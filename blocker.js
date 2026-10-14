// ============================================================
// 🛡 FOCUSGATE — App blocker bo'limi (LevelUpDay ichida).
// Hozircha FAQAT DIZAYN: ma'lumotlar namuna (DEMO), tugmalar faqat ko'rinishni o'zgartiradi.
// Keyingi bosqich: Windows ilovasi / brauzer kengaytmasi orqali haqiqiy kuzatuv va bloklash.
// Bo'limlar: Bugun (statistika) · Limitlar · Bloklash (fokus + saytlar) · Sozlamalar
// Ochish: showTab('blocker') — Hub → Bo'limlar, buyruqlar paneli (Ctrl+K).
// ============================================================
(function () {
  'use strict';
  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return uz; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- Namuna ma'lumotlar ----------
  var APPS = [
    { id: 'chrome', n: 'Google Chrome', exe: 'chrome.exe', c: '#34A853', m: 96, cat: 'web' },
    { id: 'tg', n: 'Telegram Desktop', exe: 'Telegram.exe', c: '#2AABEE', m: 60, cat: 'social' },
    { id: 'code', n: 'Visual Studio Code', exe: 'Code.exe', c: '#2F80ED', m: 42, cat: 'work' },
    { id: 'discord', n: 'Discord', exe: 'Discord.exe', c: '#5865F2', m: 30, cat: 'social' },
    { id: 'steam', n: 'Steam', exe: 'steam.exe', c: '#1B2838', m: 27, cat: 'games' },
    { id: 'yt', n: 'youtube.com', exe: L('sayt', 'website', 'сайт'), c: '#FF0033', m: 18, cat: 'web', site: true },
    { id: 'ig', n: 'instagram.com', exe: L('sayt', 'website', 'сайт'), c: '#E1306C', m: 9, cat: 'social', site: true }
  ];
  var HOURS = [0, 0.7, 0, 0, 0, 0, 6, 21, 34, 0, 3, 32, 5, 9, 11, 2, 8, 15, 39, 36, 1, 0, 0, 0];
  var CATS = { all: ['Barcha toifalar', 'All categories', 'Все категории'], work: ['Ish', 'Work', 'Работа'], social: ['Ijtimoiy', 'Social', 'Соцсети'], games: ["O'yinlar", 'Games', 'Игры'], web: ['Brauzer', 'Browser', 'Браузер'] };
  var LIMITS = {
    blocked: [{ id: 'adult', icon: '🔞', n: ['Kattalar uchun saytlar', 'Adult websites', 'Сайты для взрослых'], d: ['Doimiy blok', 'Always blocked', 'Всегда заблокировано'], on: true }],
    daily: [{ app: 'chrome', used: 96, max: 90, on: true }, { app: 'discord', used: 18, max: 45, on: true }, { app: 'yt', used: 18, max: 30, on: false }]
  };
  var REMINDERS = [{ app: 'tg', every: 30, on: true, d: ['Har 30 daqiqada tanaffus eslatmasi', 'Break reminder every 30 min', 'Напоминание о перерыве каждые 30 мин'] }];
  var FOCUS_APPS = [{ app: 'steam', tag: ['Du–Ju 09:00–18:00', 'Mon–Fri 09:00–18:00', 'Пн–Пт 09:00–18:00'], on: true }, { app: 'discord', tag: ['Fokus paytida', 'During focus', 'Во время фокуса'], on: true }, { app: 'tg', tag: ['Fokus paytida', 'During focus', 'Во время фокуса'], on: false }];
  var SITES = [
    { id: 'yt', n: 'YouTube', ic: '▶', c: '#FF0033', open: true, opts: [['shorts', ["Shorts'ni bloklash", 'Block Shorts', 'Блокировать Shorts'], true], ['search', ['Video qidiruvni bloklash', 'Block video search', 'Блокировать поиск'], false], ['pip', ['Picture-in-picture rejimini bloklash', 'Block picture-in-picture', 'Блокировать «картинку в картинке»'], false], ['comments', ['Izohlarni yashirish', 'Hide comments', 'Скрыть комментарии'], true]] },
    { id: 'ig', n: 'Instagram', ic: '◎', c: '#E1306C', open: false, opts: [['reels', ["Reels'ni bloklash", 'Block Reels', 'Блокировать Reels'], true], ['explore', ["Explore'ni bloklash", 'Block Explore', 'Блокировать «Интересное»'], false], ['stories', ['Storislarni yashirish', 'Hide stories', 'Скрыть истории'], false]] },
    { id: 'tt', n: 'TikTok', ic: '♪', c: '#25F4EE', open: false, opts: [['all', ["Butunlay bloklash", 'Block completely', 'Блокировать полностью'], false]] }
  ];
  var SETTINGS = { track: true, sites: true, notif: true, strict: false, pin: false, reward: true };
  var UI = { tab: 'today', day: 0, cat: 'all', kind: 'all', chart: 'bar', setupOpen: false, limTab: 'limits', focusMin: 25 };

  function app(id) { for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i]; return null; }
  function fmt(m) {
    m = Math.round(m * 60) / 60;
    var h = Math.floor(m / 60), mm = Math.round(m % 60);
    if (m < 1) return Math.round(m * 60) + ' ' + L('s', 's', 'с');
    if (!h) return mm + ' ' + L('daq', 'min', 'мин');
    return h + ' ' + L('soat', 'h', 'ч') + (mm ? ' ' + mm + ' ' + L('daq', 'min', 'мин') : '');
  }
  function tile(a, sz) { return '<span class="fg-tile' + (sz ? ' ' + sz : '') + '" style="--tc:' + a.c + '">' + E(a.n.charAt(0).toUpperCase()) + '</span>'; }
  function sw(on, attrs) { return '<button type="button" class="fg-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" ' + attrs + '><i></i></button>'; }
  function T(a) { return L(a[0], a[1], a[2]); }
  function demoNote() { return '<div class="fg-demo">🧪 ' + E(L('Namuna ma\'lumotlar — Focusgate hozircha dizayn ko\'rinishida. Haqiqiy kuzatuv keyingi yangilanishda.', 'Sample data — Focusgate is a design preview for now. Real tracking comes in the next update.', 'Пример данных — Focusgate пока в виде дизайна. Реальное отслеживание — в следующем обновлении.')) + '</div>'; }

  // ---------- Shapka ----------
  function hero() {
    var total = APPS.reduce(function (s, a) { return s + a.m; }, 0);
    var over = LIMITS.daily.filter(function (x) { return x.on && x.used >= x.max; }).length;
    return '<div class="fg-hero">' +
      '<div class="fg-hero-l"><div class="fg-brand"><span class="fg-logo"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5 4.5 5.4v6.1c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.4L12 2.5Z" fill="rgba(255,255,255,.22)" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.6 12.2 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><b>Focusgate</b><span>' + E(L('Ilova va sayt blokeri', 'App & site blocker', 'Блокировщик приложений')) + '</span></div></div>' +
      '<span class="fg-live' + (SETTINGS.track ? '' : ' off') + '"><i></i>' + E(SETTINGS.track ? L('Kuzatuv faol', 'Tracking on', 'Отслеживание вкл.') : L('Kuzatuv o\'chiq', 'Tracking off', 'Отслеживание выкл.')) + '</span></div>' +
      '<div class="fg-kpis">' +
      '<div><b>' + E(fmt(total)) + '</b><span>⏱ ' + E(L('Bugun ekranda', 'Screen time today', 'Экран сегодня')) + '</span></div>' +
      '<div><b>' + (LIMITS.daily.filter(function (x) { return x.on; }).length + LIMITS.blocked.filter(function (x) { return x.on; }).length) + '</b><span>🔒 ' + E(L('Faol limit', 'Active limits', 'Активные лимиты')) + '</span></div>' +
      '<div class="' + (over ? 'warn' : 'ok') + '"><b>' + (over ? over : '✓') + '</b><span>' + (over ? '⚠️ ' + E(L('Limit oshdi', 'Over limit', 'Превышено')) : '🌿 ' + E(L('Limitdasiz', 'Within limits', 'В пределах'))) + '</span></div>' +
      '</div></div>';
  }
  function nav() {
    var tabs = [['today', '📊', ['Bugun', 'Today', 'Сегодня']], ['limits', '⏳', ['Limitlar', 'Limits', 'Лимиты']], ['block', '🚫', ['Bloklash', 'Block', 'Блокировка']], ['settings', '⚙️', ['Sozlamalar', 'Settings', 'Настройки']]];
    return '<div class="fg-nav" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (UI.tab === t[0]) + '" class="' + (UI.tab === t[0] ? 'on' : '') + '" data-fg-tab="' + t[0] + '"><span>' + t[1] + '</span>' + E(T(t[2])) + '</button>';
    }).join('') + '</div>';
  }

  // ---------- 📊 Bugun ----------
  function pageToday() {
    var list = APPS.filter(function (a) { return (UI.cat === 'all' || a.cat === UI.cat) && (UI.kind === 'all' || (UI.kind === 'sites') === !!a.site); });
    var total = list.reduce(function (s, a) { return s + a.m; }, 0) || 1;
    var max = Math.max.apply(null, HOURS);
    var dayLbl = UI.day === 0 ? L('Bugun', 'Today', 'Сегодня') : UI.day === -1 ? L('Kecha', 'Yesterday', 'Вчера') : (-UI.day) + ' ' + L('kun oldin', 'days ago', 'дн. назад');
    var h = '<div class="fg-bar">' +
      '<div class="fg-day"><button type="button" data-fg-day="-1" aria-label="‹">‹</button><b>' + E(dayLbl) + '</b><button type="button" data-fg-day="1" ' + (UI.day >= 0 ? 'disabled' : '') + ' aria-label="›">›</button></div>' +
      '<div class="fg-chips">' + [['all', ['Hammasi', 'All', 'Все']], ['apps', ['Dasturlar', 'Apps', 'Приложения']], ['sites', ['Saytlar', 'Sites', 'Сайты']]].map(function (k) {
        return '<button type="button" class="' + (UI.kind === k[0] ? 'on' : '') + '" data-fg-kind="' + k[0] + '">' + E(T(k[1])) + '</button>';
      }).join('') + '</div>' +
      '<select class="fg-sel" data-fg-cat>' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (UI.cat === k ? ' selected' : '') + '>' + E(T(CATS[k])) + '</option>'; }).join('') + '</select></div>';

    // Sozlashni yakunlash kartasi
    var steps = [[true, ['Focusgate hisobini yaratish', 'Create your Focusgate profile', 'Создать профиль Focusgate']], [true, ['Birinchi limitni qo\'shish', 'Add your first limit', 'Добавить первый лимит']], [false, ['Windows ilovasini o\'rnatish', 'Install the Windows app', 'Установить приложение для Windows']]];
    var done = steps.filter(function (s) { return s[0]; }).length;
    h += '<div class="fg-card fg-setup' + (UI.setupOpen ? ' open' : '') + '"><button type="button" class="fg-setup-h" data-fg-setup><span class="fg-ring" style="--p:' + Math.round(done / steps.length * 100) + '"><b>' + done + '/' + steps.length + '</b></span><span class="fg-setup-t"><b>' + E(L('Sozlashni yakunlang', 'Finish setting up', 'Завершите настройку')) + '</b><span>' + E(L('Yana bitta qadam qoldi', 'One more step to go', 'Остался один шаг')) + '</span></span><span class="fg-chev">⌄</span></button>' +
      '<div class="fg-setup-b">' + steps.map(function (s) { return '<div class="fg-step' + (s[0] ? ' done' : '') + '"><i>' + (s[0] ? '✓' : '') + '</i>' + E(T(s[1])) + (s[0] ? '' : '<button type="button" class="fg-btn sm" data-fg-soon>' + E(L('Yuklab olish', 'Download', 'Скачать')) + '</button>') + '</div>'; }).join('') + '</div></div>';

    // Soatlik grafik
    h += '<div class="fg-card fg-chart-card"><div class="fg-card-h"><b>' + E(L('Soatlar bo\'yicha', 'By hour', 'По часам')) + '</b>' +
      '<div class="fg-seg"><button type="button" class="' + (UI.chart === 'bar' ? 'on' : '') + '" data-fg-chart="bar" aria-label="bar">▮▮</button><button type="button" class="' + (UI.chart === 'line' ? 'on' : '') + '" data-fg-chart="line" aria-label="line">〰</button></div></div>';
    if (UI.chart === 'bar') {
      h += '<div class="fg-chart">' + HOURS.map(function (v, i) {
        var pct = max ? v / max * 100 : 0;
        return '<div class="fg-col' + (v ? '' : ' z') + '" title="' + i + ':00 — ' + E(fmt(v)) + '"><em>' + (v >= 1 ? Math.round(v) : v ? '<1' : '') + '</em><i style="height:' + Math.max(pct, v ? 3 : 0) + '%"></i><span>' + (i % 3 === 0 ? i : '') + '</span></div>';
      }).join('') + '</div>';
    } else {
      var pts = HOURS.map(function (v, i) { return (i / 23 * 100).toFixed(2) + ',' + (100 - (max ? v / max * 92 : 0)).toFixed(2); }).join(' ');
      h += '<div class="fg-line"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,100 ' + pts + ' 100,100" /><polyline points="' + pts + '" vector-effect="non-scaling-stroke"/></svg><div class="fg-line-x">' + [0, 6, 12, 18, 23].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div></div>';
    }
    var appsM = APPS.filter(function (a) { return !a.site; }).reduce(function (s, a) { return s + a.m; }, 0), sitesM = APPS.filter(function (a) { return a.site; }).reduce(function (s, a) { return s + a.m; }, 0);
    h += '<div class="fg-legend"><span><i class="a"></i>' + E(L('Dasturlar', 'Apps', 'Приложения')) + ' <b>' + E(fmt(appsM)) + '</b></span><span><i class="b"></i>' + E(L('Saytlar', 'Sites', 'Сайты')) + ' <b>' + E(fmt(sitesM)) + '</b></span><span class="fg-total">' + E(L('Jami', 'Total', 'Всего')) + ': <b>' + E(fmt(appsM + sitesM)) + '</b></span></div></div>';

    // 🪙 LevelUpDay bog'lanishi
    h += '<div class="fg-reward"><span>🪙</span><div><b>' + E(L('Limitda qol — tanga ol', 'Stay within limits — earn coins', 'Не превышай лимиты — получай монеты')) + '</b><span>' + E(L('Kun oxirigacha barcha limitlarda qolsangiz +10 🪙 va streakingiz davom etadi.', 'Stay under every limit until the end of the day for +10 🪙 and keep your streak.', 'Уложись во все лимиты до конца дня: +10 🪙 и серия продолжается.')) + '</span></div><em>+10</em></div>';

    // Dasturlar ro'yxati
    h += '<div class="fg-sec-t">' + E(L('Batafsil ko\'rish uchun dasturni bosing', 'Tap an app for details', 'Нажмите на приложение для деталей')) + '</div><div class="fg-list">';
    if (!list.length) h += '<div class="fg-empty">' + E(L('Bu toifada hech narsa yo\'q', 'Nothing in this category', 'В этой категории пусто')) + '</div>';
    list.forEach(function (a) {
      var lim = LIMITS.daily.filter(function (x) { return x.app === a.id && x.on; })[0];
      h += '<button type="button" class="fg-row fg-app" data-fg-app="' + a.id + '">' + tile(a) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(a.n) + '</b><small>' + E(a.exe) + '</small>' + (lim ? '<em class="fg-tag' + (lim.used >= lim.max ? ' red' : '') + '">⏳ ' + E(fmt(lim.max)) + '</em>' : '') + '</span>' +
        '<span class="fg-prog' + (lim && lim.used >= lim.max ? ' red' : '') + '"><i style="width:' + (a.m / total * 100).toFixed(1) + '%"></i></span></span>' +
        '<span class="fg-row-r"><b>' + E(fmt(a.m)) + '</b><small>' + (a.m / total * 100).toFixed(1) + '%</small></span></button>';
    });
    return h + '</div>';
  }

  // ---------- ⏳ Limitlar ----------
  function pageLimits() {
    var h = '<div class="fg-under"><button type="button" class="' + (UI.limTab === 'limits' ? 'on' : '') + '" data-fg-lt="limits">' + E(L('Limitlar', 'Limits', 'Лимиты')) + '</button><button type="button" class="' + (UI.limTab === 'rem' ? 'on' : '') + '" data-fg-lt="rem">' + E(L('Eslatmalar', 'Reminders', 'Напоминания')) + '</button></div>';
    if (UI.limTab === 'rem') {
      h += '<div class="fg-group-t">' + E(L('Tanaffus eslatmalari', 'Break reminders', 'Напоминания о перерывах')) + ' <em>' + REMINDERS.length + '</em></div><div class="fg-list">';
      REMINDERS.forEach(function (r, i) { var a = app(r.app); h += '<div class="fg-row">' + tile(a) + '<span class="fg-row-m"><b>' + E(a.n) + '</b><small>' + E(T(r.d)) + '</small></span>' + sw(r.on, 'data-fg-rem="' + i + '"') + '</div>'; });
      return h + '</div><button type="button" class="fg-add" data-fg-addlimit>＋ ' + E(L('Eslatma qo\'shish', 'Add reminder', 'Добавить напоминание')) + '</button>';
    }
    h += '<div class="fg-group-t">🚫 ' + E(L('Bloklangan', 'Blocked', 'Заблокировано')) + ' <em>' + LIMITS.blocked.length + '</em></div><div class="fg-list">';
    LIMITS.blocked.forEach(function (b, i) { h += '<div class="fg-row"><span class="fg-tile emo">' + b.icon + '</span><span class="fg-row-m"><b>' + E(T(b.n)) + '</b><small>' + E(T(b.d)) + '</small></span>' + sw(b.on, 'data-fg-blk="' + i + '"') + '</div>'; });
    h += '</div><div class="fg-group-t">⏳ ' + E(L('Kunlik limitlar', 'Daily limits', 'Дневные лимиты')) + ' <em>' + LIMITS.daily.length + '</em></div><div class="fg-list">';
    LIMITS.daily.forEach(function (d, i) {
      var a = app(d.app), over = d.used >= d.max, pct = Math.min(100, d.used / d.max * 100);
      h += '<div class="fg-row' + (d.on ? '' : ' dim') + '">' + tile(a) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(a.n) + '</b></span><small class="' + (over && d.on ? 'red' : '') + '">' + (over && d.on ? '⛔ ' + E(L('Limit tugadi — bloklandi', 'Limit reached — blocked', 'Лимит исчерпан — заблокировано')) : E(fmt(d.used) + ' / ' + fmt(d.max))) + '</small>' +
        '<span class="fg-prog' + (over ? ' red' : pct > 75 ? ' warn' : '') + '"><i style="width:' + pct + '%"></i></span></span>' + sw(d.on, 'data-fg-daily="' + i + '"') + '</div>';
    });
    return h + '</div><button type="button" class="fg-add" data-fg-addlimit>＋ ' + E(L('Limit qo\'shish', 'Add limit', 'Добавить лимит')) + '</button>';
  }

  // ---------- 🚫 Bloklash ----------
  function pageBlock() {
    var h = '<div class="fg-card fg-focus"><div class="fg-focus-l"><span class="fg-focus-k">' + E(L('Fokus sessiyasi', 'Focus session', 'Сессия фокуса')) + '</span><b class="fg-timer">' + (UI.focusMin < 10 ? '0' : '') + UI.focusMin + ':00</b>' +
      '<div class="fg-chips">' + [15, 25, 45, 60, 90].map(function (m) { return '<button type="button" class="' + (UI.focusMin === m ? 'on' : '') + '" data-fg-min="' + m + '">' + m + ' ' + E(L('daq', 'min', 'мин')) + '</button>'; }).join('') + '</div></div>' +
      '<button type="button" class="fg-btn big" data-fg-focus>▶ ' + E(L('Fokusni boshlash', 'Start focus', 'Начать фокус')) + '</button></div>';
    h += '<div class="fg-group-t">' + E(L('Fokus paytida bloklanadigan dasturlar', 'Apps blocked during focus', 'Блокируются во время фокуса')) + ' <em>' + FOCUS_APPS.length + '</em></div><div class="fg-list">';
    FOCUS_APPS.forEach(function (f, i) { var a = app(f.app); h += '<div class="fg-row' + (f.on ? '' : ' dim') + '">' + tile(a) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(a.n) + '</b><small>' + E(a.exe) + '</small></span><em class="fg-tag">' + E(T(f.tag)) + '</em></span>' + sw(f.on, 'data-fg-fa="' + i + '"') + '</div>'; });
    h += '</div><button type="button" class="fg-add" data-fg-addlimit>＋ ' + E(L('Dastur qo\'shish', 'Add app', 'Добавить приложение')) + '</button>';
    h += '<div class="fg-group-t">' + E(L('Sayt ichida bloklash', 'In-site blocking', 'Блокировка внутри сайтов')) + ' <small>· ' + E(L('brauzer kengaytmasi', 'browser extension', 'расширение браузера')) + '</small></div>';
    SITES.forEach(function (s, si) {
      var onN = s.opts.filter(function (o) { return o[2]; }).length;
      h += '<div class="fg-card fg-acc' + (s.open ? ' open' : '') + '"><button type="button" class="fg-acc-h" data-fg-site="' + si + '"><span class="fg-tile" style="--tc:' + s.c + '">' + s.ic + '</span><b>' + E(s.n) + '</b>' + (onN ? '<em class="fg-tag">' + onN + ' ' + E(L('yoqilgan', 'on', 'вкл.')) + '</em>' : '') + '<span class="fg-chev">⌄</span></button><div class="fg-acc-b">' +
        s.opts.map(function (o, oi) { return '<div class="fg-opt"><span>' + E(T(o[1])) + '</span>' + sw(o[2], 'data-fg-opt="' + si + ':' + oi + '"') + '</div>'; }).join('') + '</div></div>';
    });
    return h;
  }

  // ---------- ⚙️ Sozlamalar ----------
  function pageSettings() {
    var rows = [
      ['track', '👁', ['Foydalanish vaqtini kuzatish', 'Track usage time', 'Отслеживать время'], ['Dastur va saytlarda o\'tkazilgan vaqt hisoblanadi', 'Counts time spent in apps and sites', 'Считает время в приложениях и на сайтах']],
      ['sites', '🌐', ['Saytlarni ham kuzatish', 'Track websites too', 'Отслеживать сайты'], ['Brauzer kengaytmasi kerak bo\'ladi', 'Requires the browser extension', 'Нужно расширение браузера']],
      ['notif', '🔔', ['Limit yaqinlashganda ogohlantirish', 'Warn before a limit ends', 'Предупреждать о лимите'], ['5 daqiqa qolganda xabar beriladi', 'Notifies 5 minutes before', 'За 5 минут до конца']],
      ['reward', '🪙', ['LevelUpDay mukofotlari', 'LevelUpDay rewards', 'Награды LevelUpDay'], ['Limitda qolgan kunlar uchun tanga va XP', 'Coins and XP for days within limits', 'Монеты и XP за дни в пределах лимитов']],
      ['strict', '🔐', ['Qat\'iy rejim', 'Strict mode', 'Строгий режим'], ['Fokus paytida limitlarni o\'chirib bo\'lmaydi', 'Limits can\'t be turned off during focus', 'Во время фокуса лимиты не отключить']],
      ['pin', '🔢', ['PIN bilan himoya', 'PIN protection', 'Защита PIN-кодом'], ['Sozlamalarni o\'zgartirish uchun PIN so\'raladi', 'PIN required to change settings', 'PIN для изменения настроек']]
    ];
    var h = '<div class="fg-card fg-set">' + rows.map(function (r) {
      return '<div class="fg-opt"><span class="fg-set-ic">' + r[1] + '</span><span class="fg-set-t"><b>' + E(T(r[2])) + '</b><small>' + E(T(r[3])) + '</small></span>' + sw(SETTINGS[r[0]], 'data-fg-set="' + r[0] + '"') + '</div>';
    }).join('') + '</div>';
    h += '<div class="fg-get">' +
      '<div class="fg-card fg-get-c"><span class="fg-get-ic">🪟</span><b>' + E(L('Windows uchun Focusgate', 'Focusgate for Windows', 'Focusgate для Windows')) + '</b><span>' + E(L('Dasturlarni kuzatish va bloklash uchun kichik yordamchi ilova.', 'A small helper app that tracks and blocks programs.', 'Небольшое приложение для отслеживания и блокировки программ.')) + '</span><button type="button" class="fg-btn" data-fg-soon>⬇ ' + E(L('Tez kunda', 'Coming soon', 'Скоро')) + '</button></div>' +
      '<div class="fg-card fg-get-c"><span class="fg-get-ic">🧩</span><b>' + E(L('Brauzer kengaytmasi', 'Browser extension', 'Расширение браузера')) + '</b><span>' + E(L('Chrome / Edge: Shorts, Reels va saytlarni bloklaydi.', 'Chrome / Edge: blocks Shorts, Reels and sites.', 'Chrome / Edge: блокирует Shorts, Reels и сайты.')) + '</span><button type="button" class="fg-btn" data-fg-soon>⬇ ' + E(L('Tez kunda', 'Coming soon', 'Скоро')) + '</button></div></div>';
    return h;
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
  function openAddLimit() {
    var kinds = [['daily', '⏳', ['Kunlik limit', 'Daily limit', 'Дневной лимит'], ['Masalan: kuniga 45 daqiqa', 'e.g. 45 minutes a day', 'Например: 45 минут в день']], ['schedule', '🗓', ['Jadval bo\'yicha', 'On a schedule', 'По расписанию'], ['Ish/dars vaqtida bloklash', 'Block during work or study hours', 'Блокировать в рабочие часы']], ['always', '🚫', ['Doimiy blok', 'Always block', 'Всегда блокировать'], ['Umuman ochilmaydi', 'Never opens', 'Никогда не открывать']], ['session', '⏲', ['Seans limiti', 'Session limit', 'Лимит сессии'], ['Har ochilishda N daqiqa', 'N minutes per launch', 'N минут за запуск']]];
    var o = openSheet('<h3>＋ ' + E(L('Limit qo\'shish', 'Add limit', 'Добавить лимит')) + '</h3>' +
      '<div class="fg-lbl">' + E(L('Nimani cheklaysiz?', 'What do you want to limit?', 'Что ограничить?')) + '</div>' +
      '<div class="fg-pick">' + APPS.map(function (a, i) { return '<button type="button" class="' + (i === 0 ? 'on' : '') + '" data-fg-pick="' + a.id + '">' + tile(a, 'sm') + '<span>' + E(a.n) + '</span></button>'; }).join('') + '</div>' +
      '<div class="fg-lbl">' + E(L('Qanday cheklaysiz?', 'How do you want to limit it?', 'Как ограничить?')) + '</div>' +
      '<div class="fg-kinds">' + kinds.map(function (k, i) { return '<button type="button" class="' + (i === 0 ? 'on' : '') + '" data-fg-kindsel="' + k[0] + '"><span>' + k[1] + '</span><b>' + E(T(k[2])) + '</b><small>' + E(T(k[3])) + '</small></button>'; }).join('') + '</div>' +
      '<div class="fg-lbl">' + E(L('Kuniga qancha?', 'How much per day?', 'Сколько в день?')) + ' <b class="fg-mins">45 ' + E(L('daq', 'min', 'мин')) + '</b></div>' +
      '<input type="range" class="fg-range" min="5" max="240" step="5" value="45" data-fg-range>' +
      '<div class="fg-lbl">' + E(L('Limitga nom (ixtiyoriy)', 'Limit name (optional)', 'Название (необязательно)')) + '</div><input class="fg-in" maxlength="40" placeholder="' + E(L('Masalan: Kechqurun o\'yin yo\'q', 'e.g. No games at night', 'Например: без игр вечером')) + '">' +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-fg-save>' + E(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    function one(sel, attr) { o.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { o.querySelectorAll(sel).forEach(function (x) { x.classList.toggle('on', x === b); }); }; }); }
    one('[data-fg-pick]'); one('[data-fg-kindsel]');
    var r = o.querySelector('[data-fg-range]'), m = o.querySelector('.fg-mins');
    r.oninput = function () { m.textContent = fmt(+r.value); };
    o.querySelector('[data-fg-save]').onclick = function () { closeSheet(); soon(); };
  }
  function openApp(id) {
    var a = app(id); if (!a) return;
    var week = [62, 88, 45, 120, 71, 96, a.m], wmax = Math.max.apply(null, week), days = L('Du Se Ch Pa Ju Sh Ya', 'Mo Tu We Th Fr Sa Su', 'Пн Вт Ср Чт Пт Сб Вс').split(' ');
    var lim = LIMITS.daily.filter(function (x) { return x.app === id; })[0];
    openSheet('<div class="fg-appd">' + tile(a, 'lg') + '<div><h3>' + E(a.n) + '</h3><small>' + E(a.exe) + ' · ' + E(T(CATS[a.cat])) + '</small></div></div>' +
      '<div class="fg-kpis in"><div><b>' + E(fmt(a.m)) + '</b><span>' + E(L('Bugun', 'Today', 'Сегодня')) + '</span></div><div><b>' + E(fmt(week.reduce(function (s, x) { return s + x; }, 0) / 7)) + '</b><span>' + E(L('O\'rtacha', 'Daily avg', 'В среднем')) + '</span></div><div><b>14</b><span>' + E(L('Ochilishlar', 'Opens', 'Запусков')) + '</span></div></div>' +
      '<div class="fg-lbl">' + E(L('Oxirgi 7 kun', 'Last 7 days', 'Последние 7 дней')) + '</div><div class="fg-week">' + week.map(function (v, i) { return '<div class="' + (i === 6 ? 'now' : '') + '"><i style="height:' + (v / wmax * 100) + '%"></i><span>' + days[i] + '</span></div>'; }).join('') + '</div>' +
      (lim ? '<div class="fg-note">⏳ ' + E(L('Kunlik limit', 'Daily limit', 'Дневной лимит')) + ': <b>' + E(fmt(lim.max)) + '</b></div>' : '') +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-soon>🚫 ' + E(L('Bloklash', 'Block', 'Заблокировать')) + '</button><button type="button" class="fg-btn" data-fg-addlimit>⏳ ' + E(lim ? L('Limitni o\'zgartirish', 'Edit limit', 'Изменить лимит') : L('Limit qo\'yish', 'Set a limit', 'Поставить лимит')) + '</button></div>');
  }
  function soon() { try { toast('🛡 ' + L('Focusgate hozircha dizayn ko\'rinishida — tez orada ishlaydi!', 'Focusgate is a design preview — it will work soon!', 'Focusgate пока в виде дизайна — скоро заработает!')); } catch (e) {} }

  // ---------- Chizish ----------
  function render() {
    var v = document.getElementById('view-blocker'); if (!v) return;
    var page = UI.tab === 'limits' ? pageLimits() : UI.tab === 'block' ? pageBlock() : UI.tab === 'settings' ? pageSettings() : pageToday();
    v.innerHTML = '<div class="fg">' + hero() + nav() + '<div class="fg-page" data-p="' + UI.tab + '">' + page + '</div>' + demoNote() + '</div>';
  }
  function flip(arr, i, key) { var x = arr[+i]; if (x) x[key || 'on'] = !x[key || 'on']; }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var inView = t.closest('#view-blocker'), inSheet = t.closest('.fg-sheet');
    if (!inView && !inSheet) return;
    var b;
    if ((b = t.closest('[data-fg-soon]'))) { soon(); return; }
    if ((b = t.closest('[data-fg-addlimit]'))) { openAddLimit(); return; }
    if (!inView) return;
    if ((b = t.closest('[data-fg-tab]'))) { UI.tab = b.dataset.fgTab; render(); try { document.querySelector('#view-blocker .fg-nav').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e2) {} return; }
    if ((b = t.closest('[data-fg-day]'))) { UI.day = Math.min(0, UI.day + (+b.dataset.fgDay)); render(); return; }
    if ((b = t.closest('[data-fg-kind]'))) { UI.kind = b.dataset.fgKind; render(); return; }
    if ((b = t.closest('[data-fg-chart]'))) { UI.chart = b.dataset.fgChart; render(); return; }
    if ((b = t.closest('[data-fg-setup]'))) { UI.setupOpen = !UI.setupOpen; b.parentNode.classList.toggle('open', UI.setupOpen); return; }
    if ((b = t.closest('[data-fg-lt]'))) { UI.limTab = b.dataset.fgLt; render(); return; }
    if ((b = t.closest('[data-fg-min]'))) { UI.focusMin = +b.dataset.fgMin; render(); return; }
    if ((b = t.closest('[data-fg-focus]'))) { soon(); return; }
    if ((b = t.closest('[data-fg-site]'))) { var s = SITES[+b.dataset.fgSite]; s.open = !s.open; b.parentNode.classList.toggle('open', s.open); return; }
    if ((b = t.closest('[data-fg-app]'))) { openApp(b.dataset.fgApp); return; }
    if ((b = t.closest('.fg-sw'))) {
      var d = b.dataset;
      if (d.fgBlk != null) flip(LIMITS.blocked, d.fgBlk);
      else if (d.fgDaily != null) flip(LIMITS.daily, d.fgDaily);
      else if (d.fgRem != null) flip(REMINDERS, d.fgRem);
      else if (d.fgFa != null) flip(FOCUS_APPS, d.fgFa);
      else if (d.fgOpt != null) { var p = d.fgOpt.split(':'), o = SITES[+p[0]].opts[+p[1]]; o[2] = !o[2]; }
      else if (d.fgSet != null) SETTINGS[d.fgSet] = !SETTINGS[d.fgSet];
      var y = window.scrollY; render(); window.scrollTo(0, y);
      return;
    }
  });
  document.addEventListener('change', function (e) {
    var s = e.target; if (s && s.matches && s.matches('#view-blocker [data-fg-cat]')) { UI.cat = s.value; render(); }
  });

  window.xRenderBlocker = render;
  window.xOpenBlocker = function (tab) { if (tab) UI.tab = tab; try { showTab('blocker'); } catch (e) { render(); } };
})();
