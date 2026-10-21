// Linux'ga xos qismlar: jarayonlar (/proc), bildirishnoma (D-Bus), oynacha (zenity/kdialog), avtoishga tushish (~/.config/autostart),
// bitta nusxa (flock), dastur nomlari. Dastur kalitlari Windows bilan bir xil ko'rinishda ("firefox.exe", "telegram.exe") —
// shunda saytda qo'yilgan qoida, kategoriya va ikonkalar ikkala tizimda ham ishlaydi.
package main

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/godbus/dbus/v5"
)

//go:embed assets/icon.png
var trayIcon []byte

const (
	osLabel = "Linux"
	userEnv = "USER"
)

// noTrack — vaqti hisoblanmaydigan tizim oynalari (ish stoli, panel, qulflash ekrani...)
var noTrack = map[string]bool{
	"gnome-shell.exe": true, "plasmashell.exe": true, "xfdesktop.exe": true, "xfce4-panel.exe": true, "nautilus-desktop.exe": true,
	"gnome-screensaver.exe": true, "xscreensaver.exe": true, "light-locker.exe": true, "kscreenlocker_greet.exe": true, "cinnamon.exe": true,
	"budgie-panel.exe": true, "mate-panel.exe": true, "lxpanel.exe": true, "xorg.exe": true, "xwayland.exe": true,
}

// linuxAlias — Linux'dagi jarayon/buyruq nomi → Windows'dagi kalit (bir xil dastur ikkala tizimda bitta qoida bilan bloklansin)
var linuxAlias = map[string]string{
	"google-chrome": "chrome", "google-chrome-stable": "chrome", "google-chrome-beta": "chrome", "chrome": "chrome",
	"chromium": "chrome", "chromium-browser": "chrome", "firefox-bin": "firefox", "firefox-esr": "firefox", "firefox": "firefox",
	"microsoft-edge": "msedge", "microsoft-edge-stable": "msedge", "msedge": "msedge", "brave-browser": "brave", "brave": "brave",
	"opera": "opera", "vivaldi-bin": "vivaldi", "vivaldi-stable": "vivaldi", "vivaldi": "vivaldi", "yandex_browser": "yandex", "yandex-browser": "yandex",
	"telegram-desktop": "telegram", "telegram": "telegram", "discord": "discord", "discordcanary": "discord", "code-oss": "code", "codium": "code", "code": "code",
	"obs": "obs64", "steam": "steam", "spotify": "spotify", "slack": "slack", "zoom": "zoom", "vlc": "vlc", "viber": "viber",
	"skypeforlinux": "skype", "notion-app": "notion", "obsidian": "obsidian", "blender": "blender", "anki": "anki", "teams-for-linux": "teams",
	"whatsapp-for-linux": "whatsapp", "whatsdesk": "whatsapp", "termius-app": "termius", "postman": "postman", "figma-linux": "figma",
	// Flatpak ilova identifikatorlari
	"org.telegram.desktop": "telegram", "com.discordapp.discord": "discord", "com.spotify.client": "spotify", "com.google.chrome": "chrome",
	"org.mozilla.firefox": "firefox", "com.brave.browser": "brave", "com.valvesoftware.steam": "steam", "com.visualstudio.code": "code",
	"com.obsproject.studio": "obs64", "org.videolan.vlc": "vlc", "us.zoom.zoom": "zoom", "com.slack.slack": "slack", "org.chromium.chromium": "chrome",
	"com.microsoft.edge": "msedge", "com.vivaldi.vivaldi": "vivaldi", "com.opera.opera": "opera", "md.obsidian.obsidian": "obsidian", "net.ankiweb.anki": "anki",
}

// linuxID — "/usr/lib/firefox/firefox" yoki "Telegram" → "firefox.exe" / "telegram.exe"
func linuxID(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	if a, ok := linuxAlias[n]; ok { // "org.telegram.desktop" — Flatpak ID, fayl kengaytmasi emas
		return a + ".exe"
	}
	n = strings.TrimSuffix(n, ".desktop")
	n = strings.TrimSuffix(n, ".appimage")
	n = strings.TrimSuffix(n, ".sh")
	n = strings.TrimSuffix(n, ".bin")
	if n == "" {
		return ""
	}
	if a, ok := linuxAlias[n]; ok {
		n = a
	}
	n = strings.ReplaceAll(n, " ", "-")
	return n + ".exe"
}

func init() {
	for _, k := range []string{"chrome.exe", "chromium.exe"} {
		Browsers[k] = true
	}
	for _, k := range []string{"systemd", "init", "xorg", "xwayland", "gnome-shell", "gnome-session-binary", "plasmashell", "kwin_x11", "kwin_wayland",
		"xfwm4", "xfce4-session", "cinnamon", "mutter", "dbus-daemon", "pipewire", "pulseaudio", "bash", "zsh", "fish", "sh", "sudo", "ssh",
		"gnome-terminal-server", "konsole", "xterm", "polkitd", "networkmanager", "lightdm", "gdm", "sddm", "xdg-desktop-portal", "focusgate"} {
		Protected[k+".exe"] = true
	}
	osLangFn = func() string {
		l := strings.ToLower(os.Getenv("LANG") + os.Getenv("LANGUAGE"))
		switch {
		case strings.HasPrefix(l, "uz"):
			return "uz"
		case strings.HasPrefix(l, "ru"):
			return "ru"
		}
		return "en"
	}
}

// selfExe — o'zimizning jarayon kaliti (Processes() bilan bir xil ko'rinishda)
func selfExe() string { return linuxID(filepath.Base(exePath)) }

// prettyExe — "telegram.exe" → "Telegram"
func prettyExe(exe string) string {
	n := strings.TrimSuffix(exe, ".exe")
	if n == "" {
		return n
	}
	return strings.ToUpper(n[:1]) + n[1:]
}

func openURL(u string) {
	for _, c := range [][]string{{"xdg-open", u}, {"gio", "open", u}, {"sensible-browser", u}} {
		if p, err := exec.LookPath(c[0]); err == nil {
			cmd := exec.Command(p, c[1:]...)
			if cmd.Start() == nil {
				go func() { _ = cmd.Wait() }()
				return
			}
		}
	}
}

// toast — freedesktop bildirishnomasi (GNOME, KDE, XFCE... hammasida bor).
func toast(title, body string) {
	conn, err := dbus.SessionBus()
	if err != nil {
		if p, err := exec.LookPath("notify-send"); err == nil {
			_ = exec.Command(p, "-a", "Focusgate", title, body).Start()
		}
		return
	}
	icon := filepath.Join(installDir(), "levelupday.png")
	conn.Object("org.freedesktop.Notifications", "/org/freedesktop/Notifications").Go("org.freedesktop.Notifications.Notify", 0, nil,
		"Focusgate", uint32(0), icon, title, body, []string{}, map[string]dbus.Variant{}, int32(7000))
}

// ---------- Jarayonlar (/proc) ----------
var myUID = uint32(os.Getuid())

func procExe(pid uint32) string {
	p, err := os.Readlink("/proc/" + strconv.Itoa(int(pid)) + "/exe")
	if err != nil {
		return ""
	}
	return strings.TrimSuffix(p, " (deleted)")
}

// procName — jarayon nomi: exe fayli (o'qib bo'lmasa — comm)
func procName(pid uint32) string {
	if p := procExe(pid); p != "" {
		return filepath.Base(p)
	}
	b, err := os.ReadFile("/proc/" + strconv.Itoa(int(pid)) + "/comm")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// Processes — SHU foydalanuvchining jarayonlari: kalit (firefox.exe) → PID'lar. Boshqa foydalanuvchilarnikiga tegilmaydi.
func Processes() map[string][]uint32 {
	out := map[string][]uint32{}
	ents, err := os.ReadDir("/proc")
	if err != nil {
		return out
	}
	for _, e := range ents {
		pid64, err := strconv.ParseUint(e.Name(), 10, 32)
		if err != nil {
			continue
		}
		fi, err := os.Stat("/proc/" + e.Name())
		if err != nil {
			continue
		}
		if s, ok := fi.Sys().(*syscall.Stat_t); !ok || s.Uid != myUID {
			continue
		}
		pid := uint32(pid64)
		n := procName(pid)
		if n == "" {
			continue
		}
		id := linuxID(n)
		out[id] = append(out[id], pid)
	}
	return out
}

// Kill — jarayonni yopadi (avval SIGTERM, 2 s dan keyin ham tirik bo'lsa — SIGKILL).
func Kill(pid uint32) error {
	if err := syscall.Kill(int(pid), syscall.SIGTERM); err != nil {
		return err
	}
	go func() {
		for i := 0; i < 20; i++ {
			if syscall.Kill(int(pid), 0) != nil {
				return
			}
			time.Sleep(100 * time.Millisecond)
		}
		_ = syscall.Kill(int(pid), syscall.SIGKILL)
	}()
	return nil
}

// ---------- Bitta nusxa ----------
var lockFile *os.File

func SingleInstance() bool {
	dir := os.Getenv("XDG_RUNTIME_DIR")
	if dir == "" {
		dir = os.TempDir()
	}
	f, err := os.OpenFile(filepath.Join(dir, "levelupday-focusgate-"+strconv.Itoa(os.Getuid())+".lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return true
	}
	if syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		f.Close()
		return false
	}
	lockFile = f // ochiq qoladi — jarayon tugaguncha qulf ushlanadi
	return true
}

// MessageBox — oddiy oyna (zenity / kdialog / xmessage). Qaytaradi: 1=OK, 6=Yes, 7=No.
// flags (Windows bilan bir xil): 0x04 yoki 0x03 — Ha/Yo'q savoli, aks holda — ma'lumot.
// Hech biri o'rnatilmagan bo'lsa — bildirishnoma chiqadi va "Ha" qaytadi (foydalanuvchi qamalib qolmasin).
func MessageBox(title, text string, flags uintptr) int {
	q := flags&0x0f == 0x04 || flags&0x0f == 0x03
	if p, err := exec.LookPath("zenity"); err == nil {
		args := []string{"--title=" + title, "--text=" + text, "--no-markup", "--width=380"}
		if q {
			args = append([]string{"--question", "--ok-label=" + Tr("yes"), "--cancel-label=" + Tr("no")}, args...)
		} else {
			args = append([]string{"--warning"}, args...)
		}
		if err := exec.Command(p, args...).Run(); err == nil {
			if q {
				return 6
			}
			return 1
		}
		if q {
			return 7
		}
		return 1
	}
	if p, err := exec.LookPath("kdialog"); err == nil {
		args := []string{"--title", title, "--sorry", text}
		if q {
			args = []string{"--title", title, "--yesno", text}
		}
		if err := exec.Command(p, args...).Run(); err == nil {
			if q {
				return 6
			}
			return 1
		}
		if q {
			return 7
		}
		return 1
	}
	toast(title, text)
	if q {
		return 6
	}
	return 1
}

// FileDescription — dasturning chiroyli nomi (.desktop faylidagi Name): "Telegram Desktop", "Google Chrome".
var (
	descMu   sync.Mutex
	descByID = map[string]string{}
	descScan bool
)

func FileDescription(path string) string {
	if path == "" {
		return ""
	}
	id := linuxID(filepath.Base(path))
	descMu.Lock()
	need := !descScan
	descScan = true
	descMu.Unlock()
	if need {
		for _, a := range desktopEntries() {
			descMu.Lock()
			if _, ok := descByID[a.id]; !ok {
				descByID[a.id] = a.name
			}
			descMu.Unlock()
		}
	}
	descMu.Lock()
	defer descMu.Unlock()
	return descByID[id]
}

// ---------- Avtoishga tushish (~/.config/autostart) ----------
func autostartFile() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "autostart", "levelupday-focusgate.desktop")
}

func AutostartEnabled() bool {
	f := autostartFile()
	if f == "" {
		return false
	}
	_, err := os.Stat(f)
	return err == nil
}

func SetAutostart(on bool, exe string) error {
	f := autostartFile()
	if f == "" {
		return os.ErrNotExist
	}
	if !on {
		err := os.Remove(f)
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	_ = os.MkdirAll(filepath.Dir(f), 0o755)
	body := "[Desktop Entry]\nType=Application\nName=LevelUpDay Focusgate\nComment=App & site blocker\n" +
		"Exec=\"" + exe + "\" --background\nIcon=" + filepath.Join(installDir(), "levelupday.png") + "\nTerminal=false\nX-GNOME-Autostart-enabled=true\nX-GNOME-Autostart-Delay=5\n"
	return os.WriteFile(f, []byte(body), 0o644)
}
