// Focusgate agent yadrosi: foydalanish hisobi, qoidalar (limitlar) va holatni saqlash.
// Bu fayl platformaga bog'liq emas — Linux'da ham test qilinadi (core_test.go).
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---------- Sayt'dan keladigan sozlamalar (fg_config.config) ----------
type Rule struct {
	ID      string `json:"id"`
	App     string `json:"app"`   // "discord.exe" yoki "site:youtube"
	Label   string `json:"label"` // ko'rinadigan nom
	Kind    string `json:"kind"`  // daily | always | schedule | session
	Minutes int    `json:"minutes"`
	Days    []int  `json:"days"` // 1=Du ... 7=Ya (schedule uchun; bo'sh — har kuni)
	From    string `json:"from"` // "09:00"
	To      string `json:"to"`   // "18:00"
	On      bool   `json:"on"`
}

type FocusApp struct {
	App   string `json:"app"`
	Label string `json:"label"`
	On    bool   `json:"on"`
}

type Config struct {
	Track      *bool      `json:"track"`
	Strict     bool       `json:"strict"`
	Notif      *bool      `json:"notif"`
	Rules      []Rule     `json:"rules"`
	FocusApps  []FocusApp `json:"focusApps"`
	FocusUntil int64      `json:"focusUntil"` // ms
	PauseUntil int64      `json:"pauseUntil"` // ms
}

func (c *Config) TrackOn() bool { return c.Track == nil || *c.Track }
func (c *Config) NotifOn() bool { return c.Notif == nil || *c.Notif }

// ---------- Foydalanish hisobi ----------
type AppUsage struct {
	Label string    `json:"label"`
	Sec   int       `json:"s"`
	Hours [24]int   `json:"h"`
}

type State struct {
	Token      string                          `json:"token"`
	DeviceName string                          `json:"deviceName"`
	Usage      map[string]map[string]*AppUsage `json:"usage"` // kun → ilova → hisob
	Config     Config                          `json:"config"`
	Warned     map[string]bool                 `json:"warned"` // "kun|qoida" — ogohlantirish yuborilgan
	AppsSentAt int64                           `json:"appsSentAt"` // dasturlar ro'yxati oxirgi marta yuborilgan (unix s)
	Events     []Event                         `json:"events"`     // serverga hali yuborilmagan hodisalar
	lastEvent  map[string]time.Time
	mu         sync.Mutex
}

func NewState() *State { return &State{Usage: map[string]map[string]*AppUsage{}, Warned: map[string]bool{}} }

func DayKey(t time.Time) string { return t.Format("2006-01-02") }

// Add — ilovaga sekund qo'shadi.
func (s *State) Add(t time.Time, app, label string, sec int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := DayKey(t)
	if s.Usage[d] == nil {
		s.Usage[d] = map[string]*AppUsage{}
	}
	u := s.Usage[d][app]
	if u == nil {
		u = &AppUsage{}
		s.Usage[d][app] = u
	}
	if label != "" {
		u.Label = label
	}
	u.Sec += sec
	u.Hours[t.Hour()] += sec
}

func (s *State) Seconds(t time.Time, app string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u := s.Usage[DayKey(t)][app]; u != nil {
		return u.Sec
	}
	return 0
}

func (s *State) TotalToday(t time.Time) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, u := range s.Usage[DayKey(t)] {
		n += u.Sec
	}
	return n
}

// Prune — 4 kundan eski hisoblarni o'chiradi.
func (s *State) Prune(t time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	keep := map[string]bool{}
	for i := 0; i < 4; i++ {
		keep[DayKey(t.AddDate(0, 0, -i))] = true
	}
	for d := range s.Usage {
		if !keep[d] {
			delete(s.Usage, d)
		}
	}
	for k := range s.Warned {
		if !keep[strings.SplitN(k, "|", 2)[0]] {
			delete(s.Warned, k)
		}
	}
}

type UsageRow struct {
	Day     string `json:"day"`
	App     string `json:"app"`
	Label   string `json:"label"`
	Seconds int    `json:"seconds"`
	Hours   []int  `json:"hours"`
}

// Rows — serverga yuboriladigan qatorlar (bugun va kecha).
func (s *State) Rows(t time.Time) []UsageRow {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []UsageRow
	for _, d := range []string{DayKey(t), DayKey(t.AddDate(0, 0, -1))} {
		apps := make([]string, 0, len(s.Usage[d]))
		for a := range s.Usage[d] {
			apps = append(apps, a)
		}
		sort.Strings(apps)
		for _, a := range apps {
			u := s.Usage[d][a]
			if u.Sec < 1 {
				continue
			}
			out = append(out, UsageRow{Day: d, App: a, Label: u.Label, Seconds: u.Sec, Hours: u.Hours[:]})
		}
	}
	return out
}

func statePath() string {
	dir, err := os.UserConfigDir() // %APPDATA%
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "LevelUpDay", "Focusgate", "state.json")
}

func (s *State) Save() error {
	s.mu.Lock()
	b, err := json.MarshalIndent(s, "", " ")
	s.mu.Unlock()
	if err != nil {
		return err
	}
	p := statePath()
	_ = os.MkdirAll(filepath.Dir(p), 0o700)
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func LoadState() *State {
	s := NewState()
	if b, err := os.ReadFile(statePath()); err == nil {
		_ = json.Unmarshal(b, s)
	}
	if s.Usage == nil {
		s.Usage = map[string]map[string]*AppUsage{}
	}
	if s.Warned == nil {
		s.Warned = map[string]bool{}
	}
	return s
}

// ---------- Saytlar: brauzer oynasi sarlavhasidan aniqlanadi ----------
var Browsers = map[string]bool{
	"chrome.exe": true, "msedge.exe": true, "firefox.exe": true, "brave.exe": true, "opera.exe": true,
	"opera_gx.exe": true, "vivaldi.exe": true, "browser.exe": true, "arc.exe": true, "yandex.exe": true,
}

type Site struct{ Key, Label, Match string }

// KnownSites — sarlavhada qidiriladigan so'zlar (kichik harf).
var KnownSites = []Site{
	{"site:youtube", "YouTube", "youtube"},
	{"site:instagram", "Instagram", "instagram"},
	{"site:tiktok", "TikTok", "tiktok"},
	{"site:facebook", "Facebook", "facebook"},
	{"site:x", "X (Twitter)", " / x"},
	{"site:twitter", "Twitter", "twitter"},
	{"site:reddit", "Reddit", "reddit"},
	{"site:twitch", "Twitch", "twitch"},
	{"site:netflix", "Netflix", "netflix"},
	{"site:vk", "VK", "вконтакте"},
	{"site:telegram", "Telegram Web", "telegram web"},
	{"site:discord", "Discord (web)", "discord"},
	{"site:pinterest", "Pinterest", "pinterest"},
	{"site:kinopoisk", "Кинопоиск", "кинопоиск"},
}

// SiteOf — brauzer sarlavhasi qaysi saytga tegishli (qo'shimcha: foydalanuvchi qo'shgan "site:..." qoidalari).
func SiteOf(title string, extra []Rule) (Site, bool) {
	t := strings.ToLower(title)
	for _, r := range extra {
		if strings.HasPrefix(r.App, "site:") {
			kw := strings.TrimPrefix(r.App, "site:")
			if kw != "" && strings.Contains(t, kw) {
				lbl := r.Label
				if lbl == "" {
					lbl = kw
				}
				return Site{r.App, lbl, kw}, true
			}
		}
	}
	for _, s := range KnownSites {
		if strings.Contains(t, s.Match) {
			return s, true
		}
	}
	return Site{}, false
}

// ---------- Qoidalar ----------
// Protected — hech qachon yopilmaydigan tizim jarayonlari.
var Protected = map[string]bool{
	"explorer.exe": true, "system": true, "svchost.exe": true, "winlogon.exe": true, "csrss.exe": true,
	"dwm.exe": true, "lsass.exe": true, "services.exe": true, "smss.exe": true, "wininit.exe": true,
	"taskmgr.exe": true, "conhost.exe": true, "runtimebroker.exe": true, "searchhost.exe": true,
	"startmenuexperiencehost.exe": true, "shellexperiencehost.exe": true, "sihost.exe": true,
	"ctfmon.exe": true, "fontdrvhost.exe": true, "focusgate.exe": true, "applicationframehost.exe": true,
}

type Verdict struct {
	Blocked bool
	Reason  string // "daily" | "always" | "schedule" | "focus" | "session"
	Rule    *Rule
}

func hm(s string) int {
	var h, m int
	if len(s) >= 4 {
		p := strings.SplitN(s, ":", 2)
		if len(p) == 2 {
			for _, c := range p[0] {
				h = h*10 + int(c-'0')
			}
			for _, c := range p[1] {
				m = m*10 + int(c-'0')
			}
		}
	}
	return h*60 + m
}

func inSchedule(r *Rule, t time.Time) bool {
	wd := int(t.Weekday())
	if wd == 0 {
		wd = 7
	}
	if len(r.Days) > 0 {
		ok := false
		for _, d := range r.Days {
			if d == wd {
				ok = true
			}
		}
		if !ok {
			return false
		}
	}
	from, to, now := hm(r.From), hm(r.To), t.Hour()*60+t.Minute()
	if from == to {
		return true
	}
	if from < to {
		return now >= from && now < to
	}
	return now >= from || now < to // tun bo'yi (22:00–06:00)
}

// Check — ilova (exe yoki site:...) hozir bloklanganmi?
func Check(cfg *Config, st *State, app string, t time.Time) Verdict {
	ms := t.UnixMilli()
	if !cfg.Strict && cfg.PauseUntil > ms {
		return Verdict{}
	}
	if Protected[app] {
		return Verdict{}
	}
	if cfg.FocusUntil > ms {
		for _, f := range cfg.FocusApps {
			if f.On && strings.EqualFold(f.App, app) {
				return Verdict{true, "focus", nil}
			}
		}
	}
	for i := range cfg.Rules {
		r := &cfg.Rules[i]
		if !r.On || !strings.EqualFold(r.App, app) {
			continue
		}
		switch r.Kind {
		case "always":
			return Verdict{true, "always", r}
		case "schedule":
			if inSchedule(r, t) {
				return Verdict{true, "schedule", r}
			}
		case "daily":
			if r.Minutes > 0 && st.Seconds(t, app) >= r.Minutes*60 {
				return Verdict{true, "daily", r}
			}
		}
	}
	return Verdict{}
}

// SessionLimit — "session" turidagi qoida bo'lsa, bir ochilishga ruxsat etilgan daqiqalar.
func SessionLimit(cfg *Config, app string) int {
	for _, r := range cfg.Rules {
		if r.On && r.Kind == "session" && strings.EqualFold(r.App, app) && r.Minutes > 0 {
			return r.Minutes
		}
	}
	return 0
}

// WarnDue — kunlik limit tugashiga ≤5 daqiqa qolganda bir marta ogohlantirish.
func WarnDue(cfg *Config, st *State, t time.Time) []Rule {
	var out []Rule
	for _, r := range cfg.Rules {
		if !r.On || r.Kind != "daily" || r.Minutes <= 5 {
			continue
		}
		used := st.Seconds(t, r.App)
		left := r.Minutes*60 - used
		key := DayKey(t) + "|" + r.App
		st.mu.Lock()
		done := st.Warned[key]
		if left > 0 && left <= 300 && !done {
			st.Warned[key] = true
			out = append(out, r)
		}
		st.mu.Unlock()
	}
	return out
}

func FmtDur(sec int) string {
	h, m := sec/3600, (sec%3600)/60
	if h > 0 {
		if m > 0 {
			return itoa(h) + " soat " + itoa(m) + " daq"
		}
		return itoa(h) + " soat"
	}
	if m > 0 {
		return itoa(m) + " daq"
	}
	return itoa(sec) + " s"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// ---------- Hodisalar (bloklash/ogohlantirish) → server → Telegram ----------
type Event struct {
	Kind   string `json:"kind"` // block | site_block | warn
	App    string `json:"app"`
	Label  string `json:"label"`
	Reason string `json:"reason"`
	At     int64  `json:"at"` // ms
}

// AddEvent — hodisani navbatga qo'shadi (bir xil hodisa 60 soniyada bir marta; navbat 200 tadan oshmaydi).
func (s *State) AddEvent(t time.Time, kind, app, label, reason string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.lastEvent == nil {
		s.lastEvent = map[string]time.Time{}
	}
	key := kind + "|" + app
	if last, ok := s.lastEvent[key]; ok && t.Sub(last) < 60*time.Second {
		return false
	}
	s.lastEvent[key] = t
	s.Events = append(s.Events, Event{kind, app, label, reason, t.UnixMilli()})
	if len(s.Events) > 200 {
		s.Events = s.Events[len(s.Events)-200:]
	}
	return true
}

// TakeEvents — yuborish uchun navbatdagi hodisalar (muvaffaqiyatsiz bo'lsa ReturnEvents bilan qaytariladi).
func (s *State) TakeEvents() []Event {
	s.mu.Lock()
	defer s.mu.Unlock()
	ev := s.Events
	s.Events = nil
	return ev
}

func (s *State) ReturnEvents(ev []Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Events = append(ev, s.Events...)
}
