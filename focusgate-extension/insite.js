// Sayt ichida bloklash: YouTube (Shorts, tavsiyalar, izohlar, qidiruv, PiP), Instagram (Reels, Explore, Stories),
// Facebook (Reels, Stories, lenta, Marketplace), TikTok (For You, izohlar, qidiruv, Live), X (Explore, trendlar, For you),
// Reddit (Popular/All, izohlar, bosh lenta), LinkedIn (lenta, yangiliklar), Twitch (tavsiyalar, chat).
// Sozlamalar LevelUpDay → Focusgate → Bloklash'da (cfg.inSite), kunlik limit — cfg.inSiteLim (daqiqa; 0 — to'liq blok).
// Bo'limlarda o'tgan vaqt (Shorts, qidiruv, PiP ...) fonga yuboriladi: "site:youtube#shorts" — statistikadagi donut uchun.
(function () {
  const host = location.hostname.replace(/^www\./, '').replace(/^m\./, '').replace(/^mobile\./, '');
  const SITE = { 'youtube.com': 'yt', 'instagram.com': 'ig', 'facebook.com': 'fb', 'tiktok.com': 'tt', 'x.com': 'x', 'twitter.com': 'x', 'reddit.com': 'rd', 'linkedin.com': 'li', 'twitch.tv': 'tw' }[host];
  if (!SITE) return;
  const KEY = { yt: 'site:youtube', ig: 'site:instagram', fb: 'site:facebook', tt: 'site:tiktok', x: 'site:x', rd: 'site:reddit', li: 'site:linkedin.com', tw: 'site:twitch' }[SITE];
  const NAME = { yt: 'YouTube', ig: 'Instagram', fb: 'Facebook', tt: 'TikTok', x: 'X', rd: 'Reddit', li: 'LinkedIn', tw: 'Twitch' }[SITE];
  const CSS = {
    yt_shorts: 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]), ytd-guide-entry-renderer:has(a[title="Shorts"]), ytd-mini-guide-entry-renderer[aria-label="Shorts"], ytd-video-renderer:has(a[href^="/shorts/"]), ytd-grid-video-renderer:has(a[href^="/shorts/"]), ytm-shorts-lockup-view-model, ytm-pivot-bar-item-renderer:has(.pivot-shorts), a[href^="/shorts/"] { display: none !important; }',
    yt_comments: 'ytd-comments, #comments, ytm-comment-section-renderer { display: none !important; }',
    yt_home: 'ytd-browse[page-subtype="home"] #primary, ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { display: none !important; } #related, ytd-watch-next-secondary-results-renderer { display: none !important; }',
    yt_search: 'ytd-searchbox, #search-icon-legacy, yt-searchbox, ytd-masthead #center, ytm-topbar-menu-button-renderer button[aria-label*="earch"] { display: none !important; }',
    yt_pip: '.ytp-pip-button, .ytp-miniplayer-button, ytd-miniplayer { display: none !important; }',
    ig_reels: 'a[href^="/reels"], a[href*="/reels/"], a[href^="/reel/"] { display: none !important; }',
    ig_explore: 'a[href^="/explore"] { display: none !important; }',
    ig_stories: 'a[href^="/stories/"], div[role="menu"]:has(a[href^="/stories/"]), section > main div:has(> div > ul canvas) { display: none !important; }',
    fb_reels: 'a[href*="/reel/"], a[href*="/reels/"], a[href^="/watch"] { display: none !important; }',
    fb_stories: 'a[href*="/stories/"], div[aria-label="Stories"], div[aria-label="Истории"] { display: none !important; }',
    tt_fyp: 'a[href="/foryou"], a[href="/"][data-e2e="nav-foryou"], [data-e2e="nav-foryou"] { display: none !important; }',
    tt_comments: '[data-e2e="comment-list"], [class*="CommentListContainer"], [data-e2e="browse-comment"], [data-e2e="comment-icon"] { display: none !important; }',
    x_explore: 'a[href="/explore"], a[data-testid="AppTabBar_Explore_Link"] { display: none !important; }',
    x_trends: '[data-testid="sidebarColumn"] section, [aria-label="Timeline: Trending now"], [aria-label="Хроника: Актуальные темы"] { display: none !important; }',
    rd_popular: 'a[href^="/r/popular"], a[href^="/r/all"], a[href*="reddit.com/r/popular"], a[href*="reddit.com/r/all"] { display: none !important; }',
    // 🆕 v0.6.7
    yt_endscreen: '.ytp-ce-element, .ytp-endscreen-content, .ytp-autonav-endscreen, .ytp-autonav-toggle-button-container, .ytp-videowall-still { display: none !important; }',
    yt_chat: 'ytd-live-chat-frame, #chat, #chat-container { display: none !important; }',
    yt_notif: 'ytd-notification-topbar-button-renderer, ytm-notification-topbar-button-renderer { display: none !important; }',
    yt_trending: 'ytd-guide-entry-renderer:has(a[href^="/feed/trending"]), ytd-guide-entry-renderer:has(a[href^="/feed/explore"]), ytd-guide-section-renderer:has(a[href^="/feed/trending"]), a[href^="/feed/trending"], a[href^="/feed/explore"] { display: none !important; }',
    ig_direct: 'a[href^="/direct"] { display: none !important; }',
    ig_search: 'a[href="#"]:has(svg[aria-label="Search"]), a[href="#"]:has(svg[aria-label="Поиск"]), svg[aria-label="Search"], svg[aria-label="Поиск"], input[aria-label="Search input"] { display: none !important; }',
    ig_feed: 'main[role="main"] article, main[role="main"] div:has(> article) { display: none !important; }',
    fb_feed: 'div[role="feed"], div[data-pagelet^="FeedUnit"] { display: none !important; }',
    fb_market: 'a[href*="/marketplace"] { display: none !important; }',
    tt_search: '[data-e2e="search-box"], [data-e2e="nav-search"], form[action*="/search"] { display: none !important; }',
    tt_live: 'a[href^="/live"], [data-e2e="nav-live"] { display: none !important; }',
    x_foryou: '[role="tablist"] [role="presentation"]:first-child { display: none !important; }',
    x_notifs: 'a[href="/notifications"], a[data-testid="AppTabBar_Notifications_Link"] { display: none !important; }',
    rd_comments: 'shreddit-comment-tree, [id^="comment-tree"], .commentarea, faceplate-batch:has(shreddit-comment) { display: none !important; }',
    rd_home: 'shreddit-feed, .ListingLayout-outerContainer [data-testid="post-container"] { display: none !important; }',
    li_feed: 'main.scaffold-layout__main .scaffold-finite-scroll, div.feed-shared-update-v2, [data-finite-scroll-hotkey-context="FEED"] { display: none !important; }',
    li_news: '#feed-news-module, aside .news-module, [data-view-name="news-module"] { display: none !important; }',
    tw_recs: 'a[href^="/directory"], [data-a-target="side-nav-bar"] [aria-label*="ecommended"], .side-nav-section[aria-label*="ecommended"], .front-page-carousel, [data-a-target="front-page-carousel"] { display: none !important; }',
    tw_chat: '.chat-shell, .right-column, [data-a-target="right-column-chat-bar"] { display: none !important; }',
  };
  // Qaysi bo'lim kunlik limitga ega bo'lishi mumkin: sozlama → bo'lim
  const LIMSEC = { yt_shorts: 'shorts', ig_reels: 'reels', fb_reels: 'reels', tt_fyp: 'fyp' };
  const SEC_LABEL = { shorts: 'Shorts', search: 'Search', watch: 'Video', pip: 'PiP', reels: 'Reels', explore: 'Explore', stories: 'Stories', direct: 'Direct', feed: 'Feed', fyp: 'For You', following: 'Following', browse: 'Browse', other: 'Other' };

  let opts = {}, lims = {}, style = null, on = false, track = true, used = {};
  // Bo'lim: hozir sahifaning qaysi qismidamiz
  function section() {
    const p = location.pathname;
    if (SITE === 'yt') return p.startsWith('/shorts') ? 'shorts' : p.startsWith('/results') ? 'search' : p.startsWith('/watch') ? 'watch' : 'other';
    if (SITE === 'ig') return /^\/(reels?)(\/|$)/.test(p) ? 'reels' : p.startsWith('/explore') ? 'explore' : p.startsWith('/stories') ? 'stories' : p.startsWith('/direct') ? 'direct' : 'feed';
    if (SITE === 'fb') return /^\/(reel|reels|watch)(\/|$)/.test(p) ? 'reels' : p.startsWith('/stories') ? 'stories' : 'feed';
    if (SITE === 'tt') return (p === '/' || p.startsWith('/foryou') || p.startsWith('/explore')) ? 'fyp' : p.startsWith('/following') ? 'following' : 'other';
    if (SITE === 'li') return p.startsWith('/feed') ? 'feed' : 'other';
    if (SITE === 'tw') return p === '/' || p.startsWith('/directory') ? 'browse' : 'watch';
    return '';
  }
  // Sozlama faolmi: yoqilgan va (limit yo'q yoki bugungi limit tugagan)
  function blocked(k) {
    if (!on || !opts[k]) return false;
    const lim = +lims[k] || 0;
    if (!lim) return true;
    return (used[LIMSEC[k]] || 0) >= lim * 60;
  }
  function apply() {
    const css = Object.keys(CSS).filter((k) => k.split('_')[0] === SITE && blocked(k)).map((k) => CSS[k]).join('\n');
    if (!style) { style = document.createElement('style'); style.id = 'lud-focusgate'; }
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    if (style.textContent !== css) style.textContent = css;
    redirect();
    noPip();
    noAutoplay();
  }
  function redirect() {
    if (!on) return;
    const p = location.pathname;
    if (SITE === 'yt') {
      if (blocked('yt_shorts') && p.startsWith('/shorts/')) { const id = p.split('/')[2]; location.replace(id ? '/watch?v=' + id : '/'); return; }
      if (blocked('yt_search') && p.startsWith('/results')) { location.replace('/'); return; }
    }
    if (SITE === 'ig') {
      if (blocked('ig_reels') && /^\/(reels?)(\/|$)/.test(p)) { location.replace('/'); return; }
      if (blocked('ig_explore') && p.startsWith('/explore')) { location.replace('/'); return; }
      if (blocked('ig_stories') && p.startsWith('/stories')) { location.replace('/'); return; }
    }
    if (SITE === 'fb') {
      if (blocked('fb_reels') && /^\/(reel|reels|watch)(\/|$)/.test(p)) { location.replace('/'); return; }
      if (blocked('fb_stories') && p.startsWith('/stories')) { location.replace('/'); return; }
    }
    if (SITE === 'tt' && blocked('tt_fyp') && (p === '/' || p.startsWith('/foryou'))) { location.replace('/following'); return; }
    if (SITE === 'x' && blocked('x_explore') && p.startsWith('/explore')) { location.replace('/home'); return; }
    if (SITE === 'rd' && blocked('rd_popular') && /^\/r\/(popular|all)(\/|$)/.test(p)) { location.replace('/'); return; }
    if (SITE === 'yt' && blocked('yt_trending') && /^\/feed\/(trending|explore)/.test(p)) { location.replace('/'); return; }
    if (SITE === 'ig' && blocked('ig_direct') && p.startsWith('/direct')) { location.replace('/'); return; }
    if (SITE === 'fb' && blocked('fb_market') && p.startsWith('/marketplace')) { location.replace('/'); return; }
    if (SITE === 'tt' && blocked('tt_search') && p.startsWith('/search')) { location.replace('/following'); return; }
    if (SITE === 'tt' && blocked('tt_live') && p.startsWith('/live')) { location.replace('/following'); return; }
    if (SITE === 'x' && blocked('x_foryou') && p === '/home') forceFollowing();
    if (SITE === 'tw' && blocked('tw_recs') && p.startsWith('/directory')) { location.replace('/'); }
  }
  // X: "For you" yashiringanda "Following" yorlig'ini avtomatik tanlaymiz
  function forceFollowing() {
    const tabs = document.querySelectorAll('[role="tablist"] [role="tab"]');
    if (tabs.length > 1 && tabs[0].getAttribute('aria-selected') === 'true') tabs[1].click();
  }
  // YouTube: keyingi videoning avtomatik boshlanishini o'chiramiz
  function noAutoplay() {
    if (SITE !== 'yt' || !blocked('yt_endscreen')) return;
    const b = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
    if (b) b.click();
  }
  // Picture-in-picture: video elementlarida o'chiriladi, ochiq bo'lsa yopiladi
  function noPip() {
    if (SITE !== 'yt' || !blocked('yt_pip')) return;
    document.querySelectorAll('video').forEach((v) => { if (!v.disablePictureInPicture) v.disablePictureInPicture = true; });
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  }
  function load() {
    chrome.storage.local.get(['cfg', 'token'], (o) => {
      on = !!o.token; const c = o.cfg || {};
      opts = c.inSite || {}; lims = c.inSiteLim || {}; track = c.track !== false;
      refreshUsed();
    });
  }
  // Bugun bo'limlarda o'tgan vaqt (limit uchun) — fondan
  function refreshUsed() {
    const secs = Object.keys(LIMSEC).filter((k) => k.split('_')[0] === SITE && opts[k] && +lims[k] > 0).map((k) => LIMSEC[k]);
    if (!secs.length) { apply(); return; }
    try {
      chrome.runtime.sendMessage({ type: 'fg:secUsed', keys: secs.map((s) => KEY + '#' + s) }, (r) => {
        if (chrome.runtime.lastError) { apply(); return; }
        secs.forEach((s) => { used[s] = (r && r[KEY + '#' + s]) || 0; });
        apply();
      });
    } catch (e) { apply(); }
  }
  load();
  chrome.storage.onChanged.addListener((ch) => { if (ch.cfg || ch.token) load(); });

  // ⏱ Har 5 soniyada: sahifa ko'rinib tursa (yoki PiP ochiq bo'lsa) — joriy bo'limga vaqt qo'shiladi
  const BEAT = 5;
  setInterval(() => {
    if (!on || !track) return;
    let sec = section();
    if (!sec) return;
    const vis = document.visibilityState === 'visible' && document.hasFocus();
    if (!vis) { if (SITE === 'yt' && document.pictureInPictureElement) sec = 'pip'; else return; }
    used[sec] = (used[sec] || 0) + BEAT;
    try { chrome.runtime.sendMessage({ type: 'fg:sec', key: KEY + '#' + sec, label: NAME + ' · ' + (SEC_LABEL[sec] || sec), s: BEAT }, () => void chrome.runtime.lastError); } catch (e) { return; }
    // Limit tugagan bo'lsa — shu zahoti bloklanadi
    if (Object.keys(LIMSEC).some((k) => k.split('_')[0] === SITE && LIMSEC[k] === sec && opts[k] && +lims[k] > 0 && used[sec] >= lims[k] * 60)) apply();
  }, BEAT * 1000);

  // 🧭 SPA: manzil o'zgarishi darhol seziladi (YouTube hodisalari, history, DOM o'zgarishi) — bir lahzaga ham ko'rinmasin
  let last = location.href;
  function onNav() { if (location.href !== last) { last = location.href; apply(); } }
  ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated', 'popstate', 'hashchange'].forEach((ev) => window.addEventListener(ev, onNav, true));
  document.addEventListener('yt-navigate-start', onNav, true);
  let mo = null, moT = 0;
  function observe() {
    if (mo || !document.documentElement) return;
    mo = new MutationObserver(() => {
      onNav();
      if (!moT && ((SITE === 'yt' && (blocked('yt_pip') || blocked('yt_endscreen'))) || (SITE === 'x' && blocked('x_foryou')))) moT = setTimeout(() => { moT = 0; noPip(); noAutoplay(); if (SITE === 'x' && location.pathname === '/home' && blocked('x_foryou')) forceFollowing(); }, 400);
      if (style && !style.isConnected) apply();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  observe();
  document.addEventListener('DOMContentLoaded', observe);
  document.addEventListener('enterpictureinpicture', () => { if (blocked('yt_pip')) noPip(); }, true);
  setInterval(onNav, 1500); // zaxira
})();
