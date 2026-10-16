// ============================================================
// 🎬 POMODORO SCENE — Pomodoro ekranining jonli orqa foni
//   • Fon tovushi yoqilgan bo'lsa — tovushga mos jonli sahna (yomg'ir yog'adi, olov uchqunlari, to'lqinlar...)
//   • Tovush o'chiq bo'lsa — tanlangan fon: 10 ta tayyor rasm (jonli) yoki galereyadan o'z rasmingiz
//   • Taymer ko'rinishi (uslub) ham shu yerda: classic / glass / neon / minimal / gradient
// Sozlamalar: S.pomoScene = { bg, live, style } (bulut bilan sinxron); galereya rasmi — faqat shu qurilmada (localStorage).
// Canvas faqat Pomodoro oynasi ochiq va sahifa ko'rinib turganda chiziladi; "harakatni kamaytirish"da — harakatsiz kadr.
// ============================================================
(function () {
  'use strict';
  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return en; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TAU = Math.PI * 2, rnd = Math.random;
  function rr(a, b) { return a + rnd() * (b - a); }
  var CUSTOM_KEY = 'pomoBgCustom';

  // ---------- Sozlamalar ----------
  function cfg() {
    var c = (typeof S !== 'undefined' && S && S.pomoScene && typeof S.pomoScene === 'object') ? S.pomoScene : {};
    return { bg: c.bg || 'city', live: c.live !== false, style: c.style || 'glass' };
  }
  function setCfg(patch) {
    try { S.pomoScene = Object.assign(cfg(), patch); if (typeof save === 'function') save(); } catch (e) {}
    apply(true);
  }
  function customImg() { try { return localStorage.getItem(CUSTOM_KEY) || ''; } catch (e) { return ''; } }

  // ---------- Umumiy chizish yordamchilari ----------
  function grad(ctx, H, stops, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0 || 0, y0 || 0, x1 || 0, y1 == null ? H : y1);
    stops.forEach(function (s, i) { g.addColorStop(s[1] != null ? s[1] : i / (stops.length - 1), s[0]); });
    return g;
  }
  function sky(ctx, W, H, stops) { ctx.fillStyle = grad(ctx, H, stops.map(function (c, i) { return [c, i / (stops.length - 1)]; })); ctx.fillRect(0, 0, W, H); }
  // Rangning o'zini shaffof qilamiz (qora tomon emas — aks holda qorong'i halqa paydo bo'ladi)
  function clear(c) {
    var m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) { var p = m[1].split(','); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',0)'; }
    if (/^#[0-9a-f]{6}$/i.test(c)) return 'rgba(' + parseInt(c.slice(1, 3), 16) + ',' + parseInt(c.slice(3, 5), 16) + ',' + parseInt(c.slice(5, 7), 16) + ',0)';
    return 'rgba(0,0,0,0)';
  }
  function glow(ctx, x, y, r, col, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, clear(col));
    ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // Tog'/tepalik siluetlari (seed bilan bir xil shakl)
  function ridge(ctx, W, H, base, amp, col, seed, rough) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    var n = 48, s = seed || 1;
    for (var i = 0; i <= n; i++) {
      var x = i / n * W;
      var y = base - amp * (0.55 * Math.sin(i * 0.37 * (rough || 1) + s) + 0.3 * Math.sin(i * 0.91 * (rough || 1) + s * 2.1) + 0.15 * Math.sin(i * 2.3 + s * 3.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function pines(ctx, W, H, base, hgt, col, seed, step) {
    ctx.fillStyle = col;
    for (var x = -20, i = 0; x < W + 20; x += step, i++) {
      var h = hgt * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7 + seed)));
      ctx.beginPath(); ctx.moveTo(x - step * 0.55, base); ctx.lineTo(x, base - h); ctx.lineTo(x + step * 0.55, base); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(0, base - 1, W, H - base + 1);
  }
  function skyline(ctx, W, H, base, col, seed, winCol, lights) {
    ctx.fillStyle = col;
    var x = 0, i = 0, wins = [];
    while (x < W) {
      var w = 26 + Math.abs(Math.sin(i * 2.3 + seed)) * 50, h = 60 + Math.abs(Math.sin(i * 1.3 + seed * 1.7)) * (H * 0.38);
      ctx.fillRect(x, base - h, w, h + (H - base));
      if (lights) for (var wy = base - h + 10; wy < base - 8; wy += 12) for (var wx = x + 5; wx < x + w - 6; wx += 9) if (Math.sin(wx * 12.9 + wy * 78.2 + seed) > 0.35) wins.push([wx, wy]);
      x += w + 2; i++;
    }
    if (lights) { ctx.fillStyle = winCol; wins.forEach(function (p) { ctx.fillRect(p[0], p[1], 4, 5); }); }
    return wins;
  }
  function makeStars(n, W, H, maxY) { var a = []; for (var i = 0; i < n; i++) a.push({ x: rnd() * W, y: rnd() * H * (maxY || 1), r: rr(0.4, 1.4), p: rnd() * TAU, s: rr(0.6, 2) }); return a; }
  function drawStars(ctx, st, t) { ctx.fillStyle = '#fff'; st.forEach(function (s) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1; }
  function moon(ctx, x, y, r, col) { glow(ctx, x, y, r * 5, 'rgba(255,245,220,0.35)', 0.8); ctx.fillStyle = col || '#fff7e0'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  // Yomg'ir (bir nechta sahnada ishlatiladi)
  function rainInit(W, H, n) { var a = []; for (var i = 0; i < n; i++) a.push({ x: rnd() * W, y: rnd() * H, l: rr(10, 26), v: rr(600, 1050), w: rr(0.6, 1.4), o: rr(0.25, 0.6) }); return { drops: a, spl: [] }; }
  function rainDraw(ctx, R, W, H, dt, wind, col) {
    ctx.strokeStyle = col || 'rgba(190,210,255,1)'; ctx.lineCap = 'round';
    R.drops.forEach(function (d) {
      d.y += d.v * dt; d.x += wind * d.v * dt;
      if (d.y > H) { if (rnd() < 0.35) R.spl.push({ x: d.x, y: H - rr(2, H * 0.08), t: 0 }); d.y = -d.l; d.x = rnd() * (W + 100) - 50; }
      ctx.globalAlpha = d.o; ctx.lineWidth = d.w; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - wind * d.l, d.y - d.l); ctx.stroke();
    });
    ctx.lineWidth = 1;
    R.spl = R.spl.filter(function (s) { s.t += dt; if (s.t > 0.35) return false; ctx.globalAlpha = (1 - s.t / 0.35) * 0.5; ctx.beginPath(); ctx.ellipse(s.x, s.y, 2 + s.t * 22, 1 + s.t * 5, 0, Math.PI, TAU); ctx.stroke(); return true; });
    ctx.globalAlpha = 1;
  }
  function particles(n, W, H, mk) { var a = []; for (var i = 0; i < n; i++) a.push(mk(i)); return a; }

  // ============================================================
  //  SAHNALAR: init(W,H) → holat; draw(ctx, st, t, dt, W, H)
  //  bg: statik qatlam (bir marta, o'lcham o'zgarganda) — offscreen'ga chiziladi
  // ============================================================
  var SCENES = {
    // ---------- 🌧️ Yomg'ir ----------
    rain: {
      n: ['Yomg\'ir', 'Rain', 'Дождь'], icon: '🌧️',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#0d1424', '#1a2438', '#27324a']); skyline(ctx, W, H, H * 0.86, '#0b111d', 3, 'rgba(255,214,140,0.55)', true); ridge(ctx, W, H, H * 0.97, 8, '#070b13', 2); },
      init: function (W, H) { return { r: rainInit(W, H, Math.round(W * H / 2600)) }; },
      draw: function (ctx, st, t, dt, W, H) { rainDraw(ctx, st.r, W, H, dt, 0.08); fog(ctx, W, H, t, 'rgba(160,180,220,0.06)'); }
    },
    // ---------- ⛈️ Momaqaldiroq ----------
    storm: {
      n: ['Momaqaldiroq', 'Storm', 'Гроза'], icon: '⛈️',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#07090f', '#121826', '#1b2232']); ridge(ctx, W, H, H * 0.84, 40, '#0a0e16', 5); ridge(ctx, W, H, H * 0.93, 18, '#05070c', 9); },
      init: function (W, H) { return { r: rainInit(W, H, Math.round(W * H / 1500)), flash: 0, next: 2, bolt: null }; },
      draw: function (ctx, st, t, dt, W, H) {
        st.next -= dt;
        if (st.next <= 0) { st.flash = 1; st.next = rr(3, 8); st.bolt = boltPath(rr(W * 0.15, W * 0.85), H * 0.75); }
        if (st.flash > 0) {
          ctx.fillStyle = 'rgba(200,215,255,' + (st.flash * 0.35) + ')'; ctx.fillRect(0, 0, W, H);
          if (st.bolt && st.flash > 0.4) { ctx.strokeStyle = 'rgba(235,240,255,' + st.flash + ')'; ctx.lineWidth = 2.2; ctx.shadowColor = '#cfe0ff'; ctx.shadowBlur = 18; ctx.beginPath(); st.bolt.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1; }
          st.flash -= dt * (st.flash > 0.6 ? 5 : 2.2);
        }
        rainDraw(ctx, st.r, W, H, dt, 0.18);
      }
    },
    // ---------- 🪟 Deraza ortida yomg'ir ----------
    window: {
      n: ['Derazadagi yomg\'ir', 'Rain on window', 'Дождь на окне'], icon: '🪟',
      bg: function (ctx, W, H) {
        sky(ctx, W, H, ['#1c1a2e', '#2b2440', '#3b2c44']);
        var cols = ['#ffb36b', '#ff6b9a', '#7cc4ff', '#ffe08a', '#b18cff'];
        for (var i = 0; i < 46; i++) glow(ctx, rnd() * W, H * 0.35 + rnd() * H * 0.65, rr(20, 70), cols[i % cols.length], 0.22);
      },
      init: function (W, H) { return { d: particles(Math.round(W * H / 5000), W, H, function () { return { x: rnd() * W, y: rnd() * H, r: rr(1.5, 4.5), v: 0, slide: rnd() < 0.08 }; }) }; },
      draw: function (ctx, st, t, dt, W, H) {
        st.d.forEach(function (d) {
          if (d.slide) { d.v = Math.min(d.v + dt * 60, 120); d.y += d.v * dt; if (d.y > H + 10) { d.y = -5; d.x = rnd() * W; d.v = 0; d.slide = rnd() < 0.1; } }
          else if (rnd() < 0.0008) d.slide = true;
          ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.3, 0, TAU); ctx.fill();
          if (d.slide && d.v > 20) { ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = d.r * 0.8; ctx.beginPath(); ctx.moveTo(d.x, d.y - d.r); ctx.lineTo(d.x, d.y - d.r - 40); ctx.stroke(); ctx.lineWidth = 1; }
        });
      }
    },
    // ---------- 🌊 Okean ----------
    ocean: {
      n: ['Okean', 'Ocean', 'Океан'], icon: '🌊',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#060b1f', '#122046', '#2a3a6e']); },
      init: function (W, H) { return { st: makeStars(120, W, H, 0.5) }; },
      draw: function (ctx, st, t, dt, W, H) {
        drawStars(ctx, st.st, t); moon(ctx, W * 0.72, H * 0.22, Math.min(W, H) * 0.05);
        var hz = H * 0.55, cols = ['#1d3a74', '#18305f', '#13264d', '#0e1d3c', '#09142b'];
        for (var k = 0; k < 5; k++) {
          var y0 = hz + k * (H - hz) / 5, A = 4 + k * 4, sp = 0.5 + k * 0.25;
          ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(0, H);
          for (var x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.012 + t * sp + k) * A + Math.sin(x * 0.031 - t * sp * 1.3) * A * 0.4);
          ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        }
        // Oy aksi
        for (var i = 0; i < 26; i++) { var yy = hz + i * (H - hz) / 26, w = (8 + i * 2.2) * (0.6 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = 'rgba(255,240,200,' + (0.35 - i * 0.011) + ')'; ctx.fillRect(W * 0.72 - w / 2 + Math.sin(t * 1.5 + i * 0.7) * 6, yy, w, 2); }
      }
    },
    // ---------- 🏞️ Daryo ----------
    river: {
      n: ['Daryo', 'River', 'Река'], icon: '🏞️',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#8fd3c7', '#3d8f86', '#1d4d4f']); ridge(ctx, W, H, H * 0.45, 30, '#2f6b5f', 4); pines(ctx, W, H, H * 0.55, H * 0.14, '#1d4a40', 2, 22); ctx.fillStyle = grad(ctx, H, [['#1f5d6b', 0], ['#0f3440', 1]], 0, H * 0.55, 0, H); ctx.fillRect(0, H * 0.55, W, H * 0.45); },
      init: function (W, H) { return { l: particles(70, W, H, function () { return { x: rnd() * W, y: rr(H * 0.57, H), len: rr(20, 80), v: rr(30, 90), o: rr(0.15, 0.45) }; }) }; },
      draw: function (ctx, st, t, dt, W, H) {
        ctx.strokeStyle = '#d8fbff';
        st.l.forEach(function (p) { p.x += p.v * dt * (0.6 + (p.y - H * 0.55) / H); if (p.x - p.len > W) { p.x = -p.len; p.y = rr(H * 0.57, H); } ctx.globalAlpha = p.o; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - p.len, p.y + Math.sin(t * 2 + p.x * 0.02) * 2); ctx.quadraticCurveTo(p.x - p.len / 2, p.y - 3, p.x, p.y); ctx.stroke(); });
        ctx.globalAlpha = 1; ctx.lineWidth = 1;
      }
    },
    // ---------- 🔥 Gulxan ----------
    fire: {
      n: ['Gulxan', 'Campfire', 'Костёр'], icon: '🔥',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#0b0507', '#1a0a0c', '#2a1008']); },
      init: function (W, H) { return { e: particles(90, W, H, function () { return emb(W, H, true); }), W: W, H: H }; },
      draw: function (ctx, st, t, dt, W, H) {
        var f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1);
        glow(ctx, W / 2, H * 0.92, Math.max(W, H) * 0.65 * f, 'rgba(255,120,40,0.55)', 0.9);
        glow(ctx, W / 2, H * 0.98, Math.min(W, H) * 0.35 * f, 'rgba(255,200,90,0.85)', 0.9);
        st.e.forEach(function (p) {
          p.y -= p.v * dt; p.x += Math.sin(t * p.f + p.p) * 20 * dt; p.life -= dt;
          if (p.life <= 0 || p.y < 0) Object.assign(p, emb(W, H, false));
          var a = Math.max(0, p.life / p.max);
          ctx.fillStyle = 'rgba(255,' + Math.round(140 + 100 * a) + ',60,' + a + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        });
      }
    },
    // ---------- 🐦 O'rmon ----------
    forest: {
      n: ['O\'rmon', 'Forest', 'Лес'], icon: '🐦',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#f6e7b0', '#a9d18e', '#3f7a4d']); ridge(ctx, W, H, H * 0.5, 30, '#6ea575', 3); pines(ctx, W, H, H * 0.66, H * 0.22, '#3c6e4a', 5, 34); pines(ctx, W, H, H * 0.82, H * 0.3, '#244d33', 9, 46); pines(ctx, W, H, H * 0.98, H * 0.36, '#14301f', 2, 60); },
      init: function (W, H) { return { p: particles(50, W, H, function () { return { x: rnd() * W, y: rnd() * H, r: rr(1, 2.6), v: rr(6, 18), ph: rnd() * TAU }; }) }; },
      draw: function (ctx, st, t, dt, W, H) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < 6; i++) { var a = -0.9 + i * 0.12 + Math.sin(t * 0.2 + i) * 0.03; ctx.fillStyle = 'rgba(255,240,190,0.05)'; ctx.beginPath(); ctx.moveTo(W * 0.15, -20); ctx.lineTo(W * 0.15 + Math.cos(a) * H * 2, Math.sin(-a) * H * 2); ctx.lineTo(W * 0.15 + Math.cos(a + 0.06) * H * 2, Math.sin(-a - 0.06) * H * 2); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        st.p.forEach(function (p) { p.y -= p.v * dt * 0.3; p.x += Math.sin(t + p.ph) * 8 * dt; if (p.y < -5) { p.y = H + 5; p.x = rnd() * W; } ctx.fillStyle = 'rgba(255,250,210,' + (0.4 + 0.4 * Math.sin(t * 2 + p.ph)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); });
      }
    },
    // ---------- 🍃 Shamol ----------
    wind: {
      n: ['Shamol', 'Wind', 'Ветер'], icon: '🍃',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#9bc6e8', '#cfe3ee', '#e9d8b4']); ridge(ctx, W, H, H * 0.78, 40, '#9cba7a', 6, 0.6); ridge(ctx, W, H, H * 0.92, 26, '#6f9655', 1, 0.8); },
      init: function (W, H) { return { s: particles(26, W, H, function () { return { x: rnd() * W, y: rnd() * H * 0.8, len: rr(80, 220), v: rr(160, 320), o: rr(0.2, 0.5) }; }), lv: particles(18, W, H, function () { return { x: rnd() * W, y: rnd() * H, v: rr(80, 160), r: rnd() * TAU, vr: rr(-3, 3), c: ['#7fb24a', '#c7a43b', '#a9cf5c'][Math.floor(rnd() * 3)] }; }) }; },
      draw: function (ctx, st, t, dt, W, H) {
        ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
        st.s.forEach(function (p) { p.x += p.v * dt; if (p.x - p.len > W) { p.x = -p.len; p.y = rnd() * H * 0.8; } ctx.globalAlpha = p.o; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x - p.len, p.y); ctx.bezierCurveTo(p.x - p.len * 0.6, p.y - 12, p.x - p.len * 0.3, p.y + 12, p.x, p.y); ctx.stroke(); });
        ctx.globalAlpha = 1;
        st.lv.forEach(function (l) { l.x += l.v * dt; l.y += Math.sin(t * 2 + l.r) * 30 * dt; l.r += l.vr * dt; if (l.x > W + 20) { l.x = -20; l.y = rnd() * H; } ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.r); ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.2, 0, 0, TAU); ctx.fill(); ctx.restore(); });
      }
    },
    // ---------- 🌙 Tun ----------
    night: {
      n: ['Tun', 'Night', 'Ночь'], icon: '🌙',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#050816', '#0d1530', '#1b2148']); ridge(ctx, W, H, H * 0.8, 36, '#0b1024', 7, 0.7); ridge(ctx, W, H, H * 0.92, 20, '#060915', 3, 0.9); },
      init: function (W, H) { return { st: makeStars(220, W, H, 0.75), ff: particles(22, W, H, function () { return { x: rnd() * W, y: rr(H * 0.6, H), a: rnd() * TAU, ph: rnd() * TAU }; }), shoot: null, next: 4 }; },
      draw: function (ctx, st, t, dt, W, H) {
        drawStars(ctx, st.st, t); moon(ctx, W * 0.8, H * 0.2, Math.min(W, H) * 0.055);
        st.next -= dt; if (st.next < 0) { st.shoot = { x: rr(0, W * 0.6), y: rr(0, H * 0.3), t: 0 }; st.next = rr(5, 12); }
        if (st.shoot) { var s = st.shoot; s.t += dt; var k = s.t / 0.9; if (k > 1) st.shoot = null; else { ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x + k * 260, s.y + k * 110); ctx.lineTo(s.x + k * 260 - 70, s.y + k * 110 - 30); ctx.stroke(); ctx.lineWidth = 1; } }
        ffDraw(ctx, st.ff, t, dt, W, H);
      }
    },
    // ---------- ☕ Kafe ----------
    cafe: {
      n: ['Kafe', 'Café', 'Кафе'], icon: '☕',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#2a1710', '#3d2216', '#1c0f0a']); },
      init: function (W, H) { return { b: bokeh(W, H, 34, ['#ffb86b', '#ffd59a', '#ff8f6b', '#f7c873']) }; },
      draw: function (ctx, st, t, dt, W, H) { bokehDraw(ctx, st.b, t, dt, W, H); steam(ctx, W * 0.5, H * 0.82, t); }
    },
    // ---------- 📚 Kutubxona ----------
    library: {
      n: ['Kutubxona', 'Library', 'Библиотека'], icon: '📚',
      bg: function (ctx, W, H) {
        sky(ctx, W, H, ['#1e140c', '#2c1d10', '#140c06']);
        var cols = ['#5b3a24', '#7a2f2f', '#2f4a5b', '#5b5224', '#3b2a4f', '#6b4a2a'];
        for (var row = 0; row < 5; row++) { var y = H * (0.12 + row * 0.18); ctx.fillStyle = '#100a05'; ctx.fillRect(0, y + H * 0.13, W, 6); for (var x = 0, i = 0; x < W; i++) { var w = 8 + (i * 37 % 11), h = H * 0.1 + (i * 13 % 9); ctx.fillStyle = cols[(i + row) % cols.length]; ctx.globalAlpha = 0.6; ctx.fillRect(x, y + H * 0.13 - h, w, h); x += w + 1; } }
        ctx.globalAlpha = 1;
      },
      init: function (W, H) { return { d: particles(80, W, H, function () { return { x: rnd() * W, y: rnd() * H, r: rr(0.6, 1.8), vx: rr(-6, 6), vy: rr(-4, 4) }; }) }; },
      draw: function (ctx, st, t, dt, W, H) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,200,120,0.07)'; ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W * 0.85, 0); ctx.lineTo(W * 0.45, H); ctx.lineTo(W * 0.1, H); ctx.closePath(); ctx.fill();
        st.d.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(t + p.x) * 2 * dt; if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; ctx.fillStyle = 'rgba(255,220,160,' + (0.3 + 0.3 * Math.sin(t * 1.5 + p.x)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); });
        ctx.restore(); glow(ctx, W * 0.2, H * 0.7, Math.min(W, H) * 0.4, 'rgba(255,180,90,0.25)', 0.9 + 0.1 * Math.sin(t * 3));
      }
    },
    // ---------- 🚆 Poyezd ----------
    train: {
      n: ['Poyezd', 'Train', 'Поезд'], icon: '🚆',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#1b1534', '#4a2a55', '#a4536b']); },
      init: function (W, H) { return { far: particles(40, W, H, function () { return { x: rnd() * W, y: rr(H * 0.55, H * 0.7), c: ['#ffd27a', '#ff9f7a', '#9fd3ff'][Math.floor(rnd() * 3)] }; }), pole: 0, off: 0 }; },
      draw: function (ctx, st, t, dt, W, H) {
        st.off += dt;
        ctx.fillStyle = '#2a1a33'; ctx.beginPath(); ctx.moveTo(0, H); for (var x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.66 - 30 * Math.abs(Math.sin((x + st.off * 20) * 0.01))); ctx.lineTo(W, H); ctx.fill();
        st.far.forEach(function (p) { p.x -= 25 * dt; if (p.x < -5) p.x = W + 5; ctx.fillStyle = p.c; ctx.globalAlpha = 0.7; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
        ctx.fillStyle = '#120b18'; ctx.fillRect(0, H * 0.74, W, H * 0.26);
        st.pole = (st.pole + dt * 900) % (W * 0.6);
        for (var k = -1; k < 3; k++) { var px = W - (st.pole + k * W * 0.6); ctx.fillStyle = 'rgba(10,6,14,0.85)'; ctx.fillRect(px, 0, 14, H * 0.8); }
        // Vagon derazasi ramkasi
        ctx.strokeStyle = 'rgba(20,14,24,0.95)'; ctx.lineWidth = Math.min(W, H) * 0.05; ctx.strokeRect(0, 0, W, H); ctx.lineWidth = 1;
      }
    },
    // ---------- 🌌 Koinot ----------
    space: {
      n: ['Koinot', 'Space', 'Космос'], icon: '🌌',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#03030a', '#0a0820', '#05040f']); glow(ctx, W * 0.3, H * 0.4, Math.max(W, H) * 0.5, 'rgba(120,60,200,0.35)'); glow(ctx, W * 0.75, H * 0.6, Math.max(W, H) * 0.45, 'rgba(40,120,220,0.3)'); },
      init: function (W, H) { return { s: particles(260, W, H, function () { return { a: rnd() * TAU, d: rnd(), v: rr(0.05, 0.25) }; }) }; },
      draw: function (ctx, st, t, dt, W, H) {
        var cx = W / 2, cy = H / 2, R = Math.max(W, H) * 0.75;
        st.s.forEach(function (p) { p.d += p.v * dt * (0.3 + p.d); if (p.d > 1) { p.d = rnd() * 0.1; p.a = rnd() * TAU; } var r = p.d * p.d * R, x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r; ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, p.d * 1.6) + ')'; ctx.beginPath(); ctx.arc(x, y, 0.4 + p.d * 1.8, 0, TAU); ctx.fill(); });
      }
    },
    // ---------- 🎐 Tibet kosasi ----------
    bowl: {
      n: ['Meditatsiya', 'Meditation', 'Медитация'], icon: '🎐',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#0f1b2b', '#1d2b45', '#2b2350']); },
      init: function () { return { r: [], next: 0 }; },
      draw: function (ctx, st, t, dt, W, H) {
        st.next -= dt; if (st.next <= 0) { st.r.push(0); st.next = 2.2; }
        var cx = W / 2, cy = H * 0.55, M = Math.max(W, H) * 0.7;
        st.r = st.r.filter(function (r, i) { r += dt * 0.18; st.r[i] = r; return r < 1; });
        st.r.forEach(function (r) { ctx.strokeStyle = 'rgba(170,200,255,' + (1 - r) * 0.5 + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * M, 0, TAU); ctx.stroke(); });
        ctx.lineWidth = 1; glow(ctx, cx, cy, M * 0.25, 'rgba(160,140,255,0.25)', 0.7 + 0.3 * Math.sin(t));
      }
    },
    // ---------- 🟤 Jigarrang shovqin ----------
    brown: {
      n: ['Yumshoq shovqin', 'Soft noise', 'Мягкий шум'], icon: '🟤',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#1f1712', '#2b2018', '#17110d']); },
      init: function (W, H) { return { b: particles(5, W, H, function (i) { return { x: rnd() * W, y: rnd() * H, r: rr(0.3, 0.6) * Math.max(W, H), p: i, c: ['#7a4f33', '#5a3d2b', '#8a6a4a', '#4a3a2f', '#6b4a3a'][i] }; }) }; },
      draw: function (ctx, st, t, dt, W, H) { st.b.forEach(function (b) { glow(ctx, b.x + Math.sin(t * 0.2 + b.p) * W * 0.15, b.y + Math.cos(t * 0.17 + b.p) * H * 0.15, b.r, b.c, 0.45); }); }
    }
  };
  function fog(ctx, W, H, t, col) { for (var i = 0; i < 3; i++) glow(ctx, ((t * 20 + i * W / 3) % (W * 1.4)) - W * 0.2, H * 0.78, W * 0.35, col, 1); }
  function boltPath(x, h) { var p = [[x, 0]], y = 0; while (y < h) { y += rr(20, 50); x += rr(-30, 30); p.push([x, y]); } return p; }
  function emb(W, H, any) { var m = rr(1.2, 3); return { x: W / 2 + rr(-W * 0.18, W * 0.18), y: any ? rr(H * 0.3, H) : H + 5, v: rr(40, 110), r: rr(0.8, 2.4), f: rr(1, 3), p: rnd() * TAU, life: m, max: m }; }
  function ffDraw(ctx, ff, t, dt, W, H) { ff.forEach(function (f) { f.a += Math.sin(t * 0.7 + f.ph) * dt; f.x += Math.cos(f.a) * 14 * dt; f.y += Math.sin(f.a) * 9 * dt; if (f.x < 0) f.x = W; if (f.x > W) f.x = 0; if (f.y < H * 0.5) f.y = H; if (f.y > H) f.y = H * 0.5; var a = 0.3 + 0.7 * Math.max(0, Math.sin(t * 1.8 + f.ph)); glow(ctx, f.x, f.y, 10, 'rgba(255,235,130,0.9)', a * 0.6); ctx.fillStyle = 'rgba(255,250,200,' + a + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, TAU); ctx.fill(); }); }
  function bokeh(W, H, n, cols) { return particles(n, W, H, function (i) { return { x: rnd() * W, y: rnd() * H, r: rr(14, 60), c: cols[i % cols.length], vx: rr(-8, 8), vy: rr(-6, 6), p: rnd() * TAU }; }); }
  function bokehDraw(ctx, b, t, dt, W, H) { b.forEach(function (o) { o.x += o.vx * dt; o.y += o.vy * dt; if (o.x < -o.r) o.x = W + o.r; if (o.x > W + o.r) o.x = -o.r; if (o.y < -o.r) o.y = H + o.r; if (o.y > H + o.r) o.y = -o.r; glow(ctx, o.x, o.y, o.r, o.c, 0.28 + 0.12 * Math.sin(t + o.p)); }); }
  function steam(ctx, x, y, t) { ctx.strokeStyle = 'rgba(255,240,220,0.18)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (var k = 0; k < 3; k++) { ctx.beginPath(); for (var i = 0; i <= 20; i++) { var yy = y - i * 9, xx = x + (k - 1) * 16 + Math.sin(i * 0.5 - t * 2 + k) * 8; if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); } ctx.lineWidth = 1; }

  // ============================================================
  //  10 ta tayyor fon (tovush o'chiq paytda)
  // ============================================================
  var BGS = {
    city: { n: ['Tungi shahar', 'Night city', 'Ночной город'], icon: '🌃',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#0b0b22', '#2a1b4a', '#6b2d5c']); glow(ctx, W / 2, H, W * 0.7, 'rgba(255,120,170,0.35)'); skyline(ctx, W, H, H * 0.78, '#1a1430', 7, 'rgba(255,200,120,0.5)', true); skyline(ctx, W, H, H * 0.94, '#0c0a18', 2, 'rgba(255,230,160,0.8)', true); },
      init: function (W, H) { return { st: makeStars(90, W, H, 0.35) }; }, draw: function (ctx, st, t) { drawStars(ctx, st.st, t); } },
    dusk: { n: ['Tog\' shafaqi', 'Mountain dusk', 'Горный закат'], icon: '🏔',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#2b1e4f', '#9a4a76', '#f5a25d']); glow(ctx, W * 0.5, H * 0.62, Math.min(W, H) * 0.18, 'rgba(255,220,150,0.9)'); ridge(ctx, W, H, H * 0.6, 60, '#6a3a63', 1, 0.8); ridge(ctx, W, H, H * 0.72, 50, '#4a2a55', 4); ridge(ctx, W, H, H * 0.86, 40, '#2c1a3c', 8); ridge(ctx, W, H, H * 0.98, 24, '#170e22', 3); },
      init: function (W, H) { return { c: clouds(W, H, 5) }; }, draw: function (ctx, st, t, dt, W, H) { cloudDraw(ctx, st.c, dt, W, 'rgba(255,200,210,0.18)'); } },
    sunset: { n: ['Dengiz quyoshi', 'Sea sunset', 'Морской закат'], icon: '🌅',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#ff7e5f', '#feb47b', '#ffd6a0']); glow(ctx, W / 2, H * 0.58, Math.min(W, H) * 0.25, 'rgba(255,240,200,1)'); ctx.fillStyle = grad(ctx, H, [['#e0735c', 0], ['#4a3a6b', 1]], 0, H * 0.6, 0, H); ctx.fillRect(0, H * 0.6, W, H * 0.4); },
      init: function () { return {}; },
      draw: function (ctx, st, t, dt, W, H) { for (var i = 0; i < 30; i++) { var y = H * 0.6 + i * H * 0.4 / 30, w = (20 + i * 6) * (0.6 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = 'rgba(255,240,200,' + (0.5 - i * 0.014) + ')'; ctx.fillRect(W / 2 - w / 2 + Math.sin(t + i) * 8, y, w, 2); } } },
    pines: { n: ['Qarag\'ayzor', 'Pine forest', 'Сосновый лес'], icon: '🌲',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#0f2a2f', '#2f5a52', '#a8c69f']); pines(ctx, W, H, H * 0.62, H * 0.2, '#28504a', 3, 30); pines(ctx, W, H, H * 0.8, H * 0.28, '#173a35', 7, 44); pines(ctx, W, H, H * 0.98, H * 0.36, '#0a211e', 1, 60); },
      init: function (W, H) { return { ff: particles(18, W, H, function () { return { x: rnd() * W, y: rr(H * 0.6, H), a: rnd() * TAU, ph: rnd() * TAU }; }) }; },
      draw: function (ctx, st, t, dt, W, H) { fog(ctx, W, H, t, 'rgba(220,240,230,0.07)'); ffDraw(ctx, st.ff, t, dt, W, H); } },
    aurora: { n: ['Shimol shafag\'i', 'Aurora', 'Северное сияние'], icon: '🌌',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#020611', '#06142a', '#0b2034']); ridge(ctx, W, H, H * 0.86, 40, '#040a14', 5); },
      init: function (W, H) { return { st: makeStars(160, W, H, 0.7) }; },
      draw: function (ctx, st, t, dt, W, H) {
        drawStars(ctx, st.st, t);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < 3; k++) { var base = H * (0.3 + k * 0.1); for (var x = 0; x < W; x += 6) { var y = base + Math.sin(x * 0.006 + t * 0.4 + k) * H * 0.06 + Math.sin(x * 0.017 - t * 0.6) * H * 0.02; var g = ctx.createLinearGradient(0, y - H * 0.2, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, ['rgba(60,255,170,0.22)', 'rgba(80,180,255,0.18)', 'rgba(190,100,255,0.16)'][k]); ctx.fillStyle = g; ctx.fillRect(x, y - H * 0.2, 6, H * 0.2); } }
        ctx.restore();
      } },
    dunes: { n: ['Sahro', 'Desert dunes', 'Пустыня'], icon: '🏜',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#4b2c5e', '#e07a5f', '#f2cc8f']); glow(ctx, W * 0.3, H * 0.5, Math.min(W, H) * 0.12, 'rgba(255,240,200,1)'); ridge(ctx, W, H, H * 0.66, 30, '#d08c5a', 2, 0.4); ridge(ctx, W, H, H * 0.8, 40, '#b0663f', 6, 0.35); ridge(ctx, W, H, H * 0.95, 30, '#7a3f2b', 3, 0.45); },
      init: function (W, H) { return { s: particles(60, W, H, function () { return { x: rnd() * W, y: rr(H * 0.6, H), v: rr(30, 80) }; }) }; },
      draw: function (ctx, st, t, dt, W, H) { ctx.fillStyle = 'rgba(255,230,190,0.35)'; st.s.forEach(function (p) { p.x += p.v * dt; if (p.x > W) p.x = 0; ctx.fillRect(p.x, p.y + Math.sin(t * 3 + p.x) * 2, 2, 1); }); } },
    sakura: { n: ['Sakura', 'Sakura', 'Сакура'], icon: '🌸',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#ffd6e7', '#f7a8c4', '#c56c9a']); glow(ctx, W * 0.7, H * 0.3, Math.min(W, H) * 0.2, 'rgba(255,255,255,0.7)'); ridge(ctx, W, H, H * 0.82, 30, '#9b4d7a', 3, 0.6); ridge(ctx, W, H, H * 0.96, 18, '#6b2f55', 7, 0.7); },
      init: function (W, H) { return { p: particles(40, W, H, function () { return { x: rnd() * W, y: rnd() * H, v: rr(25, 60), r: rnd() * TAU, vr: rr(-2, 2), s: rr(3, 6) }; }) }; },
      draw: function (ctx, st, t, dt, W, H) { st.p.forEach(function (p) { p.y += p.v * dt; p.x += Math.sin(t + p.r) * 25 * dt; p.r += p.vr * dt; if (p.y > H + 10) { p.y = -10; p.x = rnd() * W; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = 'rgba(255,240,246,0.9)'; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore(); }); } },
    galaxy: { n: ['Galaktika', 'Galaxy', 'Галактика'], icon: '🪐', bg: null, init: null, draw: null, ref: 'space' },
    lofi: { n: ['Lo-fi quyosh', 'Lo-fi sunset', 'Lo-fi закат'], icon: '🎧',
      bg: function (ctx, W, H) {
        sky(ctx, W, H, ['#1b0b3a', '#6a1b6e', '#ff6b8b']);
        var cx = W / 2, cy = H * 0.55, R = Math.min(W, H) * 0.22, g = ctx.createLinearGradient(0, cy - R, 0, cy + R); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#ff4f8b');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6a1b6e'; for (var i = 0; i < 6; i++) ctx.fillRect(cx - R, cy + i * R * 0.17, R * 2, 2 + i * 1.6);
        ctx.fillStyle = '#12052a'; ctx.fillRect(0, H * 0.62, W, H * 0.38);
      },
      init: function () { return { o: 0 }; },
      draw: function (ctx, st, t, dt, W, H) {
        var hz = H * 0.62; st.o = (st.o + dt * 0.6) % 1;
        ctx.strokeStyle = 'rgba(255,90,200,0.7)'; ctx.lineWidth = 1.2;
        for (var i = 0; i < 14; i++) { var z = (i + st.o) / 14, y = hz + Math.pow(z, 2.2) * (H - hz); ctx.globalAlpha = z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.globalAlpha = 0.6; for (var k = -12; k <= 12; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * 18, hz); ctx.lineTo(W / 2 + k * W * 0.12, H); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.lineWidth = 1;
      } },
    cozy: { n: ['Shinam xona', 'Cozy room', 'Уютная комната'], icon: '🛋',
      bg: function (ctx, W, H) { sky(ctx, W, H, ['#2b1a12', '#4a2c1c', '#1b100b']); glow(ctx, W * 0.82, H * 0.4, Math.min(W, H) * 0.5, 'rgba(255,170,90,0.45)'); ctx.fillStyle = 'rgba(30,50,80,0.6)'; ctx.fillRect(W * 0.1, H * 0.12, W * 0.32, H * 0.42); ctx.strokeStyle = '#1b100b'; ctx.lineWidth = 8; ctx.strokeRect(W * 0.1, H * 0.12, W * 0.32, H * 0.42); ctx.beginPath(); ctx.moveTo(W * 0.26, H * 0.12); ctx.lineTo(W * 0.26, H * 0.54); ctx.stroke(); ctx.lineWidth = 1; },
      init: function (W, H) { return { b: bokeh(W, H, 18, ['#ffb86b', '#ffd59a', '#ff9f6b']), r: rainInit(W * 0.32, H * 0.42, 60) }; },
      draw: function (ctx, st, t, dt, W, H) {
        ctx.save(); ctx.beginPath(); ctx.rect(W * 0.1 + 4, H * 0.12 + 4, W * 0.32 - 8, H * 0.42 - 8); ctx.clip(); ctx.translate(W * 0.1, H * 0.12); rainDraw(ctx, st.r, W * 0.32, H * 0.42, dt, 0.05, 'rgba(180,200,240,1)'); ctx.restore();
        bokehDraw(ctx, st.b, t, dt, W, H);
      } }
  };
  BGS.galaxy.bg = SCENES.space.bg; BGS.galaxy.init = SCENES.space.init; BGS.galaxy.draw = SCENES.space.draw;
  function clouds(W, H, n) { return particles(n, W, H, function () { return { x: rnd() * W, y: rr(H * 0.08, H * 0.4), w: rr(W * 0.15, W * 0.35), v: rr(6, 16) }; }); }
  function cloudDraw(ctx, c, dt, W, col) { c.forEach(function (o) { o.x += o.v * dt; if (o.x - o.w > W) o.x = -o.w; ctx.fillStyle = col; for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(o.x + i * o.w * 0.22, o.y + Math.sin(i) * 6, o.w * 0.22, o.w * 0.08, 0, 0, TAU); ctx.fill(); } }); }

  // ============================================================
  //  Renderer
  // ============================================================
  var R = { cv: null, ctx: null, off: null, key: '', st: null, raf: 0, last: 0, t: 0, W: 0, H: 0, img: null, imgSrc: '' };
  function hero() { return document.getElementById('pomo-hero'); }
  function isOpen() { var o = document.getElementById('pomo-modal-overlay'); return !!(o && o.classList.contains('open')); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function soundOn() { try { return !!(window.FocusAudio && FocusAudio.isPlaying && FocusAudio.isPlaying()); } catch (e) { return false; } }
  function soundType() { try { return FocusAudio.getType && FocusAudio.getType(); } catch (e) { return null; } }
  // Hozir qaysi sahna: 'snd:rain' | 'bg:city' | 'custom'
  function wantKey() {
    var c = cfg();
    if (c.live && soundOn()) { var ty = soundType(); if (SCENES[ty]) return 'snd:' + ty; }
    if (c.bg === 'custom' && customImg()) return 'custom';
    return 'bg:' + (BGS[c.bg] ? c.bg : 'city');
  }
  function sceneOf(key) { if (key.indexOf('snd:') === 0) return SCENES[key.slice(4)]; if (key.indexOf('bg:') === 0) return BGS[key.slice(3)]; return null; }
  function ensureCanvas() {
    var h = hero(); if (!h) return false;
    if (!R.cv || !h.contains(R.cv)) {
      R.cv = document.createElement('canvas'); R.cv.id = 'pomo-scene'; R.cv.setAttribute('aria-hidden', 'true');
      h.insertBefore(R.cv, h.firstChild); R.ctx = R.cv.getContext('2d');
      var sh = document.createElement('div'); sh.id = 'pomo-scene-shade'; h.insertBefore(sh, R.cv.nextSibling);
      var chip = document.createElement('button'); chip.type = 'button'; chip.id = 'pomo-scene-chip'; chip.onclick = function () { openPicker(); }; h.appendChild(chip);
    }
    return true;
  }
  function resize() {
    var h = hero(); if (!h || !R.cv) return;
    var r = h.getBoundingClientRect(); if (!r.width || !r.height) return;
    var k = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = Math.round(r.width), H = Math.round(r.height);
    if (W === R.W && H === R.H && R.cv.width) return;
    R.W = W; R.H = H; R.cv.width = Math.round(W * k); R.cv.height = Math.round(H * k); R.k = k;
    R.key = ''; // qayta tayyorlash
  }
  function prepare(key) {
    R.key = key; R.t = 0;
    var sc = sceneOf(key), W = R.W, H = R.H;
    R.off = document.createElement('canvas'); R.off.width = R.cv.width; R.off.height = R.cv.height;
    var o = R.off.getContext('2d'); o.setTransform(R.k, 0, 0, R.k, 0, 0);
    if (key === 'custom') {
      var src = customImg();
      if (R.imgSrc !== src) { R.img = new Image(); R.imgSrc = src; R.img.onload = function () { R.key = ''; }; R.img.src = src; }
      R.st = null; return;
    }
    try { if (sc.bg) sc.bg(o, W, H); } catch (e) {}
    R.st = sc.init ? sc.init(W, H) : {};
    updateChip(key);
  }
  function frame(now) {
    R.raf = 0;
    if (!isOpen() || document.hidden) { R.last = 0; return; }
    resize();
    var key = wantKey(); if (key !== R.key) prepare(key);
    var dt = R.last ? Math.min(0.05, (now - R.last) / 1000) : 0.016; R.last = now; R.t += dt;
    var ctx = R.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (key === 'custom') {
      ctx.fillStyle = '#0e0e12'; ctx.fillRect(0, 0, R.cv.width, R.cv.height);
      if (R.img && R.img.complete && R.img.naturalWidth) {
        var cw = R.cv.width, ch = R.cv.height, z = 1.04 + 0.04 * Math.sin(R.t * 0.05), s = Math.max(cw / R.img.naturalWidth, ch / R.img.naturalHeight) * z;
        var iw = R.img.naturalWidth * s, ih = R.img.naturalHeight * s;
        ctx.drawImage(R.img, (cw - iw) / 2 + Math.sin(R.t * 0.03) * cw * 0.01, (ch - ih) / 2, iw, ih);
      }
      updateChip(key);
    } else {
      ctx.drawImage(R.off, 0, 0);
      ctx.setTransform(R.k, 0, 0, R.k, 0, 0);
      var sc = sceneOf(key);
      try { if (sc && sc.draw) sc.draw(ctx, R.st, R.t, reduced() ? 0 : dt, R.W, R.H); } catch (e) {}
    }
    if (!reduced()) R.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!R.raf && isOpen() && ensureCanvas()) { R.last = 0; R.raf = requestAnimationFrame(frame); } }
  function updateChip(key) {
    var chip = document.getElementById('pomo-scene-chip'); if (!chip) return;
    var txt;
    if (key === 'custom') txt = '🖼 ' + L('Mening rasmim', 'My photo', 'Моё фото');
    else { var sc = sceneOf(key); txt = (sc ? sc.icon + ' ' + L(sc.n[0], sc.n[1], sc.n[2]) : ''); if (key.indexOf('snd:') === 0) txt += ' · ' + L('jonli', 'live', 'живой'); }
    if (chip._t !== txt) { chip._t = txt; chip.textContent = txt; chip.title = L('Fonni almashtirish', 'Change background', 'Сменить фон'); }
  }
  function apply(force) {
    var h = hero(); if (!h) return;
    h.setAttribute('data-pt', cfg().style);
    if (force) R.key = '';
    kick();
  }
  // Pomodoro ochilganini va tovush o'zgarishini kuzatamiz (yengil)
  setInterval(function () { if (isOpen()) { apply(false); } }, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  window.addEventListener('resize', function () { if (isOpen()) { R.W = 0; kick(); } });

  // ============================================================
  //  Fon tanlash paneli (Pomodoro sozlamalari → 🖼 Fon) + tezkor tanlash (chip bosilganda)
  // ============================================================
  var STYLES = [['glass', '🪟', ['Shisha', 'Glass', 'Стекло']], ['classic', '⏱', ['Klassik', 'Classic', 'Классика']], ['neon', '💡', ['Neon', 'Neon', 'Неон']], ['minimal', '◻️', ['Minimal', 'Minimal', 'Минимал']], ['gradient', '🌈', ['Gradient', 'Gradient', 'Градиент']]];
  function thumb(id) {
    var c = document.createElement('canvas'), W = 160, H = 100; c.width = W; c.height = H;
    var x = c.getContext('2d'), sc = BGS[id] || SCENES[id];
    try { if (sc.bg) sc.bg(x, W, H); var st = sc.init ? sc.init(W, H) : {}; if (sc.draw) sc.draw(x, st, 1.2, 0.03, W, H); } catch (e) {}
    try { return c.toDataURL('image/jpeg', 0.7); } catch (e) { return ''; }
  }
  var _thumbs = {};
  function th(id) { return _thumbs[id] || (_thumbs[id] = thumb(id)); }
  function panelHtml() {
    var c = cfg(), cu = customImg();
    var h = '<div class="ps-sec"><div class="ps-row"><div><b>🎧 ' + E(L('Tovushga mos jonli fon', 'Live scene for the sound', 'Живой фон под звук')) + '</b><small>' + E(L('Yomg\'ir tovushi — ekranda yomg\'ir yog\'adi, gulxan — uchqunlar uchadi va h.k.', 'Rain sound — it rains on screen, campfire — embers fly, and so on.', 'Звук дождя — на экране идёт дождь, костёр — летят искры и т.д.')) + '</small></div>' +
      '<button type="button" class="ps-sw' + (c.live ? ' on' : '') + '" data-ps-live role="switch" aria-checked="' + c.live + '"><i></i></button></div></div>';
    h += '<div class="ps-t">🖼 ' + E(L('Fon rasmi (tovush o\'chiq paytda)', 'Background (when no sound plays)', 'Фон (когда звук выключен)')) + '</div><div class="ps-grid">';
    Object.keys(BGS).forEach(function (id) {
      var b = BGS[id];
      h += '<button type="button" class="ps-it' + (c.bg === id ? ' on' : '') + '" data-ps-bg="' + id + '"><img alt="" src="' + th(id) + '"><span>' + b.icon + ' ' + E(L(b.n[0], b.n[1], b.n[2])) + '</span></button>';
    });
    h += '<label class="ps-it ps-up' + (c.bg === 'custom' ? ' on' : '') + '">' + (cu ? '<img alt="" src="' + cu + '">' : '<em>＋</em>') + '<span>📷 ' + E(cu ? L('Mening rasmim', 'My photo', 'Моё фото') : L('Galereyadan', 'From gallery', 'Из галереи')) + '</span><input type="file" accept="image/*" data-ps-file hidden></label>';
    h += '</div>' + (cu ? '<button type="button" class="ps-link" data-ps-rmcustom>🗑 ' + E(L('Mening rasmimni o\'chirish', 'Remove my photo', 'Удалить моё фото')) + '</button>' : '') +
      '<div class="ps-note">' + E(L('Galereya rasmi faqat shu qurilmada saqlanadi.', 'Your gallery photo is stored on this device only.', 'Фото из галереи хранится только на этом устройстве.')) + '</div>';
    h += '<div class="ps-t">⏱ ' + E(L('Taymer ko\'rinishi', 'Timer style', 'Вид таймера')) + '</div><div class="ps-styles">' + STYLES.map(function (s) {
      return '<button type="button" class="ps-st ps-st-' + s[0] + (c.style === s[0] ? ' on' : '') + '" data-ps-style="' + s[0] + '"><span class="ps-st-pv">25:00</span><small>' + s[1] + ' ' + E(L(s[2][0], s[2][1], s[2][2])) + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="ps-t">🎵 ' + E(L('Jonli sahnalar (tovushlar)', 'Live scenes (sounds)', 'Живые сцены (звуки)')) + '</div><div class="ps-grid sm">' + Object.keys(SCENES).map(function (id) {
      var s = SCENES[id]; return '<button type="button" class="ps-it" data-ps-snd="' + id + '"><img alt="" src="' + th(id) + '"><span>' + s.icon + ' ' + E(L(s.n[0], s.n[1], s.n[2])) + '</span></button>';
    }).join('') + '</div>';
    return h;
  }
  function bindPanel(root, rerender) {
    root.querySelectorAll('[data-ps-bg]').forEach(function (b) { b.onclick = function () { setCfg({ bg: b.dataset.psBg }); rerender(); }; });
    root.querySelectorAll('[data-ps-style]').forEach(function (b) { b.onclick = function () { setCfg({ style: b.dataset.psStyle }); rerender(); }; });
    root.querySelectorAll('[data-ps-snd]').forEach(function (b) {
      b.onclick = function () {
        try { S.ambientFocusSound = b.dataset.psSnd; if (typeof save === 'function') save(); if (window.FocusAudio) FocusAudio.play(b.dataset.psSnd); if (typeof syncPomoAmbientBubbleUI === 'function') syncPomoAmbientBubbleUI(); } catch (e) {}
        if (!cfg().live) setCfg({ live: true });
        setTimeout(function () { apply(true); }, 150);
      };
    });
    var lv = root.querySelector('[data-ps-live]'); if (lv) lv.onclick = function () { setCfg({ live: !cfg().live }); rerender(); };
    var rm = root.querySelector('[data-ps-rmcustom]'); if (rm) rm.onclick = function () { try { localStorage.removeItem(CUSTOM_KEY); } catch (e) {} if (cfg().bg === 'custom') setCfg({ bg: 'city' }); else apply(true); rerender(); };
    var f = root.querySelector('[data-ps-file]');
    if (f) f.onchange = function () {
      var file = f.files && f.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          // Kichraytiramiz (max 1600px, JPEG) — localStorage'ga sig'sin
          var M = 1600, s = Math.min(1, M / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          var q = 0.82, url = c.toDataURL('image/jpeg', q);
          while (url.length > 1500000 && q > 0.4) { q -= 0.12; url = c.toDataURL('image/jpeg', q); }
          try { localStorage.setItem(CUSTOM_KEY, url); } catch (e) { try { toast('⚠️ ' + L('Rasm juda katta', 'Image is too large', 'Изображение слишком большое')); } catch (e2) {} return; }
          setCfg({ bg: 'custom' }); rerender();
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(file);
    };
  }
  // Sozlamalar oynasiga "🖼 Fon" bo'limini qo'shamiz
  function injectSettingsTab() {
    var tabs = document.querySelector('#pomo-settings-modal-box .pomo-set-tabs'), content = document.querySelector('#pomo-settings-modal-box .pomo-set-content');
    if (!tabs || !content || document.getElementById('pomo-settings-tab-scene')) return;
    var ref = document.getElementById('pomo-settings-tab-sounds');
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pomo-settings-tab-btn'; btn.id = 'pomo-settings-tab-scene';
    if (ref) btn.setAttribute('style', ref.getAttribute('style') || '');
    btn.textContent = '🖼 ' + L('Fon', 'Background', 'Фон');
    btn.onclick = function () { window.pomoSettingsShowTab('scene'); };
    tabs.appendChild(btn);
    var panel = document.createElement('div'); panel.id = 'pomo-settings-panel-scene'; panel.style.display = 'none'; content.appendChild(panel);
    var orig = window.pomoSettingsShowTab;
    window.pomoSettingsShowTab = function (tab) {
      if (tab !== 'scene') { panel.style.display = 'none'; btn.style.background = 'none'; btn.style.color = 'var(--text-muted)'; return orig.apply(this, arguments); }
      orig.call(this, '__none__');
      ['general', 'timers', 'sounds'].forEach(function (k) { var p = document.getElementById('pomo-settings-panel-' + k); if (p) p.style.display = 'none'; });
      panel.style.display = ''; btn.style.background = 'var(--accent-glow)'; btn.style.color = 'var(--accent)';
      var draw = function () { panel.innerHTML = panelHtml(); bindPanel(panel, draw); };
      draw();
    };
  }
  // Chip bosilganda — tezkor tanlash oynasi
  function openPicker() {
    var old = document.getElementById('ps-quick'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'ps-quick'; ov.className = 'ps-quick';
    ov.innerHTML = '<div class="ps-quick-box" role="dialog" aria-modal="true"><div class="ps-quick-h"><b>🖼 ' + E(L('Pomodoro foni', 'Pomodoro background', 'Фон Pomodoro')) + '</b><button type="button" class="ps-x" aria-label="close">✕</button></div><div class="ps-quick-body"></div></div>';
    document.body.appendChild(ov);
    var body = ov.querySelector('.ps-quick-body'), draw = function () { body.innerHTML = panelHtml(); bindPanel(body, draw); };
    draw();
    var close = function () { ov.remove(); };
    ov.querySelector('.ps-x').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  }
  window.LUPomoScene = { apply: apply, openPicker: openPicker, scenes: Object.keys(SCENES), backgrounds: Object.keys(BGS) };
  function boot() { injectSettingsTab(); apply(true); }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
