// 🤖 telegram-bot — @LevelUpDayLoginBot webhook'i.
//  • /start <kod>  — ilovadagi "Telegram'ga ulash" tugmasidan kelgan bir martalik kod bilan akkauntni bog'laydi
//  • /start        — ulangan bo'lsa eslatmalarni qayta yoqadi, aks holda qanday ulashni tushuntiradi
//  • /today        — bugungi vazifalar (✅ tugmalari bilan)
//  • /add <matn>   — Inbox'ga tez vazifa (ilova ochilganda qo'shiladi)
//  • /stats /week /goals /pomo — statistika, haftalik hisobot, odatlar, Pomodoro holati
//  • /settings     — qaysi xabarlar kelishini tugmalar bilan sozlash
//  • /music       — ambient tovushlar (tanlab eshitish; file_id telegram_state'da keshlanadi)
//  • /stop /unlink /help
//  • Tugmalar (callback): d:<id> bajarildi, z:<id>:<daq> keyinroq eslatish, p:<kalit> sozlama
// Bajarildi/qo'shish amallari tg_actions navbatiga yoziladi — ilova keyingi ochilishda qo'llaydi (mukofot bilan).
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
    help: "🤖 <b>Buyruqlar</b>\n/today — bugungi vazifalar\n/add <i>matn</i> — Inbox'ga vazifa\n/stats — statistika\n/week — haftalik hisobot\n/goals — bugungi odatlar\n/pomo — Pomodoro holati\n/music — ambient tovushlar\n/settings — xabarlar sozlamasi\n/stop — to'xtatish · /start — yoqish\n/unlink — akkauntni uzish",
    added: "📥 Inbox'ga qo'shildi: <b>{t}</b>\nIlova ochilganda paydo bo'ladi.", addUsage: "✍️ Masalan: <code>/add Kitob o'qish 20 daqiqa</code>",
    doneOk: "✅ Bajarildi! Mukofot ilova ochilganda beriladi.", snoozed: "⏰ {m} daqiqadan keyin yana eslataman",
    stats: "📊 <b>Statistika</b>", lvl: "Daraja", streak: "Streak", best: "Eng uzun", coins: "Tanga", gems: "Olmos", tasksDone: "Bajarilgan vazifalar",
    week: "📅 <b>Haftalik hisobot</b>", focus: "Fokus (Pomodoro)", days: "kun", goals: "🎯 <b>Bugungi odatlar</b>", noGoals: "Bugun odat yo'q",
    pomoOn: "🍅 <b>{a}</b> — {p}, {m} daqiqa qoldi", pomoOff: "🍅 Hozir Pomodoro ishlamayapti", work: "ish", brk: "tanaffus",
    settings: "⚙️ <b>Qaysi xabarlar kelsin?</b>\nBosib yoqing/o'chiring:", unlinked: "👋 Akkaunt uzildi. Qayta ulash uchun ilovadan «Ulash» ni bosing.", today2: "Bajarganingizni pastdagi tugma bilan belgilang:",
    today: "📋 <b>Bugungi vazifalar</b>", none: "Bugun vazifa yo'q 🎉", test: "✅ Sinov xabari: Telegram eslatmalari ishlayapti!",
  },
  en: {
    welcome: "👋 Welcome to <b>LevelUpDay</b>!\n\nTo get reminders here, open the app: <b>Profile → Settings → ✈️ Telegram</b> and tap <b>“Connect”</b>.",
    linked: "✅ <b>Connected!</b> You'll get here:\n• ⏰ task reminders and start times\n• 🌅 08:00 — today's plan\n• 🔥 20:00 — streak reminder\n• 🌙 21:30 — day summary\n\n/today — today's tasks · /stop — pause",
    badCode: "⚠️ This link has expired. Tap “Connect” in the app again.",
    resumed: "🔔 Reminders are on. /today — today's tasks, /stop — pause.",
    stopped: "🔕 Reminders paused. Send /start to turn them back on.",
    notLinked: "ℹ️ Your account isn't connected yet. In the app: <b>Profile → Settings → ✈️ Telegram → Connect</b>.",
    help: "🤖 <b>Commands</b>\n/today — today's tasks\n/add <i>text</i> — add to Inbox\n/stats — stats\n/week — weekly report\n/goals — today's habits\n/pomo — Pomodoro status\n/music — ambient sounds\n/settings — notification settings\n/stop — pause · /start — resume\n/unlink — disconnect",
    added: "📥 Added to Inbox: <b>{t}</b>\nIt will appear when you open the app.", addUsage: "✍️ Example: <code>/add Read 20 minutes</code>",
    doneOk: "✅ Done! Your reward is added when you open the app.", snoozed: "⏰ I'll remind you again in {m} min",
    stats: "📊 <b>Stats</b>", lvl: "Level", streak: "Streak", best: "Best", coins: "Coins", gems: "Gems", tasksDone: "Tasks done",
    week: "📅 <b>Weekly report</b>", focus: "Focus (Pomodoro)", days: "days", goals: "🎯 <b>Today's habits</b>", noGoals: "No habits today",
    pomoOn: "🍅 <b>{a}</b> — {p}, {m} min left", pomoOff: "🍅 Pomodoro isn't running", work: "work", brk: "break",
    settings: "⚙️ <b>Which messages to send?</b>\nTap to toggle:", unlinked: "👋 Disconnected. Tap “Connect” in the app to link again.", today2: "Mark what you've done with the buttons below:",
    today: "📋 <b>Today's tasks</b>", none: "No tasks today 🎉", test: "✅ Test message: Telegram reminders are working!",
  },
  ru: {
    welcome: "👋 Добро пожаловать в <b>LevelUpDay</b>!\n\nЧтобы получать напоминания здесь, в приложении откройте <b>Профиль → Настройки → ✈️ Telegram</b> и нажмите <b>«Подключить»</b>.",
    linked: "✅ <b>Подключено!</b> Сюда будут приходить:\n• ⏰ напоминания и время начала задач\n• 🌅 08:00 — план на день\n• 🔥 20:00 — напоминание о серии\n• 🌙 21:30 — итоги дня\n\n/today — задачи на сегодня · /stop — пауза",
    badCode: "⚠️ Ссылка устарела. Нажмите «Подключить» в приложении ещё раз.",
    resumed: "🔔 Напоминания включены. /today — задачи, /stop — пауза.",
    stopped: "🔕 Напоминания приостановлены. Отправьте /start, чтобы включить.",
    notLinked: "ℹ️ Аккаунт ещё не подключён. В приложении: <b>Профиль → Настройки → ✈️ Telegram → Подключить</b>.",
    help: "🤖 <b>Команды</b>\n/today — задачи на сегодня\n/add <i>текст</i> — во «Входящие»\n/stats — статистика\n/week — отчёт за неделю\n/goals — привычки на сегодня\n/pomo — статус помодоро\n/music — фоновые звуки\n/settings — настройки уведомлений\n/stop — пауза · /start — включить\n/unlink — отключить",
    added: "📥 Добавлено во «Входящие»: <b>{t}</b>\nПоявится при открытии приложения.", addUsage: "✍️ Пример: <code>/add Читать 20 минут</code>",
    doneOk: "✅ Готово! Награда начислится при открытии приложения.", snoozed: "⏰ Напомню через {m} мин",
    stats: "📊 <b>Статистика</b>", lvl: "Уровень", streak: "Серия", best: "Лучшая", coins: "Монеты", gems: "Алмазы", tasksDone: "Выполнено задач",
    week: "📅 <b>Отчёт за неделю</b>", focus: "Фокус (помодоро)", days: "дн.", goals: "🎯 <b>Привычки на сегодня</b>", noGoals: "Сегодня привычек нет",
    pomoOn: "🍅 <b>{a}</b> — {p}, осталось {m} мин", pomoOff: "🍅 Помодоро сейчас не идёт", work: "работа", brk: "перерыв",
    settings: "⚙️ <b>Какие сообщения присылать?</b>\nНажмите, чтобы переключить:", unlinked: "👋 Отключено. Нажмите «Подключить» в приложении, чтобы связать снова.", today2: "Отметьте выполненное кнопками ниже:",
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

const fill = (t: string, o: Record<string, unknown>) => t.replace(/\{(\w+)\}/g, (_, k) => String(o[k] ?? ""));
function send2(chat: number, text: string, kb: unknown) { return tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
const short = (s: unknown, n = 28) => { const x = String(s ?? ""); return x.length > n ? x.slice(0, n - 1) + "…" : x; };

async function pendingDone(sb: any, userId: string) {
  const { data } = await sb.from("tg_actions").select("task_id").eq("user_id", userId).eq("kind", "done").is("applied_at", null);
  return new Set<number>((data || []).map((r: any) => Number(r.task_id)));
}
async function todayData(sb: any, userId: string, tz: string) {
  const L = local(tz);
  const [{ data }, pd] = await Promise.all([sb.from("todos").select("task_data").eq("user_id", userId), pendingDone(sb, userId)]);
  const tasks = (data || []).map((r: any) => r.task_data).filter((t: any) => dueToday(t, L.date, L.dow));
  tasks.sort((a: any, b: any) => String(a.startTime || "99").localeCompare(String(b.startTime || "99")));
  const isDone = (t: any) => doneToday(t, L.date) || pd.has(Number(t.id));
  return { tasks, isDone };
}
async function todayMsg(sb: any, userId: string, tz: string, lang: string) {
  const tx = T[lang], { tasks, isDone } = await todayData(sb, userId, tz);
  if (!tasks.length) return { text: `${tx.today}\n\n${tx.none}`, kb: openBtn(lang) };
  const done = tasks.filter(isDone).length;
  const lines = tasks.slice(0, 25).map((t: any) => `${isDone(t) ? "✅" : "▫️"} ${t.startTime ? `<code>${esc(t.startTime)}</code> ` : ""}${t.emoji ? esc(t.emoji) + " " : ""}${esc(t.name)}`);
  const open = tasks.filter((t: any) => !isDone(t)).slice(0, 8);
  const kb = { inline_keyboard: [...open.map((t: any) => [{ text: "✅ " + short((t.emoji ? t.emoji + " " : "") + t.name), callback_data: "d:" + t.id }]), ...openBtn(lang).inline_keyboard] };
  return { text: `${tx.today} · ${done}/${tasks.length}\n\n${lines.join("\n")}${tasks.length > 25 ? "\n…" : ""}${open.length ? "\n\n" + tx.today2 : ""}`, kb };
}
async function statsText(sb: any, userId: string, lang: string) {
  const tx = T[lang];
  const { data: p } = await sb.from("profiles").select("level,xp,streak,best_streak,coins,gems,tasks_completed").eq("id", userId).maybeSingle();
  if (!p) return tx.stats + "\n—";
  return `${tx.stats}\n\n⭐ ${tx.lvl}: <b>${p.level || 1}</b> (${p.xp || 0} XP)\n🔥 ${tx.streak}: <b>${p.streak || 0}</b> · ${tx.best}: ${p.best_streak || 0}\n🪙 ${tx.coins}: <b>${p.coins || 0}</b> · 💎 ${tx.gems}: ${p.gems || 0}\n✅ ${tx.tasksDone}: <b>${p.tasks_completed || 0}</b>`;
}
async function weekText(sb: any, userId: string, lang: string) {
  const tx = T[lang], since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: logs }, { data: p }] = await Promise.all([
    sb.from("pomo_log").select("duration_ms,start_at").eq("user_id", userId).gte("start_at", since).limit(2000),
    sb.from("profiles").select("streak,tasks_completed,coins").eq("id", userId).maybeSingle()]);
  const mins = Math.round((logs || []).reduce((a: number, r: any) => a + (Number(r.duration_ms) || 0), 0) / 60000);
  const days = new Set((logs || []).map((r: any) => String(r.start_at).slice(0, 10))).size;
  const hm = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return `${tx.week}\n\n🍅 ${tx.focus}: <b>${hm}</b> · ${days}/7 ${tx.days}\n🔥 ${tx.streak}: <b>${p?.streak || 0}</b>\n✅ ${tx.tasksDone}: ${p?.tasks_completed || 0}\n🪙 ${tx.coins}: ${p?.coins || 0}`;
}
async function goalsText(sb: any, userId: string, tz: string, lang: string) {
  const tx = T[lang], L = local(tz);
  const { data } = await sb.from("app_state").select("goals:data->goals").eq("user_id", userId).maybeSingle();
  const gs = (Array.isArray(data?.goals) ? data.goals : []).filter((g: any) => g && !g.done && !g.archived);
  if (!gs.length) return `${tx.goals}\n\n${tx.noGoals}`;
  return `${tx.goals}\n\n` + gs.slice(0, 20).map((g: any) => `${g.daysChecked && g.daysChecked[L.date] ? "✅" : "▫️"} ${g.emoji ? esc(g.emoji) + " " : "🎯 "}${esc(g.name)}`).join("\n");
}
async function pomoText(sb: any, userId: string, lang: string) {
  const tx = T[lang];
  const { data } = await sb.from("pomo_now").select("act,phase,fire_at").eq("user_id", userId).maybeSingle();
  if (!data || Date.parse(data.fire_at) < Date.now()) return tx.pomoOff;
  return fill(tx.pomoOn, { a: esc(data.act || "Pomodoro"), p: data.phase === "break" ? tx.brk : tx.work, m: Math.max(1, Math.round((Date.parse(data.fire_at) - Date.now()) / 60000)) });
}
const PREFS: [string, Record<string, string>][] = [
  ["tasks", { uz: "⏰ Vazifa eslatmalari", en: "⏰ Task reminders", ru: "⏰ Напоминания" }],
  ["start", { uz: "▶️ Boshlanish vaqti", en: "▶️ Start time", ru: "▶️ Время начала" }],
  ["morning", { uz: "🌅 Ertalabki reja", en: "🌅 Morning plan", ru: "🌅 Утренний план" }],
  ["streak", { uz: "🔥 Streak eslatmasi", en: "🔥 Streak reminder", ru: "🔥 Серия" }],
  ["evening", { uz: "🌙 Kun yakuni", en: "🌙 Day summary", ru: "🌙 Итоги дня" }],
  ["weekly", { uz: "📅 Haftalik hisobot", en: "📅 Weekly report", ru: "📅 Отчёт за неделю" }],
  ["social", { uz: "👥 Do'stlar va challenge", en: "👥 Friends & challenges", ru: "👥 Друзья и вызовы" }],
  ["pomo", { uz: "🍅 Pomodoro", en: "🍅 Pomodoro", ru: "🍅 Помодоро" }],
  ["fg", { uz: "🛡 Focusgate", en: "🛡 Focusgate", ru: "🛡 Focusgate" }],
];
// 🎧 Ambient tovushlar (ilovadagi FOCUS_SOUNDS bilan bir xil; 10 daqiqalik versiyalar — telegram-bot-assets/sounds)
const SOUNDS: [string, string, Record<string, string>][] = [
  ["rain", "🌧️", { uz: "Yengil yomg'ir", en: "Light Rain", ru: "Лёгкий дождь" }],
  ["storm", "⛈️", { uz: "Momaqaldiroq", en: "Thunderstorm", ru: "Гроза" }],
  ["window", "🪟", { uz: "Derazadagi yomg'ir", en: "Rain on the Window", ru: "Дождь за окном" }],
  ["ocean", "🌊", { uz: "Dengiz to'lqinlari", en: "Ocean Waves", ru: "Морские волны" }],
  ["river", "🏞️", { uz: "Tog' daryosi", en: "Mountain River", ru: "Горная река" }],
  ["fire", "🔥", { uz: "Gulxan", en: "Campfire", ru: "Костёр" }],
  ["forest", "🐦", { uz: "O'rmon qushlari", en: "Forest & Birds", ru: "Лес и птицы" }],
  ["wind", "🍃", { uz: "Daraxtlardagi shamol", en: "Wind in the Trees", ru: "Ветер в деревьях" }],
  ["night", "🌙", { uz: "Yozgi tun", en: "Summer Night", ru: "Летняя ночь" }],
  ["cafe", "☕", { uz: "Shinam kafe", en: "Cozy Café", ru: "Уютное кафе" }],
  ["library", "📚", { uz: "Kutubxona", en: "Library", ru: "Библиотека" }],
  ["train", "🚆", { uz: "Poyezdda", en: "On a Train", ru: "В поезде" }],
  ["space", "🌌", { uz: "Kosmos", en: "Deep Space", ru: "Космос" }],
  ["bowl", "🎐", { uz: "Meditatsiya qo'ng'irog'i", en: "Singing Bowl", ru: "Поющая чаша" }],
  ["brown", "🟤", { uz: "Jigarrang shovqin", en: "Brown Noise", ru: "Коричневый шум" }],
];
const MUSIC_T: Record<string, string> = {
  uz: "🎧 <b>Ambient tovushlar</b>\nFokus va dam olish uchun fon tovushini tanlang (har biri 10 daqiqa — pleyerda 🔁 takrorlashni yoqing):",
  en: "🎧 <b>Ambient sounds</b>\nPick a background sound for focus or rest (10 min each — turn on 🔁 repeat in the player):",
  ru: "🎧 <b>Фоновые звуки</b>\nВыберите звук для фокуса или отдыха (по 10 минут — включите 🔁 повтор в плеере):",
};
const musicKb = (lang: string) => {
  const rows: unknown[][] = [];
  SOUNDS.forEach(([k, ic, n], i) => { if (i % 3 === 0) rows.push([]); rows[rows.length - 1].push({ text: `${ic} ${n[lang] || n.uz}`, callback_data: "m:" + k }); });
  return { inline_keyboard: rows };
};
async function sendSound(sb: any, chat: number, key: string, lang: string) {
  const snd = SOUNDS.find(([k]) => k === key); if (!snd) return false;
  const name = snd[2][lang] || snd[2].uz, cap = `${snd[1]} ${name}`;
  const { data: st } = await sb.from("telegram_state").select("v").eq("k", "snd:" + key).maybeSingle();
  const body: Record<string, unknown> = { chat_id: chat, caption: cap, title: name, performer: "LevelUpDay", reply_markup: { inline_keyboard: [[{ text: "🎧 " + (lang === "ru" ? "Другие звуки" : lang === "en" ? "More sounds" : "Boshqa tovushlar"), callback_data: "mm" }]] } };
  let r = st?.v ? await tg("sendAudio", { ...body, audio: st.v }) : { ok: false };
  if (!r.ok) {
    r = await tg("sendAudio", { ...body, audio: `${APP_URL}telegram-bot-assets/sounds/${key}.mp3` });
    const fid = r?.result?.audio?.file_id;
    if (fid) await sb.from("telegram_state").upsert({ k: "snd:" + key, v: fid, updated_at: new Date().toISOString() });
  }
  return !!r.ok;
}
// Buyruqlar menyusi (yangi buyruq qo'shilganda CMD_VER oshiriladi)
const CMD_VER = "v3";
async function ensureCommands(sb: any) {
  const { data: st } = await sb.from("telegram_state").select("v").eq("k", "cmds").maybeSingle();
  if (st?.v === CMD_VER) return;
  const sets: Record<string, string[][]> = {
    "": [["today", "Bugungi vazifalar"], ["add", "Inbox'ga vazifa qo'shish"], ["music", "Ambient tovushlar"], ["stats", "Statistika"], ["week", "Haftalik hisobot"], ["goals", "Bugungi odatlar"], ["pomo", "Pomodoro holati"], ["settings", "Xabarlar sozlamasi"], ["stop", "Eslatmalarni to'xtatish"], ["start", "Eslatmalarni yoqish"], ["help", "Yordam"]],
    en: [["today", "Today's tasks"], ["add", "Add to Inbox"], ["music", "Ambient sounds"], ["stats", "Stats"], ["week", "Weekly report"], ["goals", "Today's habits"], ["pomo", "Pomodoro status"], ["settings", "Notification settings"], ["stop", "Pause reminders"], ["start", "Resume reminders"], ["help", "Help"]],
    ru: [["today", "Задачи на сегодня"], ["add", "Добавить во «Входящие»"], ["music", "Фоновые звуки"], ["stats", "Статистика"], ["week", "Отчёт за неделю"], ["goals", "Привычки"], ["pomo", "Статус помодоро"], ["settings", "Настройки"], ["stop", "Пауза"], ["start", "Включить напоминания"], ["help", "Помощь"]],
  };
  for (const [lc, cmds] of Object.entries(sets)) await tg("setMyCommands", { commands: cmds.map(([command, description]) => ({ command, description })), ...(lc ? { language_code: lc } : {}) });
  await sb.from("telegram_state").upsert({ k: "cmds", v: CMD_VER, updated_at: new Date().toISOString() });
}
const prefsKb = (pf: Record<string, boolean>, lang: string) => ({ inline_keyboard: PREFS.map(([k, n]) => [{ text: (pf[k] !== false ? "✅ " : "⬜ ") + (n[lang] || n.uz), callback_data: "p:" + k }]) });

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
    const { data: link } = await sb.from("telegram_links").select("chat_id,lang,tz").eq("user_id", u.user.id).maybeSingle();
    if (!link) return Response.json({ error: "not_linked" }, { status: 404, headers: CORS });
    const lg = langOf(link.lang);
    if (body.action === "test") {
      const r = await send(link.chat_id, T[lg].test, lg);
      return Response.json({ ok: !!r.ok }, { headers: CORS });
    }
    if (body.action === "today") {
      const m = await todayMsg(sb, u.user.id, link.tz, lg);
      const r = await send2(link.chat_id, m.text, m.kb);
      return Response.json({ ok: !!r.ok }, { headers: CORS });
    }
    return Response.json({ error: "unknown_action" }, { status: 400, headers: CORS });
  }

  // --- Telegram webhook ---
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret()) return new Response("forbidden", { status: 403 });
  const upd = await req.json().catch(() => null);
  await ensureCommands(sb);

  // 🔘 Tugmalar
  const cq = upd?.callback_query;
  if (cq?.data && cq.message?.chat?.id) {
    const chat = Number(cq.message.chat.id);
    const { data: link } = await sb.from("telegram_links").select("user_id,prefs,lang,tz").eq("chat_id", chat).maybeSingle();
    const lg = langOf(link?.lang || cq.from?.language_code), tx = T[lg];
    const [k, a, b] = String(cq.data).split(":");
    if (k === "m" || k === "mm") {
      await tg("answerCallbackQuery", { callback_query_id: cq.id, text: k === "m" ? "🎧 …" : undefined });
      if (k === "m") await sendSound(sb, chat, a, lg); else await send2(chat, MUSIC_T[lg], musicKb(lg));
      return new Response("ok");
    }
    if (!link) { await tg("answerCallbackQuery", { callback_query_id: cq.id, text: "ℹ️", show_alert: false }); return new Response("ok"); }
    if (k === "d" && /^\d+$/.test(a)) {
      const { data: ex } = await sb.from("tg_actions").select("id").eq("user_id", link.user_id).eq("kind", "done").eq("task_id", Number(a)).is("applied_at", null).limit(1);
      if (!ex?.length) await sb.from("tg_actions").insert({ user_id: link.user_id, kind: "done", task_id: Number(a), payload: { day: local(link.tz).date } });
      await sb.from("tg_snooze").update({ sent_at: new Date().toISOString() }).eq("user_id", link.user_id).eq("task_id", Number(a));
      await tg("answerCallbackQuery", { callback_query_id: cq.id, text: tx.doneOk });
      // /today ro'yxati bo'lsa — yangilaymiz, aks holda tugmalarni olib tashlaymiz
      if (String(cq.message.text || "").startsWith(tx.today.replace(/<[^>]+>/g, ""))) {
        const m = await todayMsg(sb, link.user_id, link.tz, lg);
        await tg("editMessageText", { chat_id: chat, message_id: cq.message.message_id, text: m.text, parse_mode: "HTML", reply_markup: m.kb });
      } else await tg("editMessageReplyMarkup", { chat_id: chat, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [[{ text: "✅", callback_data: "x" }]] } });
    } else if (k === "z" && /^\d+$/.test(a)) {
      const m = Math.max(5, Math.min(240, Number(b) || 15));
      await sb.from("tg_snooze").upsert({ user_id: link.user_id, task_id: Number(a), fire_at: new Date(Date.now() + m * 60000).toISOString(), sent_at: null });
      await tg("answerCallbackQuery", { callback_query_id: cq.id, text: fill(tx.snoozed, { m }) });
      await tg("editMessageReplyMarkup", { chat_id: chat, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [[{ text: "⏰ " + m + "′", callback_data: "x" }]] } });
    } else if (k === "p" && PREFS.some(([x]) => x === a)) {
      const pf = { ...(link.prefs || {}) }; pf[a] = pf[a] === false;
      await sb.from("telegram_links").update({ prefs: pf }).eq("chat_id", chat);
      await tg("answerCallbackQuery", { callback_query_id: cq.id, text: pf[a] ? "✅" : "⬜" });
      await tg("editMessageReplyMarkup", { chat_id: chat, message_id: cq.message.message_id, reply_markup: prefsKb(pf, lg) });
    } else await tg("answerCallbackQuery", { callback_query_id: cq.id });
    return new Response("ok");
  }

  const msg = upd?.message;
  if (!msg?.text || msg.chat?.type !== "private") return new Response("ok");
  const chat = Number(msg.chat.id), lang = langOf(msg.from?.language_code), tx = T[lang];
  const txt = String(msg.text).trim();
  const [cmdRaw, ...rest] = txt.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase(), arg = rest.join(" ");
  const { data: link } = await sb.from("telegram_links").select("user_id,enabled,tz,lang,prefs").eq("chat_id", chat).maybeSingle();

  if (cmd === "/start" && /^[0-9a-f]{32}$/.test(arg)) {
    const { data: code } = await sb.from("telegram_link_codes").select("user_id,created_at").eq("code", arg).maybeSingle();
    if (!code || Date.now() - Date.parse(code.created_at) > 30 * 60 * 1000) { await send(chat, tx.badCode, lang); return new Response("ok"); }
    // Bu chat boshqa akkauntga ulangan bo'lsa — o'sha bog'lanish uziladi
    await sb.from("telegram_links").delete().eq("chat_id", chat).neq("user_id", code.user_id);
    await sb.from("telegram_links").upsert({ user_id: code.user_id, chat_id: chat, username: msg.from?.username || null, enabled: true, lang, linked_at: new Date().toISOString() }, { onConflict: "user_id" });
    await sb.from("telegram_link_codes").delete().eq("code", arg);
    await send(chat, tx.linked + "\n\n" + tx.help, lang);
    return new Response("ok");
  }
  if (cmd === "/start") {
    if (link) { await sb.from("telegram_links").update({ enabled: true }).eq("chat_id", chat); await send(chat, tx.resumed, lang); }
    else await send(chat, tx.welcome, lang);
    return new Response("ok");
  }
  if (cmd === "/music") { await send2(chat, MUSIC_T[link ? langOf(link.lang || lang) : lang], musicKb(link ? langOf(link.lang || lang) : lang)); return new Response("ok"); }
  if (!link) { await send(chat, tx.notLinked, lang); return new Response("ok"); }
  const ul = langOf(link.lang || lang), U = T[ul];
  // "/" siz oddiy matn — Inbox'ga qo'shish
  const addText = cmd === "/add" ? arg : (!txt.startsWith("/") ? txt : "");
  if (cmd === "/today") { const m = await todayMsg(sb, link.user_id, link.tz, ul); await send2(chat, m.text, m.kb); }
  else if (cmd === "/add" || !txt.startsWith("/")) {
    const name = addText.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!name) await send(chat, U.addUsage, ul);
    else { await sb.from("tg_actions").insert({ user_id: link.user_id, kind: "add", payload: { name } }); await send(chat, fill(U.added, { t: esc(name) }), ul); }
  }
  else if (cmd === "/stats") await send(chat, await statsText(sb, link.user_id, ul), ul);
  else if (cmd === "/week") await send(chat, await weekText(sb, link.user_id, ul), ul);
  else if (cmd === "/goals") await send(chat, await goalsText(sb, link.user_id, link.tz, ul), ul);
  else if (cmd === "/pomo") await send(chat, await pomoText(sb, link.user_id, ul), ul);
  else if (cmd === "/settings") await send2(chat, U.settings, prefsKb(link.prefs || {}, ul));
  else if (cmd === "/stop") { await sb.from("telegram_links").update({ enabled: false }).eq("chat_id", chat); await send(chat, U.stopped, ul); }
  else if (cmd === "/unlink") { await sb.from("telegram_links").delete().eq("chat_id", chat); await send(chat, U.unlinked, ul); }
  else await send(chat, U.help, ul);
  return new Response("ok");
});
