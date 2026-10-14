// Holat: token, sozlamalar, hodisalar navbati, sayt vaqtlari — SharedPreferences'da.
package com.levelupday.app;

import android.content.Context;
import android.content.SharedPreferences;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

final class Store {
    static final String APP_URL = "https://levelupday.github.io/LevelUpDay/";
    static final String VERSION = "android-0.1.0";

    private static Store inst;
    private final SharedPreferences p;
    private Core.Cfg cfg;

    private Store(Context c) { p = c.getApplicationContext().getSharedPreferences("focusgate", Context.MODE_PRIVATE); }

    static synchronized Store get(Context c) {
        if (inst == null) inst = new Store(c);
        return inst;
    }

    static String day(long ms) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(ms)); }

    String token() { return p.getString("token", ""); }
    void setToken(String t) { p.edit().putString("token", t).apply(); }
    String deviceName() { return p.getString("device", ""); }
    void setDeviceName(String n) { p.edit().putString("device", n).apply(); }
    long syncedAt() { return p.getLong("syncedAt", 0); }

    synchronized Core.Cfg cfg() {
        if (cfg == null) cfg = Core.Cfg.parse(p.getString("cfg", ""));
        return cfg;
    }

    synchronized void setCfg(String json) {
        p.edit().putString("cfg", json).putLong("syncedAt", System.currentTimeMillis()).apply();
        cfg = Core.Cfg.parse(json);
        I18n.setLang(cfg.lang);
    }

    String pairCode() { return p.getLong("pairAt", 0) > System.currentTimeMillis() - 14 * 60 * 1000 ? p.getString("pair", "") : ""; }
    void setPair(String code) { p.edit().putString("pair", code).putLong("pairAt", code.isEmpty() ? 0 : System.currentTimeMillis()).apply(); }

    // ---------- Boshqa qurilmalardagi bugungi vaqt (serverdan) ----------
    synchronized Map<String, Integer> others() {
        Map<String, Integer> m = new HashMap<String, Integer>();
        try {
            JSONObject o = new JSONObject(p.getString("others", "{}"));
            if (!day(System.currentTimeMillis()).equals(o.optString("_day"))) return m;
            Iterator<String> it = o.keys();
            while (it.hasNext()) { String k = it.next(); if (!k.startsWith("_")) m.put(k, o.optInt(k)); }
        } catch (Exception ignored) { }
        return m;
    }

    synchronized void setOthers(JSONObject o, String today) {
        try { if (o == null) o = new JSONObject(); o.put("_day", today); } catch (Exception ignored) { }
        p.edit().putString("others", o.toString()).apply();
    }

    // ---------- Telefondagi brauzerda saytlar vaqti: kun → kalit → {l, s, h[24]} ----------
    synchronized void addSite(String key, String label, int sec, long at) {
        try {
            JSONObject all = new JSONObject(p.getString("sites", "{}"));
            String d = day(at);
            JSONObject dd = all.optJSONObject(d);
            if (dd == null) { dd = new JSONObject(); all.put(d, dd); }
            JSONObject u = dd.optJSONObject(key);
            if (u == null) {
                u = new JSONObject();
                JSONArray h = new JSONArray();
                for (int i = 0; i < 24; i++) h.put(0);
                u.put("h", h);
                u.put("s", 0);
                dd.put(key, u);
            }
            u.put("l", label);
            u.put("s", u.optInt("s") + sec);
            java.util.Calendar c = java.util.Calendar.getInstance();
            c.setTimeInMillis(at);
            JSONArray h = u.getJSONArray("h");
            int hr = c.get(java.util.Calendar.HOUR_OF_DAY);
            h.put(hr, h.optInt(hr) + sec);
            // 3 kundan eskilari o'chiriladi
            String keep1 = day(at - 86400000L), keep2 = day(at - 2 * 86400000L);
            JSONArray names = all.names();
            if (names != null) for (int i = 0; i < names.length(); i++) {
                String k = names.optString(i);
                if (!k.equals(d) && !k.equals(keep1) && !k.equals(keep2)) all.remove(k);
            }
            p.edit().putString("sites", all.toString()).apply();
        } catch (Exception ignored) { }
    }

    synchronized JSONObject sites(String day) {
        try {
            JSONObject o = new JSONObject(p.getString("sites", "{}")).optJSONObject(day);
            return o != null ? o : new JSONObject();
        } catch (Exception e) { return new JSONObject(); }
    }

    // ---------- Hodisalar (bloklash/ogohlantirish) → server → Telegram ----------
    private final Map<String, Long> lastEv = new HashMap<String, Long>();

    synchronized void event(String kind, String app, String label, String reason) {
        long now = System.currentTimeMillis();
        String k = kind + "|" + app;
        Long last = lastEv.get(k);
        if (last != null && now - last < 60000) return;
        lastEv.put(k, now);
        try {
            JSONArray a = new JSONArray(p.getString("events", "[]"));
            JSONObject e = new JSONObject();
            e.put("kind", kind).put("app", app).put("label", label).put("reason", reason).put("at", now);
            a.put(e);
            while (a.length() > 200) a.remove(0);
            p.edit().putString("events", a.toString()).apply();
        } catch (Exception ignored) { }
    }

    synchronized JSONArray takeEvents() {
        try {
            JSONArray a = new JSONArray(p.getString("events", "[]"));
            p.edit().putString("events", "[]").apply();
            return a;
        } catch (Exception e) { return new JSONArray(); }
    }

    synchronized void putBackEvents(JSONArray a) {
        try {
            JSONArray cur = new JSONArray(p.getString("events", "[]"));
            for (int i = 0; i < cur.length(); i++) a.put(cur.get(i));
            while (a.length() > 200) a.remove(0);
            p.edit().putString("events", a.toString()).apply();
        } catch (Exception ignored) { }
    }

    // Kunlik limit ogohlantirishi bir marta
    synchronized boolean warnOnce(String key) {
        String k = "warn|" + day(System.currentTimeMillis()) + "|" + key;
        if (p.getBoolean(k, false)) return false;
        p.edit().putBoolean(k, true).apply();
        return true;
    }

    long appsSentAt() { return p.getLong("appsAt", 0); }
    String appsHash() { return p.getString("appsHash", ""); }
    void setAppsSent(String hash) { p.edit().putLong("appsAt", System.currentTimeMillis()).putString("appsHash", hash).apply(); }
}
