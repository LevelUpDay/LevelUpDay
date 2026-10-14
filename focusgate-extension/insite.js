// Sayt ichida bloklash: YouTube Shorts / izohlar / bosh sahifa tavsiyalari, Instagram Reels / Explore, Facebook Reels.
// Sozlamalar LevelUpDay → Focusgate → Bloklash'da (cfg.inSite), kengaytma ulangan bo'lsa ishlaydi.
(function () {
  const host = location.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const CSS = {
    yt_shorts: 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]), ytd-guide-entry-renderer:has(a[title="Shorts"]), ytd-mini-guide-entry-renderer[aria-label="Shorts"], ytd-video-renderer:has(a[href^="/shorts/"]), ytd-grid-video-renderer:has(a[href^="/shorts/"]), ytd-rich-item-renderer:has(a[href^="/shorts/"]), yt-chip-cloud-chip-renderer:has(yt-formatted-string[title="Shorts"]), a[href^="/shorts/"] { display: none !important; }',
    yt_comments: 'ytd-comments, #comments { display: none !important; }',
    yt_home: 'ytd-browse[page-subtype="home"] #primary, ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { display: none !important; } #related, ytd-watch-next-secondary-results-renderer { display: none !important; }',
    ig_reels: 'a[href^="/reels"], a[href*="/reels/"], a[href^="/reel/"] { display: none !important; }',
    ig_explore: 'a[href^="/explore"] { display: none !important; }',
    fb_reels: 'a[href*="/reel/"], a[href*="/reels/"], a[href^="/watch"] { display: none !important; }',
  };
  let opts = {}, style = null, on = false;
  function apply() {
    const css = Object.keys(CSS).filter((k) => on && opts[k] && k.slice(0, 2) === ({ 'youtube.com': 'yt', 'instagram.com': 'ig', 'facebook.com': 'fb' })[host]).map((k) => CSS[k]).join('\n');
    if (!style) { style = document.createElement('style'); style.id = 'lud-focusgate'; (document.head || document.documentElement).appendChild(style); }
    style.textContent = css;
    redirect();
  }
  function redirect() {
    if (!on) return;
    const p = location.pathname;
    if (host === 'youtube.com' && opts.yt_shorts && p.startsWith('/shorts/')) { const id = p.split('/')[2]; location.replace(id ? '/watch?v=' + id : '/'); }
    if (host === 'instagram.com' && opts.ig_reels && /^\/(reels?)(\/|$)/.test(p)) location.replace('/');
    if (host === 'instagram.com' && opts.ig_explore && p.startsWith('/explore')) location.replace('/');
    if (host === 'facebook.com' && opts.fb_reels && /^\/(reel|reels|watch)(\/|$)/.test(p)) location.replace('/');
  }
  function load() {
    chrome.storage.local.get(['cfg', 'token'], (o) => { on = !!o.token; opts = (o.cfg && o.cfg.inSite) || {}; apply(); });
  }
  load();
  chrome.storage.onChanged.addListener((ch) => { if (ch.cfg || ch.token) load(); });
  // SPA: manzil o'zgarishini kuzatamiz
  let last = location.href;
  setInterval(() => { if (location.href !== last) { last = location.href; redirect(); } }, 700);
})();
