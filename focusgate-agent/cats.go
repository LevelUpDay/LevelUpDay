// Kategoriyalar: har bir dastur/sayt avtomatik toifalanadi (lug'at + o'rnatilgan papka), foydalanuvchi o'zgartira oladi
// (config.cats). Qoidalar butun kategoriyaga ham qo'yilishi mumkin: app = "cat:games" va h.k.
// Sayt (blocker.js) va kengaytma (rules.js) dagi lug'at bilan bir xil bo'lishi kerak.
package main

import (
	"regexp"
	"strings"
	"time"
)

var Categories = []string{"work", "study", "social", "games", "fun", "web", "other"}

var catDict = map[string]string{
	// 🌐 Brauzerlar
	"chrome.exe": "web", "msedge.exe": "web", "firefox.exe": "web", "brave.exe": "web", "opera.exe": "web", "opera_gx.exe": "web",
	"vivaldi.exe": "web", "browser.exe": "web", "arc.exe": "web", "yandex.exe": "web", "iexplore.exe": "web",
	// 💬 Ijtimoiy / muloqot
	"telegram.exe": "social", "discord.exe": "social", "whatsapp.exe": "social", "viber.exe": "social", "skype.exe": "social",
	"signal.exe": "social", "messenger.exe": "social", "instagram.exe": "social", "tiktok.exe": "social", "linphone.exe": "social", "microsip.exe": "social",
	"site:instagram": "social", "site:tiktok": "social", "site:facebook": "social", "site:x": "social", "site:twitter": "social",
	"site:vk": "social", "site:telegram": "social", "site:discord": "social", "site:reddit": "social", "site:pinterest": "social",
	// 🎮 O'yinlar
	"steam.exe": "games", "steamwebhelper.exe": "games", "epicgameslauncher.exe": "games", "riotclientservices.exe": "games", "leagueclient.exe": "games",
	"valorant.exe": "games", "valorant-win64-shipping.exe": "games", "robloxplayerbeta.exe": "games", "minecraftlauncher.exe": "games", "tlauncher.exe": "games",
	"cs2.exe": "games", "csgo.exe": "games", "cs.exe": "games", "hl.exe": "games", "hl2.exe": "games", "dota2.exe": "games", "gta5.exe": "games", "gtavlauncher.exe": "games",
	"fortniteclient-win64-shipping.exe": "games", "battle.net.exe": "games", "origin.exe": "games", "eadesktop.exe": "games", "upc.exe": "games",
	"ubisoftconnect.exe": "games", "genshinimpact.exe": "games", "left4dead2.exe": "games", "left4dead2-launcher.exe": "games", "tslgame.exe": "games",
	"overwatch.exe": "games", "rocketleague.exe": "games", "goggalaxy.exe": "games", "playnite.desktopapp.exe": "games", "pubg.exe": "games",
	"site:roblox": "games",
	// 🎬 Ko'ngilochar (video / musiqa)
	"vlc.exe": "fun", "spotify.exe": "fun", "potplayermini64.exe": "fun", "potplayermini.exe": "fun", "mpc-hc64.exe": "fun", "mpc-hc.exe": "fun",
	"netflix.exe": "fun", "aimp.exe": "fun", "itunes.exe": "fun", "kmplayer.exe": "fun", "utweb.exe": "fun", "qbittorrent.exe": "fun",
	"site:youtube": "fun", "site:netflix": "fun", "site:twitch": "fun", "site:kinopoisk": "fun",
	// 💼 Ish
	"code.exe": "work", "cursor.exe": "work", "devenv.exe": "work", "idea64.exe": "work", "pycharm64.exe": "work", "webstorm64.exe": "work",
	"studio64.exe": "work", "winword.exe": "work", "excel.exe": "work", "powerpnt.exe": "work", "onenote.exe": "work", "outlook.exe": "work",
	"ms-teams.exe": "work", "teams.exe": "work", "slack.exe": "work", "zoom.exe": "work", "notion.exe": "work", "obsidian.exe": "work",
	"figma.exe": "work", "photoshop.exe": "work", "illustrator.exe": "work", "adobe premiere pro.exe": "work", "afterfx.exe": "work",
	"blender.exe": "work", "termius.exe": "work", "putty.exe": "work", "windowsterminal.exe": "work", "postman.exe": "work",
	"docker desktop.exe": "work", "githubdesktop.exe": "work", "acrobat.exe": "work", "acrord32.exe": "work", "wps.exe": "work",
	"et.exe": "work", "wpp.exe": "work", "notepad++.exe": "work", "sublime_text.exe": "work", "notezilla.exe": "work", "radmin.exe": "work",
	"anydesk.exe": "work", "teamviewer.exe": "work", "obs64.exe": "work", "explorer.exe": "work", "notepad.exe": "work",
	// 📚 O'qish
	"anki.exe": "study", "site:coursera": "study", "site:udemy": "study", "site:khanacademy": "study", "site:duolingo": "study", "site:levelupday": "study",
}

var gamePath = regexp.MustCompile(`(?i)\\(steamapps\\common|epic games|riot games|ubisoft game launcher\\games|ea games|gog galaxy\\games|xboxgames|games)\\`)

// AutoCat — avtomatik kategoriya (foydalanuvchi o'zgartirmagan bo'lsa).
func AutoCat(app, path string) string {
	app = strings.ToLower(app)
	if c, ok := catDict[app]; ok {
		return c
	}
	if path != "" && gamePath.MatchString(path) {
		return "games"
	}
	if strings.HasPrefix(app, "site:") {
		return "web"
	}
	return "other"
}

// CatOf — ilova kategoriyasi: config.cats (foydalanuvchi) → agent aniqlagani (o'rnatilgan papka) → lug'at.
func CatOf(cfg *Config, st *State, app string) string {
	app = strings.ToLower(app)
	if c, ok := cfg.Cats[app]; ok && c != "" {
		return c
	}
	if st != nil {
		st.mu.Lock()
		c, ok := st.AppCats[app]
		st.mu.Unlock()
		if ok {
			return c
		}
	}
	return AutoCat(app, "")
}

// matchApp — qoida ilovaga mos keladimi (to'g'ridan-to'g'ri yoki kategoriya orqali).
func matchApp(cfg *Config, st *State, ruleApp, app string) bool {
	if strings.EqualFold(ruleApp, app) {
		return true
	}
	if strings.HasPrefix(ruleApp, "cat:") {
		return CatOf(cfg, st, app) == strings.TrimPrefix(ruleApp, "cat:")
	}
	return false
}

// usedFor — qoida uchun bugun sarflangan soniyalar (kategoriya bo'lsa — undagi barcha ilovalar yig'indisi).
func usedFor(cfg *Config, st *State, ruleApp string, t time.Time) int {
	n := usedDay(cfg, st, ruleApp, t)
	// Kun boshlanishi (masalan 04:00): yarim tundan keyin ham kechagi limit davom etadi
	if cfg.DayStart > 0 && cfg.DayStart <= 6 && t.Hour() < cfg.DayStart {
		n += usedDay(cfg, st, ruleApp, t.Add(-24*time.Hour))
	}
	return n
}

func usedDay(cfg *Config, st *State, ruleApp string, t time.Time) int {
	if !strings.HasPrefix(ruleApp, "cat:") {
		return st.Seconds(t, ruleApp)
	}
	cat := strings.TrimPrefix(ruleApp, "cat:")
	st.mu.Lock()
	apps := make([]string, 0)
	secs := map[string]int{}
	for a, u := range st.Usage[DayKey(t)] {
		apps = append(apps, a)
		secs[a] = u.Sec
	}
	st.mu.Unlock()
	n := 0
	for _, a := range apps {
		if CatOf(cfg, st, a) == cat {
			n += secs[a]
		}
	}
	return n
}
