//go:build windows

// LevelUpDay ilovasi kompyuterda: Telegram kabi alohida oyna, Ish stoli va Start menyusidagi yorliq,
// "Dasturlar va xususiyatlar" dagi yozuv (o'chirish bilan). Focusgate shu bitta o'rnatuvchi bilan birga o'rnatiladi.
package main

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows/registry"
)

//go:embed assets/levelupday.ico
var appICO []byte

const uninstKey = `Software\Microsoft\Windows\CurrentVersion\Uninstall\LevelUpDay`

func installDir() string { return filepath.Dir(installedPath()) }

func appIconPath() string {
	p := filepath.Join(installDir(), "LevelUpDay.ico")
	if b, err := os.ReadFile(p); err != nil || len(b) != len(appICO) {
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		_ = os.WriteFile(p, appICO, 0o644)
	}
	return p
}

// findBrowser — ilova oynasi uchun Chrome (foydalanuvchi akkaunti odatda shu yerda), bo'lmasa Edge (Windows'da doim bor).
func findBrowser() string {
	var c []string
	for _, env := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
		if b := os.Getenv(env); b != "" {
			c = append(c, filepath.Join(b, `Google\Chrome\Application\chrome.exe`))
		}
	}
	for _, env := range []string{"PROGRAMFILES(X86)", "PROGRAMFILES"} {
		if b := os.Getenv(env); b != "" {
			c = append(c, filepath.Join(b, `Microsoft\Edge\Application\msedge.exe`))
		}
	}
	for _, p := range c {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	return ""
}

// openApp — LevelUpDay'ni alohida ilova oynasida ochadi (manzil qatori va tablarsiz).
// installedPWA — LevelUpDay brauzer orqali ilova sifatida o'rnatilgan bo'lsa: brauzer exe va profil papkasi.
func installedPWA() (exe, profile string) {
	id := ChromeAppID(ManifestID)
	pwaID = id
	la := os.Getenv("LOCALAPPDATA")
	for _, b := range []struct{ data, exe string }{
		{filepath.Join(la, `Google\Chrome\User Data`), "chrome"},
		{filepath.Join(la, `Microsoft\Edge\User Data`), "msedge"},
		{filepath.Join(la, `BraveSoftware\Brave-Browser\User Data`), "brave"},
	} {
		ents, err := os.ReadDir(b.data)
		if err != nil {
			continue
		}
		for _, e := range ents {
			n := e.Name()
			if !e.IsDir() || (n != "Default" && !strings.HasPrefix(n, "Profile ")) {
				continue
			}
			if _, err := os.Stat(filepath.Join(b.data, n, "Web Applications", "Manifest Resources", id)); err != nil {
				continue
			}
			if p := browserExe(b.exe); p != "" {
				return p, n
			}
		}
	}
	// Zaxira: Start menyusidagi "Chrome Apps/Edge Apps" yorlig'idan (--profile-directory=… --app-id=…)
	for _, dir := range []string{"Chrome Apps", "Edge Apps", "Brave Apps"} {
		b, err := os.ReadFile(filepath.Join(startMenuDir(), dir, "LevelUpDay.lnk"))
		if err != nil {
			continue
		}
		txt := strings.ReplaceAll(string(b), "\x00", "")
		m := lnkArgs.FindStringSubmatch(txt)
		if m == nil {
			continue
		}
		kind := map[string]string{"Chrome Apps": "chrome", "Edge Apps": "msedge", "Brave Apps": "brave"}[dir]
		if p := browserExe(kind); p != "" {
			pwaID = m[2]
			return p, m[1]
		}
	}
	return "", ""
}

var lnkArgs = regexp.MustCompile(`--profile-directory="?([^"\s]+(?: \d+)?)"?\s+--app-id=([a-p]{32})`)
var pwaID = ""

func browserExe(kind string) string {
	var c []string
	switch kind {
	case "chrome":
		for _, env := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
			c = append(c, filepath.Join(os.Getenv(env), `Google\Chrome\Application\chrome.exe`))
		}
	case "msedge":
		for _, env := range []string{"PROGRAMFILES(X86)", "PROGRAMFILES"} {
			c = append(c, filepath.Join(os.Getenv(env), `Microsoft\Edge\Application\msedge.exe`))
		}
	case "brave":
		for _, env := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"} {
			c = append(c, filepath.Join(os.Getenv(env), `BraveSoftware\Brave-Browser\Application\brave.exe`))
		}
	}
	for _, p := range c {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	return ""
}

// openInstalledApp — o'rnatilgan LevelUpDay ilovasini (PWA) shu manzilda ochadi. O'rnatilmagan bo'lsa false.
func openInstalledApp(u string) bool {
	exe, prof := installedPWA()
	if exe == "" {
		return false
	}
	cmd := exec.Command(exe, "--profile-directory="+prof, "--app-id="+pwaID, "--app-launch-url-for-shortcuts-menu-item="+u)
	return cmd.Start() == nil
}

// openPair — "Ulash" tasdig'i: o'rnatilgan LevelUpDay ilovasida, bo'lmasa oddiy brauzer tabida.
func openPair(code string) {
	if !openInstalledApp(AppURL + "?src=desktop#fgpair=" + code) {
		openURL(PairURL(code))
	}
}

func openApp(hash string) {
	u := AppURL + "?src=desktop" + hash
	if openInstalledApp(u) {
		return
	}
	if b := findBrowser(); b != "" {
		cmd := exec.Command(b, "--app="+u)
		if cmd.Start() == nil {
			return
		}
	}
	openURL(u)
}

// shortcut — .lnk yaratadi (WScript.Shell orqali).
func shortcut(lnk, target, args, icon, desc string) error {
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
	ps := `$s=(New-Object -ComObject WScript.Shell).CreateShortcut(` + q(lnk) + `);$s.TargetPath=` + q(target) +
		`;$s.Arguments=` + q(args) + `;$s.IconLocation=` + q(icon+",0") + `;$s.Description=` + q(desc) +
		`;$s.WorkingDirectory=` + q(filepath.Dir(target)) + `;$s.Save()`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}

func desktopDir() string {
	if k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if v, _, err := k.GetStringValue("Desktop"); err == nil && v != "" {
			if e, err := registry.ExpandString(v); err == nil && e != "" {
				return e
			}
		}
	}
	return filepath.Join(os.Getenv("USERPROFILE"), "Desktop")
}
func startMenuDir() string {
	return filepath.Join(os.Getenv("APPDATA"), `Microsoft\Windows\Start Menu\Programs`)
}
func shortcutPaths() []string {
	return []string{filepath.Join(startMenuDir(), "LevelUpDay.lnk"), filepath.Join(desktopDir(), "LevelUpDay.lnk")}
}

// ensureDesktop — yorliqlar va "Dasturlar" yozuvi. Ish stolidagi yorliq faqat bir marta yaratiladi
// (foydalanuvchi o'chirib tashlasa, qaytib chiqmaydi); Start menyusidagisi doim tiklanadi.
func ensureDesktop() {
	exe := installedPath()
	if !strings.EqualFold(filepath.Clean(exePath), filepath.Clean(exe)) {
		return // faqat o'rnatilgan nusxa
	}
	icon := appIconPath()
	marker := filepath.Join(installDir(), "shortcuts.v1")
	paths := shortcutPaths()
	for i, lnk := range paths {
		if i == 1 {
			if _, err := os.Stat(marker); err == nil {
				continue
			}
		} else if _, err := os.Stat(lnk); err == nil {
			continue
		}
		_ = shortcut(lnk, exe, "--app", icon, "LevelUpDay")
	}
	_ = os.WriteFile(marker, []byte(Version), 0o644)
	registerUninstall(exe, icon)
}

func registerUninstall(exe, icon string) {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, uninstKey, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer k.Close()
	_ = k.SetStringValue("DisplayName", "LevelUpDay")
	_ = k.SetStringValue("DisplayVersion", Version)
	_ = k.SetStringValue("Publisher", "LevelUpDay")
	_ = k.SetStringValue("DisplayIcon", icon)
	_ = k.SetStringValue("URLInfoAbout", AppURL)
	_ = k.SetStringValue("InstallLocation", filepath.Dir(exe))
	_ = k.SetStringValue("UninstallString", `"`+exe+`" --uninstall`)
	_ = k.SetDWordValue("NoModify", 1)
	_ = k.SetDWordValue("NoRepair", 1)
	if fi, err := os.Stat(exe); err == nil {
		_ = k.SetDWordValue("EstimatedSize", uint32(fi.Size()/1024))
	}
}

// uninstall — "Dasturlar va xususiyatlar" → O'chirish. Qat'iy rejimdagi fokus paytida o'chirib bo'lmaydi.
func uninstall() {
	s := LoadState()
	SetLang(s.Config.Lang)
	if s.Config.Strict && s.Config.FocusUntil > time.Now().UnixMilli() {
		MessageBox("LevelUpDay", Tr("strict_uninst"), 0x30)
		return
	}
	if MessageBox("LevelUpDay", Tr("uninst_confirm"), 0x04|0x20) != 6 {
		return
	}
	killOthers()
	_ = SetAutostart(false, "")
	for _, p := range shortcutPaths() {
		_ = os.Remove(p)
	}
	_ = registry.DeleteKey(registry.CURRENT_USER, uninstKey)
	_ = os.RemoveAll(filepath.Dir(statePath()))
	// O'zini o'chirish: jarayon tugagach papka o'chiriladi
	dir := installDir()
	cmd := exec.Command("cmd.exe", "/C", "ping -n 3 127.0.0.1 >nul & rmdir /S /Q \""+dir+"\"")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
	MessageBox("LevelUpDay", Tr("uninst_done"), 0x40)
}
