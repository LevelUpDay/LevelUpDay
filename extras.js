// ============================================================
// ✨ EXTRAS — script.js ustiga qo'shimcha funksiyalar:
//   ▦ Eisenhower matritsasi
//   🔥 Yillik faollik xaritasi · 🐉 Haftalik boss · 🛍 Do'kon
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
    return '<div class="x-mx-chip" data-id="' + t.id + '"><button class="x-mx-done" data-done="' + t.id + '" title="✓"></button><span class="x-mx-name" data-edit="' + t.id + '">' +
      (t.emoji ? t.emoji + ' ' : '') + H(t.name) + (t.startTime ? ' <i>' + t.startTime + '</i>' : '') + '</span></div>';
  }
  function openMatrix() {
    var old = document.querySelector('.x-ov.x-mx'); var keep = !!old; if (old) old.remove();
    var tasks = todaysOpenTasks();
    var html = '<h3 class="x-h">▦ ' + L('Eisenhower matritsasi', 'Eisenhower matrix', 'Матрица Эйзенхауэра') + '</h3>' +
      '<p class="x-sub">' + L('Vazifalarni sudrab kerakli katakka qo\'ying. ✓ — bajarildi, nomini bossangiz — tahrirlash.', 'Drag tasks into a box. ✓ marks done, tap a name to edit.', 'Перетащите задачи в нужный квадрат.') + '</p>' +
      '<div class="x-mx-grid">';
    QUADS.forEach(function (Q) {
      var list = tasks.filter(function (t) { return t.quad === Q.q; });
      html += '<div class="x-mx-q ' + Q.cls + '"><div class="x-mx-qh"><b>' + Q.icon + ' ' + Q.t() + '</b><span>' + Q.s() + ' · ' + list.length + '</span></div>' +
        '<div class="x-mx-list" data-q="' + Q.q + '">' + list.map(mxChip).join('') + '</div></div>';
    });
    var un = tasks.filter(function (t) { return !t.quad; });
    html += '</div><div class="x-mx-un"><div class="x-mx-qh"><b>📥 ' + L('Saralanmagan', 'Unsorted', 'Без категории') + '</b><span>' + un.length + '</span></div>' +
      '<div class="x-mx-list" data-q="0">' + un.map(mxChip).join('') + '</div></div>';
    var ov = xModal(html, 'x-mx-box'); ov.classList.add('x-mx');
    if (keep) ov.classList.add('open');
    ov.querySelectorAll('[data-done]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); toggleTask(+b.dataset.done); setTimeout(openMatrix, 50); }; });
    ov.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { ov._close(); editTask(+b.dataset.edit); }; });
    if (typeof Sortable !== 'undefined') {
      ov.querySelectorAll('.x-mx-list').forEach(function (el) {
        Sortable.create(el, {
          group: 'x-mx', animation: 150, delay: 120, delayOnTouchOnly: true, filter: '.x-mx-done', preventOnFilter: false,
          onAdd: function (ev) {
            var id = +ev.item.dataset.id, q = +el.dataset.q;
            var tk = S.tasks.find(function (x) { return x.id === id; });
            if (tk) { if (q) tk.quad = q; else delete tk.quad; save(); try { renderTaskList(); } catch (e) {} }
            ov.querySelectorAll('.x-mx-q').forEach(function (qd) { var n = qd.querySelectorAll('.x-mx-chip').length; var sp = qd.querySelector('.x-mx-qh span'); if (sp) sp.textContent = sp.textContent.replace(/\d+$/, n); });
          }
        });
      });
    }
  }

  // =========================================================
  // 🐉 6. HAFTALIK BOSS
  // =========================================================
  var BOSSES = [
    { e: '🦥', n: ['Dangasalik', 'Sloth', 'Лень'] },
    { e: '🧟', n: ['Kechiktirish zombisi', 'Procrastination zombie', 'Зомби прокрастинации'] },
    { e: '🦑', n: ['Chalg\'ish krakeni', 'Distraction kraken', 'Кракен отвлечений'] },
    { e: '👹', n: ['Bahona devi', 'Excuse demon', 'Демон отговорок'] },
    { e: '🤖', n: ['Telefon robot', 'Phone-bot 3000', 'Телефон-бот'] },
    { e: '🐉', n: ['Charchoq ajdari', 'Burnout dragon', 'Дракон выгорания'] }
  ];
  function bossEnsure() {
    var wk = mondayOf(today());
    if (!S.boss || S.boss.week !== wk) {
      if (S.boss && !S.boss.defeated && S.boss.week) {
        S.bossHistory = S.bossHistory || [];
        S.bossHistory.unshift({ week: S.boss.week, idx: S.boss.idx, won: false, hp: S.boss.hp, maxHp: S.boss.maxHp });
      }
      var lvl = S.bossWins || 0;
      var idx = (Math.floor(parseD(wk).getTime() / 6048e5) + lvl) % BOSSES.length;
      var maxHp = 25 + lvl * 5;
      S.boss = { week: wk, idx: idx, level: lvl + 1, maxHp: maxHp, hp: maxHp, hits: {}, log: [], defeated: false };
      if (S.bossHistory && S.bossHistory.length > 20) S.bossHistory.length = 20;
    }
    return S.boss;
  }
  function bossName(b) { var B = BOSSES[b.idx] || BOSSES[0]; return B.e + ' ' + L(B.n[0], B.n[1], B.n[2]); }
  function bossReward(b) { return { gems: 2 + Math.floor((b.level - 1) / 2), coins: 10 + (b.level - 1) * 2 }; }
  var _bossRwTimer = null;
  function bossHit(tsk, on) {
    var b = bossEnsure();
    var key = tsk.id + '_' + today();
    if (on) {
      if (b.hits[key] || b.defeated) return;
      var dmg = Math.max(1, (typeof taskCoinValue === 'function' ? taskCoinValue(tsk) : 1) || 1);
      try { if (getTaskDayFlag(tsk.id, today()).onTimeGiven) dmg += 1; } catch (e) {}
      b.hits[key] = dmg;
      b.hp = Math.max(0, b.hp - dmg);
      b.log.unshift({ n: tsk.name, d: dmg, ts: Date.now() }); if (b.log.length > 12) b.log.length = 12;
      if (b.hp === 0) {
        b.defeated = true; b.defeatedAt = Date.now();
        S.bossWins = (S.bossWins || 0) + 1;
        var rw = bossReward(b);
        S.bossHistory = S.bossHistory || [];
        S.bossHistory.unshift({ week: b.week, idx: b.idx, won: true, hp: 0, maxHp: b.maxHp, at: Date.now() });
        _bossRwTimer = setTimeout(function () {
          _bossRwTimer = null;
          if (!b.defeated) return;
          try { gemsAdd(rw.gems, 'boss', L('Boss yengildi', 'Boss defeated', 'Босс побеждён'), true); } catch (e) {}
          addCoins(rw.coins, '🐉 ' + L('Boss yengildi', 'Boss defeated', 'Босс побеждён'));
          b.rewarded = { gems: rw.gems, coins: rw.coins };
          try { confetti(); confetti(); SFX.firework(); } catch (e) {}
          toast('🏆 ' + bossName(b) + ' ' + L('yengildi!', 'defeated!', 'побеждён!') + ' +' + rw.gems + ' 💎 +' + rw.coins + ' 🪙');
          feedPost('boss', L('haftalik bossni yengdi', 'defeated the weekly boss', 'победил(а) босса недели') + ': ' + bossName(b), '🏆');
          save(); renderBossStrip();
        }, 1600);
      }
    } else {
      var d = b.hits[key]; if (!d) return;
      delete b.hits[key];
      if (b.defeated) {
        // ↩ Yenguvchi zarba bekor qilindi — boss tiriladi, mukofot qaytarib olinadi
        b.defeated = false; b.defeatedAt = null;
        if (_bossRwTimer) { clearTimeout(_bossRwTimer); _bossRwTimer = null; }
        if (b.rewarded) {
          try { gemsAdd(-b.rewarded.gems, 'boss', '↩ ' + L('Boss g\'alabasi bekor qilindi', 'Boss win undone', 'Победа над боссом отменена'), true); } catch (e) {}
          addCoins(-b.rewarded.coins, '↩ 🐉 ' + L('Boss g\'alabasi bekor qilindi', 'Boss win undone', 'Победа над боссом отменена'));
          b.rewarded = null;
        }
        S.bossWins = Math.max(0, (S.bossWins || 0) - 1);
        var hi = (S.bossHistory || []).findIndex(function (x) { return x.week === b.week && x.won; });
        if (hi !== -1) S.bossHistory.splice(hi, 1);
        toast('↩ ' + bossName(b) + ' ' + L('qayta tirildi', 'is back', 'вернулся'));
      }
      b.hp = Math.min(b.maxHp, b.hp + d);
      var li = (b.log || []).findIndex(function (l) { return l.n === tsk.name && l.d === d; });
      if (li !== -1) b.log.splice(li, 1);
    }
    renderBossStrip(on);
  }
  function bossHtml(full) {
    var b = bossEnsure();
    var pct = Math.round(b.hp / b.maxHp * 100);
    var days = 7 - ((new Date().getDay() + 6) % 7);
    var rw = bossReward(b);
    var h = '<div class="x-boss ' + (b.defeated ? 'won' : '') + '"><div class="x-boss-e">' + (BOSSES[b.idx] || BOSSES[0]).e + '</div><div class="x-boss-m">' +
      '<div class="x-boss-t"><b>' + bossName(b).replace(/^\S+\s/, '') + '</b><span>Lv ' + b.level + '</span></div>' +
      '<div class="x-hp"><i style="width:' + pct + '%"></i><span>' + (b.defeated ? '✅ ' + L('Yengildi!', 'Defeated!', 'Побеждён!') : '❤️ ' + b.hp + ' / ' + b.maxHp + ' HP') + '</span></div>' +
      '<div class="x-boss-s">' + (b.defeated ? L('Keyingi boss dushanba kuni keladi', 'Next boss arrives on Monday', 'Следующий босс в понедельник')
        : L('Har bir bajarilgan vazifa = zarba', 'Each completed task = a hit', 'Каждая задача = удар') + ' · ⏳ ' + days + ' ' + L('kun', 'days', 'дн.') + ' · 🎁 ' + rw.gems + '💎 ' + rw.coins + '🪙') + '</div></div></div>';
    if (full) {
      h += '<div class="x-sec-t">⚔️ ' + L('So\'nggi zarbalar', 'Recent hits', 'Последние удары') + '</div>' +
        (b.log.length ? '<div class="x-boss-log">' + b.log.map(function (l) { return '<div><span>' + H(l.n) + '</span><b>-' + l.d + ' HP</b></div>'; }).join('') + '</div>' : '<div class="x-empty">' + L('Hali zarba yo\'q — vazifa bajaring!', 'No hits yet — complete a task!', 'Пока нет ударов') + '</div>');
      var hist = (S.bossHistory || []).slice(0, 8);
      if (hist.length) h += '<div class="x-sec-t">📜 ' + L('Tarix', 'History', 'История') + ' · 🏆 ' + (S.bossWins || 0) + '</div><div class="x-boss-hist">' + hist.map(function (x) {
        return '<span class="' + (x.won ? 'w' : 'l') + '" title="' + x.week + '">' + (BOSSES[x.idx] || BOSSES[0]).e + (x.won ? '✅' : '❌') + '</span>';
      }).join('') + '</div>';
    }
    return h;
  }
  function renderBossStrip(hit) {
    var el = document.getElementById('x-boss-strip'); if (!el) return;
    if (S.xBossHidden) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = bossHtml(false);
    if (hit) { var e = el.querySelector('.x-boss-e'); if (e) { e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); } }
    var hv = document.getElementById('x-hub-boss'); if (hv) hv.innerHTML = bossHtml(true);
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
    { id: 'b_crown', kind: 'badge', v: '👑', icon: '👑', n: ['Toj nishon', 'Crown badge', 'Значок корона'], gems: 40 }
  ];
  function shopState() { S.shop = S.shop || { owned: [], frame: null, nick: null, title: null, theme: null, effect: null, badge: null }; if (!Array.isArray(S.shop.owned)) S.shop.owned = []; return S.shop; }
  function shopBuy(id) {
    var it = SHOP.find(function (x) { return x.id === id; }); if (!it) return;
    var st = shopState(); if (st.owned.indexOf(id) !== -1) return shopEquip(id);
    var nm = L(it.n[0], it.n[1], it.n[2]);
    if (it.gems) {
      if ((typeof gemsAvailable === 'function' ? gemsAvailable() : S.gems || 0) < it.gems) { toast('💎 ' + L('Gem yetarli emas', 'Not enough gems', 'Недостаточно гемов')); return; }
      if (!confirm(nm + ' — ' + it.gems + ' 💎?')) return;
      gemsAdd(-it.gems, 'shop', nm, true);
    } else {
      if ((S.coins || 0) < it.coins) { toast('🪙 ' + L('Tanga yetarli emas', 'Not enough coins', 'Недостаточно монет')); return; }
      if (!confirm(nm + ' — ' + it.coins + ' 🪙?')) return;
      addCoins(-it.coins, '🛍 ' + nm);
    }
    st.owned.push(id);
    try { SFX.coin(); confetti(); } catch (e) {}
    toast('🛍 ' + nm + ' ' + L('sotib olindi!', 'purchased!', 'куплено!'));
    shopEquip(id, true);
  }
  function shopEquip(id, silent) {
    var it = SHOP.find(function (x) { return x.id === id; }); var st = shopState(); if (!it) return;
    st[it.kind] = (st[it.kind] === id) ? null : id;
    save(); shopApply(); try { render(); } catch (e) {} renderHubSection('shop');
    if (!silent) toast(st[it.kind] ? '✅ ' + L('Kiyildi', 'Equipped', 'Надето') : L('Olib tashlandi', 'Removed', 'Снято'));
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
    return Object.keys(o).length ? o : null;
  };
  // nameHtml allaqachon escape qilingan bo'lishi kerak
  window.xCosNameHtml = function (nameHtml, c) {
    var n = cosItem(c, 'nick'), b = cosItem(c, 'badge');
    return (n ? '<span class="xn-' + n.v + '">' + nameHtml + '</span>' : nameHtml) + (b ? '<span class="x-nbadge">' + b.v + '</span>' : '');
  };
  window.xCosFrameCls = function (c) { var f = cosItem(c, 'frame'); return f ? ' xf-' + f.v : ''; };
  window.xCosTitle = function (c) { var it = cosItem(c, 'title'); return it ? L(it.tv[0], it.tv[1], it.tv[2]) : ''; };

  var shopApply = safe(function () {
    var st = shopState(), root = document.documentElement;
    var f = SHOP.find(function (x) { return x.id === st.frame; }), n = SHOP.find(function (x) { return x.id === st.nick; });
    if (f) root.setAttribute('data-x-frame', f.v); else root.removeAttribute('data-x-frame');
    if (n) root.setAttribute('data-x-nick', n.v); else root.removeAttribute('data-x-nick');
    var th = SHOP.find(function (x) { return x.id === st.theme; });
    if (th) { root.style.setProperty('--accent', th.v); root.style.setProperty('--accent-glow', th.v + '33'); root.setAttribute('data-x-theme', th.id); }
    else if (root.getAttribute('data-x-theme')) { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-glow'); root.removeAttribute('data-x-theme'); }
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
      ['theme', '🎨 ' + L('Ilova rangi', 'App color', 'Цвет приложения')], ['effect', '🎉 ' + L('Bajarilganda effekt', 'Task-done effect', 'Эффект выполнения')]];
    var h = '<div class="x-shop-bal"><span>🪙 <b>' + (S.coins || 0) + '</b></span><span>💎 <b>' + (S.gems || 0) + '</b></span></div>';
    groups.forEach(function (g) {
      h += '<div class="x-sec-t">' + g[1] + '</div><div class="x-shop-grid">';
      SHOP.filter(function (x) { return x.kind === g[0]; }).forEach(function (it) {
        var own = st.owned.indexOf(it.id) !== -1, on = st[it.kind] === it.id;
        var prev = it.kind === 'frame' ? '<div class="x-shop-av xf-' + it.v + '">' + H((getDisplayUsername() || '?').charAt(0).toUpperCase()) + '</div>'
          : it.kind === 'nick' ? '<div class="x-shop-nk xn-' + it.v + '">' + H(getDisplayUsername() || 'Nick') + '</div>'
          : it.kind === 'theme' ? '<div class="x-shop-th" style="--tc:' + it.v + '"><i></i><i></i><i></i></div>'
          : it.kind === 'effect' ? '<div class="x-shop-fx" data-fx="' + it.id + '">' + it.v + '</div>'
          : it.kind === 'badge' ? '<div class="x-shop-nk">' + H(getDisplayUsername() || 'Nick') + ' ' + it.v + '</div>'
          : '<div class="x-shop-tt">' + L(it.tv[0], it.tv[1], it.tv[2]) + '</div>';
        h += '<button class="x-shop-it ' + (on ? 'on' : own ? 'own' : '') + '" data-shop="' + it.id + '">' + prev +
          '<div class="x-shop-n">' + L(it.n[0], it.n[1], it.n[2]).replace(/^[^:]+:\s*/, '') + '</div>' +
          '<div class="x-shop-p">' + (on ? '✅ ' + L('Kiyilgan', 'Equipped', 'Надето') : own ? L('Kiyish', 'Equip', 'Надеть') : (it.gems ? it.gems + ' 💎' : it.coins + ' 🪙')) + '</div></button>';
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
    var bosses = (S.bossHistory || []).filter(function (b) { return b.won && b.week && b.week.slice(0, 7) === ym; }).length;
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
  function openFocus(taskId) {
    if (FX) return;
    var open = todaysOpenTasks();
    var tk = taskId ? S.tasks.find(function (t) { return t.id === taskId; }) : focusPickTask();
    var ov = document.createElement('div'); ov.className = 'x-focus';
    ov.innerHTML = '<div class="x-fc-in"><div class="x-fc-top"><span>🎯 ' + L('Fokus rejimi', 'Focus mode', 'Режим фокуса') + '</span><button class="x-fc-x" title="Esc">✕</button></div>' +
      '<select class="x-fc-sel">' + '<option value="">— ' + L('Vazifasiz', 'No task', 'Без задачи') + ' —</option>' + open.map(function (t) { return '<option value="' + t.id + '"' + (tk && tk.id === t.id ? ' selected' : '') + '>' + H((t.emoji ? t.emoji + ' ' : '') + t.name + (t.startTime ? ' · ' + t.startTime : '')) + '</option>'; }).join('') + '</select>' +
      '<div class="x-fc-task"></div>' +
      '<div class="x-fc-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="bg"/><circle cx="60" cy="60" r="54" class="fg"/></svg><div class="x-fc-time">25:00</div><div class="x-fc-ph"></div></div>' +
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
      ov.querySelector('.x-fc-play').textContent = FX.running ? '⏸' : '▶';
      ov.querySelector('.x-fc-ph').textContent = FX.running ? L('diqqat...', 'focusing...', 'фокус...') : (left < FX.total ? L('pauza', 'paused', 'пауза') : '');
      try { document.title = (FX.running ? '🎯 ' + pad2(m) + ':' + pad2(s) + ' · ' : '') + 'LevelUpDay'; } catch (e) {}
      if (FX.running && left <= 0) finish();
    };
    var credit = function () {
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
      draw();
    };
    ov.querySelector('.x-fc-reset').onclick = function () { if (FX.running) credit(); FX.running = false; FX.left = FX.total; draw(); };
    ov.querySelector('.x-fc-sel').onchange = function () { var id = +this.value; setTask(id ? S.tasks.find(function (t) { return t.id === id; }) : null); };
    ov.querySelector('.x-fc-done').onclick = function () { if (FX.tk && !FX.tk.done) { toggleTask(FX.tk.id); } closeFocus(); };
    ov.querySelector('.x-fc-snd').onclick = function () { try { openFocusPlayer(); } catch (e) { toast('🎵 —'); } };
    ov.querySelector('.x-fc-x').onclick = closeFocus;
    FX.onKey = function (e) { if (e.key === 'Escape' && !document.querySelector('.modal-overlay.open')) { e.stopPropagation(); closeFocus(); } else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); ov.querySelector('.x-fc-play').click(); } };
    document.addEventListener('keydown', FX.onKey, true);
    FX.timer = setInterval(draw, 250); draw();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { if (FX) FX.wake = w; }).catch(function () {}); } catch (e) {}
    requestAnimationFrame(function () { ov.classList.add('open'); });
  }
  function closeFocus() {
    if (!FX) return;
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
  }
  function healthHtml() { return '<div class="x-card x-sleep-card">' + sleepCardHtml() + '</div>'; }
  function bindHealth(root) { bindSleep(root); }

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
    box.innerHTML = '<div class="x-empty">⏳ ' + L('Yuklanmoqda...', 'Loading...', 'Загрузка...') + '</div>';
    supabase.rpc('get_friend_feed', { p_limit: 50 }).then(function (r) {
      if (r.error) { box.innerHTML = '<div class="x-empty">⚠️ ' + H(sqlHint(r.error)) + '</div>'; return; }
      feedCache = r.data || [];
      renderFeed();
    });
  }
  function renderFeed() {
    var box = document.getElementById('x-hub-feed'); if (!box) return;
    var items = feedCache || [];
    var h = '<div class="x-row x-feed-tools"><button class="x-btn ghost sm" id="x-feed-ref">↻ ' + L('Yangilash', 'Refresh', 'Обновить') + '</button>' +
      '<label class="x-chk"><input type="checkbox" id="x-feed-auto" ' + (S.xFeedOff ? '' : 'checked') + '> ' + L('Yutuqlarimni avtomatik ulashish', 'Auto-share my achievements', 'Делиться достижениями автоматически') + '</label></div>';
    if (!items.length) h += '<div class="x-empty">📭 ' + L('Hali hech narsa yo\'q. Vazifalarni bajaring — do\'stlaringiz ko\'radi!', 'Nothing yet. Complete tasks — your friends will see it!', 'Пока пусто.') + '</div>';
    items.forEach(function (it) {
      var rc = it.reactions || {}, mine = it.my_reactions || [];
      h += '<div class="x-feed-it"><div class="x-feed-h">' + avatar(it.name, it.photo) + '<div><b>' + H(it.name || '—') + (it.is_me ? ' <i>(' + L('siz', 'you', 'вы') + ')</i>' : '') + '</b><span>' + ago(it.created_at) + '</span></div><em>' + H(it.emoji || '✅') + '</em></div>' +
        '<div class="x-feed-t">' + H(it.text) + '</div><div class="x-feed-r">' + REACTS.map(function (e) {
          var on = mine.indexOf(e) !== -1, n = rc[e] || 0;
          return '<button class="' + (on ? 'on' : '') + '" data-fr="' + it.id + '" data-e="' + e + '">' + e + (n ? ' ' + n : '') + '</button>';
        }).join('') + '</div></div>';
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
        if (!confirm(L('Umumiy vazifa o\'chirilsinmi? (ikkalangiz uchun)', 'Delete this shared task? (for both of you)', 'Удалить общую задачу? (для обоих)'))) return;
        supabase.rpc('delete_shared_task', { p_task: b.dataset.shd }).then(function (r) { if (r.error) toast('⚠️ ' + sqlHint(r.error)); loadShared(); });
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
    var sec = S.xHubSec || 'boss';
    if (!HUB_SECS.some(function (x) { return x[0] === sec; })) sec = 'boss'; // eski "Tahlil" bo'limi Statistikaga ko'chdi
    var tools = [['matrix', '▦', L('Matritsa', 'Matrix', 'Матрица')],
      ['stats', '📊', L('Statistika', 'Statistics', 'Статистика')]];
    if (window._isAdmin) tools.push(['admin', '👑', L('Admin', 'Admin', 'Админ')]);
    v.innerHTML = sectionsGrid() + '<div class="x-hub-tools">' + tools.map(function (t) { return '<button data-tool="' + t[0] + '"><span>' + t[1] + '</span>' + t[2] + '</button>'; }).join('') + '</div>' +
      '<div class="x-hub-nav">' + HUB_SECS.map(function (s) { return '<button class="' + (s[0] === sec ? 'on' : '') + '" data-sec="' + s[0] + '">' + s[1] + ' ' + L(s[2][0], s[2][1], s[2][2]) + '</button>'; }).join('') + '</div>' +
      '<div id="x-hub-body"></div>';
    v.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { ({ matrix: openMatrix, stats: function () { showTab('profile'); try { showProfileSubtab('stats'); } catch (e) {} }, admin: function () { window.openAdminPanel(); } })[b.dataset.tool](); }; });
    v.querySelectorAll('[data-sec]').forEach(function (b) { b.onclick = function () { S.xHubSec = b.dataset.sec; save(); renderHub(); }; });
    bindSections(v);
    renderHubSection(sec, true);
  }
  function renderHubSection(sec, force) {
    var body = document.getElementById('x-hub-body'); if (!body) return;
    if (!force && (S.xHubSec || 'boss') !== sec) return;
    var h = '';
    if (sec === 'boss') {
      h = '<div class="x-card" id="x-hub-boss">' + bossHtml(true) + '</div><label class="x-chk"><input type="checkbox" id="x-boss-strip-on" ' + (S.xBossHidden ? '' : 'checked') + '> ' + L('Vazifalar sahifasida boss panelini ko\'rsatish', 'Show boss bar on the Tasks page', 'Показывать босса на странице задач') + '</label>';
    } else if (sec === 'health') {
      var md = (S.moods || {})[today()];
      h = '<button type="button" class="x-card x-mood-card" onclick="openMoodCalendar()"><span class="x-mood-e">' + (md ? md.emoji : '🙂') + '</span><span class="x-mood-t"><b>' + L('Kayfiyat kundaligi', 'Mood journal', 'Дневник настроения') + '</b><span>' +
        (md ? L('Bugun belgilangan', 'Logged today', 'Отмечено сегодня') : L('Bugun qanday? Belgilang', 'How are you today? Log it', 'Как вы сегодня?')) + '</span></span><span class="x-mood-go">›</span></button>' + healthHtml();
    } else if (sec === 'shop') {
      h = '<div class="x-card">' + shopHtml() + '</div>';
    } else if (sec === 'together') {
      h = '<div id="x-hub-shared"></div>';
    } else if (sec === 'feed') {
      h = '<div id="x-hub-feed"></div>';
    }
    body.innerHTML = h;
    if (sec === 'health') bindHealth(body);
    if (sec === 'shop') {
      body.querySelectorAll('[data-shop]').forEach(function (b) { b.onclick = function () { shopBuy(b.dataset.shop); }; });
      body.querySelectorAll('.x-shop-fx').forEach(function (f) { f.onmouseenter = function () { var r = f.getBoundingClientRect(); var it = SHOP.find(function (z) { return z.id === f.dataset.fx; }); if (it) fxBurst(it.v, r.left + r.width / 2, r.top + r.height / 2); }; });
    }
    if (sec === 'boss') { var c = body.querySelector('#x-boss-strip-on'); if (c) c.onchange = function () { S.xBossHidden = !this.checked; save(); renderBossStrip(); }; }
    if (sec === 'together') { if (sharedCache && !force) renderShared(); else loadShared(); }
    if (sec === 'feed') { if (feedCache && !force) renderFeed(); else loadFeed(); }

  }

  // =========================================================
  // Vazifalar sahifasidagi qo'shimchalar
  // =========================================================
  function renderTasksExtras() {
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
      groups: function () { return [[3, '🔴 ' + L('Qiyin', 'Hard', 'Сложно')], [2, '🟠 ' + L('O\'rtacha', 'Medium', 'Средне')], [1, '🟢 ' + L('Oson', 'Easy', 'Легко')], [0, '⚪ ' + L('Bepul', 'Free', 'Бесплатно')]]; },
      key: function (t) { var d = t.diff; if (d == null) d = 1; return Math.max(0, Math.min(3, d)); }, desc: true },
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
    var h = '<div class="ad-kpis">' +
      adTile('👥', L('Jami foydalanuvchi', 'Total users', 'Всего пользователей'), adFmt(T.users), adDelta(T.new_30d, T.new_prev_30d) + ' ' + L('30 kunda', 'in 30d', 'за 30 дн') + ' +' + (T.new_30d || 0)) +
      adTile('🔥', L('Bugun faol', 'Active today', 'Активны сегодня'), adFmt(T.dau), 'WAU ' + adFmt(T.wau) + ' · MAU ' + adFmt(T.mau)) +
      adTile('📆', L('Bu oy faol', 'Active this month', 'Активны в этом месяце'), adFmt(thisM), adDelta(thisM, prevM) + ' ' + L('o\'tgan oyga nisbatan', 'vs last month', 'к прошлому месяцу')) +
      adTile('🆕', L('Bu oy qo\'shildi', 'Joined this month', 'Новых в этом месяце'), adFmt(thisS), adDelta(thisS, prevS) + ' · ' + L('bugun', 'today', 'сегодня') + ' +' + (T.new_today || 0)) +
      adTile('🔐', L('Ro\'yxatdan o\'tgan', 'Signed up', 'Зарегистрированы'), adFmt(T.confirmed), L('tasdiqlangan', 'confirmed', 'подтверждено') + ' · ' + L('kirgan', 'signed in', 'входили') + ' ' + adFmt(T.ever_signed_in)) +
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
      adCard('🔐 ' + L('Kirish usuli', 'Sign-in method', 'Способ входа'), adList(d.by_provider, function (k) { return k === 'google' ? '🔵 Google' : k === 'email' ? '📧 Email' : H(k); })) +
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
        ['', function (r) { return r.provider === 'google' ? '🔵' : '📧'; }]])) +
      '</div>';
    box.innerHTML = h;
    // tooltip
    var tip = document.getElementById('ad-tip');
    box.querySelectorAll('[data-tip]').forEach(function (el) {
      el.onmouseenter = el.onfocus = function () { if (!tip) return; tip.textContent = el.dataset.tip; tip.style.display = 'block'; var r = el.getBoundingClientRect(); tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = (r.top - 8) + 'px'; };
      el.onmouseleave = el.onblur = function () { if (tip) tip.style.display = 'none'; };
      el.ontouchstart = function () { el.onmouseenter(); setTimeout(function () { if (tip) tip.style.display = 'none'; }, 1500); };
    });
  }

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
  var MOVED_TABS = ['chest', 'reyting', 'ielts', 'sat', 'cefr', 'pomo'];
  function tabAvailable(id) {
    var t = document.getElementById('tab-' + id);
    return !!(t && t.style.display !== 'none');
  }
  function markMovedTabs() {
    MOVED_TABS.forEach(function (id) { var t = document.getElementById('tab-' + id); if (t) t.classList.add('x-moved'); });
  }
  function sectionsGrid() {
    var items = [
      ['pomo', '🍅', L('Pomodoro', 'Pomodoro', 'Pomodoro'), function () { pomoOpenModal(); }],
      ['reyting', '🏆', L('Reyting', 'Leaderboard', 'Рейтинг'), function () { showTab('reyting'); }],
      ['friends', '👥', L('Do\'stlar', 'Friends', 'Друзья'), function () { openFriendsModal(); }],
      ['chest', '🎲', 'Chest', function () { showTab('chest'); }],
      ['spin', '🎰', 'Spin', function () { showTab('spin'); }],
      ['ielts', '📊', 'IELTS', function () { showTab('ielts'); }],
      ['sat', '📐', 'SAT', function () { showTab('sat'); }],
      ['cefr', '📘', 'CEFR', function () { showTab('cefr'); }],
      ['secret', '🕵️', L('Shaxsiy nazorat', 'Personal check', 'Личный контроль'), function () { showTab('secret'); }]
    ].filter(function (x) {
      if (x[0] === 'friends' || x[0] === 'spin') return true;
      if (x[0] === 'secret') return !!S.personalCheckEnabled;
      return tabAvailable(x[0]);
    });
    window._xSecActions = {}; items.forEach(function (x) { window._xSecActions[x[0]] = x[3]; });
    return '<div class="x-secs-t">🧩 ' + L('Bo\'limlar', 'Sections', 'Разделы') + '</div><div class="x-secs">' + items.map(function (x) {
      return '<button type="button" class="x-sec" data-sec-go="' + x[0] + '"><span>' + x[1] + '</span>' + x[2] + '</button>';
    }).join('') + '</div>';
  }
  function bindSections(root) {
    root.querySelectorAll('[data-sec-go]').forEach(function (b) { b.onclick = function () { var f = (window._xSecActions || {})[b.dataset.secGo]; if (f) f(); }; });
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
    var cur = document.documentElement.getAttribute('data-tab') || 'tasks';
    if (MAIN_TABS.indexOf(cur) === -1 && cur !== 'secret') cur = 'hub';
    if (cur === 'secret') cur = 'profile';
    var it = [['tasks', '📋', L('Vazifalar', 'Tasks', 'Задачи')], ['goals', '🎯', L('Maqsadlar', 'Goals', 'Цели')], ['hub', '🚀', 'Hub'],
      ['rewards', '🎁', L('Mukofot', 'Rewards', 'Награды')], ['profile', '👤', L('Profil', 'Profile', 'Профиль')]];
    nav.innerHTML = it.map(function (x) {
      return '<button type="button" class="' + (x[0] === cur ? 'on' : '') + '" data-bn="' + x[0] + '"><span class="x-bn-i">' + x[1] + '</span><span class="x-bn-l">' + x[2] + '</span></button>';
    }).join('');
    nav.querySelectorAll('[data-bn]').forEach(function (b) {
      b.onclick = function () { showTab(b.dataset.bn); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } };
    });
  }

  // =========================================================
  // 📲 ILOVANI O'RNATISH (kompyuter / telefon)
  // =========================================================
  var _installEvt = null;
  function isStandalone() {
    try { return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; } catch (e) { return false; }
  }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || '')); }
  function canOfferInstall() { return !isStandalone() && (!!_installEvt || isIOS()); }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); _installEvt = e; renderInstallUI(); });
  window.addEventListener('appinstalled', function () { _installEvt = null; toast('🎉 ' + L('LevelUpDay o\'rnatildi!', 'LevelUpDay installed!', 'LevelUpDay установлен!')); renderInstallUI(); });
  function doInstall() {
    if (_installEvt) {
      _installEvt.prompt();
      _installEvt.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { _installEvt = null; } renderInstallUI(); }).catch(function () {});
      return;
    }
    var html = '<h3 class="x-h">📲 ' + L('Ilovani o\'rnatish', 'Install the app', 'Установить приложение') + '</h3>';
    if (isIOS()) {
      html += '<div class="x-inst-steps"><div><b>1</b>' + L('Safari pastidagi <b>Ulashish ⬆️</b> tugmasini bosing', 'Tap the <b>Share ⬆️</b> button in Safari', 'Нажмите <b>Поделиться ⬆️</b> в Safari') + '</div>' +
        '<div><b>2</b>' + L('<b>«Bosh ekranga qo\'shish»</b> ni tanlang', 'Choose <b>“Add to Home Screen”</b>', 'Выберите <b>«На экран Домой»</b>') + '</div>' +
        '<div><b>3</b>' + L('<b>Qo\'shish</b> ni bosing — tayyor!', 'Tap <b>Add</b> — done!', 'Нажмите <b>Добавить</b> — готово!') + '</div></div>';
    } else {
      html += '<div class="x-inst-steps"><div><b>1</b>' + L('Chrome yoki Edge\'da manzil satrining o\'ng tomonidagi <b>⊕ / 🖥 O\'rnatish</b> belgisini bosing', 'In Chrome or Edge, click the <b>⊕ / 🖥 Install</b> icon at the right of the address bar', 'В Chrome или Edge нажмите значок <b>⊕ Установить</b> в адресной строке') + '</div>' +
        '<div><b>2</b>' + L('Yoki menyu <b>⋮ → «LevelUpDay\'ni o\'rnatish»</b>', 'Or menu <b>⋮ → “Install LevelUpDay”</b>', 'Или меню <b>⋮ → «Установить LevelUpDay»</b>') + '</div>' +
        '<div><b>3</b>' + L('Ilova alohida oynada ochiladi va ish stolida belgisi paydo bo\'ladi', 'It opens in its own window with an icon on your desktop', 'Приложение откроется в отдельном окне со значком на рабочем столе') + '</div></div>';
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

  // ?action=… (manifest shortcuts)
  function handleLaunchAction() {
    try {
      var a = new URLSearchParams(location.search).get('action'); if (!a) return;
      history.replaceState(null, '', location.pathname + location.hash);
      if (a === 'new-task') setTimeout(function () { showTab('tasks'); openModal(); }, 400);
      if (a === 'pomodoro') setTimeout(function () { pomoOpenModal(); }, 400);
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
  window.xOpenFocus = safe(function (id) { openFocus(id); });
  window.xWaterAdd = function () {};
  window.xDismissReview = function () {};
  window.xSleepSet = safe(sleepSet);
  window.xOpenHub = function (sec) { if (sec) S.xHubSec = sec; showTab('hub'); };

  function boot() {
    try { markMovedTabs(); buildBottomNav(); renderInstallUI(); handleLaunchAction(); } catch (e) { console.warn('[extras nav]', e); }
    try { new MutationObserver(function () { renderBottomNav(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tab'] }); } catch (e) {}
    try { bossEnsure(); } catch (e) {}
    shopApply();
    renderTasksExtras();
    maybeShowWrap();
    // render() dan keyin profil/sarlavha qayta chizilganda bezaklar saqlanib qolsin
    var mo = new MutationObserver(function () { if (shopTitleText() && !document.getElementById('x-profile-title')) shopApply(); });
    var host = document.getElementById('profile-header-text'); if (host) mo.observe(host, { childList: true });
    setInterval(function () { try { renderTasksExtras(); } catch (e) {} }, 60000);
  }
  if (document.readyState === 'complete') setTimeout(boot, 600); else window.addEventListener('load', function () { setTimeout(boot, 600); });
})();
