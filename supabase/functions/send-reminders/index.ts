// 🔔 send-reminders — har 5 daqiqada pg_cron chaqiradi.
//  • Vazifa eslatmasi: task.remindAt (HH:MM) vaqti kelganda (foydalanuvchi soat mintaqasida)
//  • Odat eslatmasi: goal.remind (HH:MM) — app_state.data.goals dan (bugun belgilanmagan bo'lsa)
//  • Streak eslatmasi: 20:00 da, streak > 0 bo'lsa va bugun hech narsa bajarilmagan bo'lsa
// Har bir xabar push_log orqali bir marta yuboriladi.
// ✈️ Telegram (telegram_links): vazifa eslatmasi, boshlanish vaqti, 08:00 reja, 20:00 streak, 21:30 kun yakuni.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Kalitlar Supabase Vault'da (public._push_config — faqat service_role uchun)
let CFG: { vapid_public: string; vapid_private: string; cron_secret: string } | null = null;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const APP_URL = "https://levelupday.github.io/LevelUpDay/";
type Link = { user_id: string; chat_id: number; tz: string; lang: string | null; prefs: Record<string, boolean> };

type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string; lang: string | null; prefs: { tasks?: boolean; streak?: boolean } };

function local(tz: string) {
  let z = tz;
  try { new Intl.DateTimeFormat("en-US", { timeZone: z }); } catch { z = "Asia/Tashkent"; }
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: z, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), dow: dows[p.weekday as string] ?? 0 };
}
const toMin = (s: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// script.js → taskDueToday() bilan bir xil mantiq
function dueToday(t: any, date: string, dow: number) {
  if (!t || t.isFrozen) return false;
  if (t.postponedTo && t.postponedTo > date) return false;
  switch (t.repeat) {
    case "daily": return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "custom-days": case "weekly": return Array.isArray(t.days) && t.days.includes(dow);
    case "interval": return t.nextDate ? t.nextDate <= date : true;
    case "once": return !t.done;
    default: return true;
  }
}
const doneToday = (t: any, date: string) => t.repeat === "once" ? !!t.done : t.doneDate === date;

// 🎯 Odat (maqsad) eslatmasi — script.js → isGoalDueOnDate() bilan bir xil mantiq (soddalashtirilgan)
function goalDue(g: any, date: string, dow: number) {
  if (!g || g.done || g.archived || !g.remind) return false;
  if (g.daysChecked && g.daysChecked[date]) return false;
  if (g.startDate && date < g.startDate) return false;
  if (g.endDate && date > g.endDate) return false;
  if ((g.pauses || []).some((p: any) => date >= p.from && (!p.to || date < p.to))) return false;
  const rep = g.repeat || "daily";
  if (rep === "custom-days") return Array.isArray(g.days) && g.days.includes(dow);
  if (rep === "interval") {
    const o = Date.parse((g.intervalStart || g.startDate || date) + "T00:00:00Z"), d = Date.parse(date + "T00:00:00Z");
    const diff = Math.round((d - o) / 864e5); return diff >= 0 && diff % Math.max(1, Number(g.interval) || 1) === 0;
  }
  return true;
}

const TXT: Record<string, { task: string; streakT: string; streakB: (n: number) => string }> = {
  uz: { task: "⏰ Eslatma", streakT: "🔥 Streak yo'qolmasin!", streakB: (n) => `${n} kunlik streak'ingiz bor — bugun kamida bitta vazifani bajaring.` },
  en: { task: "⏰ Reminder", streakT: "🔥 Keep your streak!", streakB: (n) => `You're on a ${n}-day streak — finish at least one task today.` },
  ru: { task: "⏰ Напоминание", streakT: "🔥 Не потеряйте серию!", streakB: (n) => `У вас серия ${n} дн. — выполните сегодня хотя бы одну задачу.` },
};

const TG: Record<string, any> = {
  uz: { task: "⏰ <b>Eslatma</b>", start: "▶️ <b>Boshlash vaqti</b>", morning: (n: string) => `🌅 <b>Xayrli tong${n ? ", " + n : ""}!</b> Bugungi reja:`, streak: (k: number) => `🔥 <b>Streak yo'qolmasin!</b>\n${k} kunlik streak'ingiz bor — bugun kamida bitta vazifani bajaring.`, evening: "🌙 <b>Kun yakuni</b>", done: "bajarildi", left: "Qolganlari:", great: "Zo'r! Hammasi bajarildi 🎉", streakL: "Streak", btn: "📲 Ilovani ochish" },
  en: { task: "⏰ <b>Reminder</b>", start: "▶️ <b>Time to start</b>", morning: (n: string) => `🌅 <b>Good morning${n ? ", " + n : ""}!</b> Today's plan:`, streak: (k: number) => `🔥 <b>Keep your streak!</b>\nYou're on a ${k}-day streak — finish at least one task today.`, evening: "🌙 <b>Day summary</b>", done: "done", left: "Still open:", great: "Great job! Everything is done 🎉", streakL: "Streak", btn: "📲 Open the app" },
  ru: { task: "⏰ <b>Напоминание</b>", start: "▶️ <b>Пора начинать</b>", morning: (n: string) => `🌅 <b>Доброе утро${n ? ", " + n : ""}!</b> План на сегодня:`, streak: (k: number) => `🔥 <b>Не потеряйте серию!</b>\nУ вас серия ${k} дн. — выполните сегодня хотя бы одну задачу.`, evening: "🌙 <b>Итоги дня</b>", done: "выполнено", left: "Осталось:", great: "Отлично! Всё выполнено 🎉", streakL: "Серия", btn: "📲 Открыть приложение" },
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const taskLine = (t: any, done = false) => `${done ? "✅" : "▫️"} ${t.startTime ? `<code>${esc(t.startTime)}</code> ` : ""}${t.emoji ? esc(t.emoji) + " " : ""}${esc(t.name)}`;
async function tgCall(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
const hexOf = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
// Webhook va buyruqlar menyusi — token yoki manzil o'zgarganda bir marta o'rnatiladi
async function ensureWebhook(sb: any) {
  if (!BOT_TOKEN) return;
  const url = `${SB_URL}/functions/v1/telegram-bot`;
  const secret = hexOf(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lud-wh:" + BOT_TOKEN))).slice(0, 48);
  const sig = secret.slice(0, 16) + "|" + url;
  const { data: st } = await sb.from("telegram_state").select("v").eq("k", "webhook").maybeSingle();
  if (st?.v === sig) return;
  const r = await tgCall("setWebhook", { url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false });
  if (!r.json?.ok) { console.warn("setWebhook", r.json); return; }
  for (const [lc, cmds] of Object.entries({
    "": [["today", "Bugungi vazifalar"], ["stop", "Eslatmalarni to'xtatish"], ["start", "Eslatmalarni yoqish"], ["help", "Yordam"]],
    en: [["today", "Today's tasks"], ["stop", "Pause reminders"], ["start", "Resume reminders"], ["help", "Help"]],
    ru: [["today", "Задачи на сегодня"], ["stop", "Пауза"], ["start", "Включить напоминания"], ["help", "Помощь"]],
  })) await tgCall("setMyCommands", { commands: (cmds as string[][]).map(([command, description]) => ({ command, description })), ...(lc ? { language_code: lc } : {}) });
  await sb.from("telegram_state").upsert({ k: "webhook", v: sig, updated_at: new Date().toISOString() });
}

Deno.serve(async (req) => {
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  if (!CFG) {
    const { data, error } = await sb.rpc("_push_config");
    if (error || !data?.cron_secret) return new Response("config error", { status: 500 });
    CFG = data;
    webpush.setVapidDetails("mailto:shodruz1009@gmail.com", CFG!.vapid_public, CFG!.vapid_private);
  }
  if (req.headers.get("x-cron-secret") !== CFG!.cron_secret) return new Response("forbidden", { status: 403 });
  const { data: subs, error } = await sb.from("push_subscriptions").select("endpoint,user_id,p256dh,auth,tz,lang,prefs");
  if (error) return new Response(error.message, { status: 500 });
  let links: Link[] = [];
  if (BOT_TOKEN) {
    try { await ensureWebhook(sb); } catch (e) { console.warn("webhook", e); }
    const { data: tl } = await sb.from("telegram_links").select("user_id,chat_id,tz,lang,prefs").eq("enabled", true);
    links = (tl || []) as Link[];
  }
  if (!subs?.length && !links.length) return Response.json({ sent: 0 });

  const users = [...new Set([...(subs || []).map((s: Sub) => s.user_id), ...links.map((l) => l.user_id)])];
  const [{ data: todos }, { data: profs }, { data: states }] = await Promise.all([
    sb.from("todos").select("user_id,task_data").in("user_id", users),
    sb.from("profiles").select("id,streak,name").in("id", users),
    sb.from("app_state").select("user_id,goals:data->goals").in("user_id", users),
  ]);
  const goalsBy = new Map<string, any[]>();
  (states || []).forEach((r: any) => { if (Array.isArray(r.goals)) goalsBy.set(r.user_id, r.goals.filter((g: any) => g && g.remind)); });
  const nameBy = new Map<string, string>((profs || []).map((p: any) => [p.id, String(p.name || "")]));
  const tasksBy = new Map<string, any[]>();
  (todos || []).forEach((r: any) => { if (!tasksBy.has(r.user_id)) tasksBy.set(r.user_id, []); tasksBy.get(r.user_id)!.push(r.task_data); });
  const streakBy = new Map<string, number>((profs || []).map((p: any) => [p.id, Number(p.streak) || 0]));

  // Foydalanuvchi bo'yicha yuboriladigan xabarlar
  const jobs: { user: string; key: string; payload: Record<string, string> }[] = [];
  const tgJobs: { user: string; chat: number; key: string; text: string }[] = [];
  for (const user of users) {
    const s = (subs || []).find((x: Sub) => x.user_id === user) as Sub | undefined;
    const link = links.find((l) => l.user_id === user);
    const tasks = tasksBy.get(user) || [];
    // ✈️ Telegram xabarlari
    if (link) {
      const L = local(link.tz || s?.tz || "Asia/Tashkent"), G = TG[link.lang || s?.lang || "uz"] || TG.uz, pf = link.prefs || {};
      const due = tasks.filter((t) => dueToday(t, L.date, L.dow));
      const push = (key: string, text: string) => tgJobs.push({ user, chat: link.chat_id, key: "tg:" + key, text });
      for (const t of due) {
        if (doneToday(t, L.date)) continue;
        const rm = toMin(t?.remindAt), st = toMin(t?.startTime);
        if (pf.tasks !== false && rm !== null && L.min >= rm && L.min - rm < 10)
          push(`t:${t.id}:${L.date}`, `${G.task}\n${taskLine(t)}`);
        // Boshlanishdan ~5 daqiqa oldin (eslatma xuddi shu vaqtga qo'yilmagan bo'lsa)
        if (pf.start !== false && st !== null && rm !== st && L.min >= st - 5 && L.min < st + 5)
          push(`st:${t.id}:${L.date}`, `${G.start}\n${taskLine(t)}${t.endTime ? ` → <code>${esc(t.endTime)}</code>` : ""}`);
      }
      if (pf.tasks !== false) for (const g of goalsBy.get(user) || []) {
        const rm = toMin(g.remind);
        if (rm !== null && goalDue(g, L.date, L.dow) && L.min >= rm && L.min - rm < 10)
          push(`g:${g.id}:${L.date}`, `${G.task}\n${g.emoji ? esc(g.emoji) + " " : "🎯 "}${esc(g.name)}${g.target > 1 ? ` — ${g.target} ${esc(g.unit || "")}` : ""}`);
      }
      const sorted = due.slice().sort((a, b) => String(a.startTime || "99").localeCompare(String(b.startTime || "99")));
      if (pf.morning !== false && due.length && L.min >= 8 * 60 && L.min < 8 * 60 + 10) {
        const k = streakBy.get(user) || 0;
        push(`m:${L.date}`, `${G.morning(esc(nameBy.get(user) || ""))}\n\n${sorted.slice(0, 15).map((t) => taskLine(t, doneToday(t, L.date))).join("\n")}${due.length > 15 ? "\n…" : ""}${k ? `\n\n🔥 ${G.streakL}: <b>${k}</b>` : ""}`);
      }
      const streakN = streakBy.get(user) || 0;
      if (pf.streak !== false && streakN > 0 && L.min >= 20 * 60 && L.min < 20 * 60 + 10 && !tasks.some((t) => t && t.doneDate === L.date))
        push(`s:${L.date}`, G.streak(streakN));
      if (pf.evening !== false && due.length && L.min >= 21 * 60 + 30 && L.min < 21 * 60 + 40) {
        const open = sorted.filter((t) => !doneToday(t, L.date)), dn = due.length - open.length;
        push(`e:${L.date}`, `${G.evening}\n✅ <b>${dn}/${due.length}</b> ${G.done}\n\n${open.length ? `${G.left}\n${open.slice(0, 8).map((t) => taskLine(t)).join("\n")}${open.length > 8 ? "\n…" : ""}` : G.great}`);
      }
    }
    if (!s) continue;
    const L = local(s.tz), T = TXT[s.lang || "uz"] || TXT.uz, prefs = s.prefs || {};
    if (prefs.tasks !== false) {
      for (const t of tasks) {
        const rm = toMin(t?.remindAt);
        if (rm === null || !dueToday(t, L.date, L.dow) || doneToday(t, L.date)) continue;
        if (L.min >= rm && L.min - rm < 10) {
          jobs.push({ user, key: `t:${t.id}:${L.date}`, payload: { title: T.task, body: `${t.emoji ? t.emoji + " " : ""}${t.name}${t.startTime ? " · " + t.startTime : ""}`, tag: `task-${t.id}`, url: "./?tab=tasks" } });
        }
      }
    }
    if (prefs.tasks !== false) {
      for (const g of goalsBy.get(user) || []) {
        const rm = toMin(g.remind);
        if (rm === null || !goalDue(g, L.date, L.dow) || !(L.min >= rm && L.min - rm < 10)) continue;
        jobs.push({ user, key: `g:${g.id}:${L.date}`, payload: { title: T.task, body: `${g.emoji ? g.emoji + " " : "🎯 "}${g.name}${g.target > 1 ? ` — ${g.target} ${g.unit || ""}` : ""}`, tag: `goal-${g.id}`, url: "./?tab=goals" } });
      }
    }
    const streak = streakBy.get(user) || 0;
    if (prefs.streak !== false && streak > 0 && L.min >= 20 * 60 && L.min < 20 * 60 + 10 && !tasks.some((t) => t && t.doneDate === L.date)) {
      jobs.push({ user, key: `s:${L.date}`, payload: { title: T.streakT, body: T.streakB(streak), tag: "streak", url: "./?tab=tasks" } });
    }
  }

  let sent = 0, tgSent = 0;
  for (const j of tgJobs) {
    const { data: ins } = await sb.from("push_log").upsert({ user_id: j.user, key: j.key }, { onConflict: "user_id,key", ignoreDuplicates: true }).select("key");
    if (!ins?.length) continue;
    const lang = (links.find((l) => l.user_id === j.user)?.lang) || "uz";
    const r = await tgCall("sendMessage", { chat_id: j.chat, text: j.text, parse_mode: "HTML", disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: (TG[lang] || TG.uz).btn, url: APP_URL }]] } });
    if (r.json?.ok) tgSent++;
    else if (r.status === 403) await sb.from("telegram_links").update({ enabled: false }).eq("chat_id", j.chat); // bot bloklangan
    else console.warn("tg send", r.status, r.json?.description);
  }
  for (const j of jobs) {
    // Bir marta: push_log'ga yozilsagina yuboramiz
    const { data: ins } = await sb.from("push_log").upsert({ user_id: j.user, key: j.key }, { onConflict: "user_id,key", ignoreDuplicates: true }).select("key");
    if (!ins?.length) continue;
    for (const s of (subs || []).filter((x: Sub) => x.user_id === j.user) as Sub[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(j.payload), { TTL: 3600 });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        else console.warn("push error", e?.statusCode, e?.body);
      }
    }
  }
  // Eski jurnal yozuvlarini tozalaymiz (3 kundan eski)
  await sb.from("push_log").delete().lt("sent_at", new Date(Date.now() - 3 * 864e5).toISOString());
  return Response.json({ sent, jobs: jobs.length, tgSent, tgJobs: tgJobs.length });
});
