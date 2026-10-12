/* ============================================================
   🧩 UI KIT — qayta ishlatiladigan vanilla-JS komponentlar
   (React Bits'dan ilhomlangan, noldan yozilgan):
     UIKit.codeSlots(target, opts)     — raqamli kod / PIN slotlari
     UIKit.rubberSegment(target, opts) — "rezina" thumb'li segment
     UIKit.holdButton(target, opts)    — bosib turib tasdiqlash tugmasi
     UIKit.holdConfirm(opts)           — HoldButton'li tasdiqlash oynasi
   Ranglar sukut bo'yicha mavzu CSS o'zgaruvchilariga bog'langan
   (--surface2, --accent, --text, --red ...), shuning uchun har qanday
   mavzu (qorong'i/yorug') bilan mos ishlaydi. Props orqali almashtirish
   mumkin. prefers-reduced-motion hurmat qilinadi.
   ============================================================ */
(function () {
  'use strict';

  function L(uz, en, ru) {
    var l = 'uz';
    try { l = (typeof getLang === 'function') ? getLang() : (localStorage.getItem('lang') || 'uz'); } catch (e) {}
    return l === 'ru' ? (ru || en) : (l === 'en' ? en : uz);
  }
  function reduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function resolve(t) { return typeof t === 'string' ? document.querySelector(t) : t; }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function px(v) { return typeof v === 'number' ? v + 'px' : v; }
  var _uid = 0;
  function uid(p) { return 'uk-' + p + '-' + (++_uid); }

  /* ------------------------------------------------------------
     1) CODE SLOTS
     ------------------------------------------------------------ */
  function codeSlots(target, opts) {
    opts = opts || {};
    var host = resolve(target);
    var len = Math.max(1, Math.min(12, opts.length || 6));
    var cascade = opts.cascade != null ? opts.cascade : 20;
    var settle = opts.settle != null ? opts.settle : 0.3;
    var bounce = opts.bounce != null ? opts.bounce : 0.2;
    var mask = !!opts.mask;
    var value = '';
    var pos = 0;
    var status = 'idle';
    var pendingValue = null;
    var statusTimer = null;
    var disabled = false;
    var maskTimers = [];

    var root = el('div', 'uk-cs');
    var vars = {
      '--uk-cs-size': px(opts.slotSize || 44),
      '--uk-cs-gap': px(opts.gap != null ? opts.gap : 8),
      '--uk-cs-radius': px(opts.radius != null ? opts.radius : 12),
      '--uk-cs-rise': px(opts.rise != null ? opts.rise : 8),
      '--uk-cs-bounce': String(bounce),
      '--uk-cs-settle': (settle * 1000) + 'ms'
    };
    if (opts.accentColor) vars['--uk-cs-accent'] = opts.accentColor;
    if (opts.inkColor) vars['--uk-cs-ink'] = opts.inkColor;
    if (opts.slotColor) vars['--uk-cs-slot'] = opts.slotColor;
    if (opts.digitColor) vars['--uk-cs-digit'] = opts.digitColor;
    if (opts.dangerColor) vars['--uk-cs-danger'] = opts.dangerColor;
    Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });

    var input = el('input', 'uk-cs-input', {
      type: 'text', inputmode: 'numeric', pattern: '[0-9]*',
      autocomplete: mask ? 'off' : 'one-time-code', maxlength: String(len),
      'aria-label': opts.label || L(len + ' xonali kod', len + '-digit code', 'Код из ' + len + ' цифр'),
      spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', enterkeyhint: 'done'
    });
    if (mask) input.classList.add('uk-cs-input--mask');
    if (opts.id) input.id = opts.id;
    var row = el('div', 'uk-cs-row', { 'aria-hidden': 'true' });
    var slots = [];
    for (var i = 0; i < len; i++) {
      var s = el('div', 'uk-cs-slot');
      var ch = el('span', 'uk-cs-ch');
      var caret = el('span', 'uk-cs-caret');
      s.appendChild(ch); s.appendChild(caret);
      s.style.setProperty('--i', i);
      row.appendChild(s);
      slots.push({ box: s, ch: ch });
    }
    var live = el('span', 'uk-sr', { 'aria-live': 'polite' });
    root.appendChild(row); root.appendChild(input); root.appendChild(live);
    if (host) host.appendChild(root);

    function paint(prev, animate) {
      var rm = reduced();
      var newIdx = 0;
      for (var i = 0; i < len; i++) {
        var c = value.charAt(i);
        var p = prev.charAt(i);
        var sl = slots[i];
        sl.box.classList.toggle('is-filled', !!c);
        if (c !== p) {
          clearTimeout(maskTimers[i]);
          sl.ch.classList.remove('is-masked');
          sl.ch.textContent = c;
          if (c && animate && !rm) {
            sl.ch.classList.remove('uk-cs-pop');
            void sl.ch.offsetWidth; // animatsiyani qayta boshlash
            sl.ch.style.animationDelay = (newIdx * cascade) + 'ms';
            sl.ch.classList.add('uk-cs-pop');
            newIdx++;
          }
          if (c && mask) {
            (function (chEl, d) {
              maskTimers[i] = setTimeout(function () { chEl.classList.add('is-masked'); }, rm ? 0 : 380 + d);
            })(sl.ch, newIdx * cascade);
          }
        }
      }
      paintCaret();
    }
    function paintCaret() {
      var focused = document.activeElement === input;
      var active = Math.min(pos, len - 1);
      for (var i = 0; i < len; i++) {
        slots[i].box.classList.toggle('is-active', focused && i === active && status === 'idle' && !disabled);
      }
    }
    function syncInput() {
      input.value = value;
      try { if (document.activeElement === input) input.setSelectionRange(pos, pos); } catch (e) {}
    }
    function setInternal(v, fire, animate) {
      v = String(v || '').replace(/\D/g, '').slice(0, len);
      var prev = value;
      value = v;
      if (pos > value.length) pos = value.length;
      syncInput();
      paint(prev, animate !== false);
      if (fire && v !== prev) {
        if (typeof opts.onChange === 'function') { try { opts.onChange(value); } catch (e) { console.warn(e); } }
        if (value.length === len) complete();
      }
    }
    function complete() {
      if (typeof opts.onComplete !== 'function') return;
      var code = value;
      var r;
      try { r = opts.onComplete(code); } catch (e) { console.warn(e); return; }
      if (r && typeof r.then === 'function') {
        root.classList.add('is-busy');
        r.then(function (ok) {
          root.classList.remove('is-busy');
          if (ok === true) api.setStatus('success');
          else if (ok === false) api.setStatus('error');
        }, function () { root.classList.remove('is-busy'); api.setStatus('error'); });
      }
    }

    input.addEventListener('keydown', function (e) {
      if (disabled) { if (e.key !== 'Tab') e.preventDefault(); return; }
      // muvaffaqiyat/xato animatsiyasi paytida yozishni boshlasa — darhol tugatamiz
      // (masalan, "eski PIN to'g'ri" → yangi PIN darhol kiritiladi)
      if (status !== 'idle' && /^[0-9]$/.test(e.key)) { clearTimeout(statusTimer); endStatus(); }
      else if (status !== 'idle') { if (e.key !== 'Tab') e.preventDefault(); return; }
      var k = e.key;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // paste (Ctrl+V) va boshqalar
      if (k >= '0' && k <= '9' && k.length === 1) {
        e.preventDefault();
        if (pos >= len) pos = len - 1;
        var v = value.slice(0, pos) + k + value.slice(pos + 1);
        pos = Math.min(pos + 1, len);
        setInternal(v, true, true);
      } else if (k === 'Backspace') {
        e.preventDefault();
        if (!value.length) return;
        var at = pos > 0 ? pos - 1 : 0;
        if (pos === len && value.length === len) at = len - 1;
        pos = at;
        setInternal(value.slice(0, at) + value.slice(at + 1), true, false);
      } else if (k === 'Delete') {
        e.preventDefault();
        setInternal(value.slice(0, pos) + value.slice(pos + 1), true, false);
      } else if (k === 'ArrowLeft') {
        e.preventDefault(); pos = Math.max(0, pos - 1); syncInput(); paintCaret();
      } else if (k === 'ArrowRight') {
        e.preventDefault(); pos = Math.min(value.length, Math.min(len - 1, pos + 1)); syncInput(); paintCaret();
      } else if (k === 'Home') {
        e.preventDefault(); pos = 0; syncInput(); paintCaret();
      } else if (k === 'End') {
        e.preventDefault(); pos = Math.min(value.length, len - 1); syncInput(); paintCaret();
      } else if (k === 'Enter') {
        e.preventDefault();
        if (value.length === len) complete();
      } else if (k.length === 1) {
        e.preventDefault(); // raqam bo'lmagan belgilar qabul qilinmaydi
      }
    });
    // Virtual klaviatura (Android "Unidentified") / iOS SMS-autofill uchun zaxira yo'l
    input.addEventListener('input', function () {
      if (disabled) { syncInput(); return; }
      if (status !== 'idle') { clearTimeout(statusTimer); endStatus(); return; }
      var raw = input.value.replace(/\D/g, '').slice(0, len);
      var sel = input.selectionStart != null ? input.selectionStart : raw.length;
      pos = Math.min(sel, len);
      if (raw.length === len) pos = len;
      setInternal(raw, true, true);
    });
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      if (disabled) return;
      if (status !== 'idle') { clearTimeout(statusTimer); endStatus(); }
      var txt = '';
      try { txt = (e.clipboardData || window.clipboardData).getData('text') || ''; } catch (er) {}
      var digits = txt.replace(/\D/g, '').slice(0, len);
      if (!digits) return;
      var before = value; value = ''; // butun kod — kaskad bilan qayta to'ldiriladi
      paint(before, false);
      pos = Math.min(digits.length, len);
      setInternal(digits, true, true);
    });
    input.addEventListener('focus', function () { root.classList.add('is-focused'); syncInput(); paintCaret(); });
    input.addEventListener('blur', function () { root.classList.remove('is-focused'); paintCaret(); });
    input.addEventListener('click', function () {
      pos = Math.min(value.length, len - 1);
      syncInput(); paintCaret();
    });
    input.addEventListener('select', function () { syncInput(); });

    function endStatus() {
      status = 'idle';
      root.classList.remove('is-success', 'is-error');
      input.removeAttribute('aria-invalid');
      if (pendingValue !== null) { var pv = pendingValue; pendingValue = null; pos = pv.length; setInternal(pv, false, false); }
      paintCaret();
    }

    var api = {
      el: root,
      input: input,
      getValue: function () { return value; },
      setValue: function (v, o) {
        o = o || {};
        v = String(v || '').replace(/\D/g, '').slice(0, len);
        if (status !== 'idle' && !o.force) { pendingValue = v; return; }
        pos = v.length;
        setInternal(v, !!o.fire, o.animate !== false);
      },
      clear: function () { pendingValue = null; pos = 0; setInternal('', false, false); },
      setStatus: function (s, o) {
        o = o || {};
        clearTimeout(statusTimer);
        root.classList.remove('is-success', 'is-error');
        status = s === 'success' || s === 'error' ? s : 'idle';
        if (status === 'idle') { endStatus(); return; }
        if (mask) slots.forEach(function (sl, i) { clearTimeout(maskTimers[i]); if (sl.ch.textContent) sl.ch.classList.add('is-masked'); });
        void root.offsetWidth;
        root.classList.add('is-' + status);
        paintCaret();
        var rm = reduced();
        if (status === 'error') {
          input.setAttribute('aria-invalid', 'true');
          live.textContent = o.message || L("Noto'g'ri kod", 'Wrong code', 'Неверный код');
          if (pendingValue === null) pendingValue = ''; // xato — keyin tozalanadi
          statusTimer = setTimeout(function () { endStatus(); if (o.refocus !== false && root.classList.contains('was-focused')) input.focus(); }, rm ? 400 : 620);
          if (document.activeElement === input) root.classList.add('was-focused'); else root.classList.remove('was-focused');
          try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (e) {}
        } else {
          live.textContent = o.message || L('Tasdiqlandi', 'Confirmed', 'Подтверждено');
          var hold = o.hold != null ? o.hold : (rm ? 250 : (len * cascade * 2 + 420));
          if (o.persist) return;
          statusTimer = setTimeout(endStatus, hold);
        }
      },
      getStatus: function () { return status; },
      focus: function () { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } },
      disable: function (b) {
        disabled = !!b;
        input.disabled = disabled;
        root.classList.toggle('is-disabled', disabled);
        paintCaret();
      },
      destroy: function () { clearTimeout(statusTimer); root.remove(); }
    };
    if (opts.status && opts.status !== 'idle') api.setStatus(opts.status);
    if (opts.autoFocus) setTimeout(api.focus, 30);
    return api;
  }

  /* ------------------------------------------------------------
     2) RUBBER SEGMENT
     Ikki rejim:
       • items: [...] — noldan yaratadi;
       • adopt: true — konteynerdagi MAVJUD tugmalarni (id/onclick/
         class'lari bilan) segmentga aylantiradi; aktiv tugma activeClass
         ('active' / 'sel') orqali aniqlanadi va MutationObserver bilan
         kuzatiladi — shuning uchun mavjud kod o'zgarishsiz ishlaydi.
     ------------------------------------------------------------ */
  function rubberSegment(target, opts) {
    opts = opts || {};
    var root = resolve(target);
    if (!root) return null;
    var adopt = !!opts.adopt;
    var activeClass = opts.activeClass || 'active';
    var size = opts.size || 'md';
    var inset = opts.inset != null ? opts.inset : 3;
    var stretch = opts.stretch != null ? opts.stretch : 100;
    var squash = opts.squash != null ? opts.squash : 3;
    var speed = opts.speed != null ? opts.speed : 1;
    var glide = opts.glide != null ? opts.glide : 75;
    var draggable = opts.draggable !== false;
    var items = [];
    var buttons = [];
    var index = -1;

    root.classList.add('uk-seg', 'uk-seg--' + size);
    if (adopt) root.classList.add('uk-seg--adopt');
    if (opts.equalSlots) root.classList.add('uk-seg--equal');
    if (opts.stretchWidth) root.classList.add('uk-seg--full');
    root.style.setProperty('--uk-seg-radius', px(opts.radius != null ? opts.radius : 10));
    root.style.setProperty('--uk-seg-inset', px(inset));
    if (opts.trackColor) root.style.setProperty('--uk-seg-track', opts.trackColor);
    if (opts.thumbColor) root.style.setProperty('--uk-seg-thumb', opts.thumbColor);
    if (opts.textColor) root.style.setProperty('--uk-seg-text', opts.textColor);
    if (opts.activeTextColor) root.style.setProperty('--uk-seg-active-text', opts.activeTextColor);
    root.setAttribute('role', opts.role || 'radiogroup');
    if (opts.label) root.setAttribute('aria-label', opts.label);

    if (adopt) {
      buttons = Array.prototype.slice.call(root.querySelectorAll(opts.buttons || ':scope > button'));
    } else {
      root.innerHTML = '';
      items = (opts.items || []).map(function (it) { return typeof it === 'object' ? it : { value: it, label: String(it) }; });
      buttons = items.map(function (it) {
        var b = el('button', '', { type: 'button' });
        if (it.html) b.innerHTML = it.html; else b.textContent = it.label != null ? it.label : String(it.value);
        root.appendChild(b);
        return b;
      });
    }
    var radioRole = (opts.role || 'radiogroup') === 'tablist' ? 'tab' : 'radio';
    var thumb = el('span', 'uk-seg-thumb', { 'aria-hidden': 'true' });
    root.insertBefore(thumb, root.firstChild);
    buttons.forEach(function (b, i) {
      b.classList.add('uk-seg-item');
      b.setAttribute('role', radioRole);
      b.dataset.ukIdx = i;
      if (!adopt) b.addEventListener('click', function (e) { if (!(suppressClick && e.isTrusted)) select(i, true); });
    });

    // ---- Fizika: chap va o'ng qirralar uchun alohida prujinalar ----
    var X = { l: 0, r: 0, vl: 0, vr: 0, tl: 0, tr: 0, h: 0, top: 0 };
    var raf = 0, lastT = 0, trailStartAt = 0, moveDir = 0, inited = false;
    function measure(i) {
      var b = buttons[i];
      if (!b || !b.offsetParent) return null;
      return { l: b.offsetLeft, r: b.offsetLeft + b.offsetWidth, t: b.offsetTop, h: b.offsetHeight };
    }
    function applyThumb() {
      var w = Math.max(0, X.r - X.l);
      var base = (X.tr - X.tl) || w || 1;
      var extra = Math.max(0, w - base) / base; // cho'zilish ulushi
      var sq = Math.min(squash, squash * extra * 2);
      thumb.style.transform = 'translate3d(' + X.l + 'px,' + (X.top + sq / 2) + 'px,0)';
      thumb.style.width = w + 'px';
      thumb.style.height = Math.max(0, X.h - sq) + 'px';
    }
    function step(t) {
      var dt = Math.min(0.032, (t - (lastT || t)) / 1000) || 0.016;
      lastT = t;
      var k = 520 * speed * speed;         // asosiy qattiqlik
      var c = 2 * Math.sqrt(k) * 0.78;      // biroz "rezina" overshoot
      var s = Math.max(0, stretch) / 100;
      var kTrail = k / (1 + 1.6 * s);
      var cTrail = 2 * Math.sqrt(kTrail) * 0.9;
      var trailing = t >= trailStartAt;
      // yo'nalishga qarab oldingi qirra tezroq, orqadagi — kechikib harakatlanadi
      var lLead = moveDir < 0, rLead = moveDir > 0;
      var kl = lLead || !moveDir ? k : kTrail, cl = lLead || !moveDir ? c : cTrail;
      var kr = rLead || !moveDir ? k : kTrail, cr = rLead || !moveDir ? c : cTrail;
      if (lLead || !moveDir || trailing) { X.vl += (kl * (X.tl - X.l) - cl * X.vl) * dt; }
      if (rLead || !moveDir || trailing) { X.vr += (kr * (X.tr - X.r) - cr * X.vr) * dt; }
      X.l += X.vl * dt; X.r += X.vr * dt;
      if (X.r < X.l + 8) X.r = X.l + 8;
      applyThumb();
      var done = Math.abs(X.tl - X.l) < 0.3 && Math.abs(X.tr - X.r) < 0.3 && Math.abs(X.vl) < 5 && Math.abs(X.vr) < 5;
      if (done) { X.l = X.tl; X.r = X.tr; X.vl = X.vr = 0; applyThumb(); raf = 0; lastT = 0; root.classList.remove('is-moving'); return; }
      raf = requestAnimationFrame(step);
    }
    function moveTo(i, instant) {
      var m = measure(i);
      if (!m) { thumb.style.opacity = '0'; return; }
      thumb.style.opacity = '';
      X.top = m.t; X.h = m.h;
      var prevTl = X.tl;
      X.tl = m.l; X.tr = m.r;
      if (!inited || instant || reduced()) {
        inited = true;
        X.l = X.tl; X.r = X.tr; X.vl = X.vr = 0;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        applyThumb();
        return;
      }
      moveDir = X.tl > prevTl ? 1 : (X.tl < prevTl ? -1 : 0);
      trailStartAt = performance.now() + glide / Math.max(0.2, speed);
      root.classList.add('is-moving');
      if (!raf) { lastT = 0; raf = requestAnimationFrame(step); }
    }
    function paintItems() {
      buttons.forEach(function (b, i) {
        var on = i === index;
        b.classList.toggle('uk-seg-on', on);
        b.setAttribute('aria-' + (radioRole === 'tab' ? 'selected' : 'checked'), on ? 'true' : 'false');
        b.tabIndex = on || (index < 0 && i === 0) ? 0 : -1;
      });
    }
    function readAdoptIndex() {
      for (var i = 0; i < buttons.length; i++) if (buttons[i].classList.contains(activeClass)) return i;
      return -1;
    }
    function setIndex(i, instant) {
      var changed = i !== index;
      index = i;
      paintItems();
      if (i >= 0) moveTo(i, instant || !changed);
      else thumb.style.opacity = '0';
    }
    function select(i, fire) {
      if (i < 0 || i >= buttons.length) return;
      if (adopt) {
        if (fire) buttons[i].click(); // mavjud onclick → class o'zgaradi → observer
        return;
      }
      var changed = i !== index;
      setIndex(i);
      if (fire && changed && typeof opts.onChange === 'function') {
        try { opts.onChange(items[i].value, i); } catch (e) { console.warn(e); }
      }
    }

    // klaviatura (strelkalar / Home / End)
    root.addEventListener('keydown', function (e) {
      var tgt = e.target.closest ? e.target.closest('.uk-seg-item') : null;
      if (!tgt || tgt.parentNode !== root) return;
      var cur = +tgt.dataset.ukIdx, n = cur;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (cur + 1) % buttons.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (cur - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = buttons.length - 1;
      else return;
      e.preventDefault();
      buttons[n].focus();
      select(n, true);
    });

    // sudrab olib borish (thumb'ni ushlab — eng yaqin segmentga "snap")
    var drag = null, suppressClick = false;
    if (draggable) {
      root.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || index < 0) return;
        var b = e.target.closest ? e.target.closest('.uk-seg-item') : null;
        if (!b || +b.dataset.ukIdx !== index) return; // faqat aktiv segment (thumb) ushlanadi
        drag = { x0: e.clientX, l0: X.l, w: X.tr - X.tl, moved: false, id: e.pointerId };
      });
      root.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x0;
        if (!drag.moved && Math.abs(dx) < 5) return;
        if (!drag.moved) { drag.moved = true; try { root.setPointerCapture(e.pointerId); } catch (er) {} root.classList.add('is-dragging'); }
        var first = measure(0), last = measure(buttons.length - 1);
        if (!first || !last) return;
        var nl = Math.max(first.l, Math.min(last.r - drag.w, drag.l0 + dx));
        moveDir = nl > X.tl ? 1 : (nl < X.tl ? -1 : moveDir);
        X.tl = nl; X.tr = nl + drag.w;
        // kechikish faqat sudrash boshida — aks holda orqa qirra hech qachon ergashmaydi
        if (!drag.trailSet) { drag.trailSet = true; trailStartAt = performance.now() + glide / Math.max(0.2, speed) * 0.5; }
        if (!raf) { lastT = 0; raf = requestAnimationFrame(step); }
      });
      var endDrag = function (e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        var d = drag; drag = null;
        root.classList.remove('is-dragging');
        if (!d.moved) return;
        // drag'dan keyingi "native" (isTrusted) click yutiladi; o'zimizning
        // select() → button.click() (isTrusted=false) o'tkaziladi
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 0);
        var cx = X.tl + d.w / 2, best = index, bd = Infinity;
        buttons.forEach(function (b, i) {
          var m = measure(i); if (!m) return;
          var dd = Math.abs((m.l + m.r) / 2 - cx);
          if (dd < bd) { bd = dd; best = i; }
        });
        if (best === index) moveTo(index);
        else select(best, true);
      };
      root.addEventListener('pointerup', endDrag);
      root.addEventListener('pointercancel', endDrag);
      root.addEventListener('click', function (e) { if (suppressClick && e.isTrusted) { e.stopPropagation(); e.preventDefault(); } }, true);
    }

    // mavjud kod class'ni o'zgartirsa — thumb ergashadi
    var mo = null;
    if (adopt && window.MutationObserver) {
      mo = new MutationObserver(function () {
        buttons.forEach(function (b) { if (!b.classList.contains('uk-seg-item')) b.classList.add('uk-seg-item'); });
        var ni = readAdoptIndex();
        if (ni !== index) setIndex(ni);
        else if (index >= 0) moveTo(index, true);
      });
      buttons.forEach(function (b) { mo.observe(b, { attributes: true, attributeFilter: ['class'] }); });
    }
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { if (index >= 0 && !drag) moveTo(index, true); });
      ro.observe(root);
      buttons.forEach(function (b) { ro.observe(b); });
    }

    // boshlang'ich holat
    if (adopt) setIndex(readAdoptIndex(), true);
    else {
      var di = 0;
      if (opts.defaultValue != null) items.forEach(function (it, i) { if (it.value === opts.defaultValue) di = i; });
      setIndex(di, true);
    }

    return {
      el: root,
      getValue: function () { return adopt ? (buttons[index] ? buttons[index].id : null) : (items[index] ? items[index].value : null); },
      getIndex: function () { return index; },
      setValue: function (v, o) {
        o = o || {};
        var i = -1;
        if (typeof v === 'number' && (adopt || !items.some(function (it) { return it.value === v; }))) i = v;
        else items.forEach(function (it, k) { if (it.value === v) i = k; });
        if (i < 0) return;
        if (o.silent || adopt) setIndex(i); else select(i, true);
      },
      refresh: function () { if (adopt) { var ni = readAdoptIndex(); if (ni !== index) { setIndex(ni); return; } } if (index >= 0) moveTo(index, true); },
      destroy: function () { if (mo) mo.disconnect(); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); thumb.remove(); root.classList.remove('uk-seg', 'uk-seg--adopt'); }
    };
  }

  /* ------------------------------------------------------------
     3) HOLD BUTTON
     ------------------------------------------------------------ */
  function holdButton(target, opts) {
    opts = opts || {};
    var host = resolve(target);
    var holdTime = opts.holdTime || 2000;
    var releaseTime = opts.releaseTime != null ? opts.releaseTime : 200;
    var dir = opts.fillDirection || 'right';
    var wave = opts.wave !== false;
    var amp = opts.waveAmplitude != null ? opts.waveAmplitude : 6;
    var resetAfter = opts.resetAfter != null ? opts.resetAfter : 1200;
    var label = opts.label || opts.children || L("Bosib turing", 'Hold to confirm', 'Удерживайте');
    var doneLabel = opts.doneLabel || L('Bajarildi', 'Done', 'Готово');

    var wrap = el('div', 'uk-hold-wrap');
    var btn = el('button', 'uk-hold uk-hold--' + (opts.size || 'md'), { type: 'button' });
    if (opts.id) btn.id = opts.id;
    btn.style.setProperty('--uk-hold-radius', px(opts.radius != null ? opts.radius : 14));
    btn.style.setProperty('--uk-hold-scale', String(opts.pressScale != null ? opts.pressScale : 0.97));
    if (opts.backgroundColor) btn.style.setProperty('--uk-hold-bg', opts.backgroundColor);
    if (opts.fillColor) btn.style.setProperty('--uk-hold-fill', opts.fillColor);
    if (opts.textColor) btn.style.setProperty('--uk-hold-text', opts.textColor);
    if (opts.fillTextColor) btn.style.setProperty('--uk-hold-fill-text', opts.fillTextColor);
    if (opts.glow === false) btn.classList.add('uk-hold--noglow');
    var base = el('span', 'uk-hold-label');
    var fill = el('span', 'uk-hold-fill', { 'aria-hidden': 'true' });
    var fillLabel = el('span', 'uk-hold-label');
    fill.appendChild(fillLabel);
    btn.appendChild(base); btn.appendChild(fill);
    var hintId = uid('hint');
    var hint = null;
    if (opts.hint !== false) {
      hint = el('div', 'uk-hold-hint', { id: hintId });
      hint.textContent = opts.hint || L('Tasdiqlash uchun bosib turing', 'Press and hold to confirm', 'Нажмите и удерживайте для подтверждения');
      btn.setAttribute('aria-describedby', hintId);
    }
    var live = el('span', 'uk-sr', { 'aria-live': 'assertive' });
    wrap.appendChild(btn); if (hint) wrap.appendChild(hint); wrap.appendChild(live);
    if (host) host.appendChild(wrap);

    function setLabel(txt) {
      if (typeof txt === 'string' && /<[a-z]/i.test(txt)) { base.innerHTML = txt; fillLabel.innerHTML = txt; }
      else { base.textContent = txt; fillLabel.textContent = txt; }
    }
    setLabel(label);
    btn.setAttribute('aria-label', (base.textContent || '') + (hint ? '' : ''));

    var p = 0, holding = false, done = false, raf = 0, lastT = 0, phase = 0, drainRate = 0, resetTimer = 0;
    var disabled = !!opts.disabled;
    if (disabled) btn.disabled = true;

    function clip() {
      var pct = Math.max(0, Math.min(1, p));
      var rm = reduced();
      var a = (wave && !rm && pct > 0 && pct < 1) ? amp : 0;
      var pts = [], N = 14, i, v;
      if (dir === 'right' || dir === 'left') {
        var w = btn.offsetWidth || 1;
        var edge = pct * (w + (a ? a * 2 : 0)) - (a ? a : 0); // dalgacha to'liq yetib borishi uchun
        for (i = 0; i <= N; i++) {
          var y = i / N * 100;
          v = edge + a * Math.sin(i / N * Math.PI * 2 + phase);
          var xx = dir === 'right' ? v : w - v;
          pts.push(xx.toFixed(1) + 'px ' + y.toFixed(1) + '%');
        }
        fill.style.clipPath = dir === 'right'
          ? 'polygon(0 0, ' + pts.join(', ') + ', 0 100%)'
          : 'polygon(100% 0, ' + pts.join(', ') + ', 100% 100%)';
      } else {
        var h = btn.offsetHeight || 1;
        var edge2 = pct * (h + (a ? a * 2 : 0)) - (a ? a : 0);
        for (i = 0; i <= N; i++) {
          var x = i / N * 100;
          v = edge2 + a * 0.6 * Math.sin(i / N * Math.PI * 2 + phase);
          var yy = dir === 'down' ? v : h - v;
          pts.push(x.toFixed(1) + '% ' + yy.toFixed(1) + 'px');
        }
        fill.style.clipPath = dir === 'down'
          ? 'polygon(0 0, 100% 0, ' + pts.reverse().join(', ') + ')'
          : 'polygon(0 100%, 100% 100%, ' + pts.reverse().join(', ') + ')';
      }
      btn.style.setProperty('--uk-hold-p', pct.toFixed(3));
      btn.setAttribute('aria-valuenow', Math.round(pct * 100));
    }
    function loop(t) {
      var dt = lastT ? (t - lastT) : 16;
      lastT = t;
      if (holding) p += dt / holdTime;
      else p -= drainRate * dt;
      phase += dt / 140;
      if (p >= 1 && holding) { p = 1; clip(); finish(); raf = 0; return; }
      if (p <= 0 && !holding) { p = 0; clip(); raf = 0; lastT = 0; btn.classList.remove('is-active'); return; }
      clip();
      raf = requestAnimationFrame(loop);
    }
    function start(e) {
      if (disabled || done || holding) return;
      holding = true;
      btn.classList.add('is-holding', 'is-active');
      if (hint) hint.classList.remove('uk-hold-nudge');
      if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
    }
    function release() {
      if (!holding) return;
      holding = false;
      btn.classList.remove('is-holding');
      if (done) return;
      drainRate = releaseTime > 0 ? p / releaseTime : Infinity;
      if (p > 0.02 && p < 1 && hint) {
        hint.classList.remove('uk-hold-nudge'); void hint.offsetWidth; hint.classList.add('uk-hold-nudge');
      }
      if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
    }
    function finish() {
      holding = false; done = true;
      btn.classList.remove('is-holding');
      btn.classList.add('is-done');
      setLabel(doneLabel);
      live.textContent = typeof doneLabel === 'string' ? doneLabel.replace(/<[^>]+>/g, '') : '';
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
      if (typeof opts.onHold === 'function') { try { opts.onHold(); } catch (er) { console.warn(er); } }
      if (resetAfter > 0) resetTimer = setTimeout(api.reset, resetAfter);
    }

    btn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { btn.setPointerCapture(e.pointerId); } catch (er) {}
      start(e);
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('keydown', function (e) {
      if ((e.key === ' ' || e.key === 'Enter') ) { e.preventDefault(); if (!e.repeat) start(e); }
    });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } });
    btn.addEventListener('blur', release);
    // oddiy "click" (bosib turmasdan) — hech narsa qilmaydi, faqat maslahatni silkitadi
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!done && p < 0.05 && hint && !holding) { hint.classList.remove('uk-hold-nudge'); void hint.offsetWidth; hint.classList.add('uk-hold-nudge'); }
    });
    clip();

    var api = {
      el: wrap,
      button: btn,
      reset: function () {
        clearTimeout(resetTimer);
        if (raf) cancelAnimationFrame(raf); raf = 0;
        p = 0; holding = false; done = false;
        btn.classList.remove('is-done', 'is-holding', 'is-active');
        setLabel(label); clip();
      },
      setDisabled: function (b) { disabled = !!b; btn.disabled = disabled; },
      getProgress: function () { return p; },
      destroy: function () { clearTimeout(resetTimer); if (raf) cancelAnimationFrame(raf); wrap.remove(); }
    };
    return api;
  }

  /* ------------------------------------------------------------
     4) HOLD CONFIRM — native confirm() o'rniga kichik modal
     ------------------------------------------------------------ */
  function holdConfirm(opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var ov = el('div', 'uk-modal-ov');
    var box = el('div', 'uk-modal', { role: 'alertdialog', 'aria-modal': 'true' });
    var titleId = uid('t'), descId = uid('d');
    box.setAttribute('aria-labelledby', titleId);
    box.setAttribute('aria-describedby', descId);
    if (opts.danger !== false) box.classList.add('uk-modal--danger');
    box.innerHTML =
      (opts.icon ? '<div class="uk-modal-icon">' + opts.icon + '</div>' : '') +
      '<div class="uk-modal-title" id="' + titleId + '"></div>' +
      '<div class="uk-modal-msg" id="' + descId + '"></div>' +
      '<div class="uk-modal-hold"></div>' +
      '<button type="button" class="uk-modal-cancel"></button>';
    box.querySelector('.uk-modal-title').textContent = opts.title || L('Ishonchingiz komilmi?', 'Are you sure?', 'Вы уверены?');
    var msgEl = box.querySelector('.uk-modal-msg');
    if (opts.message) msgEl.innerHTML = opts.message; else msgEl.remove();
    var cancelBtn = box.querySelector('.uk-modal-cancel');
    cancelBtn.textContent = opts.cancelLabel || L('Bekor qilish', 'Cancel', 'Отмена');
    ov.appendChild(box);
    document.body.appendChild(ov);
    var closed = false;
    function close(confirmed) {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey, true);
      ov.classList.add('is-closing');
      setTimeout(function () { ov.remove(); }, reduced() ? 0 : 160);
      try { if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true }); } catch (e) {}
      if (confirmed) { if (typeof opts.onConfirm === 'function') opts.onConfirm(); }
      else if (typeof opts.onCancel === 'function') opts.onCancel();
    }
    var danger = opts.danger !== false;
    var hb = holdButton(box.querySelector('.uk-modal-hold'), {
      label: opts.holdLabel || L("O'chirish uchun bosib turing", 'Hold to delete', 'Удерживайте для удаления'),
      doneLabel: opts.doneLabel || L("O'chirildi", 'Deleted', 'Удалено'),
      hint: opts.hint,
      holdTime: opts.holdTime || 2000,
      releaseTime: opts.releaseTime != null ? opts.releaseTime : 200,
      fillColor: opts.fillColor || (danger ? 'var(--uk-danger, #E5484D)' : undefined),
      size: opts.size || 'md',
      resetAfter: 0,
      onHold: function () { setTimeout(function () { close(true); }, reduced() ? 120 : 420); }
    });
    hb.button.classList.add('uk-hold--block');
    cancelBtn.onclick = function () { close(false); };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(false); });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Tab') { // fokus modal ichida qoladi
        var f = [hb.button, cancelBtn];
        var i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { try { hb.button.focus({ preventScroll: true }); } catch (e) {} }, 30);
    return { el: ov, hold: hb, close: function () { close(false); } };
  }

  window.UIKit = {
    codeSlots: codeSlots,
    rubberSegment: rubberSegment,
    holdButton: holdButton,
    holdConfirm: holdConfirm,
    // Promise ko'rinishi: if (await UIKit.holdConfirmAsync({...})) ...
    holdConfirmAsync: function (opts) {
      return new Promise(function (res) {
        holdConfirm(Object.assign({}, opts, {
          onConfirm: function () { res(true); },
          onCancel: function () { res(false); }
        }));
      });
    }
  };
})();
