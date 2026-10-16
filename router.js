// ============================================================
// 🧭 ROUTER — har bir bo'limning o'z manzili: /LevelUpDay/profile, /LevelUpDay/pomodoro ...
// F5 (yangilash) bosilganda o'sha bo'lim qayta ochiladi; brauzerning ⟵ / ⟶ tugmalari ishlaydi.
// GitHub Pages: noma'lum yo'l 404.html ga tushadi → u ?r=<bo'lim> bilan bosh sahifaga qaytaradi.
// Service Worker: bo'lim manzillari uchun index.html qaytaradi (oflayn ham ishlaydi).
// ============================================================
(function () {
  'use strict';
  // tab → manzil (bosh sahifa = vazifalar)
  var TAB2SLUG = { tasks: '', profile: 'profile', rewards: 'rewards', goals: 'goals', hub: 'hub', blocker: 'focusgate',
    spin: 'spin', tarix: 'coins', chest: 'chest', ielts: 'ielts', sat: 'sat', cefr: 'cefr', reyting: 'leaderboard' };
  // Oynalar ko'rinishidagi bo'limlar (ustida ochiladi)
  var EXTRA = {
    pomodoro: function () { if (typeof window.pomoOpenModal === 'function') window.pomoOpenModal(); },
    stats: function () { go('profile'); try { showProfileSubtab('stats'); } catch (e) {} },
    shop: function () { hubSec('shop'); }, boss: function () { hubSec('boss'); }, feed: function () { hubSec('feed'); },
    inbox: function () { go('hub'); try { if (window.xInbox) window.xInbox.open(); } catch (e) {} },
    matrix: function () { try { if (typeof window.xOpenMatrix === 'function') window.xOpenMatrix(); } catch (e) {} }
  };
  var SLUG2TAB = {}; Object.keys(TAB2SLUG).forEach(function (t) { if (TAB2SLUG[t]) SLUG2TAB[TAB2SLUG[t]] = t; });
  SLUG2TAB.tasks = 'tasks';
  function known(slug) { return !!(SLUG2TAB[slug] || EXTRA[slug]); }

  // Ilovaning asosiy papkasi: /LevelUpDay/ (oxirgi bo'lim nomi olib tashlanadi)
  function baseOf(path) {
    var m = path.match(/^(.*\/)([A-Za-z-]+)\/?$/);
    if (m && known(m[2].toLowerCase())) return m[1];
    return path.replace(/[^/]*$/, '');
  }
  var BASE = baseOf(location.pathname);
  function slugNow() {
    var m = location.pathname.slice(BASE.length).replace(/\/$/, '').toLowerCase();
    return known(m) ? m : '';
  }
  function urlFor(slug) {
    var q = location.search.replace(/([?&])r=[^&]*&?/, '$1').replace(/[?&]$/, '');
    return BASE + slug + q;
  }

  var _silent = 0, _cur = null;
  function go(tab) { _silent++; try { showTab(tab); } finally { _silent--; } }
  function hubSec(sec) { try { S.xHubSec = sec; } catch (e) {} go('hub'); }

  // showTab() har safar chaqiradi (script.js)
  window._ludRoute = function (tab) {
    if (_silent || !(tab in TAB2SLUG)) return;
    var slug = TAB2SLUG[tab];
    if (slug === _cur && slugNow() === slug) return;
    _cur = slug;
    try { history.pushState({ lud: slug }, '', urlFor(slug)); } catch (e) {}
  };
  // Oyna ko'rinishidagi bo'lim ochilganda/yopilganda manzilni yangilaymiz
  window._ludRouteExtra = function (slug, open) {
    try {
      if (open) { if (slugNow() !== slug) history.pushState({ lud: slug, extra: 1 }, '', urlFor(slug)); }
      else if (slugNow() === slug) history.replaceState({ lud: _cur || '' }, '', urlFor(_cur || ''));
    } catch (e) {}
  };

  function apply(slug) {
    if (!slug) { go('tasks'); _cur = ''; return; }
    if (SLUG2TAB[slug]) { go(SLUG2TAB[slug]); _cur = slug === 'tasks' ? '' : slug; return; }
    if (EXTRA[slug]) { try { EXTRA[slug](); } catch (e) {} }
  }
  window.addEventListener('popstate', function () {
    try { if (typeof window.pomoCloseModal === 'function' && slugNow() !== 'pomodoro' && document.querySelector('#pomo-modal-overlay.open')) window.pomoCloseModal(true); } catch (e) {}
    apply(slugNow());
  });

  // Pomodoro oynasi: ochilganda /pomodoro, yopilganda oldingi bo'lim
  function wrapPomo() {
    var o = window.pomoOpenModal, c = window.pomoCloseModal;
    if (typeof o !== 'function' || o._lr) return;
    window.pomoOpenModal = function () { var r = o.apply(this, arguments); window._ludRouteExtra('pomodoro', true); return r; };
    window.pomoOpenModal._lr = true;
    if (typeof c === 'function') window.pomoCloseModal = function (fromPop) { var r = c.apply(this, arguments); if (fromPop !== true) window._ludRouteExtra('pomodoro', false); return r; };
  }

  function boot() {
    wrapPomo();
    // 404.html dan qaytish: ?r=profile → /LevelUpDay/profile
    var r = (location.search.match(/[?&]r=([A-Za-z-]+)/) || [])[1];
    if (r && known(r.toLowerCase())) { try { history.replaceState({ lud: r }, '', urlFor(r.toLowerCase())); } catch (e) {} }
    var slug = slugNow();
    _cur = SLUG2TAB[slug] ? (slug === 'tasks' ? '' : slug) : '';
    if (slug) setTimeout(function () { apply(slug); }, 0);
  }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
