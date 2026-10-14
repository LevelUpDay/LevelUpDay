// 🛡 focusgate — Windows agent (Focusgate.exe), brauzer kengaytmasi va Android ilovasi ↔ LevelUpDay.
//  Ulash (device flow):
//   1) agent:  {action:'pair_start', name}        → {code}  (agent brauzerda levelupday.../#fgpair=CODE ni ochadi)
//   2) sayt:   {action:'pair_approve', code} + foydalanuvchi JWT → qurilma yaratiladi
//   3) agent:  {action:'pair_poll', code}         → {token} (bir martalik; keyin kod o'chiriladi)
//  Sinxronlash:
//      agent:  {action:'sync', token, version, usage:[{day, app, label, seconds, hours[24]}], apps?:[{exe, name, cat?, icon?}], events?:[{kind, app, label, reason, at}]}
//      kengaytma ham shu funksiyadan foydalanadi (qurilma nomi 'Chrome …').
//              → {config, device, now}   (usage — shu qurilmaning kunlik umumiy qiymatlari, ustiga yoziladi)
// JWT tekshiruvi o'chirilgan: agent qurilma tokeni bilan, sayt esa foydalanuvchi JWT bilan tekshiriladi.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAIR_TTL_MS = 15 * 60 * 1000;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const APP_URL = "https://levelupday.github.io/LevelUpDay/#focusgate";

// ---------- ✈️ Telegram: bloklash / ogohlantirish xabarlari ----------
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const TX: Record<string, Record<string, string>> = {
  uz: { head: "🛡 <b>Focusgate</b>", block: "yopildi", site: "sayt tabi yopildi", warn: "kunlik limitga 5 daqiqa qoldi", daily: "bugungi limit tugadi", always: "doimiy bloklangan", schedule: "jadval bo'yicha bloklangan", focus: "fokus vaqtida", session: "seans vaqti tugadi", btn: "📊 Focusgate'ni ochish", more: "yana" },
  en: { head: "🛡 <b>Focusgate</b>", block: "was closed", site: "tab was closed", warn: "5 minutes left of your daily limit", daily: "daily limit reached", always: "always blocked", schedule: "blocked by schedule", focus: "during focus", session: "session time is up", btn: "📊 Open Focusgate", more: "more" },
  ru: { head: "🛡 <b>Focusgate</b>", block: "закрыто", site: "вкладка закрыта", warn: "до дневного лимита 5 минут", daily: "дневной лимит исчерпан", always: "заблокировано навсегда", schedule: "заблокировано по расписанию", focus: "во время фокуса", session: "время сессии вышло", btn: "📊 Открыть Focusgate", more: "ещё" },
};
async function tgNotify(sb: any, userId: string, events: { id: number; kind: string; app: string; label: string | null; reason: string | null }[]) {
  if (!BOT_TOKEN || !events.length) return;
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
    if (e.kind === "warn") return `⏳ <b>${name}</b> — ${t.warn}`;
    return `⛔ <b>${name}</b> ${e.kind === "site_block" ? t.site : t.block}${e.reason && t[e.reason] ? " · " + t[e.reason] : ""}`;
  };
  const lines = send.slice(0, 6).map(line);
  if (send.length > 6) lines.push(`… ${t.more} ${send.length - 6}`);
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: link.chat_id, text: t.head + "\n" + lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: t.btn, url: APP_URL }]] } }),
  }).catch(() => null);
  if (r && r.status === 403) await sb.from("telegram_links").update({ enabled: false }).eq("user_id", userId);
  await sb.from("fg_events").update({ notified: true }).in("id", send.map((e) => e.id));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const action = String(body.action || "");

  // ---------- 1) Ulashni boshlash (agent) ----------
  if (action === "pair_start") {
    const name = String(body.name || "Windows PC").slice(0, 60);
    for (let i = 0; i < 4; i++) {
      const code = pairCode();
      const { error } = await sb.from("fg_pair").insert({ code, device_name: name });
      if (!error) return json({ code, ttl: PAIR_TTL_MS / 1000 });
    }
    return json({ error: "pair_failed" }, 500);
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
    const token = randHex(32);
    const { data: dev, error: de } = await sb.from("fg_devices")
      .insert({ user_id: uid, name: p.device_name, token_hash: await sha256(token) }).select("id,name").single();
    if (de || !dev) return json({ error: "device_failed" }, 500);
    await sb.from("fg_pair").update({ user_id: uid, token }).eq("code", code);
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
    const { data: dev } = await sb.from("fg_devices").select("id,user_id,name").eq("token_hash", await sha256(token)).maybeSingle();
    if (!dev) return json({ error: "unauthorized" }, 401);

    const now = Date.now();
    const rows: Record<string, unknown>[] = [];
    const usage = Array.isArray(body.usage) ? body.usage.slice(0, 400) : [];
    for (const r of usage) {
      const day = String(r?.day || "");
      if (!DAY_RE.test(day)) continue;
      const age = (now - new Date(day + "T00:00:00Z").getTime()) / 86400000;
      if (age > 3 || age < -2) continue; // faqat so'nggi kunlar
      const app = String(r?.app || "").toLowerCase().slice(0, 120);
      if (!app) continue;
      const seconds = Math.max(0, Math.min(86400, Math.round(Number(r?.seconds) || 0)));
      const hours = Array.isArray(r?.hours) ? r.hours.slice(0, 24).map((x: unknown) => Math.max(0, Math.min(3600, Math.round(Number(x) || 0)))) : [];
      rows.push({ user_id: dev.user_id, device_id: dev.id, day, app, label: r?.label ? String(r.label).slice(0, 80) : null, seconds, hours, updated_at: new Date().toISOString() });
    }
    if (rows.length) {
      const { error } = await sb.from("fg_usage").upsert(rows, { onConflict: "user_id,device_id,day,app" });
      if (error) return json({ error: "usage_failed", detail: error.message }, 500);
    }
    const upd: Record<string, unknown> = { last_seen: new Date().toISOString(), agent_version: body.version ? String(body.version).slice(0, 20) : null };
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
    if (Array.isArray(body.events) && body.events.length) {
      const evs = body.events.slice(0, 50).map((e: any) => ({
        user_id: dev.user_id, device_id: dev.id,
        kind: ["block", "site_block", "warn"].includes(String(e?.kind)) ? String(e.kind) : "block",
        app: String(e?.app || "").toLowerCase().slice(0, 120), label: e?.label ? String(e.label).slice(0, 80) : null,
        reason: e?.reason ? String(e.reason).slice(0, 20) : null,
        at: Number.isFinite(Number(e?.at)) && Math.abs(now - Number(e.at)) < 3 * 86400000 ? new Date(Number(e.at)).toISOString() : new Date().toISOString(),
      })).filter((e: any) => e.app);
      if (evs.length) {
        const { data: ins } = await sb.from("fg_events").insert(evs).select("id,kind,app,label,reason");
        try { await tgNotify(sb, dev.user_id, ins || []); } catch (_) { /* Telegram xatosi sinxronlashni to'xtatmasin */ }
      }
    }
    const { data: cfg } = await sb.from("fg_config").select("config,updated_at").eq("user_id", dev.user_id).maybeSingle();
    // Bugun saytlarda o'tgan vaqt — barcha qurilmalar bo'yicha eng kattasi (kengaytma limitni to'g'ri hisoblashi uchun)
    let site_usage: Record<string, number> | undefined;
    if (DAY_RE.test(String(body.today || ""))) {
      const { data: su } = await sb.from("fg_usage").select("app,seconds").eq("user_id", dev.user_id).eq("day", String(body.today)).like("app", "site:%");
      site_usage = {};
      for (const r of su || []) site_usage[r.app] = Math.max(site_usage[r.app] || 0, r.seconds || 0);
    }
    // Android: bugun BOSHQA qurilmalarda o'tgan vaqt (umumiy limit: kompyuter + telefon). Saytlar — eng kattasi, dasturlar — yig'indi.
    let others: Record<string, number> | undefined;
    if (String(body.version || "").startsWith("android-") && DAY_RE.test(String(body.today || ""))) {
      const { data: ou } = await sb.from("fg_usage").select("app,seconds").eq("user_id", dev.user_id).eq("day", String(body.today)).neq("device_id", dev.id);
      others = {};
      for (const r of ou || []) {
        const v = r.seconds || 0;
        others[r.app] = r.app.startsWith("site:") ? Math.max(others[r.app] || 0, v) : (others[r.app] || 0) + v;
      }
    }
    return json({ config: cfg?.config || {}, config_at: cfg?.updated_at || null, device: { id: dev.id, name: dev.name }, now, site_usage, others });
  }

  return json({ error: "unknown_action" }, 400);
});
