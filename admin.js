// ============================================================
// 👑 ADMIN PANELI v2 (extras.js dagi openAdminPanel o'rniga)
//   📊 Statistika (+ sana oralig'i, CSV)   📈 Analitika (voronka, kogorta, funksiyalar, onlayn, ketganlar, Focusgate, referal, Telegram)
//   👤 Foydalanuvchilar (qidiruv, filtr, kartochka: tanga, ban, nik, zaxira, chiqarish, xabar)
//   🛡 Moderatsiya (shubhali faollik, lenta, klanlar, taqiqlangan so'zlar)
//   📣 Xabarlar (e'lon/banner/changelog, ommaviy push/Telegram/ilova)   ⚙️ Sozlamalar (funksiyalar, texnik ishlar, promo, mavsum)
//   🩺 Tizim (xatolar, sinxron, server holati)   👥 Jamoa (rollar, jurnal)   📨 Fikrlar
// Rollar: helper=1, admin=2, owner=3 — server ham har bir RPC'da tekshiradi (admin_tools.sql).
// ============================================================
(function () {
  'use strict';
  function L(uz, en, ru) { try { return _cl(uz, en, ru); } catch (e) { return uz; } }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tst(m) { try { toast(m); } catch (e) {} }
  function fmt(n) { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(n); }
  function dt(v) { if (!v) return '—'; try { return new Date(v).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(v); } }
  function dd(v) { if (!v) return '—'; try { return new Date(v).toLocaleDateString(); } catch (e) { return String(v); } }
  function ago(ts) {
    if (!ts) return '—';
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    return s < 60 ? L('hozir', 'now', 'сейчас') : s < 3600 ? Math.round(s / 60) + L(' daq', 'm', ' мин') : s < 86400 ? Math.round(s / 3600) + L(' soat', 'h', ' ч') : Math.round(s / 86400) + L(' kun', 'd', ' дн');
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var ERRS = {
    forbidden: ['Bu amal uchun huquqingiz yetmaydi', 'You don\'t have permission for this', 'Недостаточно прав'],
    reason_required: ['Sababni yozing (kamida 3 belgi)', 'Write a reason (3+ chars)', 'Укажите причину'],
    cannot_ban_staff: ['Jamoa a\'zosini bloklab bo\'lmaydi', 'Staff can\'t be banned', 'Нельзя заблокировать сотрудника'],
    no_backup: ['Bunday zaxira yo\'q', 'No such backup', 'Нет такой копии'], taken: ['Bu nom band', 'Name is taken', 'Имя занято'],
    bad_code: ['Kod: 3–32 ta lotin harf/raqam', 'Code: 3–32 letters/digits', 'Код: 3–32 буквы/цифры'], self: ['O\'zingizni o\'zgartira olmaysiz', 'You can\'t change yourself', 'Нельзя менять себя'],
    bad_email: ['Email noto\'g\'ri', 'Invalid email', 'Неверный email'], too_big: ['Juda katta qiymat', 'Value too large', 'Слишком большое значение']
  };
  function errText(e) {
    var m = (e && (e.message || e.error_description || e.error)) || String(e);
    for (var k in ERRS) if (m.indexOf(k) !== -1) return L(ERRS[k][0], ERRS[k][1], ERRS[k][2]);
    return m;
  }
  async function rpc(name, args) {
    var r = await supabase.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  async function act(fn, okMsg) {
    try { var v = await fn(); if (okMsg) tst(okMsg); return v; } catch (e) { tst('⚠️ ' + errText(e)); throw e; }
  }

  // ---------- CSV eksport ----------
  function csv(name, rows, cols) {
    cols = cols || Object.keys(rows[0] || {}).map(function (k) { return [k, k]; });
    var q = function (v) { v = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var txt = '﻿' + cols.map(function (c) { return q(c[1]); }).join(',') + '\n' + rows.map(function (r) { return cols.map(function (c) { return q(typeof c[0] === 'function' ? c[0](r) : r[c[0]]); }).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'levelupday-' + name + '-' + iso(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  var csvBtn = function (id) { return '<button type="button" class="x-btn ghost sm" data-csv="' + id + '">⬇️ CSV</button>'; };

  // ---------- kichik UI bloklari ----------
  function card(title, body, cls, extra) { return '<div class="ad-card ' + (cls || '') + '"><div class="ad-card-t adm-ct"><span>' + title + '</span>' + (extra || '') + '</div>' + body + '</div>'; }
  function tile(icon, label, val, sub) { return '<div class="ad-tile"><div class="ad-tile-l">' + icon + ' ' + label + '</div><div class="ad-tile-v">' + val + '</div>' + (sub ? '<div class="ad-tile-s">' + sub + '</div>' : '') + '</div>'; }
  function empty(t) { return '<div class="ad-empty">' + (t || '— ' + L('ma\'lumot yo\'q', 'no data', 'нет данных') + ' —') + '</div>'; }
  function table(rows, cols, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return empty();
    return '<div class="ad-tbl-w"><table class="ad-tbl adm-tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr' + (opts.rowAttr ? ' ' + opts.rowAttr(r, i) : '') + '>' + cols.map(function (c) { return '<td>' + c[1](r, i) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function bars(list, key, valKey, labelFn, every, color) {
    if (!list || !list.length) return empty();
    var mx = Math.max.apply(null, list.map(function (x) { return +x[valKey] || 0; }).concat([1]));
    return '<div class="ad-bars">' + list.map(function (x, i) {
      var v = +x[valKey] || 0, lbl = labelFn(x[key]);
      return '<div class="ad-bar" title="' + H(lbl + ': ' + v) + '"><i style="height:' + Math.max(v ? 4 : 1, v / mx * 100) + '%' + (color ? ';background:' + color : '') + '"></i><span>' + ((every && i % every !== 0 && i !== list.length - 1) ? '' : H(lbl)) + '</span></div>';
    }).join('') + '</div>';
  }
  function hlist(list, labelFn, valKey) {
    if (!list || !list.length) return empty();
    var mx = Math.max.apply(null, list.map(function (x) { return +x[valKey] || 0; }).concat([1]));
    return list.map(function (x) { return '<div class="ad-row"><div class="ad-row-t"><span>' + labelFn(x) + '</span><b>' + fmt(x[valKey]) + '</b></div><div class="ad-row-b"><i style="width:' + ((+x[valKey] || 0) / mx * 100) + '%"></i></div></div>'; }).join('');
  }
  var dayLbl = function (v) { var p = String(v).split('-'); return +p[2] + '.' + p[1]; };
  var who = function (id, name) { return '<button type="button" class="adm-link" data-user="' + H(id) + '">' + H(name || '—') + '</button>'; };

  // ---------- forma (oyna) ----------
  function form(title, fields, submitLabel, onSubmit, opts) {
    opts = opts || {};
    var ov = document.createElement('div'); ov.className = 'x-ov adm-form-ov';
    ov.innerHTML = '<div class="x-box adm-form" role="dialog" aria-modal="true"><button class="x-close" aria-label="close">✕</button><h3 class="adm-h">' + title + '</h3>' + (opts.intro || '') +
      fields.map(function (f) {
        var v = f.value == null ? '' : f.value, id = 'admf-' + f.k;
        var inp = f.type === 'textarea' ? '<textarea id="' + id + '" class="x-in" rows="' + (f.rows || 4) + '" maxlength="' + (f.max || 4000) + '" placeholder="' + H(f.ph || '') + '">' + H(v) + '</textarea>'
          : f.type === 'select' ? '<select id="' + id + '" class="x-in">' + f.options.map(function (o) { return '<option value="' + H(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + H(o[1]) + '</option>'; }).join('') + '</select>'
          : f.type === 'checkbox' ? '<label class="adm-chk"><input id="' + id + '" type="checkbox"' + (v ? ' checked' : '') + '> ' + H(f.label) + '</label>'
          : '<input id="' + id + '" class="x-in" type="' + (f.type || 'text') + '" value="' + H(v) + '" placeholder="' + H(f.ph || '') + '"' + (f.max ? ' maxlength="' + f.max + '"' : '') + '>';
        return '<div class="adm-field">' + (f.type === 'checkbox' ? '' : '<label for="' + id + '">' + H(f.label) + '</label>') + inp + (f.hint ? '<small>' + H(f.hint) + '</small>' : '') + '</div>';
      }).join('') + '<div class="adm-acts"><button type="button" class="x-btn ghost" data-x>' + H(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="x-btn' + (opts.danger ? ' adm-danger' : '') + '" data-ok>' + H(submitLabel) + '</button></div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180); };
    ov.querySelector('.x-close').onclick = ov.querySelector('[data-x]').onclick = close;
    ov.querySelector('[data-ok]').onclick = async function () {
      var vals = {};
      fields.forEach(function (f) { var el = ov.querySelector('#admf-' + f.k); vals[f.k] = f.type === 'checkbox' ? el.checked : el.value.trim(); });
      var b = this; b.disabled = true;
      try { var keep = await onSubmit(vals); if (keep !== true) close(); } catch (e) { tst('⚠️ ' + errText(e)); } finally { b.disabled = false; }
    };
    var first = ov.querySelector('input:not([type=checkbox]), textarea'); if (first) setTimeout(function () { first.focus(); }, 120);
    return ov;
  }
  function confirmDo(title, text, label, fn, danger) {
    return form(title, [], label, fn, { intro: '<p class="adm-p">' + text + '</p>', danger: danger });
  }

  // =========================================================
  // Panel
  // =========================================================
  var ME = { level: 0 }, OV = null, TAB = 'stats', CACHE = {};
  var TABS = [
    ['stats', '📊', ['Statistika', 'Stats', 'Статистика'], 1],
    ['analytics', '📈', ['Analitika', 'Analytics', 'Аналитика'], 1],
    ['users', '👤', ['Foydalanuvchilar', 'Users', 'Пользователи'], 1],
    ['mod', '🛡', ['Moderatsiya', 'Moderation', 'Модерация'], 1],
    ['msg', '📣', ['Xabarlar', 'Messages', 'Сообщения'], 1],
    ['settings', '⚙️', ['Sozlamalar', 'Settings', 'Настройки'], 1],
    ['system', '🩺', ['Tizim', 'System', 'Система'], 1],
    ['team', '👥', ['Jamoa', 'Team', 'Команда'], 1],
    ['fb', '📨', ['Fikrlar', 'Feedback', 'Отзывы'], 1]
  ];
  var ROLE = { 1: 'HELPER', 2: 'ADMIN', 3: 'OWNER' };
  window.openAdminPanel = async function (tab) {
    if (!(S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined')) { tst('🔐 ' + L('Avval hisobingizga kiring', 'Sign in first', 'Сначала войдите')); return; }
    try { ME = await rpc('admin_whoami'); } catch (e) { ME = { level: 0 }; }
    if (!ME || !ME.level) { tst('⛔ ' + L('Admin huquqi yo\'q', 'No admin access', 'Нет прав администратора')); return; }
    if (tab) TAB = tab;
    var old = document.getElementById('admin-panel-modal'); if (old) old.remove();
    OV = document.createElement('div'); OV.id = 'admin-panel-modal'; OV.className = 'ad-ov adm-ov';
    OV.innerHTML = '<div class="ad-box adm-box"><div class="ad-head adm-head"><div><div class="ad-title">👑 ' + H(L('Admin paneli', 'Admin panel', 'Панель администратора')) + '</div>' +
      '<div class="ad-upd">' + H(ME.email || '') + ' · <b class="adm-role adm-r' + ME.level + '">' + ROLE[ME.level] + '</b></div></div>' +
      '<div class="ad-head-b"><button class="x-btn ghost sm" id="adm-refresh" aria-label="refresh">↻</button><button class="x-close" id="adm-close" aria-label="close" style="position:static">✕</button></div></div>' +
      '<div class="adm-tabs" role="tablist"></div><div id="adm-body"></div></div><div id="ad-tip" class="ad-tip"></div>';
    document.body.appendChild(OV);
    var close = function () { OV.remove(); OV = null; if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search); };
    OV.querySelector('#adm-close').onclick = close;
    OV.addEventListener('click', function (e) { if (e.target === OV) close(); });
    OV.querySelector('#adm-refresh').onclick = function () { CACHE = {}; render(); };
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && OV && !document.querySelector('.adm-form-ov, .adm-card-ov')) { close(); document.removeEventListener('keydown', esc); } });
    // Foydalanuvchi nomini bosish — kartochka (hamma bo'limlarda)
    OV.addEventListener('click', function (e) { var u = e.target.closest('[data-user]'); if (u && u.dataset.user) { e.preventDefault(); openUser(u.dataset.user); } });
    render();
  };
  function render() {
    if (!OV) return;
    var tabs = OV.querySelector('.adm-tabs');
    tabs.innerHTML = TABS.filter(function (t) { return ME.level >= t[3]; }).map(function (t) {
      return '<button type="button" role="tab" class="ad-tab' + (TAB === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + ' ' + H(L(t[2][0], t[2][1], t[2][2])) + (t[0] === 'fb' ? ' <span class="ad-tab-n" id="ad-fb-n"></span>' : '') + '</button>';
    }).join('');
    tabs.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { TAB = b.dataset.t; render(); }; });
    var on = tabs.querySelector('.on'); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    var body = OV.querySelector('#adm-body');
    body.innerHTML = '<div class="ad-empty">⏳ ' + H(L('Yuklanmoqda...', 'Loading...', 'Загрузка...')) + '</div>';
    var fn = VIEWS[TAB] || VIEWS.stats;
    Promise.resolve().then(function () { return fn(body); }).catch(function (e) { body.innerHTML = '<div class="ad-empty">⚠️ ' + H(errText(e)) + '</div>'; });
  }
  function bindCsv(box, map) { box.querySelectorAll('[data-csv]').forEach(function (b) { b.onclick = function () { var f = map[b.dataset.csv]; if (f) f(); }; }); }

  var VIEWS = {};

  // ---------------------------------------------------------
  // 📊 Statistika (eski dashboard + sana oralig'i)
  // ---------------------------------------------------------
  var RANGE = { days: 30, from: null, to: null };
  VIEWS.stats = async function (body) {
    var to = RANGE.to ? new Date(RANGE.to) : new Date(), from = RANGE.from ? new Date(RANGE.from) : new Date(Date.now() - (RANGE.days - 1) * 864e5);
    var chips = [[7, '7 ' + L('kun', 'd', 'дн')], [30, '30 ' + L('kun', 'd', 'дн')], [90, '90 ' + L('kun', 'd', 'дн')], [365, '1 ' + L('yil', 'y', 'г')]];
    body.innerHTML = '<div class="adm-bar"><div class="adm-chips">' + chips.map(function (c) { return '<button type="button" data-days="' + c[0] + '" class="' + (!RANGE.from && RANGE.days === c[0] ? 'on' : '') + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<label class="adm-date">' + H(L('dan', 'from', 'с')) + ' <input type="date" id="adm-from" value="' + iso(from) + '"></label><label class="adm-date">' + H(L('gacha', 'to', 'по')) + ' <input type="date" id="adm-to" value="' + iso(to) + '"></label>' + csvBtn('range') + '</div>' +
      '<div id="adm-range"><div class="ad-empty">⏳</div></div><div id="adm-dash"></div>';
    body.querySelectorAll('[data-days]').forEach(function (b) { b.onclick = function () { RANGE = { days: +b.dataset.days }; render(); }; });
    var onDate = function () { var f = body.querySelector('#adm-from').value, t = body.querySelector('#adm-to').value; if (f && t) { RANGE = { days: 0, from: f, to: t }; render(); } };
    body.querySelector('#adm-from').onchange = onDate; body.querySelector('#adm-to').onchange = onDate;
    var rg = await rpc('admin_range_stats', { p_from: iso(from), p_to: iso(to) });
    var T = rg.totals || {}, days = rg.days || [], every = Math.ceil(days.length / 12);
    bindCsv(body, { range: function () { csv('stats', days, [['d', 'date'], ['signups', 'signups'], ['active', 'active'], ['pomo', 'pomodoro_min'], ['rewards', 'rewards']]); } });
    body.querySelector('#adm-range').innerHTML = '<div class="ad-kpis">' +
      tile('🆕', L('Yangi foydalanuvchilar', 'New users', 'Новые'), fmt(T.signups), H(dd(rg.from) + ' — ' + dd(rg.to))) +
      tile('🔥', L('Faol foydalanuvchilar', 'Active users', 'Активные'), fmt(T.active_users), L('o\'rtacha DAU', 'avg DAU', 'средний DAU') + ' ' + (T.avg_dau || 0)) +
      tile('🍅', L('Pomodoro', 'Pomodoro', 'Pomodoro'), fmt(T.pomo_minutes), L('daqiqa', 'minutes', 'минут')) +
      tile('🎁', L('Olingan mukofotlar', 'Rewards claimed', 'Наград получено'), fmt(T.rewards), '') + '</div>' +
      '<div class="ad-grid">' +
      card('🔥 ' + L('Kunlik faol', 'Daily active', 'Активные по дням'), bars(days, 'd', 'active', dayLbl, every)) +
      card('🆕 ' + L('Kunlik ro\'yxatdan o\'tish', 'Daily sign-ups', 'Регистрации по дням'), bars(days, 'd', 'signups', dayLbl, every, 'var(--green)')) +
      card('🍅 ' + L('Pomodoro (daqiqa)', 'Pomodoro (min)', 'Pomodoro (мин)'), bars(days, 'd', 'pomo', dayLbl, every, 'var(--gold)')) +
      '</div>';
    // Eski umumiy dashboard (bugungi KPI, davlatlar, top foydalanuvchilar…)
    try {
      var d = await rpc('get_admin_dashboard');
      var box = body.querySelector('#adm-dash');
      if (box && window._adRenderDashboard) window._adRenderDashboard(box, d || {});
    } catch (e) {}
  };

  // ---------------------------------------------------------
  // 📈 Analitika
  // ---------------------------------------------------------
  VIEWS.analytics = async function (body) {
    var a = CACHE.analytics || (CACHE.analytics = await rpc('admin_analytics'));
    var F = a.funnel || {}, top = F.signed_up || 0;
    var step = function (ic, label, n) { var p = top ? Math.round(n / top * 100) : 0; return '<div class="adm-fun"><div class="adm-fun-t"><span>' + ic + ' ' + H(label) + '</span><b>' + n + ' <em>' + p + '%</em></b></div><div class="adm-fun-b"><i style="width:' + p + '%"></i></div></div>'; };
    var pc = function (v) { return v == null ? '<span class="ad-dim">…</span>' : '<span class="adm-heat" style="--p:' + v + '">' + v + '%</span>'; };
    var FE = a.features || {}, act = FE.active_30d || 1;
    var feats = [['pomodoro', '🍅 Pomodoro'], ['focusgate', '🔒 Focusgate'], ['rewards', '🎁 ' + L('Mukofotlar', 'Rewards', 'Награды')], ['friends', '👥 ' + L('Do\'stlar', 'Friends', 'Друзья')],
      ['duels', '⚔️ ' + L('Duellar', 'Duels', 'Дуэли')], ['clans', '🛡 ' + L('Klanlar', 'Clans', 'Кланы')], ['parties', '🎉 Party'], ['world_party', '🌍 World Party'],
      ['shared_tasks', '🤝 ' + L('Umumiy vazifa', 'Shared tasks', 'Общие задачи')], ['feed', '📰 ' + L('Lenta', 'Feed', 'Лента')], ['exam_prep', '📚 ' + L('Imtihon tayyorgarligi', 'Exam prep', 'Подготовка к экзаменам')],
      ['telegram', '✈️ Telegram'], ['push', '🔔 Push']].map(function (f) { return { k: f[1], n: FE[f[0]] || 0 }; }).sort(function (x, y) { return y.n - x.n; });
    var C = a.churn || {}, FG = a.focusgate || {}, R = a.referrals || {}, TG = a.telegram || {};
    body.innerHTML = '<div class="ad-kpis">' +
      tile('🟢', L('Hozir onlayn', 'Online now', 'Сейчас онлайн'), a.online_now || 0, L('so\'nggi 5 daqiqa', 'last 5 minutes', 'за 5 минут')) +
      tile('🔥', L('30 kunda faol', 'Active in 30d', 'Активны за 30 дн'), fmt(FE.active_30d), '') +
      tile('💤', L('Ketganlar (14+ kun)', 'Churned (14+ d)', 'Ушли (14+ дн)'), fmt(C.count), L('so\'nggi 14–30 kunda', 'in the last 14–30 d', 'за 14–30 дн') + ' ' + (C.recent || 0)) +
      tile('🤝', L('Referallar', 'Referrals', 'Рефералы'), fmt(R.total), '30 ' + L('kunda', 'd', 'дн') + ' +' + (R.last_30d || 0)) + '</div>' +
      '<div class="ad-grid">' +
      card('🪜 ' + L('Voronka (so\'nggi 90 kun)', 'Funnel (last 90 days)', 'Воронка (90 дн)'),
        step('👤', L('Ro\'yxatdan o\'tdi', 'Signed up', 'Регистрация'), F.signed_up || 0) + step('✅', L('Birinchi vazifa', 'First task', 'Первая задача'), F.first_task || 0) +
        step('🔁', L('3+ kun qaytdi', 'Came back 3+ days', 'Вернулся 3+ дня'), F.returned_3d || 0) + step('🔥', L('7 kunlik streak', '7-day streak', 'Стрик 7 дней'), F.streak_7 || 0)) +
      card('📅 ' + L('Haftalik kogortalar (qaytish)', 'Weekly cohorts (retention)', 'Когорты по неделям'), table((a.cohorts || []).slice().reverse(), [
        [L('Hafta', 'Week', 'Неделя'), function (r) { return H(dd(r.week)); }], [L('Soni', 'Size', 'Размер'), function (r) { return r.size; }],
        ['D1', function (r) { return r.size ? pc(r.d1) : '—'; }], ['D7', function (r) { return r.size ? pc(r.d7) : '—'; }], ['D30', function (r) { return r.size ? pc(r.d30) : '—'; }]])) +
      card('🧩 ' + L('Funksiyalar (30 kun, foydalanuvchi)', 'Feature usage (30d, users)', 'Функции (30 дн)'), hlist(feats, function (x) { return H(x.k) + ' <em class="ad-dim">' + Math.round(x.n / act * 100) + '%</em>'; }, 'n')) +
      card('🟢 ' + L('Hozir onlayn', 'Online now', 'Сейчас онлайн'), table(a.online || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.id, r.name); }], ['Lv', function (r) { return r.level || 1; }],
        ['📱', function (r) { return H(r.device_type || ''); }], [L('Faollik', 'Active', 'Актив.'), function (r) { return ago(r.last_active_at); }]])) +
      '</div><div class="ad-grid">' +
      card('💤 ' + L('Ketganlar (14–60 kun, XP bo\'yicha)', 'Churned users (14–60 d, by XP)', 'Ушедшие (14–60 дн)'), table(C.list || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.id, r.name); }], ['Lv', function (r) { return r.level || 1; }], ['XP', function (r) { return fmt(r.xp); }],
        ['🔥', function (r) { return (r.best_streak || 0); }], [L('Oxirgi', 'Last', 'Посл.'), function (r) { return ago(r.last_active_at); }]]), '', csvBtn('churn')) +
      card('🔒 Focusgate', '<div class="ad-mini"><div><b>' + (FG.users || 0) + '</b><span>👤 ' + H(L('foydalanuvchi', 'users', 'польз.')) + '</span></div><div><b>' + (FG.devices_active || 0) + ' / ' + (FG.devices || 0) + '</b><span>💻 ' + H(L('faol / jami qurilma', 'active / all devices', 'активн./всего')) + '</span></div></div>' +
        '<div class="adm-sub">⛔ ' + H(L('Eng ko\'p bloklangan (30 kun)', 'Most blocked (30d)', 'Чаще блокируют')) + '</div>' + hlist(FG.top_blocked || [], function (x) { return H(String(x.label || x.app).replace(/^site:/, '')); }, 'n') +
        '<div class="adm-sub">⏱ ' + H(L('Eng ko\'p vaqt (7 kun, soat)', 'Most used (7d, hours)', 'Больше всего времени (7 дн, ч)')) + '</div>' + hlist(FG.top_used || [], function (x) { return H(String(x.label || x.app).replace(/^site:/, '')) + ' <em class="ad-dim">' + x.users + '👤</em>'; }, 'hours')) +
      card('🤝 ' + L('Referallar', 'Referrals', 'Рефералы'), table(R.top || [], [[L('Taklif qilgan', 'Referrer', 'Пригласил'), function (r) { return who(r.id, r.name); }], [L('Soni', 'Count', 'Кол-во'), function (r) { return r.n; }]])) +
      card('✈️ Telegram bot', '<div class="ad-mini"><div><b>' + (TG.linked || 0) + '</b><span>🔗 ' + H(L('ulangan', 'linked', 'привязано')) + '</span></div><div><b>' + (TG.enabled || 0) + '</b><span>✅ ' + H(L('faol', 'enabled', 'активно')) + '</span></div></div>' +
        '<div class="adm-sub">🗣 ' + H(L('Til', 'Language', 'Язык')) + '</div>' + hlist(Object.keys(TG.by_lang || {}).map(function (k) { return { k: k, n: TG.by_lang[k] }; }), function (x) { return H(x.k); }, 'n') +
        '<div class="adm-sub">🔕 ' + H(L('O\'chirilgan xabar turlari', 'Disabled notification types', 'Отключённые уведомления')) + '</div>' + hlist(Object.keys(TG.prefs_off || {}).map(function (k) { return { k: k, n: TG.prefs_off[k] }; }), function (x) { return H(x.k); }, 'n')) +
      '</div>';
    bindCsv(body, { churn: function () { csv('churn', C.list || [], [['id', 'id'], ['name', 'name'], ['level', 'level'], ['xp', 'xp'], ['best_streak', 'best_streak'], ['last_active_at', 'last_active']]); } });
  };

  // ---------------------------------------------------------
  // 👤 Foydalanuvchilar
  // ---------------------------------------------------------
  var US = { q: '', f: {}, sort: 'active', page: 0, size: 50 };
  var USER_COLS = [['id', 'id'], ['name', 'name'], ['email', 'email'], ['provider', 'provider'], ['country', 'country'], ['language', 'language'], ['level', 'level'], ['xp', 'xp'],
    ['coins', 'coins'], ['gems', 'gems'], ['streak', 'streak'], ['best_streak', 'best_streak'], ['tasks_completed', 'tasks_completed'], ['device_type', 'device'], ['referral_source', 'referral'],
    ['tg_username', 'telegram'], ['created_at', 'created_at'], ['last_active_at', 'last_active_at'], ['banned_until', 'banned_until']];
  VIEWS.users = async function (body) {
    var sel = function (k, opts) { return '<select class="x-in sm" data-f="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + ((US.f[k] || '') === o[0] ? ' selected' : '') + '>' + H(o[1]) + '</option>'; }).join('') + '</select>'; };
    body.innerHTML = '<div class="adm-bar adm-search"><input class="x-in" id="adm-q" placeholder="🔎 ' + H(L('Nik, email, Telegram, ID yoki do\'st kodi', 'Nick, email, Telegram, ID or friend code', 'Ник, email, Telegram, ID')) + '" value="' + H(US.q) + '">' +
      '<button type="button" class="x-btn sm" id="adm-go">' + H(L('Qidirish', 'Search', 'Найти')) + '</button></div>' +
      '<div class="adm-bar adm-filters">' +
      sel('active', [['', L('Har qanday faollik', 'Any activity', 'Любая активность')], ['online', '🟢 ' + L('Onlayn', 'Online', 'Онлайн')], ['today', L('Bugun', 'Today', 'Сегодня')], ['7d', '7 ' + L('kun', 'days', 'дней')], ['30d', '30 ' + L('kun', 'days', 'дней')], ['inactive14', '💤 14+ ' + L('kun yo\'q', 'days away', 'дн нет')], ['never', L('Hech qachon', 'Never', 'Никогда')]]) +
      sel('provider', [['', L('Kirish usuli', 'Sign-in', 'Вход')], ['google', 'Google'], ['telegram', 'Telegram'], ['email', 'Email']]) +
      sel('lang', [['', L('Til', 'Language', 'Язык')], ['uz', 'O\'zbek'], ['en', 'English'], ['ru', 'Русский']]) +
      sel('device', [['', L('Qurilma', 'Device', 'Устройство')], ['mobile', '📱'], ['tablet', '📲'], ['desktop', '💻']]) +
      '<input class="x-in sm" data-f="country" maxlength="2" placeholder="' + H(L('Davlat (UZ)', 'Country (UZ)', 'Страна (UZ)')) + '" value="' + H(US.f.country || '') + '">' +
      '<input class="x-in sm adm-num" data-f="level_min" type="number" min="1" placeholder="Lv ≥" value="' + H(US.f.level_min || '') + '">' +
      '<input class="x-in sm adm-num" data-f="level_max" type="number" min="1" placeholder="Lv ≤" value="' + H(US.f.level_max || '') + '">' +
      '<label class="adm-chk"><input type="checkbox" data-f="banned"' + (US.f.banned ? ' checked' : '') + '> 🚫</label><label class="adm-chk"><input type="checkbox" data-f="tg"' + (US.f.tg ? ' checked' : '') + '> ✈️</label>' +
      sel('_sort', [['active', L('Saralash: faollik', 'Sort: activity', 'Сорт.: активность')], ['new', L('Yangi', 'Newest', 'Новые')], ['xp', 'XP'], ['coins', L('Tanga', 'Coins', 'Монеты')], ['streak', 'Streak'], ['name', L('Nom', 'Name', 'Имя')]]).replace('data-f="_sort"', 'data-sort') +
      csvBtn('users') + '</div><div id="adm-ulist"><div class="ad-empty">⏳</div></div>';
    body.querySelector('[data-sort]').value = US.sort;
    var collect = function () {
      US.q = body.querySelector('#adm-q').value.trim(); var f = {};
      body.querySelectorAll('[data-f]').forEach(function (el) { var v = el.type === 'checkbox' ? (el.checked ? 'true' : '') : el.value.trim(); if (el.dataset.f === 'country') v = v.toUpperCase(); if (v) f[el.dataset.f] = v; });
      US.f = f; US.sort = body.querySelector('[data-sort]').value; US.page = 0; load();
    };
    body.querySelector('#adm-go').onclick = collect;
    body.querySelector('#adm-q').onkeydown = function (e) { if (e.key === 'Enter') collect(); };
    body.querySelectorAll('select[data-f], [data-sort], input[type=checkbox][data-f]').forEach(function (el) { el.onchange = collect; });
    bindCsv(body, { users: async function () { var d = await act(function () { return rpc('admin_search_users', { p_q: US.q, p_f: US.f, p_sort: US.sort, p_limit: 5000, p_offset: 0 }); }); csv('users', d.rows || [], USER_COLS); } });
    async function load() {
      var box = body.querySelector('#adm-ulist'); if (!box) return;
      box.innerHTML = '<div class="ad-empty">⏳</div>';
      var d = await rpc('admin_search_users', { p_q: US.q, p_f: US.f, p_sort: US.sort, p_limit: US.size, p_offset: US.page * US.size });
      var rows = d.rows || [], total = d.total || 0, pages = Math.max(1, Math.ceil(total / US.size));
      box.innerHTML = '<div class="adm-count">' + H(L('Topildi', 'Found', 'Найдено')) + ': <b>' + total + '</b></div>' + table(rows, [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.id, r.name) + (r.banned_until && Date.parse(r.banned_until) > Date.now() || r.banned_until === 'infinity' ? ' <span class="adm-tag bad">🚫</span>' : '') + '<div class="ad-dim adm-mail">' + H(r.email || '') + '</div>'; }],
        ['', function (r) { return r.provider === 'google' ? '🔵' : r.provider === 'telegram' ? '✈️' : '📧'; }],
        ['🌍', function (r) { return H(r.country || '—'); }], ['Lv', function (r) { return r.level || 1; }], ['XP', function (r) { return fmt(r.xp); }],
        ['🪙', function (r) { return fmt(r.coins); }], ['🔥', function (r) { return r.streak || 0; }], ['✅', function (r) { return r.tasks_completed || 0; }],
        [L('Qo\'shilgan', 'Joined', 'Дата'), function (r) { return dd(r.created_at); }], [L('Faollik', 'Active', 'Актив.'), function (r) { return ago(r.last_active_at); }]]) +
        (pages > 1 ? '<div class="adm-pager"><button type="button" class="x-btn ghost sm" data-pg="-1"' + (US.page ? '' : ' disabled') + '>‹</button><span>' + (US.page + 1) + ' / ' + pages + '</span><button type="button" class="x-btn ghost sm" data-pg="1"' + (US.page + 1 < pages ? '' : ' disabled') + '>›</button></div>' : '');
      box.querySelectorAll('[data-pg]').forEach(function (b) { b.onclick = function () { US.page += +b.dataset.pg; load(); }; });
    }
    await load();
  };

  // 🗂 Foydalanuvchi kartochkasi
  async function openUser(uid) {
    var old = document.querySelector('.adm-card-ov'); if (old) old.remove();
    var ov = document.createElement('div'); ov.className = 'ad-ov adm-card-ov';
    ov.innerHTML = '<div class="ad-box adm-ucard"><div class="ad-empty">⏳</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    var box = ov.querySelector('.adm-ucard');
    async function draw() {
      var c;
      try { c = await rpc('admin_user_card', { p_uid: uid }); } catch (e) { box.innerHTML = '<div class="ad-empty">⚠️ ' + H(errText(e)) + '</div><div class="adm-acts"><button class="x-btn ghost" data-close>✕</button></div>'; box.querySelector('[data-close]').onclick = function () { ov.remove(); }; return; }
      var p = c.profile || {}, au = c.auth || {}, st = c.state || {};
      var banned = p.banned_until && (p.banned_until === 'infinity' || Date.parse(p.banned_until) > Date.now());
      var av = p.photo ? '<img class="adm-av" src="' + H(p.photo) + '" alt="">' : '<span class="adm-av">' + H(String(p.name || '?').charAt(0).toUpperCase()) + '</span>';
      var lvl2 = ME.level >= 2;
      box.innerHTML = '<div class="ad-head adm-head"><div class="adm-uh">' + av + '<div><div class="ad-title">' + H(p.name || '—') + (c.staff_role ? ' <span class="adm-tag">' + H(c.staff_role.toUpperCase()) + '</span>' : '') + (banned ? ' <span class="adm-tag bad">🚫 ' + H(L('bloklangan', 'banned', 'заблокирован')) + '</span>' : '') + '</div>' +
        '<div class="ad-upd">' + H(au.email || '') + ' · ' + H(au.provider || '') + (c.telegram ? ' · ✈️ @' + H(c.telegram.username || '?') : '') + '</div><div class="ad-upd adm-id">' + H(uid) + '</div></div></div>' +
        '<div class="ad-head-b"><button class="x-close" data-close aria-label="close" style="position:static">✕</button></div></div>' +
        '<div class="adm-uacts">' +
        (lvl2 ? '<button type="button" class="x-btn sm" data-a="econ">🪙 ' + H(L('Tanga / XP', 'Coins / XP', 'Монеты / XP')) + '</button>' : '') +
        (lvl2 ? (banned ? '<button type="button" class="x-btn sm ghost" data-a="unban">✅ ' + H(L('Blokdan chiqarish', 'Unban', 'Разблокировать')) + '</button>' : '<button type="button" class="x-btn sm adm-danger" data-a="ban">🚫 Ban</button>') : '') +
        '<button type="button" class="x-btn sm ghost" data-a="rename">✏️ ' + H(L('Nik / avatar', 'Nick / avatar', 'Ник / аватар')) + '</button>' +
        '<button type="button" class="x-btn sm ghost" data-a="msg">✉️ ' + H(L('Xabar', 'Message', 'Сообщение')) + '</button>' +
        (lvl2 ? '<button type="button" class="x-btn sm ghost" data-a="signout">🚪 ' + H(L('Hamma qurilmadan chiqarish', 'Sign out everywhere', 'Выйти везде')) + '</button>' : '') +
        '</div>' +
        (banned ? '<div class="adm-alert">🚫 ' + H(p.banned_until === 'infinity' ? L('Muddatsiz', 'Permanent', 'Бессрочно') : L('Tugaydi: ', 'Until: ', 'До: ') + dt(p.banned_until)) + (st.ban_reason ? ' · ' + H(st.ban_reason) : '') + '</div>' : '') +
        '<div class="ad-kpis">' + tile('⭐', 'Lv ' + (p.level || 1), fmt(p.xp), 'XP') + tile('🪙', L('Tanga', 'Coins', 'Монеты'), fmt(p.coins), L('jami', 'total', 'всего') + ' ' + fmt(p.total_coins) + ' · 💎 ' + (p.gems || 0)) +
        tile('🔥', 'Streak', p.streak || 0, L('rekord', 'best', 'рекорд') + ' ' + (p.best_streak || 0)) + tile('✅', L('Bajarilgan', 'Done', 'Выполнено'), fmt(p.tasks_completed), L('vazifalar', 'tasks', 'задач') + ': ' + (c.tasks || 0)) +
        tile('📅', L('30 kunda faol', 'Active days (30d)', 'Акт. дней (30)'), c.active_days_30 || 0, L('oxirgi', 'last', 'посл.') + ' ' + ago(p.last_active_at)) +
        tile('🗓', L('Qo\'shilgan', 'Joined', 'Регистрация'), '<span class="adm-sm">' + H(dd(au.created_at || p.created_at)) + '</span>', L('kirgan', 'signed in', 'вход') + ' ' + ago(au.last_sign_in_at)) + '</div>' +
        '<div class="ad-grid">' +
        card('ℹ️ ' + L('Ma\'lumot', 'Info', 'Инфо'), '<div class="adm-kv">' + [
          [L('Davlat', 'Country', 'Страна'), p.country], [L('Til', 'Language', 'Язык'), p.language], [L('Qurilma', 'Device', 'Устройство'), p.device_type],
          [L('Qayerdan', 'Source', 'Источник'), p.referral_source], [L('Do\'st kodi', 'Friend code', 'Код друга'), p.friend_code], [L('Do\'stlar', 'Friends', 'Друзья'), c.friends],
          [L('Klan', 'Clan', 'Клан'), c.clan ? c.clan.name + ' [' + c.clan.tag + '] · ' + c.clan.role : null], [L('Taklif qilgan', 'Referred by', 'Пригласил'), c.referred_by ? c.referred_by.name : null],
          [L('Taklif qilganlari', 'Referrals', 'Пригласил'), c.referrals], ['Push', c.push], [L('Fikrlar', 'Feedback', 'Отзывы'), c.feedback], [L('Xatolar (30 kun)', 'Errors (30d)', 'Ошибки (30 дн)'), c.errors_30d]
        ].map(function (x) { return '<div><span>' + H(x[0]) + '</span><b>' + H(x[1] == null || x[1] === '' ? '—' : x[1]) + '</b></div>'; }).join('') + '</div>') +
        card('📱 ' + L('Qurilmalar', 'Devices', 'Устройства'), table(c.devices || [], [
          [L('Nomi', 'Name', 'Имя'), function (d) { return H(d.name || '—') + (d.signed_out_at ? ' <span class="adm-tag bad">' + H(L('chiqarilgan', 'signed out', 'выход')) + '</span>' : ''); }],
          ['v', function (d) { return H(d.app_version || ''); }], ['⏳', function (d) { return d.sync_pending ? '<b class="adm-warn">' + d.sync_pending + '</b>' : '0'; }],
          [L('Oxirgi', 'Last', 'Посл.'), function (d) { return ago(d.last_seen); }]]) +
          ((c.fg_devices || []).length ? '<div class="adm-sub">🔒 Focusgate</div>' + table(c.fg_devices, [[L('Nomi', 'Name', 'Имя'), function (d) { return H(d.name); }], ['v', function (d) { return H(d.version || ''); }], [L('Oxirgi', 'Last', 'Посл.'), function (d) { return ago(d.last_seen); }]]) : '')) +
        '</div><div class="ad-grid">' +
        card('🪙 ' + L('Tanga tarixi', 'Coin history', 'История монет'), table(c.ledger || [], [
          [L('Vaqt', 'Time', 'Время'), function (l) { return H(dt(l.at)); }],
          ['Δ', function (l) { var f = function (v, u) { return v ? '<span class="' + (v > 0 ? 'adm-up' : 'adm-down') + '">' + (v > 0 ? '+' : '') + v + u + '</span> ' : ''; }; return f(l.d_coins, '🪙') + f(l.d_xp, 'XP') + f(l.d_gems, '💎'); }],
          ['=', function (l) { return (l.coins || 0) + '🪙'; }], [L('Sabab', 'Reason', 'Причина'), function (l) { return '<span class="adm-reason">' + H(l.reason || '') + '</span>' + (l.restored_at ? ' ♻️' : ''); }]]), 'adm-scroll') +
        card('☁️ ' + L('Zaxiralar', 'Backups', 'Копии'), table(c.backups || [], [
          [L('Kun', 'Day', 'День'), function (b) { return H(b.day); }], [L('Tarkibi', 'Content', 'Состав'), function (b) { var i = b.info || {}; return (i.tasks || 0) + '✅ ' + (i.goals || 0) + '🎯 ' + (i.rewards || 0) + '🎁'; }],
          ['', function (b) { return lvl2 ? '<button type="button" class="x-btn ghost sm" data-restore="' + b.slot + '" data-day="' + H(b.day) + '">♻️ ' + H(L('Tiklash', 'Restore', 'Вернуть')) + '</button>' : ''; }]]) +
          (st.restore_slot != null ? '<div class="adm-alert">♻️ ' + H(L('Tiklash so\'ralgan — foydalanuvchi ilovani ochganda bajariladi', 'Restore requested — runs when the user opens the app', 'Восстановление запрошено')) + '</div>' : '')) +
        '</div><div class="ad-grid">' +
        card('✉️ ' + L('Xabarlar', 'Messages', 'Сообщения'), table(c.messages || [], [
          [L('Vaqt', 'Time', 'Время'), function (m) { return H(dt(m.created_at)); }], [L('Matn', 'Text', 'Текст'), function (m) { return '<span class="adm-reason">' + H((m.title ? m.title + ': ' : '') + m.body) + '</span>'; }],
          ['👁', function (m) { return m.seen_at ? '✓' : '·'; }]])) +
        card('📜 ' + L('Admin amallari', 'Admin actions', 'Действия админов'), table(c.audit || [], [
          [L('Vaqt', 'Time', 'Время'), function (a) { return H(dt(a.at)); }], [L('Amal', 'Action', 'Действие'), function (a) { return '<code>' + H(a.action) + '</code>'; }],
          [L('Kim', 'By', 'Кто'), function (a) { return H(String(a.by || '').split('@')[0]); }], ['', function (a) { return '<span class="adm-reason">' + H(a.details ? JSON.stringify(a.details) : '') + '</span>'; }]])) +
        '</div>';
      box.querySelector('[data-close]').onclick = function () { ov.remove(); };
      var A = {
        econ: function () {
          form('🪙 ' + H(L('Tanga / XP / olmos', 'Coins / XP / gems', 'Монеты / XP / алмазы')) + ' — ' + H(p.name), [
            { k: 'coins', label: L('Tanga (+ berish, − olish)', 'Coins (+ give, − take)', 'Монеты (+/−)'), type: 'number', value: 0 },
            { k: 'xp', label: 'XP', type: 'number', value: 0 }, { k: 'gems', label: L('Olmos', 'Gems', 'Алмазы'), type: 'number', value: 0 },
            { k: 'reason', label: L('Sabab (foydalanuvchiga ko\'rinadi)', 'Reason (shown to the user)', 'Причина (видна пользователю)'), ph: L('Masalan: yo\'qolgan tangalar qaytarildi', 'e.g. lost coins returned', 'напр.: возврат монет'), max: 120 },
            { k: 'notify', label: L('Foydalanuvchiga xabar ko\'rsatish', 'Notify the user', 'Уведомить пользователя'), type: 'checkbox', value: true }
          ], L('Saqlash', 'Save', 'Сохранить'), async function (v) {
            await rpc('admin_adjust_econ', { p_uid: uid, p_coins: parseInt(v.coins, 10) || 0, p_xp: parseInt(v.xp, 10) || 0, p_gems: parseInt(v.gems, 10) || 0, p_reason: v.reason, p_notify: v.notify });
            tst('✅ ' + L('Saqlandi', 'Saved', 'Сохранено')); draw();
          });
        },
        ban: function () {
          form('🚫 Ban — ' + H(p.name), [
            { k: 'hours', label: L('Muddat', 'Duration', 'Срок'), type: 'select', value: '24', options: [['1', '1 ' + L('soat', 'hour', 'час')], ['24', '1 ' + L('kun', 'day', 'день')], ['72', '3 ' + L('kun', 'days', 'дня')], ['168', '7 ' + L('kun', 'days', 'дней')], ['720', '30 ' + L('kun', 'days', 'дней')], ['', '♾ ' + L('Muddatsiz', 'Permanent', 'Навсегда')]] },
            { k: 'reason', label: L('Sabab (foydalanuvchiga ko\'rinadi)', 'Reason (shown to the user)', 'Причина'), type: 'textarea', rows: 2, max: 300 }
          ], 'Ban', async function (v) {
            await rpc('admin_ban', { p_uid: uid, p_hours: v.hours ? +v.hours : null, p_reason: v.reason });
            tst('🚫 ' + L('Bloklandi', 'Banned', 'Заблокирован')); draw();
          }, { danger: true, intro: '<p class="adm-p ad-dim">' + H(L('Bloklangan foydalanuvchi ilovani ishlata olmaydi, reyting va lentada ko\'rinmaydi, tanga/XP muzlatiladi.', 'A banned user can\'t use the app, is hidden from leaderboards and feed, and coins/XP are frozen.', 'Заблокированный не может пользоваться приложением, скрыт из рейтинга и ленты.')) + '</p>' });
        },
        unban: function () { confirmDo('✅ ' + H(L('Blokdan chiqarish', 'Unban', 'Разблокировать')), H(p.name), L('Ha', 'Yes', 'Да'), async function () { await rpc('admin_unban', { p_uid: uid }); tst('✅'); draw(); }); },
        rename: function () {
          form('✏️ ' + H(L('Nikni majburan o\'zgartirish', 'Force a nickname change', 'Сменить ник принудительно')), [
            { k: 'reason', label: L('Sabab (foydalanuvchiga ko\'rinadi)', 'Reason (shown to the user)', 'Причина'), ph: L('Nik qoidalarga zid', 'Nickname breaks the rules', 'Ник нарушает правила'), max: 300 },
            { k: 'photo', label: L('Avatarni ham olib tashlash', 'Also remove the avatar', 'Также удалить аватар'), type: 'checkbox', value: false }
          ], L('O\'zgartirish', 'Change', 'Сменить'), async function (v) {
            var n = await rpc('admin_force_rename', { p_uid: uid, p_reason: v.reason, p_reset_photo: v.photo });
            tst('✏️ → ' + n); draw();
          }, { intro: '<p class="adm-p ad-dim">' + H(L('Nik "UserNNNNN" ga almashtiriladi, foydalanuvchi darhol yangisini tanlay oladi (7 kunlik cheklovsiz).', 'The nick becomes "UserNNNNN"; the user can pick a new one right away.', 'Ник станет «UserNNNNN», пользователь сразу сможет выбрать новый.')) + '</p>' });
        },
        msg: function () {
          form('✉️ ' + H(L('Shaxsiy xabar', 'Direct message', 'Личное сообщение')) + ' — ' + H(p.name), [
            { k: 'title', label: L('Sarlavha', 'Title', 'Заголовок'), max: 120 }, { k: 'body', label: L('Matn', 'Text', 'Текст'), type: 'textarea', rows: 5, max: 2000 }
          ], L('Yuborish', 'Send', 'Отправить'), async function (v) { await rpc('admin_send_message', { p_uid: uid, p_title: v.title, p_body: v.body }); tst('✉️ ' + L('Yuborildi', 'Sent', 'Отправлено')); draw(); },
          { intro: '<p class="adm-p ad-dim">' + H(L('Ilovani ochganda oynada ko\'rinadi.', 'Shown in a popup when the user opens the app.', 'Покажется при открытии приложения.')) + '</p>' });
        },
        signout: function () { confirmDo('🚪 ' + H(L('Barcha qurilmalardan chiqarish', 'Sign out everywhere', 'Выйти на всех устройствах')), H(L('Foydalanuvchi barcha qurilmalarda qaytadan kirishi kerak bo\'ladi (masalan, akkaunt o\'g\'irlanganda).', 'The user will have to sign in again on every device (e.g. if the account was stolen).', 'Пользователю придётся войти заново на всех устройствах.')), L('Chiqarish', 'Sign out', 'Выйти'), async function () { var n = await rpc('admin_signout_all', { p_uid: uid }); tst('🚪 ' + n + ' ' + L('sessiya yopildi', 'sessions revoked', 'сессий закрыто')); draw(); }, true); }
      };
      box.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { A[b.dataset.a](); }; });
      box.querySelectorAll('[data-restore]').forEach(function (b) {
        b.onclick = function () {
          confirmDo('♻️ ' + H(L('Zaxiradan tiklash', 'Restore backup', 'Восстановить копию')), H(L(b.dataset.day + ' kungi nusxa foydalanuvchi ilovani keyingi ochganda tiklanadi (tanga/XP o\'zgarmaydi; hozirgi holat ham zaxiraga olinadi).', 'The ' + b.dataset.day + ' copy is restored the next time the user opens the app (coins/XP unchanged; the current state is backed up first).', 'Копия за ' + b.dataset.day + ' будет восстановлена при следующем открытии приложения.')), L('Tiklash', 'Restore', 'Восстановить'), async function () { await rpc('admin_request_restore', { p_uid: uid, p_slot: +b.dataset.restore }); tst('♻️ ' + L('So\'rov yuborildi', 'Requested', 'Запрошено')); draw(); });
        };
      });
    }
    await draw();
  }
  window.adminOpenUser = openUser;

  // ---------------------------------------------------------
  // 🛡 Moderatsiya
  // ---------------------------------------------------------
  var MOD = { days: 7, feedQ: '', hidden: false, clanQ: '' };
  VIEWS.mod = async function (body) {
    var res = await Promise.all([rpc('admin_suspicious', { p_days: MOD.days }), rpc('admin_feed_list', { p_q: MOD.feedQ, p_hidden: MOD.hidden, p_limit: 150 }), rpc('admin_clans_list', { p_q: MOD.clanQ }), rpc('admin_get_config')]);
    var sp = res[0] || {}, feed = res[1] || [], clans = res[2] || [], cfg = res[3] || {}, lvl2 = ME.level >= 2;
    var words = Array.isArray(cfg.banned_words) ? cfg.banned_words : [];
    body.innerHTML = '<div class="adm-bar"><span class="ad-dim">' + H(L('Davr', 'Period', 'Период')) + ':</span><div class="adm-chips">' + [1, 7, 30].map(function (d) { return '<button type="button" data-md="' + d + '" class="' + (MOD.days === d ? 'on' : '') + '">' + d + ' ' + H(L('kun', 'd', 'дн')) + '</button>'; }).join('') + '</div></div>' +
      '<div class="ad-grid">' +
      card('📈 ' + L('Juda tez o\'sish (kuniga 1200+ XP yoki 2000+ tanga)', 'Unusually fast gains', 'Слишком быстрый рост'), table(sp.gains || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.id, r.name); }], ['XP', function (r) { return fmt(r.xp); }], [L('XP/kun', 'XP/day', 'XP/день'), function (r) { return fmt(r.xp_per_day); }],
        ['🪙', function (r) { return fmt(r.coins); }], ['#', function (r) { return r.changes; }]])) +
      card('⚡ ' + L('Bir martalik katta sakrashlar', 'Single big jumps', 'Резкие скачки'), table(sp.spikes || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.user_id, r.name); }], ['Δ', function (r) { return (r.d_coins ? r.d_coins + '🪙 ' : '') + (r.d_xp ? r.d_xp + 'XP ' : '') + (r.d_gems ? r.d_gems + '💎' : ''); }],
        [L('Sabab', 'Reason', 'Причина'), function (r) { return '<span class="adm-reason">' + H(r.reason || '') + '</span>'; }], [L('Vaqt', 'Time', 'Время'), function (r) { return ago(r.at); }]])) +
      card('🧱 ' + L('Cheklovga urilganlar (anti-cheat)', 'Hit the anti-cheat cap', 'Упёрлись в лимит'), table(sp.capped || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.user_id, r.name); }], [L('XP zaxira', 'XP budget', 'Бюджет XP'), function (r) { return r.xp_b; }], [L('Tanga zaxira', 'Coin budget', 'Бюджет монет'), function (r) { return r.coins_b; }], [L('Vaqt', 'Time', 'Время'), function (r) { return ago(r.refilled_at); }]])) +
      card('🚫 ' + L('Bloklanganlar', 'Banned users', 'Заблокированные'), table(sp.banned || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.id, r.name); }], [L('Gacha', 'Until', 'До'), function (r) { return r.until ? H(dt(r.until)) : '♾'; }], [L('Sabab', 'Reason', 'Причина'), function (r) { return '<span class="adm-reason">' + H(r.reason || '') + '</span>'; }]])) +
      '</div><div class="ad-grid">' +
      card('📰 ' + L('Lenta postlari', 'Feed posts', 'Посты ленты'), '<div class="adm-bar"><input class="x-in sm" id="adm-fq" placeholder="🔎" value="' + H(MOD.feedQ) + '"><label class="adm-chk"><input type="checkbox" id="adm-fh"' + (MOD.hidden ? ' checked' : '') + '> ' + H(L('faqat yashirilganlar', 'hidden only', 'только скрытые')) + '</label></div>' +
        table(feed, [[L('Ism', 'Name', 'Имя'), function (r) { return who(r.user_id, r.name); }], [L('Post', 'Post', 'Пост'), function (r) { return H((r.emoji || '') + ' ' + (r.text || '')); }], [L('Vaqt', 'Time', 'Время'), function (r) { return ago(r.created_at); }],
          ['', function (r) { return '<button type="button" class="x-btn ghost sm" data-fh="' + r.id + '" data-on="' + (r.hidden_at ? 0 : 1) + '">' + (r.hidden_at ? '👁 ' + H(L('Ko\'rsatish', 'Show', 'Показать')) : '🙈 ' + H(L('Yashirish', 'Hide', 'Скрыть'))) + '</button>'; }]]), 'adm-scroll') +
      card('🛡 ' + L('Klanlar', 'Clans', 'Кланы'), '<div class="adm-bar"><input class="x-in sm" id="adm-cq" placeholder="🔎" value="' + H(MOD.clanQ) + '"></div>' +
        table(clans, [[L('Klan', 'Clan', 'Клан'), function (r) { return H((r.emoji || '') + ' ' + r.name + ' [' + r.tag + ']') + (r.disbanded_at ? ' <span class="adm-tag bad">' + H(L('tarqatilgan', 'disbanded', 'распущен')) + '</span>' : '') + (r.description ? '<div class="ad-dim adm-reason">' + H(r.description) + '</div>' : ''); }],
          ['👥', function (r) { return r.members; }], [L('Lider', 'Leader', 'Лидер'), function (r) { return who(r.leader_id, r.leader_name); }],
          ['', function (r) { return lvl2 && !r.disbanded_at ? '<button type="button" class="x-btn ghost sm" data-cl="rename" data-id="' + r.id + '" data-v="' + H(r.name) + '">✏️</button><button type="button" class="x-btn ghost sm" data-cl="desc" data-id="' + r.id + '">🧹</button><button type="button" class="x-btn ghost sm adm-danger-t" data-cl="disband" data-id="' + r.id + '" data-v="' + H(r.name) + '">⛔</button>' : ''; }]]), 'adm-scroll') +
      card('🤬 ' + L('Taqiqlangan so\'zlar', 'Banned words', 'Запрещённые слова'), '<p class="adm-p ad-dim">' + H(L('Nik, klan nomi va lenta postlarida tekshiriladi (katta-kichik harf, 0→o, 1→l, @→a kabi almashtirishlar ham). Har qatorga bitta so\'z.', 'Checked in nicknames, clan names and feed posts (case-insensitive, with look-alike swaps like 0→o, 1→l, @→a). One word per line.', 'Проверяются ники, названия кланов и посты. По одному слову в строке.')) + '</p>' +
        '<textarea class="x-in" id="adm-bw" rows="6"' + (lvl2 ? '' : ' disabled') + '>' + H(words.join('\n')) + '</textarea>' + (lvl2 ? '<div class="adm-acts"><button type="button" class="x-btn sm" id="adm-bw-save">' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>' : '')) +
      '</div>';
    body.querySelectorAll('[data-md]').forEach(function (b) { b.onclick = function () { MOD.days = +b.dataset.md; render(); }; });
    body.querySelector('#adm-fq').onkeydown = function (e) { if (e.key === 'Enter') { MOD.feedQ = this.value.trim(); render(); } };
    body.querySelector('#adm-fh').onchange = function () { MOD.hidden = this.checked; render(); };
    body.querySelector('#adm-cq').onkeydown = function (e) { if (e.key === 'Enter') { MOD.clanQ = this.value.trim(); render(); } };
    body.querySelectorAll('[data-fh]').forEach(function (b) { b.onclick = async function () { await act(function () { return rpc('admin_feed_hide', { p_id: +b.dataset.fh, p_hide: b.dataset.on === '1' }); }); render(); }; });
    body.querySelectorAll('[data-cl]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.id, a = b.dataset.cl;
        if (a === 'rename') form('✏️ ' + H(L('Klan nomi', 'Clan name', 'Название клана')), [{ k: 'v', label: L('Yangi nom', 'New name', 'Новое имя'), value: b.dataset.v, max: 24 }], L('Saqlash', 'Save', 'Сохранить'), async function (v) { await rpc('admin_clan_action', { p_id: id, p_action: 'rename', p_value: v.v }); render(); });
        else if (a === 'desc') confirmDo('🧹 ' + H(L('Tavsifni tozalash', 'Clear description', 'Очистить описание')), '', L('Tozalash', 'Clear', 'Очистить'), async function () { await rpc('admin_clan_action', { p_id: id, p_action: 'desc', p_value: '' }); render(); });
        else confirmDo('⛔ ' + H(L('Klanni tarqatish', 'Disband clan', 'Распустить клан')), H(b.dataset.v) + ' — ' + H(L('barcha a\'zolar klandan chiqariladi.', 'all members will be removed.', 'все участники будут исключены.')), L('Tarqatish', 'Disband', 'Распустить'), async function () { await rpc('admin_clan_action', { p_id: id, p_action: 'disband' }); render(); }, true);
      };
    });
    var bw = body.querySelector('#adm-bw-save');
    if (bw) bw.onclick = async function () {
      var list = body.querySelector('#adm-bw').value.split(/\n|,/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 2; });
      list = list.filter(function (s, i) { return list.indexOf(s) === i; }).slice(0, 500);
      await act(function () { return rpc('admin_set_config', { p_key: 'banned_words', p_value: list }); }, '✅ ' + L('Saqlandi', 'Saved', 'Сохранено') + ' (' + list.length + ')');
    };
  };

  // ---------------------------------------------------------
  // 📣 Xabarlar: e'lonlar va ommaviy yuborish
  // ---------------------------------------------------------
  var KIND = { banner: '🏷 Banner', modal: '🪟 ' + L('Oyna', 'Popup', 'Окно'), changelog: '✨ ' + L('Yangi nima bor', 'What\'s new', 'Что нового') };
  function filterFields(v) {
    v = v || {};
    return [
      { k: 'lang', label: L('Til', 'Language', 'Язык'), type: 'select', value: v.lang || '', options: [['', L('Hamma tillar', 'All languages', 'Все языки')], ['uz', 'O\'zbek'], ['en', 'English'], ['ru', 'Русский']] },
      { k: 'country', label: L('Davlat kodi (bo\'sh = hammasi)', 'Country code (empty = all)', 'Код страны (пусто = все)'), value: v.country || '', max: 2, ph: 'UZ' },
      { k: 'level_min', label: L('Daraja ≥', 'Level ≥', 'Уровень ≥'), type: 'number', value: v.level_min || '' },
      { k: 'level_max', label: L('Daraja ≤', 'Level ≤', 'Уровень ≤'), type: 'number', value: v.level_max || '' }
    ];
  }
  function annForm(a) {
    a = a || {};
    var toLocal = function (v) { if (!v) return ''; var d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    form((a.id ? '✏️ ' : '＋ ') + H(L('E\'lon', 'Announcement', 'Объявление')), [
      { k: 'kind', label: L('Turi', 'Type', 'Тип'), type: 'select', value: a.kind || 'banner', options: [['banner', KIND.banner + ' — ' + L('yuqorida, yopib qo\'yish mumkin', 'top bar, dismissible', 'полоса сверху')], ['modal', KIND.modal + ' — ' + L('bir marta', 'once', 'один раз')], ['changelog', KIND.changelog + ' — ' + L('yangilanishdan keyin bir marta', 'once after an update', 'раз после обновления')]] },
      { k: 'title', label: L('Sarlavha', 'Title', 'Заголовок'), value: a.title || '', max: 120 },
      { k: 'body', label: L('Matn (https:// havolalar bosiladigan bo\'ladi)', 'Text (https:// links become clickable)', 'Текст'), type: 'textarea', rows: 5, value: a.body || '', max: 4000 },
      { k: 'version', label: L('Versiya (changelog uchun)', 'Version (for changelog)', 'Версия'), value: a.version || '', max: 20, ph: 'v95' },
      { k: 'audience', label: L('Kimlarga', 'Audience', 'Кому'), type: 'select', value: a.audience || 'all', options: [['all', L('Hammaga', 'Everyone', 'Всем')], ['users', L('Akkauntli', 'Signed-in', 'С аккаунтом')], ['guests', L('Mehmonlar', 'Guests', 'Гостям')]] }
    ].concat(filterFields(a)).concat([
      { k: 'starts_at', label: L('Boshlanishi', 'Starts', 'Начало'), type: 'datetime-local', value: toLocal(a.starts_at) },
      { k: 'ends_at', label: L('Tugashi (bo\'sh = muddatsiz)', 'Ends (empty = never)', 'Конец (пусто = нет)'), type: 'datetime-local', value: toLocal(a.ends_at) },
      { k: 'active', label: L('Faol', 'Active', 'Активно'), type: 'checkbox', value: a.id ? a.active : true }
    ]), L('Saqlash', 'Save', 'Сохранить'), async function (v) {
      if (!v.body) throw new Error(L('Matn bo\'sh', 'Text is empty', 'Пустой текст'));
      var p = Object.assign({}, v, { id: a.id || '', country: (v.country || '').toUpperCase(), starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : '', ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : '' });
      await rpc('admin_announce_save', { p: p }); tst('✅'); try { window.LUOps && window.LUOps.reload(); } catch (e) {} render();
    });
  }
  VIEWS.msg = async function (body) {
    var res = await Promise.all([rpc('admin_announce_list'), rpc('admin_broadcast_list')]);
    var anns = res[0] || [], bcs = res[1] || [], lvl2 = ME.level >= 2;
    var live = function (a) { return a.active && Date.parse(a.starts_at) <= Date.now() && (!a.ends_at || Date.parse(a.ends_at) > Date.now()); };
    body.innerHTML = '<div class="ad-grid">' +
      card('📣 ' + L('E\'lonlar va "Yangi nima bor"', 'Announcements & changelog', 'Объявления'), table(anns, [
        [L('Turi', 'Type', 'Тип'), function (a) { return H(KIND[a.kind] || a.kind) + (live(a) ? ' <span class="adm-tag ok">LIVE</span>' : a.active ? '' : ' <span class="adm-tag">off</span>'); }],
        [L('Matn', 'Text', 'Текст'), function (a) { return '<b>' + H(a.title || '') + '</b> <span class="adm-reason">' + H(a.body) + '</span>'; }],
        ['🎯', function (a) { return H([a.lang, a.country, a.min_level ? 'Lv≥' + a.min_level : '', a.max_level ? 'Lv≤' + a.max_level : '', a.audience !== 'all' ? a.audience : ''].filter(Boolean).join(' · ') || L('hammaga', 'all', 'всем')); }],
        [L('Muddat', 'Period', 'Срок'), function (a) { return H(dd(a.starts_at)) + (a.ends_at ? ' → ' + H(dd(a.ends_at)) : ''); }],
        ['', function (a) { return lvl2 ? '<button type="button" class="x-btn ghost sm" data-ae="' + a.id + '">✏️</button>' + (a.active ? '<button type="button" class="x-btn ghost sm" data-aoff="' + a.id + '">⏸</button>' : '') : ''; }]]),
        '', lvl2 ? '<button type="button" class="x-btn sm" id="adm-ann-new">＋ ' + H(L('Yangi', 'New', 'Новое')) + '</button>' : '') +
      (lvl2 ? card('📨 ' + L('Ommaviy xabar yuborish', 'Send a broadcast', 'Массовая рассылка'), '<div id="adm-bc"></div>') : '') +
      '</div>' +
      card('🕘 ' + L('Yuborilgan ommaviy xabarlar', 'Broadcast history', 'История рассылок'), table(bcs, [
        [L('Vaqt', 'Time', 'Время'), function (b) { return H(dt(b.at)); }], [L('Matn', 'Text', 'Текст'), function (b) { return '<b>' + H(b.title || '') + '</b> <span class="adm-reason">' + H(b.body) + '</span>'; }],
        [L('Kanal', 'Channels', 'Каналы'), function (b) { return H((b.channels || []).join(', ')); }], ['🎯', function (b) { return b.targets || 0; }],
        ['✓', function (b) { return '📱' + (b.sent_inapp || 0) + ' 🔔' + (b.sent_push || 0) + ' ✈️' + (b.sent_tg || 0); }]]));
    var nb = body.querySelector('#adm-ann-new'); if (nb) nb.onclick = function () { annForm(); };
    body.querySelectorAll('[data-ae]').forEach(function (b) { b.onclick = function () { annForm(anns.filter(function (a) { return String(a.id) === b.dataset.ae; })[0]); }; });
    body.querySelectorAll('[data-aoff]').forEach(function (b) { b.onclick = async function () { var a = anns.filter(function (x) { return String(x.id) === b.dataset.aoff; })[0]; await act(function () { return rpc('admin_announce_save', { p: Object.assign({}, a, { active: false }) }); }); render(); }; });
    var bc = body.querySelector('#adm-bc');
    if (bc) {
      bc.innerHTML = '<div class="adm-field"><label>' + H(L('Sarlavha', 'Title', 'Заголовок')) + '</label><input class="x-in" id="bc-title" maxlength="120"></div>' +
        '<div class="adm-field"><label>' + H(L('Matn', 'Text', 'Текст')) + '</label><textarea class="x-in" id="bc-body" rows="4" maxlength="2000"></textarea></div>' +
        '<div class="adm-bar">' +
        '<select class="x-in sm" data-bf="lang"><option value="">' + H(L('Hamma tillar', 'All languages', 'Все языки')) + '</option><option value="uz">O\'zbek</option><option value="en">English</option><option value="ru">Русский</option></select>' +
        '<select class="x-in sm" data-bf="active"><option value="">' + H(L('Hamma', 'Everyone', 'Все')) + '</option><option value="7d">' + H(L('7 kunda faol', 'Active 7d', 'Активные 7 дн')) + '</option><option value="30d">' + H(L('30 kunda faol', 'Active 30d', 'Активные 30 дн')) + '</option><option value="inactive14">💤 ' + H(L('14+ kun kirmagan', 'Away 14+ d', 'Нет 14+ дн')) + '</option></select>' +
        '<input class="x-in sm" data-bf="country" maxlength="2" placeholder="UZ"><input class="x-in sm adm-num" data-bf="level_min" type="number" placeholder="Lv ≥"><input class="x-in sm adm-num" data-bf="level_max" type="number" placeholder="Lv ≤"></div>' +
        '<div class="adm-bar"><label class="adm-chk"><input type="checkbox" data-ch="inapp" checked> 📱 ' + H(L('Ilova ichida', 'In-app', 'В приложении')) + '</label>' +
        '<label class="adm-chk"><input type="checkbox" data-ch="push"> 🔔 Push</label><label class="adm-chk"><input type="checkbox" data-ch="telegram"> ✈️ Telegram</label></div>' +
        '<div class="adm-count" id="bc-prev">…</div><div class="adm-acts"><button type="button" class="x-btn ghost sm" id="bc-check">🎯 ' + H(L('Kimga boradi?', 'Who gets it?', 'Кому уйдёт?')) + '</button><button type="button" class="x-btn sm" id="bc-send">📨 ' + H(L('Yuborish', 'Send', 'Отправить')) + '</button></div>';
      var filters = function () { var f = {}; bc.querySelectorAll('[data-bf]').forEach(function (el) { var v = el.value.trim(); if (el.dataset.bf === 'country') v = v.toUpperCase(); if (v) f[el.dataset.bf] = v; }); return f; };
      var preview = async function () { var d = await act(function () { return rpc('admin_broadcast_preview', { p_f: filters() }); }); bc.querySelector('#bc-prev').innerHTML = '🎯 <b>' + d.users + '</b> ' + H(L('foydalanuvchi', 'users', 'польз.')) + ' · 🔔 ' + d.push + ' push · ✈️ ' + d.telegram + ' Telegram'; return d; };
      bc.querySelector('#bc-check').onclick = preview;
      bc.querySelectorAll('[data-bf]').forEach(function (el) { el.onchange = preview; });
      preview();
      bc.querySelector('#bc-send').onclick = async function () {
        var title = bc.querySelector('#bc-title').value.trim(), text = bc.querySelector('#bc-body').value.trim();
        var ch = [].slice.call(bc.querySelectorAll('[data-ch]:checked')).map(function (x) { return x.dataset.ch; });
        if (!text) { tst('⚠️ ' + L('Matn bo\'sh', 'Text is empty', 'Пустой текст')); return; }
        if (!ch.length) { tst('⚠️ ' + L('Kanal tanlang', 'Pick a channel', 'Выберите канал')); return; }
        var d = await preview();
        confirmDo('📨 ' + H(L('Yuborishni tasdiqlang', 'Confirm broadcast', 'Подтвердите рассылку')), '<b>' + H(title) + '</b><br>' + H(text) + '<br><br>🎯 ' + d.users + ' · ' + H(ch.join(', ')), L('Yuborish', 'Send', 'Отправить'), async function () {
          var r = await supabase.functions.invoke('admin-broadcast', { body: { title: title, body: text, filters: filters(), channels: ch } });
          if (r.error || !r.data || !r.data.ok) throw (r.error || new Error((r.data && r.data.error) || 'failed'));
          tst('📨 ' + L('Yuborildi', 'Sent', 'Отправлено') + ': 📱' + r.data.inapp + ' 🔔' + r.data.push + ' ✈️' + r.data.telegram);
          render();
        });
      };
    }
  };

  // ---------------------------------------------------------
  // ⚙️ Sozlamalar: funksiyalar, texnik ishlar, promo, mavsum
  // ---------------------------------------------------------
  VIEWS.settings = async function (body) {
    var res = await Promise.all([rpc('admin_get_config'), rpc('admin_promo_list'), rpc('admin_season')]);
    var cfg = res[0] || {}, promos = res[1] || [], season = res[2] || {}, lvl2 = ME.level >= 2;
    var flags = cfg.flags || {}, mt = cfg.maintenance || {}, sc = cfg.season || {};
    var F = (window.LUOps && window.LUOps.FEATURES) || {};
    var dis = lvl2 ? '' : ' disabled';
    var toLocal = function (v) { if (!v) return ''; var d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    body.innerHTML = '<div class="ad-grid">' +
      card('🧩 ' + L('Funksiyalar (yoqish / o\'chirish)', 'Features (on / off)', 'Функции (вкл/выкл)'), '<p class="adm-p ad-dim">' + H(L('O\'chirilgan bo\'lim hamma foydalanuvchilarda yashiriladi (kodni o\'zgartirmasdan). 1–2 daqiqada qo\'llanadi.', 'A disabled section is hidden for every user without a code change. Applies within 1–2 minutes.', 'Отключённый раздел скрывается у всех. Применяется за 1–2 минуты.')) + '</p>' +
        '<div class="adm-flags">' + Object.keys(F).map(function (k) { return '<label class="adm-flag"><input type="checkbox" data-flag="' + k + '"' + (flags[k] !== false ? ' checked' : '') + dis + '><span>' + H(L(F[k][0][0], F[k][0][1], F[k][0][2])) + '</span></label>'; }).join('') + '</div>' +
        (lvl2 ? '<div class="adm-acts"><button type="button" class="x-btn sm" id="adm-flags-save">' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>' : '')) +
      card('🛠 ' + L('Texnik ishlar rejimi', 'Maintenance mode', 'Режим обслуживания'), '<label class="adm-flag adm-flag-big"><input type="checkbox" id="mt-on"' + (mt.on ? ' checked' : '') + dis + '><span>' + H(L('Yoqilgan — foydalanuvchilar "Ilova yangilanmoqda" ekranini ko\'radi (jamoa ko\'rmaydi)', 'On — users see an "Updating" screen (staff don\'t)', 'Вкл — пользователи видят экран обновления')) + '</span></label>' +
        ['uz', 'en', 'ru'].map(function (lg) { return '<div class="adm-field"><label>' + lg.toUpperCase() + '</label><input class="x-in" data-mtm="' + lg + '" maxlength="300" value="' + H((mt.msg && mt.msg[lg]) || '') + '"' + dis + '></div>'; }).join('') +
        '<div class="adm-field"><label>' + H(L('Taxminiy tugash vaqti', 'Expected end', 'Ожидаемое окончание')) + '</label><input class="x-in" type="datetime-local" id="mt-until" value="' + toLocal(mt.until) + '"' + dis + '></div>' +
        (lvl2 ? '<div class="adm-acts"><button type="button" class="x-btn sm" id="mt-save">' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>' : '')) +
      '</div><div class="ad-grid">' +
      card('🎁 ' + L('Promo-kodlar', 'Promo codes', 'Промокоды'), table(promos, [
        [L('Kod', 'Code', 'Код'), function (p) { return '<code>' + H(p.code) + '</code>' + (p.active ? '' : ' <span class="adm-tag">off</span>') + (p.note ? '<div class="ad-dim adm-reason">' + H(p.note) + '</div>' : ''); }],
        [L('Sovg\'a', 'Reward', 'Награда'), function (p) { return [p.coins ? p.coins + '🪙' : '', p.xp ? p.xp + 'XP' : '', p.gems ? p.gems + '💎' : ''].filter(Boolean).join(' '); }],
        [L('Ishlatilgan', 'Used', 'Исп.'), function (p) { return p.uses + (p.max_uses ? ' / ' + p.max_uses : ''); }], [L('Muddat', 'Expires', 'Срок'), function (p) { return p.expires_at ? H(dd(p.expires_at)) : '—'; }],
        ['', function (p) { return lvl2 ? '<button type="button" class="x-btn ghost sm" data-pe="' + H(p.code) + '">✏️</button>' : ''; }]]), '', lvl2 ? '<button type="button" class="x-btn sm" id="adm-promo-new">＋ ' + H(L('Yangi', 'New', 'Новый')) + '</button>' : '') +
      card('🏆 ' + L('Reyting mavsumi', 'Leaderboard season', 'Сезон рейтинга'), '<div class="ad-mini"><div><b>' + (season.participants || 0) + '</b><span>👥 ' + H(L('ishtirokchi', 'participants', 'участников')) + '</span></div><div><b>×' + (sc.prize_mult || 1) + '</b><span>🎁 ' + H(L('mukofot koeffitsienti', 'prize multiplier', 'множитель призов')) + '</span></div></div>' +
        (sc.restarted_at ? '<p class="adm-p ad-dim">🔄 ' + H(L('Oxirgi qayta boshlash', 'Last restart', 'Последний перезапуск')) + ': ' + H(dt(sc.restarted_at)) + '</p>' : '') +
        table(season.top || [], [['#', function (r, i) { return i + 1; }], [L('Ism', 'Name', 'Имя'), function (r) { return who(r.id, r.name); }], ['🪙', function (r) { return fmt(r.season_coins); }], ['Lv', function (r) { return r.level || 1; }]]) +
        (lvl2 ? '<div class="adm-acts"><button type="button" class="x-btn ghost sm" id="ss-mult">🎁 ' + H(L('Mukofot koeffitsienti', 'Prize multiplier', 'Множитель')) + '</button><button type="button" class="x-btn sm adm-danger" id="ss-restart">🔄 ' + H(L('Mavsumni hozir yakunlash', 'End season now', 'Завершить сезон')) + '</button></div>' : '') +
        '<div class="adm-sub">🛡 ' + H(L('Klan haftasi', 'Clan week', 'Неделя кланов')) + ' · ' + H(season.clan_week ? dd(season.clan_week) : '—') + '</div>' +
        table(season.clans || [], [['#', function (r) { return r.rank; }], [L('Klan', 'Clan', 'Клан'), function (r) { return H((r.emoji || '') + ' ' + (r.name || '?') + ' [' + (r.tag || '') + ']'); }], ['XP', function (r) { return fmt(Math.round(r.avg_xp)); }]])) +
      '</div>';
    if (!lvl2) return;
    body.querySelector('#adm-flags-save').onclick = async function () {
      var f = {}; body.querySelectorAll('[data-flag]').forEach(function (el) { if (!el.checked) f[el.dataset.flag] = false; });
      await act(function () { return rpc('admin_set_config', { p_key: 'flags', p_value: f }); }, '✅ ' + L('Saqlandi', 'Saved', 'Сохранено'));
      try { window.LUOps.reload(); } catch (e) {}
    };
    body.querySelector('#mt-save').onclick = async function () {
      var on = body.querySelector('#mt-on').checked, msg = {};
      body.querySelectorAll('[data-mtm]').forEach(function (el) { if (el.value.trim()) msg[el.dataset.mtm] = el.value.trim(); });
      var u = body.querySelector('#mt-until').value;
      var go = async function () { await act(function () { return rpc('admin_set_config', { p_key: 'maintenance', p_value: { on: on, msg: msg, until: u ? new Date(u).toISOString() : null } }); }, on ? '🛠 ' + L('Texnik ishlar rejimi yoqildi', 'Maintenance mode is ON', 'Режим обслуживания включён') : '✅ ' + L('O\'chirildi', 'Turned off', 'Выключено')); };
      if (on && !mt.on) confirmDo('🛠 ' + H(L('Texnik ishlar rejimini yoqish', 'Turn on maintenance', 'Включить обслуживание')), H(L('Barcha foydalanuvchilar ilovadan foydalana olmaydi, toki o\'chirmaguningizcha.', 'No user will be able to use the app until you turn it off.', 'Пользователи не смогут работать, пока вы не выключите.')), L('Yoqish', 'Turn on', 'Включить'), go, true);
      else await go();
    };
    var np = body.querySelector('#adm-promo-new');
    var promoForm = function (p) {
      p = p || {};
      form((p.code ? '✏️ ' : '＋ ') + H(L('Promo-kod', 'Promo code', 'Промокод')), [
        { k: 'code', label: L('Kod (A–Z, 0–9, _ -)', 'Code (A–Z, 0–9, _ -)', 'Код'), value: p.code || '', max: 32, ph: 'LEVELUP2026' },
        { k: 'coins', label: L('Tanga (≤ 5000)', 'Coins (≤ 5000)', 'Монеты'), type: 'number', value: p.coins || 0 }, { k: 'xp', label: 'XP (≤ 20000)', type: 'number', value: p.xp || 0 },
        { k: 'gems', label: L('Olmos (≤ 500)', 'Gems (≤ 500)', 'Алмазы'), type: 'number', value: p.gems || 0 },
        { k: 'max_uses', label: L('Necha marta ishlatiladi (bo\'sh = cheksiz)', 'Max uses (empty = unlimited)', 'Макс. использований'), type: 'number', value: p.max_uses || '' },
        { k: 'expires_at', label: L('Tugash sanasi', 'Expires', 'Истекает'), type: 'datetime-local', value: toLocal(p.expires_at) },
        { k: 'note', label: L('Izoh (faqat admin)', 'Note (admin only)', 'Заметка'), value: p.note || '', max: 200 },
        { k: 'active', label: L('Faol', 'Active', 'Активен'), type: 'checkbox', value: p.code ? p.active : true }
      ], L('Saqlash', 'Save', 'Сохранить'), async function (v) {
        await rpc('admin_promo_save', { p: Object.assign({}, v, { code: v.code.toUpperCase(), expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : '' }) }); tst('✅'); render();
      });
    };
    if (np) np.onclick = function () { promoForm(); };
    body.querySelectorAll('[data-pe]').forEach(function (b) { b.onclick = function () { promoForm(promos.filter(function (p) { return p.code === b.dataset.pe; })[0]); }; });
    body.querySelector('#ss-mult').onclick = function () {
      form('🎁 ' + H(L('Mavsum mukofoti koeffitsienti', 'Season prize multiplier', 'Множитель призов')), [{ k: 'm', label: '× (0.5 – 5)', type: 'number', value: sc.prize_mult || 1 }], L('Saqlash', 'Save', 'Сохранить'), async function (v) {
        var m = Math.max(0.5, Math.min(5, parseFloat(v.m) || 1));
        await rpc('admin_set_config', { p_key: 'season', p_value: Object.assign({}, sc, { prize_mult: m }) }); tst('✅'); render();
      }, { intro: '<p class="adm-p ad-dim">' + H(L('Top-3 oylik mukofotlari shu songa ko\'paytiriladi (masalan, bayramda ×2).', 'Monthly top-3 prizes are multiplied by this (e.g. ×2 for a holiday).', 'Призы топ-3 умножаются на это число.')) + '</p>' });
    };
    body.querySelector('#ss-restart').onclick = function () {
      confirmDo('🔄 ' + H(L('Mavsumni hozir yakunlash', 'End the season now', 'Завершить сезон сейчас')), H(L('Joriy mavsum yakunlanadi: Top-3 mukofotlarini oladi, hammaning mavsum tangalari 0 dan boshlanadi. Har bir foydalanuvchida ilovani keyingi ochganda qo\'llanadi.', 'The current season ends: the top 3 get their prizes and everyone\'s season coins start from 0. Applies on each user\'s next app open.', 'Сезон завершится: топ-3 получат призы, сезонные монеты обнулятся.')), L('Yakunlash', 'End season', 'Завершить'), async function () {
        await rpc('admin_set_config', { p_key: 'season', p_value: Object.assign({}, sc, { epoch: (Number(sc.epoch) || 0) + 1, restarted_at: new Date().toISOString() }) }); tst('🔄 ' + L('Yangi mavsum boshlandi', 'New season started', 'Новый сезон начался')); try { window.LUOps.reload(); } catch (e) {} render();
      }, true);
    };
  };

  // ---------------------------------------------------------
  // 🩺 Tizim: xatolar, sinxron, server
  // ---------------------------------------------------------
  var SYS = { days: 7, resolved: false };
  VIEWS.system = async function (body) {
    var calls = [rpc('admin_errors', { p_days: SYS.days, p_resolved: SYS.resolved }), rpc('admin_sync_issues')];
    if (ME.level >= 2) calls.push(rpc('admin_system_health'));
    var res = await Promise.all(calls);
    var er = res[0] || {}, sy = res[1] || {}, hl = res[2];
    body.innerHTML = '<div class="adm-bar"><span class="ad-dim">' + H(L('Xatolar', 'Errors', 'Ошибки')) + ':</span><div class="adm-chips">' + [1, 7, 30].map(function (d) { return '<button type="button" data-sd="' + d + '" class="' + (SYS.days === d ? 'on' : '') + '">' + d + ' ' + H(L('kun', 'd', 'дн')) + '</button>'; }).join('') + '</div>' +
      '<label class="adm-chk"><input type="checkbox" id="sys-res"' + (SYS.resolved ? ' checked' : '') + '> ' + H(L('hal qilinganlar ham', 'include resolved', 'включая решённые')) + '</label>' + csvBtn('errors') + '</div>' +
      '<div class="ad-grid">' + card('🐞 ' + L('Xatolar soni', 'Error count', 'Число ошибок'), bars(er.by_day || [], 'day', 'n', dayLbl, 0, 'var(--red)')) +
      card('🔄 ' + L('Sinxron', 'Sync', 'Синхронизация'), '<div class="ad-mini"><div><b>' + (sy.devices_7d || 0) + '</b><span>📱 ' + H(L('faol qurilma (7 kun)', 'active devices (7d)', 'устройств (7 дн)')) + '</span></div><div><b>' + (sy.issues || []).length + '</b><span>⚠️ ' + H(L('muammoli', 'with issues', 'с проблемами')) + '</span></div>' +
        '<div><b>' + (sy.stale_state || 0) + '</b><span>🕰 ' + H(L('eski bulut holati', 'stale cloud state', 'устаревшее состояние')) + '</span></div></div>' +
        '<div class="adm-sub">🏷 ' + H(L('Ilova versiyalari', 'App versions', 'Версии')) + '</div>' + hlist(sy.versions || [], function (x) { return H(x.version); }, 'n')) + '</div>' +
      card('🐞 ' + L('Eng ko\'p uchragan xatolar', 'Top errors', 'Частые ошибки'), table(er.rows || [], [
        ['#', function (r) { return '<b>' + r.n + '</b>'; }], ['👤', function (r) { return r.users || 0; }],
        [L('Xato', 'Error', 'Ошибка'), function (r) { return '<details class="adm-err"><summary>' + H(r.msg) + '</summary><div class="ad-dim">' + H((r.src || '') + (r.line ? ':' + r.line : '')) + ' · ' + H(r.version || '') + ' · ' + H(r.url || '') + '</div><pre>' + H(r.stack || '') + '</pre><div class="ad-dim">' + H(r.ua || '') + '</div></details>'; }],
        [L('Oxirgi', 'Last', 'Посл.'), function (r) { return ago(r.last_at); }],
        ['', function (r) { return '<button type="button" class="x-btn ghost sm" data-er="' + H(r.sig) + '" data-on="' + (r.resolved ? 0 : 1) + '">' + (r.resolved ? '↩️' : '✅') + '</button>'; }]])) +
      card('⚠️ ' + L('Sinxron muammolari (7 kun)', 'Sync issues (7 days)', 'Проблемы синхронизации'), table(sy.issues || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return who(r.user_id, r.name); }], [L('Qurilma', 'Device', 'Устройство'), function (r) { return H(r.device || '') + ' <span class="ad-dim">' + H(r.app_version || '') + '</span>'; }],
        ['⏳', function (r) { return r.sync_pending || 0; }], [L('Xato', 'Error', 'Ошибка'), function (r) { return '<span class="adm-reason">' + H(r.sync_err || '') + '</span>'; }], [L('Vaqt', 'Time', 'Время'), function (r) { return ago(r.sync_at); }]])) +
      (hl ? card('🖥 ' + L('Server holati', 'Server health', 'Состояние сервера'), '<div class="ad-kpis">' +
        tile('💾', L('Baza hajmi', 'Database size', 'Размер БД'), (hl.db_size_mb || 0) + ' MB', '') + tile('👥', L('Akkauntlar', 'Accounts', 'Аккаунты'), fmt(hl.users), '') +
        tile('🔔', 'Push', fmt(hl.push_subs), '24h: ' + (hl.push_sent_24h || 0)) + tile('✈️', 'Telegram', fmt(hl.tg_enabled), '') + tile('🐞', L('Bugungi xatolar', 'Errors today', 'Ошибок сегодня'), fmt(hl.errors_today), '') +
        tile('🌐', 'HTTP', ((hl.http && hl.http.errors) || 0) + ' / ' + ((hl.http && hl.http.total) || 0), L('xato / jami (pg_net)', 'errors / total (pg_net)', 'ошибок / всего')) + '</div>' +
        '<div class="ad-grid">' + card('⏰ Cron', table(Array.isArray(hl.cron) ? hl.cron : [], [
          [L('Ish', 'Job', 'Задача'), function (j) { return '<code>' + H(j.jobname) + '</code> <span class="ad-dim">' + H(j.schedule) + '</span>'; }],
          [L('Oxirgi', 'Last', 'Посл.'), function (j) { var r = (j.runs || [])[0]; return r ? (r.status === 'succeeded' ? '✅ ' : '❌ ') + ago(r.start) : '—'; }],
          ['24h ❌', function (j) { return j.fails_24h ? '<b class="adm-warn">' + j.fails_24h + '</b>' : '0'; }]])) +
        card('📦 ' + L('Eng katta jadvallar', 'Largest tables', 'Крупные таблицы'), table(hl.tables || [], [[L('Jadval', 'Table', 'Таблица'), function (t) { return '<code>' + H(t.name) + '</code>'; }], ['MB', function (t) { return t.mb; }], [L('Qator', 'Rows', 'Строк'), function (t) { return fmt(Math.max(0, t.rows)); }]])) + '</div>' +
        ((hl.http && (hl.http.recent || []).length) ? '<div class="adm-sub">🌐 ' + H(L('So\'nggi HTTP xatolari', 'Recent HTTP errors', 'Ошибки HTTP')) + '</div>' + table(hl.http.recent, [['', function (x) { return x.status_code || '—'; }], ['', function (x) { return '<span class="adm-reason">' + H(x.msg || '') + '</span>'; }], ['', function (x) { return ago(x.created); }]]) : '')) : '');
    body.querySelectorAll('[data-sd]').forEach(function (b) { b.onclick = function () { SYS.days = +b.dataset.sd; render(); }; });
    body.querySelector('#sys-res').onchange = function () { SYS.resolved = this.checked; render(); };
    body.querySelectorAll('[data-er]').forEach(function (b) { b.onclick = async function () { await act(function () { return rpc('admin_error_resolve', { p_sig: b.dataset.er, p_resolved: b.dataset.on === '1' }); }); render(); }; });
    bindCsv(body, { errors: function () { csv('errors', er.rows || [], [['n', 'count'], ['users', 'users'], ['msg', 'message'], ['src', 'source'], ['line', 'line'], ['version', 'version'], ['url', 'url'], ['last_at', 'last_at'], ['stack', 'stack']]); } });
  };

  // ---------------------------------------------------------
  // 👥 Jamoa va jurnal
  // ---------------------------------------------------------
  var AUD = { action: '' };
  VIEWS.team = async function (body) {
    var calls = [rpc('admin_staff_list')]; if (ME.level >= 2) calls.push(rpc('admin_audit_list', { p_limit: 300, p_action: AUD.action || null }));
    var res = await Promise.all(calls), staff = res[0] || [], aud = res[1] || [], own = ME.level >= 3;
    var RN = { owner: '👑 OWNER', admin: '🛡️ ADMIN', helper: '🤝 HELPER' };
    body.innerHTML = '<div class="ad-grid">' + card('👥 ' + L('Jamoa', 'Team', 'Команда'), '<p class="adm-p ad-dim">' + H(L('HELPER: ko\'rish, fikrlar, xabar, nik va post moderatsiyasi. ADMIN: + tanga, ban, sozlamalar, e\'lon, promo, ommaviy xabar. OWNER: + jamoani boshqarish.', 'HELPER: view, feedback, messages, nick/post moderation. ADMIN: + coins, bans, settings, announcements, promos, broadcasts. OWNER: + team management.', 'HELPER: просмотр и модерация. ADMIN: + монеты, баны, настройки. OWNER: + команда.')) + '</p>' +
      table(staff, [[L('Email', 'Email', 'Email'), function (s) { return H(s.email) + (s.user_id ? '<div class="ad-dim">' + who(s.user_id, s.name) + '</div>' : '<div class="ad-dim">' + H(L('hali ro\'yxatdan o\'tmagan', 'not signed up yet', 'ещё не зарегистрирован')) + '</div>'); }],
        [L('Rol', 'Role', 'Роль'), function (s) { return s.revoked_at ? '<s class="ad-dim">' + H(RN[s.role] || s.role) + '</s>' : H(RN[s.role] || s.role); }],
        [L('Faollik', 'Active', 'Актив.'), function (s) { return ago(s.last_active_at); }],
        ['', function (s) { return own && s.email !== ME.email ? '<button type="button" class="x-btn ghost sm" data-se="' + H(s.email) + '" data-role="' + H(s.revoked_at ? 'revoked' : s.role) + '">✏️</button>' : ''; }]]),
      '', own ? '<button type="button" class="x-btn sm" id="adm-staff-add">＋ ' + H(L('Qo\'shish', 'Add', 'Добавить')) + '</button>' : '') + '</div>' +
      (ME.level >= 2 ? card('📜 ' + L('Admin amallari jurnali', 'Admin audit log', 'Журнал действий'), '<div class="adm-bar"><select class="x-in sm" id="aud-act"><option value="">' + H(L('Hamma amallar', 'All actions', 'Все действия')) + '</option>' +
        ['adjust_econ', 'ban', 'unban', 'force_rename', 'request_restore', 'signout_all', 'message', 'broadcast', 'feed_hide', 'feed_unhide', 'clan_rename', 'clan_disband', 'config_flags', 'config_maintenance', 'config_season', 'config_banned_words', 'promo_save', 'announce_save', 'staff_set', 'view_user', 'error_resolve'].map(function (a) { return '<option' + (AUD.action === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>' + csvBtn('audit') + '</div>' +
        table(aud, [[L('Vaqt', 'Time', 'Время'), function (a) { return H(dt(a.at)); }], [L('Kim', 'Who', 'Кто'), function (a) { return H(String(a.admin_email || '').split('@')[0]); }],
          [L('Amal', 'Action', 'Действие'), function (a) { return '<code>' + H(a.action) + '</code>'; }], [L('Kimga', 'Target', 'Кому'), function (a) { return a.target ? who(a.target, a.target_name || String(a.target).slice(0, 8)) : ''; }],
          [L('Tafsilot', 'Details', 'Детали'), function (a) { return '<span class="adm-reason">' + H(a.details ? JSON.stringify(a.details) : '') + '</span>'; }]]), 'adm-scroll') : '');
    var addF = function (email, role) {
      form(email ? '✏️ ' + H(email) : '＋ ' + H(L('Jamoaga qo\'shish', 'Add to the team', 'Добавить в команду')), [
        { k: 'email', label: 'Email', value: email || '', ph: 'name@gmail.com' },
        { k: 'role', label: L('Rol', 'Role', 'Роль'), type: 'select', value: role || 'helper', options: [['helper', RN.helper], ['admin', RN.admin], ['owner', RN.owner], ['revoked', '⛔ ' + L('Rolni olib tashlash', 'Remove role', 'Снять роль')]] }
      ], L('Saqlash', 'Save', 'Сохранить'), async function (v) { await rpc('admin_staff_set', { p_email: v.email, p_role: v.role }); tst('✅'); render(); },
      { intro: '<p class="adm-p ad-dim">' + H(L('Email tasdiqlangan akkauntga rol beriladi (Google yoki email bilan kirgan).', 'The role applies to a confirmed account with this email.', 'Роль действует для подтверждённого аккаунта с этим email.')) + '</p>' });
    };
    var ad = body.querySelector('#adm-staff-add'); if (ad) ad.onclick = function () { addF(); };
    body.querySelectorAll('[data-se]').forEach(function (b) { b.onclick = function () { addF(b.dataset.se, b.dataset.role); }; });
    var sa = body.querySelector('#aud-act'); if (sa) sa.onchange = function () { AUD.action = this.value; render(); };
    bindCsv(body, { audit: function () { csv('audit', aud, [['at', 'at'], ['admin_email', 'admin'], ['action', 'action'], ['target', 'target'], ['target_name', 'target_name'], ['details', 'details']]); } });
  };

  // ---------------------------------------------------------
  // 📨 Fikrlar (mavjud inbox — extras.js)
  // ---------------------------------------------------------
  VIEWS.fb = async function (body) {
    body.innerHTML = '<div class="ad-card"><div id="admin-feedback-box"></div></div>';
    try { if (typeof window.adminRenderFeedback === 'function') await window.adminRenderFeedback('new'); } catch (e) {}
  };
})();
