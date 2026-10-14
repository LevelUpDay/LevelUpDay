// Focusgate yadrosi (Android): qoidalar, kategoriyalar, saytlar. Windows agentidagi core.go / cats.go bilan bir xil mantiq.
package com.levelupday.app;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONObject;

final class Core {
    private Core() {}

    // ---------- Sayt'dan keladigan sozlamalar (fg_config.config) ----------
    static final class Rule {
        String id = "", app = "", label = "", kind = "", from = "", to = "";
        int minutes;
        int[] days = new int[0];
        boolean on;
    }

    static final class Cfg {
        boolean track = true, notif = true, strict;
        long focusUntil, pauseUntil;
        String lang = "";
        final List<Rule> rules = new ArrayList<Rule>();
        final List<String> focusApps = new ArrayList<String>();
        final Map<String, String> cats = new HashMap<String, String>();

        static Cfg parse(String json) {
            Cfg c = new Cfg();
            if (json == null || json.isEmpty()) return c;
            try {
                JSONObject o = new JSONObject(json);
                c.track = !o.has("track") || o.isNull("track") || o.optBoolean("track", true);
                c.notif = !o.has("notif") || o.isNull("notif") || o.optBoolean("notif", true);
                c.strict = o.optBoolean("strict", false);
                c.focusUntil = o.optLong("focusUntil", 0);
                c.pauseUntil = o.optLong("pauseUntil", 0);
                c.lang = o.optString("lang", "");
                JSONArray rs = o.optJSONArray("rules");
                if (rs != null) for (int i = 0; i < rs.length(); i++) {
                    JSONObject r = rs.optJSONObject(i);
                    if (r == null) continue;
                    Rule x = new Rule();
                    x.id = r.optString("id", "");
                    x.app = r.optString("app", "").toLowerCase(Locale.ROOT);
                    x.label = r.optString("label", "");
                    x.kind = r.optString("kind", "");
                    x.minutes = r.optInt("minutes", 0);
                    x.from = r.optString("from", "");
                    x.to = r.optString("to", "");
                    x.on = r.optBoolean("on", false);
                    JSONArray d = r.optJSONArray("days");
                    if (d != null) {
                        x.days = new int[d.length()];
                        for (int j = 0; j < d.length(); j++) x.days[j] = d.optInt(j);
                    }
                    if (!x.app.isEmpty()) c.rules.add(x);
                }
                JSONArray fa = o.optJSONArray("focusApps");
                if (fa != null) for (int i = 0; i < fa.length(); i++) {
                    JSONObject f = fa.optJSONObject(i);
                    if (f != null && f.optBoolean("on", false)) c.focusApps.add(f.optString("app", "").toLowerCase(Locale.ROOT));
                }
                JSONObject cs = o.optJSONObject("cats");
                if (cs != null) {
                    JSONArray names = cs.names();
                    if (names != null) for (int i = 0; i < names.length(); i++) {
                        String k = names.optString(i);
                        c.cats.put(k.toLowerCase(Locale.ROOT), cs.optString(k));
                    }
                }
            } catch (Exception ignored) { }
            return c;
        }

        String labelOf(String app) {
            for (Rule r : rules) if (r.app.equals(app) && !r.label.isEmpty()) return r.label;
            return "";
        }
    }

    // ---------- Bir xil ilova turli qurilmalarda: qoida "site:youtube" telefondagi YouTube ilovasini ham bloklaydi ----------
    static final Map<String, String[]> ALIAS = new HashMap<String, String[]>();
    private static void alias(String pkg, String... keys) { ALIAS.put(pkg.toLowerCase(Locale.ROOT), keys); }
    static {
        alias("com.google.android.youtube", "site:youtube");
        alias("com.google.android.apps.youtube.music", "site:youtube");
        alias("com.instagram.android", "site:instagram", "instagram.exe");
        alias("com.instagram.barcelona", "site:threads");
        alias("com.zhiliaoapp.musically", "site:tiktok", "tiktok.exe");
        alias("com.ss.android.ugc.trill", "site:tiktok", "tiktok.exe");
        alias("com.facebook.katana", "site:facebook");
        alias("com.facebook.lite", "site:facebook");
        alias("com.facebook.orca", "messenger.exe");
        alias("com.twitter.android", "site:x", "site:twitter");
        alias("com.reddit.frontpage", "site:reddit");
        alias("tv.twitch.android.app", "site:twitch");
        alias("com.netflix.mediaclient", "site:netflix", "netflix.exe");
        alias("com.vkontakte.android", "site:vk");
        alias("org.telegram.messenger", "telegram.exe", "site:telegram");
        alias("org.telegram.messenger.web", "telegram.exe", "site:telegram");
        alias("org.thunderdog.challegram", "telegram.exe", "site:telegram");
        alias("com.discord", "discord.exe", "site:discord");
        alias("com.pinterest", "site:pinterest");
        alias("com.whatsapp", "whatsapp.exe");
        alias("com.whatsapp.w4b", "whatsapp.exe");
        alias("com.viber.voip", "viber.exe");
        alias("com.spotify.music", "spotify.exe");
        alias("com.roblox.client", "robloxplayerbeta.exe", "site:roblox");
        alias("ru.kinopoisk", "site:kinopoisk");
        alias("com.duolingo", "site:duolingo");
        alias("org.coursera.android", "site:coursera");
        alias("com.udemy.android", "site:udemy");
        alias("org.khanacademy.android", "site:khanacademy");
        alias("com.valvesoftware.android.steam.community", "steam.exe");
        alias("com.notion.id", "notion.exe");
        alias("com.Slack", "slack.exe");
        alias("us.zoom.videomeetings", "zoom.exe");
    }

    // ---------- Kategoriyalar (sayt va Windows agenti bilan bir xil) ----------
    static final Map<String, String> CAT = new HashMap<String, String>();
    static {
        String[][] g = {
            {"web", "com.android.chrome com.chrome.beta org.mozilla.firefox com.microsoft.emmx com.brave.browser com.opera.browser com.opera.mini.native com.opera.gx com.yandex.browser com.sec.android.app.sbrowser com.vivaldi.browser com.duckduckgo.mobile.android com.mi.globalbrowser com.UCMobile.intl"},
            {"social", "org.telegram.messenger org.telegram.messenger.web org.thunderdog.challegram com.discord com.whatsapp com.whatsapp.w4b com.viber.voip com.instagram.android com.instagram.barcelona com.zhiliaoapp.musically com.ss.android.ugc.trill com.facebook.katana com.facebook.lite com.facebook.orca com.twitter.android com.reddit.frontpage com.vkontakte.android com.pinterest com.snapchat.android org.thoughtcrime.securesms com.skype.raider site:instagram site:tiktok site:facebook site:x site:twitter site:vk site:telegram site:discord site:reddit site:pinterest site:threads"},
            {"games", "com.roblox.client com.mojang.minecraftpe com.supercell.clashofclans com.supercell.clashroyale com.supercell.brawlstars com.tencent.ig com.pubg.imobile com.activision.callofduty.shooter com.miHoYo.GenshinImpact com.dts.freefireth com.dts.freefiremax com.king.candycrushsaga com.kiloo.subwaysurf com.valvesoftware.android.steam.community site:roblox"},
            {"fun", "com.google.android.youtube com.google.android.apps.youtube.music com.netflix.mediaclient tv.twitch.android.app com.spotify.music ru.kinopoisk com.amazon.avod.thirdpartyclient com.disney.disneyplus org.videolan.vlc com.mxtech.videoplayer.ad site:youtube site:netflix site:twitch site:kinopoisk"},
            {"work", "com.google.android.gm com.microsoft.office.outlook com.google.android.apps.docs com.google.android.apps.docs.editors.docs com.google.android.apps.docs.editors.sheets com.google.android.apps.docs.editors.slides com.microsoft.office.word com.microsoft.office.excel com.microsoft.office.powerpoint com.microsoft.office.officehubrow com.microsoft.teams com.Slack us.zoom.videomeetings com.notion.id md.obsidian com.google.android.calendar com.google.android.keep com.todoist com.figma.mirror com.github.android"},
            {"study", "com.duolingo com.ankiapp.client com.ichi2.anki org.coursera.android com.udemy.android org.khanacademy.android com.quizlet.quizletandroid com.google.android.apps.classroom site:coursera site:udemy site:khanacademy site:duolingo site:levelupday"},
        };
        for (String[] x : g) for (String k : x[1].split(" ")) CAT.put(k.toLowerCase(Locale.ROOT), x[0]);
    }

    /** Android'ning o'z toifasi (ApplicationInfo.category) → bizning kategoriya. */
    static String fromAndroidCat(int c) {
        switch (c) {
            case 0: return "games";        // CATEGORY_GAME
            case 1: case 2: return "fun";  // AUDIO, VIDEO
            case 4: return "social";       // SOCIAL
            case 5: return "web";          // NEWS
            case 7: return "work";         // PRODUCTIVITY
            default: return "";
        }
    }

    // ---------- Saytlar: brauzer manzili → kalit ----------
    static final String[][] SITES = {
        {"youtube.com", "site:youtube", "YouTube"}, {"youtu.be", "site:youtube", "YouTube"},
        {"instagram.com", "site:instagram", "Instagram"}, {"tiktok.com", "site:tiktok", "TikTok"},
        {"facebook.com", "site:facebook", "Facebook"}, {"fb.com", "site:facebook", "Facebook"},
        {"x.com", "site:x", "X (Twitter)"}, {"twitter.com", "site:twitter", "Twitter"},
        {"reddit.com", "site:reddit", "Reddit"}, {"twitch.tv", "site:twitch", "Twitch"},
        {"netflix.com", "site:netflix", "Netflix"}, {"vk.com", "site:vk", "VK"},
        {"web.telegram.org", "site:telegram", "Telegram Web"}, {"discord.com", "site:discord", "Discord (web)"},
        {"pinterest.com", "site:pinterest", "Pinterest"}, {"kinopoisk.ru", "site:kinopoisk", "Кинопоиск"},
        {"roblox.com", "site:roblox", "Roblox"}, {"threads.net", "site:threads", "Threads"},
    };

    /** host → {kalit, nom} yoki null. Foydalanuvchi qo'shgan "site:kun.uz" kabi qoidalar ham hisobga olinadi. */
    static String[] siteOf(String url, Cfg cfg) {
        if (url == null) return null;
        String h = url.trim().toLowerCase(Locale.ROOT);
        int p = h.indexOf("://");
        if (p >= 0) h = h.substring(p + 3);
        int e = h.length();
        for (char ch : new char[]{'/', '?', '#', ' ', ':'}) { int i = h.indexOf(ch); if (i >= 0 && i < e) e = i; }
        h = h.substring(0, e);
        if (h.startsWith("www.")) h = h.substring(4);
        if (h.startsWith("m.")) h = h.substring(2);
        if (h.isEmpty() || h.indexOf('.') < 0) return null;
        for (Rule r : cfg.rules) {
            if (!r.app.startsWith("site:")) continue;
            String kw = r.app.substring(5);
            if (kw.indexOf('.') > 0 && (h.equals(kw) || h.endsWith("." + kw))) return new String[]{r.app, r.label.isEmpty() ? kw : r.label};
        }
        for (String[] s : SITES) if (h.equals(s[0]) || h.endsWith("." + s[0])) return new String[]{s[1], s[2]};
        return null;
    }

    // ---------- Qoidalar ----------
    interface Ctx {
        String catOf(String app);     // kategoriya (foydalanuvchi → qurilma → lug'at)
        Map<String, Integer> used();  // bugun: kalit → soniya (shu qurilma + boshqa qurilmalar)
    }

    static String catOf(Cfg cfg, Map<String, String> devCats, String app) {
        app = app.toLowerCase(Locale.ROOT);
        String c = cfg.cats.get(app);
        if (c != null && !c.isEmpty()) return c;
        c = devCats.get(app);
        if (c != null && !c.isEmpty()) return c;
        c = CAT.get(app);
        if (c != null) return c;
        if (app.startsWith("site:")) return "web";
        String[] al = ALIAS.get(app);
        if (al != null) for (String a : al) { String x = CAT.get(a); if (x != null) return x; }
        return "other";
    }

    static boolean matchApp(Ctx ctx, String ruleApp, String app) {
        app = app.toLowerCase(Locale.ROOT); // server kalitlarni kichik harfda saqlaydi (com.Slack → com.slack)
        if (ruleApp.equals(app)) return true;
        if (ruleApp.startsWith("cat:")) return ctx.catOf(app).equals(ruleApp.substring(4));
        String[] al = ALIAS.get(app);
        if (al != null) for (String a : al) if (a.equals(ruleApp)) return true;
        return false;
    }

    /** Qoida uchun bugun sarflangan soniyalar — barcha mos ilovalar (kategoriya, taxallus) va qurilmalar yig'indisi. */
    static int usedFor(Ctx ctx, String ruleApp) {
        int n = 0;
        for (Map.Entry<String, Integer> e : ctx.used().entrySet()) if (matchApp(ctx, ruleApp, e.getKey())) n += e.getValue();
        return n;
    }

    static int hm(String s) {
        try {
            String[] p = s.split(":");
            return Integer.parseInt(p[0].trim()) * 60 + Integer.parseInt(p[1].trim());
        } catch (Exception e) { return 0; }
    }

    static boolean inSchedule(Rule r, Calendar t) {
        int wd = t.get(Calendar.DAY_OF_WEEK) - 1; // 0=Ya
        if (wd == 0) wd = 7;
        if (r.days.length > 0) {
            boolean ok = false;
            for (int d : r.days) if (d == wd) ok = true;
            if (!ok) return false;
        }
        int from = hm(r.from), to = hm(r.to), now = t.get(Calendar.HOUR_OF_DAY) * 60 + t.get(Calendar.MINUTE);
        if (from == to) return true;
        if (from < to) return now >= from && now < to;
        return now >= from || now < to;
    }

    static final class Verdict {
        final String reason;
        final Rule rule;
        Verdict(String reason, Rule rule) { this.reason = reason; this.rule = rule; }
    }

    static final Set<String> PROTECTED = new HashSet<String>();
    static {
        for (String p : ("com.levelupday.app android com.android.systemui com.android.settings com.android.phone com.android.dialer "
                + "com.google.android.dialer com.samsung.android.dialer com.android.emergency com.google.android.apps.safetyhub "
                + "com.android.incallui com.samsung.android.incallui com.android.packageinstaller com.google.android.packageinstaller "
                + "com.google.android.permissioncontroller com.android.permissioncontroller").split(" ")) PROTECTED.add(p);
    }

    /** Ilova (paket nomi yoki site:...) hozir bloklanganmi? null — yo'q. */
    static Verdict check(Cfg cfg, Ctx ctx, String app, long nowMs, Calendar t) {
        app = app.toLowerCase(Locale.ROOT);
        if (!cfg.strict && cfg.pauseUntil > nowMs) return null;
        if (PROTECTED.contains(app)) return null;
        if (cfg.focusUntil > nowMs) for (String f : cfg.focusApps) if (matchApp(ctx, f, app)) return new Verdict("focus", null);
        for (Rule r : cfg.rules) {
            if (!r.on || !matchApp(ctx, r.app, app)) continue;
            if ("always".equals(r.kind)) return new Verdict("always", r);
            if ("schedule".equals(r.kind) && inSchedule(r, t)) return new Verdict("schedule", r);
            if ("daily".equals(r.kind) && r.minutes > 0 && usedFor(ctx, r.app) >= r.minutes * 60) return new Verdict("daily", r);
        }
        return null;
    }

    /** "session" qoidasi: bir ochilishga ruxsat etilgan daqiqalar (0 — yo'q). */
    static int sessionLimit(Cfg cfg, Ctx ctx, String app) {
        for (Rule r : cfg.rules) if (r.on && "session".equals(r.kind) && r.minutes > 0 && matchApp(ctx, r.app, app)) return r.minutes;
        return 0;
    }
}
