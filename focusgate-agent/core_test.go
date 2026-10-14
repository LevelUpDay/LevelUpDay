package main

import (
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
