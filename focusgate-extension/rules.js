// Focusgate kengaytmasi — qoidalar (Windows agentidagi core.go bilan bir xil mantiq).
// Kalitlar: mashhur saytlar "site:youtube", boshqalari "site:<domen>" (masalan "site:kun.uz").

export const KNOWN = [
  ['site:youtube', 'YouTube', ['youtube.com', 'youtu.be']],
  ['site:instagram', 'Instagram', ['instagram.com']],
  ['site:tiktok', 'TikTok', ['tiktok.com']],
  ['site:facebook', 'Facebook', ['facebook.com', 'fb.com']],
  ['site:x', 'X (Twitter)', ['x.com', 'twitter.com']],
  ['site:twitter', 'Twitter', []],
  ['site:reddit', 'Reddit', ['reddit.com']],
  ['site:twitch', 'Twitch', ['twitch.tv']],
  ['site:netflix', 'Netflix', ['netflix.com']],
  ['site:vk', 'VK', ['vk.com']],
  ['site:telegram', 'Telegram Web', ['web.telegram.org']],
  ['site:discord', 'Discord (web)', ['discord.com']],
  ['site:pinterest', 'Pinterest', ['pinterest.com']],
];

// Tizim/ichki sahifalar hisoblanmaydi va bloklanmaydi
const SKIP = /^(newtab|extensions|settings|chrome|edge|about|devtools)$/;

function hostMatches(host, dom) { return host === dom || host.endsWith('.' + dom); }

export function cleanHost(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return '';
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) { return ''; }
}

// Sayt kaliti va nomi (null — hisoblanmaydi)
export function siteOf(url, rules) {
  const host = cleanHost(url);
  if (!host || SKIP.test(host) || host === 'levelupday.github.io') return null;
  for (const r of rules || []) {
    if (!r.app || !r.app.startsWith('site:')) continue;
    if (KNOWN.some((k) => k[0] === r.app)) continue;
    const kw = r.app.slice(5);
    if (kw && (kw.includes('.') ? hostMatches(host, kw) : host.includes(kw))) return { key: r.app, label: r.label || kw };
  }
  for (const [key, label, doms] of KNOWN) if (doms.some((d) => hostMatches(host, d))) return { key, label };
  // Boshqa saytlar: oxirgi 2 qism (kun.uz, github.com); 3 qismli zonalar (co.uk, com.tr) uchun 3 qism
  const parts = host.split('.');
  const base = parts.length > 2 && /^(co|com|org|net|gov|edu|ac)$/.test(parts[parts.length - 2]) ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
  return { key: 'site:' + base, label: base };
}

// Saytlar kategoriyalari (agentdagi cats.go va saytdagi blocker.js bilan bir xil)
export const SITE_CAT = {
  'site:instagram': 'social', 'site:tiktok': 'social', 'site:facebook': 'social', 'site:x': 'social', 'site:twitter': 'social', 'site:vk': 'social',
  'site:telegram': 'social', 'site:discord': 'social', 'site:reddit': 'social', 'site:pinterest': 'social',
  'site:youtube': 'fun', 'site:netflix': 'fun', 'site:twitch': 'fun', 'site:kinopoisk': 'fun', 'site:roblox': 'games',
  'site:coursera': 'study', 'site:udemy': 'study', 'site:khanacademy': 'study', 'site:duolingo': 'study',
};
export function catOf(cfg, key) { return (cfg && cfg.cats && cfg.cats[key]) || SITE_CAT[key] || 'web'; }
export function matches(cfg, ruleApp, key) { return ruleApp === key || (ruleApp.startsWith('cat:') && catOf(cfg, key) === ruleApp.slice(4)); }
// Sayt bo'limlari ("site:youtube#shorts") — statistika uchun; limit va kategoriya yig'indisiga qo'shilmaydi
export function isSection(key) { return key.indexOf('#') !== -1; }

function hm(s) { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; }
function weekday(d) { const wd = d.getDay(); return wd === 0 ? 7 : wd; }
// Kunlik limit bugun necha daqiqa (r.perDay: "1".."7" → daqiqa)
export function ruleMinutes(r, d = new Date()) { const v = r.perDay && r.perDay[String(weekday(d))]; return v != null ? +v : (r.minutes || 0); }
export function modeActive(m, d = new Date()) { return !!(m && (m.on || (m.sched && inSchedule(m, d)))); }
const BROWSER_EXE = /^(chrome|msedge|firefox|brave|opera|opera_gx|vivaldi|browser|arc|yandex)\.exe$/;
// Fokusda "faqat ruxsat etilganlar": sayt ruxsat etilganmi
export function allowedSite(cfg, key) {
  const list = cfg.allowApps || [];
  if (list.some((f) => f.app && matches(cfg, f.app, key))) return true;
  // Ro'yxatda birorta ham sayt yo'q, lekin brauzer ruxsat etilgan — barcha saytlar ochiq
  return !list.some((f) => /^site:/.test(f.app || '')) && list.some((f) => BROWSER_EXE.test(f.app || ''));
}
export function mindfulSite(cfg, key) { return (cfg.mindful || []).some((f) => f.on && f.app && matches(cfg, f.app, key)); }
export function inSchedule(r, d) {
  const wd = weekday(d);
  if (r.days && r.days.length && r.days.indexOf(wd) === -1) return false;
  const from = hm(r.from), to = hm(r.to), now = d.getHours() * 60 + d.getMinutes();
  if (from === to) return true;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

// check — sayt hozir bloklanganmi? used(appYokiCat) — bugun sarflangan soniyalar (son ham berish mumkin)
// Qoida shu qurilmada ishlaydimi: r.devs (fg_devices.id) bo'sh — hammasida; aks holda shu kengaytma
// yoki u turgan kompyuter (cfg._me / cfg._pc — sinxronda qo'yiladi) ro'yxatda bo'lsa
export function forMe(cfg, r) {
  const d = r && r.devs;
  if (!Array.isArray(d) || !d.length || !cfg._me) return true;
  return d.includes(cfg._me) || (!!cfg._pc && d.includes(cfg._pc));
}
export function check(cfg, key, used, now = new Date()) {
  if (!cfg || !key) return null;
  const usedOf = typeof used === 'function' ? used : () => used || 0;
  const ms = now.getTime();
  if (!cfg.strict && (cfg.pauseUntil || 0) > ms) return null;
  if ((cfg.focusUntil || 0) > ms && (cfg.focusApps || []).some((f) => f.on && matches(cfg, f.app, key))) return { reason: 'focus' };
  if ((cfg.focusUntil || 0) > ms && cfg.allowOnly && !allowedSite(cfg, key)) return { reason: 'allow' };
  for (const m of cfg.modes || []) if (modeActive(m, now) && (m.apps || []).some((f) => f.app && matches(cfg, f.app, key))) return { reason: 'mode', rule: { label: m.name } };
  for (const r of cfg.rules || []) {
    if (!r.on || !r.app || !forMe(cfg, r) || !matches(cfg, r.app, key)) continue;
    if (r.kind === 'always') return { reason: 'always', rule: r };
    if (r.kind === 'schedule' && inSchedule(r, now)) return { reason: 'schedule', rule: r };
    const lim = r.kind === 'daily' ? ruleMinutes(r, now) : 0;
    if (lim > 0 && usedOf(r.app.startsWith('cat:') ? r.app : key) >= lim * 60) return { reason: 'daily', rule: Object.assign({}, r, { minutes: lim }) };
  }
  return null;
}

export function dayKey(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
