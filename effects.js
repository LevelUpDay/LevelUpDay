// ============================================================
// ✨ EFFECTS — do'kondan sotib olinadigan UI effektlar (React Bits'ning vanilla JS qayta yozilgani):
//   u_spark  — ClickSpark : har bosishda uchqunlar (canvas overlay)
//   u_magnet — Magnet     : asosiy tugmalar sichqonchaga yengil tortiladi (faqat sichqoncha)
//   u_cross  — Crosshair  : butun ekran nishon chiziqlari + tugmalarga "lock" (faqat sichqoncha)
//   u_star   — StarBorder : asosiy tugma/kartalar chegarasi bo'ylab yuguruvchi yulduz (CSS)
//   u_target — TargetCursor: aylanuvchi burchakli kursor, tugmalarni "qamrab oladi" (faqat sichqoncha)
//   u_wave   — Shockwave  : har bosishda kengayuvchi ikki halqa to'lqini (canvas, telefonda ham)
//   u_trail  — Glow Trail : kursor/barmoq ortidan porlab so'nuvchi iz (canvas)
//   u_spot   — Spotlight  : kartalar ustida kursor ortidan yurgan yorug'lik + chegara nuri (faqat sichqoncha)
//   u_confetti — Konfetti   : har bosishda rangli konfetti sachraydi va tushadi (canvas)
//   u_ripple — Ripple     : tugmalarda bosilgan joydan yoyiluvchi "siyoh" to'lqini
//   u_tilt   — 3D Tilt    : kartalar kursor tomonga 3D egiladi (faqat sichqoncha)
//   u_bubble — Pufakchalar: bosilgan joydan pufakchalar ko'tariladi (canvas)
//   u_emoji  — Emoji Pop  : bosishda yuraklar/yulduzlar uchib chiqadi (canvas)
//   u_snow   — Qor        : ekranda sekin qor yog'adi (canvas, fon)
//   u_neon   — Neon tugmalar: asosiy tugmalar neon nur bilan "nafas oladi" (CSS)
//   u_fly    — Yoqut qo'ng'izlar: ekranda yumshoq porlovchi nuqtalar suzadi (canvas, fon)
// Egalik: S.shop.owned (id), yoqilganlar: S.shop.ufx = [id...] — app_state orqali sinxronlanadi.
// Hech bir effekt bosishlarni to'smaydi (pointer-events: none), "harakatni kamaytirish" va
// dizayn animatsiyasi toggle'iga (LUDesign.anim) bo'ysunadi. script.js dan KEYIN, extras.js dan OLDIN yuklanadi.
// ============================================================
(function () {
  'use strict';

  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return en; }
  function esc3(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var root = document.documentElement;

  var CAT = [
    { id: 'u_spark', key: 'spark', icon: '✨', coins: 100, n: ['Uchqunlar (ClickSpark)', 'Click Spark', 'Искры (ClickSpark)'],
      d: ['Har bosishda uchqunlar sachraydi', 'Sparks fly on every tap', 'Искры при каждом нажатии'] },
    { id: 'u_magnet', key: 'magnet', icon: '🧲', coins: 150, desktop: true, n: ['Magnit tugmalar', 'Magnet buttons', 'Магнитные кнопки'],
      d: ['Asosiy tugmalar kursorga tortiladi', 'Main buttons follow the cursor', 'Кнопки тянутся к курсору'] },
    { id: 'u_cross', key: 'cross', icon: '🎯', coins: 120, desktop: true, n: ['Nishon (Crosshair)', 'Crosshair', 'Прицел (Crosshair)'],
      d: ['Kursor ortidan nishon + tugmalarga lock', 'Cursor crosshair that locks onto buttons', 'Прицел за курсором с захватом кнопок'] },
    { id: 'u_star', key: 'star', icon: '🌠', gems: 20, n: ['Yulduz chegara', 'Star Border', 'Звёздная рамка'],
      d: ['Tugmalar chegarasida yuguruvchi yulduz', 'A comet runs around key buttons', 'Комета бежит по краю кнопок'] },
    { id: 'u_target', key: 'target', icon: '⌖', gems: 25, desktop: true, n: ['Nishon kursor (TargetCursor)', 'Target Cursor', 'Курсор-мишень (TargetCursor)'],
      d: ['Aylanuvchi burchaklar tugmalarni qamrab oladi', 'Spinning corners snap around buttons', 'Вращающиеся уголки обхватывают кнопки'] },
    { id: 'u_wave', key: 'wave', icon: '💫', coins: 130, n: ['To\'lqin (Shockwave)', 'Shockwave', 'Волна (Shockwave)'],
      d: ['Har bosishda halqa to\'lqini tarqaladi', 'A ring wave ripples out on every tap', 'Кольцевая волна при каждом нажатии'] },
    { id: 'u_trail', key: 'trail', icon: '☄️', gems: 15, n: ['Nurli iz (Glow Trail)', 'Glow Trail', 'Светящийся след (Glow Trail)'],
      d: ['Kursor yoki barmoq ortidan porlovchi iz', 'A glowing trail follows your cursor or finger', 'Светящийся след за курсором или пальцем'] },
    { id: 'u_spot', key: 'spot', icon: '🔦', coins: 180, desktop: true, n: ['Projektor kartalar (Spotlight)', 'Spotlight Cards', 'Прожектор (Spotlight)'],
      d: ['Kartalar ustida kursor ortidan yorug\'lik yuradi', 'Light follows the cursor across cards', 'Свет следует за курсором по карточкам'] },
    { id: 'u_confetti', key: 'confetti', icon: '🎊', coins: 150, n: ['Konfetti', 'Confetti Pop', 'Конфетти'],
      d: ['Har bosishda rangli konfetti sachraydi', 'Colorful confetti bursts on every tap', 'Конфетти при каждом нажатии'] },
    { id: 'u_ripple', key: 'ripple', icon: '🌀', coins: 120, n: ['Ripple tugmalar', 'Ripple buttons', 'Волна на кнопках'],
      d: ['Tugma bosilgan joydan to\'lqin yoyiladi', 'An ink ripple spreads from where you tap', 'Волна расходится от места нажатия'] },
    { id: 'u_tilt', key: 'tilt', icon: '🧊', gems: 20, desktop: true, n: ['3D egiluvchi kartalar', '3D Tilt cards', '3D-наклон карточек'],
      d: ['Kartalar kursor tomonga 3D egiladi', 'Cards tilt in 3D toward the cursor', 'Карточки наклоняются к курсору'] },
    { id: 'u_bubble', key: 'bubble', icon: '🫧', coins: 130, n: ['Pufakchalar', 'Bubbles', 'Пузырьки'],
      d: ['Bosilgan joydan pufakchalar ko\'tariladi', 'Bubbles float up from every tap', 'Пузырьки поднимаются от нажатия'] },
    { id: 'u_emoji', key: 'emoji', icon: '💖', coins: 140, n: ['Emoji portlash', 'Emoji Pop', 'Эмодзи-взрыв'],
      d: ['Bosishda yuraklar va yulduzlar uchadi', 'Hearts and stars fly out when you tap', 'Сердечки и звёзды при нажатии'] },
    { id: 'u_snow', key: 'snow', icon: '❄️', gems: 15, n: ['Qor yog\'ishi', 'Snowfall', 'Снегопад'],
      d: ['Ekranda sekin qor yog\'adi', 'Gentle snow falls across the screen', 'Мягкий снег падает по экрану'] },
    { id: 'u_neon', key: 'neon', icon: '💡', coins: 160, n: ['Neon tugmalar', 'Neon buttons', 'Неоновые кнопки'],
      d: ['Asosiy tugmalar neon nur bilan nafas oladi', 'Main buttons breathe with a neon glow', 'Кнопки «дышат» неоновым светом'] },
    { id: 'u_fly', key: 'fly', icon: '🌟', gems: 25, n: ['Yaltiroq qo\'ng\'izlar', 'Fireflies', 'Светлячки'],
      d: ['Ekranda porlovchi qo\'ng\'izlar suzib yuradi', 'Glowing fireflies drift around the screen', 'По экрану плывут светлячки'] }
  ];
  // 🏷 Barcha narxlar 64% arzonlashtirilgan (asl narx × 0.36 — ikki marta 40% chegirma)
  CAT.forEach(function (it) {
    if (it.coins) it.coins = Math.max(5, Math.round(it.coins * 0.36 / 5) * 5);
    if (it.gems) it.gems = Math.max(1, Math.round(it.gems * 0.36 * 1.3)); // 💎 olmos narxlari tangadan farqli 30% qimmatroq
  });
  function byId(id) { for (var i = 0; i < CAT.length; i++) if (CAT[i].id === id) return CAT[i]; return null; }
  function byKey(k) { for (var i = 0; i < CAT.length; i++) if (CAT[i].key === k) return CAT[i]; return null; }
  function priceTxt(it) { return it.gems ? it.gems + ' 💎' : it.coins + ' 🪙'; }

  function appS() { try { return (typeof S !== 'undefined' && S) ? S : null; } catch (e) { return null; } }
  function st() { var s = appS(); return s && s.shop && typeof s.shop === 'object' ? s.shop : null; }
  function owned(id) { var x = st(); return !!(x && Array.isArray(x.owned) && x.owned.indexOf(id) !== -1); }
  function enabled(id) { var x = st(); return owned(id) && !!(x && Array.isArray(x.ufx) && x.ufx.indexOf(id) !== -1); }

  var reduceMQ = null, fineMQ = null;
  try { reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  try { fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)'); } catch (e) {}
  function motionOK() {
    if (reduceMQ && reduceMQ.matches) return false;
    try { if (window.LUDesign && !window.LUDesign.anim()) return false; } catch (e) {}
    return true;
  }
  function finePointer() { return !!(fineMQ && fineMQ.matches); }
  function accent() {
    try { var c = getComputedStyle(document.body || root).getPropertyValue('--accent').trim(); if (c) return c; } catch (e) {}
    return '#7C5CFC';
  }
  function isLight() { return !!(document.body && document.body.classList.contains('light')); }

  // =========================================================
  // 1) ClickSpark — sparkColor (accent), shape line, count 8, size 14, radius 30, 500ms
  // =========================================================
  var SP = { on: false, cv: null, ctx: null, sparks: [], raf: 0, dpr: 1, cfg: { count: 8, size: 14, radius: 30, duration: 500, extra: 1 } };
  function spCanvas() {
    if (SP.cv) return SP.cv;
    var c = document.createElement('canvas');
    c.id = 'lu-fx-spark'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    SP.cv = c; SP.ctx = c.getContext('2d'); spResize();
    return c;
  }
  function spResize() {
    if (!SP.cv) return;
    SP.dpr = Math.min(window.devicePixelRatio || 1, 2);
    SP.cv.width = Math.round(window.innerWidth * SP.dpr); SP.cv.height = Math.round(window.innerHeight * SP.dpr);
  }
  function spFrame(now) {
    var ctx = SP.ctx, c = SP.cfg;
    ctx.setTransform(SP.dpr, 0, 0, SP.dpr, 0, 0);
    ctx.clearRect(0, 0, SP.cv.width, SP.cv.height);
    SP.sparks = SP.sparks.filter(function (s) {
      var el = now - s.t; if (el >= c.duration) return false;
      var p = el / c.duration, e = p * (2 - p); // ease-out
      var dist = e * c.radius * c.extra, len = c.size * (1 - e);
      var cs = Math.cos(s.a), sn = Math.sin(s.a);
      ctx.strokeStyle = s.col; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x + dist * cs, s.y + dist * sn); ctx.lineTo(s.x + (dist + len) * cs, s.y + (dist + len) * sn); ctx.stroke();
      return true;
    });
    if (SP.sparks.length) SP.raf = requestAnimationFrame(spFrame);
    else { SP.raf = 0; ctx.clearRect(0, 0, SP.cv.width, SP.cv.height); }
  }
  function spBurst(x, y) {
    spCanvas();
    var now = performance.now(), col = accent(), n = SP.cfg.count;
    for (var i = 0; i < n; i++) SP.sparks.push({ x: x, y: y, a: (2 * Math.PI * i) / n, t: now, col: col });
    if (SP.sparks.length > 160) SP.sparks.splice(0, SP.sparks.length - 160);
    if (!SP.raf) SP.raf = requestAnimationFrame(spFrame);
  }
  document.addEventListener('pointerdown', function (e) {
    if (!SP.on || !motionOK() || e.button > 0) return;
    spBurst(e.clientX, e.clientY);
  }, { capture: true, passive: true });

  // =========================================================
  // 2) Magnet — padding 100, magnetStrength 2 (faqat sichqoncha; offset yumshoq chegaralangan)
  // =========================================================
  var MAG_SEL = '.add-task-btn, .btn-save, .ct-btn-save, #ds-sidebar .tab, #ds-sidebar button.ds-nav-item, .tabs > .tab, .x-hub-nav button, [data-magnet]';
  var MG = { on: false, list: [], listT: 0, raf: 0, x: 0, y: 0, active: [], pad: 100, strength: 2, max: 14 };
  function mgList(now) {
    if (now - MG.listT < 1000) return MG.list;
    MG.listT = now;
    MG.list = Array.prototype.filter.call(document.querySelectorAll(MAG_SEL), function (el) { return el.offsetParent !== null || el.getClientRects().length; });
    return MG.list;
  }
  function mgRelease(el) {
    el._mgx = 0; el._mgy = 0; el.style.translate = '0px 0px';
    el.classList.add('lu-mag-out'); el.classList.remove('lu-mag');
    clearTimeout(el._mgT);
    el._mgT = setTimeout(function () { el.classList.remove('lu-mag-out'); if (!el._mgx && !el._mgy) el.style.translate = ''; }, 520);
  }
  function mgTick() {
    MG.raf = 0;
    var now = performance.now(), list = mgList(now), x = MG.x, y = MG.y, still = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i], r = el.getBoundingClientRect();
      if (!r.width) continue;
      var cx = r.left + r.width / 2 - (el._mgx || 0), cy = r.top + r.height / 2 - (el._mgy || 0);
      var dx = x - cx, dy = y - cy;
      if (Math.abs(dx) < r.width / 2 + MG.pad && Math.abs(dy) < r.height / 2 + MG.pad) {
        var ox = dx / MG.strength, oy = dy / MG.strength, m = Math.sqrt(ox * ox + oy * oy);
        if (m > MG.max) { ox *= MG.max / m; oy *= MG.max / m; } // "gently" — katta tugmalar uchishib ketmasin
        el._mgx = ox; el._mgy = oy;
        el.classList.add('lu-mag'); el.classList.remove('lu-mag-out');
        el.style.translate = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
        still.push(el);
      }
    }
    MG.active.forEach(function (el) { if (still.indexOf(el) === -1) mgRelease(el); });
    MG.active = still;
  }
  function mgReleaseAll() { MG.active.forEach(mgRelease); MG.active = []; }
  function mgUsable() { return MG.on && finePointer() && motionOK(); }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !mgUsable()) return;
    MG.x = e.clientX; MG.y = e.clientY;
    if (!MG.raf) MG.raf = requestAnimationFrame(mgTick);
  }, { passive: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && MG.active.length) mgReleaseAll(); }, { passive: true });

  // =========================================================
  // 3) Crosshair — #fff, opacity .85, thickness 1, smoothing .35, targetEffect 'lock', showCoordinates
  // =========================================================
  var LOCK_SEL = 'button, a[href], [role="button"], [role="switch"], [role="radio"], [onclick], .dz-card, select, label[for]';
  var CH = { on: false, el: null, h: null, v: null, box: null, xy: null, raf: 0, x: -100, y: -100, tx: -100, ty: -100, mx: 0, my: 0, lock: null, shown: false, smoothing: 0.35 };
  function chBuild() {
    if (CH.el) return;
    var w = document.createElement('div');
    w.id = 'lu-fx-cross'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<i class="lu-ch-h"></i><i class="lu-ch-v"></i><b class="lu-ch-box"><s></s><s></s><s></s><s></s></b><span class="lu-ch-xy"></span>';
    document.body.appendChild(w);
    CH.el = w; CH.h = w.children[0]; CH.v = w.children[1]; CH.box = w.children[2]; CH.xy = w.children[3];
  }
  function chShow(on) { if (CH.el && CH.shown !== on) { CH.shown = on; CH.el.classList.toggle('on', on); } }
  function chTick() {
    CH.raf = 0;
    var k = motionOK() ? (1 - CH.smoothing) : 1;
    CH.x += (CH.tx - CH.x) * k; CH.y += (CH.ty - CH.y) * k;
    if (Math.abs(CH.tx - CH.x) < 0.3) CH.x = CH.tx;
    if (Math.abs(CH.ty - CH.y) < 0.3) CH.y = CH.ty;
    CH.h.style.transform = 'translate3d(0,' + CH.y.toFixed(1) + 'px,0)';
    CH.v.style.transform = 'translate3d(' + CH.x.toFixed(1) + 'px,0,0)';
    CH.xy.style.transform = 'translate3d(' + (CH.mx + 14) + 'px,' + (CH.my + 14) + 'px,0)';
    CH.xy.textContent = Math.round(CH.mx) + ', ' + Math.round(CH.my);
    if (CH.x !== CH.tx || CH.y !== CH.ty) CH.raf = requestAnimationFrame(chTick);
  }
  function chUsable() { return CH.on && finePointer(); }
  document.addEventListener('pointermove', function (e) {
    if (!chUsable()) return;
    if (e.pointerType !== 'mouse') { chShow(false); return; }
    chBuild();
    CH.mx = e.clientX; CH.my = e.clientY;
    var t = e.target && e.target.closest ? e.target.closest(LOCK_SEL) : null;
    if (t && (t.id === 'lu-fx-cross' || t === document.body)) t = null;
    var r = t ? t.getBoundingClientRect() : null;
    if (r && (r.width > window.innerWidth * 0.9 || r.height > 220 || !r.width)) r = null; // juda katta konteynerlarga lock qilmaymiz
    if (r) {
      CH.tx = r.left + r.width / 2; CH.ty = r.top + r.height / 2;
      CH.box.style.width = (r.width + 10) + 'px'; CH.box.style.height = (r.height + 10) + 'px';
      CH.box.style.transform = 'translate3d(' + (r.left - 5) + 'px,' + (r.top - 5) + 'px,0)';
      CH.el.classList.add('locked');
    } else {
      CH.tx = e.clientX; CH.ty = e.clientY;
      CH.el.classList.remove('locked');
    }
    if (!CH.shown) { CH.x = CH.tx; CH.y = CH.ty; }
    chShow(true);
    if (!CH.raf) CH.raf = requestAnimationFrame(chTick);
  }, { passive: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) chShow(false); }, { passive: true });
  window.addEventListener('blur', function () { chShow(false); });
  document.addEventListener('scroll', function () { if (CH.el) CH.el.classList.remove('locked'); }, { passive: true, capture: true });

  // =========================================================
  // 5) TargetCursor — spinDuration 2s, hideDefaultCursor, parallaxOn
  // =========================================================
  var TC_SEL = 'button, a[href], [role="button"], [role="switch"], [role="tab"], [onclick], select, label[for], .cursor-target';
  var TC = { on: false, el: null, dot: null, cs: [], raf: 0, shown: false, mx: -100, my: -100, ang: 0, cur: null, lock: null, last: 0, spin: 2 };
  var TC_OFF = [[-1, -1], [1, -1], [1, 1], [-1, 1]], TC_R = 11, TC_PAD = 6;
  function tcBuild() {
    if (TC.el) return;
    var w = document.createElement('div');
    w.id = 'lu-fx-target'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<i class="tc tl"></i><i class="tc tr"></i><i class="tc br"></i><i class="tc bl"></i><b class="tc-dot"></b>';
    document.body.appendChild(w);
    TC.el = w; TC.cs = Array.prototype.slice.call(w.querySelectorAll('.tc')); TC.dot = w.querySelector('.tc-dot');
    TC.cur = TC_OFF.map(function (o) { return [TC.mx + o[0] * TC_R, TC.my + o[1] * TC_R]; });
  }
  function tcShow(on) { if (TC.el && TC.shown !== on) { TC.shown = on; TC.el.classList.toggle('on', on); } if (!on) root.classList.remove('lu-tc-lock'); }
  function tcTargets() {
    var r = TC.lock && TC.lock.isConnected ? TC.lock.getBoundingClientRect() : null;
    if (r && r.width) {
      // parallax: burchaklar kursor tomonga biroz siljiydi
      var px = (TC.mx - (r.left + r.width / 2)) * 0.06, py = (TC.my - (r.top + r.height / 2)) * 0.06;
      return [[r.left - TC_PAD + px, r.top - TC_PAD + py], [r.right + TC_PAD + px, r.top - TC_PAD + py], [r.right + TC_PAD + px, r.bottom + TC_PAD + py], [r.left - TC_PAD + px, r.bottom + TC_PAD + py]];
    }
    var a = TC.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return TC_OFF.map(function (o) { var x = o[0] * TC_R, y = o[1] * TC_R; return [TC.mx + x * c - y * s, TC.my + x * s + y * c]; });
  }
  function tcTick(now) {
    TC.raf = 0;
    if (!TC.shown) return;
    var dt = Math.min(0.05, (now - (TC.last || now)) / 1000); TC.last = now;
    var mo = motionOK();
    if (TC.lock) TC.ang += ((Math.round(TC.ang / 90) * 90) - TC.ang) * 0.25;
    else if (mo) TC.ang = (TC.ang + dt * 360 / TC.spin) % 360;
    var tg = tcTargets(), k = mo ? 0.3 : 1, rot = TC.lock ? 0 : TC.ang;
    for (var i = 0; i < 4; i++) {
      TC.cur[i][0] += (tg[i][0] - TC.cur[i][0]) * k; TC.cur[i][1] += (tg[i][1] - TC.cur[i][1]) * k;
      TC.cs[i].style.transform = 'translate3d(' + TC.cur[i][0].toFixed(1) + 'px,' + TC.cur[i][1].toFixed(1) + 'px,0) rotate(' + rot.toFixed(1) + 'deg)';
    }
    TC.dot.style.transform = 'translate3d(' + TC.mx + 'px,' + TC.my + 'px,0)';
    TC.raf = requestAnimationFrame(tcTick);
  }
  function tcUsable() { return TC.on && finePointer(); }
  document.addEventListener('pointermove', function (e) {
    if (!tcUsable()) return;
    if (e.pointerType !== 'mouse') { tcShow(false); return; }
    tcBuild();
    TC.mx = e.clientX; TC.my = e.clientY;
    var t = e.target && e.target.closest ? e.target.closest(TC_SEL) : null;
    if (t) { var r = t.getBoundingClientRect(); if (!r.width || r.width > window.innerWidth * 0.9 || r.height > 220) t = null; }
    TC.lock = t;
    root.classList.toggle('lu-tc-lock', !!t);
    if (!TC.shown) { TC.cur = tcTargets().map(function (p) { return p.slice(); }); TC.last = 0; }
    tcShow(true);
    if (!TC.raf) TC.raf = requestAnimationFrame(tcTick);
  }, { passive: true });
  document.addEventListener('pointerdown', function () { if (TC.el && TC.shown) { TC.el.classList.add('down'); } }, { passive: true });
  document.addEventListener('pointerup', function () { if (TC.el) TC.el.classList.remove('down'); }, { passive: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) tcShow(false); }, { passive: true });
  window.addEventListener('blur', function () { tcShow(false); });

  // =========================================================
  // 4) StarBorder — CSS (effects.css): html.lu-fx-star; hover 'lap' — tezlashadi, clickPulse
  // =========================================================
  var SB_SEL = '.add-task-btn, .btn-save, .ct-btn-save, #reyting-me-card, .lu-sb-demo';
  function sbRate(el, rate) {
    try {
      if (!el.getAnimations) return;
      (document.getAnimations ? document.getAnimations() : []).forEach(function (a) {
        var ef = a.effect;
        if (ef && ef.target === el && a.animationName === 'lu-sb-spin') {
          if (a.updatePlaybackRate) a.updatePlaybackRate(rate); else a.playbackRate = rate;
        }
      });
    } catch (e) {}
  }
  function sbActive() { return root.classList.contains('lu-fx-star'); }
  document.addEventListener('pointerover', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SB_SEL) : null;
    if (!t || t._sbHot || !(sbActive() || t.classList.contains('lu-sb-demo')) || !motionOK()) return;
    t._sbHot = true; sbRate(t, 3.2);
  }, { passive: true });
  document.addEventListener('pointerout', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SB_SEL) : null;
    if (!t || !t._sbHot || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    t._sbHot = false; sbRate(t, 1);
  }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SB_SEL) : null;
    if (!t || !(sbActive() || t.classList.contains('lu-sb-demo')) || !motionOK()) return;
    t.classList.remove('lu-sb-pulse'); void t.offsetWidth; t.classList.add('lu-sb-pulse');
    clearTimeout(t._sbP); t._sbP = setTimeout(function () { t.classList.remove('lu-sb-pulse'); }, 700);
  }, { passive: true });

  // =========================================================
  // 6) Shockwave — ikki halqa (asosiy + kechikkan ingichka), ease-out, 650ms
  // =========================================================
  var WV = { on: false, cv: null, ctx: null, rings: [], raf: 0, dpr: 1, dur: 650, R: 46 };
  function wvCanvas() {
    if (WV.cv) return WV.cv;
    var c = document.createElement('canvas');
    c.id = 'lu-fx-wave'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    WV.cv = c; WV.ctx = c.getContext('2d'); wvResize();
    return c;
  }
  function wvResize() {
    if (!WV.cv) return;
    WV.dpr = Math.min(window.devicePixelRatio || 1, 2);
    WV.cv.width = Math.round(window.innerWidth * WV.dpr); WV.cv.height = Math.round(window.innerHeight * WV.dpr);
  }
  function wvFrame(now) {
    var ctx = WV.ctx;
    ctx.setTransform(WV.dpr, 0, 0, WV.dpr, 0, 0);
    ctx.clearRect(0, 0, WV.cv.width, WV.cv.height);
    WV.rings = WV.rings.filter(function (r) {
      var el = now - r.t - r.delay; if (el < 0) return true;
      if (el >= WV.dur) return false;
      var p = el / WV.dur, e = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha = (1 - p) * r.a;
      ctx.strokeStyle = r.col; ctx.lineWidth = r.w * (1 - p * 0.6);
      ctx.beginPath(); ctx.arc(r.x, r.y, 4 + e * WV.R * r.s, 0, Math.PI * 2); ctx.stroke();
      if (r.fill) { ctx.globalAlpha = (1 - p) * 0.12; ctx.fillStyle = r.col; ctx.fill(); }
      return true;
    });
    ctx.globalAlpha = 1;
    if (WV.rings.length) WV.raf = requestAnimationFrame(wvFrame);
    else { WV.raf = 0; ctx.clearRect(0, 0, WV.cv.width, WV.cv.height); }
  }
  function wvBurst(x, y) {
    wvCanvas();
    var now = performance.now(), col = accent();
    WV.rings.push({ x: x, y: y, t: now, delay: 0, s: 1, w: 2.5, a: 0.9, col: col, fill: true });
    WV.rings.push({ x: x, y: y, t: now, delay: 110, s: 1.35, w: 1.2, a: 0.6, col: col });
    if (WV.rings.length > 60) WV.rings.splice(0, WV.rings.length - 60);
    if (!WV.raf) WV.raf = requestAnimationFrame(wvFrame);
  }
  document.addEventListener('pointerdown', function (e) {
    if (!WV.on || !motionOK() || e.button > 0) return;
    wvBurst(e.clientX, e.clientY);
  }, { capture: true, passive: true });

  // =========================================================
  // 7) Glow Trail — so'nggi nuqtalar bo'yicha ingichkalashib so'nuvchi porloq chiziq (450ms umr)
  // =========================================================
  var TR = { on: false, cv: null, ctx: null, pts: [], raf: 0, dpr: 1, life: 450, down: false };
  function trCanvas() {
    if (TR.cv) return TR.cv;
    var c = document.createElement('canvas');
    c.id = 'lu-fx-trail'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    TR.cv = c; TR.ctx = c.getContext('2d'); trResize();
    return c;
  }
  function trResize() {
    if (!TR.cv) return;
    TR.dpr = Math.min(window.devicePixelRatio || 1, 2);
    TR.cv.width = Math.round(window.innerWidth * TR.dpr); TR.cv.height = Math.round(window.innerHeight * TR.dpr);
  }
  function trFrame(now) {
    var ctx = TR.ctx;
    ctx.setTransform(TR.dpr, 0, 0, TR.dpr, 0, 0);
    ctx.clearRect(0, 0, TR.cv.width, TR.cv.height);
    TR.pts = TR.pts.filter(function (p) { return now - p.t < TR.life; });
    var n = TR.pts.length;
    if (n > 1) {
      var col = TR.col || accent();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.strokeStyle = col;
      for (var i = 1; i < n; i++) {
        var a = TR.pts[i - 1], b = TR.pts[i], k = 1 - (now - b.t) / TR.life;
        ctx.globalAlpha = Math.max(0, k) * 0.85;
        ctx.lineWidth = 1 + 5 * k * (i / n);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    if (n) TR.raf = requestAnimationFrame(trFrame);
    else { TR.raf = 0; TR.col = null; ctx.clearRect(0, 0, TR.cv.width, TR.cv.height); }
  }
  document.addEventListener('pointermove', function (e) {
    if (!TR.on || !motionOK()) return;
    if (e.pointerType === 'touch' && !TR.down) return;
    trCanvas();
    var last = TR.pts[TR.pts.length - 1];
    if (last && Math.abs(last.x - e.clientX) + Math.abs(last.y - e.clientY) < 2) return;
    if (!TR.col) TR.col = accent();
    TR.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (TR.pts.length > 48) TR.pts.shift();
    if (!TR.raf) TR.raf = requestAnimationFrame(trFrame);
  }, { passive: true });
  document.addEventListener('pointerdown', function () { TR.down = true; }, { passive: true, capture: true });
  document.addEventListener('pointerup', function () { TR.down = false; }, { passive: true, capture: true });
  document.addEventListener('pointercancel', function () { TR.down = false; }, { passive: true, capture: true });

  // =========================================================
  // 8) Spotlight — hover qilingan karta ustiga bitta fixed qatlam: radial yorug'lik + chegara nuri
  // =========================================================
  var SPOT_SEL = '.task-card, .settings-sub-card, .settings-info-card, .pc-card, .xst-card, .x-card, .quests-card, #calendar-section, #goals-calendar-section, [data-spot]';
  var SL = { on: false, el: null, card: null, x: 0, y: 0, raf: 0 };
  function slBuild() {
    if (SL.el) return SL.el;
    var d = document.createElement('div');
    d.id = 'lu-fx-spot'; d.setAttribute('aria-hidden', 'true');
    document.body.appendChild(d); SL.el = d; return d;
  }
  function slHide() { SL.card = null; if (SL.el) SL.el.classList.remove('on'); }
  function slTick() {
    SL.raf = 0;
    var c = SL.card; if (!c || !SL.el) return;
    var r = c.getBoundingClientRect();
    if (!r.width || SL.x < r.left || SL.x > r.right || SL.y < r.top || SL.y > r.bottom) { slHide(); return; }
    var st = SL.el.style;
    st.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    st.width = r.width + 'px'; st.height = r.height + 'px';
    st.borderRadius = getComputedStyle(c).borderRadius || '14px';
    st.setProperty('--sx', (SL.x - r.left) + 'px'); st.setProperty('--sy', (SL.y - r.top) + 'px');
    SL.el.classList.add('on');
  }
  document.addEventListener('pointermove', function (e) {
    if (!SL.on || e.pointerType !== 'mouse' || !finePointer()) return;
    SL.x = e.clientX; SL.y = e.clientY;
    var t = e.target && e.target.closest ? e.target.closest(SPOT_SEL) : null;
    // ichma-ich kartalarda eng ichkisi tanlanadi; modal ichidagi yoki juda katta bloklar emas
    if (!t || t.closest('.modal-overlay, .x-studio, [role="dialog"]')) { if (SL.card) slHide(); return; }
    slBuild(); SL.card = t;
    if (!SL.raf) SL.raf = requestAnimationFrame(slTick);
  }, { passive: true });
  document.addEventListener('scroll', function () { if (SL.card && !SL.raf) SL.raf = requestAnimationFrame(slTick); }, { passive: true, capture: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) slHide(); }, { passive: true });
  window.addEventListener('blur', slHide);


  // =========================================================
  // 9-16) Yangi effektlar: konfetti, ripple, 3D tilt, pufakchalar, emoji, qor, neon, qo'ng'izlar
  // Zarrachalar bitta canvas'da (P2): bosishdagi portlashlar + fon (qor, qo'ng'izlar)
  // =========================================================
  var P2 = { cv: null, ctx: null, dpr: 1, parts: [], amb: [], raf: 0, last: 0, on: {} };
  function p2Canvas() {
    if (P2.cv) return P2.cv;
    var c = document.createElement('canvas');
    c.id = 'lu-fx-p2'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    P2.cv = c; P2.ctx = c.getContext('2d'); p2Resize();
    return c;
  }
  function p2Resize() {
    if (!P2.cv) return;
    P2.dpr = Math.min(window.devicePixelRatio || 1, 2);
    P2.cv.width = Math.round(window.innerWidth * P2.dpr); P2.cv.height = Math.round(window.innerHeight * P2.dpr);
  }
  function p2Ambient() { return (P2.on.snow || P2.on.fly) && motionOK() && !document.hidden; }
  function p2Kick() { if (!P2.raf && (P2.parts.length || p2Ambient())) { p2Canvas(); P2.last = 0; P2.raf = requestAnimationFrame(p2Frame); } }
  var CONF_COL = ['#F472B6', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F87171'];
  function p2Seed() {
    var W = window.innerWidth, H = window.innerHeight, small = Math.min(W, H) < 700, want = [];
    if (P2.on.snow) want.push(['snow', small ? 36 : 70]);
    if (P2.on.fly) want.push(['fly', small ? 14 : 24]);
    P2.amb = P2.amb.filter(function (a) { return (a.k === 'snow' && P2.on.snow) || (a.k === 'fly' && P2.on.fly); });
    want.forEach(function (w) {
      var have = P2.amb.filter(function (a) { return a.k === w[0]; }).length;
      for (var i = have; i < w[1]; i++) P2.amb.push(w[0] === 'snow'
        ? { k: 'snow', x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.4, v: 18 + Math.random() * 40, ph: Math.random() * 6.28, o: .35 + Math.random() * .5 }
        : { k: 'fly', x: Math.random() * W, y: Math.random() * H, r: 1.4 + Math.random() * 1.6, a: Math.random() * 6.28, v: 10 + Math.random() * 18, ph: Math.random() * 6.28 });
    });
  }
  function p2Frame(now) {
    P2.raf = 0;
    var ctx = P2.ctx, W = window.innerWidth, H = window.innerHeight;
    var dt = P2.last ? Math.min(0.05, (now - P2.last) / 1000) : 0.016; P2.last = now;
    ctx.setTransform(P2.dpr, 0, 0, P2.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var amb = p2Ambient(), light = isLight();
    if (amb) {
      for (var i = 0; i < P2.amb.length; i++) {
        var a = P2.amb[i];
        if (a.k === 'snow') {
          a.ph += dt; a.y += a.v * dt; a.x += Math.sin(a.ph * 0.9) * 14 * dt;
          if (a.y > H + 5) { a.y = -5; a.x = Math.random() * W; }
          ctx.globalAlpha = a.o; ctx.fillStyle = light ? '#9db4d8' : '#ffffff';
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
        } else {
          a.ph += dt; a.a += (Math.sin(a.ph * 0.7) * 0.9) * dt;
          a.x += Math.cos(a.a) * a.v * dt; a.y += Math.sin(a.a) * a.v * dt;
          if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10; if (a.y < -10) a.y = H + 10; if (a.y > H + 10) a.y = -10;
          var gl = 0.35 + 0.65 * Math.max(0, Math.sin(a.ph * 1.6));
          var g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 6);
          g.addColorStop(0, light ? 'rgba(217,119,6,.55)' : 'rgba(255,230,120,.75)'); g.addColorStop(1, 'rgba(255,220,100,0)');
          ctx.globalAlpha = gl; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 6, 0, 6.2832); ctx.fill();
          ctx.fillStyle = light ? '#b45309' : '#fff7c2'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
        }
      }
    }
    P2.parts = P2.parts.filter(function (p) {
      p.t += dt; if (p.t >= p.life) return false;
      var k = p.t / p.life;
      if (p.k === 'conf') {
        p.vy += 900 * dt; p.vx *= (1 - 1.6 * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * .8 + .2);
        ctx.globalAlpha = 1 - Math.max(0, (k - .7) / .3); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      } else if (p.k === 'bub') {
        p.vy -= 40 * dt; p.y += p.vy * dt; p.x += Math.sin(p.t * 5 + p.ph) * 30 * dt;
        ctx.globalAlpha = (1 - k) * .9; ctx.strokeStyle = p.c; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * 0.6), 0, 6.2832); ctx.stroke();
        ctx.globalAlpha = (1 - k) * .55; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .18, 0, 6.2832); ctx.fill();
      } else if (p.k === 'emo') {
        p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        var sc = k < .2 ? k / .2 : 1;
        ctx.globalAlpha = 1 - Math.max(0, (k - .55) / .45); ctx.font = Math.round(p.s * sc) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.e, p.x, p.y);
      }
      return true;
    });
    ctx.globalAlpha = 1;
    if (P2.parts.length || amb) P2.raf = requestAnimationFrame(p2Frame);
    else { P2.last = 0; ctx.clearRect(0, 0, W, H); }
  }
  function confBurst(x, y) {
    for (var i = 0; i < 26; i++) {
      var ang = -Math.PI / 2 + (Math.random() - .5) * 2.2, sp = 220 + Math.random() * 320;
      P2.parts.push({ k: 'conf', x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: Math.random() * 6, vr: (Math.random() - .5) * 14, s: 6 + Math.random() * 6, c: CONF_COL[i % CONF_COL.length], t: 0, life: 1.3 + Math.random() * .5 });
    }
  }
  function bubBurst(x, y) {
    var col = accent();
    for (var i = 0; i < 9; i++) P2.parts.push({ k: 'bub', x: x + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 16, vy: -40 - Math.random() * 70, r: 4 + Math.random() * 9, ph: Math.random() * 6, c: i % 2 ? col : '#7dd3fc', t: 0, life: 1.2 + Math.random() * .7 });
  }
  var EMO = ['💖', '✨', '⭐', '💜', '🌟', '💫'];
  function emoBurst(x, y) {
    for (var i = 0; i < 7; i++) {
      var ang = -Math.PI / 2 + (Math.random() - .5) * 1.8, sp = 160 + Math.random() * 160;
      P2.parts.push({ k: 'emo', e: EMO[(Math.random() * EMO.length) | 0], x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, s: 14 + Math.random() * 12, t: 0, life: 1.1 + Math.random() * .4 });
    }
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || !motionOK()) return;
    var any = false;
    if (P2.on.confetti) { confBurst(e.clientX, e.clientY); any = true; }
    if (P2.on.bubble) { bubBurst(e.clientX, e.clientY); any = true; }
    if (P2.on.emoji) { emoBurst(e.clientX, e.clientY); any = true; }
    if (any) { if (P2.parts.length > 400) P2.parts.splice(0, P2.parts.length - 400); p2Kick(); }
  }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) p2Kick(); });

  // --- Ripple: tugma ustida "siyoh" to'lqini (alohida fixed qatlam — tugma ichiga hech narsa qo'shilmaydi)
  var RP_SEL = 'button, .tab, [role="button"], .x-sec, .task-card, .x-shop-it, .x-tchip';
  var RP = { on: false };
  document.addEventListener('pointerdown', function (e) {
    if (!RP.on || e.button > 0 || !motionOK()) return;
    var b = e.target && e.target.closest ? e.target.closest(RP_SEL) : null; if (!b) return;
    var r = b.getBoundingClientRect(); if (!r.width || r.width > 900) return;
    var cs = getComputedStyle(b);
    var w = document.createElement('div'); w.className = 'lu-rp';
    w.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + cs.borderRadius;
    var d = Math.sqrt(r.width * r.width + r.height * r.height) * 2;
    var s = document.createElement('i');
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    w.appendChild(s); document.body.appendChild(w);
    setTimeout(function () { w.remove(); }, 650);
  }, { capture: true, passive: true });

  // --- 3D Tilt: kartalar kursor tomonga egiladi (faqat sichqoncha)
  var TILT_SEL = '.task-card, .x-card, .x-sec, .stat, .x-shop-it, .fd-card, .th-it, .dz-card, .badge-card';
  var TL = { on: false, el: null, raf: 0, x: 0, y: 0 };
  function tlReset(el) { if (!el) return; el.classList.remove('lu-tilt'); el.style.removeProperty('--tx'); el.style.removeProperty('--ty'); el.style.removeProperty('--tgx'); el.style.removeProperty('--tgy'); }
  function tlTick() {
    TL.raf = 0; var el = TL.el; if (!el) return;
    var r = el.getBoundingClientRect(); if (!r.width) return;
    var px = (TL.x - r.left) / r.width - .5, py = (TL.y - r.top) / r.height - .5;
    var k = r.width > 500 ? 3 : 8;
    el.style.setProperty('--tx', (-py * k).toFixed(2) + 'deg'); el.style.setProperty('--ty', (px * k).toFixed(2) + 'deg');
    el.style.setProperty('--tgx', ((px + .5) * 100).toFixed(1) + '%'); el.style.setProperty('--tgy', ((py + .5) * 100).toFixed(1) + '%');
    el.classList.add('lu-tilt');
  }
  document.addEventListener('pointermove', function (e) {
    if (!TL.on || e.pointerType !== 'mouse' || !finePointer() || !motionOK()) { if (TL.el) { tlReset(TL.el); TL.el = null; } return; }
    var t = e.target && e.target.closest ? e.target.closest(TILT_SEL) : null;
    if (t && t.closest('.modal-overlay, [role="dialog"], .x-ov')) t = null;
    if (t !== TL.el) { tlReset(TL.el); TL.el = t; }
    if (!t) return;
    TL.x = e.clientX; TL.y = e.clientY;
    if (!TL.raf) TL.raf = requestAnimationFrame(tlTick);
  }, { passive: true });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && TL.el) { tlReset(TL.el); TL.el = null; } }, { passive: true });

  // =========================================================
  // Holatni qo'llash
  // =========================================================
  function sync() {
    SP.on = enabled('u_spark');
    MG.on = enabled('u_magnet');
    if (!mgUsable()) mgReleaseAll();
    CH.on = enabled('u_cross');
    if (!CH.on) chShow(false);
    root.classList.toggle('lu-fx-star', enabled('u_star'));
    root.classList.toggle('lu-fx-cross', CH.on && finePointer());
    TC.on = enabled('u_target');
    if (!TC.on) tcShow(false);
    root.classList.toggle('lu-fx-tc', TC.on && finePointer());
    WV.on = enabled('u_wave');
    TR.on = enabled('u_trail');
    if (!TR.on) TR.pts = [];
    SL.on = enabled('u_spot');
    if (!SL.on) slHide();
    P2.on = { confetti: enabled('u_confetti'), bubble: enabled('u_bubble'), emoji: enabled('u_emoji'), snow: enabled('u_snow'), fly: enabled('u_fly') };
    if (!P2.on.confetti && !P2.on.bubble && !P2.on.emoji) P2.parts = [];
    p2Seed(); p2Kick();
    RP.on = enabled('u_ripple');
    TL.on = enabled('u_tilt');
    if (!TL.on && TL.el) { tlReset(TL.el); TL.el = null; }
    root.classList.toggle('lu-fx-neon', enabled('u_neon'));
    root.classList.toggle('lu-fx-tilt', TL.on && finePointer());
  }

  function toggle(id) {
    var it = byId(id), x = st(); if (!it || !x || !owned(id)) return false;
    if (!Array.isArray(x.ufx)) x.ufx = [];
    var i = x.ufx.indexOf(id);
    if (i === -1) x.ufx.push(id); else x.ufx.splice(i, 1);
    try { if (typeof save === 'function') save(); } catch (e) {}
    sync();
    try { if (window.LUDesign) window.LUDesign.renderPicker(); } catch (e) {}
    try { if (typeof window.xShopRefresh === 'function') window.xShopRefresh(); } catch (e) {}
    try { if (typeof toast === 'function') toast(i === -1 ? '✨ ' + L(it.n[0], it.n[1], it.n[2]) + ' — ' + L('yoqildi', 'on', 'включено') : L(it.n[0], it.n[1], it.n[2]) + ' — ' + L('o\'chirildi', 'off', 'выключено')); } catch (e) {}
    return true;
  }

  // ---------- Do'kon preview'lari (CSS animatsiyali; sichqoncha olib kelinganda demo) ----------
  function previewHtml(key) {
    if (key === 'spark') return '<div class="fxp fxp-spark" data-fxdemo="spark">' + new Array(9).join('<i></i>') + '</div>';
    if (key === 'magnet') return '<div class="fxp fxp-mag"><span class="fxp-btn">+ Add</span><i class="fxp-cur"></i></div>';
    if (key === 'cross') return '<div class="fxp fxp-ch"><i class="h"></i><i class="v"></i><span class="fxp-btn">OK</span><b></b></div>';
    if (key === 'star') return '<div class="fxp fxp-star"><span class="fxp-btn lu-sb-demo">+ Add</span></div>';
    if (key === 'target') return '<div class="fxp fxp-tc"><span class="fxp-btn">OK</span><i></i><i></i><i></i><i></i></div>';
    if (key === 'wave') return '<div class="fxp fxp-wave" data-fxdemo="wave"><i></i><i></i><b></b></div>';
    if (key === 'trail') return '<div class="fxp fxp-trail" data-fxdemo="trail"><svg viewBox="0 0 120 56" preserveAspectRatio="none"><path d="M8 40 C 30 6, 52 6, 62 28 S 96 50, 112 14"/></svg><i></i></div>';
    if (key === 'spot') return '<div class="fxp fxp-spot"><span class="fxp-card"><b></b><b></b></span><i></i></div>';
    if (key === 'confetti') return '<div class="fxp fxp-conf" data-fxdemo="confetti">' + new Array(13).join('<i></i>') + '</div>';
    if (key === 'ripple') return '<div class="fxp fxp-rip"><span class="fxp-btn">+ Add<i></i></span></div>';
    if (key === 'tilt') return '<div class="fxp fxp-tilt"><span class="fxp-card"><b></b><b></b></span></div>';
    if (key === 'bubble') return '<div class="fxp fxp-bub" data-fxdemo="bubble">' + new Array(7).join('<i></i>') + '</div>';
    if (key === 'emoji') return '<div class="fxp fxp-emo" data-fxdemo="emoji"><i>💖</i><i>✨</i><i>⭐</i><i>💜</i><i>🌟</i></div>';
    if (key === 'snow') return '<div class="fxp fxp-snow">' + new Array(15).join('<i></i>') + '</div>';
    if (key === 'neon') return '<div class="fxp fxp-neon"><span class="fxp-btn">+ Add</span></div>';
    if (key === 'fly') return '<div class="fxp fxp-fly">' + new Array(8).join('<i></i>') + '</div>';
    return '';
  }
  function demo(key, x, y) {
    if (!motionOK()) return;
    if (key === 'spark') spBurst(x, y);
    else if (key === 'wave') wvBurst(x, y);
    else if (key === 'confetti') { confBurst(x, y); p2Kick(); }
    else if (key === 'bubble') { bubBurst(x, y); p2Kick(); }
    else if (key === 'emoji') { emoBurst(x, y); p2Kick(); }
  }
  document.addEventListener('mouseover', function (e) {
    var d = e.target && e.target.closest ? e.target.closest('[data-fxdemo]') : null;
    if (!d || d._dm) return;
    d._dm = true; setTimeout(function () { d._dm = false; }, 700);
    var r = d.getBoundingClientRect(); demo(d.getAttribute('data-fxdemo'), r.left + r.width / 2, r.top + r.height / 2);
  }, { passive: true });

  // ---------- Sozlamalar (dizayn tanlash ostida) ----------
  function settingsHtml() {
    var h = '<div class="dz-title" style="margin-top:16px">✨ ' + esc3(L('UI effektlar', 'UI effects', 'UI-эффекты')) + '</div><div class="lu-fx-set">';
    var fine = finePointer(), mo = motionOK();
    CAT.forEach(function (it) {
      var own = owned(it.id), on = enabled(it.id);
      var note = it.desktop && !fine ? L('Faqat kompyuterda (sichqoncha)', 'Desktop / mouse only', 'Только с мышью') :
        (!mo && it.key !== 'cross' ? L('Animatsiya o\'chiq — effekt to\'xtatilgan', 'Animation is off — paused', 'Анимация выключена — пауза') : L(it.d[0], it.d[1], it.d[2]));
      h += '<div class="lu-fx-row"><span class="lu-fx-ic">' + it.icon + '</span><div class="lu-fx-tx"><div class="lu-fx-n">' + esc3(L(it.n[0], it.n[1], it.n[2])) + '</div>' +
        '<div class="lu-fx-d">' + esc3(note) + '</div></div>' +
        (own ? '<div class="dz-switch' + (on ? ' on' : '') + '" role="switch" tabindex="0" aria-checked="' + on + '" data-fx-toggle="' + it.id + '"><div class="dz-knob"></div></div>'
          : '<button type="button" class="lu-fx-buy" data-fx-buy="' + it.id + '">🔒 ' + esc3(priceTxt(it)) + '</button>') + '</div>';
    });
    return h + '</div>';
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-fx-toggle], [data-fx-buy]') : null;
    if (!t) return;
    if (t.hasAttribute('data-fx-toggle')) toggle(t.getAttribute('data-fx-toggle'));
    else {
      try { if (typeof window.xOpenShopItem === 'function') window.xOpenShopItem(t.getAttribute('data-fx-buy')); } catch (e2) {}
    }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.hasAttribute && t.hasAttribute('data-fx-toggle')) { e.preventDefault(); toggle(t.getAttribute('data-fx-toggle')); }
  });

  window.addEventListener('resize', function () { spResize(); wvResize(); trResize(); p2Resize(); MG.listT = 0; }, { passive: true });
  window.addEventListener('lu:design', function () { sync(); });
  function onMQ() { sync(); try { if (window.LUDesign) window.LUDesign.renderPicker(); } catch (e) {} }
  [reduceMQ, fineMQ].forEach(function (mq) { if (!mq) return; if (mq.addEventListener) mq.addEventListener('change', onMQ); else if (mq.addListener) mq.addListener(onMQ); });

  window.LUFx = {
    catalog: function () { return CAT.map(function (it) { return { id: it.id, key: it.key, icon: it.icon, n: it.n.slice(), d: it.d.slice(), coins: it.coins, gems: it.gems, desktop: !!it.desktop }; }); },
    enabled: enabled, owned: owned, toggle: toggle, sync: sync, previewHtml: previewHtml, settingsHtml: settingsHtml, demo: demo,
    byKey: byKey, finePointer: finePointer
  };

  function boot() { sync(); try { if (window.LUDesign) window.LUDesign.renderPicker(); } catch (e) {} }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
