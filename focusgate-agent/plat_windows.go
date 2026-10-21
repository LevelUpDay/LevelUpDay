//go:build windows

// Windows'ga xos kichik qismlar: tray ikonkasi, URL ochish, toast bildirishnoma, tizim oynalari.
package main

import (
	_ "embed"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

//go:embed assets/icon.ico
var trayIcon []byte

const (
	osLabel = "Windows"
	userEnv = "USERNAME"
)

// noTrack — vaqti hisoblanmaydigan tizim oynalari (Start menyusi, qidiruv, qulflangan ekran...)
var noTrack = map[string]bool{
	"lockapp.exe": true, "shellexperiencehost.exe": true, "startmenuexperiencehost.exe": true, "searchhost.exe": true,
	"searchapp.exe": true, "textinputhost.exe": true, "applicationframehost.exe": true, "logonui.exe": true,
}

// selfExe — o'zimizning jarayon nomi (Processes() kalitlari bilan bir xil ko'rinishda)
func selfExe() string { return strings.ToLower(filepath.Base(exePath)) }

func prettyExe(exe string) string { return strings.TrimSuffix(exe, ".exe") }

func openURL(u string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}

// toast — Windows bildirishnomasi (PowerShell orqali; konsol oynasi ko'rinmaydi).
func toast(title, body string) {
	esc := func(s string) string {
		r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "'", "&apos;", "\"", "&quot;")
		return strings.ReplaceAll(r.Replace(s), "'", "''")
	}
	ps := `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;` +
		`[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null;` +
		`$x = New-Object Windows.Data.Xml.Dom.XmlDocument;` +
		`$x.LoadXml('<toast><visual><binding template="ToastGeneric"><text>` + esc(title) + `</text><text>` + esc(body) + `</text></binding></visual></toast>');` +
		`[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	_ = cmd.Start()
	go func() { _ = cmd.Wait() }()
}

// platformNote — ishga tushganda bir marta ko'rsatiladigan ogohlantirish (Windows'da yo'q).
func platformNote() string { return "" }
