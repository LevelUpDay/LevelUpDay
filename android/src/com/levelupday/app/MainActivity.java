// Asosiy oyna: sozlash qadamlari (akkaunt, ruxsatlar), bugungi vaqt, fokus holati.
package com.levelupday.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private Engine eng;
    private Ui ui;
    private final Handler h = new Handler(Looper.getMainLooper());
    private String note = "";
    private final Runnable refresh = new Runnable() {
        public void run() { render(); h.postDelayed(this, 10000); }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        eng = Engine.get(this);
        ui = new Ui(this);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);
        Apps.scan(this, true);
    }

    @Override
    protected void onResume() {
        super.onResume();
        eng.onSynced = new Runnable() { public void run() { render(); } };
        eng.syncNow();
        h.removeCallbacks(refresh);
        h.post(refresh);
    }

    @Override
    protected void onPause() {
        super.onPause();
        h.removeCallbacks(refresh);
        eng.onSynced = null;
    }

    private boolean guardOn() {
        if (GuardService.running != null) return true;
        try {
            String s = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            return s != null && s.contains(getPackageName() + "/");
        } catch (Exception e) { return false; }
    }

    private boolean batteryOk() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm == null || pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private boolean notifOk() {
        return Build.VERSION.SDK_INT < 33 || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == 0;
    }

    private void render() {
        Store st = eng.st;
        Core.Cfg cfg = st.cfg();
        boolean paired = !st.token().isEmpty(), usage = Usage.granted(this), guard = guardOn(), notif = notifOk(), batt = batteryOk();

        LinearLayout col = ui.column();
        col.setPadding(ui.dp(18), ui.dp(26), ui.dp(18), ui.dp(30));

        // Sarlavha
        LinearLayout head = ui.row();
        ImageView ic = new ImageView(this);
        ic.setImageResource(getApplicationInfo().icon);
        LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(ui.dp(48), ui.dp(48));
        ilp.rightMargin = ui.dp(12);
        head.addView(ic, ilp);
        LinearLayout ht = ui.column();
        ht.addView(ui.text("LevelUpDay", 22, Ui.TEXT, true, false));
        int done = (paired ? 1 : 0) + (usage ? 1 : 0) + (guard ? 1 : 0);
        String status = done == 3 ? "🛡 " + I18n.T("Focusgate ishlayapti", "Focusgate is active", "Focusgate работает")
                : "⚙️ " + I18n.T("Sozlash: ", "Setup: ", "Настройка: ") + done + "/3";
        ht.addView(ui.text(status, 14, done == 3 ? Ui.GREEN : Ui.ORANGE, true, false));
        head.addView(ht);
        col.addView(head);

        if (!note.isEmpty()) {
            col.addView(ui.space(10));
            col.addView(ui.text(note, 14, Ui.TEXT, false, false));
        }

        // Fokus holati
        long now = System.currentTimeMillis();
        if (paired && cfg.focusUntil > now) {
            LinearLayout f = ui.card();
            f.setBackground(ui.rounded(0x267C5CFC, 18, Ui.ACCENT));
            f.addView(ui.text("🎯 " + I18n.T("Fokus: ", "Focus: ", "Фокус: ") + I18n.dur((int) ((cfg.focusUntil - now) / 1000)) + " " + I18n.T("qoldi", "left", "осталось"), 17, Ui.TEXT, true, false));
            f.addView(ui.text(I18n.T("Chalg'ituvchi ilovalar bloklangan", "Distracting apps are blocked", "Отвлекающие приложения заблокированы"), 13, Ui.MUTED, false, false));
            col.addView(f);
        } else if (paired && !cfg.strict && cfg.pauseUntil > now) {
            LinearLayout f = ui.card();
            f.addView(ui.text("⏸ " + I18n.T("Pauza: ", "Paused: ", "Пауза: ") + I18n.dur((int) ((cfg.pauseUntil - now) / 1000)), 16, Ui.TEXT, true, false));
            col.addView(f);
        }

        // 1. Akkaunt
        col.addView(step(1, paired,
                paired ? I18n.T("Akkaunt ulangan", "Account connected", "Аккаунт подключён") : I18n.T("Akkauntga ulash", "Connect your account", "Подключите аккаунт"),
                paired ? (st.deviceName().isEmpty() ? "" : st.deviceName()) : I18n.T("Brauzerda LevelUpDay ochiladi — «Ulash» ni tasdiqlang", "LevelUpDay opens in your browser — confirm “Connect”", "Откроется LevelUpDay в браузере — подтвердите «Подключить»"),
                paired ? null : I18n.T("Ulash", "Connect", "Подключить"),
                new View.OnClickListener() { public void onClick(View v) {
                    note = "⏳ " + I18n.T("Brauzerda tasdiqlang…", "Confirm in the browser…", "Подтвердите в браузере…");
                    render();
                    eng.startPair(new Engine.Cb() { public void done(String m) { note = m; render(); } });
                } }));

        // 2. Foydalanish ma'lumotlari
        col.addView(step(2, usage,
                I18n.T("Ekran vaqtini hisoblash", "Count screen time", "Учёт экранного времени"),
                usage ? I18n.T("Ruxsat berilgan", "Allowed", "Разрешено")
                        : I18n.T("Ro'yxatdan LevelUpDay ni toping va ruxsat bering", "Find LevelUpDay in the list and allow it", "Найдите LevelUpDay в списке и разрешите"),
                usage ? null : I18n.T("Ruxsat berish", "Allow", "Разрешить"),
                new View.OnClickListener() { public void onClick(View v) { settings(Settings.ACTION_USAGE_ACCESS_SETTINGS, true); } }));

        // 3. Bloklash (maxsus imkoniyatlar)
        LinearLayout s3 = step(3, guard,
                I18n.T("Ilova va saytlarni bloklash", "Block apps and websites", "Блокировка приложений и сайтов"),
                guard ? I18n.T("Yoqilgan", "On", "Включено")
                        : I18n.T("Maxsus imkoniyatlar → O'rnatilgan ilovalar → LevelUpDay Focusgate → Yoqish", "Accessibility → Installed apps → LevelUpDay Focusgate → On", "Спец. возможности → Установленные приложения → LevelUpDay Focusgate → Вкл."),
                guard ? null : I18n.T("Yoqish", "Turn on", "Включить"),
                new View.OnClickListener() { public void onClick(View v) { settings(Settings.ACTION_ACCESSIBILITY_SETTINGS, false); } });
        if (!guard && Build.VERSION.SDK_INT >= 33) {
            s3.addView(ui.space(8));
            s3.addView(ui.text(I18n.T("Kulrang bo'lib «Cheklangan sozlama» desa: LevelUpDay ilova ma'lumotlari → ⋮ (yuqori o'ng burchak) → «Cheklangan sozlamalarga ruxsat berish», keyin qaytadan yoqing.",
                    "If it's greyed out (“Restricted setting”): LevelUpDay App info → ⋮ (top right) → “Allow restricted settings”, then turn it on again.",
                    "Если серое («Ограниченная настройка»): О приложении LevelUpDay → ⋮ (вверху справа) → «Разрешить ограниченные настройки», затем включите снова."), 13, Ui.MUTED, false, false));
            s3.addView(ui.space(8));
            s3.addView(ui.button(I18n.T("Ilova ma'lumotlarini ochish", "Open App info", "Открыть «О приложении»"), false, new View.OnClickListener() {
                public void onClick(View v) {
                    try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
                }
            }));
        }
        col.addView(s3);

        // Qo'shimcha: bildirishnoma, batareya
        if (!notif || !batt) {
            LinearLayout extra = ui.card();
            extra.addView(ui.text(I18n.T("Ishonchli ishlashi uchun", "For reliable work", "Для надёжной работы"), 15, Ui.TEXT, true, false));
            if (!notif) {
                extra.addView(ui.space(8));
                extra.addView(ui.button("🔔 " + I18n.T("Bildirishnomalarga ruxsat", "Allow notifications", "Разрешить уведомления"), false, new View.OnClickListener() {
                    public void onClick(View v) { if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1); }
                }));
            }
            if (!batt) {
                extra.addView(ui.space(8));
                extra.addView(ui.button("🔋 " + I18n.T("Batareya cheklovini o'chirish", "Don't restrict battery", "Не ограничивать батарею"), false, new View.OnClickListener() {
                    public void onClick(View v) {
                        try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
                        catch (Exception e) { settings(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, false); }
                    }
                }));
            }
            col.addView(extra);
        }

        // Bugun shu telefonda
        if (usage) col.addView(todayCard());

        col.addView(ui.space(16));
        col.addView(ui.button("📊 " + I18n.T("LevelUpDay'ni ochish", "Open LevelUpDay", "Открыть LevelUpDay"), true, new View.OnClickListener() {
            public void onClick(View v) { Engine.open(MainActivity.this, Store.APP_URL + "#focusgate"); }
        }));
        col.addView(ui.space(8));
        col.addView(ui.text(I18n.T("Limitlar, jadval va fokus LevelUpDay → Focusgate bo'limida sozlanadi — kompyuter bilan umumiy.",
                "Limits, schedules and focus are set in LevelUpDay → Focusgate — shared with your computer.",
                "Лимиты, расписание и фокус настраиваются в LevelUpDay → Focusgate — общие с компьютером."), 12.5f, Ui.MUTED, false, true));
        col.addView(ui.space(6));
        String sync = st.syncedAt() > 0 ? I18n.T("Sinxronlandi: ", "Synced: ", "Синхронизировано: ") + android.text.format.DateFormat.getTimeFormat(this).format(new java.util.Date(st.syncedAt())) : "";
        col.addView(ui.text(Store.VERSION.replace("android-", "v") + (sync.isEmpty() ? "" : " · " + sync), 11.5f, Ui.MUTED, false, true));

        // Yangilanganda aylantirish joyi saqlanadi
        View old = findViewById(android.R.id.content);
        int y = 0;
        if (old instanceof ViewGroup && ((ViewGroup) old).getChildCount() > 0 && ((ViewGroup) old).getChildAt(0) instanceof android.widget.ScrollView)
            y = ((ViewGroup) old).getChildAt(0).getScrollY();
        final View root = ui.root(col, true);
        setContentView(root);
        final int fy = y;
        if (fy > 0) root.post(new Runnable() { public void run() { root.scrollTo(0, fy); } });
    }

    private LinearLayout step(int n, boolean ok, String title, String sub, String btn, View.OnClickListener on) {
        LinearLayout c = ui.card();
        LinearLayout r = ui.row();
        r.addView(ui.badge(ok ? "✓" : String.valueOf(n), ok ? Ui.GREEN : Ui.ACCENT));
        LinearLayout t = ui.column();
        t.addView(ui.text(title, 16, Ui.TEXT, true, false));
        if (sub != null && !sub.isEmpty()) t.addView(ui.text(sub, 13, Ui.MUTED, false, false));
        r.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        c.addView(r);
        if (btn != null) {
            c.addView(ui.space(10));
            c.addView(ui.button(btn, true, on));
        }
        return c;
    }

    private View todayCard() {
        LinearLayout c = ui.card();
        Map<String, Integer> m = eng.localToday();
        List<Map.Entry<String, Integer>> l = new ArrayList<Map.Entry<String, Integer>>(m.entrySet());
        Collections.sort(l, new Comparator<Map.Entry<String, Integer>>() {
            public int compare(Map.Entry<String, Integer> a, Map.Entry<String, Integer> b) { return b.getValue() - a.getValue(); }
        });
        int total = 0;
        for (Map.Entry<String, Integer> e : l) total += e.getValue();
        c.addView(ui.text("⏱ " + I18n.T("Bugun shu qurilmada: ", "Today on this device: ", "Сегодня на устройстве: ") + I18n.dur(total), 16, Ui.TEXT, true, false));
        int max = l.isEmpty() ? 1 : Math.max(1, l.get(0).getValue());
        for (int i = 0; i < Math.min(8, l.size()); i++) {
            Map.Entry<String, Integer> e = l.get(i);
            if (e.getValue() < 60) break;
            c.addView(ui.space(10));
            LinearLayout r = ui.row();
            ImageView ic = new ImageView(this);
            try { ic.setImageDrawable(getPackageManager().getApplicationIcon(e.getKey())); } catch (Exception ignored) { }
            LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(ui.dp(28), ui.dp(28));
            ilp.rightMargin = ui.dp(10);
            r.addView(ic, ilp);
            LinearLayout t = ui.column();
            LinearLayout top = ui.row();
            TextView name = ui.text(Apps.label(this, e.getKey()), 14, Ui.TEXT, false, false);
            name.setSingleLine(true);
            top.addView(name, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            top.addView(ui.text(I18n.dur(e.getValue()), 13, Ui.MUTED, false, false));
            t.addView(top);
            View bar = new View(this);
            bar.setBackground(ui.rounded(Ui.ACCENT, 3, 0));
            LinearLayout barRow = ui.row();
            barRow.addView(bar, new LinearLayout.LayoutParams(0, ui.dp(5), Math.max(0.02f, e.getValue() / (float) max)));
            View rest = new View(this);
            barRow.addView(rest, new LinearLayout.LayoutParams(0, ui.dp(5), Math.max(0f, 1f - e.getValue() / (float) max)));
            LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            blp.topMargin = ui.dp(4);
            t.addView(barRow, blp);
            r.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            c.addView(r);
        }
        return c;
    }

    private void settings(String action, boolean withPkg) {
        try {
            Intent i = new Intent(action);
            if (withPkg && Build.VERSION.SDK_INT >= 29) i.setData(Uri.parse("package:" + getPackageName()));
            startActivity(i);
        } catch (Exception e) {
            try { startActivity(new Intent(action)); } catch (Exception e2) { Toast.makeText(this, action, Toast.LENGTH_LONG).show(); }
        }
    }
}
