/* ============================================================
   🧱 BLOCKS — React Bits Pro bloklaridan ilhomlangan vanilla-JS qismlar:
     Bento 21 — Command palette: butun ilova bo'yicha qidiruv (Ctrl+K, "/")
                va "o'zi bosiladigan" klaviatura tugmalari
     Bento 14 — Fokus rejimi: jonli taymer kartasi (extras.js openFocus bilan)
     Bento 10 — Fikr-mulohaza: qoralamani tartiblab ustidan yozib chiqish
     Bento 2  — Admin: analitika grafigi + sanab chiquvchi KPI
     Stats 14 — Statistika: sparkline va o'zgarish (delta) kartalari
     Auth 4   — Kirish: orbital "ishonch halqasi"
   extras.js dan KEYIN yuklanadi. script.js/extras.js dagi kichik ulanish
   nuqtalari window.LUBlocks orqali chaqiradi.
   ============================================================ */
(function () {
  'use strict';

  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return en; }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function $(id) { return document.getElementById(id); }
  function call(fn) { try { fn(); } catch (e) { console.warn('[LUB]', e); } }
  function dk(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysBack(n) { var out = [], d = new Date(); d.setHours(12, 0, 0, 0); for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(dk(x)); } return out; }
  function isMac() { try { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent); } catch (e) { return false; } }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ============================================================
     1) COMMAND PALETTE (Bento 21)
     ============================================================ */
  function go(tab, then) { return function () { call(function () { showTab(tab); }); if (then) setTimeout(function () { call(then); }, 120); }; }
  function settingsCard(id) {
    return function () {
      call(function () { showTab('profile'); showProfileSubtab('settings'); });
      setTimeout(function () {
        var panel = $('settings-panel'); if (panel && panel.style.display === 'none') call(function () { toggleSettingsPanel(); });
        var card = $(id); if (!card) return;
        var body = card.querySelector('.settings-sub-body');
        if (body && body.style.display === 'none') call(function () { toggleSettingsSubCard(id); });
        setTimeout(function () { try { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) {} }, 60);
      }, 150);
    };
  }
  // [id, ikon, [uz,en,ru], guruh, kalit so'zlar, amal, shart?]
  function commands() {
    var A = 'act', N = 'nav', T = 'tool';
    var list = [
      ['add-task', '➕', [L('Yangi vazifa qo\'shish', 'Add new task', 'Добавить задачу')], A, 'add task new vazifa qoshish yangi задача добавить create todo', go('tasks', function () { openModal(); })],
      ['add-goal', '🎯', [L('Yangi maqsad qo\'shish', 'Add new goal', 'Добавить цель')], A, 'add goal maqsad yangi цель добавить', go('goals', function () { openGoalModal(); })],
      ['add-reward', '🎁', [L('Yangi mukofot qo\'shish', 'Add new reward', 'Добавить награду')], A, 'add reward mukofot sovga награда', go('rewards', function () { toggleAddReward(); })],
      ['focus', '⏱', [L('Fokus rejimini boshlash', 'Start focus mode', 'Режим фокуса')], A, 'focus fokus timer taymer diqqat фокус таймер', function () { window.xOpenFocus && window.xOpenFocus(); }],
      ['pomo', '🍅', ['Pomodoro'], A, 'pomodoro pomo tomato timer taymer помидор', function () { pomoOpenModal(); }],
      ['sounds', '🎶', [L('Fokus tovushlari', 'Focus sounds', 'Звуки фокуса')], A, 'music sound musiqa tovush rain yomgir звук музыка', function () { openFocusPlayer(); }],
      ['bulk', '☑️', [L('Bir nechta vazifani tanlash', 'Select multiple tasks', 'Выбрать несколько задач')], A, 'select bulk tanlash bir nechta выбрать', go('tasks', function () { toggleBulkMode(); })],
      ['trash', '🗑', [L('Savat (o\'chirilganlar)', 'Trash', 'Корзина')], A, 'trash savat deleted ochirilgan restore корзина', function () { openTrashModal(); }],
      ['feedback', '💬', [L('Fikr yoki taklif yozish', 'Send feedback or idea', 'Отзыв или идея')], A, 'feedback fikr taklif bug xato suggestion отзыв идея', function () { openFeedbackModal(); }],
      ['theme', '🌓', [L('Tungi / kunduzgi rejim', 'Toggle dark / light', 'Тёмная / светлая тема')], A, 'theme dark light tun kun tema mavzu тема', function () { toggleTheme(); }],
      ['weekly', '📅', [L('Haftalik hisobot', 'Weekly report', 'Недельный отчёт')], A, 'weekly report hafta hisobot отчёт неделя', function () { showWeeklyReport(); }],
      ['wrap', '🗓', [L('Oylik yakun', 'Monthly wrap', 'Итоги месяца')], A, 'monthly wrap oy yakun месяц итоги', function () { window.xOpenWrap && window.xOpenWrap(); }],
      ['keys', '⌨️', [L('Klaviatura yorliqlari', 'Keyboard shortcuts', 'Горячие клавиши')], A, 'keyboard shortcuts klaviatura yorliq клавиши', function () { showShortcutsHelp(); }],
      ['tasks', '📋', [L('Vazifalar', 'Tasks', 'Задачи')], N, 'tasks vazifalar todo задачи', go('tasks')],
      ['goals', '🎯', [L('Maqsadlar', 'Goals', 'Цели')], N, 'goals maqsadlar цели', go('goals')],
      ['hub', '🚀', ['Hub'], N, 'hub markaz', go('hub')],
      ['blocker', '🔒', ['Focusgate — ' + L('ilova blokeri', 'app blocker', 'блокировщик')], N, 'focusgate blocker block bloklash limit app ilova sayt блокировка лимит', go('blocker')],
      ['rewards', '🎁', [L('Mukofotlar', 'Rewards', 'Награды')], N, 'rewards mukofotlar награды', go('rewards')],
      ['profile', '👤', [L('Profil', 'Profile', 'Профиль')], N, 'profile profil профиль', go('profile', function () { showProfileSubtab('overview'); })],
      ['stats', '📊', [L('Statistika', 'Statistics', 'Статистика')], N, 'stats statistika chart grafik статистика', go('profile', function () { showProfileSubtab('stats'); })],
      ['badges', '🏅', [L('Yutuqlar', 'Achievements', 'Достижения')], N, 'badges achievements yutuqlar nishon достижения', go('profile', function () { showProfileSubtab('badges'); })],
      ['settings', '⚙️', [L('Sozlamalar', 'Settings', 'Настройки')], N, 'settings sozlamalar настройки', go('profile', function () { showProfileSubtab('settings'); })],
      ['studio', '🎨', [L('Dizayn studiyasi', 'Design studio', 'Студия дизайна')], A, 'studio studiya design dizayn color rang nik ramka frame theme цвет дизайн', function () { window.xOpenHub && window.xOpenHub('shop'); setTimeout(function () { window.xOpenStudio && window.xOpenStudio(); }, 150); }],
      ['shop', '🛍', [L('Do\'kon', 'Shop', 'Магазин')], N, 'shop dokon magazin buy sotib olish design dizayn магазин', function () { window.xOpenHub && window.xOpenHub('shop'); }],
      ['boss', '🐉', ['Boss'], N, 'boss jang босс', function () { window.xOpenHub && window.xOpenHub('boss'); }],
      ['health', '🧘', [L('Salomatlik', 'Wellbeing', 'Самочувствие')], N, 'health salomatlik sleep uyqu mood kayfiyat здоровье сон', function () { window.xOpenHub && window.xOpenHub('health'); }],
      ['together', '🤝', [L('Birga', 'Together', 'Вместе')], N, 'together birga party duel вместе', function () { window.xOpenHub && window.xOpenHub('together'); }],
      ['feed', '📰', [L('Lenta', 'Feed', 'Лента')], N, 'feed lenta news лента', function () { window.xOpenHub && window.xOpenHub('feed'); }],
      ['inbox', '📥', ['Inbox'], N, 'inbox kiruvchi', function () { window.xInbox && window.xInbox.open(); }, function () { return !!window.xInbox; }],
      ['reyting', '🏆', [L('Reyting', 'Leaderboard', 'Рейтинг')], N, 'leaderboard reyting rating top рейтинг', go('reyting')],
      ['friends', '👥', [L('Do\'stlar', 'Friends', 'Друзья')], N, 'friends dostlar друзья', function () { openFriendsModal(); }],
      ['clans', '🛡', [L('Klanlar', 'Clans', 'Кланы')], N, 'clans klan кланы', function () { window.xOpenClans && window.xOpenClans(); }],
      ['invite', '🎁', [L('Do\'stni taklif qilish', 'Invite a friend', 'Пригласить друга')], N, 'invite referral taklif пригласить', function () { window.xOpenReferral && window.xOpenReferral(); }],
      ['spin', '🎰', ['Spin'], N, 'spin baraban колесо', go('spin')],
      ['chest', '🎲', ['Chest'], N, 'chest sandiq сундук', go('chest')],
      ['tarix', '🧾', [L('Tanga tarixi', 'Coin history', 'История монет')], N, 'history tarix coins tanga история', go('tarix')],
      ['ielts', '📊', ['IELTS'], N, 'ielts exam imtihon', go('ielts')],
      ['sat', '📐', ['SAT'], N, 'sat exam imtihon', go('sat')],
      ['cefr', '📘', ['CEFR'], N, 'cefr exam imtihon', go('cefr')],
      ['admin', '📈', [L('Admin paneli', 'Admin dashboard', 'Админ-панель')], T, 'admin panel statistika', function () { window.openAdminPanel && window.openAdminPanel(); }, function () { return !!window._isAdmin; }]
    ];
    // Sozlamalar guruhlari — DOM'dan (til almashsa ham to'g'ri nom)
    try {
      document.querySelectorAll('#settings-panel .settings-sub-card[id]').forEach(function (c) {
        var ti = c.querySelector('.settings-sub-title'), sub = c.querySelector('.settings-sub-subtitle'), ic = c.querySelector('.settings-sub-icon');
        if (!ti) return;
        list.push(['set-' + c.id, ic ? ic.textContent.trim() : '⚙️', [ti.textContent.trim()], T, 'settings sozlamalar ' + (sub ? sub.textContent : ''), settingsCard(c.id)]);
      });
    } catch (e) {}
    return list.filter(function (c) { return !c[6] || c[6](); }).map(function (c) {
      return { id: c[0], icon: c[1], title: c[2][0], group: c[3], kw: norm(c[2][0] + ' ' + c[4]), run: c[5] };
    });
  }
  function taskItems() {
    var out = [];
    try {
      (S.tasks || []).forEach(function (t) {
        if (!t || !t.name) return;
        out.push({ id: 'task-' + t.id, icon: t.emoji || (t.done ? '✅' : '⬜'), title: t.name, group: 'task', kw: norm(t.name + ' ' + (t.note || '')),
          sub: t.startTime ? t.startTime : '',
          run: function () { call(function () { showTab('tasks'); }); setTimeout(function () { call(function () { openTaskSheet(t.id); }); }, 140); } });
      });
      (S.goals || []).forEach(function (g) {
        var nm = g && (g.name || g.title); if (!nm) return;
        out.push({ id: 'goal-' + (g.id || nm), icon: g.emoji || '🎯', title: nm, group: 'goal', kw: norm(nm), run: go('goals') });
      });
    } catch (e) {}
    return out;
  }
  function score(item, q) {
    if (!q) return 1;
    var kw = item.kw, t = norm(item.title);
    if (t.indexOf(q) === 0) return 100;
    if (t.indexOf(q) !== -1) return 80;
    var words = q.split(' '), all = true, sc = 0;
    words.forEach(function (w) { var i = kw.indexOf(w); if (i === -1) all = false; else sc += (i === 0 || kw.charAt(i - 1) === ' ') ? 12 : 6; });
    if (all) return 40 + sc;
    // harflar ketma-ketligi (fuzzy)
    if (q.length < 4) return 0;
    var j = 0; for (var k = 0; k < t.length && j < q.length; k++) if (t.charAt(k) === q.charAt(j)) j++;
    return j === q.length ? 20 : 0;
  }
  var RECENT_KEY = 'luCmdRecent';
  function recent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []; } catch (e) { return []; } }
  function pushRecent(id) { try { var r = recent().filter(function (x) { return x !== id; }); r.unshift(id); localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5))); } catch (e) {} }

  var CP = null;
  function groupName(g) {
    return g === 'recent' ? L('So\'nggi', 'Recent', 'Недавние') : g === 'act' ? L('Amallar', 'Actions', 'Действия') : g === 'nav' ? L('Bo\'limlar', 'Go to', 'Разделы')
      : g === 'tool' ? L('Sozlamalar', 'Settings', 'Настройки') : g === 'task' ? L('Vazifalar', 'Tasks', 'Задачи') : L('Maqsadlar', 'Goals', 'Цели');
  }
  function openPalette(initial) {
    if (CP) { CP.input.focus(); return; }
    var mod = isMac() ? '⌘' : 'Ctrl';
    var ov = el('div', 'lub-cp-ov');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="lub-cp">' +
        '<div class="lub-cp-top"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input class="lub-cp-in" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="lub-cp-list" aria-autocomplete="list" />' +
          '<kbd class="lub-k lub-k-esc" data-k="Escape">Esc</kbd></div>' +
        '<div class="lub-cp-list" id="lub-cp-list" role="listbox"></div>' +
        '<div class="lub-cp-foot">' +
          '<span><kbd class="lub-k" data-k="ArrowUp">↑</kbd><kbd class="lub-k" data-k="ArrowDown">↓</kbd> ' + H(L('tanlash', 'navigate', 'выбор')) + '</span>' +
          '<span><kbd class="lub-k" data-k="Enter">↵</kbd> ' + H(L('ochish', 'open', 'открыть')) + '</span>' +
          '<span class="lub-cp-sc"><kbd class="lub-k" data-k="Mod">' + mod + '</kbd><kbd class="lub-k" data-k="k">K</kbd></span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var input = ov.querySelector('.lub-cp-in'), listEl = ov.querySelector('.lub-cp-list');
    input.placeholder = L('Qidiring yoki buyruq yozing… (masalan: add)', 'Search or type a command… (e.g. add)', 'Поиск или команда… (например: add)');
    CP = { ov: ov, input: input, list: listEl, items: [], sel: 0, cmds: commands(), tasks: taskItems(), demo: null };
    function render() {
      var q = norm(input.value), rows = [];
      if (!q) {
        var rc = recent(), byId = {};
        CP.cmds.forEach(function (c) { byId[c.id] = c; });
        rc.forEach(function (id) { if (byId[id]) rows.push(Object.assign({}, byId[id], { group: 'recent' })); });
        CP.cmds.forEach(function (c) { if ((c.group === 'act' || c.group === 'nav') && rc.indexOf(c.id) === -1) rows.push(c); });
      } else {
        CP.cmds.concat(CP.tasks).forEach(function (c) { var s = score(c, q); if (s > 0) rows.push(Object.assign({ _s: s + (c.group === 'act' ? 6 : 0) }, c)); });
        rows.sort(function (a, b) { return b._s - a._s; });
        rows = rows.slice(0, 40);
        // guruhlab
        var order = ['act', 'nav', 'task', 'goal', 'tool'], g = {};
        rows.forEach(function (r) { (g[r.group] = g[r.group] || []).push(r); });
        rows = []; order.forEach(function (k) { if (g[k]) rows = rows.concat(g[k]); });
      }
      CP.items = rows; CP.sel = Math.min(CP.sel, Math.max(0, rows.length - 1));
      if (!rows.length) {
        listEl.innerHTML = '<div class="lub-cp-empty">🔎 ' + H(L('Hech narsa topilmadi', 'Nothing found', 'Ничего не найдено')) + '</div>';
        return;
      }
      var h = '', last = null;
      rows.forEach(function (r, i) {
        if (r.group !== last) { h += '<div class="lub-cp-g">' + H(groupName(r.group)) + '</div>'; last = r.group; }
        h += '<div class="lub-cp-it' + (i === CP.sel ? ' on' : '') + '" role="option" id="lub-cp-o' + i + '" aria-selected="' + (i === CP.sel) + '" data-i="' + i + '">' +
          '<span class="lub-cp-ic">' + H(r.icon) + '</span><span class="lub-cp-t">' + H(r.title) + '</span>' +
          (r.sub ? '<span class="lub-cp-sub">' + H(r.sub) + '</span>' : '') + '<span class="lub-cp-go">↵</span></div>';
      });
      listEl.innerHTML = h;
      input.setAttribute('aria-activedescendant', 'lub-cp-o' + CP.sel);
    }
    function move(d) {
      if (!CP.items.length) return;
      CP.sel = (CP.sel + d + CP.items.length) % CP.items.length;
      listEl.querySelectorAll('.lub-cp-it').forEach(function (n) { var on = +n.dataset.i === CP.sel; n.classList.toggle('on', on); n.setAttribute('aria-selected', on); if (on) n.scrollIntoView({ block: 'nearest' }); });
      input.setAttribute('aria-activedescendant', 'lub-cp-o' + CP.sel);
    }
    function run(i) {
      var it = CP.items[i]; if (!it) return;
      if (it.group !== 'task' && it.group !== 'goal') pushRecent(it.id);
      closePalette();
      setTimeout(function () { call(it.run); }, 30);
    }
    function press(k) {
      var keyEl = ov.querySelector('.lub-k[data-k="' + k + '"]'); if (!keyEl) return;
      keyEl.classList.remove('press'); void keyEl.offsetWidth; keyEl.classList.add('press');
      setTimeout(function () { keyEl.classList.remove('press'); }, 180);
    }
    CP.press = press;
    input.addEventListener('input', function () { CP.sel = 0; render(); stopDemo(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); press('ArrowDown'); move(1); stopDemo(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); press('ArrowUp'); move(-1); stopDemo(); }
      else if (e.key === 'Enter') { e.preventDefault(); press('Enter'); run(CP.sel); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); press('Escape'); closePalette(); }
    });
    listEl.addEventListener('mousemove', function (e) {
      var it = e.target.closest('.lub-cp-it'); if (!it || +it.dataset.i === CP.sel) return;
      CP.sel = +it.dataset.i; listEl.querySelectorAll('.lub-cp-it').forEach(function (n) { n.classList.toggle('on', +n.dataset.i === CP.sel); });
    });
    listEl.addEventListener('click', function (e) { var it = e.target.closest('.lub-cp-it'); if (it) run(+it.dataset.i); });
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) closePalette(); });
    ov.querySelector('.lub-k-esc').addEventListener('click', closePalette);
    if (initial) input.value = initial;
    render();
    requestAnimationFrame(function () { ov.classList.add('open'); });
    setTimeout(function () { input.focus(); }, 20);
    // ⌨️ "O'zi bosiladigan" tugmalar: foydalanuvchi hali hech narsa qilmasa — klavishlar o'zi bosilib, ro'yxat bo'ylab yuradi
    if (!reduced() && !initial) {
      var seq = ['ArrowDown', 'ArrowDown', 'ArrowUp'], si = 0;
      CP.demo = setTimeout(function tick() {
        if (!CP) return;
        var k = seq[si++ % seq.length]; press(k); move(k === 'ArrowDown' ? 1 : -1);
        if (si < 6) CP.demo = setTimeout(tick, 700); else { CP.sel = 0; move(0); }
      }, 900);
    }
    function stopDemo() { if (CP && CP.demo) { clearTimeout(CP.demo); CP.demo = null; } }
    CP.stopDemo = stopDemo;
  }
  function closePalette() {
    if (!CP) return;
    var ov = CP.ov; if (CP.demo) clearTimeout(CP.demo); CP = null;
    ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180);
  }
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'k') {
      e.preventDefault();
      if (CP) { CP.press && CP.press('k'); closePalette(); } else openPalette();
      return;
    }
    if (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !CP) {
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (document.querySelector('.modal-overlay.open, .x-ov, .x-focus, #welcome-survey-modal')) return;
      e.preventDefault(); openPalette();
    }
  }, true);
  function mountSearchBtn() {
    var host = $('header-actions-right');
    if (!host || $('lub-cp-btn')) return;
    var b = el('button', 'lub-cp-btn');
    b.id = 'lub-cp-btn'; b.type = 'button';
    b.title = L('Qidirish', 'Search', 'Поиск') + ' (' + (isMac() ? '⌘' : 'Ctrl') + '+K)';
    b.setAttribute('aria-label', L('Ilova bo\'yicha qidirish', 'Search the app', 'Поиск по приложению'));
    b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<span class="lub-cp-btn-t">' + H(L('Qidirish', 'Search', 'Поиск')) + '</span><kbd class="lub-cp-btn-k">' + (isMac() ? '⌘' : 'Ctrl') + ' K</kbd>';
    b.addEventListener('click', function () { openPalette(); });
    // Spin tugmasidan keyin (kompyuterda o'ng panelda — Spin ostida to'rtburchak quti)
    var spin = $('header-spin-btn');
    if (spin && spin.parentNode === host) host.insertBefore(b, spin.nextSibling); else host.appendChild(b);
  }

  /* ============================================================
     2) BENTO 14 — Fokus rejimi jonli kartasi (extras.js chaqiradi)
     ============================================================ */
  function focusTodayMin() { try { return (S.focusLog || {})[today()] || 0; } catch (e) { return 0; } }
  function focusWeek() { var log = {}; try { log = S.focusLog || {}; } catch (e) {} return daysBack(7).map(function (d) { return log[d] || 0; }); }
  function focusLiveHtml() {
    var w = focusWeek(), mx = Math.max.apply(null, w.concat([25]));
    return '<div class="lub-fl">' +
      '<div class="lub-fl-badge"><i class="lub-fl-dot"></i><span class="lub-fl-st">' + H(L('Tayyor', 'Ready', 'Готов')) + '</span></div>' +
      '<div class="lub-fl-stats"><div><b class="lub-fl-today">' + focusTodayMin() + '</b><span>' + H(L('daqiqa bugun', 'min today', 'мин сегодня')) + '</span></div>' +
      '<div class="lub-fl-week" aria-hidden="true">' + w.map(function (v, i) { return '<i style="height:' + Math.max(8, v / mx * 100) + '%"' + (i === 6 ? ' class="td"' : '') + '></i>'; }).join('') + '</div></div>' +
      '</div>';
  }
  // har kadrda: holat (live/pauza), progress, bugungi daqiqa
  function focusLiveUpdate(ov, st) {
    if (!ov) return;
    var box = ov.querySelector('.lub-fl'); if (!box) return;
    box.classList.toggle('live', !!st.running);
    box.classList.toggle('paused', !st.running && st.left < st.total && st.left > 0);
    var s = box.querySelector('.lub-fl-st');
    s.textContent = st.running ? L('Jonli', 'Live', 'В эфире') : (st.left <= 0 ? L('Tugadi', 'Done', 'Готово') : st.left < st.total ? L('Pauza', 'Paused', 'Пауза') : L('Tayyor', 'Ready', 'Готов'));
    var extra = st.running && st.started ? Math.floor((Date.now() - st.started) / 60000) : 0;
    box.querySelector('.lub-fl-today').textContent = focusTodayMin() + extra;
    var play = ov.querySelector('.x-fc-play');
    if (play) {
      var lbl = st.running ? L('Pauza', 'Pause', 'Пауза') : (st.left < st.total && st.left > 0 ? L('Davom etish', 'Resume', 'Продолжить') : L('Boshlash', 'Start', 'Старт'));
      var ic = st.running ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
      var key = st.running ? 'p' : 's';
      if (play._k !== key + lbl) { play._k = key + lbl; play.innerHTML = ic + '<span>' + H(lbl) + '</span>'; play.setAttribute('aria-label', lbl); }
    }
  }

  /* ============================================================
     3) BENTO 10 — Qoralamani tartiblash (ustidan yozib chiqadi)
     Eslatma: bu sun'iy intellekt emas — matn qoidalar asosida tozalanadi
     (bo'shliqlar, tinish belgilari, katta harf, o'zbekcha apostroflar).
     ============================================================ */
  function polishText(src) {
    var s = String(src || '').replace(/\r/g, '');
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    s = s.replace(/\s+([,.!?;:])/g, '$1').replace(/([,.!?;:])(?=[^\s\d,.!?;:)"'»])/g, '$1 ');
    s = s.replace(/([!?.]){2,}/g, '$1');
    // o'zbekcha: o' g' — to'g'ri apostrof (ʻ), qolganlari ʼ
    s = s.replace(/([oOgG])['`‘’ʼ]/g, '$1ʻ').replace(/(\p{L})['`‘’](\p{L})/gu, '$1ʼ$2');
    s = s.replace(/\bi\b/g, 'I');
    var lines = s.split('\n').map(function (ln) {
      ln = ln.trim(); if (!ln) return '';
      ln = ln.replace(/(^|[.!?]\s+)(\p{Ll})/gu, function (m, a, c) { return a + c.toUpperCase(); });
      if (!/[.!?…:)»"]$/.test(ln) && !/^[-•*\d]/.test(ln)) ln += '.';
      return ln;
    });
    return lines.join('\n').trim();
  }
  function typeOver(ta, target, done) {
    var from = ta.value;
    if (reduced()) { ta.value = target; if (done) done(); return; }
    var i = 0, common = 0;
    while (common < from.length && common < target.length && from.charAt(common) === target.charAt(common)) common++;
    ta.classList.add('lub-typing');
    // 1) farq qilgan qismni "o'chirib", 2) yangi matnni yozib chiqadi
    var cut = from.length;
    var step = Math.max(1, Math.round((from.length - common) / 40));
    var t1 = setInterval(function () {
      cut = Math.max(common, cut - step); ta.value = from.slice(0, cut);
      if (cut <= common) {
        clearInterval(t1); i = common;
        var step2 = Math.max(1, Math.round((target.length - common) / 70));
        var t2 = setInterval(function () {
          i = Math.min(target.length, i + step2); ta.value = target.slice(0, i); ta.scrollTop = ta.scrollHeight;
          if (i >= target.length) { clearInterval(t2); ta.classList.remove('lub-typing'); if (done) done(); }
        }, 16);
      }
    }, 12);
  }
  function mountFeedbackRewrite() {
    var ta = $('fb-text'); if (!ta || $('lub-rw-bar')) return;
    var bar = el('div', 'lub-rw-bar'); bar.id = 'lub-rw-bar';
    bar.innerHTML = '<button type="button" class="lub-rw-btn"><span class="lub-rw-spark">✨</span><span>' + H(L('Matnni tartiblash', 'Polish my text', 'Привести в порядок')) + '</span></button>' +
      '<button type="button" class="lub-rw-undo" hidden>↩ ' + H(L('Asl matn', 'Original', 'Исходный')) + '</button>' +
      '<span class="lub-rw-note">' + H(L('Bo\'shliq, tinish belgisi va katta harflarni to\'g\'rilaydi', 'Fixes spacing, punctuation and capitals', 'Исправит пробелы, знаки и заглавные')) + '</span>';
    ta.parentNode.insertBefore(bar, ta.nextSibling);
    var btn = bar.querySelector('.lub-rw-btn'), undo = bar.querySelector('.lub-rw-undo'), orig = null;
    btn.onclick = function () {
      var src = ta.value;
      if (!src.trim()) { try { toast('✍️ ' + L('Avval biror narsa yozing', 'Write something first', 'Сначала напишите что-нибудь')); } catch (e) {} ta.focus(); return; }
      var out = polishText(src);
      if (out === src) { try { toast('✅ ' + L('Matn allaqachon toza', 'Already looks clean', 'Текст уже в порядке')); } catch (e) {} return; }
      orig = src; btn.disabled = true; bar.classList.add('busy');
      typeOver(ta, out, function () {
        btn.disabled = false; bar.classList.remove('busy'); undo.hidden = false;
        try { ta.dispatchEvent(new Event('input')); } catch (e) {}
      });
    };
    undo.onclick = function () { if (orig == null) return; ta.value = orig; orig = null; undo.hidden = true; try { ta.dispatchEvent(new Event('input')); } catch (e) {} };
  }
  // Fikr oynasi ochilganini kuzatamiz
  try {
    new MutationObserver(function () { if ($('feedback-modal')) mountFeedbackRewrite(); }).observe(document.body, { childList: true });
  } catch (e) {}

  /* ============================================================
     4) BENTO 2 — Admin: analitika grafigi + sanaladigan KPI
     ============================================================ */
  function countUp(node, to, ms) {
    to = +to || 0;
    if (reduced()) { node.textContent = to.toLocaleString(); return; }
    var t0 = performance.now();
    (function f(now) {
      var p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(to * e).toLocaleString();
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  function areaPath(vals, w, h, pad) {
    var mx = Math.max.apply(null, vals.concat([1])), n = vals.length;
    var pts = vals.map(function (v, i) { return [pad + (n > 1 ? i * (w - pad * 2) / (n - 1) : 0), h - pad - (v / mx) * (h - pad * 2)]; });
    var d = pts.map(function (p, i) {
      if (!i) return 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      var q = pts[i - 1], cx = (q[0] + p[0]) / 2;
      return 'C' + cx.toFixed(1) + ' ' + q[1].toFixed(1) + ' ' + cx.toFixed(1) + ' ' + p[1].toFixed(1) + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    return { line: d, area: d + ' L' + pts[n - 1][0].toFixed(1) + ' ' + (h - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - pad) + ' Z', pts: pts };
  }
  function adminHeroHtml(d) {
    var ad = (d && d.active_by_day) || [], T = (d && d.totals) || {};
    if (!ad.length) return '';
    var vals = ad.map(function (x) { return +x.n || 0; });
    var half = Math.floor(vals.length / 2), a = 0, b = 0;
    vals.forEach(function (v, i) { if (i < half) a += v; else b += v; });
    var delta = a ? Math.round((b - a) / a * 100) : (b ? 100 : 0);
    var W = 640, Hh = 180, P = 8, g = areaPath(vals, W, Hh, P);
    return '<div class="lub-ah" data-vals="' + vals.join(',') + '" data-days="' + ad.map(function (x) { return x.d; }).join(',') + '">' +
      '<div class="lub-ah-kpi"><div class="lub-ah-l">👥 ' + H(L('Jami foydalanuvchi', 'Total users', 'Всего пользователей')) + '</div>' +
        '<div class="lub-ah-n" data-to="' + (+T.users || 0) + '">0</div>' +
        '<div class="lub-ah-d ' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% <span>' + H(L('faollik, 15 kun oldingiga nisbatan', 'activity vs previous 15 days', 'активность к прошлым 15 дням')) + '</span></div>' +
        '<div class="lub-ah-mini"><span><b data-to="' + (+T.dau || 0) + '">0</b> DAU</span><span><b data-to="' + (+T.wau || 0) + '">0</b> WAU</span><span><b data-to="' + (+T.mau || 0) + '">0</b> MAU</span></div></div>' +
      '<div class="lub-ah-chart"><div class="lub-ah-ct">🔥 ' + H(L('Kunlik faol (30 kun)', 'Daily active (30 days)', 'Активные по дням (30 дн)')) + '</div>' +
        '<svg viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" class="lub-ah-svg" role="img" aria-label="' + H(L('Kunlik faol foydalanuvchilar grafigi', 'Daily active users chart', 'График активных пользователей')) + '">' +
          '<defs><linearGradient id="lubAhG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
          '<path class="lub-ah-area" d="' + g.area + '" fill="url(#lubAhG)"/><path class="lub-ah-line" d="' + g.line + '" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>' +
          '<line class="lub-ah-cur" x1="0" x2="0" y1="0" y2="' + Hh + '" vector-effect="non-scaling-stroke"/></svg>' +
        '<div class="lub-ah-tip"></div></div>' +
      '</div>';
  }
  function bindAdminHero(box) {
    var h = box && box.querySelector('.lub-ah'); if (!h) return;
    h.querySelectorAll('[data-to]').forEach(function (n, i) { countUp(n, n.getAttribute('data-to'), i ? 900 : 1400); });
    var line = h.querySelector('.lub-ah-line');
    try { var len = line.getTotalLength(); if (!reduced()) { line.style.strokeDasharray = len; line.style.strokeDashoffset = len; requestAnimationFrame(function () { line.style.transition = 'stroke-dashoffset 1.2s ease'; line.style.strokeDashoffset = '0'; }); } } catch (e) {}
    var vals = h.dataset.vals.split(',').map(Number), days = h.dataset.days.split(',');
    var chart = h.querySelector('.lub-ah-chart'), svg = h.querySelector('svg'), cur = h.querySelector('.lub-ah-cur'), tip = h.querySelector('.lub-ah-tip');
    function show(e) {
      var r = svg.getBoundingClientRect(), x = Math.max(0, Math.min(r.width, e.clientX - r.left));
      var i = Math.round(x / r.width * (vals.length - 1));
      var vx = 8 + i * (640 - 16) / (vals.length - 1);
      cur.setAttribute('x1', vx); cur.setAttribute('x2', vx); cur.style.opacity = 1;
      var p = String(days[i] || '').split('-');
      tip.innerHTML = '<b>' + vals[i] + '</b> ' + H(L('faol', 'active', 'активных')) + '<span>' + (p.length === 3 ? +p[2] + '.' + p[1] : '') + '</span>';
      tip.style.left = (vx / 640 * r.width) + 'px'; tip.style.opacity = 1;
    }
    chart.addEventListener('pointermove', show);
    chart.addEventListener('pointerdown', show);
    chart.addEventListener('pointerleave', function () { cur.style.opacity = 0; tip.style.opacity = 0; });
  }

  /* ============================================================
     5) STATS 14 — sparkline + delta kartalari (Profil → Statistika)
     ============================================================ */
  function series14() {
    var days = daysBack(14), z = function () { return days.map(function () { return 0; }); };
    var tasks = z(), coins = z(), focus = z(), sleep = z(), idx = {};
    days.forEach(function (d, i) { idx[d] = i; });
    try { var dl = S.taskDoneLog || {}; Object.keys(dl).forEach(function (id) { (dl[id] || []).forEach(function (d) { if (idx[d] != null) tasks[idx[d]]++; }); }); } catch (e) {}
    try { (S.tarix || []).forEach(function (it) { if (it && it.amount > 0 && idx[it.date] != null) coins[idx[it.date]] += it.amount; }); } catch (e) {}
    try { var fl = S.focusLog || {}; days.forEach(function (d, i) { focus[i] = fl[d] || 0; }); } catch (e) {}
    try { var hs = S.health || {}; days.forEach(function (d, i) { var v = hs[d] && hs[d].sleep; sleep[i] = v ? +v : 0; }); } catch (e) {}
    return { tasks: tasks, coins: coins, focus: focus, sleep: sleep };
  }
  function spark(vals, color) {
    var W = 120, Hh = 36, g = areaPath(vals, W, Hh, 3), last = g.pts[g.pts.length - 1];
    var id = 'lubsp' + Math.random().toString(36).slice(2, 7);
    return '<svg class="lub-sp" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + g.area + '" fill="url(#' + id + ')"/><path class="lub-sp-l" d="' + g.line + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="' + color + '"/></svg>';
  }
  function statCard(icon, label, vals, fmt, color, avg) {
    var a = vals.slice(0, 7), b = vals.slice(7);
    var sum = function (x) { return x.reduce(function (s, v) { return s + v; }, 0); };
    var cnt = function (x) { return x.filter(function (v) { return v > 0; }).length; };
    var cur = avg ? (cnt(b) ? sum(b) / cnt(b) : 0) : sum(b), prev = avg ? (cnt(a) ? sum(a) / cnt(a) : 0) : sum(a);
    var delta = prev ? Math.round((cur - prev) / prev * 100) : (cur ? 100 : 0);
    var cls = !cur && !prev ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    return '<div class="lub-sc">' +
      '<div class="lub-sc-top"><span class="lub-sc-l">' + icon + ' ' + H(label) + '</span><span class="lub-sc-d ' + cls + '">' + (cls === 'up' ? '▲' : cls === 'down' ? '▼' : '•') + ' ' + Math.abs(delta) + '%</span></div>' +
      '<div class="lub-sc-v">' + H(fmt(cur)) + '</div>' + spark(vals, color) +
      '<div class="lub-sc-f">' + H(L('7 kun · o\'tgan haftaga nisbatan', '7 days · vs prior week', '7 дней · к прошлой неделе')) + '</div></div>';
  }
  function renderStatCards() {
    var host = $('profile-subtab-stats'); if (!host) return;
    var box = $('lub-stat-cards');
    if (!box) {
      box = el('div', 'lub-scs'); box.id = 'lub-stat-cards';
      var after = host.querySelector('.xst-reports');
      if (after && after.nextSibling) host.insertBefore(box, after.nextSibling); else host.insertBefore(box, host.firstChild);
    }
    var s = series14();
    box.innerHTML =
      statCard('✅', L('Bajarilgan vazifalar', 'Tasks done', 'Выполнено задач'), s.tasks, function (v) { return String(Math.round(v)); }, '#34D399') +
      statCard('🪙', L('Topilgan tanga', 'Coins earned', 'Заработано монет'), s.coins, function (v) { return String(Math.round(v)); }, '#F5A623') +
      statCard('⏱', L('Fokus vaqti', 'Focus time', 'Время фокуса'), s.focus, function (v) { var m = Math.round(v); return m >= 60 ? Math.floor(m / 60) + L(' soat ', 'h ', ' ч ') + (m % 60) + L(' daq', 'm', ' мин') : m + L(' daq', ' min', ' мин'); }, '#A78BFA') +
      statCard('😴', L('O\'rtacha uyqu', 'Avg sleep', 'Средний сон'), s.sleep, function (v) { return v ? (Math.round(v * 10) / 10) + L(' soat', ' h', ' ч') : '—'; }, '#60A5FA', true);
  }

  /* ============================================================
     6) AUTH 4 — orbital "ishonch halqasi"
     ============================================================ */
  function orbitHtml() {
    var items = [['🔵', 'Google'], ['📧', 'Email'], ['✈️', 'Telegram'], ['🔒', L('Xavfsiz', 'Secure', 'Защищено')], ['☁️', L('Bulut', 'Cloud', 'Облако')], ['⚡', L('Tez', 'Fast', 'Быстро')]];
    return '<div class="lub-orb" aria-hidden="true"><div class="lub-orb-ring r1"></div><div class="lub-orb-ring r2"></div>' +
      '<div class="lub-orb-spin">' + items.map(function (x, i) { return '<span class="lub-orb-it" style="--a:' + (i * 360 / items.length) + 'deg" title="' + H(x[1]) + '"><i>' + x[0] + '</i></span>'; }).join('') + '</div>' +
      '<div class="lub-orb-core"><img src="icons/logo.svg" alt="" width="40" height="40"/></div></div>' +
      '<div class="lub-orb-cap">🔐 ' + H(L('Ma\'lumotlaringiz shifrlangan holda saqlanadi', 'Your data is stored encrypted', 'Ваши данные хранятся в зашифрованном виде')) + '</div>';
  }

  /* ============================================================
     7) 🎰 SPIN sahifasi — taymer, statistika, so'nggi yutuqlar, sovrinlar
     ============================================================ */
  function spinLog(prize) {
    try {
      if (!prize) return;
      S.spinHistory = Array.isArray(S.spinHistory) ? S.spinHistory : [];
      S.spinHistory.unshift({ d: today(), l: String(prize.label || ''), c: String(prize.color || '#7C5CFC'), t: String(prize.type || '') });
      if (S.spinHistory.length > 12) S.spinHistory.length = 12;
      S.spinTotal = (S.spinTotal || 0) + 1;
      if (prize.type === 'coins') S.spinCoinsWon = (S.spinCoinsWon || 0) + (prize.coins || 0);
      setTimeout(renderSpinDeck, 400);
    } catch (e) {}
  }
  function spinCountdownText() {
    var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    var d = Math.max(0, next - now), h = Math.floor(d / 3600000), m = Math.floor(d % 3600000 / 60000), s = Math.floor(d % 60000 / 1000);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  var _spinTick = 0;
  function renderSpinDeck() {
    var view = $('view-spin'); if (!view) return;
    var hero = view.firstElementChild; if (!hero) return;
    hero.classList.add('lub-spin-hero');
    if (!hero.querySelector('.lub-spin-title')) {
      var tt = el('div', 'lub-spin-title');
      tt.innerHTML = '<b>🎰 ' + H(L('Kunlik Spin', 'Daily Spin', 'Ежедневный спин')) + '</b><span>' + H(L('Har kuni 1 ta tekin aylantirish — tanga, olmos, XP va boshqa sovg\'alar', 'One free spin every day — coins, gems, XP and more', 'Один бесплатный спин в день — монеты, алмазы, XP и другое')) + '</span>';
      hero.insertBefore(tt, hero.firstChild);
    }
    var deck = $('lub-spin-deck');
    if (!deck) { deck = el('div', 'lub-spin-deck'); deck.id = 'lub-spin-deck'; view.appendChild(deck); }
    var done = false; try { done = hasSpunToday(); } catch (e) {}
    var hist = Array.isArray(S.spinHistory) ? S.spinHistory : [];
    // Sovrinlar jadvali — tur bo'yicha jamlangan ehtimollar
    var groups = {}, total = 0;
    try {
      SPIN_PRIZES.forEach(function (p) {
        var w = p.weight || 1; total += w;
        var key = p.type === 'coins' ? 'c' + p.coins : p.type;
        if (!groups[key]) groups[key] = { label: p.label, color: p.color, w: 0, type: p.type, coins: p.coins || 0 };
        groups[key].w += w;
      });
    } catch (e) {}
    var rows = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.w - a.w; });
    var pct = function (w) { var v = w / total * 100; return v >= 10 ? Math.round(v) + '%' : (Math.round(v * 10) / 10) + '%'; };
    deck.innerHTML =
      '<div class="lub-sd-card lub-sd-timer' + (done ? '' : ' ready') + '"><div class="lub-sd-h">⏳ ' + H(L('Keyingi tekin spin', 'Next free spin', 'Следующий бесплатный спин')) + '</div>' +
        (done ? '<div class="lub-sd-big" id="lub-spin-cd">' + spinCountdownText() + '</div><div class="lub-sd-sub">' + H(L('Yarim tunda yangilanadi', 'Resets at midnight', 'Обновится в полночь')) + '</div>'
          : '<div class="lub-sd-big ok">✨ ' + H(L('Hozir tayyor!', 'Ready now!', 'Готово!')) + '</div><div class="lub-sd-sub">' + H(L('Tugmani bosing va omadingizni sinang', 'Hit the button and try your luck', 'Жмите кнопку и испытайте удачу')) + '</div>') +
      '</div>' +
      '<div class="lub-sd-card"><div class="lub-sd-h">📊 ' + H(L('Statistika', 'Stats', 'Статистика')) + '</div>' +
        '<div class="lub-sd-stats"><div><b>' + (S.spinTotal || 0) + '</b><span>' + H(L('jami spin', 'total spins', 'всего спинов')) + '</span></div>' +
        '<div><b>' + (S.spinCoinsWon || 0) + ' 🪙</b><span>' + H(L('yutilgan tanga', 'coins won', 'выиграно монет')) + '</span></div></div>' +
        '<div class="lub-sd-h sm">🕘 ' + H(L('So\'nggi yutuqlar', 'Recent wins', 'Последние призы')) + '</div>' +
        (hist.length ? '<div class="lub-sd-hist">' + hist.slice(0, 8).map(function (x) { return '<span style="--c:' + H(x.c) + '" title="' + H(x.d) + '">' + H(x.l) + '</span>'; }).join('') + '</div>'
          : '<div class="lub-sd-sub">' + H(L('Hali spin qilinmagan', 'No spins yet', 'Спинов ещё не было')) + '</div>') +
      '</div>' +
      '<div class="lub-sd-card lub-sd-prizes"><div class="lub-sd-h">🎁 ' + H(L('Sovrinlar va ehtimollar', 'Prizes & odds', 'Призы и шансы')) + '</div>' +
        '<div class="lub-sd-list">' + rows.map(function (r) {
          return '<div class="lub-sd-row"><i style="background:' + H(r.color) + '"></i><span>' + H(r.label) + '</span><b>' + pct(r.w) + '</b><em style="--w:' + Math.max(2, r.w / rows[0].w * 100) + '%;--c:' + H(r.color) + '"></em></div>';
        }).join('') + '</div></div>';
    clearInterval(_spinTick);
    if (done) _spinTick = setInterval(function () {
      var n = $('lub-spin-cd');
      if (!n || view.style.display === 'none') { clearInterval(_spinTick); return; }
      n.textContent = spinCountdownText();
    }, 1000);
  }

  /* ============================================================
     8) Masonry — Statistika va Sozlamalar: ustunlar mustaqil oqadi (bo'sh joy qolmaydi)
     ============================================================ */
  var MAS = [
    { sel: '#profile-subtab-stats', mq: '(min-width: 1000px)', full: function (c) { return c.matches('.pf-kpis, .xst-reports, #pomo-stats-card, #lub-stat-cards'); } },
    { sel: '#settings-panel .settings-groups-grid', mq: '(min-width: 900px)', full: function () { return false; } }
  ];
  function unMasonry(box) {
    Array.prototype.slice.call(box.querySelectorAll(':scope > .lub-mas')).forEach(function (w) {
      var items = [];
      w.querySelectorAll(':scope > .lub-mas-col > *').forEach(function (n) { items.push(n); });
      items.sort(function (a, b) { return (+a.dataset.masI) - (+b.dataset.masI); });
      items.forEach(function (n) { box.insertBefore(n, w); });
      w.remove();
    });
    box.classList.remove('lub-masonry');
  }
  function doMasonry(cfg) {
    var box = document.querySelector(cfg.sel); if (!box) return;
    unMasonry(box);
    var on = false; try { on = window.matchMedia(cfg.mq).matches; } catch (e) {}
    if (!on) return;
    var kids = Array.prototype.slice.call(box.children), seg = [], segs = [];
    kids.forEach(function (c, i) {
      c.dataset.masI = i;
      if (cfg.full(c) || getComputedStyle(c).display === 'none') { if (seg.length) segs.push(seg); seg = []; return; }
      seg.push(c);
    });
    if (seg.length) segs.push(seg);
    segs.forEach(function (items) {
      if (items.length < 2) return;
      var w = el('div', 'lub-mas'), a = el('div', 'lub-mas-col'), b = el('div', 'lub-mas-col');
      w.appendChild(a); w.appendChild(b);
      box.insertBefore(w, items[0]);
      var ha = 0, hb = 0;
      items.forEach(function (n, i) {
        var h = n.offsetHeight || 0;
        // balandlik ma'lum bo'lsa — qisqa ustunga, aks holda navbatma-navbat
        var toA = h ? ha <= hb : i % 2 === 0;
        (toA ? a : b).appendChild(n);
        if (toA) ha += h + 12; else hb += h + 12;
      });
    });
    box.classList.add('lub-masonry');
  }
  function masonryAll() { MAS.forEach(function (c) { try { doMasonry(c); } catch (e) { console.warn('[LUB] masonry', e); } }); }
  var _masT = 0;
  function masonrySoon(ms) { clearTimeout(_masT); _masT = setTimeout(masonryAll, ms || 80); }
  // Profil bo'limlari almashganda qayta joylaymiz (onclick global funksiyani chaqiradi)
  if (typeof window.showProfileSubtab === 'function') {
    var _origSub = window.showProfileSubtab;
    window.showProfileSubtab = function (name) {
      var r = _origSub.apply(this, arguments); masonrySoon(60);
      if (name === 'settings') { try { if (window.xRenderTgSettings) window.xRenderTgSettings(); } catch (e) {} }
      if (name === 'settings' || name === 'stats') { try { if (window.LUFocusgate) window.LUFocusgate.renderEmbeds(); } catch (e) {} }
      return r;
    };
  }
  var _mqLast = null;
  window.addEventListener('resize', function () {
    var k = MAS.map(function (c) { try { return window.matchMedia(c.mq).matches ? 1 : 0; } catch (e) { return 0; } }).join('');
    if (k !== _mqLast) { _mqLast = k; masonrySoon(120); }
  });

  window.LUBlocks = {
    openPalette: openPalette, closePalette: closePalette,
    focusLiveHtml: focusLiveHtml, focusLiveUpdate: focusLiveUpdate,
    polishText: polishText, mountFeedbackRewrite: mountFeedbackRewrite,
    adminHeroHtml: adminHeroHtml, bindAdminHero: bindAdminHero,
    renderStatCards: renderStatCards, orbitHtml: orbitHtml,
    spinLog: spinLog, renderSpinDeck: renderSpinDeck, masonry: masonryAll
  };

  function boot() { call(mountSearchBtn); call(renderStatCards); call(renderSpinDeck); masonrySoon(600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
})();
