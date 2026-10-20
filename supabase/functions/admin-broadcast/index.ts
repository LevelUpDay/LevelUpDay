// 📣 admin-broadcast — admin panelidan ommaviy xabar: ilova ichida (user_messages), Web Push va Telegram.
//  Sayt: {title, body, url?, filters:{lang,country,level_min,level_max,active}, channels:['inapp','push','telegram']} + admin JWT
//  Faqat admin_emails dagi admin/owner (revoked_at bo'sh). Natija admin_broadcasts va admin_audit ga yoziladi.
// JWT tekshiruvi o'chirilgan: funksiya o'zi foydalanuvchi JWT'ini va rolini tekshiradi.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const APP_URL = "https://levelupday.github.io/LevelUpDay/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const chunks = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let vapidReady = false;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 🔐 Admin tekshiruvi (admin yoki owner)
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(jwt);
  const user = u?.user;
  if (!user?.id || !user.email || !user.email_confirmed_at) return json({ error: "unauthorized" }, 401);
  const { data: role } = await sb.from("admin_emails").select("role,revoked_at").eq("email", user.email.toLowerCase()).maybeSingle();
  if (!role || role.revoked_at || !["admin", "owner"].includes(role.role)) return json({ error: "forbidden" }, 403);

  const title = String(body.title || "").trim().slice(0, 120);
  const text = String(body.body || "").trim().slice(0, 2000);
  if (!text) return json({ error: "empty" }, 400);
  const url = /^\.\/|^https:\/\/levelupday\.github\.io\//.test(String(body.url || "")) ? String(body.url) : "./";
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const channels: string[] = Array.isArray(body.channels) ? body.channels.filter((c: string) => ["inapp", "push", "telegram"].includes(c)) : ["inapp"];
  if (!channels.length) return json({ error: "no_channels" }, 400);

  const { data: rows, error: te } = await sb.rpc("_broadcast_users", { p_f: filters });
  if (te) return json({ error: "targets_failed", detail: te.message }, 500);
  const ids: string[] = (rows || []).map((r: any) => typeof r === "string" ? r : (r?._broadcast_users || r?.id)).filter(Boolean);

  const { data: bc } = await sb.from("admin_broadcasts").insert({ admin_id: user.id, title, body: text, filters, channels, targets: ids.length }).select("id").single();
  const bid = bc?.id || 0;
  let inapp = 0, push = 0, tg = 0;

  if (channels.includes("inapp")) {
    for (const part of chunks(ids, 500)) {
      const { error } = await sb.from("user_messages").insert(part.map((id) => ({ user_id: id, title: title || null, body: text, kind: "broadcast", from_admin: user.id, data: { broadcast: bid } })));
      if (!error) inapp += part.length;
    }
  }
  if (channels.includes("push") && ids.length) {
    if (!vapidReady) {
      const { data: cfg } = await sb.rpc("_push_config");
      if (cfg?.vapid_public) { webpush.setVapidDetails("mailto:shodruz1009@gmail.com", cfg.vapid_public, cfg.vapid_private); vapidReady = true; }
    }
    if (vapidReady) {
      const payload = JSON.stringify({ title: title || "LevelUpDay", body: text.slice(0, 240), tag: "admin-" + bid, url });
      for (const part of chunks(ids, 200)) {
        const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", part);
        for (const s of subs || []) {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 }); push++; }
          catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
        }
      }
    }
  }
  if (channels.includes("telegram") && BOT_TOKEN && ids.length) {
    const msg = (title ? `📣 <b>${esc(title)}</b>\n\n` : "📣 ") + esc(text);
    for (const part of chunks(ids, 200)) {
      const { data: links } = await sb.from("telegram_links").select("chat_id").in("user_id", part).eq("enabled", true);
      for (const l of links || []) {
        const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: l.chat_id, text: msg, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: "📲 LevelUpDay", url: APP_URL }]] } }),
        }).catch(() => null);
        if (r?.ok) tg++;
        else if (r?.status === 403) await sb.from("telegram_links").update({ enabled: false }).eq("chat_id", l.chat_id);
        await sleep(40); // Telegram: ~25 xabar/soniya
      }
    }
  }
  await sb.from("admin_broadcasts").update({ sent_push: push, sent_tg: tg, sent_inapp: inapp }).eq("id", bid);
  await sb.from("admin_audit").insert({ admin_id: user.id, admin_email: user.email.toLowerCase(), action: "broadcast", details: { id: bid, title, channels, filters, targets: ids.length, push, tg, inapp } });
  return json({ ok: true, id: bid, targets: ids.length, inapp, push, telegram: tg });
});
