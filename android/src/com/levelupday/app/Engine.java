// Server bilan aloqa (ulash, sinxronlash), bugungi vaqt keshi va bildirishnomalar.
package com.levelupday.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

final class Engine implements Core.Ctx {
    static final String FN = "https://zzcvpenkevxlurgpjltz.supabase.co/functions/v1/focusgate";

    private static Engine inst;
    final Context app;
    final Store st;
    private final Handler main = new Handler(Looper.getMainLooper());
    private Map<String, Integer> usedCache = new HashMap<String, Integer>();
    private long usedAt;

    private Engine(Context c) { app = c.getApplicationContext(); st = Store.get(app); I18n.setLang(st.cfg().lang); }

    static synchronized Engine get(Context c) {
        if (inst == null) inst = new Engine(c);
        return inst;
    }

    // ---------- Core.Ctx ----------
    @Override public String catOf(String a) { return Core.catOf(st.cfg(), Apps.cats, a); }

    @Override public Map<String, Integer> used() { return usedToday(false); }

    /** Bugun: shu telefon (ilovalar + brauzerdagi saytlar) + boshqa qurilmalar. 5 soniyalik kesh. */
    synchronized Map<String, Integer> usedToday(boolean fresh) {
        if (!fresh && System.currentTimeMillis() - usedAt < 5000) return usedCache;
        Map<String, Integer> m = new HashMap<String, Integer>();
        for (Map.Entry<String, int[]> e : Usage.day(app, 0).entrySet()) if (Apps.counts(e.getKey())) m.put(e.getKey(), e.getValue()[0]);
        JSONObject s = st.sites(Store.day(System.currentTimeMillis()));
        Iterator<String> it = s.keys();
        while (it.hasNext()) { String k = it.next(); JSONObject u = s.optJSONObject(k); if (u != null) add(m, k, u.optInt("s")); }
        for (Map.Entry<String, Integer> e : st.others().entrySet()) add(m, e.getKey(), e.getValue());
        usedCache = m;
        usedAt = System.currentTimeMillis();
        return m;
    }

    /** Faqat shu telefon (statistika ekrani uchun). */
    Map<String, Integer> localToday() {
        Map<String, Integer> m = new HashMap<String, Integer>();
        for (Map.Entry<String, int[]> e : Usage.day(app, 0).entrySet()) if (Apps.counts(e.getKey())) m.put(e.getKey(), e.getValue()[0]);
        return m;
    }

    private static void add(Map<String, Integer> m, String k, int v) { Integer o = m.get(k); m.put(k, (o == null ? 0 : o) + v); }

    // ---------- HTTP ----------
    static JSONObject call(JSONObject body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(FN).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("User-Agent", "LevelUpDay-Android/" + Store.VERSION);
        OutputStream os = c.getOutputStream();
        os.write(body.toString().getBytes("UTF-8"));
        os.close();
        int code = c.getResponseCode();
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        if (in != null) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0 && bo.size() < (1 << 20)) bo.write(buf, 0, n);
            in.close();
        }
        c.disconnect();
        if (code == 401) throw new Http(401);
        if (code == 410) throw new Http(410);
        if (code >= 300) throw new Http(code);
        String s = bo.toString("UTF-8");
        return s.isEmpty() ? new JSONObject() : new JSONObject(s);
    }

    static final class Http extends Exception {
        final int code;
        Http(int c) { super("http " + c); code = c; }
    }

    // ---------- Ulash ----------
    private volatile boolean polling;

    interface Cb { void done(String msg); }

    /** Ulash kodini oladi va LevelUpDay'ni brauzerda ochadi (#fgpair=KOD) — u yerda "Ulash" tasdiqlanadi. */
    void startPair(final Cb cb) {
        new Thread(new Runnable() { public void run() {
            try {
                String code = st.pairCode();
                if (code.isEmpty()) {
                    JSONObject b = new JSONObject();
                    b.put("action", "pair_start");
                    b.put("name", "Android · " + deviceModel());
                    code = call(b).optString("code", "");
                    if (code.isEmpty()) throw new Exception("no code");
                    st.setPair(code);
                }
                final String url = Store.APP_URL + "#fgpair=" + code;
                main.post(new Runnable() { public void run() { open(app, url); } });
                pollPair(cb);
            } catch (Exception e) {
                post(cb, I18n.T("⚠️ Internet yo'q — keyinroq urinib ko'ring", "⚠️ No internet — try again later", "⚠️ Нет интернета — попробуйте позже"));
            }
        } }).start();
    }

    private void pollPair(Cb cb) {
        if (polling) return;
        polling = true;
        try {
            for (int i = 0; i < 280 && st.token().isEmpty(); i++) {
                String code = st.pairCode();
                if (code.isEmpty()) break;
                try {
                    JSONObject b = new JSONObject();
                    b.put("action", "pair_poll");
                    b.put("code", code);
                    String tok = call(b).optString("token", "");
                    if (!tok.isEmpty()) {
                        st.setToken(tok);
                        st.setPair("");
                        st.setAppsSent("");
                        syncNow();
                        post(cb, I18n.T("✅ Ulandi!", "✅ Connected!", "✅ Подключено!"));
                        return;
                    }
                } catch (Http h) {
                    if (h.code == 410) { st.setPair(""); post(cb, I18n.T("⏳ Ulash vaqti tugadi — qaytadan bosing", "⏳ Pairing expired — tap again", "⏳ Время истекло — нажмите снова")); return; }
                } catch (Exception ignored) { }
                Thread.sleep(3000);
            }
        } catch (InterruptedException ignored) {
        } finally { polling = false; }
    }

    private void post(final Cb cb, final String msg) {
        if (cb != null) main.post(new Runnable() { public void run() { cb.done(msg); } });
    }

    static String deviceModel() {
        String m = Build.MODEL == null ? "" : Build.MODEL;
        String b = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        if (!b.isEmpty() && !m.toLowerCase().startsWith(b.toLowerCase())) m = Character.toUpperCase(b.charAt(0)) + b.substring(1) + " " + m;
        return m;
    }

    static void open(Context c, String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception ignored) { }
    }

    // ---------- Sinxronlash ----------
    private volatile boolean syncing;
    Runnable onSynced;

    void syncNow() {
        if (syncing) return;
        new Thread(new Runnable() { public void run() { sync(); } }).start();
    }

    private void sync() {
        if (syncing) return;
        syncing = true;
        JSONArray events = null;
        try {
            String token = st.token();
            if (token.isEmpty()) return;
            Apps.scan(app, false);
            Core.Cfg cfg = st.cfg();
            JSONArray rows = new JSONArray();
            if (cfg.track) for (int off = 0; off >= -1; off--) {
                String d = Store.day(Usage.dayStart(off));
                for (Map.Entry<String, int[]> e : Usage.day(app, off).entrySet()) {
                    if (!Apps.counts(e.getKey()) || e.getValue()[0] < 1) continue;
                    rows.put(row(d, e.getKey(), Apps.label(app, e.getKey()), e.getValue()));
                }
                JSONObject s = st.sites(d);
                Iterator<String> it = s.keys();
                while (it.hasNext()) {
                    String k = it.next();
                    JSONObject u = s.optJSONObject(k);
                    if (u == null || u.optInt("s") < 1) continue;
                    int[] v = new int[25];
                    v[0] = u.optInt("s");
                    JSONArray h = u.optJSONArray("h");
                    for (int i = 0; h != null && i < 24; i++) v[1 + i] = h.optInt(i);
                    rows.put(row(d, k, u.optString("l", k), v));
                }
            }
            JSONObject b = new JSONObject();
            b.put("action", "sync");
            b.put("token", token);
            b.put("version", Store.VERSION);
            b.put("usage", rows);
            b.put("today", Store.day(System.currentTimeMillis()));
            String hash = Apps.hash();
            boolean sendApps = !hash.equals(st.appsHash()) || System.currentTimeMillis() - st.appsSentAt() > 24 * 3600 * 1000L;
            if (sendApps) b.put("apps", Apps.list(app));
            events = st.takeEvents();
            if (events.length() > 0) b.put("events", events);
            JSONObject r = call(b);
            events = null;
            if (sendApps) st.setAppsSent(hash);
            JSONObject cfgJ = r.optJSONObject("config");
            st.setCfg(cfgJ == null ? "{}" : cfgJ.toString());
            st.setOthers(r.optJSONObject("others"), Store.day(System.currentTimeMillis()));
            JSONObject dev = r.optJSONObject("device");
            if (dev != null) st.setDeviceName(dev.optString("name", ""));
            usedAt = 0;
            final Runnable cb = onSynced;
            if (cb != null) main.post(cb);
        } catch (Http h) {
            if (h.code == 401) { st.setToken(""); st.setDeviceName(""); }
        } catch (Exception ignored) {
        } finally {
            if (events != null && events.length() > 0) st.putBackEvents(events);
            syncing = false;
        }
    }

    private static JSONObject row(String d, String app, String label, int[] v) throws Exception {
        JSONObject o = new JSONObject();
        o.put("day", d);
        o.put("app", app);
        o.put("label", label);
        o.put("seconds", v[0]);
        JSONArray h = new JSONArray();
        for (int i = 0; i < 24; i++) h.put(v[1 + i]);
        o.put("hours", h);
        return o;
    }

    // ---------- Bildirishnomalar ----------
    void notify(int id, String title, String body) {
        if (!st.cfg().notif) return;
        try {
            NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder nb;
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(new NotificationChannel("fg", "Focusgate", NotificationManager.IMPORTANCE_DEFAULT));
                nb = new Notification.Builder(app, "fg");
            } else {
                nb = new Notification.Builder(app);
            }
            Intent i = new Intent(app, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent pi = PendingIntent.getActivity(app, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            nb.setSmallIcon(android.R.drawable.ic_lock_idle_lock).setContentTitle(title).setContentText(body).setAutoCancel(true).setContentIntent(pi);
            nm.notify(id, nb.build());
        } catch (Exception ignored) { }
    }
}
