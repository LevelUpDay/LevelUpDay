// Linux: LevelUpDay ilovasi menyuda (.desktop), alohida oynada ochish, o'chirish, faol sessiya.
package main

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

//go:embed assets/levelupday.png
var appPNG []byte

func appIconPath() string {
	p := filepath.Join(installDir(), "levelupday.png")
	if b, err := os.ReadFile(p); err != nil || len(b) != len(appPNG) {
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		_ = os.WriteFile(p, appPNG, 0o644)
	}
	return p
}

// findBrowser — ilova oynasi (--app) uchun Chromium oilasidagi brauzer; bo'lmasa "" (oddiy brauzer tabida ochiladi).
func findBrowser() string {
	for _, b := range []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser", "microsoft-edge", "vivaldi"} {
		if p, err := exec.LookPath(b); err == nil {
			return p
		}
	}
	return ""
}

func openPair(code string) { openURL(PairURL(code)) }

func openApp(hash string) {
	u := AppURL + "?src=desktop" + hash
	if b := findBrowser(); b != "" {
		if cmd := exec.Command(b, "--app="+u); cmd.Start() == nil {
			go func() { _ = cmd.Wait() }()
			return
		}
	}
	openURL(u)
}

func menuFile() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "share", "applications", "levelupday.desktop")
}

// ensureDesktop — dasturlar menyusida "LevelUpDay" (ilovani ochadi; o'ng tugma — Focusgate'ni o'chirish).
func ensureDesktop() {
	exe := installedPath()
	if filepath.Clean(exePath) != filepath.Clean(exe) {
		return // faqat o'rnatilgan nusxa
	}
	icon := appIconPath()
	body := "[Desktop Entry]\nType=Application\nName=LevelUpDay\nComment=Tasks, focus and app blocker\n" +
		"Exec=\"" + exe + "\" --app\nIcon=" + icon + "\nTerminal=false\nCategories=Office;Education;\nStartupWMClass=levelupday\n" +
		"Actions=uninstall;\n\n[Desktop Action uninstall]\nName=" + Tr("uninst_menu") + "\nExec=\"" + exe + "\" --uninstall\n"
	f := menuFile()
	if b, err := os.ReadFile(f); err == nil && string(b) == body {
		return
	}
	_ = os.MkdirAll(filepath.Dir(f), 0o755)
	_ = os.WriteFile(f, []byte(body), 0o644)
	if p, err := exec.LookPath("update-desktop-database"); err == nil {
		_ = exec.Command(p, filepath.Dir(f)).Start()
	}
}

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
	_ = os.Remove(menuFile())
	_ = os.RemoveAll(filepath.Dir(statePath()))
	_ = os.RemoveAll(installDir()) // Linux'da ishlab turgan faylni ham o'chirish mumkin
	MessageBox("LevelUpDay", Tr("uninst_done"), 0x40)
}

// activeSession — bu foydalanuvchi hozir ekranda (loginctl: faol sessiya). Aniqlab bo'lmasa — ha.
func activeSession() bool {
	p, err := exec.LookPath("loginctl")
	if err != nil {
		return true
	}
	out, err := exec.Command(p, "show-user", os.Getenv("USER"), "-p", "State", "--value").Output()
	if err != nil {
		return true
	}
	s := strings.TrimSpace(string(out))
	return s == "" || s == "active"
}

// platformNote — toza Wayland sessiyasida faol oynani bilib bo'lmaydi: foydalanuvchiga aytamiz.
func platformNote() string {
	if waylandOnly() {
		return Tr("wayland")
	}
	return ""
}
