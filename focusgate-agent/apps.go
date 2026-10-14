// O'rnatilgan dasturlar ro'yxati: Start menyusi yorliqlari (.lnk), ro'yxatga olish kitobidagi
// "Uninstall" yozuvlari va ishlab turgan jarayonlar. Bu fayl platformaga bog'liq emas (test qilinadi).
package main

import (
	"encoding/binary"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode/utf16"
)

type InstalledApp struct {
	Exe  string `json:"exe"`            // kichik harflarda: discord.exe
	Name string `json:"name"`           // Discord
	Cat  string `json:"cat,omitempty"`  // avtomatik kategoriya
	Icon string `json:"icon,omitempty"` // data:image/png;base64,... (32×32)
	path string
}

// Lnk — yorliq (.lnk, MS-SHLLINK) ichidan kerakli maydonlar.
type Lnk struct {
	Target  string // LinkInfo dagi to'liq yo'l
	Rel     string // RELATIVE_PATH (yorliq joylashgan papkaga nisbatan)
	WorkDir string
	Args    string
	EnvPath string // EnvironmentVariableDataBlock: %ProgramFiles%\App\app.exe
}

// ParseLnk — yorliqni o'qiydi (noto'g'ri fayl bo'lsa ok=false).
func ParseLnk(b []byte) (Lnk, bool) {
	var l Lnk
	if len(b) < 0x4C || binary.LittleEndian.Uint32(b[0:4]) != 0x4C {
		return l, false
	}
	flags := binary.LittleEndian.Uint32(b[0x14:0x18])
	off := 0x4C
	if flags&0x1 != 0 { // HasLinkTargetIDList
		if off+2 > len(b) {
			return l, false
		}
		off += 2 + int(binary.LittleEndian.Uint16(b[off:off+2]))
	}
	if flags&0x2 != 0 { // HasLinkInfo
		if off+4 > len(b) {
			return l, false
		}
		size := int(binary.LittleEndian.Uint32(b[off : off+4]))
		if size < 0x1C || off+size > len(b) {
			return l, false
		}
		l.Target = linkInfoPath(b[off : off+size])
		off += size
	}
	uni := flags&0x80 != 0
	for _, bit := range []uint32{0x4, 0x8, 0x10, 0x20, 0x40} { // NAME, RELATIVE_PATH, WORKING_DIR, ARGUMENTS, ICON_LOCATION
		if flags&bit == 0 {
			continue
		}
		if off+2 > len(b) {
			return l, true
		}
		n := int(binary.LittleEndian.Uint16(b[off : off+2]))
		off += 2
		sz := n
		if uni {
			sz = n * 2
		}
		if off+sz > len(b) {
			return l, true
		}
		var v string
		if uni {
			v = utf16z(append(append([]byte{}, b[off:off+sz]...), 0, 0))
		} else {
			v = string(b[off : off+sz])
		}
		switch bit {
		case 0x8:
			l.Rel = v
		case 0x10:
			l.WorkDir = v
		case 0x20:
			l.Args = v
		}
		off += sz
	}
	// ExtraData bloklari: EnvironmentVariableDataBlock (0xA0000001) — 260 bayt ANSI + 520 bayt Unicode
	for off+8 <= len(b) {
		size := int(binary.LittleEndian.Uint32(b[off : off+4]))
		if size < 4 || off+size > len(b) {
			break
		}
		sig := binary.LittleEndian.Uint32(b[off+4 : off+8])
		if sig == 0xA0000001 && size >= 0x314 {
			l.EnvPath = utf16z(b[off+8+260 : off+size])
			if l.EnvPath == "" {
				l.EnvPath = cstr(b[off+8 : off+8+260])
			}
		}
		off += size
	}
	return l, true
}

func linkInfoPath(li []byte) string {
	hdr := int(binary.LittleEndian.Uint32(li[4:8]))
	if binary.LittleEndian.Uint32(li[8:12])&0x1 == 0 { // VolumeIDAndLocalBasePath
		return ""
	}
	base, suffix := "", ""
	if hdr >= 0x24 && len(li) >= 0x24 {
		if o := int(binary.LittleEndian.Uint32(li[0x1C:0x20])); o > 0 && o < len(li) {
			base = utf16z(li[o:])
		}
		if o := int(binary.LittleEndian.Uint32(li[0x20:0x24])); o > 0 && o < len(li) {
			suffix = utf16z(li[o:])
		}
	}
	if base == "" {
		if o := int(binary.LittleEndian.Uint32(li[0x10:0x14])); o > 0 && o < len(li) {
			base = cstr(li[o:])
		}
		if o := int(binary.LittleEndian.Uint32(li[0x18:0x1C])); o > 0 && o < len(li) {
			suffix = cstr(li[o:])
		}
	}
	if base == "" {
		return ""
	}
	if suffix != "" && !strings.HasSuffix(base, `\`) {
		base += `\`
	}
	return base + suffix
}

// WinJoin — Windows yo'llarini birlashtiradi: WinJoin(`C:\a\b`, `..\c\d.exe`) = `C:\a\c\d.exe`
func WinJoin(dir, rel string) string {
	if len(rel) > 1 && (rel[1] == ':' || strings.HasPrefix(rel, `\\`)) {
		return rel
	}
	parts := strings.Split(strings.TrimRight(dir, `\`), `\`)
	for _, p := range strings.Split(rel, `\`) {
		switch p {
		case "", ".":
		case "..":
			if len(parts) > 1 {
				parts = parts[:len(parts)-1]
			}
		default:
			parts = append(parts, p)
		}
	}
	return strings.Join(parts, `\`)
}

// LnkApp — yorliq qaysi dasturni ochadi. lnkDir — yorliq turgan papka, expand — %ENV% larni ochadi.
// Squirrel o'rnatuvchilar (Discord, Slack...) "Update.exe --processStart X.exe" ko'rinishida — haqiqiy dastur X.exe.
func LnkApp(b []byte, lnkDir string, expand func(string) string) string {
	l, ok := ParseLnk(b)
	if !ok {
		return ""
	}
	t := l.Target
	if t == "" && l.EnvPath != "" && expand != nil {
		t = expand(l.EnvPath)
	}
	if t == "" && l.Rel != "" {
		t = WinJoin(lnkDir, l.Rel)
	}
	if t == "" {
		return ""
	}
	if strings.EqualFold(winBase(t), "update.exe") {
		if m := processStart.FindStringSubmatch(l.Args); m != nil {
			return t[:len(t)-len("update.exe")] + m[1]
		}
	}
	return t
}

// LnkTarget — yorliqning LinkInfo dagi to'liq yo'li (testlar uchun).
func LnkTarget(b []byte) string { l, _ := ParseLnk(b); return l.Target }

func winBase(p string) string { return filepath.Base(strings.ReplaceAll(p, `\`, "/")) }

var processStart = regexp.MustCompile(`(?i)--processStart\s+"?([^"\s]+\.exe)`)

func cstr(b []byte) string {
	for i, c := range b {
		if c == 0 {
			return string(b[:i])
		}
	}
	return string(b)
}

func utf16z(b []byte) string {
	var u []uint16
	for i := 0; i+1 < len(b); i += 2 {
		c := binary.LittleEndian.Uint16(b[i:])
		if c == 0 {
			break
		}
		u = append(u, c)
	}
	return string(utf16.Decode(u))
}

// junk — ro'yxatda kerak bo'lmagan fayllar: o'chirgichlar, o'rnatuvchilar, yangilagichlar, yordamchilar.
var junk = regexp.MustCompile(`(?i)^(unins\d*|uninstall.*|uninst.*|setup.*|.*setup|install(er)?|update(r)?|.*updater|autoupdate.*|.*crash.*|.*report.*|.*helper|.*elevat.*|repair.*|vc_redist.*|dotnet.*|.*bugsplat.*|.*launcherpatcher.*|ju(check|sched)|.*service|.*svc|.*svr|.*troubleshooter|.*userps)\.exe$`)
var junkName = regexp.MustCompile(`(?i)(uninstall|удалить|o'chirish|readme|license|documentation|\bhelp\b|website|support|release notes|what's new|check for updates|update checker|scheduler|troubleshoot|reset preferences|\bservice\b|user process|co-authoring|feed ?provider|decoder config|about java)`)

// sysExe — Windows'ning ichki/yordamchi fayllari: foydalanuvchi dasturi emas.
var sysExe = map[string]bool{
	"rundll32.exe": true, "cmd.exe": true, "powershell.exe": true, "pwsh.exe": true, "msiexec.exe": true, "regsvr32.exe": true,
	"wscript.exe": true, "cscript.exe": true, "mmc.exe": true, "control.exe": true, "conhost.exe": true, "dllhost.exe": true,
	"chrome_proxy.exe": true, "msedgewebview2.exe": true, "msedge_proxy.exe": true, "systemsettings.exe": true, "textinputhost.exe": true,
	"widgetboard.exe": true, "widgets.exe": true, "searchapp.exe": true, "lockapp.exe": true, "smartscreen.exe": true, "securityhealthsystray.exe": true,
	"onedrivesetup.exe": true, "filecoauth.exe": true, "microsoftstartfeedprovider.exe": true, "crossdeviceservice.exe": true, "phoneexperiencehost.exe": true,
	"gamebar.exe": true, "gamebarftserver.exe": true, "useroobebroker.exe": true, "backgroundtaskhost.exe": true, "wmiprvse.exe": true,
}

// UsefulApp — foydalanuvchiga ko'rsatishga arziydimi?
func UsefulApp(path, name string) bool {
	exe := strings.ToLower(winBase(path))
	if !strings.HasSuffix(exe, ".exe") || junk.MatchString(exe) || Protected[exe] || sysExe[exe] || strings.HasPrefix(exe, "focusgate") {
		return false
	}
	if name != "" && junkName.MatchString(name) {
		return false
	}
	return true
}

// ExeOfIcon — Uninstall\DisplayIcon qiymatidan exe yo'li: `"C:\x\app.exe",0` → C:\x\app.exe
func ExeOfIcon(v string) string {
	v = strings.TrimSpace(v)
	if i := strings.LastIndex(v, ","); i > 0 && !strings.Contains(v[i:], `\`) {
		v = v[:i]
	}
	v = strings.Trim(v, `" `)
	if strings.HasSuffix(strings.ToLower(v), ".exe") {
		return v
	}
	return ""
}

// AppList — dublikatlarsiz, nom bo'yicha tartiblangan ro'yxat. Birinchi kelgan nom saqlanadi
// (shuning uchun avval Start menyusi — u yerdagi nomlar eng chiroyli).
type AppList struct {
	m map[string]*InstalledApp
}

func NewAppList() *AppList { return &AppList{m: map[string]*InstalledApp{}} }

func (l *AppList) Add(path, name string) {
	if path == "" || !UsefulApp(path, name) {
		return
	}
	exe := strings.ToLower(winBase(path))
	name = strings.TrimSpace(strings.TrimPrefix(name, "Запустить "))
	if name == "" || strings.EqualFold(name, exe) {
		name = strings.TrimSuffix(winBase(path), filepath.Ext(path))
	}
	if _, ok := l.m[exe]; ok {
		return
	}
	l.m[exe] = &InstalledApp{Exe: exe, Name: name, Cat: AutoCat(exe, path), path: path}
}

func (l *AppList) List() []InstalledApp {
	out := make([]InstalledApp, 0, len(l.m))
	for _, a := range l.m {
		out = append(out, *a)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out
}

// Paths — har bir ilovaning to'liq yo'li (ikonka olish uchun).
func (l *AppList) Paths() map[string]string {
	out := map[string]string{}
	for k, a := range l.m {
		out[k] = a.path
	}
	return out
}
