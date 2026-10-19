//go:build windows

// Windows API chaqiruvlari: faol oyna, jarayonlar, bo'sh turish vaqti, bloklash, ro'yxatga olish kitobi.
package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	version  = windows.NewLazySystemDLL("version.dll")

	pGetForegroundWindow     = user32.NewProc("GetForegroundWindow")
	pGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	pGetWindowTextW          = user32.NewProc("GetWindowTextW")
	pGetLastInputInfo        = user32.NewProc("GetLastInputInfo")
	pEnumChildWindows        = user32.NewProc("EnumChildWindows")
	pEnumWindows             = user32.NewProc("EnumWindows")
	pIsWindowVisible         = user32.NewProc("IsWindowVisible")
	pGetWindowTextLengthW    = user32.NewProc("GetWindowTextLengthW")
	pMessageBoxW             = user32.NewProc("MessageBoxW")
	pKeybdEvent              = user32.NewProc("keybd_event")
	pShowWindow              = user32.NewProc("ShowWindow")
	pSetForegroundWindow     = user32.NewProc("SetForegroundWindow")
	pGetTickCount            = kernel32.NewProc("GetTickCount")
	pCreateMutexW            = kernel32.NewProc("CreateMutexW")
	pGetUserDefaultUILanguage = kernel32.NewProc("GetUserDefaultUILanguage")

	pGetFileVersionInfoSizeW = version.NewProc("GetFileVersionInfoSizeW")
	pGetFileVersionInfoW     = version.NewProc("GetFileVersionInfoW")
	pVerQueryValueW          = version.NewProc("VerQueryValueW")
)

// Foreground — hozir faol oyna haqida ma'lumot.
type Foreground struct {
	HWND  uintptr
	PID   uint32
	Path  string // to'liq yo'l
	Exe   string // kichik harflarda: discord.exe
	Title string
}

func pidOf(hwnd uintptr) uint32 {
	var pid uint32
	pGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	return pid
}

func windowTitle(hwnd uintptr) string {
	buf := make([]uint16, 512)
	n, _, _ := pGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	return windows.UTF16ToString(buf[:n])
}

func processPath(pid uint32) string {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return ""
	}
	defer windows.CloseHandle(h)
	buf := make([]uint16, windows.MAX_LONG_PATH)
	n := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &n); err != nil {
		return ""
	}
	return windows.UTF16ToString(buf[:n])
}

var childPID uint32
var childMu sync.Mutex
var enumChildCb = syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
	p := pidOf(hwnd)
	if p != 0 && p != uint32(lparam) {
		childPID = p
		return 0
	}
	return 1
})

// GetForeground — faol oynani aniqlaydi. UWP ilovalarda (ApplicationFrameHost) haqiqiy jarayon ichki oynadan olinadi.
func GetForeground() (Foreground, bool) {
	hwnd, _, _ := pGetForegroundWindow.Call()
	if hwnd == 0 {
		return Foreground{}, false
	}
	pid := pidOf(hwnd)
	path := processPath(pid)
	if strings.EqualFold(filepath.Base(path), "ApplicationFrameHost.exe") {
		childMu.Lock()
		childPID = 0
		pEnumChildWindows.Call(hwnd, enumChildCb, uintptr(pid))
		if childPID != 0 {
			pid = childPID
			path = processPath(pid)
		}
		childMu.Unlock()
	}
	if path == "" {
		return Foreground{}, false
	}
	return Foreground{HWND: hwnd, PID: pid, Path: path, Exe: strings.ToLower(filepath.Base(path)), Title: windowTitle(hwnd)}, true
}

// IdleSeconds — klaviatura/sichqoncha oxirgi marta qachon ishlatilgan.
func IdleSeconds() uint32 {
	type lastInputInfo struct {
		cbSize uint32
		dwTime uint32
	}
	li := lastInputInfo{cbSize: 8}
	r, _, _ := pGetLastInputInfo.Call(uintptr(unsafe.Pointer(&li)))
	if r == 0 {
		return 0
	}
	tick, _, _ := pGetTickCount.Call()
	return (uint32(tick) - li.dwTime) / 1000
}

// Processes — ishlayotgan jarayonlar: exe (kichik harf) → PID'lar.
func Processes() map[string][]uint32 {
	out := map[string][]uint32{}
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return out
	}
	defer windows.CloseHandle(snap)
	var pe windows.ProcessEntry32
	pe.Size = uint32(unsafe.Sizeof(pe))
	for err = windows.Process32First(snap, &pe); err == nil; err = windows.Process32Next(snap, &pe) {
		name := strings.ToLower(windows.UTF16ToString(pe.ExeFile[:]))
		out[name] = append(out[name], pe.ProcessID)
	}
	return out
}

// Kill — jarayonni yopadi.
func Kill(pid uint32) error {
	h, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, pid)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(h)
	return windows.TerminateProcess(h, 1)
}

// CloseTab — faol brauzer oynasida Ctrl+W (joriy tabni yopish).
func CloseTab() {
	const vkControl, vkW, keyUp = 0x11, 0x57, 0x0002
	pKeybdEvent.Call(vkControl, 0, 0, 0)
	pKeybdEvent.Call(vkW, 0, 0, 0)
	pKeybdEvent.Call(vkW, 0, keyUp, 0)
	pKeybdEvent.Call(vkControl, 0, keyUp, 0)
}

// Minimize — oynani vazifalar paneliga yig'adi (SW_MINIMIZE).
func Minimize(hwnd uintptr) {
	if hwnd != 0 {
		pShowWindow.Call(hwnd, 6)
	}
}

// Restore — yig'ilgan oynani qaytaradi va oldinga chiqaradi (SW_RESTORE).
func Restore(hwnd uintptr) {
	if hwnd != 0 {
		pShowWindow.Call(hwnd, 9)
		pSetForegroundWindow.Call(hwnd)
	}
}

// MessageBox — oddiy oyna (alohida goroutine'da chaqiring). Qaytaradi: 1=OK, 6=Yes, 7=No.
func MessageBox(title, text string, flags uintptr) int {
	t, _ := windows.UTF16PtrFromString(title)
	m, _ := windows.UTF16PtrFromString(text)
	r, _, _ := pMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), flags|0x00040000 /*MB_TOPMOST*/ |0x00010000 /*MB_SETFOREGROUND*/)
	return int(r)
}

// SingleInstance — ikkinchi nusxa ishga tushmasin.
func SingleInstance() bool {
	name, _ := windows.UTF16PtrFromString("Local\\LevelUpDayFocusgateAgent")
	h, _, err := pCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return true
	}
	return err != windows.ERROR_ALREADY_EXISTS
}

// FileDescription — exe ichidagi chiroyli nom ("Discord", "Google Chrome").
var descCache = map[string]string{}
var descMu sync.Mutex

func FileDescription(path string) string {
	descMu.Lock()
	defer descMu.Unlock()
	if d, ok := descCache[path]; ok {
		return d
	}
	desc := ""
	defer func() { descCache[path] = desc }()
	p, _ := windows.UTF16PtrFromString(path)
	size, _, _ := pGetFileVersionInfoSizeW.Call(uintptr(unsafe.Pointer(p)), 0)
	if size == 0 {
		return ""
	}
	data := make([]byte, size)
	if r, _, _ := pGetFileVersionInfoW.Call(uintptr(unsafe.Pointer(p)), 0, size, uintptr(unsafe.Pointer(&data[0]))); r == 0 {
		return ""
	}
	var tr *[2]uint16
	var trLen uint32
	sub, _ := windows.UTF16PtrFromString(`\VarFileInfo\Translation`)
	if r, _, _ := pVerQueryValueW.Call(uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(sub)), uintptr(unsafe.Pointer(&tr)), uintptr(unsafe.Pointer(&trLen))); r == 0 || trLen < 4 {
		return ""
	}
	q, _ := windows.UTF16PtrFromString(fmt.Sprintf(`\StringFileInfo\%04x%04x\FileDescription`, tr[0], tr[1]))
	var val *uint16
	var vLen uint32
	if r, _, _ := pVerQueryValueW.Call(uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(q)), uintptr(unsafe.Pointer(&val)), uintptr(unsafe.Pointer(&vLen))); r == 0 || vLen == 0 {
		return ""
	}
	desc = strings.TrimSpace(windows.UTF16PtrToString(val))
	if len(desc) > 60 {
		desc = desc[:60]
	}
	return desc
}

// ---------- Avtoishga tushish (HKCU\...\Run) ----------
const runKey = `Software\Microsoft\Windows\CurrentVersion\Run`
const runName = "LevelUpDay Focusgate"

func AutostartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	_, _, err = k.GetStringValue(runName)
	return err == nil
}

func SetAutostart(on bool, exe string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if on {
		return k.SetStringValue(runName, `"`+exe+`" --background`)
	}
	err = k.DeleteValue(runName)
	if err == registry.ErrNotExist {
		return nil
	}
	return err
}

// VisibleWindowPIDs — ko'rinadigan, sarlavhali oynasi bor jarayonlar (fon xizmatlari kirmaydi).
var visPIDs map[uint32]bool
var visMu sync.Mutex
var enumWinCb = syscall.NewCallback(func(hwnd uintptr, _ uintptr) uintptr {
	if v, _, _ := pIsWindowVisible.Call(hwnd); v != 0 {
		if n, _, _ := pGetWindowTextLengthW.Call(hwnd); n > 0 {
			visPIDs[pidOf(hwnd)] = true
		}
	}
	return 1
})

func VisibleWindowPIDs() map[uint32]bool {
	visMu.Lock()
	defer visMu.Unlock()
	visPIDs = map[uint32]bool{}
	pEnumWindows.Call(enumWinCb, 0)
	out := visPIDs
	visPIDs = nil
	return out
}

// Windows interfeysi tili → uz | ru | en
func init() {
	osLangFn = func() string {
		id, _, _ := pGetUserDefaultUILanguage.Call()
		switch id & 0x3ff { // asosiy til
		case 0x43:
			return "uz"
		case 0x19:
			return "ru"
		}
		return "en"
	}
}
