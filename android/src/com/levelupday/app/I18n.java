// 3 til: o'zbek, ingliz, rus. Til LevelUpDay'da tanlangan tildan (config.lang), bo'lmasa — telefon tilidan.
package com.levelupday.app;

import java.util.Locale;

final class I18n {
    private I18n() {}

    private static String lang = "";

    static void setLang(String l) {
        if ("uz".equals(l) || "en".equals(l) || "ru".equals(l)) lang = l;
    }

    static String lang() {
        if (!lang.isEmpty()) return lang;
        String sys = Locale.getDefault().getLanguage();
        if ("uz".equals(sys) || "ru".equals(sys)) return sys;
        return "en";
    }

    static String T(String uz, String en, String ru) {
        String l = lang();
        return "uz".equals(l) ? uz : "ru".equals(l) ? ru : en;
    }

    static String dur(int sec) {
        int h = sec / 3600, m = (sec % 3600) / 60;
        String uh = T("soat", "h", "ч"), um = T("daq", "min", "мин");
        if (h > 0) return m > 0 ? h + " " + uh + " " + m + " " + um : h + " " + uh;
        if (m > 0) return m + " " + um;
        return sec + " " + T("s", "s", "с");
    }

    static String reason(String r, int minutes) {
        if ("focus".equals(r)) return T("Fokus vaqtida bloklangan", "Blocked during focus", "Заблокировано во время фокуса");
        if ("always".equals(r)) return T("Doimiy bloklangan", "Always blocked", "Заблокировано всегда");
        if ("schedule".equals(r)) return T("Jadval bo'yicha bloklangan", "Blocked by schedule", "Заблокировано по расписанию");
        if ("daily".equals(r)) return T("Bugungi limit tugadi", "Today's limit is used up", "Дневной лимит исчерпан") + (minutes > 0 ? " (" + dur(minutes * 60) + ")" : "");
        if ("session".equals(r)) return T("Bir martalik seans vaqti tugadi", "Session time is up", "Время сессии вышло") + (minutes > 0 ? " (" + dur(minutes * 60) + ")" : "");
        return T("Bloklangan", "Blocked", "Заблокировано");
    }
}
