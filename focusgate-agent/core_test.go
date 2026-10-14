package main

import (
	"strings"
	"testing"
	"time"
)

func at(h, m int) time.Time { return time.Date(2026, 10, 14, h, m, 0, 0, time.Local) } // chorshanba

func TestDailyLimit(t *testing.T) {
	st := NewState()
	cfg := Config{Rules: []Rule{{App: "discord.exe", Kind: "daily", Minutes: 1, On: true}}}
	now := at(10, 0)
	if Check(&cfg, st, "discord.exe", now).Blocked {
		t.Fatal("bo'sh hisobda bloklanmasligi kerak")
	}
	st.Add(now, "discord.exe", "Discord", 60)
	if v := Check(&cfg, st, "discord.exe", now); !v.Blocked || v.Reason != "daily" {
		t.Fatalf("60s dan keyin bloklanishi kerak: %+v", v)
	}
	if Check(&cfg, st, "discord.exe", now.AddDate(0, 0, 1)).Blocked {
		t.Fatal("ertasi kuni limit yangilanishi kerak")
	}
	cfg.Rules[0].On = false
	if Check(&cfg, st, "discord.exe", now).Blocked {
		t.Fatal("o'chirilgan qoida ishlamasligi kerak")
	}
}

func TestScheduleAndOvernight(t *testing.T) {
	st := NewState()
	cfg := Config{Rules: []Rule{{App: "steam.exe", Kind: "schedule", Days: []int{1, 2, 3, 4, 5}, From: "09:00", To: "18:00", On: true}}}
	if !Check(&cfg, st, "steam.exe", at(9, 0)).Blocked || Check(&cfg, st, "steam.exe", at(18, 0)).Blocked || Check(&cfg, st, "steam.exe", at(8, 59)).Blocked {
		t.Fatal("09:00–18:00 oralig'i noto'g'ri")
	}
	sat := time.Date(2026, 10, 17, 12, 0, 0, 0, time.Local)
	if Check(&cfg, st, "steam.exe", sat).Blocked {
		t.Fatal("shanba kuni bloklanmasligi kerak")
	}
	cfg.Rules[0] = Rule{App: "steam.exe", Kind: "schedule", From: "22:00", To: "06:00", On: true}
	if !Check(&cfg, st, "steam.exe", at(23, 30)).Blocked || !Check(&cfg, st, "steam.exe", at(5, 0)).Blocked || Check(&cfg, st, "steam.exe", at(12, 0)).Blocked {
		t.Fatal("tungi jadval noto'g'ri")
	}
}

func TestFocusPauseStrictProtected(t *testing.T) {
	st := NewState()
	now := at(12, 0)
	cfg := Config{FocusApps: []FocusApp{{App: "tg.exe", On: true}}, FocusUntil: now.Add(time.Minute).UnixMilli(),
		Rules: []Rule{{App: "explorer.exe", Kind: "always", On: true}}}
	if v := Check(&cfg, st, "TG.EXE", now); !v.Blocked || v.Reason != "focus" {
		t.Fatal("fokusda bloklanishi kerak")
	}
	if Check(&cfg, st, "tg.exe", now.Add(2*time.Minute)).Blocked {
		t.Fatal("fokus tugagach bloklanmasligi kerak")
	}
	if Check(&cfg, st, "explorer.exe", now).Blocked {
		t.Fatal("tizim jarayoni hech qachon bloklanmaydi")
	}
	cfg.PauseUntil = now.Add(time.Minute).UnixMilli()
	if Check(&cfg, st, "tg.exe", now).Blocked {
		t.Fatal("pauzada bloklanmasligi kerak")
	}
	cfg.Strict = true
	if !Check(&cfg, st, "tg.exe", now).Blocked {
		t.Fatal("qat'iy rejimda pauza ishlamaydi")
	}
}

func TestSitesWarnRows(t *testing.T) {
	if s, ok := SiteOf("Lofi beats - YouTube - Google Chrome", nil); !ok || s.Key != "site:youtube" {
		t.Fatal("YouTube aniqlanmadi")
	}
	if s, ok := SiteOf("Kun.uz — yangiliklar", []Rule{{App: "site:kun.uz", Label: "Kun.uz"}}); !ok || s.Key != "site:kun.uz" {
		t.Fatal("foydalanuvchi sayti aniqlanmadi")
	}
	if _, ok := SiteOf("Inbox - Gmail", nil); ok {
		t.Fatal("Gmail sayt sifatida aniqlanmasligi kerak")
	}
	st := NewState()
	now := at(15, 0)
	cfg := Config{Rules: []Rule{{App: "game.exe", Kind: "daily", Minutes: 30, On: true}}}
	st.Add(now, "game.exe", "Game", 26*60)
	if len(WarnDue(&cfg, st, now)) != 1 || len(WarnDue(&cfg, st, now)) != 0 {
		t.Fatal("ogohlantirish bir marta chiqishi kerak")
	}
	rows := st.Rows(now)
	if len(rows) != 1 || rows[0].Seconds != 26*60 || rows[0].Hours[15] != 26*60 || rows[0].Day != "2026-10-14" {
		t.Fatalf("qatorlar noto'g'ri: %+v", rows)
	}
	st.Add(now.AddDate(0, 0, -6), "old.exe", "", 5)
	st.Prune(now)
	if len(st.Usage) != 1 {
		t.Fatal("eski kunlar o'chirilishi kerak")
	}
	if FmtDur(3725) != "1 soat 2 daq" || FmtDur(59) != "59 s" {
		t.Fatal("FmtDur")
	}
}

func TestAppsFilterAndIcon(t *testing.T) {
	if ExeOfIcon(`"C:\Program Files\Discord\app.exe",0`) != `C:\Program Files\Discord\app.exe` || ExeOfIcon(`C:\x\icon.ico`) != "" {
		t.Fatal("ExeOfIcon")
	}
	l := NewAppList()
	l.Add(`C:\Program Files\Steam\steam.exe`, "Steam")
	l.Add(`C:\Program Files\Steam\uninstall.exe`, "Uninstall Steam")
	l.Add(`C:\Apps\Discord\Update.exe`, "Discord")
	l.Add(`C:\Apps\Discord\discord.exe`, "Discord")
	l.Add(`C:\Windows\explorer.exe`, "Explorer")
	l.Add(`C:\Program Files\Steam\steam.exe`, "Steam (dublikat)")
	got := l.List()
	if len(got) != 2 || got[0].Exe != "discord.exe" || got[1].Name != "Steam" {
		t.Fatalf("AppList: %+v", got)
	}
}

// Minimal .lnk: sarlavha + LinkInfo (ANSI LocalBasePath)
func TestLnkTarget(t *testing.T) {
	path := `C:\Program Files\Telegram Desktop\Telegram.exe`
	b := make([]byte, 0x4C)
	b[0] = 0x4C
	b[0x14] = 0x02 // HasLinkInfo
	li := make([]byte, 0x1C)
	li[4] = 0x1C // header size
	li[8] = 0x01 // VolumeIDAndLocalBasePath
	li[0x10] = 0x1C // LocalBasePathOffset
	li = append(li, append([]byte(path), 0)...)
	li = append(li, 0) // CommonPathSuffix ""
	li[0x18] = byte(len(li) - 1)
	li[0] = byte(len(li))
	b = append(b, li...)
	if got := LnkTarget(b); got != path {
		t.Fatalf("LnkTarget = %q", got)
	}
	if LnkTarget([]byte("nope")) != "" {
		t.Fatal("noto'g'ri fayl")
	}
}

func TestLnkSquirrel(t *testing.T) {
	path := `C:\Users\a\AppData\Local\Discord\Update.exe`
	args := `--processStart Discord.exe`
	b := make([]byte, 0x4C)
	b[0] = 0x4C
	b[0x14] = 0x02 | 0x20 | 0x80 // LinkInfo + Arguments + Unicode
	li := make([]byte, 0x1C)
	li[4] = 0x1C
	li[8] = 0x01
	li[0x10] = 0x1C
	li = append(li, append([]byte(path), 0)...)
	li = append(li, 0)
	li[0x18] = byte(len(li) - 1)
	li[0] = byte(len(li))
	b = append(b, li...)
	b = append(b, byte(len(args)), 0)
	for _, c := range args {
		b = append(b, byte(c), 0)
	}
	if got := LnkApp(b, `C:\x`, nil); got != `C:\Users\a\AppData\Local\Discord\Discord.exe` {
		t.Fatalf("LnkApp = %q", got)
	}
}

// IDList + RELATIVE_PATH (LinkInfo yo'q) va EnvironmentVariableDataBlock
func TestLnkRelativeAndEnv(t *testing.T) {
	str := func(s string) []byte { b := []byte{byte(len(s)), 0}; for _, c := range s { b = append(b, byte(c), 0) }; return b }
	b := make([]byte, 0x4C)
	b[0] = 0x4C
	b[0x14] = 0x01 | 0x08 | 0x80 // IDList + RelativePath + Unicode
	b = append(b, 2, 0, 0, 0)    // IDList: 2 bayt + terminator
	b = append(b, str(`..\..\..\..\..\..\Program Files\VideoLAN\VLC\vlc.exe`)...)
	got := LnkApp(b, `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\VideoLAN`, nil)
	if got != `C:\Program Files\VideoLAN\VLC\vlc.exe` {
		t.Fatalf("relative = %q", got)
	}
	// Env blok
	e := make([]byte, 0x4C)
	e[0] = 0x4C
	e[0x14] = 0x01 | 0x80
	e = append(e, 2, 0, 0, 0)
	blk := make([]byte, 0x314)
	blk[0], blk[1] = 0x14, 0x03
	blk[4], blk[5], blk[6], blk[7] = 0x01, 0x00, 0x00, 0xA0
	for i, c := range `%ProgramFiles%\Steam\steam.exe` {
		blk[8+260+i*2] = byte(c)
	}
	e = append(e, blk...)
	e = append(e, 0, 0, 0, 0)
	got = LnkApp(e, `C:\x`, func(s string) string { return strings.Replace(s, "%ProgramFiles%", `C:\Program Files`, 1) })
	if got != `C:\Program Files\Steam\steam.exe` {
		t.Fatalf("env = %q", got)
	}
}

func TestJunkFromRealList(t *testing.T) {
	bad := [][2]string{{`C:\a\accuserps.exe`, "A Care Center User Process"}, {`C:\a\javacpl.exe`, "About Java"}, {`C:\a\autoupdate-windows.exe`, "Check for Updates"},
		{`C:\Windows\rundll32.exe`, "Decoder Config"}, {`C:\a\jucheck.exe`, "Java Update Checker"}, {`C:\a\chrome_proxy.exe`, "LevelUpDay"},
		{`C:\a\crossdeviceservice.exe`, "Microsoft Cross Device Service"}, {`C:\a\msedgewebview2.exe`, "Microsoft Edge WebView2"}, {`C:\a\onedrivesetup.exe`, "Microsoft OneDrive"},
		{`C:\a\notezillatroubleshooter.exe`, "Notezilla Troubleshooter"}, {`C:\a\vlc.exe`, "VLC media player - reset preferences and cache files"},
		{`C:\a\widgetservice.exe`, "WidgetService.exe"}, {`C:\Windows\powershell.exe`, "Windows PowerShell (x86)"}, {`C:\a\wpscloudsvr.exe`, "WPS Office service program"}, {`C:\Windows\cmd.exe`, "xvid_encraw"}}
	for _, x := range bad {
		if UsefulApp(x[0], x[1]) {
			t.Errorf("keraksiz qo'shildi: %s (%s)", x[1], x[0])
		}
	}
	good := [][2]string{{`C:\a\chrome.exe`, "Google Chrome"}, {`C:\a\telegram.exe`, "Telegram"}, {`C:\a\tlauncher.exe`, "TLauncher"}, {`C:\a\cs.exe`, "CS 1.6"},
		{`C:\a\vlc.exe`, "VLC media player"}, {`C:\a\termius.exe`, "Termius"}, {`C:\a\left4dead2-launcher.exe`, "Запустить Left 4 Dead 2"}, {`C:\a\notezilla.exe`, "Notezilla Notes Browser"}}
	for _, x := range good {
		if !UsefulApp(x[0], x[1]) {
			t.Errorf("kerakli dastur tushib qoldi: %s", x[1])
		}
	}
	l := NewAppList()
	l.Add(`C:\a\left4dead2-launcher.exe`, "Запустить Left 4 Dead 2")
	if l.List()[0].Name != "Left 4 Dead 2" {
		t.Fatal("'Запустить' olib tashlanmadi")
	}
}

func TestEvents(t *testing.T) {
	st := NewState()
	now := at(10, 0)
	if !st.AddEvent(now, "block", "steam.exe", "Steam", "daily") || st.AddEvent(now.Add(30*time.Second), "block", "steam.exe", "Steam", "daily") {
		t.Fatal("60 soniya ichida takrorlanmasligi kerak")
	}
	if !st.AddEvent(now.Add(61*time.Second), "block", "steam.exe", "Steam", "daily") || !st.AddEvent(now, "warn", "steam.exe", "Steam", "daily") {
		t.Fatal("yangi hodisa qo'shilishi kerak")
	}
	ev := st.TakeEvents()
	if len(ev) != 3 || len(st.Events) != 0 {
		t.Fatalf("TakeEvents: %d", len(ev))
	}
	st.ReturnEvents(ev)
	if len(st.Events) != 3 {
		t.Fatal("ReturnEvents")
	}
}

func TestCategories(t *testing.T) {
	st := NewState()
	now := at(15, 0)
	if AutoCat("steam.exe", "") != "games" || AutoCat("mygame.exe", `D:\SteamLibrary\steamapps\common\Hades\mygame.exe`) != "games" || AutoCat("site:youtube", "") != "fun" || AutoCat("foo.exe", "") != "other" {
		t.Fatal("AutoCat")
	}
	st.AppCats = map[string]string{"hades.exe": "games"}
	cfg := Config{Rules: []Rule{{App: "cat:games", Kind: "daily", Minutes: 60, On: true}}, Cats: map[string]string{"telegram.exe": "work"}}
	st.Add(now, "steam.exe", "Steam", 40*60)
	if Check(&cfg, st, "hades.exe", now).Blocked {
		t.Fatal("40 daq — hali bloklanmasin")
	}
	st.Add(now, "hades.exe", "Hades", 20*60) // o'yinlar jami 60 daq
	if v := Check(&cfg, st, "hades.exe", now); !v.Blocked || v.Reason != "daily" {
		t.Fatalf("kategoriya limiti: %+v", v)
	}
	if !Check(&cfg, st, "steam.exe", now).Blocked || Check(&cfg, st, "chrome.exe", now).Blocked {
		t.Fatal("faqat o'yinlar bloklanadi")
	}
	// foydalanuvchi kategoriyasi
	cfg2 := Config{FocusApps: []FocusApp{{App: "cat:social", On: true}}, FocusUntil: now.Add(time.Minute).UnixMilli(), Cats: map[string]string{"telegram.exe": "work"}}
	if Check(&cfg2, st, "telegram.exe", now).Blocked || !Check(&cfg2, st, "discord.exe", now).Blocked {
		t.Fatal("cats override / fokus kategoriyasi")
	}
}
