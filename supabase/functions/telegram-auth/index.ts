// ✈️ telegram-auth — Telegram Login Widget orqali kirish.
//  1) Telegram yuborgan ma'lumot (id, first_name, username, photo_url, auth_date, hash)
//     bot tokeni bilan HMAC-SHA256 orqali tekshiriladi (https://core.telegram.org/widgets/login#checking-authorization).
//  2) Foydalanuvchi topiladi yoki yaratiladi: email = tg<id>@telegram.levelupday.app (xat yuborilmaydi).
//  3) Bir martalik magiclink token_hash qaytariladi — mijoz supabase.auth.verifyOtp({ token_hash, type: 'email' })
//     bilan sessiya oladi.
// Sir: TELEGRAM_BOT_TOKEN (Edge Functions → Secrets). JWT tekshiruvi o'chirilgan — himoya HMAC imzoda.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const MAX_AGE = 24 * 3600; // Telegram ma'lumoti ko'pi bilan 1 kun eski bo'lishi mumkin

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyTelegram(data: Record<string, unknown>): Promise<boolean> {
  const hash = String(data.hash || "");
  if (!/^[0-9a-f]{64}$/.test(hash)) return false;
  const check = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secret = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(BOT_TOKEN));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(check));
  return safeEq(hex(sig), hash);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!BOT_TOKEN) return json({ error: "not_configured" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  // Faqat Telegram maydonlari imzoga kiradi
  const allowed = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined && body[k] !== null && body[k] !== "") data[k] = body[k];

  const id = Number(data.id), authDate = Number(data.auth_date);
  if (!Number.isSafeInteger(id) || id <= 0 || !authDate) return json({ error: "bad_data" }, 400);
  if (Math.abs(Date.now() / 1000 - authDate) > MAX_AGE) return json({ error: "expired" }, 401);
  if (!(await verifyTelegram(data))) return json({ error: "bad_signature" }, 401);

  const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `tg${id}@telegram.levelupday.app`;
  const name = String(data.username || [data.first_name, data.last_name].filter(Boolean).join(" ") || `tg${id}`).slice(0, 30);
  const meta = { name, full_name: name, avatar_url: data.photo_url || null, telegram_id: id, telegram_username: data.username || null, provider_hint: "telegram" };

  // Yangi bo'lsa yaratamiz (allaqachon bor bo'lsa — xato e'tiborsiz qoldiriladi)
  const created = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
  const isNew = !created.error;
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    return json({ error: "create_failed", detail: created.error.message }, 500);
  }

  const link = await sb.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return json({ error: "link_failed", detail: link.error?.message }, 500);

  return json({ email, token_hash: tokenHash, is_new: isNew });
});
