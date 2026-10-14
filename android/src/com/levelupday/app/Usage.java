// Telefonda ilovalar vaqti: Android'ning "Foydalanish ma'lumotlari" (UsageStatsManager) hodisalaridan hisoblanadi —
// ekran o'chiq/qulflangan vaqt kirmaydi, soatlar bo'yicha taqsimlanadi.
package com.levelupday.app;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

final class Usage {
    private Usage() {}

    static boolean granted(Context c) {
        try {
            AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
            int m = Build.VERSION.SDK_INT >= 29
                    ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
                    : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
            return m == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) { return false; }
    }

    static long dayStart(int offset) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.DAY_OF_MONTH, offset);
        return c.getTimeInMillis();
    }

    /** Kun (0 — bugun, -1 — kecha): paket → [jami, soat0..soat23] (soniya). */
    static Map<String, int[]> day(Context ctx, int offset) {
        Map<String, int[]> out = new HashMap<String, int[]>();
        if (!granted(ctx)) return out;
        long start = dayStart(offset), end = offset == 0 ? System.currentTimeMillis() : dayStart(offset + 1);
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents ev;
        try { ev = usm.queryEvents(start - 3 * 3600 * 1000L, end); } catch (Exception e) { return out; }
        if (ev == null) return out;
        UsageEvents.Event e = new UsageEvents.Event();
        String cur = null;
        long since = 0;
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e);
            int t = e.getEventType();
            long ts = e.getTimeStamp();
            String pkg = e.getPackageName();
            if (t == 1) { // ACTIVITY_RESUMED (MOVE_TO_FOREGROUND)
                if (cur != null && !cur.equals(pkg)) add(out, cur, since, ts, start, end);
                if (cur == null || !cur.equals(pkg)) { cur = pkg; since = ts; }
            } else if (t == 2 || t == 23) { // ACTIVITY_PAUSED / ACTIVITY_STOPPED
                if (pkg != null && pkg.equals(cur)) { add(out, cur, since, ts, start, end); cur = null; }
            } else if (t == 16 || t == 17 || t == 26 || t == 27) { // ekran o'chdi / qulf / o'chirish
                if (cur != null) { add(out, cur, since, ts, start, end); cur = null; }
            }
        }
        if (cur != null && offset == 0) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm == null || pm.isInteractive()) add(out, cur, since, end, start, end);
        }
        return out;
    }

    private static void add(Map<String, int[]> out, String pkg, long a, long b, long start, long end) {
        if (a < start) a = start;
        if (b > end) b = end;
        if (b - a > 12 * 3600 * 1000L) b = a + 12 * 3600 * 1000L; // yo'qolgan hodisa — cheksiz vaqt qo'shilmasin
        if (b <= a) return;
        int[] u = out.get(pkg);
        if (u == null) { u = new int[25]; out.put(pkg, u); }
        Calendar c = Calendar.getInstance();
        while (a < b) {
            c.setTimeInMillis(a);
            int h = c.get(Calendar.HOUR_OF_DAY);
            c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
            c.add(Calendar.HOUR_OF_DAY, 1);
            long next = Math.min(b, c.getTimeInMillis());
            int s = (int) ((next - a) / 1000);
            u[0] += s;
            u[1 + h] += s;
            a = next;
        }
    }
}
