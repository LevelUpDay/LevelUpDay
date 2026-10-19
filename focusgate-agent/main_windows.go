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
	status   = ""
	sessions = map[uint32]time.Time{} // session limiti: PID → birinchi ko'rilgan vaqt
	lastNote = map[string]time.Time{} // xabarlarni tez-tez chiqarmaslik uchun
	noteMu   sync.Mutex
)

func main() {
	exePath, _ = os.Executable()
	appMode := false // "LevelUpDay" yorlig'i: ilova oynasini ochadi (agent ishlamayotgan bo'lsa — uni ham ishga tushiradi)
	for _, a := range os.Args[1:] {
		switch a {
		case "--uninstall":
			uninstall()
			return
		case "--app":
			appMode = true
		}
	}
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
	if appMode {
		openApp("")
		if !ok {
			return // agent allaqachon ishlayapti
		}
	}
	if !ok {
		// Ishlab turgan nusxa bor: "Ha" — uni to'xtatib qayta ishga tushirish, "Yo'q" — saytni ochish
		r := MessageBox("LevelUpDay Focusgate v"+Version, Tr("running"), 0x03|0x40)
		switch r {
		case 6: // Ha
			restartFresh()
		case 7: // Yo'q
			openApp("#focusgate")
			time.Sleep(2 * time.Second)
		}
		return
	}
	st = LoadState()
	SetLang(st.Config.Lang)
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
		return Tr("r_focus")
	case "always":
		return Tr("r_always")
	case "schedule":
		return Tr("r_schedule", v.Rule.From+"–"+v.Rule.To)
	case "daily":
		return Tr("r_daily", FmtDur(RuleMinutes(v.Rule, time.Now())*60))
	case "session":
		return Tr("r_session")
	case "mode":
		return Tr("r_mode", v.Rule.Label)
	case "allow":
		return Tr("r_allow")
	}
	return Tr("r_blocked")
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
	if status == "" {
		status = Tr("starting")
	}
	mStatus = systray.AddMenuItem(status, "")
	mStatus.Disable()
	mToday = systray.AddMenuItem(Tr("today")+"—", "")
	mToday.Disable()
	mFocus = systray.AddMenuItem("", "")
	mFocus.Disable()
	mFocus.Hide()
	systray.AddSeparator()
	mOpen = systray.AddMenuItem(Tr("open"), Tr("open_tip"))
	mPair = systray.AddMenuItem(Tr("pair"), "")
	mAuto = systray.AddMenuItemCheckbox(Tr("autostart"), "", AutostartEnabled())
	mPause = systray.AddMenuItem(Tr("pause"), Tr("pause_tip"))
	systray.AddSeparator()
	mQuit = systray.AddMenuItem(Tr("quit"), "")

	go menuLoop()
	go trackLoop()
	go enforceLoop()
	go syncLoop()
	go updateLoop()
	go ensureDesktop()
	if st.Token == "" {
		go startPairing()
	}
	for _, a := range os.Args[1:] {
		if a == "--first-run" {
			if st.Token != "" {
				openApp("")
				notify("!hello", Tr("hello_title"), Tr("hello_body"))
			}
			// Token yo'q — ulash kodi bilan bildirishnoma startPairing() da chiqadi
		}
	}
}

func menuLoop() {
	for {
		select {
		case <-mOpen.ClickedCh:
			openApp("#focusgate")
		case <-mPair.ClickedCh:
			pairMu.Lock()
			c := pairCode
			pairMu.Unlock()
			if c != "" {
				openPair(c)
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
				go MessageBox("Focusgate", Tr("strict_pause"), 0x30)
				continue
			}
			st.mu.Lock()
			st.Config.PauseUntil = time.Now().Add(15 * time.Minute).UnixMilli()
			st.mu.Unlock()
			notify("!pause", Tr("pause_title"), Tr("pause_body"))
		case <-mQuit.ClickedCh:
			if st.Config.Strict && st.Config.FocusUntil > time.Now().UnixMilli() {
				go MessageBox("Focusgate", Tr("strict_quit"), 0x30)
				continue
			}
			if MessageBox("Focusgate", Tr("quit_confirm"), 0x04|0x20) == 6 {
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
	name := deviceName()
	code, err := PairStart(name)
	if err != nil {
		setStatus(Tr("no_net_pair"))
		return
	}
	pairMu.Lock()
	pairCode = code
	pairMu.Unlock()
	setStatus(Tr("pair_code", code))
	mPair.SetTitle(Tr("pair_confirm", code))
	// Ulash — oddiy brauzer tabida (akkauntga kirilgan joy); ochilmasa, kodni saytda qo'lda yozish mumkin
	openPair(code)
	notify("!pair", Tr("pair_title", code), Tr("pair_body"))
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
			st.ResetSeen = time.Now().UnixMilli() // yangi ulangan qurilma eski tozalashlarni qo'llamaydi
			st.mu.Unlock()
			_ = st.Save()
			pairMu.Lock()
			pairCode = ""
			pairMu.Unlock()
			mPair.SetTitle(Tr("repair"))
			setStatus(Tr("paired_st", name))
			notify("!paired", Tr("paired_title"), Tr("paired_body"))
			go doSync()
			return
		}
	}
	pairMu.Lock()
	pairCode = ""
	pairMu.Unlock()
	mPair.SetTitle(Tr("pair"))
	setStatus(Tr("pair_expired"))
}

// ---------- Hisoblash ----------
func trackLoop() {
	tick := time.NewTicker(time.Second)
	saveT := time.Now()
	lastApp, lastActive := "", map[string]time.Time{} // ochilishlar soni: boshqa ilovadan o'tilsa (30 s dan ko'p tanaffus bilan)
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
				if app != lastApp {
					if t0, ok := lastActive[app]; !ok || now.Sub(t0) > 30*time.Second {
						st.AddOpen(now, app, label)
					}
					lastApp = app
				}
				lastActive[app] = now
			}
		} else {
			lastApp = ""
		}
		if now.Sub(saveT) > 30*time.Second {
			saveT = now
			st.Prune(now)
			_ = st.Save()
		}
		if now.Second()%5 == 0 && mToday != nil {
			mToday.SetTitle(Tr("today") + FmtDur(st.TotalToday(now)))
			systray.SetTooltip(Tr("today_tip") + FmtDur(st.TotalToday(now)))
			fu := cfg.FocusUntil
			if left := (fu - now.UnixMilli()) / 1000; left > 0 {
				mFocus.SetTitle(Tr("focus_left", itoa(int(left/60))+":"+pad2(int(left%60))))
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
				notify("kill:"+exe, Tr("closed", niceName(exe)), reasonText(v))
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
						notify("kill:"+exe, Tr("closed", niceName(exe)), reasonText(Verdict{true, "session", nil}))
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
		// 🎯 Fokusda "faqat ruxsat etilganlar": faol oyna ro'yxatda bo'lmasa — yig'iladi (dastur) yoki tab yopiladi (sayt)
		if fg, ok := GetForeground(); ok && fg.Exe != self && !noTrack[fg.Exe] && AllowBlocks(&cfg, st, fg.Exe, now) {
			allowEnforce(&cfg, fg, now)
		}
		// 🌬 Ongli ochish: ro'yxatdagi dastur ochilsa — yig'iladi, N soniyadan keyin "rostdan kerakmi?" so'raladi
		if fg, ok := GetForeground(); ok && !Browsers[fg.Exe] && IsMindful(&cfg, st, fg.Exe) {
			mindfulAsk(&cfg, fg, procs)
		}
		// Saytlar: faol brauzer tabi bloklangan saytda bo'lsa — tab yopiladi
		if fg, ok := GetForeground(); ok && Browsers[fg.Exe] {
			if s, ok := SiteOf(fg.Title, cfg.Rules); ok {
				if v := Check(&cfg, st, s.Key, now); v.Blocked {
					CloseTab()
					notify("site:"+s.Key, Tr("closed", s.Label), reasonText(v))
					event(now, "site_block", s.Key, s.Label, v.Reason)
				}
			}
		}
		for _, w := range WarnDue(&cfg, st, now) {
			lbl := w.Rule.Label
			if lbl == "" {
				lbl = w.Rule.App
			}
			if w.Pct > 0 {
				notify("warn:"+w.Rule.App, Tr("warn_pct_title", lbl, itoa(w.Pct)+"%"), Tr("warn_pct_body", FmtDur(w.Left)))
				event(now, "warn", w.Rule.App, lbl, "p"+itoa(w.Pct))
				continue
			}
			notify("warn:"+w.Rule.App, Tr("warn_title", lbl, FmtDur(w.Left)), Tr("warn_body"))
			event(now, "warn", w.Rule.App, lbl, "daily")
		}
	}
}

// allowEnforce — oq ro'yxatdan tashqari faol oyna: sayt bo'lsa tab yopiladi, dastur bo'lsa oyna yig'iladi.
func allowEnforce(cfg *Config, fg Foreground, now time.Time) {
	if Browsers[fg.Exe] {
		sitesAllowed := false
		for _, f := range cfg.AllowApps {
			if strings.HasPrefix(f.App, "site:") {
				sitesAllowed = true
			}
		}
		if s, ok := SiteOf(fg.Title, cfg.Rules); ok && !Allowed(cfg, st, s.Key) && (sitesAllowed || !Allowed(cfg, st, fg.Exe)) {
			CloseTab()
			notify("allow:"+s.Key, Tr("closed", s.Label), Tr("r_allow"))
			event(now, "site_block", s.Key, s.Label, "allow")
			return
		}
		if sitesAllowed || Allowed(cfg, st, fg.Exe) {
			return // ruxsat etilgan sayt yoki aniqlanmagan sahifa — kengaytma tekshiradi
		}
	}
	Minimize(fg.HWND)
	notify("allow:"+fg.Exe, Tr("minimized", niceName(fg.Exe)), Tr("r_allow"))
	event(now, "block", fg.Exe, niceName(fg.Exe), "allow")
}

var (
	mindMu    sync.Mutex
	mindGrant = map[string]time.Time{} // "Ha" deyilgan ilovalar: qachongacha ruxsat
	mindAsk   = map[string]bool{}
)

// mindfulAsk — ongli ochish: oyna yig'iladi, kutish vaqtidan keyin savol; "Ha" — N daqiqa ruxsat, "Yo'q" — yopiladi.
func mindfulAsk(cfg *Config, fg Foreground, procs map[string][]uint32) {
	mindMu.Lock()
	if time.Now().Before(mindGrant[fg.Exe]) {
		mindMu.Unlock()
		return
	}
	if mindAsk[fg.Exe] {
		mindMu.Unlock()
		Minimize(fg.HWND) // savol kutilayotganda qayta ochilsa — yana yig'iladi
		return
	}
	mindAsk[fg.Exe] = true
	mindMu.Unlock()
	wait, mins := cfg.MindfulSec, cfg.MindfulMin
	if wait <= 0 || wait > 60 {
		wait = 10
	}
	if mins <= 0 || mins > 240 {
		mins = 15
	}
	name, hwnd, exe := niceName(fg.Exe), fg.HWND, fg.Exe
	Minimize(hwnd)
	notify("!mind:"+exe, Tr("mind_title"), Tr("mind_wait", itoa(wait)))
	go func() {
		time.Sleep(time.Duration(wait) * time.Second)
		yes := MessageBox("Focusgate", Tr("mind_q", name, FmtDur(mins*60)), 0x04|0x20) == 6
		mindMu.Lock()
		if yes {
			mindGrant[exe] = time.Now().Add(time.Duration(mins) * time.Minute)
		}
		delete(mindAsk, exe)
		mindMu.Unlock()
		if yes {
			Restore(hwnd)
			return
		}
		for _, pid := range Processes()[exe] {
			_ = Kill(pid)
		}
		event(time.Now(), "block", exe, name, "mindful")
	}()
}

// deviceName — "Windows · KOMPYUTER · foydalanuvchi": bitta kompyuterdagi har bir Windows foydalanuvchisi alohida qurilma
func deviceName() string {
	host, _ := os.Hostname()
	name := "Windows · " + host
	if u := strings.TrimSpace(os.Getenv("USERNAME")); u != "" && !strings.EqualFold(u, host) {
		name += " · " + u
	}
	return name
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
	st.mu.Lock()
	seen := st.ResetSeen
	st.mu.Unlock()
	res, err := Sync(tok, deviceName(), seen, st.Rows(time.Now()), apps, events)
	if err != nil {
		st.ReturnEvents(events)
	}
	if err == ErrUnauthorized {
		st.mu.Lock()
		st.Token = ""
		st.mu.Unlock()
		_ = st.Save()
		setStatus(Tr("unpaired"))
		mPair.SetTitle(Tr("pair"))
		return
	}
	if err != nil {
		setStatus(Tr("offline"))
		return
	}
	if st.ApplyReset(res.Config.StatsResetAt) {
		_ = st.Save() // saytda statistika tozalandi — bu kompyuterdagi hisob ham noldan
	}
	if SetLang(res.Config.Lang) {
		applyMenuLang()
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
	setStatus(Tr("connected_st", name))
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

// applyMenuLang — til o'zgarganda tray menyusini qayta yozadi.
func applyMenuLang() {
	if mOpen == nil {
		return
	}
	mOpen.SetTitle(Tr("open"))
	mOpen.SetTooltip(Tr("open_tip"))
	pairMu.Lock()
	c := pairCode
	pairMu.Unlock()
	st.mu.Lock()
	hasTok := st.Token != ""
	st.mu.Unlock()
	if c != "" {
		mPair.SetTitle(Tr("pair_confirm", c))
	} else if hasTok {
		mPair.SetTitle(Tr("repair"))
	} else {
		mPair.SetTitle(Tr("pair"))
	}
	mAuto.SetTitle(Tr("autostart"))
	mPause.SetTitle(Tr("pause"))
	mPause.SetTooltip(Tr("pause_tip"))
	mQuit.SetTitle(Tr("quit"))
}
