// 🤖 telegram-bot — @LevelUpDayLoginBot webhook'i.
//  • /start <kod>  — ilovadagi "Telegram'ga ulash" tugmasidan kelgan bir martalik kod bilan akkauntni bog'laydi
//  • /start        — ulangan bo'lsa eslatmalarni qayta yoqadi, aks holda qanday ulashni tushuntiradi
//  • /today        — bugungi vazifalar ro'yxati
//  • /stop         — eslatmalarni to'xtatadi
//  • /help         — yordam
// Ilovadan (foydalanuvchi JWT bilan) { action: "test" } — sinov xabari yuboradi.
// Webhook so'rovlari X-Telegram-Bot-Api-Secret-Token sarlavhasi bilan tekshiriladi (bot tokenidan hosil qilinadi).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const APP_URL = "https://levelupday.github.io/LevelUpDay/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function webhookSecret() { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lud-wh:" + BOT_TOKEN))).slice(0, 48); }
async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return await r.json().catch(() => ({ ok: false }));
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const openBtn = (lang: string) => ({ inline_keyboard: [[{ text: lang === "ru" ? "📲 Открыть приложение" : lang === "en" ? "📲 Open the app" : "📲 Ilovani ochish", url: APP_URL }]] });
function send(chat: number, text: string, lang: string) { return tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: openBtn(lang) }); }

const T: Record<string, Record<string, string>> = {
  uz: {
    welcome: "👋 <b>LevelUpDay</b> botiga xush kelibsiz!\n\nEslatmalarni shu yerda olish uchun ilovada <b>Profil → Sozlamalar → ✈️ Telegram</b> bo'limida <b>«Ulash»</b> tugmasini bosing.",
    linked: "✅ <b>Ulandi!</b> Endi eslatmalar shu yerga keladi:\n• ⏰ vazifa eslatmalari va boshlanish vaqti\n• 🌅 08:00 — bugungi reja\n• 🔥 20:00 — streak eslatmasi\n• 🌙 21:30 — kun yakuni\n\n/today — bugungi vazifalar · /stop — to'xtatish",
    badCode: "⚠️ Havola eskirgan. Ilovada «Ulash» tugmasini qayta bosing.",
    resumed: "🔔 Eslatmalar yoqildi. /today — bugungi vazifalar, /stop — to'xtatish.",
    stopped: "🔕 Eslatmalar to'xtatildi. Qayta yoqish uchun /start bosing.",
    notLinked: "ℹ️ Akkaunt hali ulanmagan. Ilovada <b>Profil → Sozlamalar → ✈️ Telegram → Ulash</b>.",
    help: "🤖 <b>Buyruqlar</b>\n/today — bugungi vazifalar\n/stop — eslatmalarni to'xtatish\n/start — qayta yoqish",
    today: "📋 <b>Bugungi vazifalar</b>", none: "Bugun vazifa yo'q 🎉", test: "✅ Sinov xabari: Telegram eslatmalari ishlayapti!",
  },
  en: {
    welcome: "👋 Welcome to <b>LevelUpDay</b>!\n\nTo get reminders here, open the app: <b>Profile → Settings → ✈️ Telegram</b> and tap <b>“Connect”</b>.",
    linked: "✅ <b>Connected!</b> You'll get here:\n• ⏰ task reminders and start times\n• 🌅 08:00 — today's plan\n• 🔥 20:00 — streak reminder\n• 🌙 21:30 — day summary\n\n/today — today's tasks · /stop — pause",
    badCode: "⚠️ This link has expired. Tap “Connect” in the app again.",
    resumed: "🔔 Reminders are on. /today — today's tasks, /stop — pause.",
    stopped: "🔕 Reminders paused. Send /start to turn them back on.",
    notLinked: "ℹ️ Your account isn't connected yet. In the app: <b>Profile → Settings → ✈️ Telegram → Connect</b>.",
    help: "🤖 <b>Commands</b>\n/today — today's tasks\n/stop — pause reminders\n/start — resume",
    today: "📋 <b>Today's tasks</b>", none: "No tasks today 🎉", test: "✅ Test message: Telegram reminders are working!",
  },
  ru: {
    welcome: "👋 Добро пожаловать в <b>LevelUpDay</b>!\n\nЧтобы получать напоминания здесь, в приложении откройте <b>Профиль → Настройки → ✈️ Telegram</b> и нажмите <b>«Подключить»</b>.",
    linked: "✅ <b>Подключено!</b> Сюда будут приходить:\n• ⏰ напоминания и время начала задач\n• 🌅 08:00 — план на день\n• 🔥 20:00 — напоминание о серии\n• 🌙 21:30 — итоги дня\n\n/today — задачи на сегодня · /stop — пауза",
    badCode: "⚠️ Ссылка устарела. Нажмите «Подключить» в приложении ещё раз.",
    resumed: "🔔 Напоминания включены. /today — задачи, /stop — пауза.",
    stopped: "🔕 Напоминания приостановлены. Отправьте /start, чтобы включить.",
    notLinked: "ℹ️ Аккаунт ещё не подключён. В приложении: <b>Профиль → Настройки → ✈️ Telegram → Подключить</b>.",
    help: "🤖 <b>Команды</b>\n/today — задачи на сегодня\n/stop — пауза\n/start — включить",
    today: "📋 <b>Задачи на сегодня</b>", none: "Сегодня задач нет 🎉", test: "✅ Тестовое сообщение: напоминания в Telegram работают!",
  },
};
const langOf = (l: unknown) => { const s = String(l || "").slice(0, 2); return s === "ru" || s === "en" ? s : "uz"; };

function local(tz: string) {
  let z = tz || "Asia/Tashkent";
  try { new Intl.DateTimeFormat("en-US", { timeZone: z }); } catch { z = "Asia/Tashkent"; }
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: z, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${p.year}-${p.month}-${p.day}`, dow: dows[p.weekday as string] ?? 0 };
}
function dueToday(t: any, date: string, dow: number) {
  if (!t || t.isFrozen) return false;
  if (t.postponedTo && t.postponedTo > date) return false;
  switch (t.repeat) {
    case "daily": return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "custom-days": case "weekly": return Array.isArray(t.days) && t.days.includes(dow);
    case "interval": return t.nextDate ? t.nextDate <= date : true;
    case "once": return !t.done || t.doneDate === date;
    default: return true;
  }
}
const doneToday = (t: any, date: string) => t.repeat === "once" ? !!t.done : t.doneDate === date;

async function todayText(sb: any, userId: string, tz: string, lang: string) {
  const L = local(tz), tx = T[lang];
  const { data } = await sb.from("todos").select("task_data").eq("user_id", userId);
  const tasks = (data || []).map((r: any) => r.task_data).filter((t: any) => dueToday(t, L.date, L.dow));
  if (!tasks.length) return `${tx.today}\n\n${tx.none}`;
  tasks.sort((a: any, b: any) => String(a.startTime || "99").localeCompare(String(b.startTime || "99")));
  const done = tasks.filter((t: any) => doneToday(t, L.date)).length;
  const lines = tasks.slice(0, 25).map((t: any) => `${doneToday(t, L.date) ? "✅" : "▫️"} ${t.startTime ? `<code>${esc(t.startTime)}</code> ` : ""}${t.emoji ? esc(t.emoji) + " " : ""}${esc(t.name)}`);
  return `${tx.today} · ${done}/${tasks.length}\n\n${lines.join("\n")}${tasks.length > 25 ? "\n…" : ""}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" || !BOT_TOKEN) return new Response("forbidden", { status: 403 });
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // --- Ilovadan: sinov xabari (foydalanuvchi sessiyasi bilan) ---
  if (!req.headers.get("x-telegram-bot-api-secret-token")) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return Response.json({ error: "auth" }, { status: 401, headers: CORS });
    const body = await req.json().catch(() => ({}));
    const { data: link } = await sb.from("telegram_links").select("chat_id,lang").eq("user_id", u.user.id).maybeSingle();
    if (!link) return Response.json({ error: "not_linked" }, { status: 404, headers: CORS });
    if (body.action === "test") {
      const r = await send(link.chat_id, T[langOf(link.lang)].test, langOf(link.lang));
      return Response.json({ ok: !!r.ok }, { headers: CORS });
    }
    return Response.json({ error: "unknown_action" }, { status: 400, headers: CORS });
  }

  // --- Telegram webhook ---
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret()) return new Response("forbidden", { status: 403 });
  const upd = await req.json().catch(() => null);
  const msg = upd?.message;
  if (!msg?.text || msg.chat?.type !== "private") return new Response("ok");
  const chat = Number(msg.chat.id), lang = langOf(msg.from?.language_code), tx = T[lang];
  const [cmdRaw, ...rest] = String(msg.text).trim().split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase(), arg = rest.join(" ");
  const { data: link } = await sb.from("telegram_links").select("user_id,enabled,tz,lang").eq("chat_id", chat).maybeSingle();

  if (cmd === "/start" && /^[0-9a-f]{32}$/.test(arg)) {
    const { data: code } = await sb.from("telegram_link_codes").select("user_id,created_at").eq("code", arg).maybeSingle();
    if (!code || Date.now() - Date.parse(code.created_at) > 30 * 60 * 1000) { await send(chat, tx.badCode, lang); return new Response("ok"); }
    // Bu chat boshqa akkauntga ulangan bo'lsa — o'sha bog'lanish uziladi
    await sb.from("telegram_links").delete().eq("chat_id", chat).neq("user_id", code.user_id);
    await sb.from("telegram_links").upsert({ user_id: code.user_id, chat_id: chat, username: msg.from?.username || null, enabled: true, lang, linked_at: new Date().toISOString() }, { onConflict: "user_id" });
    await sb.from("telegram_link_codes").delete().eq("code", arg);
    await send(chat, tx.linked, lang);
    return new Response("ok");
  }
  if (cmd === "/start") {
    if (link) { await sb.from("telegram_links").update({ enabled: true }).eq("chat_id", chat); await send(chat, tx.resumed, lang); }
    else await send(chat, tx.welcome, lang);
    return new Response("ok");
  }
  if (!link) { await send(chat, tx.notLinked, lang); return new Response("ok"); }
  const ul = langOf(link.lang || lang);
  if (cmd === "/today") await send(chat, await todayText(sb, link.user_id, link.tz, ul), ul);
  else if (cmd === "/stop") { await sb.from("telegram_links").update({ enabled: false }).eq("chat_id", chat); await send(chat, T[ul].stopped, ul); }
  else await send(chat, T[ul].help, ul);
  return new Response("ok");
});
