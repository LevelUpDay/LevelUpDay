// LevelUpDay Focusgate — brauzer kengaytmasi (Chrome / Edge, Manifest V3).
//  • Faol tabdagi saytda o'tgan vaqtni hisoblaydi (bo'sh turilganda/oyna fokusda bo'lmaganda to'xtaydi)
//  • Bloklangan saytni (doimiy / jadval / kunlik limit / fokus) "bloklandi" sahifasiga yo'naltiradi
//  • Har daqiqada LevelUpDay bilan sinxronlanadi: foydalanish → server, sozlamalar ← server (Windows agenti bilan bir xil)
//  • Ulash: LevelUpDay'da "Ulash" tasdiqlanadi (#fgpair=KOD)
import { siteOf, check, dayKey, catOf } from './rules.js';

const FN = 'https://zzcvpenkevxlurgpjltz.supabase.co/functions/v1/focusgate';
const APP = 'https://levelupday.github.io/LevelUpDay/';
const VERSION = 'ext-' + chrome.runtime.getManifest().version;
const BLOCKED = chrome.runtime.getURL('blocked.html');

// ---------- Saqlash ----------
const S = {
  async get(k) { const o = await chrome.storage.local.get(k); return o[k]; },
  async set(o) { await chrome.storage.local.set(o); },
};
async function cfgOf() { return (await S.get('cfg')) || {}; }

async function api(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error('unauthorized'), { code: 401 });
  if (r.status === 410) throw Object.assign(new Error('expired'), { code: 410 });
  if (!r.ok) throw new Error(data.error || ('http ' + r.status));
  return data;
}

// ---------- Ulash ----------
function browserName() {
  const ua = navigator.userAgent || '';
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /YaBrowser/.test(ua) ? 'Yandex' : 'Chrome';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
  return b + (os ? ' · ' + os : '');
}
async function startPair() {
  const p = await S.get('pair');
  if (p && Date.now() - p.at < 14 * 60 * 1000) { chrome.tabs.create({ url: APP + '#fgpair=' + p.code }); return p.code; }
  const r = await api({ action: 'pair_start', name: browserName() + ' (kengaytma)' });
  await S.set({ pair: { code: r.code, at: Date.now() } });
  chrome.tabs.create({ url: APP + '#fgpair=' + r.code });
  pollPair();
  return r.code;
}
let polling = false;
async function pollPair() {
  if (polling) return; polling = true;
  try {
    for (let i = 0; i < 100; i++) {
      const p = await S.get('pair');
      if (!p || (await S.get('token'))) break;
      try {
        const r = await api({ action: 'pair_poll', code: p.code });
        if (r.token) {
          await S.set({ token: r.token, pair: null });
          notifyPopup();
          sync();
          break;
        }
      } catch (e) { if (e.code === 410) { await S.set({ pair: null }); break; } }
      await new Promise((res) => setTimeout(res, 3000));
    }
  } finally { polling = false; }
}

// ---------- Vaqtni hisoblash ----------
// Joriy segment storage.session'da (service worker uxlab qolsa ham yo'qolmaydi)
async function flush(next) {
  const { cur } = await chrome.storage.session.get('cur');
  const now = Date.now();
  if (cur && cur.key) {
    const sec = Math.min(30 * 60, Math.max(0, Math.round((now - cur.since) / 1000)));
    if (sec > 0) await addUsage(cur.key, cur.label, sec, new Date(cur.since));
  }
  await chrome.storage.session.set({ cur: next === undefined ? (cur && cur.key ? { ...cur, since: now } : null) : next });
}
async function addUsage(key, label, sec, at) {
  const usage = (await S.get('usage')) || {};
  const d = dayKey(at);
  const day = usage[d] || (usage[d] = {});
  const u = day[key] || (day[key] = { label, s: 0, h: new Array(24).fill(0) });
  u.label = label || u.label; u.s += sec; u.h[at.getHours()] += sec;
  // 4 kundan eskilari o'chiriladi
  const keep = new Set([0, 1, 2, 3].map((i) => dayKey(new Date(Date.now() - i * 86400000))));
  Object.keys(usage).forEach((k) => { if (!keep.has(k)) delete usage[k]; });
  await S.set({ usage });
}
let idleState = 'active';
async function refreshCurrent() {
  const cfg = await cfgOf();
  if (cfg.track === false || idleState !== 'active') { await flush(null); return; }
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused) { await flush(null); return; }
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  const site = tab && tab.url ? siteOf(tab.url, cfg.rules) : null;
  const { cur } = await chrome.storage.session.get('cur');
  if (site && cur && cur.key === site.key && cur.tabId === tab.id) { await flush(); return; }
  await flush(site ? { key: site.key, label: site.label, tabId: tab.id, since: Date.now() } : null);
}

// ---------- Bloklash ----------
async function usedToday(key) {
  const usage = (await S.get('usage')) || {}, remote = (await S.get('remote')) || {};
  const local = ((usage[dayKey()] || {})[key] || {}).s || 0;
  const { cur } = await chrome.storage.session.get('cur');
  const live = cur && cur.key === key ? Math.round((Date.now() - cur.since) / 1000) : 0;
  return Math.max(local + live, remote[key] || 0);
}
async function enforce(tabId, url) {
  if (!url || url.startsWith(BLOCKED)) return;
  const cfg = await cfgOf();
  if (!(await S.get('token'))) return;
  const site = siteOf(url, cfg.rules);
  if (!site) return;
  // Kategoriya limiti uchun: shu kategoriyadagi barcha saytlar yig'indisi
  const usage = (await S.get('usage')) || {}, remote = (await S.get('remote')) || {};
  const keys = new Set(Object.keys(usage[dayKey()] || {}).concat(Object.keys(remote)));
  const cache = {};
  for (const k of keys) cache[k] = await usedToday(k);
  if (!(site.key in cache)) cache[site.key] = await usedToday(site.key);
  const used = (app) => app.startsWith('cat:') ? Object.keys(cache).filter((k) => catOf(cfg, k) === app.slice(4)).reduce((n, k) => n + cache[k], 0) : (cache[app] || 0);
  const v = check(cfg, site.key, used);
  if (!v) return;
  const q = new URLSearchParams({ k: site.key, l: site.label, r: v.reason, m: v.rule && v.rule.minutes ? String(v.rule.minutes) : '', u: url });
  chrome.tabs.update(tabId, { url: BLOCKED + '?' + q.toString() }).catch(() => {});
  event('site_block', site.key, site.label, v.reason);
}
async function enforceAll() {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) if (t.url) await enforce(t.id, t.url);
}

// ---------- Hodisalar → server → Telegram ----------
const lastEv = {};
let evTimer = 0;
async function event(kind, app, label, reason) {
  const k = kind + '|' + app;
  if (lastEv[k] && Date.now() - lastEv[k] < 60000) return;
  lastEv[k] = Date.now();
  const events = (await S.get('events')) || [];
  events.push({ kind, app, label, reason, at: Date.now() });
  await S.set({ events: events.slice(-200) });
  clearTimeout(evTimer); evTimer = setTimeout(sync, 4000);
}

// ---------- Sinxronlash ----------
let syncing = false;
async function sync() {
  if (syncing) return; syncing = true;
  try {
    await flush();
    const token = await S.get('token');
    if (!token) { if (await S.get('pair')) pollPair(); return; }
    const usage = (await S.get('usage')) || {};
    const rows = [];
    [dayKey(), dayKey(new Date(Date.now() - 86400000))].forEach((d) => {
      const day = usage[d] || {};
      Object.keys(day).sort((a, b) => day[b].s - day[a].s).slice(0, 80).forEach((k) => {
        if (day[k].s >= 1) rows.push({ day: d, app: k, label: day[k].label, seconds: day[k].s, hours: day[k].h });
      });
    });
    const events = (await S.get('events')) || [];
    await S.set({ events: [] });
    let r;
    try { r = await api({ action: 'sync', token, version: VERSION, usage: rows, events, today: dayKey() }); }
    catch (e) {
      const back = (await S.get('events')) || []; await S.set({ events: events.concat(back).slice(-200) });
      if (e.code === 401) await S.set({ token: null });
      throw e;
    }
    await S.set({ cfg: r.config || {}, remote: r.site_usage || {}, device: r.device || null, syncedAt: Date.now() });
    await enforceAll();
    notifyPopup();
  } catch (e) { /* oflayn — keyingi daqiqada qayta urinadi */ }
  finally { syncing = false; }
}
function notifyPopup() { chrome.runtime.sendMessage({ type: 'fg:update' }).catch(() => {}); }

// ---------- Hodisalar ----------
chrome.runtime.onInstalled.addListener(async (d) => {
  chrome.alarms.create('fg-tick', { periodInMinutes: 1 });
  chrome.idle.setDetectionInterval(120);
  if (d.reason === 'install' && !(await S.get('token'))) startPair().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('fg-tick', { periodInMinutes: 1 }); chrome.idle.setDetectionInterval(120); sync(); });
chrome.alarms.onAlarm.addListener(async (a) => { if (a.name === 'fg-tick') { await refreshCurrent(); await sync(); } });
chrome.tabs.onActivated.addListener(() => refreshCurrent());
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === 'loading') enforce(tabId, info.url || tab.url);
  if (tab.active && (info.url || info.status === 'complete')) refreshCurrent();
});
chrome.windows.onFocusChanged.addListener(() => refreshCurrent());
chrome.idle.onStateChanged.addListener((s) => { idleState = s; refreshCurrent(); });
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === 'fg:pair') { startPair().then((c) => reply({ code: c }), (e) => reply({ error: String(e.message || e) })); return true; }
  if (msg && msg.type === 'fg:sync') { sync().then(() => reply({ ok: true })); return true; }
  if (msg && msg.type === 'fg:unpair') { S.set({ token: null, cfg: {}, remote: {} }).then(() => reply({ ok: true })); return true; }
  if (msg && msg.type === 'fg:closeTab' && sender.tab) { chrome.tabs.remove(sender.tab.id); }
});
