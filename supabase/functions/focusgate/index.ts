// 🛡 focusgate — Windows agent (Focusgate.exe) ↔ LevelUpDay.
//  Ulash (device flow):
//   1) agent:  {action:'pair_start', name}        → {code}  (agent brauzerda levelupday.../#fgpair=CODE ni ochadi)
//   2) sayt:   {action:'pair_approve', code} + foydalanuvchi JWT → qurilma yaratiladi
//   3) agent:  {action:'pair_poll', code}         → {token} (bir martalik; keyin kod o'chiriladi)
//  Sinxronlash:
//      agent:  {action:'sync', token, version, usage:[{day, app, label, seconds, hours[24]}], apps?:[{exe, name}]}
//              → {config, device, now}   (usage — shu qurilmaning kunlik umumiy qiymatlari, ustiga yoziladi)
// JWT tekshiruvi o'chirilgan: agent qurilma tokeni bilan, sayt esa foydalanuvchi JWT bilan tekshiriladi.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAIR_TTL_MS = 15 * 60 * 1000;

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
      const apps: { exe: string; name: string }[] = [];
      for (const a of body.apps.slice(0, 800)) {
        const exe = String(a?.exe || "").toLowerCase().replace(/^.*[\\/]/, "").slice(0, 80);
        if (!/^[^<>:"|?*]+\.exe$/.test(exe) || seen.has(exe)) continue;
        seen.add(exe);
        apps.push({ exe, name: String(a?.name || exe.replace(/\.exe$/, "")).replace(/[\u0000-\u001f]/g, "").slice(0, 70) });
      }
      upd.apps = apps;
      upd.apps_at = new Date().toISOString();
    }
    await sb.from("fg_devices").update(upd).eq("id", dev.id);
    const { data: cfg } = await sb.from("fg_config").select("config,updated_at").eq("user_id", dev.user_id).maybeSingle();
    return json({ config: cfg?.config || {}, config_at: cfg?.updated_at || null, device: { id: dev.id, name: dev.name }, now });
  }

  return json({ error: "unknown_action" }, 400);
});
