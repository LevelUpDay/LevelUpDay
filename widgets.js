/* ============================================================
   🧩 WIDGETS — yangi standart UI to'plami (React Bits uslubidagi
   komponentlarning vanilla-JS qayta yozilgani):
     SwipeToast    — toast() va showUndoToast() o'rniga: suriladigan,
                     "pilik" (fuse) taymerli, ustma-ust turadigan xabarlar
     BellToggle    — eslatmalarni yoqish banneridagi qo'ng'iroq tugmasi
     WakeSlider    — ovoz balandligi slayderlari (to'lqinli ustunchalar)
     SlideCommit   — do'kondagi xaridni "surib tasdiqlash"
     Shredder      — savatdan butunlay o'chirishda kartani maydalash
     BranchedMenu  — sozlamalar guruhlariga shoxlangan tez o'tish menyusi
     Stepper       — kirishdagi savol-javob (welcome survey) qadamlari
   Eski ko'rinish o'chirilmagan: do'kondagi "Klassik interfeys"
   (id: ui_classic, S.shop.uistyle) sotib olinib yoqilsa — barcha eski
   toast/slayder/oynalar qaytadi. script.js dan KEYIN yuklanadi.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return en; }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- Holat: yangi (standart) yoki klassik (do'kondan) ----------
  function shopSt() { try { return (typeof S !== 'undefined' && S && S.shop && typeof S.shop === 'object') ? S.shop : null; } catch (e) { return null; } }
  function classic() {
    var x = shopSt();
    return !!(x && x.uistyle === 'ui_classic' && Array.isArray(x.owned) && x.owned.indexOf('ui_classic') !== -1);
  }
  function active() { return !classic(); }

  // ⚠️ script.js bloklari try{} ichida — funksiyalarni global almashtirib bo'lmaydi.
  // Shuning uchun script.js dagi toast(), showUndoToast(), wsUpdateDots(), wsRenderStep()
  // boshida LUWidgets.active() tekshiriladi va shu yerdagi funksiyalar chaqiriladi.

  /* ============================================================
     1) SWIPE TOAST
     ============================================================ */
  var TW = null, MAX_TOASTS = 3;
  function toastWrap() {
    if (TW && TW.isConnected) return TW;
    TW = el('div', 'luw-toasts', { 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.appendChild(TW);
    return TW;
  }
  function swipeToast(o) {
    o = o || {};
    var w = toastWrap();
    var t = el('div', 'luw-toast', { role: 'status' });
    var body = el('div', 'luw-t-body');
    var title = el('div', 'luw-t-title'); title.textContent = o.title == null ? '' : String(o.title);
    body.appendChild(title);
    if (o.description) { var d = el('div', 'luw-t-desc'); d.textContent = o.description; body.appendChild(d); }
    t.appendChild(body);
    var act = null;
    if (o.actionLabel) {
      act = el('button', 'luw-t-act', { type: 'button' }); act.textContent = o.actionLabel;
      t.appendChild(act);
    }
    var fuse = el('i', 'luw-t-fuse', { 'aria-hidden': 'true' });
    t.appendChild(fuse);
    w.appendChild(t);
    while (w.children.length > MAX_TOASTS) dismissToast(w.firstElementChild, 'overflow', true);

    var duration = o.duration || 2500, fuseAnim = null, paused = 0;
    try {
      fuseAnim = fuse.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: duration, easing: 'linear', fill: 'forwards' });
      fuseAnim.onfinish = function () { dismissToast(t, 'timeout'); };
    } catch (e) { t._tm = setTimeout(function () { dismissToast(t, 'timeout'); }, duration); }
    t._fuse = fuseAnim; t._onClose = o.onClose;
    function pause() { paused++; if (fuseAnim && fuseAnim.playState === 'running') fuseAnim.pause(); }
    function resume() { paused = Math.max(0, paused - 1); if (!paused && fuseAnim && fuseAnim.playState === 'paused' && !t._gone) fuseAnim.play(); }
    t.addEventListener('mouseenter', pause);
    t.addEventListener('mouseleave', resume);

    if (act) act.addEventListener('click', function (e) {
      e.stopPropagation();
      dismissToast(t, 'action');
      if (typeof o.onAction === 'function') o.onAction();
    });

    // 👉 Surib yopish (swipeDistance 40px)
    var sx = 0, sy = 0, dx = 0, drag = false, pid = null;
    t.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.luw-t-act') || e.button > 0) return;
      drag = true; pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0;
      try { t.setPointerCapture(pid); } catch (e2) {}
      t.classList.add('drag'); pause();
    });
    t.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== pid) return;
      dx = e.clientX - sx;
      if (Math.abs(e.clientY - sy) > 40 && Math.abs(dx) < 12) return;
      t.style.transform = 'translateX(' + dx + 'px)';
      t.style.opacity = String(clamp(1 - Math.abs(dx) / 220, 0.25, 1));
    });
    function end() {
      if (!drag) return;
      drag = false; t.classList.remove('drag');
      if (Math.abs(dx) > 40) { t._flyDir = dx > 0 ? 1 : -1; dismissToast(t, 'swipe'); return; }
      t.style.transform = ''; t.style.opacity = '';
      resume();
    }
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);

    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); });
    return t;
  }
  function dismissToast(t, reason, instant) {
    if (!t || t._gone) return;
    t._gone = true;
    clearTimeout(t._tm);
    try { if (t._fuse) t._fuse.cancel(); } catch (e) {}
    var cb = t._onClose;
    if (instant || reduced()) { t.remove(); if (typeof cb === 'function') cb(reason); return; }
    var h = t.offsetHeight;
    t.style.height = h + 'px';
    t.classList.add('out');
    if (t._flyDir) t.style.transform = 'translateX(' + (t._flyDir * 360) + 'px)';
    requestAnimationFrame(function () {
      t.style.height = '0px'; t.style.marginTop = '-10px';
      t.style.paddingTop = '0px'; t.style.paddingBottom = '0px';
    });
    setTimeout(function () { t.remove(); if (typeof cb === 'function') cb(reason); }, 340);
  }

  function plainToast(msg) {
    try { var old = $('toast'); if (old) old.classList.remove('show'); } catch (e) {}
    return swipeToast({ title: msg, duration: 2500 });
  }
  function undoToast(msg, undoFn) {
    try { var u = $('undo-toast'); if (u) u.classList.remove('show'); } catch (e) {}
    return swipeToast({
      title: msg, duration: 5000,
      actionLabel: '↩ ' + L('Qaytarish', 'Undo', 'Отменить'),
      onAction: function () {
        if (typeof undoFn !== 'function') return;
        try { _undoRunning = true; } catch (e) {}
        try { undoFn(); } finally { try { _undoRunning = false; } catch (e) {} }
        try { save(); render(); } catch (e) {}
      }
    });
  }

  /* ============================================================
     2) BELL TOGGLE
     ============================================================ */
  var BELL_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path class="luw-bell-body" d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path class="luw-bell-clap" d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  function bellToggle(o) {
    o = o || {};
    var b = el('button', 'luw-bell', { type: 'button', 'aria-pressed': 'false' });
    b.innerHTML = '<span class="luw-bell-ic">' + BELL_SVG + '<i class="luw-bell-wave"></i><i class="luw-bell-wave w2"></i></span>' +
      '<span class="luw-bell-lbls"><span class="luw-bell-off"></span><span class="luw-bell-on"></span></span>';
    b.querySelector('.luw-bell-off').textContent = o.offLabel || '';
    b.querySelector('.luw-bell-on').textContent = o.onLabel || '';
    var svg = b.querySelector('svg');
    function setPressed(p) { b.setAttribute('aria-pressed', p ? 'true' : 'false'); b.classList.toggle('on', !!p); }
    function ring() {
      if (reduced() || !svg.animate) return;
      // ringAmplitude 17°, ringPasses 5, ringDecay 1, ringDuration 820ms
      var A = 17, passes = 5, frames = [{ transform: 'rotate(0deg)' }];
      for (var k = 1; k <= passes; k++) frames.push({ transform: 'rotate(' + (A * Math.pow(1 - (k - 1) / passes, 1) * (k % 2 ? 1 : -1)).toFixed(2) + 'deg)' });
      frames.push({ transform: 'rotate(0deg)' });
      svg.animate(frames, { duration: 820, easing: 'ease-out' });
      b.classList.remove('waving'); void b.offsetWidth; b.classList.add('waving');
      clearTimeout(b._wv); b._wv = setTimeout(function () { b.classList.remove('waving'); }, 900);
    }
    b.addEventListener('click', function () {
      var next = b.getAttribute('aria-pressed') !== 'true';
      setPressed(next);
      if (next) ring();
      if (typeof o.onChange === 'function') o.onChange(next);
    });
    b._set = setPressed;
    if (o.defaultPressed) setPressed(true);
    return b;
  }
  function mountNotifBell() {
    var bar = $('notif-request-bar');
    if (!bar || bar.querySelector('.luw-bell')) return;
    var b = bellToggle({
      offLabel: L('Eslatmalarni yoqish', 'Notify me', 'Включить напоминания'),
      onLabel: L('Eslatmalar yoqildi', "You'll be notified", 'Напоминания включены'),
      onChange: function (p) {
        if (!p) return;
        setTimeout(function () {
          try { if (typeof requestNotifPermission === 'function') requestNotifPermission(); } catch (e) {}
          // Ruxsat berilmasa — qo'ng'iroq yana "o'chiq" holatiga qaytadi
          setTimeout(function () {
            try { if (typeof Notification === 'undefined' || Notification.permission !== 'granted') b._set(false); } catch (e) {}
          }, 4000);
        }, 450);
      }
    });
    bar.appendChild(b);
  }

  /* ============================================================
     3) WAKE SLIDER — mavjud <input type=range> ustiga to'lqinli ustunchalar
     (input saqlanadi va shaffof holda ustida turadi: klaviatura, sudrash,
     oninput — hammasi avvalgidek ishlaydi)
     ============================================================ */
  var WAKE_IDS = ['master-volume-slider', 'pomo-set-volume', 'focus-volume-slider'];
  var wakes = [];
  function wakeSlider(input) {
    if (!input || input._luw) return;
    var BARS = 32, REST = 10, H = 40, REACH = 6, SKEW = 0.6, GLIDE = 0.3;
    var wrap = el('div', 'luw-wake');
    var barsEl = el('div', 'luw-wake-bars', { 'aria-hidden': 'true' });
    var bubble = el('span', 'luw-wake-val', { 'aria-hidden': 'true' });
    var bars = [];
    for (var i = 0; i < BARS; i++) { var s = el('i'); barsEl.appendChild(s); bars.push(s); }
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(barsEl); wrap.appendChild(input); wrap.appendChild(bubble);
    input.classList.add('luw-wake-input');

    var st = { act: 0, pos: -10, dir: 0, h: new Array(BARS).fill(REST), raf: 0, last: performance.now(), lastVal: null };
    function frac() {
      var mn = parseFloat(input.min || 0), mx = parseFloat(input.max || 100), v = parseFloat(input.value);
      return mx > mn ? clamp((v - mn) / (mx - mn), 0, 1) : 0;
    }
    function paint() {
      var f = frac(), lit = Math.round(f * BARS);
      for (var i = 0; i < BARS; i++) {
        bars[i].style.height = st.h[i].toFixed(1) + 'px';
        bars[i].classList.toggle('lit', i < lit);
      }
      bubble.textContent = input.value;
      bubble.style.left = (f * 100) + '%';
      st.lastVal = input.value;
    }
    function tick(now) {
      st.raf = 0;
      var dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
      st.act *= Math.exp(-dt / GLIDE);
      var moving = false;
      for (var i = 0; i < BARS; i++) {
        var d = i - st.pos;
        var r = REACH * (1 + SKEW * (d * st.dir < 0 ? 1 : -0.5)); // harakat ortidan "iz" uzunroq
        var target = REST + (H - REST) * st.act * Math.exp(-(d * d) / (r * r));
        st.h[i] += (target - st.h[i]) * Math.min(1, dt * 14);
        if (Math.abs(target - st.h[i]) > 0.3) moving = true;
      }
      paint();
      if (moving || st.act > 0.02) st.raf = requestAnimationFrame(tick);
      else wrap.classList.remove('waking');
    }
    function wake(posIdx) {
      if (!active()) return;
      if (reduced()) { paint(); return; }
      var p = posIdx == null ? frac() * (BARS - 1) : posIdx;
      st.dir = p > st.pos ? 1 : p < st.pos ? -1 : st.dir;
      st.pos = p; st.act = 1;
      wrap.classList.add('waking');
      if (!st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(tick); }
    }
    input.addEventListener('input', function () { wake(); });
    input.addEventListener('change', function () { paint(); });
    input.addEventListener('focus', function () { wake(); });
    wrap.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' && !e.buttons) {
        var r = wrap.getBoundingClientRect();
        wake(clamp((e.clientX - r.left) / r.width, 0, 1) * (BARS - 1));
      }
    });
    input._luw = { paint: paint };
    wakes.push(input);
    paint();
  }
  function mountWakes() { WAKE_IDS.forEach(function (id) { wakeSlider($(id)); }); }
  // Skript qiymatni dasturiy o'zgartirsa (input hodisasisiz) — ustunchalar ham yangilansin
  setInterval(function () {
    if (document.hidden || !active()) return;
    wakes.forEach(function (inp) { if (inp._luw && inp.offsetParent !== null && String(inp.value) !== String(inp._luw.lastVal)) { inp._luw.lastVal = inp.value; inp._luw.paint(); } });
  }, 500);

  /* ============================================================
     4) SLIDE COMMIT — surib tasdiqlash oynasi
     o: { icon, title, message, label, doneLabel, errorLabel, onConfirm(): false → xato, onCancel }
     ============================================================ */
  function slideConfirm(o) {
    o = o || {};
    var prevFocus = document.activeElement;
    var ov = el('div', 'luw-sc-ov', { role: 'dialog', 'aria-modal': 'true' });
    var box = el('div', 'luw-sc-box');
    var ic = el('div', 'luw-sc-ic'); ic.textContent = o.icon || '🛍';
    var tt = el('div', 'luw-sc-title'); tt.textContent = o.title || '';
    box.appendChild(ic); box.appendChild(tt);
    if (o.message) { var ms = el('div', 'luw-sc-msg'); ms.textContent = o.message; box.appendChild(ms); }
    var track = el('div', 'luw-sc-track');
    var fill = el('i', 'luw-sc-fill');
    var lbl = el('span', 'luw-sc-lbl'); lbl.textContent = o.label || L('Surib tasdiqlang', 'Slide to confirm', 'Сдвиньте для подтверждения');
    var handle = el('button', 'luw-sc-handle', { type: 'button', 'aria-label': lbl.textContent });
    handle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="ar" d="M9 6l6 6-6 6"/><path class="ok" d="M5 12.5l4.5 4.5L19 7.5"/><path class="no" d="M7 7l10 10M17 7L7 17"/></svg>';
    track.appendChild(fill); track.appendChild(lbl); track.appendChild(handle);
    box.appendChild(track);
    var cancel = el('button', 'luw-sc-cancel', { type: 'button' }); cancel.textContent = L('Bekor qilish', 'Cancel', 'Отмена');
    box.appendChild(cancel);
    ov.appendChild(box);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    setTimeout(function () { try { handle.focus({ preventScroll: true }); } catch (e) {} }, 60);

    var x = 0, max = 0, dragging = false, sx = 0, pid = null, busy = false, closed = false;
    function measure() { max = Math.max(0, track.clientWidth - handle.offsetWidth - 8); }
    function setX(v, anim) {
      x = clamp(v, 0, max);
      track.classList.toggle('settle', !!anim);
      handle.style.transform = 'translateX(' + x + 'px)';
      fill.style.width = (x + handle.offsetWidth / 2 + 4) + 'px';
      lbl.style.opacity = String(clamp(1 - x / (max * 0.7 || 1), 0, 1));
    }
    function close(ok) {
      if (closed) return; closed = true;
      ov.classList.remove('open');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function () { ov.remove(); }, 220);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) {}
      if (!ok && typeof o.onCancel === 'function') o.onCancel();
    }
    function commit() {
      if (busy) return; busy = true;
      measure(); setX(max, true);
      var ok = true;
      try { ok = (typeof o.onConfirm === 'function') ? o.onConfirm() !== false : true; } catch (e) { ok = false; }
      if (ok) {
        track.classList.add('done'); lbl.textContent = o.doneLabel || '✓'; lbl.style.opacity = '1';
        setTimeout(function () { close(true); }, reduced() ? 400 : 1100);
      } else {
        track.classList.add('err'); lbl.textContent = o.errorLabel || L('Xatolik', 'Failed', 'Ошибка'); lbl.style.opacity = '1';
        setTimeout(function () { track.classList.remove('err'); busy = false; lbl.textContent = o.label || ''; setX(0, true); }, 1400);
      }
    }
    handle.addEventListener('pointerdown', function (e) {
      if (busy) return;
      measure(); dragging = true; pid = e.pointerId; sx = e.clientX - x;
      try { handle.setPointerCapture(pid); } catch (e2) {}
      track.classList.add('drag');
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) { if (dragging && e.pointerId === pid) setX(e.clientX - sx, false); });
    function release() {
      if (!dragging) return; dragging = false; track.classList.remove('drag');
      if (x >= max * 0.9) commit(); else setX(0, true); // returnBounce
    }
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', release);
    handle.addEventListener('click', function (e) { e.preventDefault(); });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); if (!busy) close(false); return; }
      if (document.activeElement === handle && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'End')) { e.preventDefault(); commit(); }
    }
    document.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', function () { if (!busy) close(false); });
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov && !busy) close(false); });
    measure(); setX(0, false);
    return { close: function () { close(false); } };
  }

  /* ============================================================
     5) SHREDDER — kartani tasmalarga bo'lib "maydalaydi", so'ng done()
     ============================================================ */
  function shred(card, done) {
    var finish = function () { try { done(); } catch (e) { console.warn('[LUW] shred done:', e); } };
    if (!card || !card.isConnected || !active() || reduced()) return finish();
    if (card._shredding) return; card._shredding = true;
    var r = card.getBoundingClientRect();
    if (!r.width || !r.height) return finish();
    var STRIP = 10, n = Math.ceil(r.width / STRIP), FALL = 140, CURL = 1;
    var layer = el('div', 'luw-shred', { 'aria-hidden': 'true' });
    var cs = getComputedStyle(card);
    layer.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;z-index:10001;pointer-events:none';
    var tpl = card.cloneNode(true);
    tpl.removeAttribute('id');
    tpl.style.cssText += ';position:absolute;top:0;margin:0;box-sizing:border-box;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' + cs.borderRadius;
    var slot = el('i', 'luw-shred-slot');
    var strips = [];
    for (var i = 0; i < n; i++) {
      var s = el('div', 'luw-shred-strip');
      s.style.cssText = 'left:' + (i * STRIP) + 'px;width:' + Math.min(STRIP, r.width - i * STRIP) + 'px';
      var c = tpl.cloneNode(true); c.style.left = (-i * STRIP) + 'px';
      s.appendChild(c); layer.appendChild(s); strips.push(s);
    }
    layer.appendChild(slot);
    document.body.appendChild(layer);
    card.style.visibility = 'hidden';
    // Maydalash: kartani pastga "tishlar" orqali o'tkazib, tasmalar egilib tushadi
    var feedMs = 520;
    strips.forEach(function (s, i) {
      var curl = (i % 2 ? 1 : -1) * (4 + Math.random() * 6) * CURL;
      var drift = (Math.random() - 0.5) * 10;
      try {
        s.animate([
          { transform: 'translateY(0) rotate(0deg)', opacity: 1, clipPath: 'inset(0 0 0 0)' },
          { transform: 'translateY(' + (r.height * 0.55) + 'px) rotate(0deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(' + drift + 'px,' + (r.height + FALL) + 'px) rotate(' + curl + 'deg)', opacity: 0 }
        ], { duration: feedMs + 380, delay: (i % 3) * 18, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      } catch (e) {}
    });
    setTimeout(function () {
      layer.remove();
      // Karta joyini yumshoq yig'ib, so'ng holatni o'zgartiramiz
      card.style.overflow = 'hidden';
      card.style.maxHeight = r.height + 'px';
      card.style.transition = 'max-height .22s ease, padding .22s ease, margin .22s ease, border-width .22s ease';
      requestAnimationFrame(function () {
        card.style.maxHeight = '0px'; card.style.paddingTop = '0px'; card.style.paddingBottom = '0px';
        card.style.marginTop = '0px'; card.style.marginBottom = '0px'; card.style.borderWidth = '0px';
      });
      setTimeout(finish, 240);
    }, feedMs + 420);
  }
  // Savatdagi kartani topib maydalash (script.js chaqiradi)
  function shredTrash(kind, key, done) {
    var sel = kind === 'sub' ? '[data-trash-sub="' + key + '"]' : '[data-trash-task="' + key + '"]';
    var card = null;
    try { card = document.querySelector('#trash-list ' + sel); } catch (e) {}
    shred(card, done);
  }

  /* ============================================================
     6) BRANCHED MENU — sozlamalar guruhlariga tez o'tish
     ============================================================ */
  function mountBranchMenu() {
    var grid = document.querySelector('#settings-panel .settings-groups-grid');
    if (!grid || document.querySelector('.luw-bm')) return;
    var nav = el('nav', 'luw-bm', { 'aria-label': L('Sozlamalar bo\'limlari', 'Settings sections', 'Разделы настроек') });
    var head = el('button', 'luw-bm-head', { type: 'button', 'aria-expanded': 'false' });
    var list = el('div', 'luw-bm-list');
    var ul = el('ul', 'luw-bm-ul');
    list.appendChild(ul); nav.appendChild(head); nav.appendChild(list);
    grid.parentNode.insertBefore(nav, grid);
    var activeId = null;
    function label() { head.innerHTML = '<span class="luw-bm-ic">🧭</span><span class="luw-bm-t"></span><span class="luw-bm-car">▾</span>'; head.querySelector('.luw-bm-t').textContent = L('Tez o\'tish', 'Quick jump', 'Быстрый переход'); }
    function build() {
      label(); ul.innerHTML = '';
      var cards = Array.prototype.filter.call(grid.children, function (c) { return c.classList.contains('settings-sub-card') && c.id && c.style.display !== 'none'; });
      cards.forEach(function (c, i) {
        var ti = c.querySelector('.settings-sub-title'), ic = c.querySelector('.settings-sub-icon');
        if (!ti) return;
        var li = el('li'); li.style.setProperty('--i', i);
        var b = el('button', 'luw-bm-row' + (c.id === activeId ? ' on' : ''), { type: 'button', 'data-card': c.id });
        b.innerHTML = '<span class="luw-bm-ri"></span><span class="luw-bm-rt"></span>';
        var txt = ti.textContent.trim();
        // Sarlavha o'zi emoji bilan boshlansa — alohida ikonka takrorlanmasin
        var lead = /^[^\p{L}\p{N}]+/u.exec(txt);
        b.querySelector('.luw-bm-ri').textContent = lead ? lead[0].trim() : (ic ? ic.textContent.trim() : '•');
        b.querySelector('.luw-bm-rt').textContent = lead ? txt.slice(lead[0].length) : txt;
        li.appendChild(b); ul.appendChild(li);
      });
    }
    head.addEventListener('click', function () {
      var open = !nav.classList.contains('open');
      if (open) build();
      nav.classList.toggle('open', open);
      head.setAttribute('aria-expanded', String(open));
      try { if (typeof SFX !== 'undefined' && SFX.click) SFX.click(); } catch (e) {}
    });
    ul.addEventListener('click', function (e) {
      var b = e.target.closest('.luw-bm-row'); if (!b) return;
      var id = b.getAttribute('data-card'), card = $(id); if (!card) return;
      activeId = id;
      Array.prototype.forEach.call(ul.querySelectorAll('.luw-bm-row'), function (x) { x.classList.toggle('on', x === b); });
      var body = card.querySelector('.settings-sub-body');
      if (body && body.style.display === 'none' && typeof toggleSettingsSubCard === 'function') toggleSettingsSubCard(id);
      setTimeout(function () { try { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e2) { card.scrollIntoView(); } }, 30);
      card.classList.remove('luw-flash'); void card.offsetWidth; card.classList.add('luw-flash');
    });
    label();
  }

  /* ============================================================
     7) STEPPER — kirishdagi savol-javob qadamlari
     ============================================================ */
  var CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // true qaytarsa — chizildi (script.js eski nuqtalarni chizmaydi)
  function stepperDots() {
    var dotsEl = $('ws-dots');
    if (!dotsEl) return false;
    if (!active()) { dotsEl.classList.remove('luw-stepper'); return false; }
    var total = 3, step = 0;
    try { total = WS_TOTAL_STEPS; step = wsState.step; } catch (e) {}
    if (!dotsEl.classList.contains('luw-stepper') || dotsEl.querySelectorAll('.luw-st-dot').length !== total) {
      dotsEl.classList.add('luw-stepper');
      var h = '';
      for (var i = 0; i < total; i++) {
        if (i) h += '<div class="luw-st-line"><i></i></div>';
        h += '<div class="luw-st-dot" data-n="' + (i + 1) + '"><b>' + (i + 1) + '</b>' + CHECK_SVG + '</div>';
      }
      dotsEl.innerHTML = h;
    }
    Array.prototype.forEach.call(dotsEl.querySelectorAll('.luw-st-dot'), function (d, i) {
      d.classList.toggle('active', i === step); d.classList.toggle('done', i < step);
    });
    Array.prototype.forEach.call(dotsEl.querySelectorAll('.luw-st-line'), function (l, i) { l.classList.toggle('done', i < step); });
    return true;
  }
  var wsLast = null;
  // wsRenderStep() oxirida chaqiriladi: qadam almashsa — kontent yon tomondan siljib kiradi
  function stepperAnimate() {
    var step = null;
    try { step = wsState.step; } catch (e) {}
    var body = $('ws-body');
    if (active() && body && wsLast !== null && step !== wsLast && !reduced() && body.animate) {
      var dir = step > wsLast ? 1 : -1;
      body.animate([{ opacity: 0, transform: 'translateX(' + (dir * 28) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    wsLast = step;
  }

  /* ============================================================
     Holatni qo'llash
     ============================================================ */
  function sync() {
    var on = active();
    root.classList.toggle('luw-on', on);
    root.classList.toggle('luw-classic', !on);
    if (on) { mountNotifBell(); mountWakes(); mountBranchMenu(); wakes.forEach(function (i) { if (i._luw) i._luw.paint(); }); }
    else {
      // Klassik rejimda yangi toastlar yopiladi
      if (TW) Array.prototype.slice.call(TW.children).forEach(function (t) { dismissToast(t, 'mode', true); });
    }
    // Kirish so'rovnomasi widgets.js dan oldin ochilgan bo'lishi mumkin — qadamlarni qayta chizamiz
    try { if ($('ws-dots') && typeof wsUpdateDots === 'function') wsUpdateDots(); } catch (e) {}
  }

  window.LUWidgets = {
    active: active, classic: classic, sync: sync,
    toast: swipeToast, plainToast: plainToast, undoToast: undoToast, dismiss: dismissToast,
    stepperDots: stepperDots, stepperAnimate: stepperAnimate,
    bellToggle: bellToggle, wakeSlider: wakeSlider,
    slideConfirm: slideConfirm, shred: shred, shredTrash: shredTrash
  };

  function boot() { try { sync(); } catch (e) { console.warn('[LUW] boot:', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
})();
