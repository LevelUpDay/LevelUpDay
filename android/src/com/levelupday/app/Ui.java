// Kichik UI yordamchilari (XML maketlarsiz) — LevelUpDay'ning qorong'i dizayni.
package com.levelupday.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

final class Ui {
    static final int BG = 0xFF0B0B12, CARD = 0xFF16161F, LINE = 0x1FFFFFFF, TEXT = 0xFFF4F4FA, MUTED = 0xFF9A9AB0,
            ACCENT = 0xFF7C5CFC, GREEN = 0xFF22C55E, ORANGE = 0xFFF59E0B;

    final Context c;
    private final float d;

    Ui(Context c) { this.c = c; d = c.getResources().getDisplayMetrics().density; }

    int dp(float v) { return Math.round(v * d); }

    View root(View content, boolean scroll) {
        if (!scroll) {
            LinearLayout f = new LinearLayout(c);
            f.setBackgroundColor(BG);
            f.setGravity(Gravity.CENTER);
            f.addView(content, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            return f;
        }
        ScrollView s = new ScrollView(c);
        s.setBackgroundColor(BG);
        s.setFillViewport(true);
        s.addView(content);
        return s;
    }

    LinearLayout column() {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    LinearLayout row() {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    View space(int h) {
        View v = new View(c);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(h)));
        return v;
    }

    TextView text(String s, float sp, int color, boolean bold, boolean center) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setLineSpacing(0, 1.15f);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        if (center) t.setGravity(Gravity.CENTER_HORIZONTAL);
        return t;
    }

    GradientDrawable rounded(int fill, int radiusDp, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(radiusDp));
        if (stroke != 0) g.setStroke(dp(1), stroke);
        return g;
    }

    LinearLayout card() {
        LinearLayout l = column();
        l.setBackground(rounded(CARD, 18, LINE));
        l.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(12);
        l.setLayoutParams(lp);
        return l;
    }

    Button button(String s, boolean primary, View.OnClickListener on) {
        Button b = new Button(c);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(primary ? Color.WHITE : TEXT);
        b.setBackground(rounded(primary ? ACCENT : 0x14FFFFFF, 14, primary ? 0 : LINE));
        b.setStateListAnimator(null);
        b.setPadding(dp(16), dp(12), dp(16), dp(12));
        b.setOnClickListener(on);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        b.setLayoutParams(lp);
        return b;
    }

    /** Kichik yumaloq belgi (1, 2, ✓). */
    TextView badge(String s, int color) {
        TextView t = text(s, 13, Color.WHITE, true, true);
        t.setGravity(Gravity.CENTER);
        t.setBackground(rounded(color, 14, 0));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(28), dp(28));
        lp.rightMargin = dp(12);
        t.setLayoutParams(lp);
        return t;
    }
}
