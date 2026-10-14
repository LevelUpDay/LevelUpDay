// O'rnatilgan ilovalar: nomi, kategoriyasi, ikonkasi (sayt'dagi ro'yxat va qoidalar uchun).
package com.levelupday.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONObject;

final class Apps {
    private Apps() {}

    static final Map<String, String> labels = new HashMap<String, String>();
    static final Map<String, String> cats = new HashMap<String, String>();
    static final Set<String> launchable = new HashSet<String>();
    static final Set<String> homes = new HashSet<String>();
    private static long scannedAt;

    /** Ro'yxatni yangilaydi (10 daqiqada bir martadan ko'p emas). */
    static synchronized void scan(Context c, boolean force) {
        if (!force && System.currentTimeMillis() - scannedAt < 10 * 60 * 1000L && !launchable.isEmpty()) return;
        scannedAt = System.currentTimeMillis();
        PackageManager pm = c.getPackageManager();
        launchable.clear();
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo r : pm.queryIntentActivities(i, 0)) {
            String pkg = r.activityInfo.packageName;
            if (pkg.equals(c.getPackageName())) continue;
            launchable.add(pkg);
            try { labels.put(pkg, String.valueOf(r.loadLabel(pm))); } catch (Exception ignored) { }
            String cat = Core.CAT.get(pkg.toLowerCase(java.util.Locale.ROOT));
            if (cat == null && Build.VERSION.SDK_INT >= 26) {
                try { cat = Core.fromAndroidCat(r.activityInfo.applicationInfo.category); } catch (Exception ignored) { }
            }
            if (cat == null || cat.isEmpty()) cat = (r.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0 ? "other" : "";
            if (!cat.isEmpty()) cats.put(pkg.toLowerCase(java.util.Locale.ROOT), cat);
        }
        homes.clear();
        Intent h = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        for (ResolveInfo r : pm.queryIntentActivities(h, 0)) homes.add(r.activityInfo.packageName);
    }

    static String label(Context c, String pkg) {
        String l = labels.get(pkg);
        if (l != null) return l;
        try {
            PackageManager pm = c.getPackageManager();
            l = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)));
        } catch (Exception e) { l = pkg; }
        labels.put(pkg, l);
        return l;
    }

    /** Vaqti hisoblanadigan ilova: ishga tushiriladigan, bosh ekran (launcher) emas. */
    static boolean counts(String pkg) { return launchable.contains(pkg) && !homes.contains(pkg); }

    static String hash() {
        List<String> l = new ArrayList<String>(launchable);
        Collections.sort(l);
        return Integer.toHexString(l.toString().hashCode());
    }

    /** Server uchun: [{exe: paket, name, cat, icon: data:image/png;base64}] */
    static JSONArray list(Context c) {
        JSONArray out = new JSONArray();
        PackageManager pm = c.getPackageManager();
        List<String> l = new ArrayList<String>(launchable);
        Collections.sort(l);
        for (String pkg : l) {
            if (homes.contains(pkg)) continue;
            try {
                JSONObject o = new JSONObject();
                o.put("exe", pkg);
                o.put("name", label(c, pkg));
                String cat = cats.get(pkg.toLowerCase(java.util.Locale.ROOT));
                if (cat != null) o.put("cat", cat);
                String ic = icon(pm, pkg);
                if (ic != null) o.put("icon", ic);
                out.put(o);
            } catch (Exception ignored) { }
            if (out.length() >= 400) break;
        }
        return out;
    }

    private static String icon(PackageManager pm, String pkg) {
        try {
            Drawable d = pm.getApplicationIcon(pkg);
            Bitmap b = Bitmap.createBitmap(40, 40, Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(b);
            d.setBounds(0, 0, 40, 40);
            d.draw(cv);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, bo);
            String s = "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            return s.length() <= 12000 ? s : null;
        } catch (Throwable e) { return null; }
    }
}
