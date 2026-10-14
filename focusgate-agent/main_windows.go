//go:build windows

// LevelUpDay Focusgate — Windows agenti.
//  • Har soniyada faol oynani o'qiydi va vaqtni hisoblaydi (bo'sh turilganda hisoblanmaydi)
//  • Har 2 soniyada qoidalarni tekshiradi: limit/jadval/doimiy/fokus — dastur yopiladi, sayt tabi yopiladi
//  • Har 45 soniyada LevelUpDay bilan sinxronlanadi (foydalanish → server, sozlamalar ← server)
//  • Tray menyusi: holat, bugungi vaqt, panelni ochish, avtoishga tushish, pauza, chiqish
package main

import (
	_ "embed"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"fyne.io/systray"
)

//go:embed assets/icon.ico
var iconICO []byte

var (
	st       *State
	exePath  string
	pairCode string
	pairMu   sync.Mutex
	status   = "Ishga tushmoqda…"
	sessions = map[uint32]time.Time{} // session limiti: PID → birinchi ko'rilgan vaqt
	lastNote = map[string]time.Time{} // xabarlarni tez-tez chiqarmaslik uchun
	noteMu   sync.Mutex
)

func main() {
	exePath, _ = os.Executable()
	waitLock := false // yangi o'rnatilgan / yangilangan nusxa: eski jarayon yopilishini kutadi
	for _, a := range os.Args[1:] {
		if a == "--updated" || a == "--first-run" {
			waitLock = true
		}
	}
	// 1) Avval o'rnatish (yuklab olingan joydan ishga tushirilgan bo'lsa). Bu qulf (mutex) olishdan OLDIN bo'lishi shart —
	//    aks holda o'rnatilgan nusxa "allaqachon ishlayapti" deb yopilib qolardi (v0.2.0 xatosi).
	if installIfNeeded() {
		return
	}
	ok := SingleInstance()
	for i := 0; !ok && waitLock && i < 30; i++ {
		time.Sleep(500 * time.Millisecond)
		ok = SingleInstance()
	}
	if !ok {
		// Ishlab turgan nusxa bor: "Ha" — uni to'xtatib qayta ishga tushirish, "Yo'q" — saytni ochish
		r := MessageBox("LevelUpDay Focusgate v"+Version, "Focusgate allaqachon ishlayapti (soat yonidagi ^ ichida 🛡 belgi).\n\n"+
			"Ha — qayta ishga tushirish (eski nusxa to'xtatiladi)\nYo'q — LevelUpDay'da Focusgate bo'limini ochish", 0x03|0x40)
		switch r {
		case 6: // Ha
			restartFresh()
		case 7: // Yo'q
			openURL(AppURL + "#focusgate")
			time.Sleep(2 * time.Second)
		}
		return
	}
	st = LoadState()
	cleanupOld()
	if waitLock {
		st.AppsSentAt = 0 // yangi versiya — ro'yxatni qayta yuboramiz
	}
	systray.Run(onReady, func() { _ = st.Save() })
}

// installIfNeeded — yuklab olingan Focusgate.exe ishga tushirilganda: eski nusxani to'xtatadi, o'zini
// %LOCALAPPDATA%\Programs\LevelUpDay Focusgate ga ko'chiradi, avtoishga tushishni yoqadi va o'sha nusxani ishga tushiradi.
func installIfNeeded() bool {
	for _, a := range os.Args[1:] {
		if a == "--no-install" || a == "--background" || a == "--first-run" || a == "--updated" {
			return false
		}
	}
	dst := installedPath()
	if dst == "" || strings.EqualFold(filepath.Clean(exePath), filepath.Clean(dst)) {
		return false
	}
	_ = os.MkdirAll(filepath.Dir(dst), 0o755)
	// Ishlab turgan eski nusxa (har qanday versiya) yopiladi — yangi fayl uning o'rniga yoziladi
	killOthers()
	var err error
	for i := 0; i < 6; i++ {
		if err = copyFile(exePath, dst); err == nil {
			break
		}
		time.Sleep(500 * time.Millisecond)
	}
	if err != nil {
		return false // ko'chirib bo'lmasa — joyida ishlayveramiz
	}
	_ = SetAutostart(true, dst)
	cmd := exec.Command(dst, "--first-run")
	if cmd.Start() != nil {
		return false
	}
	return true
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp := dst + ".new"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	out.Close()
	_ = os.Remove(dst)
	return os.Rename(tmp, dst)
}

func openURL(u string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}

// notify — Windows bildirishnomasi (PowerShell orqali toast; konsol oynasi ko'rinmaydi).
func notify(key, title, body string) {
	st.mu.Lock()
	notifOn := st.Config.NotifOn()
	st.mu.Unlock()
	if !notifOn && !strings.HasPrefix(key, "!") {
		return
	}
	noteMu.Lock()
	if t, ok := lastNote[key]; ok && time.Since(t) < 45*time.Second {
		noteMu.Unlock()
		return
	}
	lastNote[key] = time.Now()
	noteMu.Unlock()
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

func reasonText(v Verdict) string {
	switch v.Reason {
	case "focus":
		return "fokus vaqtida bloklangan"
	case "always":
		return "doimiy bloklangan"
	case "schedule":
		return "jadval bo'yicha bloklangan (" + v.Rule.From + "–" + v.Rule.To + ")"
	case "daily":
		return "bugungi limit tugadi (" + itoa(v.Rule.Minutes) + " daq)"
	case "session":
		return "bir martalik seans vaqti tugadi"
	}
	return "bloklangan"
}

// ---------- Tray ----------
var (
	mStatus, mToday, mFocus, mOpen, mPair, mAuto, mPause, mQuit *systray.MenuItem
)

func onReady() {
	systray.SetIcon(iconICO)
	systray.SetTitle("Focusgate")
	systray.SetTooltip("LevelUpDay Focusgate v" + Version)
	vItem := systray.AddMenuItem("LevelUpDay Focusgate v"+Version, "")
	vItem.Disable()
	mStatus = systray.AddMenuItem(status, "")
	mStatus.Disable()
	mToday = systray.AddMenuItem("Bugun: —", "")
	mToday.Disable()
	mFocus = systray.AddMenuItem("", "")
	mFocus.Disable()
	mFocus.Hide()
	systray.AddSeparator()
	mOpen = systray.AddMenuItem("📊 LevelUpDay'da ochish", "Statistika va limitlar")
	mPair = systray.AddMenuItem("🔗 Akkauntga ulash", "")
	mAuto = systray.AddMenuItemCheckbox("Windows bilan birga ishga tushish", "", AutostartEnabled())
	mPause = systray.AddMenuItem("⏸ 15 daqiqa pauza", "Limitlarni vaqtincha to'xtatish")
	systray.AddSeparator()
	mQuit = systray.AddMenuItem("Chiqish", "")

	go menuLoop()
	go trackLoop()
	go enforceLoop()
	go syncLoop()
	go updateLoop()
	if st.Token == "" {
		go startPairing()
	}
	for _, a := range os.Args[1:] {
		if a == "--first-run" {
			if st.Token != "" {
				notify("!hello", "LevelUpDay Focusgate ishlayapti ✅", "Soat yonidagi 🛡 belgisi orqali boshqaring.")
			} else {
				notify("!hello", "LevelUpDay Focusgate o'rnatildi ✅", "Brauzerda \"Ulash\" tugmasini bosing.")
			}
		}
	}
}

func menuLoop() {
	for {
		select {
		case <-mOpen.ClickedCh:
			openURL(AppURL + "#focusgate")
		case <-mPair.ClickedCh:
			pairMu.Lock()
			c := pairCode
			pairMu.Unlock()
			if c != "" {
				openURL(PairURL(c))
			} else {
				go startPairing()
			}
		case <-mAuto.ClickedCh:
			on := !mAuto.Checked()
			if SetAutostart(on, exePath) == nil {
				if on {
					mAuto.Check()
				} else {
					mAuto.Uncheck()
				}
			}
		case <-mPause.ClickedCh:
			if st.Config.Strict {
				go MessageBox("Focusgate", "Qat'iy rejim yoqilgan — pauza qilib bo'lmaydi.", 0x30)
				continue
			}
			st.mu.Lock()
			st.Config.PauseUntil = time.Now().Add(15 * time.Minute).UnixMilli()
			st.mu.Unlock()
			notify("!pause", "Focusgate pauzada", "15 daqiqa davomida limitlar ishlamaydi.")
		case <-mQuit.ClickedCh:
			if st.Config.Strict && st.Config.FocusUntil > time.Now().UnixMilli() {
				go MessageBox("Focusgate", "Qat'iy rejim: fokus sessiyasi tugamaguncha chiqib bo'lmaydi.", 0x30)
				continue
			}
			if MessageBox("Focusgate", "Focusgate'ni to'xtatasizmi? Limitlar va kuzatuv ishlamay qoladi.", 0x04|0x20) == 6 {
				_ = st.Save()
				systray.Quit()
				return
			}
		}
	}
}

func setStatus(s string) {
	status = s
	if mStatus != nil {
		mStatus.SetTitle(s)
	}
}

func startPairing() {
	pairMu.Lock()
	if pairCode != "" {
		pairMu.Unlock()
		return
	}
	pairMu.Unlock()
	host, _ := os.Hostname()
	name := "Windows · " + host
	code, err := PairStart(name)
	if err != nil {
		setStatus("⚠️ Internet yo'q — ulash keyinroq")
		return
	}
	pairMu.Lock()
	pairCode = code
	pairMu.Unlock()
	setStatus("🔗 Ulash kodi: " + code)
	mPair.SetTitle("🔗 Brauzerda ulashni tasdiqlash (" + code + ")")
	openURL(PairURL(code))
	deadline := time.Now().Add(15 * time.Minute)
	for time.Now().Before(deadline) {
		time.Sleep(3 * time.Second)
		tok, err := PairPoll(code)
		if err == ErrExpired {
			break
		}
		if tok != "" {
			st.mu.Lock()
			st.Token = tok
			st.DeviceName = name
			st.mu.Unlock()
			_ = st.Save()
			pairMu.Lock()
			pairCode = ""
			pairMu.Unlock()
			mPair.SetTitle("🔗 Boshqa akkauntga qayta ulash")
			setStatus("✅ Ulandi: " + name)
			notify("!paired", "Focusgate ulandi ✅", "Endi limitlarni LevelUpDay → Focusgate'da boshqarasiz.")
			go doSync()
			return
		}
	}
	pairMu.Lock()
	pairCode = ""
	pairMu.Unlock()
	mPair.SetTitle("🔗 Akkauntga ulash")
	setStatus("⏳ Ulash vaqti tugadi — qaytadan bosing")
}

// ---------- Hisoblash ----------
func trackLoop() {
	tick := time.NewTicker(time.Second)
	saveT := time.Now()
	for now := range tick.C {
		st.mu.Lock()
		cfg := st.Config
		st.mu.Unlock()
		if cfg.TrackOn() && IdleSeconds() < 120 {
			if fg, ok := GetForeground(); ok && !noTrack[fg.Exe] && !strings.HasPrefix(fg.Exe, "focusgate") {
				app, label := fg.Exe, FileDescription(fg.Path)
				if Browsers[fg.Exe] {
					if s, ok := SiteOf(fg.Title, cfg.Rules); ok {
						app, label = s.Key, s.Label
					}
				}
				if label == "" {
					label = strings.TrimSuffix(fg.Exe, ".exe")
				}
				st.Add(now, app, label, 1)
			}
		}
		if now.Sub(saveT) > 30*time.Second {
			saveT = now
			st.Prune(now)
			_ = st.Save()
		}
		if now.Second()%5 == 0 && mToday != nil {
			mToday.SetTitle("⏱ Bugun: " + FmtDur(st.TotalToday(now)))
			systray.SetTooltip("LevelUpDay Focusgate — bugun " + FmtDur(st.TotalToday(now)))
			fu := cfg.FocusUntil
			if left := (fu - now.UnixMilli()) / 1000; left > 0 {
				mFocus.SetTitle("🎯 Fokus: " + itoa(int(left/60)) + ":" + pad2(int(left%60)) + " qoldi")
				mFocus.Show()
			} else {
				mFocus.Hide()
			}
		}
	}
}

// noTrack — vaqti hisoblanmaydigan tizim oynalari (Start menyusi, qidiruv, qulflangan ekran...)
var noTrack = map[string]bool{
	"lockapp.exe": true, "shellexperiencehost.exe": true, "startmenuexperiencehost.exe": true, "searchhost.exe": true,
	"searchapp.exe": true, "textinputhost.exe": true, "applicationframehost.exe": true, "logonui.exe": true,
}

func pad2(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

// ---------- Bloklash ----------
func enforceLoop() {
	tick := time.NewTicker(2 * time.Second)
	self := strings.ToLower(filepath.Base(exePath))
	for now := range tick.C {
		st.mu.Lock()
		cfg := st.Config
		st.mu.Unlock()
		procs := Processes()
		seen := map[uint32]bool{}
		for exe, pids := range procs {
			if exe == self || Protected[exe] {
				continue
			}
			v := Check(&cfg, st, exe, now)
			if v.Blocked {
				for _, pid := range pids {
					_ = Kill(pid)
				}
				notify("kill:"+exe, "🛡 "+niceName(exe)+" yopildi", reasonText(v))
				event(now, "block", exe, niceName(exe), v.Reason)
				continue
			}
			if lim := SessionLimit(&cfg, st, exe); lim > 0 {
				for _, pid := range pids {
					seen[pid] = true
					t0, ok := sessions[pid]
					if !ok {
						sessions[pid] = now
						continue
					}
					if now.Sub(t0) >= time.Duration(lim)*time.Minute {
						_ = Kill(pid)
						notify("kill:"+exe, "🛡 "+niceName(exe)+" yopildi", reasonText(Verdict{true, "session", nil}))
						event(now, "block", exe, niceName(exe), "session")
					}
				}
			}
		}
		for pid := range sessions {
			if !seen[pid] {
				delete(sessions, pid)
			}
		}
		// Saytlar: faol brauzer tabi bloklangan saytda bo'lsa — tab yopiladi
		if fg, ok := GetForeground(); ok && Browsers[fg.Exe] {
			if s, ok := SiteOf(fg.Title, cfg.Rules); ok {
				if v := Check(&cfg, st, s.Key, now); v.Blocked {
					CloseTab()
					notify("site:"+s.Key, "🛡 "+s.Label+" yopildi", reasonText(v))
					event(now, "site_block", s.Key, s.Label, v.Reason)
				}
			}
		}
		for _, r := range WarnDue(&cfg, st, now) {
			lbl := r.Label
			if lbl == "" {
				lbl = r.App
			}
			left := r.Minutes*60 - st.Seconds(now, r.App)
			notify("warn:"+r.App, "⏳ "+lbl+": "+FmtDur(left)+" qoldi", "Kunlik limit tez orada tugaydi.")
			event(now, "warn", r.App, lbl, "daily")
		}
	}
}

func niceName(exe string) string {
	st.mu.Lock()
	defer st.mu.Unlock()
	if u := st.Usage[DayKey(time.Now())][exe]; u != nil && u.Label != "" {
		return u.Label
	}
	return strings.TrimSuffix(exe, ".exe")
}

// ---------- Sinxronlash ----------
var syncMu sync.Mutex

func doSync() {
	syncMu.Lock()
	defer syncMu.Unlock()
	st.mu.Lock()
	tok := st.Token
	st.mu.Unlock()
	if tok == "" {
		return
	}
	// O'rnatilgan dasturlar ro'yxati — 6 soatda bir marta (yoki birinchi sinxronlashda)
	var apps []InstalledApp
	st.mu.Lock()
	needApps := time.Now().Unix()-st.AppsSentAt > 6*3600
	st.mu.Unlock()
	if needApps {
		apps = ScanApps()
	}
	events := st.TakeEvents()
	res, err := Sync(tok, st.Rows(time.Now()), apps, events)
	if err != nil {
		st.ReturnEvents(events)
	}
	if err == ErrUnauthorized {
		st.mu.Lock()
		st.Token = ""
		st.mu.Unlock()
		_ = st.Save()
		setStatus("🔌 Akkauntdan uzildi — qayta ulang")
		mPair.SetTitle("🔗 Akkauntga ulash")
		return
	}
	if err != nil {
		setStatus("⚠️ Internet yo'q — oflayn ishlayapti")
		return
	}
	st.mu.Lock()
	if apps != nil {
		st.AppsSentAt = time.Now().Unix()
	}
	pause := st.Config.PauseUntil
	st.Config = res.Config
	if res.Config.PauseUntil < pause { // lokal pauza saqlanadi
		st.Config.PauseUntil = pause
	}
	if res.Device.Name != "" {
		st.DeviceName = res.Device.Name
	}
	name := st.DeviceName
	st.mu.Unlock()
	setStatus("✅ Ulangan: " + name)
}

func syncLoop() {
	time.Sleep(3 * time.Second)
	for {
		doSync()
		// fokus boshlanishini tezroq sezish uchun tez-tez so'raymiz
		time.Sleep(30 * time.Second)
	}
}

// updateLoop — 1 daqiqadan keyin va har 6 soatda yangi versiyani tekshiradi.
func updateLoop() {
	time.Sleep(time.Minute)
	for {
		if CheckUpdate() {
			systray.Quit()
			return
		}
		time.Sleep(time.Hour)
	}
}

// killOthers — boshqa barcha Focusgate jarayonlarini to'xtatadi (o'zidan tashqari) va ular yopilishini kutadi.
func killOthers() {
	self := uint32(os.Getpid())
	mine := strings.ToLower(filepath.Base(exePath))
	killed := false
	for exe, pids := range Processes() {
		if exe != "focusgate.exe" && exe != mine && !strings.HasPrefix(exe, "focusgate") {
			continue
		}
		for _, pid := range pids {
			if pid != self {
				_ = Kill(pid)
				killed = true
			}
		}
	}
	if killed {
		time.Sleep(1500 * time.Millisecond)
	}
}

// restartFresh — eski nusxalarni to'xtatib, o'rnatilgan (yoki shu) nusxani qayta ishga tushiradi.
func restartFresh() {
	killOthers()
	target := exePath
	if dst := installedPath(); dst != "" && !strings.EqualFold(filepath.Clean(exePath), filepath.Clean(dst)) {
		_ = os.MkdirAll(filepath.Dir(dst), 0o755)
		for i := 0; i < 6; i++ {
			if copyFile(exePath, dst) == nil {
				_ = SetAutostart(true, dst)
				target = dst
				break
			}
			time.Sleep(500 * time.Millisecond)
		}
	}
	_ = exec.Command(target, "--first-run").Start()
}

// event — hodisani navbatga qo'yadi va 4 soniyadan keyin sinxronlaydi (Telegram xabari tez kelsin).
var eventSyncPending bool
var eventMu sync.Mutex

func event(t time.Time, kind, app, label, reason string) {
	if !st.AddEvent(t, kind, app, label, reason) {
		return
	}
	eventMu.Lock()
	if eventSyncPending {
		eventMu.Unlock()
		return
	}
	eventSyncPending = true
	eventMu.Unlock()
	go func() {
		time.Sleep(4 * time.Second)
		eventMu.Lock()
		eventSyncPending = false
		eventMu.Unlock()
		doSync()
	}()
}
