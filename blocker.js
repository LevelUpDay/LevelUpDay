// ============================================================
// 🛡 FOCUSGATE — ilova va sayt blokeri (LevelUpDay ichida).
// Ishlash tartibi:
//   • Windows'da Focusgate.exe (focusgate-agent/) faol oynani kuzatadi, vaqtni hisoblaydi va bloklaydi.
//   • Agent ↔ server: supabase/functions/focusgate (ulash + sinxronlash). Jadvallar: fg_devices, fg_usage, fg_config.
//   • Bu sahifa: statistika (fg_usage), limitlar/fokus (fg_config.config) — agent 30 soniyada qabul qiladi.
//   • Kompyuter ulanmagan bo'lsa — ulash yo'riqnomasi va namuna (DEMO) ko'rinish.
// Ochish: showTab('blocker') · Hub → Bo'limlar · Ctrl+K · #focusgate · ulash havolasi #fgpair=XXXX-XXXX
// ============================================================
(function () {
  'use strict';
  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return uz; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(a) { return L(a[0], a[1], a[2]); }
  var AGENT_VERSION = '0.2.2'; // downloads/version.json bilan bir xil bo'lsin
  var DOWNLOAD_URL = 'downloads/Focusgate.exe?v=' + AGENT_VERSION; // ?v= — brauzer/CDN eski faylni bermasligi uchun

  // ---------- Namuna (DEMO) ma'lumotlar — kompyuter ulanmaganda ko'rsatiladi ----------
  var DEMO_APPS = [
    { id: 'chrome.exe', n: 'Google Chrome', m: 96 }, { id: 'telegram.exe', n: 'Telegram Desktop', m: 60 },
    { id: 'code.exe', n: 'Visual Studio Code', m: 42 }, { id: 'discord.exe', n: 'Discord', m: 30 },
    { id: 'steam.exe', n: 'Steam', m: 27 }, { id: 'site:youtube', n: 'YouTube', m: 18 }, { id: 'site:instagram', n: 'Instagram', m: 9 }
  ];
  var DEMO_HOURS = [0, 0.7, 0, 0, 0, 0, 6, 21, 34, 0, 3, 32, 5, 9, 11, 2, 8, 15, 39, 36, 1, 0, 0, 0];
  var DEMO_CFG = {
    track: true, notif: true, strict: false, focusUntil: 0,
    rules: [{ id: 'd1', app: 'site:pornhub', label: L('Kattalar uchun saytlar', 'Adult websites', 'Сайты для взрослых'), kind: 'always', on: true },
      { id: 'd2', app: 'chrome.exe', label: 'Google Chrome', kind: 'daily', minutes: 90, on: true },
      { id: 'd3', app: 'discord.exe', label: 'Discord', kind: 'daily', minutes: 45, on: true },
      { id: 'd4', app: 'steam.exe', label: 'Steam', kind: 'schedule', days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', on: true }],
    focusApps: [{ app: 'discord.exe', label: 'Discord', on: true }, { app: 'telegram.exe', label: 'Telegram Desktop', on: false }]
  };

  // Mashhur saytlar (agent bilan bir xil kalitlar)
  var SITES = [['site:youtube', 'YouTube', '#FF0033'], ['site:instagram', 'Instagram', '#E1306C'], ['site:tiktok', 'TikTok', '#25F4EE'],
    ['site:facebook', 'Facebook', '#1877F2'], ['site:reddit', 'Reddit', '#FF4500'], ['site:x', 'X (Twitter)', '#111111'], ['site:twitch', 'Twitch', '#9146FF'], ['site:netflix', 'Netflix', '#E50914']];
  var BRAND = { 'chrome.exe': '#34A853', 'msedge.exe': '#0C7CD5', 'firefox.exe': '#FF7139', 'telegram.exe': '#2AABEE', 'discord.exe': '#5865F2', 'steam.exe': '#1B2838', 'code.exe': '#2F80ED',
    'spotify.exe': '#1DB954', 'whatsapp.exe': '#25D366', 'winword.exe': '#2B579A', 'excel.exe': '#217346', 'powerpnt.exe': '#D24726', 'notion.exe': '#333333', 'obs64.exe': '#302E31' };
  var CAT_OF = { 'chrome.exe': 'web', 'msedge.exe': 'web', 'firefox.exe': 'web', 'brave.exe': 'web', 'opera.exe': 'web', 'telegram.exe': 'social', 'discord.exe': 'social', 'whatsapp.exe': 'social',
    'steam.exe': 'games', 'epicgameslauncher.exe': 'games', 'robloxplayerbeta.exe': 'games', 'code.exe': 'work', 'devenv.exe': 'work', 'idea64.exe': 'work', 'pycharm64.exe': 'work',
    'winword.exe': 'work', 'excel.exe': 'work', 'powerpnt.exe': 'work', 'notion.exe': 'work', 'obsidian.exe': 'work', 'site:instagram': 'social', 'site:tiktok': 'social', 'site:facebook': 'social', 'site:x': 'social', 'site:reddit': 'social', 'site:youtube': 'web' };
  var CATS = { all: ['Barcha toifalar', 'All categories', 'Все категории'], work: ['Ish', 'Work', 'Работа'], social: ['Ijtimoiy', 'Social', 'Соцсети'], games: ["O'yinlar", 'Games', 'Игры'], web: ['Brauzer', 'Browser', 'Браузер'], other: ['Boshqa', 'Other', 'Другое'] };

  // ---------- Holat ----------
  var FG = { loaded: false, loading: false, devices: [], cfg: null, rows: [], err: '', at: 0 };
  var UI = { tab: 'today', day: 0, cat: 'all', kind: 'all', chart: 'bar', setupOpen: false, focusMin: 25 };
  var LOCAL = { reward: true };

  function sbOk() { try { return !!(typeof S !== 'undefined' && S && S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.from); } catch (e) { return false; } }
  function real() { return sbOk() && FG.devices.length > 0; }
  function cfg() { return real() ? (FG.cfg || (FG.cfg = { track: true, notif: true, strict: false, rules: [], focusApps: [], focusUntil: 0 })) : DEMO_CFG; }
  function loadLocal() { try { var x = S && S.focusgate && S.focusgate.settings; if (x && typeof x.reward === 'boolean') LOCAL.reward = x.reward; } catch (e) {} }
  function saveLocal() { try { if (!S.focusgate || typeof S.focusgate !== 'object') S.focusgate = {}; S.focusgate.settings = Object.assign({}, S.focusgate.settings || {}, LOCAL); save(); } catch (e) {} }
  function dayStr(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------- Ma'lumot modeli (real yoki namuna) ----------
  function color(id) {
    if (BRAND[id]) return BRAND[id];
    for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === id) return SITES[i][2];
    var h = 0; for (var j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
    return 'hsl(' + (h % 360) + ',62%,52%)';
  }
  function niceExe(id) { return id.indexOf('site:') === 0 ? L('sayt', 'website', 'сайт') : id; }
  function mkApp(id, label, min) { return { id: id, n: label || (id.indexOf('site:') === 0 ? id.slice(5) : id.replace(/\.exe$/, '')), exe: niceExe(id), c: color(id), m: min, cat: CAT_OF[id] || (id.indexOf('site:') === 0 ? 'web' : 'other'), site: id.indexOf('site:') === 0 }; }
  // Bir kunlik ilovalar (minut) va soatlar
  function dayModel(off) {
    if (!real()) {
      if (off !== 0) return { apps: DEMO_APPS.map(function (a) { return mkApp(a.id, a.n, Math.round(a.m * (0.6 + ((a.id.length * 7 + -off * 13) % 9) / 10))); }), hours: DEMO_HOURS.map(function (v, i) { return v * (0.5 + ((i * 5 - off * 3) % 7) / 10); }) };
      return { apps: DEMO_APPS.map(function (a) { return mkApp(a.id, a.n, a.m); }), hours: DEMO_HOURS.slice() };
    }
    var d = dayStr(off), by = {}, hours = new Array(24).fill(0);
    FG.rows.forEach(function (r) {
      if (r.day !== d) return;
      var x = by[r.app] || (by[r.app] = { label: r.label, s: 0 });
      x.s += r.seconds || 0; if (r.label) x.label = r.label;
      (r.hours || []).forEach(function (v, i) { if (i < 24) hours[i] += (v || 0) / 60; });
    });
    var apps = Object.keys(by).map(function (k) { return mkApp(k, by[k].label, by[k].s / 60); }).filter(function (a) { return a.m >= 0.5; }).sort(function (a, b) { return b.m - a.m; });
    return { apps: apps, hours: hours };
  }
  function usedMin(app, off) { var a = dayModel(off || 0).apps.filter(function (x) { return x.id === app; })[0]; return a ? a.m : 0; }
  function weekOf(app) {
    var out = [];
    for (var i = -6; i <= 0; i++) out.push(app ? usedMin(app, i) : dayModel(i).apps.reduce(function (s, a) { return s + a.m; }, 0));
    return out;
  }
  function knownApps() {
    var seen = {}, out = [];
    for (var i = 0; i >= -6; i--) dayModel(i).apps.forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; out.push(a); } });
    return out;
  }
  // 💻 Kompyuterdagi barcha dasturlar (agent Start menyusi, ro'yxatga olish kitobi va jarayonlardan yig'adi)
  var DEMO_INSTALLED = [['chrome.exe', 'Google Chrome'], ['telegram.exe', 'Telegram Desktop'], ['code.exe', 'Visual Studio Code'], ['discord.exe', 'Discord'], ['steam.exe', 'Steam'],
    ['spotify.exe', 'Spotify'], ['msedge.exe', 'Microsoft Edge'], ['winword.exe', 'Word'], ['excel.exe', 'Excel'], ['obs64.exe', 'OBS Studio'], ['epicgameslauncher.exe', 'Epic Games Launcher'],
    ['vlc.exe', 'VLC media player'], ['notepad.exe', 'Notepad'], ['whatsapp.exe', 'WhatsApp'], ['robloxplayerbeta.exe', 'Roblox Player'], ['zoom.exe', 'Zoom']];
  function installed() {
    var seen = {}, out = [];
    var src = real() ? FG.devices.reduce(function (a, d) { return a.concat(Array.isArray(d.apps) ? d.apps.map(function (x) { return [x.exe, x.name]; }) : []); }, []) : DEMO_INSTALLED;
    src.forEach(function (x) { if (x[0] && !seen[x[0]]) { seen[x[0]] = 1; out.push({ id: x[0], n: x[1] || x[0] }); } });
    return out.sort(function (a, b) { return a.n.toLowerCase() < b.n.toLowerCase() ? -1 : 1; });
  }
  function labelOf(app) {
    var ins = installed().filter(function (a) { return a.id === app; })[0]; var r = (cfg().rules || []).concat(cfg().focusApps || []).filter(function (x) { return x.app === app && x.label; })[0]; if (r) return r.label; var k = knownApps().filter(function (a) { return a.id === app; })[0]; if (k) return k.n; if (ins) return ins.n; for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === app) return SITES[i][1]; return app.replace(/^site:/, '').replace(/\.exe$/, ''); }

  // ---------- Server ----------
  async function load(force) {
    if (!sbOk()) { FG.loaded = true; FG.devices = []; return; }
    if (FG.loading || (!force && Date.now() - FG.at < 20000)) return;
    FG.loading = true; FG.err = '';
    try {
      var since = dayStr(-7);
      var res = await Promise.all([
        supabase.from('fg_devices').select('id,name,last_seen,agent_version,created_at,apps,apps_at').order('created_at', { ascending: true }),
        supabase.from('fg_config').select('config').maybeSingle(),
        supabase.from('fg_usage').select('device_id,day,app,label,seconds,hours').gte('day', since).limit(5000)
      ]);
      if (res[0].error) throw res[0].error;
      FG.devices = res[0].data || [];
      var c = res[1] && res[1].data && res[1].data.config;
      // Yaqinda saqlangan bo'lsa — serverdan kelgan (eskirgan bo'lishi mumkin) nusxa ustiga yozilmaydi
      if (!FG.cfg || Date.now() - (FG.dirtyAt || 0) > 10000) FG.cfg = Object.assign({ track: true, notif: true, strict: false, rules: [], focusApps: [], focusUntil: 0 }, c || {});
      FG.rows = (res[2] && res[2].data) || [];
      FG.at = Date.now();
      try { checkReward(); } catch (e) {}
    } catch (e) { FG.err = (e && e.message) || String(e); }
    FG.loading = false; FG.loaded = true;
    rerender();
  }
  var _saveT = 0;
  function saveCfg() {
    if (!real()) return;
    FG.dirtyAt = Date.now();
    clearTimeout(_saveT);
    _saveT = setTimeout(async function () {
      try {
        var r = await supabase.from('fg_config').upsert({ user_id: S.cloudUserId, config: FG.cfg, updated_at: new Date().toISOString() });
        if (r.error) throw r.error;
        FG.dirtyAt = Date.now();
      } catch (e) { try { toast('⚠️ Focusgate: ' + L('saqlab bo\'lmadi', 'could not save', 'не удалось сохранить')); } catch (e2) {} }
    }, 350);
  }

  // 🪙 Kecha barcha kunlik limitlarda qolgan bo'lsa +10 tanga (kuniga bir marta)
  function checkReward() {
    if (!real() || !LOCAL.reward) return;
    var y = dayStr(-1);
    if (!S.focusgate) S.focusgate = {};
    if (S.focusgate.rewarded === y) return;
    var daily = (FG.cfg.rules || []).filter(function (r) { return r.on && r.kind === 'daily' && r.minutes > 0; });
    var any = FG.rows.some(function (r) { return r.day === y; });
    if (!daily.length || !any) return;
    var ok = daily.every(function (r) { return usedMin(r.app, -1) < r.minutes; });
    S.focusgate.rewarded = y;
    if (ok) {
      S.coins = (S.coins || 0) + 10;
      try { addTarixLog('in', '🛡 Focusgate: ' + L('kecha barcha limitlarda qoldingiz', 'stayed within all limits yesterday', 'вчера в пределах лимитов'), 10, 'fg-reward'); } catch (e) {}
      try { toast('🛡 +10 🪙 — ' + L('kecha barcha limitlarda qoldingiz!', 'you stayed within all limits yesterday!', 'вчера вы уложились во все лимиты!')); } catch (e) {}
    }
    save();
    try { if (typeof render === 'function') render(); } catch (e) {}
  }

  // ---------- Kichik yordamchilar ----------
  function fmt(m) {
    m = Math.max(0, Math.round(m * 60) / 60);
    var h = Math.floor(m / 60), mm = Math.round(m % 60);
    if (m < 1) return Math.round(m * 60) + ' ' + L('s', 's', 'с');
    if (!h) return mm + ' ' + L('daq', 'min', 'мин');
    if (mm === 60) { h++; mm = 0; }
    return h + ' ' + L('soat', 'h', 'ч') + (mm ? ' ' + mm + ' ' + L('daq', 'min', 'мин') : '');
  }
  function tile(a, sz) { return '<span class="fg-tile' + (sz ? ' ' + sz : '') + '" style="--tc:' + a.c + '">' + E((a.n || '?').charAt(0).toUpperCase()) + '</span>'; }
  function tileFor(app, sz) { return tile({ n: labelOf(app), c: color(app) }, sz); }
  function sw(on, attrs, dis) { return '<button type="button" class="fg-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" ' + attrs + (dis ? ' disabled' : '') + '><i></i></button>'; }
  function ago(ts) {
    if (!ts) return L('hali ulanmagan', 'never synced', 'ещё не синхр.');
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 120) return L('hozir onlayn', 'online now', 'сейчас онлайн');
    if (s < 3600) return Math.round(s / 60) + ' ' + L('daq oldin', 'min ago', 'мин назад');
    if (s < 86400) return Math.round(s / 3600) + ' ' + L('soat oldin', 'h ago', 'ч назад');
    return Math.round(s / 86400) + ' ' + L('kun oldin', 'd ago', 'дн. назад');
  }
  function online() { return FG.devices.some(function (d) { return d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 120000; }); }
  var DAYS = function () { return L('Du Se Ch Pa Ju Sh Ya', 'Mo Tu We Th Fr Sa Su', 'Пн Вт Ср Чт Пт Сб Вс').split(' '); };
  function ruleDesc(r) {
    if (r.kind === 'always') return L('Doimiy blok', 'Always blocked', 'Всегда заблокировано');
    if (r.kind === 'session') return L('Har ochilishda', 'Per launch', 'За запуск') + ' ' + fmt(r.minutes);
    if (r.kind === 'schedule') {
      var d = r.days && r.days.length && r.days.length < 7 ? r.days.map(function (x) { return DAYS()[x - 1]; }).join(', ') : L('Har kuni', 'Every day', 'Каждый день');
      return d + ' · ' + (r.from || '00:00') + '–' + (r.to || '00:00');
    }
    return '';
  }
  function demoNote() {
    return '<div class="fg-demo">🧪 ' + E(L('Bu namuna ma\'lumotlar. Kompyuteringizni ulasangiz — haqiqiy statistika va bloklash shu yerda.', 'This is sample data. Connect your computer to see real stats and blocking here.', 'Это пример. Подключите компьютер — здесь будут реальные данные и блокировка.')) + '</div>';
  }

  // ---------- Shapka ----------
  var SHIELD = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5 4.5 5.4v6.1c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.4L12 2.5Z" fill="rgba(255,255,255,.22)" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.6 12.2 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function hero() {
    var dm = dayModel(0), total = dm.apps.reduce(function (s, a) { return s + a.m; }, 0), c = cfg();
    var daily = (c.rules || []).filter(function (r) { return r.on && r.kind === 'daily'; });
    var over = daily.filter(function (r) { return usedMin(r.app, 0) >= r.minutes; }).length;
    var active = (c.rules || []).filter(function (r) { return r.on; }).length;
    var live = real() ? (online() ? ['', L('Kuzatuv faol', 'Tracking on', 'Отслеживание вкл.')] : [' warn', L('Kompyuter oflayn', 'Computer offline', 'Компьютер офлайн')]) : [' off', L('Kompyuter ulanmagan', 'No computer connected', 'Компьютер не подключён')];
    return '<div class="fg-hero">' +
      '<div class="fg-hero-l"><div class="fg-brand"><span class="fg-logo">' + SHIELD + '</span><div><b>Focusgate</b><span>' + E(L('Ilova va sayt blokeri', 'App & site blocker', 'Блокировщик приложений')) + '</span></div></div>' +
      '<span class="fg-live' + live[0] + '"><i></i>' + E(live[1]) + '</span></div>' +
      '<div class="fg-kpis">' +
      '<div><b>' + E(fmt(total)) + '</b><span>⏱ ' + E(L('Bugun ekranda', 'Screen time today', 'Экран сегодня')) + '</span></div>' +
      '<div><b>' + active + '</b><span>🔒 ' + E(L('Faol limit', 'Active limits', 'Активные лимиты')) + '</span></div>' +
      '<div class="' + (over ? 'warn' : 'ok') + '"><b>' + (over ? over : '✓') + '</b><span>' + (over ? '⚠️ ' + E(L('Limit oshdi', 'Over limit', 'Превышено')) : '🌿 ' + E(L('Limitdasiz', 'Within limits', 'В пределах'))) + '</span></div>' +
      '</div></div>';
  }
  function connectCard() {
    if (real()) return '';
    var signed = sbOk();
    return '<div class="fg-card fg-connect"><div class="fg-connect-h"><span>💻</span><div><b>' + E(L('Kompyuteringizni ulang', 'Connect your computer', 'Подключите компьютер')) + '</b><small>' + E(L('Windows 10/11 · bepul · 7 MB · v' + AGENT_VERSION, 'Windows 10/11 · free · 7 MB · v' + AGENT_VERSION, 'Windows 10/11 · бесплатно · 7 МБ · v' + AGENT_VERSION)) + '</small></div></div>' +
      '<ol class="fg-steps">' +
      '<li><b>' + E(L('Focusgate.exe ni yuklab oling', 'Download Focusgate.exe', 'Скачайте Focusgate.exe')) + '</b></li>' +
      '<li><b>' + E(L('Ishga tushiring', 'Run it', 'Запустите')) + '</b><small>' + E(L('Windows "Kompyuteringiz himoyalandi" desa: "Подробнее / More info" → "Run anyway".', 'If Windows says "Windows protected your PC": More info → Run anyway.', 'Если Windows пишет «Система защитила ваш ПК»: «Подробнее» → «Выполнить в любом случае».')) + '</small></li>' +
      '<li><b>' + E(L('Brauzer o\'zi ochiladi — "Ulash" ni bosing', 'Your browser opens — press "Connect"', 'Откроется браузер — нажмите «Подключить»')) + '</b>' + (signed ? '' : '<small class="red">' + E(L('Avval LevelUpDay akkauntingizga kiring (Profil → Sozlamalar).', 'Sign in to your LevelUpDay account first (Profile → Settings).', 'Сначала войдите в аккаунт LevelUpDay (Профиль → Настройки).')) + '</small>') + '</li></ol>' +
      '<a class="fg-btn big fg-dl" href="' + DOWNLOAD_URL + '" download="Focusgate.exe" rel="noopener">⬇ ' + E(L('Windows uchun yuklab olish', 'Download for Windows', 'Скачать для Windows')) + '</a></div>';
  }
  function nav() {
    var tabs = [['today', '📊', ['Bugun', 'Today', 'Сегодня']], ['limits', '⏳', ['Limitlar', 'Limits', 'Лимиты']], ['block', '🚫', ['Bloklash', 'Block', 'Блокировка']], ['settings', '⚙️', ['Sozlamalar', 'Settings', 'Настройки']]];
    return '<div class="fg-nav" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (UI.tab === t[0]) + '" class="' + (UI.tab === t[0] ? 'on' : '') + '" data-fg-tab="' + t[0] + '"><span>' + t[1] + '</span>' + E(T(t[2])) + '</button>';
    }).join('') + '</div>';
  }

  // ---------- 📊 Bugun ----------
  function pageToday() {
    var dm = dayModel(UI.day);
    var list = dm.apps.filter(function (a) { return (UI.cat === 'all' || a.cat === UI.cat) && (UI.kind === 'all' || (UI.kind === 'sites') === !!a.site); });
    var total = list.reduce(function (s, a) { return s + a.m; }, 0) || 1;
    var max = Math.max.apply(null, dm.hours.concat([0.0001]));
    var dayLbl = UI.day === 0 ? L('Bugun', 'Today', 'Сегодня') : UI.day === -1 ? L('Kecha', 'Yesterday', 'Вчера') : (-UI.day) + ' ' + L('kun oldin', 'days ago', 'дн. назад');
    var h = '<div class="fg-bar">' +
      '<div class="fg-day"><button type="button" data-fg-day="-1" ' + (UI.day <= -6 ? 'disabled' : '') + ' aria-label="‹">‹</button><b>' + E(dayLbl) + '</b><button type="button" data-fg-day="1" ' + (UI.day >= 0 ? 'disabled' : '') + ' aria-label="›">›</button></div>' +
      '<div class="fg-chips">' + [['all', ['Hammasi', 'All', 'Все']], ['apps', ['Dasturlar', 'Apps', 'Приложения']], ['sites', ['Saytlar', 'Sites', 'Сайты']]].map(function (k) {
        return '<button type="button" class="' + (UI.kind === k[0] ? 'on' : '') + '" data-fg-kind="' + k[0] + '">' + E(T(k[1])) + '</button>';
      }).join('') + '</div>' +
      '<select class="fg-sel" data-fg-cat>' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (UI.cat === k ? ' selected' : '') + '>' + E(T(CATS[k])) + '</option>'; }).join('') + '</select></div>';

    h += '<div class="fg-card fg-chart-card"><div class="fg-card-h"><b>' + E(L('Soatlar bo\'yicha', 'By hour', 'По часам')) + '</b>' +
      '<div class="fg-seg"><button type="button" class="' + (UI.chart === 'bar' ? 'on' : '') + '" data-fg-chart="bar" aria-label="bar">▮▮</button><button type="button" class="' + (UI.chart === 'line' ? 'on' : '') + '" data-fg-chart="line" aria-label="line">〰</button></div></div>';
    if (UI.chart === 'bar') {
      h += '<div class="fg-chart">' + dm.hours.map(function (v, i) {
        var pct = v / max * 100;
        return '<div class="fg-col' + (v >= 0.05 ? '' : ' z') + '" title="' + i + ':00 — ' + E(fmt(v)) + '"><em>' + (v >= 1 ? Math.round(v) : v >= 0.05 ? '<1' : '') + '</em><i style="height:' + Math.max(pct, v >= 0.05 ? 3 : 0) + '%"></i><span>' + (i % 3 === 0 ? i : '') + '</span></div>';
      }).join('') + '</div>';
    } else {
      var pts = dm.hours.map(function (v, i) { return (i / 23 * 100).toFixed(2) + ',' + (100 - v / max * 92).toFixed(2); }).join(' ');
      h += '<div class="fg-line"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,100 ' + pts + ' 100,100" /><polyline points="' + pts + '" vector-effect="non-scaling-stroke"/></svg><div class="fg-line-x">' + [0, 6, 12, 18, 23].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div></div>';
    }
    var appsM = dm.apps.filter(function (a) { return !a.site; }).reduce(function (s, a) { return s + a.m; }, 0), sitesM = dm.apps.filter(function (a) { return a.site; }).reduce(function (s, a) { return s + a.m; }, 0);
    h += '<div class="fg-legend"><span><i class="a"></i>' + E(L('Dasturlar', 'Apps', 'Приложения')) + ' <b>' + E(fmt(appsM)) + '</b></span><span><i class="b"></i>' + E(L('Saytlar', 'Sites', 'Сайты')) + ' <b>' + E(fmt(sitesM)) + '</b></span><span class="fg-total">' + E(L('Jami', 'Total', 'Всего')) + ': <b>' + E(fmt(appsM + sitesM)) + '</b></span></div></div>';

    if (LOCAL.reward) h += '<div class="fg-reward"><span>🪙</span><div><b>' + E(L('Limitda qol — tanga ol', 'Stay within limits — earn coins', 'Не превышай лимиты — получай монеты')) + '</b><span>' + E(L('Kun davomida barcha kunlik limitlarda qolsangiz, ertasi kuni +10 🪙 olasiz.', 'Stay under every daily limit and get +10 🪙 the next day.', 'Уложись во все дневные лимиты — получишь +10 🪙 на следующий день.')) + '</span></div><em>+10</em></div>';

    h += '<div class="fg-sec-t">' + E(L('Batafsil ko\'rish uchun dasturni bosing', 'Tap an app for details', 'Нажмите на приложение для деталей')) + '</div><div class="fg-list">';
    if (!list.length) h += '<div class="fg-empty">' + E(real() ? L('Bu kun uchun ma\'lumot yo\'q. Focusgate kompyuterda ishlayotganiga ishonch hosil qiling.', 'No data for this day yet. Make sure Focusgate is running on your PC.', 'Нет данных за этот день. Проверьте, что Focusgate запущен на ПК.') : L('Bu toifada hech narsa yo\'q', 'Nothing in this category', 'В этой категории пусто')) + '</div>';
    var rules = cfg().rules || [];
    list.forEach(function (a) {
      var lim = rules.filter(function (x) { return x.app === a.id && x.on && x.kind === 'daily'; })[0];
      var red = lim && a.m >= lim.minutes;
      h += '<button type="button" class="fg-row fg-app" data-fg-app="' + E(a.id) + '">' + tile(a) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(a.n) + '</b><small>' + E(a.exe) + '</small>' + (lim ? '<em class="fg-tag' + (red ? ' red' : '') + '">⏳ ' + E(fmt(lim.minutes)) + '</em>' : '') + '</span>' +
        '<span class="fg-prog' + (red ? ' red' : '') + '"><i style="width:' + (a.m / total * 100).toFixed(1) + '%"></i></span></span>' +
        '<span class="fg-row-r"><b>' + E(fmt(a.m)) + '</b><small>' + (a.m / total * 100).toFixed(1) + '%</small></span></button>';
    });
    return h + '</div>' + allAppsBtn();
  }

  // ---------- ⏳ Limitlar ----------
  function ruleRow(r, i) {
    var used = usedMin(r.app, 0), isDaily = r.kind === 'daily', over = isDaily && used >= r.minutes, pct = isDaily ? Math.min(100, used / r.minutes * 100) : 0;
    var sub = isDaily ? (over && r.on ? '⛔ ' + L('Limit tugadi — bloklandi', 'Limit reached — blocked', 'Лимит исчерпан — заблокировано') : fmt(used) + ' / ' + fmt(r.minutes)) : ruleDesc(r);
    return '<div class="fg-row' + (r.on ? '' : ' dim') + '">' + (r.kind === 'always' && /porn|adult|xxx/.test(r.app) ? '<span class="fg-tile emo">🔞</span>' : tileFor(r.app)) +
      '<button type="button" class="fg-row-m fg-row-btn" data-fg-edit="' + i + '"><span class="fg-row-n"><b>' + E(r.label || labelOf(r.app)) + '</b>' + (r.app.indexOf('site:') === 0 ? '<small>' + E(L('sayt', 'site', 'сайт')) + '</small>' : '') + '</span><small class="' + (over && r.on ? 'red' : '') + '">' + E(sub) + '</small>' +
      (isDaily ? '<span class="fg-prog' + (over ? ' red' : pct > 75 ? ' warn' : '') + '"><i style="width:' + pct + '%"></i></span>' : '') + '</button>' +
      sw(r.on, 'data-fg-rule="' + i + '"', cfg().strict && r.on && real()) + '</div>';
  }
  function pageLimits() {
    var rules = cfg().rules || [], h = '';
    var blocked = [], daily = [];
    rules.forEach(function (r, i) { ((r.kind === 'daily' || r.kind === 'session') ? daily : blocked).push(ruleRow(r, i)); });
    h += '<div class="fg-group-t">🚫 ' + E(L('Bloklangan', 'Blocked', 'Заблокировано')) + ' <em>' + blocked.length + '</em></div><div class="fg-list">' + (blocked.join('') || '<div class="fg-empty sm">' + E(L('Hozircha yo\'q', 'None yet', 'Пока нет')) + '</div>') + '</div>';
    h += '<div class="fg-group-t">⏳ ' + E(L('Kunlik limitlar', 'Daily limits', 'Дневные лимиты')) + ' <em>' + daily.length + '</em></div><div class="fg-list">' + (daily.join('') || '<div class="fg-empty sm">' + E(L('Hozircha yo\'q', 'None yet', 'Пока нет')) + '</div>') + '</div>';
    h += '<button type="button" class="fg-add" data-fg-addlimit>＋ ' + E(L('Limit qo\'shish', 'Add limit', 'Добавить лимит')) + '</button>' + allAppsBtn();
    if (cfg().strict && real()) h += '<div class="fg-hint">🔐 ' + E(L('Qat\'iy rejim: yoqilgan limitlarni o\'chirib yoki kamaytirib bo\'lmaydi.', 'Strict mode: active limits can\'t be turned off or loosened.', 'Строгий режим: активные лимиты нельзя отключить или ослабить.')) + '</div>';
    return h;
  }

  // ---------- 🚫 Bloklash ----------
  function focusLeft() { return Math.max(0, (cfg().focusUntil || 0) - Date.now()); }
  function mmss(ms) { var s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function pageBlock() {
    var c = cfg(), left = focusLeft(), h;
    if (left > 0) {
      h = '<div class="fg-card fg-focus on"><div class="fg-focus-l"><span class="fg-focus-k">🎯 ' + E(L('Fokus davom etmoqda', 'Focus in progress', 'Идёт фокус')) + '</span><b class="fg-timer" data-fg-live>' + mmss(left) + '</b>' +
        '<small class="fg-focus-n">' + E(L('Ro\'yxatdagi dasturlar ochilsa — darhol yopiladi.', 'Listed apps are closed as soon as they open.', 'Приложения из списка закрываются сразу.')) + '</small></div>' +
        '<button type="button" class="fg-btn big ghost" data-fg-stop' + (c.strict ? ' disabled' : '') + '>■ ' + E(c.strict ? L('Qat\'iy rejim', 'Strict mode', 'Строгий режим') : L('To\'xtatish', 'Stop', 'Остановить')) + '</button></div>';
    } else {
      h = '<div class="fg-card fg-focus"><div class="fg-focus-l"><span class="fg-focus-k">' + E(L('Fokus sessiyasi', 'Focus session', 'Сессия фокуса')) + '</span><b class="fg-timer">' + String(UI.focusMin).padStart(2, '0') + ':00</b>' +
        '<div class="fg-chips">' + [15, 25, 45, 60, 90].map(function (m) { return '<button type="button" class="' + (UI.focusMin === m ? 'on' : '') + '" data-fg-min="' + m + '">' + m + ' ' + E(L('daq', 'min', 'мин')) + '</button>'; }).join('') + '</div></div>' +
        '<button type="button" class="fg-btn big" data-fg-focus>▶ ' + E(L('Fokusni boshlash', 'Start focus', 'Начать фокус')) + '</button></div>';
    }
    var fa = c.focusApps || [];
    h += '<div class="fg-group-t">' + E(L('Fokus paytida bloklanadigan dasturlar', 'Apps blocked during focus', 'Блокируются во время фокуса')) + ' <em>' + fa.length + '</em></div><div class="fg-list">';
    fa.forEach(function (f, i) {
      h += '<div class="fg-row' + (f.on ? '' : ' dim') + '">' + tileFor(f.app) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(f.label || labelOf(f.app)) + '</b><small>' + E(niceExe(f.app)) + '</small></span><em class="fg-tag">' + E(L('Fokus paytida', 'During focus', 'Во время фокуса')) + '</em></span>' +
        (real() && !(c.strict && left > 0) ? '<button type="button" class="fg-del" data-fg-fadel="' + i + '" aria-label="×">✕</button>' : '') + sw(f.on, 'data-fg-fa="' + i + '"', c.strict && left > 0 && f.on && real()) + '</div>';
    });
    if (!fa.length) h += '<div class="fg-empty sm">' + E(L('Ro\'yxat bo\'sh — chalg\'itadigan dasturlarni qo\'shing', 'Empty — add distracting apps', 'Пусто — добавьте отвлекающие приложения')) + '</div>';
    h += '</div><button type="button" class="fg-add" data-fg-addfocus>＋ ' + E(L('Dastur qo\'shish', 'Add app', 'Добавить приложение')) + '</button>';
    // Saytlar
    h += '<div class="fg-group-t">' + E(L('Saytlarni bloklash', 'Block websites', 'Блокировка сайтов')) + ' <small>· ' + E(L('brauzer tabi avtomatik yopiladi', 'the browser tab closes automatically', 'вкладка закрывается автоматически')) + '</small></div><div class="fg-card fg-sites">';
    SITES.forEach(function (s) {
      var r = (c.rules || []).filter(function (x) { return x.app === s[0] && x.kind === 'always'; })[0];
      var on = !!(r && r.on);
      h += '<div class="fg-opt"><span class="fg-site-l"><span class="fg-tile sm" style="--tc:' + s[2] + '">' + E(s[1].charAt(0)) + '</span>' + E(s[1]) + '</span>' + sw(on, 'data-fg-site="' + s[0] + '"', c.strict && on && real()) + '</div>';
    });
    h += '</div><div class="fg-hint">🧩 ' + E(L('Shorts / Reels kabi sayt ichidagi bo\'limlarni alohida bloklash — brauzer kengaytmasida (tez kunda).', 'Blocking Shorts / Reels inside sites — coming with the browser extension.', 'Блокировка Shorts / Reels внутри сайтов — скоро в расширении.')) + '</div>';
    return h;
  }

  // ---------- ⚙️ Sozlamalar ----------
  function settingsRows() {
    var c = cfg();
    var rows = [
      ['track', '👁', ['Foydalanish vaqtini kuzatish', 'Track usage time', 'Отслеживать время'], ['Dastur va saytlarda o\'tkazilgan vaqt hisoblanadi', 'Counts time spent in apps and sites', 'Считает время в приложениях и на сайтах'], c.track !== false],
      ['notif', '🔔', ['Windows bildirishnomalari', 'Windows notifications', 'Уведомления Windows'], ['Limit tugashiga 5 daqiqa qolganda va bloklanganda', '5 minutes before a limit ends and when blocking', 'За 5 минут до лимита и при блокировке'], c.notif !== false],
      ['strict', '🔐', ['Qat\'iy rejim', 'Strict mode', 'Строгий режим'], ['Limitlarni o\'chirib, pauza qilib va fokusni to\'xtatib bo\'lmaydi', 'No turning off limits, pausing or stopping focus', 'Нельзя отключить лимиты, поставить паузу или остановить фокус'], !!c.strict],
      ['reward', '🪙', ['LevelUpDay mukofotlari', 'LevelUpDay rewards', 'Награды LevelUpDay'], ['Barcha limitlarda qolgan kun uchun +10 tanga', '+10 coins for a day within all limits', '+10 монет за день в пределах лимитов'], LOCAL.reward]
    ];
    return rows.map(function (r) {
      return '<div class="fg-opt"><span class="fg-set-ic">' + r[1] + '</span><span class="fg-set-t"><b>' + E(T(r[2])) + '</b><small>' + E(T(r[3])) + '</small></span>' + sw(r[4], 'data-fg-set="' + r[0] + '"', r[0] === 'strict' && r[4] && real()) + '</div>';
    }).join('');
  }
  function devicesHtml() {
    if (!real()) return '';
    return '<div class="fg-group-t">💻 ' + E(L('Ulangan kompyuterlar', 'Connected computers', 'Подключённые компьютеры')) + ' <em>' + FG.devices.length + '</em></div><div class="fg-list">' +
      FG.devices.map(function (d) {
        var on = d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 120000;
        return '<div class="fg-row"><span class="fg-tile" style="--tc:#3b82f6">🪟</span><span class="fg-row-m"><b>' + E(d.name || 'Windows') + '</b><small class="' + (on ? 'grn' : '') + '">' + (on ? '● ' : '') + E(ago(d.last_seen)) + (d.agent_version ? ' · v' + E(d.agent_version) : '') + (Array.isArray(d.apps) ? ' · ' + d.apps.length + ' ' + E(L('dastur', 'apps', 'прогр.')) : '') + '</small></span>' +
          '<button type="button" class="fg-btn sm ghost" data-fg-unpair="' + E(d.id) + '">' + E(L('Uzish', 'Remove', 'Отключить')) + '</button></div>';
      }).join('') + '</div>';
  }
  function getCards() {
    return '<div class="fg-get">' +
      '<div class="fg-card fg-get-c"><span class="fg-get-ic">🪟</span><b>' + E(L('Windows uchun Focusgate', 'Focusgate for Windows', 'Focusgate для Windows')) + '</b><span>' + E(L('Dasturlarni kuzatadi va bloklaydi. Soat yonida (tray) ishlaydi.', 'Tracks and blocks programs. Lives in the system tray.', 'Отслеживает и блокирует программы. Работает в трее.')) + '</span><a class="fg-btn" href="' + DOWNLOAD_URL + '" download="Focusgate.exe" rel="noopener">⬇ ' + E(L('Yuklab olish', 'Download', 'Скачать')) + '</a></div>' +
      '<div class="fg-card fg-get-c"><span class="fg-get-ic">🧩</span><b>' + E(L('Brauzer kengaytmasi', 'Browser extension', 'Расширение браузера')) + '</b><span>' + E(L('Shorts, Reels va sayt ichidagi bo\'limlarni bloklash.', 'Blocks Shorts, Reels and in-site sections.', 'Блокирует Shorts, Reels и разделы сайтов.')) + '</span><button type="button" class="fg-btn ghost" data-fg-soon>' + E(L('Tez kunda', 'Coming soon', 'Скоро')) + '</button></div></div>';
  }
  function pageSettings() {
    return '<div class="fg-card fg-set">' + settingsRows() + '</div>' + devicesHtml() + getCards() +
      '<div class="fg-hint">⚙️ ' + E(L('Bu sozlamalar Profil → Sozlamalar → Focusgate bo\'limida ham bor.', 'These settings also live in Profile → Settings → Focusgate.', 'Эти настройки также есть в Профиль → Настройки → Focusgate.')) + '</div>';
  }

  // ---------- 🧩 Ilova ichidagi kartalar: Profil → Statistika va Profil → Sozlamalar ----------
  function statsCardHtml() {
    var dm = dayModel(0), total = dm.apps.reduce(function (s, a) { return s + a.m; }, 0), max = Math.max.apply(null, dm.hours.concat([0.0001]));
    var week = weekOf(null), prev = week.slice(0, 6).filter(function (x) { return x > 0; });
    var avg = prev.length ? prev.reduce(function (s, x) { return s + x; }, 0) / prev.length : 0;
    var diff = avg ? Math.round((total - avg) / avg * 100) : 0;
    var daily = (cfg().rules || []).filter(function (r) { return r.on && r.kind === 'daily'; });
    var over = daily.filter(function (r) { return usedMin(r.app, 0) >= r.minutes; });
    var top = dm.apps.slice(0, 4);
    var h = '<div class="fg-emb-h"><span class="fg-emb-ic">' + SHIELD.replace(/26/g, '18') + '</span>' +
      '<div><b>' + E(L('Ekran vaqti', 'Screen time', 'Экранное время')) + '</b><small>Focusgate · ' + E(real() ? (online() ? L('onlayn', 'online', 'онлайн') : ago(FG.devices[0] && FG.devices[0].last_seen)) : L('namuna', 'sample', 'пример')) + '</small></div>' +
      '<button type="button" class="fg-emb-more" data-fg-go="today">' + E(L('Batafsil', 'Details', 'Подробнее')) + ' ›</button></div>';
    h += '<div class="fg-emb-kpis">' +
      '<div><b>' + E(fmt(total)) + '</b><span>' + E(L('Bugun', 'Today', 'Сегодня')) + '</span></div>' +
      '<div class="' + (diff > 0 ? 'up' : 'down') + '"><b>' + (avg ? (diff > 0 ? '▲ ' : '▼ ') + Math.abs(diff) + '%' : '—') + '</b><span>' + E(L('Haftalik o\'rtachaga', 'vs weekly avg', 'к среднему за неделю')) + '</span></div>' +
      '<div class="' + (over.length ? 'up' : 'down') + '"><b>' + (daily.length ? (daily.length - over.length) + '/' + daily.length : '—') + '</b><span>' + E(L('Limitda', 'Within limit', 'В пределах')) + '</span></div></div>';
    h += '<div class="fg-emb-spark" aria-hidden="true">' + dm.hours.map(function (v) { return '<i style="height:' + Math.max(v >= 0.05 ? 6 : 2, v / max * 100) + '%"' + (v >= 0.05 ? '' : ' class="z"') + '></i>'; }).join('') + '</div>' +
      '<div class="fg-emb-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>';
    if (top.length) {
      h += '<div class="fg-emb-top">' + top.map(function (a) {
        var lim = daily.filter(function (x) { return x.app === a.id; })[0], red = lim && a.m >= lim.minutes;
        return '<button type="button" class="fg-emb-app" data-fg-appopen="' + E(a.id) + '">' + tile(a, 'sm') + '<span class="fg-emb-n">' + E(a.n) + '</span><span class="fg-prog' + (red ? ' red' : '') + '"><i style="width:' + (a.m / top[0].m * 100).toFixed(1) + '%"></i></span><b>' + E(fmt(a.m)) + '</b></button>';
      }).join('') + '</div>';
    } else h += '<div class="fg-empty sm">' + E(L('Bugun hali ma\'lumot yo\'q', 'No data yet today', 'Сегодня пока нет данных')) + '</div>';
    if (over.length) h += '<button type="button" class="fg-emb-warn" data-fg-go="limits">⛔ ' + E(over.map(function (x) { return x.label || labelOf(x.app); }).join(', ')) + ' — ' + E(L('limit tugadi', 'limit reached', 'лимит исчерпан')) + ' ›</button>';
    if (!real()) h += '<a class="fg-emb-cta" href="' + DOWNLOAD_URL + '" download="Focusgate.exe" rel="noopener">💻 ' + E(L('Haqiqiy statistika uchun kompyuterni ulang — Focusgate.exe', 'Connect your PC for real stats — Focusgate.exe', 'Подключите ПК для реальной статистики — Focusgate.exe')) + ' ⬇</a>';
    return h;
  }
  function settingsCardHtml() {
    var c = cfg();
    var nL = (c.rules || []).filter(function (x) { return x.on; }).length, nF = (c.focusApps || []).filter(function (x) { return x.on; }).length;
    return (real() ? '' : '<div class="fg-emb-note">💻 ' + E(L('Kompyuter hali ulanmagan — quyidan Focusgate.exe ni yuklab oling.', 'No computer connected yet — download Focusgate.exe below.', 'Компьютер ещё не подключён — скачайте Focusgate.exe ниже.')) + '</div>') +
      '<div class="fg-emb-set">' + settingsRows() + '</div>' + devicesHtml() +
      '<div class="fg-emb-links">' +
      '<button type="button" data-fg-go="limits"><span>⏳</span><b>' + E(L('Limitlar', 'Limits', 'Лимиты')) + '</b><small>' + nL + ' ' + E(L('faol', 'active', 'активно')) + '</small><i>›</i></button>' +
      '<button type="button" data-fg-go="block"><span>🚫</span><b>' + E(L('Fokusda bloklash', 'Focus blocking', 'Блокировка в фокусе')) + '</b><small>' + nF + ' ' + E(L('dastur', 'apps', 'прил.')) + '</small><i>›</i></button>' +
      '<button type="button" data-fg-go="today"><span>📊</span><b>' + E(L('Ekran vaqti', 'Screen time', 'Экранное время')) + '</b><small>' + E(L('statistika', 'statistics', 'статистика')) + '</small><i>›</i></button></div>' + getCards();
  }
  function renderEmbeds() {
    loadLocal();
    var st = document.getElementById('fg-stats-card'); if (st) st.innerHTML = statsCardHtml();
    var se = document.getElementById('fg-settings-root'); if (se) se.innerHTML = settingsCardHtml();
    try { var sub = document.querySelector('#focusgate-settings-card .fg-set-sub'); if (sub) sub.textContent = L('Ekran vaqti, limitlar va bloklash', 'Screen time, limits and blocking', 'Экранное время, лимиты и блокировка'); } catch (e) {}
  }

  // ---------- Pastki oynalar (sheet) ----------
  var _sheet = null;
  function closeSheet() { if (!_sheet) return; var s = _sheet; _sheet = null; s.classList.remove('on'); setTimeout(function () { s.remove(); }, 220); document.removeEventListener('keydown', escClose, true); }
  function escClose(e) { if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); } }
  function openSheet(html) {
    closeSheet();
    var o = document.createElement('div'); o.className = 'fg-ov';
    o.innerHTML = '<div class="fg-sheet" role="dialog" aria-modal="true"><button type="button" class="fg-x" data-fg-close aria-label="×">✕</button>' + html + '</div>';
    document.body.appendChild(o); _sheet = o;
    requestAnimationFrame(function () { o.classList.add('on'); });
    o.addEventListener('click', function (e) { if (e.target === o || (e.target.closest && e.target.closest('[data-fg-close]'))) closeSheet(); });
    document.addEventListener('keydown', escClose, true);
    return o;
  }
  function needConnect() {
    openSheet('<h3>💻 ' + E(L('Avval kompyuterni ulang', 'Connect your computer first', 'Сначала подключите компьютер')) + '</h3>' + connectCard().replace('fg-card fg-connect', 'fg-connect in'));
  }
  // Nishon tanlash: so'nggi 7 kunda ishlatilganlar + mashhur saytlar + qo'lda kiritish
  function pickerHtml(sel) {
    var used = knownApps().filter(function (a) { return !a.site; }).slice(0, 10).map(function (a) { return [a.id, a.n]; });
    var usedIds = {}; used.forEach(function (x) { usedIds[x[0]] = 1; });
    var all = installed().filter(function (a) { return !usedIds[a.id]; }).map(function (a) { return [a.id, a.n]; });
    var sites = SITES.map(function (x) { return [x[0], x[1]]; });
    if (sel && !used.concat(all, sites).some(function (x) { return x[0] === sel; })) used.unshift([sel, labelOf(sel)]);
    var first = sel || (used[0] || all[0] || sites[0])[0];
    function chips(items) { return items.map(function (x) { return '<button type="button" class="' + (x[0] === first ? 'on' : '') + '" data-fg-pick="' + E(x[0]) + '" data-label="' + E(x[1]) + '" data-q="' + E((x[1] + ' ' + x[0]).toLowerCase()) + '">' + tileFor(x[0], 'sm') + '<span>' + E(x[1]) + '</span></button>'; }).join(''); }
    function grp(title, items) { return items.length ? '<div class="fg-pick-g"><div class="fg-pick-t">' + E(title) + ' <em>' + items.length + '</em></div><div class="fg-pick wrap">' + chips(items) + '</div></div>' : ''; }
    return '<input class="fg-in fg-custom" maxlength="80" autocomplete="off" placeholder="🔍 ' + E(L('Qidirish yoki yozing: game.exe, kun.uz', 'Search or type: game.exe, kun.uz', 'Поиск или ввод: game.exe, kun.uz')) + '">' +
      '<div class="fg-pickbox">' + grp(L('Ko\'p ishlatilgan', 'Most used', 'Часто используемые'), used) + grp(L('Saytlar', 'Websites', 'Сайты'), sites) +
      grp(L('Kompyuterdagi dasturlar', 'Apps on your computer', 'Программы на компьютере'), all) +
      (real() && !all.length ? '<div class="fg-pick-note">' + E(L('Dasturlar ro\'yxati Focusgate yangilangach (v0.2+) shu yerda chiqadi.', 'The full app list appears here once Focusgate updates (v0.2+).', 'Полный список появится после обновления Focusgate (v0.2+).')) + '</div>' : '') +
      '<div class="fg-pick-none" hidden>' + E(L('Topilmadi — "Saqlash" ni bossangiz, yozganingiz qo\'shiladi.', 'Not found — press "Save" to add what you typed.', 'Не найдено — нажмите «Сохранить», чтобы добавить введённое.')) + '</div></div>';
  }
  // Tanlagich: qidiruv + bitta tanlov
  function bindPicker(o) {
    var inp = o.querySelector('.fg-custom'), none = o.querySelector('.fg-pick-none');
    one(o, '[data-fg-pick]');
    inp.oninput = function () {
      var q = inp.value.trim().toLowerCase(), any = false;
      o.querySelectorAll('[data-fg-pick]').forEach(function (b) { var hit = !q || b.getAttribute('data-q').indexOf(q) !== -1; b.hidden = !hit; if (hit) any = true; if (q) b.classList.remove('on'); });
      o.querySelectorAll('.fg-pick-g').forEach(function (g) { g.hidden = !g.querySelector('[data-fg-pick]:not([hidden])'); });
      if (none) none.hidden = any || !q;
      if (q) { var vis = o.querySelectorAll('[data-fg-pick]:not([hidden])'); if (vis.length === 1) vis[0].classList.add('on'); }
    };
  }
  function readTarget(o) {
    var sb = o.querySelector('[data-fg-pick].on:not([hidden])');
    if (sb) return { app: sb.getAttribute('data-fg-pick'), label: sb.getAttribute('data-label') };
    var cu = (o.querySelector('.fg-custom').value || '').trim().toLowerCase();
    if (cu) {
      if (/\.exe$/.test(cu)) { var ex = cu.replace(/^.*[\\/]/, ''), kn = knownApps().filter(function (x) { return x.id === ex; })[0]; return { app: ex, label: kn ? kn.n : ex.replace(/\.exe$/, '') }; }
      var kw = cu.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      var base = kw.split('.')[0];
      // mashhur sayt bo'lsa — agent bilan bir xil kalit (youtube.com → site:youtube), aks holda to'liq domen (kun.uz)
      for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === 'site:' + base) return { app: SITES[i][0], label: SITES[i][1] };
      return { app: 'site:' + kw, label: kw };
    }
    return null;
  }
  function one(o, sel, cb) { o.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { o.querySelectorAll(sel).forEach(function (x) { x.classList.toggle('on', x === b); }); if (cb) cb(b); }; }); }

  function openRuleSheet(idx) {
    if (!real()) { needConnect(); return; }
    var c = cfg(), r = idx != null ? c.rules[idx] : null, strictLock = !!(c.strict && r && r.on);
    var kinds = [['daily', '⏳', ['Kunlik limit', 'Daily limit', 'Дневной лимит'], ['Masalan: kuniga 45 daqiqa', 'e.g. 45 minutes a day', 'Например: 45 минут в день']], ['schedule', '🗓', ['Jadval bo\'yicha', 'On a schedule', 'По расписанию'], ['Ish/dars vaqtida bloklash', 'Block during work or study hours', 'Блокировать в рабочие часы']], ['always', '🚫', ['Doimiy blok', 'Always block', 'Всегда блокировать'], ['Umuman ochilmaydi', 'Never opens', 'Никогда не открывать']], ['session', '⏲', ['Seans limiti', 'Session limit', 'Лимит сессии'], ['Har ochilishda N daqiqa', 'N minutes per launch', 'N минут за запуск']]];
    var kind = r ? r.kind : 'daily', mins = r && r.minutes ? r.minutes : 45, days = r && r.days && r.days.length ? r.days.slice() : [1, 2, 3, 4, 5];
    var o = openSheet('<h3>' + (r ? '✏️ ' + E(L('Limitni tahrirlash', 'Edit limit', 'Изменить лимит')) : '＋ ' + E(L('Limit qo\'shish', 'Add limit', 'Добавить лимит'))) + '</h3>' +
      '<div class="fg-lbl">' + E(L('Nimani cheklaysiz?', 'What do you want to limit?', 'Что ограничить?')) + '</div>' + pickerHtml(r && r.app) +
      '<div class="fg-lbl">' + E(L('Qanday cheklaysiz?', 'How do you want to limit it?', 'Как ограничить?')) + '</div>' +
      '<div class="fg-kinds">' + kinds.map(function (k) { return '<button type="button" class="' + (kind === k[0] ? 'on' : '') + '" data-fg-kindsel="' + k[0] + '"><span>' + k[1] + '</span><b>' + E(T(k[2])) + '</b><small>' + E(T(k[3])) + '</small></button>'; }).join('') + '</div>' +
      '<div class="fg-kopt" data-k="mins"><div class="fg-lbl">' + E(L('Necha daqiqa?', 'How many minutes?', 'Сколько минут?')) + ' <b class="fg-mins">' + E(fmt(mins)) + '</b></div><input type="range" class="fg-range" min="5" max="480" step="5" value="' + mins + '" data-fg-range></div>' +
      '<div class="fg-kopt" data-k="sched"><div class="fg-lbl">' + E(L('Kunlar va vaqt', 'Days and time', 'Дни и время')) + '</div><div class="fg-days">' + DAYS().map(function (d, i) { return '<button type="button" class="' + (days.indexOf(i + 1) !== -1 ? 'on' : '') + '" data-fg-dow="' + (i + 1) + '">' + E(d) + '</button>'; }).join('') + '</div>' +
      '<div class="fg-times"><label>' + E(L('Dan', 'From', 'С')) + '<input type="time" class="fg-in" data-fg-from value="' + E((r && r.from) || '09:00') + '"></label><label>' + E(L('Gacha', 'To', 'До')) + '<input type="time" class="fg-in" data-fg-to value="' + E((r && r.to) || '18:00') + '"></label></div></div>' +
      (strictLock ? '<div class="fg-note">🔐 ' + E(L('Qat\'iy rejim: bu limitni faqat kuchaytirish mumkin.', 'Strict mode: this limit can only be tightened.', 'Строгий режим: лимит можно только ужесточить.')) + '</div>' : '') +
      '<div class="fg-acts">' + (r && !strictLock ? '<button type="button" class="fg-btn ghost danger" data-fg-del>🗑 ' + E(L('O\'chirish', 'Delete', 'Удалить')) + '</button>' : '<button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button>') +
      '<button type="button" class="fg-btn" data-fg-save>' + E(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    function vis() { o.querySelector('[data-k="mins"]').style.display = (kind === 'daily' || kind === 'session') ? '' : 'none'; o.querySelector('[data-k="sched"]').style.display = kind === 'schedule' ? '' : 'none'; }
    bindPicker(o);
    one(o, '[data-fg-kindsel]', function (b) { kind = b.getAttribute('data-fg-kindsel'); vis(); });
    o.querySelectorAll('[data-fg-dow]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); }; });
    var rg = o.querySelector('[data-fg-range]'), mEl = o.querySelector('.fg-mins');
    rg.oninput = function () { mEl.textContent = fmt(+rg.value); };
    vis();
    var del = o.querySelector('[data-fg-del]');
    // cfg() saqlash paytida qayta olinadi — oyna ochiq turganda fonda yangilangan bo'lishi mumkin
    if (del) del.onclick = function () { var cc = cfg(), k = cc.rules.indexOf(r); if (k === -1) k = idx; cc.rules.splice(k, 1); saveCfg(); closeSheet(); rerender(); };
    o.querySelector('[data-fg-save]').onclick = function () {
      var tg = readTarget(o); if (!tg) return;
      var nr = { id: r ? r.id : 'r' + Date.now().toString(36), app: tg.app, label: tg.label, kind: kind, on: true };
      if (kind === 'daily' || kind === 'session') nr.minutes = +rg.value;
      if (kind === 'schedule') {
        nr.days = Array.prototype.map.call(o.querySelectorAll('[data-fg-dow].on'), function (b) { return +b.getAttribute('data-fg-dow'); });
        nr.from = o.querySelector('[data-fg-from]').value || '09:00'; nr.to = o.querySelector('[data-fg-to]').value || '18:00';
      }
      if (strictLock && !(nr.app === r.app && (kind === r.kind ? (kind === 'always' || (nr.minutes || 0) <= (r.minutes || 0) || kind === 'schedule') : kind === 'always'))) {
        try { toast('🔐 ' + L('Qat\'iy rejimda limitni yumshatib bo\'lmaydi', 'Strict mode: limits can\'t be loosened', 'Строгий режим: лимит нельзя ослабить')); } catch (e) {} return;
      }
      var cc = cfg();
      if (r) { var k = -1; cc.rules.forEach(function (x, i) { if (x.id === r.id) k = i; }); if (k === -1) cc.rules.push(nr); else cc.rules[k] = nr; } else cc.rules.push(nr);
      saveCfg(); closeSheet(); rerender();
      try { toast('🛡 ' + L('Saqlandi — kompyuter 30 soniyada qabul qiladi', 'Saved — your PC picks it up within 30 s', 'Сохранено — ПК получит за 30 с')); } catch (e) {}
    };
  }
  function openFocusAppSheet() {
    if (!real()) { needConnect(); return; }
    var o = openSheet('<h3>＋ ' + E(L('Fokusda bloklash', 'Block during focus', 'Блокировать в фокусе')) + '</h3><div class="fg-lbl">' + E(L('Qaysi dastur yoki sayt?', 'Which app or site?', 'Какое приложение или сайт?')) + '</div>' + pickerHtml() +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-fg-save>' + E(L('Qo\'shish', 'Add', 'Добавить')) + '</button></div>');
    bindPicker(o);
    o.querySelector('[data-fg-save]').onclick = function () {
      var tg = readTarget(o); if (!tg) return;
      var c = cfg(); c.focusApps = c.focusApps || [];
      if (!c.focusApps.some(function (f) { return f.app === tg.app; })) c.focusApps.push({ app: tg.app, label: tg.label, on: true });
      saveCfg(); closeSheet(); rerender();
    };
  }
  function openApp(id) {
    var a = knownApps().filter(function (x) { return x.id === id; })[0] || mkApp(id, labelOf(id), 0);
    var today = usedMin(id, 0), week = weekOf(id), wmax = Math.max.apply(null, week.concat([0.0001]));
    var nonzero = week.filter(function (x) { return x > 0; });
    var dn = DAYS(), labels = []; for (var i = -6; i <= 0; i++) { var d = new Date(); d.setDate(d.getDate() + i); labels.push(dn[(d.getDay() + 6) % 7]); }
    var idx = -1; (cfg().rules || []).forEach(function (x, i) { if (x.app === id && idx === -1) idx = i; });
    var lim = idx !== -1 ? cfg().rules[idx] : null;
    var o = openSheet('<div class="fg-appd">' + tile(a, 'lg') + '<div><h3>' + E(a.n) + '</h3><small>' + E(a.exe) + ' · ' + E(T(CATS[a.cat] || CATS.other)) + '</small></div></div>' +
      '<div class="fg-kpis in"><div><b>' + E(fmt(today)) + '</b><span>' + E(L('Bugun', 'Today', 'Сегодня')) + '</span></div><div><b>' + E(fmt(nonzero.length ? nonzero.reduce(function (s, x) { return s + x; }, 0) / nonzero.length : 0)) + '</b><span>' + E(L('O\'rtacha', 'Daily avg', 'В среднем')) + '</span></div><div><b>' + E(fmt(week.reduce(function (s, x) { return s + x; }, 0))) + '</b><span>' + E(L('7 kunda', '7 days', 'За 7 дней')) + '</span></div></div>' +
      '<div class="fg-lbl">' + E(L('Oxirgi 7 kun', 'Last 7 days', 'Последние 7 дней')) + '</div><div class="fg-week">' + week.map(function (v, i) { return '<div class="' + (i === 6 ? 'now' : '') + '" title="' + E(fmt(v)) + '"><i style="height:' + Math.max(v ? 4 : 0, v / wmax * 100) + '%"></i><span>' + labels[i] + '</span></div>'; }).join('') + '</div>' +
      (lim ? '<div class="fg-note">⏳ ' + E(lim.kind === 'daily' ? L('Kunlik limit', 'Daily limit', 'Дневной лимит') + ': ' + fmt(lim.minutes) : ruleDesc(lim)) + '</div>' : '') +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-blocknow>🚫 ' + E(L('Doimiy bloklash', 'Always block', 'Всегда блокировать')) + '</button><button type="button" class="fg-btn" data-fg-limitnow>⏳ ' + E(lim ? L('Limitni o\'zgartirish', 'Edit limit', 'Изменить лимит') : L('Limit qo\'yish', 'Set a limit', 'Поставить лимит')) + '</button></div>');
    o.querySelector('[data-fg-limitnow]').onclick = function () {
      if (lim) { openRuleSheet(idx); return; }
      if (!real()) { needConnect(); return; }
      var c = cfg(); c.rules.push({ id: 'r' + Date.now().toString(36), app: id, label: a.n, kind: 'daily', minutes: 60, on: true });
      openRuleSheet(c.rules.length - 1);
    };
    o.querySelector('[data-fg-blocknow]').onclick = function () {
      if (!real()) { needConnect(); return; }
      var c = cfg(); c.rules.push({ id: 'r' + Date.now().toString(36), app: id, label: a.n, kind: 'always', on: true });
      saveCfg(); closeSheet(); rerender();
      try { toast('🚫 ' + a.n + ' — ' + L('bloklandi', 'blocked', 'заблокировано')); } catch (e) {}
    };
  }
  function openAllApps() {
    var all = installed(), today = {}; dayModel(0).apps.forEach(function (a) { today[a.id] = a.m; });
    var rules = cfg().rules || [];
    var o = openSheet('<h3>💻 ' + E(L('Kompyuterdagi dasturlar', 'Apps on your computer', 'Программы на компьютере')) + ' <small class="fg-h-n">' + all.length + '</small></h3>' +
      '<input class="fg-in fg-all-q" autocomplete="off" placeholder="🔍 ' + E(L('Dastur qidirish…', 'Search apps…', 'Поиск программ…')) + '">' +
      '<div class="fg-all">' + (all.length ? all.map(function (a) {
        var r = rules.filter(function (x) { return x.app === a.id && x.on; })[0];
        return '<button type="button" class="fg-all-r" data-fg-appopen="' + E(a.id) + '" data-q="' + E((a.n + ' ' + a.id).toLowerCase()) + '">' + tileFor(a.id, 'sm') + '<span class="fg-all-n"><b>' + E(a.n) + '</b><small>' + E(a.id) + '</small></span>' +
          (r ? '<em class="fg-tag' + (r.kind === 'always' ? ' red' : '') + '">' + E(r.kind === 'daily' ? '⏳ ' + fmt(r.minutes) : r.kind === 'always' ? '🚫' : r.kind === 'schedule' ? '🗓' : '⏲') + '</em>' : '') +
          '<span class="fg-all-t">' + (today[a.id] ? E(fmt(today[a.id])) : '') + '</span><i>›</i></button>';
      }).join('') : '<div class="fg-empty">' + E(L('Ro\'yxat hali kelmagan. Focusgate\'ni yangilang (v0.2+) — bir necha daqiqada barcha dasturlar shu yerda chiqadi.', 'No list yet. Update Focusgate (v0.2+) — all apps appear here within minutes.', 'Списка пока нет. Обновите Focusgate (v0.2+) — программы появятся через пару минут.')) + '</div>') + '</div>');
    var q = o.querySelector('.fg-all-q');
    q.oninput = function () { var v = q.value.trim().toLowerCase(); o.querySelectorAll('.fg-all-r').forEach(function (r) { r.hidden = !!v && r.getAttribute('data-q').indexOf(v) === -1; }); };
    setTimeout(function () { try { if (window.matchMedia('(pointer: fine)').matches) q.focus(); } catch (e) {} }, 250);
  }
  function allAppsBtn() {
    var n = installed().length;
    return '<button type="button" class="fg-allbtn" data-fg-allapps><span>💻</span><b>' + E(L('Kompyuterdagi barcha dasturlar', 'All apps on your computer', 'Все программы на компьютере')) + '</b><em>' + (n || '—') + '</em><i>›</i></button>';
  }
  function soon() { try { toast('🧩 ' + L('Brauzer kengaytmasi tez orada!', 'Browser extension coming soon!', 'Расширение браузера скоро!')); } catch (e) {} }

  // ---------- 🔗 Kompyuterni ulash (#fgpair=XXXX-XXXX) ----------
  var _pairWait = 0;
  function pairFromHash() {
    var m = /fgpair=([A-Za-z2-9]{4}-[A-Za-z2-9]{4})/.exec(location.hash || '');
    if (!m) { if (/^#focusgate/.test(location.hash || '')) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} setTimeout(function () { window.xOpenBlocker(); }, 300); } return; }
    var code = m[1].toUpperCase();
    if (!sbOk()) {
      if (_pairWait++ < 40) { setTimeout(pairFromHash, 1500); return; } // sessiya tiklanishini kutamiz
      openSheet('<h3>🔐 ' + E(L('Avval akkauntga kiring', 'Sign in first', 'Сначала войдите')) + '</h3><p class="fg-p">' + E(L('Kompyuterni ulash uchun LevelUpDay akkauntingizga kiring, so\'ng Focusgate\'dagi "Akkauntga ulash" ni qayta bosing.', 'Sign in to your LevelUpDay account, then press "Connect account" in Focusgate again.', 'Войдите в аккаунт LevelUpDay и снова нажмите «Подключить» в Focusgate.')) + '</p>');
      return;
    }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    var o = openSheet('<div class="fg-pair"><span class="fg-pair-ic">💻</span><h3>' + E(L('Kompyuterni ulash', 'Connect computer', 'Подключить компьютер')) + '</h3>' +
      '<p class="fg-p">' + E(L('Focusgate shu kodni ko\'rsatyaptimi? Tasdiqlasangiz, kompyuter akkauntingizga ulanadi.', 'Does Focusgate show this code? Confirm to link the computer to your account.', 'Focusgate показывает этот код? Подтвердите, чтобы привязать компьютер.')) + '</p>' +
      '<div class="fg-code">' + E(code) + '</div>' +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-fg-pairok>✅ ' + E(L('Ulash', 'Connect', 'Подключить')) + '</button></div></div>');
    o.querySelector('[data-fg-pairok]').onclick = async function () {
      var b = this; b.disabled = true; b.textContent = '…';
      try {
        var r = await supabase.functions.invoke('focusgate', { body: { action: 'pair_approve', code: code } });
        var err = r.error || (r.data && r.data.error);
        if (err) throw new Error(typeof err === 'string' ? err : (err.message || 'error'));
        closeSheet();
        try { toast('✅ ' + L('Kompyuter ulandi! Bir daqiqada statistika paydo bo\'ladi.', 'Computer connected! Stats appear within a minute.', 'Компьютер подключён! Статистика появится через минуту.')); } catch (e) {}
        await load(true);
        window.xOpenBlocker('today');
      } catch (e) {
        b.disabled = false; b.textContent = L('Qayta urinish', 'Try again', 'Повторить');
        var msg = String(e && e.message || e);
        try { toast('⚠️ ' + (/expired|410/.test(msg) ? L('Kod eskirgan — Focusgate\'da "Akkauntga ulash" ni qayta bosing', 'Code expired — press "Connect account" in Focusgate again', 'Код устарел — снова нажмите «Подключить» в Focusgate') : L('Ulab bo\'lmadi: ', 'Could not connect: ', 'Не удалось: ') + msg)); } catch (e2) {}
      }
    };
  }
  window.addEventListener('hashchange', function () { _pairWait = 0; pairFromHash(); });

  // ---------- Chizish ----------
  function render() {
    loadLocal();
    var v = document.getElementById('view-blocker'); if (!v) return;
    if (!FG.loaded && sbOk()) { load(); }
    var page = UI.tab === 'limits' ? pageLimits() : UI.tab === 'block' ? pageBlock() : UI.tab === 'settings' ? pageSettings() : pageToday();
    v.innerHTML = '<div class="fg' + (real() ? ' is-real' : ' is-demo') + '">' + hero() + connectCard() + nav() + '<div class="fg-page" data-p="' + UI.tab + '">' + page + '</div>' + (real() ? '' : demoNote()) + '</div>';
  }
  function visible() { var v = document.getElementById('view-blocker'); return !!(v && v.style.display !== 'none' && v.offsetParent !== null); }
  function rerender() { if (visible()) { var y = window.scrollY; render(); window.scrollTo(0, y); } renderEmbeds(); }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var inView = t.closest('#view-blocker'), inSheet = t.closest('.fg-sheet'), inEmb = t.closest('.fg-scope');
    if (!inView && !inSheet && !inEmb) return;
    var b, c = cfg();
    if ((b = t.closest('[data-fg-soon]'))) { soon(); return; }
    if ((b = t.closest('[data-fg-go]'))) { window.xOpenBlocker(b.dataset.fgGo); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e2) {} return; }
    if ((b = t.closest('[data-fg-appopen]'))) { openApp(b.dataset.fgAppopen); return; }
    if ((b = t.closest('[data-fg-allapps]'))) { openAllApps(); return; }
    if ((b = t.closest('[data-fg-unpair]'))) {
      if (!confirm(L('Bu kompyuterni uzasizmi? Focusgate u yerda ishlashdan to\'xtaydi.', 'Remove this computer? Focusgate will stop working there.', 'Отключить этот компьютер? Focusgate перестанет там работать.'))) return;
      supabase.from('fg_devices').delete().eq('id', b.dataset.fgUnpair).then(function () { load(true); });
      return;
    }
    if ((b = t.closest('.fg-sw[data-fg-set]'))) {
      var k = b.dataset.fgSet;
      if (k === 'reward') { LOCAL.reward = !LOCAL.reward; saveLocal(); }
      else if (real()) { if (k === 'strict' && c.strict) return; c[k] = !(k === 'strict' ? c.strict : c[k] !== false); saveCfg(); }
      else { needConnect(); return; }
      rerender(); return;
    }
    if (!inView) return;
    if ((b = t.closest('[data-fg-tab]'))) { UI.tab = b.dataset.fgTab; render(); return; }
    if ((b = t.closest('[data-fg-day]'))) { UI.day = Math.max(-6, Math.min(0, UI.day + (+b.dataset.fgDay))); render(); return; }
    if ((b = t.closest('[data-fg-kind]'))) { UI.kind = b.dataset.fgKind; render(); return; }
    if ((b = t.closest('[data-fg-chart]'))) { UI.chart = b.dataset.fgChart; render(); return; }
    if ((b = t.closest('[data-fg-min]'))) { UI.focusMin = +b.dataset.fgMin; render(); return; }
    if ((b = t.closest('[data-fg-addlimit]'))) { openRuleSheet(null); return; }
    if ((b = t.closest('[data-fg-addfocus]'))) { openFocusAppSheet(); return; }
    if ((b = t.closest('[data-fg-edit]'))) { openRuleSheet(+b.dataset.fgEdit); return; }
    if ((b = t.closest('[data-fg-app]'))) { openApp(b.dataset.fgApp); return; }
    if ((b = t.closest('[data-fg-focus]'))) {
      if (!real()) { needConnect(); return; }
      if (!(c.focusApps || []).some(function (f) { return f.on; })) { try { toast('➕ ' + L('Avval fokusda bloklanadigan dastur qo\'shing', 'Add an app to block during focus first', 'Сначала добавьте приложение для блокировки')); } catch (e2) {} return; }
      c.focusUntil = Date.now() + UI.focusMin * 60000; saveCfg(); rerender();
      try { toast('🎯 ' + L('Fokus boshlandi — kompyuter 30 soniyada qabul qiladi', 'Focus started — your PC picks it up within 30 s', 'Фокус начат — ПК получит за 30 с')); } catch (e2) {}
      return;
    }
    if ((b = t.closest('[data-fg-stop]'))) { if (c.strict) return; c.focusUntil = 0; saveCfg(); rerender(); return; }
    if ((b = t.closest('[data-fg-fadel]'))) { c.focusApps.splice(+b.dataset.fgFadel, 1); saveCfg(); rerender(); return; }
    if ((b = t.closest('.fg-sw'))) {
      if (!real()) { needConnect(); return; }
      var d = b.dataset;
      if (d.fgRule != null) { var r = c.rules[+d.fgRule]; if (c.strict && r.on) return; r.on = !r.on; }
      else if (d.fgFa != null) { var f = c.focusApps[+d.fgFa]; if (c.strict && f.on && focusLeft() > 0) return; f.on = !f.on; }
      else if (d.fgSite != null) {
        var key = d.fgSite, ex = c.rules.filter(function (x) { return x.app === key && x.kind === 'always'; })[0];
        if (ex) { if (c.strict && ex.on) return; ex.on = !ex.on; }
        else { var s = SITES.filter(function (x) { return x[0] === key; })[0]; c.rules.push({ id: 'r' + Date.now().toString(36), app: key, label: s ? s[1] : key, kind: 'always', on: true }); }
      }
      saveCfg(); rerender();
    }
  });
  document.addEventListener('change', function (e) {
    var s = e.target; if (s && s.matches && s.matches('#view-blocker [data-fg-cat]')) { UI.cat = s.value; render(); }
  });
  // Fokus taymeri va avtoyangilanish
  setInterval(function () {
    var el = document.querySelector('#view-blocker [data-fg-live]');
    if (el) { var left = focusLeft(); if (left <= 0) rerender(); else el.textContent = mmss(left); }
  }, 1000);
  setInterval(function () { if (real() && (visible() || document.querySelector('#fg-stats-card'))) load(); }, 60000);

  window.xRenderBlocker = function () { render(); if (sbOk()) load(); };
  window.xOpenBlocker = function (tab) { if (tab) UI.tab = tab; try { showTab('blocker'); } catch (e) { render(); } };
  window.LUFocusgate = { renderEmbeds: function () { renderEmbeds(); if (sbOk()) load(); }, open: function (tab) { window.xOpenBlocker(tab); }, reload: function () { return load(true); }, _state: FG };
  function boot() { try { renderEmbeds(); } catch (e) {} try { pairFromHash(); } catch (e) {} setTimeout(function () { if (sbOk()) load(true); }, 2500); }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
