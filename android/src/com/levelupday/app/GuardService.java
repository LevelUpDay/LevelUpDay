// Focusgate qo'riqchisi (Maxsus imkoniyatlar xizmati):
//  • qaysi ilova ochilganini darhol biladi → qoida bo'lsa (limit/jadval/doimiy/fokus/seans) bosh ekranga qaytaradi va "Bloklandi" oynasini ko'rsatadi
//  • brauzerda (Chrome, Samsung, Edge, Firefox, Opera, Yandex, Brave) ochiq sayt manzilini o'qiydi → saytlar ham bloklanadi va vaqti hisoblanadi
//  • har 2 soniyada qayta tekshiradi (limit ilova ochiq turganda tugashi mumkin), har daqiqada LevelUpDay bilan sinxronlanadi
// Faqat ilova nomi va manzil satri o'qiladi — foydalanuvchi yozgan matnlar o'qilmaydi va hech qayerga yuborilmaydi.
package com.levelupday.app;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class GuardService extends AccessibilityService {
    static volatile GuardService running;

    // Brauzer → manzil satri elementi
    private static final Map<String, String[]> URL_BAR = new HashMap<String, String[]>();
    static {
        String[] chromium = {"url_bar", "search_box_text", "url_field", "location_bar_edit_text"};
        for (String p : new String[]{"com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.brave.browser", "com.microsoft.emmx",
                "com.vivaldi.browser", "com.kiwibrowser.browser", "com.opera.browser", "com.opera.gx", "com.opera.mini.native",
                "com.sec.android.app.sbrowser", "com.mi.globalbrowser", "com.duckduckgo.mobile.android", "com.yandex.browser"}) URL_BAR.put(p, chromium);
        URL_BAR.put("org.mozilla.firefox", new String[]{"mozac_browser_toolbar_url_view", "url_bar_title"});
        URL_BAR.put("com.yandex.browser", new String[]{"bro_omnibar_address_title_text", "suggest_omnibox_query_edit", "url_bar"});
        URL_BAR.put("com.duckduckgo.mobile.android", new String[]{"omnibarTextInput", "url_bar"});
    }

    private final Handler h = new Handler(Looper.getMainLooper());
    private Engine eng;
    private String fg = "";          // hozir ochiq ilova (paket)
    private long fgSince;            // shu ilova qachondan beri ochiq (seans limiti uchun)
    private String[] site;           // brauzerdagi sayt {kalit, nom} yoki null
    private long siteAt, lastUrlRead, lastSync, lastBlock;
    private String lastBlockKey = "";

    private final Runnable tick = new Runnable() {
        public void run() {
            try { onTick(); } catch (Throwable ignored) { }
            h.postDelayed(this, 2000);
        }
    };

    @Override
    protected void onServiceConnected() {
        running = this;
        eng = Engine.get(this);
        Apps.scan(this, true);
        h.removeCallbacks(tick);
        h.postDelayed(tick, 1000);
        eng.syncNow();
    }

    @Override
    public void onDestroy() {
        running = null;
        h.removeCallbacks(tick);
        flushSite();
        super.onDestroy();
    }

    @Override public void onInterrupt() { }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e == null || e.getPackageName() == null) return;
        String pkg = e.getPackageName().toString();
        if (e.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            Apps.scan(this, false);
            // Klaviatura, tizim paneli va h.k. — faol ilova emas
            if (!Apps.launchable.contains(pkg) && !Apps.homes.contains(pkg)) return;
            if (!pkg.equals(fg)) {
                flushSite();
                site = null;
                fg = pkg;
                fgSince = System.currentTimeMillis();
            }
            if (URL_BAR.containsKey(pkg)) readUrl(pkg);
            check();
        } else if (e.getEventType() == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED && pkg.equals(fg) && URL_BAR.containsKey(pkg)) {
            long now = System.currentTimeMillis();
            if (now - lastUrlRead < 700) return;
            readUrl(pkg);
            check();
        }
    }

    private void readUrl(String pkg) {
        lastUrlRead = System.currentTimeMillis();
        AccessibilityNodeInfo root = null;
        try { root = getRootInActiveWindow(); } catch (Exception ignored) { }
        if (root == null) return;
        String url = null;
        for (String id : URL_BAR.get(pkg)) {
            List<AccessibilityNodeInfo> l = null;
            try { l = root.findAccessibilityNodeInfosByViewId(pkg + ":id/" + id); } catch (Exception ignored) { }
            if (l != null && !l.isEmpty()) {
                CharSequence t = l.get(0).getText();
                // Foydalanuvchi manzil satriga yozayotgan bo'lsa (fokusda) — hali sayt ochilmagan
                if (t != null && !l.get(0).isFocused()) url = t.toString();
                break;
            }
        }
        String[] s = url == null ? null : Core.siteOf(url, eng.st.cfg());
        String oldKey = site == null ? "" : site[0], newKey = s == null ? "" : s[0];
        if (url != null && !oldKey.equals(newKey)) {
            flushSite();
            site = s;
            siteAt = System.currentTimeMillis();
        }
    }

    /** Brauzerdagi sayt vaqtini saqlaydi. */
    private void flushSite() {
        if (site == null || siteAt == 0) return;
        long now = System.currentTimeMillis();
        int sec = (int) Math.min(30 * 60, (now - siteAt) / 1000);
        if (sec > 0 && eng != null && eng.st.cfg().track) eng.st.addSite(site[0], site[1], sec, siteAt);
        siteAt = now;
    }

    private boolean screenOn() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm == null || pm.isInteractive();
    }

    private void onTick() {
        long now = System.currentTimeMillis();
        if (!screenOn()) {
            flushSite();
            siteAt = 0;
            site = null;
        } else {
            if (site != null && siteAt == 0) siteAt = now;
            if (site != null && now - siteAt >= 20000) flushSite();
            check();
            warn();
        }
        if (now - lastSync > 60000) {
            lastSync = now;
            flushSite();
            eng.syncNow();
        }
    }

    private void check() {
        if (eng == null || fg.isEmpty() || eng.st.token().isEmpty()) return;
        Core.Cfg cfg = eng.st.cfg();
        long now = System.currentTimeMillis();
        Calendar t = Calendar.getInstance();
        if (site != null) {
            Core.Verdict v = Core.check(cfg, eng, site[0], now, t);
            if (v != null) { block(site[0], site[1], v.reason, v.rule == null ? 0 : v.rule.minutes, true); return; }
        }
        if (Apps.homes.contains(fg)) return;
        Core.Verdict v = Core.check(cfg, eng, fg, now, t);
        if (v != null) { block(fg, Apps.label(this, fg), v.reason, v.rule == null ? 0 : v.rule.minutes, false); return; }
        int sl = Core.sessionLimit(cfg, eng, fg);
        if (sl > 0 && now - fgSince >= sl * 60000L) block(fg, Apps.label(this, fg), "session", sl, false);
    }

    private void block(String key, String label, String reason, int minutes, boolean isSite) {
        long now = System.currentTimeMillis();
        if (key.equals(lastBlockKey) && now - lastBlock < 1500) return;
        lastBlockKey = key;
        lastBlock = now;
        flushSite();
        site = null;
        if (isSite) performGlobalAction(GLOBAL_ACTION_BACK);
        performGlobalAction(GLOBAL_ACTION_HOME);
        try {
            Intent i = new Intent(this, BlockActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            i.putExtra("key", key).putExtra("label", label).putExtra("reason", reason).putExtra("minutes", minutes);
            startActivity(i);
        } catch (Exception ignored) { }
        eng.st.event(isSite ? "site_block" : "block", key, label, reason);
        fg = "";
    }

    /** Kunlik limit tugashiga ≤5 daqiqa qolganda bir marta ogohlantiradi. */
    private void warn() {
        Core.Cfg cfg = eng.st.cfg();
        for (Core.Rule r : cfg.rules) {
            if (!r.on || !"daily".equals(r.kind) || r.minutes <= 5) continue;
            boolean relevant = Core.matchApp(eng, r.app, fg) || (site != null && Core.matchApp(eng, r.app, site[0]));
            if (!relevant) continue;
            int left = r.minutes * 60 - Core.usedFor(eng, r.app);
            if (left > 0 && left <= 300 && eng.st.warnOnce(r.app)) {
                String name = r.label.isEmpty() ? r.app : r.label;
                eng.notify(r.app.hashCode(), "⏳ " + name + ": " + I18n.dur(left) + " " + I18n.T("qoldi", "left", "осталось"),
                        I18n.T("Kunlik limit tez orada tugaydi.", "Your daily limit is almost up.", "Дневной лимит скоро закончится."));
                eng.st.event("warn", r.app, name, "daily");
            }
        }
    }
}
