// 🛡 focusgate — Windows agent (Focusgate.exe), brauzer kengaytmasi va Android ilovasi ↔ LevelUpDay.
//  Ulash (device flow):
//   1) agent:  {action:'pair_start', name}        → {code}  (agent brauzerda levelupday.../#fgpair=CODE ni ochadi)
//   2) sayt:   {action:'pair_approve', code} + foydalanuvchi JWT → qurilma yaratiladi
//   3) agent:  {action:'pair_poll', code}         → {token} (bir martalik; keyin kod o'chiriladi)
//  Sinxronlash:
//      agent:  {action:'sync', token, version, usage:[{day, app, label, seconds, hours[24], opens?, open_hours?[24]}], apps?:[{exe, name, cat?, icon?}], events?:[{kind, app, label, reason, at}]}
//      kengaytma ham shu funksiyadan foydalanadi (qurilma nomi 'Chrome …'). Sayt bo'limlari: "site:youtube#shorts".
//              → {config, device, now}   (usage — shu qurilmaning kunlik umumiy qiymatlari, ustiga yoziladi)
//  Statistikani tozalash: {action:'reset_stats'} + foydalanuvchi JWT → fg_usage/fg_events/fg_sessions (faqat o'ziniki)
//      va config.statsResetAt — agent/kengaytma (reset_seen < statsResetAt) mahalliy hisobni ham nolga tushiradi.
//  Qurilma turi (fg_devices.kind): pc / ext / phone. Kengaytma kompyuterga bog'lanadi (parent_id): agent aytgan pc_id yoki bir xil tarmoq.
//  Yangi qurilma: {action:'notify_new_device', device_id} + foydalanuvchi JWT → account_devices.notified, Telegram xabari (prefs.newDevice).
//  Haftalik hisobot: {action:'weekly_report'} — faqat pg_cron (x-cron-secret), yakshanba kechqurun Telegram'ga.
// JWT tekshiruvi o'chirilgan: agent qurilma tokeni bilan, sayt esa foydalanuvchi JWT bilan tekshiriladi.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAIR_TTL_MS = 15 * 60 * 1000;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const APP_URL = "https://levelupday.github.io/LevelUpDay/focusgate";

// ---------- ✈️ Telegram: bloklash / ogohlantirish xabarlari ----------
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const TX: Record<string, Record<string, string>> = {
  uz: { head: "🛡 <b>Focusgate</b>", block: "yopildi", site: "sayt tabi yopildi", warn: "kunlik limitga 5 daqiqa qoldi", warnp: "kunlik limitning {p}% ishlatildi", daily: "bugungi limit tugadi", always: "doimiy bloklangan", schedule: "jadval bo'yicha bloklangan", focus: "fokus vaqtida", session: "seans vaqti tugadi", mode: "rejim bo'yicha bloklangan", allow: "fokusda faqat ruxsat etilganlar", mindful: "«kerak emas» deb yopdingiz 👏", break: "majburiy tanaffus", weekly: "haftalik limit tugadi", opens: "bugungi ochilishlar tugadi", total: "umumiy ekran vaqti limiti", keyword: "taqiqlangan so'z", adult: "kattalar kontenti", btn: "📊 Focusgate'ni ochish", more: "yana", off: "⚠️ <b>{d}</b> bilan aloqa uzildi — Focusgate yopilgan yoki kengaytma o'chirilgan bo'lishi mumkin." },
  en: { head: "🛡 <b>Focusgate</b>", block: "was closed", site: "tab was closed", warn: "5 minutes left of your daily limit", warnp: "{p}% of the daily limit used", daily: "daily limit reached", always: "always blocked", schedule: "blocked by schedule", focus: "during focus", session: "session time is up", mode: "blocked by a mode", allow: "only allowed apps during focus", mindful: "you chose not to open it 👏", break: "mandatory break", weekly: "weekly limit reached", opens: "today's opens used up", total: "total screen-time limit", keyword: "blocked keyword", adult: "adult content", btn: "📊 Open Focusgate", more: "more", off: "⚠️ Lost contact with <b>{d}</b> — Focusgate may have been closed or the extension turned off." },
  ru: { head: "🛡 <b>Focusgate</b>", block: "закрыто", site: "вкладка закрыта", warn: "до дневного лимита 5 минут", warnp: "использовано {p}% дневного лимита", daily: "дневной лимит исчерпан", always: "заблокировано навсегда", schedule: "заблокировано по расписанию", focus: "во время фокуса", session: "время сессии вышло", mode: "заблокировано режимом", allow: "в фокусе только разрешённые", mindful: "вы решили не открывать 👏", break: "обязательный перерыв", weekly: "недельный лимит исчерпан", opens: "открытия на сегодня закончились", total: "общий лимит экранного времени", keyword: "запрещённое слово", adult: "контент для взрослых", btn: "📊 Открыть Focusgate", more: "ещё", off: "⚠️ Связь с <b>{d}</b> потеряна — возможно, Focusgate закрыт или расширение выключено." },
};
// 🌙 Tungi jim rejim (conf.quiet {from,to}, conf.tzOff — brauzerdagi getTimezoneOffset daqiqalarda)
function quietNow(conf: any) {
  const q = conf && conf.quiet; if (!q || !q.from || !q.to || q.from === q.to) return false;
  const hm = (x: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(x || ""); return m ? +m[1] * 60 + +m[2] : 0; };
  const d = new Date(), n = (((d.getUTCHours() * 60 + d.getUTCMinutes() - (+conf.tzOff || 0)) % 1440) + 1440) % 1440, f = hm(q.from), t = hm(q.to);
  return f < t ? n >= f && n < t : n >= f || n < t;
}
async function tgNotify(sb: any, userId: string, events: { id: number; kind: string; app: string; label: string | null; reason: string | null }[], conf: any = {}) {
  if (!BOT_TOKEN || !events.length || quietNow(conf)) return;
  events = events.filter((e) => e.kind === "warn" ? conf.notifWarn !== false : conf.notifBlock !== false);
  if (!events.length) return;
  const { data: link } = await sb.from("telegram_links").select("chat_id,enabled,prefs,lang").eq("user_id", userId).maybeSingle();
  if (!link || !link.enabled || (link.prefs && link.prefs.fg === false)) return;
  // Bir dastur haqida 20 daqiqada ko'pi bilan bir marta
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { data: recent } = await sb.from("fg_events").select("app,kind").eq("user_id", userId).eq("notified", true).gte("at", since);
  const seen = new Set((recent || []).map((r: any) => r.kind + "|" + r.app));
  const send = events.filter((e) => { const k = e.kind + "|" + e.app; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!send.length) return;
  const lang = ["ru", "en"].includes(String(link.lang)) ? String(link.lang) : "uz", t = TX[lang];
  const line = (e: typeof send[0]) => {
    const name = esc(e.label || e.app.replace(/^site:/, "").replace(/\.exe$/, ""));
    if (e.kind === "warn") { const p = /^p(\d{1,2})$/.exec(e.reason || ""); return `⏳ <b>${name}</b> — ${p ? t.warnp.replace("{p}", p[1]) : t.warn}`; }
    return `⛔ <b>${name}</b> ${e.kind === "site_block" ? t.site : t.block}${e.reason && t[e.reason] ? " · " + t[e.reason] : ""}`;
  };
  const lines = send.slice(0, 6).map(line);
  if (send.length > 6) lines.push(`… ${t.more} ${send.length - 6}`);
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: link.chat_id, text: t.head + "\n" + lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: t.btn, url: APP_URL }]] } }),
  }).catch(() => null);
  if (r && r.status === 403) await sb.from("telegram_links").update({ enabled: false }).eq("user_id", userId);
  // Faqat yuborilgan bo'lsa "xabar berildi" deb belgilaymiz (aks holda keyingi sinxronda qayta urinadi)
  if (r && r.ok) await sb.from("fg_events").update({ notified: true }).in("id", send.map((e) => e.id));
}

// ---------- 📊 Haftalik hisobot (cron, yakshanba kechqurun) ----------
const WK: Record<string, Record<string, string>> = {
  uz: { head: "📊 <b>Focusgate · haftalik hisobot</b>", total: "Bu hafta ekran vaqti", less: "o'tgan haftadan kam", more: "o'tgan haftadan ko'p", same: "o'tgan hafta bilan bir xil", top: "Eng ko'p vaqt", h: "s", m: "daq", btn: "📊 Batafsil" },
  en: { head: "📊 <b>Focusgate · weekly report</b>", total: "Screen time this week", less: "less than last week", more: "more than last week", same: "same as last week", top: "Top apps", h: "h", m: "m", btn: "📊 Details" },
  ru: { head: "📊 <b>Focusgate · недельный отчёт</b>", total: "Экранное время за неделю", less: "меньше, чем на прошлой неделе", more: "больше, чем на прошлой неделе", same: "как на прошлой неделе", top: "Больше всего времени", h: "ч", m: "мин", btn: "📊 Подробнее" },
};
function fmtHM(sec: number, t: Record<string, string>) { const m = Math.round(sec / 60), h = Math.floor(m / 60); return h ? `${h} ${t.h} ${m % 60} ${t.m}` : `${m} ${t.m}`; }
async function weeklyReport(sb: any) {
  if (!BOT_TOKEN) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await sb.rpc("fg_weekly_summary", { p_today: today });
  if (error || !rows?.length) return 0;
  const ids = rows.map((r: any) => r.user_id);
  const { data: links } = await sb.from("telegram_links").select("user_id,chat_id,enabled,prefs,lang").in("user_id", ids).eq("enabled", true);
  let sent = 0;
  for (const l of links || []) {
    if (l.prefs && (l.prefs.fg === false || l.prefs.fgweekly === false)) continue;
    const r = rows.find((x: any) => x.user_id === l.user_id); if (!r) continue;
    const lang = ["ru", "en"].includes(String(l.lang)) ? String(l.lang) : "uz", t = WK[lang];
    const pct = r.prev_sec ? Math.round((r.this_sec - r.prev_sec) / r.prev_sec * 100) : 0;
    const cmp = !r.prev_sec ? "" : pct === 0 ? `\n➖ ${t.same}` : pct < 0 ? `\n📉 ${Math.abs(pct)}% ${t.less} 👏` : `\n📈 ${pct}% ${t.more}`;
    const top = (Array.isArray(r.top) ? r.top : []).map((a: any, i: number) => `${i + 1}. ${esc(String(a.label || a.app).replace(/^site:/, "").replace(/\.exe$/, ""))} — ${fmtHM(a.s, t)}`).join("\n");
    const text = `${t.head}\n\n⏱ ${t.total}: <b>${fmtHM(r.this_sec, t)}</b>${cmp}${top ? `\n\n🏆 ${t.top}:\n${top}` : ""}`;
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: l.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: t.btn, url: APP_URL }]] } }),
    }).catch(() => null);
    if (res && res.status === 403) await sb.from("telegram_links").update({ enabled: false }).eq("user_id", l.user_id);
    if (res && res.ok) sent++;
  }
  return sent;
}

// 🧮 overOf — haftalik limit (dushanbadan), bugungi ochilishlar soni, umumiy ekran vaqti: chegaradan oshganlar ro'yxati.
// Saytlar har kuni qurilmalar bo'yicha eng kattasi, dasturlar — yig'indi. Kategoriya: faqat cfg.cats dagi moslik.
async function overOf(sb: any, uid: string, conf: any, today: string) {
  const rules = (conf.rules || []).filter((r: any) => r && r.on && r.app && (r.kind === "weekly" || r.kind === "opens") && r.skip !== today && (+r.minutes || 0) > 0);
  const totalMin = +conf.totalMin || 0;
  if ((!rules.length && !totalMin) || !DAY_RE.test(today)) return [];
  const d = new Date(today + "T00:00:00Z"), wd = (d.getUTCDay() + 6) % 7, monday = new Date(d.getTime() - wd * 864e5).toISOString().slice(0, 10);
  const { data: rows } = await sb.from("fg_usage").select("day,app,seconds,opens").eq("user_id", uid).gte("day", monday).lte("day", today).not("app", "like", "%#%").limit(5000);
  const week: Record<string, number> = {}, dayS: Record<string, number> = {}, opens: Record<string, number> = {}, siteDay: Record<string, number> = {};
  for (const r of rows || []) {
    const s = r.seconds || 0;
    if (r.app.startsWith("site:")) { const k = r.day + "|" + r.app; siteDay[k] = Math.max(siteDay[k] || 0, s); }
    else { week[r.app] = (week[r.app] || 0) + s; if (r.day === today) dayS[r.app] = (dayS[r.app] || 0) + s; }
    if (r.day === today) opens[r.app] = (opens[r.app] || 0) + (r.opens || 0);
  }
  for (const k of Object.keys(siteDay)) { const [day, app] = [k.slice(0, 10), k.slice(11)]; week[app] = (week[app] || 0) + siteDay[k]; if (day === today) dayS[app] = (dayS[app] || 0) + siteDay[k]; }
  const cats = conf.cats || {};
  const sum = (m: Record<string, number>, app: string) => app.startsWith("cat:") ? Object.keys(m).filter((a) => cats[a] === app.slice(4)).reduce((n, a) => n + m[a], 0) : (m[app] || 0);
  const out: { app: string; reason: string; label: string }[] = [];
  for (const r of rules) {
    if (r.kind === "weekly" && sum(week, r.app) >= r.minutes * 60) out.push({ app: r.app, reason: "weekly", label: r.label || r.app });
    if (r.kind === "opens" && sum(opens, r.app) >= r.minutes) out.push({ app: r.app, reason: "opens", label: r.label || r.app });
  }
  if (totalMin > 0 && Object.values(dayS).reduce((n, v) => n + v, 0) >= totalMin * 60) {
    for (const c of ["social", "games", "fun"]) out.push({ app: "cat:" + c, reason: "total", label: "Total" });
  }
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
function randHex(n: number) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
function pairCode() {
  const AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O, 1/I yo'q
  const a = new Uint8Array(8); crypto.getRandomValues(a);
  const s = [...a].map((x) => AL[x % AL.length]).join("");
  return s.slice(0, 4) + "-" + s.slice(4);
}
const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Qurilma turi nomidan: "Chrome · Windows (kengaytma)" → ext, "Android …" → phone, qolgani → pc (Windows agenti)
const kindOf = (name: string, ver?: string | null) => /^ext-/.test(ver || "") || /\((kengaytma|extension|расширение)\)/i.test(name) ? "ext" : /^android-/.test(ver || "") || /android/i.test(name) ? "phone" : "pc";
const hours24 = (v: unknown, max: number) => Array.isArray(v) ? v.slice(0, 24).map((x: unknown) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)))) : [];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const action = String(body.action || "");

  // ---------- 1) Ulashni boshlash (agent) ----------
  if (action === "pair_start") {
    const name = String(body.name || "Windows PC").replace(/[\u0000-\u001f<>]/g, "").slice(0, 60);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null;
    // Eskirgan kodlarni tozalaymiz; bitta manzildan 10 daqiqada ko'pi bilan 10 ta kod
    await sb.from("fg_pair").delete().lt("created_at", new Date(Date.now() - PAIR_TTL_MS).toISOString());
    if (ip) {
      const { count } = await sb.from("fg_pair").select("code", { count: "exact", head: true }).eq("ip", ip).gte("created_at", new Date(Date.now() - 10 * 60000).toISOString());
      if ((count || 0) >= 10) return json({ error: "rate_limited" }, 429);
    }
    for (let i = 0; i < 4; i++) {
      const code = pairCode();
      const { error } = await sb.from("fg_pair").insert({ code, device_name: name, ip });
      if (!error) return json({ code, ttl: PAIR_TTL_MS / 1000 });
    }
    return json({ error: "pair_failed" }, 500);
  }

  // ---------- 2a) Ulash so'rovi haqida ma'lumot (sayt tasdiqlashdan oldin ko'rsatadi) ----------
  if (action === "pair_info") {
    const code = String(body.code || "").toUpperCase().trim();
    if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user?.id) return json({ error: "unauthorized" }, 401);
    const { data: p } = await sb.from("fg_pair").select("device_name,user_id,created_at").eq("code", code).maybeSingle();
    if (!p || Date.now() - new Date(p.created_at).getTime() > PAIR_TTL_MS) return json({ error: "expired" }, 410);
    if (p.user_id) return json({ error: "already_used" }, 409);
    return json({ name: p.device_name, kind: kindOf(String(p.device_name || "")), created_at: p.created_at, age_sec: Math.round((Date.now() - new Date(p.created_at).getTime()) / 1000) });
  }

  // ---------- 2) Ulashni tasdiqlash (sayt, foydalanuvchi JWT) ----------
  if (action === "pair_approve") {
    const code = String(body.code || "").toUpperCase().trim();
    if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: p } = await sb.from("fg_pair").select("code,device_name,user_id,created_at").eq("code", code).maybeSingle();
    if (!p || Date.now() - new Date(p.created_at).getTime() > PAIR_TTL_MS) return json({ error: "expired" }, 410);
    if (p.user_id) return json({ error: "already_used" }, 409);
    // Atomar "band qilish": ikki marta bosilsa ham bitta qurilma yaratiladi
    const { data: claimed } = await sb.from("fg_pair").update({ user_id: uid }).eq("code", code).is("user_id", null).select("code");
    if (!claimed || !claimed.length) return json({ error: "already_used" }, 409);
    const token = randHex(32);
    const kind = kindOf(String(p.device_name || ""));
    const { data: dev, error: de } = await sb.from("fg_devices")
      .insert({ user_id: uid, name: p.device_name, kind, token_hash: await sha256(token) }).select("id,name,kind").single();
    if (de || !dev) { await sb.from("fg_pair").update({ user_id: null }).eq("code", code); return json({ error: "device_failed" }, 500); }
    await sb.from("fg_pair").update({ token }).eq("code", code);
    // Shu kompyuter (shu Windows foydalanuvchisi) qayta ulandi — eski nusxasi ro'yxatda qolib ketmasin
    if (kind === "pc") {
      const { data: olds } = await sb.from("fg_devices").select("id").eq("user_id", uid).eq("kind", "pc").eq("name", p.device_name).neq("id", dev.id);
      const ids = (olds || []).map((o: any) => o.id);
      if (ids.length) {
        await sb.from("fg_devices").update({ parent_id: dev.id }).eq("user_id", uid).in("parent_id", ids); // kengaytmalar yangi nusxaga o'tadi
        await sb.from("fg_devices").delete().in("id", ids);
      }
    }
    return json({ ok: true, device: dev });
  }

  // ---------- 3) Token olish (agent kutib turadi) ----------
  if (action === "pair_poll") {
    const code = String(body.code || "").toUpperCase().trim();
    if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
    const { data: p } = await sb.from("fg_pair").select("token,created_at").eq("code", code).maybeSingle();
    if (!p || Date.now() - new Date(p.created_at).getTime() > PAIR_TTL_MS) return json({ error: "expired" }, 410);
    if (!p.token) return json({ pending: true });
    await sb.from("fg_pair").delete().eq("code", code);
    return json({ token: p.token });
  }

  // ---------- Sinxronlash (agent, qurilma tokeni) ----------
  if (action === "sync") {
    const token = String(body.token || "");
    if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "unauthorized" }, 401);
    const { data: dev } = await sb.from("fg_devices").select("id,user_id,name,label,kind,parent_id,link_src,created_at").eq("token_hash", await sha256(token)).maybeSingle();
    if (!dev) return json({ error: "unauthorized" }, 401);
    const kind = dev.kind || kindOf(String(dev.name || ""), body.version ? String(body.version) : null);
    // Tarmoq belgisi (IP o'zi saqlanmaydi): kengaytmani shu tarmoqdagi kompyuterga bog'lash uchun
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const ipHash = ip ? (await sha256(dev.user_id + "|" + ip)).slice(0, 24) : null;

    const now = Date.now();
    const { data: cfg } = await sb.from("fg_config").select("config,updated_at").eq("user_id", dev.user_id).maybeSingle();
    // Statistika tozalangan, lekin qurilma buni hali bilmaydi (reset_seen eski) — eski hisobni qayta yozmaymiz.
    // reset_seen yubormaydigan eski versiyalar odatdagidek ishlayveradi.
    const resetAt = Number(cfg?.config?.statsResetAt) || 0;
    const staleDevice = resetAt > 0 && typeof body.reset_seen === "number" && body.reset_seen < resetAt;
    const rows: Record<string, unknown>[] = [];
    const usage = Array.isArray(body.usage) && !staleDevice ? body.usage.slice(0, 400) : [];
    for (const r of usage) {
      const day = String(r?.day || "");
      if (!DAY_RE.test(day)) continue;
      const age = (now - new Date(day + "T00:00:00Z").getTime()) / 86400000;
      if (age > 4 || age < -2) continue; // faqat so'nggi kunlar (oflayn bo'lgan kunlar ham yetib kelsin)
      const app = String(r?.app || "").toLowerCase().slice(0, 120);
      if (!app) continue;
      const seconds = Math.max(0, Math.min(86400, Math.round(Number(r?.seconds) || 0)));
      // opens/open_hours har doim yoziladi (eski agentlarda 0) — upsert'da ustunlar bir xil bo'lsin
      const opens = Math.max(0, Math.min(5000, Math.round(Number(r?.opens) || 0)));
      rows.push({ user_id: dev.user_id, device_id: dev.id, day, app, label: r?.label ? String(r.label).slice(0, 80) : null, seconds, hours: hours24(r?.hours, 3600), opens, open_hours: hours24(r?.open_hours, 1000), updated_at: new Date().toISOString() });
    }
    if (rows.length) {
      const { error } = await sb.from("fg_usage").upsert(rows, { onConflict: "user_id,device_id,day,app" });
      if (error) return json({ error: "usage_failed", detail: error.message }, 500);
    }
    const upd: Record<string, unknown> = { last_seen: new Date().toISOString(), agent_version: body.version ? String(body.version).slice(0, 20) : null, kind, ip_hash: ipHash, offline_alert_at: null };
    if (typeof body.incognito === "boolean") upd.incognito = body.incognito;
    // 🧩 Kengaytma qaysi kompyuterda: 1) shu kompyuterdagi Focusgate agenti aytdi (pc_id), 2) bir xil tarmoq, faqat bitta kompyuter bo'lsa
    if (kind === "ext" && dev.link_src !== "manual" && dev.link_src !== "none") {
      let parent: string | null = null, src = "";
      const pcId = String(body.pc_id || "");
      if (/^[0-9a-f-]{36}$/i.test(pcId)) {
        const { data: pc } = await sb.from("fg_devices").select("id").eq("id", pcId).eq("user_id", dev.user_id).eq("kind", "pc").maybeSingle();
        if (pc) { parent = pc.id; src = "agent"; }
      }
      if (!parent && ipHash && dev.link_src !== "agent") {
        const { data: pcs } = await sb.from("fg_devices").select("id").eq("user_id", dev.user_id).eq("kind", "pc").eq("ip_hash", ipHash)
          .gte("last_seen", new Date(now - 15 * 60000).toISOString());
        if (pcs && pcs.length === 1) { parent = pcs[0].id; src = "ip"; }
      }
      if (parent && (parent !== dev.parent_id || src !== dev.link_src)) {
        upd.parent_id = parent; upd.link_src = src;
        // Shu kompyuterdagi shu brauzerning eski (qayta o'rnatilgan) nusxalari — o'chiriladi
        await sb.from("fg_devices").delete().eq("user_id", dev.user_id).eq("kind", "ext").eq("parent_id", parent).eq("name", dev.name)
          .neq("id", dev.id).lt("last_seen", dev.created_at);
      }
    }
    // Windows agenti nomi: "Windows · KOMPYUTER · foydalanuvchi" — bitta kompyuterdagi har bir Windows foydalanuvchisi alohida qurilma.
    // Faqat avtomatik qo'yilgan nomlar yangilanadi.
    if (typeof body.name === "string") {
      const nn = body.name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
      if (/^(Windows|Linux) · /.test(nn) && /^(Windows|Linux) · /.test(String(dev.name || "")) && nn !== dev.name) { upd.name = nn; dev.name = nn; }
    }
    // O'rnatilgan dasturlar ro'yxati (agent bir necha soatda bir yuboradi)
    if (Array.isArray(body.apps)) {
      const seen = new Set<string>();
      const apps: { exe: string; name: string; cat?: string; icon?: string }[] = [];
      const CATS = ["work", "study", "social", "games", "fun", "web", "other"];
      for (const a of body.apps.slice(0, 800)) {
        const exe = String(a?.exe || "").toLowerCase().replace(/^.*[\\/]/, "").slice(0, 80);
        // Windows: "discord.exe"; Android: paket nomi "com.instagram.android"
        if (!(/^[^<>:"|?*]+\.exe$/.test(exe) || /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(exe)) || seen.has(exe)) continue;
        seen.add(exe);
        const item: { exe: string; name: string; cat?: string; icon?: string } = { exe, name: String(a?.name || exe.replace(/\.exe$/, "")).replace(/[\u0000-\u001f]/g, "").slice(0, 70) };
        if (CATS.includes(String(a?.cat))) item.cat = String(a.cat);
        // Ikonka: faqat kichik PNG data URL (32×32)
        if (typeof a?.icon === "string" && a.icon.length <= 12000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.icon)) item.icon = a.icon;
        apps.push(item);
      }
      upd.apps = apps;
      upd.apps_at = new Date().toISOString();
    }
    await sb.from("fg_devices").update(upd).eq("id", dev.id);
    // 🛡 Hodisalar: dastur yopildi / sayt yopildi / ogohlantirish → jurnal + Telegram
    if (Array.isArray(body.events) && body.events.length && !staleDevice) {
      const evs = body.events.slice(0, 30).map((e: any) => ({
        user_id: dev.user_id, device_id: dev.id,
        kind: ["block", "site_block", "warn"].includes(String(e?.kind)) ? String(e.kind) : "block",
        app: String(e?.app || "").toLowerCase().slice(0, 120), label: e?.label ? String(e.label).slice(0, 80) : null,
        reason: e?.reason ? String(e.reason).slice(0, 20) : null,
        at: Number.isFinite(Number(e?.at)) && Math.abs(now - Number(e.at)) < 3 * 86400000 ? new Date(Number(e.at)).toISOString() : new Date().toISOString(),
      })).filter((e: any) => e.app);
      if (evs.length) {
        const { data: ins } = await sb.from("fg_events").insert(evs).select("id,kind,app,label,reason");
        try { await tgNotify(sb, dev.user_id, ins || [], cfg?.config || {}); } catch (_) { /* Telegram xatosi sinxronlashni to'xtatmasin */ }
      }
    }
    // Bugun saytlarda o'tgan vaqt — barcha qurilmalar bo'yicha eng kattasi (kengaytma limitni to'g'ri hisoblashi uchun)
    let site_usage: Record<string, number> | undefined;
    if (DAY_RE.test(String(body.today || ""))) {
      const { data: su } = await sb.from("fg_usage").select("app,seconds").eq("user_id", dev.user_id).eq("day", String(body.today)).like("app", "site:%");
      site_usage = {};
      for (const r of su || []) site_usage[r.app] = Math.max(site_usage[r.app] || 0, r.seconds || 0);
    }
    // Bugun BOSHQA qurilmalarda o'tgan vaqt. Saytlar — eng kattasi, dasturlar — yig'indi.
    let others: Record<string, number> | undefined;
    // Endi barcha qurilmalarga: umumiy kunlik limit (kompyuter + telefon + kengaytma) hamma joyda bir xil hisoblansin
    if (DAY_RE.test(String(body.today || ""))) {
      const { data: ou } = await sb.from("fg_usage").select("app,seconds").eq("user_id", dev.user_id).eq("day", String(body.today)).neq("device_id", dev.id);
      others = {};
      for (const r of ou || []) {
        const v = r.seconds || 0;
        others[r.app] = r.app.startsWith("site:") ? Math.max(others[r.app] || 0, v) : (others[r.app] || 0) + v;
      }
    }
    // 🧮 Barcha qurilmalar bo'yicha hisoblanadigan bloklar: haftalik limit, ochilishlar soni, umumiy ekran vaqti
    const conf = Object.assign({}, cfg?.config || {});
    try { conf.over = await overOf(sb, dev.user_id, conf, String(body.today || "")); } catch (_) { /* hisoblab bo'lmasa — bloklarsiz */ }
    return json({ config: conf, config_at: cfg?.updated_at || null, device: { id: dev.id, name: dev.label || dev.name, kind, parent: (upd.parent_id as string | undefined) || dev.parent_id || null }, now, site_usage, others });
  }

  // ---------- 🧹 Statistikani tozalash (sayt, foydalanuvchi JWT) ----------
  if (action === "reset_stats") {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const at = Date.now();
    const out: Record<string, number> = {};
    for (const t of ["fg_usage", "fg_events", "fg_sessions"]) {
      const { error, count } = await sb.from(t).delete({ count: "exact" }).eq("user_id", uid);
      if (error) return json({ error: "reset_failed", table: t, detail: error.message }, 500);
      out[t] = count || 0;
    }
    // Qurilmalar mahalliy hisobini ham tozalasin
    const { data: c } = await sb.from("fg_config").select("config").eq("user_id", uid).maybeSingle();
    const conf = Object.assign({}, c?.config || {}, { statsResetAt: at });
    await sb.from("fg_config").upsert({ user_id: uid, config: conf, updated_at: new Date().toISOString() });
    return json({ ok: true, at, deleted: out });
  }

  // ---------- 📱 Yangi qurilmadan kirildi (sayt, foydalanuvchi JWT) → Telegram ----------
  if (action === "notify_new_device") {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const id = String(body.device_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_device" }, 400);
    const { data: dev } = await sb.from("account_devices").select("id,name,kind,created_at,notified").eq("id", id).eq("user_id", uid).maybeSingle();
    if (!dev || dev.notified) return json({ ok: true, sent: false });
    await sb.from("account_devices").update({ notified: true }).eq("id", id).eq("user_id", uid);
    // Birinchi qurilma (ro'yxatdan o'tish) yoki eski yozuv — xabar kerak emas
    if (Date.now() - new Date(dev.created_at).getTime() > 15 * 60 * 1000) return json({ ok: true, sent: false });
    const { count } = await sb.from("account_devices").select("id", { count: "exact", head: true }).eq("user_id", uid).neq("id", id);
    if (!count) return json({ ok: true, sent: false });
    if (!BOT_TOKEN) return json({ ok: true, sent: false });
    const { data: link } = await sb.from("telegram_links").select("chat_id,enabled,prefs,lang").eq("user_id", uid).maybeSingle();
    if (!link || !link.enabled || (link.prefs && link.prefs.newDevice === false)) return json({ ok: true, sent: false });
    const lang = ["ru", "en"].includes(String(link.lang)) ? String(link.lang) : "uz";
    const ND: Record<string, string[]> = {
      uz: ["🔔 <b>LevelUpDay</b> — akkauntingizga yangi qurilmadan kirildi", "Agar bu siz bo'lmasangiz: Sinxronlash → Qurilmalar bo'limida uni chiqaring va parolni almashtiring.", "📱 Qurilmalarni ko'rish"],
      en: ["🔔 <b>LevelUpDay</b> — a new device signed in to your account", "If this wasn't you: sign it out in Sync → Devices and change your password.", "📱 View devices"],
      ru: ["🔔 <b>LevelUpDay</b> — в аккаунт вошли с нового устройства", "Если это не вы: выйдите с него в Синхронизация → Устройства и смените пароль.", "📱 Устройства"],
    };
    const t = ND[lang];
    const when = new Date(dev.created_at).toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const text = `${t[0]}\n\n📱 <b>${esc(String(dev.name || "?").slice(0, 80))}</b>\n🕒 ${when}\n\n${t[1]}`;
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: link.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: t[2], url: APP_URL.replace(/focusgate$/, "") }]] } }),
    }).catch(() => null);
    if (r && r.status === 403) await sb.from("telegram_links").update({ enabled: false }).eq("user_id", uid);
    return json({ ok: true, sent: !!(r && r.ok) });
  }

  // ---------- 🎯 Fokus boshlandi → do'stlarga Telegram (sayt, foydalanuvchi JWT; 30 daqiqada bir marta) ----------
  if (action === "focus_started") {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    const uid = u?.user?.id;
    if (!uid || !BOT_TOKEN) return json({ ok: true, sent: 0 });
    const { data: c } = await sb.from("fg_config").select("config").eq("user_id", uid).maybeSingle();
    const conf = c?.config || {};
    if (conf.share === false || conf.focusPing === false || Date.now() - (+conf.focusPingAt || 0) < 30 * 60000) return json({ ok: true, sent: 0 });
    await sb.from("fg_config").update({ config: Object.assign({}, conf, { focusPingAt: Date.now() }) }).eq("user_id", uid);
    const { data: me } = await sb.from("profiles").select("name").eq("id", uid).maybeSingle();
    const { data: f1 } = await sb.from("friendships").select("friend_id").eq("user_id", uid);
    const { data: f2 } = await sb.from("friendships").select("user_id").eq("friend_id", uid);
    const ids = [...new Set([...(f1 || []).map((x: any) => x.friend_id), ...(f2 || []).map((x: any) => x.user_id)])];
    if (!ids.length) return json({ ok: true, sent: 0 });
    const { data: links } = await sb.from("telegram_links").select("user_id,chat_id,enabled,prefs,lang").in("user_id", ids).eq("enabled", true);
    const min = Math.max(1, Math.min(600, Math.round(+body.minutes || 25)));
    const FT: Record<string, string[]> = { uz: ["🎯 <b>{n}</b> {m} daqiqalik fokusni boshladi — qo'shiling, birga +20% bonus!", "🤝 Qo'shilish"], en: ["🎯 <b>{n}</b> started a {m}-minute focus — join for a +20% bonus together!", "🤝 Join"], ru: ["🎯 <b>{n}</b> начал(а) фокус на {m} мин — присоединяйтесь, вместе +20%!", "🤝 Присоединиться"] };
    let sent = 0;
    for (const l of links || []) {
      if (l.prefs && (l.prefs.fg === false || l.prefs.fgfriends === false)) continue;
      const t = FT[["ru", "en"].includes(String(l.lang)) ? String(l.lang) : "uz"];
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: l.chat_id, text: t[0].replace("{n}", esc(String(me?.name || "?"))).replace("{m}", String(min)), parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t[1], url: APP_URL }]] } }),
      }).catch(() => null);
      if (r && r.ok) sent++;
    }
    return json({ ok: true, sent });
  }

  // ---------- 🚨 Qurilma oflayn bo'lib qoldi (faqat cron: x-cron-secret, har 10 daqiqa) → Telegram ----------
  if (action === "offline_check") {
    const { data: pc } = await sb.rpc("_push_config");
    if (!pc?.cron_secret || req.headers.get("x-cron-secret") !== pc.cron_secret) return json({ error: "forbidden" }, 403);
    const now = Date.now();
    const { data: devs } = await sb.from("fg_devices").select("id,user_id,name,label,kind,last_seen,offline_alert_at")
      .in("kind", ["pc", "ext"]).is("offline_alert_at", null)
      .lt("last_seen", new Date(now - 12 * 60000).toISOString()).gt("last_seen", new Date(now - 60 * 60000).toISOString()).limit(200);
    let sent = 0;
    for (const d of devs || []) {
      await sb.from("fg_devices").update({ offline_alert_at: new Date().toISOString() }).eq("id", d.id);
      const { data: c } = await sb.from("fg_config").select("config").eq("user_id", d.user_id).maybeSingle();
      const conf = c?.config || {};
      if (conf.offlineAlert === false || !(conf.rules || []).some((r: any) => r && r.on)) continue; // limitlari yo'q — kerak emas
      const { data: link } = await sb.from("telegram_links").select("chat_id,enabled,prefs,lang").eq("user_id", d.user_id).maybeSingle();
      if (!BOT_TOKEN || !link || !link.enabled || (link.prefs && link.prefs.fg === false)) continue;
      const t = TX[["ru", "en"].includes(String(link.lang)) ? String(link.lang) : "uz"];
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: link.chat_id, text: `${t.head}\n\n${t.off.replace("{d}", esc(String(d.label || d.name || "")))}`, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t.btn, url: APP_URL }]] } }),
      }).catch(() => null);
      if (res && res.ok) sent++;
    }
    return json({ ok: true, checked: (devs || []).length, sent });
  }

  // ---------- 📊 Haftalik hisobot (faqat cron: x-cron-secret) ----------
  if (action === "weekly_report") {
    const { data: pc } = await sb.rpc("_push_config");
    if (!pc?.cron_secret || req.headers.get("x-cron-secret") !== pc.cron_secret) return json({ error: "forbidden" }, 403);
    const n = await weeklyReport(sb);
    return json({ ok: true, sent: n });
  }

  return json({ error: "unknown_action" }, 400);
});
