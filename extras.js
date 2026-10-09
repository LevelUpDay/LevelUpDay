// ============================================================
// ✨ EXTRAS — script.js ustiga qo'shimcha funksiyalar:
//   📑 Shablonlar · ▦ Eisenhower matritsasi · 🌙 Kun yakuni
//   🔥 Yillik faollik xaritasi · 🐉 Haftalik boss · 🛍 Do'kon
//   🔗 Odatlar bog'liqligi · ⏰ Eng samarali vaqt · 📅 Oylik yakun
//   🎯 Fokus rejimi · 💧 Suv va 😴 uyqu · 👥 Birgalikdagi vazifa
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
  // 📑 2. SHABLONLAR
  // =========================================================
  var BUILTIN_TPL = [
    { id: 'b_school', emoji: '🏫', name: ['Maktab kuni', 'School day', 'Школьный день'], items: [
      ['Nonushta', '07:00', '07:30', '🍳'], ['Maktab', '08:00', '13:00', '🏫'], ['Uy vazifasi', '14:30', '15:30', '📝'],
      ['Sport', '16:30', '17:30', '🏃'], ['Kitob o\'qish', '21:00', '21:30', '📖']] },
    { id: 'b_weekend', emoji: '🌴', name: ['Dam olish kuni', 'Weekend', 'Выходной'], items: [
      ['Sport', '09:00', '10:00', '🏃'], ['IELTS mashq', '10:30', '12:00', '📊'], ['Uy ishlari', '13:00', '14:00', '🧹'],
      ['Do\'stlar bilan', '16:00', '18:00', '👥'], ['Kitob o\'qish', '20:30', '21:30', '📖']] },
    { id: 'b_exam', emoji: '📚', name: ['Imtihon tayyorgarligi', 'Exam prep', 'Подготовка к экзамену'], items: [
      ['Reading', '08:00', '09:30', '📖'], ['Listening', '10:00', '11:30', '🎧'], ['Writing', '14:00', '15:30', '✍️'],
      ['Speaking', '16:00', '17:00', '🗣'], ['Vocabulary', '20:00', '20:45', '🔤']] }
  ];
  function tplAll() {
    var b = BUILTIN_TPL.map(function (t) {
      return { id: t.id, builtin: true, emoji: t.emoji, name: L(t.name[0], t.name[1], t.name[2]),
        items: t.items.map(function (i) { return { name: i[0], startTime: i[1], endTime: i[2], emoji: i[3] }; }) };
    });
    return b.concat(S.templates || []);
  }
  function tplApply(id, when) {
    var tp = tplAll().find(function (x) { return x.id === id; }); if (!tp) return;
    var date = when === 'tomorrow' ? addDays(today(), 1) : today();
    var added = 0;
    tp.items.forEach(function (it) {
      var dup = S.tasks.some(function (t) {
        return t.repeat === 'once' && !t.done && t.name === it.name && (t.startTime || null) === (it.startTime || null) &&
          ((t.postponedTo || today()) === date);
      });
      if (dup) return;
      xMakeTask({ name: it.name, startTime: it.startTime, endTime: it.endTime, emoji: it.emoji, date: date });
      added++;
    });
    try { ensureFullTaskOrder(); } catch (e) {}
    save(); render();
    toast('📑 ' + tp.emoji + ' ' + tp.name + ' · +' + added + ' ' + L('vazifa', 'tasks', 'задач') + (when === 'tomorrow' ? ' (' + L('ertaga', 'tomorrow', 'завтра') + ')' : ''));
  }
  function tplSaveFromToday() {
    var items = todaysDueTasks().filter(function (t) { return t.startTime; })
      .sort(function (a, b) { return a.startTime < b.startTime ? -1 : 1; })
      .map(function (t) { return { name: t.name, startTime: t.startTime, endTime: t.endTime || null, emoji: t.emoji || null }; });
    if (!items.length) { toast('🕒 ' + L('Bugun vaqtli vazifa yo\'q — avval vazifalarga vaqt qo\'ying', 'No timed tasks today — add times first', 'Сегодня нет задач со временем')); return; }
    var name = prompt(L('Shablon nomi:', 'Template name:', 'Название шаблона:'), L('Mening kunim', 'My day', 'Мой день'));
    if (!name) return;
    S.templates = S.templates || [];
    S.templates.push({ id: 'u_' + Date.now(), emoji: '⭐', name: name.trim().slice(0, 40), items: items });
    save(); toast('📑 ' + L('Shablon saqlandi', 'Template saved', 'Шаблон сохранён') + ' · ' + items.length);
    openTemplates();
  }
  function tplDelete(id) {
    if (!confirm(L('Shablon o\'chirilsinmi?', 'Delete this template?', 'Удалить шаблон?'))) return;
    S.templates = (S.templates || []).filter(function (t) { return t.id !== id; });
    save(); openTemplates();
  }
  function openTemplates() {
    var old = document.querySelector('.x-ov.x-tpl'); if (old) old.remove();
    var html = '<h3 class="x-h">📑 ' + L('Kun shablonlari', 'Day templates', 'Шаблоны дня') + '</h3>' +
      '<p class="x-sub">' + L('Tayyor kun rejasini bir bosishda qo\'shing. Vazifalar bir martalik bo\'lib qo\'shiladi.', 'Add a ready-made day plan in one tap. Tasks are added as one-time tasks.', 'Добавьте готовый план дня одним нажатием.') + '</p>';
    tplAll().forEach(function (tp) {
      html += '<div class="x-tpl-card"><div class="x-tpl-top"><b>' + tp.emoji + ' ' + H(tp.name) + '</b>' +
        (tp.builtin ? '' : '<button class="x-link danger" data-del="' + tp.id + '">🗑</button>') + '</div>' +
        '<div class="x-tpl-items">' + tp.items.map(function (i) {
          return '<span>' + (i.startTime ? '<i>' + i.startTime + (i.endTime ? '–' + i.endTime : '') + '</i> ' : '') + (i.emoji || '') + ' ' + H(i.name) + '</span>';
        }).join('') + '</div>' +
        '<div class="x-row"><button class="x-btn" data-apply="' + tp.id + '" data-when="today">＋ ' + L('Bugunga', 'Today', 'На сегодня') + '</button>' +
        '<button class="x-btn ghost" data-apply="' + tp.id + '" data-when="tomorrow">＋ ' + L('Ertaga', 'Tomorrow', 'На завтра') + '</button></div></div>';
    });
    html += '<button class="x-btn wide ghost" id="x-tpl-save">💾 ' + L('Bugungi vaqtli vazifalardan shablon yaratish', 'Save today\'s timed tasks as a template', 'Создать шаблон из сегодняшних задач') + '</button>';
    var ov = xModal(html, 'x-tpl-box'); ov.classList.add('x-tpl');
    ov.querySelectorAll('[data-apply]').forEach(function (b) { b.onclick = function () { tplApply(b.dataset.apply, b.dataset.when); ov._close(); }; });
    ov.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { tplDelete(b.dataset.del); }; });
    ov.querySelector('#x-tpl-save').onclick = tplSaveFromToday;
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
  // 🌙 4. KUN YAKUNI (kechki ko'rib chiqish)
  // =========================================================
  function reviewDoneToday() { return !!(S.reviews && S.reviews[today()]); }
  function openReview() {
    var td = today(), due = todaysDueTasks(), done = due.filter(function (t) { return t.done; });
    var prev = (S.reviews || {})[td] || {};
    var coinsToday = (S.tarix || []).filter(function (r) { return r.date === td && r.type === 'in' && r.amount > 0; }).reduce(function (a, r) { return a + r.amount; }, 0);
    var undone = due.filter(function (t) { return !t.done && !t.skipped; });
    var html = '<h3 class="x-h">🌙 ' + L('Kun yakuni', 'Evening review', 'Итоги дня') + '</h3>' +
      '<div class="x-stats3"><div><b>' + done.length + '/' + due.length + '</b><span>' + L('bajarildi', 'done', 'выполнено') + '</span></div>' +
      '<div><b>+' + coinsToday + '</b><span>🪙 ' + L('bugun', 'today', 'сегодня') + '</span></div>' +
      '<div><b>' + (getStreakSafe()) + '</b><span>🔥 streak</span></div></div>' +
      (undone.length ? '<div class="x-note">⏳ ' + L('Bajarilmay qolganlar', 'Still open', 'Не выполнено') + ': ' + undone.slice(0, 6).map(function (t) { return H(t.name); }).join(', ') + (undone.length > 6 ? '…' : '') + '</div>' : '') +
      '<label class="x-lbl">😊 ' + L('Bugun nima yaxshi bo\'ldi?', 'What went well today?', 'Что сегодня получилось?') + '</label>' +
      '<textarea id="x-rv-good" rows="2" class="x-in">' + H(prev.good || '') + '</textarea>' +
      '<label class="x-lbl">🛠 ' + L('Nimani yaxshilash mumkin?', 'What could be better?', 'Что можно улучшить?') + '</label>' +
      '<textarea id="x-rv-improve" rows="2" class="x-in">' + H(prev.improve || '') + '</textarea>' +
      '<label class="x-lbl">🎯 ' + L('Ertangi 3 ta asosiy vazifa', 'Top 3 for tomorrow', '3 главные задачи на завтра') + '</label>';
    for (var i = 0; i < 3; i++) {
      html += '<div class="x-rv-top"><span>' + (i + 1) + '</span><input class="x-in" id="x-rv-t' + i + '" placeholder="' + L('Vazifa nomi', 'Task name', 'Название задачи') + '" />' +
        '<input class="x-in x-time" type="time" id="x-rv-s' + i + '" /></div>';
    }
    html += '<p class="x-sub">' + L('Ertangi vazifalar 📌 muhim deb ertaga ro\'yxatga qo\'shiladi.', 'Tomorrow\'s tasks are added as 📌 pinned.', 'Задачи на завтра будут закреплены 📌.') + '</p>' +
      '<button class="x-btn wide" id="x-rv-save">✅ ' + L('Kunni yakunlash', 'Finish the day', 'Завершить день') + (prev.ts ? '' : ' · +10 XP') + '</button>';
    var hist = Object.keys(S.reviews || {}).filter(function (d) { return d !== td; }).sort().reverse().slice(0, 5);
    if (hist.length) {
      html += '<details class="x-hist"><summary>📖 ' + L('Oldingi yakunlar', 'Past reviews', 'Прошлые итоги') + '</summary>' + hist.map(function (d) {
        var r = S.reviews[d];
        return '<div class="x-hist-it"><b>' + d + '</b>' + (r.good ? '<div>😊 ' + H(r.good) + '</div>' : '') + (r.improve ? '<div>🛠 ' + H(r.improve) + '</div>' : '') + '</div>';
      }).join('') + '</details>';
    }
    var ov = xModal(html, 'x-rv-box');
    ov.querySelector('#x-rv-save').onclick = function () {
      var first = !prev.ts;
      var tops = [];
      for (var j = 0; j < 3; j++) {
        var n = ov.querySelector('#x-rv-t' + j).value.trim();
        var st = ov.querySelector('#x-rv-s' + j).value || null;
        if (n) tops.push({ name: n, startTime: st });
      }
      S.reviews = S.reviews || {};
      S.reviews[td] = { good: ov.querySelector('#x-rv-good').value.trim(), improve: ov.querySelector('#x-rv-improve').value.trim(), top: tops.map(function (x) { return x.name; }), done: done.length, due: due.length, ts: Date.now() };
      var tm = addDays(td, 1);
      tops.forEach(function (x) {
        var a = hm2m(x.startTime);
        xMakeTask({ name: x.name, startTime: x.startTime, endTime: a != null ? m2hm(Math.min(a + 60, 1439)) : null, date: tm, pinned: true });
      });
      try { ensureFullTaskOrder(); } catch (e) {}
      if (first) addXP(10, L('Kun yakuni', 'Evening review', 'Итоги дня'));
      save(); render(); ov._close();
      toast('🌙 ' + L('Kun yakunlandi! Yaxshi dam oling', 'Day wrapped up! Rest well', 'День завершён! Хорошего отдыха') + (tops.length ? ' · ' + tops.length + ' ' + L('ta vazifa ertaga', 'tasks for tomorrow', 'задач на завтра') : ''));
    };
  }
  function getStreakSafe() { try { return (typeof getStreak === 'function' ? getStreak() : (S.streak || 0)) || 0; } catch (e) { return S.streak || 0; } }

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
        setTimeout(function () {
          try { gemsAdd(rw.gems, 'boss', L('Boss yengildi', 'Boss defeated', 'Босс побеждён'), true); } catch (e) {}
          addCoins(rw.coins, '🐉 ' + L('Boss yengildi', 'Boss defeated', 'Босс побеждён'));
          try { confetti(); confetti(); SFX.firework(); } catch (e) {}
          toast('🏆 ' + bossName(b) + ' ' + L('yengildi!', 'defeated!', 'побеждён!') + ' +' + rw.gems + ' 💎 +' + rw.coins + ' 🪙');
          feedPost('boss', L('haftalik bossni yengdi', 'defeated the weekly boss', 'победил(а) босса недели') + ': ' + bossName(b), '🏆');
          save(); renderBossStrip();
        }, 1600);
      }
    } else {
      var d = b.hits[key]; if (!d) return;
      delete b.hits[key];
      if (!b.defeated) b.hp = Math.min(b.maxHp, b.hp + d);
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
    { id: 'f_neon', kind: 'frame', v: 'neon', icon: '💜', n: ['Neon ramka', 'Neon frame', 'Неоновая рамка'], gems: 5 },
    { id: 'f_fire', kind: 'frame', v: 'fire', icon: '🔥', n: ['Olov ramka', 'Fire frame', 'Огненная рамка'], gems: 8 },
    { id: 'f_rainbow', kind: 'frame', v: 'rainbow', icon: '🌈', n: ['Kamalak ramka', 'Rainbow frame', 'Радужная рамка'], gems: 15 },
    { id: 'n_mint', kind: 'nick', v: 'mint', icon: '🟢', n: ['Yalpiz nik', 'Mint nickname', 'Мятный ник'], coins: 80 },
    { id: 'n_pink', kind: 'nick', v: 'pink', icon: '🩷', n: ['Pushti nik', 'Pink nickname', 'Розовый ник'], coins: 80 },
    { id: 'n_gold', kind: 'nick', v: 'gold', icon: '✨', n: ['Oltin nik', 'Gold nickname', 'Золотой ник'], coins: 150 },
    { id: 'n_rainbow', kind: 'nick', v: 'rainbow', icon: '🌈', n: ['Kamalak nik', 'Rainbow nickname', 'Радужный ник'], gems: 10 },
    { id: 't_owl', kind: 'title', v: '🦉 ' + 'Night Owl', icon: '🦉', n: ['Unvon: Tungi boyo\'g\'li', 'Title: Night Owl', 'Титул: Сова'], coins: 120, tv: ['🦉 Tungi boyo\'g\'li', '🦉 Night Owl', '🦉 Сова'] },
    { id: 't_early', kind: 'title', v: 'early', icon: '🌅', n: ['Unvon: Erta turuvchi', 'Title: Early Bird', 'Титул: Жаворонок'], coins: 120, tv: ['🌅 Erta turuvchi', '🌅 Early Bird', '🌅 Жаворонок'] },
    { id: 't_machine', kind: 'title', v: 'machine', icon: '⚡', n: ['Unvon: Ish mashinasi', 'Title: Machine', 'Титул: Машина'], gems: 6, tv: ['⚡ Ish mashinasi', '⚡ Machine', '⚡ Машина'] },
    { id: 't_legend', kind: 'title', v: 'legend', icon: '👑', n: ['Unvon: Afsona', 'Title: Legend', 'Титул: Легенда'], gems: 20, tv: ['👑 Afsona', '👑 Legend', '👑 Легенда'] }
  ];
  function shopState() { S.shop = S.shop || { owned: [], frame: null, nick: null, title: null }; if (!Array.isArray(S.shop.owned)) S.shop.owned = []; return S.shop; }
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
  function shopTitleText() {
    var st = shopState(); var it = SHOP.find(function (x) { return x.id === st.title; });
    return it ? L(it.tv[0], it.tv[1], it.tv[2]) : '';
  }
  var shopApply = safe(function () {
    var st = shopState(), root = document.documentElement;
    var f = SHOP.find(function (x) { return x.id === st.frame; }), n = SHOP.find(function (x) { return x.id === st.nick; });
    if (f) root.setAttribute('data-x-frame', f.v); else root.removeAttribute('data-x-frame');
    if (n) root.setAttribute('data-x-nick', n.v); else root.removeAttribute('data-x-nick');
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
    var groups = [['frame', '🖼 ' + L('Avatar ramkalari', 'Avatar frames', 'Рамки аватара')], ['nick', '🎨 ' + L('Nik rangi', 'Nickname color', 'Цвет ника')], ['title', '🏷 ' + L('Unvonlar', 'Titles', 'Титулы')]];
    var h = '<div class="x-shop-bal"><span>🪙 <b>' + (S.coins || 0) + '</b></span><span>💎 <b>' + (S.gems || 0) + '</b></span></div>';
    groups.forEach(function (g) {
      h += '<div class="x-sec-t">' + g[1] + '</div><div class="x-shop-grid">';
      SHOP.filter(function (x) { return x.kind === g[0]; }).forEach(function (it) {
        var own = st.owned.indexOf(it.id) !== -1, on = st[it.kind] === it.id;
        var prev = it.kind === 'frame' ? '<div class="x-shop-av xf-' + it.v + '">' + H((getDisplayUsername() || '?').charAt(0).toUpperCase()) + '</div>'
          : it.kind === 'nick' ? '<div class="x-shop-nk xn-' + it.v + '">' + H(getDisplayUsername() || 'Nick') + '</div>'
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
    var reviews = Object.keys(S.reviews || {}).filter(function (k) { return k.slice(0, 7) === ym; }).length;
    var water = 0, wDays = 0; Object.keys(S.health || {}).forEach(function (k) { if (k.slice(0, 7) === ym && S.health[k].water) { water += S.health[k].water; wDays++; } });
    var focus = 0; Object.keys(S.focusLog || {}).forEach(function (k) { if (k.slice(0, 7) === ym) focus += S.focusLog[k] || 0; });
    var mood = null; try { var ms = (typeof getMoods === 'function' ? getMoods() : S.moods) || {}; var cnt = {}; Object.keys(ms).forEach(function (k) { if (k.slice(0, 7) === ym) { var m = ms[k] && (ms[k].emoji || ms[k].mood || ms[k]); if (typeof m === 'string' && m.length <= 4) cnt[m] = (cnt[m] || 0) + 1; } }); var mk = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0]; if (mk) mood = mk; } catch (e) {}
    return { ym: ym, tasks: tasks, active: active, bestDay: bestDay, bestV: bestV, coins: coins, pomoMin: pomoMin, top: top, bosses: bosses, reviews: reviews, water: water, wDays: wDays, focus: focus, mood: mood };
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
      '<div class="x-wrap-brand">ToDoList · todolistorg.github.io</div></div>';
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
    F(30, 500); x.globalAlpha = .75; x.fillText('ToDoList · todolistorg.github.io', 80, Hh - 70); x.globalAlpha = 1;
    c.toBlob(function (blob) {
      if (!blob) return;
      var file = new File([blob], 'todolist-' + s.ym + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'ToDoList ' + ymLabel(s.ym) }).catch(function () {}); return; }
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
      try { document.title = (FX.running ? '🎯 ' + pad2(m) + ':' + pad2(s) + ' · ' : '') + 'ToDoList'; } catch (e) {}
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
    try { document.title = 'ToDoList'; } catch (e) {}
  }

  // =========================================================
  // 💧 15. SUV VA 😴 UYQU
  // =========================================================
  function hDay(ds) { S.health = S.health || {}; ds = ds || today(); S.health[ds] = S.health[ds] || {}; return S.health[ds]; }
  function waterGoal() { return S.waterGoal || 8; }
  function waterAdd(n) {
    var d = hDay(); d.water = Math.max(0, (d.water || 0) + n);
    if (n > 0 && d.water >= waterGoal() && !d.waterBonus) { d.waterBonus = true; addCoins(1, '💧 ' + L('Suv maqsadi', 'Water goal', 'Норма воды')); toast('💧 ' + L('Kunlik suv maqsadi bajarildi!', 'Daily water goal reached!', 'Дневная норма воды!') + ' +1 🪙'); try { confetti(); } catch (e) {} }
    save(); renderWaterPill(); renderHubSection('health');
  }
  function sleepSave() {
    var bed = (document.getElementById('x-sl-bed') || {}).value, wake = (document.getElementById('x-sl-wake') || {}).value;
    if (!bed || !wake) { toast('😴 ' + L('Yotish va turish vaqtini kiriting', 'Enter bed and wake times', 'Укажите время сна и подъёма')); return; }
    var mins = hm2m(wake) - hm2m(bed); if (mins <= 0) mins += 1440;
    var d = hDay(); d.bed = bed; d.wake = wake; d.sleep = Math.round(mins / 6) / 10;
    if (d.sleep >= 7 && d.sleep <= 10 && !d.sleepBonus) { d.sleepBonus = true; addCoins(1, '😴 ' + L('Yaxshi uyqu', 'Good sleep', 'Хороший сон')); toast('😴 ' + d.sleep + ' ' + L('soat — zo\'r!', 'h — great!', 'ч — отлично!') + ' +1 🪙'); }
    else toast('😴 ' + d.sleep + ' ' + L('soat saqlandi', 'h saved', 'ч сохранено'));
    S.lastBed = bed; S.lastWake = wake;
    save(); renderHubSection('health');
  }
  function healthHtml() {
    var d = hDay(), g = waterGoal(), w = d.water || 0;
    var cups = ''; for (var i = 0; i < Math.max(g, w); i++) cups += '<button class="x-cup ' + (i < w ? 'full' : '') + '" data-cup="' + i + '">' + (i < w ? '💧' : '○') + '</button>';
    var h = '<div class="x-card"><div class="x-card-h"><b>💧 ' + L('Suv', 'Water', 'Вода') + '</b><span>' + w + ' / ' + g + ' ' + L('stakan', 'glasses', 'стаканов') + '</span></div>' +
      '<div class="x-cups">' + cups + '</div><div class="x-row"><button class="x-btn" data-w="1">＋ 1 ' + L('stakan', 'glass', 'стакан') + '</button><button class="x-btn ghost" data-w="-1">－</button>' +
      '<label class="x-goal">🎯 <input type="number" min="1" max="20" id="x-wgoal" value="' + g + '"></label></div></div>';
    var sl = d.sleep;
    h += '<div class="x-card"><div class="x-card-h"><b>😴 ' + L('Uyqu (bugun tunda)', 'Sleep (last night)', 'Сон (прошлой ночью)') + '</b><span>' + (sl != null ? sl + ' ' + L('soat', 'h', 'ч') : '—') + '</span></div>' +
      '<div class="x-row"><label class="x-tlab">🛏 <input type="time" id="x-sl-bed" value="' + (d.bed || S.lastBed || '23:00') + '"></label><label class="x-tlab">⏰ <input type="time" id="x-sl-wake" value="' + (d.wake || S.lastWake || '07:00') + '"></label>' +
      '<button class="x-btn" id="x-sl-save">💾</button></div>';
    var vals = [], lbls = [], ws = [], sum = 0, cnt = 0;
    for (var k = 6; k >= 0; k--) { var ds = addDays(today(), -k), hd = (S.health || {})[ds] || {}; vals.push(hd.sleep || 0); ws.push(hd.water || 0); lbls.push(weekdaysShort()[(parseD(ds).getDay() + 6) % 7]); if (hd.sleep) { sum += hd.sleep; cnt++; } }
    h += bars(vals, lbls, 6, 'h') + '<div class="x-sub">' + L('7 kunlik o\'rtacha', '7-day average', 'Среднее за 7 дней') + ': <b>' + (cnt ? (sum / cnt).toFixed(1) + ' ' + L('soat', 'h', 'ч') : '—') + '</b> · ' + L('Tavsiya: 7–9 soat', 'Recommended: 7–9 h', 'Рекомендуется 7–9 ч') + '</div></div>';
    h += '<div class="x-card"><div class="x-card-h"><b>💧 ' + L('Suv — 7 kun', 'Water — 7 days', 'Вода — 7 дней') + '</b></div>' + bars(ws, lbls, 6) + '</div>';
    return h;
  }
  function bindHealth(root) {
    root.querySelectorAll('[data-w]').forEach(function (b) { b.onclick = function () { waterAdd(+b.dataset.w); }; });
    root.querySelectorAll('[data-cup]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.cup, cur = hDay().water || 0; waterAdd(i < cur ? (i + 1 === cur ? -1 : i + 1 - cur) : i + 1 - cur); }; });
    var g = root.querySelector('#x-wgoal'); if (g) g.onchange = function () { S.waterGoal = Math.max(1, Math.min(20, +g.value || 8)); save(); renderWaterPill(); renderHubSection('health'); };
    var sv = root.querySelector('#x-sl-save'); if (sv) sv.onclick = sleepSave;
  }
  function renderWaterPill() {
    var el = document.getElementById('x-water-pill'); if (!el) return;
    var w = (hDay().water || 0), g = waterGoal();
    el.innerHTML = '💧 ' + w + '/' + g;
    el.classList.toggle('done', w >= g);
  }

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
    ['insights', '📊', ['Tahlil', 'Insights', 'Аналитика']],
    ['health', '💧', ['Salomatlik', 'Health', 'Здоровье']],
    ['shop', '🛍', ['Do\'kon', 'Shop', 'Магазин']],
    ['together', '🤝', ['Birga', 'Together', 'Вместе']],
    ['feed', '📰', ['Lenta', 'Feed', 'Лента']]
  ];
  function renderHub() {
    var v = document.getElementById('view-hub'); if (!v) return;
    var sec = S.xHubSec || 'boss';
    var tools = [['wrap', '📅', L('Oylik yakun', 'Monthly wrap', 'Итоги месяца')], ['focus', '🎯', L('Fokus', 'Focus', 'Фокус')], ['review', '🌙', L('Kun yakuni', 'Evening review', 'Итоги дня')],
      ['tpl', '📑', L('Shablonlar', 'Templates', 'Шаблоны')], ['matrix', '▦', L('Matritsa', 'Matrix', 'Матрица')]];
    v.innerHTML = '<div class="x-hub-tools">' + tools.map(function (t) { return '<button data-tool="' + t[0] + '"><span>' + t[1] + '</span>' + t[2] + '</button>'; }).join('') + '</div>' +
      '<div class="x-hub-nav">' + HUB_SECS.map(function (s) { return '<button class="' + (s[0] === sec ? 'on' : '') + '" data-sec="' + s[0] + '">' + s[1] + ' ' + L(s[2][0], s[2][1], s[2][2]) + '</button>'; }).join('') + '</div>' +
      '<div id="x-hub-body"></div>';
    v.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { ({ wrap: function () { openWrap(); }, focus: function () { openFocus(); }, review: openReview, tpl: openTemplates, matrix: openMatrix })[b.dataset.tool](); }; });
    v.querySelectorAll('[data-sec]').forEach(function (b) { b.onclick = function () { S.xHubSec = b.dataset.sec; save(); renderHub(); }; });
    renderHubSection(sec, true);
  }
  function renderHubSection(sec, force) {
    var body = document.getElementById('x-hub-body'); if (!body) return;
    if (!force && (S.xHubSec || 'boss') !== sec) return;
    var h = '';
    if (sec === 'boss') {
      h = '<div class="x-card" id="x-hub-boss">' + bossHtml(true) + '</div><label class="x-chk"><input type="checkbox" id="x-boss-strip-on" ' + (S.xBossHidden ? '' : 'checked') + '> ' + L('Vazifalar sahifasida boss panelini ko\'rsatish', 'Show boss bar on the Tasks page', 'Показывать босса на странице задач') + '</label>';
    } else if (sec === 'insights') {
      h = '<div class="x-card"><div class="x-card-h"><b>🔥 ' + L('Yillik faollik', 'Yearly activity', 'Активность за год') + '</b></div>' + heatmapHtml() + '</div>' +
        '<div class="x-card"><div class="x-card-h"><b>⏰ ' + L('Eng samarali vaqt', 'Productive time', 'Продуктивное время') + '</b></div>' + productiveHtml() + '</div>' +
        '<div class="x-card"><div class="x-card-h"><b>🔗 ' + L('Odatlar bog\'liqligi', 'Habit links', 'Связи привычек') + '</b></div>' + correlationHtml() + '</div>';
    } else if (sec === 'health') {
      h = healthHtml();
    } else if (sec === 'shop') {
      h = '<div class="x-card">' + shopHtml() + '</div>';
    } else if (sec === 'together') {
      h = '<div id="x-hub-shared"></div>';
    } else if (sec === 'feed') {
      h = '<div id="x-hub-feed"></div>';
    }
    body.innerHTML = h;
    if (sec === 'health') bindHealth(body);
    if (sec === 'shop') body.querySelectorAll('[data-shop]').forEach(function (b) { b.onclick = function () { shopBuy(b.dataset.shop); }; });
    if (sec === 'boss') { var c = body.querySelector('#x-boss-strip-on'); if (c) c.onchange = function () { S.xBossHidden = !this.checked; save(); renderBossStrip(); }; }
    if (sec === 'together') { if (sharedCache && !force) renderShared(); else loadShared(); }
    if (sec === 'feed') { if (feedCache && !force) renderFeed(); else loadFeed(); }
    if (sec === 'insights') { var sc = body.querySelector('.x-hm-scroll'); if (sc) sc.scrollLeft = sc.scrollWidth; }
  }

  // =========================================================
  // Vazifalar sahifasidagi qo'shimchalar
  // =========================================================
  function renderTasksExtras() {
    renderBossStrip(false);
    renderWaterPill();
    var LB = { focus: L('Fokus', 'Focus', 'Фокус'), matrix: L('Matritsa', 'Matrix', 'Матрица'), tpl: L('Shablonlar', 'Templates', 'Шаблоны'), review: L('Kun yakuni', 'Review', 'Итоги дня') };
    document.querySelectorAll('.x-tl[data-x]').forEach(function (e) { if (LB[e.dataset.x]) e.textContent = LB[e.dataset.x]; });
    var rbt = document.querySelector('.x-rb-t'); if (rbt) rbt.textContent = L('Kunni yakunlash vaqti — 2 daqiqa ajrating', 'Time to wrap up your day — take 2 minutes', 'Пора подвести итоги дня — 2 минуты');
    var bn = document.getElementById('x-review-banner');
    if (bn) {
      var show = new Date().getHours() >= 20 && !reviewDoneToday() && S.xReviewDismiss !== today();
      bn.style.display = show ? '' : 'none';
    }
  }

  // ---------- script.js ulanish nuqtalari ----------
  window.xRenderHub = safe(renderHub);
  window.xRenderTasksExtras = safe(renderTasksExtras);
  window.xOnTaskDone = safe(function (tsk, on) {
    bossHit(tsk, on);
    if (on) {
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
  window.xOpenTemplates = safe(openTemplates);
  window.xOpenMatrix = safe(openMatrix);
  window.xOpenReview = safe(openReview);
  window.xOpenWrap = safe(function (ym) { openWrap(ym); });
  window.xOpenFocus = safe(function (id) { openFocus(id); });
  window.xWaterAdd = safe(waterAdd);
  window.xDismissReview = function () { S.xReviewDismiss = today(); save(); renderTasksExtras(); };
  window.xOpenHub = function (sec) { if (sec) S.xHubSec = sec; showTab('hub'); };

  function boot() {
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
