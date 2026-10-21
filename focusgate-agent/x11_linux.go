// Linux: faol oyna, bo'sh turish vaqti, tabni yopish, oynani yig'ish — X11 orqali (Xorg sessiyasi yoki XWayland oynalari).
// Toza Wayland'da faol oynani bilib bo'lmaydi: u holda vaqt hisoblanmaydi, lekin dasturlarni bloklash (jarayonni yopish) ishlayveradi.
package main

import (
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/godbus/dbus/v5"
	"github.com/jezek/xgb"
	"github.com/jezek/xgb/screensaver"
	"github.com/jezek/xgb/xproto"
	"github.com/jezek/xgb/xtest"
)

// Foreground — hozir faol oyna haqida ma'lumot.
type Foreground struct {
	HWND  uintptr // X11 oyna identifikatori
	PID   uint32
	Path  string // to'liq yo'l (/usr/lib/firefox/firefox)
	Exe   string // Windows bilan bir xil kalit: firefox.exe (linuxID)
	Title string
}

var (
	xMu    sync.Mutex
	xc     *xgb.Conn
	xRoot  xproto.Window
	xSS    bool // screensaver kengaytmasi bor
	xTest  bool // XTEST (klaviatura bosish) bor
	xAtoms = map[string]xproto.Atom{}
	xTried bool
)

// xconn — X serverga bitta ulanish (uzilsa — qayta ulanadi).
func xconn() *xgb.Conn {
	if xc != nil {
		return xc
	}
	if os.Getenv("DISPLAY") == "" {
		if !xTried {
			xTried = true
			_ = os.Setenv("DISPLAY", ":0") // autostart'da DISPLAY bo'lmasligi mumkin
		} else {
			return nil
		}
	}
	c, err := xgb.NewConn()
	if err != nil {
		return nil
	}
	xc = c
	xRoot = xproto.Setup(c).DefaultScreen(c).Root
	xSS = screensaver.Init(c) == nil
	xTest = xtest.Init(c) == nil
	xAtoms = map[string]xproto.Atom{}
	return xc
}

func xdrop() {
	if xc != nil {
		xc.Close()
		xc = nil
	}
}

func atom(c *xgb.Conn, name string) xproto.Atom {
	if a, ok := xAtoms[name]; ok {
		return a
	}
	r, err := xproto.InternAtom(c, false, uint16(len(name)), name).Reply()
	if err != nil {
		return 0
	}
	xAtoms[name] = r.Atom
	return r.Atom
}

func prop(c *xgb.Conn, w xproto.Window, name string) *xproto.GetPropertyReply {
	r, err := xproto.GetProperty(c, false, w, atom(c, name), xproto.GetPropertyTypeAny, 0, 1024).Reply()
	if err != nil || r == nil || r.ValueLen == 0 {
		return nil
	}
	return r
}

// GetForeground — faol oyna (_NET_ACTIVE_WINDOW) → PID (_NET_WM_PID) → /proc/PID/exe.
func GetForeground() (Foreground, bool) {
	xMu.Lock()
	defer xMu.Unlock()
	c := xconn()
	if c == nil {
		return Foreground{}, false
	}
	r := prop(c, xRoot, "_NET_ACTIVE_WINDOW")
	if r == nil || len(r.Value) < 4 {
		if r == nil {
			// Ulanish uzilgan bo'lishi mumkin (sessiya almashdi) — keyingi safar qayta ulanamiz
			if _, err := xproto.GetInputFocus(c).Reply(); err != nil {
				xdrop()
			}
		}
		return Foreground{}, false
	}
	w := xproto.Window(xgb.Get32(r.Value))
	if w == 0 {
		return Foreground{}, false
	}
	var pid uint32
	if p := prop(c, w, "_NET_WM_PID"); p != nil && len(p.Value) >= 4 {
		pid = xgb.Get32(p.Value)
	}
	title := ""
	if t := prop(c, w, "_NET_WM_NAME"); t != nil {
		title = string(t.Value)
	} else if t := prop(c, w, "WM_NAME"); t != nil {
		title = string(t.Value)
	}
	if pid == 0 {
		return Foreground{}, false
	}
	path := procExe(pid)
	exe := ""
	if path != "" {
		exe = linuxID(filepath.Base(path))
	} else if cls := prop(c, w, "WM_CLASS"); cls != nil { // Flatpak/boshqa nom maydoni: oyna sinfidan
		parts := strings.Split(strings.TrimRight(string(cls.Value), "\x00"), "\x00")
		exe = linuxID(parts[len(parts)-1])
	}
	if exe == "" {
		return Foreground{}, false
	}
	return Foreground{HWND: uintptr(w), PID: pid, Path: path, Exe: exe, Title: title}, true
}

// IdleSeconds — klaviatura/sichqoncha oxirgi marta qachon ishlatilgan (X11 ScreenSaver yoki GNOME Mutter).
func IdleSeconds() uint32 {
	xMu.Lock()
	c := xconn()
	if c != nil && xSS {
		r, err := screensaver.QueryInfo(c, xproto.Drawable(xRoot)).Reply()
		xMu.Unlock()
		if err == nil {
			return r.MsSinceUserInput / 1000
		}
	} else {
		xMu.Unlock()
	}
	if conn, err := dbus.SessionBus(); err == nil {
		var ms uint64
		if conn.Object("org.gnome.Mutter.IdleMonitor", "/org/gnome/Mutter/IdleMonitor/Core").Call("org.gnome.Mutter.IdleMonitor.GetIdletime", 0).Store(&ms) == nil {
			return uint32(ms / 1000)
		}
	}
	return 0
}

// keycode — keysym uchun klaviatura kodi.
func keycode(c *xgb.Conn, sym xproto.Keysym) xproto.Keycode {
	s := xproto.Setup(c)
	n := byte(s.MaxKeycode - s.MinKeycode + 1)
	r, err := xproto.GetKeyboardMapping(c, s.MinKeycode, n).Reply()
	if err != nil || r.KeysymsPerKeycode == 0 {
		return 0
	}
	per := int(r.KeysymsPerKeycode)
	for i := 0; i < int(n); i++ {
		for j := 0; j < per && i*per+j < len(r.Keysyms); j++ {
			if r.Keysyms[i*per+j] == sym {
				return xproto.Keycode(int(s.MinKeycode) + i)
			}
		}
	}
	return 0
}

// CloseTab — faol brauzer oynasida Ctrl+W (joriy tabni yopish).
func CloseTab() {
	xMu.Lock()
	defer xMu.Unlock()
	c := xconn()
	if c == nil || !xTest {
		return
	}
	ctrl, w := keycode(c, 0xffe3 /*Control_L*/), keycode(c, 0x0077 /*w*/)
	if ctrl == 0 || w == 0 {
		return
	}
	press := func(t byte, k xproto.Keycode) { xtest.FakeInput(c, t, byte(k), 0, xRoot, 0, 0, 0) }
	press(xproto.KeyPress, ctrl)
	press(xproto.KeyPress, w)
	press(xproto.KeyRelease, w)
	press(xproto.KeyRelease, ctrl)
	c.Sync()
}

func clientMsg(c *xgb.Conn, w xproto.Window, typ string, data ...uint32) {
	for len(data) < 5 {
		data = append(data, 0)
	}
	ev := xproto.ClientMessageEvent{Format: 32, Window: w, Type: atom(c, typ), Data: xproto.ClientMessageDataUnionData32New(data)}
	xproto.SendEvent(c, false, xRoot, xproto.EventMaskSubstructureRedirect|xproto.EventMaskSubstructureNotify, string(ev.Bytes()))
	c.Sync()
}

// Minimize — oynani panelga yig'adi (WM_CHANGE_STATE → IconicState).
func Minimize(hwnd uintptr) {
	if hwnd == 0 {
		return
	}
	xMu.Lock()
	defer xMu.Unlock()
	if c := xconn(); c != nil {
		clientMsg(c, xproto.Window(hwnd), "WM_CHANGE_STATE", 3)
	}
}

// Restore — yig'ilgan oynani qaytaradi va oldinga chiqaradi (_NET_ACTIVE_WINDOW).
func Restore(hwnd uintptr) {
	if hwnd == 0 {
		return
	}
	xMu.Lock()
	defer xMu.Unlock()
	if c := xconn(); c != nil {
		clientMsg(c, xproto.Window(hwnd), "_NET_ACTIVE_WINDOW", 2)
	}
}

// waylandOnly — toza Wayland sessiyasi (X11 oynalari ko'rinmaydi): vaqt hisoblash ishlamaydi.
func waylandOnly() bool {
	if os.Getenv("WAYLAND_DISPLAY") == "" {
		return false
	}
	xMu.Lock()
	defer xMu.Unlock()
	return xconn() == nil
}
