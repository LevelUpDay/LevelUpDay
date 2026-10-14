// ============================================================
// ✨ EFFECTS — do'kondan sotib olinadigan UI effektlar (React Bits'ning vanilla JS qayta yozilgani):
//   u_spark  — ClickSpark : har bosishda uchqunlar (canvas overlay)
//   u_magnet — Magnet     : asosiy tugmalar sichqonchaga yengil tortiladi (faqat sichqoncha)
//   u_cross  — Crosshair  : butun ekran nishon chiziqlari + tugmalarga "lock" (faqat sichqoncha)
//   u_star   — StarBorder : asosiy tugma/kartalar chegarasi bo'ylab yuguruvchi yulduz (CSS)
//   u_target — TargetCursor: aylanuvchi burchakli kursor, tugmalarni "qamrab oladi" (faqat sichqoncha)
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
      d: ['Aylanuvchi burchaklar tugmalarni qamrab oladi', 'Spinning corners snap around buttons', 'Вращающиеся уголки обхватывают кнопки'] }
  ];
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
    return '';
  }
  function demo(key, x, y) { if (key === 'spark' && motionOK()) spBurst(x, y); }
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

  window.addEventListener('resize', function () { spResize(); MG.listT = 0; }, { passive: true });
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
