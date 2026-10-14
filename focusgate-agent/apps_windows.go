//go:build windows

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows/registry"
)

// ScanApps — kompyuterdagi barcha dasturlar: Start menyusi + ish stoli yorliqlari, Uninstall yozuvlari, ishlab turganlar.
func ScanApps() []InstalledApp {
	l := NewAppList()
	var dirs []string
	for _, p := range []struct{ env, sub string }{
		{"APPDATA", `Microsoft\Windows\Start Menu\Programs`},
		{"ProgramData", `Microsoft\Windows\Start Menu\Programs`},
		{"USERPROFILE", `Desktop`},
		{"PUBLIC", `Desktop`},
	} {
		if v := os.Getenv(p.env); v != "" {
			dirs = append(dirs, filepath.Join(v, p.sub))
		}
	}
	for _, d := range dirs {
		_ = filepath.WalkDir(d, func(path string, de fs.DirEntry, err error) error {
			if err != nil || de.IsDir() || !strings.EqualFold(filepath.Ext(path), ".lnk") {
				return nil
			}
			if info, err := de.Info(); err != nil || info.Size() > 1<<16 {
				return nil
			}
			b, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			if t := LnkApp(b, filepath.Dir(path), expandEnv); t != "" {
				l.Add(t, strings.TrimSuffix(de.Name(), filepath.Ext(de.Name())))
			}
			return nil
		})
	}
	for _, root := range []registry.Key{registry.CURRENT_USER, registry.LOCAL_MACHINE} {
		for _, path := range []string{`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`, `SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`} {
			k, err := registry.OpenKey(root, path, registry.ENUMERATE_SUB_KEYS|registry.QUERY_VALUE)
			if err != nil {
				continue
			}
			names, _ := k.ReadSubKeyNames(-1)
			for _, n := range names {
				sk, err := registry.OpenKey(k, n, registry.QUERY_VALUE)
				if err != nil {
					continue
				}
				if sc, _, err := sk.GetIntegerValue("SystemComponent"); err == nil && sc == 1 {
					sk.Close()
					continue
				}
				dn, _, _ := sk.GetStringValue("DisplayName")
				icon, _, _ := sk.GetStringValue("DisplayIcon")
				sk.Close()
				if exe := ExeOfIcon(icon); exe != "" && dn != "" {
					l.Add(exe, dn)
				}
			}
			k.Close()
		}
	}
	// Microsoft Store (UWP) ilovalari: Spotify, WhatsApp, Netflix...
	for _, a := range storeApps() {
		l.Add(a.Exe, a.Name)
	}
	// Hozir ochiq oynasi bor dasturlar (portativlar ham) — fon xizmatlari kirmaydi
	win := strings.ToLower(os.Getenv("SystemRoot"))
	vis := VisibleWindowPIDs()
	for _, pids := range Processes() {
		for _, pid := range pids {
			if !vis[pid] {
				continue
			}
			p := processPath(pid)
			if p == "" || (win != "" && strings.HasPrefix(strings.ToLower(p), win)) {
				break
			}
			l.Add(p, FileDescription(p))
			break
		}
	}
	list := l.List()
	paths := l.Paths()
	cats := map[string]string{}
	for i := range list {
		list[i].Icon = IconPNG(paths[list[i].Exe])
		cats[list[i].Exe] = list[i].Cat
	}
	st.mu.Lock()
	st.AppCats = cats
	st.mu.Unlock()
	return list
}

func expandEnv(s string) string {
	if v, err := registry.ExpandString(s); err == nil {
		return v
	}
	return s
}

// storeApps — PowerShell orqali o'rnatilgan Store ilovalari (manifestdagi Executable va nomi).
func storeApps() []InstalledApp {
	ps := `$ErrorActionPreference='SilentlyContinue'; $r=@(); Get-AppxPackage -PackageTypeFilter Main | Where-Object { -not $_.IsFramework -and $_.SignatureKind -ne 'System' } | ForEach-Object { $p=$_; $m=Get-AppxPackageManifest $p; if ($m) { foreach ($a in $m.Package.Applications.Application) { if ($a.Executable) { $n=[string]$m.Package.Properties.DisplayName; if (-not $n -or $n -like 'ms-resource*') { $n=($p.Name -split '\.')[-1] }; $r += [pscustomobject]@{ exe=(Split-Path $a.Executable -Leaf); name=$n } } } } }; ConvertTo-Json -InputObject $r -Compress`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	done := make(chan []byte, 1)
	go func() { out, _ := cmd.Output(); done <- out }()
	var out []byte
	select {
	case out = <-done:
	case <-time.After(40 * time.Second):
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return nil
	}
	var list []InstalledApp
	if json.Unmarshal(out, &list) != nil {
		return nil
	}
	return list
}

// ---------- Avtoyangilanish: downloads/version.json ----------
type updateInfo struct {
	Version string `json:"version"`
	SHA256  string `json:"sha256"`
	URL     string `json:"url"`
}

func newer(a, b string) bool { // a > b ?
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

func installedPath() string {
	base, err := os.UserCacheDir()
	if err != nil {
		return ""
	}
	return filepath.Join(base, "Programs", "LevelUpDay Focusgate", "Focusgate.exe")
}

// CheckUpdate — yangi versiya bo'lsa yuklab oladi, sha256 ni tekshiradi, o'zini almashtiradi va qayta ishga tushadi.
func CheckUpdate() bool {
	if !strings.EqualFold(filepath.Clean(exePath), filepath.Clean(installedPath())) {
		return false // faqat o'rnatilgan nusxa yangilanadi
	}
	c := &http.Client{Timeout: 60 * time.Second}
	res, err := c.Get(AppURL + "downloads/version.json?t=" + strconv.FormatInt(time.Now().Unix(), 10))
	if err != nil {
		return false
	}
	var u updateInfo
	err = json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&u)
	res.Body.Close()
	if err != nil || !newer(u.Version, Version) || len(u.SHA256) != 64 {
		return false
	}
	url := u.URL
	if url == "" {
		url = AppURL + "downloads/Focusgate.exe"
	}
	res, err = c.Get(url + "?v=" + u.Version)
	if err != nil {
		return false
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return false
	}
	dir := filepath.Dir(exePath)
	tmp := filepath.Join(dir, "Focusgate.new.exe")
	f, err := os.Create(tmp)
	if err != nil {
		return false
	}
	h := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, h), io.LimitReader(res.Body, 64<<20))
	f.Close()
	if err != nil || !strings.EqualFold(hex.EncodeToString(h.Sum(nil)), u.SHA256) {
		_ = os.Remove(tmp)
		return false
	}
	old := filepath.Join(dir, "Focusgate.old.exe")
	_ = os.Remove(old)
	if os.Rename(exePath, old) != nil { // ishlab turgan exe ni nomini o'zgartirish mumkin
		_ = os.Remove(tmp)
		return false
	}
	if os.Rename(tmp, exePath) != nil {
		_ = os.Rename(old, exePath)
		return false
	}
	_ = st.Save()
	if exec.Command(exePath, "--background", "--updated").Start() != nil {
		return false
	}
	return true
}

func cleanupOld() {
	_ = os.Remove(filepath.Join(filepath.Dir(exePath), "Focusgate.old.exe"))
	_ = os.Remove(filepath.Join(filepath.Dir(exePath), "Focusgate.new.exe"))
}
