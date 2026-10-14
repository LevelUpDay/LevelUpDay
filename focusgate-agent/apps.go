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
	Exe  string `json:"exe"`  // kichik harflarda: discord.exe
	Name string `json:"name"` // Discord
}

// LnkTarget — Windows yorlig'i (.lnk, MS-SHLLINK) ichidan maqsad faylning to'liq yo'lini oladi.
func LnkTarget(b []byte) string { t, _ := LnkParse(b); return t }

// LnkApp — yorliq qaysi dasturni ochadi. Squirrel o'rnatuvchilar (Discord, Slack...) "Update.exe --processStart X.exe"
// ko'rinishida bo'ladi — bunda haqiqiy dastur X.exe.
func LnkApp(b []byte) string {
	t, args := LnkParse(b)
	if t == "" {
		return ""
	}
	if strings.EqualFold(filepath.Base(strings.ReplaceAll(t, `\`, "/")), "update.exe") {
		if m := processStart.FindStringSubmatch(args); m != nil {
			return t[:len(t)-len("update.exe")] + m[1]
		}
	}
	return t
}

var processStart = regexp.MustCompile(`(?i)--processStart\s+"?([^"\s]+\.exe)`)

// LnkParse — maqsad yo'li va buyruq qatori argumentlari.
func LnkParse(b []byte) (string, string) {
	t := lnkTarget(b)
	if t == "" {
		return "", ""
	}
	return t, lnkArgs(b)
}

func lnkArgs(b []byte) string {
	flags := binary.LittleEndian.Uint32(b[0x14:0x18])
	off := 0x4C
	if flags&0x1 != 0 {
		off += 2 + int(binary.LittleEndian.Uint16(b[off:off+2]))
	}
	if flags&0x2 != 0 {
		if off+4 > len(b) {
			return ""
		}
		off += int(binary.LittleEndian.Uint32(b[off : off+4]))
	}
	uni := flags&0x80 != 0
	for _, bit := range []uint32{0x4, 0x8, 0x10, 0x20} { // NAME, RELATIVE_PATH, WORKING_DIR, ARGUMENTS
		if flags&bit == 0 {
			continue
		}
		if off+2 > len(b) {
			return ""
		}
		n := int(binary.LittleEndian.Uint16(b[off : off+2]))
		off += 2
		sz := n
		if uni {
			sz = n * 2
		}
		if off+sz > len(b) {
			return ""
		}
		if bit == 0x20 {
			if uni {
				return utf16z(append(append([]byte{}, b[off:off+sz]...), 0, 0))
			}
			return string(b[off : off+sz])
		}
		off += sz
	}
	return ""
}

func lnkTarget(b []byte) string {
	if len(b) < 0x4C || binary.LittleEndian.Uint32(b[0:4]) != 0x4C {
		return ""
	}
	flags := binary.LittleEndian.Uint32(b[0x14:0x18])
	off := 0x4C
	if flags&0x1 != 0 { // HasLinkTargetIDList
		if off+2 > len(b) {
			return ""
		}
		off += 2 + int(binary.LittleEndian.Uint16(b[off:off+2]))
	}
	if flags&0x2 == 0 || off+0x1C > len(b) { // HasLinkInfo yo'q
		return ""
	}
	li := b[off:]
	size := int(binary.LittleEndian.Uint32(li[0:4]))
	hdr := int(binary.LittleEndian.Uint32(li[4:8]))
	liFlags := binary.LittleEndian.Uint32(li[8:12])
	if size > len(li) || liFlags&0x1 == 0 { // VolumeIDAndLocalBasePath
		return ""
	}
	li = li[:size]
	base, suffix := "", ""
	if hdr >= 0x24 && len(li) >= 0x24 { // Unicode yo'llar
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
var junk = regexp.MustCompile(`(?i)^(unins\d*|uninstall.*|uninst.*|setup.*|install(er)?|update(r)?|.*updater|.*crash.*|.*report.*|.*helper|.*elevat.*|repair.*|vc_redist.*|dotnet.*|msiexec|.*bugsplat.*|.*launcherpatcher.*)\.exe$`)
var junkName = regexp.MustCompile(`(?i)(uninstall|удалить|o'chirish|readme|license|documentation|help|website|support|release notes|what's new)`)

// UsefulApp — foydalanuvchiga ko'rsatishga arziydimi?
func UsefulApp(path, name string) bool {
	exe := strings.ToLower(filepath.Base(strings.ReplaceAll(path, `\`, "/")))
	if !strings.HasSuffix(exe, ".exe") || junk.MatchString(exe) || Protected[exe] {
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
	exe := strings.ToLower(filepath.Base(strings.ReplaceAll(path, `\`, "/")))
	name = strings.TrimSpace(name)
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(strings.ReplaceAll(path, `\`, "/")), filepath.Ext(path))
	}
	if _, ok := l.m[exe]; ok {
		return
	}
	l.m[exe] = &InstalledApp{Exe: exe, Name: name}
}

func (l *AppList) List() []InstalledApp {
	out := make([]InstalledApp, 0, len(l.m))
	for _, a := range l.m {
		out = append(out, *a)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out
}
