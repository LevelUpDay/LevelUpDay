// ============================================================
// 🎓 EXAM PREP — IELTS / SAT / CEFR dashboard
//   Hero (countdown + target ring + readiness), ko'nikmalar breakdown,
//   mock test jurnali + SVG progress grafigi, haftalik o'qish rejasi
//   (sessiyalar + Pomodoro daqiqalari), zaif ko'nikma va keyingi qadam,
//   kunlik maslahat, lug'at (flashcard) — IELTS/CEFR uchun.
// Mavjud ma'lumotlar o'zgarmaydi: S.ieltsResults, S.satResults,
// S.cefr.history, S.examDates. Yangi ma'lumotlar: S.examPrep
//   { sessions:[{id,exam,skill,min,date}], goalH:{exam:h}, pomo:{exam:bool},
//     notes:{exam:{date:text}}, words:[{id,exam,w,m,ex,st,n,d}] }
// script.js dan KEYIN yuklanadi (global S, save, today, esc, _cl ...).
// ============================================================
(function () {
  'use strict';

  var L = function (uz, en, ru) { return _cl(uz, en, ru); };
  var H = function (s) { return esc(s == null ? '' : String(s)); };
  var T3 = function (a) { return L(a[0], a[1], a[2]); };
  var EXAMS = ['ielts', 'sat', 'cefr'];
  var LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  function holdAsk(msgHtml, onOk) {
    if (typeof showHoldConfirmModal === 'function') return showHoldConfirmModal(msgHtml, onOk, { icon: '🗑️' });
    var tmp = document.createElement('div'); tmp.innerHTML = msgHtml;
    if (confirm(tmp.textContent)) onOk();
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dkey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseD(ds) { return new Date(ds + 'T00:00:00'); }
  function addD(ds, n) { var d = parseD(ds); d.setDate(d.getDate() + n); return dkey(d); }
  function mondayOf(ds) { var d = parseD(ds); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
  function tdy() { try { return today(); } catch (e) { return dkey(new Date()); } }
  function months() { try { return getMonthsFullArr(); } catch (e) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; } }
  function shortDate(ds, withYear) {
    if (!ds) return '—';
    var d = parseD(ds); if (isNaN(d)) return ds;
    var m = months()[d.getMonth()] || '';
    return d.getDate() + ' ' + m.slice(0, 3) + (withYear ? ' ' + d.getFullYear() : '');
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function weekdaysShort() { return [L('Du', 'Mo', 'Пн'), L('Se', 'Tu', 'Вт'), L('Ch', 'We', 'Ср'), L('Pa', 'Th', 'Чт'), L('Ju', 'Fr', 'Пт'), L('Sh', 'Sa', 'Сб'), L('Ya', 'Su', 'Вс')]; }
  function dayIdx() { return Math.floor(parseD(tdy()).getTime() / 86400000); }
  function ieltsRound(avg) { return Math.round(avg * 2) / 2; } // .25 -> .5, .75 -> keyingi butun (rasmiy qoida)

  // ---------------- Ma'lumot ----------------
  function ep() {
    if (!S.examPrep || typeof S.examPrep !== 'object') S.examPrep = {};
    var x = S.examPrep;
    if (!Array.isArray(x.sessions)) x.sessions = [];
    if (!Array.isArray(x.words)) x.words = [];
    if (!x.goalH || typeof x.goalH !== 'object') x.goalH = {};
    if (!x.pomo || typeof x.pomo !== 'object') x.pomo = {};
    if (!x.notes || typeof x.notes !== 'object') x.notes = {};
    return x;
  }
  function uid() { return Date.now() * 100 + Math.floor(Math.random() * 100); }

  var SKILLS = {
    ielts: [
      { k: 'listening', e: '🎧', n: 'Listening', c: '#60A5FA' },
      { k: 'reading', e: '📖', n: 'Reading', c: '#34D399' },
      { k: 'writing', e: '✍️', n: 'Writing', c: '#F5A623' },
      { k: 'speaking', e: '🗣️', n: 'Speaking', c: '#F87171' }
    ],
    sat: [
      { k: 'rw', e: '📚', n: 'Reading & Writing', c: '#B48EFF' },
      { k: 'math', e: '🧮', n: 'Math', c: '#34D399' }
    ],
    cefr: [
      { k: 'listening', e: '🎧', n: 'Listening', c: '#60A5FA' },
      { k: 'reading', e: '📖', n: 'Reading', c: '#34D399' },
      { k: 'writing', e: '✍️', n: 'Writing', c: '#F5A623' },
      { k: 'speaking', e: '🗣️', n: 'Speaking', c: '#F87171' }
    ]
  };
  var EXTRA_SKILLS = function (exam) {
    var a = [{ k: 'mock', e: '🧩', n: L('Mock test', 'Mock test', 'Пробный тест'), c: '#B48EFF' }];
    if (exam !== 'sat') a.unshift({ k: 'vocab', e: '🔤', n: L("Lug'at", 'Vocabulary', 'Словарь'), c: '#22D3EE' });
    return a;
  };
  function skillMeta(exam, k) {
    var all = SKILLS[exam].concat(EXTRA_SKILLS(exam));
    for (var i = 0; i < all.length; i++) if (all[i].k === k) return all[i];
    return { k: k, e: '📌', n: k, c: '#B48EFF' };
  }
  var TITLE = { ielts: '📊 IELTS', sat: '📐 SAT', cefr: '📘 CEFR' };

  // Ballni sonli ko'rinishda (CEFR: A1=1 ... C2=6)
  function rank(level) { var i = LEVELS.indexOf(level); return i === -1 ? null : i + 1; }
  function fmt(exam, v) {
    if (v == null || isNaN(v)) return '—';
    if (exam === 'ielts') return (Math.round(v * 2) / 2).toFixed(1);
    if (exam === 'sat') return String(Math.round(v));
    return LEVELS[clamp(Math.round(v), 1, 6) - 1];
  }
  function scaleOf(exam, overall) {
    if (exam === 'ielts') return { min: 0, max: 9 };
    if (exam === 'sat') return overall ? { min: 400, max: 1600 } : { min: 200, max: 800 };
    return { min: 0, max: 6 };
  }

  function sortAsc(a, b) { var da = a.date || '', db = b.date || ''; if (da < db) return -1; if (da > db) return 1; return (a.id || 0) - (b.id || 0); }

  // Raw yozuvlari (har biri bitta ko'nikma) — imtihon turiga qarab
  function rawEntries(exam) {
    if (exam === 'ielts') return (S.ieltsResults || []).slice();
    if (exam === 'sat') return (S.satResults || []).slice();
    try { ensureCefrDefaults(); } catch (e) {}
    return ((S.cefr && S.cefr.history) || []).slice();
  }
  // Mock uchun yaroqli yozuv -> sonli qiymat
  function entryValue(exam, r) {
    if (exam === 'ielts') {
      if (r.band === null || r.band === undefined || isNaN(Number(r.band))) return null;
      if (r.subSection && r.subSection !== 'all') {
        // Writing/Speaking task/part bandlari ham ko'nikma ko'rsatkichi sifatida olinadi
        if (r.section === 'writing' || r.section === 'speaking') return Number(r.band);
        return null;
      }
      return Number(r.band);
    }
    if (exam === 'sat') return (r.score == null || isNaN(Number(r.score))) ? null : Number(r.score);
    return rank(r.level);
  }

  // Sana bo'yicha guruhlangan mock'lar (eski -> yangi)
  function mocks(exam) {
    var by = {}, out = [], notes = ep().notes[exam] || {};
    rawEntries(exam).sort(sortAsc).forEach(function (r) {
      var v = entryValue(exam, r); if (v === null) return;
      var d = r.date || '';
      if (!by[d]) { by[d] = { date: d, vals: {}, ids: [], full: null }; out.push(by[d]); }
      by[d].ids.push(r.id);
      if (exam === 'cefr' && r.section === 'full') { by[d].full = v; return; }
      (by[d].vals[r.section] = by[d].vals[r.section] || []).push(v);
    });
    out.forEach(function (m) {
      m.scores = {};
      Object.keys(m.vals).forEach(function (k) {
        var a = m.vals[k], avg = a.reduce(function (s, x) { return s + x; }, 0) / a.length;
        m.scores[k] = exam === 'ielts' ? ieltsRound(avg) : (exam === 'sat' ? Math.round(avg / 10) * 10 : Math.round(avg));
      });
      var sk = SKILLS[exam].filter(function (s) { return m.scores[s.k] !== undefined; });
      m.complete = sk.length === SKILLS[exam].length;
      if (exam === 'sat') {
        m.overall = m.complete ? m.scores.rw + m.scores.math : null;
      } else if (exam === 'cefr' && m.full !== null && !m.complete) {
        m.overall = m.full; m.complete = true;
      } else if (sk.length) {
        var sum = sk.reduce(function (s, x) { return s + m.scores[x.k]; }, 0);
        m.overall = exam === 'ielts' ? ieltsRound(sum / sk.length) : Math.round(sum / sk.length);
      } else m.overall = null;
      m.note = notes[m.date] || '';
    });
    return out;
  }

  // Har ko'nikmaning joriy (oxirgi) ko'rsatkichi
  function currentSkills(exam) {
    var res = {};
    if (exam === 'ielts') {
      var all = S.ieltsResults || [];
      SKILLS.ielts.forEach(function (s) {
        var b = null;
        try { b = calcSectionBandFromParts(s.k, all, 1); } catch (e) {}
        if (b !== null && !isNaN(b)) res[s.k] = b;
      });
      return res;
    }
    rawEntries(exam).sort(sortAsc).forEach(function (r) {
      var v = entryValue(exam, r); if (v === null || r.section === 'full') return;
      res[r.section] = v;
    });
    return res;
  }
  function currentOverall(exam, cur, ms) {
    var ks = SKILLS[exam].map(function (s) { return s.k; });
    var have = ks.filter(function (k) { return cur[k] !== undefined; });
    if (have.length === ks.length) {
      var sum = have.reduce(function (s, k) { return s + cur[k]; }, 0);
      if (exam === 'sat') return { v: sum, exact: true };
      return { v: exam === 'ielts' ? ieltsRound(sum / ks.length) : Math.round(sum / ks.length), exact: true };
    }
    if (exam === 'cefr') {
      for (var i = ms.length - 1; i >= 0; i--) if (ms[i].full !== null) return { v: ms[i].full, exact: true };
    }
    if (have.length && exam !== 'sat') {
      var s2 = have.reduce(function (s, k) { return s + cur[k]; }, 0);
      return { v: exam === 'ielts' ? ieltsRound(s2 / have.length) : Math.round(s2 / have.length), exact: false };
    }
    return null;
  }
  function examInfo(exam) {
    var d = null;
    try { d = getExamDate(exam); } catch (e) {}
    var target = null, tRaw = d && d.target;
    if (exam === 'cefr') { if (!tRaw && S.cefr && S.cefr.targetLevel) tRaw = S.cefr.targetLevel; target = rank(tRaw); }
    else if (tRaw !== '' && tRaw != null) { var n = parseFloat(String(tRaw).replace(',', '.')); if (!isNaN(n)) target = n; }
    return { date: d && d.date ? d.date : null, target: target, savedAt: d && d.savedAt };
  }
  function skillTarget(exam, target) {
    if (target == null) return null;
    if (exam === 'sat') return Math.round(target / 2 / 10) * 10;
    return target;
  }

  // ---------------- O'qish sessiyalari ----------------
  var POMO_RX = { ielts: /ielts/i, sat: /\bSAT\b/i, cefr: /cefr/i };
  function pomoUse(exam) { return ep().pomo[exam] !== false; }
  function pomoByDay(exam) {
    var out = {};
    if (!pomoUse(exam)) return out;
    var raw = []; try { raw = JSON.parse(localStorage.getItem('pomoLogs') || '[]'); } catch (e) {}
    (Array.isArray(raw) ? raw : []).forEach(function (l) {
      if (!l || !l.date || !POMO_RX[exam].test(String(l.actName || ''))) return;
      var ms = (Number(l.durationMs) || 0) - (Number(l.catchUpMs) || 0);
      if (ms <= 0) return;
      out[l.date] = (out[l.date] || 0) + Math.min(ms, 3 * 3600000) / 60000;
    });
    Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k]); });
    return out;
  }
  function studyByDay(exam) {
    var by = {};
    ep().sessions.forEach(function (s) { if (s.exam === exam && s.date) by[s.date] = (by[s.date] || 0) + (Number(s.min) || 0); });
    var p = pomoByDay(exam);
    Object.keys(p).forEach(function (k) { by[k] = (by[k] || 0) + p[k]; });
    return { all: by, pomo: p };
  }
  function study(exam) {
    var sb = studyByDay(exam), by = sb.all, td = tdy(), mon = mondayOf(td);
    var week = [], wk = 0, wkPomo = 0;
    for (var i = 0; i < 7; i++) { var dk = addD(mon, i); var m = by[dk] || 0; week.push({ d: dk, m: m }); wk += m; wkPomo += sb.pomo[dk] || 0; }
    var streak = 0, cur = by[td] ? td : addD(td, -1);
    while (by[cur] > 0) { streak++; cur = addD(cur, -1); }
    var goalH = Number(ep().goalH[exam]); if (!(goalH > 0)) goalH = exam === 'sat' ? 6 : 5;
    var bySkill = {};
    ep().sessions.forEach(function (s) { if (s.exam === exam && s.date >= mon) bySkill[s.skill] = (bySkill[s.skill] || 0) + (Number(s.min) || 0); });
    return { week: week, weekMin: wk, weekPomo: wkPomo, streak: streak, goalH: goalH, todayMin: by[td] || 0, bySkill: bySkill };
  }

  // ---------------- Maslahatlar va harakatlar ----------------
  var TIPS = {
    ielts: {
      listening: [
        ["Har kuni bitta Cambridge Listening section'ini yeching va skript bilan tekshiring.", "Do one Cambridge Listening section daily, then check it against the transcript.", "Каждый день решайте одну секцию Cambridge Listening и сверяйте со скриптом."],
        ["Audio boshlanishidan oldin savollardagi kalit so'zlarni belgilang.", "Underline keywords in the questions before the audio starts.", "Подчёркивайте ключевые слова в вопросах до начала аудио."],
        ["Imlo xatosi ball yo'qotadi — raqam, sana va ismlarni yozishni mashq qiling.", "Spelling costs points — practise writing numbers, dates and names.", "Орфография стоит баллов — тренируйте запись чисел, дат и имён."]
      ],
      reading: [
        ["Avval matnni 2 daqiqada ko'zdan kechiring (skimming), keyin javob qidiring.", "Skim the passage for 2 minutes first, then scan for the answers.", "Сначала просмотрите текст за 2 минуты, затем ищите ответы."],
        ["True/False/Not Given: faqat matnda yozilganga tayaning.", "True/False/Not Given: rely only on what the text actually says.", "True/False/Not Given: опирайтесь только на то, что сказано в тексте."],
        ["Har passage uchun 20 daqiqa — vaqtni qat'iy kuzating.", "Give each passage 20 minutes — keep strict time.", "На каждый текст — 20 минут, строго следите за временем."]
      ],
      writing: [
        ["Task 2: 5 daqiqa reja — kirish, 2 ta asosiy paragraf, xulosa.", "Task 2: spend 5 minutes planning — intro, two body paragraphs, conclusion.", "Task 2: 5 минут на план — вступление, два абзаца, вывод."],
        ["Task 1'da umumiy tendensiyani (overview) albatta yozing.", "Always include a clear overview in Task 1.", "В Task 1 обязательно пишите общий обзор (overview)."],
        ["Bitta insho yozing va uni band descriptor bo'yicha o'zingiz baholang.", "Write one essay and self-grade it with the band descriptors.", "Напишите эссе и оцените его по band descriptors."]
      ],
      speaking: [
        ["Part 2: 1 daqiqa reja, keyin 2 daqiqa to'xtovsiz gapiring.", "Part 2: plan for 1 minute, then speak for 2 minutes non-stop.", "Part 2: минута на план, затем 2 минуты говорите без пауз."],
        ["Javoblaringizni yozib oling va qayta tinglab xatolarni toping.", "Record your answers and listen back for mistakes.", "Записывайте ответы и переслушивайте, ищите ошибки."],
        ["Javobni sabab va misol bilan kengaytiring.", "Extend every answer with a reason and an example.", "Расширяйте ответы причиной и примером."]
      ]
    },
    sat: {
      math: [
        ["Desmos kalkulyatori bilan ishlashni mashq qiling — vaqtni tejaydi.", "Practise with the built-in Desmos calculator — it saves time.", "Тренируйтесь с калькулятором Desmos — это экономит время."],
        ["Xato qilgan har bir masalani 'xatolar daftari'ga yozing.", "Log every missed question in an error notebook.", "Записывайте каждую ошибку в тетрадь ошибок."],
        ["Chiziqli tenglamalar va algebra — eng ko'p uchraydigan mavzular.", "Linear equations and algebra are the most tested topics — master them.", "Линейные уравнения и алгебра — самые частые темы."]
      ],
      rw: [
        ["Har kuni 10 ta 'Words in Context' savolini yeching.", "Do 10 Words-in-Context questions every day.", "Решайте 10 вопросов Words in Context каждый день."],
        ["Tinish belgilari va subject–verb agreement qoidalarini takrorlang.", "Review punctuation and subject–verb agreement rules.", "Повторите пунктуацию и согласование подлежащего со сказуемым."],
        ["Har bir javobni matndagi dalil bilan tasdiqlang — taxmin qilmang.", "Back every answer with evidence from the passage — don't guess.", "Подтверждайте каждый ответ фактом из текста — не угадывайте."]
      ]
    },
    cefr: {
      listening: [
        ["Kuniga 15 daqiqa ingliz tilida podkast tinglang.", "Listen to an English podcast for 15 minutes a day.", "Слушайте английский подкаст 15 минут в день."],
        ["Subtitrsiz qisqa video ko'ring, so'ng mazmunini aytib bering.", "Watch a short video without subtitles, then summarise it.", "Посмотрите короткое видео без субтитров и перескажите его."]
      ],
      reading: [
        ["Har kuni bitta qisqa maqola o'qing va 5 ta yangi so'z yozib oling.", "Read one short article daily and note 5 new words.", "Читайте одну короткую статью в день и выписывайте 5 новых слов."],
        ["Matnning asosiy fikrini bitta gapda ifodalang.", "Summarise the main idea of a text in one sentence.", "Сформулируйте главную мысль текста одним предложением."]
      ],
      writing: [
        ["Har kuni 100 so'zli matn yozing (email yoki fikr).", "Write a 100-word text every day (an email or an opinion).", "Пишите текст на 100 слов каждый день (письмо или мнение)."],
        ["Bog'lovchi so'zlarni ishlating: however, therefore, moreover.", "Use linking words: however, therefore, moreover.", "Используйте связки: however, therefore, moreover."]
      ],
      speaking: [
        ["Shadowing: 3 daqiqa ona tilida so'zlashuvchidan keyin takrorlang.", "Shadowing: repeat after a native speaker for 3 minutes.", "Shadowing: 3 минуты повторяйте за носителем языка."],
        ["Kuningizni ovoz chiqarib ingliz tilida tasvirlab bering.", "Describe your day out loud in English.", "Опишите свой день вслух на английском."]
      ]
    }
  };
  var ACTIONS = {
    ielts: {
      listening: ["Bugun: Listening Part 3–4 to'liq section + skript tahlili", "Today: a full Listening Part 3–4 section + transcript review", "Сегодня: полная секция Listening Part 3–4 + разбор скрипта"],
      reading: ["Bugun: 1 ta Reading passage 20 daqiqada + T/F/NG savollar", "Today: one Reading passage in 20 minutes + T/F/NG questions", "Сегодня: один текст Reading за 20 минут + вопросы T/F/NG"],
      writing: ["Bugun: Writing Task 2 insho mashqi (40 daqiqa)", "Writing Task 2 essay practice today (40 min)", "Сегодня: эссе Writing Task 2 (40 минут)"],
      speaking: ["Bugun: Speaking Part 2 — 3 ta cue card, ovozingizni yozib oling", "Today: Speaking Part 2 — 3 cue cards, record yourself", "Сегодня: Speaking Part 2 — 3 карточки, запишите себя"]
    },
    sat: {
      math: ["Bugun: 20 ta algebra savoli (vaqt bilan)", "Today: 20 timed algebra questions", "Сегодня: 20 задач по алгебре на время"],
      rw: ["Bugun: 1 ta Reading & Writing modul (27 savol, 32 daqiqa)", "Today: one Reading & Writing module (27 Q, 32 min)", "Сегодня: один модуль Reading & Writing (27 вопросов, 32 мин)"]
    },
    cefr: {
      listening: ["Bugun: 20 daqiqa audio + tushunish savollari", "Today: 20 minutes of audio + comprehension questions", "Сегодня: 20 минут аудио + вопросы на понимание"],
      reading: ["Bugun: 2 ta matn o'qing va yangi so'zlarni lug'atga qo'shing", "Today: read 2 texts and add new words to your word bank", "Сегодня: прочитайте 2 текста и добавьте новые слова в словарь"],
      writing: ["Bugun: 150 so'zli email yoki insho yozing", "Today: write a 150-word email or essay", "Сегодня: напишите письмо или эссе на 150 слов"],
      speaking: ["Bugun: 10 daqiqa mavzu bo'yicha gapiring va yozib oling", "Today: speak on a topic for 10 minutes and record it", "Сегодня: говорите на тему 10 минут и запишите себя"]
    }
  };

  function overallMocks(ms) {
    var withV = ms.filter(function (m) { return m.overall != null; });
    var full = withV.filter(function (m) { return m.complete; });
    return full.length ? full : withV;
  }
  function analyse(exam) {
    var ms = mocks(exam), cur = currentSkills(exam), info = examInfo(exam);
    var ov = currentOverall(exam, cur, ms);
    var tSkill = skillTarget(exam, info.target);
    var unit = exam === 'sat' ? 100 : 1;
    var weak = null, strong = null, missing = [];
    SKILLS[exam].forEach(function (s) {
      if (cur[s.k] === undefined) { missing.push(s); return; }
      var gap = tSkill != null ? (tSkill - cur[s.k]) / unit : -cur[s.k] / unit;
      if (!weak || gap > weak.gap) weak = { s: s, gap: gap };
      if (!strong || gap < strong.gap) strong = { s: s, gap: gap };
    });
    if (weak && strong && weak.s.k === strong.s.k) strong = null;
    // Overall statistikasi: to'liq mock'lar (bo'lmasa — qisman ham)
    var useMs = overallMocks(ms);
    var vals = useMs.map(function (m) { return m.overall; });
    var stats = vals.length ? {
      best: Math.max.apply(null, vals), latest: vals[vals.length - 1],
      avg: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, n: vals.length
    } : null;
    var st = study(exam);
    var scorePart = null;
    if (ov && info.target != null) {
      var floor = exam === 'ielts' ? 3 : (exam === 'sat' ? 400 : 0);
      scorePart = info.target <= floor ? 1 : clamp((ov.v - floor) / (info.target - floor), 0, 1);
    }
    var studyPart = clamp(st.weekMin / (st.goalH * 60), 0, 1);
    var readiness = scorePart == null ? null : Math.round(100 * (0.8 * scorePart + 0.2 * studyPart));
    return { ms: ms, cur: cur, ov: ov, info: info, tSkill: tSkill, weak: weak, strong: strong, missing: missing, stats: stats, st: st, scorePart: scorePart, readiness: readiness };
  }

  // ---------------- UI holati ----------------
  var UI = { series: {}, allMocks: {}, allWords: {}, sesSkill: {}, sesMin: {} };

  // ---------------- Render qismlari ----------------
  function ring(pct, centerTop, centerSub, color) {
    var r = 46, c = 2 * Math.PI * r, off = c * (1 - clamp(pct || 0, 0, 1));
    return '<div class="xp-ring"><svg viewBox="0 0 108 108" aria-hidden="true">' +
      '<circle cx="54" cy="54" r="' + r + '" class="xp-ring-bg"/>' +
      '<circle cx="54" cy="54" r="' + r + '" class="xp-ring-fg" style="stroke:' + (color || 'var(--accent)') + ';stroke-dasharray:' + c.toFixed(1) + ';stroke-dashoffset:' + off.toFixed(1) + '"/>' +
      '</svg><div class="xp-ring-c"><b>' + centerTop + '</b><span>' + centerSub + '</span></div></div>';
  }

  function countdown(info) {
    if (!info.date) return null;
    var ms = parseD(info.date).getTime() - Date.now();
    var dToday = Math.round((parseD(info.date) - parseD(tdy())) / 86400000);
    if (dToday < 0) return { past: true, days: -dToday };
    if (dToday === 0) return { today: true };
    return { days: Math.floor(ms / 86400000), hours: Math.floor((ms % 86400000) / 3600000) };
  }

  function heroHtml(exam, a) {
    var info = a.info, cd = countdown(info);
    var head = '<div class="xp-hero-top"><span class="xp-pill">' + TITLE[exam] + '</span>' +
      '<button type="button" class="xp-link" data-xp="setdate">✏️ ' + (info.date ? L('Sana va maqsad', 'Date & target', 'Дата и цель') : L('Sozlash', 'Set up', 'Настроить')) + '</button></div>';
    if (!info.date && !a.ms.length && !a.ov) {
      // Onboarding
      return '<section class="xp-card xp-hero xp-onb">' + head +
        '<h3 class="xp-onb-t">' + L("Imtihonga tayyorgarlikni boshlaymiz 🚀", "Let's plan your exam prep 🚀", 'Начнём подготовку к экзамену 🚀') + '</h3>' +
        '<ol class="xp-steps">' +
        '<li><b>1</b><div>' + L('Imtihon sanasi va maqsad ballni belgilang', 'Set your exam date and target score', 'Укажите дату экзамена и целевой балл') + '</div><button type="button" class="x-btn sm" data-xp="setdate">' + L('Belgilash', 'Set', 'Указать') + '</button></li>' +
        '<li><b>2</b><div>' + L('Birinchi mock test natijasini kiriting', 'Log your first mock test result', 'Внесите результат первого пробного теста') + '</div><button type="button" class="x-btn sm ghost" data-xp="addmock">+ Mock</button></li>' +
        '<li><b>3</b><div>' + L("Haftalik o'qish soatlari maqsadini qo'ying", 'Pick a weekly study-hours goal', 'Задайте недельную цель по часам') + '</div><button type="button" class="x-btn sm ghost" data-xp="goal">⏱</button></li>' +
        '</ol></section>';
    }
    var tgtTxt = info.target != null ? fmt(exam, info.target) : '—';
    var curTxt = a.ov ? (a.ov.exact ? '' : '≈') + fmt(exam, a.ov.v) : '—';
    var ringPct = a.scorePart != null ? a.scorePart : (a.ov ? (a.ov.v - scaleOf(exam, true).min) / (scaleOf(exam, true).max - scaleOf(exam, true).min) : 0);
    var ringCol = a.scorePart != null && a.scorePart >= 1 ? 'var(--green)' : 'var(--accent)';
    var ringHtml = ring(ringPct, H(curTxt), L('maqsad', 'target', 'цель') + ' ' + H(tgtTxt), ringCol);

    var cdHtml;
    if (!cd) cdHtml = '<button type="button" class="xp-cd-empty" data-xp="setdate">📅 ' + L('Imtihon sanasini kiriting', 'Add your exam date', 'Добавьте дату экзамена') + '</button>';
    else if (cd.past) cdHtml = '<div class="xp-cd"><div class="xp-cd-n">🎉</div><div class="xp-cd-l">' + L('Imtihon o\'tdi', 'Exam passed', 'Экзамен прошёл') + ' · ' + H(shortDate(info.date, true)) + '</div></div>';
    else if (cd.today) cdHtml = '<div class="xp-cd"><div class="xp-cd-n xp-hot">' + L('BUGUN', 'TODAY', 'СЕГОДНЯ') + '</div><div class="xp-cd-l">' + L('Omad! Siz tayyorsiz 💪', 'Good luck — you\'ve got this 💪', 'Удачи — вы готовы 💪') + '</div></div>';
    else cdHtml = '<div class="xp-cd"><div class="xp-cd-n"><b>' + cd.days + '</b><small>' + L('kun', 'd', 'дн') + '</small><b>' + cd.hours + '</b><small>' + L('soat', 'h', 'ч') + '</small></div>' +
      '<div class="xp-cd-l">' + L('imtihongacha', 'until exam', 'до экзамена') + ' · ' + H(shortDate(info.date, true)) + '</div></div>';

    var ready = a.readiness;
    var readyHtml = '<div class="xp-ready"><div class="xp-ready-h"><span>' + L('Tayyorgarlik', 'Readiness', 'Готовность') + '</span><b>' + (ready == null ? '—' : ready + '%') + '</b></div>' +
      '<div class="xp-bar"><i style="width:' + (ready || 0) + '%"></i></div>' +
      (ready == null ? '<div class="xp-mini">' + (info.target == null ? L('Maqsad ballni belgilang', 'Set a target score', 'Укажите целевой балл') : L('Mock natijasini kiriting', 'Log a mock result', 'Внесите результат теста')) + '</div>' : '') + '</div>';

    var chips = [];
    if (a.stats) {
      chips.push('<span>' + L('Oxirgi', 'Latest', 'Последний') + ' <b>' + fmt(exam, a.stats.latest) + '</b></span>');
      chips.push('<span>' + L('Eng yaxshi', 'Best', 'Лучший') + ' <b>' + fmt(exam, a.stats.best) + '</b></span>');
    }
    if (a.ov && info.target != null) {
      var gap = info.target - a.ov.v;
      if (gap > 0) chips.push('<span class="xp-warn">' + L('Kerak', 'Need', 'Нужно') + ' <b>+' + (exam === 'cefr' ? gap + ' ' + L('daraja', 'lvl', 'ур.') : fmt(exam, gap)) + '</b></span>');
      else chips.push('<span class="xp-ok">✓ ' + L('Maqsadga yetdingiz', 'On target', 'Цель достигнута') + '</span>');
    }
    return '<section class="xp-card xp-hero">' + head +
      '<div class="xp-hero-main">' + ringHtml + '<div class="xp-hero-side">' + cdHtml + readyHtml + '</div></div>' +
      (chips.length ? '<div class="xp-chips">' + chips.join('') + '</div>' : '') +
      '<div class="xp-hero-act"><button type="button" class="x-btn" data-xp="addmock">＋ ' + L("Mock natija qo'shish", 'Add mock result', 'Добавить пробный тест') + '</button>' +
      ((a.ms.length || a.ov) ? '<button type="button" class="x-btn ghost" data-xp="detail">📊 ' + L('Chuqur tahlil', 'Deep analysis', 'Детальный анализ') + '</button>' : '') + '</div>' +
      '</section>';
  }

  function nextActionHtml(exam, a) {
    var title, body, skillK = null;
    if (!a.ms.length && !Object.keys(a.cur).length) {
      title = L('Boshlang\'ich darajani aniqlang', 'Find your baseline', 'Определите стартовый уровень');
      body = L("To'liq mock test topshiring va natijani kiriting — shunda reja aniqroq bo'ladi.", 'Take a full mock test and log it — your plan gets smarter from there.', 'Пройдите полный пробный тест и внесите результат — план станет точнее.');
    } else if (a.missing.length) {
      skillK = a.missing[0].k;
      title = a.missing[0].e + ' ' + a.missing[0].n + ': ' + L("hali natija yo'q", 'no score yet', 'нет результата');
      body = T3(ACTIONS[exam][skillK]);
    } else if (a.weak) {
      skillK = a.weak.s.k;
      var onTarget = a.tSkill != null && a.weak.gap <= 0;
      title = onTarget ? L('Hammasi maqsadda — ritmni saqlang', 'All skills on target — keep the rhythm', 'Все навыки на уровне цели — держите ритм')
        : a.weak.s.e + ' ' + L('Zaif ko\'nikma: ', 'Weakest skill: ', 'Слабый навык: ') + a.weak.s.n;
      body = onTarget ? L("Haftada bitta to'liq mock test bilan formani saqlang.", 'Keep sharp with one full mock test a week.', 'Поддерживайте форму: один полный тест в неделю.') : T3(ACTIONS[exam][skillK]);
    }
    var tipSkill = skillK || SKILLS[exam][dayIdx() % SKILLS[exam].length].k;
    var tips = TIPS[exam][tipSkill] || [];
    var tip = tips.length ? T3(tips[dayIdx() % tips.length]) : '';
    var tm = skillMeta(exam, tipSkill);
    return '<section class="xp-card xp-next">' +
      '<div class="xp-next-ic">🎯</div><div class="xp-next-b"><div class="xp-k">' + L('Keyingi qadam', 'Next action', 'Следующий шаг') + '</div>' +
      '<div class="xp-next-t">' + H(title) + '</div><div class="xp-next-d">' + H(body) + '</div>' +
      (skillK ? '<button type="button" class="x-btn sm" data-xp="quicklog" data-skill="' + skillK + '">▶ ' + L('Bajarildi — 30 daq yozish', 'Done — log 30 min', 'Готово — записать 30 мин') + '</button>' : '<button type="button" class="x-btn sm" data-xp="addmock">＋ Mock</button>') +
      '</div></section>' +
      (tip ? '<section class="xp-card xp-tip"><div class="xp-k">💡 ' + L('Kun maslahati', 'Tip of the day', 'Совет дня') + ' · <span style="color:' + tm.c + '">' + H(tm.n) + '</span></div><div class="xp-tip-t">' + H(tip) + '</div></section>' : '');
  }

  function skillsHtml(exam, a) {
    var sc = scaleOf(exam, false), rows = '';
    var series = {};
    a.ms.forEach(function (m) { Object.keys(m.scores).forEach(function (k) { (series[k] = series[k] || []).push(m.scores[k]); }); });
    SKILLS[exam].forEach(function (s) {
      var v = a.cur[s.k], has = v !== undefined;
      var pct = has ? clamp((v - sc.min) / (sc.max - sc.min), 0, 1) * 100 : 0;
      var tp = a.tSkill != null ? clamp((a.tSkill - sc.min) / (sc.max - sc.min), 0, 1) * 100 : null;
      var ser = series[s.k] || [], delta = '';
      if (ser.length >= 2) {
        var dlt = ser[ser.length - 1] - ser[ser.length - 2];
        if (dlt) delta = '<em class="' + (dlt > 0 ? 'up' : 'down') + '">' + (dlt > 0 ? '▲' : '▼') + (exam === 'cefr' ? Math.abs(dlt) : fmt(exam, Math.abs(dlt))) + '</em>';
      }
      var badge = '';
      if (a.weak && a.weak.s.k === s.k && !(a.tSkill != null && a.weak.gap <= 0)) badge = '<span class="xp-tag weak">' + L('Fokus', 'Focus', 'Фокус') + '</span>';
      else if (a.strong && a.strong.s.k === s.k) badge = '<span class="xp-tag strong">' + L('Kuchli', 'Strong', 'Сильный') + '</span>';
      var reached = has && a.tSkill != null && v >= a.tSkill;
      rows += '<div class="xp-skill">' +
        '<div class="xp-skill-h"><span class="xp-skill-n">' + s.e + ' ' + H(s.n) + badge + '</span>' +
        '<span class="xp-skill-v">' + delta + '<b style="color:' + s.c + '">' + (has ? fmt(exam, v) : '—') + '</b>' +
        (a.tSkill != null ? '<small>/ ' + fmt(exam, a.tSkill) + '</small>' : '') + (reached ? ' <i class="xp-check">✓</i>' : '') + '</span></div>' +
        '<div class="xp-track"><i style="width:' + pct + '%;background:' + s.c + '"></i>' + (tp != null ? '<u style="left:' + tp + '%" title="target"></u>' : '') + '</div>' +
        '</div>';
    });
    var note = exam === 'ielts' ? L("Overall = 4 ko'nikma o'rtachasi, eng yaqin 0.5 gacha yaxlitlanadi (.25 → .5, .75 → yuqoriga).", 'Overall = average of 4 skills rounded to the nearest 0.5 (.25 rounds up to .5, .75 up to the next band).', 'Overall = среднее 4 навыков, округлённое до 0.5 (.25 → .5, .75 → вверх).')
      : exam === 'sat' ? L("Har bo'lim 200–800, jami 400–1600.", 'Each section 200–800, total 400–1600.', 'Каждый раздел 200–800, всего 400–1600.')
        : L('Darajalar A1 → C2. Maqsad chizig\'i — vertikal belgi.', 'Levels A1 → C2. The tick marks your target.', 'Уровни A1 → C2. Отметка — ваша цель.');
    var levelsAxis = exam === 'cefr' ? '<div class="xp-lvl-axis">' + LEVELS.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>' : '';
    return '<section class="xp-card"><div class="xp-sec-h"><h4>' + L("Ko'nikmalar", 'Skill breakdown', 'Навыки') + '</h4></div>' + rows + levelsAxis +
      '<div class="xp-foot">' + H(note) + '</div></section>';
  }

  function chartSvg(exam, pts, target, color) {
    var W = 320, Hh = 150, pl = 34, pr = 14, pt = 14, pb = 24;
    var vals = pts.map(function (p) { return p.v; });
    if (target != null) vals.push(target);
    var lo, hi, step;
    if (exam === 'cefr') { lo = 1; hi = 6; step = 1; }
    else if (exam === 'ielts') { lo = Math.max(0, Math.floor(Math.min.apply(null, vals) - 0.5)); hi = Math.min(9, Math.ceil(Math.max.apply(null, vals) + 0.5)); if (hi - lo < 2) { lo = Math.max(0, hi - 2); } step = (hi - lo) > 4 ? 1 : 0.5; }
    else {
      lo = Math.floor((Math.min.apply(null, vals) - 40) / 100) * 100; hi = Math.ceil((Math.max.apply(null, vals) + 40) / 100) * 100;
      lo = Math.max(pts[0] && pts[0].isSkill ? 200 : 400, lo); hi = Math.min(pts[0] && pts[0].isSkill ? 800 : 1600, hi); if (hi <= lo) hi = lo + 100;
      step = (hi - lo) > 400 ? 200 : 100;
    }
    var n = pts.length, iw = W - pl - pr, ih = Hh - pt - pb;
    var X = function (i) { return pl + (n === 1 ? iw / 2 : i * iw / (n - 1)); };
    var Y = function (v) { return pt + ih - (v - lo) / (hi - lo) * ih; };
    var g = '';
    for (var v = lo; v <= hi + 1e-9; v += step) {
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="xp-gl"/>' +
        '<text x="' + (pl - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" class="xp-ax" text-anchor="end">' + fmt(exam, v) + '</text>';
    }
    var tl = '';
    if (target != null && target >= lo && target <= hi) {
      tl = '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(target).toFixed(1) + '" y2="' + Y(target).toFixed(1) + '" class="xp-tl"/>' +
        '<text x="' + (pl + 4) + '" y="' + (Y(target) - 4).toFixed(1) + '" class="xp-tlt" text-anchor="start">🎯 ' + fmt(exam, target) + '</text>';
    }
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ');
    var area = n > 1 ? '<path d="' + path + ' L' + X(n - 1).toFixed(1) + ' ' + (pt + ih) + ' L' + X(0).toFixed(1) + ' ' + (pt + ih) + ' Z" fill="url(#xpg-' + exam + ')"/>' : '';
    var dots = pts.map(function (p, i) {
      var last = i === n - 1;
      return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (last ? 4.5 : 3) + '" class="' + (p.partial ? 'xp-dot-p' : 'xp-dot') + '" style="stroke:' + color + ';' + (p.partial ? '' : 'fill:' + color) + '"><title>' + H(shortDate(p.d, true)) + ': ' + fmt(exam, p.v) + '</title></circle>';
    }).join('');
    var lastLbl = n ? '<text x="' + Math.min(X(n - 1), W - pr - 4).toFixed(1) + '" y="' + (Y(pts[n - 1].v) - 9).toFixed(1) + '" class="xp-lv" text-anchor="' + (n === 1 ? 'middle' : 'end') + '">' + fmt(exam, pts[n - 1].v) + '</text>' : '';
    var xl = '<text x="' + X(0).toFixed(1) + '" y="' + (Hh - 6) + '" class="xp-ax" text-anchor="' + (n === 1 ? 'middle' : 'start') + '">' + H(shortDate(pts[0].d)) + '</text>' +
      (n > 1 ? '<text x="' + X(n - 1).toFixed(1) + '" y="' + (Hh - 6) + '" class="xp-ax" text-anchor="end">' + H(shortDate(pts[n - 1].d)) + '</text>' : '');
    return '<svg class="xp-chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="progress chart">' +
      '<defs><linearGradient id="xpg-' + exam + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".28"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      g + tl + area + (n > 1 ? '<path d="' + path + '" class="xp-line" style="stroke:' + color + '"/>' : '') + dots + lastLbl + xl + '</svg>';
  }

  function progressHtml(exam, a) {
    var sel = UI.series[exam] || 'overall';
    var tabs = [{ k: 'overall', n: 'Overall', c: 'var(--accent)' }].concat(SKILLS[exam].map(function (s) { return { k: s.k, n: exam === 'sat' ? (s.k === 'rw' ? 'R&W' : 'Math') : s.n.charAt(0), c: s.c, full: s.n }; }));
    var seg = '<div class="xp-seg" role="tablist">' + tabs.map(function (tb) {
      return '<button type="button" role="tab" aria-selected="' + (tb.k === sel) + '" class="' + (tb.k === sel ? 'on' : '') + '" data-xp="series" data-k="' + tb.k + '" title="' + H(tb.full || tb.n) + '">' + H(tb.n) + '</button>';
    }).join('') + '</div>';
    var pts = [];
    if (sel === 'overall') overallMocks(a.ms).forEach(function (m) { pts.push({ d: m.date, v: m.overall, partial: !m.complete }); });
    else a.ms.forEach(function (m) { if (m.scores[sel] !== undefined) pts.push({ d: m.date, v: m.scores[sel], isSkill: true }); });
    var color = sel === 'overall' ? (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7C5CFC') : skillMeta(exam, sel).c;
    var target = sel === 'overall' ? a.info.target : a.tSkill;
    var body;
    if (!pts.length) {
      body = '<div class="xp-empty"><div>📈</div>' + L("Grafik uchun kamida 1 ta mock natija kiriting", 'Log a mock result to start your progress chart', 'Внесите результат теста, чтобы увидеть график') + '</div>';
    } else body = chartSvg(exam, pts, target, color) + (sel === 'overall' && pts.some(function (p) { return p.partial; }) ? '<div class="xp-foot">○ ' + L("— qisman mock (barcha ko'nikmalar emas)", '— partial mock (not all skills)', '— неполный тест (не все навыки)') + '</div>' : '');
    var s = a.stats, statHtml = '';
    if (sel === 'overall' && s) {
      statHtml = '<div class="xp-stats"><div><span>' + L('Oxirgi', 'Latest', 'Последний') + '</span><b>' + fmt(exam, s.latest) + '</b></div>' +
        '<div><span>' + L('Eng yaxshi', 'Best', 'Лучший') + '</span><b>' + fmt(exam, s.best) + '</b></div>' +
        '<div><span>' + L("O'rtacha", 'Average', 'Средний') + '</span><b>' + (exam === 'ielts' ? s.avg.toFixed(1) : fmt(exam, s.avg)) + '</b></div>' +
        '<div><span>' + L('Mocklar', 'Mocks', 'Тесты') + '</span><b>' + s.n + '</b></div></div>';
    } else if (pts.length) {
      var vs = pts.map(function (p) { return p.v; });
      statHtml = '<div class="xp-stats"><div><span>' + L('Oxirgi', 'Latest', 'Последний') + '</span><b>' + fmt(exam, vs[vs.length - 1]) + '</b></div>' +
        '<div><span>' + L('Eng yaxshi', 'Best', 'Лучший') + '</span><b>' + fmt(exam, Math.max.apply(null, vs)) + '</b></div>' +
        '<div><span>' + L("O'rtacha", 'Average', 'Средний') + '</span><b>' + (exam === 'ielts' ? (vs.reduce(function (x, y) { return x + y; }, 0) / vs.length).toFixed(1) : fmt(exam, vs.reduce(function (x, y) { return x + y; }, 0) / vs.length)) + '</b></div>' +
        '<div><span>' + L('Natijalar', 'Results', 'Результаты') + '</span><b>' + vs.length + '</b></div></div>';
    }
    return '<section class="xp-card"><div class="xp-sec-h"><h4>' + L('Progress', 'Progress', 'Прогресс') + '</h4>' + seg + '</div>' + body + statHtml + '</section>';
  }

  function mocksHtml(exam, a) {
    var list = a.ms.slice().reverse();
    var show = UI.allMocks[exam] ? list : list.slice(0, 4);
    var items = show.map(function (m) {
      var chips = SKILLS[exam].map(function (s) {
        var v = m.scores[s.k];
        return '<span class="xp-mc' + (v === undefined ? ' off' : '') + '" style="--c:' + s.c + '"><i>' + (exam === 'sat' ? (s.k === 'rw' ? 'R&W' : 'M') : s.n.charAt(0)) + '</i>' + (v === undefined ? '—' : fmt(exam, v)) + '</span>';
      }).join('');
      return '<div class="xp-mock">' +
        '<div class="xp-mock-h"><div><div class="xp-mock-d">' + H(shortDate(m.date, true)) + (m.date === tdy() ? ' · ' + L('bugun', 'today', 'сегодня') : '') + '</div>' +
        '<div class="xp-mock-cs">' + chips + '</div></div>' +
        '<div class="xp-mock-o"><b>' + fmt(exam, m.overall) + '</b><span>' + (m.complete ? (exam === 'sat' ? 'Total' : 'Overall') : L('qisman', 'partial', 'частично')) + '</span></div></div>' +
        (m.note ? '<div class="xp-mock-n">📝 ' + H(m.note) + '</div>' : '') +
        '<div class="xp-mock-a"><button type="button" class="xp-link" data-xp="note" data-d="' + H(m.date) + '">📝 ' + (m.note ? L('Izohni tahrirlash', 'Edit note', 'Изменить заметку') : L("Izoh qo'shish", 'Add note', 'Добавить заметку')) + '</button>' +
        '<button type="button" class="xp-link danger" data-xp="delmock" data-d="' + H(m.date) + '" aria-label="delete">🗑️</button></div>' +
        '</div>';
    }).join('');
    var more = list.length > 4 ? '<button type="button" class="xp-more" data-xp="allmocks">' + (UI.allMocks[exam] ? '▲ ' + L('Kamroq', 'Show less', 'Свернуть') : '▼ ' + L('Barchasi', 'Show all', 'Показать все') + ' (' + list.length + ')') + '</button>' : '';
    return '<section class="xp-card"><div class="xp-sec-h"><h4>' + L('Mock testlar jurnali', 'Mock test log', 'Журнал пробных тестов') + '</h4><button type="button" class="x-btn sm" data-xp="addmock">＋</button></div>' +
      (items || '<div class="xp-empty"><div>🧪</div>' + L("Hali mock test yo'q. Birinchisini qo'shing!", 'No mock tests yet. Add your first one!', 'Пробных тестов пока нет. Добавьте первый!') + '</div>') + more + '</section>';
  }

  function studyHtml(exam, a) {
    var st = a.st, goalMin = st.goalH * 60, pct = clamp(st.weekMin / goalMin, 0, 1);
    var wd = weekdaysShort(), maxM = Math.max(30, Math.max.apply(null, st.week.map(function (d) { return d.m; })));
    var bars = st.week.map(function (d, i) {
      var h = d.m ? Math.max(6, Math.round(d.m / maxM * 100)) : 0;
      return '<div class="xp-wk' + (d.d === tdy() ? ' now' : '') + '"><div class="xp-wk-b"><i style="height:' + h + '%"></i></div><span>' + wd[i] + '</span></div>';
    }).join('');
    var opts = SKILLS[exam].concat(EXTRA_SKILLS(exam));
    var selSkill = UI.sesSkill[exam] || (a.weak ? a.weak.s.k : opts[0].k);
    var selMin = UI.sesMin[exam] || 30;
    var skillChips = opts.map(function (s) {
      return '<button type="button" class="xp-chip' + (s.k === selSkill ? ' on' : '') + '" style="--c:' + s.c + '" data-xp="sesskill" data-k="' + s.k + '">' + s.e + ' ' + H(s.n) + '</button>';
    }).join('');
    var minChips = [15, 30, 45, 60, 90].map(function (m) {
      return '<button type="button" class="xp-chip' + (m === selMin ? ' on' : '') + '" data-xp="sesmin" data-m="' + m + '">' + m + '</button>';
    }).join('');
    var recent = ep().sessions.filter(function (s) { return s.exam === exam; }).sort(function (x, y) { return (y.date || '').localeCompare(x.date || '') || y.id - x.id; }).slice(0, 4);
    var recentHtml = recent.length ? '<div class="xp-ses-list">' + recent.map(function (s) {
      var m = skillMeta(exam, s.skill);
      return '<div class="xp-ses"><span>' + m.e + ' ' + H(m.n) + '</span><span class="xp-dim">' + H(shortDate(s.date)) + '</span><b>' + (Number(s.min) || 0) + ' ' + L('daq', 'min', 'мин') + '</b>' +
        '<button type="button" class="xp-x" data-xp="delses" data-id="' + s.id + '" aria-label="delete">✕</button></div>';
    }).join('') + '</div>' : '';
    var hh = function (m) { var h = Math.floor(m / 60), mm = m % 60; return h ? h + L(' soat', 'h', ' ч') + (mm ? ' ' + mm + L(' daq', 'm', ' мин') : '') : mm + L(' daq', 'm', ' мин'); };
    var pomoLine = '<label class="xp-pomo"><input type="checkbox" data-xp="pomo"' + (pomoUse(exam) ? ' checked' : '') + '> 🍅 ' +
      L('Nomida "' + exam.toUpperCase() + '" bor Pomodoro daqiqalarini qo\'shish', 'Count Pomodoro minutes from activities named "' + exam.toUpperCase() + '"', 'Учитывать минуты Pomodoro с названием «' + exam.toUpperCase() + '»') +
      (st.weekPomo ? ' <b>(+' + st.weekPomo + ' ' + L('daq', 'min', 'мин') + ')</b>' : '') + '</label>';
    return '<section class="xp-card"><div class="xp-sec-h"><h4>' + L("O'qish rejasi", 'Study plan', 'План занятий') + '</h4>' +
      '<button type="button" class="xp-link" data-xp="goal">⏱ ' + L('Maqsad', 'Goal', 'Цель') + ': ' + st.goalH + L(' soat/hafta', ' h/week', ' ч/нед') + '</button></div>' +
      '<div class="xp-study-top">' + ring(pct, Math.round(pct * 100) + '%', L('hafta', 'week', 'неделя'), pct >= 1 ? 'var(--green)' : 'var(--accent)') +
      '<div class="xp-study-s"><div class="xp-kv"><span>' + L('Bu hafta', 'This week', 'На этой неделе') + '</span><b>' + hh(st.weekMin) + ' / ' + st.goalH + L(' soat', 'h', ' ч') + '</b></div>' +
      '<div class="xp-kv"><span>' + L('Seriya', 'Streak', 'Серия') + '</span><b>🔥 ' + st.streak + ' ' + L('kun', st.streak === 1 ? 'day' : 'days', 'дн.') + '</b></div>' +
      '<div class="xp-kv"><span>' + L('Bugun', 'Today', 'Сегодня') + '</span><b>' + hh(st.todayMin) + '</b></div></div></div>' +
      '<div class="xp-week">' + bars + '</div>' +
      '<div class="xp-log"><div class="xp-k">' + L("O'qish sessiyasini yozish", 'Log a study session', 'Записать занятие') + '</div>' +
      '<div class="xp-chips-row">' + skillChips + '</div>' +
      '<div class="xp-log-row"><div class="xp-chips-row">' + minChips + '</div>' +
      '<input type="number" class="x-in xp-min-in" min="1" max="600" inputmode="numeric" placeholder="' + L('daq', 'min', 'мин') + '" aria-label="minutes" data-xp-in="min">' +
      '<button type="button" class="x-btn" data-xp="logses">＋ ' + L('Yozish', 'Log', 'Записать') + '</button></div></div>' +
      recentHtml + pomoLine + '</section>';
  }

  function vocabHtml(exam) {
    var ws = ep().words.filter(function (w) { return w.exam === exam; });
    var known = ws.filter(function (w) { return w.st === 'known'; }).length;
    var learn = ws.length - known;
    var sorted = ws.slice().sort(function (x, y) { return y.id - x.id; });
    var show = UI.allWords[exam] ? sorted : sorted.slice(0, 5);
    var list = show.map(function (w) {
      return '<div class="xp-word"><div class="xp-word-b"><div><b>' + H(w.w) + '</b> <span class="xp-wst ' + (w.st === 'known' ? 'k' : (w.st === 'unknown' ? 'u' : 'n')) + '">' +
        (w.st === 'known' ? L('biladi', 'known', 'знаю') : (w.st === 'unknown' ? L("o'rganish", 'learning', 'учу') : L('yangi', 'new', 'новое'))) + '</span></div>' +
        '<div class="xp-word-m">' + H(w.m) + '</div>' + (w.ex ? '<div class="xp-word-e">“' + H(w.ex) + '”</div>' : '') + '</div>' +
        '<button type="button" class="xp-x" data-xp="delword" data-id="' + w.id + '" aria-label="delete">✕</button></div>';
    }).join('');
    var more = sorted.length > 5 ? '<button type="button" class="xp-more" data-xp="allwords">' + (UI.allWords[exam] ? '▲ ' + L('Kamroq', 'Show less', 'Свернуть') : '▼ ' + L('Barchasi', 'Show all', 'Показать все') + ' (' + sorted.length + ')') + '</button>' : '';
    return '<section class="xp-card"><div class="xp-sec-h"><h4>' + L("So'zlar banki", 'Word bank', 'Словарь') + '</h4>' +
      (ws.length ? '<button type="button" class="x-btn sm" data-xp="review">🃏 ' + L('Takrorlash', 'Review', 'Повторить') + (learn ? ' (' + learn + ')' : '') + '</button>' : '') + '</div>' +
      (ws.length ? '<div class="xp-vstat"><span>' + ws.length + ' ' + L("so'z", 'words', 'слов') + '</span><span class="k">✓ ' + known + '</span><span class="u">↻ ' + learn + '</span>' +
        '<div class="xp-bar"><i style="width:' + Math.round(known / ws.length * 100) + '%;background:var(--green)"></i></div></div>' : '') +
      '<form class="xp-wform" data-xp-form="word" autocomplete="off">' +
      '<input class="x-in" name="w" maxlength="60" required placeholder="' + L("So'z", 'Word', 'Слово') + '" aria-label="word">' +
      '<input class="x-in" name="m" maxlength="140" required placeholder="' + L("Ma'nosi", 'Meaning', 'Значение') + '" aria-label="meaning">' +
      '<input class="x-in xp-wide" name="ex" maxlength="200" placeholder="' + L('Misol gap (ixtiyoriy)', 'Example sentence (optional)', 'Пример (необязательно)') + '" aria-label="example">' +
      '<button type="submit" class="x-btn">＋ ' + L("Qo'shish", 'Add', 'Добавить') + '</button></form>' +
      (list ? '<div class="xp-words">' + list + '</div>' : '<div class="xp-empty sm">' + L("Imtihon uchun muhim so'zlarni yig'ing va flashcard bilan takrorlang.", 'Collect key exam words and drill them with flashcards.', 'Собирайте важные слова и повторяйте их карточками.') + '</div>') +
      more + '</section>';
  }

  // ---------------- Asosiy render ----------------
  function ensureShell(exam) {
    var view = document.getElementById('view-' + exam);
    if (!view) return null;
    var box = document.getElementById('xp-' + exam);
    if (box) return box;
    // Mavjud (eski) tarkib — "Batafsil yozuvlar" bo'limiga ko'chiriladi
    var det = document.createElement('details');
    det.className = 'xp-card xp-legacy'; det.id = 'xp-legacy-' + exam;
    var sum = document.createElement('summary'); sum.id = 'xp-legacy-sum-' + exam;
    det.appendChild(sum);
    var inner = document.createElement('div'); inner.className = 'xp-legacy-in';
    while (view.firstChild) inner.appendChild(view.firstChild);
    det.appendChild(inner);
    box = document.createElement('div'); box.className = 'xp'; box.id = 'xp-' + exam; box.setAttribute('data-exam', exam);
    view.appendChild(box); view.appendChild(det);
    box.addEventListener('click', onClick);
    box.addEventListener('change', onChange);
    box.addEventListener('submit', onSubmit);
    return box;
  }

  function render(exam) {
    if (EXAMS.indexOf(exam) === -1) return;
    var box = ensureShell(exam); if (!box) return;
    var a;
    try { a = analyse(exam); } catch (e) { console.warn('[exam-prep]', e); return; }
    var y = window.scrollY;
    box.innerHTML = heroHtml(exam, a) +
      '<div class="xp-grid">' +
      '<div class="xp-col">' + nextActionHtml(exam, a) + skillsHtml(exam, a) + progressHtml(exam, a) + '</div>' +
      '<div class="xp-col">' + mocksHtml(exam, a) + studyHtml(exam, a) + (exam !== 'sat' ? vocabHtml(exam) : '') + '</div>' +
      '</div>';
    var sum = document.getElementById('xp-legacy-sum-' + exam);
    if (sum) sum.textContent = '🗂 ' + L("Barcha yozuvlar, qismlar va filtr", 'All entries, parts & filters', 'Все записи, части и фильтр') + ' (' + rawEntries(exam).length + ')';
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  }
  function renderVisible() {
    EXAMS.forEach(function (ex) {
      var v = document.getElementById('view-' + ex);
      if (v && v.style.display !== 'none') render(ex);
    });
  }

  // ---------------- Amallar ----------------
  function afterResultsChange(exam) {
    try { renderProfileGoalWidget(); } catch (e) {}
    try { renderExamTrendChart(); } catch (e) {}
    try { renderExamForecastCard(); } catch (e) {}
    if (exam === 'ielts') renderIeltsTab(); else if (exam === 'sat') renderSatTab(); else renderCefrTab();
  }

  function onClick(e) {
    var b = e.target.closest('[data-xp]'); if (!b) return;
    var box = e.currentTarget, exam = box.getAttribute('data-exam'), act = b.getAttribute('data-xp');
    if (b.tagName === 'INPUT') return;
    switch (act) {
      case 'setdate': try { openIeltsModal(exam); } catch (er) {} break;
      case 'addmock': openMockModal(exam); break;
      case 'detail':
        if (exam === 'ielts') openIeltsDetailModal(); else if (exam === 'sat') openSatDetailModal(); else openCefrDetailModal();
        break;
      case 'series': UI.series[exam] = b.getAttribute('data-k'); render(exam); break;
      case 'allmocks': UI.allMocks[exam] = !UI.allMocks[exam]; render(exam); break;
      case 'allwords': UI.allWords[exam] = !UI.allWords[exam]; render(exam); break;
      case 'note': openNoteModal(exam, b.getAttribute('data-d')); break;
      case 'delmock': deleteMock(exam, b.getAttribute('data-d')); break;
      case 'goal': editGoal(exam); break;
      case 'sesskill': UI.sesSkill[exam] = b.getAttribute('data-k'); render(exam); break;
      case 'sesmin': UI.sesMin[exam] = Number(b.getAttribute('data-m')); render(exam); break;
      case 'logses': {
        var inp = box.querySelector('[data-xp-in="min"]');
        var custom = inp && inp.value ? Math.round(Number(inp.value)) : 0;
        var min = custom || UI.sesMin[exam] || 30;
        if (!(min > 0 && min <= 600)) { toast('❗ ' + L('Daqiqa 1–600 oralig\'ida', 'Minutes must be 1–600', 'Минуты: от 1 до 600')); return; }
        var a = analyse(exam);
        logSession(exam, UI.sesSkill[exam] || (a.weak ? a.weak.s.k : SKILLS[exam][0].k), min);
        break;
      }
      case 'quicklog': logSession(exam, b.getAttribute('data-skill'), 30); break;
      case 'delses': {
        var id = Number(b.getAttribute('data-id'));
        holdAsk(L("Bu o'qish sessiyasini o'chirasizmi?", 'Delete this study session?', 'Удалить это занятие?'), function () {
          ep().sessions = ep().sessions.filter(function (s) { return s.id !== id; }); save(); render(exam);
        });
        break;
      }
      case 'review': openReview(exam); break;
      case 'delword': {
        var wid = Number(b.getAttribute('data-id'));
        var w = ep().words.filter(function (x) { return x.id === wid; })[0];
        holdAsk(L("So'zni o'chirasizmi?", 'Delete this word?', 'Удалить слово?') + (w ? '<br><b>' + H(w.w) + '</b>' : ''), function () {
          ep().words = ep().words.filter(function (x) { return x.id !== wid; }); save(); render(exam);
        });
        break;
      }
    }
  }
  function onChange(e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-xp') === 'pomo') {
      var exam = e.currentTarget.getAttribute('data-exam');
      ep().pomo[exam] = !!t.checked; save(); render(exam);
    }
  }
  function onSubmit(e) {
    var f = e.target; if (f.getAttribute('data-xp-form') !== 'word') return;
    e.preventDefault();
    var exam = e.currentTarget.getAttribute('data-exam');
    var w = (f.w.value || '').trim(), m = (f.m.value || '').trim(), ex = (f.ex.value || '').trim();
    if (!w || !m) { toast('❗ ' + L("So'z va ma'nosini kiriting", 'Enter a word and its meaning', 'Введите слово и значение')); return; }
    var dup = ep().words.some(function (x) { return x.exam === exam && x.w.toLowerCase() === w.toLowerCase(); });
    if (dup) { toast('ℹ️ ' + L("Bu so'z allaqachon bor", 'This word is already in your bank', 'Это слово уже есть')); return; }
    ep().words.push({ id: uid(), exam: exam, w: w.slice(0, 60), m: m.slice(0, 140), ex: ex.slice(0, 200), st: 'new', n: 0, d: tdy() });
    save(); render(exam);
    var nf = document.querySelector('#xp-' + exam + ' [data-xp-form="word"] input[name="w"]');
    if (nf) nf.focus();
    toast('✅ ' + L("So'z qo'shildi", 'Word added', 'Слово добавлено'));
  }

  function logSession(exam, skill, min) {
    ep().sessions.push({ id: uid(), exam: exam, skill: skill, min: min, date: tdy() });
    if (ep().sessions.length > 2000) ep().sessions = ep().sessions.slice(-2000);
    save(); render(exam);
    var m = skillMeta(exam, skill);
    toast('✅ ' + m.e + ' ' + m.n + ' · ' + min + ' ' + L('daq yozildi', 'min logged', 'мин записано'));
  }

  function editGoal(exam) {
    var cur = study(exam).goalH;
    var ask = L("Haftalik o'qish maqsadi (soat, 1–60)", 'Weekly study goal (hours, 1–60)', 'Недельная цель (часы, 1–60)');
    var apply = function (val) {
      var n = parseFloat(String(val).replace(',', '.'));
      if (isNaN(n) || n < 1 || n > 60) { toast('❗ ' + L('1 dan 60 gacha soat', '1 to 60 hours', 'От 1 до 60 часов')); return; }
      ep().goalH[exam] = Math.round(n * 2) / 2; save(); render(exam);
    };
    if (typeof showPromptModal === 'function') showPromptModal(ask, cur, apply, { icon: '⏱', inputType: 'number' });
    else { var v = prompt(ask, cur); if (v != null) apply(v); }
  }

  function deleteMock(exam, date) {
    var m = mocks(exam).filter(function (x) { return x.date === date; })[0]; if (!m) return;
    var ids = m.ids.slice();
    holdAsk(L("Bu mock testni o'chirasizmi?", 'Delete this mock test?', 'Удалить этот пробный тест?') + '<br><b>' + H(shortDate(date, true)) + '</b> · ' + ids.length + ' ' + L('ta natija', 'results', 'результатов'), function () {
      var has = function (r) { return ids.indexOf(r.id) !== -1; };
      if (exam === 'ielts') S.ieltsResults = (S.ieltsResults || []).filter(function (r) { return !has(r); });
      else if (exam === 'sat') S.satResults = (S.satResults || []).filter(function (r) { return !has(r); });
      else { ensureCefrDefaults(); S.cefr.history = S.cefr.history.filter(function (r) { return !has(r); }); }
      var n = ep().notes[exam]; if (n && n[date] && !mocks(exam).some(function (x) { return x.date === date; })) delete n[date];
      save(); afterResultsChange(exam);
      toast('🗑️ ' + L("Mock o'chirildi", 'Mock deleted', 'Тест удалён'));
    });
  }

  // ---------------- Modallar ----------------
  function modal(html, cls) {
    var ov = document.createElement('div');
    ov.className = 'x-ov xp-ov';
    ov.innerHTML = '<div class="x-box xp-box ' + (cls || '') + '" role="dialog" aria-modal="true"><button type="button" class="x-close" aria-label="close">✕</button>' + html + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    var onKey = function (e) { if (e.key === 'Escape' && document.body.lastElementChild === ov) { e.stopPropagation(); close(); } };
    var close = function () { ov.classList.remove('open'); document.removeEventListener('keydown', onKey, true); setTimeout(function () { ov.remove(); }, 180); };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.x-close').onclick = close;
    ov._close = close;
    return ov;
  }

  function bandToRaw(band, sec) {
    for (var i = 0; i <= 40; i++) if (rawToBand(i, sec) >= band) return i;
    return 40;
  }

  function openMockModal(exam) {
    var fields = SKILLS[exam].map(function (s) {
      var inp;
      if (exam === 'ielts') {
        var opts = '<option value="">—</option>';
        for (var b = 9; b >= 1; b -= 0.5) opts += '<option value="' + b + '">' + b.toFixed(1) + '</option>';
        inp = '<select class="x-in" name="' + s.k + '" aria-label="' + s.n + ' band">' + opts + '</select>';
        if (s.k === 'listening' || s.k === 'reading') inp += '<input class="x-in xp-raw" type="number" min="0" max="40" inputmode="numeric" name="' + s.k + '_raw" placeholder="' + L("yoki to'g'ri /40", 'or raw /40', 'или из 40') + '" aria-label="' + s.n + ' raw">';
      } else if (exam === 'sat') {
        inp = '<input class="x-in" type="number" min="200" max="800" step="10" inputmode="numeric" name="' + s.k + '" placeholder="200–800" aria-label="' + s.n + '">';
      } else {
        inp = '<div class="xp-lvls" data-name="' + s.k + '">' + LEVELS.map(function (l) { return '<button type="button" data-lvl="' + l + '">' + l + '</button>'; }).join('') + '</div>';
      }
      return '<div class="xp-mf"><label><span style="color:' + s.c + '">' + s.e + '</span> ' + H(s.n) + '</label><div class="xp-mf-in">' + inp + '</div></div>';
    }).join('');
    var ov = modal('<h3 class="xp-m-t">🧪 ' + L('Mock test natijasi', 'Mock test result', 'Результат пробного теста') + ' · ' + exam.toUpperCase() + '</h3>' +
      '<div class="xp-m-sub">' + L("Bo'sh qoldirilgan ko'nikmalar saqlanmaydi.", 'Leave a skill empty to skip it.', 'Пустые навыки не сохраняются.') + '</div>' +
      '<form class="xp-mform" autocomplete="off">' +
      '<div class="xp-mf"><label>📅 ' + L('Sana', 'Date', 'Дата') + '</label><div class="xp-mf-in"><input class="x-in" type="date" name="date" required value="' + tdy() + '" max="' + tdy() + '"></div></div>' +
      fields +
      '<div class="xp-mf col"><label>📝 ' + L('Izoh', 'Notes', 'Заметки') + '</label><textarea class="x-in" name="note" rows="2" maxlength="500" placeholder="' + L('Masalan: vaqt yetmadi, Task 2 da xato…', 'e.g. ran out of time on Reading P3…', 'Напр.: не хватило времени…') + '"></textarea></div>' +
      '<div class="xp-m-prev" aria-live="polite"></div>' +
      '<button type="submit" class="x-btn wide">💾 ' + L('Saqlash', 'Save', 'Сохранить') + '</button></form>');
    var form = ov.querySelector('form'), prev = ov.querySelector('.xp-m-prev');
    var lv = {};
    ov.querySelectorAll('.xp-lvls').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var bt = e.target.closest('[data-lvl]'); if (!bt) return;
        var k = g.getAttribute('data-name'), l = bt.getAttribute('data-lvl');
        lv[k] = lv[k] === l ? null : l;
        g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-lvl') === lv[k]); });
        update();
      });
    });
    function read() {
      var out = {}, bad = false;
      SKILLS[exam].forEach(function (s) {
        if (exam === 'ielts') {
          var raw = form[s.k + '_raw'] ? form[s.k + '_raw'].value : '';
          if (raw !== '') {
            var r = Math.round(Number(raw)); if (isNaN(r) || r < 0 || r > 40) { bad = true; return; }
            out[s.k] = { raw: r, band: rawToBand(r, s.k) };
          } else if (form[s.k].value !== '') {
            var b = Number(form[s.k].value);
            if (s.k === 'listening' || s.k === 'reading') { var rr = bandToRaw(b, s.k); out[s.k] = { raw: rr, band: rawToBand(rr, s.k) }; }
            else out[s.k] = { raw: null, band: b };
          }
        } else if (exam === 'sat') {
          var v = form[s.k].value; if (v === '') return;
          var n = Math.round(Number(v)); if (isNaN(n) || n < 200 || n > 800) { bad = true; return; }
          out[s.k] = { score: n };
        } else if (lv[s.k]) out[s.k] = { level: lv[s.k] };
      });
      return { out: out, bad: bad };
    }
    function update() {
      var r = read(), ks = Object.keys(r.out);
      if (r.bad) { prev.textContent = '❗ ' + (exam === 'sat' ? '200–800' : '0–40'); return; }
      if (!ks.length) { prev.textContent = ''; return; }
      var vals = ks.map(function (k) { var o = r.out[k]; return exam === 'ielts' ? o.band : (exam === 'sat' ? o.score : rank(o.level)); });
      var sum = vals.reduce(function (a, b) { return a + b; }, 0), all = ks.length === SKILLS[exam].length;
      var txt = exam === 'ielts' ? 'Overall ' + (all ? '' : '≈') + fmt('ielts', ieltsRound(sum / vals.length))
        : exam === 'sat' ? (all ? 'Total ' + sum + ' / 1600' : '')
          : 'Overall ' + (all ? '' : '≈') + fmt('cefr', Math.round(sum / vals.length));
      if (exam === 'ielts') ks.forEach(function (k) { if (r.out[k].raw != null) txt += ' · ' + k.charAt(0).toUpperCase() + ' ' + r.out[k].raw + '/40→' + r.out[k].band.toFixed(1); });
      prev.textContent = txt + (all ? '' : ' (' + ks.length + '/' + SKILLS[exam].length + ')');
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var date = form.date.value;
      if (!date) { toast('❗ ' + L('Sanani kiriting', 'Enter the date', 'Введите дату')); return; }
      if (date > tdy()) { toast('❗ ' + L('Kelajakdagi sana mumkin emas', 'Future dates are not allowed', 'Будущая дата недопустима')); return; }
      var r = read();
      if (r.bad) { toast('❗ ' + L("Qiymatlar oralig'ini tekshiring", 'Check the value ranges', 'Проверьте диапазон значений')); return; }
      var ks = Object.keys(r.out);
      if (!ks.length) { toast('❗ ' + L('Kamida bitta natijani kiriting', 'Enter at least one result', 'Введите хотя бы один результат')); return; }
      var base = Date.now();
      ks.forEach(function (k, i) {
        var o = r.out[k], id = base + i;
        if (exam === 'ielts') { if (!S.ieltsResults) S.ieltsResults = []; S.ieltsResults.push({ section: k, subSection: 'all', band: o.band, raw: o.raw, date: date, id: id }); }
        else if (exam === 'sat') { if (!S.satResults) S.satResults = []; S.satResults.push({ section: k, score: o.score, date: date, id: id }); }
        else { ensureCefrDefaults(); S.cefr.history.push({ id: id, raw: null, section: k, level: o.level, date: date }); }
      });
      var note = (form.note.value || '').trim().slice(0, 500);
      if (note) { var nn = ep().notes; nn[exam] = nn[exam] || {}; nn[exam][date] = nn[exam][date] ? nn[exam][date] + ' · ' + note : note; }
      save();
      ov._close();
      afterResultsChange(exam);
      toast('✅ ' + L('Mock natija saqlandi', 'Mock result saved', 'Результат сохранён'));
    });
  }

  function openNoteModal(exam, date) {
    var nn = ep().notes; nn[exam] = nn[exam] || {};
    var ov = modal('<h3 class="xp-m-t">📝 ' + L('Mock izohi', 'Mock notes', 'Заметки к тесту') + ' · ' + H(shortDate(date, true)) + '</h3>' +
      '<form class="xp-mform"><textarea class="x-in" name="note" rows="4" maxlength="500"></textarea>' +
      '<button type="submit" class="x-btn wide">💾 ' + L('Saqlash', 'Save', 'Сохранить') + '</button></form>');
    var f = ov.querySelector('form');
    f.note.value = nn[exam][date] || '';
    setTimeout(function () { try { f.note.focus(); } catch (e) {} }, 60);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (f.note.value || '').trim().slice(0, 500);
      if (v) nn[exam][date] = v; else delete nn[exam][date];
      save(); ov._close(); render(exam);
    });
  }

  function openReview(exam) {
    var ws = ep().words.filter(function (w) { return w.exam === exam; });
    if (!ws.length) return;
    var prio = function (w) { return w.st === 'unknown' ? 0 : (w.st === 'known' ? 2 : 1); };
    var queue = ws.slice().sort(function (a, b) { return prio(a) - prio(b) || (a.n || 0) - (b.n || 0) || Math.random() - 0.5; });
    var learning = queue.filter(function (w) { return w.st !== 'known'; });
    if (learning.length) queue = learning.concat(queue.filter(function (w) { return w.st === 'known'; }).slice(0, Math.max(0, 10 - learning.length)));
    queue = queue.slice(0, 20);
    var i = 0, ok = 0, bad = 0, flipped = false;
    var ov = modal('<div class="xp-rv"></div>', 'xp-rv-box');
    var root = ov.querySelector('.xp-rv');
    function draw() {
      if (i >= queue.length) {
        root.innerHTML = '<div class="xp-rv-done"><div class="xp-rv-big">🎉</div><h3>' + L('Takrorlash tugadi!', 'Review complete!', 'Повторение завершено!') + '</h3>' +
          '<div class="xp-rv-sum"><span class="k">✓ ' + ok + '</span><span class="u">↻ ' + bad + '</span></div>' +
          '<button type="button" class="x-btn wide" data-rv="close">' + L('Yopish', 'Close', 'Закрыть') + '</button></div>';
        return;
      }
      var w = queue[i];
      root.innerHTML = '<div class="xp-rv-top"><span>' + (i + 1) + ' / ' + queue.length + '</span><div class="xp-bar"><i style="width:' + Math.round(i / queue.length * 100) + '%"></i></div></div>' +
        '<button type="button" class="xp-flash' + (flipped ? ' flip' : '') + '" data-rv="flip" aria-live="polite">' +
        '<span class="xp-flash-w">' + H(w.w) + '</span>' +
        (flipped ? '<span class="xp-flash-m">' + H(w.m) + '</span>' + (w.ex ? '<span class="xp-flash-e">“' + H(w.ex) + '”</span>' : '')
          : '<span class="xp-flash-h">' + L("Ma'nosini ko'rish uchun bosing", 'Tap to reveal the meaning', 'Нажмите, чтобы увидеть значение') + '</span>') + '</button>' +
        '<div class="xp-rv-act"><button type="button" class="x-btn xp-no" data-rv="no">↻ ' + L('Bilmayman', "Don't know", 'Не знаю') + '</button>' +
        '<button type="button" class="x-btn xp-yes" data-rv="yes">✓ ' + L('Bilaman', 'Know it', 'Знаю') + '</button></div>';
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rv]'); if (!b) return;
      var a = b.getAttribute('data-rv');
      if (a === 'close') { ov._close(); return; }
      if (a === 'flip') { flipped = !flipped; draw(); return; }
      var w = queue[i]; if (!w) return;
      w.st = a === 'yes' ? 'known' : 'unknown'; w.n = (w.n || 0) + 1; w.r = tdy();
      if (a === 'yes') ok++; else bad++;
      save();
      i++; flipped = false; draw();
      if (i >= queue.length) render(exam);
    });
    var origClose = ov._close;
    ov._close = function () { origClose(); render(exam); };
    ov.querySelector('.x-close').onclick = ov._close;
    draw();
  }

  // ---------------- Integratsiya ----------------
  function wrapAfter(name, fn) {
    var o = window[name]; if (typeof o !== 'function') return;
    window[name] = function () { var r = o.apply(this, arguments); try { fn.apply(this, arguments); } catch (e) { console.warn('[exam-prep]', e); } return r; };
  }
  wrapAfter('renderIeltsTab', function () { render('ielts'); });
  wrapAfter('renderSatTab', function () { render('sat'); });
  wrapAfter('renderCefrTab', function () { render('cefr'); });
  wrapAfter('renderIeltsCountdown', renderVisible);
  wrapAfter('applyLanguage', renderVisible);

  // Eski ro'yxatdagi o'chirish tugmalari — endi bosib-turib tasdiqlanadi
  function wrapDelete(name, msg) {
    var o = window[name]; if (typeof o !== 'function') return;
    window[name] = function (id) { var self = this, args = arguments; holdAsk(msg(), function () { o.apply(self, args); }); };
  }
  wrapDelete('deleteIeltsResult', function () { return L("Bu natijani o'chirasizmi?", 'Delete this result?', 'Удалить этот результат?'); });
  wrapDelete('deleteSatResult', function () { return L("Bu natijani o'chirasizmi?", 'Delete this result?', 'Удалить этот результат?'); });
  wrapDelete('deleteCefrResultEntry', function () { return L("Bu natijani o'chirasizmi?", 'Delete this result?', 'Удалить этот результат?'); });

  // Pomodoro boshqa tabda yangilansa — ko'rinib turgan dashboard yangilanadi
  window.addEventListener('storage', function (e) { if (e.key === 'pomoLogs') renderVisible(); });
  // Countdown soatlari — daqiqada bir yangilanadi (faqat ko'rinib tursa)
  setInterval(function () { if (!document.hidden) { try { renderVisibleHeroOnly(); } catch (e) {} } }, 60000);
  function renderVisibleHeroOnly() {
    EXAMS.forEach(function (ex) {
      var v = document.getElementById('view-' + ex);
      if (!v || v.style.display === 'none') return;
      var box = document.getElementById('xp-' + ex), hero = box && box.querySelector('.xp-hero');
      if (!hero || box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
      var tmp = document.createElement('div'); tmp.innerHTML = heroHtml(ex, analyse(ex));
      if (tmp.firstChild) hero.replaceWith(tmp.firstChild);
    });
  }

  window.XPrep = { render: render, renderVisible: renderVisible, analyse: analyse, mocks: mocks, ieltsRound: ieltsRound };
})();
