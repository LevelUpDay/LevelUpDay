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
function matches(cfg, ruleApp, key) { return ruleApp === key || (ruleApp.startsWith('cat:') && catOf(cfg, key) === ruleApp.slice(4)); }

function hm(s) { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; }
export function inSchedule(r, d) {
  let wd = d.getDay(); if (wd === 0) wd = 7;
  if (r.days && r.days.length && r.days.indexOf(wd) === -1) return false;
  const from = hm(r.from), to = hm(r.to), now = d.getHours() * 60 + d.getMinutes();
  if (from === to) return true;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

// check — sayt hozir bloklanganmi? used(appYokiCat) — bugun sarflangan soniyalar (son ham berish mumkin)
export function check(cfg, key, used, now = new Date()) {
  if (!cfg || !key) return null;
  const usedOf = typeof used === 'function' ? used : () => used || 0;
  const ms = now.getTime();
  if (!cfg.strict && (cfg.pauseUntil || 0) > ms) return null;
  if ((cfg.focusUntil || 0) > ms && (cfg.focusApps || []).some((f) => f.on && matches(cfg, f.app, key))) return { reason: 'focus' };
  for (const r of cfg.rules || []) {
    if (!r.on || !r.app || !matches(cfg, r.app, key)) continue;
    if (r.kind === 'always') return { reason: 'always', rule: r };
    if (r.kind === 'schedule' && inSchedule(r, now)) return { reason: 'schedule', rule: r };
    if (r.kind === 'daily' && r.minutes > 0 && usedOf(r.app.startsWith('cat:') ? r.app : key) >= r.minutes * 60) return { reason: 'daily', rule: r };
  }
  return null;
}

export function dayKey(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
