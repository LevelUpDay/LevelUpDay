// ============================================================
// ✨ EXTRAS — script.js ustiga qo'shimcha funksiyalar:
//   ▦ Eisenhower matritsasi
//   🔥 Yillik faollik xaritasi · 🐉 Boss janglari · 🛍 Do'kon
//   🔗 Odatlar bog'liqligi · ⏰ Eng samarali vaqt · 📅 Oylik yakun
//   🎯 Fokus rejimi · 😴 Uyqu · 👥 Birgalikdagi vazifa
//   📰 Do'stlar lentasi (Supabase: supabase/social.sql)
// script.js dagi global funksiyalar (S, save, render, toast, _cl ...)
// ishlatiladi; bu fayl script.js dan KEYIN yuklanadi.
// ============================================================
(function () {
  'use strict';

  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  // 🗑 Destruktiv tasdiqlash: HoldButton'li modal (script.js showHoldConfirmModal),
  // u mavjud bo'lmasa — native confirm() (msg HTML-escape qilingan bo'ladi).
  var holdAsk = function (msgHtml, onOk, opts) {
    if (typeof showHoldConfirmModal === 'function') return showHoldConfirmModal(msgHtml, onOk, opts);
    var tmp = document.createElement('div'); tmp.innerHTML = msgHtml;
    if (confirm(tmp.textContent)) onOk();
  };
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseD(ds) { return new Date(ds + 'T00:00:00'); }
  function nowMin() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function hm2m(hm) { if (!hm) return null; var p = hm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function m2hm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
  function safe(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { console.warn('[extras]', e); } }; }
  function mondayOf(ds) { var d = parseD(ds); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return dkey(d); }
  function monthsArr() { try { return getMonthsFullArr(); } catch (e) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; } }
  function weekdaysShort() { return [L('Du', 'Mo', 'Пн'), L('Se', 'Tu', 'Вт'), L('Ch', 'We', 'Ср'), L('Pa', 'Th', 'Чт'), L('Ju', 'Fr', 'Пт'), L('Sh', 'Sa', 'Сб'), L('Ya', 'Su', 'Вс')]; }
  function addCoins(n, desc) {
    S.coins = (S.coins || 0) + n;
    if (n > 0) S.totalCoins = (S.totalCoins || 0) + n;
    try { addTarixLog(n > 0 ? 'in' : 'out', desc, n); } catch (e) {}
  }

  // ---------- umumiy modal ----------
  function xModal(html, cls) {
    var ov = document.createElement('div');
    ov.className = 'x-ov';
    ov.innerHTML = '<div class="x-box ' + (cls || '') + '"><button class="x-close" aria-label="close">✕</button>' + html + '</div>';
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

  // ---------- vazifa yaratish ----------
  function xMakeTask(o) {
    var t = {
      id: S.nextId++, name: o.name, diff: 1, coins: o.coins == null ? 1 : o.coins, penalty: o.penalty == null ? 1 : o.penalty,
      repeat: 'once', days: null, interval: null, nextDate: null, strictSchedule: false, dueDate: null,
      remindAt: null, startTime: o.startTime || null, endTime: o.endTime || null, autoPomo: false,
      pinned: !!o.pinned, done: false, doneDate: null, skipped: false, skippedDate: null, lastDoneDate: null,
      createdAt: today(), label: null, note: o.note || null, emoji: o.emoji || null,
      isFrozen: false, frozenAt: null, subtasks: []
    };
    if (o.date && o.date > today()) t.postponedTo = o.date;
    if (o.quad) t.quad = o.quad;
    S.tasks.push(t);
    return t;
  }
  function todaysOpenTasks() {
    var td = today();
    return (S.tasks || []).filter(function (t) {
      if (t.isFrozen || t.done || t.skipped) return false;
      if (t.postponedTo && t.postponedTo > td) return false;
      return t.repeat === 'once' ? true : taskDueToday(t);
    });
  }
  function todaysDueTasks() {
    var td = today();
    return (S.tasks || []).filter(function (t) {
      if (t.isFrozen) return false;
      if (t.postponedTo && t.postponedTo > td) return false;
      if (t.repeat === 'once') return !t.done || t.doneDate === td;
      return taskDueToday(t);
    });
  }

  // =========================================================
  // ▦ 3. EISENHOWER MATRITSASI
  // =========================================================
  var QUADS = [
    { q: 1, icon: '🔥', cls: 'q1', t: function () { return L('Muhim va shoshilinch', 'Urgent & important', 'Срочно и важно'); }, s: function () { return L('Hozir qiling', 'Do it now', 'Сделать сейчас'); } },
    { q: 2, icon: '📅', cls: 'q2', t: function () { return L('Muhim, shoshilinch emas', 'Important, not urgent', 'Важно, не срочно'); }, s: function () { return L('Rejalashtiring', 'Schedule it', 'Запланировать'); } },
    { q: 3, icon: '⚡', cls: 'q3', t: function () { return L('Shoshilinch, muhim emas', 'Urgent, not important', 'Срочно, не важно'); }, s: function () { return L('Tezda tugating / topshiring', 'Do quickly / delegate', 'Делегировать'); } },
    { q: 4, icon: '🗑', cls: 'q4', t: function () { return L('Muhim ham, shoshilinch ham emas', 'Neither', 'Ни то, ни другое'); }, s: function () { return L('Kamaytiring', 'Drop it', 'Убрать'); } }
  ];
  function mxChip(t) {
    return '<div class="x-mx-chip" data-id="' + t.id + '" tabindex="0" role="button" aria-pressed="false"><button class="x-mx-done" data-done="' + t.id + '" title="✓" aria-label="' + H(L('Bajarildi', 'Mark done', 'Выполнено')) + '"></button><span class="x-mx-name">' +
      (t.emoji ? t.emoji + ' ' : '') + H(t.name) + (t.startTime ? ' <i>' + t.startTime + '</i>' : '') + '</span>' +
      '<button class="x-mx-edit" data-edit="' + t.id + '" title="' + H(L('Tahrirlash', 'Edit', 'Изменить')) + '" aria-label="' + H(L('Tahrirlash', 'Edit', 'Изменить')) + ': ' + H(t.name) + '">✏️</button></div>';
  }
  // Yagona manba: vazifani kvadrantga ko'chirish (drag ham, tap ham shu orqali)
  function mxMoveTask(id, q) {
    var tk = S.tasks.find(function (x) { return x.id === id; });
    if (!tk) return null;
    if (q) tk.quad = q; else delete tk.quad;
    save(); try { renderTaskList(); } catch (e) {}
    return tk;
  }
  function mxQuadName(q) {
    var Q = QUADS.find(function (x) { return x.q === q; });
    return Q ? Q.icon + ' ' + Q.t() : '📥 ' + L('Saralanmagan', 'Unsorted', 'Без категории');
  }
  function openMatrix() {
    var old = document.querySelector('.x-ov.x-mx'); var keep = !!old; if (old) { if (old._mxKey) window.removeEventListener('keydown', old._mxKey, true); old.remove(); }
    var tasks = todaysOpenTasks();
    var hint = '<em class="x-mx-hint">' + L('Shu yerga ko\'chirish uchun bosing', 'Tap to move here', 'Нажмите, чтобы переместить') + '</em>';
    var html = '<h3 class="x-h">▦ ' + L('Eisenhower matritsasi', 'Eisenhower matrix', 'Матрица Эйзенхауэра') + '</h3>' +
      '<p class="x-sub">' + L('Vazifani bosing — u belgilanadi, so\'ng kerakli katakni bosing. Sudrab ham qo\'yish mumkin. ✓ — bajarildi, ✏️ — tahrirlash.', 'Tap a task to select it, then tap a box to move it there. Dragging works too. ✓ marks done, ✏️ edits.', 'Нажмите на задачу, чтобы выбрать её, затем нажмите на нужный квадрат. Можно и перетаскивать. ✓ — выполнено, ✏️ — изменить.') + '</p>' +
      '<div class="x-mx-grid">';
    QUADS.forEach(function (Q) {
      var list = tasks.filter(function (t) { return t.quad === Q.q; });
      html += '<div class="x-mx-q ' + Q.cls + '" data-zone="' + Q.q + '"><div class="x-mx-qh"><b>' + Q.icon + ' ' + Q.t() + '</b><span class="x-mx-cnt">' + Q.s() + ' · ' + list.length + '</span>' + hint + '</div>' +
        '<div class="x-mx-list" data-q="' + Q.q + '">' + list.map(mxChip).join('') + '</div></div>';
    });
    var un = tasks.filter(function (t) { return !t.quad; });
    html += '</div><div class="x-mx-un" data-zone="0"><div class="x-mx-qh"><b>📥 ' + L('Saralanmagan', 'Unsorted', 'Без категории') + '</b><span class="x-mx-cnt">' + un.length + '</span>' + hint + '</div>' +
      '<div class="x-mx-list" data-q="0">' + un.map(mxChip).join('') + '</div></div>';
    var ov = xModal(html, 'x-mx-box'); ov.classList.add('x-mx');
    if (keep) ov.classList.add('open');
    var box = ov.querySelector('.x-box');
    var selId = null, lastDragEnd = 0, dragging = false;
    function zoneOf(el) { var z = el && el.closest('[data-zone]'); return z ? +z.dataset.zone : null; }
    function clearSel() {
      selId = null; box.classList.remove('x-mx-picking');
      box.querySelectorAll('.x-mx-chip.x-mx-sel').forEach(function (c) { c.classList.remove('x-mx-sel'); c.setAttribute('aria-pressed', 'false'); });
      box.querySelectorAll('[data-zone].x-mx-src').forEach(function (z) { z.classList.remove('x-mx-src'); });
    }
    function select(chip) {
      clearSel();
      selId = +chip.dataset.id; chip.classList.add('x-mx-sel'); chip.setAttribute('aria-pressed', 'true');
      box.classList.add('x-mx-picking');
      var z = chip.closest('[data-zone]'); if (z) z.classList.add('x-mx-src');
    }
    ov.querySelectorAll('[data-done]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); toggleTask(+b.dataset.done); setTimeout(openMatrix, 50); }; });
    ov.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); ov._close(); editTask(+b.dataset.edit); }; });
    ov.querySelectorAll('.x-mx-chip').forEach(function (c) {
      // Faqat sichqoncha (desktop bonus) — telefonda ikki marta tez bosish tanlov/bekor qilishdir
      c.addEventListener('pointerdown', function (e) { c._pt = e.pointerType; });
      c.ondblclick = function (e) { if (c._pt === 'touch' || e.target.closest('button')) return; ov._close(); editTask(+c.dataset.id); };
      c.onkeydown = function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); c.click(); } };
    });
    box.addEventListener('click', function (e) {
      if (dragging || Date.now() - lastDragEnd < 350) return;
      if (e.target.closest('button')) return; // ✓, ✏️, ✕ — o'z ishlovchilari bor
      var chip = e.target.closest('.x-mx-chip');
      var zone = zoneOf(e.target);
      if (selId == null) { if (chip) select(chip); return; }
      var cur = box.querySelector('.x-mx-chip.x-mx-sel');
      var curZone = zoneOf(cur);
      if (zone != null && zone !== curZone) {
        var tk = mxMoveTask(selId, zone);
        clearSel();
        if (tk) { openMatrix(); try { toast('✓ ' + L('Ko\'chirildi', 'Moved', 'Перемещено') + ' → ' + mxQuadName(zone)); } catch (er) {} }
        return;
      }
      if (chip && chip !== cur) { select(chip); return; }
      clearSel(); // o'sha vazifa / o'sha katak / tashqarisi — bekor
    });
    var onKey = function (e) {
      if (!ov.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
      if (e.key === 'Escape' && selId != null) { e.stopPropagation(); e.preventDefault(); clearSel(); }
    };
    window.addEventListener('keydown', onKey, true);
    ov._mxKey = onKey;
    if (typeof Sortable !== 'undefined') {
      ov.querySelectorAll('.x-mx-list').forEach(function (el) {
        Sortable.create(el, {
          group: 'x-mx', animation: 150, delay: 120, delayOnTouchOnly: true, filter: '.x-mx-done, .x-mx-edit', preventOnFilter: false,
          onStart: function () { dragging = true; clearSel(); },
          onEnd: function () { dragging = false; lastDragEnd = Date.now(); },
          onAdd: function (ev) {
            mxMoveTask(+ev.item.dataset.id, +el.dataset.q);
            ov.querySelectorAll('[data-zone]').forEach(function (qd) { var n = qd.querySelectorAll('.x-mx-chip').length; var sp = qd.querySelector('.x-mx-cnt'); if (sp) sp.textContent = sp.textContent.replace(/\d+$/, n); });
          }
        });
      });
    }
  }

  // =========================================================
  // 🐉 6. BOSS JANGLARI — kuchsizdan kuchligacha, foydalanuvchi o'zi tanlaydi
  //   • Har bir bajarilgan vazifa = zarba (tanga qiymati + o'z vaqtida bonusi)
  //   • G'alaba (HP 0, muddat ichida) → boss mukofoti
  //   • Mag'lubiyat (muddat tugadi / taslim) → garov tangalari ayiriladi
  //   • Vazifa bekor qilinsa → boss HP tiklanadi (g'alaba ham qaytarib olinadi)
  //   Holat: S.xBoss = { v:2, fight, wins, losses, history, spent }
  // =========================================================
  var BOSSES = [
    { id: 'slime', e: '🫠', n: ['Dangasa shilimshiq', 'Lazy Slime', 'Ленивый слизень'], hp: 12, days: 1, stake: 5, coins: 10, gems: 0, req: null, lvl: 1 },
    { id: 'demon', e: '👹', n: ['Bahona devi', 'Excuse Demon', 'Демон отговорок'], hp: 30, days: 3, stake: 10, coins: 22, gems: 1, req: 'slime', lvl: 1 },
    { id: 'golem', e: '🗿', n: ['Kechiktirish golemi', 'Procrastination Golem', 'Голем прокрастинации'], hp: 55, days: 5, stake: 20, coins: 45, gems: 2, req: 'demon', lvl: 1 },
    { id: 'hydra', e: '🐍', n: ['Chalg\'ish gidrasi', 'Distraction Hydra', 'Гидра отвлечений'], hp: 85, days: 7, stake: 35, coins: 75, gems: 3, req: 'golem', lvl: 2 },
    { id: 'dragon', e: '🐉', n: ['Charchoq ajdari', 'Burnout Dragon', 'Дракон выгорания'], hp: 125, days: 10, stake: 60, coins: 130, gems: 5, req: 'hydra', lvl: 3 },
    { id: 'king', e: '👑', n: ['Xaos qiroli', 'Chaos King', 'Король хаоса'], hp: 180, days: 14, stake: 100, coins: 220, gems: 8, req: 'dragon', lvl: 4 }
  ];
  var OLD_BOSS_E = ['🦥', '🧟', '🦑', '👹', '🤖', '🐉']; // eski haftalik boss tarixi uchun
  function bossById(id) { for (var i = 0; i < BOSSES.length; i++) if (BOSSES[i].id === id) return BOSSES[i]; return null; }
  function bossNm(B) { return B ? L(B.n[0], B.n[1], B.n[2]) : 'Boss'; }
  function bossName(f) { var B = bossById(f.id) || BOSSES[1]; return B.e + ' ' + bossNm(B); }
  function userLvl() { try { return getLevel(S.xp).level || 1; } catch (e) { return 1; } }
  function bossState() {
    var st = S.xBoss;
    if (!st || typeof st !== 'object' || st.v !== 2) {
      st = S.xBoss = { v: 2, fight: null, wins: {}, losses: {}, history: [], spent: {} };
      // ♻️ Eski (haftalik) bossdan ko'chirish — davom etayotgan jang jarimasiz davom etadi
      var o = S.boss;
      if (o && o.week) {
        Object.keys(o.hits || {}).forEach(function (k) { st.spent[k] = 'legacy'; });
        if (!o.defeated && o.hp > 0 && o.week === mondayOf(today())) {
          var end = parseD(o.week); end.setDate(end.getDate() + 7);
          var lv = o.level || 1;
          st.fight = { fid: 'legacy' + o.week, id: 'demon', legacy: true, hp: o.hp, maxHp: o.maxHp || o.hp, startedAt: Date.now(), endsAt: end.getTime(), stake: 0,
            rw: { coins: 10 + (lv - 1) * 2, gems: 2 + Math.floor((lv - 1) / 2) }, hits: Object.assign({}, o.hits || {}), log: (o.log || []).slice(0, 12), status: 'active' };
          Object.keys(st.fight.hits).forEach(function (k) { st.spent[k] = st.fight.fid; });
        }
      }
      // Eski g'alabalar — keyingi bossni ochish uchun hisobga olinadi
      if ((S.bossWins || 0) > 0) st.wins.slime = S.bossWins;
      S.boss = null;
    }
    st.wins = st.wins || {}; st.losses = st.losses || {}; st.history = st.history || []; st.spent = st.spent || {};
    // Kechagi zarba kalitlari endi kerak emas (bekor qilish faqat bugungi vazifalar uchun)
    var td = today();
    Object.keys(st.spent).forEach(function (k) { if (k.slice(k.indexOf('_') + 1) < td) delete st.spent[k]; });
    return st;
  }
  function bossUnlocked(B) {
    var st = bossState();
    if (B.req && !((st.wins[B.req] || 0) > 0)) return false;
    return userLvl() >= (B.lvl || 1);
  }
  function bossLockText(B) {
    var p = [];
    if (B.req && !((bossState().wins[B.req] || 0) > 0)) { var R = bossById(B.req); p.push(L('Avval yeng: ', 'Beat first: ', 'Сначала победите: ') + R.e + ' ' + bossNm(R)); }
    if (userLvl() < (B.lvl || 1)) p.push(L('Daraja ', 'Level ', 'Уровень ') + B.lvl + '+');
    return p.join(' · ');
  }
  function fmtLeft(ms) {
    ms = Math.max(0, ms);
    var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    if (d > 0) return d + L('k', 'd', 'д') + ' ' + h + L('s', 'h', 'ч');
    if (h > 0) return h + L('s', 'h', 'ч') + ' ' + m + L('d', 'm', 'м');
    return Math.max(1, m) + L(' daq', 'm', ' мин');
  }
  function rwText(rw) { return '+' + rw.coins + '🪙' + (rw.gems ? ' +' + rw.gems + '💎' : ''); }
  function bossHistPush(f, won) {
    var st = bossState();
    st.history.unshift({ fid: f.fid, id: f.id, won: won, fled: f.status === 'fled', at: Date.now(), date: today(), hp: f.hp, maxHp: f.maxHp, stake: f.stake, rw: won && f.rewarded ? f.rewarded : null });
    if (st.history.length > 30) st.history.length = 30;
  }
  // Boshqa oyna (tab) bu jangni allaqachon yakunlagan bo'lsa — o'sha holatni olamiz, qayta qo'llamaymiz
  function bossAdoptFresh(f) {
    try {
      var p = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || 'null');
      var d = p && p.data, xf = d && d.xBoss && d.xBoss.fight;
      if (xf && xf.fid === f.fid && ((xf.status === 'won' && xf.rewarded) || xf.status === 'lost' || xf.status === 'fled')) {
        var tasks = S.tasks, ord = S.taskOrder;
        Object.assign(S, d); S.tasks = tasks; S.taskOrder = ord;
        return true;
      }
    } catch (e) {}
    return false;
  }
  function bossRefreshUi() { renderBossAll(); setTimeout(function () { try { render(); } catch (e) {} }, 0); }
  function bossGrant(f) {
    if (f.status !== 'won' || f.rewarded) return;
    var st = bossState();
    var g = 0; try { g = f.rw.gems ? gemsAdd(f.rw.gems, 'boss', '🐉 ' + L('Boss yengildi', 'Boss defeated', 'Босс побеждён'), true) : 0; } catch (e) {}
    addCoins(f.rw.coins, '🐉 ' + L('Boss yengildi', 'Boss defeated', 'Босс побеждён') + ': ' + bossNm(bossById(f.id)));
    f.rewarded = { coins: f.rw.coins, gems: g || 0 };
    f.resolvedAt = Date.now();
    if (!f.legacy) st.wins[f.id] = (st.wins[f.id] || 0) + 1;
    S.bossWins = (S.bossWins || 0) + 1;
    bossHistPush(f, true);
    save();
    try { confetti(); confetti(); SFX.firework(); } catch (e) {}
    toast('🏆 ' + bossName(f) + ' ' + L('yengildi!', 'defeated!', 'побеждён!') + ' ' + rwText(f.rewarded));
    try { feedPost('boss', L('bossni yengdi', 'defeated a boss', 'победил(а) босса') + ': ' + bossName(f), '🏆'); } catch (e) {}
    bossRefreshUi();
  }
  function bossLose(f, fled) {
    if (f.status !== 'active') return;
    var st = bossState();
    f.status = fled ? 'fled' : 'lost'; f.resolvedAt = Date.now();
    if (f.stake > 0) addCoins(-f.stake, '🐉 ' + (fled ? L('Bossdan qochildi', 'Fled from boss', 'Побег от босса') : L('Bossga yutqazildi', 'Lost to boss', 'Поражение от босса')) + ': ' + bossNm(bossById(f.id)));
    if (!f.legacy) st.losses[f.id] = (st.losses[f.id] || 0) + 1;
    bossHistPush(f, false);
    save();
    var msg = (fled ? '🏳️ ' + L('Taslim bo\'ldingiz', 'You surrendered', 'Вы сдались') : '💀 ' + bossName(f) + ' ' + L('g\'olib chiqdi — vaqt tugadi', 'won — time ran out', 'победил — время вышло')) +
      (f.stake > 0 ? ' · -' + f.stake + ' 🪙' : '');
    toast(msg);
    if (!fled && !document.hidden) {
      try {
        xModal('<div class="x-bres l"><div class="x-bres-e">' + (bossById(f.id) || BOSSES[1]).e + '</div><h3>' + L('Mag\'lubiyat', 'Defeat', 'Поражение') + '</h3><p>' + H(bossName(f)) + ' ' +
          L('muddat ichida yengilmadi', 'was not beaten in time', 'не побеждён вовремя') + ' (❤️ ' + f.hp + ' / ' + f.maxHp + ').</p>' +
          (f.stake > 0 ? '<p class="x-bres-c">-' + f.stake + ' 🪙</p>' : '') + '<p class="x-sub">' + L('Kuchsizroq bossdan boshlab ko\'ring yoki qayta urinib ko\'ring.', 'Try a weaker boss or try again.', 'Попробуйте босса послабее или ещё раз.') + '</p></div>');
      } catch (e) {}
    }
    bossRefreshUi();
  }
  // Idempotent: yakunlangan jang qayta qo'llanmaydi (status bo'yicha himoya).
  // status va tanga/olmos bitta S nusxasida birga saqlanadi, shuning uchun boshqa oynadan
  // kelgan nusxa doim izchil: "active" bo'lsa — undagi tangalardan hali ayirilmagan.
  function bossResolve() {
    var st = bossState(), f = st.fight; if (!f) return;
    if (f.status === 'won' && !f.rewarded) {
      if (_bossRwTimer) return; // bekor qilish uchun qisqa kutish davri
      if (bossAdoptFresh(f)) { renderBossAll(); return; }
      bossGrant(bossState().fight);
    } else if (f.status === 'active' && Date.now() >= f.endsAt) {
      if (bossAdoptFresh(f)) { renderBossAll(); return; }
      bossLose(bossState().fight, false);
    }
  }
  var _bossRwTimer = null;
  function bossHit(tsk, on) {
    bossResolve();
    var st = bossState(), f = st.fight;
    var key = tsk.id + '_' + today();
    if (on) {
      if (!f || f.status !== 'active' || f.hits[key] || st.spent[key] || Date.now() >= f.endsAt) { renderBossStrip(false); return; }
      var dmg = Math.max(1, (typeof taskCoinValue === 'function' ? taskCoinValue(tsk) : 1) || 1);
      try { if (getTaskDayFlag(tsk.id, today()).onTimeGiven) dmg += 1; } catch (e) {}
      f.hits[key] = dmg; st.spent[key] = f.fid;
      f.hp = Math.max(0, f.hp - dmg);
      f.log.unshift({ n: tsk.name, d: dmg, ts: Date.now() }); if (f.log.length > 12) f.log.length = 12;
      if (f.hp === 0) {
        f.status = 'won'; f.wonAt = Date.now(); f.rewarded = null;
        var fid = f.fid;
        if (_bossRwTimer) clearTimeout(_bossRwTimer);
        _bossRwTimer = setTimeout(function () {
          _bossRwTimer = null;
          var g = bossState().fight;
          if (!g || g.fid !== fid || g.status !== 'won' || g.rewarded) return;
          if (bossAdoptFresh(g)) { renderBossAll(); return; }
          bossGrant(g);
        }, 1600);
      }
    } else {
      if (!f || !f.hits[key] || (f.status !== 'active' && f.status !== 'won')) return;
      var d = f.hits[key];
      delete f.hits[key]; if (st.spent[key] === f.fid) delete st.spent[key];
      if (f.status === 'won') {
        // ↩ Yenguvchi zarba bekor qilindi — boss tiriladi, mukofot qaytarib olinadi
        if (_bossRwTimer) { clearTimeout(_bossRwTimer); _bossRwTimer = null; }
        if (f.rewarded) {
          if (f.rewarded.gems) { try { gemsAdd(-f.rewarded.gems, 'boss', '↩ ' + L('Boss g\'alabasi bekor qilindi', 'Boss win undone', 'Победа над боссом отменена'), true); } catch (e) {} }
          addCoins(-f.rewarded.coins, '↩ 🐉 ' + L('Boss g\'alabasi bekor qilindi', 'Boss win undone', 'Победа над боссом отменена'));
          if (!f.legacy) st.wins[f.id] = Math.max(0, (st.wins[f.id] || 0) - 1);
          S.bossWins = Math.max(0, (S.bossWins || 0) - 1);
          var hi = st.history.findIndex(function (x) { return x.fid === f.fid && x.won; });
          if (hi !== -1) st.history.splice(hi, 1);
        }
        f.status = 'active'; f.wonAt = null; f.rewarded = null; f.resolvedAt = null;
        toast('↩ ' + bossName(f) + ' ' + L('qayta tirildi', 'is back', 'вернулся'));
      }
      f.hp = Math.min(f.maxHp, f.hp + d);
      var li = (f.log || []).findIndex(function (l) { return l.n === tsk.name && l.d === d; });
      if (li !== -1) f.log.splice(li, 1);
    }
    renderBossAll(on);
  }
  function bossCanStart(B) {
    var st = bossState(), f = st.fight;
    if (f && (f.status === 'active' || (f.status === 'won' && !f.rewarded))) return 'busy';
    if (!bossUnlocked(B)) return 'locked';
    if ((S.coins || 0) < B.stake) return 'coins';
    return '';
  }
  function bossStartAsk(id) {
    bossResolve();
    var B = bossById(id); if (!B) return;
    var why = bossCanStart(B);
    if (why === 'busy') { toast('⚔️ ' + L('Avval joriy jangni tugating', 'Finish your current fight first', 'Сначала завершите текущий бой')); return; }
    if (why === 'locked') { toast('🔒 ' + bossLockText(B)); return; }
    if (why === 'coins') { toast('🪙 ' + L('Garov uchun kamida ' + B.stake + ' tanga kerak', 'You need at least ' + B.stake + ' coins for the stake', 'Нужно минимум ' + B.stake + ' монет для ставки')); return; }
    var ov = xModal('<div class="x-bres"><div class="x-bres-e">' + B.e + '</div><h3>' + H(bossNm(B)) + '</h3>' +
      '<div class="x-bossr-st c"><span>❤️ ' + B.hp + ' HP</span><span>⏳ ' + B.days + ' ' + L('kun', 'days', 'дн.') + '</span><span>🎁 ' + rwText(B) + '</span></div>' +
      '<p>' + L('Muddat ichida bossning HP\'sini 0 ga tushiring: har bir bajarilgan vazifa — zarba.', 'Bring its HP to 0 in time: every completed task is a hit.', 'Снизьте HP до 0 вовремя: каждая задача — удар.') + '</p>' +
      '<p class="x-bres-w">⚠️ ' + L('Yutqazsangiz (yoki taslim bo\'lsangiz) ' + B.stake + ' tanga yo\'qotasiz.', 'If you lose (or surrender) you will lose ' + B.stake + ' coins.', 'Если проиграете (или сдадитесь), потеряете ' + B.stake + ' монет.') + '</p>' +
      '<div class="x-bres-a"><button class="x-btn ghost" data-bx="no">' + L('Bekor', 'Cancel', 'Отмена') + '</button><button class="x-btn x-btn-fight" data-bx="go">⚔️ ' + L('Jangni boshlash', 'Start fight', 'Начать бой') + '</button></div></div>');
    ov.querySelector('[data-bx="no"]').onclick = ov._close;
    ov.querySelector('[data-bx="go"]').onclick = function () { ov._close(); bossStart(id); };
  }
  function bossStart(id) {
    bossResolve();
    var B = bossById(id); if (!B || bossCanStart(B)) { if (B) bossStartAsk(id); return; }
    var st = bossState(), now = Date.now();
    st.fight = { fid: 'f' + now.toString(36) + Math.random().toString(36).slice(2, 6), id: B.id, hp: B.hp, maxHp: B.hp, startedAt: now, endsAt: now + B.days * 864e5,
      stake: B.stake, rw: { coins: B.coins, gems: B.gems }, hits: {}, log: [], status: 'active' };
    save();
    try { SFX.click && SFX.click(); } catch (e) {}
    toast('⚔️ ' + bossName(st.fight) + ' — ' + L('jang boshlandi!', 'the fight begins!', 'бой начался!'));
    renderBossAll();
  }
  function bossSurrender() {
    var f = bossState().fight; if (!f || f.status !== 'active') return;
    var ov = xModal('<div class="x-bres"><div class="x-bres-e">🏳️</div><h3>' + L('Taslim bo\'lasizmi?', 'Surrender?', 'Сдаться?') + '</h3><p>' +
      L('Bu mag\'lubiyat hisoblanadi', 'This counts as a loss', 'Это засчитается как поражение') + (f.stake > 0 ? ': -' + f.stake + ' 🪙' : '') + '.</p>' +
      '<div class="x-bres-a"><button class="x-btn ghost" data-bx="no">' + L('Jangni davom ettirish', 'Keep fighting', 'Продолжить бой') + '</button><button class="x-btn x-btn-flee" data-bx="go">' + L('Taslim bo\'lish', 'Surrender', 'Сдаться') + '</button></div></div>');
    ov.querySelector('[data-bx="no"]').onclick = ov._close;
    ov.querySelector('[data-bx="go"]').onclick = function () { ov._close(); var g = bossState().fight; if (g && g.fid === f.fid && g.status === 'active' && !bossAdoptFresh(g)) bossLose(g, true); else renderBossAll(); };
  }
  function bossFightHtml(f, full) {
    var B = bossById(f.id) || BOSSES[1];
    var won = f.status === 'won', over = f.status === 'lost' || f.status === 'fled';
    var pct = Math.round(f.hp / f.maxHp * 100);
    var left = f.endsAt - Date.now();
    var status = won ? '✅ ' + L('Yengildi!', 'Defeated!', 'Побеждён!') : over ? (f.status === 'fled' ? '🏳️ ' + L('Taslim', 'Surrendered', 'Сдались') : '💀 ' + L('Yutqazildi', 'Lost', 'Поражение')) : '❤️ ' + f.hp + ' / ' + f.maxHp + ' HP';
    var sub = won ? L('Keyingi bossni tanlang', 'Choose your next boss', 'Выберите следующего босса') + ' · 🎁 ' + rwText(f.rewarded || f.rw)
      : over ? L('Yangi jang uchun boss tanlang', 'Pick a boss for a new fight', 'Выберите босса для нового боя') + (f.stake ? ' · -' + f.stake + '🪙' : '')
      : '🎁 ' + L('Mukofot', 'Reward', 'Награда') + ' ' + rwText(f.rw) + (f.stake ? ' · 💀 ' + L('Garov', 'Stake', 'Ставка') + ' -' + f.stake + '🪙' : '');
    var h = '<div class="x-boss ' + (won ? 'won' : over ? 'lost' : '') + (!won && !over && left < 864e5 ? ' urgent' : '') + '"><div class="x-boss-e">' + B.e + '</div><div class="x-boss-m">' +
      '<div class="x-boss-t"><b>' + H(bossNm(B)) + '</b><span>' + (won || over ? '' : '⏳ ' + fmtLeft(left)) + '</span></div>' +
      '<div class="x-hp"><i style="width:' + pct + '%"></i><span>' + status + '</span></div>' +
      '<div class="x-boss-s">' + sub + '</div></div></div>';
    if (full) {
      if (f.status === 'active') h += '<div class="x-boss-act"><span class="x-boss-s">' + L('Har bir bajarilgan vazifa = zarba (tanga qiymati, o\'z vaqtida +1)', 'Each completed task = a hit (its coin value, +1 if on time)', 'Каждая задача = удар (её стоимость, +1 вовремя)') + '</span><button class="x-btn ghost sm" data-bflee="1">🏳️ ' + L('Taslim', 'Surrender', 'Сдаться') + '</button></div>';
      if (f.status === 'active' || won) {
        h += '<div class="x-sec-t">⚔️ ' + L('So\'nggi zarbalar', 'Recent hits', 'Последние удары') + '</div>' +
          (f.log.length ? '<div class="x-boss-log">' + f.log.map(function (l) { return '<div><span>' + H(l.n) + '</span><b>-' + l.d + ' HP</b></div>'; }).join('') + '</div>' : '<div class="x-empty">' + L('Hali zarba yo\'q — vazifa bajaring!', 'No hits yet — complete a task!', 'Пока нет ударов') + '</div>');
      }
    }
    return h;
  }
  function bossPickHtml() {
    return '<div class="x-boss x-boss-pick"><div class="x-boss-e">⚔️</div><div class="x-boss-m"><div class="x-boss-t"><b>' + L('Boss tanlang', 'Choose a boss', 'Выберите босса') + '</b></div>' +
      '<div class="x-boss-p">' + L('Vazifalar bilan jang qiling va mukofot yuting', 'Fight with your tasks and win rewards', 'Сражайтесь задачами и получайте награды') + ' ›</div></div></div>';
  }
  function bossRosterHtml() {
    var st = bossState(), f = st.fight, busy = f && (f.status === 'active' || (f.status === 'won' && !f.rewarded));
    return '<div class="x-bossr-grid">' + BOSSES.map(function (B, i) {
      var unl = bossUnlocked(B), cur = busy && f.id === B.id, w = st.wins[B.id] || 0, lo = st.losses[B.id] || 0;
      var btn;
      if (cur) btn = '<button class="x-btn sm" disabled>⚔️ ' + L('Jangda', 'Fighting', 'В бою') + '</button>';
      else if (!unl) btn = '<div class="x-bossr-lock">🔒 ' + H(bossLockText(B)) + '</div>';
      else if (busy) btn = '<button class="x-btn sm ghost" disabled>' + L('Jang davom etmoqda', 'Fight in progress', 'Идёт бой') + '</button>';
      else if ((S.coins || 0) < B.stake) btn = '<button class="x-btn sm ghost" disabled>🪙 ' + L(B.stake + ' tanga kerak', 'Need ' + B.stake + ' coins', 'Нужно ' + B.stake + ' монет') + '</button>';
      else btn = '<button class="x-btn sm x-btn-fight" data-bfight="' + B.id + '">⚔️ ' + L('Jang', 'Fight', 'Бой') + '</button>';
      return '<div class="x-bossr' + (unl ? '' : ' locked') + (cur ? ' cur' : '') + (w ? ' beaten' : '') + '">' +
        '<div class="x-bossr-h"><span class="x-bossr-e">' + (unl ? B.e : '🔒') + '</span><div class="x-bossr-n"><b>' + H(bossNm(B)) + '</b><small>' + '★'.repeat(i + 1) + (w || lo ? ' · ✅' + w + ' ❌' + lo : '') + '</small></div></div>' +
        '<div class="x-bossr-st"><span>❤️ ' + B.hp + ' HP</span><span>⏳ ' + B.days + ' ' + L('kun', 'd', 'дн.') + '</span><span class="g">🎁 ' + rwText(B) + '</span><span class="r">💀 -' + B.stake + '🪙</span></div>' + btn + '</div>';
    }).join('') + '</div>';
  }
  function bossHubHtml() {
    var st = bossState(), f = st.fight;
    var h = '<div class="x-card" id="x-hub-boss">' + (f ? bossFightHtml(f, true) : bossPickHtml().replace('x-boss-pick', 'x-boss-pick big')) + '</div>';
    h += '<div class="x-sec-t">🐲 ' + L('Bosslar — kuchsizdan kuchligacha', 'Bosses — weak to strong', 'Боссы — от слабых к сильным') + ' · 🪙 ' + (S.coins || 0) + '</div>' + bossRosterHtml();
    var hist = st.history.slice(0, 10), old = (S.bossHistory || []).slice(0, Math.max(0, 10 - hist.length));
    if (hist.length || old.length) {
      var wins = 0; Object.keys(st.wins).forEach(function (k) { wins += st.wins[k] || 0; });
      h += '<div class="x-sec-t">📜 ' + L('Tarix', 'History', 'История') + ' · 🏆 ' + Math.max(wins, S.bossWins || 0) + '</div><div class="x-boss-hist">' +
        hist.map(function (x) { var B = bossById(x.id) || BOSSES[1]; return '<span class="' + (x.won ? 'w' : 'l') + '" title="' + H(bossNm(B) + ' · ' + (x.date || '')) + '">' + B.e + (x.won ? '✅' : x.fled ? '🏳️' : '❌') + '</span>'; }).join('') +
        old.map(function (x) { return '<span class="' + (x.won ? 'w' : 'l') + '" title="' + H(x.week || '') + '">' + (OLD_BOSS_E[x.idx] || '🐉') + (x.won ? '✅' : '❌') + '</span>'; }).join('') + '</div>';
    }
    h += '<label class="x-chk"><input type="checkbox" id="x-boss-strip-on" ' + (S.xBossHidden ? '' : 'checked') + '> ' + L('Vazifalar sahifasida boss panelini ko\'rsatish', 'Show boss bar on the Tasks page', 'Показывать босса на странице задач') + '</label>';
    return h;
  }
  function bindBossHub(body) {
    body.querySelectorAll('[data-bfight]').forEach(function (b) { b.onclick = function () { bossStartAsk(b.dataset.bfight); }; });
    var fl = body.querySelector('[data-bflee]'); if (fl) fl.onclick = bossSurrender;
    var c = body.querySelector('#x-boss-strip-on'); if (c) c.onchange = function () { S.xBossHidden = !this.checked; save(); renderBossStrip(); };
  }
  function renderBossStrip(hit) {
    var el = document.getElementById('x-boss-strip'); if (!el) return;
    if (S.xBossHidden) { el.style.display = 'none'; return; }
    el.style.display = '';
    var f = bossState().fight;
    el.innerHTML = f && (f.status === 'active' || f.status === 'won') ? bossFightHtml(f, false) : bossPickHtml();
    try { renderToday(); } catch (e) {}
    if (hit) { var e = el.querySelector('.x-boss-e'); if (e) { e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); } }
  }
  // 📌 Vazifalar sahifasining tepasidagi ixcham qator — sahifa asosan vazifalar uchun,
  // boss / kvestlar / uyqu kichik chiplar sifatida turadi va bosilganda to'liq ochiladi
  function renderToday() {
    var el = document.getElementById('x-today'); if (!el) return;
    var chips = [];
    if (!S.xBossHidden) {
      var f = bossState().fight, B = f ? bossById(f.id) : null;
      if (f && f.status === 'active') {
        var pct = Math.max(0, Math.round((f.hp / Math.max(1, f.maxHp)) * 100));
        chips.push('<button class="x-tchip x-tchip-boss" data-tc="boss" title="' + H(bossNm(B)) + '"><span>' + (B ? B.e : '⚔️') + '</span><b>' + f.hp + '/' + f.maxHp + '</b><i class="x-tchip-bar"><i style="width:' + pct + '%"></i></i></button>');
      } else chips.push('<button class="x-tchip" data-tc="boss"><span>⚔️</span><b>' + L('Boss', 'Boss', 'Босс') + '</b></button>');
    }
    try {
      var Q = mqGetQuests(), dn = Q.daily.filter(function (q) { return q.claimed; }).length;
      var ready = Q.daily.concat(Q.weekly).filter(function (q) { return q.done && !q.claimed; }).length;
      chips.push('<button class="x-tchip' + (ready ? ' x-tchip-hot' : '') + '" data-tc="quests"><span>🎯</span><b>' + dn + '/' + Q.daily.length + '</b>' + (ready ? '<em>' + ready + '</em>' : '') + '</button>');
    } catch (e) {}
    var sl = (S.health && S.health[today()] && S.health[today()].sleep) || null;
    chips.push('<button class="x-tchip" data-tc="sleep"><span>😴</span><b>' + (sl ? sl + L(' s', 'h', ' ч') : '—') + '</b></button>');
    chips.push('<button class="x-tchip" data-tc="matrix"><span>▦</span><b>' + L('Matritsa', 'Matrix', 'Матрица') + '</b></button>');
    // 📱 Focusgate: bugungi ekran vaqti (qurilma ulangan bo'lsa); maqsaddan oshsa — qizil
    try {
      var FGa = window.LUDFocusgate;
      if (FGa && FGa.real()) {
        var fm = FGa.todayMin(), fgl = FGa.goalMin(), fh = Math.floor(fm / 60), fmm = Math.round(fm % 60);
        chips.push('<button class="x-tchip' + (fgl && fm > fgl ? ' x-tchip-over' : '') + '" data-tc="screen" title="Focusgate"><span>📱</span><b>' + (fh ? fh + L(' s ', 'h ', ' ч ') : '') + fmm + L(' d', 'm', ' м') + '</b></button>');
      }
    } catch (e) {}
    var nn = notesList().length;
    chips.push('<button class="x-tchip" data-tc="notes"><span>📝</span><b>' + L('List', 'List', 'Список') + '</b>' + (nn ? '<em>' + nn + '</em>' : '') + '</button>');
    // ↕️ Foydalanuvchi tartibi (bosib turib sudrab o'zgartiriladi) — S.xTodayOrder
    var ord = Array.isArray(S.xTodayOrder) ? S.xTodayOrder : [];
    var keyOf = function (h) { var m = /data-tc="([^"]+)"/.exec(h); return m ? m[1] : ''; };
    chips.sort(function (a, b) { var ia = ord.indexOf(keyOf(a)), ib = ord.indexOf(keyOf(b)); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    el.innerHTML = chips.join('');
    el.querySelectorAll('[data-tc]').forEach(function (b) { b.onclick = function () { if (Date.now() - (el._dragEnd || 0) < 300) return; todayOpen(b.dataset.tc); }; });
    if (typeof Sortable !== 'undefined' && !el._sort) {
      el._sort = Sortable.create(el, {
        animation: 160, delay: 250, delayOnTouchOnly: false, touchStartThreshold: 6, draggable: '.x-tchip', ghostClass: 'x-tchip-ghost',
        onEnd: function () { el._dragEnd = Date.now(); S.xTodayOrder = Array.prototype.map.call(el.querySelectorAll('[data-tc]'), function (x) { return x.dataset.tc; }); save(); }
      });
    }
  }
  // Yashirin kartani oynaga ko'chirib ochamiz, yopilganda joyiga qaytaramiz (render funksiyalari id bo'yicha topadi)
  function todayOpen(k) {
    if (k === 'boss') { xOpenHub('boss'); return; }
    if (k === 'matrix') { xOpenMatrix(); return; }
    if (k === 'notes') { openNotes(); return; }
    if (k === 'screen') { try { window.LUDFocusgate.open(); } catch (e) {} return; }
    var node = document.getElementById(k === 'quests' ? 'quests-card' : 'x-sleep-card'); if (!node) return;
    if (k === 'quests') { S.questsCollapsed = false; try { renderQuests(); } catch (e) {} }
    var ov = xModal('<div class="x-today-sheet"></div>', 'x-today-box');
    var pool = document.getElementById('x-today-pool');
    ov.querySelector('.x-today-sheet').appendChild(node);
    var orig = ov._close;
    ov._close = function () { if (pool) pool.appendChild(node); renderToday(); orig(); };
    ov.querySelector('.x-close').onclick = ov._close;
    ov.addEventListener('click', function (e) { if (e.target === ov) { if (pool && node.parentNode !== pool) pool.appendChild(node); renderToday(); } }, true);
    var onKey = function (e) { if (e.key === 'Escape' && pool && node.parentNode !== pool) { pool.appendChild(node); renderToday(); document.removeEventListener('keydown', onKey, true); } };
    document.addEventListener('keydown', onKey, true);
  }
  window.xRenderToday = safe(renderToday);
  window.xTodaysOpenTasks = function () { try { return todaysOpenTasks(); } catch (e) { return []; } };

  // 📝 Tez eslatmalar (List): tanga/XP yo'q — shunchaki yozib qo'yish, tahrirlash va o'chirish. S.xNotes = [{id, t, at}]
  function notesList() { if (!Array.isArray(S.xNotes)) S.xNotes = []; return S.xNotes; }
  function openNotes() {
    var html = '<h3 class="x-h">📝 ' + L('Tez eslatmalar', 'Quick notes', 'Быстрые заметки') + '</h3>' +
      '<div class="x-nt-new"><textarea class="x-nt-in" rows="3" placeholder="' + H(L('Shu yerga yozing…', 'Write here…', 'Пишите здесь…')) + '"></textarea>' +
      '<button class="x-btn x-nt-add">➕ ' + L('Listga qo\'shish', 'Add to list', 'Добавить') + '</button></div>' +
      '<div class="x-nt-list"></div><button class="x-nt-clear">🗑 ' + L('Hammasini o\'chirish', 'Delete all', 'Удалить всё') + '</button>';
    var ov = xModal(html, 'x-nt-box'), box = ov.querySelector('.x-box');
    var inp = box.querySelector('.x-nt-in'), listEl = box.querySelector('.x-nt-list'), clr = box.querySelector('.x-nt-clear');
    function commit() { save(); renderToday(); }
    function draw() {
      var N = notesList();
      listEl.innerHTML = N.length ? N.map(function (n) {
        return '<div class="x-nt-it" data-id="' + H(n.id) + '"><div class="x-nt-t" contenteditable="true" spellcheck="false">' + H(n.t) + '</div>' +
          '<button class="x-nt-del" data-del="' + H(n.id) + '" aria-label="' + H(L('O\'chirish', 'Delete', 'Удалить')) + '">🗑</button></div>';
      }).join('') : '<div class="x-nt-empty">' + L('Hozircha bo\'sh', 'Nothing here yet', 'Пока пусто') + '</div>';
      clr.style.display = N.length ? '' : 'none';
    }
    function add() {
      var t = inp.value.replace(/\s+$/, '').replace(/^\s*\n/, '');
      if (!t.trim()) { inp.focus(); return; }
      notesList().unshift({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: t, at: Date.now() });
      inp.value = ''; commit(); draw(); inp.focus();
    }
    box.querySelector('.x-nt-add').onclick = add;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      S.xNotes = notesList().filter(function (n) { return n.id !== b.dataset.del; }); commit(); draw();
    });
    // Tahrirlash: matnni bosib o'zgartirish, chiqqanda saqlanadi (bo'shatilsa — o'chadi)
    listEl.addEventListener('focusout', function (e) {
      var t = e.target.closest('.x-nt-t'); if (!t) return;
      var id = t.parentNode.dataset.id, v = t.innerText.replace(/\s+$/, ''), n = notesList().find(function (x) { return x.id === id; });
      if (!n) return;
      if (!v.trim()) { S.xNotes = notesList().filter(function (x) { return x.id !== id; }); commit(); draw(); return; }
      if (v !== n.t) { n.t = v; n.at = Date.now(); commit(); }
    });
    clr.onclick = function () {
      if (!confirm(L('Barcha eslatmalar o\'chirilsinmi?', 'Delete all notes?', 'Удалить все заметки?'))) return;
      S.xNotes = []; commit(); draw();
    };
    draw(); setTimeout(function () { inp.focus(); }, 60);
  }

  function renderBossAll(hit) {
    renderBossStrip(hit);
    if (document.getElementById('x-hub-boss') && (S.xHubSec || 'boss') === 'boss') renderHubSection('boss', true);
  }

  // =========================================================
  // 🛍 7. DO'KON (ramka, nik rangi, unvon)
  // =========================================================
  var SHOP = [
    { id: 'f_gold', kind: 'frame', v: 'gold', icon: '🟡', n: ['Oltin ramka', 'Gold frame', 'Золотая рамка'], coins: 150 },
    { id: 'f_ice', kind: 'frame', v: 'ice', icon: '🧊', n: ['Muz ramka', 'Ice frame', 'Ледяная рамка'], coins: 200 },
    { id: 'f_neon', kind: 'frame', v: 'neon', icon: '💜', n: ['Neon ramka', 'Neon frame', 'Неоновая рамка'], gems: 12 },
    { id: 'f_fire', kind: 'frame', v: 'fire', icon: '🔥', n: ['Olov ramka', 'Fire frame', 'Огненная рамка'], gems: 20 },
    { id: 'f_rainbow', kind: 'frame', v: 'rainbow', icon: '🌈', n: ['Kamalak ramka', 'Rainbow frame', 'Радужная рамка'], gems: 40 },
    { id: 'n_mint', kind: 'nick', v: 'mint', icon: '🟢', n: ['Yalpiz nik', 'Mint nickname', 'Мятный ник'], coins: 80 },
    { id: 'n_pink', kind: 'nick', v: 'pink', icon: '🩷', n: ['Pushti nik', 'Pink nickname', 'Розовый ник'], coins: 80 },
    { id: 'n_gold', kind: 'nick', v: 'gold', icon: '✨', n: ['Oltin nik', 'Gold nickname', 'Золотой ник'], coins: 150 },
    { id: 'n_rainbow', kind: 'nick', v: 'rainbow', icon: '🌈', n: ['Kamalak nik', 'Rainbow nickname', 'Радужный ник'], gems: 25 },
    { id: 't_owl', kind: 'title', v: '🦉 ' + 'Night Owl', icon: '🦉', n: ['Unvon: Tungi boyo\'g\'li', 'Title: Night Owl', 'Титул: Сова'], coins: 120, tv: ['🦉 Tungi boyo\'g\'li', '🦉 Night Owl', '🦉 Сова'] },
    { id: 't_early', kind: 'title', v: 'early', icon: '🌅', n: ['Unvon: Erta turuvchi', 'Title: Early Bird', 'Титул: Жаворонок'], coins: 120, tv: ['🌅 Erta turuvchi', '🌅 Early Bird', '🌅 Жаворонок'] },
    { id: 't_machine', kind: 'title', v: 'machine', icon: '⚡', n: ['Unvon: Ish mashinasi', 'Title: Machine', 'Титул: Машина'], gems: 15, tv: ['⚡ Ish mashinasi', '⚡ Machine', '⚡ Машина'] },
    { id: 't_legend', kind: 'title', v: 'legend', icon: '👑', n: ['Unvon: Afsona', 'Title: Legend', 'Титул: Легенда'], gems: 50, tv: ['👑 Afsona', '👑 Legend', '👑 Легенда'] },
    // ➕ yangi ramkalar
    { id: 'f_ocean', kind: 'frame', v: 'ocean', icon: '🌊', n: ['Okean ramka', 'Ocean frame', 'Океанская рамка'], coins: 180 },
    { id: 'f_sakura', kind: 'frame', v: 'sakura', icon: '🌸', n: ['Sakura ramka', 'Sakura frame', 'Рамка сакура'], coins: 250 },
    { id: 'f_matrix', kind: 'frame', v: 'matrix', icon: '💚', n: ['Matritsa ramka', 'Matrix frame', 'Рамка матрица'], coins: 300 },
    { id: 'f_lava', kind: 'frame', v: 'lava', icon: '🌋', n: ['Lava ramka', 'Lava frame', 'Лавовая рамка'], gems: 25 },
    { id: 'f_galaxy', kind: 'frame', v: 'galaxy', icon: '🌌', n: ['Galaktika ramka', 'Galaxy frame', 'Рамка галактика'], gems: 30 },
    // ➕ yangi nik ranglari
    { id: 'n_ocean', kind: 'nick', v: 'ocean', icon: '🔵', n: ['Okean nik', 'Ocean nickname', 'Океанский ник'], coins: 80 },
    { id: 'n_lava', kind: 'nick', v: 'lava', icon: '🟠', n: ['Lava nik', 'Lava nickname', 'Лавовый ник'], coins: 100 },
    { id: 'n_ice', kind: 'nick', v: 'ice', icon: '🧊', n: ['Muz nik', 'Ice nickname', 'Ледяной ник'], coins: 120 },
    { id: 'n_neon', kind: 'nick', v: 'neon', icon: '💡', n: ['Neon nik', 'Neon nickname', 'Неоновый ник'], gems: 20 },
    { id: 'n_aurora', kind: 'nick', v: 'aurora', icon: '🌌', n: ['Shimol shafag\'i nik', 'Aurora nickname', 'Ник аврора'], gems: 30 },
    // ➕ yangi unvonlar
    { id: 't_book', kind: 'title', v: 'book', icon: '📚', n: ['Unvon: Kitobxon', 'Title: Bookworm', 'Титул: Книголюб'], coins: 100, tv: ['📚 Kitobxon', '📚 Bookworm', '📚 Книголюб'] },
    { id: 't_sniper', kind: 'title', v: 'sniper', icon: '🎯', n: ['Unvon: Mergan', 'Title: Sharpshooter', 'Титул: Снайпер'], coins: 150, tv: ['🎯 Mergan', '🎯 Sharpshooter', '🎯 Снайпер'] },
    { id: 't_zen', kind: 'title', v: 'zen', icon: '🧘', n: ['Unvon: Zen ustasi', 'Title: Zen master', 'Титул: Мастер дзен'], coins: 150, tv: ['🧘 Zen ustasi', '🧘 Zen master', '🧘 Мастер дзен'] },
    { id: 't_rocket', kind: 'title', v: 'rocket', icon: '🚀', n: ['Unvon: Raketa', 'Title: Rocket', 'Титул: Ракета'], coins: 200, tv: ['🚀 Raketa', '🚀 Rocket', '🚀 Ракета'] },
    { id: 't_lion', kind: 'title', v: 'lion', icon: '🦁', n: ['Unvon: Sher yurak', 'Title: Lionheart', 'Титул: Львиное сердце'], gems: 20, tv: ['🦁 Sher yurak', '🦁 Lionheart', '🦁 Львиное сердце'] },
    { id: 't_genius', kind: 'title', v: 'genius', icon: '🧠', n: ['Unvon: Daho', 'Title: Genius', 'Титул: Гений'], gems: 30, tv: ['🧠 Daho', '🧠 Genius', '🧠 Гений'] },
    // 🎨 ilova rangi (accent)
    { id: 'c_ocean', kind: 'theme', v: '#0ea5e9', icon: '🌊', n: ['Okean rangi', 'Ocean theme', 'Тема океан'], coins: 200 },
    { id: 'c_forest', kind: 'theme', v: '#22c55e', icon: '🌲', n: ['O\'rmon rangi', 'Forest theme', 'Тема лес'], coins: 200 },
    { id: 'c_sunset', kind: 'theme', v: '#f97316', icon: '🌅', n: ['Shafaq rangi', 'Sunset theme', 'Тема закат'], coins: 200 },
    { id: 'c_rose', kind: 'theme', v: '#ec4899', icon: '🌹', n: ['Atirgul rangi', 'Rose theme', 'Тема роза'], coins: 200 },
    { id: 'c_gold', kind: 'theme', v: '#eab308', icon: '🏆', n: ['Oltin rang', 'Gold theme', 'Золотая тема'], gems: 15 },
    { id: 'c_crimson', kind: 'theme', v: '#ef4444', icon: '🍒', n: ['Qirmizi rang', 'Crimson theme', 'Тема кармин'], gems: 15 },
    // 🎉 bajarilganda effekt
    { id: 'e_stars', kind: 'effect', v: '⭐✨🌟', icon: '⭐', n: ['Yulduzlar', 'Stars', 'Звёзды'], coins: 150 },
    { id: 'e_hearts', kind: 'effect', v: '💖💗💕', icon: '💖', n: ['Yuraklar', 'Hearts', 'Сердечки'], coins: 150 },
    { id: 'e_coins', kind: 'effect', v: '🪙💰🪙', icon: '🪙', n: ['Tangalar yomg\'iri', 'Coin rain', 'Дождь монет'], coins: 200 },
    { id: 'e_petals', kind: 'effect', v: '🌸🌺🌼', icon: '🌸', n: ['Gul barglari', 'Petals', 'Лепестки'], coins: 200 },
    { id: 'e_fire', kind: 'effect', v: '🔥💥🔥', icon: '🔥', n: ['Olov', 'Fire', 'Огонь'], gems: 15 },
    { id: 'e_party', kind: 'effect', v: '🎉🎊🥳', icon: '🎉', n: ['Bayram', 'Party', 'Праздник'], gems: 20 },
    // 🏅 nik yonidagi nishon
    { id: 'b_star', kind: 'badge', v: '⭐', icon: '⭐', n: ['Yulduz nishon', 'Star badge', 'Значок звезда'], coins: 100 },
    { id: 'b_fire', kind: 'badge', v: '🔥', icon: '🔥', n: ['Olov nishon', 'Fire badge', 'Значок огонь'], coins: 100 },
    { id: 'b_bolt', kind: 'badge', v: '⚡', icon: '⚡', n: ['Chaqmoq nishon', 'Bolt badge', 'Значок молния'], coins: 120 },
    { id: 'b_moon', kind: 'badge', v: '🌙', icon: '🌙', n: ['Oy nishon', 'Moon badge', 'Значок луна'], coins: 120 },
    { id: 'b_unicorn', kind: 'badge', v: '🦄', icon: '🦄', n: ['Yagona shox', 'Unicorn badge', 'Значок единорог'], gems: 15 },
    { id: 'b_gem', kind: 'badge', v: '💎', icon: '💎', n: ['Olmos nishon', 'Diamond badge', 'Значок алмаз'], gems: 25 },
    { id: 'b_crown', kind: 'badge', v: '👑', icon: '👑', n: ['Toj nishon', 'Crown badge', 'Значок корона'], gems: 40 },
    // 🧩 Interfeys uslubi: yangi komponentlar (widgets.js) — standart va bepul;
    // eski (klassik) toast/slayder/oynalar — ham bepul (hammada bor). S.shop.uistyle
    { id: 'ui_classic', kind: 'uistyle', v: 'classic', icon: '🗂', n: ['Klassik interfeys', 'Classic UI', 'Классический интерфейс'], coins: 0, free: true,
      d: ['Eski toast, slayder va tasdiqlash oynalari', 'The old toasts, sliders and confirm dialogs', 'Старые уведомления, слайдеры и окна'] },
    // ➕ Yangi interfeys uslublari — kartalar/tugmalar ko'rinishi (html[data-x-ui])
    { id: 'ui_glass', kind: 'uistyle', v: 'glass', icon: '🪟', n: ['Shisha', 'Glass', 'Стекло'], coins: 250,
      d: ['Shaffof, xira shishadek kartalar', 'Frosted, see-through glass cards', 'Матовые прозрачные карточки'] },
    { id: 'ui_soft', kind: 'uistyle', v: 'soft', icon: '☁️', n: ['Yumshoq', 'Soft', 'Мягкий'], coins: 250,
      d: ['Yumaloq, yumshoq soyali kartalar', 'Rounded cards with soft shadows', 'Округлые карточки с мягкой тенью'] },
    { id: 'ui_sharp', kind: 'uistyle', v: 'sharp', icon: '📐', n: ['Minimal', 'Minimal', 'Минимал'], coins: 200,
      d: ['To\'g\'ri burchakli, toza va ixcham', 'Sharp corners, clean and flat', 'Острые углы, чисто и плоско'] },
    { id: 'ui_bubble', kind: 'uistyle', v: 'bubble', icon: '🫧', n: ['Pufakcha', 'Bubbly', 'Пузырьки'], coins: 300,
      d: ['Juda yumaloq, quvnoq ko\'rinish', 'Extra-round, playful look', 'Очень круглый, игривый вид'] },
    { id: 'ui_neon', kind: 'uistyle', v: 'neon', icon: '🔮', n: ['Neon', 'Neon', 'Неон'], gems: 25,
      d: ['Kartalar chegarasi neon bilan porlaydi', 'Card edges glow with neon light', 'Края карточек светятся неоном'] },
    { id: 'ui_retro', kind: 'uistyle', v: 'retro', icon: '🕹', n: ['Retro', 'Retro', 'Ретро'], gems: 30,
      d: ['Qalin chegara va qattiq soya — 90-yillar uslubi', 'Bold outlines and hard shadows, 90s style', 'Жирные рамки и жёсткие тени в стиле 90-х'] },
    { id: 'ui_aurora', kind: 'uistyle', v: 'aurora', icon: '🌈', n: ['Gradient', 'Gradient', 'Градиент'], gems: 35,
      d: ['Kartalarda yumshoq rangli gradient', 'Soft colorful gradients on cards', 'Мягкие цветные градиенты на карточках'] },
    // ➕ yangi nishon
    { id: 'b_dragon', kind: 'badge', v: '🐉', icon: '🐉', n: ['Ajdar nishon', 'Dragon badge', 'Значок дракон'], gems: 35 },
    // ➕ yangi unvonlar
    { id: 't_unstop', kind: 'title', v: 'unstop', icon: '🔥', n: ['Unvon: To\'xtovsiz', 'Title: Unstoppable', 'Титул: Неудержимый'], coins: 180, tv: ['🔥 To\'xtovsiz', '🔥 Unstoppable', '🔥 Неудержимый'] },
    { id: 't_summit', kind: 'title', v: 'summit', icon: '🏔', n: ['Unvon: Cho\'qqi zabtkori', 'Title: Summit seeker', 'Титул: Покоритель вершин'], coins: 200, tv: ['🏔 Cho\'qqi zabtkori', '🏔 Summit seeker', '🏔 Покоритель вершин'] },
    { id: 't_strat', kind: 'title', v: 'strat', icon: '♟', n: ['Unvon: Strateg', 'Title: Strategist', 'Титул: Стратег'], coins: 220, tv: ['♟ Strateg', '♟ Strategist', '♟ Стратег'] },
    { id: 't_star', kind: 'title', v: 'star', icon: '🌟', n: ['Unvon: Yangi yulduz', 'Title: Rising star', 'Титул: Восходящая звезда'], coins: 160, tv: ['🌟 Yangi yulduz', '🌟 Rising star', '🌟 Восходящая звезда'] },
    { id: 't_wolf', kind: 'title', v: 'wolf', icon: '🐺', n: ['Unvon: Yolg\'iz bo\'ri', 'Title: Lone wolf', 'Титул: Одинокий волк'], gems: 25, tv: ['🐺 Yolg\'iz bo\'ri', '🐺 Lone wolf', '🐺 Одинокий волк'] },
    { id: 't_diamond', kind: 'title', v: 'diamond', icon: '💎', n: ['Unvon: Olmos aql', 'Title: Diamond mind', 'Титул: Алмазный ум'], gems: 45, tv: ['💎 Olmos aql', '💎 Diamond mind', '💎 Алмазный ум'] },
    // ➕ yangi ilova ranglari
    { id: 'c_teal', kind: 'theme', v: '#14b8a6', icon: '🦚', n: ['Firuza rang', 'Teal theme', 'Бирюзовая тема'], coins: 220 },
    { id: 'c_lime', kind: 'theme', v: '#84cc16', icon: '🍋', n: ['Laym rang', 'Lime theme', 'Лаймовая тема'], gems: 15 },
    // ➕ yangi bajarilganda effektlar
    { id: 'e_space', kind: 'effect', v: '🚀🪐💫', icon: '🚀', n: ['Koinot', 'Space launch', 'Космос'], coins: 220 },
    { id: 'e_magic', kind: 'effect', v: '🦄🌈✨', icon: '🦄', n: ['Sehr', 'Magic', 'Магия'], gems: 20 }
  ];
  // 🏷 Barcha narxlar 64% arzonlashtirilgan (asl narx × 0.36 — ikki marta 40% chegirma). Dizayn va effekt narxlari o'z fayllarida xuddi shunday kamaytirilgan
  SHOP.forEach(function (it) {
    if (it.coins) it.coins = Math.max(5, Math.round(it.coins * 0.36 / 5) * 5);
    if (it.gems) it.gems = Math.max(1, Math.round(it.gems * 0.36 * 1.3)); // 💎 olmos narxlari tangadan farqli 30% qimmatroq
  });
  // 🎨 Pullik fon dizaynlari (narxlar designs.js da — yagona manba). Egalik id: 'd_<dizayn>'
  try {
    if (window.LUDesign && window.LUDesign.catalog) window.LUDesign.catalog().forEach(function (d) {
      if (d.price) SHOP.push({ id: 'd_' + d.id, kind: 'design', v: d.id, icon: '🎨', n: d.n, coins: d.price.coins, gems: d.price.gems });
    });
  } catch (e) {}
  // ✨ UI effektlar (effects.js). Bir nechtasi bir vaqtda yoqilishi mumkin: S.shop.ufx = [id...]
  try {
    if (window.LUFx && window.LUFx.catalog) window.LUFx.catalog().forEach(function (f) {
      SHOP.push({ id: f.id, kind: 'ufx', v: f.key, icon: f.icon, n: f.n, d: f.d, coins: f.coins, gems: f.gems, desktop: f.desktop });
    });
  } catch (e) {}
  // 🎨 Dizayn studiyasi — o'zi yaratgan ranglar (S.shop.custom). Gridlarda ko'rinmaydi (hidden)
  SHOP.push({ id: 'n_custom', kind: 'nick', v: 'custom', icon: '🎨', n: ['Mening nik rangim', 'My nickname color', 'Мой цвет ника'], hidden: true, coins: 0 });
  SHOP.push({ id: 'f_custom', kind: 'frame', v: 'custom', icon: '🎨', n: ['Mening ramkam', 'My frame', 'Моя рамка'], hidden: true, coins: 0 });
  (function () {
    var it = { id: 'c_custom', kind: 'theme', icon: '🎨', n: ['Mening rangim', 'My color', 'Мой цвет'], hidden: true, coins: 0 };
    Object.defineProperty(it, 'v', { get: function () { var c = S.shop && S.shop.custom; return (c && isHex(c.accent)) ? c.accent : '#7C5CFC'; } });
    SHOP.push(it);
  })();
  function isHex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }
  function shopState() {
    S.shop = S.shop || { owned: [], frame: null, nick: null, title: null, theme: null, effect: null, badge: null }; if (!Array.isArray(S.shop.owned)) S.shop.owned = [];
    // 🆓 Bepul buyumlar (Classic UI) — hammada bor
    SHOP.forEach(function (x) { if (x.free && S.shop.owned.indexOf(x.id) === -1) S.shop.owned.push(x.id); });
    return S.shop;
  }
  // 🎁 Har bir darajada bepul sovg'alar (fonlar, effektlar, uslublar...). Daraja olinganda S.shop.owned ga qo'shiladi.
  var LEVEL_GIFTS = {
    1: ['n_mint'],
    2: ['d_rings', 'e_stars'],
    3: ['d_aurora', 'u_spark'],
    4: ['d_ocean', 'ui_glass', 'f_neon'],
    5: ['d_lava', 'u_confetti', 't_star'],
    6: ['d_synth', 'u_fly', 'b_dragon'],
    7: ['d_silk', 'ui_neon', 't_legend', 'f_rainbow']
  };
  function giftLevelOf(id) { for (var k in LEVEL_GIFTS) if (LEVEL_GIFTS[k].indexOf(id) !== -1) return +k; return 0; }
  function giftName(id) {
    var it = SHOP.find(function (x) { return x.id === id; });
    if (it) return (it.icon && it.kind !== 'design' ? it.icon + ' ' : it.kind === 'design' ? '🌌 ' : '') + L(it.n[0], it.n[1], it.n[2]).replace(/^[^:]+:\s*/, '');
    try { if (id.indexOf('d_') === 0 && window.LUDesign) { var d = window.LUDesign.catalog().filter(function (x) { return x.id === id.slice(2); })[0]; if (d) return '🌌 ' + L(d.n[0], d.n[1], d.n[2]); } } catch (e) {}
    return id;
  }
  window.xLevelGiftHtml = function (level, done) {
    var g = LEVEL_GIFTS[level]; if (!g || !g.length) return '';
    return '<span class="lvp-gift' + (done ? ' got' : '') + '">🎁 ' + g.map(function (id) { return H(giftName(id)); }).join(' · ') + '</span>';
  };
  window.xLevelGifts = safe(function (level) {
    if (!level || typeof S === 'undefined') return;
    if (S.cloudLinked && !window._cloudPullDone) return; // bulutdagi holat kelguncha kutamiz (ikki marta berilmasin)
    var st = shopState(); if (!Array.isArray(st.lvGifts)) st.lvGifts = [];
    var fresh = [], nLv = 0, first = !st.lvGifts.length && level > 1;
    for (var lv = 1; lv <= level; lv++) {
      if (st.lvGifts.indexOf(lv) !== -1) continue;
      st.lvGifts.push(lv); nLv++;
      (LEVEL_GIFTS[lv] || []).forEach(function (id) { if (st.owned.indexOf(id) === -1) { st.owned.push(id); fresh.push(id); } });
    }
    if (!fresh.length) { return; }
    try { save(); } catch (e) {}
    try { if (window.LUDesign) window.LUDesign.renderPicker(); } catch (e) {}
    try { renderHubSection('shop'); } catch (e) {}
    var msg = '🎁 ' + (first || nLv > 1 ? L('Darajangiz uchun sovg\'alar', 'Gifts for your level', 'Подарки за ваш уровень') : L('Lv ' + level + ' sovg\'asi', 'Lv ' + level + ' gift', 'Подарок за ур. ' + level)) + ': ' +
      fresh.slice(0, 4).map(giftName).join(', ') + (fresh.length > 4 ? ' +' + (fresh.length - 4) : '') + ' — ' + L('Do\'konda qo\'llang', 'apply them in the Shop', 'примените в магазине');
    setTimeout(function () { try { toast(msg); } catch (e) {} }, first ? 1500 : 600);
  });
  function shopBuy(id) {
    var it = SHOP.find(function (x) { return x.id === id; }); if (!it) return;
    if (it.hidden) { window.xOpenStudio(); return; } // studiya qismlari faqat studiya orqali
    var st = shopState(); if (st.owned.indexOf(id) !== -1) return shopEquip(id);
    var nm = L(it.n[0], it.n[1], it.n[2]);
    var gemsHave = function () { return typeof gemsAvailable === 'function' ? gemsAvailable() : S.gems || 0; };
    if (it.gems ? gemsHave() < it.gems : (S.coins || 0) < it.coins) {
      toast(it.gems ? '💎 ' + L('Gem yetarli emas', 'Not enough gems', 'Недостаточно гемов') : '🪙 ' + L('Tanga yetarli emas', 'Not enough coins', 'Недостаточно монет'));
      return;
    }
    var price = it.gems ? it.gems + ' 💎' : it.coins + ' 🪙';
    var pay = function () {
      if (st.owned.indexOf(id) !== -1) return true;
      if (it.gems) { if (gemsHave() < it.gems) return false; gemsAdd(-it.gems, 'shop', nm, true); }
      else { if ((S.coins || 0) < it.coins) return false; addCoins(-it.coins, '🛍 ' + nm); }
      shopBought(it, id, nm);
      return true;
    };
    // 🧩 SlideCommit (widgets.js): "Surib to'lash" — klassik interfeysda oddiy confirm()
    if (window.LUWidgets && window.LUWidgets.active()) {
      window.LUWidgets.slideConfirm({
        icon: it.icon || '🛍', title: nm, message: price,
        label: L('Surib to\'lang', 'Slide to pay', 'Сдвиньте для оплаты'),
        doneLabel: L('To\'landi', 'Paid', 'Оплачено'),
        errorLabel: L('To\'lov amalga oshmadi', 'Payment failed', 'Оплата не прошла'),
        onConfirm: pay
      });
      return;
    }
    if (!confirm(nm + ' — ' + price + '?')) return;
    pay();
  }
  function shopBought(it, id, nm) {
    var st = shopState();
    st.owned.push(id);
    try { SFX.coin(); confetti(); } catch (e) {}
    if (it.kind === 'design') {
      // Dizayn: sotib olindi → "Qo'llash" tugmasi (avtomatik qo'llanmaydi)
      toast('🛍 ' + nm + ' ' + L('sotib olindi! Endi "Qo\'llash"ni bosing', 'purchased! Tap "Apply" to use it', 'куплено! Нажмите «Применить»'));
      save(); renderHubSection('shop');
      try { window.LUDesign.renderPicker(); } catch (e) {}
      return;
    }
    toast('🛍 ' + nm + ' ' + L('sotib olindi!', 'purchased!', 'куплено!'));
    shopEquip(id, true);
  }
  function shopEquip(id, silent) {
    var it = SHOP.find(function (x) { return x.id === id; }); var st = shopState(); if (!it) return;
    if (it.kind === 'design') { shopApplyDesign(it.v); return; }
    if (it.kind === 'ufx') {
      if (!Array.isArray(st.ufx)) st.ufx = [];
      var ix = st.ufx.indexOf(id), turnOn = ix === -1;
      if (turnOn) st.ufx.push(id); else st.ufx.splice(ix, 1);
      save(); try { window.LUFx.sync(); window.LUDesign.renderPicker(); } catch (e) {} renderHubSection('shop');
      if (!silent || turnOn) toast(turnOn ? '✨ ' + L('Effekt yoqildi', 'Effect on', 'Эффект включён') : L('Effekt o\'chirildi', 'Effect off', 'Эффект выключен'));
      return;
    }
    st[it.kind] = (st[it.kind] === id) ? null : id;
    save(); shopApply(); try { render(); } catch (e) {} renderHubSection('shop');
    if (!silent) toast(st[it.kind] ? '✅ ' + L('Kiyildi', 'Equipped', 'Надето') : L('Olib tashlandi', 'Removed', 'Снято'));
  }
  function shopApplyDesign(did) {
    if (!window.LUDesign) return;
    if (window.LUDesign.current() === did) { toast('✅ ' + L('Bu dizayn allaqachon qo\'llangan', 'This design is already applied', 'Этот дизайн уже применён')); return; }
    if (window.LUDesign.apply(did) !== false) {
      toast('🎨 ' + L('Dizayn qo\'llandi', 'Design applied', 'Дизайн применён'));
      renderHubSection('shop');
    }
  }
  function fxBurst(chars, x, y) {
    var arr = Array.from(chars || '🎉'); var n = 16;
    var cx = x != null ? x : window.innerWidth / 2, cy = y != null ? y : window.innerHeight * 0.45;
    for (var i = 0; i < n; i++) {
      var e = document.createElement('span'); e.className = 'x-fx';
      e.textContent = arr[i % arr.length];
      var ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 130;
      e.style.left = cx + 'px'; e.style.top = cy + 'px';
      e.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); e.style.setProperty('--dy', (Math.sin(ang) * dist - 60) + 'px');
      e.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg'); e.style.fontSize = (14 + Math.random() * 14) + 'px';
      document.body.appendChild(e); setTimeout(function (el) { return function () { el.remove(); }; }(e), 1200);
    }
  }
  function shopEffectBurst(x, y) { var st = shopState(), it = SHOP.find(function (z) { return z.id === st.effect; }); if (it) fxBurst(it.v, x, y); }
  function shopTitleText() {
    var st = shopState(); var it = SHOP.find(function (x) { return x.id === st.title; });
    return it ? L(it.tv[0], it.tv[1], it.tv[2]) : '';
  }
  // 👀 Boshqalarga ko'rinadigan bezaklar (reyting, do'stlar, profil oynasi).
  // Faqat do'kondagi ma'lum id'lar qabul qilinadi — bazadagi qiymat orqali HTML kiritib bo'lmaydi.
  var COS_KINDS = ['frame', 'nick', 'badge', 'title'];
  function cosItem(c, kind) {
    if (!c || typeof c !== 'object' || typeof c[kind] !== 'string') return null;
    return SHOP.find(function (x) { return x.id === c[kind] && x.kind === kind; }) || null;
  }
  window.xCosMine = function () {
    var st = shopState(), o = {};
    COS_KINDS.forEach(function (k) { if (st[k] && st.owned.indexOf(st[k]) !== -1) o[k] = st[k]; });
    // 🎨 Studiya ranglari (faqat #rrggbb) — boshqalar ham ko'radi
    var cu = st.custom || {}, cx = {};
    if (o.nick === 'n_custom' && cu.nick && isHex(cu.nick.a)) cx.n = [cu.nick.a].concat(isHex(cu.nick.b) ? [cu.nick.b] : []);
    if (o.frame === 'f_custom' && cu.frame && isHex(cu.frame.a)) cx.f = [cu.frame.a].concat(isHex(cu.frame.b) ? [cu.frame.b] : []);
    if (cx.n || cx.f) o.cx = cx;
    try { var ach = achShowcaseIds(); if (ach.length) o.ach = ach; } catch (e) {}
    // Barcha olingan yutuqlar — faqat id'lar (ixcham), boshqalar profil oynasida ko'radi
    try { var all = achEarnedIds(); if (all.length) o.achAll = all; } catch (e) {}
    return Object.keys(o).length ? o : null;
  };
  // nameHtml allaqachon escape qilingan bo'lishi kerak
  // Boshqa foydalanuvchining studiya ranglari: har bir rang juftligi uchun bitta CSS qoida (faqat hex)
  var _cxRules = {}, _cxSheet = null;
  function cxClass(kind, arr) {
    if (!Array.isArray(arr) || !isHex(arr[0]) || (arr[1] != null && !isHex(arr[1]))) return '';
    var a = arr[0].toLowerCase(), b = (arr[1] || arr[0]).toLowerCase();
    var cls = 'xc' + kind + '-' + a.slice(1) + '-' + b.slice(1);
    if (!_cxRules[cls]) {
      _cxRules[cls] = 1;
      try {
        if (!_cxSheet) { var st0 = document.createElement('style'); st0.id = 'x-cx-rules'; document.head.appendChild(st0); _cxSheet = st0.sheet; }
        _cxSheet.insertRule('.' + cls + '{--xc' + kind + '1:' + a + ';--xc' + kind + '2:' + b + '}', _cxSheet.cssRules.length);
      } catch (e) {}
    }
    return cls;
  }
  window.xCosNameHtml = function (nameHtml, c) {
    var n = cosItem(c, 'nick'), b = cosItem(c, 'badge');
    var ncls = n ? 'xn-' + n.v + (n.v === 'custom' ? ' ' + cxClass('n', c.cx && c.cx.n) : '') : '';
    if (n && n.v === 'custom' && ncls === 'xn-custom ') ncls = '';
    return (ncls ? '<span class="' + ncls + '">' + nameHtml + '</span>' : nameHtml) + (b ? '<span class="x-nbadge">' + b.v + '</span>' : '');
  };
  window.xCosFrameCls = function (c) {
    var f = cosItem(c, 'frame'); if (!f) return '';
    if (f.v !== 'custom') return ' xf-' + f.v;
    var k = cxClass('f', c.cx && c.cx.f);
    return k ? ' xf-custom ' + k : '';
  };
  window.xCosTitle = function (c) { var it = cosItem(c, 'title'); return it ? L(it.tv[0], it.tv[1], it.tv[2]) : ''; };

  // =========================================================
  // 🎨 DIZAYN STUDIYASI — bitta oynada: ilova rangi, nik rangi (gradient), ramka.
  // Narx har bir o'zgartirilgan qism bo'yicha jonli hisoblanadi; oxirida to'lanadi.
  // Avval sotib olingan rang qayta tanlansa — bepul.
  // =========================================================
  // (ikki marta 40% chegirmadan keyingi narxlar)
  var STUDIO_PRICE = {
    accent: { coins: 55 },
    nick: { coins: 35 }, nick2: { gems: 5 },
    frame: { coins: 40 }, frame2: { gems: 5 }
  };
  function hsl2hex(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l);
    var f = function (n) { return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  }
  var STUDIO_SWATCHES = (function () {
    var out = [];
    [[90, 78], [85, 64], [80, 52], [70, 40]].forEach(function (sl) {
      for (var h = 0; h < 360; h += 20) out.push(hsl2hex(h, sl[0], sl[1]));
    });
    return out.concat(['#ffffff', '#e4e4e7', '#a1a1aa', '#71717a', '#3f3f46', '#18181b', '#f5c542', '#c0c0c0', '#cd7f32']);
  })();
  // 👀 Sinab ko'rish yordamchilari (sahifa sinov paytida yopilsa — keyingi ochilishda avvalgi holat tiklanadi)
  var TRY_SEC = 60;
  function tryBackup(st, hasD) {
    return { theme: st.theme || null, nick: st.nick || null, frame: st.frame || null, badge: st.badge || null, title: st.title || null, effect: st.effect || null, uistyle: st.uistyle || null,
      ufx: (Array.isArray(st.ufx) ? st.ufx : []).slice(), custom: JSON.parse(JSON.stringify(st.custom || {})), design: hasD && window.LUDesign ? window.LUDesign.current() : null };
  }
  function tryRefresh() {
    try { shopApply(); render(); } catch (e) {}
    try { if (window.LUFx) window.LUFx.sync(); } catch (e) {}
    try { if (window.LUWidgets) window.LUWidgets.sync(); } catch (e) {}
  }
  function tryRestore(st) {
    var b = null; try { b = JSON.parse(localStorage.getItem('ludTryBackup') || 'null'); } catch (e) {}
    window._ludTrying = false;
    if (!b) return;
    st = st || shopState();
    ['theme', 'nick', 'frame', 'badge', 'title', 'effect', 'uistyle'].forEach(function (k) { st[k] = b[k] || null; });
    st.ufx = b.ufx || []; st.custom = b.custom || {};
    if (b.design && window.LUDesign && window.LUDesign.current() !== b.design) { try { window.LUDesign.apply(b.design, { force: true, silent: true }); } catch (e) {} }
    try { localStorage.removeItem('ludTryBackup'); } catch (e) {}
    try { save(); } catch (e) {}
    tryRefresh();
  }
  setTimeout(function () { try { if (localStorage.getItem('ludTryBackup')) tryRestore(); } catch (e) {} }, 1500);
  window.xOpenStudio = function (startTab) {
    var st = shopState();
    var cu = st.custom || {};
    var hasD = !!window.LUDesign, hasFx = !!window.LUFx;
    // Ranglar qoralamasi (sotib olingan qiymatlardan boshlanadi)
    var D = {
      accent: cu.accent || null,
      nick: cu.nick ? { a: cu.nick.a, b: cu.nick.b || null } : null,
      frame: cu.frame ? { a: cu.frame.a, b: cu.frame.b || null } : null
    };
    // Tanlovlar: hozir kiyilganlardan boshlanadi
    var sel = { theme: st.theme || null, nick: st.nick || null, frame: st.frame || null, badge: st.badge || null, title: st.title || null, effect: st.effect || null,
      uistyle: st.uistyle || null, design: hasD ? window.LUDesign.current() : null, ufx: (Array.isArray(st.ufx) ? st.ufx : []).slice() };
    var tab = startTab || 'colors', ctab = 'accent', slot = 'a';
    var ov = document.createElement('div'); ov.className = 'xs-ov';
    ov.innerHTML = '<div class="xs-box" role="dialog" aria-modal="true">' +
      '<div class="xs-head"><b>🛍 ' + H(L('Do\'kon studiyasi', 'Shop studio', 'Студия магазина')) + ' <span class="xs-sale">−40%</span></b><button type="button" class="xs-x" aria-label="close">✕</button></div>' +
      '<div class="xs-prev"></div><div class="xs-tabs" role="tablist"></div><div class="xs-body"></div><div class="xs-foot"></div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    var $ = function (q) { return ov.querySelector(q); };
    var close = function () { ov.classList.remove('open'); document.removeEventListener('keydown', onKey, true); setTimeout(function () { ov.remove(); }, 200); };
    var onKey = function (e) { if (e.key === 'Escape' && !document.querySelector('.luw-sc-ov')) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    $('.xs-x').onclick = close;
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) close(); });

    function same(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase(); }
    function own(id) { return st.owned.indexOf(id) !== -1; }
    function item(id) { return SHOP.find(function (x) { return x.id === id; }) || null; }
    function nm(it) { return L(it.n[0], it.n[1], it.n[2]).replace(/^[^:]+:\s*/, ''); }
    function pr(it) { return it.gems ? { gems: it.gems } : { coins: it.coins || 0 }; }
    function prTxt(p) { return p.gems ? p.gems + ' 💎' : (p.coins || 0) + ' 🪙'; }
    function gemsHave() { return typeof gemsAvailable === 'function' ? gemsAvailable() : S.gems || 0; }
    function dCat() { return hasD ? window.LUDesign.catalog() : []; }

    // Savat: [nom, narx, id?]
    function lines() {
      var out = [], owned = st.custom || {};
      if (sel.theme === 'c_custom' && D.accent && !same(D.accent, owned.accent)) out.push(['🎨 ' + L('Ilova rangi', 'App color', 'Цвет приложения'), STUDIO_PRICE.accent]);
      if (sel.nick === 'n_custom' && D.nick && D.nick.a) {
        var on = owned.nick || {};
        if (!same(D.nick.a, on.a)) out.push(['✏️ ' + L('Nik rangi', 'Nickname color', 'Цвет ника'), STUDIO_PRICE.nick]);
        if (D.nick.b && !same(D.nick.b, on.b)) out.push(['✏️ ' + L('Nik gradienti', 'Nickname gradient', 'Градиент ника'), STUDIO_PRICE.nick2]);
      }
      if (sel.frame === 'f_custom' && D.frame && D.frame.a) {
        var of = owned.frame || {};
        if (!same(D.frame.a, of.a)) out.push(['🖼 ' + L('Ramka rangi', 'Frame color', 'Цвет рамки'), STUDIO_PRICE.frame]);
        if (D.frame.b && !same(D.frame.b, of.b)) out.push(['🖼 ' + L('Ikkinchi halqa', 'Second ring', 'Второе кольцо'), STUDIO_PRICE.frame2]);
      }
      ['theme', 'nick', 'frame', 'badge', 'title', 'effect', 'uistyle'].forEach(function (k) {
        var id = sel[k], it = id && item(id);
        if (it && !it.hidden && !own(id)) out.push([(it.icon || '') + ' ' + nm(it), pr(it), id]);
      });
      if (hasD && sel.design) {
        var d = dCat().find(function (x) { return x.id === sel.design; });
        if (d && d.price && !window.LUDesign.isOwned(d.id)) out.push(['🌌 ' + L(d.n[0], d.n[1], d.n[2]), d.price, 'd_' + d.id]);
      }
      sel.ufx.forEach(function (id) { var it = item(id); if (it && !own(id)) out.push([(it.icon || '✨') + ' ' + nm(it), pr(it), id]); });
      return out;
    }
    function total() { var c = 0, g = 0; lines().forEach(function (x) { c += x[1].coins || 0; g += x[1].gems || 0; }); return { coins: c, gems: g }; }
    // Hech narsa sotib olinmasa ham — kiyilgan narsalar o'zgardimi?
    function changed() {
      var cur = { theme: st.theme || null, nick: st.nick || null, frame: st.frame || null, badge: st.badge || null, title: st.title || null, effect: st.effect || null, uistyle: st.uistyle || null };
      for (var k in cur) if ((sel[k] || null) !== cur[k]) return true;
      if (hasD && sel.design !== window.LUDesign.current()) return true;
      var a = (st.ufx || []).slice().sort().join(), b = sel.ufx.slice().sort().join();
      return a !== b;
    }

    // ---------- Jonli ko'rinish ----------
    function accentNow() {
      if (sel.theme === 'c_custom' && D.accent) return D.accent;
      var it = sel.theme && item(sel.theme);
      if (it && it.id !== 'c_custom') return it.v;
      return '#7C5CFC';
    }
    function drawPrev() {
      var acc = accentNow(), name = H(getDisplayUsername() || 'Nick');
      var fr = sel.frame && item(sel.frame), nk = sel.nick && item(sel.nick), bd = sel.badge && item(sel.badge), tt = sel.title && item(sel.title);
      var fCls = '', fSty = '', nCls = '', nSty = '';
      if (fr) { if (fr.v === 'custom') { if (D.frame && D.frame.a) { fCls = ' xf-custom'; fSty = '--xcf1:' + D.frame.a + ';--xcf2:' + (D.frame.b || D.frame.a) + ';'; } } else fCls = ' xf-' + fr.v; }
      if (nk) { if (nk.v === 'custom') { if (D.nick && D.nick.a) { nCls = ' xn-custom'; nSty = '--xcn1:' + D.nick.a + ';--xcn2:' + (D.nick.b || D.nick.a); } } else nCls = ' xn-' + nk.v; }
      $('.xs-prev').innerHTML =
        (hasD && sel.design ? '<span class="xs-pv-bg dz-prev dz-prev-' + H(sel.design) + '" aria-hidden="true"><span class="dz-prev-in"></span></span>' : '') +
        '<div class="xs-pv-av' + fCls + '" style="' + fSty + 'background:' + acc + '">' + H((getDisplayUsername() || '?').charAt(0).toUpperCase()) + '</div>' +
        '<div class="xs-pv-r"><div class="xs-pv-n"><span class="' + nCls.trim() + '" style="' + nSty + '">' + name + '</span>' + (bd ? ' <span class="x-nbadge">' + bd.v + '</span>' : '') + '</div>' +
        (tt ? '<div class="xs-pv-t">' + H(L(tt.tv[0], tt.tv[1], tt.tv[2])) + '</div>' : '') +
        '<div class="xs-pv-bar"><i style="background:' + acc + '"></i></div>' +
        '<span class="xs-pv-btn" style="background:' + acc + '">+ ' + H(L('Vazifa', 'Task', 'Задача')) + '</span></div>';
    }

    // ---------- Bo'limlar ----------
    var TABS = [['colors', '🎨', L('Ranglar', 'Colors', 'Цвета')], ['designs', '🌌', L('Fonlar', 'Backgrounds', 'Фоны')], ['ufx', '✨', L('Effektlar', 'Effects', 'Эффекты')],
      ['theme', '🎯', L('Mavzu', 'Theme', 'Тема')], ['frame', '🖼', L('Ramka', 'Frame', 'Рамка')], ['nick', '✏️', L('Nik', 'Nickname', 'Ник')], ['badge', '🏅', L('Nishon', 'Badge', 'Значок')],
      ['title', '🏷', L('Unvon', 'Title', 'Титул')], ['effect', '🎉', L('Bajarilganda', 'On done', 'При выполнении')], ['uistyle', '🧩', L('Interfeys', 'UI', 'Интерфейс')]];
    function drawTabs() {
      $('.xs-tabs').innerHTML = TABS.filter(function (x) { return x[0] !== 'designs' || hasD; }).filter(function (x) { return x[0] !== 'ufx' || hasFx; }).map(function (x) {
        return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" class="' + (tab === x[0] ? 'on' : '') + '" data-xs-tab="' + x[0] + '"><span>' + x[1] + '</span>' + H(x[2]) + '</button>';
      }).join('');
      ov.querySelectorAll('[data-xs-tab]').forEach(function (b) { b.onclick = function () { tab = b.dataset.xsTab; slot = 'a'; drawTabs(); drawBody(); }; });
      var on = $('.xs-tabs .on'); if (on) try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
    }
    function cardHtml(id, inner, nameTxt, price, selected, note) {
      var owned = price == null || own(id) || (id.indexOf('d_') === 0 && hasD && window.LUDesign.isOwned(id.slice(2)));
      return '<button type="button" class="xs-it' + (selected ? ' on' : '') + '" data-xs-pick="' + H(id) + '" aria-pressed="' + selected + '">' + inner +
        '<span class="xs-it-n">' + H(nameTxt) + '</span>' + (note ? '<span class="xs-it-note">' + H(note) + '</span>' : '') +
        '<span class="xs-it-p">' + (selected ? '✓ ' : '') + (owned ? H(price == null ? L('Bepul', 'Free', 'Бесплатно') : L('Sizda bor', 'Owned', 'Есть')) : prTxt(price)) + '</span></button>';
    }
    function noneCard(kind) {
      return '<button type="button" class="xs-it xs-none' + (!sel[kind] ? ' on' : '') + '" data-xs-pick="none:' + kind + '" aria-pressed="' + !sel[kind] + '"><span class="xs-it-pv">∅</span><span class="xs-it-n">' + H(L('Yo\'q', 'None', 'Нет')) + '</span><span class="xs-it-p">' + (!sel[kind] ? '✓' : '') + '</span></button>';
    }
    function prevOf(it) {
      var u = H((getDisplayUsername() || '?').charAt(0).toUpperCase()), n = H(getDisplayUsername() || 'Nick');
      if (it.kind === 'frame') return '<span class="xs-it-pv"><span class="x-shop-av xf-' + it.v + '">' + u + '</span></span>';
      if (it.kind === 'nick') return '<span class="xs-it-pv"><span class="x-shop-nk xn-' + it.v + '">' + n + '</span></span>';
      if (it.kind === 'theme') return '<span class="xs-it-pv"><span class="x-shop-th" style="--tc:' + it.v + '"><i></i><i></i><i></i></span></span>';
      if (it.kind === 'effect') return '<span class="xs-it-pv xs-it-fx">' + it.v + '</span>';
      if (it.kind === 'badge') return '<span class="xs-it-pv"><span class="x-shop-nk">' + n + ' ' + it.v + '</span></span>';
      if (it.kind === 'title') return '<span class="xs-it-pv"><span class="x-shop-tt">' + H(L(it.tv[0], it.tv[1], it.tv[2])) + '</span></span>';
      if (it.kind === 'uistyle') return '<span class="xs-it-pv"><span class="x-shop-ui uip-' + it.v + '"><i></i><i></i><i></i></span></span>';
      if (it.kind === 'ufx') return '<span class="xs-it-pv">' + (hasFx ? window.LUFx.previewHtml(it.v) : it.icon) + '</span>';
      return '<span class="xs-it-pv">' + (it.icon || '') + '</span>';
    }
    function drawBody() {
      var h = '';
      if (tab === 'colors') h = colorsHtml();
      else if (tab === 'designs') {
        h = '<div class="xs-grid">' + dCat().map(function (d) {
          var inner = '<span class="xs-it-pv dz-prev dz-prev-' + d.id + '"><span class="dz-prev-in"></span></span>';
          return cardHtml('d_' + d.id, inner, L(d.n[0], d.n[1], d.n[2]), d.price || null, sel.design === d.id);
        }).join('') + '</div>';
      } else if (tab === 'ufx') {
        h = '<div class="xs-hint">' + H(L('Bir nechtasini tanlash mumkin', 'You can pick several', 'Можно выбрать несколько')) + '</div><div class="xs-grid">' +
          SHOP.filter(function (x) { return x.kind === 'ufx'; }).map(function (it) {
            return cardHtml(it.id, prevOf(it), nm(it), pr(it), sel.ufx.indexOf(it.id) !== -1, it.desktop ? '🖱 ' + L('Faqat kompyuterda', 'Desktop only', 'Только ПК') : '');
          }).join('') + '</div>';
      } else {
        var list = SHOP.filter(function (x) { return x.kind === tab && !x.hidden; });
        h = '<div class="xs-grid">' + noneCard(tab) + list.map(function (it) {
          return cardHtml(it.id, prevOf(it), nm(it), pr(it), sel[tab] === it.id, tab === 'uistyle' ? L(it.d[0], it.d[1], it.d[2]) : '');
        }).join('') + '</div>';
        if (tab === 'uistyle') h = '<div class="xs-hint">' + H(L('"Yo\'q" — standart interfeys (bepul). Boshqalari kartalar va tugmalar ko\'rinishini o\'zgartiradi.', '"None" — the default UI (free). Others restyle cards and buttons.', '«Нет» — стандартный интерфейс. Остальные меняют вид карточек и кнопок.')) + '</div>' + h;
      }
      $('.xs-body').innerHTML = h;
      if (tab === 'colors') bindColors();
      ov.querySelectorAll('[data-xs-pick]').forEach(function (b) { b.onclick = function () { pick(b.dataset.xsPick, b); }; });
    }
    function pick(id, el) {
      try { SFX.click(); } catch (e) {}
      if (id.indexOf('none:') === 0) { sel[id.slice(5)] = null; }
      else if (id.indexOf('d_') === 0) { sel.design = id.slice(2); }
      else {
        var it = item(id); if (!it) return;
        if (it.kind === 'ufx') { var i = sel.ufx.indexOf(id); if (i === -1) sel.ufx.push(id); else sel.ufx.splice(i, 1); }
        else if (it.kind === 'uistyle') sel.uistyle = sel.uistyle === id ? null : id;
        else {
          sel[it.kind] = sel[it.kind] === id ? null : id;
          if (it.kind === 'effect' && sel.effect && el) { var r = el.getBoundingClientRect(); try { fxBurst(it.v, r.left + r.width / 2, r.top + r.height / 2); } catch (e) {} }
        }
      }
      drawPrev(); drawBody(); drawFoot();
    }

    // ---------- Ranglar (o'zingiz yaratasiz) ----------
    function colorsHtml() {
      var CT = [['accent', '🎨 ' + L('Ilova', 'App', 'Приложение')], ['nick', '✏️ ' + L('Nik', 'Nickname', 'Ник')], ['frame', '🖼 ' + L('Ramka', 'Frame', 'Рамка')]];
      var h = '<div class="xs-seg">' + CT.map(function (x) { return '<button type="button" class="' + (ctab === x[0] ? 'on' : '') + '" data-xs-ctab="' + x[0] + '">' + H(x[1]) + '</button>'; }).join('') + '</div>';
      if (ctab !== 'accent') {
        var two = !!(D[ctab] && D[ctab].b);
        h += '<div class="xs-slots"><button type="button" class="' + (slot === 'a' ? 'on' : '') + '" data-xs-slot="a"><i style="background:' + ((D[ctab] && D[ctab].a) || 'transparent') + '"></i>' + H(L('1-rang', 'Color 1', 'Цвет 1')) + '</button>' +
          '<button type="button" class="' + (slot === 'b' ? 'on' : '') + '" data-xs-slot="b"><i style="background:' + ((D[ctab] && D[ctab].b) || 'transparent') + '"></i>' + H(ctab === 'nick' ? L('Gradient', 'Gradient', 'Градиент') : L('2-halqa', 'Ring 2', 'Кольцо 2')) + ' <small>💎</small></button>' +
          (two ? '<button type="button" class="xs-mini" data-xs-clear2="1">✕ ' + H(L('2-rangni olib tashlash', 'Remove color 2', 'Убрать цвет 2')) + '</button>' : '') + '</div>';
      }
      var c = curColor();
      h += '<div class="xs-sw" role="listbox" aria-label="' + H(L('Ranglar', 'Colors', 'Цвета')) + '">' + STUDIO_SWATCHES.map(function (x) {
        return '<button type="button" role="option" aria-selected="' + same(c, x) + '" class="' + (same(c, x) ? 'on' : '') + '" style="background:' + x + '" data-xs-c="' + x + '" title="' + x + '"></button>';
      }).join('') + '</div>' +
        '<label class="xs-custom"><input type="color" value="' + (isHex(c) ? c : '#7c5cfc') + '" /><span>🌈 ' + H(L('Boshqa istalgan rang', 'Any other color', 'Любой другой цвет')) + '</span><code>' + H(c || '—') + '</code></label>' +
        '<button type="button" class="xs-reset">↺ ' + H(L('Bu rangni olib tashlash', 'Remove this color', 'Убрать этот цвет')) + '</button>';
      return h;
    }
    function ckey() { return ctab === 'accent' ? 'theme' : ctab; }
    function cid() { return ctab === 'accent' ? 'c_custom' : ctab === 'nick' ? 'n_custom' : 'f_custom'; }
    function curColor() { return ctab === 'accent' ? D.accent : (D[ctab] ? D[ctab][slot] : null); }
    function putColor(hex) {
      if (ctab === 'accent') D.accent = hex;
      else { D[ctab] = D[ctab] || { a: null, b: null }; if (slot === 'b' && !D[ctab].a) D[ctab].a = hex; D[ctab][slot] = hex; }
      sel[ckey()] = cid(); // o'z rangi tanlansa — shu qism kiyiladi
    }
    function bindColors() {
      ov.querySelectorAll('[data-xs-ctab]').forEach(function (b) { b.onclick = function () { ctab = b.dataset.xsCtab; slot = 'a'; drawBody(); }; });
      ov.querySelectorAll('[data-xs-c]').forEach(function (b) { b.onclick = function () { if (!isHex(b.dataset.xsC)) return; putColor(b.dataset.xsC); try { SFX.click(); } catch (e) {} drawPrev(); drawBody(); drawFoot(); }; });
      ov.querySelectorAll('[data-xs-slot]').forEach(function (b) { b.onclick = function () { slot = b.dataset.xsSlot; drawBody(); }; });
      var c2 = ov.querySelector('[data-xs-clear2]'); if (c2) c2.onclick = function () { if (D[ctab]) D[ctab].b = null; slot = 'a'; drawPrev(); drawBody(); drawFoot(); };
      var inp = ov.querySelector('.xs-custom input');
      inp.oninput = function () { if (!isHex(inp.value)) return; putColor(inp.value); drawPrev(); drawFoot(); var code = ov.querySelector('.xs-custom code'); if (code) code.textContent = inp.value; };
      inp.onchange = function () { drawBody(); };
      ov.querySelector('.xs-reset').onclick = function () {
        if (ctab === 'accent') D.accent = null; else D[ctab] = null;
        if (sel[ckey()] === cid()) sel[ckey()] = null;
        drawPrev(); drawBody(); drawFoot();
      };
    }

    // ---------- Pastki qism: jamlanma narx ----------
    var shown = { coins: 0, gems: 0 };
    function animNum(node, from, to) {
      if (from === to || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { node.textContent = to; return; }
      var t0 = performance.now();
      (function f(now) { var p = Math.min(1, (now - t0) / 380); node.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
    }
    function drawFoot() {
      var ls = lines(), t = total();
      var okC = (S.coins || 0) >= t.coins, okG = gemsHave() >= t.gems, ch = changed() || ls.length;
      $('.xs-foot').innerHTML =
        (ls.length ? '<div class="xs-lines">' + ls.map(function (x) { return '<div><span>' + H(x[0]) + '</span><b>' + prTxt(x[1]) + '</b></div>'; }).join('') + '</div>' : '') +
        '<div class="xs-total"><span>' + H(L('Jami', 'Total', 'Итого')) + ' <small class="xs-n">' + (ls.length ? ls.length + ' ' + H(L('ta narsa', 'item(s)', 'шт.')) : '') + '</small></span><span class="xs-sum"><b class="xs-tc' + (okC ? '' : ' bad') + '">0</b> 🪙' +
          (t.gems ? ' + <b class="xs-tg' + (okG ? '' : ' bad') + '">0</b> 💎' : '') + '</span></div>' +
        '<div class="xs-bal">' + H(L('Balans', 'Balance', 'Баланс')) + ': ' + (S.coins || 0) + ' 🪙 · ' + gemsHave() + ' 💎</div>' +
        '<button type="button" class="xs-pay"' + ((!ch || !okC || !okG) ? ' disabled' : '') + '>' +
          (!ch ? H(L('Biror narsa tanlang', 'Pick something', 'Выберите что-нибудь'))
            : (!okC || !okG) ? H(L('Mablag\'', 'Funds', 'Средств')) + ' ' + H(L('yetarli emas', 'not enough', 'недостаточно'))
            : ls.length ? '💳 ' + H(L('To\'lash va qo\'llash', 'Pay & apply', 'Оплатить и применить')) : '✅ ' + H(L('Qo\'llash (bepul)', 'Apply (free)', 'Применить (бесплатно)'))) + '</button>' +
        (ls.length ? '<button type="button" class="xs-try">👀 ' + H(L('Sotib olmasdan sinab ko\'rish (' + TRY_SEC + ' s)', 'Try it on without buying (' + TRY_SEC + ' s)', 'Примерить без покупки (' + TRY_SEC + ' с)')) + '</button>' : '');
      var tc = $('.xs-tc'), tg = $('.xs-tg');
      if (tc) animNum(tc, shown.coins, t.coins);
      if (tg) animNum(tg, shown.gems, t.gems);
      shown = t;
      $('.xs-pay').onclick = pay;
      var tb = $('.xs-try'); if (tb) tb.onclick = tryOn;
    }
    // 👀 Sinab ko'rish: tanlovlar butun ilovada vaqtincha qo'llanadi (sotib olinmaydi), keyin avvalgi holat qaytadi
    function tryOn() {
      var bak = tryBackup(st, hasD);
      try { localStorage.setItem('ludTryBackup', JSON.stringify(bak)); } catch (e) {}
      window._ludTrying = true;
      ['theme', 'nick', 'frame', 'badge', 'title', 'effect', 'uistyle'].forEach(function (k) { st[k] = sel[k] || null; });
      st.ufx = sel.ufx.slice();
      st.custom = Object.assign({}, st.custom || {});
      if (sel.theme === 'c_custom' && D.accent) st.custom.accent = D.accent;
      if (sel.nick === 'n_custom' && D.nick && D.nick.a) st.custom.nick = { a: D.nick.a, b: D.nick.b || null };
      if (sel.frame === 'f_custom' && D.frame && D.frame.a) st.custom.frame = { a: D.frame.a, b: D.frame.b || null };
      if (hasD && sel.design && sel.design !== window.LUDesign.current()) { try { window.LUDesign.apply(sel.design, { force: true, silent: true }); } catch (e) {} }
      tryRefresh();
      ov.style.display = 'none';
      var left = TRY_SEC, bar = document.createElement('div'); bar.className = 'xs-trybar';
      bar.innerHTML = '<span>👀 ' + H(L('Sinov rejimi', 'Try-on mode', 'Примерка')) + ' · <b class="xs-try-t">' + left + '</b> s</span>' +
        '<button type="button" data-tr="buy">🛒 ' + H(L('Sotib olish', 'Buy', 'Купить')) + '</button><button type="button" data-tr="back">↩ ' + H(L('Qaytarish', 'Revert', 'Вернуть')) + '</button>';
      document.body.appendChild(bar);
      var timer = setInterval(function () { left--; var t = bar.querySelector('.xs-try-t'); if (t) t.textContent = left; if (left <= 0) end(false); }, 1000);
      function end(buy) {
        clearInterval(timer); bar.remove();
        tryRestore(st);
        if (!document.body.contains(ov)) return;
        ov.style.display = '';
        drawPrev(); drawFoot();
        if (buy) pay(); else toast('↩ ' + L('Avvalgi ko\'rinish qaytarildi', 'Reverted to your look', 'Возвращён прежний вид'));
      }
      bar.querySelector('[data-tr="buy"]').onclick = function () { end(true); };
      bar.querySelector('[data-tr="back"]').onclick = function () { end(false); };
      toast('👀 ' + L('Butun ilovada ko\'ring — ' + TRY_SEC + ' soniyadan keyin qaytadi', 'Look around the app — reverts in ' + TRY_SEC + ' s', 'Осмотритесь — вернётся через ' + TRY_SEC + ' с'));
    }
    function commit() {
      var ls = lines(), t = total();
      if ((S.coins || 0) < t.coins || gemsHave() < t.gems) return false;
      var title = '🛍 ' + L('Do\'kon studiyasi', 'Shop studio', 'Студия магазина');
      if (t.coins) addCoins(-t.coins, title);
      if (t.gems) gemsAdd(-t.gems, 'shop', title, true);
      ls.forEach(function (x) { if (x[2] && st.owned.indexOf(x[2]) === -1) st.owned.push(x[2]); });
      // O'z ranglari
      st.custom = st.custom || {};
      if (sel.theme === 'c_custom' && D.accent) { st.custom.accent = D.accent; if (!own('c_custom')) st.owned.push('c_custom'); }
      if (sel.nick === 'n_custom' && D.nick && D.nick.a) { st.custom.nick = { a: D.nick.a, b: D.nick.b || null }; if (!own('n_custom')) st.owned.push('n_custom'); }
      if (sel.frame === 'f_custom' && D.frame && D.frame.a) { st.custom.frame = { a: D.frame.a, b: D.frame.b || null }; if (!own('f_custom')) st.owned.push('f_custom'); }
      // Kiyish
      ['theme', 'nick', 'frame', 'badge', 'title', 'effect', 'uistyle'].forEach(function (k) { var id = sel[k]; st[k] = id && own(id) ? id : null; });
      st.ufx = sel.ufx.filter(own);
      save();
      if (hasD && sel.design && sel.design !== window.LUDesign.current()) { try { window.LUDesign.apply(sel.design); } catch (e) {} }
      try { shopApply(); render(); } catch (e) {}
      try { if (hasFx) window.LUFx.sync(); } catch (e) {}
      try { if (window.LUWidgets) window.LUWidgets.sync(); } catch (e) {}
      if (t.coins || t.gems) { try { SFX.coin(); confetti(); } catch (e) {} }
      renderHubSection('shop');
      toast(t.coins || t.gems ? '🛍 ' + L('Sotib olindi va qo\'llandi!', 'Purchased & applied!', 'Куплено и применено!') : '✅ ' + L('Qo\'llandi', 'Applied', 'Применено'));
      return true;
    }
    function pay() {
      var t = total();
      if (!t.coins && !t.gems) { if (commit()) close(); return; }
      var price = (t.coins ? t.coins + ' 🪙' : '') + (t.coins && t.gems ? ' + ' : '') + (t.gems ? t.gems + ' 💎' : '');
      var title = '🛍 ' + L('Do\'kon studiyasi', 'Shop studio', 'Студия магазина');
      if (window.LUWidgets && window.LUWidgets.active()) {
        window.LUWidgets.slideConfirm({ icon: '🛍', title: title, message: lines().length + ' ' + L('ta narsa', 'item(s)', 'шт.') + ' · ' + price,
          label: L('Surib to\'lang', 'Slide to pay', 'Сдвиньте для оплаты'), doneLabel: L('To\'landi', 'Paid', 'Оплачено'),
          errorLabel: L('Mablag\' yetarli emas', 'Not enough funds', 'Недостаточно средств'),
          onConfirm: function () { var ok = commit(); if (ok) setTimeout(close, 1150); return ok; } });
      } else if (confirm(title + ' — ' + price + '?')) { if (commit()) close(); }
    }
    drawPrev(); drawTabs(); drawBody(); drawFoot();
  };

  // ---------- 🏅 Yutuqlar devori (Achievements wall) ----------
  // Ta'riflar script.js dagi buildAllBadges() dan olinadi (id, icon, label, desc, group).
  // Daraja (tier) = id oxiridagi raqam (streak_3 → 3). Tanlov: S.achShowcase = [id...] (≤ 6).
  var ACH_MAX = 6;
  // Guruhlar ro'yxati script.js dagi getBadgeGroups() dan olinadi (yangi guruh qo'shilsa — tanlagichda ham chiqadi)
  function achGroups() {
    var out = [{ key: 'special', ico: '🌟', label: L('Maxsus', 'Special', 'Особые') }];
    try { (getBadgeGroups() || []).forEach(function (g) { out.push({ key: g.key, ico: g.ico, label: g.label() }); }); } catch (e) {}
    return out;
  }
  function achDefs() {
    var list = [];
    try { list = (typeof buildAllBadges === 'function' ? buildAllBadges() : []) || []; } catch (e) { list = []; }
    var map = {};
    // Daraja: buildAllBadges bergan tier (maxsus yutuqlarda 0 → 1-daraja ko'rinishi)
    list.forEach(function (b) { var tr = +b.tier || parseInt(String(b.id).split('_')[1], 10) || 1; b.tier = Math.max(1, Math.min(5, tr)); map[b.id] = b; });
    return { list: list, map: map };
  }
  function achEarned(b) {
    if (S.badgesUnlocked && S.badgesUnlocked[b.id] === true) return true;
    try { return !!b.check(S); } catch (e) { return false; }
  }
  // Foydalanuvchi hech tanlamagan bo'lsa: eng yuqori darajali 6 ta yutuq
  function achDefaultIds(defs) {
    return defs.list.filter(achEarned).map(function (b, i) { return { b: b, i: i }; })
      .sort(function (a, z) { return (z.b.tier - a.b.tier) || (a.i - z.i); })
      .slice(0, ACH_MAX).map(function (x) { return x.b.id; });
  }
  function achShowcaseIds(defs) {
    defs = defs || achDefs();
    if (!Array.isArray(S.achShowcase)) return achDefaultIds(defs);
    var out = [];
    S.achShowcase.forEach(function (id) {
      var b = typeof id === 'string' && defs.map[id];
      if (b && out.indexOf(id) === -1 && out.length < ACH_MAX && achEarned(b)) out.push(id);
    });
    return out;
  }
  function achGroupOf(k) { return achGroups().filter(function (g) { return g.key === k; })[0] || { key: k, ico: '', label: k }; }
  function achGroupName(g) { return achGroupOf(g).label; }
  function achBadgeHtml(b, cls) {
    var gn = achGroupName(b.group);
    return '<div class="x-aw-b x-aw-t' + b.tier + (cls ? ' ' + cls : '') + '" title="' + H(gn + ' — ' + b.desc) + '">' +
      '<span class="x-aw-g" aria-hidden="true">' + H(achGroupOf(b.group).ico) + '</span>' +
      '<span class="x-aw-i">' + H(b.icon) + '</span><span class="x-aw-n">' + H(b.label) + '</span>' +
      '<span class="x-aw-gn">' + H(gn) + '</span></div>';
  }
  var ACH_ALL_MAX = 80;
  function achEarnedIds(defs) {
    defs = defs || achDefs();
    return defs.list.filter(achEarned).map(function (b) { return String(b.id); }).slice(0, ACH_ALL_MAX);
  }
  // Bazadan kelgan id ro'yxatini tozalash: faqat ta'riflarda bor, takrorlanmagan satrlar
  function achCleanIds(arr, defs, max, seen) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    arr.slice(0, ACH_ALL_MAX * 2).forEach(function (id) {
      if (out.length >= max || typeof id !== 'string' || seen[id] || !Object.prototype.hasOwnProperty.call(defs.map, id)) return;
      seen[id] = 1; out.push(id);
    });
    return out;
  }
  // Boshqa foydalanuvchi uchun (cosmetics.ach / cosmetics.achAll) — faqat ma'lum id'lar, hammasi escape qilinadi
  function achWallParts(c) {
    var defs = achDefs(), seen = {};
    var ok = c && typeof c === 'object';
    var pins = ok ? achCleanIds(c.ach, defs, ACH_MAX, seen) : [];
    var rest = ok ? achCleanIds(c.achAll, defs, ACH_ALL_MAX, seen) : [];
    var idx = {}; defs.list.forEach(function (b, i) { idx[b.id] = i; });
    rest.sort(function (a, z) { return (defs.map[z].tier - defs.map[a].tier) || (idx[a] - idx[z]); });
    return { defs: defs, pins: pins, rest: rest, hasAll: !!(ok && Array.isArray(c.achAll)) };
  }
  window.xAchWallHtml = function (c) {
    try {
      var P = achWallParts(c);
      var html = P.pins.map(function (id) { return achBadgeHtml(P.defs.map[id], 'x-aw-pin'); }).join('') +
        P.rest.map(function (id) { return achBadgeHtml(P.defs.map[id]); }).join('');
      return html ? '<div class="x-aw-row">' + html + '</div>' : '';
    } catch (e) { return ''; }
  };
  // Profil modallari uchun tayyor bo'lim: ko'rgazmadagilar avval (ajratilgan), keyin qolganlari
  window.xAchWallSection = function (c) {
    try {
      var P = achWallParts(c), n = P.pins.length + P.rest.length, total = P.defs.list.length;
      var inner = window.xAchWallHtml(c);
      var cnt = total ? '<span class="x-aw-count">' + n + ' / ' + total + '</span>' : '';
      return '<div class="x-aw-sec"><div class="x-aw-sec-t"><span>🏅 ' + H(L('Yutuqlar', 'Achievements', 'Достижения')) + '</span>' + cnt + '</div>' +
        (inner || '<div class="x-aw-none">' + H(L('Hali yutuq yo\'q', 'No achievements yet', 'Пока нет достижений')) + '</div>') + '</div>';
    } catch (e) { return ''; }
  };
  // Yangi yutuq: vitrinada < 6 ta bo'lsa avtomatik qo'shamiz
  window.xAchOnEarned = function (id) {
    if (!Array.isArray(S.achShowcase)) return; // standart (avto) rejimda baribir ko'rinadi
    var cur = achShowcaseIds();
    if (cur.length < ACH_MAX && cur.indexOf(id) === -1) { cur.push(id); S.achShowcase = cur; }
  };
  window.xAchWallRender = safe(function () {
    var host = document.getElementById('x-achwall'); if (!host) return;
    var defs = achDefs(), ids = achShowcaseIds(defs);
    var earnedN = defs.list.filter(achEarned).length, total = defs.list.length;
    var cells = ids.map(function (id) { return achBadgeHtml(defs.map[id]); }).join('');
    if (earnedN) for (var i = ids.length; i < ACH_MAX; i++) cells += '<button type="button" class="x-aw-b x-aw-empty" onclick="xAchPicker()" aria-label="' + H(L('Yutuq tanlash', 'Choose achievement', 'Выбрать достижение')) + '">＋</button>';
    host.innerHTML =
      '<div class="x-aw-head"><div class="x-aw-hl"><div class="x-aw-title">🏅 ' + H(L('Yutuqlar devori', 'Achievements wall', 'Стена достижений')) + '</div>' +
      '<span class="x-aw-count">' + earnedN + ' / ' + total + ' ' + H(L('olingan', 'earned', 'получено')) + '</span></div>' +
      '<button type="button" class="x-btn sm ghost x-aw-choose" onclick="xAchPicker()"' + (earnedN ? '' : ' disabled') + '>✏️ ' + H(L('Tanlash', 'Choose', 'Выбрать')) + '</button></div>' +
      (earnedN ? '<div class="x-aw-grid">' + cells + '</div>'
        : '<div class="x-aw-hint">' + H(L('Birinchi yutug\'ingizni qo\'lga kiriting — u shu yerda do\'stlaringizga ko\'rinadi.', 'Earn your first achievement — it will be shown here for your friends to see.', 'Получите первое достижение — оно появится здесь, и его увидят друзья.')) + '</div>') +
      '<div class="x-aw-note">👀 ' + H(L('Do\'stlar va reytingda ko\'rinadi', 'Visible to friends and on the leaderboard', 'Видно друзьям и в рейтинге')) + '</div>';
  });
  window.xAchPicker = safe(function () {
    var defs = achDefs(), sel = achShowcaseIds(defs).slice(), groups = achGroups();
    var ov = xModal('<h3 class="x-h">🏅 ' + H(L('Vitrina uchun yutuqlar', 'Showcase achievements', 'Достижения для витрины')) + '</h3>' +
      '<div class="x-sub">' + H(L('6 tagacha olingan yutuqni tanlang. Qulflanganlarini tanlab bo\'lmaydi.', 'Pick up to 6 earned achievements. Locked ones can\'t be pinned.', 'Выберите до 6 полученных достижений. Закрытые выбрать нельзя.')) + '</div>' +
      '<div class="x-aw-pk"></div>' +
      '<div class="x-aw-foot"><span class="x-aw-sel"></span><button type="button" class="x-btn sm ghost x-aw-clear">' + H(L('Tozalash', 'Clear', 'Очистить')) + '</button>' +
      '<button type="button" class="x-btn sm x-aw-save">' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>', 'x-aw-box');
    var body = ov.querySelector('.x-aw-pk'), selEl = ov.querySelector('.x-aw-sel');
    function draw() {
      // Olinganlari bor guruhlar avval, keyin qolganlari
      var earnedIn = function (g) { return defs.list.some(function (b) { return b.group === g.key && achEarned(b); }); };
      body.innerHTML = groups.filter(earnedIn).concat(groups.filter(function (g) { return !earnedIn(g); })).map(function (g) {
        var items = defs.list.filter(function (b) { return b.group === g.key; });
        if (!items.length) return '';
        return '<div class="x-aw-pk-g">' + H(g.ico + ' ' + g.label) + '</div><div class="x-aw-pk-grid">' +
          items.map(function (b) {
            var ok = achEarned(b), on = sel.indexOf(b.id) !== -1;
            return '<button type="button" class="x-aw-b x-aw-t' + b.tier + (ok ? '' : ' locked') + (on ? ' on' : '') + '" data-id="' + H(b.id) + '"' +
              (ok ? ' aria-pressed="' + on + '"' : ' disabled') + ' title="' + H(b.desc) + '">' +
              '<span class="x-aw-i">' + (ok ? H(b.icon) : '🔒') + '</span><span class="x-aw-n">' + H(b.label) + '</span>' +
              (on ? '<span class="x-aw-no">' + (sel.indexOf(b.id) + 1) + '</span>' : '') + '</button>';
          }).join('') + '</div>';
      }).join('');
      selEl.textContent = sel.length + ' / ' + ACH_MAX;
    }
    body.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-id]'); if (!btn || btn.disabled) return;
      var id = btn.getAttribute('data-id'), k = sel.indexOf(id);
      if (k !== -1) sel.splice(k, 1);
      else if (sel.length >= ACH_MAX) { toast(L('Ko\'pi bilan 6 ta', 'Up to 6 only', 'Не больше 6')); return; }
      else sel.push(id);
      try { SFX.click(); } catch (e2) {}
      draw();
    });
    ov.querySelector('.x-aw-clear').onclick = function () { sel = []; draw(); };
    ov.querySelector('.x-aw-save').onclick = function () {
      S.achShowcase = sel.slice(0, ACH_MAX);
      save(); window.xAchWallRender(); ov._close();
      try { if (typeof scheduleCloudSync === 'function') scheduleCloudSync(true); } catch (e) {} // do'stlar yangi vitrinani darhol ko'rsin
      toast('✅ ' + L('Vitrina saqlandi', 'Showcase saved', 'Витрина сохранена'));
    };
    draw();
  });

  var shopApply = safe(function () {
    var st = shopState(), root = document.documentElement;
    try { if (window.LUDesign) window.LUDesign.enforce(); } catch (e) {} // sotib olinmagan dizayn qo'llanmasin
    try { if (window.LUFx) window.LUFx.sync(); } catch (e) {}
    try { if (window.LUWidgets) window.LUWidgets.sync(); } catch (e) {}
    var f = SHOP.find(function (x) { return x.id === st.frame; }), n = SHOP.find(function (x) { return x.id === st.nick; });
    if (f) root.setAttribute('data-x-frame', f.v); else root.removeAttribute('data-x-frame');
    var cu = st.custom || {};
    if (cu.frame && isHex(cu.frame.a)) { root.style.setProperty('--xcf1', cu.frame.a); root.style.setProperty('--xcf2', isHex(cu.frame.b) ? cu.frame.b : cu.frame.a); }
    if (cu.nick && isHex(cu.nick.a)) { root.style.setProperty('--xcn1', cu.nick.a); root.style.setProperty('--xcn2', isHex(cu.nick.b) ? cu.nick.b : cu.nick.a); }
    if (n) root.setAttribute('data-x-nick', n.v); else root.removeAttribute('data-x-nick');
    var th = SHOP.find(function (x) { return x.id === st.theme; });
    if (th) { root.style.setProperty('--accent', th.v); root.style.setProperty('--accent-glow', th.v + '33'); root.setAttribute('data-x-theme', th.id); }
    else if (root.getAttribute('data-x-theme')) { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-glow'); root.removeAttribute('data-x-theme'); }
    var ui = SHOP.find(function (x) { return x.id === st.uistyle && x.kind === 'uistyle'; });
    if (ui && ui.v !== 'classic' && st.owned.indexOf(ui.id) !== -1) root.setAttribute('data-x-ui', ui.v); else root.removeAttribute('data-x-ui');
    var bd = SHOP.find(function (x) { return x.id === st.badge; });
    if (bd) root.setAttribute('data-x-badge', bd.v); else root.removeAttribute('data-x-badge');
    ['user-title', 'profile-name-big'].forEach(function (id) {
      var el0 = document.getElementById(id); if (!el0) return;
      var bEl = el0.parentNode && el0.parentNode.querySelector('.x-nbadge[data-for="' + id + '"]');
      if (bd) {
        if (!bEl) { bEl = document.createElement('span'); bEl.className = 'x-nbadge'; bEl.setAttribute('data-for', id); el0.insertAdjacentElement('afterend', bEl); }
        bEl.textContent = bd.v;
      } else if (bEl) bEl.remove();
    });
    var tt = shopTitleText();
    var host = document.getElementById('profile-header-text');
    var el = document.getElementById('x-profile-title');
    if (host && tt) {
      if (!el) { el = document.createElement('div'); el.id = 'x-profile-title'; el.className = 'x-ptitle'; var nm = document.getElementById('profile-name-big'); if (nm && nm.nextSibling) host.insertBefore(el, nm.nextSibling); else host.appendChild(el); }
      el.textContent = tt;
    } else if (el) el.remove();
  });
  function shopHtml() {
    var st = shopState();
    var groups = [['frame', '🖼 ' + L('Avatar ramkalari', 'Avatar frames', 'Рамки аватара')], ['nick', '✏️ ' + L('Nik rangi', 'Nickname color', 'Цвет ника')],
      ['badge', '🏅 ' + L('Nik yonidagi nishon', 'Nickname badge', 'Значок у ника')], ['title', '🏷 ' + L('Unvonlar', 'Titles', 'Титулы')],
      ['theme', '🎨 ' + L('Ilova rangi', 'App color', 'Цвет приложения')], ['effect', '🎉 ' + L('Bajarilganda effekt', 'Task-done effect', 'Эффект выполнения')],
      ['uistyle', '🧩 ' + L('Interfeys uslubi', 'UI style', 'Стиль интерфейса')]];
    var h = '<div class="x-shop-bal"><span>🪙 <b>' + (S.coins || 0) + '</b></span><span>💎 <b>' + (S.gems || 0) + '</b></span></div>';
    h += '<button type="button" class="xs-open" data-studio-open="1"><span class="xs-open-sw" aria-hidden="true"></span><span class="xs-open-t"><b>🛍 ' + H(L('Do\'kon studiyasi', 'Shop studio', 'Студия магазина')) + ' <span class="xs-sale">−40%</span></b>' +
      '<span>' + H(L('Hammasi bitta oynada: ranglar, fonlar, effektlar, ramka, nik, nishon, unvon. Narx pastda jamlanadi, oxirida to\'laysiz', 'Everything in one window: colors, backgrounds, effects, frames, nicknames, badges, titles. Total adds up below, pay at the end', 'Всё в одном окне: цвета, фоны, эффекты, рамки, ники, значки, титулы. Итог внизу, оплата в конце')) + '</span></span><span class="xs-open-go">›</span></button>';
    // Bo'limlarga tez o'tish
    h += '<div class="x-shop-cats">' + [['design', '🎨 ' + L('Dizaynlar', 'Designs', 'Дизайны')], ['ufx', '✨ ' + L('Effektlar', 'Effects', 'Эффекты')]].concat(groups.map(function (g) { return [g[0], g[1]]; }))
      .map(function (g) { return '<button type="button" data-shop-cat="' + g[0] + '">' + H(g[1]) + '</button>'; }).join('') + '</div>';
    // 🎨 Dizaynlar (bepullari ham ko'rsatiladi)
    var curD = window.LUDesign ? window.LUDesign.current() : 'default';
    h += '<div class="x-sec-t" id="x-shop-sec-design">🎨 ' + L('Dizaynlar', 'Designs', 'Дизайны') + '</div><div class="x-shop-grid">';
    (window.LUDesign ? window.LUDesign.catalog() : []).forEach(function (d) {
      var own = window.LUDesign.isOwned(d.id), on = curD === d.id, sid = 'd_' + d.id;
      var lbl = on ? '✅ ' + L('Qo\'llangan', 'Applied', 'Применён') : own ? (d.price ? '' : L('Bepul', 'Free', 'Бесплатно') + ' · ') + L('Qo\'llash', 'Apply', 'Применить')
        : (giftLevelOf(sid) ? '🎁 Lv ' + giftLevelOf(sid) + ' · ' : '') + (d.price.gems ? d.price.gems + ' 💎' : d.price.coins + ' 🪙');
      h += '<button class="x-shop-it x-shop-dz ' + (on ? 'on' : own ? 'own' : '') + '" ' + (own ? 'data-dz-apply="' + d.id + '"' : 'data-shop="' + sid + '"') + ' data-shop-item="' + sid + '">' +
        '<span class="dz-prev dz-prev-' + d.id + '"><span class="dz-prev-in"></span>' + (own ? '' : '<span class="dz-lock">🔒</span>') + '</span>' +
        '<div class="x-shop-n">' + H(L(d.n[0], d.n[1], d.n[2])) + '</div><div class="x-shop-p">' + lbl + '</div></button>';
    });
    h += '</div>';
    // ✨ UI effektlar
    h += '<div class="x-sec-t" id="x-shop-sec-ufx">✨ ' + L('UI effektlar', 'UI effects', 'UI-эффекты') + '</div><div class="x-shop-grid">';
    var ufxOn = Array.isArray(st.ufx) ? st.ufx : [];
    SHOP.filter(function (x) { return x.kind === 'ufx'; }).forEach(function (it) {
      var own = st.owned.indexOf(it.id) !== -1, on = own && ufxOn.indexOf(it.id) !== -1;
      h += '<button class="x-shop-it ' + (on ? 'on' : own ? 'own' : '') + '" data-shop="' + it.id + '" data-shop-item="' + it.id + '">' +
        (window.LUFx ? window.LUFx.previewHtml(it.v) : '') +
        '<div class="x-shop-n">' + H(L(it.n[0], it.n[1], it.n[2])) + '</div>' +
        (it.desktop ? '<div class="x-shop-note">🖱 ' + L('Faqat kompyuterda', 'Desktop only', 'Только ПК') + '</div>' : '') +
        '<div class="x-shop-p">' + (on ? '✅ ' + L('Yoqilgan', 'On', 'Вкл') : own ? L('Yoqish', 'Turn on', 'Включить') : (giftLevelOf(it.id) ? '🎁 Lv ' + giftLevelOf(it.id) + ' · ' : '') + (it.gems ? it.gems + ' 💎' : it.coins + ' 🪙')) + '</div></button>';
    });
    h += '</div>';
    groups.forEach(function (g) {
      h += '<div class="x-sec-t" id="x-shop-sec-' + g[0] + '">' + g[1] + '</div><div class="x-shop-grid">';
      SHOP.filter(function (x) { return x.kind === g[0] && !x.hidden; }).forEach(function (it) {
        var own = st.owned.indexOf(it.id) !== -1, on = st[it.kind] === it.id;
        var prev = it.kind === 'frame' ? '<div class="x-shop-av xf-' + it.v + '">' + H((getDisplayUsername() || '?').charAt(0).toUpperCase()) + '</div>'
          : it.kind === 'nick' ? '<div class="x-shop-nk xn-' + it.v + '">' + H(getDisplayUsername() || 'Nick') + '</div>'
          : it.kind === 'theme' ? '<div class="x-shop-th" style="--tc:' + it.v + '"><i></i><i></i><i></i></div>'
          : it.kind === 'effect' ? '<div class="x-shop-fx" data-fx="' + it.id + '">' + it.v + '</div>'
          : it.kind === 'badge' ? '<div class="x-shop-nk">' + H(getDisplayUsername() || 'Nick') + ' ' + it.v + '</div>'
          : it.kind === 'uistyle' ? '<div class="x-shop-ui uip-' + it.v + '"><i></i><i></i><i></i></div>'
          : '<div class="x-shop-tt">' + L(it.tv[0], it.tv[1], it.tv[2]) + '</div>';
        h += '<button class="x-shop-it ' + (on ? 'on' : own ? 'own' : '') + '" data-shop="' + it.id + '" data-shop-item="' + it.id + '">' + prev +
          '<div class="x-shop-n">' + L(it.n[0], it.n[1], it.n[2]).replace(/^[^:]+:\s*/, '') + '</div>' +
          (it.d ? '<div class="x-shop-note">' + H(L(it.d[0], it.d[1], it.d[2])) + '</div>' : '') +
          '<div class="x-shop-p">' + (it.kind === 'uistyle'
            ? (on ? '✅ ' + L('Yoqilgan', 'On', 'Вкл') : own ? L('Yoqish', 'Turn on', 'Включить') : (it.gems ? it.gems + ' 💎' : it.coins + ' 🪙'))
            : (on ? '✅ ' + L('Kiyilgan', 'Equipped', 'Надето') : own ? L('Kiyish', 'Equip', 'Надеть') : (giftLevelOf(it.id) ? '🎁 Lv ' + giftLevelOf(it.id) + ' · ' : '') + (it.gems ? it.gems + ' 💎' : it.coins + ' 🪙'))) + '</div></button>';
      });
      h += '</div>';
    });
    return h;
  }

  // =========================================================
  // 🔥 5. YILLIK FAOLLIK XARITASI · ⏰ 11. ENG SAMARALI VAQT · 🔗 10. BOG'LIQLIK
  // =========================================================
  function heatmapHtml() {
    var log = S.weekDoneLog || {};
    var end = new Date(); end.setHours(0, 0, 0, 0);
    var start = new Date(end); start.setDate(start.getDate() - 7 * 52 - ((end.getDay() + 6) % 7));
    var cols = [], d = new Date(start), total = 0, active = 0, best = 0, monthsLbl = [], lastM = -1;
    var mArr = monthsArr();
    while (d <= end) {
      var col = [];
      for (var i = 0; i < 7; i++) {
        var k = dkey(d), v = d <= end ? (log[k] || 0) : -1;
        if (v > 0) { total += v; active++; best = Math.max(best, v); }
        col.push({ k: k, v: v });
        d.setDate(d.getDate() + 1);
      }
      var m = parseD(col[0].k).getMonth();
      monthsLbl.push(m !== lastM ? String(mArr[m]).slice(0, 3) : ''); lastM = m;
      cols.push(col);
    }
    var lvl = function (v) { if (v <= 0) return 0; if (best <= 4) return Math.min(4, v); var r = v / best; return r > .75 ? 4 : r > .5 ? 3 : r > .25 ? 2 : 1; };
    var h = '<div class="x-hm-sum"><span><b>' + total + '</b> ' + L('vazifa / yil', 'tasks / year', 'задач / год') + '</span><span><b>' + active + '</b> ' + L('faol kun', 'active days', 'активных дней') + '</span><span><b>' + longestRun(log) + '</b> ' + L('eng uzun seriya', 'longest run', 'макс. серия') + '</span></div>';
    h += '<div class="x-hm-wrap"><div class="x-hm-days">' + weekdaysShort().map(function (w, i) { return '<span>' + (i % 2 === 0 ? w : '') + '</span>'; }).join('') + '</div><div class="x-hm-scroll"><div class="x-hm-months">' +
      monthsLbl.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div><div class="x-hm">';
    cols.forEach(function (c) {
      h += '<div class="x-hm-c">' + c.map(function (x) { return x.v < 0 ? '<i class="x-hm-x"></i>' : '<i class="l' + lvl(x.v) + '" title="' + x.k + ': ' + x.v + '"></i>'; }).join('') + '</div>';
    });
    h += '</div></div></div><div class="x-hm-leg">' + L('Kam', 'Less', 'Меньше') + ' <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> ' + L('Ko\'p', 'More', 'Больше') + '</div>';
    return h;
  }
  function longestRun(log) {
    var keys = Object.keys(log).filter(function (k) { return log[k] > 0; }).sort();
    var best = 0, run = 0, prev = null;
    keys.forEach(function (k) { run = (prev && addDays(prev, 1) === k) ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return best;
  }
  function bars(vals, labels, hiIdx, unit) {
    var mx = Math.max.apply(null, vals.concat([1]));
    return '<div class="x-bars">' + vals.map(function (v, i) {
      return '<div class="x-bar' + (i === hiIdx ? ' hi' : '') + '" title="' + labels[i] + ': ' + v + (unit || '') + '"><i style="height:' + Math.max(2, v / mx * 100) + '%"></i><span>' + labels[i] + '</span></div>';
    }).join('') + '</div>';
  }
  function productiveHtml() {
    var hl = S.taskDoneHourLog || {}, hv = [], i;
    for (i = 0; i < 24; i++) hv.push(hl[i] || 0);
    var pm = [], logs = []; for (i = 0; i < 24; i++) pm.push(0);
    try { logs = JSON.parse(localStorage.getItem('pomoLogs') || '[]') || []; } catch (e) {}
    var cut = Date.now() - 60 * 864e5;
    logs.forEach(function (l) { if (!l || !l.startAt || l.startAt < cut) return; pm[new Date(l.startAt).getHours()] += Math.round((l.durationMs || 0) / 60000); });
    var score = hv.map(function (v, k) { return v * 10 + pm[k]; });
    var bestH = score.indexOf(Math.max.apply(null, score));
    var log = S.weekDoneLog || {}, wd = [0, 0, 0, 0, 0, 0, 0], wc = [0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < 56; i++) { var k2 = addDays(today(), -i), w = (parseD(k2).getDay() + 6) % 7; wd[w] += log[k2] || 0; wc[w]++; }
    var wavg = wd.map(function (v, j) { return Math.round(v / Math.max(1, wc[j]) * 10) / 10; });
    var bestW = wavg.indexOf(Math.max.apply(null, wavg)), worstW = wavg.indexOf(Math.min.apply(null, wavg));
    var totalH = hv.reduce(function (a, b) { return a + b; }, 0);
    var hLbl = []; for (i = 0; i < 24; i++) hLbl.push(i % 3 === 0 ? String(i) : '');
    var emo = bestH >= 5 && bestH < 9 ? '🌅' : bestH < 12 ? '☀️' : bestH < 17 ? '🌤' : bestH < 21 ? '🌆' : '🌙';
    var h = '';
    if (!totalH && !pm.some(Boolean)) return '<div class="x-empty">' + L('Hali ma\'lumot kam — bir necha kun vazifa bajaring.', 'Not enough data yet — complete tasks for a few days.', 'Пока мало данных.') + '</div>';
    h += '<div class="x-insight big">' + emo + ' ' + L('Eng samarali vaqting', 'Your most productive time', 'Самое продуктивное время') + ': <b>' + pad2(bestH) + ':00–' + pad2((bestH + 1) % 24) + ':00</b><div class="x-sub">' +
      L('Qiyin vazifalarni shu vaqtga qo\'ying.', 'Schedule hard tasks for this time.', 'Ставьте сложные задачи на это время.') + '</div></div>';
    h += '<div class="x-sec-t">🕐 ' + L('Soatlar bo\'yicha bajarilgan vazifalar', 'Tasks completed by hour', 'Задачи по часам') + '</div>' + bars(hv, hLbl, bestH);
    if (pm.some(Boolean)) h += '<div class="x-sec-t">🍅 ' + L('Pomodoro daqiqalari (60 kun)', 'Pomodoro minutes (60 days)', 'Минуты Pomodoro (60 дней)') + '</div>' + bars(pm, hLbl, pm.indexOf(Math.max.apply(null, pm)), ' min');
    h += '<div class="x-sec-t">📆 ' + L('Hafta kunlari (o\'rtacha, 8 hafta)', 'Weekdays (avg, 8 weeks)', 'Дни недели (среднее, 8 недель)') + '</div>' + bars(wavg, weekdaysShort(), bestW);
    if (wavg[bestW] > 0) h += '<div class="x-insight">💪 ' + L('Eng kuchli kuning', 'Strongest day', 'Самый сильный день') + ': <b>' + weekdaysShort()[bestW] + '</b> (' + wavg[bestW] + ')' +
      (bestW !== worstW ? ' · 😴 ' + L('eng sust', 'weakest', 'самый слабый') + ': <b>' + weekdaysShort()[worstW] + '</b> (' + wavg[worstW] + ')' : '') + '</div>';
    return h;
  }
  function correlationHtml() {
    var log = S.taskDoneLog || {}, wl = S.weekDoneLog || {};
    var days = []; for (var i = 1; i <= 60; i++) { var d = addDays(today(), -i); if ((wl[d] || 0) > 0) days.push(d); }
    var tasks = (S.tasks || []).filter(function (t) { return t.repeat !== 'once' && !t.isFrozen && (log[t.id] || []).length >= 3; });
    var sets = {}; tasks.forEach(function (t) { var o = {}; (log[t.id] || []).forEach(function (x) { o[x] = 1; }); sets[t.id] = o; });
    var dueOn = function (t, ds) {
      if (t.repeat === 'daily') return true;
      if (t.repeat === 'custom-days' && Array.isArray(t.days)) { var wd = parseD(ds).getDay(); return t.days.indexOf(wd) !== -1 || t.days.indexOf(String(wd)) !== -1; }
      return true;
    };
    var res = [];
    tasks.forEach(function (A) {
      tasks.forEach(function (B) {
        if (A.id === B.id) return;
        var a1 = 0, a1b = 0, a0 = 0, a0b = 0;
        days.forEach(function (ds) {
          if (!dueOn(B, ds) || !dueOn(A, ds)) return;
          if (sets[A.id][ds]) { a1++; if (sets[B.id][ds]) a1b++; } else { a0++; if (sets[B.id][ds]) a0b++; }
        });
        if (a1 < 4 || a0 < 3) return;
        var p1 = a1b / a1, p0 = a0b / a0, lift = p1 - p0;
        if (lift >= 0.2) res.push({ A: A, B: B, p1: p1, p0: p0, lift: lift });
      });
    });
    res.sort(function (x, y) { return y.lift - x.lift; });
    var seen = {}, out = [];
    res.forEach(function (r) { var k = [r.A.id, r.B.id].sort().join('-'); if (seen[k] || out.length >= 4) return; seen[k] = 1; out.push(r); });
    var h = '';
    if (!days.length || !out.length) {
      h += '<div class="x-empty">🔍 ' + (days.length < 14
        ? L('Bog\'liqlikni topish uchun kamida 2 hafta takrorlanuvchi vazifalar tarixi kerak.', 'At least 2 weeks of recurring task history is needed.', 'Нужно минимум 2 недели истории.')
        : L('Hozircha kuchli bog\'liqlik topilmadi.', 'No strong links found yet.', 'Сильных связей пока не найдено.')) + '</div>';
    }
    out.forEach(function (r) {
      h += '<div class="x-corr"><div class="x-corr-t">' + (r.A.emoji || '✅') + ' <b>' + H(r.A.name) + '</b> → ' + (r.B.emoji || '✅') + ' <b>' + H(r.B.name) + '</b></div>' +
        '<div class="x-sub">' + L('«{a}» bajargan kunlaringda «{b}» ni bajarish ehtimoli {p1}% (bajarmagan kunlari {p0}%).', 'On days you do «{a}», you complete «{b}» {p1}% of the time (vs {p0}% otherwise).', 'В дни, когда вы делаете «{a}», «{b}» выполняется в {p1}% случаев (иначе {p0}%).')
          .replace('{a}', H(r.A.name)).replace('{b}', H(r.B.name)).replace('{p1}', Math.round(r.p1 * 100)).replace('{p0}', Math.round(r.p0 * 100)) + '</div>' +
        '<div class="x-corr-bar"><i style="width:' + Math.round(r.p1 * 100) + '%"></i><em style="width:' + Math.round(r.p0 * 100) + '%"></em></div></div>';
    });
    // kayfiyat va uyqu bilan bog'liqlik (ma'lumot bo'lsa)
    var hs = S.health || {}, good = [], bad = [];
    days.forEach(function (ds) { var sl = hs[ds] && hs[ds].sleep; if (sl == null) return; (sl >= 7 ? good : bad).push(wl[ds] || 0); });
    if (good.length >= 3 && bad.length >= 3) {
      var avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
      var g = avg(good), b = avg(bad);
      h += '<div class="x-insight">😴 ' + L('7+ soat uxlagan kunlaringda o\'rtacha', 'On 7h+ sleep days you complete', 'В дни со сном 7+ ч вы делаете') + ' <b>' + g.toFixed(1) + '</b> ' + L('ta vazifa, kam uxlaganda', 'tasks on average, vs', 'задач, при недосыпе') + ' <b>' + b.toFixed(1) + '</b>.</div>';
    }
    return h;
  }

  // =========================================================
  // 📅 12. OYLIK YAKUN (Wrapped)
  // =========================================================
  function monthStats(ym) {
    var log = S.weekDoneLog || {}, tl = S.taskDoneLog || {};
    var tasks = 0, active = 0, bestDay = null, bestV = 0;
    Object.keys(log).forEach(function (k) { if (k.slice(0, 7) !== ym) return; var v = log[k] || 0; tasks += v; if (v > 0) active++; if (v > bestV) { bestV = v; bestDay = k; } });
    var coins = 0; (S.tarix || []).forEach(function (r) { if (r && r.date && r.date.slice(0, 7) === ym && r.type === 'in' && r.amount > 0) coins += r.amount; });
    var pomoMin = 0; try { (JSON.parse(localStorage.getItem('pomoLogs') || '[]') || []).forEach(function (l) { if (l && l.date && String(l.date).slice(0, 7) === ym) pomoMin += Math.round((l.durationMs || 0) / 60000); }); } catch (e) {}
    var top = (S.tasks || []).map(function (t) { return { t: t, n: (tl[t.id] || []).filter(function (d) { return d.slice(0, 7) === ym; }).length }; })
      .filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 3);
    var bosses = (S.bossHistory || []).filter(function (b) { return b.won && b.week && b.week.slice(0, 7) === ym; }).length +
      ((S.xBoss && S.xBoss.history) || []).filter(function (b) { return b.won && b.date && b.date.slice(0, 7) === ym; }).length;
    var focus = 0; Object.keys(S.focusLog || {}).forEach(function (k) { if (k.slice(0, 7) === ym) focus += S.focusLog[k] || 0; });
    var mood = null; try { var ms = (typeof getMoods === 'function' ? getMoods() : S.moods) || {}; var cnt = {}; Object.keys(ms).forEach(function (k) { if (k.slice(0, 7) === ym) { var m = ms[k] && (ms[k].emoji || ms[k].mood || ms[k]); if (typeof m === 'string' && m.length <= 4) cnt[m] = (cnt[m] || 0) + 1; } }); var mk = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0]; if (mk) mood = mk; } catch (e) {}
    return { ym: ym, tasks: tasks, active: active, bestDay: bestDay, bestV: bestV, coins: coins, pomoMin: pomoMin, top: top, bosses: bosses, focus: focus, mood: mood };
  }
  function ymShift(ym, n) { var d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function ymLabel(ym) { return monthsArr()[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
  function openWrap(ym) {
    ym = ym || ymShift(today().slice(0, 7), new Date().getDate() <= 5 ? -1 : 0);
    var old = document.querySelector('.x-ov.x-wrap'); var keep = !!old; if (old) old.remove();
    var s = monthStats(ym), p = monthStats(ymShift(ym, -1));
    var diff = p.tasks ? Math.round((s.tasks - p.tasks) / p.tasks * 100) : null;
    var dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
    var nick = getDisplayUsername() || '';
    var card = '<div class="x-wrap-card" id="x-wrap-card"><div class="x-wrap-top"><span>📅 ' + ymLabel(ym) + '</span><b>' + H(nick) + '</b></div>' +
      '<div class="x-wrap-hero"><div class="x-wrap-big">' + s.tasks + '</div><div>' + L('ta vazifa bajarildi', 'tasks completed', 'задач выполнено') +
      (diff != null ? ' <em class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '▲' : '▼') + Math.abs(diff) + '%</em>' : '') + '</div></div>' +
      '<div class="x-wrap-grid">' +
      '<div><b>' + s.active + '/' + dim + '</b><span>📆 ' + L('faol kun', 'active days', 'активных дней') + '</span></div>' +
      '<div><b>+' + s.coins + '</b><span>🪙 ' + L('tanga', 'coins', 'монет') + '</span></div>' +
      '<div><b>' + (s.pomoMin >= 60 ? Math.round(s.pomoMin / 6) / 10 + 'h' : s.pomoMin + 'm') + '</b><span>🍅 Pomodoro</span></div>' +
      '<div><b>' + (s.bestV || 0) + '</b><span>🚀 ' + L('eng zo\'r kun', 'best day', 'лучший день') + (s.bestDay ? ' · ' + parseD(s.bestDay).getDate() : '') + '</span></div>' +
      '<div><b>' + s.bosses + '</b><span>🐉 ' + L('boss yengildi', 'bosses beaten', 'боссов') + '</span></div>' +
      '<div><b>' + (s.focus >= 60 ? Math.round(s.focus / 6) / 10 + 'h' : s.focus + 'm') + '</b><span>🎯 ' + L('fokus', 'focus', 'фокус') + '</span></div>' +
      '</div>' +
      (s.top.length ? '<div class="x-wrap-top3"><div class="x-wrap-lbl">🏅 ' + L('Eng ko\'p bajarilganlar', 'Top habits', 'Топ привычек') + '</div>' + s.top.map(function (x, i) {
        return '<div><span>' + ['🥇', '🥈', '🥉'][i] + ' ' + (x.t.emoji || '') + ' ' + H(x.t.name) + '</span><b>×' + x.n + '</b></div>';
      }).join('') + '</div>' : '') +
      (s.mood ? '<div class="x-wrap-foot">' + L('Oyning kayfiyati', 'Mood of the month', 'Настроение месяца') + ': ' + s.mood + '</div>' : '') +
      '<div class="x-wrap-brand">LevelUpDay · levelupday.github.io/LevelUpDay</div></div>';
    var html = '<div class="x-wrap-nav"><button class="x-btn ghost sm" id="x-wr-prev">‹</button><b>' + ymLabel(ym) + '</b><button class="x-btn ghost sm" id="x-wr-next" ' + (ym >= today().slice(0, 7) ? 'disabled' : '') + '>›</button></div>' + card +
      '<div class="x-row"><button class="x-btn" id="x-wr-save">📸 ' + L('Rasm qilib saqlash', 'Save as image', 'Сохранить картинку') + '</button>' +
      '<button class="x-btn ghost" id="x-wr-share">📰 ' + L('Lentaga ulashish', 'Share to feed', 'В ленту') + '</button></div>';
    var ov = xModal(html, 'x-wrap-box'); ov.classList.add('x-wrap'); if (keep) ov.classList.add('open');
    ov.querySelector('#x-wr-prev').onclick = function () { openWrap(ymShift(ym, -1)); };
    ov.querySelector('#x-wr-next').onclick = function () { openWrap(ymShift(ym, 1)); };
    ov.querySelector('#x-wr-save').onclick = function () { wrapImage(s, nick, diff, dim); };
    ov.querySelector('#x-wr-share').onclick = function () {
      feedPost('wrap', ymLabel(ym) + ': ' + s.tasks + ' ' + L('ta vazifa', 'tasks', 'задач') + ', ' + s.active + ' ' + L('faol kun', 'active days', 'активных дней') + ', +' + s.coins + ' 🪙', '📅', true);
    };
  }
  function wrapImage(s, nick, diff, dim) {
    var c = document.createElement('canvas'), W = 1080, Hh = 1350; c.width = W; c.height = Hh;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, '#2b1a6b'); g.addColorStop(.55, '#7c5cfc'); g.addColorStop(1, '#f472b6');
    x.fillStyle = g; x.fillRect(0, 0, W, Hh);
    x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.arc(940, 160, 260, 0, 7); x.fill(); x.beginPath(); x.arc(120, 1200, 220, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.textBaseline = 'top';
    var F = function (sz, w) { x.font = (w || 700) + ' ' + sz + 'px "DM Sans", system-ui, sans-serif'; };
    F(44, 600); x.globalAlpha = .85; x.fillText('📅 ' + ymLabel(s.ym), 80, 80); x.fillText(nick, 80, 140); x.globalAlpha = 1;
    F(220, 800); x.fillText(String(s.tasks), 80, 230);
    F(52, 600); x.fillText(L('ta vazifa bajarildi', 'tasks completed', 'задач выполнено') + (diff != null ? '  ' + (diff >= 0 ? '▲' : '▼') + Math.abs(diff) + '%' : ''), 84, 470);
    var cells = [[s.active + '/' + dim, '📆 ' + L('faol kun', 'active days', 'активных дней')], ['+' + s.coins, '🪙 ' + L('tanga', 'coins', 'монет')],
      [(s.pomoMin >= 60 ? Math.round(s.pomoMin / 6) / 10 + 'h' : s.pomoMin + 'm'), '🍅 Pomodoro'], [String(s.bestV || 0), '🚀 ' + L('eng zo\'r kun', 'best day', 'лучший день')]];
    cells.forEach(function (cc, i) {
      var cx = 80 + (i % 2) * 470, cy = 590 + Math.floor(i / 2) * 200;
      x.fillStyle = 'rgba(255,255,255,0.14)'; roundRect(x, cx, cy, 440, 170, 28); x.fill();
      x.fillStyle = '#fff'; F(80, 800); x.fillText(cc[0], cx + 32, cy + 22); F(36, 500); x.fillText(cc[1], cx + 32, cy + 112);
    });
    var y = 1010; F(40, 700);
    s.top.forEach(function (t, i) { x.fillText(['🥇', '🥈', '🥉'][i] + ' ' + String(t.t.name).slice(0, 26) + '  ×' + t.n, 80, y); y += 62; });
    F(30, 500); x.globalAlpha = .75; x.fillText('LevelUpDay · levelupday.github.io/LevelUpDay', 80, Hh - 70); x.globalAlpha = 1;
    c.toBlob(function (blob) {
      if (!blob) return;
      var file = new File([blob], 'levelupday-' + s.ym + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'LevelUpDay ' + ymLabel(s.ym) }).catch(function () {}); return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('📸 ' + L('Rasm saqlandi', 'Image saved', 'Изображение сохранено'));
    }, 'image/png');
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  var maybeShowWrap = safe(function () {
    var d = new Date(); if (d.getDate() > 3) return;
    var prev = ymShift(today().slice(0, 7), -1);
    if (S.xWrapShown === prev) return;
    if (monthStats(prev).tasks < 1) return;
    S.xWrapShown = prev; save();
    setTimeout(function () { if (!document.querySelector('.modal-overlay.open,.x-ov')) openWrap(prev); }, 3500);
  });

  // =========================================================
  // 🎯 14. FOKUS REJIMI
  // =========================================================
  var FX = null;
  function focusPickTask() {
    var open = todaysOpenTasks(), nm = nowMin();
    var cur = open.find(function (t) { var a = hm2m(t.startTime), b = t.endTime ? hm2m(t.endTime) : a + 60; return a != null && nm >= a && nm < b; });
    return cur || open.find(function (t) { return t.quad === 1; }) || open.find(function (t) { return t.pinned; }) || open[0] || null;
  }
  function openFocus(taskId, autoStart, minutes) {
    if (FX) return;
    var open = todaysOpenTasks();
    var tk = taskId ? S.tasks.find(function (t) { return t.id === taskId; }) : focusPickTask();
    if (tk && open.indexOf(tk) === -1) open.unshift(tk);
    var ov = document.createElement('div'); ov.className = 'x-focus';
    ov.innerHTML = '<div class="x-fc-in"><div class="x-fc-top"><span>🎯 ' + L('Fokus rejimi', 'Focus mode', 'Режим фокуса') + '</span><button class="x-fc-x" title="Esc">✕</button></div>' +
      '<select class="x-fc-sel">' + '<option value="">— ' + L('Vazifasiz', 'No task', 'Без задачи') + ' —</option>' + open.map(function (t) { return '<option value="' + t.id + '"' + (tk && tk.id === t.id ? ' selected' : '') + '>' + H((t.emoji ? t.emoji + ' ' : '') + t.name + (t.startTime ? ' · ' + t.startTime : '')) + '</option>'; }).join('') + '</select>' +
      '<div class="x-fc-task"></div>' +
      '<div class="x-fc-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="bg"/><circle cx="60" cy="60" r="54" class="fg"/></svg><div class="x-fc-time">25:00</div><div class="x-fc-ph"></div></div>' +
      (window.LUBlocks ? window.LUBlocks.focusLiveHtml() : '') +
      '<div class="x-fc-presets"><button data-m="25">25m</button><button data-m="50">50m</button><button data-m="90">90m</button><button data-m="block" class="blk">' + L('Blok oxirigacha', 'Until block end', 'До конца блока') + '</button></div>' +
      '<div class="x-fc-ctrl"><button class="x-fc-play">▶</button><button class="x-fc-reset">↺</button></div>' +
      '<div class="x-fc-act"><button class="x-fc-done">✅ ' + L('Bajarildi', 'Done', 'Готово') + '</button><button class="x-fc-snd">🎵 ' + L('Tovushlar', 'Sounds', 'Звуки') + '</button></div>' +
      '<div class="x-fc-quote"></div></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('x-focus-on');
    FX = { ov: ov, tk: tk, total: 25 * 60000, left: 25 * 60000, running: false, endAt: 0, timer: null, wake: null, started: 0 };
    var Q = [L('Bitta ish. Hozir. To\'liq.', 'One thing. Now. Fully.', 'Одно дело. Сейчас. Полностью.'), L('Telefonni chetga qo\'ying 📵', 'Put your phone away 📵', 'Отложите телефон 📵'),
      L('Kichik qadamlar katta natija beradi', 'Small steps, big results', 'Маленькие шаги — большой результат'), L('Boshlash — eng qiyin qismi. Siz allaqachon boshladingiz!', 'Starting is the hardest part — you already did!', 'Начать — самое трудное. Вы уже начали!')];
    ov.querySelector('.x-fc-quote').textContent = Q[Math.floor(Math.random() * Q.length)];
    var setTask = function (t) {
      FX.tk = t;
      ov.querySelector('.x-fc-task').innerHTML = t ? '<b>' + H((t.emoji ? t.emoji + ' ' : '') + t.name) + '</b>' + (t.startTime ? '<span>' + t.startTime + (t.endTime ? '–' + t.endTime : '') + '</span>' : '') : '';
      ov.querySelector('.x-fc-done').style.display = t ? '' : 'none';
      var bl = ov.querySelector('[data-m="block"]'); bl.style.display = (t && t.startTime) ? '' : 'none';
    };
    setTask(tk);
    var draw = function () {
      var left = FX.running ? Math.max(0, FX.endAt - Date.now()) : FX.left;
      var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
      ov.querySelector('.x-fc-time').textContent = pad2(m) + ':' + pad2(s);
      var fg = ov.querySelector('.fg'), C = 2 * Math.PI * 54;
      fg.style.strokeDasharray = C; fg.style.strokeDashoffset = C * (1 - left / FX.total);
      if (!window.LUBlocks) ov.querySelector('.x-fc-play').textContent = FX.running ? '⏸' : '▶'; // aks holda blocks.js yorliqli tugma chizadi
      ov.querySelector('.x-fc-ph').textContent = FX.running ? L('diqqat...', 'focusing...', 'фокус...') : (left < FX.total ? L('pauza', 'paused', 'пауза') : '');
      try { document.title = (FX.running ? '🎯 ' + pad2(m) + ':' + pad2(s) + ' · ' : '') + 'LevelUpDay'; } catch (e) {}
      try { if (window.LUBlocks) window.LUBlocks.focusLiveUpdate(ov, { running: FX.running, left: left, total: FX.total, started: FX.started }); } catch (e) {}
      try { if (window.LUFocusBus) { window.LUFocusBus.sync('focusmode', FX.running ? FX.endAt : 0, FX.tk ? FX.tk.name : ''); window.LUFocusBus.badge(ov.querySelector('.x-fc-in'), FX.running, 'focusmode'); } } catch (e) {}
      if (FX.running && left <= 0) finish();
    };
    // 🔗 Focusgate: fokus ishlayotganda dasturlar bloklanadi
    var fgSync = function () { try { if (window.LUFocusBus) window.LUFocusBus.sync('focusmode', FX && FX.running ? FX.endAt : 0, FX && FX.tk ? FX.tk.name : ''); } catch (e) {} };
    var credit = function () {
      fgSync();
      if (!FX.started) return;
      var mins = Math.round((Date.now() - FX.started) / 60000); FX.started = 0;
      if (mins < 1) return;
      S.focusLog = S.focusLog || {}; S.focusLog[today()] = (S.focusLog[today()] || 0) + mins; save();
    };
    var finish = function () {
      FX.running = false; FX.left = 0; credit(); clearInterval(FX.timer);
      try { SFX.firework(); } catch (e) {}
      try { if (typeof window.pomoPlaySound === 'function') window.pomoPlaySound(); } catch (e) {}
      var msg = '🎯 ' + L('Fokus sessiyasi tugadi!', 'Focus session complete!', 'Сессия фокуса завершена!');
      toast(msg); try { tkShowNotification(msg, FX.tk ? FX.tk.name : ''); } catch (e) {}
      if (Math.round(FX.total / 60000) >= 25 && S.xFocusBonus !== today()) { S.xFocusBonus = today(); addCoins(1, '🎯 ' + L('Fokus sessiyasi', 'Focus session', 'Сессия фокуса')); toast('🎯 +1 🪙'); save(); }
      draw();
    };
    var setDur = function (min) { if (FX.running) { credit(); } FX.running = false; FX.total = FX.left = Math.max(1, min) * 60000; draw(); };
    ov.querySelectorAll('.x-fc-presets button').forEach(function (b) {
      b.onclick = function () {
        ov.querySelectorAll('.x-fc-presets button').forEach(function (z) { z.classList.toggle('on', z === b); });
        if (b.dataset.m === 'block') { var e = FX.tk.endTime ? hm2m(FX.tk.endTime) : hm2m(FX.tk.startTime) + 60; setDur(Math.max(1, e - nowMin())); }
        else setDur(+b.dataset.m);
      };
    });
    ov.querySelector('[data-m="25"]').classList.add('on');
    ov.querySelector('.x-fc-play').onclick = function () {
      if (FX.running) { FX.left = Math.max(0, FX.endAt - Date.now()); FX.running = false; credit(); }
      else { if (FX.left <= 0) FX.left = FX.total; FX.endAt = Date.now() + FX.left; FX.running = true; FX.started = Date.now(); }
      fgSync();
      draw();
    };
    ov.querySelector('.x-fc-reset').onclick = function () { if (FX.running) credit(); FX.running = false; FX.left = FX.total; draw(); };
    ov.querySelector('.x-fc-sel').onchange = function () { var id = +this.value; setTask(id ? S.tasks.find(function (t) { return t.id === id; }) : null); };
    ov.querySelector('.x-fc-done').onclick = function () { if (FX.tk && !FX.tk.done) { toggleTask(FX.tk.id); } closeFocus(); try { showTab('tasks'); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
    ov.querySelector('.x-fc-snd').onclick = function () { try { openFocusPlayer(); } catch (e) { toast('🎵 —'); } };
    ov.querySelector('.x-fc-x').onclick = closeFocus;
    FX.onKey = function (e) { if (e.key === 'Escape' && !document.querySelector('.modal-overlay.open')) { e.stopPropagation(); closeFocus(); } else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); ov.querySelector('.x-fc-play').click(); } };
    document.addEventListener('keydown', FX.onKey, true);
    FX.timer = setInterval(draw, 250); draw();
    if (minutes > 0) { ov.querySelectorAll('.x-fc-presets button').forEach(function (z) { z.classList.remove('on'); }); setDur(minutes); }
    if (autoStart) ov.querySelector('.x-fc-play').click();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { if (FX) FX.wake = w; }).catch(function () {}); } catch (e) {}
    requestAnimationFrame(function () { ov.classList.add('open'); });
  }
  function closeFocus() {
    if (!FX) return;
    try { if (window.LUFocusBus) window.LUFocusBus.sync('focusmode', 0); } catch (e) {}
    if (FX.running && FX.started) { var mins = Math.round((Date.now() - FX.started) / 60000); if (mins >= 1) { S.focusLog = S.focusLog || {}; S.focusLog[today()] = (S.focusLog[today()] || 0) + mins; save(); } }
    clearInterval(FX.timer); document.removeEventListener('keydown', FX.onKey, true);
    try { FX.wake && FX.wake.release(); } catch (e) {}
    var ov = FX.ov; FX = null; ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 200);
    document.documentElement.classList.remove('x-focus-on');
    try { document.title = 'LevelUpDay'; } catch (e) {}
  }

  // =========================================================
  // 😴 15. UYQU — necha soat uxlagani (yagona manba: S.health[YYYY-MM-DD].sleep)
  // =========================================================
  function hDay(ds) { S.health = S.health || {}; ds = ds || today(); S.health[ds] = S.health[ds] || {}; return S.health[ds]; }
  function sleepOf(ds) { var d = (S.health || {})[ds]; var v = d && d.sleep; return (v == null || isNaN(+v)) ? null : +v; }
  function sleepWeek() {
    var vals = [], lbls = [], sum = 0, cnt = 0;
    for (var k = 6; k >= 0; k--) { var ds = addDays(today(), -k), v = sleepOf(ds); vals.push(v || 0); lbls.push(weekdaysShort()[(parseD(ds).getDay() + 6) % 7]); if (v) { sum += v; cnt++; } }
    return { vals: vals, lbls: lbls, avg: cnt ? sum / cnt : null, cnt: cnt };
  }
  function fmtH(v) { return (Math.round(v * 10) / 10) + ' ' + L('soat', 'h', 'ч'); }
  function sleepSet(h) {
    var d = hDay();
    if (h == null) { delete d.sleep; delete d.bed; delete d.wake; }
    else {
      h = Math.max(0, Math.min(16, Math.round(h * 2) / 2));
      d.sleep = h; delete d.bed; delete d.wake;
      if (h >= 7 && h <= 10 && !d.sleepBonus) { d.sleepBonus = true; addCoins(1, '😴 ' + L('Yaxshi uyqu', 'Good sleep', 'Хороший сон')); toast('😴 ' + fmtH(h) + ' — ' + L('zo\'r!', 'great!', 'отлично!') + ' +1 🪙'); }
    }
    save(); renderSleepCards();
  }
  function sleepCardHtml() {
    var cur = sleepOf(today()), w = sleepWeek();
    var tone = cur == null ? '' : (cur >= 7 && cur <= 9 ? 'ok' : cur < 6 ? 'low' : 'mid');
    var chips = [5, 6, 7, 8, 9].map(function (n) { return '<button type="button" class="x-sl-chip' + (cur === n ? ' on' : '') + '" data-slh="' + n + '">' + n + '</button>'; }).join('');
    var mx = Math.max.apply(null, w.vals.concat([9]));
    var mini = '<div class="x-sl-mini" aria-hidden="true">' + w.vals.map(function (v, i) {
      return '<div class="x-sl-mb' + (i === 6 ? ' td' : '') + (v && (v < 7 || v > 9) ? ' off' : '') + '" title="' + w.lbls[i] + ': ' + (v ? fmtH(v) : '—') + '"><i style="height:' + (v ? Math.max(8, v / mx * 100) : 4) + '%"></i><span>' + w.lbls[i] + '</span></div>';
    }).join('') + '</div>';
    return '<div class="x-sl-top"><b>😴 ' + L('Uyqu', 'Sleep', 'Сон') + '</b><span class="x-sl-q">' + L('Bugun tunda necha soat uxladingiz?', 'How long did you sleep last night?', 'Сколько вы спали этой ночью?') + '</span></div>' +
      '<div class="x-sl-row"><div class="x-sl-step"><button type="button" class="x-sl-pm" data-sld="-0.5" aria-label="-0.5">−</button>' +
      '<span class="x-sl-val ' + tone + '">' + (cur == null ? '—' : (Math.round(cur * 10) / 10) + '<small>' + L('soat', 'h', 'ч') + '</small>') + '</span>' +
      '<button type="button" class="x-sl-pm" data-sld="0.5" aria-label="+0.5">+</button></div>' +
      '<div class="x-sl-chips">' + chips + '</div></div>' +
      '<div class="x-sl-foot">' + mini + '<div class="x-sl-meta"><span>' + L('7 kun o\'rtacha', '7-day avg', 'Среднее 7 дн.') + ': <b>' + (w.avg != null ? fmtH(w.avg) : '—') + '</b></span>' +
      '<span>💡 ' + L('Tavsiya: 7–9 soat', 'Recommended: 7–9 h', 'Рекомендуется 7–9 ч') + '</span>' +
      (cur != null ? '<button type="button" class="x-link x-sl-clr" data-slclr="1">' + L('Tozalash', 'Clear', 'Сбросить') + '</button>' : '') + '</div></div>';
  }
  function bindSleep(root) {
    root.querySelectorAll('[data-slh]').forEach(function (b) { b.onclick = function () { sleepSet(+b.dataset.slh); }; });
    root.querySelectorAll('[data-sld]').forEach(function (b) { b.onclick = function () { var c = sleepOf(today()); sleepSet((c == null ? 7 : c) + (c == null ? 0 : +b.dataset.sld)); }; });
    root.querySelectorAll('[data-slclr]').forEach(function (b) { b.onclick = function () { sleepSet(null); }; });
  }
  function renderSleepCards() {
    document.querySelectorAll('.x-sleep-card').forEach(function (el) { var sh = sleepCardHtml(); el._h = sh; el.innerHTML = sh; bindSleep(el); });
    document.querySelectorAll('.x-wk-card').forEach(function (el) { var t = document.createElement('div'); t.innerHTML = weeklyHtml(); el.replaceWith(t.firstChild); });
    try { renderToday(); } catch (e) {}
  }
  function healthHtml() { return '<div class="x-card x-sleep-card">' + sleepCardHtml() + '</div>'; }
  function bindHealth(root) { bindSleep(root); }

  // =========================================================
  // 🧘 SALOMATLIK qo'shimchalari: kunlik tasdiq · SOS tinchlanish ·
  //    haftalik tahlil · odatni tashlash hisoblagichlari
  //    Ma'lumot: S.xAffirm {date, idx} · S.xCalmLog[date]=n ·
  //    S.xHabits [{id,name,emoji,start,best,created,shown[]}] · S.xWkSeen
  // =========================================================
  function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
  function wbRerender() { if ((S.xHubSec || 'boss') === 'health' && document.getElementById('x-hub-body')) renderHubSection('health', true); }

  // ---------- 💬 Kunlik tasdiq ----------
  var AFFIRM = [
    ['Har bir kichik qadam ham — oldinga qadam.', 'Every small step is still a step forward.', 'Каждый маленький шаг — всё равно шаг вперёд.'],
    ['Bugun o\'zingga mehribon bo\'l.', 'Be kind to yourself today.', 'Будь добр к себе сегодня.'],
    ['Mukammallik emas, davomiylik muhim.', 'Consistency beats perfection.', 'Постоянство важнее совершенства.'],
    ['Sen o\'ylaganingdan kuchliroqsan.', 'You are stronger than you think.', 'Ты сильнее, чем думаешь.'],
    ['Dam olish ham — ishning bir qismi.', 'Rest is part of the work.', 'Отдых — тоже часть работы.'],
    ['Bitta vazifa. Bitta nafas. Bitta qadam.', 'One task. One breath. One step.', 'Одна задача. Один вдох. Один шаг.'],
    ['Kecha qanday bo\'lganidan qat\'i nazar, bugun yangi imkoniyat.', 'Whatever yesterday was, today is a fresh chance.', 'Каким бы ни был вчерашний день, сегодня — новый шанс.'],
    ['O\'z tezligingda yur — bu poyga emas.', 'Move at your own pace — it\'s not a race.', 'Иди в своём темпе — это не гонка.'],
    ['Xato qilish — o\'rganayotganingning belgisi.', 'Mistakes mean you are learning.', 'Ошибки — значит, ты учишься.'],
    ['Sen yetarlicha yaxshisan, hozirning o\'zida.', 'You are enough, right now.', 'Ты достаточно хорош — прямо сейчас.'],
    ['Kichik g\'alabalarni ham nishonla.', 'Celebrate the small wins too.', 'Празднуй и маленькие победы.'],
    ['Boshlash uchun zo\'r bo\'lish shart emas, zo\'r bo\'lish uchun boshlash shart.', 'You don\'t have to be great to start, but you have to start to be great.', 'Не нужно быть великим, чтобы начать, но нужно начать, чтобы стать великим.'],
    ['Fikrlaringni kuzat, lekin ularga ishonib qolma.', 'Notice your thoughts — you don\'t have to believe all of them.', 'Замечай мысли — не обязательно верить им всем.'],
    ['Bugungi harakating — ertangi natijang.', 'Today\'s effort is tomorrow\'s result.', 'Сегодняшние усилия — завтрашний результат.'],
    ['Chuqur nafas ol. Sen uddalaysan.', 'Take a deep breath. You\'ve got this.', 'Сделай глубокий вдох. Ты справишься.'],
    ['Taraqqiyot — chiziq emas, lekin u baribir oldinga.', 'Progress isn\'t linear, but it still moves forward.', 'Прогресс не линеен, но он всё равно движется вперёд.'],
    ['O\'zingni boshqalar bilan emas, kechagi o\'zing bilan solishtir.', 'Compare yourself to who you were yesterday, not to others.', 'Сравнивай себя со вчерашним собой, а не с другими.'],
    ['"Yo\'q" deyish ham o\'zingga g\'amxo\'rlik.', 'Saying "no" can be self-care.', 'Сказать «нет» — тоже забота о себе.'],
    ['Har kuni 1% yaxshiroq — bir yilda 37 barobar.', '1% better every day adds up fast.', 'На 1% лучше каждый день — и это быстро накапливается.'],
    ['Qiyin kunlar ham o\'tib ketadi.', 'Hard days pass too.', 'Трудные дни тоже проходят.'],
    ['Sen o\'z hayotingning muallifisan.', 'You are the author of your own story.', 'Ты автор своей истории.'],
    ['Tanang va ongingni tingla — ular senga yordam bermoqchi.', 'Listen to your body and mind — they are on your side.', 'Слушай тело и разум — они на твоей стороне.'],
    ['Intizom — o\'zingga bergan va\'dangni bajarish.', 'Discipline is keeping promises to yourself.', 'Дисциплина — это держать обещания себе.'],
    ['Bugun kimgadir tabassum ulash.', 'Share a smile with someone today.', 'Подари кому-нибудь улыбку сегодня.'],
    ['Eng yaxshi vaqt — hozir.', 'The best time is now.', 'Лучшее время — сейчас.'],
    ['Charchoq — to\'xtash emas, sekinlash signali.', 'Tired means slow down, not give up.', 'Усталость — сигнал замедлиться, а не сдаться.'],
    ['Qilgan ishlaring uchun o\'zingga rahmat ayt.', 'Thank yourself for what you\'ve done.', 'Поблагодари себя за то, что уже сделал.'],
    ['Katta maqsad — kichik odatlardan quriladi.', 'Big goals are built from small habits.', 'Большие цели строятся из маленьких привычек.'],
    ['Sen bu yerdasan — bu allaqachon jasorat.', 'You showed up — that already takes courage.', 'Ты здесь — это уже смелость.'],
    ['Diqqatingni nazorat qila oladigan narsalarga qarat.', 'Focus on what you can control.', 'Сосредоточься на том, что можешь контролировать.'],
    ['Har tong — yangi sahifa.', 'Every morning is a new page.', 'Каждое утро — новая страница.'],
    ['Sekin borsang ham, to\'xtamasang bas.', 'It doesn\'t matter how slowly you go, as long as you don\'t stop.', 'Неважно, как медленно ты идёшь, главное — не останавливаться.'],
    ['Sening qadring natijalaring bilan o\'lchanmaydi.', 'Your worth is not measured by your output.', 'Твоя ценность не измеряется результатами.']
  ];
  function affirmIdx() {
    var a = S.xAffirm;
    if (a && a.date === today() && a.idx >= 0 && a.idx < AFFIRM.length) return a.idx;
    var s = today(), h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % AFFIRM.length;
  }
  function affirmHtml() {
    var q = AFFIRM[affirmIdx()];
    return '<div class="x-card x-aff-card"><span class="x-aff-ic" aria-hidden="true">✨</span><div class="x-aff-t"><small>' + L('Kunlik tasdiq', 'Daily affirmation', 'Аффирмация дня') + '</small><q>' + H(L(q[0], q[1], q[2])) + '</q></div>' +
      '<button type="button" class="x-aff-re" data-aff-re="1" aria-label="' + L('Boshqasi', 'Another one', 'Другая') + '" title="' + L('Boshqasi', 'Another one', 'Другая') + '">↻</button></div>';
  }

  // ---------- 😮‍💨 SOS: tinchlanish ----------
  function calmBtnHtml() {
    var n = (S.xCalmLog || {})[today()] || 0;
    return '<button type="button" class="x-card x-calm-card" data-calm="1"><span class="x-calm-e" aria-hidden="true">😮‍💨</span><span class="x-calm-t"><b>' + L('Tinchlanish (SOS)', 'Calm down (SOS)', 'Успокоиться (SOS)') + '</b><span>' +
      L('Hozir stressdamisiz? Nafas mashqi yoki 5-4-3-2-1', 'Stressed right now? Breathing or 5-4-3-2-1', 'Стресс прямо сейчас? Дыхание или 5-4-3-2-1') + '</span></span>' +
      (n ? '<span class="x-calm-n" title="' + L('Bugungi seanslar', 'Sessions today', 'Сеансов сегодня') + '">✓ ' + n + '</span>' : '<span class="x-mood-go">›</span>') + '</button>';
  }
  function calmLog() { S.xCalmLog = S.xCalmLog || {}; S.xCalmLog[today()] = (S.xCalmLog[today()] || 0) + 1; save(); }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  var CALM = null;
  var CALM_SOUNDS = [['bowl', '🎐', ['Ko\'zacha', 'Singing bowl', 'Чаша']], ['ocean', '🌊', ['Okean', 'Ocean', 'Океан']], ['rain', '🌧️', ['Yomg\'ir', 'Rain', 'Дождь']], ['river', '🏞️', ['Daryo', 'River', 'Река']], ['space', '🌌', ['Kosmos', 'Space', 'Космос']]];
  function openCalm() {
    if (CALM) return;
    var ov = document.createElement('div');
    ov.className = 'x-calm-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<button type="button" class="x-calm-x" aria-label="' + L('Yopish', 'Close', 'Закрыть') + '">✕</button>' +
      '<div class="x-calm-in"><div class="x-calm-tabs" role="tablist">' +
      '<button type="button" class="on" data-cm="breath">🌬 ' + L('Nafas', 'Breathing', 'Дыхание') + '</button>' +
      '<button type="button" data-cm="ground">🖐 5-4-3-2-1</button></div><div class="x-calm-body"></div>' +
      '<div class="x-calm-music" role="group" aria-label="' + L('Tinchlantiruvchi musiqa', 'Calming music', 'Успокаивающая музыка') + '"><span>🎵</span>' +
      CALM_SOUNDS.map(function (m) { return '<button type="button" data-cmu="' + m[0] + '" title="' + L(m[2][0], m[2][1], m[2][2]) + '">' + m[1] + '</button>'; }).join('') +
      '<button type="button" data-cmu="" title="' + L('Ovozsiz', 'Mute', 'Без звука') + '">🔇</button></div></div>';
    document.body.appendChild(ov);
    CALM = { ov: ov, timer: null, mode: 'breath' };
    // 🎵 Tinchlantiruvchi fon musiqasi (FocusAudio) — yopilganda avvalgi holatga qaytadi
    var FA = window.FocusAudio || (typeof FocusAudio !== 'undefined' ? FocusAudio : null);
    var prevType = null, prevPlaying = false;
    try { if (FA) { prevType = FA.getType(); prevPlaying = !!(FA.isPlaying && FA.isPlaying()); } } catch (e) {}
    var musicSel = (function () { try { var v = localStorage.getItem('calmMusic'); return v === null ? 'bowl' : (v === 'lofi' ? 'space' : v === 'forest' ? 'river' : v); } catch (e) { return 'bowl'; } })();
    var setMusic = function (type) {
      musicSel = type; try { localStorage.setItem('calmMusic', type); } catch (e) {}
      ov.querySelectorAll('[data-cmu]').forEach(function (b) { b.classList.toggle('on', b.dataset.cmu === type); });
      if (!FA) return;
      try { if (type) FA.play(type, Math.max(35, S.ambientFocusVolume || 45)); else FA.pause(); } catch (e) {}
    };
    ov.querySelectorAll('[data-cmu]').forEach(function (b) { b.onclick = function () { setMusic(b.dataset.cmu); }; });
    setMusic(musicSel);
    var body = ov.querySelector('.x-calm-body');
    var stop = function () { if (CALM && CALM.timer) { clearInterval(CALM.timer); CALM.timer = null; } };
    var close = function () {
      if (!CALM) return; stop(); document.removeEventListener('keydown', CALM.onKey, true);
      CALM = null; ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 200);
      try { if (FA) { if (prevPlaying && prevType) FA.play(prevType, S.ambientFocusVolume); else if (musicSel) FA.pause(); } } catch (e) {}
      document.documentElement.classList.remove('x-calm-on'); wbRerender();
    };
    var PH = [[4, L('Nafas oling…', 'Breathe in…', 'Вдох…'), 'in'], [4, L('Ushlab turing…', 'Hold…', 'Задержите…'), 'hold'], [6, L('Chiqaring…', 'Breathe out…', 'Выдох…'), 'out']];
    var CYCLE = 14;
    var breath = function () {
      stop(); var mins = CALM.mins || 1;
      body.innerHTML = '<div class="x-br-wrap"><div class="x-br-c" aria-hidden="true"></div><div class="x-br-txt"><b class="x-br-ph">' + L('Tayyormisiz?', 'Ready?', 'Готовы?') + '</b><span class="x-br-cd"></span></div></div>' +
        '<div class="x-br-left" aria-live="polite"></div>' +
        '<div class="x-br-mins">' + [1, 2, 3].map(function (m) { return '<button type="button" class="' + (m === mins ? 'on' : '') + '" data-bm="' + m + '">' + m + ' ' + L('daq', 'min', 'мин') + '</button>'; }).join('') + '</div>' +
        '<button type="button" class="x-btn x-br-go">▶ ' + L('Boshlash', 'Start', 'Начать') + '</button>' +
        '<p class="x-calm-hint">' + L('4 soniya nafas oling, 4 soniya ushlang, 6 soniya sekin chiqaring.', 'Inhale 4 s, hold 4 s, exhale slowly 6 s.', 'Вдох 4 с, задержка 4 с, медленный выдох 6 с.') + '</p>';
      var c = body.querySelector('.x-br-c'), ph = body.querySelector('.x-br-ph'), cd = body.querySelector('.x-br-cd'), left = body.querySelector('.x-br-left'), go = body.querySelector('.x-br-go');
      var rm = reducedMotion();
      body.querySelectorAll('[data-bm]').forEach(function (b) { b.onclick = function () { CALM.mins = +b.dataset.bm; breath(); }; });
      go.onclick = function () {
        if (CALM.timer) { breath(); return; }
        var total = (CALM.mins || 1) * 60, t0 = Date.now(), lastPh = -1;
        body.querySelectorAll('[data-bm]').forEach(function (b) { b.disabled = true; });
        go.textContent = '■ ' + L('To\'xtatish', 'Stop', 'Стоп'); go.classList.add('ghost');
        var tick = function () {
          var el = (Date.now() - t0) / 1000;
          if (el >= total) {
            stop(); calmLog(); c.className = 'x-br-c'; c.style.transitionDuration = '';
            ph.textContent = '🌿 ' + L('Barakalla!', 'Well done!', 'Молодец!');
            cd.textContent = ''; left.textContent = L('Mashq tugadi. O\'zingizni qanday his qilyapsiz?', 'Session complete. How do you feel now?', 'Упражнение завершено. Как вы себя чувствуете?');
            go.textContent = '↻ ' + L('Yana', 'Again', 'Ещё раз'); go.classList.remove('ghost');
            body.querySelectorAll('[data-bm]').forEach(function (b) { b.disabled = false; });
            return;
          }
          var inC = el % CYCLE, i = 0, acc = 0;
          while (inC >= acc + PH[i][0]) { acc += PH[i][0]; i++; }
          var phaseIdx = Math.floor(el / CYCLE) * 3 + i;
          if (phaseIdx !== lastPh) {
            lastPh = phaseIdx; ph.textContent = PH[i][1];
            if (!rm) { c.style.transitionDuration = PH[i][0] + 's'; }
            c.className = 'x-br-c ' + PH[i][2];
          }
          cd.textContent = Math.ceil(PH[i][0] - (inC - acc));
          var rem = Math.ceil(total - el); left.textContent = L('Qoldi', 'Remaining', 'Осталось') + ': ' + Math.floor(rem / 60) + ':' + pad2(rem % 60);
        };
        CALM.timer = setInterval(tick, 200); tick();
      };
    };
    var GSTEPS = [
      [5, '👀', L('ta narsani ko\'ring', 'things you can see', 'вещей, которые вы видите'), L('Atrofga qarang va ularni ichingizda nomlang.', 'Look around and name them in your head.', 'Оглянитесь и назовите их про себя.')],
      [4, '✋', L('ta narsaga teging', 'things you can touch', 'вещи, которые можно потрогать'), L('Ularning sirtini, haroratini his qiling.', 'Notice their texture and temperature.', 'Почувствуйте их текстуру и температуру.')],
      [3, '👂', L('ta tovushni eshiting', 'things you can hear', 'звука, которые вы слышите'), L('Uzoq va yaqin tovushlarga e\'tibor bering.', 'Notice sounds near and far.', 'Обратите внимание на близкие и далёкие звуки.')],
      [2, '👃', L('ta hidni seziring', 'things you can smell', 'запаха, которые вы чувствуете'), L('Agar hid bo\'lmasa, sevimli hidingizni eslang.', 'If nothing, recall a smell you love.', 'Если ничего нет — вспомните любимый запах.')],
      [1, '👅', L('ta ta\'mni his qiling', 'thing you can taste', 'вкус, который вы ощущаете'), L('Bir qultum suv iching yoki og\'zingizdagi ta\'mga e\'tibor bering.', 'Take a sip of water or notice the taste in your mouth.', 'Сделайте глоток воды или заметьте вкус во рту.')]
    ];
    var ground = function (step) {
      stop(); step = step || 0;
      if (step >= GSTEPS.length) {
        calmLog();
        body.innerHTML = '<div class="x-gr-card done"><div class="x-gr-e">🌿</div><b>' + L('Barakalla!', 'Well done!', 'Молодец!') + '</b><p>' + L('Siz hozirgi lahzadasiz. Sekin nafas oling va davom eting.', 'You are here, in the present moment. Breathe slowly and carry on.', 'Вы здесь, в настоящем моменте. Дышите медленно и продолжайте.') + '</p></div>' +
          '<div class="x-gr-nav"><button type="button" class="x-btn ghost" data-gr="0">↻ ' + L('Qaytadan', 'Restart', 'Заново') + '</button><button type="button" class="x-btn" data-grx="1">' + L('Yopish', 'Close', 'Закрыть') + '</button></div>';
      } else {
        var g = GSTEPS[step];
        body.innerHTML = '<div class="x-gr-dots">' + GSTEPS.map(function (_, i) { return '<i class="' + (i < step ? 'ok' : i === step ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
          '<div class="x-gr-card"><div class="x-gr-e" aria-hidden="true">' + g[1] + '</div><div class="x-gr-n">' + g[0] + '</div><b>' + g[0] + ' ' + g[2] + '</b><p>' + g[3] + '</p></div>' +
          '<div class="x-gr-nav">' + (step ? '<button type="button" class="x-btn ghost" data-gr="' + (step - 1) + '">‹ ' + L('Orqaga', 'Back', 'Назад') + '</button>' : '') +
          '<button type="button" class="x-btn" data-gr="' + (step + 1) + '">' + (step === GSTEPS.length - 1 ? L('Tugatish', 'Finish', 'Завершить') : L('Keyingi', 'Next', 'Далее') + ' ›') + '</button></div>';
      }
      body.querySelectorAll('[data-gr]').forEach(function (b) { b.onclick = function () { ground(+b.dataset.gr); }; });
      var bx = body.querySelector('[data-grx]'); if (bx) bx.onclick = close;
    };
    var setMode = function (m) {
      CALM.mode = m;
      ov.querySelectorAll('[data-cm]').forEach(function (b) { b.classList.toggle('on', b.dataset.cm === m); b.setAttribute('aria-selected', b.dataset.cm === m ? 'true' : 'false'); });
      if (m === 'breath') breath(); else ground(0);
    };
    ov.querySelectorAll('[data-cm]').forEach(function (b) { b.onclick = function () { setMode(b.dataset.cm); }; });
    ov.querySelector('.x-calm-x').onclick = close;
    CALM.onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', CALM.onKey, true);
    CALM.close = close;
    document.documentElement.classList.add('x-calm-on');
    setMode('breath');
    requestAnimationFrame(function () { ov.classList.add('open'); });
  }

  // ---------- 📊 Haftalik tahlil ----------
  var MOOD_SCORE = { '🥳': 5, '🙂': 4, '😇': 4, '🧐': 3, '😑': 3, '🥵': 2, '🤯': 2, '😭': 1, '😡': 1, '🤮': 1 };
  function moodScore(ds) {
    var m = (S.moods || {})[ds]; if (!m) return null;
    if (typeof m.level === 'number') return m.level;
    var e = m.emoji || m.mood || (typeof m === 'string' ? m : null);
    return e && MOOD_SCORE[e] != null ? MOOD_SCORE[e] : (e ? 3 : null);
  }
  function doneCounts() {
    var c = {}, log = S.taskDoneLog || {};
    Object.keys(log).forEach(function (id) { var arr = log[id]; if (!Array.isArray(arr)) return; var seen = {}; arr.forEach(function (d) { if (typeof d === 'string' && !seen[d]) { seen[d] = 1; c[d] = (c[d] || 0) + 1; } }); });
    return c;
  }
  function avg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function weekStats(off, dc) {
    var ms = [], ss = [], ts = [];
    for (var k = 6; k >= 0; k--) { var ds = addDays(today(), -(k + off)); var m = moodScore(ds), s = sleepOf(ds); if (m != null) ms.push(m); if (s) ss.push(s); ts.push(dc[ds] || 0); }
    return { mood: avg(ms), sleep: avg(ss), tasks: avg(ts), total: ts.reduce(function (a, b) { return a + b; }, 0), days: ts };
  }
  function wkInsights(dc) {
    var out = [], gS = [], bS = [], gM = [], bM = [], mG = [], mB = [], anyT = 0;
    for (var k = 0; k < 28; k++) {
      var ds = addDays(today(), -k), t = dc[ds] || 0, s = sleepOf(ds), m = moodScore(ds);
      if (k === 0 && !t && s == null && m == null) continue; // bugun hali boshlanmagan
      if (s) (s >= 7 ? gS : bS).push(t);
      if (m != null) { if (m >= 4) gM.push(t); else if (m <= 2) bM.push(t); }
      if (s && m != null) (s >= 7 ? mG : mB).push(m);
      anyT += t;
    }
    if (!anyT) { gS = bS = gM = bM = []; } // vazifa bajarilmagan bo'lsa, vazifa bo'yicha xulosa chiqarmaymiz
    if (gS.length >= 2 && bS.length >= 2) {
      var a = r1(avg(gS)), b = r1(avg(bS));
      out.push('😴 ' + L('7+ soat uxlagan kunlaringda o\'rtacha <b>' + a + '</b> ta vazifa bajargansiz, kam uxlagan kunlarda — <b>' + b + '</b> ta.',
        'On days you slept 7+ hours you completed <b>' + a + '</b> tasks on average, on short-sleep days — <b>' + b + '</b>.',
        'В дни, когда вы спали 7+ часов, вы выполняли в среднем <b>' + a + '</b> задач, при недосыпе — <b>' + b + '</b>.'));
    }
    if (gM.length >= 2 && bM.length >= 2) {
      var ga = avg(gM), ba = avg(bM);
      if (ba > 0 && Math.abs(ga - ba) / ba >= 0.1) {
        var p = Math.round(Math.abs(ga - ba) / ba * 100);
        out.push(ga > ba ? '🙂 ' + L('Kayfiyat yaxshi kunlarda vazifalar <b>' + p + '%</b> ko\'proq bajarilgan.', 'On good-mood days you completed <b>' + p + '%</b> more tasks.', 'В дни хорошего настроения задач выполнено на <b>' + p + '%</b> больше.')
          : '💡 ' + L('Kayfiyat past kunlarda ham <b>' + p + '%</b> ko\'proq vazifa bajargansiz — ish sizni chalg\'itadi, lekin dam olishni unutmang.', 'On low-mood days you did <b>' + p + '%</b> more tasks — keep an eye on rest too.', 'В дни плохого настроения вы сделали на <b>' + p + '%</b> больше задач — не забывайте об отдыхе.'));
      } else {
        out.push('🙂 ' + L('Kayfiyat yaxshi va past kunlarda bajarilgan vazifalar soni deyarli bir xil — barqarorsiz!', 'You complete about the same number of tasks on good and low-mood days — steady!', 'В дни хорошего и плохого настроения вы делаете примерно одинаково задач — стабильно!'));
      }
    }
    if (mG.length >= 2 && mB.length >= 2) {
      var x = avg(mG), y = avg(mB);
      if (x - y >= 0.5) out.push('🌙 ' + L('Yaxshi uxlagan kunlaringizda kayfiyatingiz sezilarli yaxshiroq (' + r1(x) + ' vs ' + r1(y) + ' / 5).', 'Your mood is noticeably better after a good night\'s sleep (' + r1(x) + ' vs ' + r1(y) + ' / 5).', 'После хорошего сна ваше настроение заметно лучше (' + r1(x) + ' vs ' + r1(y) + ' / 5).'));
    }
    return out.slice(0, 3);
  }
  function wkDelta(cur, prev, unit, dec) {
    if (cur == null) return '';
    if (prev == null || prev === 0) return '';
    var d = cur - prev; if (Math.abs(d) < (dec ? 0.05 : 0.5) && Math.abs(d) < 0.1) return '<em class="x-wk-d">=</em>';
    return '<em class="x-wk-d ' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '▲' : '▼') + ' ' + r1(Math.abs(d)) + (unit || '') + '</em>';
  }
  function weeklyHtml() {
    var dc = doneCounts(), w = weekStats(0, dc), p = weekStats(7, dc), ins = wkInsights(dc);
    var wk = mondayOf(today()), isNew = S.xWkSeen !== wk;
    var lbls = []; for (var k = 6; k >= 0; k--) lbls.push(weekdaysShort()[(parseD(addDays(today(), -k)).getDay() + 6) % 7]);
    var mx = Math.max.apply(null, w.days.concat([1]));
    var bars = '<div class="x-wk-bars" aria-hidden="true">' + w.days.map(function (v, i) {
      return '<div class="x-wk-b' + (i === 6 ? ' td' : '') + '" title="' + lbls[i] + ': ' + v + '"><span class="x-wk-bn">' + (v || '') + '</span><i style="height:' + (v ? Math.max(10, v / mx * 100) : 4) + '%"></i><span>' + lbls[i] + '</span></div>';
    }).join('') + '</div>';
    var moodE = w.mood == null ? '—' : (w.mood >= 4.3 ? '🥳' : w.mood >= 3.5 ? '🙂' : w.mood >= 2.5 ? '😑' : w.mood >= 1.8 ? '🥵' : '😭');
    var stat = function (ic, lab, val, dl) { return '<div class="x-wk-s"><span>' + ic + ' ' + lab + '</span><b>' + val + '</b>' + dl + '</div>'; };
    var html = '<div class="x-card x-wk-card"><div class="x-card-h"><b>📊 ' + L('Haftalik tahlil', 'Weekly analysis', 'Недельный анализ') + (isNew ? ' <span class="x-new">' + L('Yangi', 'New', 'Новое') + '</span>' : '') + '</b><span>' + L('So\'nggi 7 kun', 'Last 7 days', 'Последние 7 дней') + '</span></div>' +
      '<div class="x-wk-grid">' +
      stat(moodE, L('Kayfiyat', 'Mood', 'Настроение'), w.mood == null ? '—' : r1(w.mood) + '<small>/5</small>', wkDelta(w.mood, p.mood, '', true)) +
      stat('😴', L('Uyqu', 'Sleep', 'Сон'), w.sleep == null ? '—' : r1(w.sleep) + '<small>' + L('soat', 'h', 'ч') + '</small>', wkDelta(w.sleep, p.sleep, L('s', 'h', 'ч'), true)) +
      stat('✅', L('Vazifa/kun', 'Tasks/day', 'Задач/день'), r1(w.tasks), wkDelta(w.tasks, p.tasks, '', true)) +
      '</div>' + bars +
      '<div class="x-wk-cmp">' + L('O\'tgan haftaga nisbatan', 'vs previous week', 'по сравнению с прошлой неделей') + ': ' + w.total + ' / ' + p.total + ' ' + L('ta vazifa', 'tasks', 'задач') + '</div>' +
      (ins.length ? '<ul class="x-wk-ins">' + ins.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>'
        : '<div class="x-wk-hint">🌱 ' + L('Ko\'proq ma\'lumot yig\'ilsin — kayfiyat va uyquni har kuni belgilab boring.', 'Let\'s collect more data — log your mood and sleep every day.', 'Нужно больше данных — отмечайте настроение и сон каждый день.') + '</div>') +
      '</div>';
    if (isNew) { S.xWkSeen = wk; try { save(); } catch (e) {} }
    return html;
  }

  // ---------- 🚭 Odatni tashlash ----------
  var HAB_PRESETS = [
    ['🍬', 'Shirinliksiz', 'No sweets', 'Без сладкого'],
    ['📱', 'Ijtimoiy tarmoqsiz', 'No social media', 'Без соцсетей'],
    ['🚭', 'Chekmaslik', 'No smoking', 'Не курю'],
    ['🥤', 'Gazli ichimliksiz', 'No soda', 'Без газировки'],
    ['🍔', 'Fast-foodsiz', 'No fast food', 'Без фастфуда'],
    ['🎮', 'O\'yinsiz', 'No gaming', 'Без игр']
  ];
  var HAB_MS = [3, 7, 14, 30, 60, 100];
  var HAB_MAX = 10;
  function habDays(h) { return Math.max(0, daysBetween(h.start, today())); }
  function habCheckMilestones() {
    var changed = false;
    (S.xHabits || []).forEach(function (h) {
      h.shown = h.shown || []; var d = habDays(h), hit = null;
      HAB_MS.forEach(function (m) { if (d >= m && h.shown.indexOf(m) === -1) { h.shown.push(m); hit = m; changed = true; } });
      if (hit) setTimeout(function () {
        toast('🎉 ' + h.emoji + ' ' + h.name + ' — ' + L(hit + ' kun! Zo\'r!', hit + ' days! Amazing!', hit + ' дн.! Отлично!'));
        try { confetti(); } catch (e) {}
      }, 300);
    });
    if (changed) save();
  }
  function daysWord(n) { return L(n + ' kun', n + (n === 1 ? ' day' : ' days'), n + ' дн.'); }
  function habitsHtml() {
    var list = S.xHabits || [];
    var rows = list.map(function (h) {
      var d = habDays(h), best = Math.max(h.best || 0, d);
      var next = HAB_MS.find(function (m) { return m > d; }); var prevM = 0; HAB_MS.forEach(function (m) { if (m <= d) prevM = m; });
      var pct = next ? Math.round((d - prevM) / (next - prevM) * 100) : 100;
      return '<div class="x-hb-row" data-hid="' + H(h.id) + '"><span class="x-hb-e">' + H(h.emoji || '🚫') + '</span><div class="x-hb-m"><b>' + H(h.name) + '</b>' +
        '<span class="x-hb-n"><strong>' + daysWord(d) + '</strong> · 🏆 ' + L('Rekord', 'Best', 'Рекорд') + ': ' + daysWord(best) + '</span>' +
        '<div class="x-hb-bar" title="' + (next ? L('Keyingi marra: ', 'Next milestone: ', 'Следующая цель: ') + daysWord(next) : '') + '"><i style="width:' + pct + '%"></i></div></div>' +
        '<div class="x-hb-act"><button type="button" class="x-btn ghost sm" data-hreset="' + H(h.id) + '">' + L('Uzildi', 'Slipped', 'Сорвался') + '</button>' +
        '<button type="button" class="x-link danger" data-hdel="' + H(h.id) + '" aria-label="' + L('O\'chirish', 'Delete', 'Удалить') + '">🗑</button></div></div>';
    }).join('');
    var form = '<div class="x-hb-form" hidden><div class="x-hb-pre">' + HAB_PRESETS.map(function (p, i) { return '<button type="button" data-hpre="' + i + '">' + p[0] + ' ' + L(p[1], p[2], p[3]) + '</button>'; }).join('') + '</div>' +
      '<div class="x-row"><input class="x-in x-hb-ei" maxlength="4" value="🚫" aria-label="emoji"><input class="x-in x-hb-ni" maxlength="40" placeholder="' + L('Masalan: Kofesiz', 'e.g. No coffee', 'Напр.: Без кофе') + '"></div>' +
      '<label class="x-hb-dl">' + L('Qachondan beri?', 'Since when?', 'С какого дня?') + ' <input type="date" class="x-in x-hb-di" value="' + today() + '" max="' + today() + '"></label>' +
      '<div class="x-row"><button type="button" class="x-btn" data-hsave="1">' + L('Qo\'shish', 'Add', 'Добавить') + '</button><button type="button" class="x-btn ghost" data-hcancel="1">' + L('Bekor', 'Cancel', 'Отмена') + '</button></div></div>';
    return '<div class="x-card x-hb-card"><div class="x-card-h"><b>🚭 ' + L('Odatni tashlash', 'Quit a habit', 'Бросить привычку') + '</b>' +
      (list.length < HAB_MAX ? '<button type="button" class="x-btn sm" data-hadd="1">＋ ' + L('Qo\'shish', 'Add', 'Добавить') + '</button>' : '<span>' + list.length + '/' + HAB_MAX + '</span>') + '</div>' +
      (rows || '<div class="x-hb-empty">' + L('Yomon odatdan voz kechyapsizmi? Hisoblagich qo\'shing — har bir "toza" kun hisoblanadi.', 'Quitting a bad habit? Add a counter — every clean day counts.', 'Бросаете вредную привычку? Добавьте счётчик — каждый «чистый» день на счету.') + '</div>') + form + '</div>';
  }
  function bindHabits(root) {
    var card = root.querySelector('.x-hb-card'); if (!card) return;
    var form = card.querySelector('.x-hb-form'), ni = card.querySelector('.x-hb-ni'), ei = card.querySelector('.x-hb-ei'), di = card.querySelector('.x-hb-di');
    var add = card.querySelector('[data-hadd]'); if (add) add.onclick = function () { form.hidden = !form.hidden; if (!form.hidden) ni.focus(); };
    card.querySelector('[data-hcancel]').onclick = function () { form.hidden = true; };
    card.querySelectorAll('[data-hpre]').forEach(function (b) { b.onclick = function () { var p = HAB_PRESETS[+b.dataset.hpre]; ei.value = p[0]; ni.value = L(p[1], p[2], p[3]); card.querySelectorAll('[data-hpre]').forEach(function (z) { z.classList.toggle('on', z === b); }); }; });
    var doSave = function () {
      var nm = ni.value.trim(); if (!nm) { ni.focus(); toast(L('Nomini yozing', 'Enter a name', 'Введите название')); return; }
      S.xHabits = S.xHabits || []; if (S.xHabits.length >= HAB_MAX) { toast(L('Ko\'pi bilan ' + HAB_MAX + ' ta', 'Max ' + HAB_MAX, 'Максимум ' + HAB_MAX)); return; }
      var st = di.value && /^\d{4}-\d{2}-\d{2}$/.test(di.value) && di.value <= today() ? di.value : today();
      var h = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: nm.slice(0, 40), emoji: (ei.value.trim() || '🚫').slice(0, 4), start: st, best: 0, created: Date.now(), shown: [] };
      S.xHabits.push(h); save(); toast('✅ ' + h.emoji + ' ' + h.name); wbRerender();
    };
    card.querySelector('[data-hsave]').onclick = doSave;
    ni.onkeydown = function (e) { if (e.key === 'Enter') doSave(); };
    card.querySelectorAll('[data-hreset]').forEach(function (b) { b.onclick = function () {
      var h = (S.xHabits || []).find(function (x) { return x.id === b.dataset.hreset; }); if (!h) return;
      var d = habDays(h);
      var doReset = function () {
        h.best = Math.max(h.best || 0, d); h.start = today(); h.shown = []; save();
        toast('💪 ' + L('Hechqisi yo\'q — qaytadan boshlaymiz!', 'It\'s okay — let\'s start again!', 'Ничего страшного — начнём заново!')); wbRerender();
      };
      holdAsk(H(L('"' + h.name + '" hisoblagichi 0 dan boshlansinmi? (' + d + ' kun rekordga yoziladi)', 'Reset "' + h.name + '" to 0? (' + d + ' days will be kept as a record)', 'Сбросить «' + h.name + '» до 0? (' + d + ' дн. сохранятся в рекорде)')),
        doReset, { icon: '🔄', title: L('Hisoblagichni nollash', 'Reset counter', 'Сбросить счётчик'),
          holdLabel: '🔄 ' + L('Nollash uchun bosib turing', 'Hold to reset', 'Удерживайте для сброса'),
          doneLabel: '✓ ' + L('Nollandi', 'Reset', 'Сброшено') });
    }; });
    card.querySelectorAll('[data-hdel]').forEach(function (b) { b.onclick = function () {
      var h = (S.xHabits || []).find(function (x) { return x.id === b.dataset.hdel; }); if (!h) return;
      holdAsk(H(L('"' + h.name + '" o\'chirilsinmi?', 'Delete "' + h.name + '"?', 'Удалить «' + h.name + '»?')), function () {
        S.xHabits = S.xHabits.filter(function (x) { return x !== h; }); save(); wbRerender();
      }, { icon: '🗑️', title: L("Odatni o'chirish", 'Delete habit', 'Удалить привычку') });
    }; });
  }

  function wellbeingHtml(moodCard) { habCheckMilestones(); return affirmHtml() + calmBtnHtml() + moodCard + healthHtml() + weeklyHtml() + habitsHtml(); }
  function bindWellbeing(root) {
    bindHealth(root); bindHabits(root);
    var re = root.querySelector('[data-aff-re]'); if (re) re.onclick = function () {
      var cur = affirmIdx(), n = cur; while (n === cur) n = Math.floor(Math.random() * AFFIRM.length);
      S.xAffirm = { date: today(), idx: n }; save();
      var card = root.querySelector('.x-aff-card'); if (card) { var tmp = document.createElement('div'); tmp.innerHTML = affirmHtml(); card.replaceWith(tmp.firstChild); bindWellbeing(root); }
    };
    var cb = root.querySelector('[data-calm]'); if (cb) cb.onclick = openCalm;
  }
  // kayfiyat saqlanganda Salomatlik bo'limi yangilansin
  (function () {
    var orig = window.saveMoodEntry;
    if (typeof orig === 'function') window.saveMoodEntry = function () { var r = orig.apply(this, arguments); try { wbRerender(); } catch (e) {} return r; };
  })();

  // =========================================================
  // 📰 17. DO'STLAR LENTASI  ·  👥 16. BIRGALIKDAGI VAZIFA (Supabase)
  // =========================================================
  function cloudOk() { return !!(S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.rpc); }
  function sqlHint(err) {
    var m = (err && (err.message || err)) || '';
    if (/function|does not exist|schema cache|404/i.test(m)) return L('Server hali sozlanmagan (supabase/social.sql ishga tushirilmagan).', 'Server not set up yet (run supabase/social.sql).', 'Сервер не настроен (запустите supabase/social.sql).');
    return m;
  }
  var _feedQueue = Promise.resolve();
  function feedPost(kind, text, emoji, manual) {
    if (!cloudOk()) { if (manual) toast('📰 ' + L('Lenta uchun hisobga kiring', 'Sign in to use the feed', 'Войдите, чтобы пользоваться лентой')); return; }
    if (S.xFeedOff && !manual) return;
    _feedQueue = _feedQueue.then(function () {
      return supabase.rpc('post_activity', { p_kind: kind, p_text: String(text).slice(0, 200), p_emoji: emoji || '✅' }).then(function (r) {
        if (r.error) { console.warn('[feed]', r.error.message); if (manual) toast('⚠️ ' + sqlHint(r.error)); }
        else if (manual) toast('📰 ' + L('Lentaga ulashildi', 'Shared to feed', 'Опубликовано'));
      });
    }).catch(function () {});
  }
  window.xFeedPost = feedPost;
  var REACTS = ['🔥', '👏', '💪', '❤️'];
  function ago(ts) {
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return L('hozir', 'now', 'сейчас');
    if (s < 3600) return Math.floor(s / 60) + L(' daq', 'm', ' мин');
    if (s < 86400) return Math.floor(s / 3600) + L(' soat', 'h', ' ч');
    return Math.floor(s / 86400) + L(' kun', 'd', ' дн');
  }
  function avatar(name, photo) {
    return photo ? '<img class="x-av" src="' + H(photo) + '" alt="">' : '<span class="x-av">' + H(String(name || '?').charAt(0).toUpperCase()) + '</span>';
  }
  var feedCache = null;
  function loadFeed() {
    var box = document.getElementById('x-hub-feed'); if (!box) return;
    if (!cloudOk()) { box.innerHTML = '<div class="x-empty">🔐 ' + L('Do\'stlar lentasi uchun hisobingizga kiring (Profil → Sozlamalar).', 'Sign in to see your friends\' feed.', 'Войдите, чтобы видеть ленту друзей.') + '</div>'; return; }
    var rf = document.getElementById('x-feed-ref');
    if (rf && feedCache) rf.classList.add('spin');
    else box.innerHTML = '<div class="fd-skel"><i></i><i></i><i></i></div>';
    supabase.rpc('get_friend_feed', { p_limit: 50 }).then(function (r) {
      if (r.error) { box.innerHTML = '<div class="x-empty">⚠️ ' + H(sqlHint(r.error)) + '</div>'; return; }
      feedCache = r.data || [];
      renderFeed();
    });
  }
  function renderFeed() {
    var box = document.getElementById('x-hub-feed'); if (!box) return;
    var items = feedCache || [];
    var h = '<div class="fd-head"><div class="fd-head-t"><b>📰 ' + L('Do\'stlar lentasi', 'Friends feed', 'Лента друзей') + '</b><small>' +
        (items.length ? items.length + ' ' + L('ta yozuv', 'posts', 'записей') : L('Do\'stlaringiz yutuqlari shu yerda', 'Your friends\' wins show up here', 'Успехи друзей появятся здесь')) + '</small></div>' +
      '<button class="fd-ref" id="x-feed-ref" title="' + L('Yangilash', 'Refresh', 'Обновить') + '" aria-label="' + L('Yangilash', 'Refresh', 'Обновить') + '">↻</button></div>' +
      '<label class="fd-auto"><span><b>' + L('Avtomatik ulashish', 'Auto-share', 'Автопубликация') + '</b><small>' + L('Yutuqlarimni avtomatik ulashish', 'Auto-share my achievements', 'Делиться достижениями автоматически') + '</small></span>' +
      '<input type="checkbox" id="x-feed-auto" ' + (S.xFeedOff ? '' : 'checked') + '><i class="fd-sw"></i></label>';
    if (!items.length) h += '<div class="fd-empty"><span>📭</span>' + L('Hali hech narsa yo\'q. Vazifalarni bajaring — do\'stlaringiz ko\'radi!', 'Nothing yet. Complete tasks — your friends will see it!', 'Пока пусто. Выполняйте задачи — друзья увидят!') + '</div>';
    items.forEach(function (it, i) {
      var rc = it.reactions || {}, mine = it.my_reactions || [];
      var tot = REACTS.reduce(function (a, e) { return a + (rc[e] || 0); }, 0);
      h += '<div class="x-feed-it fd-card' + (it.is_me ? ' me' : '') + '" style="--i:' + Math.min(i, 12) + '"><div class="x-feed-h">' + avatar(it.name, it.photo) + '<div><b>' + H(it.name || '—') + (it.is_me ? ' <i>' + L('siz', 'you', 'вы') + '</i>' : '') + '</b><span>' + ago(it.created_at) + '</span></div><em>' + H(it.emoji || '✅') + '</em></div>' +
        '<div class="x-feed-t">' + H(it.text) + '</div><div class="x-feed-r">' + REACTS.map(function (e) {
          var on = mine.indexOf(e) !== -1, n = rc[e] || 0;
          return '<button class="' + (on ? 'on' : '') + '" data-fr="' + it.id + '" data-e="' + e + '"><span>' + e + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</button>';
        }).join('') + (tot ? '<small class="fd-tot">' + tot + ' ' + L('reaksiya', tot === 1 ? 'reaction' : 'reactions', 'реакц.') + '</small>' : '') + '</div></div>';
    });
    box.innerHTML = h;
    box.querySelector('#x-feed-ref').onclick = loadFeed;
    box.querySelector('#x-feed-auto').onchange = function () { S.xFeedOff = !this.checked; save(); };
    box.querySelectorAll('[data-fr]').forEach(function (b) {
      b.onclick = function () {
        var id = +b.dataset.fr, e = b.dataset.e, it = (feedCache || []).find(function (x) { return x.id === id; }); if (!it) return;
        it.my_reactions = it.my_reactions || []; it.reactions = it.reactions || {};
        var on = it.my_reactions.indexOf(e) === -1;
        if (on) { it.my_reactions.push(e); it.reactions[e] = (it.reactions[e] || 0) + 1; } else { it.my_reactions = it.my_reactions.filter(function (z) { return z !== e; }); it.reactions[e] = Math.max(0, (it.reactions[e] || 1) - 1); }
        renderFeed();
        if (on) { var nb = document.querySelector('#x-hub-feed [data-fr="' + id + '"][data-e="' + e + '"]'); if (nb) nb.classList.add('pop'); }
        supabase.rpc('react_activity', { p_feed: id, p_emoji: e, p_on: on }).then(function (r) { if (r.error) toast('⚠️ ' + sqlHint(r.error)); });
      };
    });
  }

  var sharedCache = null;
  function loadShared() {
    var box = document.getElementById('x-hub-shared'); if (!box) return;
    if (!cloudOk()) { box.innerHTML = '<div class="x-empty">🔐 ' + L('Do\'st bilan umumiy vazifa uchun hisobingizga kiring.', 'Sign in to share tasks with friends.', 'Войдите, чтобы делить задачи с друзьями.') + '</div>'; return; }
    box.innerHTML = '<div class="x-empty">⏳ ' + L('Yuklanmoqda...', 'Loading...', 'Загрузка...') + '</div>';
    supabase.rpc('get_my_shared_tasks').then(function (r) {
      if (r.error) { box.innerHTML = '<div class="x-empty">⚠️ ' + H(sqlHint(r.error)) + '</div>'; return; }
      sharedCache = r.data || [];
      renderShared();
    });
  }
  function sharedStreak(it) {
    var me = {}, fr = {};
    (it.checks || []).forEach(function (c) { (c.user_id === S.cloudUserId ? me : fr)[c.day] = 1; });
    var n = 0, d = today(); if (!(me[d] && fr[d])) d = addDays(d, -1);
    while (me[d] && fr[d]) { n++; d = addDays(d, -1); }
    return { n: n, me: !!me[today()], fr: !!fr[today()] };
  }
  function renderShared() {
    var box = document.getElementById('x-hub-shared'); if (!box) return;
    var friends = ((S.friends || {}).list || []);
    if (!friends.length && !renderShared._fs && typeof window.friendsSyncFromCloud === 'function') { renderShared._fs = 1; Promise.resolve(window.friendsSyncFromCloud()).then(function () { renderShared(); }, function () {}); }
    var h = '<div class="x-card"><div class="x-card-h"><b>➕ ' + L('Do\'st bilan yangi umumiy odat', 'New shared habit', 'Новая общая привычка') + '</b></div>';
    if (!friends.length) h += '<div class="x-sub">' + L('Avval do\'st qo\'shing (👥 Do\'stlar).', 'Add a friend first (👥 Friends).', 'Сначала добавьте друга.') + '</div>';
    else h += '<div class="x-row"><input class="x-in" id="x-sh-name" maxlength="60" placeholder="' + L('Masalan: 30 daqiqa ingliz tili', 'e.g. 30 min English', 'Напр.: 30 мин английского') + '"><select class="x-in" id="x-sh-fr">' +
      friends.map(function (f) { return '<option value="' + H(f.id) + '">' + H(f.name) + '</option>'; }).join('') + '</select><button class="x-btn" id="x-sh-add">＋</button></div>';
    h += '<div class="x-sub">' + L('Ikkalangiz ham bugun bajarsangiz — har biringizga +2 🪙 va umumiy seriya o\'sadi.', 'If you both do it today — +2 🪙 each and your shared streak grows.', 'Если оба выполните сегодня — +2 🪙 и общая серия растёт.') + '</div></div>';
    var items = sharedCache || [];
    if (!items.length) h += '<div class="x-empty">🤝 ' + L('Hali umumiy vazifa yo\'q.', 'No shared tasks yet.', 'Пока нет общих задач.') + '</div>';
    items.forEach(function (it) {
      var st = sharedStreak(it);
      h += '<div class="x-sh-it ' + (st.me && st.fr ? 'both' : '') + '"><div class="x-sh-h"><b>' + H(it.emoji || '🤝') + ' ' + H(it.name) + '</b><span>🔥 ' + st.n + '</span></div>' +
        '<div class="x-sh-p"><div class="x-sh-who ' + (st.me ? 'ok' : '') + '">' + avatar(L('Siz', 'You', 'Вы'), null) + '<span>' + L('Siz', 'You', 'Вы') + ' ' + (st.me ? '✅' : '⏳') + '</span></div>' +
        '<div class="x-sh-who ' + (st.fr ? 'ok' : '') + '">' + avatar(it.partner_name, it.partner_photo) + '<span>' + H(it.partner_name || '—') + ' ' + (st.fr ? '✅' : '⏳') + '</span></div></div>' +
        '<div class="x-row"><button class="x-btn ' + (st.me ? 'ghost' : '') + '" data-shc="' + it.id + '" data-on="' + (st.me ? 0 : 1) + '">' + (st.me ? '↩ ' + L('Bekor qilish', 'Undo', 'Отменить') : '✅ ' + L('Bugun bajardim', 'Done today', 'Сделал(а) сегодня')) + '</button>' +
        '<button class="x-link danger" data-shd="' + it.id + '">🗑</button></div></div>';
    });
    box.innerHTML = h;
    var add = box.querySelector('#x-sh-add');
    if (add) add.onclick = function () {
      var n = box.querySelector('#x-sh-name').value.trim(), fr = box.querySelector('#x-sh-fr').value;
      if (!n) { box.querySelector('#x-sh-name').focus(); return; }
      add.disabled = true;
      supabase.rpc('create_shared_task', { p_partner: fr, p_name: n, p_emoji: '🤝' }).then(function (r) {
        add.disabled = false;
        if (r.error) { toast('⚠️ ' + sqlHint(r.error)); return; }
        toast('🤝 ' + L('Umumiy vazifa yaratildi', 'Shared task created', 'Общая задача создана')); loadShared();
      });
    };
    box.querySelectorAll('[data-shc]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.shc, on = b.dataset.on === '1'; b.disabled = true;
        supabase.rpc('check_shared_task', { p_task: id, p_day: today(), p_done: on }).then(function (r) {
          if (r.error) { b.disabled = false; toast('⚠️ ' + sqlHint(r.error)); return; }
          var it = (sharedCache || []).find(function (x) { return String(x.id) === String(id); });
          if (it) {
            it.checks = (it.checks || []).filter(function (c) { return !(c.user_id === S.cloudUserId && c.day === today()); });
            if (on) it.checks.push({ user_id: S.cloudUserId, day: today() });
            var st = sharedStreak(it);
            S.xSharedBonus = S.xSharedBonus || {};
            if (on && st.me && st.fr && S.xSharedBonus[id] !== today()) {
              S.xSharedBonus[id] = today(); addCoins(2, '🤝 ' + it.name); save();
              toast('🤝 ' + L('Ikkalangiz ham bajardingiz!', 'You both did it!', 'Вы оба выполнили!') + ' +2 🪙'); try { confetti(); } catch (e) {}
              feedPost('shared', L('do\'sti bilan birga bajardi', 'completed together with a friend', 'выполнил(а) вместе с другом') + ': ' + it.name + ' (🔥 ' + st.n + ')', '🤝');
            }
          }
          renderShared();
        });
      };
    });
    box.querySelectorAll('[data-shd]').forEach(function (b) {
      b.onclick = function () {
        holdAsk(H(L('Umumiy vazifa o\'chirilsinmi? (ikkalangiz uchun)', 'Delete this shared task? (for both of you)', 'Удалить общую задачу? (для обоих)')), function () {
          supabase.rpc('delete_shared_task', { p_task: b.dataset.shd }).then(function (r) { if (r.error) toast('⚠️ ' + sqlHint(r.error)); loadShared(); });
        }, { icon: '🗑️', title: L("Umumiy vazifani o'chirish", 'Delete shared task', 'Удалить общую задачу') });
      };
    });
  }

  // =========================================================
  // 🚀 HUB sahifasi
  // =========================================================
  var HUB_SECS = [
    ['boss', '🐉', ['Boss', 'Boss', 'Босс']],
    ['shop', '🛍', ['Do\'kon', 'Shop', 'Магазин']],
    ['health', '🧘', ['Salomatlik', 'Wellbeing', 'Самочувствие']],
    ['together', '🤝', ['Birga', 'Together', 'Вместе']],
    ['feed', '📰', ['Lenta', 'Feed', 'Лента']]
  ];
  function renderHub() {
    var v = document.getElementById('view-hub'); if (!v) return;
    // 📥 Inbox — Hub ichidagi alohida ko'rinish (pastdagi IIFE: window.xInbox)
    if (window.xInbox && window.xInbox.isOpen()) { window.xInbox.render(v); return; }
    var sec = S.xHubSec || 'boss';
    if (!HUB_SECS.some(function (x) { return x[0] === sec; })) sec = 'boss'; // eski "Tahlil" bo'limi Statistikaga ko'chdi
    var tools = [['matrix', '▦', L('Matritsa', 'Matrix', 'Матрица')],
      ['stats', '📊', L('Statistika', 'Statistics', 'Статистика')]];
    if (window._isAdmin) tools.push(['admin', '👑', L('Admin', 'Admin', 'Админ')]);
    v.innerHTML = '<div id="x-hub-pomo"></div>' + sectionsGrid() + '<div class="x-hub-tools">' + tools.map(function (t) { return '<button data-tool="' + t[0] + '"><span>' + t[1] + '</span>' + t[2] + '</button>'; }).join('') + '</div>' +
      '<div class="x-hub-nav">' + HUB_SECS.map(function (s) { return '<button class="' + (s[0] === sec ? 'on' : '') + '" data-sec="' + s[0] + '">' + s[1] + ' ' + L(s[2][0], s[2][1], s[2][2]) + '</button>'; }).join('') + '</div>' +
      '<div id="x-hub-body"></div>';
    v.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { ({ matrix: openMatrix, stats: function () { showTab('profile'); try { showProfileSubtab('stats'); } catch (e) {} }, admin: function () { window.openAdminPanel(); } })[b.dataset.tool](); }; });
    v.querySelectorAll('[data-sec]').forEach(function (b) { b.onclick = function () { S.xHubSec = b.dataset.sec; save(); renderHub(); }; });
    bindSections(v);
    try { if (typeof window.pomoSyncHubBar === 'function') window.pomoSyncHubBar(); } catch (e) {}
    renderHubSection(sec, true);
  }
  function renderHubSection(sec, force) {
    var body = document.getElementById('x-hub-body'); if (!body) return;
    if (!force && (S.xHubSec || 'boss') !== sec) return;
    var h = '';
    if (sec === 'boss') {
      try { bossResolve(); } catch (e) {}
      h = bossHubHtml();
    } else if (sec === 'health') {
      var md = (S.moods || {})[today()];
      h = '<button type="button" class="x-card x-mood-card" onclick="openMoodCalendar()"><span class="x-mood-e">' + (md ? md.emoji : '🙂') + '</span><span class="x-mood-t"><b>' + L('Kayfiyat kundaligi', 'Mood journal', 'Дневник настроения') + '</b><span>' +
        (md ? L('Bugun belgilangan', 'Logged today', 'Отмечено сегодня') : L('Bugun qanday? Belgilang', 'How are you today? Log it', 'Как вы сегодня?')) + '</span></span><span class="x-mood-go">›</span></button>';
      h = wellbeingHtml(h);
    } else if (sec === 'shop') {
      h = '<div class="x-card">' + shopHtml() + '</div>';
    } else if (sec === 'together') {
      h = '<div id="fg-together"></div><div id="x-hub-shared"></div>';
    } else if (sec === 'feed') {
      h = '<div id="x-hub-feed"></div>';
    }
    body.innerHTML = h;
    if (sec === 'health') bindWellbeing(body);
    if (sec === 'shop') {
      body.querySelectorAll('[data-shop]').forEach(function (b) { b.onclick = function () { shopBuy(b.dataset.shop); }; });
      body.querySelectorAll('[data-dz-apply]').forEach(function (b) { b.onclick = function () { shopApplyDesign(b.dataset.dzApply); }; });
      body.querySelectorAll('[data-studio-open]').forEach(function (b) { b.onclick = function () { window.xOpenStudio(); }; });
      body.querySelectorAll('[data-shop-cat]').forEach(function (b) {
        b.onclick = function () { var t = document.getElementById('x-shop-sec-' + b.dataset.shopCat); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      });
      body.querySelectorAll('.x-shop-fx').forEach(function (f) { f.onmouseenter = function () { var r = f.getBoundingClientRect(); var it = SHOP.find(function (z) { return z.id === f.dataset.fx; }); if (it) fxBurst(it.v, r.left + r.width / 2, r.top + r.height / 2); }; });
    }
    if (sec === 'boss') bindBossHub(body);
    if (sec === 'together') { if (sharedCache && !force) renderShared(); else loadShared(); }
    if (sec === 'together') { try { if (window.LUFocusgate) window.LUFocusgate.renderTogether(); } catch (e) {} }
    if (sec === 'feed') { if (feedCache && !force) renderFeed(); else loadFeed(); }

  }

  // =========================================================
  // Vazifalar sahifasidagi qo'shimchalar
  // =========================================================
  function renderTasksExtras() {
    try { bossResolve(); } catch (e) {}
    renderBossStrip(false);
    var LB = { focus: L('Fokus', 'Focus', 'Фокус'), matrix: L('Matritsa', 'Matrix', 'Матрица') };
    document.querySelectorAll('.x-tl[data-x]').forEach(function (e) { if (LB[e.dataset.x]) e.textContent = LB[e.dataset.x]; });
    var sc = document.getElementById('x-sleep-card');
    if (sc) { var sh = sleepCardHtml(); if (sc._h !== sh) { sc._h = sh; sc.innerHTML = sh; bindSleep(sc); } }
  }

  // =========================================================
  // ↕️ TOTAL panelidagi saralash turlari
  // =========================================================
  function subCount(t) { try { return (ensureSubtasks(t) || []).length; } catch (e) { return (t.subtasks || []).length; } }
  function coinOf(t) { try { return taskCoinValue(t) || 0; } catch (e) { return t.coins || 0; } }
  var SORTS = {
    color: { icon: '🎨', n: ['Rang', 'Color', 'Цвет'] },
    diff: { icon: '💪', n: ['Qiyinchilik', 'Difficulty', 'Сложность'],
      groups: function () { return [[4, '🟣 ' + L('Epik', 'Epic', 'Эпик')], [3, '🔴 ' + L('Qiyin', 'Hard', 'Сложно')], [2, '🟠 ' + L('O\'rtacha', 'Medium', 'Средне')], [1, '🟢 ' + L('Oson', 'Easy', 'Легко')], [0, '⚪ ' + L('Bepul', 'Free', 'Бесплатно')]]; },
      key: function (t) { var d = t.diff; if (d == null) d = 1; return Math.max(0, Math.min(4, d)); }, desc: true },
    time: { icon: '🕒', n: ['Vaqt', 'Time', 'Время'],
      groups: function () { return [[0, '🌅 ' + L('Ertalab (12:00 gacha)', 'Morning (before 12)', 'Утро (до 12)')], [1, '☀️ ' + L('Kunduzi (12–17)', 'Afternoon (12–17)', 'День (12–17)')], [2, '🌙 ' + L('Kechqurun (17 dan)', 'Evening (17+)', 'Вечер (с 17)')], [3, '⏳ ' + L('Vaqtsiz', 'No time', 'Без времени')]]; },
      key: function (t) { var m = hm2m(t.startTime); return m == null ? 3 : m < 720 ? 0 : m < 1020 ? 1 : 2; },
      fine: function (t) { var m = hm2m(t.startTime); return m == null ? 9999 : m; } },
    subs: { icon: '☑️', n: ['Sub-tasklar', 'Subtasks', 'Подзадачи'],
      groups: function () { return [[2, '📚 ' + L('5 va undan ko\'p', '5 or more', '5 и больше')], [1, '📝 1–4'], [0, '▫️ ' + L('Sub-tasksiz', 'No subtasks', 'Без подзадач')]]; },
      key: function (t) { var n = subCount(t); return n >= 5 ? 2 : n >= 1 ? 1 : 0; }, fine: function (t) { return -subCount(t); }, desc: true },
    imp: { icon: '⭐', n: ['Muhimlik', 'Importance', 'Важность'],
      groups: function () { return [[0, '📌 ' + L('Muhim (pin)', 'Pinned', 'Закреплённые')], [1, '🔥 ' + L('Muhim va shoshilinch', 'Urgent & important', 'Срочно и важно')], [2, '📅 ' + L('Muhim', 'Important', 'Важно')], [3, '⚡ ' + L('Shoshilinch', 'Urgent', 'Срочно')], [5, '▫️ ' + L('Oddiy', 'Normal', 'Обычные')], [4, '🗑 ' + L('Muhim emas', 'Not important', 'Неважно')]]; },
      key: function (t) { if (t.pinned) return 0; return t.quad ? t.quad : 5; },
      rank: function (k) { return [0, 1, 2, 3, 5, 4].indexOf(k); } },
    coins: { icon: '🪙', n: ['Tanga', 'Coins', 'Монеты'], key: function (t) { return coinOf(t); }, desc: true, dyn: true },
    name: { icon: '🔤', n: ['Nom (A–Z)', 'Name (A–Z)', 'Имя (А–Я)'], key: function () { return 0; }, fine: function (t) { return String(t.name || '').toLowerCase(); } }
  };
  var SORT_ORDER = ['color', 'diff', 'time', 'subs', 'imp', 'coins', 'name'];
  function sortMode() { return SORTS[S.taskSortMode] ? S.taskSortMode : 'color'; }
  function applySortMode(mode) {
    var M = SORTS[mode]; if (!M || mode === 'color') return;
    try { ensureFullTaskOrder(); } catch (e) {}
    var byId = {}; S.tasks.forEach(function (t) { byId[t.id] = t; });
    var rev = !!(S.taskSortRev && S.taskSortRev[mode]);
    var rank = function (t) { var k = M.key(t); if (M.rank) k = M.rank(k); return M.desc ? -k : k; };
    var arr = S.taskOrder.map(function (id, i) { return { id: id, i: i, t: byId[id] }; });
    arr.sort(function (a, b) {
      if (!a.t || !b.t) return (a.t ? -1 : 0) - (b.t ? -1 : 0) || a.i - b.i;
      var ra = rank(a.t), rb = rank(b.t);
      if (ra !== rb) return rev ? rb - ra : ra - rb;
      if (M.fine) { var fa = M.fine(a.t), fb = M.fine(b.t); if (fa !== fb) return (fa < fb ? -1 : 1) * (rev ? -1 : 1); }
      return a.i - b.i;
    });
    S.taskOrder = arr.map(function (x) { return x.id; });
  }
  function setSortMode(mode) {
    if (!SORTS[mode]) return;
    S.taskSortRev = S.taskSortRev || {};
    if (sortMode() === mode && mode !== 'color') S.taskSortRev[mode] = !S.taskSortRev[mode];
    S.taskSortMode = mode;
    if (mode === 'color') { try { applyColorSortOrder(); } catch (e) {} } else applySortMode(mode);
    save(); render();
    var M = SORTS[mode];
    toast('↕️ ' + M.icon + ' ' + L(M.n[0], M.n[1], M.n[2]) + (mode !== 'color' && S.taskSortRev[mode] ? ' ↑' : mode !== 'color' ? ' ↓' : ''));
  }
  window.xSetSortMode = setSortMode;
  window.xRenderSortPanel = function (tasks) {
    var bar = document.getElementById('xs-modes'), cw = document.getElementById('xs-color-wrap'), gw = document.getElementById('xs-groups');
    if (!bar || !cw || !gw) return;
    var mode = sortMode(), rev = !!(S.taskSortRev && S.taskSortRev[mode]);
    bar.innerHTML = '<div class="xs-lbl">↕️ ' + L('Saralash', 'Sort by', 'Сортировка') + '</div><div class="xs-chips">' + SORT_ORDER.map(function (k) {
      var M = SORTS[k];
      return '<button type="button" class="xs-chip' + (k === mode ? ' on' : '') + '" onclick="xSetSortMode(\'' + k + '\')">' + M.icon + ' ' + L(M.n[0], M.n[1], M.n[2]) + (k === mode && k !== 'color' ? ' <i>' + (rev ? '↑' : '↓') + '</i>' : '') + '</button>';
    }).join('') + '</div>';
    if (mode === 'color') { cw.style.display = ''; gw.style.display = 'none'; return; }
    cw.style.display = 'none'; gw.style.display = '';
    var M = SORTS[mode], list = tasks || [];
    var groups;
    if (M.dyn) {
      var vals = {}; list.forEach(function (t) { vals[coinOf(t)] = 1; });
      groups = Object.keys(vals).map(Number).sort(function (a, b) { return b - a; }).map(function (v) { return [v, '🪙 ' + v + ' ' + L('tangalik', 'coins', 'монет')]; });
    } else if (M.groups) groups = M.groups();
    else groups = [[0, '🔤 ' + L('Barcha vazifalar', 'All tasks', 'Все задачи')]];
    if (rev) groups = groups.slice().reverse();
    var h = '<div class="xs-gt">' + M.icon + ' ' + L('Bugungi vazifalar', 'Today\'s tasks', 'Задачи на сегодня') + ' — ' + L(M.n[0], M.n[1], M.n[2]).toLowerCase() + ' ' + L('bo\'yicha', '', '') + '</div>';
    groups.forEach(function (g) {
      var inG = list.filter(function (t) { return M.key(t) === g[0]; });
      if (!inG.length && M.dyn) return;
      var dn = inG.filter(function (t) { return t.done; }).length;
      var coins = inG.reduce(function (a, t) { return a + coinOf(t); }, 0);
      var pct = inG.length ? Math.round(dn / inG.length * 100) : 0;
      h += '<div class="xs-row' + (inG.length ? '' : ' empty') + '"><div class="xs-row-t"><span>' + g[1] + '</span><b>' + dn + '/' + inG.length + '</b></div>' +
        '<div class="xs-bar"><i style="width:' + pct + '%"></i></div>' +
        (inG.length ? '<div class="xs-row-s">' + inG.slice(0, 4).map(function (t) { return '<span class="' + (t.done ? 'd' : '') + '">' + (t.emoji ? t.emoji + ' ' : '') + H(t.name) + '</span>'; }).join('') + (inG.length > 4 ? '<span>+' + (inG.length - 4) + '</span>' : '') + (coins ? '<em>' + coins + ' 🪙</em>' : '') + '</div>' : '') + '</div>';
    });
    h += '<div class="xs-hint">' + L('Vazifalar ro\'yxati shu tartibda saralandi. Qayta bossangiz — teskari tartib.', 'Your task list is sorted this way. Tap again to reverse.', 'Список задач отсортирован. Нажмите ещё раз — обратный порядок.') + '</div>';
    gw.innerHTML = h;
  };

  // 📊 Profil → Statistika: yillik faollik, samarali vaqt, bog'liqlik (avval Hub'da edi)
  window.xRenderStatsInsights = safe(function () {
    var a = document.getElementById('xst-heatmap'), b = document.getElementById('xst-productive'), c = document.getElementById('xst-links');
    var wl = document.querySelector('.xst-wrap-lbl'); if (wl) wl.textContent = L('Oylik yakun', 'Monthly wrap', 'Итоги месяца');
    var card = function (icon, title, body) { return '<div class="x-card-h"><b>' + icon + ' ' + title + '</b></div>' + body; };
    if (a) { a.innerHTML = card('🔥', L('Yillik faollik', 'Yearly activity', 'Активность за год'), heatmapHtml()); var sc = a.querySelector('.x-hm-scroll'); if (sc) sc.scrollLeft = sc.scrollWidth; }
    if (b) b.innerHTML = card('⏰', L('Eng samarali vaqt', 'Productive time', 'Продуктивное время'), productiveHtml());
    if (c) c.innerHTML = card('🔗', L('Odatlar bog\'liqligi', 'Habit links', 'Связи привычек'), correlationHtml());
    var sl = document.getElementById('xst-sleep');
    if (sl) {
      var w = sleepWeek();
      sl.innerHTML = card('😴', L('Uyqu — 7 kun', 'Sleep — 7 days', 'Сон — 7 дней'), bars(w.vals, w.lbls, 6, 'h') +
        '<div class="x-sub">' + L('O\'rtacha', 'Average', 'Среднее') + ': <b>' + (w.avg != null ? fmtH(w.avg) : '—') + '</b>' + (w.cnt ? ' · ' + w.cnt + '/7 ' + L('kun', 'days', 'дн.') : '') + ' · ' + L('Tavsiya: 7–9 soat', 'Recommended: 7–9 h', 'Рекомендуется 7–9 ч') + '</div>');
    }
  });

  // =========================================================
  // 📊 ADMIN DASHBOARD (faqat admins jadvalidagi foydalanuvchilar uchun)
  // =========================================================
  function adFmt(n) { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(n); }
  function adDelta(cur, prev) {
    cur = Number(cur) || 0; prev = Number(prev) || 0;
    if (!prev) return cur ? '<span class="ad-delta up">▲ ' + L('yangi', 'new', 'новое') + '</span>' : '';
    var p = Math.round((cur - prev) / prev * 100);
    return '<span class="ad-delta ' + (p >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '▲' : '▼') + ' ' + Math.abs(p) + '%</span>';
  }
  function adTile(icon, label, val, sub) {
    return '<div class="ad-tile"><div class="ad-tile-l">' + icon + ' ' + label + '</div><div class="ad-tile-v">' + val + '</div>' + (sub ? '<div class="ad-tile-s">' + sub + '</div>' : '') + '</div>';
  }
  var MON = function (ym) { var m = +ym.slice(5, 7) - 1; try { return String(getMonthsArr()[m]).slice(0, 3); } catch (e) { return ym.slice(5); } };
  // Ustunli grafik (bitta seriya, bitta rang): hover'da qiymat
  function adBars(list, key, labelFn, every) {
    var mx = Math.max.apply(null, list.map(function (x) { return x.n; }).concat([1]));
    return '<div class="ad-bars">' + list.map(function (x, i) {
      var lbl = labelFn(x[key]);
      return '<div class="ad-bar" data-tip="' + H(lbl + ': ' + x.n) + '"><i style="height:' + Math.max(x.n ? 4 : 1, x.n / mx * 100) + '%"></i>' +
        '<span>' + ((every && i % every !== 0 && i !== list.length - 1) ? '' : H(lbl)) + '</span></div>';
    }).join('') + '</div>';
  }
  // Gorizontal ro'yxat-chiziqlar (kategoriyalar)
  function adList(list, labelFn, max) {
    list = (list || []).slice(0, max || 12);
    if (!list.length) return '<div class="ad-empty">— ' + L('ma\'lumot yo\'q', 'no data', 'нет данных') + ' —</div>';
    var tot = list.reduce(function (a, x) { return a + (Number(x.n) || 0); }, 0) || 1, mx = Math.max.apply(null, list.map(function (x) { return x.n; }));
    return list.map(function (x) {
      var pct = Math.round(x.n / tot * 100);
      return '<div class="ad-row"><div class="ad-row-t"><span>' + labelFn(x.k) + '</span><b>' + x.n + ' <em>' + pct + '%</em></b></div><div class="ad-row-b"><i style="width:' + (x.n / mx * 100) + '%"></i></div></div>';
    }).join('');
  }
  var notSet = function () { return '<span class="ad-dim">— ' + L('ko\'rsatilmagan', 'not set', 'не указано') + '</span>'; };
  var REF = { ai: '🤖 AI', youtube: '▶️ YouTube', instagram: '📸 Instagram', friend: '👥 ' + L('Do\'st / oila', 'Friend / family', 'Друг / семья'), other: '✍️ ' + L('Boshqa', 'Other', 'Другое') };
  var SUBJ = { ielts: '🗣 IELTS', sat: '🎯 SAT', cefr: '📘 CEFR', other: '✨ ' + L('Boshqa', 'Other', 'Другое') };
  var DEV = { mobile: '📱 ' + L('Telefon', 'Phone', 'Телефон'), tablet: '📲 ' + L('Planshet', 'Tablet', 'Планшет'), desktop: '💻 ' + L('Kompyuter', 'Computer', 'Компьютер') };
  var LANG = { uz: '🇺🇿 O\'zbek', en: '🇬🇧 English', ru: '🇷🇺 Русский' };
  function adCountry(k) { if (!k) return notSet(); try { return countryFlagImg(k, 14) + ' ' + H(countryName(k) || k); } catch (e) { return H(k); } }
  function adCard(title, body, cls) { return '<div class="ad-card ' + (cls || '') + '"><div class="ad-card-t">' + title + '</div>' + body + '</div>'; }

  function renderAdminDashboard(box, d) {
    var T = d.totals || {}, E = d.engagement || {}, Sx = d.social || {};
    var sm = d.signups_by_month || [], am = d.active_by_month || [], sd = d.signups_by_day || [], ad = d.active_by_day || [];
    var thisM = am.length ? am[am.length - 1].n : 0, prevM = am.length > 1 ? am[am.length - 2].n : 0;
    var thisS = sm.length ? sm[sm.length - 1].n : 0, prevS = sm.length > 1 ? sm[sm.length - 2].n : 0;
    var dayLbl = function (v) { var p = String(v).split('-'); return +p[2] + '.' + p[1]; };
    var h = (window.LUBlocks ? window.LUBlocks.adminHeroHtml(d) : '') + '<div class="ad-kpis">' +
      adTile('👥', L('Jami foydalanuvchi', 'Total users', 'Всего пользователей'), adFmt(T.users), adDelta(T.new_30d, T.new_prev_30d) + ' ' + L('30 kunda', 'in 30d', 'за 30 дн') + ' +' + (T.new_30d || 0)) +
      adTile('🔥', L('Bugun faol', 'Active today', 'Активны сегодня'), adFmt(T.dau), 'WAU ' + adFmt(T.wau) + ' · MAU ' + adFmt(T.mau)) +
      adTile('📆', L('Bu oy faol', 'Active this month', 'Активны в этом месяце'), adFmt(thisM), adDelta(thisM, prevM) + ' ' + L('o\'tgan oyga nisbatan', 'vs last month', 'к прошлому месяцу')) +
      adTile('🆕', L('Bu oy qo\'shildi', 'Joined this month', 'Новых в этом месяце'), adFmt(thisS), adDelta(thisS, prevS) + ' · ' + L('bugun', 'today', 'сегодня') + ' +' + (T.new_today || 0)) +
      adTile('🔐', L('Ro\'yxatdan o\'tgan', 'Signed up', 'Зарегистрированы'), adFmt(T.confirmed), L('tasdiqlangan', 'confirmed', 'подтверждено') + ' · ' + L('kirgan', 'signed in', 'входили') + ' ' + adFmt(T.ever_signed_in) + (T.telegram_bot != null ? ' · ✈️ ' + L('bot', 'bot', 'бот') + ' ' + adFmt(T.telegram_bot) : '')) +
      adTile('🔁', L('7 kunlik qaytish', '7-day retention', 'Удержание 7 дн'), d.retention_7d == null ? '—' : d.retention_7d + '%', L('7+ kun oldin qo\'shilib, shu hafta faol', 'joined 7+ days ago & active this week', 'пришли 7+ дн назад и активны')) +
      '</div>';
    h += '<div class="ad-grid">' +
      adCard('📈 ' + L('Oylik faol foydalanuvchilar', 'Monthly active users', 'Активные по месяцам'), adBars(am, 'm', MON)) +
      adCard('🆕 ' + L('Oylik yangi foydalanuvchilar', 'New users per month', 'Новые по месяцам'), adBars(sm, 'm', MON)) +
      adCard('🔥 ' + L('Kunlik faollik (30 kun)', 'Daily active (30 days)', 'Активность по дням (30 дн)'), adBars(ad, 'd', dayLbl, 5)) +
      adCard('👤 ' + L('Kunlik ro\'yxatdan o\'tish (30 kun)', 'Daily sign-ups (30 days)', 'Регистрации по дням (30 дн)'), adBars(sd, 'd', dayLbl, 5)) +
      '</div>';
    h += '<div class="ad-grid">' +
      adCard('🌍 ' + L('Davlatlar', 'Countries', 'Страны'), adList(d.by_country, adCountry, 12)) +
      adCard('🗣 ' + L('Ilova tili', 'App language', 'Язык приложения'), adList(d.by_language, function (k) { return k ? (LANG[k] || H(k.toUpperCase())) : notSet(); })) +
      adCard('📣 ' + L('Qayerdan bilishgan', 'How they found us', 'Откуда узнали'), adList(d.by_referral, function (k) { return k ? (REF[k] || H(k)) : notSet(); }) +
        ((d.referral_other || []).length ? '<div class="ad-sub-t">✍️ ' + L('"Boshqa" javoblari', '"Other" answers', 'Ответы «Другое»') + '</div>' + adList(d.referral_other, function (k) { return H(k); }, 8) : '')) +
      adCard('🎯 ' + L('Qaysi fan uchun', 'Studying for', 'Для какого предмета'), adList(d.by_subject, function (k) { return SUBJ[k] || H(k); }) +
        ((d.goal_other || []).length ? '<div class="ad-sub-t">✍️ ' + L('"Boshqa maqsad"', '"Other goal"', '«Другая цель»') + '</div>' + adList(d.goal_other, function (k) { return H(k); }, 8) : '')) +
      adCard('🔐 ' + L('Kirish usuli', 'Sign-in method', 'Способ входа'), adList(d.by_provider, function (k) { return k === 'google' ? '🔵 Google' : k === 'telegram' ? '✈️ Telegram' : k === 'email' ? '📧 Email' : H(k); })) +
      adCard('📱 ' + L('Qurilma', 'Device', 'Устройство'), adList(d.by_device, function (k) { return k ? (DEV[k] || H(k)) : notSet(); })) +
      adCard('⭐ ' + L('Darajalar', 'Levels', 'Уровни'), adList(d.by_level, function (k) { return 'Lv ' + k + (k >= 8 ? '+' : ''); }, 8)) +
      '</div>';
    h += '<div class="ad-grid">' +
      adCard('⚡ ' + L('Faollik', 'Engagement', 'Вовлечённость'), '<div class="ad-mini">' +
        '<div><b>' + adFmt(E.tasks_total) + '</b><span>✅ ' + L('bajarilgan vazifa', 'tasks done', 'задач выполнено') + '</span></div>' +
        '<div><b>' + (E.tasks_avg || 0) + '</b><span>📊 ' + L('o\'rtacha / odam', 'avg / user', 'в среднем') + '</span></div>' +
        '<div><b>' + (E.streak_avg || 0) + '</b><span>🔥 ' + L('o\'rtacha streak', 'avg streak', 'средний стрик') + '</span></div>' +
        '<div><b>' + (E.streak_max || 0) + '</b><span>🏆 ' + L('rekord streak', 'best streak', 'рекорд') + '</span></div>' +
        '<div><b>' + adFmt(E.pomo_minutes) + '</b><span>🍅 ' + L('Pomodoro daqiqa', 'Pomodoro min', 'мин Pomodoro') + '</span></div>' +
        '<div><b>' + adFmt(E.coins_total) + '</b><span>🪙 ' + L('jami tanga', 'coins earned', 'монет всего') + '</span></div>' +
        '<div><b>' + adFmt(E.gems_total) + '</b><span>💎 ' + L('jami gem', 'gems', 'гемов') + '</span></div>' +
        '<div><b>' + adFmt(E.xp_avg) + '</b><span>⭐ ' + L('o\'rtacha XP', 'avg XP', 'средний XP') + '</span></div></div>') +
      adCard('🤝 ' + L('Ijtimoiy', 'Social', 'Социальное'), '<div class="ad-mini">' +
        '<div><b>' + (Sx.friendships || 0) + '</b><span>👥 ' + L('do\'stlik', 'friendships', 'дружб') + '</span></div>' +
        '<div><b>' + (Sx.friend_requests_pending || 0) + '</b><span>📨 ' + L('kutilayotgan so\'rov', 'pending requests', 'заявок') + '</span></div>' +
        '<div><b>' + (Sx.duels_active || 0) + ' / ' + (Sx.duels_total || 0) + '</b><span>⚔️ ' + L('duel (faol/jami)', 'duels (active/all)', 'дуэли') + '</span></div>' +
        '<div><b>' + (Sx.parties || 0) + '</b><span>🎉 ' + L('partiya', 'parties', 'пати') + '</span></div>' +
        '<div><b>' + (Sx.world_parties_active || 0) + '</b><span>🌍 World Party</span></div>' +
        '<div><b>' + (Sx.shared_tasks || 0) + '</b><span>🤝 ' + L('umumiy vazifa', 'shared tasks', 'общих задач') + '</span></div>' +
        '<div><b>' + (Sx.feed_posts_7d || 0) + '</b><span>📰 ' + L('lenta (7 kun)', 'feed posts (7d)', 'постов (7 дн)') + '</span></div>' +
        '<div><b>' + (Sx.feedback_new || 0) + '</b><span>💬 ' + L('yangi fikr', 'new feedback', 'новых отзывов') + '</span></div></div>') +
      '</div>';
    var tbl = function (rows, cols) {
      return '<div class="ad-tbl-w"><table class="ad-tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + c[1](r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    };
    var when = function (v) { if (!v) return '—'; try { return new Date(v).toLocaleDateString(); } catch (e) { return String(v).slice(0, 10); } };
    h += '<div class="ad-grid">' +
      adCard('🏆 ' + L('Eng faol foydalanuvchilar', 'Top users', 'Топ пользователей'), tbl(d.top_users || [], [
        ['#', function (r) { return (d.top_users.indexOf(r) + 1); }], [L('Ism', 'Name', 'Имя'), function (r) { return H(r.name || '—'); }],
        ['Lv', function (r) { return r.level || 1; }], ['XP', function (r) { return adFmt(r.xp); }], ['✅', function (r) { return r.tasks || 0; }], ['🔥', function (r) { return r.streak || 0; }]])) +
      adCard('🆕 ' + L('So\'nggi qo\'shilganlar', 'Recent sign-ups', 'Недавние регистрации'), tbl(d.recent_users || [], [
        [L('Ism', 'Name', 'Имя'), function (r) { return H(r.name || '—'); }], [L('Davlat', 'Country', 'Страна'), function (r) { return r.country ? adCountry(r.country) : '—'; }],
        [L('Qo\'shilgan', 'Joined', 'Дата'), function (r) { return when(r.created_at); }], [L('Oxirgi faollik', 'Last active', 'Активность'), function (r) { return when(r.last_active); }],
        ['', function (r) { return r.provider === 'google' ? '🔵' : r.provider === 'telegram' ? '✈️' : '📧'; }]])) +
      '</div>';
    box.innerHTML = h;
    try { if (window.LUBlocks) window.LUBlocks.bindAdminHero(box); } catch (e) {}
    // tooltip
    var tip = document.getElementById('ad-tip');
    box.querySelectorAll('[data-tip]').forEach(function (el) {
      el.onmouseenter = el.onfocus = function () { if (!tip) return; tip.textContent = el.dataset.tip; tip.style.display = 'block'; var r = el.getBoundingClientRect(); tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = (r.top - 8) + 'px'; };
      el.onmouseleave = el.onblur = function () { if (tip) tip.style.display = 'none'; };
      el.ontouchstart = function () { el.onmouseenter(); setTimeout(function () { if (tip) tip.style.display = 'none'; }, 1500); };
    });
  }

  // admin.js (yangi panel) "Statistika" bo'limida shu chizgichdan foydalanadi
  window._adRenderDashboard = renderAdminDashboard;
  window.openAdminPanel = async function () {
    if (!cloudOk()) { toast('🔐 ' + L('Avval hisobingizga kiring', 'Sign in first', 'Сначала войдите')); return; }
    var old = document.getElementById('admin-panel-modal'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'admin-panel-modal'; ov.className = 'ad-ov';
    ov.innerHTML = '<div class="ad-box"><div class="ad-head"><div><div class="ad-title">📊 ' + L('Admin paneli', 'Admin dashboard', 'Панель администратора') + '</div><div class="ad-upd" id="ad-upd"></div></div>' +
      '<div class="ad-head-b"><button class="x-btn ghost sm" id="ad-refresh">↻</button><button class="x-close" id="ad-close" aria-label="close" style="position:static">✕</button></div></div>' +
      '<div class="ad-tabs"><button class="ad-tab on" data-adt="stats">📊 ' + L('Statistika', 'Stats', 'Статистика') + '</button>' +
      '<button class="ad-tab" data-adt="fb">📨 ' + L('Fikrlar', 'Feedback', 'Отзывы') + ' <span class="ad-tab-n" id="ad-fb-n"></span></button></div>' +
      '<div id="ad-body"><div class="ad-empty">⏳ ' + L('Yuklanmoqda...', 'Loading...', 'Загрузка...') + '</div></div>' +
      '<div class="ad-card" id="ad-fb-wrap" style="display:none"><div id="admin-feedback-box"></div></div></div><div id="ad-tip" class="ad-tip"></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search); };
    ov.querySelector('#ad-close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var load = async function () {
      var body = ov.querySelector('#ad-body');
      var r = await supabase.rpc('get_admin_dashboard');
      if (r.error) { body.innerHTML = '<div class="ad-empty" style="color:#F87171">⚠️ ' + H(r.error.message) + '</div>'; return; }
      renderAdminDashboard(body, r.data || {});
      var u = ov.querySelector('#ad-upd'); if (u) u.textContent = L('Yangilangan', 'Updated', 'Обновлено') + ': ' + new Date().toLocaleTimeString();
    };
    var showTabAd = function (t) {
      ov.querySelectorAll('.ad-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.adt === t); });
      ov.querySelector('#ad-body').style.display = t === 'stats' ? '' : 'none';
      ov.querySelector('#ad-fb-wrap').style.display = t === 'fb' ? '' : 'none';
    };
    ov.querySelectorAll('.ad-tab').forEach(function (b) { b.onclick = function () { showTabAd(b.dataset.adt); }; });
    // Yangi (o'qilmagan) fikrlar soni — bo'lsa, darhol "Fikrlar" bo'limini ochamiz
    var countNew = function (open) {
      supabase.rpc('admin_list_feedback', { p_status: 'new', p_limit: 500 }).then(function (r) {
        var n = (!r.error && Array.isArray(r.data)) ? r.data.length : 0;
        var el = ov.querySelector('#ad-fb-n'); if (el) el.textContent = n ? String(n) : '';
        if (open && n) showTabAd('fb');
      });
    };
    ov.querySelector('#ad-refresh').onclick = function () { load(); countNew(false); try { adminRenderFeedback(); } catch (e) {} };
    load();
    try { if (typeof adminRenderFeedback === 'function') adminRenderFeedback('new'); } catch (e) {}
    countNew(true);
  };

  // Admin bo'lsa — Profil → Sozlamalar va Hub'da "Admin paneli" tugmasi chiqadi
  var _adminChecked = false;
  function adminButtonCheck() {
    if (_adminChecked || !cloudOk()) return;
    _adminChecked = true;
    supabase.rpc('am_i_admin').then(function (r) {
      if (r.error || r.data !== true) return;
      window._isAdmin = true;
      var host = document.getElementById('profile-subtab-settings');
      if (host && !document.getElementById('ad-open-btn')) {
        var b = document.createElement('button'); b.id = 'ad-open-btn'; b.className = 'ad-open-btn'; b.type = 'button';
        b.innerHTML = '📊 ' + L('Admin paneli — statistika', 'Admin dashboard — statistics', 'Панель администратора — статистика');
        b.onclick = function () { window.openAdminPanel(); };
        host.insertBefore(b, host.firstChild);
      }
      try { renderHub(); } catch (e) {}
    });
  }
  setInterval(function () { try { adminButtonCheck(); } catch (e) {} }, 5000);

  // =========================================================
  // 🧭 ASOSIY NAVIGATSIYA: 5 ta bo'lim, qolganlari Hub → "Bo'limlar"
  // =========================================================
  var MAIN_TABS = ['tasks', 'goals', 'hub', 'rewards', 'profile'];
  var MOVED_TABS = ['chest', 'reyting', 'ielts', 'sat', 'cefr', 'pomo', 'blocker'];
  function tabAvailable(id) {
    var t = document.getElementById('tab-' + id);
    return !!(t && t.style.display !== 'none');
  }
  // =========================================================
  // 🧲 Bo'limlar va asosiy menyu — ushlab turib suring (drag & swap):
  //   • Hub → "Bo'limlar" ichida joylarini almashtirish
  //   • bo'limni asosiy menyuga (chap panel / pastki panel) qo'yish va u yerdan qaytarib olish
  //   • Vazifalar, Profil va Hub doim asosiy menyuda qoladi
  // Holat: S.xNav = { nav: [id...], secs: [id...] } — bulut orqali sinxronlanadi
  // =========================================================
  var NAV_LOCK = ['tasks', 'profile', 'hub'];
  var NAV_MAX = 7;
  function navItems() {
    var all = [
      ['tasks', '📋', L('Vazifalar', 'Tasks', 'Задачи'), function () { showTab('tasks'); }],
      ['goals', '🎯', L('Maqsadlar', 'Goals', 'Цели'), function () { showTab('goals'); }],
      ['hub', '🚀', 'Hub', function () { if (window.xInbox) window.xInbox.close(true); showTab('hub'); }],
      ['rewards', '🎁', L('Mukofot', 'Rewards', 'Награды'), function () { showTab('rewards'); }],
      ['profile', '👤', L('Profil', 'Profile', 'Профиль'), function () { showTab('profile'); }],
      ['inbox', '📥', 'Inbox', function () { showTab('hub'); if (window.xInbox) window.xInbox.open(); }],
      ['blocker', '🔒', 'Focusgate', function () { showTab('blocker'); }],
      ['pomo', '🍅', L('Pomodoro', 'Pomodoro', 'Pomodoro'), function () { pomoOpenModal(); }],
      ['reyting', '🏆', L('Reyting', 'Leaderboard', 'Рейтинг'), function () { showTab('reyting'); }],
      ['friends', '👥', L('Do\'stlar', 'Friends', 'Друзья'), function () { openFriendsModal(); }],
      ['clans', '🛡', L('Klanlar', 'Clans', 'Кланы'), function () { openClans(); }],
      ['invite', '🎁', L('Taklif qil', 'Invite', 'Пригласить'), function () { openReferral(); }],
      ['chest', '🎲', 'Chest', function () { showTab('chest'); }],
      ['spin', '🎰', 'Spin', function () { showTab('spin'); }],
      ['ielts', '📊', 'IELTS', function () { showTab('ielts'); }],
      ['sat', '📐', 'SAT', function () { showTab('sat'); }],
      ['cefr', '📘', 'CEFR', function () { showTab('cefr'); }],
      ['secret', '🕵️', L('Shaxsiy nazorat', 'Personal check', 'Личный контроль'), function () { showTab('secret'); }]
    ];
    var ok = all.filter(function (x) {
      if (['tasks', 'goals', 'hub', 'rewards', 'profile', 'friends', 'spin', 'invite', 'clans'].indexOf(x[0]) !== -1) return true;
      if (x[0] === 'inbox') return !!window.xInbox;
      if (x[0] === 'secret') return !!S.personalCheckEnabled;
      return tabAvailable(x[0]);
    });
    var map = {}; ok.forEach(function (x) { map[x[0]] = { id: x[0], icon: x[1], label: x[2], act: x[3] }; });
    return { list: ok.map(function (x) { return x[0]; }), map: map };
  }
  function navState() { var x = S.xNav && typeof S.xNav === 'object' ? S.xNav : {}; return { nav: Array.isArray(x.nav) ? x.nav.slice() : null, secs: Array.isArray(x.secs) ? x.secs.slice() : [] }; }
  // Asosiy menyu ro'yxati (tartib bilan)
  function navList() {
    var it = navItems(), st = navState();
    var def = document.documentElement.classList.contains('layout-desktop') ? ['profile', 'tasks', 'rewards', 'goals', 'hub'] : MAIN_TABS.slice();
    var l = (st.nav || def).filter(function (id, i, a) { return it.map[id] && a.indexOf(id) === i; });
    NAV_LOCK.forEach(function (k) { if (l.indexOf(k) === -1) l.push(k); });
    return l;
  }
  // Hub → "Bo'limlar" ro'yxati (menyuda bo'lmaganlar, foydalanuvchi tartibida)
  function secList() {
    var it = navItems(), nav = navList(), st = navState();
    var rest = it.list.filter(function (id) { return nav.indexOf(id) === -1; });
    var ordered = st.secs.filter(function (id) { return rest.indexOf(id) !== -1; });
    rest.forEach(function (id) { if (ordered.indexOf(id) === -1) ordered.push(id); });
    return ordered;
  }
  function navSave(nav, secs) {
    S.xNav = { nav: nav, secs: secs };
    try { save(); } catch (e) {}
    applyNav();
    try { if (document.documentElement.getAttribute('data-tab') === 'hub' && !(window.xInbox && window.xInbox.isOpen())) renderHub(); } catch (e) {}
  }
  // Chap panel (#tabs-bar) va pastki panelni ro'yxatga moslaymiz
  function applyNav() {
    var nav = navList(), it = navItems(), bar = document.getElementById('tabs-bar');
    if (bar) {
      bar.querySelectorAll('.tab.x-navpin').forEach(function (b) { if (nav.indexOf(b.dataset.xnav) === -1) b.remove(); });
      Array.prototype.forEach.call(bar.querySelectorAll('.tab[id^="tab-"]:not(.x-navpin)'), function (t) {
        var id = t.id.slice(4); t.setAttribute('data-xnav', id);
        t.classList.toggle('x-moved', nav.indexOf(id) === -1);
      });
      nav.forEach(function (id) {
        var el = document.getElementById('tab-' + id);
        if (!el || !bar.contains(el)) {
          el = bar.querySelector('.x-navpin[data-xnav="' + id + '"]');
          if (!el) {
            var m = it.map[id]; if (!m) return;
            el = document.createElement('button'); el.type = 'button'; el.className = 'tab x-navpin'; el.setAttribute('data-xnav', id);
            el.textContent = m.icon + ' ' + m.label;
            el.onclick = function () { var x = navItems().map[id]; if (x) x.act(); };
          }
        }
        bar.appendChild(el); // tartib bo'yicha
      });
    }
    renderBottomNav();
  }
  function markMovedTabs() { applyNav(); }
  function sectionsGrid() {
    var it = navItems(), items = secList().map(function (id) { return it.map[id]; });
    window._xSecActions = {}; items.forEach(function (x) { window._xSecActions[x.id] = x.act; });
    return '<div class="x-secs-t">🧩 ' + L('Bo\'limlar', 'Sections', 'Разделы') + '<small class="x-secs-hint">✋ ' + L('Ushlab turib suring: joyini almashtiring yoki menyuga qo\'ying', 'Hold & drag: swap places or drop into the menu', 'Удерживайте и тяните: меняйте местами или перенесите в меню') + '</small></div><div class="x-secs" data-xdz="secs">' + items.map(function (x) {
      return '<button type="button" class="x-sec" data-sec-go="' + x.id + '" data-xdrag="sec"><span>' + x.icon + '</span>' + x.label +
        (x.id === 'pomo' ? '<em class="x-pomo-live" aria-hidden="true"></em>' : '') +
        (x.id === 'friends' ? (function () { var n = 0; try { var F = S.friends || {}, seen = F.seenRequestIds || {}; n = (F.incoming || []).filter(function (r) { return !seen[r.id]; }).length; } catch (e) {} return '<em class="x-sec-badge" id="x-hub-fr-badge"' + (n ? '' : ' style="display:none"') + '>' + n + '</em>'; })() : '') +
        (x.id === 'inbox' ? (function () { var n = 0; try { n = window.xInbox.openCount(); } catch (e) {} return n ? '<em class="x-sec-badge" aria-label="' + n + '">' + (n > 99 ? '99+' : n) + '</em>' : ''; })() : '') + '</button>';
    }).join('') + '</div>';
  }
  function bindSections(root) {
    root.querySelectorAll('[data-sec-go]').forEach(function (b) { b.onclick = function () { if (DG.justDropped) return; var f = (window._xSecActions || {})[b.dataset.secGo]; if (f) f(); }; });
    try { if (window.pomoSyncRunIndicator) window.pomoSyncRunIndicator(); } catch (e) {}
  }
  // 📱 Telefonda pastki navigatsiya paneli
  function buildBottomNav() {
    if (document.getElementById('x-bnav')) return;
    var nav = document.createElement('nav'); nav.id = 'x-bnav'; nav.setAttribute('aria-label', 'main');
    document.body.appendChild(nav);
    renderBottomNav();
  }
  function renderBottomNav() {
    var nav = document.getElementById('x-bnav'); if (!nav) return;
    var list = navList(), it = navItems();
    var cur = document.documentElement.getAttribute('data-tab') || 'tasks';
    if (cur === 'secret' && list.indexOf('secret') === -1) cur = 'profile';
    if (list.indexOf(cur) === -1) cur = 'hub';
    nav.setAttribute('data-xdz', 'nav');
    nav.classList.toggle('many', list.length > 5);
    nav.innerHTML = list.map(function (id) {
      var x = it.map[id]; if (!x) return '';
      var lbl = id === 'rewards' ? L('Mukofot', 'Rewards', 'Награды') : x.label;
      var host = id === (list.indexOf('pomo') !== -1 ? 'pomo' : 'hub');
      return '<button type="button" class="' + (id === cur ? 'on' : '') + (host ? ' x-pomo-host' : '') + '" data-bn="' + id + '" data-xdrag="nav"><span class="x-bn-i">' + x.icon + '</span><span class="x-bn-l">' + H(lbl) + '</span>' +
        (host ? '<span class="x-pomo-live" aria-hidden="true"></span>' : '') + '</button>';
    }).join('');
    try { if (window.pomoSyncRunIndicator) window.pomoSyncRunIndicator(); } catch (e) {}
    nav.querySelectorAll('[data-bn]').forEach(function (b) {
      b.onclick = function () {
        if (DG.justDropped) return;
        var x = navItems().map[b.dataset.bn]; if (x) x.act();
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      };
    });
  }

  // ---------- Drag & drop (sichqoncha va barmoq: ushlab turish) ----------
  var DG = { el: null, id: null, from: null, ghost: null, timer: 0, sx: 0, sy: 0, on: false, pid: null, target: null, justDropped: false };
  function dgNavBox() { return document.documentElement.classList.contains('layout-desktop') ? document.getElementById('tabs-bar') : document.getElementById('x-bnav'); }
  function dgItemFromEl(el) {
    if (!el) return null;
    var sec = el.closest('[data-xdrag="sec"]'); if (sec) return { el: sec, id: sec.dataset.secGo, from: 'secs' };
    var bn = el.closest('#x-bnav [data-bn]'); if (bn) return { el: bn, id: bn.dataset.bn, from: 'nav' };
    var tb = el.closest('#tabs-bar .tab[data-xnav]'); if (tb && document.documentElement.classList.contains('layout-desktop')) return { el: tb, id: tb.dataset.xnav, from: 'nav' };
    return null;
  }
  // Sudrash paytida ekran chetiga yaqinlashsa — sahifa o'zi aylanadi (bo'limlar va pastki menyu orasida)
  function dgAutoScroll() {
    if (!DG.on) return;
    var y = DG.cy, h = window.innerHeight, edge = 70, v = 0;
    if (y != null) { if (y < edge) v = -Math.ceil((edge - y) / 6); else if (y > h - edge - 64) v = Math.ceil((y - (h - edge - 64)) / 6); }
    if (v) { window.scrollBy(0, v); dgMove(DG.cx, DG.cy); }
    DG.raf = requestAnimationFrame(dgAutoScroll);
  }
  function dgStart() {
    DG.on = true;
    DG.cx = DG.sx; DG.cy = DG.sy;
    cancelAnimationFrame(DG.raf); DG.raf = requestAnimationFrame(dgAutoScroll);
    try { var sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges(); } catch (e) {}
    var r = DG.el.getBoundingClientRect();
    var g = DG.el.cloneNode(true); g.classList.add('x-dg-ghost'); g.removeAttribute('id');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.style.left = '0px'; g.style.top = '0px';
    DG.ox = DG.sx - r.left; DG.oy = DG.sy - r.top;
    document.body.appendChild(g); DG.ghost = g;
    DG.el.classList.add('x-dg-src');
    document.documentElement.classList.add('x-dragging');
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
    dgMove(DG.sx, DG.sy);
  }
  function dgMove(x, y) {
    if (!DG.ghost) return;
    DG.cx = x; DG.cy = y;
    DG.ghost.style.transform = 'translate(' + (x - DG.ox) + 'px,' + (y - DG.oy) + 'px) scale(1.06) rotate(-2deg)';
    var under = document.elementFromPoint(x, y);
    document.querySelectorAll('.x-dg-over').forEach(function (e) { e.classList.remove('x-dg-over'); });
    var navBox = dgNavBox(), t = null;
    var it = dgItemFromEl(under);
    if (it && it.el !== DG.el) t = it;
    else if (under && navBox && navBox.contains(under)) t = { el: navBox, id: null, from: 'nav' };
    else if (under && under.closest('[data-xdz="secs"]')) t = { el: under.closest('[data-xdz="secs"]'), id: null, from: 'secs' };
    DG.target = t;
    if (t) t.el.classList.add('x-dg-over');
  }
  function dgEnd(cancel) {
    clearTimeout(DG.timer); cancelAnimationFrame(DG.raf);
    var was = DG.on, t = DG.target, id = DG.id, from = DG.from;
    if (DG.ghost) DG.ghost.remove();
    if (DG.el) DG.el.classList.remove('x-dg-src');
    document.querySelectorAll('.x-dg-over').forEach(function (e) { e.classList.remove('x-dg-over'); });
    document.documentElement.classList.remove('x-dragging');
    DG.el = DG.ghost = DG.target = null; DG.on = false; DG.pid = null;
    if (!was) return;
    DG.justDropped = true; setTimeout(function () { DG.justDropped = false; }, 350);
    if (cancel || !t) return;
    dgDrop(id, from, t);
  }
  function dgDrop(id, from, t) {
    var nav = navList(), secs = secList();
    var toNav = t.from === 'nav', tid = t.id;
    if (from === 'nav' && !toNav && NAV_LOCK.indexOf(id) !== -1) {
      toast('🔒 ' + L('Vazifalar, Profil va Hub doim asosiy menyuda turadi', 'Tasks, Profile and Hub always stay in the main menu', 'Задачи, Профиль и Hub всегда остаются в меню'));
      return;
    }
    var canSwap = from !== t.from && tid && (from === 'nav' ? secs : nav).indexOf(tid) !== -1 && NAV_LOCK.indexOf(toNav ? tid : id) === -1;
    if (from === 'secs' && toNav && nav.length >= NAV_MAX && !canSwap) {
      toast('⚠️ ' + L('Menyuda ko\'pi bilan ' + NAV_MAX + ' ta bo\'lim bo\'ladi', 'The menu holds up to ' + NAV_MAX + ' items', 'В меню максимум ' + NAV_MAX + ' пунктов'));
      return;
    }
    var src = from === 'nav' ? nav : secs, dst = toNav ? nav : secs;
    var si = src.indexOf(id);
    var swapped = false;
    if (src === dst && tid && tid !== id) {
      // bir ro'yxat ichida — almashtirish (swap)
      var ti = dst.indexOf(tid); if (ti === -1 || si === -1) return;
      dst[si] = tid; dst[ti] = id;
    } else if (src !== dst && canSwap && si !== -1) {
      // menyu ↔ bo'limlar: ikkalasi o'rin almashadi (menyudagi soni o'zgarmaydi)
      var tj = dst.indexOf(tid); dst[tj] = id; src[si] = tid; swapped = true;
      if (document.documentElement.getAttribute('data-tab') === (toNav ? tid : id)) { try { showTab('hub'); } catch (e) {} }
    } else if (src !== dst) {
      if (si !== -1) src.splice(si, 1);
      var at = tid ? dst.indexOf(tid) : -1;
      if (at === -1) dst.push(id); else dst.splice(at, 0, id);
      // menyudan chiqqan bo'lim joriy bo'lsa — Hub ga o'tamiz
      if (!toNav && document.documentElement.getAttribute('data-tab') === id) { try { showTab('hub'); } catch (e) {} }
    } else return;
    try { SFX.click(); } catch (e) {}
    navSave(nav, secs);
    if (swapped) { var mm = navItems().map; toast('🔄 ' + (mm[id] || {}).label + ' ⇄ ' + (mm[tid] || {}).label); }
    else if (toNav && from === 'secs') toast('📌 ' + (navItems().map[id] || {}).label + ' — ' + L('menyuga qo\'shildi', 'added to the menu', 'добавлено в меню'));
    else if (!toNav && from === 'nav') toast('🧩 ' + (navItems().map[id] || {}).label + ' — ' + L('Bo\'limlarga qaytdi', 'moved back to Sections', 'перемещено в Разделы'));
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || DG.el) return;
    var it = dgItemFromEl(e.target); if (!it) return;
    DG.el = it.el; DG.id = it.id; DG.from = it.from; DG.sx = e.clientX; DG.sy = e.clientY; DG.pid = e.pointerId; DG.touch = e.pointerType !== 'mouse';
    clearTimeout(DG.timer);
    DG.timer = setTimeout(function () { if (DG.el && !DG.on) dgStart(); }, DG.touch ? 380 : 260);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!DG.el || e.pointerId !== DG.pid) return;
    if (!DG.on) {
      var dx = e.clientX - DG.sx, dy = e.clientY - DG.sy, d = Math.sqrt(dx * dx + dy * dy);
      if (DG.touch) { if (d > 10) { clearTimeout(DG.timer); DG.el = null; } return; } // barmoq: avval ushlab turish kerak, aks holda bu aylantirish
      if (d > 7) { clearTimeout(DG.timer); dgStart(); }
      return;
    }
    dgMove(e.clientX, e.clientY);
  }, true);
  document.addEventListener('pointerup', function (e) { if (DG.el && e.pointerId === DG.pid) dgEnd(false); }, true);
  document.addEventListener('pointercancel', function (e) { if (DG.el && e.pointerId === DG.pid && !DG.on) { clearTimeout(DG.timer); DG.el = null; } }, true);
  // Sudrash paytida sahifa aylanmasin (telefon)
  document.addEventListener('touchmove', function (e) { if (DG.on) { e.preventDefault(); var t = e.touches[0]; if (t) dgMove(t.clientX, t.clientY); } }, { passive: false });
  document.addEventListener('touchend', function (e) { if (DG.on) { var t = e.changedTouches[0]; if (t) dgMove(t.clientX, t.clientY); dgEnd(false); } }, true);
  document.addEventListener('click', function (e) { if (DG.justDropped && dgItemFromEl(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (DG.el && dgItemFromEl(e.target)) e.preventDefault(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && DG.on) dgEnd(true); });
  window.xApplyNav = safe(applyNav);

  // =========================================================
  // 📲 ILOVANI O'RNATISH (kompyuter / telefon)
  // =========================================================
  var _installEvt = null;
  // Windows dasturidan ochilgan oyna (Focusgate.exe --app → ?src=desktop)
  try { if (/[?&]src=desktop/.test(location.search)) sessionStorage.setItem('luDesktop', '1'); } catch (e) {}
  function isStandalone() {
    try { if (sessionStorage.getItem('luDesktop') === '1') return true; } catch (e) {}
    try { return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; } catch (e) { return false; }
  }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || '')); }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); _installEvt = e; renderInstallUI(); });
  window.addEventListener('appinstalled', function () {
    _installEvt = null; toast('🎉 ' + L('LevelUpDay o\'rnatildi!', 'LevelUpDay installed!', 'LevelUpDay установлен!')); renderInstallUI();
    // Brauzer orqali o'rnatilganda Focusgate (ilova bloklovchi) birga o'rnatilmaydi — darhol taklif qilamiz
    if (isWin() && dlOn()) setTimeout(function () { doInstall(true); }, 900);
  });
  function isWin() { return /Windows NT/i.test(navigator.userAgent || ''); }
  // "Ilovani o'rnatish" oynasida Windows o'rnatuvchisi (Setup.exe) taklif qilinmaydi — faqat brauzer orqali o'rnatish.
  // Focusgate kuzatuvchilari (exe + kengaytma) Focusgate bo'limida yuklab olinadi (blocker.js: DOWNLOADS_ON).
  function dlOn() { return false; }
  function canOfferInstall() { return !isStandalone() && (!!_installEvt || isIOS() || isWin()); }
  function pwaPrompt() {
    if (!_installEvt) return false;
    _installEvt.prompt();
    _installEvt.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { _installEvt = null; } renderInstallUI(); }).catch(function () {});
    return true;
  }
  function doInstall(afterPwa) {
    var html = afterPwa === true
      ? '<h3 class="x-h">✅ ' + L('Ilova o\'rnatildi — endi Focusgate', 'App installed — now add Focusgate', 'Приложение установлено — теперь Focusgate') + '</h3><p style="margin:0 0 4px;font-size:13.5px;color:var(--text-muted)">' + L('Brauzer orqali o\'rnatilganda ilova bloklovchi birga o\'rnatilmaydi. Dasturlarni bloklash va ekran vaqti uchun quyidagi faylni ham o\'rnating.', 'Installing from the browser doesn\'t include the app blocker. To block programs and track screen time, also install this file.', 'При установке из браузера блокировщик не ставится. Чтобы блокировать программы и считать экранное время, установите и этот файл.') + '</p>'
      : '<h3 class="x-h">📲 ' + L('Ilovani o\'rnatish', 'Install the app', 'Установить приложение') + '</h3>';
    if (isWin() && dlOn()) {
      // Windows: bitta o'rnatuvchi — LevelUpDay oynasi (Ish stoli + Start menyusi) va Focusgate birga
      var ver = (window.LUFocusgate && window.LUFocusgate.version) || '';
      html += '<div class="x-inst-win"><div class="x-inst-win-h"><img src="icons/icon-192.png" alt=""><div><b>LevelUpDay ' + L('Windows uchun', 'for Windows', 'для Windows') + '</b>' +
        '<span>' + L('Telegram kabi alohida dastur + Focusgate (ilova/sayt bloklovchi) — bitta faylda', 'A real desktop app like Telegram + Focusgate (app & site blocker) — in one file', 'Настоящее приложение как Telegram + Focusgate (блокировщик) — одним файлом') + '</span></div></div>' +
        '<a class="x-btn" id="x-inst-win-dl" href="downloads/Focusgate.exe?v=' + encodeURIComponent(ver) + '" download="LevelUpDay-Setup.exe">⬇️ ' + L('Yuklab olish', 'Download', 'Скачать') + ' (Windows 10/11, 7 MB)</a>' +
        '<div class="x-inst-steps"><div><b>1</b><span>' + L('<b>LevelUpDay-Setup.exe</b> ni oching (Windows «Noma\'lum dastur» desa: <b>Batafsil → Baribir ishga tushirish</b>)', 'Open <b>LevelUpDay-Setup.exe</b> (if Windows warns: <b>More info → Run anyway</b>)', 'Откройте <b>LevelUpDay-Setup.exe</b> (если Windows предупредит: <b>Подробнее → Выполнить в любом случае</b>)') + '</span></div>' +
        '<div><b>2</b><span>' + L('O\'zi o\'rnatiladi: Ish stoli va Start menyusida <b>LevelUpDay</b> belgisi paydo bo\'ladi, soat yonida 🛡 Focusgate', 'It installs itself: a <b>LevelUpDay</b> icon appears on the desktop and Start menu, plus 🛡 Focusgate by the clock', 'Установится само: значок <b>LevelUpDay</b> на рабочем столе и в Пуске, 🛡 Focusgate возле часов') + '</span></div>' +
        '<div><b>3</b><span>' + L('Ochilgan oynada <b>«Ulash»</b> ni tasdiqlang — tayyor. O\'chirish: Sozlamalar → Dasturlar → LevelUpDay', 'Confirm <b>“Connect”</b> in the window that opens — done. To remove: Settings → Apps → LevelUpDay', 'Подтвердите <b>«Подключить»</b> в открывшемся окне — готово. Удаление: Параметры → Приложения → LevelUpDay') + '</span></div></div></div>' +
        '<div class="x-inst-alt">' + L('Yoki faqat brauzer orqali (Focusgate\'siz):', 'Or browser-only (without Focusgate):', 'Или только через браузер (без Focusgate):') + ' ' +
        (_installEvt ? '<button class="x-link" id="x-inst-pwa">🖥 ' + L('Brauzerdan o\'rnatish', 'Install from browser', 'Установить из браузера') + '</button>' : L('manzil satridagi <b>⊕</b> belgisi', 'the <b>⊕</b> icon in the address bar', 'значок <b>⊕</b> в адресной строке')) + '</span></div>';
      var m = xModal(html, 'x-inst-box');
      var pb = document.getElementById('x-inst-pwa'); if (pb) pb.onclick = function () { pwaPrompt(); };
      var dl = document.getElementById('x-inst-win-dl'); if (dl) dl.onclick = function () { setTimeout(function () { toast('⬇️ ' + L('Yuklangan faylni oching', 'Open the downloaded file', 'Откройте скачанный файл')); }, 600); };
      return m;
    }
    if (pwaPrompt()) return;
    if (isIOS()) {
      html += '<div class="x-inst-steps"><div><b>1</b><span>' + L('Safari pastidagi <b>Ulashish ⬆️</b> tugmasini bosing', 'Tap the <b>Share ⬆️</b> button in Safari', 'Нажмите <b>Поделиться ⬆️</b> в Safari') + '</span></div>' +
        '<div><b>2</b><span>' + L('<b>«Bosh ekranga qo\'shish»</b> ni tanlang', 'Choose <b>“Add to Home Screen”</b>', 'Выберите <b>«На экран Домой»</b>') + '</span></div>' +
        '<div><b>3</b><span>' + L('<b>Qo\'shish</b> ni bosing — tayyor!', 'Tap <b>Add</b> — done!', 'Нажмите <b>Добавить</b> — готово!') + '</span></div></div>';
    } else {
      html += '<div class="x-inst-steps"><div><b>1</b><span>' + L('Chrome yoki Edge\'da manzil satrining o\'ng tomonidagi <b>⊕ / 🖥 O\'rnatish</b> belgisini bosing', 'In Chrome or Edge, click the <b>⊕ / 🖥 Install</b> icon at the right of the address bar', 'В Chrome или Edge нажмите значок <b>⊕ Установить</b> в адресной строке') + '</span></div>' +
        '<div><b>2</b><span>' + L('Yoki menyu <b>⋮ → «LevelUpDay\'ni o\'rnatish»</b>', 'Or menu <b>⋮ → “Install LevelUpDay”</b>', 'Или меню <b>⋮ → «Установить LevelUpDay»</b>') + '</span></div>' +
        '<div><b>3</b><span>' + L('Ilova alohida oynada ochiladi va ish stolida belgisi paydo bo\'ladi', 'It opens in its own window with an icon on your desktop', 'Приложение откроется в отдельном окне со значком на рабочем столе') + '</span></div></div>';
    }
    xModal(html, 'x-inst-box');
  }
  window.xInstallApp = doInstall;
  function renderInstallUI() {
    var show = canOfferInstall();
    // 1) Vazifalar sahifasidagi banner (yopib qo'ysa qaytib chiqmaydi)
    var bn = document.getElementById('x-install-banner');
    var want = show && !S.xInstallDismissed;
    if (want && !bn) {
      var host = document.getElementById('view-tasks');
      if (host) {
        bn = document.createElement('div'); bn.id = 'x-install-banner'; bn.className = 'x-install-banner';
        bn.innerHTML = '<img src="icons/icon-192.png" alt=""><div class="x-ib-t"><b>' + L('LevelUpDay\'ni o\'rnating', 'Install LevelUpDay', 'Установите LevelUpDay') + '</b><span>' +
          L('Ish stoli / bosh ekrandan bir bosishda ochiladi, oflayn ham ishlaydi', 'Open it in one tap from your desktop / home screen, works offline', 'Открывается в одно касание, работает офлайн') + '</span></div>' +
          '<button class="x-btn sm" id="x-ib-go">📲 ' + L('O\'rnatish', 'Install', 'Установить') + '</button><button class="x-link" id="x-ib-x" aria-label="close">✕</button>';
        host.insertBefore(bn, host.firstChild);
        bn.querySelector('#x-ib-go').onclick = doInstall;
        bn.querySelector('#x-ib-x').onclick = function () { S.xInstallDismissed = true; save(); bn.remove(); };
      }
    } else if (!want && bn) bn.remove();
    // 2) Profil → Sozlamalar tugmasi (doim, o'rnatilmagan bo'lsa)
    var st = document.getElementById('profile-subtab-settings'), sb = document.getElementById('x-install-settings');
    if (show && st && !sb) {
      sb = document.createElement('button'); sb.id = 'x-install-settings'; sb.type = 'button'; sb.className = 'ad-open-btn x-inst-btn';
      sb.innerHTML = '📲 ' + L('Ilovani kompyuter / telefonga o\'rnatish', 'Install the app on this device', 'Установить приложение на устройство');
      sb.onclick = doInstall; st.insertBefore(sb, st.firstChild);
    } else if (!show && sb) sb.remove();
  }

  // =========================================================
  // 🔔 PUSH ESLATMALAR — ilova yopiq bo'lsa ham keladi (server: send-reminders edge function)
  //   • vazifaning "Eslatma" vaqti kelganda  • 20:00 da streak yo'qolish arafasida
  // =========================================================
  var VAPID_PUBLIC = 'BNhtrhbMAR7bk60PbDmmXYElq6dfRmzSJwlKSoT_JeuEmyL0mAmKrrjZlNgkel2pLLart3jbww2eTXJ4dLkfFVc';
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:'; }
  function b64u(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function pushPrefs() { S.xPushPrefs = S.xPushPrefs || { tasks: true, streak: true }; return S.xPushPrefs; }
  async function pushCurrentSub() { try { var reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; } }
  async function pushSave(sub) {
    var j = sub.toJSON();
    var tz = 'Asia/Tashkent'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) {}
    var r = await supabase.from('push_subscriptions').upsert({
      endpoint: j.endpoint, user_id: S.cloudUserId, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: tz,
      lang: (typeof getLang === 'function' ? getLang() : 'uz'), prefs: pushPrefs(), updated_at: new Date().toISOString()
    });
    if (r.error) throw r.error;
    S.xPushSyncedDate = today(); save();
  }
  async function pushEnable(silent) {
    if (!pushSupported()) { if (!silent) toast('⚠️ ' + (isIOS() && !isStandalone() ? L('iPhone\'da eslatmalar uchun avval ilovani o\'rnating (Share → Add to Home Screen)', 'On iPhone, install the app first (Share → Add to Home Screen)', 'На iPhone сначала установите приложение (Поделиться → На экран «Домой»)') : L('Bu brauzer eslatmalarni qo\'llamaydi', 'This browser does not support notifications', 'Браузер не поддерживает уведомления'))); return false; }
    if (!cloudOk()) { if (!silent) toast('🔐 ' + L('Eslatmalar uchun akkauntga kiring', 'Sign in to get reminders', 'Войдите, чтобы получать напоминания')); return false; }
    try {
      var perm = Notification.permission === 'default' && !silent ? await Notification.requestPermission() : Notification.permission;
      if (perm !== 'granted') { if (!silent) toast('🔕 ' + L('Brauzer sozlamalarida bildirishnomalarga ruxsat bering', 'Allow notifications in your browser settings', 'Разрешите уведомления в настройках браузера')); return false; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC) });
      await pushSave(sub);
      S.xPushOn = true; save();
      if (!silent) toast('🔔 ' + L('Eslatmalar yoqildi', 'Reminders are on', 'Напоминания включены'));
      return true;
    } catch (e) { console.warn('[push]', e); if (!silent) toast('⚠️ ' + L('Eslatmalarni yoqib bo\'lmadi', 'Could not turn on reminders', 'Не удалось включить напоминания')); return false; }
  }
  async function pushDisable() {
    try { var sub = await pushCurrentSub(); if (sub) { try { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch (e) {} await sub.unsubscribe(); } } catch (e) {}
    S.xPushOn = false; save(); toast('🔕 ' + L('Eslatmalar o\'chirildi', 'Reminders are off', 'Напоминания выключены'));
  }
  window.xPushEnable = pushEnable;
  // Chiqishda: bu qurilmaga eski akkauntning eslatmalari kelmasin
  window.xPushOffSilent = async function () {
    try { var sub = await pushCurrentSub(); if (sub) { try { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch (e) {} await sub.unsubscribe(); } } catch (e) {}
  };
  // Vazifaga eslatma qo'yilganda / ilova ochilganda — ruxsat bor bo'lsa jimgina obunani yangilaymiz
  window.xPushAuto = function () {
    if (!pushSupported() || !cloudOk() || S.xPushOn === false) return;
    if (Notification.permission !== 'granted') return;
    if (S.xPushOn && S.xPushSyncedDate === today()) return;
    pushEnable(true);
  };
  function renderPushSettings() {
    var st = document.getElementById('profile-subtab-settings'); if (!st) return;
    var card = document.getElementById('x-push-card');
    if (!card) { card = document.createElement('div'); card.id = 'x-push-card'; card.className = 'x-card x-push-card'; var ib = document.getElementById('x-install-settings'); st.insertBefore(card, ib ? ib.nextSibling : st.firstChild); }
    var on = !!S.xPushOn && pushSupported() && Notification.permission === 'granted', pf = pushPrefs();
    card.innerHTML = '<div class="x-push-h"><span>🔔</span><div><b>' + L('Eslatmalar', 'Reminders', 'Напоминания') + '</b><small>' +
      L('Ilova yopiq bo\'lsa ham: vazifa vaqti va 20:00 da streak eslatmasi', 'Even when the app is closed: task times and a streak reminder at 20:00', 'Даже когда приложение закрыто: время задач и напоминание о серии в 20:00') + '</small></div>' +
      '<button class="x-btn sm' + (on ? ' ghost' : '') + '" id="x-push-tg">' + (on ? L('O\'chirish', 'Turn off', 'Выключить') : L('Yoqish', 'Turn on', 'Включить')) + '</button></div>' +
      (on ? '<label class="x-chk"><input type="checkbox" data-pp="tasks"' + (pf.tasks !== false ? ' checked' : '') + '> ' + L('Vazifa eslatmalari', 'Task reminders', 'Напоминания о задачах') + '</label>' +
            '<label class="x-chk"><input type="checkbox" data-pp="streak"' + (pf.streak !== false ? ' checked' : '') + '> ' + L('Streak eslatmasi (20:00)', 'Streak reminder (20:00)', 'Напоминание о серии (20:00)') + '</label>' : '');
    card.querySelector('#x-push-tg').onclick = async function () { this.disabled = true; if (on) await pushDisable(); else await pushEnable(false); renderPushSettings(); };
    card.querySelectorAll('[data-pp]').forEach(function (c) { c.onchange = async function () { pushPrefs()[c.dataset.pp] = c.checked; save(); var sub = await pushCurrentSub(); if (sub) { try { await pushSave(sub); } catch (e) {} } }; });
  }
  window.xRenderPushSettings = safe(renderPushSettings);

  // =========================================================
  // ✈️ TELEGRAM ESLATMALARI — @LevelUpDayLoginBot (telegram_links jadvali)
  //   Ulash: tg_link_code() → t.me/<bot>?start=<kod> → bot webhook'i bog'laydi
  // =========================================================
  var TG_BOT = 'LevelUpDayLoginBot';
  var _tgPoll = 0;
  async function renderTgSettings() {
    var st = document.getElementById('profile-subtab-settings'); if (!st) return;
    var card = document.getElementById('x-tg-card');
    if (!card) {
      card = document.createElement('div'); card.id = 'x-tg-card'; card.className = 'x-card x-push-card x-tg-card';
      var pc = document.getElementById('x-push-card');
      st.insertBefore(card, pc ? pc.nextSibling : st.firstChild);
    }
    var head = function (sub, btn) {
      return '<div class="x-push-h"><span>✈️</span><div><b>' + L('Telegram eslatmalari', 'Telegram reminders', 'Напоминания в Telegram') + '</b><small>' + sub + '</small></div>' + (btn || '') + '</div>';
    };
    if (!cloudOk()) {
      card.innerHTML = head(H(L('Avval akkauntga kiring — keyin eslatmalar Telegram\'ga keladi', 'Sign in first — then reminders will come to Telegram', 'Сначала войдите — затем напоминания придут в Telegram')));
      return;
    }
    var r = await supabase.from('telegram_links').select('chat_id,username,enabled,prefs,tz,lang,times').maybeSingle();
    var link = r && !r.error ? r.data : null;
    if (!link) {
      card.innerHTML = head(H(L('Vazifa eslatmalari, 08:00 reja, streak va kun yakuni — @' + TG_BOT + ' orqali', 'Task reminders, 08:00 plan, streak and day summary — via @' + TG_BOT, 'Напоминания, план в 08:00, серия и итоги дня — через @' + TG_BOT)),
        '<button class="x-btn sm" id="x-tg-link">' + L('Ulash', 'Connect', 'Подключить') + '</button>');
      card.querySelector('#x-tg-link').onclick = async function () {
        var b = this; b.disabled = true;
        // Popup bloklanmasligi uchun oyna darhol ochiladi, manzil keyin beriladi
        var w = null; try { w = window.open('', '_blank'); } catch (e) {}
        var c = await supabase.rpc('tg_link_code');
        b.disabled = false;
        if (c.error || !c.data) { try { w && w.close(); } catch (e) {} toast('⚠️ ' + ((c.error && c.error.message) || 'error')); return; }
        var url = 'https://t.me/' + TG_BOT + '?start=' + encodeURIComponent(c.data);
        if (w) w.location.href = url; else location.href = url;
        toast('✈️ ' + L('Telegram\'da «Start» ni bosing', 'Press “Start” in Telegram', 'Нажмите «Start» в Telegram'));
        // Ulanishni kutamiz (2 daqiqagacha)
        clearInterval(_tgPoll); var n = 0;
        _tgPoll = setInterval(async function () {
          if (++n > 40) { clearInterval(_tgPoll); return; }
          var q = await supabase.from('telegram_links').select('chat_id').maybeSingle();
          if (q && q.data) { clearInterval(_tgPoll); toast('✅ ' + L('Telegram ulandi!', 'Telegram connected!', 'Telegram подключён!')); renderTgSettings(); }
        }, 3000);
      };
      return;
    }
    // Soat mintaqasi / til — server eslatmalarni to'g'ri vaqtda yuborishi uchun
    var tz = 'Asia/Tashkent'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) {}
    var lang = 'uz'; try { lang = getLang(); } catch (e) {}
    if (link.tz !== tz || link.lang !== lang) { try { await supabase.from('telegram_links').update({ tz: tz, lang: lang }).eq('chat_id', link.chat_id); } catch (e) {} }
    var pf = link.prefs || {};
    var opts = [['tasks', L('⏰ Vazifa eslatmalari', '⏰ Task reminders', '⏰ Напоминания о задачах')], ['start', L('▶️ Vazifa boshlanish vaqti', '▶️ Task start time', '▶️ Время начала задачи')],
      ['morning', L('🌅 08:00 — bugungi reja', '🌅 08:00 — today\'s plan', '🌅 08:00 — план на день')], ['streak', L('🔥 20:00 — streak eslatmasi', '🔥 20:00 — streak reminder', '🔥 20:00 — напоминание о серии')],
      ['evening', L('🌙 21:30 — kun yakuni', '🌙 21:30 — day summary', '🌙 21:30 — итоги дня')],
      ['fg', L('🛡 Focusgate — bloklash va limitlar', '🛡 Focusgate — blocks and limits', '🛡 Focusgate — блокировки и лимиты')],
      ['weekly', L('📅 Yakshanba — haftalik hisobot', '📅 Sunday — weekly report', '📅 Воскресенье — отчёт за неделю')],
      ['social', L('👥 Do\'stlar: so\'rov, challenge, turtki', '👥 Friends: requests, challenges, nudges', '👥 Друзья: заявки, вызовы, толчки')],
      ['pomo', L('🍅 Pomodoro taymeri tugaganda', '🍅 When a Pomodoro timer ends', '🍅 Когда заканчивается помодоро')]];
    var tms = link.times || {};
    var TMS = [['morning', '08:00', L('🌅 Ertalabki reja', '🌅 Morning plan', '🌅 Утренний план')], ['streak', '20:00', L('🔥 Streak eslatmasi', '🔥 Streak reminder', '🔥 Серия')],
      ['evening', '21:30', L('🌙 Kun yakuni', '🌙 Day summary', '🌙 Итоги дня')], ['weekly', '20:30', L('📅 Haftalik (yakshanba)', '📅 Weekly (Sunday)', '📅 Неделя (вс)')]];
    opts = opts.map(function (o) { var tm = TMS.filter(function (x) { return x[0] === o[0]; })[0]; return tm ? [o[0], o[1].replace(/\d\d:\d\d — /, '').replace(/^(\S+) [^—]*— /, '$1 '), tm] : o; });
    card.innerHTML = head(H((link.username ? '@' + link.username + ' · ' : '') + (link.enabled ? L('xabarlar yoqilgan', 'messages on', 'сообщения включены') : L('xabarlar o\'chirilgan — hech narsa kelmaydi', 'messages off — nothing will be sent', 'сообщения выключены — ничего не придёт'))),
      '<button type="button" class="x-tg-sw' + (link.enabled ? ' on' : '') + '" id="x-tg-en" role="switch" aria-checked="' + !!link.enabled + '" title="' + H(link.enabled ? L('O\'chirish', 'Turn off', 'Выключить') : L('Yoqish', 'Turn on', 'Включить')) + '"><i></i></button>') +
      (link.enabled ? '<div class="x-tg-sub">' + L('Qaysi xabarlar kelsin:', 'Which messages to send:', 'Какие сообщения присылать:') + '</div>' + opts.map(function (o) { return '<div class="x-tg-row"><label class="x-chk"><input type="checkbox" data-tgp="' + o[0] + '"' + (pf[o[0]] !== false ? ' checked' : '') + '> ' + H(o[1]) + '</label>' + (o[2] ? '<input type="time" class="x-in x-tg-tm" data-tgt="' + o[0] + '" value="' + H(tms[o[0]] || o[2][1]) + '">' : '') + '</div>'; }).join('') +
        '<div class="x-tg-sub">🌙 ' + L('Tinch soatlar (bu vaqtda eslatma kelmaydi)', 'Quiet hours (no reminders)', 'Тихие часы (без напоминаний)') + '</div><div class="x-tg-row x-tg-q"><input type="time" class="x-in x-tg-tm" data-tgt="quietFrom" value="' + H(tms.quietFrom || '') + '"><span>—</span><input type="time" class="x-in x-tg-tm" data-tgt="quietTo" value="' + H(tms.quietTo || '') + '"><button type="button" class="x-btn ghost sm" id="x-tg-qoff">✕</button></div>' +
        '<div class="x-tg-hint">🤖 ' + L('Botda: /today (✅ tugmalari bilan), /add matn — Inbox\'ga, /stats, /week, /goals, /pomo, /settings. Eslatmadagi «✅ Bajardim» ilovada avtomatik belgilanadi.', 'In the bot: /today (with ✅ buttons), /add text — to Inbox, /stats, /week, /goals, /pomo, /settings. “✅ Done” in a reminder is applied in the app automatically.', 'В боте: /today (с кнопками ✅), /add текст — во «Входящие», /stats, /week, /goals, /pomo, /settings. «✅ Готово» в напоминании отметится в приложении.') + '</div>' : '') +
      '<div class="x-tg-hint">' + L('Botda ham boshqarish mumkin: /stop — o\'chirish, /start — yoqish.', 'You can also control it in the bot: /stop — off, /start — on.', 'Можно и в боте: /stop — выключить, /start — включить.') + '</div>' +
      '<div class="x-tg-act"><button class="x-btn ghost sm" id="x-tg-today">📋 ' + L('Bugungi reja', 'Today\'s plan', 'План') + '</button><button class="x-btn ghost sm" id="x-tg-test">🧪 ' + L('Sinov xabari', 'Send test', 'Тест') + '</button>' +
      '<button class="x-btn ghost sm" id="x-tg-open">💬 @' + TG_BOT + '</button>' +
      '<button class="x-btn ghost sm x-tg-un" id="x-tg-unlink">' + L('Uzish', 'Disconnect', 'Отключить') + '</button></div>';
    card.querySelector('#x-tg-en').onclick = async function () {
      this.disabled = true; this.classList.toggle('on');
      var r2 = await supabase.from('telegram_links').update({ enabled: !link.enabled }).eq('chat_id', link.chat_id);
      if (r2 && r2.error) toast('⚠️ ' + r2.error.message);
      else toast(!link.enabled ? '🔔 ' + L('Telegram xabarlari yoqildi', 'Telegram messages on', 'Сообщения Telegram включены') : '🔕 ' + L('Telegram xabarlari o\'chirildi', 'Telegram messages off', 'Сообщения Telegram выключены'));
      renderTgSettings();
    };
    card.querySelectorAll('[data-tgp]').forEach(function (c) {
      c.onchange = async function () { pf[c.dataset.tgp] = c.checked; await supabase.from('telegram_links').update({ prefs: pf }).eq('chat_id', link.chat_id); };
    });
    var saveTimes = async function () { await supabase.from('telegram_links').update({ times: tms }).eq('chat_id', link.chat_id); toast('🕒 ' + L('Saqlandi', 'Saved', 'Сохранено')); };
    card.querySelectorAll('[data-tgt]').forEach(function (inp) { inp.onchange = function () { if (inp.value) tms[inp.dataset.tgt] = inp.value; else delete tms[inp.dataset.tgt]; saveTimes(); }; });
    var qoff = card.querySelector('#x-tg-qoff');
    if (qoff) qoff.onclick = function () { delete tms.quietFrom; delete tms.quietTo; card.querySelectorAll('.x-tg-q input').forEach(function (x) { x.value = ''; }); saveTimes(); };
    card.querySelector('#x-tg-today').onclick = async function () {
      this.disabled = true;
      var t = await supabase.functions.invoke('telegram-bot', { body: { action: 'today' } });
      this.disabled = false;
      toast(t && !t.error && t.data && t.data.ok ? '✅ ' + L('Telegram\'ga yuborildi', 'Sent to Telegram', 'Отправлено в Telegram') : '⚠️ ' + L('Yuborib bo\'lmadi', 'Could not send', 'Не удалось'));
    };
    card.querySelector('#x-tg-test').onclick = async function () {
      this.disabled = true;
      var t = await supabase.functions.invoke('telegram-bot', { body: { action: 'test' } });
      this.disabled = false;
      toast(t && !t.error && t.data && t.data.ok ? '✅ ' + L('Telegram\'ga yuborildi', 'Sent to Telegram', 'Отправлено в Telegram') : '⚠️ ' + L('Yuborib bo\'lmadi — botni bloklamaganingizni tekshiring', 'Could not send — make sure the bot is not blocked', 'Не удалось — проверьте, что бот не заблокирован'));
    };
    card.querySelector('#x-tg-open').onclick = function () { window.open('https://t.me/' + TG_BOT, '_blank'); };
    card.querySelector('#x-tg-unlink').onclick = async function () {
      if (!confirm(L('Telegram eslatmalari uzilsinmi?', 'Disconnect Telegram reminders?', 'Отключить напоминания в Telegram?'))) return;
      await supabase.from('telegram_links').delete().eq('chat_id', link.chat_id);
      toast(L('Telegram uzildi', 'Telegram disconnected', 'Telegram отключён')); renderTgSettings();
    };
  }
  window.xRenderTgSettings = safe(function () { renderTgSettings().catch(function (e) { console.warn('[tg]', e); }); });

  // ✈️ Botdagi amallarni ilovada qo'llash: «✅ Bajardim» (mukofot bilan) va /add (Inbox'ga)
  var _tgaBusy = false, _tgaAt = 0;
  async function applyTgActions() {
    if (!cloudOk() || _tgaBusy || Date.now() - _tgaAt < 20000) return;
    _tgaBusy = true; _tgaAt = Date.now();
    try {
      var r = await supabase.from('tg_actions').select('id,kind,task_id,payload,created_at').is('applied_at', null).order('id').limit(50);
      var rows = (r && !r.error && r.data) || [], ids = [], nDone = 0, nAdd = 0, td = today();
      rows.forEach(function (a) {
        try {
          if (a.kind === 'done') {
            var day = (a.payload && a.payload.day) || td;
            var t = (S.tasks || []).find(function (x) { return x && Number(x.id) === Number(a.task_id); });
            if (t && day === td && !(t.repeat === 'once' ? t.done : t.doneDate === td)) { toggleTaskInternal(t.id); nDone++; }
          } else if (a.kind === 'add' && a.payload && a.payload.name && window.xInboxAddText) { if (window.xInboxAddText(a.payload.name)) nAdd++; }
        } catch (e) { console.warn('[tg action]', e); }
        ids.push(a.id);
      });
      if (ids.length) await supabase.from('tg_actions').update({ applied_at: new Date().toISOString() }).in('id', ids);
      if (nDone || nAdd) {
        try { save(); render(); } catch (e) {}
        toast('✈️ Telegram: ' + (nDone ? '✅ ' + nDone + ' ' + L('ta bajarildi', 'done', 'выполнено') : '') + (nDone && nAdd ? ' · ' : '') + (nAdd ? '📥 ' + nAdd + ' ' + L('ta Inbox\'ga', 'to Inbox', 'во «Входящие»') : ''));
      }
    } catch (e) {}
    _tgaBusy = false;
  }
  window.xApplyTgActions = applyTgActions;
  setTimeout(applyTgActions, 7000);
  setInterval(function () { if (!document.hidden) applyTgActions(); }, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(applyTgActions, 1500); });

  // =========================================================
  // 🕒 VAQT — davlat bo'yicha (tz.js). Sukut bo'yicha O'CHIQ: qurilma vaqti.
  //   S.tzByCountry = true → localStorage.ludTz = profil davlatining vaqt mintaqasi (sahifa qayta yuklanadi)
  // =========================================================
  function tzOfCountry() { var c = S.profile && S.profile.country; return (c && window.LUD_TZ_MAP && window.LUD_TZ_MAP[c]) || null; }
  function tzWanted() { return S.tzByCountry ? tzOfCountry() : null; }
  function tzClock(zone) { try { return new Intl.DateTimeFormat(getLang ? getLang() : 'en', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Date.now())); } catch (e) { return ''; } }
  // Kerakli holat amaldagidan farq qilsa — saqlab, bir marta qayta yuklaymiz (sessiyada tsikl bo'lmasin)
  function tzApply(force) {
    var want = tzWanted(), cur = null; try { cur = localStorage.getItem('ludTz'); } catch (e) {}
    if ((want || null) === (cur || null)) return false;
    try { if (want) localStorage.setItem('ludTz', want); else { localStorage.removeItem('ludTz'); localStorage.removeItem('ludSkew'); } } catch (e) { return false; }
    // O'chirilganda vaqt qurilma soatiga qaytadi (orqaga ketishi mumkin) — soat-firibgarlik himoyasi noto'g'ri ishlamasin
    if (!want && window.LUD_TZ && window.LUD_TZ.skew) { try { S.lastKnownTimestamp = Date.now() - window.LUD_TZ.skew; S.clockTamperDetected = false; save(); } catch (e) {} }
    var k = 'ludTzReload:' + (want || 'off');
    try { if (!force && sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); } catch (e) {}
    toast('🕒 ' + L('Vaqt yangilanmoqda…', 'Updating time…', 'Обновляем время…'));
    setTimeout(function () { location.reload(); }, 600);
    return true;
  }
  window.xTzApply = tzApply;
  function renderTzSettings() {
    var st = document.getElementById('profile-subtab-settings'); if (!st) return;
    var card = document.getElementById('x-tz-card');
    if (!card) {
      card = document.createElement('div'); card.id = 'x-tz-card'; card.className = 'x-card x-push-card x-tz-card';
      var tg = document.getElementById('x-tg-card');
      st.insertBefore(card, tg ? tg.nextSibling : st.firstChild);
    }
    var on = !!S.tzByCountry, cz = tzOfCountry(), cc = S.profile && S.profile.country, dev = (window.LUD_TZ && window.LUD_TZ.device) || '';
    var flag = cc && typeof countryFlagImg === 'function' ? countryFlagImg(cc, 14) + ' ' : '';
    var sub = on && cz
      ? flag + H(typeof countryName === 'function' ? countryName(cc) : cc) + ' · ' + H(cz.replace(/_/g, ' ')) + ' · <b>' + H(tzClock(cz)) + '</b>'
        + (window.LUD_TZ && window.LUD_TZ.skew ? ' · ' + L('qurilma soati tuzatildi', 'device clock corrected', 'часы устройства исправлены') + ' (' + (window.LUD_TZ.skew > 0 ? '+' : '−') + Math.round(Math.abs(window.LUD_TZ.skew) / 60000) + ' ' + L('daq', 'min', 'мин') + ')' : '')
      : L('Qurilma vaqti', 'Device time', 'Время устройства') + ' · ' + H(dev.replace(/_/g, ' ')) + ' · <b>' + H(tzClock(dev || undefined)) + '</b>';
    card.innerHTML = '<div class="x-push-h"><span>🕒</span><div><b>' + L('Vaqt — davlat bo\'yicha', 'Time by country', 'Время по стране') + '</b><small>' + sub + '</small></div>' +
      '<button type="button" class="x-tg-sw' + (on ? ' on' : '') + '" id="x-tz-sw" role="switch" aria-checked="' + on + '"' + (!cz && !on ? ' disabled' : '') + '><i></i></button></div>' +
      '<div class="x-tg-hint">' + (cz
        ? L('Yoqilsa: kun, soat, eslatmalar va statistika profilingizdagi davlat vaqti bilan hisoblanadi — boshqa davlatga borsangiz ham. O\'chiq bo\'lsa — telefon/noutbuk soati.', 'When on, days, hours, reminders and stats use your profile country\'s time — even when you travel. When off, your phone/laptop clock is used.', 'Если включено, дни, часы, напоминания и статистика считаются по времени страны из профиля — даже в поездке. Если выключено — по часам телефона/ноутбука.')
        : L('Avval profilda davlatingizni tanlang (Profil → ✎ Tahrirlash), keyin yoqish mumkin.', 'Choose your country in your profile first (Profile → ✎ Edit), then you can turn this on.', 'Сначала выберите страну в профиле (Профиль → ✎ Изменить), затем можно включить.') +
        (!cz ? ' <button type="button" class="x-link" id="x-tz-country">' + L('Davlatni tanlash', 'Choose country', 'Выбрать страну') + '</button>' : '')) + '</div>';
    var sw = card.querySelector('#x-tz-sw');
    sw.onclick = function () {
      if (!cz && !S.tzByCountry) return;
      S.tzByCountry = !S.tzByCountry; save();
      if (!tzApply(true)) renderTzSettings();
    };
    var cb = card.querySelector('#x-tz-country'); if (cb) cb.onclick = function () { try { showProfileEdit(); } catch (e) {} };
  }
  window.xRenderTzSettings = safe(renderTzSettings);
  // Bulutdan kelgan sozlama yoki davlat o'zgargan bo'lsa — mos holatga keltiramiz
  setTimeout(function () { try { tzApply(false); } catch (e) {} }, 4000);
  setTimeout(function () { try { tzApply(false); } catch (e) {} }, 15000);

  // =========================================================
  // 🎁 DO'ST TAKLIF QILISH — havola: ?ref=KOD
  //   Taklif qilingan yangi foydalanuvchi 3 xil kunda faol bo'lsa: ikkalasiga ham +10 💎
  // =========================================================
  var REF_GEMS = 10;
  function refCaptureFromUrl() {
    try {
      var q = new URLSearchParams(location.search), c = q.get('ref');
      if (!c) return;
      if (/^[A-Za-z0-9_-]{3,24}$/.test(c)) localStorage.setItem('lud_ref', c.toUpperCase());
      q.delete('ref'); var qs = q.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (e) {}
  }
  var _refBusy = false;
  async function refSync() {
    if (_refBusy || !cloudOk()) return; _refBusy = true;
    try {
      var code = null; try { code = localStorage.getItem('lud_ref'); } catch (e) {}
      if (code) {
        var r = await supabase.rpc('claim_referral', { p_code: code });
        try { localStorage.removeItem('lud_ref'); } catch (e) {}
        if (!r.error && r.data && r.data.ok) toast('🎁 ' + L('Sizni ' + (r.data.referrer_name || 'do\'stingiz') + ' taklif qildi! 3 kun faol bo\'lsangiz ikkalangiz ham +' + REF_GEMS + ' 💎 olasiz', (r.data.referrer_name || 'A friend') + ' invited you! Be active on 3 days and you both get +' + REF_GEMS + ' 💎', 'Вас пригласил(а) ' + (r.data.referrer_name || 'друг') + '! Будьте активны 3 дня — оба получите +' + REF_GEMS + ' 💎'));
      }
      var c2 = await supabase.rpc('claim_referral_rewards');
      if (!c2.error && c2.data && c2.data.ok) {
        var n = (c2.data.as_referrer || 0) + (c2.data.as_referee ? 1 : 0);
        if (n > 0) { gemsAdd(n * REF_GEMS, 'referral', '🎁 ' + L('Do\'st taklifi mukofoti', 'Referral reward', 'Награда за приглашение')); try { confetti(); } catch (e) {} save(); }
      }
    } catch (e) { console.warn('[referral]', e); }
    _refBusy = false;
  }
  async function openReferral() {
    if (!cloudOk()) { toast('🔐 ' + L('Do\'st taklif qilish uchun akkauntga kiring', 'Sign in to invite friends', 'Войдите, чтобы приглашать друзей')); return; }
    var ov = xModal('<h3 class="x-h">🎁 ' + L('Do\'stni taklif qil', 'Invite a friend', 'Пригласить друга') + '</h3><div id="x-ref-body"><div class="ad-empty">⏳</div></div>', 'x-ref-box');
    await refSync();
    var r = await supabase.rpc('get_my_referrals');
    var b = ov.querySelector('#x-ref-body'); if (!b) return;
    if (r.error || !r.data || !r.data.code) { b.innerHTML = '<div class="ad-empty">⚠️ ' + H(r.error ? r.error.message : L('Kod topilmadi', 'No code yet', 'Код не найден')) + '</div>'; return; }
    var d = r.data, link = location.origin + location.pathname + '?ref=' + encodeURIComponent(d.code);
    var msg = L('LevelUpDay — vazifalarni o\'yin kabi bajaraman! Qo\'shil, ikkalamiz ham 💎 olamiz: ', 'I level up my days with LevelUpDay! Join me and we both get 💎: ', 'Прокачиваю свои дни в LevelUpDay! Присоединяйся — оба получим 💎: ') + link;
    b.innerHTML =
      '<p class="x-ref-p">' + L('Havolani do\'stingizga yuboring. U ro\'yxatdan o\'tib, <b>3 xil kunda</b> ilovaga kirsa, ikkalangiz ham <b>+' + REF_GEMS + ' 💎</b> olasiz.', 'Send the link to a friend. When they sign up and use the app on <b>3 different days</b>, you both get <b>+' + REF_GEMS + ' 💎</b>.', 'Отправьте ссылку другу. Когда он зарегистрируется и зайдёт в приложение <b>3 разных дня</b>, вы оба получите <b>+' + REF_GEMS + ' 💎</b>.') + '</p>' +
      '<div class="x-ref-link"><input readonly value="' + H(link) + '"><button class="x-btn sm" id="x-ref-copy">📋 ' + L('Nusxa', 'Copy', 'Копировать') + '</button></div>' +
      '<div class="x-ref-acts"><a class="x-btn sm ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(msg.replace(link, '')) + '">✈️ Telegram</a>' +
      (navigator.share ? '<button class="x-btn sm ghost" id="x-ref-share">📤 ' + L('Ulashish', 'Share', 'Поделиться') + '</button>' : '') + '</div>' +
      '<div class="x-ref-stats"><div><b>' + (d.invited || 0) + '</b><span>' + L('Taklif qilingan', 'Invited', 'Приглашено') + '</span></div><div><b>' + (d.active || 0) + '</b><span>' + L('Faol (3+ kun)', 'Active (3+ days)', 'Активны (3+ дн.)') + '</span></div><div><b>' + ((d.rewarded || 0) * REF_GEMS) + ' 💎</b><span>' + L('Olingan', 'Earned', 'Получено') + '</span></div></div>' +
      (d.invited_by ? '<div class="x-ref-by">🤝 ' + L('Sizni taklif qilgan: ', 'Invited by: ', 'Вас пригласил(а): ') + '<b>' + H(d.invited_by) + '</b> · ' + (d.my_claimed ? L('mukofot olindi ✅', 'reward received ✅', 'награда получена ✅') : L('faol kunlar: ', 'active days: ', 'активных дней: ') + Math.min(3, d.my_progress || 0) + '/3') + '</div>' : '') +
      ((d.list || []).length ? '<div class="x-sec-t">' + L('Taklif qilganlarim', 'My invites', 'Мои приглашения') + '</div>' + d.list.map(function (x) { return '<div class="x-ref-row"><span>' + H(x.name || '?') + '</span><em>' + (x.claimed ? '✅ +' + REF_GEMS + ' 💎' : x.active ? '🎁' : '⏳ ' + L('3 kun kutilmoqda', 'waiting for 3 days', 'ждём 3 дня')) + '</em></div>'; }).join('') : '');
    var cp = b.querySelector('#x-ref-copy'); if (cp) cp.onclick = function () { var i = b.querySelector('.x-ref-link input'); try { navigator.clipboard.writeText(link); } catch (e) { i.select(); document.execCommand('copy'); } toast('📋 ' + L('Havola nusxalandi', 'Link copied', 'Ссылка скопирована')); };
    var sh = b.querySelector('#x-ref-share'); if (sh) sh.onclick = function () { navigator.share({ title: 'LevelUpDay', text: msg.replace(link, ''), url: link }).catch(function () {}); };
  }
  window.xOpenReferral = openReferral;
  refCaptureFromUrl();

  // =========================================================
  // 🛡 KLANLAR — 30 kishigacha; haftalik klan jangi: a'zolarning o'rtacha haftalik XP'si
  //   Hafta oxirida top-3 klan a'zolariga: 1-o'rin 15 💎, 2-o'rin 10 💎, 3-o'rin 5 💎
  // =========================================================
  var CLAN_EMOJIS = ['🛡', '🐉', '🦁', '🐺', '🦅', '🔥', '⚡', '🌙', '🚀', '📚', '👑', '💎'];
  var _clanData = null, _clanEmoji = '🛡';
  async function clanLoad() {
    if (!cloudOk()) return null;
    var r = await supabase.rpc('get_clan_data');
    if (r.error) { console.warn('[clan]', r.error.message); return null; }
    _clanData = r.data || {};
    S.xClanId = _clanData.mine ? _clanData.mine.id : null; // comp_record_event klan XP'sini ham yozishi uchun
    return _clanData;
  }
  async function clanClaim() {
    if (!cloudOk()) return;
    try {
      var r = await supabase.rpc('claim_clan_rewards');
      if (!r.error && r.data && r.data.gems > 0) { gemsAdd(r.data.gems, 'clan', '🛡 ' + L('Klan jangi mukofoti', 'Clan war reward', 'Награда клановой войны')); try { confetti(); } catch (e) {} save(); }
    } catch (e) {}
  }
  function clanErr(e) {
    return ({ level_too_low: L('Klan yaratish uchun Lv2 kerak', 'You need Lv2 to create a clan', 'Для создания клана нужен Lv2'),
      taken: L('Bu nom yoki teg band', 'This name or tag is taken', 'Это имя или тег заняты'),
      bad_name: L('Nom 3–24 belgi bo\'lsin', 'Name must be 3–24 characters', 'Имя: 3–24 символа'),
      bad_tag: L('Teg 2–5 ta lotin harfi/raqam', 'Tag: 2–5 letters/digits', 'Тег: 2–5 латинских букв/цифр'),
      already_in_clan: L('Siz allaqachon klandasiz', 'You are already in a clan', 'Вы уже в клане'),
      full: L('Klan to\'lgan', 'The clan is full', 'Клан заполнен'),
      cooldown: L('Klandan chiqqandan keyin 24 soat kutish kerak', 'Wait 24 hours after leaving a clan', 'После выхода из клана нужно подождать 24 часа'),
      not_found: L('Klan topilmadi', 'Clan not found', 'Клан не найден') })[e] || e;
  }
  function clanTagHtml(c) { return '<span class="x-clan-tag">[' + H(c.tag) + ']</span>'; }
  function clanHtml(d) {
    var h = '';
    var lw = d.lastWeek || [];
    if (d.mine) {
      var c = d.mine, isLeader = c.leaderId === S.cloudUserId;
      h += '<div class="x-clan-head"><div class="x-clan-emo">' + H(c.emoji) + '</div><div class="x-clan-hd"><b>' + H(c.name) + ' ' + clanTagHtml(c) + '</b>' +
        (c.description ? '<small>' + H(c.description) + '</small>' : '') + '</div></div>';
      h += '<div class="x-clan-stats"><div><b>#' + (c.rank || '—') + '</b><span>' + L('Haftalik o\'rin', 'Weekly rank', 'Место за неделю') + '</span></div>' +
        '<div><b>' + (c.score || 0) + '</b><span>' + L('O\'rtacha XP', 'Avg XP', 'Средний XP') + '</span></div>' +
        '<div><b>' + (c.members || []).length + '/' + c.maxMembers + '</b><span>' + L('A\'zolar', 'Members', 'Участники') + '</span></div></div>';
      h += '<div class="x-clan-note">⚔️ ' + L('Klanlar a\'zolarning shu haftadagi o\'rtacha XP\'si bo\'yicha bellashadi. Hafta oxirida top-3 klan a\'zolari: 🥇 15 💎 · 🥈 10 💎 · 🥉 5 💎', 'Clans compete on members\' average XP this week. At week end, members of the top-3 clans get 🥇 15 💎 · 🥈 10 💎 · 🥉 5 💎', 'Кланы соревнуются по среднему XP участников за неделю. В конце недели участники топ-3 кланов получают 🥇 15 💎 · 🥈 10 💎 · 🥉 5 💎') + '</div>';
      h += '<div class="x-sec-t">👥 ' + L('A\'zolar — shu hafta', 'Members — this week', 'Участники — эта неделя') + '</div>';
      h += (c.members || []).map(function (m, i) {
        var nm = H(m.name || '?'); try { if (window.xCosNameHtml) nm = window.xCosNameHtml(nm, m.cosmetics); } catch (e) {}
        try { var _st = window.staffNameHtml && window.staffNameHtml(H(m.name || '?'), m.id || m.user_id); if (_st) nm = _st; } catch (e) {}
        return '<div class="x-clan-row"><span class="x-clan-pos">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span><span class="x-clan-nm">' + nm + (m.role === 'leader' ? ' 👑' : '') + (m.id === S.cloudUserId ? ' <em>(' + L('siz', 'you', 'вы') + ')</em>' : '') + '</span>' +
          '<b>' + Math.round(m.weekXp || 0) + ' XP</b>' + (isLeader && m.id !== S.cloudUserId ? '<button class="x-link" data-clan-kick="' + H(m.id) + '">✕</button>' : '') + '</div>';
      }).join('');
      h += '<button class="x-btn sm ghost x-clan-leave" id="x-clan-leave">🚪 ' + L('Klandan chiqish', 'Leave clan', 'Покинуть клан') + '</button>';
    } else {
      var cd = d.cooldownUntil ? new Date(d.cooldownUntil) : null;
      h += '<div class="x-clan-note">' + L('Klanga qo\'shiling yoki o\'zingiz yarating. Har hafta klanlar a\'zolarning o\'rtacha XP\'si bo\'yicha bellashadi — top-3 klan a\'zolari 💎 oladi.', 'Join a clan or create your own. Every week clans compete on members\' average XP — top-3 clan members earn 💎.', 'Вступите в клан или создайте свой. Каждую неделю кланы соревнуются по среднему XP — участники топ-3 получают 💎.') +
        (cd && cd > new Date() ? '<br>⏳ ' + L('Yangi klanga kirish: ', 'You can join a new clan after ', 'Вступить в новый клан можно после ') + cd.toLocaleString() : '') + '</div>';
      h += '<details class="x-clan-create"><summary>➕ ' + L('Klan yaratish (Lv2+)', 'Create a clan (Lv2+)', 'Создать клан (Lv2+)') + '</summary>' +
        '<div class="x-clan-emos">' + CLAN_EMOJIS.map(function (e) { return '<button type="button" data-clan-emo="' + e + '" class="' + (e === _clanEmoji ? 'on' : '') + '">' + e + '</button>'; }).join('') + '</div>' +
        '<input id="x-clan-name" maxlength="24" placeholder="' + L('Klan nomi', 'Clan name', 'Название клана') + '">' +
        '<input id="x-clan-tag" maxlength="5" placeholder="' + L('Teg (2–5): DRM', 'Tag (2–5): DRM', 'Тег (2–5): DRM') + '" style="text-transform:uppercase">' +
        '<input id="x-clan-desc" maxlength="140" placeholder="' + L('Qisqa tavsif (ixtiyoriy)', 'Short description (optional)', 'Краткое описание (необязательно)') + '">' +
        '<button class="x-btn" id="x-clan-create">🛡 ' + L('Yaratish', 'Create', 'Создать') + '</button></details>';
    }
    if (lw.length) h += '<div class="x-sec-t">🏆 ' + L('O\'tgan hafta g\'oliblari', 'Last week\'s winners', 'Победители прошлой недели') + '</div>' +
      lw.map(function (w) { return '<div class="x-clan-row"><span class="x-clan-pos">' + (['🥇', '🥈', '🥉'][w.rank - 1] || w.rank) + '</span><span class="x-clan-nm">' + H(w.emoji) + ' ' + H(w.name) + ' ' + clanTagHtml(w) + '</span><b>' + Math.round(w.avgXp) + ' XP</b></div>'; }).join('');
    h += '<div class="x-sec-t">🌍 ' + L('Klanlar reytingi — shu hafta', 'Clan ranking — this week', 'Рейтинг кланов — эта неделя') + '</div>';
    h += (d.top || []).length ? (d.top || []).map(function (c, i) {
      var mineRow = d.mine && c.id === d.mine.id, full = c.members >= c.maxMembers;
      return '<div class="x-clan-row' + (mineRow ? ' mine' : '') + '"><span class="x-clan-pos">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span><span class="x-clan-nm">' + H(c.emoji) + ' ' + H(c.name) + ' ' + clanTagHtml(c) + '<small>👥 ' + c.members + '/' + c.maxMembers + '</small></span><b>' + Math.round(c.score || 0) + ' XP</b>' +
        (!d.mine && !full ? '<button class="x-btn sm" data-clan-join="' + H(c.id) + '">' + L('Qo\'shilish', 'Join', 'Вступить') + '</button>' : '') + '</div>';
    }).join('') : '<div class="ad-empty">' + L('Hali klanlar yo\'q — birinchisini siz yarating!', 'No clans yet — create the first one!', 'Кланов пока нет — создайте первый!') + '</div>';
    return h;
  }
  async function openClans() {
    if (!cloudOk()) { toast('🔐 ' + L('Klanlar uchun akkauntga kiring', 'Sign in to use clans', 'Войдите, чтобы пользоваться кланами')); return; }
    var ov = xModal('<h3 class="x-h">🛡 ' + L('Klanlar', 'Clans', 'Кланы') + '</h3><div id="x-clan-body"><div class="ad-empty">⏳</div></div>', 'x-clan-box');
    var body = ov.querySelector('#x-clan-body');
    var render = async function () {
      var d = await clanLoad();
      if (!d) { body.innerHTML = '<div class="ad-empty">⚠️ ' + L('Yuklab bo\'lmadi', 'Could not load', 'Не удалось загрузить') + '</div>'; return; }
      body.innerHTML = clanHtml(d);
      var act = async function (fn, okMsg) { var r = await fn(); if (r.error || !(r.data && r.data.ok)) { toast('❌ ' + clanErr(r.error ? r.error.message : r.data && r.data.error)); return; } if (okMsg) toast(okMsg); render(); };
      body.querySelectorAll('[data-clan-emo]').forEach(function (b) { b.onclick = function () { _clanEmoji = b.dataset.clanEmo; body.querySelectorAll('[data-clan-emo]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      var cr = body.querySelector('#x-clan-create'); if (cr) cr.onclick = function () {
        var nm = (body.querySelector('#x-clan-name').value || '').trim(), tg = (body.querySelector('#x-clan-tag').value || '').trim().toUpperCase(), ds = (body.querySelector('#x-clan-desc').value || '').trim();
        act(function () { return supabase.rpc('create_clan', { p_name: nm, p_tag: tg, p_emoji: _clanEmoji, p_desc: ds }); }, '🛡 ' + L('Klan yaratildi!', 'Clan created!', 'Клан создан!'));
      };
      body.querySelectorAll('[data-clan-join]').forEach(function (b) { b.onclick = function () { act(function () { return supabase.rpc('join_clan', { p_clan: b.dataset.clanJoin }); }, '🛡 ' + L('Klanga qo\'shildingiz!', 'You joined the clan!', 'Вы вступили в клан!')); }; });
      body.querySelectorAll('[data-clan-kick]').forEach(function (b) { b.onclick = function () { if (confirm(L('A\'zoni klandan chiqarasizmi?', 'Remove this member from the clan?', 'Исключить участника из клана?'))) act(function () { return supabase.rpc('kick_clan_member', { p_user: b.dataset.clanKick }); }); }; });
      var lv = body.querySelector('#x-clan-leave'); if (lv) lv.onclick = function () { if (confirm(L('Klandan chiqasizmi? 24 soat davomida boshqa klanga kira olmaysiz.', 'Leave the clan? You will not be able to join another clan for 24 hours.', 'Покинуть клан? 24 часа нельзя будет вступить в другой клан.'))) act(function () { return supabase.rpc('leave_clan'); }); };
    };
    await clanClaim();
    render();
  }
  window.xOpenClans = openClans;

  // ?action=… (manifest shortcuts)
  function handleLaunchAction() {
    try {
      var a = new URLSearchParams(location.search).get('action'); if (!a) return;
      history.replaceState(null, '', location.pathname + location.hash);
      if (a === 'new-task') setTimeout(function () { showTab('tasks'); openModal(); }, 400);
      if (a === 'pomodoro') setTimeout(function () { pomoOpenModal(); }, 400);
      if (a === 'tasks') setTimeout(function () { showTab('tasks'); }, 300);
      if (a === 'focusgate') setTimeout(function () { if (window.xOpenBlocker) window.xOpenBlocker('today'); else showTab('blocker'); }, 400);
      if (a === 'inbox') setTimeout(function () { showTab('hub'); if (window.xInbox) window.xInbox.open(); }, 400);
    } catch (e) {}
  }

  // ---------- script.js ulanish nuqtalari ----------
  window.xRenderHub = safe(renderHub);
  window.xRenderTasksExtras = safe(renderTasksExtras);
  window.xOnTaskDone = safe(function (tsk, on) {
    bossHit(tsk, on);
    if (on) {
      try { var cb = document.querySelector('.task-card[data-id="' + tsk.id + '"] .check-btn'); var rr = cb && cb.getBoundingClientRect(); shopEffectBurst(rr ? rr.left + rr.width / 2 : null, rr ? rr.top + rr.height / 2 : null); } catch (e) {}
      var n = (S.weekDoneLog || {})[today()] || 0;
      if ([5, 10, 20].indexOf(n) !== -1 && S.xFeedMilestone !== today() + ':' + n) {
        S.xFeedMilestone = today() + ':' + n;
        feedPost('tasks', L('bugun {n} ta vazifa bajardi', 'completed {n} tasks today', 'выполнил(а) {n} задач сегодня').replace('{n}', n), n >= 10 ? '🚀' : '💪');
      }
    }
  });
  window.xTaskChips = function (t, future) {
    try {
      if (future || !t.quad) return '';
      var Q = QUADS[t.quad - 1]; return Q ? '<span class="tk-chip x-qchip ' + Q.cls + '" title="' + H(Q.t()) + '">' + Q.icon + ' ' + H(Q.s()) + '</span>' : '';
    } catch (e) { return ''; }
  };
  // Olib tashlangan vositalar (Shablonlar, Kun yakuni, Suv) — eski keshlangan HTML xato bermasligi uchun bo'sh stublar
  window.xOpenTemplates = function () {};
  window.xOpenMatrix = safe(openMatrix);
  window.xOpenReview = function () {};
  window.xOpenWrap = safe(function (ym) { openWrap(ym); });
  window.xOpenFocus = safe(function (id, autoStart, minutes) { openFocus(id, autoStart, minutes); });
  window.xWaterAdd = function () {};
  window.xDismissReview = function () {};
  window.xSleepSet = safe(sleepSet);
  window.xOpenHub = function (sec) { if (sec) S.xHubSec = sec; showTab('hub'); };
  // 🛍 Do'konni ochib, kerakli mahsulotga aylantirish (Sozlamalardagi qulflangan dizayn/effektdan)
  window.xOpenShopItem = safe(function (itemId) {
    S.xHubSec = 'shop'; showTab('hub');
    setTimeout(function () {
      var el = document.querySelector('[data-shop-item="' + itemId + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('x-shop-flash'); void el.offsetWidth; el.classList.add('x-shop-flash');
      setTimeout(function () { el.classList.remove('x-shop-flash'); }, 1800);
    }, 260);
  });
  window.xShopRefresh = function () { try { renderHubSection('shop'); } catch (e) {} };

  function boot() {
    try { markMovedTabs(); buildBottomNav(); renderInstallUI(); handleLaunchAction(); } catch (e) { console.warn('[extras nav]', e); }
    // Ko'rinish tayyor — yuklanish pardasini ochamiz (index.html)
    try { requestAnimationFrame(function () { if (window.ludUiReady) window.ludUiReady(); }); } catch (e) { if (window.ludUiReady) window.ludUiReady(); }
    try { renderPushSettings(); setTimeout(window.xPushAuto, 4000); } catch (e) { console.warn('[push]', e); }
    try { setTimeout(window.xRenderTgSettings, 1500); } catch (e) {}
    try { setTimeout(window.xRenderTzSettings, 1600); } catch (e) {}
    // 💚 Onlayn holat: ilova ochiq turganda har 2 daqiqada faollik yuboriladi (do'stlarda "onlayn" ko'rinadi)
    var beat = function () {
      if (document.visibilityState !== 'visible' || !cloudOk()) return;
      try { supabase.rpc('touch_activity', { p_device: (typeof _cloudDeviceType === 'function' ? _cloudDeviceType() : null) }).then(function () {}, function () {}); } catch (e) {}
      try { if (typeof compDailyPing === 'function') compDailyPing(); } catch (e) {}
    };
    setTimeout(beat, 5000); setInterval(beat, 120000);
    setTimeout(refSync, 6000);
    setTimeout(function () { clanLoad().then(function () {}, function () {}); clanClaim(); }, 7000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') beat(); });
    try { new MutationObserver(function () { renderBottomNav(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tab'] }); } catch (e) {}
    try { bossState(); bossResolve(); } catch (e) {}
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { try { bossResolve(); renderBossStrip(false); } catch (e) {} }, 400); });
    shopApply();
    try { window.xAchWallRender(); } catch (e) {}
    renderTasksExtras();
    maybeShowWrap();
    // render() dan keyin profil/sarlavha qayta chizilganda bezaklar saqlanib qolsin
    var mo = new MutationObserver(function () { if (shopTitleText() && !document.getElementById('x-profile-title')) shopApply(); });
    var host = document.getElementById('profile-header-text'); if (host) mo.observe(host, { childList: true });
    setInterval(function () { try { renderTasksExtras(); } catch (e) {} }, 60000);
  }
  // Asosiy ilova (bootSharedApp) tayyor bo'lishi bilan — qat'iy 600 ms kutmasdan (parda tezroq ochiladi)
  var bootWhenReady = function () { var n = 0; (function w() { if (window._appBooted || n++ > 80) boot(); else setTimeout(w, 25); })(); };
  if (document.readyState === 'complete') bootWhenReady(); else window.addEventListener('load', bootWhenReady);
})();

// ============================================================
// 📨 FIKRLAR: admin inbox (javob, izoh, prioritet, ommaviy amallar)
//    + foydalanuvchi uchun "Mening xabarlarim" (admin javoblari).
// RPC'lar: admin_list_feedback, admin_set_feedback_status,
// admin_delete_feedback, admin_reply_feedback, admin_update_feedback_meta,
// get_my_feedback, mark_feedback_replies_seen.
// script.js dagi adminRenderFeedback / adminFeedbackSet / adminFeedbackDelete /
// openFeedbackModal shu yerda kengaytiriladi (global nomlar saqlanadi).
// ⚠️ Fikr matni — ishonchsiz kiritma: hammasi H() orqali escape qilinadi.
// ============================================================
(function () {
  'use strict';
  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  function cloudOk() { return !!(S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.rpc); }
  function lang() { try { return getLang(); } catch (e) { return 'uz'; } }
  function locale() { var l = lang(); return l === 'ru' ? 'ru-RU' : (l === 'en' ? 'en-GB' : 'uz-UZ'); }
  // RPC — hech qachon throw qilmaydi: { data, error }
  function rpc(name, args) {
    try {
      if (typeof supabase === 'undefined' || !supabase || !supabase.rpc) return Promise.resolve({ data: null, error: { message: 'offline' } });
      return Promise.resolve(supabase.rpc(name, args || {})).then(function (r) { return r || { data: null, error: { message: 'empty' } }; },
        function (e) { return { data: null, error: { message: (e && e.message) || String(e) } }; });
    } catch (e) { return Promise.resolve({ data: null, error: { message: (e && e.message) || String(e) } }); }
  }
  function errHtml(err) {
    var m = (err && err.message) || '';
    var missing = /function|does not exist|schema cache|404|PGRST202/i.test(m);
    return '<div class="fbx-err">⚠️ ' + (missing
      ? L('Bu funksiya serverda hali yoqilmagan. Keyinroq urinib ko\'ring.', 'This feature is not enabled on the server yet. Please try later.', 'Эта функция ещё не включена на сервере. Попробуйте позже.')
      : L('Yuklab bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.', 'Could not load. Check your connection and try again.', 'Не удалось загрузить. Проверьте соединение и повторите.')) +
      (m ? '<small>' + H(m.slice(0, 160)) + '</small>' : '') + '</div>';
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return L('hozirgina', 'just now', 'только что');
    if (diff < 3600) return Math.floor(diff / 60) + ' ' + L('daq oldin', 'min ago', 'мин назад');
    if (diff < 86400) return Math.floor(diff / 3600) + ' ' + L('soat oldin', 'h ago', 'ч назад');
    try { return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ' ' + d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return d.toLocaleString(); }
  }
  function fullDate(iso) { try { return new Date(iso).toLocaleString(locale()); } catch (e) { return String(iso || ''); } }
  function shortDevice(ua) {
    ua = String(ua || ''); if (!ua) return '';
    var os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /YaBrowser/.test(ua) ? 'Yandex' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    var mob = /Mobile|Android|iPhone/.test(ua) ? '📱' : '💻';
    return mob + ' ' + ([os, br].filter(Boolean).join(' · ') || ua.slice(0, 30));
  }
  function kinds() {
    return { bug: ['🐞', L('Xato', 'Bug', 'Ошибка')], idea: ['💡', L('G\'oya', 'Idea', 'Идея')], complaint: ['😕', L('Shikoyat', 'Complaint', 'Жалоба')], other: ['💬', L('Boshqa', 'Other', 'Другое')] };
  }
  function kindBadge(k) {
    var known = kinds()[k];
    var m = known || ['💬', H(k || '?')];
    return '<span class="fbx-kind fbx-k-' + (known ? k : 'other') + '">' + m[0] + ' ' + m[1] + '</span>';
  }
  function stMeta() {
    return {
      'new': ['🆕', L('Yangi', 'New', 'Новый')],
      read: ['👁', L('O\'qilgan', 'Read', 'Прочитан')],
      in_progress: ['🛠', L('Jarayonda', 'In progress', 'В работе')],
      done: ['✅', L('Bajarildi', 'Done', 'Готово')],
      wontfix: ['🚫', L('Qilinmaydi', 'Won\'t fix', 'Не будет')]
    };
  }
  function stChip(st) {
    var known = stMeta()[st];
    var m = known || ['•', H(st)];
    return '<span class="fbx-st fbx-st-' + (known ? st : 'new') + '">' + m[0] + ' ' + m[1] + '</span>';
  }
  var PRI_COL = ['', '#60A5FA', '#F59E0B', '#EF4444'];
  function priLabel(p) { return [L('Yo\'q', 'None', 'Нет'), L('Past', 'Low', 'Низкий'), L('O\'rta', 'Medium', 'Средний'), L('Yuqori', 'High', 'Высокий')][p] || ''; }
  function flag(p) {
    p = Math.max(0, Math.min(3, Number(p) || 0));
    return '<span class="fbx-flag' + (p ? '' : ' off') + '"' + (p ? ' style="--fc:' + PRI_COL[p] + '"' : '') + ' title="' + H(priLabel(p)) + '">⚑' + (p ? '<b>' + p + '</b>' : '') + '</span>';
  }
  function copyText(t) {
    var ok = function () { toast('📋 ' + L('Nusxalandi', 'Copied', 'Скопировано')); };
    var fallback = function () {
      try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok(); }
      catch (e) { toast('⚠️ ' + L('Nusxalab bo\'lmadi', 'Could not copy', 'Не удалось скопировать')); }
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, fallback); return; } } catch (e) {}
    fallback();
  }
  var holdAsk = function (msgHtml, onOk, opts) {
    if (typeof showHoldConfirmModal === 'function') return showHoldConfirmModal(msgHtml, onOk, opts);
    if (window.UIKit && UIKit.holdConfirm) return UIKit.holdConfirm(Object.assign({ message: msgHtml, onConfirm: onOk }, opts || {}));
    var tmp = document.createElement('div'); tmp.innerHTML = msgHtml; if (confirm(tmp.textContent)) onOk();
  };
  // Segment: UIKit.rubberSegment (adopt-rejimda — o'zimizning tugmalar), bo'lmasa oddiy chiplar
  function segment(host, items, cur, onChange, label, opts) {
    host.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.innerHTML = it.html || H(it.label);
      if (it.id) b.id = it.id;
      b.dataset.v = it.value;
      if (it.value === cur) b.className = 'active';
      b.onclick = function () {
        host.querySelectorAll(':scope > button').forEach(function (x) { x.classList.toggle('active', x === b); });
        onChange(it.value);
      };
      host.appendChild(b);
    });
    if (window.UIKit && typeof UIKit.rubberSegment === 'function') {
      try { UIKit.rubberSegment(host, Object.assign({ adopt: true, radius: 999, size: 'sm', label: label }, opts || {})); return; } catch (e) {}
    }
    host.classList.add('fbx-chips');
  }

  // =========================================================
  // 👑 ADMIN INBOX
  // =========================================================
  var A = { tab: 'inbox', kind: '', q: '', sort: 'new', rows: null, err: null, sel: {}, open: {}, drafts: {}, newCount: null };
  var TABS = ['inbox', 'in_progress', 'done', 'wontfix', 'all'];
  function inTab(f, tab) {
    if (tab === 'all') return true;
    if (tab === 'inbox') return f.status === 'new' || f.status === 'read' || !f.status;
    return f.status === tab;
  }
  function tabLabel(t) {
    return { inbox: '📥 ' + L('Kiruvchi', 'Inbox', 'Входящие'), in_progress: '🛠 ' + L('Jarayonda', 'In progress', 'В работе'), done: '✅ ' + L('Bajarildi', 'Done', 'Готово'), wontfix: '🚫 ' + L('Qilinmaydi', 'Won\'t fix', 'Не будет'), all: '🗂 ' + L('Hammasi', 'All', 'Все') }[t];
  }
  function countFor(t) { return (A.rows || []).filter(function (f) { return inTab(f, t); }).length; }
  function unreadCount() { return (A.rows || []).filter(function (f) { return f.status === 'new'; }).length; }
  function visibleRows() {
    var q = A.q.trim().toLowerCase();
    var list = (A.rows || []).filter(function (f) {
      if (!inTab(f, A.tab)) return false;
      if (A.kind && f.kind !== A.kind) return false;
      if (q) {
        var hay = [f.message, f.user_name, f.contact, f.admin_note, f.admin_reply, f.id].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var t = function (f) { return new Date(f.created_at).getTime() || 0; };
    list.sort(function (a, b) {
      if (A.sort === 'priority') { var d = (Number(b.priority) || 0) - (Number(a.priority) || 0); if (d) return d; }
      if (A.sort === 'old') return t(a) - t(b);
      return t(b) - t(a);
    });
    return list;
  }
  function rowById(id) { id = String(id); return (A.rows || []).find(function (f) { return String(f.id) === id; }); }
  function box() { return document.getElementById('admin-feedback-box'); }

  function adminShell() {
    var b = box(); if (!b) return;
    b.innerHTML = '<div class="fbx">' +
      '<div class="fbx-top"><div class="fbx-title">📨 ' + L('Fikrlar qutisi', 'Feedback inbox', 'Входящие отзывы') + '</div><div class="fbx-sum" id="fbx-sum"></div>' +
      '<button type="button" class="x-btn ghost sm" id="fbx-reload" title="' + L('Yangilash', 'Reload', 'Обновить') + '">↻</button></div>' +
      '<div class="fbx-seg-wrap"><div id="fbx-seg"></div></div>' +
      '<div class="fbx-tools">' +
        '<input id="fbx-q" type="search" class="fbx-in" maxlength="80" placeholder="🔎 ' + L('Qidirish: matn, ism, aloqa...', 'Search: text, name, contact...', 'Поиск: текст, имя, контакт...') + '" />' +
        '<select id="fbx-kind" class="fbx-in fbx-sel" aria-label="kind"><option value="">' + L('Barcha turlar', 'All kinds', 'Все типы') + '</option>' +
          Object.keys(kinds()).map(function (k) { return '<option value="' + k + '">' + kinds()[k][0] + ' ' + kinds()[k][1] + '</option>'; }).join('') + '</select>' +
        '<select id="fbx-sort" class="fbx-in fbx-sel" aria-label="sort"><option value="new">↓ ' + L('Eng yangi', 'Newest', 'Сначала новые') + '</option><option value="priority">⚑ ' + L('Prioritet', 'Priority', 'Приоритет') + '</option><option value="old">↑ ' + L('Eng eski', 'Oldest', 'Сначала старые') + '</option></select>' +
      '</div>' +
      '<div id="fbx-bulk" class="fbx-bulk"></div>' +
      '<div id="fbx-list" class="fbx-list"><div class="ad-empty">⏳ ' + L('Yuklanmoqda...', 'Loading...', 'Загрузка...') + '</div></div></div>';
    var q = b.querySelector('#fbx-q'); q.value = A.q;
    var qt = 0; q.oninput = function () { clearTimeout(qt); qt = setTimeout(function () { A.q = q.value; renderList(); }, 150); };
    var k = b.querySelector('#fbx-kind'); k.value = A.kind; k.onchange = function () { A.kind = k.value; renderList(); };
    var so = b.querySelector('#fbx-sort'); so.value = A.sort; so.onchange = function () { A.sort = so.value; renderList(); };
    b.querySelector('#fbx-reload').onclick = function () { adminLoad(); };
    renderSeg(true);
    var list = b.querySelector('#fbx-list');
    list.addEventListener('click', onListClick);
    list.addEventListener('input', onListInput);
    list.addEventListener('change', onListChange);
    b.querySelector('#fbx-bulk').addEventListener('click', onBulkClick);
    b.querySelector('#fbx-bulk').addEventListener('change', onBulkClick);
  }
  function segHtml(t) { var n = A.rows ? countFor(t) : ''; return H(tabLabel(t)) + (n !== '' ? ' <em class="fbx-cnt">' + n + '</em>' : ''); }
  function renderSeg(build) {
    var host = document.getElementById('fbx-seg'); if (!host) return;
    if (!build && host.children.length) {
      // faqat sonlarni yangilash (thumb ResizeObserver orqali ergashadi)
      host.querySelectorAll(':scope > button[data-v]').forEach(function (b) { var h = segHtml(b.dataset.v); if (b.innerHTML !== h) b.innerHTML = h; });
      return;
    }
    segment(host, TABS.map(function (t) { return { value: t, html: segHtml(t) }; }), A.tab, function (v) { A.tab = v; A.sel = {}; renderList(); }, L('Holat filtri', 'Status filter', 'Фильтр статуса'));
  }
  function renderSum() {
    var el = document.getElementById('fbx-sum'); if (!el || !A.rows) return;
    var n = unreadCount();
    el.innerHTML = '<span>' + A.rows.length + ' ' + L('ta', 'total', 'всего') + '</span>' + (n ? '<span class="fbx-unread">' + n + ' ' + L('yangi', 'new', 'новых') + '</span>' : '');
  }
  function selIds() { return Object.keys(A.sel).filter(function (k) { return A.sel[k] && rowById(k); }); }
  function renderBulk() {
    var el = document.getElementById('fbx-bulk'); if (!el) return;
    var ids = selIds();
    var vis = visibleRows();
    if (!vis.length || A.err) { el.innerHTML = ''; return; }
    var allOn = vis.every(function (f) { return A.sel[f.id]; });
    el.innerHTML = '<label class="fbx-chk"><input type="checkbox" data-bulk="all"' + (allOn ? ' checked' : '') + '> ' + (ids.length ? '<b>' + ids.length + '</b> ' + L('tanlandi', 'selected', 'выбрано') : L('Hammasini tanlash', 'Select all', 'Выбрать все')) + '</label>' +
      (ids.length ? '<span class="fbx-bulk-a"><button type="button" class="x-btn sm" data-bulk="done">✅ ' + L('Bajarildi', 'Mark done', 'Готово') + '</button>' +
        '<button type="button" class="x-btn ghost sm" data-bulk="read">👁 ' + L('O\'qildi', 'Read', 'Прочитано') + '</button>' +
        '<button type="button" class="x-btn sm fbx-danger" data-bulk="del">🗑 ' + L('O\'chirish', 'Delete', 'Удалить') + '</button>' +
        '<button type="button" class="x-btn ghost sm" data-bulk="clear" aria-label="clear">✕</button></span>' : '');
  }
  function templates() {
    return [
      { icon: '✅', uz: 'Rahmat! Tuzatdik ✅', en: 'Thanks! We fixed it ✅', ru: 'Спасибо! Исправили ✅' },
      { icon: '👀', uz: 'Ko\'rib chiqyapmiz, tez orada xabar beramiz.', en: 'We\'re looking into it and will update you soon.', ru: 'Изучаем, скоро сообщим.' },
      { icon: '✍️', uz: 'Batafsilroq yozing: qaysi qurilma va qanday qadamlardan keyin bo\'ldi?', en: 'Please tell us more: which device and what steps led to it?', ru: 'Напишите подробнее: какое устройство и после каких шагов?' },
      { icon: '💡', uz: 'Ajoyib g\'oya! Rejamizga qo\'shdik 💡', en: 'Great idea! We added it to our plans 💡', ru: 'Отличная идея! Добавили в планы 💡' },
      { icon: '🙏', uz: 'Fikringiz uchun rahmat! 🙏', en: 'Thank you for your feedback! 🙏', ru: 'Спасибо за ваш отзыв! 🙏' }
    ];
  }
  function tplShort(t) { var s = t[lang()] || t.uz; return s.length > 26 ? s.slice(0, 24) + '…' : s; }
  function itemHtml(f) {
    var open = !!A.open[f.id], sel = !!A.sel[f.id], p = Math.max(0, Math.min(3, Number(f.priority) || 0));
    var msg = String(f.message || '');
    var long = msg.length > 220 || msg.split('\n').length > 4;
    var who = f.user_name ? H(f.user_name) : '<i>' + L('Mehmon', 'Guest', 'Гость') + '</i>';
    var meta = [shortDevice(f.device), f.lang ? '🌐 ' + String(f.lang).toUpperCase() : '', f.user_id ? '' : '👤 ' + L('akkauntsiz', 'no account', 'без аккаунта')].filter(Boolean);
    var sid = H(f.id);
    var h = '<div class="fbx-item' + (f.status === 'new' ? ' is-new' : '') + (open ? ' is-open' : '') + (sel ? ' is-sel' : '') + '" data-id="' + sid + '"' + (p ? ' style="--pc:' + PRI_COL[p] + '"' : '') + '>' +
      '<div class="fbx-ih">' +
        '<label class="fbx-cb" title="' + L('Tanlash', 'Select', 'Выбрать') + '"><input type="checkbox" data-act="sel"' + (sel ? ' checked' : '') + '></label>' +
        '<div class="fbx-ih-m" data-act="toggle">' +
          '<div class="fbx-ih-1">' + (f.status === 'new' ? '<i class="fbx-dot" aria-label="new"></i>' : '') + '<b class="fbx-who">' + who + '</b>' + kindBadge(f.kind) + stChip(f.status) + (p ? flag(p) : '') + (f.admin_reply ? '<span class="fbx-replied" title="' + H(L('Javob berilgan', 'Replied', 'Есть ответ')) + '">↩︎</span>' : '') + '</div>' +
          '<div class="fbx-ih-2"><span title="' + H(fullDate(f.created_at)) + '">' + H(fmtDate(f.created_at)) + '</span>' + meta.map(function (m) { return '<span>' + H(m) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<button type="button" class="fbx-chev" data-act="toggle" aria-label="expand" aria-expanded="' + open + '">' + (open ? '▴' : '▾') + '</button>' +
      '</div>' +
      '<div class="fbx-msg' + (open || !long ? '' : ' clamp') + '" data-act="toggle">' + H(msg) + '</div>';
    if (!open) return h + (long ? '<button type="button" class="fbx-more" data-act="toggle">' + L('Ko\'proq', 'Show more', 'Ещё') + ' ▾</button>' : '') + '</div>';
    var rl = ['uz', 'en', 'ru'].indexOf(f.lang) >= 0 ? f.lang : lang();
    h += '<div class="fbx-body">' +
      (f.contact ? '<div class="fbx-row"><span class="fbx-lbl">✉️ ' + L('Aloqa', 'Contact', 'Контакт') + '</span><span class="fbx-val">' + H(f.contact) + '</span><button type="button" class="fbx-mini" data-act="copy-contact" aria-label="copy">📋</button></div>' : '') +
      (f.device ? '<div class="fbx-row"><span class="fbx-lbl">🖥 ' + L('Qurilma', 'Device', 'Устройство') + '</span><span class="fbx-val fbx-ua">' + H(f.device) + '</span></div>' : '') +
      '<div class="fbx-row"><span class="fbx-lbl">#</span><span class="fbx-val">' + sid + ' · ' + H(fullDate(f.created_at)) + '</span></div>' +
      '<div class="fbx-sec-t">' + L('Holat', 'Status', 'Статус') + '</div><div class="fbx-sts">' +
        ['read', 'in_progress', 'done', 'wontfix'].map(function (s) { var m = stMeta()[s]; return '<button type="button" class="fbx-stb fbx-st-' + s + (f.status === s ? ' on' : '') + '" data-act="status" data-st="' + s + '" aria-pressed="' + (f.status === s) + '">' + m[0] + ' ' + m[1] + '</button>'; }).join('') +
      '</div>' +
      '<div class="fbx-sec-t">' + L('Prioritet', 'Priority', 'Приоритет') + '</div><div class="fbx-pris">' +
        [0, 1, 2, 3].map(function (n) { return '<button type="button" class="fbx-prb' + (p === n ? ' on' : '') + '" data-act="pri" data-p="' + n + '"' + (n ? ' style="--fc:' + PRI_COL[n] + '"' : '') + ' aria-pressed="' + (p === n) + '">' + (n ? '⚑ ' : '○ ') + priLabel(n) + '</button>'; }).join('') +
      '</div>' +
      '<div class="fbx-sec-t">🔒 ' + L('Shaxsiy izoh (faqat admin)', 'Private note (admin only)', 'Личная заметка (только админ)') + ' <span class="fbx-saved" data-saved></span></div>' +
      '<textarea class="fbx-in fbx-note" data-act="note" rows="2" maxlength="1000" placeholder="' + L('Masalan: v2.3 da tuzatiladi', 'e.g. fix in v2.3', 'напр.: исправить в v2.3') + '">' + H(f.admin_note || '') + '</textarea>' +
      '<div class="fbx-sec-t">↩︎ ' + L('Javob', 'Reply', 'Ответ') + ' <span class="fbx-dim">(' + L('foydalanuvchi ko\'radi', 'visible to the user', 'увидит пользователь') + ')</span></div>' +
      (f.admin_reply ? '<div class="fbx-reply-old"><div class="fbx-bubble admin">' + H(f.admin_reply) + '</div><div class="fbx-reply-meta">' + H(fmtDate(f.replied_at)) + ' · ' + (f.reply_seen ? '👁 ' + L('ko\'rildi', 'seen', 'просмотрено') : '⏳ ' + L('hali ko\'rilmadi', 'not seen yet', 'ещё не просмотрено')) + '</div></div>' : '') +
      (f.user_id ? '<div class="fbx-tpls">' + templates().map(function (t, i) { return '<button type="button" class="fbx-tpl" data-act="tpl" data-i="' + i + '" data-l="' + rl + '" title="' + H(t[rl] || t.uz) + '">' + t.icon + ' ' + H(tplShort(t)) + '</button>'; }).join('') + '</div>' +
        '<textarea class="fbx-in fbx-reply" data-act="reply-draft" rows="3" maxlength="2000" placeholder="' + L('Javob yozing...', 'Write a reply...', 'Напишите ответ...') + '">' + H(A.drafts[f.id] || '') + '</textarea>' +
        '<div class="fbx-reply-f"><span class="fbx-dim" data-rc>' + String(A.drafts[f.id] || '').length + ' / 2000</span><button type="button" class="x-btn sm" data-act="reply">' + (f.admin_reply ? '✏️ ' + L('Javobni yangilash', 'Update reply', 'Обновить ответ') : '📤 ' + L('Javob yuborish', 'Send reply', 'Отправить ответ')) + '</button></div>'
        : '<div class="fbx-dim fbx-noacc">👤 ' + L('Akkauntsiz yuborilgan — foydalanuvchi ilovada javobni ko\'ra olmaydi. Aloqa orqali yozing.', 'Sent without an account — the user can\'t see in-app replies. Use the contact.', 'Отправлено без аккаунта — ответ в приложении не увидят. Используйте контакт.') + '</div>') +
      '<div class="fbx-acts">' +
        '<button type="button" class="x-btn ghost sm" data-act="copy">📋 ' + L('Nusxa', 'Copy', 'Копировать') + '</button>' +
        (f.user_id ? '<button type="button" class="x-btn ghost sm" data-act="profile">👤 ' + L('Profil', 'Profile', 'Профиль') + '</button>' : '') +
        '<button type="button" class="x-btn sm fbx-danger" data-act="del">🗑 ' + L('O\'chirish', 'Delete', 'Удалить') + '</button>' +
      '</div></div></div>';
    return h;
  }
  function renderList() {
    var el = document.getElementById('fbx-list'); if (!el) return;
    renderSum(); renderSeg();
    if (A.err) { el.innerHTML = errHtml(A.err); renderBulk(); return; }
    if (!A.rows) { el.innerHTML = '<div class="ad-empty">⏳ ' + L('Yuklanmoqda...', 'Loading...', 'Загрузка...') + '</div>'; return; }
    var rows = visibleRows();
    renderBulk();
    el.innerHTML = rows.length ? rows.map(itemHtml).join('') : '<div class="ad-empty">— ' + ((A.q || A.kind) ? L('Hech narsa topilmadi', 'Nothing found', 'Ничего не найдено') : L('Bu bo\'limda fikr yo\'q', 'No feedback here', 'Здесь пока пусто')) + ' —</div>';
  }
  function itemEl(id) {
    var list = document.getElementById('fbx-list'); if (!list) return null;
    var els = list.querySelectorAll('.fbx-item');
    for (var i = 0; i < els.length; i++) if (els[i].dataset.id === String(id)) return els[i];
    return null;
  }
  function rerenderItem(id) {
    var el = itemEl(id), f = rowById(id);
    if (!el) return;
    if (!f || !visibleRows().some(function (x) { return String(x.id) === String(id); })) { renderList(); return; }
    var tmp = document.createElement('div'); tmp.innerHTML = itemHtml(f); el.replaceWith(tmp.firstChild);
    renderSum(); renderSeg(); renderBulk();
  }

  var _loadSeq = 0;
  async function adminLoad() {
    var seq = ++_loadSeq;
    A.err = null;
    if (!document.getElementById('fbx-list')) adminShell();
    renderList();
    var r = await rpc('admin_list_feedback', { p_status: null, p_limit: 500 });
    if (seq !== _loadSeq) return;
    if (r.error) { A.err = r.error; renderList(); return; }
    A.rows = Array.isArray(r.data) ? r.data : [];
    A.newCount = unreadCount(); paintAdminBadges();
    renderList();
  }
  async function setStatus(ids, st) {
    ids = [].concat(ids);
    var res = await Promise.all(ids.map(function (id) { return rpc('admin_set_feedback_status', { p_id: Number(id), p_status: st }); }));
    var fail = 0;
    res.forEach(function (r, i) { if (r.error) { fail++; return; } var f = rowById(ids[i]); if (f) f.status = st; });
    if (fail) toast('⚠️ ' + L('Ba\'zilari saqlanmadi', 'Some changes failed', 'Часть изменений не сохранена') + ' (' + fail + ')');
    A.newCount = unreadCount(); paintAdminBadges();
    return !fail;
  }
  async function deleteIds(ids) {
    ids = [].concat(ids);
    var res = await Promise.all(ids.map(function (id) { return rpc('admin_delete_feedback', { p_id: Number(id) }); }));
    var fail = 0;
    res.forEach(function (r, i) {
      if (r.error) { fail++; return; }
      A.rows = (A.rows || []).filter(function (f) { return String(f.id) !== String(ids[i]); });
      delete A.sel[ids[i]]; delete A.open[ids[i]];
    });
    toast(fail ? '⚠️ ' + L('O\'chirib bo\'lmadi', 'Could not delete', 'Не удалось удалить') + ' (' + fail + ')' : '🗑 ' + L('O\'chirildi', 'Deleted', 'Удалено') + (ids.length > 1 ? ' (' + ids.length + ')' : ''));
    A.newCount = unreadCount(); paintAdminBadges();
    renderList();
  }
  var noteTimers = {};
  function savedMark(id, txt) { var it = itemEl(id), m = it && it.querySelector('[data-saved]'); if (m) m.textContent = txt; return m; }
  function saveMeta(id) {
    var f = rowById(id); if (!f) return Promise.resolve(false);
    savedMark(id, '⏳');
    return rpc('admin_update_feedback_meta', { p_id: Number(id), p_note: f.admin_note ? String(f.admin_note) : null, p_priority: Math.max(0, Math.min(3, Number(f.priority) || 0)) }).then(function (r) {
      if (r.error) { savedMark(id, '⚠️'); toast('⚠️ ' + L('Saqlanmadi', 'Not saved', 'Не сохранено') + ': ' + String(r.error.message || '').slice(0, 80)); return false; }
      var m = savedMark(id, '✓ ' + L('saqlandi', 'saved', 'сохранено'));
      if (m) setTimeout(function () { if (m.textContent.indexOf('✓') === 0) m.textContent = ''; }, 1800);
      return true;
    });
  }
  function onListInput(e) {
    var t = e.target, it = t.closest('.fbx-item'); if (!it) return;
    var id = it.dataset.id, f = rowById(id); if (!f) return;
    if (t.dataset.act === 'note') {
      f.admin_note = t.value;
      savedMark(id, '…');
      clearTimeout(noteTimers[id]); noteTimers[id] = setTimeout(function () { noteTimers[id] = 0; saveMeta(id); }, 900);
    } else if (t.dataset.act === 'reply-draft') {
      A.drafts[id] = t.value;
      var rc = it.querySelector('[data-rc]'); if (rc) rc.textContent = t.value.length + ' / 2000';
    }
  }
  function onListChange(e) {
    var t = e.target, it = t.closest('.fbx-item'); if (!it) return;
    var id = it.dataset.id;
    if (t.dataset.act === 'sel') { if (t.checked) A.sel[id] = true; else delete A.sel[id]; it.classList.toggle('is-sel', t.checked); renderBulk(); }
    if (t.dataset.act === 'note' && noteTimers[id]) { clearTimeout(noteTimers[id]); noteTimers[id] = 0; saveMeta(id); }
  }
  function onListClick(e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var it = t.closest('.fbx-item'); if (!it) return;
    var id = it.dataset.id, f = rowById(id); if (!f) return;
    var act = t.dataset.act;
    if (act === 'sel' || act === 'note' || act === 'reply-draft') return;
    if (act === 'toggle') {
      if (e.target.closest('.fbx-msg') && window.getSelection && String(window.getSelection())) return; // matn belgilanmoqda
      A.open[id] = !A.open[id];
      if (A.open[id] && f.status === 'new') {
        f.status = 'read'; // optimistik: ochildi → o'qildi
        rpc('admin_set_feedback_status', { p_id: Number(id), p_status: 'read' }).then(function (r) {
          if (r.error) { f.status = 'new'; rerenderItem(id); }
          A.newCount = unreadCount(); paintAdminBadges();
        });
        A.newCount = unreadCount(); paintAdminBadges();
      }
      rerenderItem(id);
      return;
    }
    if (act === 'status') {
      var st = t.dataset.st; if (f.status === st) return;
      t.disabled = true;
      setStatus(id, st).then(function (ok) { if (ok) toast(stMeta()[st][0] + ' ' + stMeta()[st][1]); rerenderItem(id); });
      return;
    }
    if (act === 'pri') {
      var old = f.priority; f.priority = Number(t.dataset.p) || 0;
      if (Number(old) === f.priority) return;
      rerenderItem(id);
      saveMeta(id).then(function (ok) { if (!ok) { f.priority = old; rerenderItem(id); } });
      return;
    }
    if (act === 'tpl') {
      var tp = templates()[+t.dataset.i]; if (!tp) return;
      var ta = it.querySelector('.fbx-reply'); if (!ta) return;
      var txt = tp[t.dataset.l] || tp.uz;
      ta.value = (ta.value.trim() ? (ta.value.replace(/\s+$/, '') + '\n' + txt) : txt).slice(0, 2000);
      A.drafts[id] = ta.value;
      var rc = it.querySelector('[data-rc]'); if (rc) rc.textContent = ta.value.length + ' / 2000';
      ta.focus();
      return;
    }
    if (act === 'reply') {
      var ta2 = it.querySelector('.fbx-reply'); var txt2 = ((ta2 && ta2.value) || '').trim().slice(0, 2000);
      if (txt2.length < 2) { toast(L('Javob matnini yozing', 'Write a reply first', 'Напишите ответ')); if (ta2) ta2.focus(); return; }
      t.disabled = true; t.textContent = '⏳ ...';
      rpc('admin_reply_feedback', { p_id: Number(id), p_reply: txt2 }).then(function (r) {
        if (r.error) { toast('⚠️ ' + L('Javob yuborilmadi', 'Reply failed', 'Ответ не отправлен') + ': ' + String(r.error.message || '').slice(0, 80)); rerenderItem(id); return; }
        f.admin_reply = txt2; f.replied_at = new Date().toISOString(); f.reply_seen = false;
        if (f.status === 'new') f.status = 'read';
        delete A.drafts[id];
        A.newCount = unreadCount(); paintAdminBadges();
        toast('📤 ' + L('Javob yuborildi', 'Reply sent', 'Ответ отправлен'));
        rerenderItem(id);
      });
      return;
    }
    if (act === 'copy') { copyText(String(f.message || '')); return; }
    if (act === 'copy-contact') { copyText(String(f.contact || '')); return; }
    if (act === 'profile') { openProfile(f.user_id); return; }
    if (act === 'del') {
      holdAsk(L('Bu fikr butunlay o\'chiriladi:', 'This feedback will be permanently deleted:', 'Отзыв будет удалён навсегда:') + '<div class="fbx-del-q">' + H(String(f.message || '').slice(0, 140)) + '</div>',
        function () { deleteIds([id]); }, { icon: '🗑', title: L('Fikrni o\'chirish', 'Delete feedback', 'Удалить отзыв') });
    }
  }
  function onBulkClick(e) {
    var t = e.target.closest('[data-bulk]'); if (!t) return;
    var b = t.dataset.bulk;
    if (b === 'all') {
      if (e.type !== 'change') return;
      var vis = visibleRows(), allOn = vis.every(function (f) { return A.sel[f.id]; });
      A.sel = {}; if (!allOn) vis.forEach(function (f) { A.sel[f.id] = true; });
      renderList(); return;
    }
    if (e.type !== 'click') return;
    if (b === 'clear') { A.sel = {}; renderList(); return; }
    var ids = selIds(); if (!ids.length) return;
    if (b === 'done' || b === 'read') {
      t.disabled = true;
      setStatus(ids, b).then(function (ok) { A.sel = {}; if (ok) toast(stMeta()[b][0] + ' × ' + ids.length); renderList(); });
      return;
    }
    if (b === 'del') {
      holdAsk(L('Tanlangan fikrlar o\'chiriladi', 'Selected feedback will be deleted', 'Выбранные отзывы будут удалены') + ': <b>' + ids.length + '</b>',
        function () { deleteIds(ids); }, { icon: '🗑', title: L('Ommaviy o\'chirish', 'Bulk delete', 'Массовое удаление') });
    }
  }
  function openProfile(uid) {
    if (!uid) return;
    var before = document.getElementById('player-profile-modal');
    try { if (typeof showPlayerProfileModal === 'function') showPlayerProfileModal(uid); } catch (e) {}
    var m = document.getElementById('player-profile-modal');
    if (m && m !== before) { m.style.zIndex = '480'; return; }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(uid)).catch(function () {}); } catch (e) {}
    toast('👤 ' + L('Profil reytingda topilmadi — ID nusxalandi', 'Profile not in leaderboard — ID copied', 'Профиль не найден в рейтинге — ID скопирован'));
  }

  // Global nomlar (admin paneli, eski onclick'lar) — yangi inboxga yo'naltiriladi
  window.adminRenderFeedback = function (filter) {
    if (filter === 'new' || filter === 'read') A.tab = 'inbox';
    else if (filter === '') A.tab = 'all';
    else if (TABS.indexOf(filter) >= 0) A.tab = filter;
    if (!box()) return;
    if (!document.getElementById('fbx-list')) adminShell();
    return adminLoad();
  };
  window.adminFeedbackSet = function (id, st) { return setStatus(id, st).then(function () { renderList(); }); };
  window.adminFeedbackDelete = function (id) {
    holdAsk(L('Bu fikrni o\'chirasizmi?', 'Delete this feedback?', 'Удалить этот отзыв?'), function () { deleteIds([id]); }, { icon: '🗑' });
  };

  // 🔴 Admin kirish nuqtalarida "yangi" soni
  function paintAdminBadges() {
    if (!window._isAdmin) return;
    var n = Number(A.newCount) || 0;
    var t = n > 99 ? '99+' : (n ? String(n) : '');
    [document.getElementById('ad-open-btn')].concat([].slice.call(document.querySelectorAll('[data-tool="admin"]'))).forEach(function (el) {
      if (!el) return;
      var b = el.querySelector('.fbx-badge');
      if (!t) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'fbx-badge'; el.appendChild(b); }
      if (b.textContent !== t) b.textContent = t;
      b.title = n + ' ' + L('yangi fikr', 'new feedback', 'новых отзывов');
    });
    var tabN = document.getElementById('ad-fb-n'); if (tabN && A.newCount != null && tabN.textContent !== t) tabN.textContent = t;
  }
  var _adminCntAt = 0;
  function adminCountCheck(force) {
    if (!window._isAdmin || !cloudOk()) return;
    if (!force && Date.now() - _adminCntAt < 5 * 60 * 1000) return;
    _adminCntAt = Date.now();
    rpc('admin_list_feedback', { p_status: 'new', p_limit: 500 }).then(function (r) {
      if (r.error || !Array.isArray(r.data)) return;
      A.newCount = r.data.length; paintAdminBadges();
    });
  }

  // =========================================================
  // 📬 FOYDALANUVCHI: "Mening xabarlarim" + javob belgisi
  // =========================================================
  var U = { rows: null, err: null, unseen: 0, at: 0, toasted: false, loading: false };
  try { U.toasted = sessionStorage.getItem('fbReplyToast') === '1'; } catch (e) {}
  function unseenOf(rows) { return (rows || []).filter(function (f) { return f.admin_reply && f.reply_seen === false; }).length; }
  function paintUserBadges() {
    var n = cloudOk() ? U.unseen : 0;
    ['fb-card-btn', 'fbx-tab-mine'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var d = el.querySelector('.fbx-udot');
      if (!n) { if (d) d.remove(); return; }
      if (!d) { d = document.createElement('span'); d.className = 'fbx-udot'; el.appendChild(d); }
      if (d.textContent !== String(n)) d.textContent = String(n);
    });
    var card = document.querySelector('#feedback-settings-card .settings-sub-icon');
    if (card) card.classList.toggle('fbx-has-dot', !!n);
  }
  function userFetch() {
    if (!cloudOk()) return Promise.resolve(null);
    U.loading = true;
    return rpc('get_my_feedback').then(function (r) {
      U.loading = false; U.at = Date.now();
      if (r.error) { U.err = r.error; return null; }
      U.err = null;
      U.rows = Array.isArray(r.data) ? r.data : [];
      U.unseen = unseenOf(U.rows);
      paintUserBadges();
      return U.rows;
    });
  }
  function userCheck(force) {
    if (!cloudOk() || U.loading) return;
    if (!force && Date.now() - U.at < 5 * 60 * 1000) return;
    userFetch().then(function (rows) {
      if (!rows || !U.unseen || U.toasted) return;
      var pane = document.getElementById('fbx-mine-pane');
      if (pane && pane.offsetParent) return; // ro'yxat allaqachon ochiq
      U.toasted = true; try { sessionStorage.setItem('fbReplyToast', '1'); } catch (e) {}
      toast('📬 ' + L('Admin javob berdi', 'The admin replied', 'Админ ответил') + (U.unseen > 1 ? ' (' + U.unseen + ')' : '') + ' — ' + L('Sozlamalar → Fikr', 'Settings → Feedback', 'Настройки → Отзывы'));
    });
  }
  function mineHtml() {
    if (!cloudOk()) {
      return '<div class="fbx-guest">🔐 <b>' + L('Javoblarni ko\'rish uchun hisobga kiring', 'Sign in to see replies', 'Войдите, чтобы видеть ответы') + '</b><br>' +
        L('Mehmon sifatida yuborilgan xabarlarga admin javobi ilovada ko\'rinmaydi. Profil → Sozlamalar → bulutli hisob orqali kiring.', 'Replies to messages sent as a guest can\'t be shown in the app. Sign in via Profile → Settings → cloud account.', 'Ответы на сообщения гостей в приложении не видны. Войдите: Профиль → Настройки → облачный аккаунт.') + '</div>';
    }
    if (U.err && !U.rows) return errHtml(U.err);
    if (!U.rows) return '<div class="ad-empty">⏳ ' + L('Yuklanmoqda...', 'Loading...', 'Загрузка...') + '</div>';
    if (!U.rows.length) return '<div class="ad-empty">📭 ' + L('Hali xabar yubormagansiz', 'You haven\'t sent any messages yet', 'Вы ещё не отправляли сообщений') + '</div>';
    return U.rows.map(function (f) {
      var fresh = f.admin_reply && f.reply_seen === false;
      return '<div class="fbx-thread' + (fresh ? ' is-fresh' : '') + '">' +
        '<div class="fbx-th-h">' + kindBadge(f.kind) + stChip(f.status) + '<span class="fbx-dim" title="' + H(fullDate(f.created_at)) + '">' + H(fmtDate(f.created_at)) + '</span></div>' +
        '<div class="fbx-bubble me">' + H(f.message) + '</div>' +
        (f.admin_reply ? '<div class="fbx-bubble-w"><div class="fbx-bubble admin"><div class="fbx-bubble-who">👑 ' + L('Admin', 'Admin', 'Админ') + (fresh ? ' <span class="fbx-new-tag">' + L('yangi', 'new', 'новое') + '</span>' : '') + '</div>' + H(f.admin_reply) + '</div><div class="fbx-reply-meta">' + H(fmtDate(f.replied_at)) + '</div></div>'
          : '<div class="fbx-await">⏳ ' + L('Javob kutilmoqda', 'Awaiting reply', 'Ожидает ответа') + '</div>') +
        '</div>';
    }).join('');
  }
  function renderMine() {
    var p = document.getElementById('fbx-mine-pane'); if (!p) return;
    p.innerHTML = '<div class="fbx-mine">' + mineHtml() + '</div>';
  }
  function openMine() {
    renderMine();
    if (!cloudOk()) return;
    userFetch().then(function () {
      renderMine();
      if (!U.rows || !U.unseen) return;
      rpc('mark_feedback_replies_seen').then(function (r) {
        if (r.error) return;
        U.rows.forEach(function (f) { if (f.admin_reply) f.reply_seen = true; });
        U.unseen = 0; U.toasted = true; paintUserBadges();
      });
    });
  }
  // openFeedbackModal kengaytmasi: "Yozish | Mening xabarlarim" tablari
  var _origOpen = window.openFeedbackModal;
  if (typeof _origOpen === 'function') {
    window.openFeedbackModal = function (tab) {
      _origOpen.apply(this, arguments);
      try { enhanceModal(tab === 'mine' ? 'mine' : 'write'); } catch (e) { console.warn('[feedback tabs]', e); }
    };
  }
  function enhanceModal(tab) {
    var ov = document.getElementById('feedback-modal'); if (!ov) return;
    var bx = ov.firstElementChild; if (!bx || bx.querySelector('#fbx-mtabs')) return;
    bx.classList.add('fbx-modal');
    var head = bx.firstElementChild;
    var write = document.createElement('div'); write.id = 'fbx-write-pane';
    while (head.nextSibling) write.appendChild(head.nextSibling);
    if (!cloudOk()) {
      var hint = document.createElement('div'); hint.className = 'fbx-guest-mini';
      hint.textContent = '💡 ' + L('Admin javobini ilovada olish uchun hisobga kiring.', 'Sign in to receive the admin\'s reply in the app.', 'Войдите, чтобы получить ответ админа в приложении.');
      write.insertBefore(hint, write.querySelector('#fb-send'));
    }
    var mine = document.createElement('div'); mine.id = 'fbx-mine-pane'; mine.style.display = 'none';
    var tabs = document.createElement('div'); tabs.id = 'fbx-mtabs'; tabs.className = 'fbx-mtabs';
    bx.appendChild(tabs); bx.appendChild(write); bx.appendChild(mine);
    var show = function (v) {
      write.style.display = v === 'write' ? '' : 'none';
      mine.style.display = v === 'mine' ? '' : 'none';
      if (v === 'mine') openMine();
    };
    segment(tabs, [
      { value: 'write', html: '✍️ ' + H(L('Yozish', 'Write', 'Написать')) },
      { value: 'mine', id: 'fbx-tab-mine', html: '📬 ' + H(L('Mening xabarlarim', 'My messages', 'Мои сообщения')) }
    ], tab, show, L('Fikr bo\'limlari', 'Feedback sections', 'Разделы отзывов'), { equalSlots: true, size: 'md' });
    paintUserBadges();
    show(tab);
  }
  window.openMyFeedback = function () { window.openFeedbackModal('mine'); };

  // ---------- ishga tushirish ----------
  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (cloudOk()) {
        if (!U.at) userCheck(true);
        if (window._isAdmin) { adminCountCheck(true); clearInterval(iv); }
        else if (tries > 8) clearInterval(iv); // admin tekshiruvi (am_i_admin) ulgurishi uchun
      } else if (tries > 120) clearInterval(iv); // ~10 daqiqa
    }, 5000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      userCheck(false); adminCountCheck(false);
    });
    // Hub / Sozlamalar qayta chizilganda belgilar yo'qolmasin
    setInterval(function () { try { paintAdminBadges(); paintUserBadges(); } catch (e) {} }, 4000);
  }
  if (document.readyState === 'complete') setTimeout(boot, 800); else window.addEventListener('load', function () { setTimeout(boot, 800); });
  window._fbx = { A: A, U: U, userCheck: userCheck, adminCountCheck: adminCountCheck, paint: function () { paintAdminBadges(); paintUserBadges(); } };
})();

// ============================================================
// 📥 INBOX — Hub → "Inbox": BARCHA vazifalar (kunidan qat'i nazar),
// 🎲 Chest vazifalari va 🎯 Maqsadlar bir joyda. Faqat o'qiydi/yig'adi —
// ma'lumot modeli o'zgarmaydi; amallar mavjud funksiyalar orqali
// (toggleTask, editTask, openTaskSheet, openAddChestTask, openGoalModal ...).
// UI sozlamalari: S.inboxPrefs = { type, cat, sort, showDone, col:{} }
// ============================================================
(function () {
  'use strict';
  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  var isOpen = false, query = '', refreshT = null, rootEl = null;
  var sel = null; // ☑ tanlash rejimi: { 't|12': true, 'g|5': true, 'c|3': true } (null — o'chiq)
  function selKey(k, id) { return k + '|' + id; }
  function selHtml(k, id) {
    var on = !!(sel && sel[selKey(k, id)]);
    return '<button type="button" class="ib-sel' + (on ? ' on' : '') + '" data-act="sel" aria-pressed="' + on + '" aria-label="' + H(L('Tanlash', 'Select', 'Выбрать')) + '">' + (on ? CHECK_SVG : '') + '</button>';
  }
  function delBtn(act) { return '<button type="button" class="ib-del" data-act="' + act + '" aria-label="' + H(L("O'chirish", 'Delete', 'Удалить')) + '" title="' + H(L("O'chirish", 'Delete', 'Удалить')) + '">🗑</button>'; }
  function has(fn) { return typeof window[fn] === 'function'; }
  function td0() { return today(); }

  function prefs() {
    var p = S.inboxPrefs;
    if (!p || typeof p !== 'object') p = S.inboxPrefs = {};
    if (['all', 'tasks', 'chest', 'goals'].indexOf(p.type) === -1) p.type = 'all';
    if (['date', 'diff', 'name', 'coins'].indexOf(p.sort) === -1) p.sort = 'date';
    if (typeof p.showDone !== 'boolean') p.showDone = false;
    if (!p.col || typeof p.col !== 'object') p.col = {};
    if (!p.cat || (p.cat !== 'all' && p.cat !== 'none' && !(has('taskCatById') && taskCatById(p.cat)))) p.cat = 'all';
    if (['date', 'cat', 'diff'].indexOf(p.groupBy) === -1) p.groupBy = 'date';
    if (typeof p.view !== 'string' || !(/^(all|week|priority|nodate)$/.test(p.view) || /^day:\d{4}-\d{2}-\d{2}$/.test(p.view))) p.view = 'all';
    if (/^day:/.test(p.view) && p.view.slice(4) < td0()) p.view = 'all';
    if (['all', '0', '1', '2', '3', '4'].indexOf(String(p.diff)) === -1) p.diff = 'all';
    if (typeof p.subs !== 'boolean') p.subs = false;
    if (['focus', 'all'].indexOf(p.badge) === -1) p.badge = 'focus';
    return p;
  }
  function setPref(k, v) { prefs()[k] = v; try { save(); } catch (e) {} }

  // ---------- 🗂 Vazifalar tahlili ----------
  function onDate(t, ds) { try { return has('tbTaskOnDate') ? tbTaskOnDate(t, ds) : (ds === td0() && taskDueToday(t)); } catch (e) { return false; } }
  function isOverdue(t, td) {
    if (t.done || t.isFrozen) return false;
    var po = false; try { po = isTaskPostponedOverdue(t, td); } catch (e) {}
    return po || !!(t.dueDate && t.dueDate < td);
  }
  function nextDue(t, td) {
    if (t.isFrozen) return null;
    var rep = t.repeat || 'once';
    if (rep === 'once') {
      if (t.done) return t.doneDate || null;
      if (t.postponedTo && t.postponedTo > td) return t.postponedTo;
      return t.dueDate || t.postponedTo || null;
    }
    for (var i = 0; i < 62; i++) {
      var ds = addDays(td, i);
      if (i === 0 && (t.done || t.skipped)) continue;
      if (onDate(t, ds)) return ds;
    }
    return null;
  }
  function taskInfo(t, td) {
    var rep = t.repeat || 'once', once = rep === 'once';
    var dueToday = !t.isFrozen && onDate(t, td) && !(t.postponedTo && t.postponedTo > td);
    var ov = isOverdue(t, td);
    var next = nextDue(t, td);
    var g;
    if (t.isFrozen) g = 'frozen';
    else if (t.done) g = 'done';
    else if (ov) g = 'overdue';
    else if (once) {
      if (t.postponedTo && t.postponedTo > td) g = 'upcoming';
      else if (t.dueDate && t.dueDate > td) g = 'upcoming';
      else if (t.postponedTo || t.dueDate === td || t.startTime || t.overdueOn) g = 'today';
      else g = 'nodate';
    } else g = (dueToday || t.skipped) ? 'today' : 'repeating';
    // ✓ faqat bugun navbatdagi (yoki bugun bajarilgan) vazifalar uchun
    var canCheck = !t.isFrozen && !t.skipped && (t.done ? (!once || t.doneDate === td) : (dueToday || ov));
    // ⤵ "Bugun qilish": kelajakka qo'yilgan bir martalik / har N kunlik vazifa
    var canToday = !t.done && !t.isFrozen && !canCheck && ((once && t.postponedTo && t.postponedTo > td) || (rep === 'interval' && t.nextDate && t.nextDate > td));
    return { k: 't', o: t, g: g, next: next, canCheck: canCheck, canToday: !!canToday, future: !canCheck && !t.done && !t.isFrozen };
  }
  // 🐞 Faqat shu kunga tegishli sub-tasklar (bir martalik bajarilgani keyingi kunlarda yo'q) va shu kundagi holati
  function subsOf(t, td) {
    var subs = []; try { subs = ensureSubtasks(t) || []; } catch (e) {}
    return subs.filter(function (s) { if (!s) return false; try { return subtaskDueToday(s, td); } catch (e) { return true; } });
  }
  function subDone(t, s, td) { try { return subtaskDoneOnDate(t.id, s.id, td); } catch (e) { return !!s.done; } }
  function subProgress(t, td) {
    var subs = subsOf(t, td);
    if (!subs.length) return null;
    var d = 0;
    subs.forEach(function (s) { if (subDone(t, s, td)) d++; });
    return [d, subs.length];
  }

  // ---------- 🎯 Maqsadlar ----------
  function goalInfo(g, td) {
    var tk = has('trackDate') ? trackDate() : td;
    var days = g.daysChecked ? Object.keys(g.daysChecked).length : 0;
    var ongoing = !g.duration && g.repeat !== 'once';
    var total = g.duration || 1;
    var completed = !ongoing && (!!g.done || days >= total);
    var paused = false; try { paused = goalIsPaused(g); } catch (e) {}
    var expired = !!(g.endDate && g.endDate < td && !completed);
    var due = false; try { due = isGoalDueOnDate(g, tk); } catch (e) {}
    var checked = !!(g.daysChecked && g.daysChecked[tk]);
    var future = !!(g.startDate && g.startDate > tk);
    var pct = 0; try { pct = ongoing ? goalRate30(g) : Math.min(100, Math.round(days / total * 100)); } catch (e) {}
    var rank = completed ? 5 : paused ? 4 : expired ? 3 : future ? 2.5 : (due && !checked) ? 0 : checked ? 1 : 2;
    return { k: 'g', o: g, g: 'goals', days: days, total: total, ongoing: ongoing, completed: completed, paused: paused, expired: expired,
      due: due && !completed && !paused && !expired && !future, checked: checked, future: future, pct: pct, rank: rank };
  }
  function goalCoins(g) { return (typeof g.coins === 'number') ? g.coins : 1; }

  // ---------- 🎲 Chest ----------
  function chestInfo(c, doneNames, activeName) {
    var coins = 0; try { coins = ctCoinsOf(c); } catch (e) { coins = c.coins || 0; }
    var done = doneNames.indexOf(c.name) !== -1;
    return { k: 'c', o: c, g: 'chest', coins: coins, done: done, active: !done && activeName === c.name };
  }

  // ---------- Hisoblagich (Hub plitkasi uchun): ochiq vazifalar + faol maqsadlar ----------
  // 🔢 Belgi: "focus" (standart) — bugungi + muddati o'tgan vazifalar va bugun belgilanmagan maqsadlar; "all" — hamma ochiqlar
  function openCount() {
    var n = 0, td = td0(), all = prefs().badge === 'all';
    (S.tasks || []).forEach(function (t) {
      if (!t || t.done || t.isFrozen) return;
      if (all) { n++; return; }
      var g = taskInfo(t, td).g; if (g === 'overdue' || g === 'today') n++;
    });
    (S.goals || []).forEach(function (g) {
      if (!g) return; var x = goalInfo(g, td);
      if (all ? (!x.completed && !x.paused && !x.expired) : (x.due && !x.checked)) n++;
    });
    return n;
  }

  // ---------- Yig'ish + filtr + saralash ----------
  function matches(x, q) {
    if (!q) return true;
    var o = x.o, hay = [o.name, o.emoji, o.note, o.desc];
    if (x.k === 't') {
      var c = null; try { c = taskCatOf(o); } catch (e) {}
      if (c) hay.push(c.name);
      (Array.isArray(o.subtasks) ? o.subtasks : []).forEach(function (s) { hay.push(s && s.name); });
    }
    return hay.filter(Boolean).join(' \u0001 ').toLowerCase().indexOf(q) !== -1;
  }
  function hl(name) {
    var q = query.trim(), s = String(name == null ? '' : name);
    if (!q) return H(s);
    var i = s.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return H(s);
    return H(s.slice(0, i)) + '<mark class="ib-hl">' + H(s.slice(i, i + q.length)) + '</mark>' + H(s.slice(i + q.length));
  }
  // 🗓 Vazifa shu kunga tegishlimi (7 kunlik tasma va "kun" ko'rinishi uchun)
  function taskOnDay(t, ds, x) {
    if (t.isFrozen || t.done) return false;
    if ((t.repeat || 'once') === 'once') {
      if (x.g === 'overdue' || x.g === 'today') return ds === td0();
      return (t.postponedTo || t.dueDate) === ds;
    }
    if (ds === td0()) return x.g === 'today' || x.g === 'overdue';
    if (t.repeat === 'interval' && t.nextDate) return t.nextDate === ds;
    return onDate(t, ds);
  }
  function viewOk(x, p) {
    var v = p.view, td = td0(), t = x.o;
    if (v === 'all') return true;
    if (x.k !== 't') return false;
    if (v === 'nodate') return x.g === 'nodate';
    if (v === 'priority') return !t.done && !t.isFrozen && (!!t.pinned || (t.diff == null ? 1 : t.diff) >= 3 || x.g === 'overdue');
    if (v === 'week') { if (x.g === 'overdue' || x.g === 'today') return true; return !!(x.next && x.next >= td && x.next <= addDays(td, 6)) && !t.done; }
    if (v.indexOf('day:') === 0) return taskOnDay(t, v.slice(4), x);
    return true;
  }
  function sortKey(x, sort) {
    var o = x.o;
    if (x.k === 't') {
      if (sort === 'diff') return -(o.diff == null ? 1 : o.diff);
      if (sort === 'coins') { try { return -taskCoinValue(o); } catch (e) { return 0; } }
      return (x.next || '9999-99-99') + ' ' + (o.startTime || '99:99');
    }
    if (x.k === 'g') {
      if (sort === 'diff' || sort === 'coins') return -goalCoins(o);
      return x.rank;
    }
    if (sort === 'diff' || sort === 'coins') return -x.coins;
    return (x.active ? 0 : x.done ? 2 : 1);
  }
  function cmp(sort) {
    return function (a, b) {
      if (sort !== 'name') {
        var ka = sortKey(a, sort), kb = sortKey(b, sort);
        if (ka < kb) return -1; if (ka > kb) return 1;
        if (a.k === 't' && !!a.o.pinned !== !!b.o.pinned) return a.o.pinned ? -1 : 1;
      }
      return String(a.o.name || '').localeCompare(String(b.o.name || ''), undefined, { sensitivity: 'base', numeric: true });
    };
  }
  var GROUPS = [
    ['overdue', '⚠️', function () { return L("Muddati o'tgan", 'Overdue', 'Просрочено'); }],
    ['today', '📅', function () { return L('Bugun', 'Today', 'Сегодня'); }],
    ['nodate', '📌', function () { return L('Sanasiz / Qachondir', 'No date / Someday', 'Без даты / Когда-нибудь'); }],
    ['upcoming', '🗓', function () { return L('Kelgusi', 'Upcoming', 'Предстоящие'); }],
    ['repeating', '🔁', function () { return L('Takrorlanuvchi', 'Repeating', 'Повторяющиеся'); }],
    ['chest', '🎲', function () { return 'Chest'; }],
    ['goals', '🎯', function () { return L('Maqsadlar', 'Goals', 'Цели'); }],
    ['frozen', '❄️', function () { return L('Muzlatilgan', 'Frozen', 'Заморожено'); }],
    ['done', '✅', function () { return L('Bajarilgan', 'Completed', 'Выполнено'); }],
    ['archive', '🗄', function () { return L('Arxiv (30 kundan eski)', 'Archive (30+ days old)', 'Архив (старше 30 дней)'); }]
  ];
  // Arxiv guruhi standart holatda yig'iq
  function isCol(p, g) { return g === 'archive' ? p.col.archive !== false : !!p.col[g]; }
  function collect() {
    var p = prefs(), td = td0(), q = query.trim().toLowerCase();
    var wantT = p.type === 'all' || p.type === 'tasks';
    var catOn = p.cat !== 'all';
    var wantC = (p.type === 'all' && !catOn) || p.type === 'chest';
    var wantG = (p.type === 'all' && !catOn) || p.type === 'goals';
    var out = {};
    GROUPS.forEach(function (g) { out[g[0]] = []; });
    var arch = addDays(td, -30), dOn = p.diff !== 'all';
    if (p.view !== 'all') { wantC = false; wantG = false; }
    if (dOn || p.subs) { wantC = false; wantG = false; }
    if (wantT) (S.tasks || []).forEach(function (t) {
      if (!t || t.id == null) return;
      if (catOn) { try { if (!taskCatMatches(t, p.cat)) return; } catch (e) {} }
      if (dOn && String(t.diff == null ? 1 : t.diff) !== p.diff) return;
      if (p.subs && !(Array.isArray(t.subtasks) && t.subtasks.length)) return;
      var x = taskInfo(t, td);
      if (x.g === 'done' && (t.repeat || 'once') === 'once' && t.doneDate && t.doneDate < arch) x.g = 'archive';
      if (!p.showDone && (x.g === 'done' || x.g === 'archive')) return;
      if (!viewOk(x, p)) return;
      if (!matches(x, q)) return;
      out[x.g].push(x);
    });
    if (wantC) {
      var dn = []; try { dn = _chestDoneTodayNames(); } catch (e) {}
      var an = (S.isChestQuestActive && S.chestQuest) ? S.chestQuest.name : null;
      // 🐞 Bir xil nomli Chest vazifalar: bugun necha marta bajarilgan bo'lsa, shuncha vazifa "bajarildi" bo'ladi (hammasi emas)
      var cflags = []; try { cflags = chestDoneFlags(S.chestTasks || []); } catch (e) {}
      var aq = (S.isChestQuestActive && S.chestQuest) ? S.chestQuest : null;
      (S.chestTasks || []).forEach(function (c, ci) {
        if (!c) return;
        var used = !!cflags[ci];
        var x = chestInfo(c, used ? [c.name] : [], aq && (aq.id != null ? aq.id === c.id : aq.name === c.name) ? c.name : null);
        if (!p.showDone && x.done) return;
        if (!matches(x, q)) return;
        out.chest.push(x);
      });
    }
    if (wantG) (S.goals || []).forEach(function (g) {
      if (!g) return;
      var x = goalInfo(g, td);
      if (!p.showDone && x.completed) return;
      if (!matches(x, q)) return;
      out.goals.push(x);
    });
    var c = cmp(p.sort);
    Object.keys(out).forEach(function (k) { out[k].sort(c); });
    return out;
  }

  // ---------- HTML ----------
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>';
  function chip(cls, txt) { return '<span class="tk-chip ' + cls + '">' + txt + '</span>'; }
  function dateTxt(ds) { try { return H(tkShortDate(ds)); } catch (e) { return H(ds); } }
  function taskHtml(x, td) {
    var t = x.o, d = t.diff == null ? 1 : t.diff, ch = [];
    var cat = null; try { cat = taskCatOf(t); } catch (e) {}
    if (x.g === 'overdue') ch.push(chip('tk-chip-over', '⚠️ ' + (t.dueDate && t.dueDate < td ? L('Muddat', 'Due', 'Срок') + ' ' + dateTxt(t.dueDate) : L('Qoldirilgan', 'Postponed', 'Отложено') + (t.overdueFrom ? ' ' + dateTxt(t.overdueFrom) : ''))));
    if (t.skipped && !t.done) ch.push(chip('tk-chip-skip', '⏭ ' + L("O'tkazildi", 'Skipped', 'Пропущено')));
    if (cat) ch.push('<span class="tk-chip tk-chip-cat" style="--tc:' + H(cat.color || '#7C5CFC') + '">' + H(taskCatLabel(cat)) + '</span>');
    try { ch.push(chip('tk-chip-diff d' + d, taskTier(d).icon + ' ' + H(taskTierName(d)))); } catch (e) {}
    var cv = 0; try { cv = taskCoinValue(t); } catch (e) {}
    if (cv > 0) ch.push(chip('tk-chip-coin', '+' + cv + ' 🪙'));
    if ((t.repeat || 'once') !== 'once') { try { ch.push(chip('tk-chip-rep', '🔁 ' + H(repeatLabel(t).text))); } catch (e) {} }
    if (t.done) ch.push(chip('ib-chip-ok', '✓ ' + (t.doneDate ? dateTxt(t.doneDate) : L('Bajarildi', 'Done', 'Готово'))));
    else if (x.next && x.g !== 'overdue' && !t.isFrozen && !(x.g === 'today' && x.next === td)) ch.push(chip('tk-chip-info' + (x.next > td ? ' ib-chip-fut' : ''), '📅 ' + dateTxt(x.next)));
    if (t.dueDate && !t.done && t.dueDate >= td && x.next !== t.dueDate) ch.push(chip('tk-chip-info', '⏳ ' + L('Muddat', 'Due', 'Срок') + ' ' + dateTxt(t.dueDate)));
    if (t.startTime) ch.push(chip('tk-chip-info', '🕒 ' + H(t.startTime + (t.endTime ? '–' + t.endTime : ''))));
    var sp = subProgress(t, td);
    if (sp) ch.push(chip('tk-chip-subs' + (sp[0] === sp[1] ? ' all' : ''), '☑ ' + sp[0] + '/' + sp[1]));
    if (t.isFrozen) ch.push(chip('ib-chip-ice', '❄️ ' + L('Muzlatilgan', 'Frozen', 'Заморожено')));

    var lead, nd = L('Hali muddati kelmagan', 'Not due yet', 'Срок ещё не наступил');
    if (x.canCheck) lead = '<button type="button" class="check-btn ib-chk' + (t.done ? ' checked' : '') + '" data-act="chk" aria-pressed="' + (t.done ? 'true' : 'false') + '" aria-label="' + H(t.done ? L('Qaytarish', 'Undo', 'Отменить') : L('Bajarildi', 'Done', 'Готово')) + '">' + CHECK_SVG + '</button>';
    else if (t.isFrozen) lead = '<button type="button" class="ib-lead ib-unfz" data-act="unfz" title="' + H(L('Muzdan chiqarish', 'Unfreeze', 'Разморозить')) + '" aria-label="' + H(L('Muzdan chiqarish', 'Unfreeze', 'Разморозить')) + '">❄️</button>';
    else if (t.done) lead = '<span class="check-btn checked ib-chk ib-chk-static" aria-hidden="true">' + CHECK_SVG + '</span>';
    else lead = '<button type="button" class="ib-chk-fut" data-act="fut" aria-label="' + H(nd) + '" title="' + H(nd) + '">⏳</button>';

    if (sel) lead = selHtml('t', t.id);
    var dragOk = !sel && !t.done && !t.isFrozen && ((t.repeat || 'once') === 'once' || t.repeat === 'interval');
    return '<div class="ib-item' + (t.done ? ' is-done' : '') + (t.isFrozen ? ' is-frozen' : '') + (t.label ? ' has-label' : '') + (sel && sel[selKey('t', t.id)] ? ' is-sel' : '') + '" data-k="t" data-id="' + H(t.id) + '"' + (dragOk ? ' draggable="true"' : '') + ' tabindex="-1"' + (t.label ? ' style="--ib-lb:' + H(t.label) + '"' : '') + '>' +
      lead +
      '<button type="button" class="ib-main" data-act="open"><span class="ib-name">' + (t.pinned ? '<span class="ib-pin">📌</span>' : '') + (t.emoji ? '<span class="ib-emo">' + H(t.emoji) + '</span>' : '') + hl(t.name) + '</span>' +
        '<span class="ib-meta">' + ch.join('') + '</span></button>' +
      (x.canToday && !sel ? '<button type="button" class="ib-today" data-act="today" title="' + H(L('Bugunga olish', 'Do it today', 'Сделать сегодня')) + '">⤵ ' + H(L('Bugun', 'Today', 'Сегодня')) + '</button>' : '') +
      (sel ? '' : delBtn('del') + '<button type="button" class="ib-more" data-act="more" aria-label="' + H(L('Menyu', 'Menu', 'Меню')) + '">⋯</button>') +
      subsHtml(t, x, td) +
    '</div>';
  }
  // ↳ Sub-tasklar — vazifa ostida, bugun navbatdagi vazifada belgilash mumkin
  function subsHtml(t, x, td) {
    var subs = subsOf(t, td);
    if (!subs.length) return '';
    var live = x.canCheck && !t.done;
    return '<div class="ib-sts">' + subs.map(function (sb) {
      if (!sb) return '';
      var dn = subDone(t, sb, td);
      var box = live
        ? '<button type="button" class="ib-st-chk' + (dn ? ' on' : '') + '" data-act="sub" data-sid="' + H(sb.id) + '" aria-pressed="' + dn + '" aria-label="' + H(dn ? L('Qaytarish', 'Undo', 'Отменить') : L('Bajarildi', 'Done', 'Готово')) + '">' + (dn ? CHECK_SVG : '') + '</button>'
        : '<span class="ib-st-chk static' + (dn ? ' on' : '') + '" aria-hidden="true">' + (dn ? CHECK_SVG : '') + '</span>';
      return '<div class="ib-st' + (dn ? ' done' : '') + (sb.skipped && !dn ? ' skipped' : '') + '">' + box +
        (sb.label ? '<i class="ib-st-dot" style="background:' + H(sb.label) + '"></i>' : '') +
        '<button type="button" class="ib-st-n" data-act="subedit" data-sid="' + H(sb.id) + '" title="' + H(L('Tahrirlash', 'Edit', 'Изменить')) + '">' + hl(sb.name) + '</button>' + (sb.skipped && !dn ? '<span class="ib-st-tag">⏭</span>' : '') +
        (sel ? '' : '<button type="button" class="ib-st-ed" data-act="subedit" data-sid="' + H(sb.id) + '" aria-label="' + H(L("Sub-taskni tahrirlash", 'Edit subtask', 'Изменить подзадачу')) + '" title="' + H(L('Tahrirlash', 'Edit', 'Изменить')) + '">✏️</button>' +
          '<button type="button" class="ib-st-del" data-act="subdel" data-sid="' + H(sb.id) + '" aria-label="' + H(L("Sub-taskni o'chirish", 'Delete subtask', 'Удалить подзадачу')) + '" title="' + H(L("O'chirish", 'Delete', 'Удалить')) + '">✕</button>') + '</div>';
    }).join('') + (sel ? '' : '<button type="button" class="ib-st-add" data-act="subadd">＋ ' + H(L("Sub-task qo'shish", 'Add subtask', 'Добавить подзадачу')) + '</button>') + '</div>';
  }
  function goalHtml(x) {
    var g = x.o, ch = [], c = goalCoins(g);
    ch.push(chip('tk-chip-coin', '+' + c + ' 🪙'));
    if (!g.endDate) { try { ch.push(chip('tk-chip-rep', '🔁 ' + H(repeatLabel(g).text))); } catch (e) {} }
    try { var st = goalStreak(g); if (st && st.cur > 0) ch.push(chip('ib-chip-fire', '🔥 ' + st.cur)); } catch (e) {}
    var status = x.completed ? chip('ib-chip-ok', '🏆 ' + L('Tugagan', 'Completed', 'Завершена'))
      : x.paused ? chip('tk-chip-info', '⏸ ' + L('Pauzada', 'Paused', 'На паузе'))
      : x.expired ? chip('tk-chip-over', '⌛ ' + L("Muddati o'tgan", 'Expired', 'Истекла'))
      : x.future ? chip('tk-chip-info ib-chip-fut', '📅 ' + dateTxt(g.startDate))
      : x.due ? (x.checked ? chip('ib-chip-ok', '✓ ' + L('Bugun belgilandi', 'Checked today', 'Отмечено сегодня')) : chip('tk-chip-subs', '• ' + L('Bugun navbatda', 'Due today', 'Сегодня')))
      : chip('tk-chip-info', L('Bugun emas', 'Not today', 'Не сегодня'));
    ch.push(status);
    var prog = x.ongoing ? x.days + ' ' + L('kun', 'days', 'дн.') + ' · 30d ' + x.pct + '%' : x.days + '/' + x.total + ' ' + L('kun', 'days', 'дн.');
    var lead = sel ? selHtml('g', g.id) : x.due
      ? '<button type="button" class="check-btn ib-chk' + (x.checked ? ' checked' : '') + '" data-act="gchk" aria-pressed="' + (x.checked ? 'true' : 'false') + '" aria-label="' + H(L('Belgilash', 'Check in', 'Отметить')) + '">' + CHECK_SVG + '</button>'
      : '<span class="ib-lead" aria-hidden="true">' + H(g.emoji || '🎯') + '</span>';
    return '<div class="ib-item ib-goal' + (x.completed ? ' is-done' : '') + (x.paused ? ' is-frozen' : '') + (sel && sel[selKey('g', g.id)] ? ' is-sel' : '') + '" data-k="g" data-id="' + H(g.id) + '" tabindex="-1">' + lead +
      '<button type="button" class="ib-main" data-act="open"><span class="ib-name">' + (x.due ? '<span class="ib-emo">' + H(g.emoji || '🎯') + '</span>' : '') + hl(g.name) + '</span>' +
      '<span class="ib-meta">' + ch.join('') + '</span>' +
      '<span class="ib-prog"><span class="ib-bar"><i style="width:' + Math.max(0, Math.min(100, x.pct)) + '%"></i></span><small>' + H(prog) + '</small></span></button>' +
      (sel ? '' : delBtn('gdel') + '<button type="button" class="ib-more" data-act="gcal" aria-label="' + H(L('Kalendar', 'Calendar', 'Календарь')) + '" title="' + H(L('Kalendar', 'Calendar', 'Календарь')) + '">📅</button>') + '</div>';
  }
  function chestHtml(x) {
    var c = x.o, ch = [chip('tk-chip-coin', '+' + x.coins + ' 🪙')];
    if (x.done) ch.push(chip('ib-chip-ok', '✓ ' + L('Bugun bajarildi', 'Done today', 'Выполнено сегодня')));
    if (x.active) ch.push(chip('tk-chip-subs', '⏳ ' + L('Faol vazifa', 'Active task', 'Активная задача')));
    return '<div class="ib-item ib-chest' + (x.done ? ' is-done' : '') + (sel && sel[selKey('c', c.id)] ? ' is-sel' : '') + '" data-k="c" data-id="' + H(c.id) + '" tabindex="-1">' + (sel ? selHtml('c', c.id) : '<span class="ib-lead" aria-hidden="true"><i class="ib-dot d' + H(Math.max(1, Math.min(3, Number(c.diff) || 1))) + '"></i></span>') +
      '<button type="button" class="ib-main" data-act="open"><span class="ib-name">' + hl(c.name) + '</span><span class="ib-meta">' + ch.join('') + '</span></button>' +
      (sel ? '' : delBtn('cdel') + '<button type="button" class="ib-more" data-act="chest" aria-label="' + H(L("Chest bo'limi", 'Open Chest', 'Открыть Chest')) + '" title="' + H(L("Chest bo'limi", 'Open Chest', 'Открыть Chest')) + '">🎲</button>') + '</div>';
  }
  function emptyHtml(totalAll) {
    if (query.trim()) return '<div class="ib-empty"><span>🔍</span>' + H(L('Hech narsa topilmadi', 'Nothing found', 'Ничего не найдено')) + '<small>«' + H(query.trim()) + '»</small>' +
      '<button type="button" class="x-btn sm ghost" data-act="reset">✕ ' + H(L('Filtrlarni tozalash', 'Reset filters', 'Сбросить фильтры')) + '</button></div>';
    if (!totalAll) return '<div class="ib-empty"><span>📭</span>' + H(L("Inbox bo'sh — birinchi vazifani qo'shing", 'Inbox is empty — add your first task', 'Входящие пусты — добавьте первую задачу')) +
      '<button type="button" class="x-btn sm" data-act="add">＋ ' + H(L("Vazifa qo'shish", 'Add task', 'Добавить задачу')) + '</button></div>';
    return '<div class="ib-empty"><span>🎉</span>' + H(L("Bu filtrda hech narsa yo'q", 'Nothing here for this filter', 'В этом фильтре пусто')) +
      (filtersOn() ? '<button type="button" class="x-btn sm ghost" data-act="reset">✕ ' + H(L('Filtrlarni tozalash', 'Reset filters', 'Сбросить фильтры')) + '</button>' : '') + '</div>';
  }
  function filtersOn() { var p = prefs(); return !!query.trim() || p.type !== 'all' || p.cat !== 'all' || p.view !== 'all' || p.diff !== 'all' || p.subs; }
  // 🗂 Guruhlash: bo'lim yoki qiyinlik bo'yicha (Chest va Maqsadlar o'z guruhida qoladi)
  function regroup(r, by) {
    var TASKG = ['overdue', 'today', 'nodate', 'upcoming', 'repeating', 'frozen', 'done', 'archive'];
    var items = []; TASKG.forEach(function (g) { items = items.concat(r[g]); r[g] = []; });
    var groups = [], map = {};
    items.forEach(function (x) {
      var key, icon, title;
      if (by === 'cat') { var c = null; try { c = taskCatOf(x.o); } catch (e) {} key = 'cat:' + (c ? c.id : '-'); icon = c ? '🗂' : '📭'; title = c ? taskCatLabel(c) : L("Bo'limsiz", 'No category', 'Без раздела'); }
      else { var d = x.o.diff == null ? 1 : x.o.diff; key = 'diff:' + d; try { icon = taskTier(d).icon; title = taskTierName(d); } catch (e) { icon = '•'; title = String(d); } }
      if (!map[key]) { map[key] = []; groups.push([key, icon, title, by === 'diff' ? -(x.o.diff == null ? 1 : x.o.diff) : title]); }
      map[key].push(x);
    });
    groups.sort(function (a, b) { return a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0; });
    return groups.map(function (g) { r[g[0]] = map[g[0]]; return [g[0], g[1], function () { return g[2]; }]; });
  }
  function summaryHtml() {
    var td = td0(), ov = 0, tdy = 0, dn = 0;
    (S.tasks || []).forEach(function (t) {
      if (!t) return;
      if (t.done) { if (t.doneDate === td) dn++; return; }
      var g = taskInfo(t, td).g; if (g === 'overdue') ov++; else if (g === 'today') tdy++;
    });
    var p = prefs(), days = [], wd = [L('Ya', 'Su', 'Вс'), L('Du', 'Mo', 'Пн'), L('Se', 'Tu', 'Вт'), L('Ch', 'We', 'Ср'), L('Pa', 'Th', 'Чт'), L('Ju', 'Fr', 'Пт'), L('Sh', 'Sa', 'Сб')];
    for (var i = 0; i < 7; i++) {
      var ds = addDays(td, i), c = 0;
      (S.tasks || []).forEach(function (t) { if (t && taskOnDay(t, ds, taskInfo(t, td))) c++; });
      var dt = new Date(ds + 'T00:00:00');
      days.push('<button type="button" class="ib-day' + (p.view === 'day:' + ds ? ' on' : '') + (c >= 6 ? ' busy' : '') + '" data-day="' + ds + '" title="' + H(ds) + '"><small>' + H(i === 0 ? L('Bugun', 'Today', 'Сегодня') : wd[dt.getDay()]) + '</small><b>' + dt.getDate() + '</b><em>' + (c || '·') + '</em></button>');
    }
    return '<div class="ib-sum">' +
      '<button type="button" class="ib-sum-it ov' + (ov ? '' : ' z') + '" data-jump="overdue"><b>' + ov + '</b><small>⚠️ ' + H(L("Muddati o'tgan", 'Overdue', 'Просрочено')) + '</small></button>' +
      '<button type="button" class="ib-sum-it td" data-jump="today"><b>' + tdy + '</b><small>📅 ' + H(L('Bugun', 'Today', 'Сегодня')) + '</small></button>' +
      '<button type="button" class="ib-sum-it ok" data-jump="done"><b>' + dn + '</b><small>✅ ' + H(L('Bugun bajarildi', 'Done today', 'Сделано сегодня')) + '</small></button></div>' +
      '<div class="ib-week" role="group" aria-label="' + H(L('Kelgusi 7 kun', 'Next 7 days', 'Ближайшие 7 дней')) + '">' + days.join('') + '</div>';
  }
  function listHtml() {
    var r = collect(), p = prefs(), td = td0(), h = '', n = 0;
    var groups = GROUPS;
    if (p.groupBy !== 'date') groups = regroup(r, p.groupBy).concat(GROUPS.filter(function (g) { return g[0] === 'chest' || g[0] === 'goals'; }));
    var dropG = { today: 1, upcoming: 1, nodate: 1 };
    groups.forEach(function (gr) {
      var items = r[gr[0]]; if (!items || !items.length) return;
      n += items.length;
      var col = isCol(p, gr[0]);
      var act = gr[0] === 'chest' ? '<button type="button" class="ib-sec-a" data-act="chest-add" aria-label="' + H(L("Chest vazifa qo'shish", 'Add chest task', 'Добавить задачу Chest')) + '">＋</button>'
        : gr[0] === 'goals' ? '<button type="button" class="ib-sec-a" data-act="goal-add" aria-label="' + H(L("Maqsad qo'shish", 'Add goal', 'Добавить цель')) + '">＋</button>' : '';
      h += '<section class="ib-sec ib-g-' + H(gr[0].replace(/[^a-z0-9_-]/gi, '_')) + (col ? ' is-col' : '') + '" data-g="' + H(gr[0]) + '"' + (p.groupBy === 'date' && dropG[gr[0]] ? ' data-drop="' + gr[0] + '"' : '') + '>' +
        '<div class="ib-sec-hd"><button type="button" class="ib-sec-h" data-act="col" aria-expanded="' + (col ? 'false' : 'true') + '"><span class="ib-chev" aria-hidden="true">▾</span><span class="ib-sec-i" aria-hidden="true">' + gr[1] + '</span><span class="ib-sec-t">' + H(gr[2]()) + '</span><span class="ib-cnt">' + items.length + '</span></button>' + act + '</div>' +
        (col ? '' : '<div class="ib-sec-b">' + items.map(function (x) { return x.k === 't' ? taskHtml(x, td) : x.k === 'g' ? goalHtml(x) : chestHtml(x); }).join('') + '</div>') +
        '</section>';
    });
    var all = (S.tasks || []).length + (S.chestTasks || []).length + (S.goals || []).length;
    // Sanasiz guruh bo'sh bo'lsa ham sudrab tashlash uchun joy
    if (n && p.groupBy === 'date' && !r.nodate.length && p.view === 'all') h += '<section class="ib-sec ib-drop-only" data-drop="nodate" hidden><div class="ib-sec-hd"><span class="ib-sec-h">📌 ' + H(L('Sanasiz', 'No date', 'Без даты')) + '</span></div></section>';
    return n ? h : emptyHtml(all);
  }
  function toolsHtml() {
    var p = prefs();
    var types = [['all', L('Hammasi', 'All', 'Все')], ['tasks', '📋 ' + L('Vazifalar', 'Tasks', 'Задачи')], ['chest', '🎲 Chest'], ['goals', '🎯 ' + L('Maqsadlar', 'Goals', 'Цели')]];
    var cats = Array.isArray(S.taskCats) ? S.taskCats.filter(Boolean) : [];
    var showCats = cats.length && (p.type === 'all' || p.type === 'tasks');
    var sorts = [['date', L('Sana', 'Date', 'Дата')], ['diff', L('Qiyinlik', 'Difficulty', 'Сложность')], ['name', L('Nomi', 'Name', 'Название')], ['coins', L('Tanga', 'Coins', 'Монеты')]];
    var views = [['all', '🗃 ' + L('Hammasi', 'Everything', 'Всё')], ['week', '📆 ' + L('Bu hafta', 'This week', 'Эта неделя')], ['priority', '🔥 ' + L('Ustuvor', 'Priority', 'Приоритет')], ['nodate', '📌 ' + L('Sanasiz', 'No date', 'Без даты')]];
    return '<div class="ib-search"><span aria-hidden="true">🔍</span><input type="search" id="ib-q" autocomplete="off" placeholder="' + H(L('Qidirish…', 'Search…', 'Поиск…')) + '" value="' + H(query) + '" aria-label="' + H(L('Qidirish', 'Search', 'Поиск')) + '"></div>' +
      '<div class="ib-chips" role="group" aria-label="' + H(L('Turi', 'Type', 'Тип')) + '">' + types.map(function (x) {
        return '<button type="button" class="ib-chip' + (p.type === x[0] ? ' on' : '') + '" data-type="' + x[0] + '" aria-pressed="' + (p.type === x[0]) + '">' + H(x[1]) + '</button>';
      }).join('') + '</div>' +
      (showCats ? '<div class="ib-chips ib-cats" role="group" aria-label="' + H(L("Bo'lim", 'Category', 'Раздел')) + '">' +
        '<button type="button" class="ib-chip sm' + (p.cat === 'all' ? ' on' : '') + '" data-cat="all" aria-pressed="' + (p.cat === 'all') + '">🗂 ' + H(L("Barcha bo'limlar", 'All categories', 'Все разделы')) + '</button>' +
        cats.map(function (c) { return '<button type="button" class="ib-chip sm' + (p.cat === c.id ? ' on' : '') + '" data-cat="' + H(c.id) + '" aria-pressed="' + (p.cat === c.id) + '" style="--tc:' + H(c.color || '#7C5CFC') + '"><i class="ib-cdot" aria-hidden="true"></i>' + H(taskCatLabel(c)) + '</button>'; }).join('') +
        '<button type="button" class="ib-chip sm' + (p.cat === 'none' ? ' on' : '') + '" data-cat="none" aria-pressed="' + (p.cat === 'none') + '">' + H(L("Bo'limsiz", 'No category', 'Без раздела')) + '</button></div>' : '') +
      '<div class="ib-chips ib-views" role="group" aria-label="' + H(L("Ko'rinish", 'View', 'Вид')) + '">' + views.map(function (x) {
        return '<button type="button" class="ib-chip sm' + (p.view === x[0] ? ' on' : '') + '" data-view="' + x[0] + '" aria-pressed="' + (p.view === x[0]) + '">' + H(x[1]) + '</button>';
      }).join('') + '</div>' +
      '<div class="ib-row2"><label class="ib-sort"><span>↕ ' + H(L('Saralash', 'Sort', 'Сортировка')) + '</span><select id="ib-sort">' +
        sorts.map(function (s) { return '<option value="' + s[0] + '"' + (p.sort === s[0] ? ' selected' : '') + '>' + H(s[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ib-sort"><span>🗂 ' + H(L('Guruh', 'Group', 'Группа')) + '</span><select id="ib-group">' +
        [['date', L('Sana', 'Date', 'Дата')], ['cat', L("Bo'lim", 'Category', 'Раздел')], ['diff', L('Qiyinlik', 'Difficulty', 'Сложность')]].map(function (s) { return '<option value="' + s[0] + '"' + (p.groupBy === s[0] ? ' selected' : '') + '>' + H(s[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ib-sort"><span>💪</span><select id="ib-diff" aria-label="' + H(L('Qiyinlik', 'Difficulty', 'Сложность')) + '"><option value="all">' + H(L('Har qanday', 'Any', 'Любая')) + '</option>' +
        [0, 1, 2, 3, 4].map(function (d) { var nm = ''; try { nm = taskTier(d).icon + ' ' + taskTierName(d); } catch (e) { nm = String(d); } return '<option value="' + d + '"' + (String(p.diff) === String(d) ? ' selected' : '') + '>' + H(nm) + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="ib-toggle' + (p.subs ? ' on' : '') + '" id="ib-subs" role="switch" aria-checked="' + p.subs + '"><i aria-hidden="true"></i>☑ ' + H(L("Sub-taskli", 'With subtasks', 'С подзадачами')) + '</button>' +
        '<button type="button" class="ib-toggle' + (p.showDone ? ' on' : '') + '" id="ib-done" role="switch" aria-checked="' + p.showDone + '"><i aria-hidden="true"></i>' + H(L('Bajarilganlar', 'Show completed', 'Выполненные')) + '</button>' +
        '<label class="ib-sort"><span>🔢 ' + H(L('Belgida', 'Badge', 'Значок')) + '</span><select id="ib-badge"><option value="focus"' + (p.badge === 'focus' ? ' selected' : '') + '>' + H(L("Bugun + muddati o'tgan", 'Today + overdue', 'Сегодня + просроч.')) + '</option><option value="all"' + (p.badge === 'all' ? ' selected' : '') + '>' + H(L('Hamma ochiqlar', 'All open', 'Все открытые')) + '</option></select></label></div>';
  }

  // ---------- Chizish ----------
  function render(v) {
    v = v || document.getElementById('view-hub'); if (!v) return;
    v.innerHTML = '<div class="ib" id="ib-root">' +
      '<div class="ib-head"><button type="button" class="ib-back" data-act="back" aria-label="' + H(L('Orqaga', 'Back', 'Назад')) + '">←</button>' +
      '<h2 class="ib-title">📥 Inbox <span class="ib-total" id="ib-total"></span></h2>' +
      '<button type="button" class="x-btn sm ghost" data-act="share" title="' + H(L('Ulashish / eksport', 'Share / export', 'Поделиться / экспорт')) + '" aria-label="' + H(L('Ulashish / eksport', 'Share / export', 'Поделиться / экспорт')) + '">📤</button>' +
      '<button type="button" class="x-btn sm ghost ib-triage-b" data-act="triage" hidden>🧹 <span></span></button>' +
      '<button type="button" class="x-btn sm ghost ib-selmode" data-act="selmode" aria-pressed="false">☑ ' + H(L('Tanlash', 'Select', 'Выбрать')) + '</button>' +
      '<button type="button" class="x-btn sm ib-add" data-act="add">＋ ' + H(L("Qo'shish", 'Add', 'Добавить')) + '</button></div>' +
      '<div class="ib-selbar" id="ib-selbar" hidden></div>' +
      '<form class="ib-qa" id="ib-qa-f" autocomplete="off"><span aria-hidden="true">⚡</span><input id="ib-qa" maxlength="160" enterkeyhint="done" placeholder="' + H(L("Tez qo'shish: «Kitob o'qish ertaga #o'qish !2» — Enter", "Quick add: “Read a book tomorrow #study !2” — Enter", "Быстро: «Читать книгу завтра #учёба !2» — Enter")) + '" aria-label="' + H(L("Tez qo'shish", 'Quick add', 'Быстрое добавление')) + '"></form>' +
      '<div id="ib-sumbox"></div>' +
      '<div class="ib-tools" id="ib-tools">' + toolsHtml() + '</div>' +
      '<div class="ib-list" id="ib-list"></div></div>';
    rootEl = v.querySelector('#ib-root');
    bindTools();
    rootEl.addEventListener('click', onClick);
    rootEl.querySelector('#ib-qa-f').addEventListener('submit', function (e) { e.preventDefault(); quickAdd(); });
    bindGestures();
    renderList();
  }
  // ☑ Tanlash paneli: nechta tanlandi · hammasini tanlash · o'chirish · bekor qilish
  function renderSelBar() {
    var bar = rootEl && rootEl.querySelector('#ib-selbar'), sm = rootEl && rootEl.querySelector('.ib-selmode');
    if (sm) { sm.classList.toggle('on', !!sel); sm.setAttribute('aria-pressed', sel ? 'true' : 'false'); }
    if (!bar) return;
    if (!sel) { bar.hidden = true; bar.innerHTML = ''; return; }
    var n = Object.keys(sel).length;
    bar.hidden = false;
    bar.innerHTML = '<span class="ib-selbar-n">' + H(L(n + ' ta tanlandi', n + ' selected', 'Выбрано: ' + n)) + '</span>' +
      '<button type="button" class="x-btn sm ghost" data-act="selall">' + H(L('Hammasini tanlash', 'Select all', 'Выбрать все')) + '</button>' +
      '<button type="button" class="x-btn sm" data-act="bdone"' + (n ? '' : ' disabled') + '>✓ ' + H(L('Bajarish', 'Complete', 'Выполнить')) + '</button>' +
      '<button type="button" class="x-btn sm ghost" data-act="btomorrow"' + (n ? '' : ' disabled') + '>⏭ ' + H(L('Ertaga', 'Tomorrow', 'Завтра')) + '</button>' +
      '<label class="x-btn sm ghost ib-bdate"' + (n ? '' : ' aria-disabled="true"') + '>📅<input type="date" id="ib-bdate" min="' + td0() + '"' + (n ? '' : ' disabled') + ' aria-label="' + H(L('Sanaga surish', 'Move to date', 'Перенести на дату')) + '"></label>' +
      (Array.isArray(S.taskCats) && S.taskCats.length ? '<select class="x-btn sm ghost" id="ib-bcat"' + (n ? '' : ' disabled') + ' aria-label="' + H(L("Bo'limga o'tkazish", 'Move to category', 'В раздел')) + '"><option value="">🗂 ' + H(L("Bo'lim…", 'Category…', 'Раздел…')) + '</option>' +
        S.taskCats.filter(Boolean).map(function (c) { return '<option value="' + H(c.id) + '">' + H(taskCatLabel(c)) + '</option>'; }).join('') + '<option value="-">' + H(L("Bo'limsiz", 'No category', 'Без раздела')) + '</option></select>' : '') +
      '<button type="button" class="x-btn sm ghost" data-act="bpin"' + (n ? '' : ' disabled') + '>📌</button>' +
      '<button type="button" class="x-btn sm ghost" data-act="bfreeze"' + (n ? '' : ' disabled') + ' title="' + H(L('Muzlatish / qaytarish', 'Freeze / unfreeze', 'Заморозить / вернуть')) + '">❄️</button>' +
      '<button type="button" class="x-btn sm ib-selbar-del" data-act="seldel"' + (n ? '' : ' disabled') + '>🗑 ' + H(L("O'chirish", 'Delete', 'Удалить')) + '</button>' +
      '<button type="button" class="x-btn sm ghost" data-act="selmode">' + H(L('Bekor', 'Cancel', 'Отмена')) + '</button>';
    var bd = bar.querySelector('#ib-bdate'); if (bd) bd.onchange = function () { if (bd.value) bulk('date', bd.value); };
    var bc = bar.querySelector('#ib-bcat'); if (bc) bc.onchange = function () { if (bc.value) bulk('cat', bc.value); };
  }
  function visibleKeys() {
    var r = collect(), out = [], p = prefs();
    if (p.groupBy !== 'date') regroup(r, p.groupBy);
    Object.keys(r).forEach(function (g) { if (isCol(p, g)) return; (r[g] || []).forEach(function (x) { out.push(selKey(x.k, x.o.id)); }); });
    return out;
  }
  // 🗑 Bir nechtasini birdan o'chirish: vazifalar savatga (qaytarish mumkin), maqsad va Chest — qaytarish tugmasi bilan
  function bulkDelete() {
    var keys = Object.keys(sel || {}); if (!keys.length) return;
    var items = keys.map(function (k) { var i = k.indexOf('|'); var kk = k.slice(0, i); return { k: kk, o: find(kk, k.slice(i + 1)) }; }).filter(function (x) { return x.o; });
    var nT = items.filter(function (x) { return x.k === 't'; }).length, nG = items.filter(function (x) { return x.k === 'g'; }).length, nC = items.length - nT - nG;
    var parts = [];
    if (nT) parts.push(nT + ' ' + L('ta vazifa', 'tasks', 'задач'));
    if (nG) parts.push(nG + ' ' + L('ta maqsad', 'goals', 'целей'));
    if (nC) parts.push(nC + ' ' + L('ta Chest vazifa', 'chest tasks', 'задач Chest'));
    var doIt = function () {
      try { allowTaskBulkDelete(); } catch (e) {}
      var goals = [], chests = [];
      items.forEach(function (x) {
        if (x.k === 't') { try { moveTaskToTrash(x.o.id); } catch (e) { console.warn('[inbox] del', e); } }
        else if (x.k === 'g') { goals.push(x.o); S.goals = (S.goals || []).filter(function (g) { return g !== x.o; }); }
        else { chests.push(x.o); S.chestTasks = (S.chestTasks || []).filter(function (c) { return c !== x.o; }); }
      });
      sel = null;
      try { SFX.delete(); } catch (e) {}
      try { save(); } catch (e) {}
      try { if (typeof renderGoals === 'function') renderGoals(); } catch (e) {}
      try { if (typeof renderChest === 'function') renderChest(); } catch (e) {}
      renderSelBar(); renderList();
      var undo = function () {
        items.forEach(function (x) { if (x.k === 't') { try { restoreTask(x.o.id); } catch (e) {} } });
        if (goals.length) S.goals = (S.goals || []).concat(goals);
        if (chests.length) S.chestTasks = (S.chestTasks || []).concat(chests);
        try { save(); } catch (e) {}
        try { if (typeof window.render === 'function') window.render(); } catch (e) {}
        renderList();
      };
      try { showUndoToast('🗑 ' + L(parts.join(', ') + " o'chirildi", parts.join(', ') + ' deleted', 'Удалено: ' + parts.join(', ')), undo); } catch (e) { toast('🗑 ' + parts.join(', ')); }
    };
    var msg = H(L(parts.join(', ') + " o'chirilsinmi?", 'Delete ' + parts.join(', ') + '?', 'Удалить ' + parts.join(', ') + '?'));
    try { showHoldConfirmModal(msg, doIt, { icon: '🗑️', title: L("Tanlanganlarni o'chirish", 'Delete selected', 'Удалить выбранное'), holdTime: 1200, holdLabel: '🗑 ' + L("O'chirish uchun bosib turing", 'Hold to delete', 'Удерживайте для удаления') }); }
    catch (e) { if (confirm(L(parts.join(', ') + " o'chirilsinmi?", 'Delete ' + parts.join(', ') + '?', 'Удалить ' + parts.join(', ') + '?'))) doIt(); }
  }
  function renderList() {
    if (!rootEl || !rootEl.isConnected) return;
    var list = rootEl.querySelector('#ib-list'); if (!list) return;
    if (sel) Object.keys(sel).forEach(function (k) { var i = k.indexOf('|'); if (!find(k.slice(0, i), k.slice(i + 1))) delete sel[k]; });
    list.innerHTML = listHtml();
    var sb = rootEl.querySelector('#ib-sumbox'); if (sb) sb.innerHTML = summaryHtml();
    var tb = rootEl.querySelector('.ib-triage-b');
    if (tb) { var nd = nodateTasks().length; tb.hidden = !nd; tb.querySelector('span').textContent = L('Saralash', 'Triage', 'Разбор') + ' ' + nd; tb.title = L("Sanasiz vazifalarni birma-bir hal qilish", 'Sort out undated tasks one by one', 'Разобрать задачи без даты'); }
    renderSelBar();
    var tot = rootEl.querySelector('#ib-total'); if (tot) { var n = openCount(); tot.textContent = n ? String(n) : ''; }
  }
  function renderTools() {
    var tl = rootEl && rootEl.querySelector('#ib-tools'); if (!tl) return;
    tl.innerHTML = toolsHtml(); bindTools();
  }
  function bindTools() {
    var q = rootEl.querySelector('#ib-q');
    if (q) q.addEventListener('input', function () { query = q.value || ''; renderList(); });
    var so = rootEl.querySelector('#ib-sort');
    if (so) so.addEventListener('change', function () { setPref('sort', so.value); renderList(); });
    [['#ib-group', 'groupBy'], ['#ib-diff', 'diff'], ['#ib-badge', 'badge']].forEach(function (x) {
      var el = rootEl.querySelector(x[0]);
      if (el) el.addEventListener('change', function () { setPref(x[1], el.value); renderList(); });
    });
  }
  function find(k, id) {
    var arr = k === 't' ? S.tasks : k === 'g' ? S.goals : S.chestTasks;
    return (arr || []).find(function (o) { return o && String(o.id) === String(id); });
  }
  function onClick(e) {
    var b = e.target.closest('button'); if (!b || !rootEl || !rootEl.contains(b)) return;
    if (b.dataset.type) { setPref('type', b.dataset.type); if (b.dataset.type === 'chest' || b.dataset.type === 'goals') setPref('cat', 'all'); renderTools(); renderList(); return; }
    if (b.dataset.cat) { setPref('cat', b.dataset.cat); renderTools(); renderList(); return; }
    if (b.id === 'ib-done') { setPref('showDone', !prefs().showDone); renderTools(); renderList(); return; }
    if (b.id === 'ib-subs') { setPref('subs', !prefs().subs); renderTools(); renderList(); return; }
    if (b.dataset.view) { setPref('view', b.dataset.view); renderTools(); renderList(); return; }
    if (b.dataset.day) { var dv = 'day:' + b.dataset.day; setPref('view', prefs().view === dv ? 'all' : dv); renderTools(); renderList(); return; }
    if (b.dataset.jump) {
      var jg = b.dataset.jump, pj = prefs();
      if (jg === 'done' && !pj.showDone) setPref('showDone', true);
      if (pj.view !== 'all') setPref('view', 'all');
      pj.col[jg] = false; renderTools(); renderList();
      var se = rootEl.querySelector('[data-g="' + jg + '"]'); if (se) se.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var act = b.dataset.act; if (!act) return;
    if (act === 'back') { close(); return; }
    if (act === 'selmode') { sel = sel ? null : {}; renderList(); return; }
    if (act === 'selall') { var ks = visibleKeys(), all = ks.every(function (k) { return sel[k]; }); sel = {}; if (!all) ks.forEach(function (k) { sel[k] = true; }); renderList(); return; }
    if (act === 'seldel') { bulkDelete(); return; }
    if (act === 'bdone') { bulk('done'); return; }
    if (act === 'btomorrow') { bulk('date', addDays(td0(), 1)); return; }
    if (act === 'bpin') { bulk('pin'); return; }
    if (act === 'bfreeze') { bulk('freeze'); return; }
    if (act === 'reset') { query = ''; var pr = prefs(); pr.type = 'all'; pr.cat = 'all'; pr.view = 'all'; pr.diff = 'all'; pr.subs = false; try { save(); } catch (er) {} var qi = rootEl.querySelector('#ib-q'); if (qi) qi.value = ''; renderTools(); renderList(); return; }
    if (act === 'triage') { triage(); return; }
    if (act === 'share') { shareMenu(b); return; }
    if (act === 'add') { try { openModal(); } catch (er) {} return; }
    if (act === 'chest-add') { try { openAddChestTask(); } catch (er) {} return; }
    if (act === 'goal-add') { try { openGoalModal(); } catch (er) {} return; }
    if (act === 'col') {
      var sec = b.closest('[data-g]'); if (!sec) return;
      var p = prefs(), gk = sec.dataset.g; p.col[gk] = !isCol(p, gk); try { save(); } catch (er) {}
      renderList(); return;
    }
    var it = b.closest('.ib-item'); if (!it) return;
    var k = it.dataset.k, o = find(k, it.dataset.id);
    if (!o) { renderList(); return; }
    var id = o.id;
    // Tanlash rejimida: belgi yoki qatorni bosish — tanlash/bekor qilish
    if (sel && (act === 'sel' || act === 'open')) { var sk = selKey(k, id); if (sel[sk]) delete sel[sk]; else sel[sk] = true; renderList(); return; }
    if (act === 'del') { try { deleteTask(id); } catch (er) { console.warn('[inbox] del', er); } return; }
    if (act === 'gdel') { try { deleteGoal(id); } catch (er) { console.warn('[inbox] gdel', er); } return; }
    if (act === 'cdel') { try { deleteChestTask(id); } catch (er) { console.warn('[inbox] cdel', er); } return; }
    if (act === 'subedit' || act === 'subadd') {
      if (sel) return;
      try { openSubtaskModal(o.id, act === 'subedit' ? (function () { var q0 = (o.subtasks || []).find(function (q) { return q && String(q.id) === String(b.dataset.sid); }); return q0 ? q0.id : undefined; })() : undefined); } catch (er) { console.warn('[inbox] subedit', er); }
      return;
    }
    if (act === 'subdel') {
      var sd = (o.subtasks || []).find(function (q) { return q && String(q.id) === String(b.dataset.sid); });
      if (sd) { try { deleteSubtask(o.id, sd.id); } catch (er) { console.warn('[inbox] subdel', er); } }
      return;
    }
    if (k === 't') {
      var x = taskInfo(o, td0());
      if (act === 'chk') { if (x.canCheck) toggleTask(id); else renderList(); }
      else if (act === 'unfz') { try { unfreezeTask(id); } catch (er) {} renderList(); }
      else if (act === 'sub') {
        var sid = b.dataset.sid, sub = (o.subtasks || []).find(function (q) { return q && String(q.id) === String(sid); });
        if (sub && x.canCheck) { try { toggleSubtask(o.id, sub.id, td0()); } catch (er) { console.warn('[inbox] sub', er); } }
        renderList();
      }
      else if (act === 'fut') { toast('⏳ ' + L("Hali muddati kelmagan — o'sha kunida belgilanadi", 'Not due yet — mark it on its day', 'Срок ещё не наступил — отметьте в свой день')); try { openTaskSheet(id, true, b); } catch (er) {} }
      else if (act === 'today') doToday(o);
      else if (act === 'more') { try { openTaskSheet(id, x.future, b); } catch (er) {} }
      else if (act === 'open') { try { editTask(id); } catch (er) {} }
    } else if (k === 'g') {
      if (act === 'gchk') { try { goalCheckToday(id); } catch (er) {} }
      else if (act === 'gcal') { try { openGoalCalendar(id); } catch (er) {} }
      else if (act === 'open') { try { openGoalModal(id); } catch (er) {} }
    } else if (k === 'c') {
      if (act === 'chest') { close(true); showTab('chest'); }
      else if (act === 'open') { try { openAddChestTask(id); } catch (er) {} }
    }
  }
  // ---------- 📅 Sana o'zgartirish (bir martalik va "har N kunda" vazifalar) ----------
  // ds — yangi sana; null — "Sanasiz"ga qaytarish. Bugungi/muddati o'tgan vazifani oldinga surish — qoldirish (⏩) hisoblanadi.
  function setTaskDate(t, ds) {
    var td = td0(), rep = t.repeat || 'once', g = taskInfo(t, td).g;
    if (t.done || t.isFrozen) return false;
    if (rep !== 'once' && rep !== 'interval') return false;
    if (ds && ds <= td) { doToday(t, true); return true; }
    if (!ds) {
      if (rep !== 'once' || g === 'overdue') return false;
      t.postponedTo = null; return true;
    }
    var late = g === 'today' || g === 'overdue';
    if (rep === 'once') t.postponedTo = ds;
    if (late) { try { markTaskPostponed(t); } catch (e) {} t.overdueOn = ds; }
    if (rep === 'interval') t.nextDate = ds;
    return true;
  }
  function afterChange() {
    try { save(); } catch (e) {}
    try { if (typeof window.render === 'function') window.render(); } catch (e) {}
    renderList();
  }
  function selItems() {
    return Object.keys(sel || {}).map(function (k) { var i = k.indexOf('|'); var kk = k.slice(0, i); return { k: kk, o: find(kk, k.slice(i + 1)) }; }).filter(function (x) { return x.o; });
  }
  // ☑ Ko'p tanlanganlarga amal: done · date · cat · pin · freeze
  function bulk(kind, val) {
    var items = selItems(), tasks = items.filter(function (x) { return x.k === 't'; }).map(function (x) { return x.o; });
    if (!tasks.length) { toast('ℹ️ ' + L("Bu amal faqat vazifalar uchun", 'This works for tasks only', 'Только для задач')); return; }
    var n = 0, skip = 0, td = td0();
    if (kind === 'done') {
      tasks.forEach(function (t) { var x = taskInfo(t, td); if (x.canCheck && !t.done) { try { toggleTask(t.id); n++; } catch (e) {} } else skip++; });
    } else if (kind === 'date') {
      tasks.forEach(function (t) { if (setTaskDate(t, val)) n++; else skip++; });
    } else if (kind === 'cat') {
      tasks.forEach(function (t) { try { taskSetCats(t, val === '-' ? [] : [val]); n++; } catch (e) { skip++; } });
    } else if (kind === 'pin') {
      var allPinned = tasks.every(function (t) { return t.pinned; });
      tasks.forEach(function (t) { t.pinned = !allPinned; n++; });
    } else if (kind === 'freeze') {
      var allFz = tasks.every(function (t) { return t.isFrozen; });
      tasks.forEach(function (t) { if (t.done) { skip++; return; } t.isFrozen = !allFz; t.frozenAt = allFz ? null : td; n++; });
    }
    sel = null;
    afterChange();
    toast('✓ ' + L(n + ' ta vazifa yangilandi', n + ' tasks updated', 'Обновлено задач: ' + n) + (skip ? ' · ' + L(skip + ' tasi o\'tkazildi', skip + ' skipped', 'пропущено: ' + skip) : ''));
  }

  // ---------- ⚡ Tez qo'shish: "nom ertaga #bo'lim !2" ----------
  var WD = { 0: ['yakshanba', 'sunday', 'sun', 'воскресенье', 'вс'], 1: ['dushanba', 'monday', 'mon', 'понедельник', 'пн'], 2: ['seshanba', 'tuesday', 'tue', 'вторник', 'вт'],
    3: ['chorshanba', 'wednesday', 'wed', 'среда', 'ср'], 4: ['payshanba', 'thursday', 'thu', 'четверг', 'чт'], 5: ['juma', 'friday', 'fri', 'пятница', 'пт'], 6: ['shanba', 'saturday', 'sat', 'суббота', 'сб'] };
  function parseQuick(raw) {
    var td = td0(), out = { name: '', date: null, diff: 1, cat: null }, rest = [];
    String(raw || '').trim().split(/\s+/).forEach(function (w) {
      var lw = w.toLowerCase();
      if (/^!([0-4])$/.test(lw)) { out.diff = +lw.slice(1); return; }
      if (/^#.+/.test(w)) {
        var nm = lw.slice(1), c = (S.taskCats || []).filter(Boolean).filter(function (x) { var lb = ''; try { lb = taskCatLabel(x); } catch (e) { lb = x.name || ''; } lb = String(lb).toLowerCase(); return lb === nm || String(x.name || '').toLowerCase() === nm || lb.indexOf(nm) !== -1; })[0];
        if (c) { out.cat = c.id; return; }
      }
      if (/^(bugun|today|сегодня)$/.test(lw)) { out.date = td; return; }
      if (/^(ertaga|tomorrow|tmr|завтра)$/.test(lw)) { out.date = addDays(td, 1); return; }
      if (/^(indinga|послезавтра)$/.test(lw)) { out.date = addDays(td, 2); return; }
      var m = lw.match(/^(\d{1,2})[./](\d{1,2})$/);
      if (m) { var y = +td.slice(0, 4), ds = y + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0'); if (ds < td) ds = (y + 1) + ds.slice(4); if (!isNaN(Date.parse(ds))) { out.date = ds; return; } }
      for (var d = 0; d < 7; d++) if (WD[d].indexOf(lw) !== -1) {
        var cur = new Date(td + 'T00:00:00').getDay(), add = (d - cur + 7) % 7 || 7; out.date = addDays(td, add); return;
      }
      rest.push(w);
    });
    out.name = rest.join(' ').trim();
    return out;
  }
  function quickAdd() {
    var inp = rootEl && rootEl.querySelector('#ib-qa'); if (!inp) return;
    var q = parseQuick(inp.value);
    if (!q.name) { inp.focus(); return; }
    var tr = taskTier(q.diff), td = td0();
    var t = { id: S.nextId++, name: q.name.slice(0, 120), diff: q.diff, coins: tr.c, penalty: tr.p, repeat: 'once', days: null, interval: null, nextDate: null,
      strictSchedule: false, dueDate: null, remindAt: null, startTime: null, endTime: null, autoPomo: false, pinned: false,
      done: false, doneDate: null, skipped: false, skippedDate: null, lastDoneDate: null, createdAt: td, label: null, note: null,
      emoji: null, isFrozen: false, frozenAt: null, subtasks: [] };
    if (q.date) t.postponedTo = q.date;
    if (q.cat) { try { taskSetCats(t, [q.cat]); } catch (e) {} }
    S.tasks.push(t);
    try { ensureFullTaskOrder(); } catch (e) {}
    inp.value = '';
    afterChange();
    try { SFX.click(); } catch (e) {}
    toast('⚡ ' + L("Qo'shildi", 'Added', 'Добавлено') + ': ' + t.name + (q.date ? ' · 📅 ' + (q.date === td ? L('bugun', 'today', 'сегодня') : q.date) : ''));
    setTimeout(function () { var i2 = rootEl && rootEl.querySelector('#ib-qa'); if (i2) i2.focus(); }, 30);
  }

  // ✈️ Telegram /add — matndan vazifa (quickAdd bilan bir xil tahlil: !1, #kategoriya, ertaga ...)
  window.xInboxAddText = function (text) {
    var q = parseQuick(String(text || '')); if (!q.name) return null;
    var tr = taskTier(q.diff), td = td0();
    var t = { id: S.nextId++, name: q.name.slice(0, 120), diff: q.diff, coins: tr.c, penalty: tr.p, repeat: 'once', days: null, interval: null, nextDate: null,
      strictSchedule: false, dueDate: null, remindAt: null, startTime: null, endTime: null, autoPomo: false, pinned: false,
      done: false, doneDate: null, skipped: false, skippedDate: null, lastDoneDate: null, createdAt: td, label: null, note: null,
      emoji: null, isFrozen: false, frozenAt: null, subtasks: [], fromTg: true };
    if (q.date) t.postponedTo = q.date;
    if (q.cat) { try { taskSetCats(t, [q.cat]); } catch (e) {} }
    S.tasks.push(t);
    try { ensureFullTaskOrder(); } catch (e) {}
    afterChange();
    return t;
  };

  // ---------- 🧹 Saralash: sanasiz vazifalarni birma-bir hal qilish ----------
  function nodateTasks() { var td = td0(); return (S.tasks || []).filter(function (t) { return t && !t.done && !t.isFrozen && taskInfo(t, td).g === 'nodate'; }); }
  function triage() {
    var list = nodateTasks(), i = 0, done = 0;
    if (!list.length) return;
    var ov = document.createElement('div'); ov.className = 'x-ov ib-tri-ov';
    ov.innerHTML = '<div class="x-box ib-tri" role="dialog" aria-modal="true"><button class="x-close" aria-label="close">✕</button><div class="ib-tri-body"></div></div>';
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('open'); });
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 200); afterChange(); };
    ov.querySelector('.x-close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var step = function () {
      while (i < list.length && (!list[i] || (S.tasks || []).indexOf(list[i]) === -1)) i++;
      var body = ov.querySelector('.ib-tri-body');
      if (i >= list.length) { body.innerHTML = '<div class="ib-tri-end">🎉<b>' + H(L('Hammasi saralandi!', 'All sorted!', 'Всё разобрано!')) + '</b><small>' + H(L(done + ' ta vazifa joyiga qo\'yildi', done + ' tasks placed', 'Разобрано: ' + done)) + '</small><button type="button" class="x-btn" data-x="close">OK</button></div>'; body.querySelector('[data-x]').onclick = close; return; }
      var t = list[i];
      body.innerHTML = '<div class="ib-tri-n">' + (i + 1) + ' / ' + list.length + '</div><div class="ib-tri-t">' + (t.emoji ? H(t.emoji) + ' ' : '') + H(t.name) + '</div>' + (t.note ? '<div class="ib-tri-note">' + H(t.note) + '</div>' : '') +
        '<div class="ib-tri-acts">' +
        '<button type="button" class="x-btn" data-x="today">📅 ' + H(L('Bugun', 'Today', 'Сегодня')) + '</button>' +
        '<button type="button" class="x-btn ghost" data-x="tom">⏭ ' + H(L('Ertaga', 'Tomorrow', 'Завтра')) + '</button>' +
        '<button type="button" class="x-btn ghost" data-x="week">🗓 ' + H(L('Keyingi hafta', 'Next week', 'Через неделю')) + '</button>' +
        '<button type="button" class="x-btn ghost" data-x="skip">↷ ' + H(L('Keyinroq hal qilaman', 'Decide later', 'Решу позже')) + '</button>' +
        '<button type="button" class="x-btn ghost ib-tri-del" data-x="del">🗑 ' + H(L("O'chirish", 'Delete', 'Удалить')) + '</button></div>';
      body.querySelectorAll('[data-x]').forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.x;
          if (a === 'today') { doToday(t, true); done++; }
          else if (a === 'tom') { setTaskDate(t, addDays(td0(), 1)); done++; }
          else if (a === 'week') { setTaskDate(t, addDays(td0(), 7)); done++; }
          else if (a === 'del') { try { moveTaskToTrash(t.id); done++; } catch (e) {} }
          try { save(); } catch (e) {}
          i++; step();
        };
      });
    };
    step();
  }

  // ---------- 📤 Ulashish / eksport ----------
  function exportRows() {
    var r = collect(), p = prefs(), rows = [];
    if (p.groupBy !== 'date') regroup(r, p.groupBy);
    Object.keys(r).forEach(function (g) { (r[g] || []).forEach(function (x) { rows.push(x); }); });
    return rows;
  }
  function shareMenu(btn) {
    var old = document.querySelector('.ib-share-m'); if (old) { old.remove(); return; }
    var m = document.createElement('div'); m.className = 'ib-share-m';
    m.innerHTML = '<button type="button" data-s="text">📝 ' + H(L('Matn sifatida ulashish', 'Share as text', 'Поделиться текстом')) + '</button>';
    document.body.appendChild(m);
    var rc = btn.getBoundingClientRect(); m.style.top = Math.round(rc.bottom + 6) + 'px'; m.style.left = Math.round(Math.max(8, Math.min(rc.left, window.innerWidth - m.offsetWidth - 8))) + 'px';
    var off = function (e) { if (!m.contains(e.target) && e.target !== btn) { m.remove(); document.removeEventListener('click', off, true); } };
    setTimeout(function () { document.addEventListener('click', off, true); }, 0);
    m.onclick = function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      var rows = exportRows(), td = td0();
      if (b.dataset.s === 'text') {
        var txt = '📥 Inbox · ' + td + '\n' + rows.map(function (x) {
          var o = x.o, mark = x.k === 't' ? (o.done ? '☑' : '☐') : x.k === 'g' ? '🎯' : '🎲';
          return mark + ' ' + (o.name || '') + (x.k === 't' && x.next && !o.done ? ' — ' + x.next : '');
        }).join('\n');
        var done = function () { toast('📋 ' + L('Nusxalandi', 'Copied', 'Скопировано')); };
        if (navigator.share) navigator.share({ title: 'Inbox', text: txt }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done); else done();
      }
      m.remove();
    };
  }
  // 📄 Inbox CSV — endi faqat Sozlamalar → Eksport oynasidan
  window.xCsvInbox = function () {
    var rows = exportRows(), td = td0();
    {
        var q = function (v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
        var csv = ['type,name,status,date,category,difficulty,coins'].concat(rows.map(function (x) {
          var o = x.o, c = null; if (x.k === 't') { try { c = taskCatOf(o); } catch (e) {} }
          var coins = 0; try { coins = x.k === 't' ? taskCoinValue(o) : x.k === 'g' ? goalCoins(o) : x.coins; } catch (e) {}
          return [x.k === 't' ? 'task' : x.k === 'g' ? 'goal' : 'chest', o.name, x.k === 't' ? (o.done ? 'done' : x.g) : x.k === 'g' ? (x.completed ? 'completed' : 'active') : (x.done ? 'done' : 'open'),
            x.k === 't' ? (o.done ? o.doneDate : x.next) : '', c ? (c.name || '') : '', o.diff == null ? '' : o.diff, coins].map(q).join(',');
        })).join('\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'inbox-' + td + '.csv'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    }
  };

  // ---------- 👆 Telefonda surish va 🖱 sudrab qayta rejalashtirish ----------
  function bindGestures() {
    var sw = null;
    rootEl.addEventListener('pointerdown', function (e) {
      if (sel || e.pointerType === 'mouse' || e.button > 0) return;
      var it = e.target.closest('.ib-item[data-k="t"]'); if (!it || e.target.closest('.ib-sts, input, select')) return;
      sw = { it: it, x: e.clientX, y: e.clientY, dx: 0, on: false };
    }, { passive: true });
    rootEl.addEventListener('pointermove', function (e) {
      if (!sw) return;
      var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (!sw.on) { if (Math.abs(dy) > 12) { sw = null; return; } if (Math.abs(dx) < 14) return; sw.on = true; sw.it.classList.add('ib-swiping'); }
      sw.dx = Math.max(-140, Math.min(140, dx));
      sw.it.style.transform = 'translateX(' + sw.dx + 'px)';
      sw.it.dataset.sw = sw.dx > 70 ? 'r' : sw.dx < -70 ? 'l' : '';
    }, { passive: true });
    var end = function () {
      if (!sw) return; var s0 = sw; sw = null;
      s0.it.classList.remove('ib-swiping'); s0.it.style.transform = ''; var dir = s0.it.dataset.sw; s0.it.dataset.sw = '';
      if (!s0.on || !dir) return;
      var t = find('t', s0.it.dataset.id); if (!t) return;
      var x = taskInfo(t, td0());
      if (dir === 'r') { if (x.canCheck) toggleTask(t.id); else if (x.canToday) doToday(t); else toast('⏳ ' + L('Hali muddati kelmagan', 'Not due yet', 'Срок ещё не наступил')); }
      else { if (setTaskDate(t, addDays(td0(), 1))) { afterChange(); toast('⏭ ' + L('Ertaga', 'Tomorrow', 'Завтра') + ': ' + t.name); } else toast('ℹ️ ' + L("Takrorlanuvchi vazifani surib bo'lmaydi", "Repeating tasks can't be moved", 'Повторяющуюся задачу нельзя перенести')); }
    };
    rootEl.addEventListener('pointerup', end); rootEl.addEventListener('pointercancel', end);

    var dragId = null;
    rootEl.addEventListener('dragstart', function (e) {
      var it = e.target.closest && e.target.closest('.ib-item[draggable="true"]'); if (!it) return;
      dragId = it.dataset.id; it.classList.add('ib-dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } catch (er) {}
      rootEl.querySelectorAll('[data-drop]').forEach(function (s0) { s0.hidden = false; s0.classList.add('ib-drop-on'); });
    });
    rootEl.addEventListener('dragend', function () {
      dragId = null;
      rootEl.querySelectorAll('.ib-dragging').forEach(function (x) { x.classList.remove('ib-dragging'); });
      rootEl.querySelectorAll('[data-drop]').forEach(function (s0) { s0.classList.remove('ib-drop-on', 'ib-drop-hover'); if (s0.classList.contains('ib-drop-only')) s0.hidden = true; });
    });
    rootEl.addEventListener('dragover', function (e) {
      var sec = dragId && e.target.closest && e.target.closest('[data-drop]'); if (!sec) return;
      e.preventDefault(); rootEl.querySelectorAll('.ib-drop-hover').forEach(function (x) { if (x !== sec) x.classList.remove('ib-drop-hover'); }); sec.classList.add('ib-drop-hover');
    });
    rootEl.addEventListener('drop', function (e) {
      var sec = dragId && e.target.closest && e.target.closest('[data-drop]'); if (!sec) return;
      e.preventDefault();
      var t = find('t', dragId), to = sec.dataset.drop; if (!t) return;
      var ok = to === 'today' ? setTaskDate(t, td0()) : to === 'upcoming' ? setTaskDate(t, addDays(td0(), 1)) : setTaskDate(t, null);
      if (ok) { afterChange(); toast('📅 ' + (to === 'today' ? L('Bugunga', 'To today', 'На сегодня') : to === 'upcoming' ? L('Ertaga', 'Tomorrow', 'Завтра') : L('Sanasiz', 'No date', 'Без даты'))); }
      else toast('ℹ️ ' + L("Bu vazifaning sanasini bu yerga o'tkazib bo'lmaydi", "This task can't be moved here", 'Эту задачу нельзя перенести сюда'));
    });
  }

  // ⤵ Kelajakka qo'yilgan vazifani bugunga olish (⏩ qoldirish mantig'ining teskarisi)
  function doToday(t, quiet) {
    var td = td0(), rep = t.repeat || 'once';
    if (t.done || t.isFrozen) return;
    if (rep !== 'once' && rep !== 'interval') { if (!quiet) { try { openTaskSheet(t.id, true); } catch (e) {} } return; }
    if (t.overdueFrom && t.overdueFrom >= td) { t.overdueFrom = null; t.overdueOn = null; }
    else if (t.overdueOn && t.overdueOn > td) t.overdueOn = td;
    if (rep === 'once') t.postponedTo = td; else t.nextDate = td;
    if (quiet) return;
    save();
    try { if (typeof window.render === 'function') window.render(); } catch (e) {}
    toast('📅 ' + L("Bugungi ro'yxatga qo'shildi", 'Moved to today', 'Перенесено на сегодня'));
  }

  function open() {
    isOpen = true; query = ''; sel = null;
    if ((document.documentElement.getAttribute('data-tab') || '') !== 'hub') showTab('hub'); else render();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function close(silent) {
    if (!isOpen) return;
    isOpen = false; rootEl = null;
    if (!silent && typeof window.xRenderHub === 'function') { window.xRenderHub(); try { window.scrollTo(0, 0); } catch (e) {} }
  }
  function scheduleRefresh() {
    if (!isOpen || !rootEl || !rootEl.isConnected) return;
    if (refreshT) return; // throttle: ketma-ket save()'lar yangilanishni cheksiz kechiktirmasin
    refreshT = setTimeout(function () { refreshT = null; try { renderList(); } catch (e) { console.warn('[inbox]', e); } }, 40);
  }

  // Ma'lumot o'zgarsa ro'yxat yangilanadi: save() har safar S._savedAt ni yangilaydi
  // (script.js ichidagi save() chaqiruvlari window.save orqali o'tmaydi, shuning
  // uchun yengil kuzatuv), render() esa xRenderTasksExtras orqali darhol xabar beradi.
  var lastSaved = null;
  setInterval(function () {
    if (!isOpen || !rootEl || !rootEl.isConnected || document.hidden) return;
    var s = S && S._savedAt;
    if (s !== lastSaved) { lastSaved = s; scheduleRefresh(); }
  }, 700);
  (function hookRender() {
    var orig = window.xRenderTasksExtras;
    window.xRenderTasksExtras = function () {
      var r; if (typeof orig === 'function') r = orig.apply(this, arguments);
      try { lastSaved = S && S._savedAt; scheduleRefresh(); } catch (e) {}
      return r;
    };
  })();
  // Hubdan boshqa bo'limga o'tilsa — Inbox yopiladi (keyingi safar Hub odatdagidek ochiladi)
  try {
    new MutationObserver(function () {
      if (isOpen && document.documentElement.getAttribute('data-tab') !== 'hub') { isOpen = false; rootEl = null; }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tab'] });
  } catch (e) {}
  // ⌨️ Klaviatura: / qidiruv · n tez qo'shish · j/k yurish · x bajarish · e ochish
  document.addEventListener('keydown', function (e) {
    if (!isOpen || !rootEl || !rootEl.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target, typing = tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable);
    if (typing || document.querySelector('.modal-overlay.open, .x-ov, .ct-modal-overlay, .tc-ov, #task-action-sheet.open')) return;
    var k = e.key, items = Array.prototype.slice.call(rootEl.querySelectorAll('.ib-item'));
    var cur = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.ib-item') : null;
    if (k === '/') { e.preventDefault(); var q = rootEl.querySelector('#ib-q'); if (q) q.focus(); return; }
    if (k === 'n') { e.preventDefault(); var qa = rootEl.querySelector('#ib-qa'); if (qa) qa.focus(); return; }
    if (k === 'j' || k === 'k' || k === 'ArrowDown' && cur || k === 'ArrowUp' && cur) {
      if (!items.length) return; e.preventDefault();
      var i = cur ? items.indexOf(cur) : -1, d = (k === 'j' || k === 'ArrowDown') ? 1 : -1;
      var nx = items[Math.max(0, Math.min(items.length - 1, i + d))]; if (nx) { nx.focus(); nx.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    if (!cur) return;
    if (k === 'x') { var cb = cur.querySelector('[data-act="chk"], [data-act="gchk"]'); if (cb) { e.preventDefault(); cb.click(); } return; }
    if (k === 'e' || k === 'Enter') { var mb = cur.querySelector('[data-act="open"]'); if (mb) { e.preventDefault(); mb.click(); } return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen || !rootEl || !rootEl.isConnected) return;
    if (document.querySelector('.modal-overlay.open, .x-ov, .ct-modal-overlay, .tc-ov, #task-action-sheet.open')) return;
    if (e.target && e.target.id === 'ib-q' && e.target.value) return;
    if (sel) { sel = null; renderList(); return; } // avval tanlash rejimidan chiqamiz
    close();
  });

  window.xInbox = { open: open, close: close, isOpen: function () { return isOpen; }, render: render, openCount: openCount, _collect: collect };
})();

// ============================================================
// 🎯 MAQSADLAR v2 — kunlik miqdor (8 stakan suv), kunlik izoh, statistika, andozalar,
// rang/arxiv/qo'lda tartib, rejali pauza, vazifaga bog'lash, 👥 do'st bilan birga odat
// (script.js → renderGoals/saveGoal/toggleTaskInternal ichidagi ilgaklar orqali)
// ============================================================
(function () {
  'use strict';
  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  var COLORS = ['', '#7C5CFC', '#34D399', '#F5A623', '#F87171', '#60A5FA', '#EC4899', '#22D3EE'];
  function G(id) { return (S.goals || []).find(function (x) { return String(x.id) === String(id); }); }
  function tk() { return typeof trackDate === 'function' ? trackDate() : today(); }
  function rerender() { try { save(); } catch (e) {} try { renderGoals(); } catch (e) {} try { renderGoalsCalendar(); } catch (e) {} try { render(); } catch (e) {} }
  function modal(html, cls) {
    var ov = document.createElement('div'); ov.className = 'x-ov gx-ov';
    ov.innerHTML = '<div class="x-box ' + (cls || '') + '" role="dialog" aria-modal="true"><button class="x-close" aria-label="close">✕</button>' + html + '</div>';
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('open'); });
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 200); };
    ov.querySelector('.x-close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov._close = close; return ov;
  }

  // ---------- Modal: qo'shimcha maydonlar ----------
  var _editId = null;
  function fieldsHtml(g) {
    var tasks = (S.tasks || []).filter(function (t) { return t && !t.isFrozen; }).slice(0, 300);
    return '<div class="modal-field"><label>🔢 ' + H(L('Kunlik miqdor (ixtiyoriy)', 'Daily amount (optional)', 'Дневная норма (необязательно)')) + '</label>' +
      '<div class="gmx-row"><input type="number" id="gmx-target" min="1" max="999" inputmode="numeric" placeholder="' + H(L('masalan 8', 'e.g. 8', 'напр. 8')) + '" value="' + H(g && g.target > 1 ? g.target : '') + '">' +
      '<input type="text" id="gmx-unit" maxlength="16" placeholder="' + H(L('stakan, bet, daqiqa…', 'glasses, pages, min…', 'стаканов, страниц…')) + '" value="' + H((g && g.unit) || '') + '"></div>' +
      '<small class="gmx-hint">' + H(L("Bo'sh bo'lsa — oddiy ✓. Masalan 8 stakan suv: har stakanga +1, 8 ga yetganda kun belgilanadi.", 'Leave empty for a simple ✓. E.g. 8 glasses: +1 each, the day is marked at 8.', 'Пусто — простая ✓. Напр. 8 стаканов: +1 за каждый, день отмечается на 8.')) + '</small></div>' +
      '<div class="modal-field"><label>🎨 ' + H(L('Rang', 'Color', 'Цвет')) + '</label><div class="gmx-colors">' + COLORS.map(function (c) {
        return '<button type="button" class="gmx-col' + (((g && g.color) || '') === c ? ' sel' : '') + '" data-c="' + c + '" style="' + (c ? 'background:' + c : '') + '" aria-label="' + H(c || L("Rangsiz", 'None', 'Без цвета')) + '">' + (c ? '' : '∅') + '</button>';
      }).join('') + '</div></div>' +
      '<div class="modal-field"><label>🔗 ' + H(L("Vazifaga bog'lash", 'Link to a task', 'Связать с задачей')) + '</label><select id="gmx-link"><option value="">— ' + H(L("Bog'lanmagan", 'Not linked', 'Не связано')) + ' —</option>' +
        tasks.map(function (t) { return '<option value="' + H(t.id) + '"' + (g && String(g.linkTask) === String(t.id) ? ' selected' : '') + '>' + H((t.emoji ? t.emoji + ' ' : '') + t.name) + '</option>'; }).join('') + '</select>' +
      '<small class="gmx-hint">' + H(L("Bog'langan vazifa bajarilsa — odat ham avtomatik belgilanadi", 'When the linked task is completed, the habit is marked too', 'Когда задача выполнена — привычка отмечается сама')) + '</small></div>' +
      '<label class="gmx-check"><input type="checkbox" id="gmx-grace"' + (!g || g.grace !== false ? ' checked' : '') + '> 🧊 ' + H(L("Streak himoyasi: oyiga 2 ta o'tkazib yuborilgan kun streakni uzmaydi", 'Streak shield: 2 missed days a month don\'t break the streak', 'Защита серии: 2 пропуска в месяц не обрывают серию')) + '</label>';
  }
  (function hookOpen() {
    var orig = window.openGoalModal;
    if (typeof orig !== 'function') return;
    window.openGoalModal = openGoalModal = function (id) {
      _editId = id || null;
      var r = orig.apply(this, arguments);
      var box = document.getElementById('gmx-fields');
      if (box) {
        box.innerHTML = fieldsHtml(id ? G(id) : null);
        box.querySelectorAll('.gmx-col').forEach(function (b) { b.onclick = function () { box.querySelectorAll('.gmx-col').forEach(function (x) { x.classList.toggle('sel', x === b); }); }; });
      }
      return r;
    };
  })();
  window.xGoalSaveExtras = function (g) {
    var box = document.getElementById('gmx-fields'); if (!box || !box.firstChild) return;
    var tg = parseInt((document.getElementById('gmx-target') || {}).value, 10);
    g.target = tg > 1 ? Math.min(999, tg) : null;
    g.unit = g.target ? String((document.getElementById('gmx-unit') || {}).value || '').trim().slice(0, 16) : null;
    var sc = box.querySelector('.gmx-col.sel'); g.color = sc ? sc.dataset.c || null : (g.color || null);
    var lk = (document.getElementById('gmx-link') || {}).value; g.linkTask = lk ? (isNaN(+lk) ? lk : +lk) : null;
    g.grace = !!(document.getElementById('gmx-grace') || {}).checked;
  };

  // ---------- 🔢 Kunlik miqdor ----------
  function count(g, d) { return (g.counts && g.counts[d]) || 0; }
  window.gxInc = function (id, delta) {
    var g = G(id); if (!g) return;
    var d = tk(); if (!g.counts) g.counts = {};
    var tgt = g.target || 1, prev = count(g, d), n = Math.max(0, Math.min(tgt * 3, prev + delta));
    g.counts[d] = n; if (!n) delete g.counts[d];
    var checked = !!(g.daysChecked && g.daysChecked[d]);
    if (n >= tgt && !checked) { try { goalCheckToday(g.id); } catch (e) {} return; }
    if (n < tgt && checked) { try { goalCheckToday(g.id); } catch (e) {} return; }
    if (delta > 0) { try { SFX.click(); } catch (e) {} }
    rerender();
  };

  // ---------- 📝 Kunlik izoh ----------
  window.gxNote = function (id) {
    var g = G(id); if (!g) return;
    var d = tk(), cur = (g.notes && g.notes[d]) || '';
    var moods = ['😄', '🙂', '😐', '😕', '😫'];
    var ov = modal('<h3 class="gx-h">📝 ' + H(g.emoji || '🎯') + ' ' + H(g.name) + '</h3><p class="gx-sub">' + H(d) + '</p>' +
      '<div class="gx-moods">' + moods.map(function (m) { return '<button type="button" class="gx-mood' + (cur.indexOf(m) === 0 ? ' sel' : '') + '" data-m="' + m + '">' + m + '</button>'; }).join('') + '</div>' +
      '<textarea class="x-in gx-note" maxlength="200" rows="3" placeholder="' + H(L("Bugun qanday o'tdi? (ixtiyoriy)", 'How did it go today? (optional)', 'Как прошло сегодня? (необязательно)')) + '">' + H(cur.replace(/^(\S+)\s/, function (m0, e1) { return moods.indexOf(e1) !== -1 ? '' : m0; })) + '</textarea>' +
      '<div class="gx-acts"><button type="button" class="x-btn" data-save>' + H(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    var mood = moods.filter(function (m) { return cur.indexOf(m) === 0; })[0] || '';
    ov.querySelectorAll('.gx-mood').forEach(function (b) { b.onclick = function () { mood = mood === b.dataset.m ? '' : b.dataset.m; ov.querySelectorAll('.gx-mood').forEach(function (x) { x.classList.toggle('sel', x.dataset.m === mood); }); }; });
    ov.querySelector('[data-save]').onclick = function () {
      var txt = String(ov.querySelector('.gx-note').value || '').trim(), v = (mood ? mood + ' ' : '') + txt;
      if (!g.notes) g.notes = {};
      if (v.trim()) g.notes[d] = v.trim().slice(0, 210); else delete g.notes[d];
      ov._close(); rerender(); toast('📝 ' + L('Saqlandi', 'Saved', 'Сохранено'));
    };
  };

  // ---------- 📊 Statistika ----------
  window.gxStats = function (id) {
    var g = G(id); if (!g) return;
    var end = tk(), wd = [0, 0, 0, 0, 0, 0, 0].map(function () { return { due: 0, done: 0 }; }), grid = '', doneN = 0, dueN = 0;
    var names = typeof getShortDaysArr === 'function' ? getShortDaysArr() : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (var i = 89; i >= 0; i--) {
      var d = addDays(end, -i), before = g.startDate && d < g.startDate, chk = !!(g.daysChecked && g.daysChecked[d]), due = !before && isGoalDueOnDate(g, d);
      var dow = new Date(d + 'T00:00:00').getDay();
      if (due && d !== end || chk) { wd[dow].due++; dueN++; if (chk) { wd[dow].done++; doneN++; } }
      grid += '<i class="' + (chk ? 'on' : before ? 'na' : due && d !== end ? 'miss' : 'off') + '" title="' + d + (g.notes && g.notes[d] ? ' · ' + H(g.notes[d]) : '') + '"></i>';
    }
    var rates = wd.map(function (x, i) { return { i: i, r: x.due ? Math.round(x.done / x.due * 100) : null }; });
    var known = rates.filter(function (x) { return x.r !== null; });
    var best = known.slice().sort(function (a, b) { return b.r - a.r; })[0], worst = known.slice().sort(function (a, b) { return a.r - b.r; })[0];
    var st = goalStreak(g), notes = Object.keys(g.notes || {}).sort().reverse().slice(0, 5);
    modal('<h3 class="gx-h">📊 ' + H(g.emoji || '🎯') + ' ' + H(g.name) + '</h3>' +
      '<div class="gx-kpis"><div><b>' + (dueN ? Math.round(doneN / dueN * 100) : 0) + '%</b><small>' + H(L('90 kunda', '90 days', '90 дней')) + '</small></div><div><b>🔥 ' + st.cur + '</b><small>' + H(L('Hozirgi', 'Current', 'Текущая')) + '</small></div><div><b>🏆 ' + st.best + '</b><small>' + H(L('Rekord', 'Best', 'Рекорд')) + '</small></div><div><b>' + doneN + '</b><small>' + H(L('Bajarilgan kun', 'Days done', 'Дней')) + '</small></div></div>' +
      '<div class="gx-lbl">' + H(L('Hafta kunlari bo\'yicha', 'By weekday', 'По дням недели')) + '</div><div class="gx-wd">' + [1, 2, 3, 4, 5, 6, 0].map(function (i) {
        var r = rates[i].r; return '<div class="gx-wd-c"><span class="gx-wd-bar"><i style="height:' + (r || 0) + '%"></i></span><b>' + (r === null ? '—' : r + '%') + '</b><small>' + H(String(names[i]).slice(0, 2)) + '</small></div>';
      }).join('') + '</div>' +
      (best && worst && best.i !== worst.i ? '<p class="gx-sub">💪 ' + H(L('Eng yaxshi kun', 'Best day', 'Лучший день')) + ': <b>' + H(names[best.i]) + '</b> · 😓 ' + H(L('Eng qiyin', 'Hardest', 'Сложнее всего')) + ': <b>' + H(names[worst.i]) + '</b></p>' : '') +
      '<div class="gx-lbl">' + H(L('Oxirgi 90 kun', 'Last 90 days', 'Последние 90 дней')) + '</div><div class="gx-grid">' + grid + '</div>' +
      (notes.length ? '<div class="gx-lbl">📝 ' + H(L('Izohlar', 'Notes', 'Заметки')) + '</div>' + notes.map(function (d) { return '<div class="gx-note-row"><small>' + d + '</small> ' + H(g.notes[d]) + '</div>'; }).join('') : ''), 'gx-stats');
  };

  // ---------- ⏸ Rejali pauza ----------
  window.gxPlanPause = function (id) {
    var g = G(id); if (!g) return;
    var td = today();
    var ov = modal('<h3 class="gx-h">⏸ ' + H(L('Rejali pauza', 'Planned pause', 'Плановая пауза')) + '</h3><p class="gx-sub">' + H(L("Ta'til yoki kasallik: shu kunlarda jarima va talab bo'lmaydi, streak uzilmaydi.", 'Vacation or sick days: no penalty or requirement, the streak is kept.', 'Отпуск или болезнь: без штрафов, серия сохраняется.')) + '</p>' +
      '<div class="gmx-row"><label class="gx-dl">' + H(L('Dan', 'From', 'С')) + '<input type="date" class="x-in" id="gx-pf" min="' + td + '" value="' + td + '"></label><label class="gx-dl">' + H(L('Gacha', 'To', 'По')) + '<input type="date" class="x-in" id="gx-pt" min="' + td + '" value="' + addDays(td, 4) + '"></label></div>' +
      ((g.pauses || []).filter(function (p) { return p.to && p.to > td; }).map(function (p, i) { return '<div class="gx-note-row">⏸ ' + p.from + ' → ' + addDays(p.to, -1) + '</div>'; }).join('')) +
      '<div class="gx-acts"><button type="button" class="x-btn" data-ok>' + H(L('Rejalashtirish', 'Schedule', 'Запланировать')) + '</button></div>');
    ov.querySelector('[data-ok]').onclick = function () {
      var f = ov.querySelector('#gx-pf').value, t2 = ov.querySelector('#gx-pt').value;
      if (!f || !t2 || t2 < f) { toast('⚠️ ' + L("Sanalar noto'g'ri", 'Invalid dates', 'Неверные даты')); return; }
      if (!g.pauses) g.pauses = [];
      g.pauses.push({ from: f, to: addDays(t2, 1), planned: true });
      ov._close(); rerender(); toast('⏸ ' + f + ' → ' + t2);
    };
  };
  window.gxArchive = function (id) {
    var g = G(id); if (!g) return;
    g.archived = !g.archived; rerender();
    toast(g.archived ? '🗄 ' + L('Arxivga olindi', 'Archived', 'В архиве') : '↩ ' + L('Arxivdan chiqarildi', 'Restored', 'Восстановлено'));
  };

  // ---------- Kartaga qo'shimchalar ----------
  window.xGoalCard = function (card, g, x) {
    var d = tk();
    var acts = card.firstElementChild && card.firstElementChild.lastElementChild;
    if (acts) {
      var mk = function (ic, title, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'gx-btn'; b.title = title; b.setAttribute('aria-label', title); b.textContent = ic; b.onclick = function (e) { e.stopPropagation(); fn(g.id); }; return b; };
      var more = document.createElement('div'); more.className = 'gx-more';
      more.appendChild(mk('📝', L('Bugungi izoh', "Today's note", 'Заметка'), window.gxNote));
      more.appendChild(mk('📊', L('Statistika', 'Stats', 'Статистика'), window.gxStats));
      if (!x.completed && g.repeat !== 'once') more.appendChild(mk('🗓', L('Rejali pauza', 'Planned pause', 'Плановая пауза'), window.gxPlanPause));
      more.appendChild(mk(g.archived ? '↩' : '🗄', g.archived ? L('Arxivdan chiqarish', 'Unarchive', 'Из архива') : L('Arxivlash', 'Archive', 'В архив'), window.gxArchive));
      card.firstElementChild.after(more);
    }
    var chips = card.children[1 + (acts ? 1 : 0)];
    var addChip = function (html) { if (!chips) return; var s0 = document.createElement('span'); s0.className = 'gx-chip'; s0.innerHTML = html; chips.appendChild(s0); };
    var st = goalStreak(g);
    if (st.saved) addChip('🧊 ' + st.saved + '/' + 2);
    if (g.linkTask != null) { var lt = (S.tasks || []).find(function (t) { return String(t.id) === String(g.linkTask); }); if (lt) addChip('🔗 ' + H(lt.name.length > 18 ? lt.name.slice(0, 18) + '…' : lt.name)); }
    var pl = (g.pauses || []).filter(function (p) { return p.planned && p.from > d; })[0];
    if (pl) addChip('🗓⏸ ' + H(pl.from));
    if (g.notes && g.notes[d]) { var nl = document.createElement('div'); nl.className = 'gx-note-line'; nl.textContent = '📝 ' + g.notes[d]; card.appendChild(nl); }
    // 🔢 Kunlik miqdor: ✓ tugmasi o'rniga − n/maqsad +
    if (g.target > 1 && x.due && !x.completed && !x.paused && !x.expired) {
      var cb = card.querySelector('button[onclick^="goalCheckToday"]');
      if (cb) {
        var n = count(g, d), pct = Math.min(100, Math.round(n / g.target * 100));
        var w = document.createElement('div'); w.className = 'gx-counter' + (x.checked ? ' done' : '');
        w.innerHTML = '<button type="button" class="gx-cbtn" data-d="-1" aria-label="−1">−</button><div class="gx-cmid"><b>' + n + ' / ' + g.target + '</b><small>' + H(g.unit || '') + (x.checked ? ' · ✓' : '') + '</small><span class="gx-cbar"><i style="width:' + pct + '%"></i></span></div><button type="button" class="gx-cbtn plus" data-d="1" aria-label="+1">＋</button>';
        w.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { window.gxInc(g.id, +b.dataset.d); }; });
        cb.replaceWith(w);
      }
    }
  };

  // ---------- Ro'yxat ustidagi asboblar: andozalar, qo'lda tartib, do'st bilan odat ----------
  var _sortable = null;
  window.xGoalsListDone = function (list) {
    var bar = document.getElementById('goals-filter-bar'); if (!bar) return;
    var tools = document.getElementById('gx-tools');
    if (!tools) { tools = document.createElement('div'); tools.id = 'gx-tools'; tools.className = 'gx-tools'; bar.parentNode.insertBefore(tools, bar); }
    tools.innerHTML = '<button type="button" class="gx-tool" data-t="tpl">📦 ' + H(L('Andozalar', 'Templates', 'Шаблоны')) + '</button>' +
      '<button type="button" class="gx-tool' + (S.goalManualOrder ? ' on' : '') + '" data-t="ord">↕ ' + H(L("Qo'lda tartib", 'Manual order', 'Свой порядок')) + '</button>' +
      '<button type="button" class="gx-tool" data-t="sh">👥 ' + H(L("Do'st bilan odat", 'Habit with a friend', 'Привычка с другом')) + '</button>';
    tools.querySelector('[data-t="tpl"]').onclick = openTemplates;
    tools.querySelector('[data-t="ord"]').onclick = function () { S.goalManualOrder = !S.goalManualOrder; if (S.goalManualOrder && !Array.isArray(S.goalOrder)) S.goalOrder = (S.goals || []).map(function (g) { return g.id; }); rerender(); toast(S.goalManualOrder ? '↕ ' + L('Kartani bosib turib sudrang', 'Hold and drag a card', 'Зажмите и перетащите') : L("Avtomatik tartib", 'Automatic order', 'Авто-порядок')); };
    tools.querySelector('[data-t="sh"]').onclick = shInvite;
    if (_sortable) { try { _sortable.destroy(); } catch (e) {} _sortable = null; }
    if (S.goalManualOrder && window.Sortable && list.children.length > 1) {
      _sortable = window.Sortable.create(list, { animation: 160, delay: 220, delayOnTouchOnly: true, filter: 'button, input', preventOnFilter: false, ghostClass: 'gx-ghost',
        onEnd: function () {
          var ids = Array.prototype.map.call(list.querySelectorAll('.goal-card'), function (c) { return isNaN(+c.dataset.id) ? c.dataset.id : +c.dataset.id; });
          var rest = (S.goalOrder || []).filter(function (id) { return ids.indexOf(id) === -1; });
          S.goalOrder = ids.concat(rest); try { save(); } catch (e) {}
        } });
    }
    renderShared();
  };

  var TPL = [
    ['⏰', ['Erta turish (7:00 gacha)', 'Wake up early (before 7)', 'Ранний подъём (до 7:00)'], {}],
    ['🏃', ['Sport (Du/Ch/Ju)', 'Workout (Mon/Wed/Fri)', 'Спорт (Пн/Ср/Пт)'], { repeat: 'custom-days', days: [1, 3, 5], coins: 2 }],
    ['📖', ['Kitob o\'qish', 'Read a book', 'Чтение книги'], { target: 20, unit: ['bet', 'pages', 'стр.'] }],
    ['💧', ['Suv ichish', 'Drink water', 'Пить воду'], { target: 8, unit: ['stakan', 'glasses', 'стаканов'] }],
    ['🧘', ['Meditatsiya', 'Meditation', 'Медитация'], {}],
    ['📵', ['Yotishdan oldin telefonsiz', 'No phone before bed', 'Без телефона перед сном'], {}],
    ['🇬🇧', ['Ingliz tili — 15 daqiqa', 'English — 15 minutes', 'Английский — 15 минут'], { coins: 2 }],
    ['🚶', ['Qadamlar', 'Steps', 'Шаги'], { target: 8000, unit: ['qadam', 'steps', 'шагов'] }]
  ];
  function openTemplates() {
    var have = {}; (S.goals || []).forEach(function (g) { have[String(g.name).toLowerCase()] = 1; });
    var ov = modal('<h3 class="gx-h">📦 ' + H(L('Odat andozalari', 'Habit templates', 'Шаблоны привычек')) + '</h3><div class="gx-tpls">' + TPL.map(function (t0, i) {
      var nm = L(t0[1][0], t0[1][1], t0[1][2]), ex = have[nm.toLowerCase()];
      return '<button type="button" class="gx-tpl" data-i="' + i + '"' + (ex ? ' disabled' : '') + '><span>' + t0[0] + '</span><b>' + H(nm) + '</b>' + (t0[2].target ? '<small>' + t0[2].target + ' ' + H(L(t0[2].unit[0], t0[2].unit[1], t0[2].unit[2])) + '</small>' : '') + '<em>' + (ex ? '✓' : '＋') + '</em></button>';
    }).join('') + '</div>');
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b || b.disabled) return;
      var t0 = TPL[+b.dataset.i], o = t0[2], nm = L(t0[1][0], t0[1][1], t0[1][2]);
      var g = { id: Date.now(), name: nm, desc: '', duration: 0, emoji: t0[0], startDate: tk(), endDate: null, done: false, daysChecked: {}, coins: o.coins || 1,
        repeat: o.repeat || 'daily', penalty: 0, remind: null, pauses: [], daysPenalty: {}, days: o.days || null, interval: null, intervalStart: null,
        target: o.target || null, unit: o.unit ? L(o.unit[0], o.unit[1], o.unit[2]) : null, grace: true };
      if (!S.goals) S.goals = []; S.goals.push(g);
      b.disabled = true; b.querySelector('em').textContent = '✓';
      rerender(); toast(t0[0] + ' ' + L("Qo'shildi", 'Added', 'Добавлено') + ': ' + nm);
    });
  }

  // ---------- 🔗 Vazifa bajarilsa — odat belgilanadi ----------
  window.xGoalLinkedTask = function (task) {
    if (!task) return;
    var d = tk(), changed = false;
    (S.goals || []).forEach(function (g) {
      if (g.linkTask == null || String(g.linkTask) !== String(task.id) || g.archived) return;
      var chk = !!(g.daysChecked && g.daysChecked[d]);
      if (!g.autoLinked) g.autoLinked = {};
      if (task.done && !chk && isGoalDueOnDate(g, d) && !goalIsPaused(g)) { _goalToggleDateCore(g, d); g.autoLinked[d] = 1; changed = true; toast('🔗 ' + (g.emoji || '🎯') + ' ' + g.name + ' ✓'); }
      else if (!task.done && chk && g.autoLinked[d]) { _goalToggleDateCore(g, d); delete g.autoLinked[d]; changed = true; }
    });
    if (changed) { try { save(); renderGoals(); } catch (e) {} }
  };

  // ---------- 👥 Do'st bilan birga odat (server: shared_habits) ----------
  var SH = { list: null, at: 0, busy: false };
  function cloud() { return !!(S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.rpc); }
  function shLoad(force) {
    if (!cloud() || SH.busy || (!force && SH.list && Date.now() - SH.at < 60000)) return;
    SH.busy = true;
    supabase.rpc('sh_list').then(function (r) { SH.busy = false; SH.at = Date.now(); if (r.error) return; SH.list = r.data || []; shBonus(); renderShared(); }, function () { SH.busy = false; });
  }
  function together(h) {
    var me = {}, ot = {}, n = 0, d = today();
    (h.me || []).forEach(function (x) { me[x] = 1; }); (h.other || []).forEach(function (x) { ot[x] = 1; });
    if (!(me[d] && ot[d])) d = addDays(d, -1);
    while (me[d] && ot[d] && n < 400) { n++; d = addDays(d, -1); }
    return n;
  }
  // Ikkalangiz ham bugun belgilasangiz — bir marta +2 🪙
  function shBonus() {
    var d = today(); if (!S.shBonus) S.shBonus = {};
    (SH.list || []).forEach(function (h) {
      if (h.status !== 'active') return;
      var k = h.id + '|' + d;
      if (S.shBonus[k] || (h.me || []).indexOf(d) === -1 || (h.other || []).indexOf(d) === -1) return;
      S.shBonus[k] = 1; S.coins = (S.coins || 0) + 2; S.totalCoins = (S.totalCoins || 0) + 2;
      try { addTarixLog('in', '👥 ' + (h.emoji || '🤝') + ' ' + h.name + ' — ' + L('birga bajarildi', 'done together', 'вместе'), 2); } catch (e) {}
      toast('👥 ' + L('Ikkalangiz ham bajardingiz! +2 🪙', 'You both did it! +2 🪙', 'Вы оба сделали! +2 🪙'));
    });
    var cut = addDays(d, -10); Object.keys(S.shBonus).forEach(function (k) { if (k.split('|')[1] < cut) delete S.shBonus[k]; });
    try { save(); } catch (e) {}
  }
  function renderShared() {
    var list = document.getElementById('goals-list'); if (!list) return;
    var box = document.getElementById('gx-shared');
    if (!box) { box = document.createElement('div'); box.id = 'gx-shared'; list.parentNode.insertBefore(box, list.nextSibling); }
    if (!cloud()) { box.innerHTML = ''; return; }
    if (!SH.list) { shLoad(false); box.innerHTML = ''; return; }
    shLoad(false);
    if (!SH.list.length) { box.innerHTML = ''; return; }
    var d = today();
    box.innerHTML = '<div class="gx-lbl gx-sh-t">👥 ' + H(L("Do'stlar bilan odatlar", 'Habits with friends', 'Привычки с друзьями')) + '</div>' + SH.list.map(function (h) {
      var meOn = (h.me || []).indexOf(d) !== -1, otOn = (h.other || []).indexOf(d) !== -1, n = together(h);
      var pend = h.status === 'pending';
      return '<div class="gx-sh" data-id="' + H(h.id) + '"><div class="gx-sh-top"><span class="gx-sh-e">' + H(h.emoji || '🤝') + '</span><div class="gx-sh-n"><b>' + H(h.name) + '</b><small>' + H(L('bilan', 'with', 'с')) + ' ' + H(h.otherName || '—') + (n ? ' · 🔥 ' + n + ' ' + H(L('kun birga', 'days together', 'дн. вместе')) : '') + '</small></div>' +
        (pend ? (h.mine ? '<span class="gx-chip">⏳ ' + H(L('Javob kutilmoqda', 'Waiting', 'Ожидание')) + '</span>' : '<button type="button" class="x-btn sm" data-sh="acc">' + H(L('Qabul', 'Accept', 'Принять')) + '</button><button type="button" class="x-btn sm ghost" data-sh="dec">✕</button>')
          : '<button type="button" class="gx-btn" data-sh="end" title="' + H(L('Tugatish', 'End', 'Завершить')) + '">🏁</button>') + '</div>' +
        (pend ? '' : '<div class="gx-sh-row"><button type="button" class="gx-sh-me' + (meOn ? ' on' : '') + '" data-sh="chk">' + (meOn ? '✓ ' : '') + H(L('Men', 'Me', 'Я')) + '</button><span class="gx-sh-ot' + (otOn ? ' on' : '') + '">' + (otOn ? '✓ ' : '⏳ ') + H(h.otherName || '') + '</span>' + (meOn && otOn ? '<span class="gx-chip ok">+2 🪙</span>' : '') + '</div>') + '</div>';
    }).join('');
    box.onclick = function (e) {
      var b = e.target.closest('[data-sh]'); if (!b) return;
      var card = b.closest('[data-id]'), id = card && card.dataset.id, h = (SH.list || []).find(function (x) { return x.id === id; }); if (!h) return;
      var a = b.dataset.sh, call;
      if (a === 'chk') { var on = (h.me || []).indexOf(d) === -1; call = supabase.rpc('sh_check', { p_id: id, p_day: d, p_on: on }); if (on) { try { SFX.coin(); } catch (e2) {} } }
      else if (a === 'acc' || a === 'dec') call = supabase.rpc('sh_respond', { p_id: id, p_accept: a === 'acc' });
      else if (a === 'end') { if (!confirm(L('Bu birgalikdagi odat tugatilsinmi?', 'End this shared habit?', 'Завершить совместную привычку?'))) return; call = supabase.rpc('sh_end', { p_id: id }); }
      if (!call) return;
      b.disabled = true;
      call.then(function (r) { if (r.error || !(r.data && r.data.ok)) toast('⚠️ ' + ((r.error && r.error.message) || (r.data && r.data.error) || '?')); shLoad(true); });
    };
  }
  function shInvite(friendId, _ok) {
    if (!cloud()) { toast('🔐 ' + L('Avval akkauntga kiring', 'Sign in first', 'Сначала войдите')); return; }
    if (typeof friendId !== 'string') friendId = null;
    var fr = ((S.friends && S.friends.list) || []).filter(function (f) { return f && f.id; });
    if (!fr.length && !_ok && typeof window.friendsSyncFromCloud === 'function') { Promise.resolve(window.friendsSyncFromCloud()).then(function () { shInvite(friendId, 1); }, function () { shInvite(friendId, 1); }); return; }
    if (!fr.length) { toast('👥 ' + L("Avval do'st qo'shing", 'Add a friend first', 'Сначала добавьте друга')); try { openFriendsModal(); } catch (e) {} return; }
    var ov = modal('<h3 class="gx-h">👥 ' + H(L("Do'st bilan birga odat", 'Habit with a friend', 'Привычка с другом')) + '</h3><p class="gx-sub">' + H(L("Ikkalangiz har kuni belgilaysiz. Ikkalangiz ham bajargan kun — har biringizga +2 🪙 va umumiy 🔥 streak.", "You both check in daily. On days you both do it — +2 🪙 each and a shared 🔥 streak.", 'Отмечаете оба каждый день. Если оба сделали — +2 🪙 каждому и общая 🔥 серия.')) + '</p>' +
      '<label class="gx-dl">' + H(L("Do'st", 'Friend', 'Друг')) + '<select class="x-in" id="gx-shf">' + fr.map(function (f) { return '<option value="' + H(f.id) + '">' + H(f.name || '—') + '</option>'; }).join('') + '</select></label>' +
      '<div class="gmx-row"><input class="x-in" id="gx-she" maxlength="4" value="🤝" style="max-width:64px;text-align:center"><input class="x-in" id="gx-shn" maxlength="80" placeholder="' + H(L('Masalan: har kuni 20 daqiqa ingliz tili', 'e.g. 20 min of English daily', 'напр. 20 минут английского')) + '"></div>' +
      '<div class="gx-acts"><button type="button" class="x-btn" data-ok>' + H(L('Taklif yuborish', 'Send invite', 'Пригласить')) + '</button></div>');
    if (friendId) { try { ov.querySelector('#gx-shf').value = friendId; } catch (e) {} }
    ov.querySelector('[data-ok]').onclick = function () {
      var nm = String(ov.querySelector('#gx-shn').value || '').trim(); if (!nm) { ov.querySelector('#gx-shn').focus(); return; }
      var bb = this; bb.disabled = true;
      supabase.rpc('sh_invite', { p_friend: ov.querySelector('#gx-shf').value, p_name: nm, p_emoji: ov.querySelector('#gx-she').value || '🤝' }).then(function (r) {
        bb.disabled = false;
        if (r.error || !(r.data && r.data.ok)) { var er = (r.error && r.error.message) || (r.data && r.data.error); toast('⚠️ ' + (er === 'limit' ? L("Ko'pi bilan 10 ta birgalikdagi odat", 'Up to 10 shared habits', 'Не больше 10') : er)); return; }
        ov._close(); toast('📨 ' + L('Taklif yuborildi', 'Invite sent', 'Приглашение отправлено')); shLoad(true); try { window.dispatchEvent(new Event('lud-challenges')); } catch (e) {}
      });
    };
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && document.documentElement.getAttribute('data-tab') === 'goals') shLoad(true); });
  // ⚔️ Challenge markazi uchun (Do'stlar → Chorlov)
  window.xShInvite = shInvite;
  window.xShared = { get: function () { return SH.list; }, load: function (force) { if (!SH.list || force) { SH.at = 0; } shLoad(true); }, at: function () { return SH.at; } };
  var _shRender = renderShared;
  renderShared = function () { _shRender(); try { window.dispatchEvent(new Event('lud-challenges-data')); } catch (e) {} };
})();

// ============================================================
// 🍅 POMODORO v2 — kunlik maqsad, reja, sessiya izohi/baho, chalg'ish
// sabablari, server alarm, do'stlar fokusda, yutuqlar, kengaytirilgan
// statistika, shovqin mikseri, tanaffus mashqlari, presetlar, CSV.
// ============================================================
(function () {
  'use strict';
  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function cloud() { return !!(S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.rpc); }
  function logs() { try { return window.pomoGetLogs ? window.pomoGetLogs() : []; } catch (e) { return []; } }
  function sets() { try { return window.pomoGetSettingsObj ? window.pomoGetSettingsObj() : {}; } catch (e) { return {}; } }
  function fmtM(min) { min = Math.round(min); return min >= 60 ? Math.floor(min / 60) + L('s ', 'h ', 'ч ') + (min % 60) + L('d', 'm', 'м') : min + L(' daq', ' min', ' мин'); }
  function addCoins(n, desc) {
    S.coins = (S.coins || 0) + n; S.totalCoins = (S.totalCoins || 0) + n;
    try { addTarixLog('in', desc, n); } catch (e) {}
  }
  function sv() { try { save(); } catch (e) {} }
  function xModal(html, cls) {
    var ov = document.createElement('div');
    ov.className = 'x-ov';
    ov.innerHTML = '<div class="x-box ' + (cls || '') + '"><button class="x-close" aria-label="close">✕</button>' + html + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180); };
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.x-close').onclick = close;
    ov._close = close;
    return ov;
  }
  function minsOn(ds) { var m = 0; logs().forEach(function (l) { if (l.date === ds) m += (l.durationMs || 0) / 60000; }); return m; }
  function liveMin() { var a = window.pomoActiveAct && window.pomoActiveAct(); if (!a || !a.running || !a.sessionStartAt) return 0; return Math.max(0, ((a.elapsedMs || 0) - (a.sessionBaseElapsed || 0)) / 60000); }
  function goalMin() { var g = parseInt(sets().dailyGoalMin, 10); return g > 0 ? g : 0; }

  // ---------- 1. Kunlik maqsad bonusi + 13. reja ----------
  function checkGoal() {
    var g = goalMin(); if (!g) return;
    var d = dkey(); S.pomoGoalHit = S.pomoGoalHit || {};
    if (S.pomoGoalHit[d] || minsOn(d) < g) return;
    S.pomoGoalHit[d] = 1;
    var b = Math.min(10, 2 + Math.floor(g / 30));
    addCoins(b, '🍅 ' + L('Kunlik fokus maqsadi', 'Daily focus goal', 'Дневная цель фокуса'));
    sv(); try { toast('🎯 ' + L('Kunlik fokus maqsadi bajarildi! +', 'Daily focus goal reached! +', 'Дневная цель достигнута! +') + b + ' 🪙'); } catch (e) {}
    try { SFX.coin(); } catch (e) {}
  }
  function doneCount(d) { return ((S.pomoDone || {})[d || dkey()]) || 0; }
  function planFor(d) { return ((S.pomoPlan || {})[d || dkey()]) || 0; }
  function tomorrowKey() { var t = new Date(); t.setDate(t.getDate() + 1); return dkey(t); }

  function renderBar() {
    var panel = document.getElementById('pomo-manage-panel'); if (!panel) return;
    var bar = document.getElementById('pmx-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'pmx-bar';
      var list = document.getElementById('pomo-activity-list');
      panel.insertBefore(bar, list);
      bar.addEventListener('click', onBarClick);
    }
    var d = dkey(), g = goalMin(), m = minsOn(d) + liveMin();
    var pct = g ? Math.min(100, Math.round(m / g * 100)) : 0;
    var pl = planFor(d), dn = doneCount(d), plT = planFor(tomorrowKey());
    var h = '<div class="pmx-row">';
    h += '<div class="pmx-goal' + (g && m >= g ? ' hit' : '') + '" data-a="goal" role="button" tabindex="0"><div class="pmx-ring" style="--p:' + pct + '"><span>' + (g ? pct + '%' : '🎯') + '</span></div><div><b>' + L('Bugun', 'Today', 'Сегодня') + ': ' + fmtM(m) + '</b><small>' + (g ? L('Maqsad', 'Goal', 'Цель') + ': ' + fmtM(g) : L('Kunlik maqsad qo\'yish', 'Set a daily goal', 'Задать цель на день')) + '</small></div></div>';
    h += '<div class="pmx-plan" data-a="plan" role="button" tabindex="0"><b>🍅 ' + dn + (pl ? ' / ' + pl : '') + '</b><small>' + (pl ? L('Reja', 'Plan', 'План') : L('Reja yo\'q', 'No plan', 'Нет плана')) + (plT ? ' · ' + L('ertaga', 'tmrw', 'завтра') + ' ' + plT : '') + '</small>';
    if (pl) h += '<div class="pmx-dots">' + Array.from({ length: Math.min(pl, 16) }, function (_, i) { return '<i class="' + (i < dn ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    h += '</div></div>';
    h += '<div class="pmx-tools">'
      + '<button type="button" data-a="stats">📊 ' + L('Tahlil', 'Insights', 'Анализ') + '</button>'
      + '<button type="button" data-a="live">👥 ' + L('Do\'stlar', 'Friends', 'Друзья') + '<span id="pmx-live-n"></span></button>'
      + '<button type="button" data-a="noise">🎚 ' + L('Shovqin', 'Noise', 'Шум') + (NZ.on ? ' •' : '') + '</button>'
      + '<button type="button" data-a="ach">🏅 ' + L('Yutuqlar', 'Badges', 'Награды') + '</button></div>';
    bar.innerHTML = h;
  }
  function onBarClick(e) {
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.getAttribute('data-a');
    if (a === 'goal') askGoal();
    else if (a === 'plan') askPlan();
    else if (a === 'stats') openStats();
    else if (a === 'live') openLive();
    else if (a === 'noise') openNoise();
    else if (a === 'ach') openAch();
    else if (a === 'csv') exportCsv();
  }
  function askGoal() {
    var cur = goalMin();
    var ov = xModal('<h3>🎯 ' + L('Kunlik fokus maqsadi', 'Daily focus goal', 'Дневная цель фокуса') + '</h3><p class="pmx-muted">' + L('Maqsadga yetganda bonus tanga olasiz (kuniga 1 marta).', 'Reach it to earn bonus coins (once a day).', 'Достигните её — получите бонус (раз в день).') + '</p>'
      + '<div class="pmx-chips">' + [0, 30, 60, 90, 120, 180, 240].map(function (v) { return '<button type="button" data-v="' + v + '" class="' + (v === cur ? 'sel' : '') + '">' + (v ? fmtM(v) : L('O\'chiq', 'Off', 'Выкл')) + '</button>'; }).join('') + '</div>', 'pmx-box');
    ov.querySelector('.pmx-chips').onclick = function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      var s = sets(); s.dailyGoalMin = +b.getAttribute('data-v'); window.pomoPersistSettings(); ov._close(); renderBar(); checkGoal();
    };
  }
  function askPlan() {
    var d = dkey(), t = tomorrowKey();
    var ov = xModal('<h3>🍅 ' + L('Pomodoro rejasi', 'Pomodoro plan', 'План помодоро') + '</h3>'
      + '<label class="pmx-lbl">' + L('Bugun', 'Today', 'Сегодня') + ' <input type="number" min="0" max="30" id="pmx-pl-d" value="' + planFor(d) + '"></label>'
      + '<label class="pmx-lbl">' + L('Ertaga', 'Tomorrow', 'Завтра') + ' <input type="number" min="0" max="30" id="pmx-pl-t" value="' + planFor(t) + '"></label>'
      + '<p class="pmx-muted">' + L('Bugun bajarildi', 'Done today', 'Сделано сегодня') + ': ' + doneCount(d) + ' 🍅</p>'
      + '<div class="modal-actions"><button class="btn-save" id="pmx-pl-ok">' + L('Saqlash', 'Save', 'Сохранить') + '</button></div>', 'pmx-box');
    ov.querySelector('#pmx-pl-ok').onclick = function () {
      S.pomoPlan = S.pomoPlan || {};
      var a = Math.max(0, Math.min(30, parseInt(ov.querySelector('#pmx-pl-d').value, 10) || 0));
      var b = Math.max(0, Math.min(30, parseInt(ov.querySelector('#pmx-pl-t').value, 10) || 0));
      if (a) S.pomoPlan[d] = a; else delete S.pomoPlan[d];
      if (b) S.pomoPlan[t] = b; else delete S.pomoPlan[t];
      var keys = Object.keys(S.pomoPlan).sort(); while (keys.length > 60) delete S.pomoPlan[keys.shift()];
      sv(); ov._close(); renderBar();
    };
  }

  // ---------- 2/12. Sozlamalar: long break interval, presetlar ----------
  var PRESETS = [[25, 5, 15], [45, 10, 20], [50, 10, 20], [90, 20, 30]];
  window.xPomoSettingsOpen = function (s, running) {
    var panel = document.getElementById('pomo-settings-panel-timers'); if (!panel) return;
    var box = document.getElementById('pmx-set');
    if (!box) {
      box = document.createElement('div'); box.id = 'pmx-set';
      panel.insertBefore(box, panel.children[1] || null);
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pre]'); if (!b || b.disabled) return;
        var p = PRESETS[+b.getAttribute('data-pre')];
        ['pomo-set-work', 'pomo-set-short-break', 'pomo-set-long-break'].forEach(function (id, i) { var el = document.getElementById(id); if (el && !el.disabled) el.value = p[i]; });
      });
    }
    var le = parseInt(s.longEvery, 10) || 4;
    box.innerHTML = '<div class="pmx-presets">' + PRESETS.map(function (p, i) { return '<button type="button" data-pre="' + i + '"' + (running ? ' disabled' : '') + '>' + p[0] + '/' + p[1] + '</button>'; }).join('') + '</div>'
      + '<label class="pmx-lbl">' + L('Uzun tanaffus har', 'Long break every', 'Длинный перерыв каждые') + ' <select id="pmx-long-every">' + [2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option value="' + n + '"' + (n === le ? ' selected' : '') + '>' + n + ' 🍅</option>'; }).join('') + '</select></label>'
      + '<label class="pmx-lbl">' + L('Kunlik maqsad (daq)', 'Daily goal (min)', 'Цель на день (мин)') + ' <input type="number" id="pmx-goal-in" min="0" max="720" step="5" value="' + goalMin() + '"></label>';
  };
  window.xPomoSettingsSave = function (st) {
    var le = document.getElementById('pmx-long-every'), gi = document.getElementById('pmx-goal-in');
    if (le) st.longEvery = Math.max(2, Math.min(8, parseInt(le.value, 10) || 4));
    if (gi) st.dailyGoalMin = Math.max(0, Math.min(720, parseInt(gi.value, 10) || 0));
    setTimeout(function () { renderBar(); checkGoal(); }, 0);
  };

  // ---------- 3. Vazifa kartasida jami fokus vaqti ----------
  var _tfCache = null, _tfAt = 0;
  window.xTaskFocusChip = function (t) {
    if (!t || !t.pomoActId) return '';
    if (!_tfCache || Date.now() - _tfAt > 3000) {
      _tfCache = {}; _tfAt = Date.now();
      logs().forEach(function (l) { if (l.actId) _tfCache[l.actId] = (_tfCache[l.actId] || 0) + (l.durationMs || 0); });
    }
    var ms = _tfCache[t.pomoActId] || 0;
    if (ms < 60000) return '';
    return '<span class="tk-chip tk-chip-info" title="' + H(L('Shu vazifaga jami fokus', 'Total focus on this task', 'Всего фокуса на задаче')) + '">⏱ ' + fmtM(ms / 60000) + '</span>';
  };

  // ---------- 4/5. Sessiya izohi, baho, chalg'ish sababi ----------
  var REASONS = [['phone', '📱', L('Telefon', 'Phone', 'Телефон')], ['people', '🗣', L('Odam', 'People', 'Люди')], ['tired', '😴', L('Charchoq', 'Tired', 'Усталость')], ['food', '🍽', L('Ovqat', 'Food', 'Еда')], ['other', '…', L('Boshqa', 'Other', 'Другое')]];
  function reasonLbl(k) { var r = REASONS.filter(function (x) { return x[0] === k; })[0]; return r ? r[1] + ' ' + r[2] : k; }
  window.xPomoOnSession = function (plog, act) {
    setTimeout(function () { checkGoal(); checkAch(); renderBar(); }, 0);
    if (!plog || plog.durationMs < 5 * 60000) return;
    var interrupted = act && act.phase === 'work' && (act.cycleMs || 0) > 60000;
    setTimeout(function () { askReview(plog, interrupted); }, 250);
  };
  function askReview(plog, interrupted) {
    var h = '<h3>📝 ' + L('Sessiya yakuni', 'Session summary', 'Итог сессии') + '</h3><p class="pmx-muted">' + H(plog.actName) + ' · ' + fmtM(plog.durationMs / 60000) + '</p>'
      + '<div class="pmx-stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-r="' + n + '">★</button>'; }).join('') + '</div>';
    if (interrupted) h += '<div class="pmx-sub">' + L('Nega to\'xtatdingiz?', 'Why did you stop?', 'Почему остановились?') + '</div><div class="pmx-chips pmx-reasons">' + REASONS.map(function (r) { return '<button type="button" data-k="' + r[0] + '">' + r[1] + ' ' + r[2] + '</button>'; }).join('') + '</div>';
    h += '<textarea id="pmx-note" maxlength="200" rows="2" placeholder="' + H(L('Nima qildingiz? (ixtiyoriy)', 'What did you do? (optional)', 'Что сделали? (необязательно)')) + '"></textarea>'
      + '<div class="modal-actions"><button class="btn-cancel" id="pmx-rv-skip">' + L('O\'tkazish', 'Skip', 'Пропустить') + '</button><button class="btn-save" id="pmx-rv-ok">' + L('Saqlash', 'Save', 'Сохранить') + '</button></div>';
    var ov = xModal(h, 'pmx-box'), rating = 0, reason = null;
    ov.querySelector('.pmx-stars').onclick = function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return; rating = +b.getAttribute('data-r');
      ov.querySelectorAll('.pmx-stars button').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-r') <= rating); });
    };
    var rs = ov.querySelector('.pmx-reasons');
    if (rs) rs.onclick = function (e) { var b = e.target.closest('[data-k]'); if (!b) return; reason = b.getAttribute('data-k'); rs.querySelectorAll('button').forEach(function (x) { x.classList.toggle('sel', x === b); }); };
    ov.querySelector('#pmx-rv-skip').onclick = ov._close;
    ov.querySelector('#pmx-rv-ok').onclick = function () {
      var note = ov.querySelector('#pmx-note').value.trim();
      if (rating) plog.rating = rating;
      if (note) plog.note = note.slice(0, 200);
      if (reason) plog.reason = reason;
      try { window.pomoLogsChanged(); } catch (e) {}
      ov._close();
    };
  }

  // ---------- 6. Server alarm (ilova yopiq bo'lsa ham push/Telegram) ----------
  var _alarmT = null;
  function schedAlarm(act) {
    clearTimeout(_alarmT);
    _alarmT = setTimeout(function () {
      if (!cloud()) return;
      act = act || (window.pomoActiveAct && window.pomoActiveAct());
      if (!act || !act.running) { supabase.rpc('pomo_now_clear').then(function () {}, function () {}); return; }
      var left = window.pomoPhaseLeftMs(act);
      if (left < 5000) return;
      var brk = act.phase === 'break';
      supabase.rpc('pomo_now_set', {
        p_act: String(act.name || '').slice(0, 60), p_phase: brk ? 'break' : 'work',
        p_fire_at: new Date(Date.now() + left).toISOString(),
        p_title: brk ? L('☕ Tanaffus tugadi', '☕ Break is over', '☕ Перерыв окончен') : L('🍅 Pomodoro tugadi', '🍅 Pomodoro done', '🍅 Помодоро завершён'),
        p_body: brk ? L('Ishga qaytish vaqti: ', 'Back to work: ', 'Пора за работу: ') + (act.name || '') : (act.name || '') + ' — ' + L('tanaffus qiling', 'take a break', 'сделайте перерыв')
      }).then(function () {}, function () {});
    }, 400);
  }
  window.xPomoOnStart = function (act) { schedAlarm(act); setTimeout(renderBar, 0); };
  window.xPomoOnStop = function () { schedAlarm(null); setTimeout(renderBar, 0); };
  window.xPomoOnPhase = function (act, last, events) {
    var n = (events || []).filter(function (x) { return x === 'work-done'; }).length;
    if (n) {
      var d = dkey(); S.pomoDone = S.pomoDone || {}; S.pomoDone[d] = (S.pomoDone[d] || 0) + n;
      var ks = Object.keys(S.pomoDone).sort(); while (ks.length > 120) delete S.pomoDone[ks.shift()];
      sv();
      var pl = planFor(d);
      if (pl && S.pomoDone[d] === pl) { try { toast('🏁 ' + L('Bugungi Pomodoro rejasi bajarildi!', 'Today\'s pomodoro plan done!', 'План помодоро на сегодня выполнен!')); } catch (e) {} }
    }
    schedAlarm(act); renderBar(); syncBreak();
  };

  // ---------- 7. Do'stlar hozir fokusda ----------
  var LIVE = { list: [], at: 0 };
  function loadLive(cb) {
    if (!cloud()) { cb && cb(); return; }
    supabase.rpc('pomo_friends_live').then(function (r) {
      LIVE.list = (r && r.data) || []; LIVE.at = Date.now();
      var n = document.getElementById('pmx-live-n'); if (n) n.textContent = LIVE.list.length ? ' ' + LIVE.list.length : '';
      cb && cb();
    }, function () { cb && cb(); });
  }
  function openLive() {
    var ov = xModal('<h3>👥 ' + L('Hozir fokusda', 'Focusing now', 'Сейчас в фокусе') + '</h3><div id="pmx-live-list" class="pmx-muted">…</div>', 'pmx-box');
    loadLive(function () {
      var el = ov.querySelector('#pmx-live-list'); if (!el) return;
      if (!cloud()) { el.textContent = L('Akkauntga kiring', 'Sign in first', 'Войдите в аккаунт'); return; }
      if (!LIVE.list.length) { el.textContent = L('Hozir hech kim fokusda emas', 'Nobody is focusing right now', 'Сейчас никто не в фокусе'); return; }
      el.className = 'pmx-live';
      el.innerHTML = LIVE.list.map(function (f) {
        var m = Math.max(0, Math.round((new Date(f.until) - Date.now()) / 60000));
        return '<div class="pmx-live-it">' + (f.photo ? '<img src="' + H(f.photo) + '" alt="">' : '<span class="pmx-av">' + H((f.name || '?')[0]) + '</span>') + '<div><b>' + H(f.name) + '</b><small>' + (f.phase === 'break' ? '☕ ' : '🍅 ') + H(f.act || '') + ' · ' + m + L(' daq qoldi', ' min left', ' мин осталось') + '</small></div><button type="button" class="btn-save" data-join="' + H(f.act || 'Focus') + '">' + L('Qo\'shilish', 'Join', 'Присоединиться') + '</button></div>';
      }).join('');
      el.onclick = function (e) {
        var b = e.target.closest('[data-join]'); if (!b) return;
        joinFocus(b.getAttribute('data-join')); ov._close();
      };
    });
  }
  function joinFocus(name) {
    var acts = window.pomoGetActs ? window.pomoGetActs() : [];
    var a = window.pomoActiveAct && window.pomoActiveAct();
    if (a && a.running) { try { toast(L('Taymer allaqachon ishlayapti', 'Timer already running', 'Таймер уже идёт')); } catch (e) {} return; }
    var nm = '👥 ' + String(name).slice(0, 30), act = acts.filter(function (x) { return x.name === nm; })[0];
    if (!act) {
      act = { id: 'pomo_' + Date.now() + '_' + Math.floor(Math.random() * 1000), name: nm, limit: 120, elapsedMs: 0, cycleMs: 0, breakRemainingMs: 0, phase: 'work', running: false, lastTickAt: null, emoji: '👥', color: '#7C5CFC' };
      acts.push(act);
    }
    window.pomoStartOrResume(act.id);
    try { toast('🤝 ' + L('Birga fokus boshlandi', 'Focusing together', 'Фокус вместе начат')); } catch (e) {}
  }

  // ---------- 8. Yutuqlar ----------
  var ACH = [
    ['h10', '⏱', L('10 soat fokus', '10 focus hours', '10 часов фокуса'), 15],
    ['h50', '🔥', L('50 soat fokus', '50 focus hours', '50 часов фокуса'), 40],
    ['h100', '💎', L('100 soat fokus', '100 focus hours', '100 часов фокуса'), 80],
    ['s7', '📅', L('7 kun ketma-ket', '7-day streak', '7 дней подряд'), 20],
    ['s30', '🏆', L('30 kun ketma-ket', '30-day streak', '30 дней подряд'), 60],
    ['early', '🌅', L('Erta qush (07:00 dan oldin)', 'Early bird (before 7:00)', 'Ранняя пташка (до 7:00)'), 10],
    ['deep', '🧠', L('2 soatlik uzluksiz sessiya', '2h unbroken session', 'Сессия 2 часа без перерыва'), 15]
  ];
  function achStats() {
    var tot = 0, days = {}, early = false, deep = false;
    logs().forEach(function (l) {
      tot += (l.durationMs || 0); if (l.date) days[l.date] = 1;
      if (l.startAt && new Date(l.startAt).getHours() < 7 && l.durationMs >= 10 * 60000) early = true;
      if (l.durationMs >= 120 * 60000) deep = true;
    });
    var best = 0, run = 0, prev = null;
    Object.keys(days).sort().forEach(function (d) {
      if (prev) { var p = new Date(prev + 'T00:00:00'); p.setDate(p.getDate() + 1); run = dkey(p) === d ? run + 1 : 1; } else run = 1;
      best = Math.max(best, run); prev = d;
    });
    return { h: tot / 3600000, best: best, early: early, deep: deep };
  }
  function achOk(id, st) { return { h10: st.h >= 10, h50: st.h >= 50, h100: st.h >= 100, s7: st.best >= 7, s30: st.best >= 30, early: st.early, deep: st.deep }[id]; }
  function checkAch() {
    var st = achStats(), got = S.pomoAch = S.pomoAch || {}, ch = false;
    ACH.forEach(function (a) {
      if (got[a[0]] || !achOk(a[0], st)) return;
      got[a[0]] = Date.now(); ch = true;
      addCoins(a[3], '🏅 ' + a[2]);
      try { toast('🏅 ' + a[1] + ' ' + a[2] + ' +' + a[3] + ' 🪙'); } catch (e) {}
    });
    if (ch) { sv(); try { SFX.coin(); } catch (e) {} }
  }
  function openAch() {
    checkAch();
    var st = achStats(), got = S.pomoAch || {};
    xModal('<h3>🏅 ' + L('Pomodoro yutuqlari', 'Pomodoro badges', 'Награды помодоро') + '</h3><p class="pmx-muted">' + L('Jami', 'Total', 'Всего') + ': ' + st.h.toFixed(1) + L(' soat', ' h', ' ч') + ' · ' + L('eng uzun seriya', 'best streak', 'лучшая серия') + ': ' + st.best + '</p><div class="pmx-ach">'
      + ACH.map(function (a) { return '<div class="pmx-ach-it' + (got[a[0]] ? ' on' : '') + '"><span>' + a[1] + '</span><b>' + H(a[2]) + '</b><small>' + (got[a[0]] ? '✓' : '+' + a[3] + ' 🪙') + '</small></div>'; }).join('') + '</div>', 'pmx-box');
  }

  // ---------- 9. Kengaytirilgan statistika ----------
  function openStats() {
    var L2 = logs(), heat = [], i, j, mx = 0;
    for (i = 0; i < 7; i++) { heat.push([]); for (j = 0; j < 24; j++) heat[i].push(0); }
    var now = new Date(), wk0 = new Date(now); wk0.setHours(0, 0, 0, 0); wk0.setDate(wk0.getDate() - ((wk0.getDay() + 6) % 7));
    var pw0 = new Date(wk0); pw0.setDate(pw0.getDate() - 7);
    var thisW = 0, lastW = 0, share = {}, reasons = {}, rs = 0, rn = 0, notes = [];
    var since = Date.now() - 90 * 864e5;
    L2.forEach(function (l) {
      var st = l.startAt || 0, ms = l.durationMs || 0;
      if (st >= since) { var dt = new Date(st); var wd = (dt.getDay() + 6) % 7; heat[wd][dt.getHours()] += ms / 60000; }
      if (st >= wk0.getTime()) thisW += ms; else if (st >= pw0.getTime()) lastW += ms;
      if (st >= since) share[l.actName || '?'] = (share[l.actName || '?'] || 0) + ms;
      if (l.reason) reasons[l.reason] = (reasons[l.reason] || 0) + 1;
      if (l.rating) { rs += l.rating; rn++; }
      if (l.note) notes.push(l);
    });
    heat.forEach(function (r) { r.forEach(function (v) { mx = Math.max(mx, v); }); });
    var wd = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(function (x, k) { return L(x, ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][k], ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][k]); });
    var hm = '<div class="pmx-heat"><span></span>' + Array.from({ length: 24 }, function (_, h) { return '<span class="pmx-hh">' + (h % 3 ? '' : h) + '</span>'; }).join('');
    heat.forEach(function (r, k) { hm += '<span class="pmx-hd">' + wd[k] + '</span>' + r.map(function (v, h) { return '<i style="--a:' + (mx ? (v / mx).toFixed(2) : 0) + '" title="' + wd[k] + ' ' + h + ':00 · ' + Math.round(v) + 'm"></i>'; }).join(''); });
    hm += '</div>';
    var tot = Object.keys(share).reduce(function (a, k) { return a + share[k]; }, 0);
    var sh = Object.keys(share).sort(function (a, b) { return share[b] - share[a]; }).slice(0, 6).map(function (k) { var p = Math.round(share[k] / tot * 100); return '<div class="pmx-bar-it"><span>' + H(k) + '</span><div><i style="width:' + p + '%"></i></div><b>' + p + '%</b></div>'; }).join('');
    var diff = lastW ? Math.round((thisW - lastW) / lastW * 100) : null;
    var rsn = Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a]; }).map(function (k) { return '<span class="pmx-tag">' + reasonLbl(k) + ' ×' + reasons[k] + '</span>'; }).join('');
    var h = '<h3>📊 ' + L('Fokus tahlili', 'Focus insights', 'Анализ фокуса') + '</h3>'
      + '<div class="pmx-kpis"><div><b>' + fmtM(thisW / 60000) + '</b><small>' + L('Shu hafta', 'This week', 'Эта неделя') + '</small></div><div><b>' + fmtM(lastW / 60000) + '</b><small>' + L('O\'tgan hafta', 'Last week', 'Прошлая неделя') + '</small></div><div><b class="' + (diff == null ? '' : diff >= 0 ? 'up' : 'down') + '">' + (diff == null ? '—' : (diff >= 0 ? '▲ ' : '▼ ') + Math.abs(diff) + '%') + '</b><small>' + L('Farq', 'Change', 'Изменение') + '</small></div><div><b>' + (rn ? (rs / rn).toFixed(1) + ' ★' : '—') + '</b><small>' + L('O\'rtacha baho', 'Avg rating', 'Средняя оценка') + '</small></div></div>'
      + '<div class="pmx-sub">🕒 ' + L('Qaysi soatlarda fokus (90 kun)', 'When you focus (90 days)', 'Когда вы в фокусе (90 дней)') + '</div>' + (mx ? hm : '<p class="pmx-muted">—</p>')
      + '<div class="pmx-sub">📁 ' + L('Faoliyatlar ulushi', 'Activity share', 'Доля занятий') + '</div>' + (sh || '<p class="pmx-muted">—</p>')
      + '<div class="pmx-sub">📵 ' + L('Chalg\'ituvchilar', 'Distractions', 'Отвлечения') + '</div>' + (rsn ? '<div class="pmx-tags">' + rsn + '</div>' : '<p class="pmx-muted">—</p>')
      + (notes.length ? '<div class="pmx-sub">📝 ' + L('Oxirgi izohlar', 'Recent notes', 'Последние заметки') + '</div><div class="pmx-notes">' + notes.slice(-5).reverse().map(function (l) { return '<div><small>' + H(l.date) + ' · ' + H(l.actName) + (l.rating ? ' · ' + l.rating + '★' : '') + '</small>' + H(l.note) + '</div>'; }).join('') + '</div>' : '');
    xModal(h, 'pmx-box pmx-wide');
  }

  // ---------- 10. Shovqin mikseri (WebAudio) ----------
  var NZ = { ctx: null, nodes: {}, vol: { white: 0, pink: 0, brown: 0 }, on: false };
  try { var _nv = JSON.parse(localStorage.getItem('ludPomoNoise') || 'null'); if (_nv) NZ.vol = Object.assign(NZ.vol, _nv); } catch (e) {}
  function noiseBuf(ctx, kind) {
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }
  function noiseApply() {
    var any = Object.keys(NZ.vol).some(function (k) { return NZ.vol[k] > 0; });
    if (any && !NZ.ctx) { try { NZ.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (!NZ.ctx) return;
    Object.keys(NZ.vol).forEach(function (k) {
      var v = NZ.vol[k], n = NZ.nodes[k];
      if (v > 0 && !n) {
        var src = NZ.ctx.createBufferSource(); src.buffer = noiseBuf(NZ.ctx, k); src.loop = true;
        var g = NZ.ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(NZ.ctx.destination); src.start();
        n = NZ.nodes[k] = { src: src, g: g };
      }
      if (n) n.g.gain.setTargetAtTime(v / 100 * 0.6, NZ.ctx.currentTime, 0.1);
      if (n && v <= 0) { (function (nn, kk) { setTimeout(function () { if (NZ.vol[kk] <= 0) { try { nn.src.stop(); } catch (e) {} delete NZ.nodes[kk]; } }, 400); })(n, k); }
    });
    if (NZ.ctx.state === 'suspended') NZ.ctx.resume();
    NZ.on = any;
    try { localStorage.setItem('ludPomoNoise', JSON.stringify(NZ.vol)); } catch (e) {}
  }
  function openNoise() {
    var lb = { white: L('Oq shovqin', 'White noise', 'Белый шум'), pink: L('Pushti shovqin', 'Pink noise', 'Розовый шум'), brown: L('Jigarrang shovqin', 'Brown noise', 'Коричневый шум') };
    var ov = xModal('<h3>🎚 ' + L('Shovqin mikseri', 'Noise mixer', 'Микшер шума') + '</h3><p class="pmx-muted">' + L('Fokus uchun fon shovqinlarini aralashtiring.', 'Mix background noise for focus.', 'Смешайте фоновый шум для фокуса.') + '</p>'
      + Object.keys(lb).map(function (k) { return '<label class="pmx-nz">' + lb[k] + '<input type="range" min="0" max="100" data-k="' + k + '" value="' + NZ.vol[k] + '"></label>'; }).join('')
      + '<div class="modal-actions"><button class="btn-cancel" id="pmx-nz-off">' + L('Hammasini o\'chirish', 'Mute all', 'Выключить всё') + '</button></div>', 'pmx-box');
    ov.addEventListener('input', function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; NZ.vol[k] = +e.target.value; noiseApply(); });
    ov.querySelector('#pmx-nz-off').onclick = function () { Object.keys(NZ.vol).forEach(function (k) { NZ.vol[k] = 0; }); ov.querySelectorAll('input').forEach(function (x) { x.value = 0; }); noiseApply(); renderBar(); };
    var oc = ov._close; ov._close = function () { oc(); renderBar(); };
    ov.querySelector('.x-close').onclick = ov._close;
  }

  // ---------- 11. Tanaffus mashqlari ----------
  var EX = [
    ['🧘', L('Nafas: 4 s olib, 4 s ushlab, 4 s chiqaring', 'Breathe: in 4s, hold 4s, out 4s', 'Дыхание: вдох 4с, пауза 4с, выдох 4с'), 1],
    ['🙆', L('Yelka va bo\'yinni aylantiring (10 marta)', 'Roll shoulders and neck (10×)', 'Вращайте плечами и шеей (10×)')],
    ['👀', L('20-20-20: 20 s davomida 6 m uzoqqa qarang', '20-20-20: look 6 m away for 20 s', '20-20-20: смотрите вдаль 20 с')],
    ['💧', L('Bir stakan suv iching', 'Drink a glass of water', 'Выпейте стакан воды')],
    ['🚶', L('Turib, 1-2 daqiqa yuring', 'Stand up and walk 1–2 min', 'Встаньте и пройдитесь 1–2 мин')],
    ['🤸', L('10 ta o\'tirib-turish', '10 squats', '10 приседаний')],
    ['✋', L('Bilak va barmoqlarni cho\'zing', 'Stretch wrists and fingers', 'Растяните запястья и пальцы')]
  ];
  var _exIdx = -1;
  function syncBreak() {
    var hero = document.getElementById('pomo-hero'); if (!hero) return;
    var a = window.pomoActiveAct && window.pomoActiveAct();
    var on = !!(a && a.running && a.phase === 'break');
    var el = document.getElementById('pmx-break');
    if (!on) { if (el) el.remove(); _exIdx = -1; return; }
    if (el) return;
    if (_exIdx < 0) _exIdx = Math.floor(Math.random() * EX.length);
    var ex = EX[_exIdx];
    el = document.createElement('div'); el.id = 'pmx-break';
    el.innerHTML = (ex[2] ? '<div class="pmx-breath"><i></i></div>' : '<span class="pmx-ex-ic">' + ex[0] + '</span>') + '<div><b>' + L('Tanaffus mashqi', 'Break exercise', 'Упражнение') + '</b><small>' + H(ex[1]) + '</small></div><button type="button" aria-label="next">↻</button>';
    el.querySelector('button').onclick = function () { _exIdx = (_exIdx + 1) % EX.length; el.remove(); syncBreak(); };
    var ctr = document.getElementById('pomo-hero-controls');
    hero.insertBefore(el, ctr ? ctr.nextSibling : null);
  }

  // ---------- 14. CSV ----------
  function exportCsv() {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['date', 'activity', 'start', 'end', 'minutes', 'rating', 'reason', 'note']];
    logs().slice().sort(function (a, b) { return (a.startAt || 0) - (b.startAt || 0); }).forEach(function (l) {
      rows.push([l.date, l.actName, l.startAt ? new Date(l.startAt).toISOString() : '', l.stopAt ? new Date(l.stopAt).toISOString() : '', ((l.durationMs || 0) / 60000).toFixed(1), l.rating || '', l.reason || '', l.note || '']);
    });
    var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pomodoro-' + dkey() + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.xCsvPomo = exportCsv;

  // ---------- ishga tushirish ----------
  function tick() {
    var ov = document.getElementById('pomo-modal-overlay');
    if (ov && ov.classList.contains('open')) { renderBar(); syncBreak(); if (Date.now() - LIVE.at > 60000) loadLive(); }
    checkGoal();
  }
  function init() {
    renderBar(); checkAch();
    setInterval(tick, 15000);
    var mo = document.getElementById('pomo-modal-overlay');
    if (mo && window.MutationObserver) new MutationObserver(function () { if (mo.classList.contains('open')) { renderBar(); syncBreak(); loadLive(); } }).observe(mo, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { var a = window.pomoActiveAct && window.pomoActiveAct(); if (a && a.running) schedAlarm(a); }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();

// ============================================================
// ⚔️ CHALLENGE MARKAZI — Do'stlar → Chorlov bo'limida ilovadagi barcha
// challenge'lar bir joyda: vazifa duellari, Focusgate (ekran/fokus),
// 🍅 Pomodoro, 🤝 birgalikdagi odatlar (Goals), 🎉 party musobaqasi.
// ============================================================
(function () {
  'use strict';
  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  function cloud() { return !!(S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.rpc); }
  function FG() { return window.LUFocusgate || null; }
  function today_() { try { return today(); } catch (e) { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); } }
  function fmtM(m) { m = Math.round(m || 0); return m >= 60 ? Math.floor(m / 60) + L('s ', 'h ', 'ч ') + (m % 60) + L('d', 'm', 'м') : m + L(' daq', ' min', ' мин'); }
  var CH = { fg: [], st: {}, at: 0, busy: false, filter: 'all' };
  try { CH.filter = localStorage.getItem('ludChxFilter') || 'all'; } catch (e) {}

  // ---------- do'stlar ro'yxati har doim yangi bo'lsin ----------
  var _frAt = 0;
  function withFriends(cb) {
    var has = ((S.friends || {}).list || []).length;
    if (!cloud() || typeof window.friendsSyncFromCloud !== 'function' || (has && Date.now() - _frAt < 300000)) { cb(); return; }
    _frAt = Date.now();
    Promise.resolve(window.friendsSyncFromCloud()).then(cb, cb);
  }
  window.chxWithFriends = withFriends;

  // ---------- ma'lumot ----------
  function load(force, cb) {
    if (!cloud() || CH.busy || (!force && Date.now() - CH.at < 60000)) { cb && cb(); return; }
    CH.busy = true;
    supabase.from('fg_challenges').select('*').gte('end_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(30).then(function (r) {
      var list = (r && r.data) || [];
      return Promise.all(list.map(function (c) { return supabase.rpc('fg_challenge_stats', { p_id: c.id }).then(function (x) { CH.st[c.id] = x.data || []; }, function () {}); })).then(function () { CH.fg = list; });
    }).then(function () { CH.busy = false; CH.at = Date.now(); try { if (window.xShared) window.xShared.load(); } catch (e) {} render(); badge(); cb && cb(); }, function () { CH.busy = false; cb && cb(); });
  }
  function fgSrc(c) { var m = FG() ? FG().chMetric(c) : (c.mode === 'pomo' ? 'pomo' : c.metric); return m === 'pomo' ? 'pomo' : 'fg'; }
  function fgPending(c) { var st = CH.st[c.id] || [], me = st.filter(function (p) { return p.me; })[0]; return !!(me && !me.accepted && c.owner !== S.cloudUserId && new Date(c.end_at) > new Date()); }
  function shList() { try { return (window.xShared && window.xShared.get()) || []; } catch (e) { return []; } }
  function pendingItems() {
    var a = [];
    CH.fg.forEach(function (c) { if (fgPending(c)) a.push({ k: 'fg:' + c.id }); });
    shList().forEach(function (h) { if (h.status === 'pending' && !h.mine) a.push({ k: 'sh:' + h.id }); });
    return a;
  }

  // ---------- badge ----------
  function unseen() {
    var F = S.friends || {}; F.seenChxIds = F.seenChxIds || {};
    return pendingItems().filter(function (x) { return !F.seenChxIds[x.k]; }).length;
  }
  function badge() {
    var el = document.getElementById('friends-challenge-badge'); if (!el) return;
    var F = S.friends || {};
    var base = (F.challengesIncoming || []).filter(function (c) { return !(F.seenChallengeIds || {})[c.id]; }).length;
    var n = base + unseen();
    el.textContent = n; el.style.display = n ? '' : 'none';
  }
  if (typeof window.updateFriendsBadges === 'function') {
    var _ub = window.updateFriendsBadges;
    window.updateFriendsBadges = function () { var r = _ub.apply(this, arguments); try { badge(); } catch (e) {} return r; };
  }
  if (typeof window.friendsShowTab === 'function') {
    var _st = window.friendsShowTab;
    window.friendsShowTab = function (tab) {
      var r = _st.apply(this, arguments);
      if (tab === 'challenge') {
        var F = S.friends || {}; F.seenChxIds = F.seenChxIds || {};
        pendingItems().forEach(function (x) { F.seenChxIds[x.k] = true; });
        try { save(); } catch (e) {}
        render(); badge(); load(false); withFriends(function () {});
        try { if (FG() && FG().loadSocial) FG().loadSocial(); } catch (e) {} // tugaganlarni hisoblab mukofot beradi
      }
      return r;
    };
  }

  // ---------- yangi challenge turlari ----------
  var TYPES = [
    ['task', '⚔️', function () { return L('Vazifa dueli', 'Task duel', 'Дуэль задач'); }, function () { return L('Bajarish foizi yoki XP · 💎 tikish', 'Completion % or XP · 💎 stake', '% выполнения или XP · ставка 💎'); }],
    ['screen', '📱', function () { return L('Ekran vaqti', 'Screen time', 'Экранное время'); }, function () { return L('Kim kamroq telefon/kompyuter', 'Who uses devices less', 'Кто меньше в устройствах'); }],
    ['focus', '🎯', function () { return L('Fokus sessiyalar', 'Focus sessions', 'Фокус-сессии'); }, function () { return L('Focusgate fokus daqiqalari', 'Focusgate focus minutes', 'Минуты фокуса Focusgate'); }],
    ['pomo', '🍅', function () { return 'Pomodoro'; }, function () { return L('Kim ko\'proq Pomodoro qiladi', 'Who does more Pomodoro', 'Кто больше помодоро'); }],
    ['habit', '🤝', function () { return L('Birga odat', 'Habit together', 'Привычка вместе'); }, function () { return L('Har kuni ikkalangiz belgilaysiz', 'You both check in daily', 'Оба отмечаете каждый день'); }],
    ['party', '🎉', function () { return L('Party musobaqasi', 'Party contest', 'Конкурс пати'); }, function () { return L('Guruh ichida reyting', 'Leaderboard in your party', 'Рейтинг в пати'); }]
  ];
  function startType(k, friendId) {
    try { SFX.click(); } catch (e) {}
    if (k !== 'task' && k !== 'party' && !cloud()) { toast('🔐 ' + L('Avval akkauntga kiring', 'Sign in first', 'Сначала войдите')); return; }
    if (k === 'party') { window.friendsShowTab('party'); return; }
    withFriends(function () {
      if (k === 'task') {
        try { friendsOpenNewChallenge(); } catch (e) {}
        if (friendId) { var sel = document.getElementById('fnc-friend-select'); if (sel) sel.value = friendId; }
      } else if (k === 'habit') {
        if (window.xShInvite) window.xShInvite(friendId || null);
      } else {
        if (FG() && FG().openChallenge) FG().openChallenge({ metric: k, friendId: friendId });
        else toast('⏳');
      }
    });
  }
  window.chxStart = startType;
  function typesHtml(fid) {
    return '<div class="chx-types">' + TYPES.map(function (t) { return '<button type="button" class="chx-type" data-chx-new="' + t[0] + '"' + (fid ? ' data-fid="' + H(fid) + '"' : '') + '><span>' + t[1] + '</span><b>' + H(t[2]()) + '</b><small>' + H(t[3]()) + '</small></button>'; }).join('') + '</div>';
  }
  window.chxPick = function (friendId) {
    var ov = document.createElement('div'); ov.className = 'x-ov';
    var f = friendId && typeof friendsFindPersonById === 'function' ? friendsFindPersonById(friendId) : null;
    ov.innerHTML = '<div class="x-box chx-pick"><button class="x-close" aria-label="close">✕</button><h3 class="chx-h">⚔️ ' + H(L('Challenge turi', 'Challenge type', 'Тип челленджа')) + (f ? ' · ' + H(f.name) : '') + '</h3>' + typesHtml(friendId) + '</div>';
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('open'); });
    var close = function () { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 180); };
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('.x-close')) { close(); return; }
      var b = e.target.closest('[data-chx-new]'); if (!b) return;
      close(); try { closeFriendProfileModal(); } catch (er) {}
      startType(b.getAttribute('data-chx-new'), b.getAttribute('data-fid'));
    });
  };

  // ---------- chizish ----------
  function av(p) {
    var ph = p.photo || p.otherPhoto || '';
    if (/^https?:\/\//.test(ph) || /^data:image\//.test(ph)) return '<span class="chx-av" style="background-image:url(' + H(ph) + ')"></span>';
    return '<span class="chx-av">' + H(String(p.name || p.otherName || '?').charAt(0).toUpperCase()) + '</span>';
  }
  function timeBar(c) {
    var s = new Date(c.start_at || c.created_at).getTime(), e = new Date(c.end_at).getTime(), n = Date.now();
    var p = Math.max(0, Math.min(100, Math.round((n - s) / Math.max(1, e - s) * 100)));
    var left = Math.max(0, Math.ceil((e - n) / 864e5));
    return '<div class="chx-time"><i style="width:' + p + '%"></i></div><small class="chx-left">' + (e < n ? L('Tugadi', 'Ended', 'Завершён') : '⏳ ' + left + ' ' + L('kun qoldi', 'days left', 'дн. осталось')) + '</small>';
  }
  function fgCard(c) {
    var fg = FG(), st = (CH.st[c.id] || []).slice(), m = fgSrc(c) === 'pomo' ? 'pomo' : c.metric;
    var ended = new Date(c.end_at) < new Date(), pend = fgPending(c), mine = c.owner === S.cloudUserId;
    var w = fg ? fg.chWinner(c, st) : null;
    var val = function (p) { return m === 'pomo' ? p.pomo_min || 0 : m === 'focus' ? p.focus_min || 0 : (p.days ? p.screen_min : 1e9); };
    st.sort(function (a, b) { return m === 'screen' ? val(a) - val(b) : val(b) - val(a); });
    var mx = Math.max.apply(null, st.map(function (p) { var v = val(p); return v >= 1e9 ? 0 : v; }).concat([1]));
    var src = m === 'pomo' ? ['🍅', 'Pomodoro'] : m === 'focus' ? ['🎯', L('Fokus', 'Focus', 'Фокус')] : ['📱', L('Ekran vaqti', 'Screen time', 'Экран')];
    var ttl = fg ? fg.chTitle(c) : (c.title || src[1]);
    var res = ended ? (w === 'all' ? '✅ ' + L('Hamma uddaladi', 'Everyone made it', 'Все справились') : w === 'tie' ? '🤝 ' + L('Durang', 'Tie', 'Ничья') : w ? '🏆 ' + H(((st.filter(function (p) { return p.id === w; })[0]) || {}).name || '') + (w === S.cloudUserId ? ' (+20 🪙)' : '') : L('Natija yo\'q', 'No result', 'Нет результата')) : '';
    var h = '<div class="chx-card' + (pend ? ' pend' : '') + (ended ? ' ended' : '') + '"><div class="chx-top"><span class="chx-src">' + src[0] + ' ' + H(src[1]) + '</span><span class="chx-kind">' + (c.kind === 'duel' ? '⚔️ Duel' : '👥 ' + L('Guruh', 'Group', 'Группа')) + '</span></div>'
      + '<b class="chx-t">' + H(ttl) + '</b>' + (c.kind === 'group' && c.goal_min ? '<small class="chx-goal">🎯 ' + fmtM(c.goal_min) + (m === 'screen' ? L(' / kun', ' / day', ' / день') : '') + '</small>' : '') + timeBar(c);
    h += '<div class="chx-ppl">' + st.map(function (p, i) {
      var v = val(p), pct = v >= 1e9 ? 0 : Math.round(v / mx * 100);
      if (c.kind === 'group' && c.goal_min) pct = m === 'screen' ? Math.min(100, Math.round((p.max_min || 0) / c.goal_min * 100)) : Math.min(100, Math.round(v / c.goal_min * 100));
      return '<div class="chx-p' + (p.me ? ' me' : '') + '">' + av(p) + '<span class="chx-pn">' + (i === 0 && !ended && c.kind === 'duel' && v < 1e9 && v > 0 ? '👑 ' : '') + H(p.me ? L('Siz', 'You', 'Вы') : p.name || '—') + (p.accepted || p.id === c.owner ? '' : ' ⏳') + '</span><div class="chx-pb"><i style="width:' + pct + '%"></i></div><b>' + H(fg ? fg.chValTxt(c, p) : fmtM(v)) + '</b></div>';
    }).join('') + '</div>';
    if (res) h += '<div class="chx-res">' + res + '</div>';
    h += '<div class="chx-acts">';
    if (pend) h += '<button type="button" class="friend-req-btn accept" data-chx="fgacc" data-id="' + c.id + '">🤝 ' + H(L('Qabul qilish', 'Accept', 'Принять')) + '</button>';
    if (!ended) h += '<button type="button" class="friend-req-btn decline" data-chx="fgleave" data-id="' + c.id + '">' + H(mine ? L('Bekor qilish', 'Cancel', 'Отменить') : pend ? L('Rad etish', 'Decline', 'Отклонить') : L('Chiqish', 'Leave', 'Выйти')) + '</button>';
    h += '</div></div>';
    return h;
  }
  function shStreak(h) {
    var me = {}, ot = {}, n = 0, d = today_();
    (h.me || []).forEach(function (x) { me[x] = 1; }); (h.other || []).forEach(function (x) { ot[x] = 1; });
    var dt = new Date(d + 'T00:00:00'); var k = function () { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); };
    if (!(me[d] && ot[d])) dt.setDate(dt.getDate() - 1);
    while (me[k()] && ot[k()] && n < 400) { n++; dt.setDate(dt.getDate() - 1); }
    return n;
  }
  function shCard(h) {
    var d = today_(), meOn = (h.me || []).indexOf(d) !== -1, otOn = (h.other || []).indexOf(d) !== -1, pend = h.status === 'pending', n = shStreak(h);
    var s = '<div class="chx-card' + (pend && !h.mine ? ' pend' : '') + '"><div class="chx-top"><span class="chx-src">🤝 ' + H(L('Birga odat', 'Habit together', 'Привычка вместе')) + '</span>' + (n ? '<span class="chx-kind">🔥 ' + n + '</span>' : '') + '</div>'
      + '<b class="chx-t">' + H(h.emoji || '🤝') + ' ' + H(h.name) + '</b><small class="chx-goal">' + H(L('bilan', 'with', 'с')) + ' ' + H(h.otherName || '—') + '</small>';
    if (pend) {
      s += '<div class="chx-acts">' + (h.mine ? '<span class="chx-wait">⏳ ' + H(L('Javob kutilmoqda', 'Waiting for reply', 'Ждём ответа')) + '</span>' : '<button type="button" class="friend-req-btn accept" data-chx="shacc" data-id="' + H(h.id) + '">' + H(L('Qabul qilish', 'Accept', 'Принять')) + '</button><button type="button" class="friend-req-btn decline" data-chx="shdec" data-id="' + H(h.id) + '">' + H(L('Rad etish', 'Decline', 'Отклонить')) + '</button>') + '</div>';
    } else {
      s += '<div class="chx-sh"><button type="button" class="chx-me' + (meOn ? ' on' : '') + '" data-chx="shchk" data-id="' + H(h.id) + '">' + (meOn ? '✓ ' : '○ ') + H(L('Men bugun', 'Me today', 'Я сегодня')) + '</button><span class="chx-ot' + (otOn ? ' on' : '') + '">' + (otOn ? '✓ ' : '⏳ ') + H(h.otherName || '') + '</span>' + (meOn && otOn ? '<span class="chx-ok">+2 🪙</span>' : '') + '</div>'
        + '<div class="chx-acts"><button type="button" class="friend-req-btn decline" data-chx="shend" data-id="' + H(h.id) + '">🏁 ' + H(L('Tugatish', 'End', 'Завершить')) + '</button></div>';
    }
    return s + '</div>';
  }
  function partyCard() {
    var p = null; try { p = friendsGetMyParty(); } catch (e) {}
    if (!p || !p.comp) return '';
    var left = Math.max(0, Math.ceil(((p.comp.endAt || 0) - Date.now()) / 864e5));
    return '<div class="chx-card"><div class="chx-top"><span class="chx-src">🎉 Party</span></div><b class="chx-t">' + H(p.name || 'Party') + '</b><small class="chx-left">⏳ ' + left + ' ' + H(L('kun qoldi', 'days left', 'дн. осталось')) + '</small><div class="chx-acts"><button type="button" class="friend-req-btn" data-chx="party">' + H(L('Ochish', 'Open', 'Открыть')) + ' →</button></div></div>';
  }
  function render() {
    var panel = document.getElementById('friends-panel-challenge'); if (!panel) return;
    var hub = document.getElementById('chx-hub');
    if (!hub) {
      hub = document.createElement('div'); hub.id = 'chx-hub';
      panel.insertBefore(hub, panel.firstChild);
      hub.addEventListener('click', onClick);
      // eski "vazifa duellari" bo'limiga sarlavha
      var t = document.createElement('div'); t.className = 'chx-sec chx-duel-h'; t.textContent = '⚔️ ' + L('Vazifa duellari', 'Task duels', 'Дуэли задач');
      panel.insertBefore(t, hub.nextSibling);
    }
    var F = S.friends || {}, sh = shList(), fl = CH.filter;
    var fgAct = CH.fg.filter(function (c) { return new Date(c.end_at) > new Date() && !fgPending(c); });
    var fgEnd = CH.fg.filter(function (c) { return new Date(c.end_at) <= new Date(); });
    var pend = CH.fg.filter(fgPending).map(fgCard).concat(sh.filter(function (h) { return h.status === 'pending'; }).map(shCard));
    var pendFiltered = CH.fg.filter(function (c) { return fgPending(c) && (fl === 'all' || fl === fgSrc(c)); }).map(fgCard).concat(fl === 'all' || fl === 'habit' ? sh.filter(function (h) { return h.status === 'pending'; }).map(shCard) : []);
    var act = [];
    fgAct.forEach(function (c) { if (fl === 'all' || fl === fgSrc(c)) act.push(fgCard(c)); });
    if (fl === 'all' || fl === 'habit') sh.forEach(function (h) { if (h.status === 'active') act.push(shCard(h)); });
    if (fl === 'all') { var pc = partyCard(); if (pc) act.push(pc); }
    var duelsAct = (F.challenges || []).filter(function (c) { return c.status === 'active'; }).length, duelsIn = (F.challengesIncoming || []).length;
    var nAct = fgAct.length + sh.filter(function (h) { return h.status === 'active'; }).length + duelsAct;
    var nPend = pend.length + duelsIn;
    var FL = [['all', L('Hammasi', 'All', 'Все')], ['task', '⚔️ ' + L('Vazifa', 'Tasks', 'Задачи')], ['fg', '📱 Focusgate'], ['pomo', '🍅 Pomodoro'], ['habit', '🤝 ' + L('Odat', 'Habits', 'Привычки')]];
    var h = '<div class="chx-sum"><div><b>' + nAct + '</b><small>' + H(L('Faol', 'Active', 'Активные')) + '</small></div><div><b>' + nPend + '</b><small>' + H(L('Kutilmoqda', 'Pending', 'Ожидают')) + '</small></div><div><b>' + ((F.list || []).length) + '</b><small>' + H(L('Do\'stlar', 'Friends', 'Друзья')) + '</small></div><button type="button" class="chx-ref" data-chx="refresh" title="↻">↻</button></div>'
      + '<div class="chx-sec">➕ ' + H(L('Yangi challenge', 'New challenge', 'Новый челлендж')) + '</div>' + typesHtml(null)
      + (!cloud() ? '<div class="chx-empty">🔐 ' + H(L('Focusgate, Pomodoro va odat challenge\'lari uchun akkauntga kiring.', 'Sign in for Focusgate, Pomodoro and habit challenges.', 'Войдите для челленджей Focusgate, помодоро и привычек.')) + '</div>' : '')
      + '<div class="chx-filters">' + FL.map(function (x) { return '<button type="button" data-chx-f="' + x[0] + '" class="' + (fl === x[0] ? 'on' : '') + '">' + H(x[1]) + '</button>'; }).join('') + '</div>';
    if (fl !== 'task') {
      if (pendFiltered.length) h += '<div class="chx-sec">📥 ' + H(L('Sizga kelgan takliflar', 'Invites for you', 'Приглашения вам')) + '</div><div class="chx-grid">' + pendFiltered.join('') + '</div>';
      h += '<div class="chx-sec">🔥 ' + H(L('Faol challenge\'lar', 'Active challenges', 'Активные челленджи')) + '</div>' + (act.length ? '<div class="chx-grid">' + act.join('') + '</div>' : '<div class="chx-empty">' + (CH.busy ? '⏳' : H(L('Hozircha yo\'q — yuqoridan birini boshlang!', 'None yet — start one above!', 'Пока нет — начните выше!'))) + '</div>');
      var endF = fgEnd.filter(function (c) { return fl === 'all' || fl === fgSrc(c); });
      if (endF.length) h += '<details class="chx-ended"><summary>🏁 ' + H(L('Yaqinda tugaganlar', 'Recently ended', 'Недавно завершённые')) + ' (' + endF.length + ')</summary><div class="chx-grid">' + endF.map(fgCard).join('') + '</div></details>';
    }
    hub.innerHTML = h;
    // vazifa duellari faqat "Hammasi" yoki "Vazifa" filtrida
    var showDuels = fl === 'all' || fl === 'task';
    Array.prototype.forEach.call(panel.children, function (el) { if (el !== hub) el.classList.toggle('chx-hide', !showDuels); });
  }
  function onClick(e) {
    var f = e.target.closest('[data-chx-f]');
    if (f) { CH.filter = f.getAttribute('data-chx-f'); try { localStorage.setItem('ludChxFilter', CH.filter); } catch (er) {} render(); return; }
    var n = e.target.closest('[data-chx-new]');
    if (n) { startType(n.getAttribute('data-chx-new'), null); return; }
    var b = e.target.closest('[data-chx]'); if (!b) return;
    var a = b.getAttribute('data-chx'), id = b.getAttribute('data-id'), call = null;
    if (a === 'refresh') { b.disabled = true; withFriends(function () {}); load(true); return; }
    if (a === 'party') { window.friendsShowTab('party'); return; }
    if (a === 'fgacc') call = supabase.rpc('fg_challenge_join', { p_id: id });
    else if (a === 'fgleave') { if (!confirm(L('Ishonchingiz komilmi?', 'Are you sure?', 'Вы уверены?'))) return; call = supabase.rpc('fg_challenge_leave', { p_id: id }); }
    else if (a === 'shacc' || a === 'shdec') call = supabase.rpc('sh_respond', { p_id: id, p_accept: a === 'shacc' });
    else if (a === 'shend') { if (!confirm(L('Bu birgalikdagi odat tugatilsinmi?', 'End this shared habit?', 'Завершить совместную привычку?'))) return; call = supabase.rpc('sh_end', { p_id: id }); }
    else if (a === 'shchk') { var h = shList().filter(function (x) { return x.id === id; })[0]; if (!h) return; var on = (h.me || []).indexOf(today_()) === -1; call = supabase.rpc('sh_check', { p_id: id, p_day: today_(), p_on: on }); if (on) { try { SFX.coin(); } catch (er) {} } }
    if (!call) return;
    b.disabled = true;
    call.then(function (r) {
      if (r.error || (r.data && r.data.ok === false)) toast('⚠️ ' + ((r.error && r.error.message) || r.data.error || '?'));
      else if (a === 'fgacc' || a === 'shacc') toast('🤝 ' + L('Qabul qilindi!', 'Accepted!', 'Принято!'));
      load(true);
      try { if (FG() && FG().loadSocial) FG().loadSocial(true); } catch (er) {}
    }, function () { b.disabled = false; });
  }

  // ---------- "Yangi chorlov" oynasi: ilovadagi barcha challenge turlari shu yerda ----------
  // script.js ichidagi chaqiruvlar blok-ichki nomni ishlatadi — shuning uchun o'rash o'rniga oyna ochilishini kuzatamiz
  (function () {
    var ovEl = document.getElementById('friends-newchallenge-overlay');
    if (!ovEl || !window.MutationObserver) return;
    new MutationObserver(function () { if (ovEl.classList.contains('open')) enhanceNC(); }).observe(ovEl, { attributes: true, attributeFilter: ['class'] });
  })();
  function enhanceNC() {
    var r;
      try {
        var ov = document.getElementById('friends-newchallenge-overlay'), box = ov && ov.querySelector('.modal'), sel = document.getElementById('fnc-friend-select');
        if (!box) return r;
        // UUID o'rniga ism va do'st kodi
        if (sel) Array.prototype.forEach.call(sel.options, function (o) { var f = (S.friends.list || []).filter(function (x) { return String(x.id) === o.value; })[0]; if (f) o.textContent = (f.name || '—') + (f.friendCode ? ' · ' + f.friendCode : ''); });
        var bar = box.querySelector('#chx-nc-types');
        if (!bar) {
          bar = document.createElement('div'); bar.id = 'chx-nc-types'; bar.className = 'modal-field';
          bar.innerHTML = '<label>' + H(L('Challenge turi', 'Challenge type', 'Тип челленджа')) + '</label><div class="chx-nc">' + TYPES.map(function (t) { return '<button type="button" data-nct="' + t[0] + '" class="' + (t[0] === 'task' ? 'on' : '') + '" title="' + H(t[3]()) + '"><span>' + t[1] + '</span>' + H(t[2]()) + '</button>'; }).join('') + '</div>';
          var h2 = box.querySelector('h2'); box.insertBefore(bar, h2 ? h2.nextSibling : box.firstChild);
          bar.addEventListener('click', function (e) {
            var b = e.target.closest('[data-nct]'); if (!b) return;
            var k = b.getAttribute('data-nct'); if (k === 'task') return;
            var fid = (document.getElementById('fnc-friend-select') || {}).value || null;
            try { closeNewChallengeModal(); } catch (er) {}
            startType(k, fid);
          });
        }
      } catch (e) {}
      return r;
  }

  // ---------- do'st profilida "⚔️ Challenge" tugmasi ----------
  if (typeof window.showFriendProfileModal === 'function') {
    var _sp = window.showFriendProfileModal;
    window.showFriendProfileModal = function (id) {
      _sp.apply(this, arguments);
      try {
        if (friendsRelationStatus(id) !== 'friend') return;
        var box = document.querySelector('#friend-profile-modal > div'); if (!box) return;
        var host = box.querySelector('.fp-right') || box, last = host.lastElementChild;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chx-fp-btn';
        b.innerHTML = '⚔️ ' + H(L('Challenge qilish', 'Challenge', 'Бросить вызов'));
        b.onclick = function () { window.chxPick(id); };
        host.insertBefore(b, last);
      } catch (e) {}
    };
  }

  // script.js badge'ni o'zicha qayta yozsa — barcha turdagi takliflar sonini qaytaramiz
  (function () {
    var bEl = document.getElementById('friends-challenge-badge');
    if (bEl && window.MutationObserver) new MutationObserver(function () {
      var F = S.friends || {}, n = (F.challengesIncoming || []).filter(function (c) { return !(F.seenChallengeIds || {})[c.id]; }).length + unseen();
      if (bEl.textContent !== String(n) && n > 0) badge();
    }).observe(bEl, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  })();
  window.addEventListener('lud-challenges', function () { CH.at = 0; load(true); });
  window.addEventListener('lud-challenges-data', function () { render(); badge(); });
  function init() {
    setTimeout(function () { load(false); }, 6000);
    setInterval(function () { if (!document.hidden) load(false); }, 300000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();

// ============================================================
// 📄 JADVAL (CSV) EKSPORTI — bitta joyda: Sozlamalar → Eksport oynasi.
// Bo'limlardagi alohida CSV tugmalari olib tashlandi.
// ============================================================
(function () {
  'use strict';
  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var ITEMS = [
    ['stats', '📊', function () { return L('Vazifalar statistikasi', 'Task statistics', 'Статистика задач'); }, function () { if (typeof exportStatsCSV === 'function') exportStatsCSV(); }],
    ['inbox', '📥', function () { return 'Inbox'; }, function () { if (window.xCsvInbox) window.xCsvInbox(); }],
    ['pomo', '🍅', function () { return L('Pomodoro seanslari', 'Pomodoro sessions', 'Сессии помодоро'); }, function () { if (window.xCsvPomo) window.xCsvPomo(); }],
    ['fg', '🛡', function () { return L('Focusgate (30 kun)', 'Focusgate (30 days)', 'Focusgate (30 дней)'); }, function () { if (window.LUFocusgate && window.LUFocusgate.exportCsv) window.LUFocusgate.exportCsv(); }]
  ];
  window.xCsvSection = function (box) {
    if (!box || box.querySelector('.xcsv')) return;
    var d = document.createElement('details'); d.className = 'xcsv';
    d.innerHTML = '<summary>📄 ' + esc(L('Jadval sifatida (CSV, Excel uchun)', 'As a spreadsheet (CSV, for Excel)', 'Таблицей (CSV, для Excel)')) + '</summary><div class="xcsv-g">' +
      ITEMS.map(function (x) { return '<button type="button" data-csv="' + x[0] + '"><span>' + x[1] + '</span>' + esc(x[2]()) + '</button>'; }).join('') + '</div>';
    var cancel = box.querySelector('#export-cancel');
    box.insertBefore(d, cancel || null);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-csv]'); if (!b) return;
      var it = ITEMS.filter(function (x) { return x[0] === b.getAttribute('data-csv'); })[0];
      try { it && it[3](); } catch (er) { console.warn('[csv]', er); }
    });
  };
})();
