// Agent matnlari 3 tilda: o'zbek, ingliz, rus. Til LevelUpDay'da tanlangan tildan (config.lang) olinadi,
// bo'lmasa — Windows tilidan.
package main

import (
	"strings"
	"sync"
)

var tr = map[string][3]string{
	"starting":       {"Ishga tushmoqda…", "Starting…", "Запуск…"},
	"today":          {"⏱ Bugun: ", "⏱ Today: ", "⏱ Сегодня: "},
	"today_tip":      {"LevelUpDay Focusgate — bugun ", "LevelUpDay Focusgate — today ", "LevelUpDay Focusgate — сегодня "},
	"open":           {"📊 LevelUpDay'ni ochish", "📊 Open LevelUpDay", "📊 Открыть LevelUpDay"},
	"open_tip":       {"Statistika va limitlar", "Stats and limits", "Статистика и лимиты"},
	"pair":           {"🔗 Akkauntga ulash", "🔗 Connect account", "🔗 Подключить аккаунт"},
	"pair_confirm":   {"🔗 Brauzerda ulashni tasdiqlash (%s)", "🔗 Confirm in browser (%s)", "🔗 Подтвердить в браузере (%s)"},
	"repair":         {"🔗 Boshqa akkauntga qayta ulash", "🔗 Reconnect to another account", "🔗 Подключить другой аккаунт"},
	"autostart":      {"Windows bilan birga ishga tushish", "Start with Windows", "Запускать вместе с Windows"},
	"pause":          {"⏸ 15 daqiqa pauza", "⏸ Pause for 15 minutes", "⏸ Пауза 15 минут"},
	"pause_tip":      {"Limitlarni vaqtincha to'xtatish", "Pause limits for a while", "Временно отключить лимиты"},
	"quit":           {"Chiqish", "Quit", "Выход"},
	"focus_left":     {"🎯 Fokus: %s qoldi", "🎯 Focus: %s left", "🎯 Фокус: осталось %s"},
	"no_net_pair":    {"⚠️ Internet yo'q — ulash keyinroq", "⚠️ No internet — will connect later", "⚠️ Нет интернета — подключение позже"},
	"pair_code":      {"🔗 Ulash kodi: %s", "🔗 Pairing code: %s", "🔗 Код подключения: %s"},
	"paired_st":      {"✅ Ulandi: %s", "✅ Connected: %s", "✅ Подключено: %s"},
	"connected_st":   {"✅ Ulangan: %s", "✅ Connected: %s", "✅ Подключено: %s"},
	"pair_expired":   {"⏳ Ulash vaqti tugadi — qaytadan bosing", "⏳ Pairing expired — click again", "⏳ Время подключения истекло — нажмите снова"},
	"unpaired":       {"🔌 Akkauntdan uzildi — qayta ulang", "🔌 Disconnected — connect again", "🔌 Отключено — подключите снова"},
	"offline":        {"⚠️ Internet yo'q — oflayn ishlayapti", "⚠️ No internet — working offline", "⚠️ Нет интернета — работает офлайн"},
	"strict_pause":   {"Qat'iy rejim yoqilgan — pauza qilib bo'lmaydi.", "Strict mode is on — pausing is not allowed.", "Включён строгий режим — паузу поставить нельзя."},
	"strict_quit":    {"Qat'iy rejim: fokus sessiyasi tugamaguncha chiqib bo'lmaydi.", "Strict mode: you can't quit until the focus session ends.", "Строгий режим: нельзя выйти до конца сессии фокуса."},
	"quit_confirm":   {"Focusgate'ni to'xtatasizmi? Limitlar va kuzatuv ishlamay qoladi.", "Stop Focusgate? Limits and tracking will stop working.", "Остановить Focusgate? Лимиты и отслеживание перестанут работать."},
	"running":        {"Focusgate allaqachon ishlayapti (soat yonidagi ^ ichida 🛡 belgi).\n\nHa — qayta ishga tushirish (eski nusxa to'xtatiladi)\nYo'q — LevelUpDay'da Focusgate bo'limini ochish", "Focusgate is already running (🛡 icon under ^ next to the clock).\n\nYes — restart it (the old copy is stopped)\nNo — open Focusgate in LevelUpDay", "Focusgate уже запущен (значок 🛡 под ^ возле часов).\n\nДа — перезапустить (старая копия остановится)\nНет — открыть Focusgate в LevelUpDay"},
	"hello_title":    {"LevelUpDay Focusgate ishlayapti ✅", "LevelUpDay Focusgate is running ✅", "LevelUpDay Focusgate работает ✅"},
	"hello_body":     {"Soat yonidagi 🛡 belgisi orqali boshqaring.", "Control it from the 🛡 icon next to the clock.", "Управляйте через значок 🛡 возле часов."},
	"inst_title":     {"LevelUpDay Focusgate o'rnatildi ✅", "LevelUpDay Focusgate installed ✅", "LevelUpDay Focusgate установлен ✅"},
	"pair_title":     {"🔗 Ulash kodi: %s", "🔗 Pairing code: %s", "🔗 Код подключения: %s"},
	"pair_body":      {"LevelUpDay oynasida «Ulash» ni bosing. Ochilmasa: LevelUpDay → Focusgate → «Kod bilan ulash» ga shu kodni yozing.", "Press “Connect” in the LevelUpDay window. If it doesn't open: LevelUpDay → Focusgate → “Connect with code” and type this code.", "Нажмите «Подключить» в окне LevelUpDay. Если не открылось: LevelUpDay → Focusgate → «Подключить по коду» и введите этот код."},
	"inst_body":      {"Brauzerda \"Ulash\" tugmasini bosing.", "Press \"Connect\" in your browser.", "Нажмите «Подключить» в браузере."},
	"pause_title":    {"Focusgate pauzada", "Focusgate paused", "Focusgate на паузе"},
	"pause_body":     {"15 daqiqa davomida limitlar ishlamaydi.", "Limits are off for 15 minutes.", "Лимиты не работают 15 минут."},
	"paired_title":   {"Focusgate ulandi ✅", "Focusgate connected ✅", "Focusgate подключён ✅"},
	"paired_body":    {"Endi limitlarni LevelUpDay → Focusgate'da boshqarasiz.", "Now manage limits in LevelUpDay → Focusgate.", "Теперь управляйте лимитами в LevelUpDay → Focusgate."},
	"closed":         {"🛡 %s yopildi", "🛡 %s was closed", "🛡 %s закрыто"},
	"warn_title":     {"⏳ %s: %s qoldi", "⏳ %s: %s left", "⏳ %s: осталось %s"},
	"warn_body":      {"Kunlik limit tez orada tugaydi.", "Your daily limit is almost up.", "Дневной лимит скоро закончится."},
	"r_focus":        {"fokus vaqtida bloklangan", "blocked during focus", "заблокировано во время фокуса"},
	"r_always":       {"doimiy bloklangan", "always blocked", "заблокировано всегда"},
	"r_schedule":     {"jadval bo'yicha bloklangan (%s)", "blocked by schedule (%s)", "заблокировано по расписанию (%s)"},
	"r_daily":        {"bugungi limit tugadi (%s)", "today's limit is used up (%s)", "дневной лимит исчерпан (%s)"},
	"r_session":      {"bir martalik seans vaqti tugadi", "session time is up", "время сессии вышло"},
	"r_mode":         {"«%s» rejimida bloklangan", "blocked by the “%s” mode", "заблокировано режимом «%s»"},
	"r_allow":        {"fokusda faqat ruxsat etilgan dasturlar ishlaydi", "only allowed apps work during focus", "во время фокуса работают только разрешённые приложения"},
	"minimized":      {"🛡 %s yig'ildi", "🛡 %s was minimized", "🛡 %s свёрнуто"},
	"warn_pct_title": {"⏳ %s: limitning %s ishlatildi", "⏳ %s: %s of the limit used", "⏳ %s: использовано %s лимита"},
	"warn_pct_body":  {"Bugun yana %s qoldi.", "%s left for today.", "На сегодня осталось %s."},
	"mind_title":     {"🌬 Nafas oling…", "🌬 Take a breath…", "🌬 Сделайте вдох…"},
	"mind_wait":      {"%s soniyadan keyin so'raymiz: rostdan ham kerakmi?", "In %s seconds we'll ask: do you really need it?", "Через %s секунд спросим: это правда нужно?"},
	"mind_q":         {"%s ni ochishni rostdan xohlaysizmi?\n\nHa — %s ruxsat\nYo'q — yopiladi", "Do you really want to open %s?\n\nYes — allowed for %s\nNo — it will be closed", "Вы правда хотите открыть %s?\n\nДа — разрешено на %s\nНет — будет закрыто"},
	"r_blocked":      {"bloklangan", "blocked", "заблокировано"},
	"uninst_confirm": {"LevelUpDay va Focusgate kompyuterdan o'chirilsinmi? Limitlar va kuzatuv to'xtaydi (akkauntingiz va ma'lumotlaringiz saqlanib qoladi).", "Remove LevelUpDay and Focusgate from this computer? Limits and tracking will stop (your account and data are kept).", "Удалить LevelUpDay и Focusgate с компьютера? Лимиты и отслеживание остановятся (аккаунт и данные сохранятся)."},
	"uninst_done":    {"LevelUpDay o'chirildi.", "LevelUpDay was removed.", "LevelUpDay удалён."},
	"strict_uninst":  {"Qat'iy rejim: fokus sessiyasi tugamaguncha o'chirib bo'lmaydi.", "Strict mode: you can't uninstall until the focus session ends.", "Строгий режим: нельзя удалить до конца сессии фокуса."},
	"u_h":            {"soat", "h", "ч"},
	"u_m":            {"daq", "min", "мин"},
	"u_s":            {"s", "s", "с"},
}

var (
	langMu   sync.Mutex
	curLang  = ""
	osLangFn func() string // Windows tili (win.go)
)

// Lang — joriy til: config.lang → Windows tili → ingliz.
func Lang() string {
	langMu.Lock()
	defer langMu.Unlock()
	if curLang != "" {
		return curLang
	}
	if osLangFn != nil {
		if l := osLangFn(); l != "" {
			return l
		}
	}
	return "en"
}

func SetLang(l string) bool {
	l = strings.ToLower(strings.TrimSpace(l))
	if l != "uz" && l != "en" && l != "ru" {
		return false
	}
	langMu.Lock()
	defer langMu.Unlock()
	changed := curLang != l
	curLang = l
	return changed
}

// Tr — tarjima; %s o'rinlariga args qo'yiladi.
func Tr(key string, args ...string) string {
	v, ok := tr[key]
	if !ok {
		return key
	}
	i := 1
	switch Lang() {
	case "uz":
		i = 0
	case "ru":
		i = 2
	}
	s := v[i]
	for _, a := range args {
		s = strings.Replace(s, "%s", a, 1)
	}
	return s
}

// FmtDur — "1 soat 5 daq" / "1 h 5 min" / "1 ч 5 мин".
func FmtDur(sec int) string {
	h, m := sec/3600, (sec%3600)/60
	if h > 0 {
		if m > 0 {
			return itoa(h) + " " + Tr("u_h") + " " + itoa(m) + " " + Tr("u_m")
		}
		return itoa(h) + " " + Tr("u_h")
	}
	if m > 0 {
		return itoa(m) + " " + Tr("u_m")
	}
	return itoa(sec) + " " + Tr("u_s")
}
