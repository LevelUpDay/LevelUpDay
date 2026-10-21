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
	PerDay  map[string]int `json:"perDay"` // kunlik limit hafta kuni bo'yicha: "1".."7" → daqiqa (yo'q — Minutes)
	Devs    []string       `json:"devs"`   // qaysi qurilmalarda (fg_devices.id); bo'sh — hammasida
}

// forDevice — qoida shu qurilmada ishlaydimi (ID hali noma'lum bo'lsa — ishlaydi, xavfsizroq)
func (r *Rule) forDevice(me string) bool {
	if len(r.Devs) == 0 || me == "" {
		return true
	}
	for _, d := range r.Devs {
		if d == me {
			return true
		}
	}
	return false
}

func (s *State) devID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.DeviceID
}

// Mode — "Ish", "Uyqu", "Imtihon" kabi rejim: yoqilganda (yoki jadval vaqtida) ro'yxatdagilar bloklanadi.
type Mode struct {
	ID    string     `json:"id"`
	Name  string     `json:"name"`
	Apps  []FocusApp `json:"apps"`
	On    bool       `json:"on"`
	Sched bool       `json:"sched"`
	Days  []int      `json:"days"`
	From  string     `json:"from"`
	To    string     `json:"to"`
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
	Cats       map[string]string `json:"cats"`
	Modes      []Mode            `json:"modes"`
	AllowOnly  bool              `json:"allowOnly"`  // fokus paytida faqat AllowApps ishlaydi
	AllowApps  []FocusApp        `json:"allowApps"`
	Mindful    []FocusApp        `json:"mindful"`    // ochishdan oldin "rostdan kerakmi?" so'raladi
	MindfulMin int               `json:"mindfulMin"` // "Ha" desa — necha daqiqa ruxsat (standart 15)
	MindfulSec int               `json:"mindfulSec"` // savoldan oldin kutish (standart 10 s)
	WarnAt     []int             `json:"warnAt"`     // qo'shimcha ogohlantirish: limitning 50%, 80% ...
	StatsResetAt int64           `json:"statsResetAt"` // saytda "statistikani tozalash" bosilgan vaqt (ms)
	Lang       string            `json:"lang"` // LevelUpDay'da tanlangan til: uz | en | ru // foydalanuvchi o'zgartirgan kategoriyalar: ilova → kategoriya
}

func (c *Config) TrackOn() bool { return c.Track == nil || *c.Track }
func (c *Config) NotifOn() bool { return c.Notif == nil || *c.Notif }

// ---------- Foydalanish hisobi ----------
type AppUsage struct {
	Label string  `json:"label"`
	Sec   int     `json:"s"`
	Hours [24]int `json:"h"`
	Opens int     `json:"o"`  // necha marta ochilgan (boshqa ilovadan o'tilgan)
	OH    [24]int `json:"oh"` // ochilishlar soatlar bo'yicha
}

type State struct {
	Token      string                          `json:"token"`
	DeviceID   string                          `json:"deviceId"` // serverdagi fg_devices.id (kengaytma shu kompyuterga bog'lanishi uchun)
	DeviceName string                          `json:"deviceName"`
	Usage      map[string]map[string]*AppUsage `json:"usage"` // kun → ilova → hisob
	Config     Config                          `json:"config"`
	Warned     map[string]bool                 `json:"warned"` // "kun|qoida" — ogohlantirish yuborilgan
	AppsSentAt int64                           `json:"appsSentAt"` // dasturlar ro'yxati oxirgi marta yuborilgan (unix s)
	Events     []Event                         `json:"events"`     // serverga hali yuborilmagan hodisalar
	AppCats    map[string]string               `json:"appCats"`    // skanerda aniqlangan kategoriyalar (o'rnatilgan papka bo'yicha)
	ResetSeen  int64                           `json:"resetSeen"`  // qaysi tozalashgacha mahalliy hisob o'chirilgan (ms)
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

// AddOpen — ilova ochilganini (seans boshlanganini) sanaydi.
func (s *State) AddOpen(t time.Time, app, label string) {
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
	if label != "" && u.Label == "" {
		u.Label = label
	}
	u.Opens++
	u.OH[t.Hour()]++
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

// ApplyReset — saytda statistika tozalangan bo'lsa (statsResetAt yangiroq), mahalliy hisob ham o'chiriladi.
func (s *State) ApplyReset(at int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if at <= s.ResetSeen {
		return false
	}
	s.Usage = map[string]map[string]*AppUsage{}
	s.Warned = map[string]bool{}
	s.Events = nil
	s.ResetSeen = at
	return true
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
	Seconds   int    `json:"seconds"`
	Hours     []int  `json:"hours"`
	Opens     int    `json:"opens"`
	OpenHours []int  `json:"open_hours"`
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
			out = append(out, UsageRow{Day: d, App: a, Label: u.Label, Seconds: u.Sec, Hours: u.Hours[:], Opens: u.Opens, OpenHours: u.OH[:]})
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
			lbl := r.Label
			if lbl == "" {
				lbl = kw
			}
			// Sarlavhada odatda domen emas, sayt nomi bo'ladi ("Kun.uz — …", "… · GitHub") — nom bo'yicha ham qidiriladi
			name := strings.ToLower(strings.TrimSpace(r.Label))
			if kw != "" && (strings.Contains(t, kw) || (strings.Contains(kw, ".") && len([]rune(name)) >= 4 && strings.Contains(t, name))) {
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
	Reason  string // "daily" | "always" | "schedule" | "focus" | "session" | "mode" | "allow"
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

func weekday(t time.Time) int {
	wd := int(t.Weekday())
	if wd == 0 {
		wd = 7
	}
	return wd
}

func inSchedule(r *Rule, t time.Time) bool { return inWindow(r.Days, r.From, r.To, t) }

func inWindow(days []int, fromS, toS string, t time.Time) bool {
	wd := weekday(t)
	if len(days) > 0 {
		ok := false
		for _, d := range days {
			if d == wd {
				ok = true
			}
		}
		if !ok {
			return false
		}
	}
	from, to, now := hm(fromS), hm(toS), t.Hour()*60+t.Minute()
	if from == to {
		return true
	}
	if from < to {
		return now >= from && now < to
	}
	return now >= from || now < to // tun bo'yi (22:00–06:00)
}

// RuleMinutes — kunlik limit bugun necha daqiqa (hafta kuni bo'yicha alohida bo'lishi mumkin).
func RuleMinutes(r *Rule, t time.Time) int {
	if r.PerDay != nil {
		if m, ok := r.PerDay[itoa(weekday(t))]; ok {
			return m
		}
	}
	return r.Minutes
}

// ModeActive — rejim hozir yoqilganmi (qo'lda yoki jadval bo'yicha).
func ModeActive(m *Mode, t time.Time) bool {
	return m.On || (m.Sched && inWindow(m.Days, m.From, m.To, t))
}

// FocusOn — fokus sessiyasi davom etmoqdami.
func FocusOn(cfg *Config, t time.Time) bool { return cfg.FocusUntil > t.UnixMilli() }

// Allowed — "faqat ruxsat etilganlar" fokus rejimida ilova ruxsat etilganmi.
func Allowed(cfg *Config, st *State, app string) bool {
	if Protected[app] || strings.HasPrefix(app, "focusgate") {
		return true
	}
	for _, f := range cfg.AllowApps {
		if matchApp(cfg, st, f.App, app) {
			return true
		}
	}
	return false
}

// AllowBlocks — fokusdagi oq ro'yxat rejimida shu ilova to'xtatilishi kerakmi.
func AllowBlocks(cfg *Config, st *State, app string, t time.Time) bool {
	if !cfg.AllowOnly || !FocusOn(cfg, t) || (!cfg.Strict && cfg.PauseUntil > t.UnixMilli()) {
		return false
	}
	return !Allowed(cfg, st, app)
}

// IsMindful — ochishdan oldin "rostdan kerakmi?" so'raladigan ilova.
func IsMindful(cfg *Config, st *State, app string) bool {
	for _, f := range cfg.Mindful {
		if f.On && matchApp(cfg, st, f.App, app) {
			return true
		}
	}
	return false
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
			if f.On && matchApp(cfg, st, f.App, app) {
				return Verdict{true, "focus", nil}
			}
		}
	}
	for i := range cfg.Modes {
		m := &cfg.Modes[i]
		if !ModeActive(m, t) {
			continue
		}
		for _, f := range m.Apps {
			if matchApp(cfg, st, f.App, app) {
				return Verdict{true, "mode", &Rule{Label: m.Name}}
			}
		}
	}
	me := st.devID()
	for i := range cfg.Rules {
		r := &cfg.Rules[i]
		if !r.On || !r.forDevice(me) || !matchApp(cfg, st, r.App, app) {
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
			if m := RuleMinutes(r, t); m > 0 && usedFor(cfg, st, r.App, t) >= m*60 {
				return Verdict{true, "daily", r}
			}
		}
	}
	return Verdict{}
}

// SessionLimit — "session" turidagi qoida bo'lsa, bir ochilishga ruxsat etilgan daqiqalar.
func SessionLimit(cfg *Config, st *State, app string) int {
	me := st.devID()
	for _, r := range cfg.Rules {
		if r.On && r.Kind == "session" && r.forDevice(me) && matchApp(cfg, st, r.App, app) && r.Minutes > 0 {
			return r.Minutes
		}
	}
	return 0
}

// Warn — ogohlantirish: Pct = 0 — "5 daqiqa qoldi", aks holda limitning Pct foizi ishlatildi.
type Warn struct {
	Rule Rule
	Pct  int
	Left int // soniya
}

// WarnDue — kunlik limit tugashiga ≤5 daqiqa qolganda va cfg.WarnAt foizlarida (har biri kuniga bir marta).
func WarnDue(cfg *Config, st *State, t time.Time) []Warn {
	var out []Warn
	me := st.devID()
	for _, r := range cfg.Rules {
		mins := RuleMinutes(&r, t)
		if !r.On || r.Kind != "daily" || mins <= 0 || !r.forDevice(me) {
			continue
		}
		used := usedFor(cfg, st, r.App, t)
		left := mins*60 - used
		if left <= 0 {
			continue
		}
		st.mu.Lock()
		// Eng katta yetilgan foiz bitta xabar bo'ladi (50% va 80% bir vaqtda yetilsa — faqat 80%)
		best := -1
		for _, p := range cfg.WarnAt {
			if p <= 0 || p >= 100 || used*100 < mins*60*p {
				continue
			}
			key := DayKey(t) + "|" + r.App + "|p" + itoa(p)
			if !st.Warned[key] {
				st.Warned[key] = true
				if p > best {
					best = p
				}
			}
		}
		key := DayKey(t) + "|" + r.App
		if mins > 5 && left <= 300 && !st.Warned[key] {
			st.Warned[key] = true
			best = 0
		}
		st.mu.Unlock()
		if best >= 0 {
			out = append(out, Warn{r, best, left})
		}
	}
	return out
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

// ---------- Faol foydalanish: video/o'yinda klaviaturaga tegilmasa ham vaqt hisoblanadi ----------
// mediaApps — video pleyerlar: film ko'rilayotganda sichqoncha ishlatilmaydi, lekin vaqt o'tyapti
var mediaApps = map[string]bool{
	"vlc.exe": true, "mpv.exe": true, "potplayermini64.exe": true, "potplayermini.exe": true, "mpc-hc64.exe": true, "mpc-hc.exe": true,
	"mpc-be64.exe": true, "kmplayer.exe": true, "wmplayer.exe": true, "video.ui.exe": true, "netflix.exe": true, "stremio.exe": true,
	"kodi.exe": true, "plex.exe": true, "smplayer.exe": true, "celluloid.exe": true, "totem.exe": true, "haruna.exe": true, "mplayer.exe": true,
}

// videoSites — brauzerda ochiq bo'lsa, harakatsizlikda ham hisoblanadigan saytlar (sarlavhadan)
var videoSites = map[string]bool{
	"site:youtube": true, "site:netflix": true, "site:twitch": true, "site:kinopoisk": true, "site:primevideo.com": true,
	"site:disneyplus.com": true, "site:rutube.ru": true, "site:ivi.ru": true, "site:mover.uz": true, "site:kick.com": true, "site:tiktok": true,
}

// ActiveUse — shu soniya hisoblanadimi: odatda 2 daqiqa harakatsizlikdan keyin to'xtaydi; video pleyer va video saytda — 3 soatgacha,
// o'yinlarda (geympad bilan o'ynalganda klaviatura ishlamaydi) — 30 daqiqagacha.
func ActiveUse(idle uint32, exe, title string, rules []Rule, cats map[string]string) bool {
	if idle < 120 {
		return true
	}
	if mediaApps[exe] {
		return idle < 3*3600
	}
	if Browsers[exe] {
		if s, ok := SiteOf(title, rules); ok && videoSites[s.Key] {
			return idle < 3*3600
		}
		return false
	}
	if cats[exe] == "games" || AutoCat(exe, "") == "games" {
		return idle < 30*60
	}
	return false
}
