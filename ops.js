// ============================================================
// 🛰 OPS — admin panelidan boshqariladigan, hamma foydalanuvchida ishlaydigan qism
//   • 🐞 JS xatolarini serverga yozish (log_client_error) — admin "Xatolar" bo'limi
//   • ⚙️ app_config: funksiyalarni yoqish/o'chirish (flags), texnik ishlar rejimi, mavsum (epoch, mukofot)
//   • 📣 E'lonlar: banner / bir martalik oyna / "Yangi nima bor" (get_announcements)
//   • ✉️ Admin xabarlari, 🚫 ban ekrani, ✏️ majburiy nik, ♻️ admin so'ragan zaxira tiklash (get_my_status)
//   • 🎁 Promo-kod (Sozlamalar → Promo-kod)
// account.js dan keyin yuklanadi. Hamma server chaqiruvlari xato bersa jim o'tadi.
// ============================================================
(function () {
  'use strict';
  window.APP_VERSION = 'v128'; // sw.js CACHE_VERSION bilan bir xil

  function L(uz, en, ru) { try { return _cl(uz, en, ru); } catch (e) { return uz; } }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Oddiy matn → xavfsiz HTML (qatorlar, havolalar)
  function T(s) { return H(s).replace(/\n/g, '<br>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function sbOk() { return typeof supabase !== 'undefined' && supabase && supabase.rpc; }
  function linked() { return !!(typeof S !== 'undefined' && S && S.cloudLinked && S.cloudUserId); }
  function owner() { try { return _cloudOwnerOk(); } catch (e) { return false; } }
  function tst(m) { try { toast(m); } catch (e) {} }
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lang() { try { return getLang(); } catch (e) { return 'uz'; } }
  function pick(o) { if (!o) return ''; if (typeof o === 'string') return o; return o[lang()] || o.uz || o.en || o.ru || ''; }
  function modal(html, cls) {
    var ov = document.createElement('div');
    ov.className = 'x-ov ops-ov';
    ov.innerHTML = '<div class="x-box ops-box ' + (cls || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    ov.close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180); };
    return ov;
  }
  var staffLevel = 0;
  function isStaff() { return staffLevel > 0 || !!window._isAdmin; }

  // =========================================================
  // 🐞 Xatolar jurnali
  // =========================================================
  var _errSent = 0, _errSeen = {};
  function reportError(msg, src, line, stack) {
    try {
      msg = String(msg || '').slice(0, 500);
      if (!msg || /^Script error\.?$/i.test(msg) || /ResizeObserver loop/i.test(msg)) return;
      src = String(src || '');
      if (/^(chrome|moz|safari)-extension:/.test(src) || /extension:\/\//.test(String(stack || ''))) return;
      var k = msg + '|' + src + '|' + line;
      if (_errSeen[k] || _errSent >= 15 || !sbOk()) return;
      _errSeen[k] = 1; _errSent++;
      supabase.rpc('log_client_error', { p: { msg: msg, src: src.replace(location.origin, ''), line: line == null ? '' : String(line), stack: String(stack || '').slice(0, 3000),
        version: window.APP_VERSION, url: location.pathname + location.hash, ua: (navigator.userAgent || '').slice(0, 200) } }).then(function () {}, function () {});
    } catch (e) {}
  }
  window.addEventListener('error', function (e) { reportError(e.message, e.filename, e.lineno, e.error && e.error.stack); });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; if (!r) return;
    var m = r.message || String(r);
    if (/Failed to fetch|NetworkError|Load failed|AbortError|JWT expired/i.test(m)) return; // tarmoq xatolari — bizning xato emas
    reportError('Unhandled: ' + m, r.fileName || '', r.lineNumber || '', r.stack);
  });

  // =========================================================
  // ⚙️ Ilova sozlamalari (app_config)
  // =========================================================
  var CFG = jget('ludAppConfig', null) || {};
  // Funksiya kaliti → [nomi, yashiriladigan elementlar, nav tab]
  var FEATURES = {
    chest: [['🎲 Chest', 'Chest', 'Chest'], 'button[data-tab="chest"], #tab-chest', 'chest'],
    reyting: [['🏆 Reyting', 'Leaderboard', 'Рейтинг'], 'button[data-tab="reyting"], #tab-reyting, #friends-tab-reyting', 'reyting'],
    ielts: [['📊 IELTS', 'IELTS', 'IELTS'], 'button[data-tab="ielts"], #tab-ielts', 'ielts'],
    sat: [['📐 SAT', 'SAT', 'SAT'], 'button[data-tab="sat"], #tab-sat', 'sat'],
    cefr: [['📘 CEFR', 'CEFR', 'CEFR'], 'button[data-tab="cefr"], #tab-cefr', 'cefr'],
    pomodoro: [['⏱️ Pomodoro', 'Pomodoro', 'Pomodoro'], 'button[data-tab="pomo"], #tab-pomo', null],
    focusgate: [['🔒 Focusgate', 'Focusgate', 'Focusgate'], 'button[data-tab="blocker"], #tab-blocker', 'blocker'],
    hub: [['🚀 Hub', 'Hub', 'Hub'], 'button[data-tab="hub"], #tab-hub', 'hub'],
    friends: [['👥 Do\'stlar', 'Friends', 'Друзья'], '#header-friends-btn, #friends-settings-card', null],
    duels: [['⚔️ Duel / chorlov', 'Duels', 'Дуэли'], '#friends-tab-challenge', null],
    party: [['🎉 Party / World Party', 'Party / World Party', 'Пати'], '#friends-tab-party', null],
    clans: [['🛡 Klanlar', 'Clans', 'Кланы'], '[data-sec="clans"], [data-tool="clans"]', null],
    feed: [['📰 Lenta', 'Feed', 'Лента'], '[data-sec="feed"]', null],
    spin: [['🎡 Omad g\'ildiragi', 'Spin wheel', 'Колесо'], '[data-sec="spin"], [data-tool="spin"]', null],
    promo: [['🎁 Promo-kod', 'Promo codes', 'Промокоды'], '#ops-promo-card', null]
  };
  function featureOn(k) { var f = CFG.flags || {}; return f[k] !== false; }
  function applyFlags() {
    var css = '';
    Object.keys(FEATURES).forEach(function (k) {
      var off = !featureOn(k);
      document.body.classList.toggle('ff-off-' + k, off);
      if (off) css += FEATURES[k][1].split(',').map(function (sel) { return 'body.ff-off-' + k + ' ' + sel.trim(); }).join(', ') + '{display:none!important}';
    });
    var st = document.getElementById('ops-flags-css');
    if (!st) { st = document.createElement('style'); st.id = 'ops-flags-css'; document.head.appendChild(st); }
    st.textContent = css;
    // Ochiq turgan bo'lim o'chirilgan bo'lsa — Vazifalarga
    try {
      var cur = document.documentElement.getAttribute('data-tab');
      Object.keys(FEATURES).forEach(function (k) { if (!featureOn(k) && FEATURES[k][2] && FEATURES[k][2] === cur) showTab('tasks'); });
    } catch (e) {}
  }
  // showTab: o'chirilgan bo'limga o'tishni to'xtatish
  function wrapShowTab() {
    if (typeof window.showTab !== 'function' || window.showTab._ops) return;
    var orig = window.showTab;
    var w = function (tab) {
      for (var k in FEATURES) {
        if (FEATURES[k][2] === tab && !featureOn(k)) { tst('🔧 ' + L('Bu bo\'lim vaqtincha o\'chirilgan', 'This section is temporarily disabled', 'Раздел временно отключён')); return orig.call(this, 'tasks'); }
      }
      return orig.apply(this, arguments);
    };
    w._ops = true; window.showTab = w;
  }

  // 🔧 Texnik ishlar rejimi (jamoa a'zolari ko'rmaydi)
  var _maintEl = null;
  function applyMaintenance() {
    var m = CFG.maintenance || {};
    var on = !!m.on && !isStaff() && !(m.until && Date.parse(m.until) < Date.now());
    if (!on) { if (_maintEl) { _maintEl.remove(); _maintEl = null; } return; }
    if (!_maintEl) { _maintEl = document.createElement('div'); _maintEl.className = 'ops-full ops-maint'; document.body.appendChild(_maintEl); }
    _maintEl.innerHTML = '<div class="ops-full-box"><div class="ops-full-ic">🛠</div><h3>' + H(L('Ilova yangilanmoqda', 'We\'re updating the app', 'Приложение обновляется')) + '</h3>' +
      '<p>' + T(pick(m.msg) || L('Tez orada qaytamiz. Ma\'lumotlaringiz xavfsiz.', 'We\'ll be back soon. Your data is safe.', 'Скоро вернёмся. Ваши данные в безопасности.')) + '</p>' +
      (m.until ? '<p class="ops-dim">⏳ ' + H(new Date(m.until).toLocaleString()) + '</p>' : '') +
      '<button type="button" class="x-btn" data-r>🔄 ' + H(L('Qayta tekshirish', 'Check again', 'Проверить снова')) + '</button></div>';
    _maintEl.querySelector('[data-r]').onclick = function () { loadConfig(true); };
  }
  function applyConfig() { applyFlags(); applyMaintenance(); }
  var _cfgAt = 0;
  async function loadConfig(force) {
    if (!sbOk() || (!force && Date.now() - _cfgAt < 60000)) return;
    _cfgAt = Date.now();
    try {
      var r = await supabase.from('app_config').select('key,value');
      if (r.error || !r.data) return;
      var c = {}; r.data.forEach(function (x) { c[x.key] = x.value; });
      var prevEpoch = Number(CFG.season && CFG.season.epoch) || 0;
      CFG = c; jset('ludAppConfig', c);
      applyConfig();
      // Admin mavsumni qayta boshladi — reytingni darhol yangilaymiz
      if ((Number(c.season && c.season.epoch) || 0) !== prevEpoch) { try { checkReytingMonthlySeason(); } catch (e) {} }
    } catch (e) {}
  }

  // =========================================================
  // 📣 E'lonlar
  // =========================================================
  function annSeen() { return jget('ludAnnSeen', {}); }
  function annMark(id) { var s = annSeen(); s[id] = Date.now(); jset('ludAnnSeen', s); }
  var _annList = [];
  function renderBanner() {
    var old = document.getElementById('ops-banner'); if (old) old.remove();
    var seen = annSeen();
    var b = _annList.filter(function (a) { return a.kind === 'banner' && !seen[a.id]; })[0];
    if (!b) return;
    var el = document.createElement('div'); el.id = 'ops-banner'; el.className = 'ops-banner'; el.setAttribute('role', 'status');
    el.innerHTML = '<span class="ops-banner-ic">📣</span><div class="ops-banner-t">' + (b.title ? '<b>' + H(b.title) + '</b> ' : '') + T(b.body) + '</div><button type="button" aria-label="close">✕</button>';
    el.querySelector('button').onclick = function () { annMark(b.id); el.remove(); renderBanner(); };
    document.body.appendChild(el);
  }
  var _modalBusy = false;
  function nextModal() {
    if (_modalBusy || _lockedOut()) return;
    var seen = annSeen();
    var a = _annList.filter(function (x) { return (x.kind === 'modal' || x.kind === 'changelog') && !seen[x.id]; }).pop(); // eng eskisidan
    if (a) {
      _modalBusy = true;
      var ov = modal('<div class="ops-ann-ic">' + (a.kind === 'changelog' ? '✨' : '📣') + '</div>' +
        '<h3 class="ops-h">' + H(a.title || (a.kind === 'changelog' ? L('Yangi nima bor', 'What\'s new', 'Что нового') : 'LevelUpDay')) + (a.version ? ' <span class="ops-ver">' + H(a.version) + '</span>' : '') + '</h3>' +
        '<div class="ops-body">' + T(a.body) + '</div><div class="ops-acts"><button type="button" class="x-btn" data-ok>' + H(L('Tushunarli', 'Got it', 'Понятно')) + '</button></div>', 'ops-ann');
      ov.querySelector('[data-ok]').onclick = function () { annMark(a.id); ov.close(); _modalBusy = false; setTimeout(nextModal, 300); };
      return;
    }
    showNextMessage();
  }
  async function loadAnnouncements() {
    if (!sbOk()) return;
    try {
      var lvl = 1; try { lvl = getLevel(S.xp || 0).level || 1; } catch (e) {}
      var r = await supabase.rpc('get_announcements', { p_lang: lang(), p_country: (S.profile && S.profile.country) || null, p_level: lvl, p_user: linked() });
      if (r.error || !Array.isArray(r.data)) return;
      // Birinchi ochilishda eski "Yangi nima bor" larni ko'rsatmaymiz (yangi foydalanuvchi uchun)
      var seen = annSeen();
      if (!localStorage.getItem('ludAnnInit')) {
        r.data.forEach(function (a) { if (a.kind === 'changelog') seen[a.id] = Date.now(); });
        jset('ludAnnSeen', seen); try { localStorage.setItem('ludAnnInit', '1'); } catch (e) {}
      }
      _annList = r.data;
      renderBanner(); nextModal();
    } catch (e) {}
  }

  // =========================================================
  // ✉️ Admin xabarlari, 🚫 ban, ✏️ nik, ♻️ tiklash
  // =========================================================
  var _msgQueue = [], _status = null, _msgShown = {};
  function msgHtml(m) {
    if (m.kind === 'econ') {
      var d = m.data || {}, parts = [];
      if (d.coins) parts.push((d.coins > 0 ? '+' : '') + d.coins + ' 🪙');
      if (d.xp) parts.push((d.xp > 0 ? '+' : '') + d.xp + ' XP');
      if (d.gems) parts.push((d.gems > 0 ? '+' : '') + d.gems + ' 💎');
      var plus = (d.coins || 0) + (d.xp || 0) + (d.gems || 0) >= 0;
      return '<div class="ops-ann-ic">' + (plus ? '🎁' : '⚖️') + '</div><h3 class="ops-h">' + H(plus ? L('Sizga sovg\'a!', 'A gift for you!', 'Вам подарок!') : L('Hisobingiz tuzatildi', 'Your balance was adjusted', 'Баланс исправлен')) + '</h3>' +
        '<div class="ops-econ">' + H(parts.join('  ')) + '</div><div class="ops-body"><span class="ops-dim">👑 LevelUpDay · </span>' + T(m.body) + '</div>';
    }
    return '<div class="ops-ann-ic">' + (m.kind === 'broadcast' ? '📣' : '✉️') + '</div><h3 class="ops-h">' + H(m.title || L('LevelUpDay jamoasidan xabar', 'Message from the LevelUpDay team', 'Сообщение от команды LevelUpDay')) + '</h3>' +
      '<div class="ops-body">' + T(m.body) + '</div><div class="ops-dim ops-from">👑 LevelUpDay · ' + H(new Date(m.at).toLocaleString()) + '</div>';
  }
  function showNextMessage() {
    if (_modalBusy || _lockedOut() || !_msgQueue.length) return;
    var m = _msgQueue.shift();
    _msgShown[m.id] = 1;
    _modalBusy = true;
    var ov = modal(msgHtml(m) + '<div class="ops-acts">' + (m.kind === 'admin' ? '<button type="button" class="x-btn ghost" data-reply>↩️ ' + H(L('Javob yozish', 'Reply', 'Ответить')) + '</button>' : '') +
      '<button type="button" class="x-btn" data-ok>' + H(L('Rahmat', 'Thanks', 'Спасибо')) + '</button></div>', 'ops-msg');
    var done = function () { ov.close(); _modalBusy = false; markSeen([m.id]); setTimeout(nextModal, 300); };
    ov.querySelector('[data-ok]').onclick = done;
    var rp = ov.querySelector('[data-reply]');
    if (rp) rp.onclick = function () { done(); setTimeout(function () { try { openFeedbackModal(); } catch (e) {} }, 350); };
  }
  // ✅ Ko'rilgan xabar: serverga yuboriladi (supabase so'rovi .then'siz umuman jo'natilmaydi!) va qurilmada ham eslab qolinadi —
  // tarmoq xatosida ham qayta chiqmaydi, keyingi ochilishda serverga yana yuboriladi
  function seenKey() { return 'ludMsgSeen_' + ((typeof S !== 'undefined' && S && S.cloudUserId) || ''); }
  function markSeen(ids) {
    var loc = jget(seenKey(), []); ids.forEach(function (id) { if (loc.indexOf(id) === -1) loc.push(id); }); jset(seenKey(), loc.slice(-300));
    try { supabase.rpc('mark_messages_seen', { p_ids: ids }).then(function () {}, function () {}); } catch (e) {}
  }
  function _lockedOut() { return !!document.querySelector('.ops-ban, .ops-maint, .acc-lock, .acc-loading'); }

  var _banEl = null;
  function applyBan(b) {
    if (!b) { if (_banEl) { _banEl.remove(); _banEl = null; } return; }
    if (!_banEl) { _banEl = document.createElement('div'); _banEl.className = 'ops-full ops-ban'; document.body.appendChild(_banEl); }
    _banEl.innerHTML = '<div class="ops-full-box"><div class="ops-full-ic">🚫</div><h3>' + H(L('Akkauntingiz bloklangan', 'Your account is suspended', 'Ваш аккаунт заблокирован')) + '</h3>' +
      (b.reason ? '<p><b>' + H(L('Sabab', 'Reason', 'Причина')) + ':</b> ' + H(b.reason) + '</p>' : '') +
      '<p class="ops-dim">' + H(b.until ? L('Blok tugaydi: ', 'Ends: ', 'До: ') + new Date(b.until).toLocaleString() : L('Muddatsiz', 'Permanent', 'Бессрочно')) + '</p>' +
      '<p class="ops-dim">' + H(L('Xato deb hisoblasangiz — bizga yozing.', 'If you think this is a mistake — write to us.', 'Если это ошибка — напишите нам.')) + '</p>' +
      '<div class="ops-acts"><button type="button" class="x-btn ghost" data-fb>✍️ ' + H(L('Murojaat yozish', 'Appeal', 'Обжаловать')) + '</button>' +
      '<button type="button" class="x-btn ghost" data-out>🚪 ' + H(L('Akkauntdan chiqish', 'Sign out', 'Выйти')) + '</button></div></div>';
    _banEl.querySelector('[data-fb]').onclick = function () { try { openFeedbackModal(); } catch (e) {} };
    _banEl.querySelector('[data-out]').onclick = function () { try { cloudLogoutAndWipe(); } catch (e) {} };
  }
  async function applyForce(f) {
    if (!f || _forceShown === f.name) return;
    _forceShown = f.name;
    try {
      S.profile = S.profile || {};
      S.profile.name = f.name; S.kiName = f.name;
      if (f.photo) S.profile.photo = null;
      save(); try { renderProfile(); } catch (e) {} try { render(); } catch (e) {}
    } catch (e) {}
    try { await supabase.rpc('ack_my_status', { p_what: 'force' }); } catch (e) {}
    _modalBusy = true;
    var ov = modal('<div class="ops-ann-ic">✏️</div><h3 class="ops-h">' + H(L('Nikingiz o\'zgartirildi', 'Your nickname was changed', 'Ваш ник изменён')) + '</h3>' +
      '<div class="ops-body">' + H(L('LevelUpDay jamoasi nikingizni', 'The LevelUpDay team changed your nickname to', 'Команда LevelUpDay сменила ваш ник на')) + ' <b>' + H(f.name) + '</b>' + (f.photo ? ' ' + H(L('va avatarni olib tashladi', 'and removed your avatar', 'и убрала аватар')) : '') + '.' +
      (f.reason ? '<br><span class="ops-dim">' + H(L('Sabab', 'Reason', 'Причина')) + ': ' + H(f.reason) + '</span>' : '') +
      '<br>' + H(L('Yangi nikni hoziroq tanlashingiz mumkin.', 'You can pick a new one right now.', 'Можете выбрать новый прямо сейчас.')) + '</div>' +
      '<div class="ops-acts"><button type="button" class="x-btn ghost" data-ok>' + H(L('Keyinroq', 'Later', 'Позже')) + '</button><button type="button" class="x-btn" data-edit>✏️ ' + H(L('Nik tanlash', 'Choose a nickname', 'Выбрать ник')) + '</button></div>');
    var close = function () { ov.close(); _modalBusy = false; setTimeout(nextModal, 300); };
    ov.querySelector('[data-ok]').onclick = close;
    ov.querySelector('[data-edit]').onclick = function () { close(); try { showTab('profile'); showProfileEdit(); } catch (e) {} };
  }
  var _restoring = false;
  async function applyRestore(slot) {
    if (slot == null || _restoring || !window.LUAccount || !window.LUAccount.restoreBackup) return;
    _restoring = true;
    try {
      var ok = await window.LUAccount.restoreBackup(slot, { admin: true });
      if (ok !== false) await supabase.rpc('ack_my_status', { p_what: 'restore' });
    } catch (e) {} finally { _restoring = false; }
  }
  var _stAt = 0, _stBusy = false, _forceShown = '';
  async function loadStatus(force) {
    if (_stBusy || !sbOk() || !linked() || !owner() || (!force && Date.now() - _stAt < 60000)) return;
    _stAt = Date.now(); _stBusy = true;
    try {
      var r = await supabase.rpc('get_my_status');
      if (r.error || !r.data) return;
      var st = _status = r.data;
      var wasStaff = isStaff();
      staffLevel = Number(st.staff) || 0;
      if (isStaff() !== wasStaff) applyMaintenance();
      applyBan(st.banned);
      if (st.banned) return;
      if (st.force) await applyForce(st.force);
      if (st.restore_slot != null) applyRestore(st.restore_slot);
      var have = {}; _msgQueue.forEach(function (m) { have[m.id] = 1; });
      var loc = jget(seenKey(), []), resend = [];
      (st.messages || []).forEach(function (m) {
        if (loc.indexOf(m.id) !== -1) { resend.push(m.id); return; } // bu qurilmada ko'rilgan — faqat serverga qayta belgilaymiz
        if (!have[m.id] && !_msgShown[m.id]) _msgQueue.push(m);
      });
      // 🎁 Admin sovg'asi/tuzatish: serverdagi yangi balansni darhol olamiz (farq mahalliy holatga qo'shiladi)
      var econNew = (st.messages || []).filter(function (m) { return m.kind === 'econ' && loc.indexOf(m.id) === -1; });
      if (econNew.length && window._profMergeServer) {
        try {
          var pr = await supabase.from('profiles').select('coins,total_coins,xp,gems').eq('id', S.cloudUserId).maybeSingle();
          if (pr && !pr.error && pr.data) {
            // Qurilmada "asos" hali yo'q bo'lsa — sovg'adan oldingi server holatini xabardagi farqlardan tiklaymiz
            var fb = { coins: pr.data.coins || 0, total_coins: pr.data.total_coins || 0, xp: pr.data.xp || 0, gems: pr.data.gems || 0 };
            econNew.forEach(function (m) { var d = m.data || {}; fb.coins -= d.coins || 0; fb.xp -= d.xp || 0; fb.gems -= d.gems || 0; if ((d.coins || 0) > 0) fb.total_coins -= d.coins; });
            window._profMergeServer(pr.data, fb); try { save(); render(); } catch (e2) {}
          }
        } catch (e1) {}
      }
      if (resend.length) markSeen(resend);
      nextModal();
    } catch (e) {} finally { _stBusy = false; }
  }

  // =========================================================
  // 🎁 Promo-kod
  // =========================================================
  var ERR = {
    not_found: ['Bunday kod yo\'q yoki o\'chirilgan', 'No such code (or it is disabled)', 'Такого кода нет'],
    expired: ['Kod muddati tugagan', 'This code has expired', 'Срок действия кода истёк'],
    used_up: ['Kod limiti tugagan', 'This code has been used up', 'Лимит кода исчерпан'],
    already: ['Bu kodni allaqachon ishlatgansiz', 'You have already used this code', 'Вы уже использовали этот код'],
    banned: ['Akkaunt bloklangan', 'Account suspended', 'Аккаунт заблокирован'],
    auth: ['Avval akkauntga kiring', 'Sign in first', 'Сначала войдите']
  };
  function openPromo() {
    if (!linked()) { tst('🔐 ' + L('Promo-kod uchun akkauntga kiring', 'Sign in to use promo codes', 'Войдите, чтобы ввести промокод')); return; }
    var ov = modal('<button class="x-close" aria-label="close">✕</button><div class="ops-ann-ic">🎁</div><h3 class="ops-h">' + H(L('Promo-kod', 'Promo code', 'Промокод')) + '</h3>' +
      '<input class="x-in ops-promo-in" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="LEVELUP2026">' +
      '<div class="ops-acts"><button type="button" class="x-btn" data-go>' + H(L('Ishlatish', 'Redeem', 'Применить')) + '</button></div>');
    var inp = ov.querySelector('input'), btn = ov.querySelector('[data-go]');
    ov.querySelector('.x-close').onclick = function () { ov.close(); };
    setTimeout(function () { inp.focus(); }, 100);
    var go = async function () {
      var code = inp.value.trim().toUpperCase(); if (!code) return;
      btn.disabled = true;
      try {
        var r = await supabase.rpc('redeem_promo', { p_code: code });
        var d = r.data || {};
        if (r.error || !d.ok) { var e = ERR[d.error] || [r.error ? r.error.message : '?', r.error ? r.error.message : '?', r.error ? r.error.message : '?']; tst('⚠️ ' + L(e[0], e[1], e[2])); btn.disabled = false; return; }
        var p = d.profile || {};
        try {
          if (typeof p.coins === 'number') S.coins = p.coins;
          if (typeof p.total_coins === 'number') S.totalCoins = p.total_coins;
          if (typeof p.season_coins === 'number' && typeof p.coins === 'number') S.reytingSeasonCoinsBase = Math.max(0, p.coins - p.season_coins); // promo tangasi oylik reytingga ham kiradi
          if (typeof p.xp === 'number') S.xp = p.xp;
          if (typeof p.gems === 'number') S.gems = p.gems;
          if (window._profBaseFromS) window._profBaseFromS(); // promo serverda qo'shildi — eski qiymat qaytarib yozilmasin
          var gain = [d.coins ? '+' + d.coins + ' 🪙' : '', d.xp ? '+' + d.xp + ' XP' : '', d.gems ? '+' + d.gems + ' 💎' : ''].filter(Boolean).join(' ');
          addTarixLog('in', '🎁 ' + L('Promo-kod', 'Promo code', 'Промокод') + ' ' + code, d.coins || 0);
          save(); render(); try { confetti(); } catch (e2) {}
          tst('🎉 ' + gain);
        } catch (e3) {}
        ov.close();
      } catch (e) { btn.disabled = false; tst('⚠️ ' + (e && e.message || e)); }
    };
    btn.onclick = go;
    inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }
  function mountPromoCard() {
    if (document.getElementById('ops-promo-card')) return;
    var fb = document.getElementById('feedback-settings-card'); if (!fb || !fb.parentNode) return;
    var c = document.createElement('div'); c.id = 'ops-promo-card'; c.className = 'settings-sub-card';
    c.innerHTML = '<button type="button" class="settings-sub-header"><span class="settings-sub-header-left"><span class="settings-sub-icon icon-pink">🎁</span>' +
      '<span style="min-width:0"><span class="settings-sub-title">🎁 ' + H(L('Promo-kod', 'Promo code', 'Промокод')) + '</span><span class="settings-sub-subtitle">' + H(L('Kodni kiriting va sovg\'a oling', 'Enter a code to get a gift', 'Введите код и получите подарок')) + '</span></span></span>' +
      '<span class="settings-sub-arrow-wrap"><span class="settings-sub-arrow">›</span></span></button>';
    c.querySelector('button').onclick = openPromo;
    fb.parentNode.insertBefore(c, fb.nextSibling);
  }

  // =========================================================
  // ⏱ Ishga tushirish
  // =========================================================
  function tick(force) { loadConfig(force); loadStatus(force); }
  function boot() {
    wrapShowTab(); applyConfig(); mountPromoCard();
    setTimeout(function () { tick(true); }, 2500);
    setTimeout(loadAnnouncements, 5000);
    // Akkaunt yuklanganidan keyin holatni tekshiramiz (owner kech o'rnatiladi)
    var tries = 0, iv = setInterval(function () { tries++; if (linked() && owner()) { loadStatus(true); clearInterval(iv); } else if (tries > 40) clearInterval(iv); }, 3000);
    setInterval(function () { if (document.visibilityState === 'visible') tick(false); }, 2 * 60000);
    setInterval(function () { if (document.visibilityState === 'visible') loadAnnouncements(); }, 15 * 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(function () { tick(false); }, 1200); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.LUOps = {
    config: function () { return CFG; }, featureOn: featureOn, FEATURES: FEATURES,
    seasonEpoch: function () { return Number(CFG.season && CFG.season.epoch) || 0; },
    reload: function () { tick(true); loadAnnouncements(); }, openPromo: openPromo, reportError: reportError,
    status: function () { return _status; }
  };
})();
