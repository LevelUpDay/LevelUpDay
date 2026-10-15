import { dayKey } from './rules.js';
// Til: LevelUpDay'da tanlangani (cfg.lang), bo'lmasa brauzer tili
let LANG = /^ru/.test(navigator.language || '') ? 'ru' : /^uz/.test(navigator.language || '') ? 'uz' : 'en';
const L = (a, b, c) => (LANG === 'ru' ? c : LANG === 'uz' ? a : b);
const fmt = (s) => { const m = Math.round(s / 60); if (m < 1) return Math.round(s) + ' ' + L('s', 's', 'с'); const h = Math.floor(m / 60); return h ? h + ' ' + L('soat', 'h', 'ч') + (m % 60 ? ' ' + (m % 60) + ' ' + L('daq', 'min', 'мин') : '') : m + ' ' + L('daq', 'min', 'мин'); };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function render() {
  const o = await chrome.storage.local.get(['token', 'usage', 'cfg', 'device', 'pair', 'syncedAt']);
  if (o.cfg && ['uz', 'en', 'ru'].includes(o.cfg.lang)) LANG = o.cfg.lang;
  const day = (o.usage || {})[dayKey()] || {};
  const list = Object.keys(day).map((k) => ({ k, l: day[k].label || k.replace(/^site:/, ''), s: day[k].s })).sort((a, b) => b.s - a.s);
  const total = list.reduce((s, x) => s + x.s, 0);
  $('total').textContent = fmt(total);
  $('totalL').textContent = L('bugun saytlarda', 'on sites today', 'на сайтах сегодня');
  $('st').textContent = o.token ? L('Ulangan', 'Connected', 'Подключено') : L('Ulanmagan', 'Not connected', 'Не подключено');
  $('st').className = 'pill' + (o.token ? '' : ' off');
  $('dev').textContent = o.device && o.device.name ? o.device.name : 'LevelUpDay';
  const left = ((o.cfg && o.cfg.focusUntil) || 0) - Date.now();
  $('focus').style.display = o.token && left > 0 ? 'block' : 'none';
  if (left > 0) $('focus').textContent = '🎯 ' + L('Fokus', 'Focus', 'Фокус') + ': ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0') + ' ' + L('qoldi', 'left', 'осталось');
  let h = '';
  if (!o.token) {
    h += '<div class="note">' + esc(L('LevelUpDay akkauntingizga ulang — limitlar, fokus va saytlarni bloklash shu yerda ishlaydi.', 'Connect your LevelUpDay account — limits, focus and site blocking work here.', 'Подключите аккаунт LevelUpDay — лимиты, фокус и блокировка сайтов заработают здесь.')) + '</div>';
    if (o.pair && Date.now() - o.pair.at < 14 * 60000) h += '<div class="code">' + esc(o.pair.code) + '</div>';
    h += '<div class="btns"><button class="p" id="pair">🔗 ' + esc(L('Akkauntga ulash', 'Connect account', 'Подключить')) + '</button></div>';
  } else {
    h += '<div class="t">' + esc(L('Bugun', 'Today', 'Сегодня')) + '</div>';
    if (!list.length) h += '<div class="empty">' + esc(L('Hali ma\'lumot yo\'q', 'No data yet', 'Пока нет данных')) + '</div>';
    const max = list.length ? list[0].s : 1;
    list.slice(0, 6).forEach((x) => { h += '<div class="row"><b>' + esc(x.l) + '</b><em>' + fmt(x.s) + '</em><i><s style="width:' + (x.s / max * 100).toFixed(1) + '%"></s></i></div>'; });
    h += '<div class="btns"><a class="p" href="https://levelupday.github.io/LevelUpDay/#focusgate" target="_blank">📊 ' + esc(L('Limitlar', 'Limits', 'Лимиты')) + '</a><button class="g" id="sync">↻ ' + esc(L('Yangilash', 'Refresh', 'Обновить')) + '</button></div>';
  }
  // Yangi versiya bormi? (qo'lda o'rnatilgan kengaytma o'zi yangilanmaydi)
  try {
    const v = await (await fetch('https://levelupday.github.io/LevelUpDay/downloads/version.json?t=' + Math.floor(Date.now() / 3600000), { cache: 'no-store' })).json();
    const cur = chrome.runtime.getManifest().version, nv = v && v.ext;
    const newer = nv && nv.split('.').map(Number).some((x, i, arr) => { const c = cur.split('.').map(Number); for (let j = 0; j < arr.length; j++) { if ((arr[j] || 0) !== (c[j] || 0)) return (arr[j] || 0) > (c[j] || 0); } return false; });
    if (newer) h += '<div class="note upd">🆕 ' + esc(L('Yangi versiya: ', 'New version: ', 'Новая версия: ') + nv) + ' — ' + esc(L('ZIP ni yuklab, papkadagi fayllarni almashtiring va chrome://extensions da ↻ ni bosing.', 'download the ZIP, replace the folder\'s files and press ↻ in chrome://extensions.', 'скачайте ZIP, замените файлы в папке и нажмите ↻ в chrome://extensions.')) +
      ' <a href="https://levelupday.github.io/LevelUpDay/downloads/focusgate-extension.zip" target="_blank">⬇ ZIP</a></div>';
  } catch (e) {}
  $('body').innerHTML = h;
  const p = $('pair'); if (p) p.onclick = () => { p.textContent = '…'; chrome.runtime.sendMessage({ type: 'fg:pair' }, () => render()); };
  const s = $('sync'); if (s) s.onclick = () => { s.textContent = '…'; chrome.runtime.sendMessage({ type: 'fg:sync' }, () => render()); };
}
render();
chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'fg:update') render(); });
setInterval(render, 1000);
