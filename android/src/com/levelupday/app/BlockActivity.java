// "Bloklandi" oynasi — bloklangan ilova/sayt ochilganda ko'rsatiladi.
package com.levelupday.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;

public class BlockActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        render();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        render();
    }

    private void render() {
        Intent i = getIntent();
        String label = i.getStringExtra("label");
        String reason = i.getStringExtra("reason");
        int minutes = i.getIntExtra("minutes", 0);
        Ui ui = new Ui(this);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);
        LinearLayout col = ui.column();
        col.setGravity(android.view.Gravity.CENTER);
        col.setPadding(ui.dp(28), ui.dp(48), ui.dp(28), ui.dp(48));
        col.addView(ui.text("🛡", 64, Ui.TEXT, true, true));
        col.addView(ui.space(12));
        col.addView(ui.text(label == null ? "" : label, 26, Ui.TEXT, true, true));
        col.addView(ui.space(8));
        col.addView(ui.text(I18n.reason(reason, minutes), 16, Ui.MUTED, false, true));
        col.addView(ui.space(18));
        String tip = "focus".equals(reason)
                ? I18n.T("Fokus sessiyasi davom etmoqda — davom eting, siz uddalaysiz! 💪", "Your focus session is on — keep going, you've got this! 💪", "Идёт сессия фокуса — продолжайте, у вас получится! 💪")
                : I18n.T("Limitni LevelUpDay → Focusgate bo'limida o'zgartirish mumkin.", "You can change the limit in LevelUpDay → Focusgate.", "Лимит можно изменить в LevelUpDay → Focusgate.");
        col.addView(ui.text(tip, 14, Ui.MUTED, false, true));
        col.addView(ui.space(28));
        col.addView(ui.button(I18n.T("Bosh ekranga", "Go home", "На главный экран"), true, new View.OnClickListener() {
            public void onClick(View v) { goHome(); }
        }));
        col.addView(ui.space(10));
        col.addView(ui.button(I18n.T("LevelUpDay'ni ochish", "Open LevelUpDay", "Открыть LevelUpDay"), false, new View.OnClickListener() {
            public void onClick(View v) { Engine.open(BlockActivity.this, Store.APP_URL + "#focusgate"); finish(); }
        }));
        setContentView(ui.root(col, false));
    }

    private void goHome() {
        Intent h = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(h); } catch (Exception ignored) { }
        finish();
    }

    @Override
    public void onBackPressed() { goHome(); }
}
