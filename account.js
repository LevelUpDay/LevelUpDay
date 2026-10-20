// ============================================================
// ☁️ AKKAUNT VA SINXRONLASH MARKAZI (script.js dan keyin yuklanadi)
//   • Sinxronlash markazi: holat, "hozir sinxronlash", "bulutdan qayta yuklash", ziddiyatlar
//   • 🪙 Tanga/XP tarixi (coin_ledger, server yozadi) + xato bilan yo'qolganini tiklash (restore_lost_coins)
//   • ☁️ Bulut zaxiralari (app_backups: kuniga bitta, 30 kun) va tiklash
//   • 📤 Eksport / import (mavjud funksiyalar)
//   • 📱 Qurilmalar (account_devices) — uzoqdan chiqarish, yangi qurilma haqida Telegram xabari
//   • 🔑 Kirish usullari: Google'ni ulash, parol o'rnatish/o'zgartirish, emailni o'zgartirish
//   • 👥 Bir qurilmada bir nechta akkaunt — tozalamasdan almashish (IndexedDB'dagi nusxa)
//   • 🔐 Ilova uchun PIN qulf (faqat shu qurilmada)
//   • ⏳ Akkaunt yuklanmaguncha "user1, 0 tanga" o'rniga yuklanish oynasi
//   • 🤝 Mehmon sifatida qilingan ishni mavjud akkauntga qo'shish taklifi
// Hamma joyda: tanga/XP faqat server orqali tiklanadi (zaxira/import ularni o'zgartirmaydi).
// ============================================================
(function () {
  'use strict';
  function L(uz, en, ru) { try { return _cl(uz, en, ru); } catch (e) { return uz; } }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sbOk() { return typeof supabase !== 'undefined' && supabase && supabase.from; }
  function linked() { return !!(typeof S !== 'undefined' && S && S.cloudLinked && S.cloudUserId); }
  function owner() { try { return _cloudOwnerOk(); } catch (e) { return false; } }
  function tst(m) { try { toast(m); } catch (e) {} }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function ago(ts) {
    if (!ts) return '—';
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return L('hozirgina', 'just now', 'только что');
    if (s < 3600) return Math.round(s / 60) + ' ' + L('daq oldin', 'min ago', 'мин назад');
    if (s < 86400) return Math.round(s / 3600) + ' ' + L('soat oldin', 'h ago', 'ч назад');
    return Math.round(s / 86400) + ' ' + L('kun oldin', 'd ago', 'дн. назад');
  }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // Qurilmaga xos, akkaunt almashganda ham saqlanadigan kalitlar (wipe KEEP ro'yxati bilan bir xil)
  var DEVICE_KEYS = ['appTheme', 'designAnim', 'appLayout', 'sfxVolume', 'soundEnabled', 'dsSidebarW', 'dsAsideW', 'settingsPanelOpen', 'ludAccounts', 'ludPinLock', 'ludDeviceId'];
  var ECON = ['coins', 'totalCoins', 'xp', 'gems', 'streak', 'bestStreak', 'reytingSeasonCoinsBase'];

  // ---------- umumiy oyna ----------
  function modal(html, cls) {
    var ov = document.createElement('div');
    ov.className = 'x-ov acc-ov';
    ov.innerHTML = '<div class="x-box acc-box ' + (cls || '') + '" role="dialog" aria-modal="true"><button class="x-close" aria-label="close">✕</button>' + html + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180); document.removeEventListener('keydown', onKey, true); };
    var onKey = function (e) { if (e.key === 'Escape' && document.body.lastElementChild === ov) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.x-close').onclick = close;
    ov._close = close;
    return ov;
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (res) {
      var ov = modal('<h3 class="acc-h">' + H(title) + '</h3><p class="acc-p">' + text + '</p><div class="acc-acts"><button type="button" class="x-btn ghost" data-no>' + H(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="x-btn' + (danger ? ' acc-danger' : '') + '" data-yes>' + H(okLabel) + '</button></div>');
      var done = false;
      ov.querySelector('[data-yes]').onclick = function () { done = true; ov._close(); res(true); };
      ov.querySelector('[data-no]').onclick = function () { done = true; ov._close(); res(false); };
      ov.querySelector('.x-close').addEventListener('click', function () { if (!done) res(false); });
      ov.addEventListener('click', function (e) { if (e.target === ov && !done) res(false); });
    });
  }

  // =========================================================
  // ⏳ #3 Akkaunt yuklanmaguncha: mehmon holati (user1, 0 tanga) o'rniga yuklanish oynasi
  // =========================================================
  var _loadSince = 0, _loadEl = null, _pageAt = Date.now();
  // Kirish sessiyasi bor, lekin akkaunt hali yuklanmagan (sahifa endi ochildi / kirgandan keyingi qayta yuklash):
  // "user1, 0 tanga" mehmon ekrani bir lahza ko'rinib-yo'qolmasin — darhol yuklanish oynasi
  function sessionPending() {
    if (linked() && owner()) return false;
    if (Date.now() - _pageAt > 25000) return false;
    try {
      if (sessionStorage.getItem('cloudCleanLogin')) return true;
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^sb-.+-auth-token$/.test(k)) return true; }
    } catch (e) {}
    return false;
  }
  function loadingTick() {
    var early = sessionPending();
    var need = (linked() && !owner()) || early;
    if (!need) { _loadSince = 0; if (_loadEl) { _loadEl.remove(); _loadEl = null; } document.documentElement.classList.remove('lud-pending'); return; }
    if (!_loadSince) _loadSince = Date.now();
    if (!early && Date.now() - _loadSince < 1500) return;
    var off = navigator.onLine === false;
    if (!_loadEl) {
      _loadEl = document.createElement('div');
      _loadEl.className = 'acc-loading';
      _loadEl.innerHTML = '<div class="acc-loading-box"><div class="acc-spin" aria-hidden="true"></div><h3></h3><p></p>' +
        '<div class="acc-acts"><button type="button" class="x-btn" data-retry>🔄 ' + H(L('Qayta urinish', 'Try again', 'Повторить')) + '</button>' +
        '<button type="button" class="x-btn ghost" data-out>🚪 ' + H(L('Akkauntdan chiqish', 'Sign out', 'Выйти')) + '</button></div></div>';
      document.body.appendChild(_loadEl);
      _loadEl.querySelector('[data-retry]').onclick = function () { try { window.cloudRetryNow(); } catch (e) {} tst('🔄 ' + L('Qayta urinilmoqda…', 'Retrying…', 'Повторяем…')); };
      _loadEl.querySelector('[data-out]').onclick = function () { try { cloudLogoutAndWipe(); } catch (e) {} };
    }
    var h = _loadEl.querySelector('h3'), p = _loadEl.querySelector('p');
    var ht = off ? '📴 ' + L('Internet yo\'q', 'No internet', 'Нет интернета') : '☁️ ' + L('Akkaunt yuklanmoqda…', 'Loading your account…', 'Загружаем аккаунт…');
    var pt = L('Bulutdagi ma\'lumotlaringiz olinmoqda. Shu paytda hech narsa o\'zgarmaydi va bulutga yozilmaydi — tangalaringiz xavfsiz.', 'Getting your cloud data. Nothing changes or gets written meanwhile — your coins are safe.', 'Загружаем данные из облака. Пока ничего не меняется и не записывается — монеты в безопасности.') + (S.cloudEmail ? ' (' + S.cloudEmail + ')' : '');
    if (h.textContent !== ht) h.textContent = ht;
    if (p.textContent !== pt) p.textContent = pt;
  }
  setInterval(loadingTick, 300);
  loadingTick();

  // =========================================================
  // 📱 #13 / #16 Qurilmalar
  // =========================================================
  function deviceId() {
    var id = ls('ludDeviceId');
    if (!id) {
      try { id = crypto.randomUUID(); } catch (e) { id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
      ls('ludDeviceId', id);
    }
    return id;
  }
  function deviceName() {
    var ua = navigator.userAgent || '';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /YaBrowser/.test(ua) ? 'Yandex' : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : L('Brauzer', 'Browser', 'Браузер');
    var os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    var app = false; try { app = sessionStorage.getItem('luDesktop') === '1' || window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    return (app ? 'LevelUpDay ' + L('ilovasi', 'app', 'приложение') : br) + (os ? ' · ' + os : '');
  }
  var _devBusy = false;
  async function devicePing() {
    if (!linked() || !owner() || !sbOk() || _devBusy || navigator.onLine === false) return;
    _devBusy = true;
    try {
      var id = deviceId(), uid = S.cloudUserId;
      var r = await supabase.from('account_devices').select('id,signed_out_at,notified').eq('id', id).maybeSingle();
      if (r.error) return;
      if (r.data && r.data.signed_out_at) {
        // Boshqa qurilmadan "chiqarish" bosilgan
        tst('🚪 ' + L('Bu qurilma boshqa qurilmadan akkauntdan chiqarildi', 'This device was signed out from another device', 'Это устройство было выведено из аккаунта с другого устройства'));
        await supabase.from('account_devices').update({ signed_out_at: null, last_seen: new Date().toISOString() }).eq('id', id);
        setTimeout(function () { try { cloudLogoutAndWipe(); } catch (e) {} }, 800);
        return;
      }
      var row = { id: id, user_id: uid, name: deviceName(), kind: (typeof _cloudDeviceType === 'function' ? _cloudDeviceType() : null), ua: (navigator.userAgent || '').slice(0, 200), last_seen: new Date().toISOString() };
      // 🔄 Sinxron holati — admin paneli "Sinxron muammolari" uchun
      var tel = { app_version: window.APP_VERSION || null, sync_pending: 0, sync_err: window._cloudLastErr ? String(window._cloudLastErr).slice(0, 200) : null, sync_at: row.last_seen };
      try { tel.sync_pending = cloudPendingCount(); } catch (e) {}
      if (!window._noDevTelemetry) Object.assign(row, tel);
      if (!r.data) {
        var ins = await supabase.from('account_devices').insert(row);
        // Yangi qurilma — Telegram'ga xabar (server tekshiradi, bir marta)
        if (!ins.error) { try { await supabase.functions.invoke('focusgate', { body: { action: 'notify_new_device', device_id: id } }); } catch (e) {} }
      } else {
        var up = { name: row.name, kind: row.kind, ua: row.ua, last_seen: row.last_seen };
        if (!window._noDevTelemetry) Object.assign(up, tel);
        var ur = await supabase.from('account_devices').update(up).eq('id', id);
        if (ur.error && /app_version|sync_/.test(ur.error.message || '')) window._noDevTelemetry = true;
      }
    } catch (e) {} finally { _devBusy = false; }
  }
  setTimeout(devicePing, 6000);
  setInterval(function () { if (document.visibilityState === 'visible') devicePing(); }, 5 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(devicePing, 1500); });

  // =========================================================
  // ☁️ #9 Bulut zaxiralari (kuniga bitta, 30 kunlik aylanma)
  // =========================================================
  function backupPayload() {
    var data = {}; try { data = _appStatePayload(); } catch (e) { data = {}; }
    var tasks = JSON.parse(JSON.stringify(S.tasks || []));
    var info = { tasks: tasks.length, goals: (S.goals || []).length, rewards: (S.rewards || []).length, coins: S.coins || 0, xp: S.xp || 0, name: (S.profile && S.profile.name) || '' };
    return { data: data, tasks: tasks, info: info };
  }
  function slotOf(day) { return Math.floor(Date.parse(day + 'T00:00:00Z') / 864e5) % 30; }
  async function backupNow(manual) {
    if (!linked() || !owner() || !window._cloudPullDone || !sbOk()) { if (manual) tst('⚠️ ' + L('Avval akkaunt yuklanishi kerak', 'Your account must load first', 'Сначала должен загрузиться аккаунт')); return false; }
    var day = dayKey(), p = backupPayload();
    if (!manual) {
      // 🛡 Avtomatik zaxira bugungi yaxshi nusxani bo'sh/yarim holat bilan bosib ketmasin
      var ex = await supabase.from('app_backups').select('day,info').eq('user_id', S.cloudUserId).eq('slot', slotOf(day)).maybeSingle();
      var exN = ex && ex.data && ex.data.day === day ? Number((ex.data.info || {}).tasks) || 0 : 0;
      if (exN > 0 && (p.info.tasks === 0 || p.info.tasks * 2 < exN)) return false;
      if (p.info.tasks === 0 && Object.keys(typeof _lastSyncedTasks === 'object' ? _lastSyncedTasks : {}).length > 0) return false;
    }
    var r = await supabase.from('app_backups').upsert({ user_id: S.cloudUserId, slot: slotOf(day), day: day, data: p.data, tasks: p.tasks, info: p.info, created_at: new Date().toISOString() }, { onConflict: 'user_id,slot' });
    if (r.error) { if (manual) tst('⚠️ ' + r.error.message); return false; }
    ls('ludCloudBackupDay_' + S.cloudUserId, day);
    if (manual) tst('☁️ ' + L('Zaxira nusxa olindi', 'Backup saved', 'Резервная копия сохранена'));
    return true;
  }
  function autoBackup() {
    if (!linked() || !owner() || !window._cloudPullDone || navigator.onLine === false) return;
    if (ls('ludCloudBackupDay_' + S.cloudUserId) === dayKey()) return;
    backupNow(false);
  }
  setTimeout(autoBackup, 20000);
  setInterval(autoBackup, 30 * 60000);
  // opts.admin — admin so'ragan tiklash (ops.js): tasdiqsiz, natijani qaytaradi
  async function restoreBackup(slot, opts) {
    opts = opts || {};
    var r = await supabase.from('app_backups').select('day,data,tasks,info').eq('user_id', S.cloudUserId).eq('slot', slot).maybeSingle();
    if (r.error || !r.data) { tst('⚠️ ' + ((r.error && r.error.message) || L('Topilmadi', 'Not found', 'Не найдено'))); return false; }
    var b = r.data, inf = b.info || {};
    var ok = opts.admin ? true : await confirmBox('☁️ ' + L('Zaxiradan tiklash', 'Restore backup', 'Восстановить копию'),
      H(L(b.day + ' kungi nusxa tiklanadi: ' + (inf.tasks || 0) + ' ta vazifa, ' + (inf.goals || 0) + ' ta maqsad va sozlamalar. Hozirgi vazifalar shu nusxa bilan almashtiriladi.', 'The ' + b.day + ' copy will be restored: ' + (inf.tasks || 0) + ' tasks, ' + (inf.goals || 0) + ' goals and settings. Current tasks are replaced by it.', 'Будет восстановлена копия за ' + b.day + ': задач ' + (inf.tasks || 0) + ', целей ' + (inf.goals || 0) + ' и настройки. Текущие задачи будут заменены.')) +
      '<br><small class="acc-muted">' + H(L('🪙 Tanga, XP va olmos o\'zgarmaydi — ular faqat "Tanga tarixi" orqali tiklanadi.', '🪙 Coins, XP and gems are not changed — they are restored only via "Coin history".', '🪙 Монеты, XP и алмазы не меняются — их восстанавливают только через «Историю монет».')) + '</small>',
      L('Tiklash', 'Restore', 'Восстановить'), true);
    if (!ok) return false;
    await backupNow(false); // tiklashdan oldin hozirgi holat ham saqlanib qoladi
    var d = b.data || {};
    Object.keys(d).forEach(function (k) {
      if (k === '_ls' || k === 'profile' || ECON.indexOf(k) !== -1) return;
      try { if (_CLOUD_LOCAL_ONLY.indexOf(k) !== -1) return; } catch (e) {}
      S[k] = d[k];
    });
    if (d.profile) { var keep = S.profile || {}; S.profile = Object.assign({}, keep, d.profile, { photo: keep.photo || null, loginMethod: keep.loginMethod }); }
    S.tasks = Array.isArray(b.tasks) ? b.tasks : S.tasks;
    try { ensureFullTaskOrder(); } catch (e) {}
    try { save(); } catch (e) {}
    try { scheduleAppStateSync(true); } catch (e) {}
    try { scheduleTodosCloudSync(true); } catch (e) {}
    try { render(); renderProfile(); } catch (e) {}
    tst('✅ ' + L('Zaxira tiklandi', 'Backup restored', 'Копия восстановлена') + ' (' + b.day + ')');
    return true;
  }

  // =========================================================
  // ⚔️ #8 Ziddiyatlar: bitta vazifa ikki qurilmada bir vaqtda o'zgartirilgan
  // =========================================================
  function cfKey() { return 'ludConflicts_' + (S.cloudUserId || ''); }
  function conflicts() { var a = jget(cfKey(), []); return Array.isArray(a) ? a : []; }
  function addConflict(id, remote) {
    if (!remote) return;
    var a = conflicts().filter(function (x) { return x.id !== id; });
    a.unshift({ id: id, name: remote.name || ('#' + id), remote: remote, at: Date.now() });
    ls(cfKey(), JSON.stringify(a.slice(0, 20)));
    tst('⚔️ «' + (remote.name || '') + '» ' + L('ikki qurilmada o\'zgartirildi — bu yerdagisi saqlandi. Sinxronlash markazida ko\'ring.', 'was edited on two devices — this one was kept. See the Sync center.', 'изменено на двух устройствах — сохранено это. См. Центр синхронизации.'));
  }
  function useRemote(id) {
    var c = conflicts().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var i = (S.tasks || []).findIndex(function (t) { return t.id === id; });
    if (i >= 0) S.tasks[i] = c.remote; else (S.tasks = S.tasks || []).push(c.remote);
    dropConflict(id);
    try { save(); render(); } catch (e) {}
    tst('✅ ' + L('Boshqa qurilmadagi nusxa olindi', 'Took the other device\'s copy', 'Взята копия с другого устройства'));
  }
  function dropConflict(id) { ls(cfKey(), JSON.stringify(conflicts().filter(function (x) { return x.id !== id; }))); }

  // =========================================================
  // 🪙 #10 Tanga tarixi + tiklash
  // =========================================================
  function isLoss(r) { return r.d_coins < 0 && r.d_xp < 0 && ((r.xp || 0) === 0 || -r.d_xp * 2 >= (r.xp || 0) - r.d_xp) && !r.restored_at && Date.now() - Date.parse(r.at) < 30 * 864e5; }
  async function restoreCoins(id) {
    var ok = await confirmBox('♻️ ' + L('Tangalarni tiklash', 'Restore coins', 'Восстановить монеты'), H(L('Shu yozuvda yo\'qolgan tanga va XP akkauntga qaytariladi (bir marta).', 'The coins and XP lost in this entry will be returned to your account (once).', 'Потерянные в этой записи монеты и XP вернутся на аккаунт (один раз).')), L('Tiklash', 'Restore', 'Восстановить'));
    if (!ok) return false;
    var r = await supabase.rpc('restore_lost_coins', { p_id: id });
    if (r.error) { tst('⚠️ ' + (/not_a_loss/.test(r.error.message) ? L('Bu yozuv tiklanmaydi (oddiy sarf)', 'This entry can\'t be restored (normal spending)', 'Эту запись нельзя восстановить (обычная трата)') : /already/.test(r.error.message) ? L('Allaqachon tiklangan', 'Already restored', 'Уже восстановлено') : r.error.message)); return false; }
    var d = r.data || {};
    S.coins = d.coins || 0; S.xp = d.xp || 0; if (d.gems != null) S.gems = d.gems; if (d.total_coins != null) S.totalCoins = Math.max(S.totalCoins || 0, d.total_coins);
    try { addTarixLog('in', '♻️ ' + L('Yo\'qolgan tangalar tiklandi', 'Lost coins restored', 'Потерянные монеты восстановлены'), 0, 'restore_' + id); } catch (e) {}
    try { saveToLocalStorage(S); render(); renderProfile(); } catch (e) {}
    tst('✅ ' + L('Tiklandi: ', 'Restored: ', 'Восстановлено: ') + (S.coins || 0) + ' 🪙');
    return true;
  }

  // =========================================================
  // 👥 #17 Bir qurilmada bir nechta akkaunt (IndexedDB'dagi nusxa — tozalamasdan almashish)
  // =========================================================
  function accounts() { var a = jget('ludAccounts', []); return Array.isArray(a) ? a : []; }
  function rememberAccount() {
    if (!linked() || !owner()) return;
    var a = accounts().filter(function (x) { return x.uid !== S.cloudUserId; });
    a.unshift({ uid: S.cloudUserId, name: (S.profile && S.profile.name) || '', email: S.cloudEmail || '', method: (S.profile && S.profile.loginMethod) || '', at: Date.now() });
    ls('ludAccounts', JSON.stringify(a.slice(0, 6)));
  }
  setInterval(rememberAccount, 30000); setTimeout(rememberAccount, 5000);
  function idb() {
    return new Promise(function (res, rej) {
      var rq = indexedDB.open('ludAccounts', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('stash'); };
      rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { rej(rq.error); };
    });
  }
  function idbOp(mode, fn) { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction('stash', mode), st = tx.objectStore('stash'), rq = fn(st); tx.oncomplete = function () { res(rq && rq.result); }; tx.onerror = function () { rej(tx.error); }; }); }); }
  function stashGet(uid) { return idbOp('readonly', function (st) { return st.get(uid); }).catch(function () { return null; }); }
  function stashPut(uid, v) { return idbOp('readwrite', function (st) { return st.put(v, uid); }); }
  function stashDel(uid) { return idbOp('readwrite', function (st) { return st.delete(uid); }).catch(function () {}); }
  function snapshotLS() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && DEVICE_KEYS.indexOf(k) === -1) out[k] = localStorage.getItem(k); }
    return out;
  }
  async function flushNow() {
    try { scheduleCloudSync(true); scheduleTodosCloudSync(true); scheduleAppStateSync(true); } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 1800); });
  }
  function freezeAndReload(writeLs) {
    window._cloudPullDone = false;
    try { stopRealtimeSync(); } catch (e) {}
    window.save = function () {}; try { save = window.save; saveToLocalStorage = function () {}; syncTasksToLocalStorage = function () {}; } catch (e) {}
    var paidDesign = false; try { paidDesign = !!(window.LUDesign && !window.LUDesign.isFree(window.LUDesign.current())); } catch (e) {}
    var del = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && (DEVICE_KEYS.indexOf(k) === -1 || (paidDesign && k === 'appTheme')) && k.indexOf('cloudQueue2_') !== 0) del.push(k); }
    del.forEach(function (k) { ls(k, null); });
    if (writeLs) Object.keys(writeLs).forEach(function (k) { ls(k, writeLs[k]); });
    setTimeout(function () { location.replace(location.origin + location.pathname); }, 500);
  }
  async function switchTo(uid) {
    if (uid === S.cloudUserId) return;
    var st = await stashGet(uid);
    var acc = accounts().filter(function (x) { return x.uid === uid; })[0] || {};
    if (linked() && owner()) { tst('⏳ ' + L('Saqlanmoqda…', 'Saving…', 'Сохранение…')); await flushNow(); try { await stashPut(S.cloudUserId, { ls: snapshotLS(), at: Date.now() }); } catch (e) {} }
    try { sessionStorage.setItem('cloudCleanDone', uid); sessionStorage.removeItem('ludWipeLog'); } catch (e) {}
    if (st && st.ls) {
      tst('👥 ' + (acc.name || acc.email || '') + ' — ' + L('akkauntga o\'tilmoqda', 'switching account', 'переключаем аккаунт'));
      freezeAndReload(st.ls);
    } else {
      // Bu akkaunt uchun saqlangan sessiya yo'q — kirish oynasi (email oldindan yoziladi)
      try { sessionStorage.setItem('ludLoginEmail', acc.email || ''); } catch (e) {}
      tst('🔑 ' + L('Bu akkauntga qayta kiring', 'Sign in to this account', 'Войдите в этот аккаунт'));
      freezeAndReload(null);
    }
  }
  async function addAccount() {
    if (linked() && owner()) { tst('⏳ ' + L('Saqlanmoqda…', 'Saving…', 'Сохранение…')); await flushNow(); try { await stashPut(S.cloudUserId, { ls: snapshotLS(), at: Date.now() }); } catch (e) {} }
    freezeAndReload(null);
  }
  // Chiqishda: shu akkauntning qurilmadagi nusxasi va sessiyasi o'chiriladi (ro'yxatda faqat nomi qoladi)
  (function hookLogout() {
    var orig = window.cloudLogoutAndWipe;
    if (typeof orig !== 'function') return;
    window.cloudLogoutAndWipe = cloudLogoutAndWipe = async function () {
      var uid = S && S.cloudUserId;
      if (uid) { await stashDel(uid); try { await supabase.from('account_devices').update({ signed_out_at: null, last_seen: new Date().toISOString() }).eq('id', deviceId()); } catch (e) {} }
      return orig.apply(this, arguments);
    };
  })();
  // #6 Akkaunt almashganda (boshqa akkauntga kirilganda) oldingisining yuborilmagan o'zgarishlari:
  // tasklar navbati akkaunt bo'yicha qurilmada saqlanadi va o'sha akkauntga qaytilganda yuboriladi
  function stashBeforeWipe() {
    try {
      if (S && S.cloudUserId && owner() && typeof cloudPendingCount === 'function' && cloudPendingCount() > 0) {
        var q = { base: _lastSyncedTasks, ups: _pendingTodoUpserts, dels: _pendingTodoDeletes, at: Date.now() };
        ls(_cloudQueueKey(S.cloudUserId), JSON.stringify(q));
        tst('💾 ' + L('Oldingi akkauntning yuborilmagan o\'zgarishlari saqlab qo\'yildi — o\'sha akkauntga qaytsangiz yuboriladi', 'The previous account\'s unsynced changes were kept — they will sync when you switch back', 'Неотправленные изменения прежнего аккаунта сохранены — отправятся при возврате'));
      }
    } catch (e) {}
    return false; // tozalash odatdagidek davom etadi
  }

  // =========================================================
  // 🤝 #7 Mehmon sifatida qilingan ishni mavjud akkauntga qo'shish
  // =========================================================
  function guestItems() {
    var tasks = (S.tasks || []).filter(function (t) { return t && !t.sample; });
    var goals = (S.goals || []).filter(function (g) { return g && !g.sample; });
    return { tasks: tasks, goals: goals };
  }
  function askGuestMerge(uid) {
    var g = guestItems();
    if (S.lastCloudUserId || (!g.tasks.length && !g.goals.length)) return Promise.resolve(false);
    return new Promise(function (res) {
      var ov = modal('<h3 class="acc-h">🤝 ' + H(L('Mehmon sifatidagi ishlaringiz', 'Your guest progress', 'Ваш прогресс в гостевом режиме')) + '</h3>' +
        '<p class="acc-p">' + H(L('Bu qurilmada akkauntsiz ' + g.tasks.length + ' ta vazifa va ' + g.goals.length + ' ta maqsad yaratilgan. Ularni akkauntingizga qo\'shaymi?', 'You created ' + g.tasks.length + ' tasks and ' + g.goals.length + ' goals here without an account. Add them to your account?', 'Здесь без аккаунта создано задач: ' + g.tasks.length + ', целей: ' + g.goals.length + '. Добавить их в аккаунт?')) + '</p>' +
        '<p class="acc-p acc-muted">' + H(L('Tanga va XP qo\'shilmaydi — akkauntdagisi qoladi.', 'Coins and XP are not added — your account\'s stay.', 'Монеты и XP не добавляются — остаются из аккаунта.')) + '</p>' +
        '<div class="acc-acts"><button type="button" class="x-btn ghost" data-no>' + H(L('Kerak emas', 'Discard', 'Не нужно')) + '</button><button type="button" class="x-btn" data-yes>＋ ' + H(L('Akkauntga qo\'shish', 'Add to account', 'Добавить в аккаунт')) + '</button></div>');
      var fin = function (yes) {
        if (yes) { try { sessionStorage.setItem('ludGuestMerge', JSON.stringify({ uid: uid, tasks: g.tasks, goals: g.goals })); } catch (e) {} }
        ov._close(); res(yes);
      };
      ov.querySelector('[data-yes]').onclick = function () { fin(true); };
      ov.querySelector('[data-no]').onclick = function () { fin(false); };
      ov.querySelector('.x-close').addEventListener('click', function () { res(false); });
    });
  }
  function afterPull(uid) {
    var raw = null; try { raw = sessionStorage.getItem('ludGuestMerge'); } catch (e) {}
    if (!raw) return;
    try { sessionStorage.removeItem('ludGuestMerge'); } catch (e) {}
    var m = null; try { m = JSON.parse(raw); } catch (e) {}
    if (!m || m.uid !== uid) return;
    var used = {}, maxId = Number(S.nextId) || 0;
    (S.tasks || []).forEach(function (t) { used[t.id] = 1; if (t.id >= maxId) maxId = t.id + 1; });
    var nT = 0, nG = 0;
    (m.tasks || []).forEach(function (t) { var c = JSON.parse(JSON.stringify(t)); if (used[c.id]) c.id = maxId++; used[c.id] = 1; if (c.id >= maxId) maxId = c.id + 1; (S.tasks = S.tasks || []).push(c); nT++; });
    S.nextId = Math.max(Number(S.nextId) || 0, maxId);
    var gid = Date.now();
    (m.goals || []).forEach(function (g) { var c = JSON.parse(JSON.stringify(g)); if ((S.goals || []).some(function (x) { return x.id === c.id; })) c.id = gid++; (S.goals = S.goals || []).push(c); nG++; });
    try { ensureFullTaskOrder(); } catch (e) {}
    setTimeout(function () { try { save(); render(); } catch (e) {} tst('🤝 ' + L(nT + ' ta vazifa va ' + nG + ' ta maqsad akkauntga qo\'shildi', nT + ' tasks and ' + nG + ' goals added to your account', 'Добавлено в аккаунт: задач ' + nT + ', целей ' + nG)); }, 300);
  }

  // =========================================================
  // 🔐 #18 PIN qulf (faqat shu qurilmada)
  // =========================================================
  function pinCfg() { var c = jget('ludPinLock', null); return c && c.hash ? c : null; }
  async function hashPin(pin, salt) {
    var b = new TextEncoder().encode('lud-pin:' + salt + ':' + pin);
    var h = await crypto.subtle.digest('SHA-256', b);
    return Array.prototype.map.call(new Uint8Array(h), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  var _lockEl = null, _hiddenAt = 0, _fails = 0, _blockUntil = 0;
  function lockNow() {
    var c = pinCfg(); if (!c || _lockEl) return;
    _lockEl = document.createElement('div'); _lockEl.className = 'acc-lock';
    _lockEl.innerHTML = '<div class="acc-lock-box"><div class="acc-lock-ic">🔐</div><h3>LevelUpDay</h3><p>' + H(L('PIN-kodni kiriting', 'Enter your PIN', 'Введите PIN-код')) + '</p>' +
      '<input type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="acc-pin" aria-label="PIN">' +
      '<button type="button" class="x-btn" data-ok>' + H(L('Ochish', 'Unlock', 'Открыть')) + '</button>' +
      '<button type="button" class="acc-link" data-forgot>' + H(L('PIN\'ni unutdim', 'Forgot PIN', 'Забыл PIN')) + '</button></div>';
    document.body.appendChild(_lockEl);
    var inp = _lockEl.querySelector('input');
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 100);
    var go = async function () {
      if (Date.now() < _blockUntil) { tst('⏳ ' + L('Biroz kuting', 'Please wait', 'Подождите') + ' (' + Math.ceil((_blockUntil - Date.now()) / 1000) + 's)'); return; }
      var h = await hashPin(inp.value.trim(), c.salt);
      if (h === c.hash) { _fails = 0; _lockEl.remove(); _lockEl = null; return; }
      _fails++; inp.value = ''; inp.classList.add('err'); setTimeout(function () { inp.classList.remove('err'); }, 500);
      if (_fails >= 5) { _blockUntil = Date.now() + 30000; _fails = 0; tst('⏳ ' + L('5 marta xato — 30 soniya kuting', '5 wrong tries — wait 30 seconds', '5 ошибок — подождите 30 секунд')); }
    };
    _lockEl.querySelector('[data-ok]').onclick = go;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    _lockEl.querySelector('[data-forgot]').onclick = async function () {
      var ok = await confirmBox('🔐 ' + L('PIN\'ni unutdingizmi?', 'Forgot your PIN?', 'Забыли PIN?'),
        H(linked() ? L('Akkauntdan chiqasiz va bu qurilmadagi ma\'lumotlar tozalanadi. Bulutdagilari saqlanadi — qayta kirsangiz qaytadi. PIN o\'chiriladi.', 'You will be signed out and this device\'s data cleared. Cloud data is kept — it comes back when you sign in. The PIN is removed.', 'Вы выйдете из аккаунта, данные на устройстве будут очищены. Облачные данные сохранятся. PIN будет удалён.')
          : L('Akkaunt ulanmagan: bu qurilmadagi barcha ma\'lumotlar o\'chadi va PIN olib tashlanadi.', 'No account linked: all data on this device will be erased and the PIN removed.', 'Аккаунт не подключён: все данные на устройстве будут удалены, PIN снят.')),
        L('Davom etish', 'Continue', 'Продолжить'), true);
      if (!ok) return;
      ls('ludPinLock', null);
      if (linked()) { try { cloudLogoutAndWipe(); } catch (e) {} }
      else { try { _cloudWipeLocalAndReload('🔓', false, { noStash: true }); } catch (e) { localStorage.clear(); location.reload(); } }
    };
  }
  document.addEventListener('visibilitychange', function () {
    var c = pinCfg(); if (!c) return;
    if (document.visibilityState === 'hidden') _hiddenAt = Date.now();
    else if (_hiddenAt && Date.now() - _hiddenAt >= (c.after || 0) * 60000) lockNow();
  });
  if (pinCfg()) { if (document.body) lockNow(); else document.addEventListener('DOMContentLoaded', lockNow); }
  function openPinSetup() {
    var c = pinCfg();
    var ov = modal('<h3 class="acc-h">🔐 ' + H(L('Ilova uchun PIN qulf', 'App PIN lock', 'PIN-блокировка приложения')) + '</h3>' +
      '<p class="acc-p acc-muted">' + H(L('Faqat shu qurilmada ishlaydi. Ilova ochilganda (va fonda turgandan keyin) PIN so\'raladi.', 'Works on this device only. The PIN is asked when the app opens (and after it was in the background).', 'Работает только на этом устройстве. PIN спрашивается при открытии (и после фона).')) + '</p>' +
      (c ? '<input type="password" inputmode="numeric" maxlength="8" class="x-in acc-pin" data-old placeholder="' + H(L('Joriy PIN', 'Current PIN', 'Текущий PIN')) + '">' : '') +
      '<input type="password" inputmode="numeric" maxlength="8" class="x-in acc-pin" data-new placeholder="' + H(L('Yangi PIN (4–8 raqam)', 'New PIN (4–8 digits)', 'Новый PIN (4–8 цифр)')) + '">' +
      '<input type="password" inputmode="numeric" maxlength="8" class="x-in acc-pin" data-rep placeholder="' + H(L('Yana bir marta', 'Repeat', 'Ещё раз')) + '">' +
      '<div class="acc-lbl">' + H(L('Fondan qaytganda qulflash', 'Lock after background', 'Блокировать после фона')) + '</div><div class="acc-chips">' +
      [[0, L('Darhol', 'Immediately', 'Сразу')], [1, '1 ' + L('daq', 'min', 'мин')], [5, '5 ' + L('daq', 'min', 'мин')], [15, '15 ' + L('daq', 'min', 'мин')]].map(function (x) { return '<button type="button" data-after="' + x[0] + '" class="' + (((c && c.after) || 0) === x[0] ? 'on' : '') + '">' + H(x[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="acc-acts">' + (c ? '<button type="button" class="x-btn ghost acc-danger-t" data-off>' + H(L('PIN\'ni olib tashlash', 'Remove PIN', 'Снять PIN')) + '</button>' : '') + '<button type="button" class="x-btn" data-save>' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    var after = (c && c.after) || 0;
    ov.querySelectorAll('[data-after]').forEach(function (b) { b.onclick = function () { after = +b.dataset.after; ov.querySelectorAll('[data-after]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    async function checkOld() { if (!c) return true; var v = ov.querySelector('[data-old]').value.trim(); if (await hashPin(v, c.salt) !== c.hash) { tst('⚠️ ' + L('Joriy PIN noto\'g\'ri', 'Wrong current PIN', 'Неверный текущий PIN')); return false; } return true; }
    ov.querySelector('[data-save]').onclick = async function () {
      if (!(await checkOld())) return;
      var a = ov.querySelector('[data-new]').value.trim(), b = ov.querySelector('[data-rep]').value.trim();
      if (!a && c) { c.after = after; ls('ludPinLock', JSON.stringify(c)); ov._close(); tst('✅'); renderCenter(); return; }
      if (!/^\d{4,8}$/.test(a)) { tst('⚠️ ' + L('4–8 ta raqam kiriting', 'Enter 4–8 digits', 'Введите 4–8 цифр')); return; }
      if (a !== b) { tst('⚠️ ' + L('PIN\'lar mos emas', 'PINs don\'t match', 'PIN не совпадают')); return; }
      var salt = Math.random().toString(36).slice(2);
      ls('ludPinLock', JSON.stringify({ salt: salt, hash: await hashPin(a, salt), after: after }));
      ov._close(); tst('🔐 ' + L('PIN o\'rnatildi', 'PIN set', 'PIN установлен')); renderCenter();
    };
    var off = ov.querySelector('[data-off]');
    if (off) off.onclick = async function () { if (!(await checkOld())) return; ls('ludPinLock', null); ov._close(); tst('🔓 ' + L('PIN olib tashlandi', 'PIN removed', 'PIN снят')); renderCenter(); };
  }

  // =========================================================
  // 🔑 #14 / #15 Kirish usullari
  // =========================================================
  function openPassword() {
    var ov = modal('<h3 class="acc-h">🔑 ' + H(L('Parol', 'Password', 'Пароль')) + '</h3><p class="acc-p acc-muted">' + H(L('Parol o\'rnatsangiz, Google yoki Telegram bilan ochilgan akkauntga email va parol bilan ham kira olasiz.', 'With a password you can also sign in to a Google/Telegram account with email and password.', 'С паролем вы сможете входить и по email/паролю, даже если аккаунт создан через Google или Telegram.')) + '</p>' +
      '<input type="password" class="x-in" data-a autocomplete="new-password" placeholder="' + H(L('Yangi parol (kamida 8 belgi)', 'New password (min 8 chars)', 'Новый пароль (мин. 8 символов)')) + '">' +
      '<input type="password" class="x-in" data-b autocomplete="new-password" placeholder="' + H(L('Yana bir marta', 'Repeat', 'Ещё раз')) + '">' +
      '<div class="acc-acts"><button type="button" class="x-btn" data-save>' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    ov.querySelector('[data-save]').onclick = async function () {
      var a = ov.querySelector('[data-a]').value, b = ov.querySelector('[data-b]').value;
      if (!a || a.length < 8) { tst('⚠️ ' + L('Kamida 8 belgi', 'At least 8 characters', 'Минимум 8 символов')); return; }
      if (a !== b) { tst('⚠️ ' + L('Parollar mos emas', 'Passwords don\'t match', 'Пароли не совпадают')); return; }
      var r = await supabase.auth.updateUser({ password: a });
      if (r.error) { tst('⚠️ ' + r.error.message); return; }
      ov._close(); tst('✅ ' + L('Parol saqlandi', 'Password saved', 'Пароль сохранён'));
    };
  }
  function openEmail() {
    var ov = modal('<h3 class="acc-h">📧 ' + H(L('Emailni o\'zgartirish', 'Change email', 'Сменить email')) + '</h3><p class="acc-p acc-muted">' + H(L('Yangi manzilga tasdiqlash xati keladi; havolani bosgandan keyin email almashadi.', 'A confirmation email is sent to the new address; the email changes after you click the link.', 'На новый адрес придёт письмо; email сменится после перехода по ссылке.')) + '</p>' +
      '<input type="email" class="x-in" data-e autocomplete="email" placeholder="you@example.com" value="' + H(/@(telegram|tg)\./.test(S.cloudEmail || '') ? '' : (S.cloudEmail || '')) + '">' +
      '<div class="acc-acts"><button type="button" class="x-btn" data-save>' + H(L('Yuborish', 'Send', 'Отправить')) + '</button></div>');
    ov.querySelector('[data-save]').onclick = async function () {
      var e = ov.querySelector('[data-e]').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { tst('⚠️ ' + L('Email noto\'g\'ri', 'Invalid email', 'Неверный email')); return; }
      var r = await supabase.auth.updateUser({ email: e }, { emailRedirectTo: location.origin + location.pathname });
      if (r.error) { tst('⚠️ ' + r.error.message); return; }
      ov._close(); tst('📧 ' + L('Tasdiqlash xati yuborildi — pochtangizni tekshiring', 'Confirmation sent — check your inbox', 'Письмо отправлено — проверьте почту'));
    };
  }
  async function linkGoogle() {
    if (!supabase.auth.linkIdentity) { tst('⚠️ ' + L('Brauzeringizda bu imkoniyat yo\'q', 'Not supported here', 'Не поддерживается')); return; }
    try { sessionStorage.setItem('ludLinkingGoogle', '1'); } catch (e) {}
    var r = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
    if (r && r.error) {
      tst('⚠️ ' + (/manual linking|disabled/i.test(r.error.message) ? L('Server sozlamasida "Manual linking" yoqilmagan', '"Manual linking" is disabled on the server', 'На сервере выключено «Manual linking»') : r.error.message));
    }
  }

  // =========================================================
  // 🧭 SINXRONLASH MARKAZI (#4, #11, #8, #9, #10, #12, #13, #14, #15, #16, #17, #18)
  // =========================================================
  var _ov = null, _tab = 'status';
  function open(tab) {
    if (tab) _tab = tab;
    if (_ov && _ov.isConnected) { renderCenter(); return; }
    _ov = modal('<div class="acc-center"></div>', 'acc-wide');
    renderCenter();
  }
  var TABS = [['status', '☁️', ['Holat', 'Status', 'Статус']], ['coins', '🪙', ['Tanga tarixi', 'Coin history', 'История монет']], ['backups', '🗂', ['Zaxiralar', 'Backups', 'Копии']],
    ['devices', '📱', ['Qurilmalar', 'Devices', 'Устройства']], ['login', '🔑', ['Kirish', 'Sign-in', 'Вход']], ['accounts', '👥', ['Akkauntlar', 'Accounts', 'Аккаунты']], ['lock', '🔐', ['PIN qulf', 'PIN lock', 'PIN']]];
  function renderCenter() {
    if (!_ov || !_ov.isConnected) return;
    var box = _ov.querySelector('.acc-center');
    box.innerHTML = '<h3 class="acc-h">☁️ ' + H(L('Sinxronlash va akkaunt', 'Sync & account', 'Синхронизация и аккаунт')) + '</h3>' +
      '<div class="acc-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" role="tab" class="' + (_tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '"><span>' + t[1] + '</span>' + H(L(t[2][0], t[2][1], t[2][2])) + '</button>'; }).join('') + '</div><div class="acc-body"></div>';
    box.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { _tab = b.dataset.tab; renderCenter(); }; });
    var body = box.querySelector('.acc-body');
    var fn = { status: tabStatus, coins: tabCoins, backups: tabBackups, devices: tabDevices, login: tabLogin, accounts: tabAccounts, lock: tabLock }[_tab] || tabStatus;
    try { fn(body); } catch (e) { body.innerHTML = '<div class="acc-empty">⚠️ ' + H(e && e.message || e) + '</div>'; }
  }
  function needAcc(body) {
    if (linked() && owner()) return false;
    body.innerHTML = '<div class="acc-empty">' + H(linked() ? L('Akkaunt hali yuklanmoqda…', 'Account is still loading…', 'Аккаунт ещё загружается…') : L('Bu bo\'lim uchun akkauntga kiring (Profil → Sozlamalar).', 'Sign in to use this (Profile → Settings).', 'Войдите в аккаунт (Профиль → Настройки).')) + '</div>';
    return true;
  }
  function tabStatus(body) {
    var n = 0; try { n = cloudPendingCount(); } catch (e) {}
    var st = !linked() ? ['local', '💾', L('Akkauntsiz — faqat shu qurilmada', 'No account — this device only', 'Без аккаунта — только на устройстве')]
      : !owner() ? ['loading', '⏳', L('Akkaunt yuklanmoqda…', 'Loading account…', 'Загрузка аккаунта…')]
      : navigator.onLine === false ? ['offline', '📴', L('Oflayn — internet qaytganda yuboriladi', 'Offline — will sync when back online', 'Офлайн — отправим, когда появится сеть')]
      : (window._cloudLastErr && n) ? ['error', '⚠️', L('Yuborishda xato — qayta urinilmoqda', 'Sync error — retrying', 'Ошибка — повторяем')]
      : n ? ['pending', '⏳', L('Yuborilmoqda…', 'Syncing…', 'Синхронизация…')] : ['ok', '✓', L('Hammasi bulutda saqlangan', 'Everything is in the cloud', 'Всё сохранено в облаке')];
    var cf = linked() ? conflicts() : [];
    var h = '<div class="acc-stat acc-' + st[0] + '"><span class="acc-stat-ic">' + st[1] + '</span><div><b>' + H(st[2]) + '</b><small>' +
      H((linked() ? (S.cloudEmail || '') + ' · ' : '') + L('Oxirgi sinxron: ', 'Last sync: ', 'Последняя синхронизация: ') + (window._cloudLastOkAt ? ago(window._cloudLastOkAt) : '—') + (n ? ' · ' + L('kutmoqda: ', 'pending: ', 'в очереди: ') + n : '')) + '</small>' +
      (window._cloudLastErr ? '<small class="acc-err">' + H(window._cloudLastErr) + '</small>' : '') + '</div></div>';
    if (linked()) h += '<div class="acc-grid2"><button type="button" class="acc-act" data-sync><span>🔄</span><b>' + H(L('Hozir sinxronlash', 'Sync now', 'Синхронизировать')) + '</b><small>' + H(L('Navbatdagilarni yuborish va yangilarini olish', 'Send pending and fetch new', 'Отправить и получить новое')) + '</small></button>' +
      '<button type="button" class="acc-act" data-repull><span>⬇️</span><b>' + H(L('Bulutdan qayta yuklash', 'Reload from cloud', 'Загрузить из облака')) + '</b><small>' + H(L('Qurilmadagini bulutdagi bilan almashtirish', 'Replace device data with the cloud', 'Заменить данные облачными')) + '</small></button></div>';
    if (cf.length) {
      h += '<div class="acc-lbl">⚔️ ' + H(L('Ikki qurilmada o\'zgartirilganlar', 'Edited on two devices', 'Изменено на двух устройствах')) + '</div>' + cf.map(function (c) {
        return '<div class="acc-row"><div class="acc-row-m"><b>' + H(c.name) + '</b><small>' + H(L('Bu yerdagisi saqlandi · ', 'This device\'s copy kept · ', 'Сохранено это · ') + ago(c.at)) + '</small></div>' +
          '<button type="button" class="x-btn sm ghost" data-cfuse="' + c.id + '">' + H(L('U nusxani olish', 'Use other', 'Взять другую')) + '</button><button type="button" class="x-btn sm ghost" data-cfdrop="' + c.id + '">✕</button></div>';
      }).join('');
    }
    h += '<div class="acc-lbl">📤 ' + H(L('Fayl bilan', 'With a file', 'Через файл')) + '</div><div class="acc-grid2">' +
      '<button type="button" class="acc-act" data-export><span>📤</span><b>' + H(L('Eksport (JSON)', 'Export (JSON)', 'Экспорт (JSON)')) + '</b><small>' + H(L('Barcha ma\'lumotni faylga saqlash', 'Save all data to a file', 'Сохранить всё в файл')) + '</small></button>' +
      '<button type="button" class="acc-act" data-import><span>📥</span><b>' + H(L('Import', 'Import', 'Импорт')) + '</b><small>' + H(L('Fayldan tiklash', 'Restore from a file', 'Восстановить из файла')) + '</small></button></div>';
    body.innerHTML = h;
    var q = function (s) { return body.querySelector(s); };
    if (q('[data-sync]')) q('[data-sync]').onclick = async function () {
      this.disabled = true;
      try { window.cloudRetryNow(); } catch (e) {}
      if (owner()) { try { scheduleCloudSync(true); scheduleTodosCloudSync(true); scheduleAppStateSync(true); } catch (e) {} try { await _cloudCatchUp(true); } catch (e) {} }
      setTimeout(function () { tst('🔄 ' + L('Sinxronlandi', 'Synced', 'Синхронизировано')); renderCenter(); }, 1500);
    };
    if (q('[data-repull]')) q('[data-repull]').onclick = async function () {
      var pend = 0; try { pend = cloudPendingCount(); } catch (e) {}
      var ok = await confirmBox('⬇️ ' + L('Bulutdan qayta yuklash', 'Reload from cloud', 'Загрузить из облака'),
        H(L('Bu qurilmadagi vazifalar va sozlamalar bulutdagi bilan almashtiriladi.', 'Tasks and settings on this device are replaced by the cloud copy.', 'Задачи и настройки на устройстве заменятся облачными.')) + (pend ? '<br><b class="acc-err">' + H(L(pend + ' ta yuborilmagan o\'zgarish yo\'qoladi!', pend + ' unsynced changes will be lost!', 'Потеряются неотправленные изменения: ' + pend)) + '</b>' : ''),
        L('Qayta yuklash', 'Reload', 'Загрузить'), !!pend);
      if (!ok) return;
      try { _pendingTodoUpserts = {}; _pendingTodoDeletes = {}; _lastSyncedTasks = {}; ls(_cloudQueueKey(S.cloudUserId), null); } catch (e) {}
      var res = null; try { res = await cloudPullAll(S.cloudUserId); } catch (e) {}
      if (!res || !res.ok) { tst('⚠️ ' + L('Bulutdan o\'qib bo\'lmadi', 'Could not read the cloud', 'Не удалось прочитать облако')); return; }
      try { writeLocalTasks(S.tasks || []); saveToLocalStorage(S); applyLanguage(); render(); renderProfile(); } catch (e) {}
      tst('✅ ' + L('Bulutdagi ma\'lumotlar yuklandi', 'Cloud data loaded', 'Данные из облака загружены')); renderCenter();
    };
    body.querySelectorAll('[data-cfuse]').forEach(function (b) { b.onclick = function () { useRemote(+b.dataset.cfuse); renderCenter(); }; });
    body.querySelectorAll('[data-cfdrop]').forEach(function (b) { b.onclick = function () { dropConflict(+b.dataset.cfdrop); renderCenter(); }; });
    q('[data-export]').onclick = function () { try { exportAppData(); } catch (e) {} };
    q('[data-import]').onclick = function () { try { triggerImportAppData(); } catch (e) {} };
  }
  async function tabCoins(body) {
    if (needAcc(body)) return;
    body.innerHTML = '<p class="acc-p acc-muted">' + H(L('Tanga, XP va olmosdagi har bir o\'zgarish serverda yoziladi. Xato bilan yo\'qolgani (tanga va XP birga keskin tushgan) — 30 kun ichida bir marta tiklanadi.', 'Every coin, XP and gem change is recorded on the server. A loss by mistake (coins and XP dropping together) can be restored once within 30 days.', 'Каждое изменение монет, XP и алмазов записывается на сервере. Ошибочную потерю (монеты и XP упали вместе) можно вернуть один раз в течение 30 дней.')) + '</p><div class="acc-empty">⏳</div>';
    var r = await supabase.from('coin_ledger').select('id,at,d_coins,d_xp,d_gems,coins,xp,gems,reason,device,restored_at').order('at', { ascending: false }).limit(80);
    var list = (r && r.data) || [];
    var el = body.querySelector('.acc-empty');
    if (r.error) { el.textContent = '⚠️ ' + r.error.message; return; }
    if (!list.length) { el.textContent = L('Hali yozuv yo\'q — keyingi tanga o\'zgarishidan boshlab chiqadi.', 'No entries yet — they start with your next coin change.', 'Пока нет записей — появятся со следующего изменения.'); return; }
    var fmtD = function (v, u) { return v ? '<span class="' + (v > 0 ? 'acc-up' : 'acc-down') + '">' + (v > 0 ? '+' : '') + v + ' ' + u + '</span>' : ''; };
    el.outerHTML = '<div class="acc-list">' + list.map(function (x) {
      var loss = isLoss(x);
      return '<div class="acc-row' + (loss ? ' acc-loss' : '') + '"><div class="acc-row-m"><b>' + fmtD(x.d_coins, '🪙') + ' ' + fmtD(x.d_xp, 'XP') + ' ' + fmtD(x.d_gems, '💎') + '</b>' +
        '<small>' + H(new Date(x.at).toLocaleString()) + (x.reason ? ' · ' + H(x.reason) : '') + ' · ' + H(L('keyin: ', 'after: ', 'после: ') + (x.coins || 0) + ' 🪙') + (x.restored_at ? ' · ✅ ' + H(L('tiklangan', 'restored', 'восстановлено')) : '') + '</small></div>' +
        (loss ? '<button type="button" class="x-btn sm" data-restore="' + x.id + '">♻️ ' + H(L('Tiklash', 'Restore', 'Вернуть')) + '</button>' : '') + '</div>';
    }).join('') + '</div>';
    body.querySelectorAll('[data-restore]').forEach(function (b) { b.onclick = async function () { if (await restoreCoins(+b.dataset.restore)) renderCenter(); }; });
  }
  async function tabBackups(body) {
    if (needAcc(body)) return;
    body.innerHTML = '<p class="acc-p acc-muted">' + H(L('Har kuni bitta nusxa bulutda saqlanadi (oxirgi 30 kun). Tiklash vazifa, maqsad, mukofot va sozlamalarni qaytaradi; tanga/XP o\'zgarmaydi.', 'One copy a day is kept in the cloud (last 30 days). Restoring brings back tasks, goals, rewards and settings; coins/XP are unchanged.', 'Каждый день в облаке сохраняется копия (30 дней). Восстановление возвращает задачи, цели, награды и настройки; монеты/XP не меняются.')) + '</p>' +
      '<button type="button" class="x-btn" data-now>☁️ ' + H(L('Hozir zaxira olish', 'Back up now', 'Сохранить сейчас')) + '</button><div class="acc-empty">⏳</div>';
    body.querySelector('[data-now]').onclick = async function () { this.disabled = true; await backupNow(true); renderCenter(); };
    var r = await supabase.from('app_backups').select('slot,day,info,created_at').order('day', { ascending: false });
    var el = body.querySelector('.acc-empty');
    if (r.error) { el.textContent = '⚠️ ' + r.error.message; return; }
    var list = r.data || [];
    if (!list.length) { el.textContent = L('Hali zaxira yo\'q', 'No backups yet', 'Копий пока нет'); return; }
    el.outerHTML = '<div class="acc-list">' + list.map(function (b) {
      var i = b.info || {};
      return '<div class="acc-row"><div class="acc-row-m"><b>📅 ' + H(b.day) + '</b><small>' + H((i.tasks || 0) + ' ' + L('vazifa', 'tasks', 'задач') + ' · ' + (i.goals || 0) + ' ' + L('maqsad', 'goals', 'целей') + ' · ' + (i.rewards || 0) + ' ' + L('mukofot', 'rewards', 'наград') + ' · ' + new Date(b.created_at).toLocaleTimeString()) + '</small></div>' +
        '<button type="button" class="x-btn sm ghost" data-rs="' + b.slot + '">' + H(L('Tiklash', 'Restore', 'Восстановить')) + '</button></div>';
    }).join('') + '</div>';
    body.querySelectorAll('[data-rs]').forEach(function (b) { b.onclick = function () { restoreBackup(+b.dataset.rs); }; });
  }
  async function tabDevices(body) {
    if (needAcc(body)) return;
    body.innerHTML = '<div class="acc-empty">⏳</div>';
    var r = await supabase.from('account_devices').select('id,name,kind,last_seen,created_at,signed_out_at').order('last_seen', { ascending: false });
    var tg = null; try { var t = await supabase.from('telegram_links').select('enabled,prefs').maybeSingle(); tg = t && t.data; } catch (e) {}
    if (r.error) { body.innerHTML = '<div class="acc-empty">⚠️ ' + H(r.error.message) + '</div>'; return; }
    var me = deviceId(), list = (r.data || []).filter(function (d) { return !d.signed_out_at || d.id === me; });
    var ic = function (k) { return k === 'mobile' ? '📱' : k === 'tablet' ? '📲' : '💻'; };
    var nOn = !!(tg && tg.enabled && !(tg.prefs && tg.prefs.newDevice === false));
    body.innerHTML = '<div class="acc-list">' + list.map(function (d) {
      var mine = d.id === me;
      return '<div class="acc-row"><span class="acc-ic">' + ic(d.kind) + '</span><div class="acc-row-m"><b>' + H(d.name || '—') + (mine ? ' <em class="acc-tag">' + H(L('shu qurilma', 'this device', 'это устройство')) + '</em>' : '') + '</b><small>' + H(L('Oxirgi faollik: ', 'Last active: ', 'Активность: ') + ago(d.last_seen)) + '</small></div>' +
        (mine ? '' : '<button type="button" class="x-btn sm ghost acc-danger-t" data-out="' + H(d.id) + '">' + H(L('Chiqarish', 'Sign out', 'Выйти')) + '</button>') + '</div>';
    }).join('') + '</div>' +
      (list.length > 1 ? '<button type="button" class="x-btn ghost acc-danger-t" data-allout>🚪 ' + H(L('Boshqa barcha qurilmalardan chiqish', 'Sign out of all other devices', 'Выйти на всех других устройствах')) + '</button>' : '') +
      '<label class="acc-switch"><input type="checkbox" data-notify' + (nOn ? ' checked' : '') + (tg && tg.enabled ? '' : ' disabled') + '><span>✈️ ' + H(L('Yangi qurilmadan kirilganda Telegram\'ga xabar', 'Telegram alert when a new device signs in', 'Сообщение в Telegram при входе с нового устройства')) + '</span></label>' +
      (tg && tg.enabled ? '' : '<p class="acc-p acc-muted">' + H(L('Telegram ulanmagan — Profil → Sozlamalar → Telegram eslatmalari.', 'Telegram is not connected — Profile → Settings → Telegram reminders.', 'Telegram не подключён — Профиль → Настройки → Telegram.')) + '</p>');
    body.querySelectorAll('[data-out]').forEach(function (b) {
      b.onclick = async function () {
        var u = await supabase.from('account_devices').update({ signed_out_at: new Date().toISOString() }).eq('id', b.dataset.out);
        tst(u.error ? '⚠️ ' + u.error.message : '🚪 ' + L('Qurilma keyingi ochilishida akkauntdan chiqadi', 'The device will be signed out next time it opens', 'Устройство выйдет при следующем открытии'));
        renderCenter();
      };
    });
    var all = body.querySelector('[data-allout]');
    if (all) all.onclick = async function () {
      var ok = await confirmBox('🚪 ' + L('Boshqa qurilmalardan chiqish', 'Sign out other devices', 'Выйти на других устройствах'), H(L('Shu qurilmadan boshqa hamma joyda akkauntdan chiqiladi.', 'You will be signed out everywhere except this device.', 'Вы выйдете везде, кроме этого устройства.')), L('Chiqarish', 'Sign out', 'Выйти'), true);
      if (!ok) return;
      try { await supabase.auth.signOut({ scope: 'others' }); } catch (e) {}
      await supabase.from('account_devices').update({ signed_out_at: new Date().toISOString() }).neq('id', me);
      tst('🚪 ' + L('Boshqa qurilmalardan chiqildi', 'Signed out of other devices', 'Выход на других устройствах выполнен')); renderCenter();
    };
    var nt = body.querySelector('[data-notify]');
    if (nt) nt.onchange = async function () {
      var pr = Object.assign({}, (tg && tg.prefs) || {}); pr.newDevice = nt.checked;
      var u = await supabase.from('telegram_links').update({ prefs: pr }).eq('user_id', S.cloudUserId);
      tst(u.error ? '⚠️ ' + u.error.message : '✅');
    };
  }
  async function tabLogin(body) {
    if (needAcc(body)) return;
    body.innerHTML = '<div class="acc-empty">⏳</div>';
    var ids = [];
    try { var g = await supabase.auth.getUserIdentities(); ids = ((g && g.data && g.data.identities) || []).map(function (i) { return i.provider; }); } catch (e) {}
    var u = null; try { u = (await supabase.auth.getUser()).data.user; } catch (e) {}
    var tgLinked = false; try { var t = await supabase.from('telegram_links').select('chat_id').maybeSingle(); tgLinked = !!(t && t.data); } catch (e) {}
    var email = (u && u.email) || S.cloudEmail || '';
    var fakeEmail = /@(telegram|tg)\./i.test(email) || /^tg[_-]?\d+@/i.test(email);
    var row = function (ic, name, on, sub, btn) { return '<div class="acc-row"><span class="acc-ic">' + ic + '</span><div class="acc-row-m"><b>' + H(name) + ' ' + (on ? '<em class="acc-tag ok">✓ ' + H(L('ulangan', 'linked', 'привязан')) + '</em>' : '') + '</b><small>' + H(sub) + '</small></div>' + (btn || '') + '</div>'; };
    var hasGoogle = ids.indexOf('google') !== -1, hasEmail = ids.indexOf('email') !== -1;
    body.innerHTML = '<p class="acc-p acc-muted">' + H(L('Bitta akkauntga bir nechta kirish usulini bog\'lang — biri ishlamasa, boshqasi bilan kirasiz.', 'Link several sign-in methods to one account — if one fails, use another.', 'Привяжите несколько способов входа — если один не сработает, войдёте другим.')) + '</p><div class="acc-list">' +
      row('📧', 'Email', hasEmail && !fakeEmail, fakeEmail ? L('Haqiqiy email qo\'shing', 'Add a real email', 'Добавьте настоящий email') : email, '<button type="button" class="x-btn sm ghost" data-email>' + H(fakeEmail ? L('Qo\'shish', 'Add', 'Добавить') : L('O\'zgartirish', 'Change', 'Сменить')) + '</button>') +
      row('🔑', L('Parol', 'Password', 'Пароль'), false, L('Email + parol bilan kirish uchun', 'For email + password sign-in', 'Для входа по email и паролю'), '<button type="button" class="x-btn sm ghost" data-pass>' + H(L('O\'rnatish', 'Set', 'Задать')) + '</button>') +
      row('🟢', 'Google', hasGoogle, hasGoogle ? L('Google bilan kira olasiz', 'You can sign in with Google', 'Можно входить через Google') : L('Google akkauntni ulash', 'Link a Google account', 'Привязать Google'), hasGoogle ? '' : '<button type="button" class="x-btn sm" data-google>' + H(L('Ulash', 'Link', 'Привязать')) + '</button>') +
      row('✈️', 'Telegram', tgLinked, tgLinked ? L('Bot ulangan', 'Bot connected', 'Бот подключён') : L('Eslatmalar va kirish', 'Reminders and sign-in', 'Напоминания и вход'), tgLinked ? '' : '<button type="button" class="x-btn sm ghost" data-tg>' + H(L('Ulash', 'Link', 'Привязать')) + '</button>') +
      '</div>';
    var q = function (s) { return body.querySelector(s); };
    q('[data-email]').onclick = openEmail;
    q('[data-pass]').onclick = openPassword;
    if (q('[data-google]')) q('[data-google]').onclick = linkGoogle;
    if (q('[data-tg]')) q('[data-tg]').onclick = function () { if (_ov) _ov._close(); try { showTab('profile'); showProfileSubtab('settings'); } catch (e) {} setTimeout(function () { var c = document.getElementById('x-tg-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 400); };
  }
  function tabAccounts(body) {
    var list = accounts(), cur = linked() ? S.cloudUserId : null;
    stashListThen(function (stashed) {
      body.innerHTML = '<p class="acc-p acc-muted">' + H(L('Bir qurilmada bir nechta akkauntdan foydalaning — almashganda ma\'lumotlar o\'chmaydi, har birining nusxasi shu qurilmada saqlanadi.', 'Use several accounts on one device — switching keeps each account\'s data on this device.', 'Несколько аккаунтов на одном устройстве — при переключении данные каждого сохраняются.')) + '</p>' +
        '<div class="acc-list">' + (list.length ? list.map(function (a) {
          var isCur = a.uid === cur, has = stashed.indexOf(a.uid) !== -1;
          return '<div class="acc-row"><span class="acc-ic">👤</span><div class="acc-row-m"><b>' + H(a.name || a.email || '—') + (isCur ? ' <em class="acc-tag ok">' + H(L('hozirgi', 'current', 'текущий')) + '</em>' : '') + '</b><small>' + H((a.email || '') + (a.method ? ' · ' + a.method : '')) + '</small></div>' +
            (isCur ? '' : '<button type="button" class="x-btn sm' + (has ? '' : ' ghost') + '" data-sw="' + H(a.uid) + '">' + H(has ? L('O\'tish', 'Switch', 'Перейти') : L('Kirish', 'Sign in', 'Войти')) + '</button>') +
            (isCur ? '' : '<button type="button" class="x-btn sm ghost" data-forget="' + H(a.uid) + '" aria-label="✕">✕</button>') + '</div>';
        }).join('') : '<div class="acc-empty">' + H(L('Hali akkaunt yo\'q', 'No accounts yet', 'Аккаунтов пока нет')) + '</div>') + '</div>' +
        '<button type="button" class="x-btn" data-add>＋ ' + H(L('Boshqa akkaunt qo\'shish', 'Add another account', 'Добавить аккаунт')) + '</button>';
      body.querySelectorAll('[data-sw]').forEach(function (b) { b.onclick = function () { switchTo(b.dataset.sw); }; });
      body.querySelectorAll('[data-forget]').forEach(function (b) { b.onclick = async function () { await stashDel(b.dataset.forget); ls('ludAccounts', JSON.stringify(accounts().filter(function (x) { return x.uid !== b.dataset.forget; }))); renderCenter(); }; });
      body.querySelector('[data-add]').onclick = async function () {
        var ok = await confirmBox('👥 ' + L('Boshqa akkaunt', 'Another account', 'Другой аккаунт'), H(L('Hozirgi akkaunt shu qurilmada saqlanib qoladi — keyin "Akkauntlar"dan bir bosishda qaytasiz.', 'The current account stays saved on this device — come back in one tap from "Accounts".', 'Текущий аккаунт сохранится на устройстве — вернётесь одним нажатием.')), L('Davom etish', 'Continue', 'Продолжить'));
        if (ok) addAccount();
      };
    });
  }
  function stashListThen(cb) { idbOp('readonly', function (st) { return st.getAllKeys(); }).then(function (k) { cb(k || []); }, function () { cb([]); }); }
  function tabLock(body) {
    var c = pinCfg();
    body.innerHTML = '<div class="acc-stat acc-' + (c ? 'ok' : 'local') + '"><span class="acc-stat-ic">' + (c ? '🔐' : '🔓') + '</span><div><b>' + H(c ? L('PIN qulf yoqilgan', 'PIN lock is on', 'PIN-блокировка включена') : L('PIN qulf o\'chiq', 'PIN lock is off', 'PIN-блокировка выключена')) + '</b><small>' +
      H(c ? (c.after ? L(c.after + ' daqiqa fonda turgandan keyin so\'raladi', 'Asked after ' + c.after + ' min in background', 'Спрашивается после ' + c.after + ' мин в фоне') : L('Har safar ochilganda so\'raladi', 'Asked every time the app opens', 'Спрашивается при каждом открытии')) : L('Umumiy qurilmada ilovani boshqalardan himoya qiladi', 'Protects the app on a shared device', 'Защищает приложение на общем устройстве')) + '</small></div></div>' +
      '<button type="button" class="x-btn" data-pin>' + H(c ? L('O\'zgartirish', 'Change', 'Изменить') : L('PIN o\'rnatish', 'Set a PIN', 'Установить PIN')) + '</button>' +
      (c ? '<button type="button" class="x-btn ghost" data-lock>🔒 ' + H(L('Hozir qulflash', 'Lock now', 'Заблокировать')) + '</button>' : '');
    body.querySelector('[data-pin]').onclick = openPinSetup;
    var lk = body.querySelector('[data-lock]'); if (lk) lk.onclick = function () { if (_ov) _ov._close(); lockNow(); };
  }

  // Login oynasiga saqlangan email (akkauntlar ro'yxatidan "Kirish")
  try {
    var pre = sessionStorage.getItem('ludLoginEmail');
    if (pre && typeof wsState !== 'undefined') { wsState.loginEmail = pre; wsState.authMode = 'login'; sessionStorage.removeItem('ludLoginEmail'); }
  } catch (e) {}

  window.LUAccount = { open: open, addConflict: addConflict, askGuestMerge: askGuestMerge, afterPull: afterPull, stashBeforeWipe: stashBeforeWipe, backupNow: backupNow, restoreBackup: restoreBackup, lock: lockNow, _devicePing: devicePing };
})();
