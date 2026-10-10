// 🔔 send-reminders — har 5 daqiqada pg_cron chaqiradi.
//  • Vazifa eslatmasi: task.remindAt (HH:MM) vaqti kelganda (foydalanuvchi soat mintaqasida)
//  • Streak eslatmasi: 20:00 da, streak > 0 bo'lsa va bugun hech narsa bajarilmagan bo'lsa
// Har bir xabar push_log orqali bir marta yuboriladi.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Kalitlar Supabase Vault'da (public._push_config — faqat service_role uchun)
let CFG: { vapid_public: string; vapid_private: string; cron_secret: string } | null = null;

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

const TXT: Record<string, { task: string; streakT: string; streakB: (n: number) => string }> = {
  uz: { task: "⏰ Eslatma", streakT: "🔥 Streak yo'qolmasin!", streakB: (n) => `${n} kunlik streak'ingiz bor — bugun kamida bitta vazifani bajaring.` },
  en: { task: "⏰ Reminder", streakT: "🔥 Keep your streak!", streakB: (n) => `You're on a ${n}-day streak — finish at least one task today.` },
  ru: { task: "⏰ Напоминание", streakT: "🔥 Не потеряйте серию!", streakB: (n) => `У вас серия ${n} дн. — выполните сегодня хотя бы одну задачу.` },
};

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
  if (!subs?.length) return Response.json({ sent: 0 });

  const users = [...new Set(subs.map((s: Sub) => s.user_id))];
  const [{ data: todos }, { data: profs }] = await Promise.all([
    sb.from("todos").select("user_id,task_data").in("user_id", users),
    sb.from("profiles").select("id,streak").in("id", users),
  ]);
  const tasksBy = new Map<string, any[]>();
  (todos || []).forEach((r: any) => { if (!tasksBy.has(r.user_id)) tasksBy.set(r.user_id, []); tasksBy.get(r.user_id)!.push(r.task_data); });
  const streakBy = new Map<string, number>((profs || []).map((p: any) => [p.id, Number(p.streak) || 0]));

  // Foydalanuvchi bo'yicha yuboriladigan xabarlar
  const jobs: { user: string; key: string; payload: Record<string, string> }[] = [];
  for (const user of users) {
    const s = subs.find((x: Sub) => x.user_id === user) as Sub;
    const L = local(s.tz), T = TXT[s.lang || "uz"] || TXT.uz, prefs = s.prefs || {};
    const tasks = tasksBy.get(user) || [];
    if (prefs.tasks !== false) {
      for (const t of tasks) {
        const rm = toMin(t?.remindAt);
        if (rm === null || !dueToday(t, L.date, L.dow) || doneToday(t, L.date)) continue;
        if (L.min >= rm && L.min - rm < 10) {
          jobs.push({ user, key: `t:${t.id}:${L.date}`, payload: { title: T.task, body: `${t.emoji ? t.emoji + " " : ""}${t.name}${t.startTime ? " · " + t.startTime : ""}`, tag: `task-${t.id}`, url: "./?tab=tasks" } });
        }
      }
    }
    const streak = streakBy.get(user) || 0;
    if (prefs.streak !== false && streak > 0 && L.min >= 20 * 60 && L.min < 20 * 60 + 10 && !tasks.some((t) => t && t.doneDate === L.date)) {
      jobs.push({ user, key: `s:${L.date}`, payload: { title: T.streakT, body: T.streakB(streak), tag: "streak", url: "./?tab=tasks" } });
    }
  }

  let sent = 0;
  for (const j of jobs) {
    // Bir marta: push_log'ga yozilsagina yuboramiz
    const { data: ins } = await sb.from("push_log").upsert({ user_id: j.user, key: j.key }, { onConflict: "user_id,key", ignoreDuplicates: true }).select("key");
    if (!ins?.length) continue;
    for (const s of subs.filter((x: Sub) => x.user_id === j.user) as Sub[]) {
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
  return Response.json({ sent, jobs: jobs.length });
});
