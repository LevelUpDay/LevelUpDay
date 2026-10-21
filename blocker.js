// ============================================================
// 🛡 FOCUSGATE — ilova va sayt blokeri (LevelUpDay ichida).
// Ishlash tartibi:
//   • Windows'da Focusgate.exe (focusgate-agent/) faol oynani kuzatadi, vaqtni hisoblaydi va bloklaydi.
//   • Agent ↔ server: supabase/functions/focusgate (ulash + sinxronlash). Jadvallar: fg_devices, fg_usage, fg_config.
//   • Bu sahifa: statistika (fg_usage), limitlar/fokus (fg_config.config) — agent 30 soniyada qabul qiladi.
//   • Kompyuter ulanmagan bo'lsa — ulash yo'riqnomasi va namuna (DEMO) ko'rinish.
// Ochish: showTab('blocker') · Hub → Bo'limlar · Ctrl+K · #focusgate · ulash havolasi #fgpair=XXXX-XXXX
// ============================================================
(function () {
  'use strict';
  function L(uz, en, ru) { try { if (typeof _cl === 'function') return _cl(uz, en, ru); } catch (e) {} return uz; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(a) { return L(a[0], a[1], a[2]); }
  var AGENT_VERSION = '0.6.3'; // downloads/version.json bilan bir xil bo'lsin
  var DOWNLOAD_URL = 'downloads/Focusgate.exe?v=' + AGENT_VERSION;
  // ✅ Focusgate kuzatuvchilari (Windows dasturi Focusgate.exe va brauzer kengaytmasi ZIP) — Focusgate bo'limida yuklab olinadi.
  // Faqat "Ilovani o'rnatish" oynasidagi Windows o'rnatuvchisi o'chirilgan (extras.js: dlOn).
  var DOWNLOADS_ON = true;
  function soonCard() {
    return '<div class="fg-card fg-connect fg-soon"><div class="fg-connect-h"><span>⏳</span><div><b>' + E(L('Kompyuter va telefon ilovasi — tez kunda', 'Computer & phone apps — coming soon', 'Приложения для компьютера и телефона — скоро')) + '</b>' +
      '<small>' + E(L('Dasturlarni bloklash va ekran vaqti uchun ilovalar tayyorlanmoqda. Hozircha LevelUpDay\'ni brauzerda (Google Chrome) ishlating — pastda namuna statistikani ko\'rishingiz mumkin.', 'Apps for blocking programs and tracking screen time are on the way. For now, use LevelUpDay in your browser (Google Chrome) — below is sample data.', 'Приложения для блокировки и учёта экранного времени готовятся. Пока используйте LevelUpDay в браузере (Google Chrome) — ниже пример статистики.')) + '</small></div></div></div>';
  }

  // ---------- Namuna (DEMO) ma'lumotlar — kompyuter ulanmaganda ko'rsatiladi ----------
  var DEMO_APPS = [
    { id: 'chrome.exe', n: 'Google Chrome', m: 96 }, { id: 'telegram.exe', n: 'Telegram Desktop', m: 60 },
    { id: 'code.exe', n: 'Visual Studio Code', m: 42 }, { id: 'discord.exe', n: 'Discord', m: 30 },
    { id: 'steam.exe', n: 'Steam', m: 27 }, { id: 'site:youtube', n: 'YouTube', m: 18 }, { id: 'site:instagram', n: 'Instagram', m: 9 }
  ];
  var DEMO_HOURS = [0, 0.7, 0, 0, 0, 0, 6, 21, 34, 0, 3, 32, 5, 9, 11, 2, 8, 15, 39, 36, 1, 0, 0, 0];
  var DEMO_CFG = {
    track: true, notif: true, strict: false, focusUntil: 0,
    rules: [{ id: 'd1', app: 'site:pornhub', label: L('Kattalar uchun saytlar', 'Adult websites', 'Сайты для взрослых'), kind: 'always', on: true },
      { id: 'd2', app: 'chrome.exe', label: 'Google Chrome', kind: 'daily', minutes: 90, on: true },
      { id: 'd3', app: 'discord.exe', label: 'Discord', kind: 'daily', minutes: 45, on: true },
      { id: 'd4', app: 'steam.exe', label: 'Steam', kind: 'schedule', days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', on: true }],
    focusApps: [{ app: 'discord.exe', label: 'Discord', on: true }, { app: 'telegram.exe', label: 'Telegram Desktop', on: false }]
  };

  // Mashhur saytlar (agent bilan bir xil kalitlar)
  var SITES = [['site:youtube', 'YouTube', '#FF0033'], ['site:instagram', 'Instagram', '#E1306C'], ['site:tiktok', 'TikTok', '#25F4EE'],
    ['site:facebook', 'Facebook', '#1877F2'], ['site:reddit', 'Reddit', '#FF4500'], ['site:x', 'X (Twitter)', '#111111'], ['site:twitch', 'Twitch', '#9146FF'], ['site:netflix', 'Netflix', '#E50914']];
  var BRAND = { 'chrome.exe': '#34A853', 'msedge.exe': '#0C7CD5', 'firefox.exe': '#FF7139', 'telegram.exe': '#2AABEE', 'discord.exe': '#5865F2', 'steam.exe': '#1B2838', 'code.exe': '#2F80ED',
    'spotify.exe': '#1DB954', 'whatsapp.exe': '#25D366', 'winword.exe': '#2B579A', 'excel.exe': '#217346', 'powerpnt.exe': '#D24726', 'notion.exe': '#333333', 'obs64.exe': '#302E31' };
  // 🗂 Kategoriyalar (agent: focusgate-agent/cats.go, kengaytma: rules.js bilan bir xil lug'at)
  var CAT_LIST = [['work', '💼', ['Ish', 'Work', 'Работа'], '#3b82f6'], ['study', '📚', ['O\'qish', 'Study', 'Учёба'], '#10b981'], ['social', '💬', ['Ijtimoiy', 'Social', 'Соцсети'], '#ec4899'],
    ['games', '🎮', ['O\'yinlar', 'Games', 'Игры'], '#8b5cf6'], ['fun', '🎬', ['Ko\'ngilochar', 'Entertainment', 'Развлечения'], '#f43f5e'], ['web', '🌐', ['Brauzer', 'Browser', 'Браузер'], '#0ea5e9'], ['other', '📦', ['Boshqa', 'Other', 'Другое'], '#64748b']];
  var CATS = { all: ['Hammasi', 'All', 'Все'] };
  CAT_LIST.forEach(function (c) { CATS[c[0]] = c[2]; });
  function catInfo(k) { return CAT_LIST.filter(function (c) { return c[0] === k; })[0] || CAT_LIST[CAT_LIST.length - 1]; }
  var CAT_OF = {};
  [['web', 'chrome msedge firefox brave opera opera_gx vivaldi browser arc yandex iexplore'],
   ['social', 'telegram discord whatsapp viber skype signal messenger instagram tiktok linphone microsip site:instagram site:tiktok site:facebook site:x site:twitter site:vk site:telegram site:discord site:reddit site:pinterest'],
   ['games', 'steam steamwebhelper epicgameslauncher riotclientservices leagueclient valorant valorant-win64-shipping robloxplayerbeta minecraftlauncher tlauncher cs2 csgo cs hl hl2 dota2 gta5 gtavlauncher fortniteclient-win64-shipping battle.net origin eadesktop upc ubisoftconnect genshinimpact left4dead2 left4dead2-launcher tslgame overwatch rocketleague goggalaxy playnite.desktopapp pubg site:roblox'],
   ['fun', 'vlc spotify potplayermini64 potplayermini mpc-hc64 mpc-hc netflix aimp itunes kmplayer utweb qbittorrent site:youtube site:netflix site:twitch site:kinopoisk'],
   ['work', 'code cursor devenv idea64 pycharm64 webstorm64 studio64 winword excel powerpnt onenote outlook ms-teams teams slack zoom notion obsidian figma photoshop illustrator afterfx blender termius putty windowsterminal postman githubdesktop acrobat acrord32 wps et wpp notepad++ sublime_text notezilla radmin anydesk teamviewer obs64 explorer notepad'],
   ['study', 'anki site:coursera site:udemy site:khanacademy site:duolingo site:levelupday']].forEach(function (g) {
    g[1].split(' ').forEach(function (k) { CAT_OF[k.indexOf('site:') === 0 ? k : k + '.exe'] = g[0]; });
  });
  CAT_OF['adobe premiere pro.exe'] = 'work'; CAT_OF['docker desktop.exe'] = 'work';
  // Saytlar va ikonkasi chiqmagan dasturlar uchun favicon manbasi
  var DOMAIN = { 'site:youtube': 'youtube.com', 'site:instagram': 'instagram.com', 'site:tiktok': 'tiktok.com', 'site:facebook': 'facebook.com', 'site:x': 'x.com', 'site:twitter': 'twitter.com',
    'site:reddit': 'reddit.com', 'site:twitch': 'twitch.tv', 'site:netflix': 'netflix.com', 'site:vk': 'vk.com', 'site:telegram': 'web.telegram.org', 'site:discord': 'discord.com', 'site:pinterest': 'pinterest.com',
    'site:kinopoisk': 'kinopoisk.ru', 'site:roblox': 'roblox.com', 'site:coursera': 'coursera.org', 'site:udemy': 'udemy.com', 'site:khanacademy': 'khanacademy.org', 'site:duolingo': 'duolingo.com',
    'chrome.exe': 'google.com/chrome', 'msedge.exe': 'microsoft.com/edge', 'firefox.exe': 'firefox.com', 'telegram.exe': 'telegram.org', 'discord.exe': 'discord.com', 'whatsapp.exe': 'whatsapp.com',
    'steam.exe': 'store.steampowered.com', 'epicgameslauncher.exe': 'epicgames.com', 'spotify.exe': 'spotify.com', 'code.exe': 'code.visualstudio.com', 'zoom.exe': 'zoom.us', 'slack.exe': 'slack.com',
    'notion.exe': 'notion.so', 'figma.exe': 'figma.com', 'robloxplayerbeta.exe': 'roblox.com', 'tlauncher.exe': 'tlauncher.org', 'vlc.exe': 'videolan.org', 'obs64.exe': 'obsproject.com',
    'winword.exe': 'office.com', 'excel.exe': 'office.com', 'powerpnt.exe': 'office.com', 'viber.exe': 'viber.com', 'skype.exe': 'skype.com', 'termius.exe': 'termius.com', 'blender.exe': 'blender.org' };

  // 🌐 Saytlar katalogi: guruh → [kalit, nom, domen]. Mashhurlari agent/kengaytma bilan bir xil kalitda (site:youtube),
  // qolganlari to'liq domen (site:kun.uz). Guruhning kategoriyasi cfg.cats orqali barcha qurilmalarga yetkaziladi.
  var SITE_GROUPS = [
    ['social', '💬', ['Ijtimoiy tarmoqlar', 'Social', 'Соцсети'], 'social', [['site:instagram', 'Instagram', 'instagram.com'], ['site:tiktok', 'TikTok', 'tiktok.com'], ['site:facebook', 'Facebook', 'facebook.com'], ['site:x', 'X (Twitter)', 'x.com'], ['site:reddit', 'Reddit', 'reddit.com'], ['site:pinterest', 'Pinterest', 'pinterest.com'], ['site:telegram', 'Telegram Web', 'web.telegram.org'], ['site:discord', 'Discord', 'discord.com'], ['site:vk', 'VK', 'vk.com'], ['site:threads.net', 'Threads', 'threads.net'], ['site:snapchat.com', 'Snapchat', 'snapchat.com'], ['site:linkedin.com', 'LinkedIn', 'linkedin.com'], ['site:tumblr.com', 'Tumblr', 'tumblr.com'], ['site:ok.ru', 'Одноклассники', 'ok.ru'], ['site:quora.com', 'Quora', 'quora.com']]],
    ['video', '🎬', ['Video va musiqa', 'Video & music', 'Видео и музыка'], 'fun', [['site:youtube', 'YouTube', 'youtube.com'], ['site:netflix', 'Netflix', 'netflix.com'], ['site:twitch', 'Twitch', 'twitch.tv'], ['site:kick.com', 'Kick', 'kick.com'], ['site:kinopoisk', 'Кинопоиск', 'kinopoisk.ru'], ['site:primevideo.com', 'Prime Video', 'primevideo.com'], ['site:disneyplus.com', 'Disney+', 'disneyplus.com'], ['site:rutube.ru', 'Rutube', 'rutube.ru'], ['site:ivi.ru', 'Иви', 'ivi.ru'], ['site:mover.uz', 'Mover.uz', 'mover.uz'], ['site:spotify.com', 'Spotify', 'spotify.com'], ['site:soundcloud.com', 'SoundCloud', 'soundcloud.com'], ['site:music.yandex.ru', 'Яндекс Музыка', 'music.yandex.ru'], ['site:9gag.com', '9GAG', '9gag.com']]],
    ['games', '🎮', ['O\'yinlar', 'Games', 'Игры'], 'games', [['site:roblox', 'Roblox', 'roblox.com'], ['site:store.steampowered.com', 'Steam', 'store.steampowered.com'], ['site:epicgames.com', 'Epic Games', 'epicgames.com'], ['site:chess.com', 'Chess.com', 'chess.com'], ['site:lichess.org', 'Lichess', 'lichess.org'], ['site:poki.com', 'Poki', 'poki.com'], ['site:crazygames.com', 'CrazyGames', 'crazygames.com'], ['site:miniclip.com', 'Miniclip', 'miniclip.com'], ['site:itch.io', 'itch.io', 'itch.io'], ['site:y8.com', 'Y8', 'y8.com'], ['site:friv.com', 'Friv', 'friv.com'], ['site:minecraft.net', 'Minecraft', 'minecraft.net']]],
    ['news', '📰', ['Yangiliklar', 'News', 'Новости'], 'web', [['site:kun.uz', 'Kun.uz', 'kun.uz'], ['site:daryo.uz', 'Daryo', 'daryo.uz'], ['site:gazeta.uz', 'Gazeta.uz', 'gazeta.uz'], ['site:qalampir.uz', 'Qalampir', 'qalampir.uz'], ['site:podrobno.uz', 'Podrobno', 'podrobno.uz'], ['site:uza.uz', 'UzA', 'uza.uz'], ['site:bbc.com', 'BBC', 'bbc.com'], ['site:cnn.com', 'CNN', 'cnn.com'], ['site:lenta.ru', 'Лента.ру', 'lenta.ru'], ['site:ria.ru', 'РИА', 'ria.ru'], ['site:news.google.com', 'Google News', 'news.google.com']]],
    ['shop', '🛍', ['Xaridlar', 'Shopping', 'Покупки'], 'other', [['site:uzum.uz', 'Uzum Market', 'uzum.uz'], ['site:olx.uz', 'OLX', 'olx.uz'], ['site:wildberries.ru', 'Wildberries', 'wildberries.ru'], ['site:ozon.ru', 'Ozon', 'ozon.ru'], ['site:market.yandex.ru', 'Яндекс Маркет', 'market.yandex.ru'], ['site:amazon.com', 'Amazon', 'amazon.com'], ['site:aliexpress.com', 'AliExpress', 'aliexpress.com'], ['site:temu.com', 'Temu', 'temu.com'], ['site:ebay.com', 'eBay', 'ebay.com']]],
    ['ai', '🤖', ['Sun\'iy intellekt', 'AI', 'ИИ'], 'work', [['site:chatgpt.com', 'ChatGPT', 'chatgpt.com'], ['site:claude.ai', 'Claude', 'claude.ai'], ['site:gemini.google.com', 'Gemini', 'gemini.google.com'], ['site:perplexity.ai', 'Perplexity', 'perplexity.ai'], ['site:character.ai', 'Character.AI', 'character.ai']]],
    ['study', '📚', ['O\'qish', 'Study', 'Учёба'], 'study', [['site:duolingo', 'Duolingo', 'duolingo.com'], ['site:coursera', 'Coursera', 'coursera.org'], ['site:udemy', 'Udemy', 'udemy.com'], ['site:khanacademy', 'Khan Academy', 'khanacademy.org'], ['site:quizlet.com', 'Quizlet', 'quizlet.com'], ['site:wikipedia.org', 'Wikipedia', 'wikipedia.org']]],
    ['work', '💼', ['Ish', 'Work', 'Работа'], 'work', [['site:github.com', 'GitHub', 'github.com'], ['site:docs.google.com', 'Google Docs', 'docs.google.com'], ['site:notion.so', 'Notion', 'notion.so'], ['site:figma.com', 'Figma', 'figma.com'], ['site:trello.com', 'Trello', 'trello.com'], ['site:mail.google.com', 'Gmail', 'mail.google.com']]]
  ];
  var SITE_CAT_OF = {};
  SITE_GROUPS.forEach(function (g) { g[4].forEach(function (x) { SITE_CAT_OF[x[0]] = g[3]; if (!DOMAIN[x[0]]) DOMAIN[x[0]] = x[2]; if (!SITES.some(function (y) { return y[0] === x[0]; })) SITES.push([x[0], x[1], '']); }); });
  Object.keys(SITE_CAT_OF).forEach(function (k) { if (!CAT_OF[k]) CAT_OF[k] = SITE_CAT_OF[k]; });

  // ---------- Holat ----------
  var FG = { loaded: false, loading: false, devices: [], cfg: null, rows: [], err: '', at: 0 };
  var UI = { tab: 'today', day: 0, cat: 'all', kind: 'all', dev: 'all', metric: 'time', chart: 'bar', hide: {}, hr: -1, setupOpen: false, focusMin: 25, allSites: false };
  var HIST_DAYS = 30; // statistika tarixi (kalendar)
  var LOCAL = { reward: true };

  function sbOk() { try { return !!(typeof S !== 'undefined' && S && S.cloudLinked && S.cloudUserId && typeof supabase !== 'undefined' && supabase && supabase.from); } catch (e) { return false; } }
  function real() { return sbOk() && FG.devices.length > 0; }
  // Qurilma ulanmagan bo'lsa — namuna (soxta) ma'lumot ko'rsatilmaydi: hammasi bo'sh, faqat ulash taklifi
  var EMPTY_CFG = { track: true, notif: true, strict: false, rules: [], focusApps: [], focusUntil: 0 };
  function cfg() { return real() ? (FG.cfg || (FG.cfg = { track: true, notif: true, strict: false, rules: [], focusApps: [], focusUntil: 0 })) : EMPTY_CFG; }
  function loadLocal() { try { var x = S && S.focusgate && S.focusgate.settings; if (x && typeof x.reward === 'boolean') LOCAL.reward = x.reward; } catch (e) {} }
  function saveLocal() { try { if (!S.focusgate || typeof S.focusgate !== 'object') S.focusgate = {}; S.focusgate.settings = Object.assign({}, S.focusgate.settings || {}, LOCAL); save(); } catch (e) {} }
  function dayStr(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------- Ma'lumot modeli (real yoki namuna) ----------
  function brandOf(id) { var b = window.FG_ICONS && id ? window.FG_ICONS[id] : null; return b && b[1] ? b : null; }
  function color(id) {
    if (BRAND[id]) return BRAND[id];
    var bi = brandOf(id); if (bi) return '#' + bi[0];
    for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === id && SITES[i][2]) return SITES[i][2];
    var h = 0; for (var j = 0; j < id.length; j++) h = (h * 31 + id.charCodeAt(j)) >>> 0;
    return 'hsl(' + (h % 360) + ',62%,52%)';
  }
  function isPkg(id) { return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(id) && !/\.exe$/.test(id); }
  function niceExe(id) { return id.indexOf('site:') === 0 ? L('sayt', 'website', 'сайт') : isPkg(id) ? '📱 Android' : id; }
  function mkApp(id, label, min) { return { id: id, n: label || (id.indexOf('site:') === 0 ? id.slice(5) : id.replace(/\.exe$/, '')), exe: niceExe(id), c: color(id), m: min, cat: catOf(id), site: id.indexOf('site:') === 0 }; }
  // Kategoriya: foydalanuvchi tanlagani → agent aniqlagani (o'rnatilgan papka) → lug'at
  function devApp(id) { for (var i = 0; i < FG.devices.length; i++) { var a = FG.devices[i].apps; if (Array.isArray(a)) for (var j = 0; j < a.length; j++) if (a[j].exe === id) return a[j]; } return null; }
  function catOf(id) {
    if (!id) return 'other';
    if (id.indexOf('cat:') === 0) return id.slice(4);
    var c = cfg(); if (c && c.cats && c.cats[id]) return c.cats[id];
    var d = real() ? devApp(id) : null; if (d && d.cat) return d.cat;
    return CAT_OF[id] || (id.indexOf('site:') === 0 ? 'web' : 'other');
  }
  // Ikonka: agent yuborgan exe ikonkasi → sayt favikonkasi
  function iconOf(id) {
    var d = real() ? devApp(id) : null; if (d && d.icon) return d.icon;
    var dom = DOMAIN[id] || (id.indexOf('site:') === 0 && id.indexOf('.') !== -1 ? id.slice(5) : '');
    return dom ? 'https://www.google.com/s2/favicons?sz=64&domain_url=' + encodeURIComponent('https://' + dom) : '';
  }
  // Bir kunlik ilovalar (minut) va soatlar
  // 📱💻🧩 Ulangan qurilmalar: turi va tartib raqami (statistikada "1 · parking24" kabi)
  function devKind(d) {
    if (d && d.kind) return d.kind === 'ext' || d.kind === 'phone' ? d.kind : 'pc';
    var v = (d && d.agent_version) || ''; return /^ext-/.test(v) || /\((kengaytma|extension|расширение)\)/.test((d && d.name) || '') ? 'ext' : /^android-/.test(v) ? 'phone' : 'pc';
  }
  function devOn(d) { return !!(d && d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 150000); }
  function devIcon(d) { var k = devKind(d); return k === 'ext' ? '🧩' : k === 'phone' ? '📱' : '💻'; }
  function devName(d) { if (d && d.label) return String(d.label); return String((d && d.name) || 'Windows').replace(/\((kengaytma|extension|расширение)\)/, '(' + L('kengaytma', 'extension', 'расширение') + ')'); }
  function devById(id) { for (var i = 0; i < FG.devices.length; i++) if (FG.devices[i].id === id) return FG.devices[i]; return null; }
  // Statistika filtri: kompyuterga bog'langan kengaytmaning ma'lumoti o'sha kompyuter ichida hisoblanadi
  function inDev(rowDev, dev) { if (!dev || dev === 'all' || rowDev === dev) return true; var x = devById(rowDev); return !!(x && x.parent_id === dev && devKind(x) === 'ext'); }
  function statDevs() { return FG.devices.filter(function (d) { return devKind(d) !== 'ext'; }); }
  // Bir ilovaning soatlar bo'yicha vaqti (daqiqa) — tanlangan kun va qurilma uchun
  function appHours(id, off, dev) {
    var d = dayStr(off), out = new Array(24).fill(0), best = null, site = id.indexOf('site:') === 0;
    if (!real()) return out;
    FG.rows.forEach(function (r) {
      if (r.day !== d || r.app !== id || !inDev(r.device_id, dev)) return;
      if (site) { if (!best || (r.seconds || 0) > (best.seconds || 0)) best = r; return; }
      (r.hours || []).forEach(function (v, i) { if (i < 24) out[i] += (v || 0) / 60; });
    });
    if (best) (best.hours || []).forEach(function (v, i) { if (i < 24) out[i] += (v || 0) / 60; });
    return out;
  }
  // Soatlarni "09:00–11:00, 20:00–21:00" kabi oraliqlarga yig'adi
  function hourRanges(h) {
    var out = [], st = -1;
    for (var i = 0; i <= 24; i++) {
      var on = i < 24 && h[i] >= 0.5;
      if (on && st === -1) st = i;
      if (!on && st !== -1) { out.push([st, i]); st = -1; }
    }
    return out.map(function (r) { var m = 0; for (var k = r[0]; k < r[1]; k++) m += h[k]; return { a: r[0], b: r[1], m: m }; });
  }
  // Bo'lim qatorlari ("site:youtube#shorts") — faqat sayt ichidagi statistika uchun, umumiy vaqtga qo'shilmaydi
  function isSec(app) { return String(app).indexOf('#') !== -1; }
  var _dmCache = {};
  function dayModel(off, dev) {
    if (dev === undefined) dev = 'all';
    var z = function () { return new Array(24).fill(0); };
    if (!real()) return { apps: [], hours: z(), hA: z(), hS: z(), oh: z(), ohA: z(), ohS: z() };
    var ck = off + '|' + dev + '|' + FG.at + '|' + (FG.cfgAt || 0);
    if (_dmCache[ck]) return _dmCache[ck];
    var d = dayStr(off), by = {}, hA = z(), hS = z(), ohA = z(), ohS = z();
    // Saytlarni Windows agenti ham, kengaytma ham hisoblaydi — sayt uchun eng katta qiymat olinadi, dasturlar qo'shiladi
    var siteBest = {};
    FG.rows.forEach(function (r) {
      if (r.day !== d || isSec(r.app)) return;
      if (!inDev(r.device_id, dev)) return;
      var site = r.app.indexOf('site:') === 0;
      var x = by[r.app] || (by[r.app] = { label: r.label, s: 0, o: 0 });
      if (r.label) x.label = r.label;
      if (site) { if ((r.seconds || 0) > x.s || (!x.s && (r.opens || 0) > x.o)) { x.s = r.seconds || 0; x.o = r.opens || 0; siteBest[r.app] = r; } return; }
      x.s += r.seconds || 0; x.o += r.opens || 0;
      (r.hours || []).forEach(function (v, i) { if (i < 24) hA[i] += (v || 0) / 60; });
      (r.open_hours || []).forEach(function (v, i) { if (i < 24) ohA[i] += v || 0; });
    });
    Object.keys(siteBest).forEach(function (k) {
      (siteBest[k].hours || []).forEach(function (v, i) { if (i < 24) hS[i] += (v || 0) / 60; });
      (siteBest[k].open_hours || []).forEach(function (v, i) { if (i < 24) ohS[i] += v || 0; });
    });
    var apps = Object.keys(by).map(function (k) { var a = mkApp(k, by[k].label, by[k].s / 60); a.o = by[k].o; return a; }).filter(function (a) { return a.m >= 0.5 || a.o > 0; }).sort(function (a, b) { return b.m - a.m; });
    var sum = function (a, b) { return a.map(function (v, i) { return v + b[i]; }); };
    return (_dmCache[ck] = { apps: apps, hours: sum(hA, hS), hA: hA, hS: hS, oh: sum(ohA, ohS), ohA: ohA, ohS: ohS });
  }
  // Sayt ichidagi bo'limlar (Shorts, qidiruv, PiP ...): oxirgi `days` kunda soniyalar (kun bo'yicha — eng ko'p sanagan qurilma)
  function sections(site, days, onlyToday) {
    var out = {}, pre = site + '#', from = onlyToday ? 0 : -(days - 1), daysOk = {};
    for (var i = from; i <= 0; i++) daysOk[dayStr(i)] = 1;
    var best = {};
    FG.rows.forEach(function (r) {
      if (!daysOk[r.day] || String(r.app).indexOf(pre) !== 0) return;
      var k = r.day + '|' + r.app; if (!best[k] || (r.seconds || 0) > best[k]) best[k] = r.seconds || 0;
    });
    Object.keys(best).forEach(function (k) { var sec = k.split('#')[1]; out[sec] = (out[sec] || 0) + best[k]; });
    return out;
  }
  // Kunlik limit shu kuni necha daqiqa (r.perDay — hafta kuni bo'yicha)
  function wdOf(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); var w = d.getDay(); return w === 0 ? 7 : w; }
  function ruleMin(r, off) { var v = r && r.perDay && r.perDay[String(wdOf(off))]; return v != null ? +v : ((r && r.minutes) || 0); }
  function usedMin(app, off) {
    var apps = dayModel(off || 0).apps;
    if (app && app.indexOf('cat:') === 0) { var k = app.slice(4); return apps.filter(function (x) { return x.cat === k; }).reduce(function (s, x) { return s + x.m; }, 0); }
    var a = apps.filter(function (x) { return x.id === app; })[0]; return a ? a.m : 0;
  }
  function weekOf(app) {
    var out = [];
    for (var i = -6; i <= 0; i++) out.push(app ? usedMin(app, i) : dayModel(i).apps.reduce(function (s, a) { return s + a.m; }, 0));
    return out;
  }
  function knownApps() {
    var seen = {}, out = [];
    for (var i = 0; i >= -6; i--) dayModel(i).apps.forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; out.push(a); } });
    return out;
  }
  // 💻 Kompyuterdagi barcha dasturlar (agent Start menyusi, ro'yxatga olish kitobi va jarayonlardan yig'adi)
  var DEMO_INSTALLED = [['chrome.exe', 'Google Chrome'], ['telegram.exe', 'Telegram Desktop'], ['code.exe', 'Visual Studio Code'], ['discord.exe', 'Discord'], ['steam.exe', 'Steam'],
    ['spotify.exe', 'Spotify'], ['msedge.exe', 'Microsoft Edge'], ['winword.exe', 'Word'], ['excel.exe', 'Excel'], ['obs64.exe', 'OBS Studio'], ['epicgameslauncher.exe', 'Epic Games Launcher'],
    ['vlc.exe', 'VLC media player'], ['notepad.exe', 'Notepad'], ['whatsapp.exe', 'WhatsApp'], ['robloxplayerbeta.exe', 'Roblox Player'], ['zoom.exe', 'Zoom']];
  // Agent eski versiyasi yuborgan keraksiz yozuvlar (xizmatlar, yangilagichlar, tizim fayllari) — saytda ham filtrlanadi
  var JUNK_EXE = /^(unins\d*|uninstall.*|setup.*|.*setup|update(r)?|.*updater|autoupdate.*|.*crash.*|.*helper|ju(check|sched)|.*service|.*svc|.*svr|.*troubleshooter|.*userps|rundll32|cmd|powershell|pwsh|msiexec|chrome_proxy|msedgewebview2|onedrivesetup|filecoauth|widgetboard|widgetservice|microsoftstartfeedprovider|crossdeviceservice|systemsettings|focusgate.*)\.exe$/i;
  var JUNK_NAME = /(uninstall|check for updates|update checker|scheduler|troubleshoot|reset preferences|\bservice\b|user process|co-authoring|decoder config|about java)/i;
  function installed() {
    var seen = {}, out = [];
    var src = real() ? FG.devices.reduce(function (a, d) { return a.concat(Array.isArray(d.apps) ? d.apps.map(function (x) { return [x.exe, x.name]; }) : []); }, []) : [];
    src.forEach(function (x) {
      if (!x[0] || seen[x[0]] || JUNK_EXE.test(x[0]) || JUNK_NAME.test(x[1] || '')) return;
      seen[x[0]] = 1; out.push({ id: x[0], n: String(x[1] || x[0]).replace(/^Запустить\s+/, '') });
    });
    return out.sort(function (a, b) { return a.n.toLowerCase() < b.n.toLowerCase() ? -1 : 1; });
  }
  function labelOf(app) {
    if (app && app.indexOf('cat:') === 0) { var ci = catInfo(app.slice(4)); return ci[1] + ' ' + T(ci[2]); }
    var ins = installed().filter(function (a) { return a.id === app; })[0]; var r = (cfg().rules || []).concat(cfg().focusApps || []).filter(function (x) { return x.app === app && x.label; })[0]; if (r) return r.label; var k = knownApps().filter(function (a) { return a.id === app; })[0]; if (k) return k.n; if (ins) return ins.n; for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === app) return SITES[i][1]; return app.replace(/^site:/, '').replace(/\.exe$/, ''); }

  // ---------- Server ----------
  // 30 kunlik foydalanish — sahifalab (server bir so'rovda 1000 qatordan ko'p bermaydi)
  async function loadUsage(since) {
    var out = [], step = 1000;
    for (var i = 0; i < 20; i++) {
      var r = await supabase.from('fg_usage').select('device_id,day,app,label,seconds,hours,opens,open_hours').gte('day', since).order('day', { ascending: false }).order('app', { ascending: true }).order('device_id', { ascending: true }).range(i * step, i * step + step - 1);
      if (r.error) {
        // Eski sxema (opens ustuni hali yo'q) — oddiy so'rov
        if (i === 0) { var r2 = await supabase.from('fg_usage').select('device_id,day,app,label,seconds,hours').gte('day', dayStr(-7)).limit(5000); return { data: (r2 && r2.data) || [] }; }
        break;
      }
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < step) break;
    }
    return { data: out };
  }
  async function load(force) {
    if (!sbOk()) { FG.loaded = true; FG.devices = []; return; }
    if (FG.loading || (!force && Date.now() - FG.at < 20000)) return;
    FG.loading = true; FG.err = '';
    try {
      var since = dayStr(-(HIST_DAYS - 1));
      var res = await Promise.all([
        supabase.from('fg_devices').select('id,name,label,kind,parent_id,link_src,last_seen,agent_version,created_at,apps,apps_at').order('created_at', { ascending: true }),
        supabase.from('fg_config').select('config').maybeSingle(),
        loadUsage(since),
        supabase.from('fg_events').select('kind,app,label,reason,at,device_id').gte('at', new Date(Date.now() - 8 * 864e5).toISOString()).order('at', { ascending: false }).limit(500)
      ]);
      FG.events = (res[3] && res[3].data) || [];
      if (res[0].error) throw res[0].error;
      FG.devices = res[0].data || [];
      var c = res[1] && res[1].data && res[1].data.config;
      // Yaqinda saqlangan bo'lsa — serverdan kelgan (eskirgan bo'lishi mumkin) nusxa ustiga yozilmaydi
      if (!FG.cfg || Date.now() - (FG.dirtyAt || 0) > 10000) FG.cfg = Object.assign({ track: true, notif: true, strict: false, rules: [], focusApps: [], focusUntil: 0 }, c || {});
      setTimeout(function () { try { strictTick(); } catch (e) {} }, 0);
      (FG.cfg.rules || []).forEach(function (r, i) { if (!r.id) r.id = 'r' + Date.now().toString(36) + i; });
      try { if (FG.devices.length && FG.cfg.lang !== getLang()) setTimeout(saveCfg, 0); } catch (e) {}
      FG.rows = (res[2] && res[2].data) || []; _dmCache = {};
      try { var tgr = await supabase.from('telegram_links').select('enabled,prefs').maybeSingle(); FG.tg = tgr && tgr.data ? tgr.data : null; } catch (e) { FG.tg = null; }
      try { badgeFlags(); } catch (e) {}
      FG.at = Date.now();
      try { checkReward(); } catch (e) {}
      try { rewardSync(); } catch (e) { console.warn('[fg rewards]', e); }
    } catch (e) { FG.err = (e && e.message) || String(e); }
    FG.loading = false; FG.loaded = true;
    rerender();
  }
  var _saveT = 0;
  function saveCfg() {
    if (!real()) return;
    try { FG.cfg.lang = getLang(); } catch (e) {} // Windows agenti va kengaytma shu tilda yozadi
    // Katalogdagi saytlar kategoriyasi: qoidada ishlatilgan saytlar uchun cfg.cats ga (foydalanuvchi tanlovi ustidan yozilmaydi)
    try {
      var cc = FG.cfg.cats || (FG.cfg.cats = {});
      (FG.cfg.rules || []).concat(FG.cfg.focusApps || []).forEach(function (r) { if (r && r.app && SITE_CAT_OF[r.app] && !cc[r.app]) cc[r.app] = SITE_CAT_OF[r.app]; });
      if ((FG.cfg.rules || []).concat(FG.cfg.focusApps || []).some(function (r) { return r && /^cat:/.test(r.app || ''); }))
        Object.keys(SITE_CAT_OF).forEach(function (k) { if (!cc[k]) cc[k] = SITE_CAT_OF[k]; });
    } catch (e) {}
    FG.dirtyAt = Date.now(); FG.cfgAt = Date.now(); _dmCache = {};
    clearTimeout(_saveT);
    _saveT = setTimeout(async function () {
      try {
        var r = await supabase.from('fg_config').upsert({ user_id: S.cloudUserId, config: FG.cfg, updated_at: new Date().toISOString() });
        if (r.error) throw r.error;
        FG.dirtyAt = Date.now();
        try { badgeFlags(); } catch (e) {}
      } catch (e) { try { toast('⚠️ Focusgate: ' + L('saqlab bo\'lmadi', 'could not save', 'не удалось сохранить')); } catch (e2) {} }
    }, 350);
  }

  // 🏅 Yutuqlar uchun belgilar (script.js → getSpecialBadges / getBadgeGroups)
  function badgeFlags() {
    var st = fgS(), ch = false, c = FG.cfg || {};
    var set = function (k, v) { if (v && !st[k]) { st[k] = true; ch = true; } };
    set('pc', FG.devices.some(function (d) { return !/^(ext|android)-/.test(d.agent_version || ''); }));
    set('ext', FG.devices.some(function (d) { return /^ext-/.test(d.agent_version || ''); }));
    set('tg', !!(FG.tg && FG.tg.enabled));
    set('strictUsed', !!c.strict);
    set('catRule', (c.rules || []).some(function (r) { return r.on && String(r.app).indexOf('cat:') === 0; }));
    if (ch) { save(); try { if (typeof renderBadges === 'function') renderBadges(); } catch (e) {} }
  }

  // 🪙 Kecha barcha kunlik limitlarda qolgan bo'lsa +10 tanga (kuniga bir marta)
  function checkReward() {
    if (!real() || !LOCAL.reward) return;
    var y = dayStr(-1);
    if (!S.focusgate) S.focusgate = {};
    if (S.focusgate.rewarded === y) return;
    var daily = (FG.cfg.rules || []).filter(function (r) { return r.on && r.kind === 'daily' && r.minutes > 0; });
    var any = FG.rows.some(function (r) { return r.day === y; });
    if (!daily.length || !any) return;
    var ok = daily.every(function (r) { var m = ruleMin(r, -1); return !m || usedMin(r.app, -1) < m; });
    S.focusgate.rewarded = y;
    if (ok) {
      S.focusgate.goodDays = (S.focusgate.goodDays || 0) + 1;
      S.coins = (S.coins || 0) + 10;
      try { addTarixLog('in', '🛡 Focusgate: ' + L('kecha barcha limitlarda qoldingiz', 'stayed within all limits yesterday', 'вчера в пределах лимитов'), 10, 'fg-reward'); } catch (e) {}
      try { toast('🛡 +10 🪙 — ' + L('kecha barcha limitlarda qoldingiz!', 'you stayed within all limits yesterday!', 'вчера вы уложились во все лимиты!')); } catch (e) {}
    }
    save();
    try { if (typeof render === 'function') render(); } catch (e) {}
  }

  // ---------- Kichik yordamchilar ----------
  function fmt(m) {
    m = Math.max(0, Math.round(m * 60) / 60);
    var h = Math.floor(m / 60), mm = Math.round(m % 60);
    if (m < 1) return Math.round(m * 60) + ' ' + L('s', 's', 'с');
    if (!h) return mm + ' ' + L('daq', 'min', 'мин');
    if (mm === 60) { h++; mm = 0; }
    return h + ' ' + L('soat', 'h', 'ч') + (mm ? ' ' + mm + ' ' + L('daq', 'min', 'мин') : '');
  }
  function tile(a, sz) {
    if (a.id && a.id.indexOf('cat:') === 0) { var ci = catInfo(a.id.slice(4)); return '<span class="fg-tile cat' + (sz ? ' ' + sz : '') + '" style="--tc:' + ci[3] + '">' + ci[1] + '</span>'; }
    // Saytlar: o'rnatilgan brend ikonka → favikon; dasturlar: agent yuborgan ikonka → brend ikonka → favikon; bo'lmasa harf
    var bi = a.id ? brandOf(a.id) : null, d = a.id && a.id.indexOf('site:') !== 0 && real() ? devApp(a.id) : null;
    if (bi && !(d && d.icon)) {
      var hx = bi[0], lum = (parseInt(hx.slice(0, 2), 16) * 299 + parseInt(hx.slice(2, 4), 16) * 587 + parseInt(hx.slice(4, 6), 16) * 114) / 255000;
      return '<span class="fg-tile brand' + (sz ? ' ' + sz : '') + '" style="--tc:#' + hx + ';--tf:' + (lum > 0.72 ? '#111' : '#fff') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + bi[1] + '"/></svg></span>';
    }
    var ic = a.id ? iconOf(a.id) : '';
    return '<span class="fg-tile' + (ic ? ' img' : ' ltr') + (sz ? ' ' + sz : '') + '" style="--tc:' + a.c + '">' + E((a.n || '?').charAt(0).toUpperCase()) +
      (ic ? '<img src="' + E(ic) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'img\');this.parentNode.classList.add(\'ltr\');this.remove()">' : '') + '</span>';
  }
  function tileFor(app, sz) { return tile({ id: app, n: labelOf(app), c: color(app) }, sz); }
  function sw(on, attrs, dis) { return '<button type="button" class="fg-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" ' + attrs + (dis ? ' disabled' : '') + '><i></i></button>'; }
  function ago(ts) {
    if (!ts) return L('hali ulanmagan', 'never synced', 'ещё не синхр.');
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 120) return L('hozir onlayn', 'online now', 'сейчас онлайн');
    if (s < 3600) return Math.round(s / 60) + ' ' + L('daq oldin', 'min ago', 'мин назад');
    if (s < 86400) return Math.round(s / 3600) + ' ' + L('soat oldin', 'h ago', 'ч назад');
    return Math.round(s / 86400) + ' ' + L('kun oldin', 'd ago', 'дн. назад');
  }
  function online() { return FG.devices.some(devOn); }
  // Kompyuterlar bo'lsa — faqat ularning holati (kengaytma onlayn bo'lsa ham kompyuter oflayn bo'lishi mumkin)
  function liveState() {
    var pcs = FG.devices.filter(function (d) { return devKind(d) === 'pc'; });
    if (pcs.length) return pcs.some(devOn) ? 'on' : 'pcoff';
    return online() ? 'on' : 'off';
  }
  var DAYS = function () { return L('Du Se Ch Pa Ju Sh Ya', 'Mo Tu We Th Fr Sa Su', 'Пн Вт Ср Чт Пт Сб Вс').split(' '); };
  function ruleDesc(r) {
    if (r.kind === 'always') return L('Doimiy blok', 'Always blocked', 'Всегда заблокировано');
    if (r.kind === 'session') return L('Har ochilishda', 'Per launch', 'За запуск') + ' ' + fmt(r.minutes);
    if (r.kind === 'schedule') {
      var d = r.days && r.days.length && r.days.length < 7 ? r.days.map(function (x) { return DAYS()[x - 1]; }).join(', ') : L('Har kuni', 'Every day', 'Каждый день');
      return d + ' · ' + (r.from || '00:00') + '–' + (r.to || '00:00');
    }
    return '';
  }
  function demoNote() {
    return '<div class="fg-demo fg-nodev">💻 ' + E(L('Hali hech qanday qurilma ulanmagan — shuning uchun statistika bo\'sh. Kompyuterga Focusgate.exe ni yoki brauzerga kengaytmani o\'rnating: haqiqiy vaqtlaringiz shu yerda paydo bo\'ladi.', 'No device is connected yet, so there are no stats. Install Focusgate.exe on your computer or the browser extension — your real time will show up here.', 'Ни одно устройство не подключено, поэтому статистики нет. Установите Focusgate.exe на компьютер или расширение в браузер — здесь появится ваше реальное время.')) + '</div>';
  }

  // ---------- Shapka ----------
  var SHIELD = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5 4.5 5.4v6.1c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10V5.4L12 2.5Z" fill="rgba(255,255,255,.22)" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.6 12.2 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function hero() {
    var dm = dayModel(0), total = dm.apps.reduce(function (s, a) { return s + a.m; }, 0), c = cfg();
    var daily = (c.rules || []).filter(function (r) { return r.on && r.kind === 'daily'; });
    var over = daily.filter(function (r) { var m = ruleMin(r, 0); return m > 0 && usedMin(r.app, 0) >= m; }).length;
    var active = (c.rules || []).filter(function (r) { return r.on; }).length;
    var live = real() ? (pauseLeft() > 0 ? [' warn', '⏸ ' + L('Pauza', 'Paused', 'Пауза')] : (c.modes || []).some(modeOnNow) ? ['', '🎭 ' + (c.modes || []).filter(modeOnNow).map(function (m) { return m.name; }).join(', ')] : liveState() === 'on' ? ['', L('Kuzatuv faol', 'Tracking on', 'Отслеживание вкл.')] : liveState() === 'pcoff' ? [' warn', L('Kompyuter oflayn', 'Computer offline', 'Компьютер офлайн')] : [' warn', L('Qurilmalar oflayn', 'Devices offline', 'Устройства офлайн')]) : [' off', L('Kompyuter ulanmagan', 'No computer connected', 'Компьютер не подключён')];
    return '<div class="fg-hero">' +
      '<div class="fg-hero-l"><div class="fg-brand"><span class="fg-logo">' + SHIELD + '</span><div><b>Focusgate</b><span>' + E(L('Ilova va sayt blokeri', 'App & site blocker', 'Блокировщик приложений')) + '</span></div></div>' +
      '<span class="fg-live' + live[0] + '"><i></i>' + E(live[1]) + '</span></div>' +
      '<div class="fg-kpis">' +
      '<div><b>' + E(fmt(total)) + '</b><span>⏱ ' + E(L('Bugun ekranda', 'Screen time today', 'Экран сегодня')) + '</span></div>' +
      '<div><b>' + active + '</b><span>🔒 ' + E(L('Faol limit', 'Active limits', 'Активные лимиты')) + '</span></div>' +
      '<div class="' + (over ? 'warn' : 'ok') + '"><b>' + (over ? over : '✓') + '</b><span>' + (over ? '⚠️ ' + E(L('Limit oshdi', 'Over limit', 'Превышено')) : '🌿 ' + E(L('Limitdasiz', 'Within limits', 'В пределах'))) + '</span></div>' +
      '</div></div>';
  }
  // 🔢 Kod bilan ulash — brauzer o'zi ochilmasa (Focusgate bildirishnomasidagi / tray menyusidagi kod)
  function codeFormHtml() {
    return '<div class="fg-codeform"><span>🔢 ' + E(L('Brauzer ochilmadimi? Focusgate ko\'rsatgan kodni yozing:', 'Browser didn\'t open? Type the code Focusgate shows:', 'Браузер не открылся? Введите код из Focusgate:')) + '</span>' +
      '<div class="fg-codeform-r"><input class="fg-in" data-fg-codein maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EF23">' +
      '<button type="button" class="fg-btn" data-fg-codego>' + E(L('Ulash', 'Connect', 'Подключить')) + '</button></div></div>';
  }
  function codeGo(btn) {
    var box = btn.closest('.fg-codeform'), inp = box && box.querySelector('[data-fg-codein]');
    var v = String(inp && inp.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z2-9]{8}$/.test(v)) { toast('⚠️ ' + L('Kod 8 belgidan iborat: ABCD-EF23', 'The code has 8 characters: ABCD-EF23', 'Код из 8 символов: ABCD-EF23')); if (inp) inp.focus(); return; }
    _pairWait = 0; closeSheet();
    location.hash = '#fgpair=' + v.slice(0, 4) + '-' + v.slice(4);
  }
  function connectCard() {
    if (real()) return '';
    if (!DOWNLOADS_ON) return soonCard();
    var signed = sbOk();
    return '<div class="fg-card fg-connect"><div class="fg-connect-h"><span>💻</span><div><b>' + E(L('Kompyuteringizni ulang', 'Connect your computer', 'Подключите компьютер')) + '</b><small>' + E(L('Windows 10/11 · bepul · 7 MB · v' + AGENT_VERSION, 'Windows 10/11 · free · 7 MB · v' + AGENT_VERSION, 'Windows 10/11 · бесплатно · 7 МБ · v' + AGENT_VERSION)) + '</small></div></div>' +
      '<ol class="fg-steps">' +
      '<li><b>' + E(L('Focusgate.exe ni yuklab oling', 'Download Focusgate.exe', 'Скачайте Focusgate.exe')) + '</b></li>' +
      '<li><b>' + E(L('Ishga tushiring', 'Run it', 'Запустите')) + '</b><small>' + E(L('Windows "Kompyuteringiz himoyalandi" desa: "Подробнее / More info" → "Run anyway".', 'If Windows says "Windows protected your PC": More info → Run anyway.', 'Если Windows пишет «Система защитила ваш ПК»: «Подробнее» → «Выполнить в любом случае».')) + '</small></li>' +
      '<li><b>' + E(L('Brauzer o\'zi ochiladi — "Ulash" ni bosing', 'Your browser opens — press "Connect"', 'Откроется браузер — нажмите «Подключить»')) + '</b>' + (signed ? '' : '<small class="red">' + E(L('Avval LevelUpDay akkauntingizga kiring (Profil → Sozlamalar).', 'Sign in to your LevelUpDay account first (Profile → Settings).', 'Сначала войдите в аккаунт LevelUpDay (Профиль → Настройки).')) + '</small>') + '</li></ol>' +
      '<a class="fg-btn big fg-dl" href="' + DOWNLOAD_URL + '" download="Focusgate.exe" rel="noopener">⬇ ' + E(L('Windows uchun yuklab olish', 'Download for Windows', 'Скачать для Windows')) + '</a>' + (signed ? codeFormHtml() : '') + '</div>';
  }
  function nav() {
    var tabs = [['today', '📊', ['Bugun', 'Today', 'Сегодня']], ['limits', '⏳', ['Limitlar', 'Limits', 'Лимиты']], ['block', '🚫', ['Bloklash', 'Block', 'Блокировка']], ['compete', '🏆', ['Reyting', 'Compete', 'Рейтинг']], ['settings', '⚙️', ['Sozlamalar', 'Settings', 'Настройки']]];
    return '<div class="fg-nav" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (UI.tab === t[0]) + '" class="' + (UI.tab === t[0] ? 'on' : '') + '" data-fg-tab="' + t[0] + '"><span>' + t[1] + '</span>' + E(T(t[2])) + '</button>';
    }).join('') + '</div>';
  }

  // ---------- 📊 Bugun ----------
  function dayLabel(off) {
    if (off === 0) return L('Bugun', 'Today', 'Сегодня');
    if (off === -1) return L('Kecha', 'Yesterday', 'Вчера');
    var d = new Date(); d.setDate(d.getDate() + off);
    var mo = L('yan fev mar apr may iyn iyl avg sen okt noy dek', 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec', 'янв фев мар апр мая июн июл авг сен окт ноя дек').split(' ');
    return d.getDate() + ' ' + mo[d.getMonth()] + ', ' + DAYS()[(d.getDay() + 6) % 7];
  }
  function sumArr(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function fmtN(n) { return Math.round(n) + ' ' + L('marta', 'times', 'раз'); }
  function metricVal(a) { return UI.metric === 'opens' ? (a.o || 0) : a.m; }
  function metricFmt(v) { return UI.metric === 'opens' ? fmtN(v) : fmt(v); }

  // 🧭 Sozlash bosqichlari: akkaunt → kompyuter (Focusgate.exe) → brauzer kengaytmasi
  function setupSteps() {
    var pc = FG.devices.some(function (d) { return devKind(d) === 'pc'; }), ext = FG.devices.some(function (d) { return devKind(d) === 'ext'; });
    return [
      ['acc', sbOk(), '🔐', ['Akkauntga kiring', 'Sign in to your account', 'Войдите в аккаунт'], ['Profil → Sozlamalar → Kirish', 'Profile → Settings → Sign in', 'Профиль → Настройки → Вход']],
      ['pc', pc, '💻', ['Kompyuterga Focusgate.exe', 'Focusgate.exe on your computer', 'Focusgate.exe на компьютер'], ['Dasturlarni kuzatadi va bloklaydi', 'Tracks and blocks programs', 'Отслеживает и блокирует программы']],
      ['ext', ext, '🧩', ['Brauzer kengaytmasi', 'Browser extension', 'Расширение браузера'], ['Saytlar, Shorts va Reels', 'Sites, Shorts and Reels', 'Сайты, Shorts и Reels']]
    ];
  }
  function setupCard() {
    if (!DOWNLOADS_ON) return '';
    var st = setupSteps(), done = st.filter(function (x) { return x[1]; }).length;
    if (done === st.length) return '';
    var h = '<div class="fg-card fg-setup' + (UI.setupOpen ? ' open' : '') + '"><button type="button" class="fg-setup-h" data-fg-setup><b>' + E(L('Focusgate\'ni sozlashni yakunlang', 'Complete Focusgate setup', 'Завершите настройку Focusgate')) + ' (' + done + '/' + st.length + ')</b>' +
      '<span class="fg-setup-bar"><i style="width:' + (done / st.length * 100) + '%"></i></span><em>' + E(UI.setupOpen ? L('Yashirish', 'Hide', 'Скрыть') : L('Ko\'rsatish', 'Show', 'Показать')) + ' <span class="fg-chev">⌄</span></em></button>';
    if (UI.setupOpen) h += '<div class="fg-setup-l">' + st.map(function (x) {
      return '<button type="button" class="fg-setup-s' + (x[1] ? ' ok' : '') + '" data-fg-setupstep="' + x[0] + '"' + (x[1] ? ' disabled' : '') + '><span>' + (x[1] ? '✅' : x[2]) + '</span><span class="fg-setup-n"><b>' + E(T(x[3])) + '</b><small>' + E(T(x[4])) + '</small></span>' + (x[1] ? '' : '<i>›</i>') + '</button>';
    }).join('') + '</div>';
    return h + '</div>';
  }
  function setupGo(k) {
    if (k === 'acc') { try { if (typeof showTab === 'function') showTab('profile'); } catch (e) {} try { toast('🔐 ' + L('Profil → Sozlamalar → Kirish', 'Profile → Settings → Sign in', 'Профиль → Настройки → Вход')); } catch (e) {} return; }
    if (k === 'pc') { needConnect(); return; }
    if (k === 'ext') openExtInstall();
  }

  // 🔍 Focusgate ichida qidiruv: ilova yoki sayt → bugungi vaqt, limit, bosilsa — batafsil
  function searchHtml() {
    return '<div class="fg-search"><input class="fg-in" data-fg-search type="search" autocomplete="off" placeholder="🔍 ' + E(L('Focusgate\'da qidirish: ilova yoki sayt…', 'Search Focusgate: app or site…', 'Поиск в Focusgate: приложение или сайт…')) + '"><div class="fg-search-r" hidden></div></div>';
  }
  function searchRun(inp) {
    var box = inp.parentNode.querySelector('.fg-search-r'), q = inp.value.trim().toLowerCase();
    if (!q) { box.hidden = true; box.innerHTML = ''; return; }
    var seen = {}, items = [], today = {}, rules = cfg().rules || [];
    dayModel(0).apps.forEach(function (a) { today[a.id] = a.m; });
    function add(id, n) { if (!id || seen[id] || isSec(id)) return; var hay = (n + ' ' + id + ' ' + (DOMAIN[id] || '')).toLowerCase(); if (hay.indexOf(q) === -1) return; seen[id] = 1; items.push([id, n]); }
    knownApps().forEach(function (a) { add(a.id, a.n); });
    installed().forEach(function (a) { add(a.id, a.n); });
    SITES.forEach(function (x) { add(x[0], x[1]); });
    var site = siteFromInput(q); if (site) add(site.app, site.label);
    items.sort(function (a, b) { return (today[b[0]] || 0) - (today[a[0]] || 0); });
    box.innerHTML = items.length ? items.slice(0, 8).map(function (x) {
      var r = rules.filter(function (y) { return y.app === x[0] && y.on; })[0];
      return '<button type="button" class="fg-all-r" data-fg-appopen="' + E(x[0]) + '">' + tileFor(x[0], 'sm') + '<span class="fg-all-n"><b>' + E(x[1]) + '</b><small>' + E(niceExe(x[0]) === x[0] ? x[0] : (DOMAIN[x[0]] || niceExe(x[0]))) + '</small></span>' +
        (r ? '<em class="fg-tag' + (r.kind === 'always' ? ' red' : '') + '">' + E(ruleTag(r)) + '</em>' : '') + '<span class="fg-all-t">' + (today[x[0]] ? E(fmt(today[x[0]])) : '') + '</span><i>›</i></button>';
    }).join('') : '<div class="fg-empty sm">' + E(L('Topilmadi', 'Nothing found', 'Ничего не найдено')) + '</div>';
    box.hidden = false;
  }
  function ruleTag(r) { return r.kind === 'daily' ? '⏳ ' + fmt(ruleMin(r, 0)) : r.kind === 'always' ? '🚫' : r.kind === 'schedule' ? '🗓' : '⏲ ' + fmt(r.minutes || 0); }

  // 🎛 Filtrlar qatori: sana (kalendar) · qurilma · o'lchov · turi · kategoriya · tozalash
  function filterBar(dm) {
    if (UI.dev !== 'all' && !statDevs().some(function (d) { return d.id === UI.dev; })) UI.dev = 'all';
    var dirty = UI.day !== 0 || UI.dev !== 'all' || UI.metric !== 'time' || UI.kind !== 'all' || UI.cat !== 'all';
    var opt = function (v, cur, label) { return '<option value="' + E(v) + '"' + (v === cur ? ' selected' : '') + '>' + E(label) + '</option>'; };
    var h = '';
    if (dirty) h += '<button type="button" class="fg-reset" data-fg-reset>' + E(L('Filtrlarni tozalash', 'Reset filters', 'Сбросить фильтры')) + ' ✕</button>';
    h += '<div class="fg-filters"><div class="fg-day fg-date"><button type="button" data-fg-day="-1" ' + (UI.day <= -(HIST_DAYS - 1) ? 'disabled' : '') + ' aria-label="‹">‹</button>' +
      '<label class="fg-date-l">📅 <b>' + E(dayLabel(UI.day)) + '</b><input type="date" data-fg-date min="' + dayStr(-(HIST_DAYS - 1)) + '" max="' + dayStr(0) + '" value="' + dayStr(UI.day) + '"></label>' +
      '<button type="button" data-fg-day="1" ' + (UI.day >= 0 ? 'disabled' : '') + ' aria-label="›">›</button></div>';
    if (real() && statDevs().length > 1) {
      var all = sumArr(dayModel(UI.day, 'all').apps.map(function (a) { return a.m; }));
      h += '<select class="fg-sel" data-fg-fdev>' + opt('all', UI.dev, '🌐 ' + L('Barcha qurilmalar', 'All devices', 'Все устройства') + ' · ' + fmt(all)) + statDevs().map(function (d, i) {
        return opt(d.id, UI.dev, devIcon(d) + ' ' + (i + 1) + ' · ' + devName(d) + ' · ' + fmt(sumArr(dayModel(UI.day, d.id).apps.map(function (a) { return a.m; }))));
      }).join('') + '</select>';
    }
    h += '<select class="fg-sel" data-fg-fmetric>' + opt('time', UI.metric, '⏱ ' + L('Foydalanish vaqti', 'Usage time', 'Время использования')) + opt('opens', UI.metric, '🔁 ' + L('Ochilishlar soni', 'Session count', 'Число запусков')) + '</select>';
    h += '<select class="fg-sel" data-fg-fkind>' + opt('all', UI.kind, L('Ilova va saytlar', 'Apps and websites', 'Приложения и сайты')) + opt('apps', UI.kind, '💻 ' + L('Ilovalar', 'Apps', 'Приложения')) + opt('sites', UI.kind, '🌐 ' + L('Saytlar', 'Websites', 'Сайты')) + '</select>';
    h += '<select class="fg-sel" data-fg-fcat>' + opt('all', UI.cat, '🗂 ' + L('Barcha kategoriyalar', 'All categories', 'Все категории')) + CAT_LIST.map(function (c) { return opt(c[0], UI.cat, c[1] + ' ' + T(c[2])); }).join('') + '</select>';
    return h + '</div>';
  }

  // 📈 Taqqoslash: kecha shu vaqtgacha va 7 kunlik o'rtacha bilan
  function compareHtml(dm) {
    if (!real()) return '';
    var ser = UI.metric === 'opens' ? function (m) { return m.oh; } : function (m) { return m.hours; };
    var upto = UI.day === 0 ? new Date().getHours() + 1 : 24;
    var cur = sumArr(ser(dm).slice(0, upto)), prev = sumArr(ser(dayModel(UI.day - 1, UI.dev)).slice(0, upto));
    var avgs = []; for (var i = 1; i <= 7; i++) { var v = sumArr(ser(dayModel(UI.day - i, UI.dev)).slice(0, upto)); if (v > 0) avgs.push(v); }
    var avg = avgs.length ? sumArr(avgs) / avgs.length : 0;
    function chip(base, label) {
      if (!base || !cur) return '';
      var pct = Math.round((cur - base) / base * 100), up = pct > 0;
      return '<span class="fg-cmp ' + (pct === 0 ? '' : up ? 'up' : 'down') + '" title="' + E(metricFmt(base)) + '">' + (pct === 0 ? '＝' : up ? '▲ ' : '▼ ') + (pct ? Math.abs(pct) + '%' : '') + ' <small>' + E(label) + '</small></span>';
    }
    var a = chip(prev, UI.day === 0 ? L('kechagi shu vaqtga nisbatan', 'vs yesterday by now', 'к вчера на это время') : L('oldingi kunga', 'vs previous day', 'к предыдущему дню'));
    var b = chip(avg, L('7 kunlik o\'rtachaga', 'vs 7-day average', 'к среднему за 7 дней'));
    return a || b ? '<div class="fg-cmps">' + a + b + '</div>' : '';
  }

  // Silliq egri chiziq (Catmull-Rom → Bezier) — 0..100 koordinatalarda
  function smoothPath(pts) {
    if (!pts.length) return '';
    var d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(100, p1[1] + (p2[1] - p0[1]) / 6)], c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(100, p2[1] - (p3[1] - p1[1]) / 6)];
      d += ' C' + c1[0].toFixed(2) + ',' + c1[1].toFixed(2) + ' ' + c2[0].toFixed(2) + ',' + c2[1].toFixed(2) + ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
    }
    return d;
  }
  function niceMax(v) {
    if (UI.metric === 'opens') { var st = [1, 2, 5, 10, 20, 50, 100, 200, 500]; for (var i = 0; i < st.length; i++) if (v <= st[i]) return st[i]; return Math.ceil(v / 100) * 100; }
    var mm = [5, 10, 15, 20, 30, 45, 60]; for (var j = 0; j < mm.length; j++) if (v <= mm[j]) return mm[j]; return Math.ceil(v / 60) * 60;
  }
  function hourLbl(i) { return String(i).padStart(2, '0') + ':00'; }
  function chartCard(dm) {
    var opens = UI.metric === 'opens', A = opens ? dm.ohA : dm.hA, B = opens ? dm.ohS : dm.hS;
    if (UI.kind === 'apps') B = B.map(function () { return 0; });
    if (UI.kind === 'sites') A = A.map(function () { return 0; });
    var showA = !UI.hide.a, showB = !UI.hide.b;
    var tot = A.map(function (v, i) { return (showA ? v : 0) + (showB ? B[i] : 0); });
    var peak = Math.max.apply(null, (UI.chart === 'line' ? A.concat(B) : tot).concat([opens ? 1 : 0.0001]));
    var ymax = niceMax(peak);
    var h = '<div class="fg-card fg-chart-card"><div class="fg-card-h"><b>' + E(opens ? L('Ochilishlar soatlar bo\'yicha', 'Sessions by hour', 'Запуски по часам') : L('Soatlar bo\'yicha', 'By hour', 'По часам')) + '</b>' +
      '<div class="fg-seg"><button type="button" class="' + (UI.chart === 'bar' ? 'on' : '') + '" data-fg-chart="bar" aria-label="bar">▮▮</button><button type="button" class="' + (UI.chart === 'line' ? 'on' : '') + '" data-fg-chart="line" aria-label="line">〰</button></div></div>' + compareHtml(dm);
    var ylab = opens ? String(ymax) : (ymax >= 60 ? (ymax / 60) + L('s', 'h', 'ч') : ymax + L('d', 'm', 'м'));
    h += '<div class="fg-plot"><span class="fg-ymax">' + E(ylab) + '</span>';
    if (UI.chart === 'bar') {
      h += '<div class="fg-chart">' + tot.map(function (v, i) {
        var pct = v / ymax * 100, lbl = opens ? (v >= 1 ? Math.round(v) : '') : (v >= 1 ? Math.round(v) + (v >= 60 ? '' : '') : v >= 0.05 ? '<1' : '');
        var av = showA ? A[i] : 0, bv = showB ? B[i] : 0;
        return '<button type="button" class="fg-col' + (v >= (opens ? 1 : 0.05) ? '' : ' z') + (UI.hr === i ? ' sel' : '') + '" data-fg-hr="' + i + '" title="' + hourLbl(i) + ' — ' + E(metricFmt(v)) + '"><em>' + lbl + '</em>' +
          (v > 0 ? '<span class="fg-stk" style="height:' + Math.max(pct, 3).toFixed(1) + '%">' + (bv > 0 ? '<i class="b" style="flex-grow:' + bv.toFixed(3) + '"></i>' : '') + (av > 0 ? '<i style="flex-grow:' + av.toFixed(3) + '"></i>' : '') + '</span>' : '') + '<span>' + (i % 3 === 0 ? i : '') + '</span></button>';
      }).join('') + '</div>';
    } else {
      var toPts = function (arr) { return arr.map(function (v, i) { return [i / 23 * 100, 100 - Math.min(1, v / ymax) * 92]; }); };
      var pa = toPts(A), pb = toPts(B), pathA = smoothPath(pa), pathB = smoothPath(pb);
      h += '<div class="fg-line"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        (showB ? '<path class="ar b" d="' + pathB + ' L100,100 L0,100 Z"/><path class="ln b" d="' + pathB + '" vector-effect="non-scaling-stroke"/>' : '') +
        (showA ? '<path class="ar" d="' + pathA + ' L100,100 L0,100 Z"/><path class="ln" d="' + pathA + '" vector-effect="non-scaling-stroke"/>' : '') + '</svg>' +
        '<div class="fg-dots">' + pa.map(function (p, i) {
          return '<button type="button" class="fg-hit' + (UI.hr === i ? ' sel' : '') + '" data-fg-hr="' + i + '" style="left:' + p[0] + '%" title="' + hourLbl(i) + '">' +
            (showA && A[i] > 0 ? '<i style="top:' + p[1] + '%"></i>' : '') + (showB && B[i] > 0 ? '<i class="b" style="top:' + pb[i][1] + '%"></i>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="fg-line-x"><span>' + E(L('00:00', '12am', '00:00')) + '</span><span>' + E(L('Tush', 'Noon', 'Полдень')) + '</span><span>' + E(L('23:00', '11pm', '23:00')) + '</span></div></div>';
    }
    h += '</div>';
    if (UI.hr >= 0) h += '<div class="fg-tip">🕒 <b>' + hourLbl(UI.hr) + '–' + hourLbl((UI.hr + 1) % 24) + '</b> · <i class="a"></i>' + E(metricFmt(A[UI.hr])) + ' · <i class="b"></i>' + E(metricFmt(B[UI.hr])) + '</div>';
    // Legend: tur bo'yicha jami (bosilsa — yashirish/ko'rsatish), jami → haftalik hisobot
    var sa = sumArr(A), sb = sumArr(B);
    h += '<div class="fg-legend"><button type="button" class="fg-lg' + (showA ? '' : ' off') + '" data-fg-hide="a"><i class="a"></i><span>' + E(L('Ilovalar', 'Apps', 'Приложения')) + '<b>' + E(metricFmt(sa)) + '</b></span></button>' +
      '<button type="button" class="fg-lg' + (showB ? '' : ' off') + '" data-fg-hide="b"><i class="b"></i><span>' + E(L('Saytlar', 'Websites', 'Сайты')) + '<b>' + E(metricFmt(sb)) + '</b></span></button>' +
      '<button type="button" class="fg-eye" data-fg-eye aria-label="👁">' + (UI.hide.a || UI.hide.b ? '🙈' : '👁') + '</button>' +
      '<button type="button" class="fg-total" data-fg-weekly>' + E(L('Jami', 'Total', 'Всего')) + ': <b>' + E(metricFmt(sa + sb)) + '</b> →</button></div>';
    return h + '</div>';
  }

  // Ilova qatoridagi belgilar: limit, jadval, blok, sayt ichida bloklash, rejim, ongli ochish — bosilsa sozlamasiga o'tadi
  function appBadges(id) {
    var c = cfg(), out = '', rules = c.rules || [];
    rules.forEach(function (r, i) {
      if (!r.on || r.app !== id) return;
      var red = r.kind === 'daily' && ruleMin(r, UI.day) > 0 && usedMin(id, UI.day) >= ruleMin(r, UI.day);
      out += '<span class="fg-bdg' + (r.kind === 'always' || red ? ' red' : '') + '" data-fg-badge="rule" data-i="' + i + '">' + E(ruleTag(r)) + '</span>';
    });
    var ins = INSITE.filter(function (x) { return x[0] === id; })[0];
    if (ins && ins[3].some(function (x) { return (c.inSite || {})[x[0]]; })) out += '<span class="fg-bdg" data-fg-badge="insite" data-k="' + E(id) + '" title="' + E(L('Sayt ichida bloklash', 'In-site blocking', 'Блокировка внутри сайта')) + '">⋮⋮</span>';
    if ((c.modes || []).some(function (m) { return (m.apps || []).some(function (f) { return f.app === id; }); })) out += '<span class="fg-bdg" data-fg-badge="modes">🎭</span>';
    if ((c.mindful || []).some(function (f) { return f.on && f.app === id; })) out += '<span class="fg-bdg" data-fg-badge="mindful">🌬</span>';
    if ((c.focusApps || []).some(function (f) { return f.on && f.app === id; })) out += '<span class="fg-bdg" data-fg-badge="focus">🎯</span>';
    return out;
  }
  function badgeGo(b) {
    var k = b.dataset.fgBadge;
    if (k === 'rule') { openRuleSheet(+b.dataset.i); return; }
    UI.tab = k === 'insite' || k === 'modes' || k === 'mindful' || k === 'focus' ? 'block' : 'limits';
    if (k === 'insite') UI.openSite = b.dataset.k;
    render();
    setTimeout(function () { var el = document.querySelector('#view-blocker [data-anchor="' + k + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }

  // 🛡 Bloklash tarixi (fg_events): tanlangan kun
  var REASON = { daily: ['limit tugadi', 'limit reached', 'лимит исчерпан'], always: ['doimiy blok', 'always blocked', 'всегда заблокировано'], schedule: ['jadval', 'schedule', 'расписание'], focus: ['fokus', 'focus', 'фокус'], session: ['seans tugadi', 'session ended', 'сессия окончена'], mode: ['rejim', 'mode', 'режим'], allow: ['ruxsat etilmagan', 'not allowed', 'не разрешено'], mindful: ['«kerak emas»', '“not needed”', '«не нужно»'] };
  function evDay(e) { var d = new Date(e.at); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function evRow(e) {
    var d = new Date(e.at), dv = devById(e.device_id), warn = e.kind === 'warn';
    var why = warn ? (/^p\d+$/.test(e.reason || '') ? L('limitning ' + e.reason.slice(1) + '% i', e.reason.slice(1) + '% of limit', e.reason.slice(1) + '% лимита') : L('5 daq qoldi', '5 min left', 'осталось 5 мин')) : T(REASON[e.reason] || ['bloklandi', 'blocked', 'заблокировано']);
    return '<div class="fg-ev' + (warn ? ' warn' : '') + '"><span class="fg-ev-t">' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '</span>' + tileFor(e.app, 'sm') +
      '<span class="fg-ev-n"><b>' + E(e.label || labelOf(e.app)) + '</b><small>' + (warn ? '⏳ ' : '⛔ ') + E(why) + (dv ? ' · ' + devIcon(dv) + ' ' + E(devName(dv)) : '') + '</small></span></div>';
  }
  function historyCard() {
    if (!real()) return '';
    var d = dayStr(UI.day), list = (FG.events || []).filter(function (e) { return evDay(e) === d && inDev(e.device_id, UI.dev); });
    var blocks = list.filter(function (e) { return e.kind !== 'warn'; }).length;
    var h = '<div class="fg-card fg-hist"><div class="fg-card-h"><b>🛡 ' + E(L('Bloklash tarixi', 'Block history', 'История блокировок')) + '</b><small>' + E(dayLabel(UI.day)) + '</small></div>';
    if (!list.length) return h + '<div class="fg-empty sm">' + E(L('Bu kunda hech narsa bloklanmadi 🌿', 'Nothing was blocked on this day 🌿', 'В этот день ничего не блокировалось 🌿')) + '</div></div>';
    h += '<div class="fg-hist-k"><b>' + blocks + '</b> ' + E(L('marta bloklandi', 'blocks', 'блокировок')) + (list.length - blocks ? ' · <b>' + (list.length - blocks) + '</b> ' + E(L('ogohlantirish', 'warnings', 'предупреждений')) : '') + '</div>';
    h += list.slice(0, 5).map(evRow).join('');
    if (list.length > 5) h += '<button type="button" class="fg-add" data-fg-hist>' + E(L('Hammasini ko\'rish', 'See all', 'Показать все')) + ' (' + list.length + ') ›</button>';
    return h + '</div>';
  }
  function openHistory() {
    var by = {}; (FG.events || []).forEach(function (e) { (by[evDay(e)] = by[evDay(e)] || []).push(e); });
    var h = '<h3>🛡 ' + E(L('Bloklash tarixi · 7 kun', 'Block history · 7 days', 'История блокировок · 7 дней')) + '</h3>';
    var any = false;
    for (var i = 0; i >= -7; i--) { var k = dayStr(i); if (!by[k]) continue; any = true; h += '<div class="fg-rwh-day">' + E(dayLabel(i)) + ' · ' + by[k].length + '</div>' + by[k].map(evRow).join(''); }
    if (!any) h += '<div class="fg-empty">' + E(L('Hali hech narsa bloklanmagan', 'Nothing blocked yet', 'Пока ничего не блокировалось')) + '</div>';
    openSheet(h + '<div class="fg-acts"><button type="button" class="fg-btn" data-fg-close>' + E(L('Yopish', 'Close', 'Закрыть')) + '</button></div>');
  }

  // 📊 Haftalik hisobot (ilovada): shu hafta vs o'tgan hafta, kunlar, eng ko'p vaqt olganlar, bloklar
  function openWeekly() {
    var days = [], tw = 0, lw = 0, by = {};
    for (var i = -6; i <= 0; i++) { var m = dayModel(i); var t = sumArr(m.apps.map(function (a) { return a.m; })); days.push([i, t]); tw += t; m.apps.forEach(function (a) { by[a.id] = by[a.id] || { a: a, m: 0 }; by[a.id].m += a.m; }); }
    for (var j = -13; j <= -7; j++) lw += sumArr(dayModel(j).apps.map(function (a) { return a.m; }));
    var pct = lw ? Math.round((tw - lw) / lw * 100) : null, mx = Math.max.apply(null, days.map(function (x) { return x[1]; }).concat([0.0001]));
    var top = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.m - a.m; }).slice(0, 5);
    var used = days.filter(function (x) { return x[1] > 0; }), best = used.slice().sort(function (a, b) { return a[1] - b[1]; })[0];
    var blocks = (FG.events || []).filter(function (e) { return e.kind !== 'warn' && Date.now() - new Date(e.at).getTime() < 7 * 864e5; }).length;
    var h = '<h3>📊 ' + E(L('Haftalik hisobot', 'Weekly report', 'Недельный отчёт')) + '</h3>' +
      '<div class="fg-kpis in"><div><b>' + E(fmt(tw)) + '</b><span>' + E(L('7 kunda', '7 days', 'За 7 дней')) + '</span></div>' +
      '<div class="' + (pct == null ? '' : pct > 0 ? 'warn' : 'ok') + '"><b>' + (pct == null ? '—' : (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%') + '</b><span>' + E(L('O\'tgan haftaga', 'vs last week', 'к прошлой неделе')) + '</span></div>' +
      '<div><b>' + E(fmt(used.length ? tw / used.length : 0)) + '</b><span>' + E(L('Kuniga o\'rtacha', 'Daily average', 'В среднем за день')) + '</span></div></div>' +
      '<div class="fg-week">' + days.map(function (x) { var d = new Date(); d.setDate(d.getDate() + x[0]); return '<div class="' + (x[0] === 0 ? 'now' : '') + '" title="' + E(fmt(x[1])) + '"><i style="height:' + Math.max(x[1] ? 4 : 0, x[1] / mx * 100) + '%"></i><span>' + DAYS()[(d.getDay() + 6) % 7] + '</span></div>'; }).join('') + '</div>';
    if (best) h += '<div class="fg-note">🌿 ' + E(L('Eng yaxshi kun: ', 'Best day: ', 'Лучший день: ') + dayLabel(best[0]) + ' — ' + fmt(best[1])) + (blocks ? ' · 🛡 ' + E(L(blocks + ' marta bloklandi', blocks + ' blocks', 'блокировок: ' + blocks)) : '') + '</div>';
    if (top.length) h += '<div class="fg-lbl">🏆 ' + E(L('Eng ko\'p vaqt olganlar', 'Top time sinks', 'Больше всего времени')) + '</div><div class="fg-card fg-pkl">' + top.map(function (x) {
      return '<button type="button" class="fg-all-r" data-fg-appopen="' + E(x.a.id) + '">' + tile(x.a, 'sm') + '<span class="fg-all-n"><b>' + E(x.a.n) + '</b><small>' + E(L('kuniga ', '', '') + fmt(x.m / 7) + L('', ' / day', ' в день')) + '</small></span><span class="fg-all-t">' + E(fmt(x.m)) + '</span><i>›</i></button>';
    }).join('') + '</div>';
    var wk = FG.tg ? !(FG.tg.prefs && FG.tg.prefs.fgweekly === false) : false;
    h += '<div class="fg-hint">✈️ ' + E(FG.tg && FG.tg.enabled ? (wk ? L('Bu hisobot har yakshanba kechqurun Telegram\'ga ham yuboriladi.', 'This report is also sent to Telegram every Sunday evening.', 'Этот отчёт также приходит в Telegram каждое воскресенье вечером.') : L('Telegram\'ga haftalik hisobot o\'chirilgan (Sozlamalar).', 'Weekly Telegram report is off (Settings).', 'Недельный отчёт в Telegram выключен (Настройки).')) : L('Telegram ulansa, hisobot har yakshanba kelib turadi: Profil → Sozlamalar → Telegram.', 'Connect Telegram to get it every Sunday: Profile → Settings → Telegram.', 'Подключите Telegram, чтобы получать отчёт по воскресеньям: Профиль → Настройки → Telegram.')) + '</div>';
    openSheet(h + '<div class="fg-acts"><button type="button" class="fg-btn" data-fg-close>' + E(L('Yopish', 'Close', 'Закрыть')) + '</button></div>');
  }

  function pageToday() {
    var dm = dayModel(UI.day, UI.dev), opens = UI.metric === 'opens';
    var list = dm.apps.filter(function (a) { return (UI.cat === 'all' || a.cat === UI.cat) && (UI.kind === 'all' || (UI.kind === 'sites') === !!a.site) && metricVal(a) > 0; });
    if (opens) list = list.slice().sort(function (a, b) { return (b.o || 0) - (a.o || 0); });
    var total = sumArr(list.map(metricVal)) || 1;
    var h = setupCard() + filterBar(dm) + catBar(dm.apps) + chartCard(dm);

    if (LOCAL.reward) h += '<div class="fg-reward"><span>🪙</span><div><b>' + E(L('Limitda qol — tanga ol', 'Stay within limits — earn coins', 'Не превышай лимиты — получай монеты')) + '</b><span>' + E(L('Kun davomida barcha kunlik limitlarda qolsangiz, ertasi kuni +10 🪙 olasiz. Fokus sessiyasi: har daqiqa = 1 XP.', 'Stay within every daily limit and get +10 🪙 the next day. Focus sessions: 1 XP per minute.', 'Уложитесь во все дневные лимиты — получите +10 🪙 на следующий день. Фокус: 1 XP за минуту.')) + '</span></div></div>';

    h += '<div class="fg-sec-t">' + E(L('Batafsil ko\'rish uchun ilovani bosing', 'Tap an app for details', 'Нажмите на приложение для деталей')) + '</div><div class="fg-list">';
    if (!list.length) h += '<div class="fg-empty">' + E(real() ? (opens && dm.apps.length ? L('Ochilishlar soni Focusgate v0.6 va kengaytma v0.6 dan boshlab hisoblanadi.', 'Session counts are recorded from Focusgate v0.6 and extension v0.6.', 'Число запусков считается с Focusgate v0.6 и расширения v0.6.') : L('Bu kun uchun ma\'lumot yo\'q. Focusgate kompyuterda ishlayotganiga ishonch hosil qiling.', 'No data for this day yet. Make sure Focusgate is running on your PC.', 'Нет данных за этот день. Проверьте, что Focusgate работает на ПК.')) : L('Statistika qurilma ulangach paydo bo\'ladi.', 'Stats appear once a device is connected.', 'Статистика появится после подключения устройства.')) + '</div>';
    list.forEach(function (a) {
      var v = metricVal(a);
      h += '<div class="fg-row fg-app" role="button" tabindex="0" data-fg-app="' + E(a.id) + '">' + tile(a) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(a.n) + '</b>' + appBadges(a.id) + '</span>' +
        '<span class="fg-prog"><i style="width:' + (v / total * 100).toFixed(1) + '%"></i></span></span>' +
        '<span class="fg-row-r"><b>' + E(metricFmt(v)) + '</b><small>' + (v / total * 100).toFixed(1) + '%' + (opens ? '' : (a.o ? ' · 🔁' + a.o : '')) + '</small></span></div>';
    });
    return h + '</div>' + historyCard() + allAppsBtn();
  }

  // 🗂 Kategoriyalar bo'yicha taqsimot (bosilsa — filtr)
  function catBar(apps) {
    var by = {}, total = 0;
    apps.forEach(function (a) { by[a.cat] = (by[a.cat] || 0) + a.m; total += a.m; });
    var cats = CAT_LIST.filter(function (c) { return by[c[0]] > 0; }).sort(function (a, b) { return by[b[0]] - by[a[0]]; });
    if (!total) return '';
    return '<div class="fg-card fg-cats"><div class="fg-catbar">' + cats.map(function (c) { return '<i style="width:' + (by[c[0]] / total * 100).toFixed(2) + '%;--cc:' + c[3] + '" title="' + E(T(c[2])) + '"></i>'; }).join('') + '</div>' +
      '<div class="fg-catchips"><button type="button" class="' + (UI.cat === 'all' ? 'on' : '') + '" data-fg-catf="all">' + E(T(CATS.all)) + ' <b>' + E(fmt(total)) + '</b></button>' +
      cats.map(function (c) { return '<button type="button" class="' + (UI.cat === c[0] ? 'on' : '') + '" data-fg-catf="' + c[0] + '" style="--cc:' + c[3] + '"><i></i>' + c[1] + ' ' + E(T(c[2])) + ' <b>' + E(fmt(by[c[0]])) + '</b></button>'; }).join('') + '</div></div>';
  }

  // 📍 Qoida qaysi qurilmalarda: tanlanadigan qurilmalar — kompyuterlar, telefonlar va kompyuterga bog'lanmagan
  // kengaytmalar (bog'langan kengaytma o'z kompyuteri bilan birga ishlaydi). r.devs bo'sh — hammasida.
  function targetDevs() {
    return FG.devices.filter(function (d) { var k = devKind(d); if (k !== 'ext') return true; var p = d.parent_id && devById(d.parent_id); return !(p && devKind(p) === 'pc'); });
  }
  function ruleDevs(r) { var ids = Array.isArray(r && r.devs) ? r.devs.filter(function (id) { return !!devById(id); }) : []; return ids.length ? ids : null; }
  function ruleDevLabel(r) { var d = ruleDevs(r); return d ? d.map(function (id) { var x = devById(id); return devIcon(x) + ' ' + devName(x); }).join(', ') : ''; }
  // Ko'proq qurilmada ishlaydimi (yangi ro'yxat eskisini to'liq qamrab oladi) — qat'iy rejim uchun
  function devsCover(nw, old) { var a = ruleDevs({ devs: nw }), b = ruleDevs({ devs: old }); if (!a) return true; if (!b) return false; return b.every(function (id) { return a.indexOf(id) !== -1; }); }

  // ---------- ⏳ Limitlar ----------
  function ruleRow(r, i) {
    var dvs = ruleDevs(r);
    var used = dvs ? usedOn(r.app, dvs) : usedMin(r.app, 0), isDaily = r.kind === 'daily', lm = ruleMin(r, 0), over = isDaily && lm > 0 && used >= lm, pct = isDaily && lm ? Math.min(100, used / lm * 100) : 0;
    var sub = isDaily ? (over && r.on ? '⛔ ' + L('Limit tugadi — bloklandi', 'Limit reached — blocked', 'Лимит исчерпан — заблокировано') : fmt(used) + ' / ' + (lm ? fmt(lm) : '∞') + (r.perDay ? ' · 📅 ' + L('kunlar bo\'yicha', 'per day', 'по дням') : '')) : ruleDesc(r);
    return '<div class="fg-row fg-sortable' + (r.on ? '' : ' dim') + '" data-id="' + E(r.id || '') + '"><span class="fg-grip" aria-hidden="true">⋮⋮</span>' + (r.kind === 'always' && /porn|adult|xxx/.test(r.app) ? '<span class="fg-tile emo">🔞</span>' : tileFor(r.app)) +
      '<button type="button" class="fg-row-m fg-row-btn" data-fg-edit="' + i + '"><span class="fg-row-n"><b>' + E(r.app.indexOf('cat:') === 0 ? T(catInfo(r.app.slice(4))[2]) : (r.label || labelOf(r.app))) + '</b>' + (r.app.indexOf('site:') === 0 ? '<small>' + E(L('sayt', 'site', 'сайт')) + '</small>' : r.app.indexOf('cat:') === 0 ? '<small>' + E(L('kategoriya', 'category', 'категория')) + '</small>' : '') + '</span><small class="' + (over && r.on ? 'red' : '') + '">' + E(sub) + '</small>' + (dvs ? '<small class="fg-rdevs">📍 ' + E(ruleDevLabel(r)) + '</small>' : '') +
      (isDaily ? '<span class="fg-prog' + (over ? ' red' : pct > 75 ? ' warn' : '') + '"><i style="width:' + pct + '%"></i></span>' : '') + '</button>' +
      sw(r.on, 'data-fg-rule="' + i + '"', cfg().strict && r.on && real()) + '</div>';
  }
  function pageLimits() {
    var rules = cfg().rules || [], h = '';
    var blocked = [], daily = [];
    rules.forEach(function (r, i) { ((r.kind === 'daily' || r.kind === 'session') ? daily : blocked).push(ruleRow(r, i)); });
    h += '<div class="fg-group-t">🚫 ' + E(L('Bloklangan', 'Blocked', 'Заблокировано')) + ' <em>' + blocked.length + '</em></div><div class="fg-list" data-sort="blocked">' + (blocked.join('') || '<div class="fg-empty sm">' + E(L('Hozircha yo\'q', 'None yet', 'Пока нет')) + '</div>') + '</div>';
    h += '<div class="fg-group-t">⏳ ' + E(L('Kunlik limitlar', 'Daily limits', 'Дневные лимиты')) + ' <em>' + daily.length + '</em></div><div class="fg-list" data-sort="daily">' + (daily.join('') || '<div class="fg-empty sm">' + E(L('Hozircha yo\'q', 'None yet', 'Пока нет')) + '</div>') + '</div>';
    h += '<button type="button" class="fg-add" data-fg-addlimit>＋ ' + E(L('Limit qo\'shish', 'Add limit', 'Добавить лимит')) + '</button>' + allAppsBtn();
    if (rules.length > 1) h += '<div class="fg-hint">↕️ ' + E(L('Tartibni o\'zgartirish uchun qatorni bosib turib suring.', 'Press and hold a row, then drag to reorder.', 'Зажмите строку и перетащите, чтобы изменить порядок.')) + '</div>';
    if (cfg().strict && real()) h += '<div class="fg-hint">🔐 ' + E(L('Qat\'iy rejim: yoqilgan limitlarni o\'chirib yoki kamaytirib bo\'lmaydi.', 'Strict mode: active limits can\'t be turned off or loosened.', 'Строгий режим: активные лимиты нельзя отключить или ослабить.')) + '</div>';
    return h;
  }

  // ---------- 🚫 Bloklash ----------
  function focusLeft() { return Math.max(0, (cfg().focusUntil || 0) - Date.now()); }
  function mmss(ms) { var s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function pageBlock() {
    var c = cfg(), left = focusLeft(), h = pauseHtml(), strictF = !!(c.strict && left > 0 && real());
    if (left > 0) {
      var own = linkOwner(), srcTxt = own && own !== 'focusgate' && SRC[own] ? ' · ' + SRC[own][0] + ' ' + T(SRC[own][1]) : '';
      h += '<div class="fg-card fg-focus on"><div class="fg-focus-l"><span class="fg-focus-k">🎯 ' + E(L('Fokus davom etmoqda', 'Focus in progress', 'Идёт фокус') + srcTxt) + '</span><b class="fg-timer" data-fg-live>' + mmss(left) + '</b>' +
        '<small class="fg-focus-n">' + E(c.allowOnly ? L('Faqat ruxsat etilgan ilova va saytlar ishlaydi.', 'Only allowed apps and sites work.', 'Работают только разрешённые приложения и сайты.') : L('Ro\'yxatdagi dasturlar ochilsa — darhol yopiladi.', 'Listed apps are closed as soon as they open.', 'Приложения из списка закрываются сразу.')) + '</small></div>' +
        '<button type="button" class="fg-btn big ghost" data-fg-stop' + (c.strict ? ' disabled' : '') + '>■ ' + E(c.strict ? L('Qat\'iy rejim', 'Strict mode', 'Строгий режим') : L('To\'xtatish', 'Stop', 'Остановить')) + '</button></div>';
    } else {
      var preset = [15, 25, 45, 60, 90], custom = preset.indexOf(UI.focusMin) === -1;
      h += '<div class="fg-card fg-focus"><div class="fg-focus-l"><span class="fg-focus-k">' + E(L('Fokus sessiyasi', 'Focus session', 'Сессия фокуса')) + '</span><b class="fg-timer">' + (UI.focusMin >= 60 ? Math.floor(UI.focusMin / 60) + ':' + String(UI.focusMin % 60).padStart(2, '0') + ':00' : String(UI.focusMin).padStart(2, '0') + ':00') + '</b>' +
        '<div class="fg-chips">' + preset.map(function (m) { return '<button type="button" class="' + (UI.focusMin === m ? 'on' : '') + '" data-fg-min="' + m + '">' + m + ' ' + E(L('daq', 'min', 'мин')) + '</button>'; }).join('') +
        '<label class="fg-chip-in' + (custom ? ' on' : '') + '">✎ <input type="number" min="1" max="600" step="1" inputmode="numeric" data-fg-mincustom value="' + (custom ? UI.focusMin : '') + '" placeholder="' + E(L('boshqa', 'custom', 'своё')) + '"> ' + E(L('daq', 'min', 'мин')) + '</label></div></div>' +
        '<div class="fg-focus-r"><button type="button" class="fg-btn big" data-fg-focus>▶ ' + E(L('Fokusni boshlash', 'Start focus', 'Начать фокус')) + '</button>' +
        '<div class="fg-focus-alt"><span>' + E(L('yoki birga:', 'or together with:', 'или вместе с:')) + '</span><button type="button" class="fg-btn sm ghost" data-fg-withfocus>🧘 ' + E(L('Fokus ekrani', 'Focus screen', 'Экран фокуса')) + '</button><button type="button" class="fg-btn sm ghost" data-fg-withpomo>🍅 Pomodoro</button></div></div></div>' +
        (cfg().linkFocus === false ? '' : '<div class="fg-hint">🔗 ' + E(L('Pomodoro yoki Fokus rejimini boshlasangiz ham shu ro\'yxat avtomatik ishlaydi.', 'Starting Pomodoro or Focus mode also applies this list automatically.', 'При запуске Pomodoro или режима фокуса этот список тоже применяется автоматически.')) + '</div>');
    }
    // Fokus turi: ro'yxatni bloklash yoki faqat ruxsat etilganlar (oq ro'yxat)
    h += '<div class="fg-seg wide" data-anchor="focus"><button type="button" class="' + (c.allowOnly ? '' : 'on') + '" data-fg-allowmode="0">🚫 ' + E(L('Ro\'yxatni bloklash', 'Block a list', 'Блокировать список')) + '</button><button type="button" class="' + (c.allowOnly ? 'on' : '') + '" data-fg-allowmode="1">✅ ' + E(L('Faqat ruxsat etilganlar', 'Allow only', 'Только разрешённые')) + '</button></div>';
    function frow(f, i, attr, del) {
      return '<div class="fg-row fg-sortable' + (f.on === false ? ' dim' : '') + '" data-app="' + E(f.app) + '"><span class="fg-grip" aria-hidden="true">⋮⋮</span>' + tileFor(f.app) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(f.app.indexOf('cat:') === 0 ? T(catInfo(f.app.slice(4))[2]) : (f.label || labelOf(f.app))) + '</b><small>' + E(f.app.indexOf('cat:') === 0 ? L('kategoriya', 'category', 'категория') : niceExe(f.app)) + '</small></span></span>' +
        (real() && !strictF ? '<button type="button" class="fg-del" data-' + del + '="' + i + '" aria-label="×">✕</button>' : '') + (attr ? sw(f.on, 'data-' + attr + '="' + i + '"', strictF && f.on) : '') + '</div>';
    }
    if (c.allowOnly) {
      var al = c.allowApps || [];
      h += '<div class="fg-group-t">' + E(L('Fokusda faqat shular ishlaydi', 'Only these work during focus', 'Во время фокуса работают только они')) + ' <em>' + al.length + '</em></div><div class="fg-list">' + al.map(function (f, i) { return frow(f, i, '', 'fg-aldel'); }).join('');
      if (!al.length) h += '<div class="fg-empty sm">' + E(L('Ro\'yxat bo\'sh — fokusda hamma narsa yig\'iladi/yopiladi. Kerakli ilova va saytlarni qo\'shing (masalan VS Code, Google Docs).', 'Empty — everything is minimized/closed during focus. Add what you need (e.g. VS Code, Google Docs).', 'Пусто — во время фокуса всё сворачивается/закрывается. Добавьте нужное (например VS Code, Google Docs).')) + '</div>';
      h += '</div><button type="button" class="fg-add" data-fg-addallow>＋ ' + E(L('Ruxsat etilganlarni tanlash', 'Choose allowed apps & sites', 'Выбрать разрешённые')) + '</button>' +
        '<div class="fg-hint">ℹ️ ' + E(L('Kompyuterda ro\'yxatda yo\'q oyna yig\'iladi, brauzerda esa ro\'yxatda yo\'q sayt bloklanadi (kengaytma kerak). Tizim oynalari (Explorer, Task Manager) har doim ishlaydi.', 'On the PC, windows not in the list get minimized; in the browser, unlisted sites are blocked (needs the extension). System windows (Explorer, Task Manager) always work.', 'На ПК окна не из списка сворачиваются, в браузере сайты не из списка блокируются (нужно расширение). Системные окна работают всегда.')) + '</div>';
    } else {
      var fa = c.focusApps || [];
      h += '<div class="fg-group-t">' + E(L('Fokus paytida bloklanadigan dasturlar', 'Apps blocked during focus', 'Блокируются во время фокуса')) + ' <em>' + fa.length + '</em></div><div class="fg-list" data-sort="focus">' + fa.map(function (f, i) { return frow(f, i, 'fg-fa', 'fg-fadel'); }).join('');
      if (!fa.length) h += '<div class="fg-empty sm">' + E(L('Ro\'yxat bo\'sh — chalg\'itadigan dasturlarni qo\'shing', 'Empty — add distracting apps', 'Пусто — добавьте отвлекающие приложения')) + '</div>';
      h += '</div><button type="button" class="fg-add" data-fg-addfocus>＋ ' + E(L('Dastur qo\'shish', 'Add app', 'Добавить приложение')) + '</button>';
    }
    h += modesHtml() + mindfulHtml();
    // Saytlar: mashhur 8 ta (yoki hammasi) + foydalanuvchi qo'shgan boshqa saytlar (doimiy blok)
    h += '<div class="fg-group-t">' + E(L('Saytlarni bloklash', 'Block websites', 'Блокировка сайтов')) + ' <small>· ' + E(L('brauzer tabi avtomatik yopiladi', 'the browser tab closes automatically', 'вкладка закрывается автоматически')) + '</small></div><div class="fg-card fg-sites">';
    var shown = SITES.slice(0, UI.allSites ? SITES.length : 8).map(function (x) { return x[0]; });
    (c.rules || []).forEach(function (x) { if (x.kind === 'always' && /^site:/.test(x.app) && shown.indexOf(x.app) === -1) shown.push(x.app); });
    shown.forEach(function (key) {
      var r = (c.rules || []).filter(function (x) { return x.app === key && x.kind === 'always'; })[0];
      var on = !!(r && r.on);
      h += '<div class="fg-opt"><span class="fg-site-l">' + tileFor(key, 'sm') + '<span class="fg-site-n"><b>' + E(labelOf(key)) + '</b><small>' + E(DOMAIN[key] || key.slice(5)) + '</small></span></span>' + sw(on, 'data-fg-site="' + E(key) + '"', c.strict && on && real()) + '</div>';
    });
    var more = SITES.length - 8;
    h += '</div>' + (more > 0 ? '<button type="button" class="fg-more" data-fg-moresites>' + E(UI.allSites ? L('Kamroq ko\'rsatish', 'Show less', 'Свернуть') + ' ⌃' : L('Yana ' + more + ' ta mashhur sayt', more + ' more popular sites', 'Ещё ' + more + ' популярных сайтов') + ' ⌄') + '</button>' : '') +
      '<button type="button" class="fg-add" data-fg-addsite>＋ ' + E(L('Sayt qo\'shish — katalog, kategoriya yoki istalgan manzil', 'Add a website — catalog, category or any address', 'Добавить сайт — каталог, категория или любой адрес')) + '</button>' + inSiteHtml();
    return h;
  }

  // ⏸ Pauza: limit va bloklar vaqtincha to'xtaydi (qat'iy rejimda emas)
  function pauseLeft() { return Math.max(0, (cfg().pauseUntil || 0) - Date.now()); }
  function pauseHtml() {
    if (!real()) return '';
    var c = cfg(), left = pauseLeft(), st = fgS(), n = st.pauses && st.pauses.day === dayStr(0) ? st.pauses.n : 0;
    if (left > 0) return '<div class="fg-card fg-pause on" data-anchor="pause"><span class="fg-pause-ic">⏸</span><div class="fg-pause-t"><b>' + E(L('Pauza — limitlar ishlamayapti', 'Paused — limits are off', 'Пауза — лимиты выключены')) + '</b><small><span data-fg-plive>' + mmss(left) + '</span> ' + E(L('qoldi', 'left', 'осталось')) + '</small></div><button type="button" class="fg-btn sm" data-fg-resume>▶ ' + E(L('Davom ettirish', 'Resume', 'Продолжить')) + '</button></div>';
    return '<div class="fg-card fg-pause" data-anchor="pause"><span class="fg-pause-ic">⏸</span><div class="fg-pause-t"><b>' + E(L('Tanaffus kerakmi?', 'Need a break?', 'Нужен перерыв?')) + '</b><small>' + E(c.strict ? L('Qat\'iy rejimda pauza yo\'q', 'No pausing in strict mode', 'В строгом режиме паузы нет') : L('Limit va bloklar vaqtincha to\'xtaydi', 'Limits and blocks stop for a while', 'Лимиты и блокировки временно отключатся') + (n ? ' · ' + L('bugun ' + n + ' marta', n + ' today', 'сегодня: ' + n) : '')) + '</small></div>' +
      '<div class="fg-chips">' + [5, 15, 30].map(function (m) { return '<button type="button" data-fg-pause="' + m + '"' + (c.strict ? ' disabled' : '') + '>' + m + ' ' + E(L('daq', 'min', 'мин')) + '</button>'; }).join('') + '</div></div>';
  }
  function startPause(m) {
    var c = cfg(); if (c.strict) return;
    guard(function () {
      var cc = cfg(); cc.pauseUntil = Date.now() + m * 60000; saveCfg();
      var st = fgS(); if (!st.pauses || st.pauses.day !== dayStr(0)) st.pauses = { day: dayStr(0), n: 0 }; st.pauses.n++; save();
      rerender();
      try { toast('⏸ ' + L(m + ' daqiqa pauza — qurilmalar 30 soniyada qabul qiladi', m + '-minute pause — devices pick it up within 30 s', 'Пауза ' + m + ' мин — устройства получат за 30 с')); } catch (e) {}
    });
  }

  // 🎭 Rejimlar: "Ish", "Uyqu", "Imtihon" — yoqilganda (yoki jadval vaqtida) ro'yxatdagilar bloklanadi
  var MODE_EMO = ['💼', '😴', '📚', '🎮', '🏃', '🍽', '🙏', '🧘', '👨‍👩‍👧', '🌙'];
  function modeOnNow(m) {
    if (m.on) return true;
    if (!m.sched) return false;
    var now = new Date(), wd = now.getDay() === 0 ? 7 : now.getDay();
    if (m.days && m.days.length && m.days.indexOf(wd) === -1) return false;
    var hm = function (x) { var p = String(x || '00:00').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
    var f = hm(m.from), t = hm(m.to), n = now.getHours() * 60 + now.getMinutes();
    return f === t ? true : f < t ? (n >= f && n < t) : (n >= f || n < t);
  }
  function modesHtml() {
    var c = cfg(), ms = c.modes || [];
    var h = '<div class="fg-group-t" data-anchor="modes">🎭 ' + E(L('Rejimlar', 'Modes', 'Режимы')) + ' <em>' + ms.length + '</em> <small>· ' + E(L('Ish, Uyqu, Imtihon — bir tugma bilan', 'Work, Sleep, Exam — one tap', 'Работа, Сон, Экзамен — одним касанием')) + '</small></div>';
    if (ms.length) h += '<div class="fg-list">' + ms.map(function (m, i) {
      var act = modeOnNow(m), sub = (m.apps || []).length + ' ' + L('ta ilova/sayt', 'apps/sites', 'прил./сайтов') + (m.sched ? ' · 🗓 ' + ruleDesc({ kind: 'schedule', days: m.days, from: m.from, to: m.to }) : '');
      return '<div class="fg-row' + (act ? ' fg-mode-on' : '') + '"><span class="fg-tile emo">' + E(m.icon || '🎭') + '</span><button type="button" class="fg-row-m fg-row-btn" data-fg-modeedit="' + i + '"><span class="fg-row-n"><b>' + E(m.name || '—') + '</b>' + (act ? '<em class="fg-tag">● ' + E(L('faol', 'active', 'активен')) + '</em>' : '') + '</span><small>' + E(sub) + '</small></button>' +
        sw(!!m.on, 'data-fg-mode="' + i + '"', c.strict && m.on && real()) + '</div>';
    }).join('') + '</div>';
    return h + '<button type="button" class="fg-add" data-fg-addmode>＋ ' + E(L('Rejim qo\'shish', 'Add a mode', 'Добавить режим')) + '</button>';
  }
  function openModeSheet(idx, draft) {
    if (!real()) { needConnect(); return; }
    var c = cfg(), m = idx != null ? c.modes[idx] : null, isNew = !m;
    var d = draft || JSON.parse(JSON.stringify(m || { id: 'm' + Date.now().toString(36), name: '', icon: '💼', apps: [], on: false, sched: false, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' }));
    var tpl = [['💼', ['Ish', 'Work', 'Работа'], false, [1, 2, 3, 4, 5], '09:00', '18:00', 'cat:social'], ['😴', ['Uyqu', 'Sleep', 'Сон'], true, [], '23:00', '07:00', 'cat:games'], ['📚', ['Imtihon', 'Exam', 'Экзамен'], false, [], '08:00', '20:00', 'cat:fun']];
    var o = openSheet('<h3>🎭 ' + E(isNew ? L('Yangi rejim', 'New mode', 'Новый режим') : L('Rejimni tahrirlash', 'Edit mode', 'Изменить режим')) + '</h3>' +
      (isNew ? '<div class="fg-lbl">' + E(L('Tayyor andozalar', 'Templates', 'Шаблоны')) + '</div><div class="fg-chips">' + tpl.map(function (t, i) { return '<button type="button" data-fg-mtpl="' + i + '">' + t[0] + ' ' + E(T(t[1])) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="fg-lbl">' + E(L('Nomi', 'Name', 'Название')) + '</div><input class="fg-in" data-fg-mname maxlength="30" value="' + E(d.name) + '" placeholder="' + E(L('Masalan: Ish', 'e.g. Work', 'Например: Работа')) + '">' +
      '<div class="fg-chips fg-emos">' + MODE_EMO.map(function (x) { return '<button type="button" class="' + (d.icon === x ? 'on' : '') + '" data-fg-memo="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="fg-lbl">' + E(L('Nimalar bloklansin?', 'What gets blocked?', 'Что блокировать?')) + '</div><button type="button" class="fg-allbtn" data-fg-mapps><span>📋</span><b>' + E(d.apps.length ? d.apps.slice(0, 3).map(function (f) { return f.label || labelOf(f.app); }).join(', ') + (d.apps.length > 3 ? ' +' + (d.apps.length - 3) : '') : L('Ilova va saytlarni tanlang', 'Choose apps and sites', 'Выберите приложения и сайты')) + '</b><em>' + d.apps.length + '</em><i>›</i></button>' +
      '<label class="fg-pk-block"><input type="checkbox" data-fg-msched' + (d.sched ? ' checked' : '') + '> ' + E(L('Jadval bo\'yicha avtomatik yoqilsin', 'Turn on automatically on a schedule', 'Включать автоматически по расписанию')) + '</label>' +
      '<div class="fg-msched"' + (d.sched ? '' : ' hidden') + '><div class="fg-days">' + DAYS().map(function (x, i) { return '<button type="button" class="' + (!d.days || !d.days.length || d.days.indexOf(i + 1) !== -1 ? 'on' : '') + '" data-fg-dow="' + (i + 1) + '">' + E(x) + '</button>'; }).join('') + '</div>' +
      '<div class="fg-times"><label>' + E(L('Dan', 'From', 'С')) + '<input type="time" class="fg-in" data-fg-from value="' + E(d.from || '09:00') + '"></label><label>' + E(L('Gacha', 'To', 'До')) + '<input type="time" class="fg-in" data-fg-to value="' + E(d.to || '18:00') + '"></label></div></div>' +
      '<div class="fg-acts">' + (isNew ? '<button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button>' : '<button type="button" class="fg-btn ghost danger" data-fg-mdel>🗑 ' + E(L('O\'chirish', 'Delete', 'Удалить')) + '</button>') +
      '<button type="button" class="fg-btn" data-fg-msave>' + E(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    function read() {
      d.name = o.querySelector('[data-fg-mname]').value.trim();
      d.sched = o.querySelector('[data-fg-msched]').checked;
      d.days = Array.prototype.map.call(o.querySelectorAll('[data-fg-dow].on'), function (b) { return +b.getAttribute('data-fg-dow'); });
      if (d.days.length === 7) d.days = [];
      d.from = o.querySelector('[data-fg-from]').value || '09:00'; d.to = o.querySelector('[data-fg-to]').value || '18:00';
    }
    o.querySelectorAll('[data-fg-mtpl]').forEach(function (b) { b.onclick = function () { var t = tpl[+b.dataset.fgMtpl]; read(); d.icon = t[0]; d.name = T(t[1]); d.sched = t[2]; d.days = t[3]; d.from = t[4]; d.to = t[5]; if (!d.apps.length) d.apps = [{ app: t[6], label: labelOf(t[6]) }]; openModeSheet(idx, d); }; });
    one(o, '[data-fg-memo]', function (b) { d.icon = b.dataset.fgMemo; });
    o.querySelectorAll('[data-fg-dow]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); }; });
    o.querySelector('[data-fg-msched]').onchange = function () { o.querySelector('.fg-msched').hidden = !this.checked; };
    o.querySelector('[data-fg-mapps]').onclick = function () { read(); pickApps(d.apps, function (out) { d.apps = out; openModeSheet(idx, d); }, { plain: true, title: L('Rejimda bloklanadiganlar', 'Blocked in this mode', 'Блокируется в режиме'), cats: true }); };
    var del = o.querySelector('[data-fg-mdel]');
    if (del) del.onclick = function () {
      var cc = cfg(); if (cc.strict && m.on) { toast('🔐 ' + L('Qat\'iy rejim: faol rejimni o\'chirib bo\'lmaydi', 'Strict mode: an active mode can\'t be removed', 'Строгий режим: активный режим нельзя удалить')); return; }
      guard(function () { var k = cfg().modes.indexOf(m); if (k !== -1) cfg().modes.splice(k, 1); saveCfg(); closeSheet(); rerender(); });
    };
    o.querySelector('[data-fg-msave]').onclick = function () {
      read();
      if (!d.name) { toast('✍️ ' + L('Rejim nomini yozing', 'Type a name for the mode', 'Введите название режима')); return; }
      var cc = cfg(); cc.modes = cc.modes || [];
      var k = -1; cc.modes.forEach(function (x, i) { if (x.id === d.id) k = i; });
      var commit = function () { if (k === -1) cc.modes.push(d); else cc.modes[k] = d; saveCfg(); closeSheet(); rerender(); };
      // Faol rejimdan ilova olib tashlash yoki jadvalni o'zgartirish — yumshatish: qat'iy rejimda taqiqlanadi, PIN bo'lsa so'raladi
      var loosen = k !== -1 && m && modeOnNow(m) && (m.apps || []).some(function (f) { return !d.apps.some(function (x) { return x.app === f.app; }); });
      if (loosen && cc.strict) { toast('🔐 ' + L('Qat\'iy rejim: faol rejimni yumshatib bo\'lmaydi', 'Strict mode: an active mode can\'t be loosened', 'Строгий режим: активный режим нельзя ослабить')); return; }
      if (loosen) guard(commit); else commit();
    };
  }

  // 🌬 Ongli ochish: ochishdan oldin N soniya kutish va "rostdan kerakmi?" savoli
  function mindfulHtml() {
    var c = cfg(), mf = c.mindful || [], ws = c.mindfulSec || 10, wm = c.mindfulMin || 15;
    var h = '<div class="fg-group-t" data-anchor="mindful">🌬 ' + E(L('Ongli ochish', 'Mindful opening', 'Осознанное открытие')) + ' <em>' + mf.length + '</em> <small>· ' + E(L('ochishdan oldin "rostdan kerakmi?"', 'asks "do you really need it?" first', 'сначала спросит «точно нужно?»')) + '</small></div>';
    if (mf.length) h += '<div class="fg-list">' + mf.map(function (f, i) {
      return '<div class="fg-row' + (f.on === false ? ' dim' : '') + '">' + tileFor(f.app) + '<span class="fg-row-m"><span class="fg-row-n"><b>' + E(f.label || labelOf(f.app)) + '</b><small>' + E(niceExe(f.app)) + '</small></span></span>' +
        (real() ? '<button type="button" class="fg-del" data-fg-mfdel="' + i + '" aria-label="×">✕</button>' : '') + sw(f.on !== false, 'data-fg-mf="' + i + '"') + '</div>';
    }).join('') + '</div>' +
      '<div class="fg-card fg-mfset"><span>⏳ ' + E(L('Kutish', 'Wait', 'Ожидание')) + '</span><div class="fg-chips">' + [5, 10, 20, 30].map(function (x) { return '<button type="button" class="' + (ws === x ? 'on' : '') + '" data-fg-mfsec="' + x + '">' + x + ' ' + E(L('s', 's', 'с')) + '</button>'; }).join('') + '</div>' +
      '<span>✅ ' + E(L('"Ha" desa ruxsat', 'Allowed after "Yes"', 'Разрешено после «Да»')) + '</span><div class="fg-chips">' + [5, 15, 30, 60].map(function (x) { return '<button type="button" class="' + (wm === x ? 'on' : '') + '" data-fg-mfmin="' + x + '">' + x + ' ' + E(L('daq', 'min', 'мин')) + '</button>'; }).join('') + '</div></div>';
    return h + '<button type="button" class="fg-add" data-fg-addmindful>＋ ' + E(L('Ilova yoki sayt tanlash', 'Choose apps or sites', 'Выбрать приложения или сайты')) + '</button>';
  }

  // ---------- ⚙️ Sozlamalar ----------
  function settingsRows() {
    var c = cfg();
    var rows = [
      ['track', '👁', ['Foydalanish vaqtini kuzatish', 'Track usage time', 'Отслеживать время'], ['Dastur va saytlarda o\'tkazilgan vaqt hisoblanadi', 'Counts time spent in apps and sites', 'Считает время в приложениях и на сайтах'], c.track !== false],
      ['notif', '🔔', ['Windows bildirishnomalari', 'Windows notifications', 'Уведомления Windows'], ['Limit tugashiga 5 daqiqa qolganda va bloklanganda', '5 minutes before a limit ends and when blocking', 'За 5 минут до лимита и при блокировке'], c.notif !== false],
      ['linkFocus', '🔗', ['Pomodoro va Fokus rejimi bilan', 'Link Pomodoro & Focus mode', 'Связать с Pomodoro и фокусом'], ['Ular ishlaganda ham fokus ro\'yxatidagi dasturlar bloklanadi', 'Apps in the focus list are blocked while they run', 'Приложения из списка фокуса блокируются и во время них'], c.linkFocus !== false],
      ['strict', '🔐', ['Qat\'iy rejim', 'Strict mode', 'Строгий режим'], c.strictOffAt ? ['⏳ O\'chadi: ' + new Date(c.strictOffAt).toLocaleString(), '⏳ Turns off: ' + new Date(c.strictOffAt).toLocaleString(), '⏳ Выключится: ' + new Date(c.strictOffAt).toLocaleString()] : ['Limitlarni o\'chirib, pauza qilib va fokusni to\'xtatib bo\'lmaydi', 'No turning off limits, pausing or stopping focus', 'Нельзя отключить лимиты, поставить паузу или остановить фокус'], !!c.strict],
      ['reward', '🪙', ['LevelUpDay mukofotlari', 'LevelUpDay rewards', 'Награды LevelUpDay'], ['Limitlarda qolgan kun: +10 🪙 · fokus: har daqiqa 1 XP', 'Day within limits: +10 🪙 · focus: 1 XP per minute', 'День в лимитах: +10 🪙 · фокус: 1 XP за минуту'], LOCAL.reward],
      ['share', '👥', ['Do\'stlarim ko\'rsin', 'Visible to friends', 'Видно друзьям'], ['Fokus va ekran vaqti do\'stlar reytingida chiqadi (dasturlar ko\'rinmaydi)', 'Focus and screen time appear in the friends board (apps stay private)', 'Фокус и экранное время видны в рейтинге друзей (приложения скрыты)'], c.share !== false],
      ['tg', '✈️', ['Telegram\'ga xabar', 'Telegram alerts', 'Сообщения в Telegram'], [FG.tg ? 'Dastur bloklansa yoki limit tugasa — botdan xabar' : 'Telegram ulanmagan — Profil → Sozlamalar → Telegram', FG.tg ? 'Message from the bot when something is blocked or a limit ends' : 'Telegram not connected — Profile → Settings → Telegram', FG.tg ? 'Сообщение от бота при блокировке или исчерпании лимита' : 'Telegram не подключён — Профиль → Настройки → Telegram'], !!(FG.tg && FG.tg.enabled && !(FG.tg.prefs && FG.tg.prefs.fg === false))],
      ['tgweekly', '📊', ['Haftalik hisobot (Telegram)', 'Weekly report (Telegram)', 'Недельный отчёт (Telegram)'], ['Har yakshanba kechqurun: ekran vaqti, o\'tgan hafta bilan taqqoslash, top ilovalar', 'Every Sunday evening: screen time, week-over-week change, top apps', 'Каждое воскресенье вечером: экранное время, сравнение с прошлой неделей, топ приложений'], !!(FG.tg && FG.tg.enabled && !(FG.tg.prefs && (FG.tg.prefs.fg === false || FG.tg.prefs.fgweekly === false)))]
    ];
    return rows.map(function (r) {
      return '<div class="fg-opt"><span class="fg-set-ic">' + r[1] + '</span><span class="fg-set-t"><b>' + E(T(r[2])) + '</b><small>' + E(T(r[3])) + '</small></span>' + sw(r[4], 'data-fg-set="' + r[0] + '"', (r[0] === 'tg' || r[0] === 'tgweekly') && !FG.tg) + '</div>';
    }).join('');
  }
  // 🔗 Ulangan qurilmalar: har bir kompyuter ichida uning brauzer kengaytmasi (ulangan / ulanmagan),
  // telefonlar alohida, kompyuterga bog'lanmagan kengaytmalar — "qaysi kompyuterda?" tanlovi bilan
  function devStatus(d) {
    var on = devOn(d);
    return '<small class="' + (on ? 'grn' : '') + '">' + (on ? '● ' + E(L('onlayn', 'online', 'онлайн')) : E(ago(d.last_seen))) +
      (d.agent_version ? ' · v' + E(String(d.agent_version).replace(/^(ext|android)-/, '')) : '') + '</small>';
  }
  function browserOf(d) { if (d && d.label) return String(d.label); return String((d && d.name) || 'Chrome').replace(/\s*\((kengaytma|extension|расширение)\)\s*/i, '').trim(); }
  function devicesHtml() {
    if (!real()) return '';
    var pcs = [], exts = [], phones = [], kids = {};
    FG.devices.forEach(function (d) { var k = devKind(d); (k === 'pc' ? pcs : k === 'ext' ? exts : phones).push(d); });
    var loose = exts.filter(function (x) {
      var p = x.parent_id && devById(x.parent_id);
      if (p && devKind(p) === 'pc') { (kids[p.id] = kids[p.id] || []).push(x); return false; }
      return true;
    });
    var nm = function (d, txt) { return '<b class="fg-devname">' + E(txt) + '<button type="button" class="fg-ren" data-fg-rename="' + E(d.id) + '" aria-label="' + E(L('Nomini o\'zgartirish', 'Rename', 'Переименовать')) + '" title="' + E(L('Nomini o\'zgartirish', 'Rename', 'Переименовать')) + '">✏️</button></b>'; };
    var unpairBtn = function (d, sm) { return '<button type="button" class="fg-btn sm ghost' + (sm ? ' fg-unx' : '') + '" data-fg-unpair="' + E(d.id) + '" aria-label="' + E(L('Uzish', 'Remove', 'Отключить')) + '">' + (sm ? '✕' : E(L('Uzish', 'Remove', 'Отключить'))) + '</button>'; };
    var extLine = function (x) {
      return '<div class="fg-subrow"><span class="fg-sub-ic">🧩</span><span class="fg-row-m">' + nm(x, L('Brauzer kengaytmasi', 'Browser extension', 'Расширение браузера') + ' · ' + browserOf(x)) +
        '<small class="fg-ok">✅ ' + E(L('Ulangan', 'Connected', 'Подключено')) + '</small> ' + devStatus(x) + '</span>' + unpairBtn(x, true) + '</div>';
    };
    var h = '<div class="fg-group-t">🔗 ' + E(L('Ulangan qurilmalar', 'Connected devices', 'Подключённые устройства')) + ' <em>' + (pcs.length + phones.length + (pcs.length ? 0 : exts.length)) + '</em></div>' +
      '<div class="fg-hint">' + E(L('Har bir kompyuterda Focusgate dasturi va brauzer kengaytmasi birga ishlaydi: dastur — ilovalarni, kengaytma — saytlarni boshqaradi.', 'On each computer the Focusgate app and the browser extension work together: the app handles programs, the extension handles websites.', 'На каждом компьютере работают вместе программа Focusgate и расширение: программа — приложения, расширение — сайты.')) + '</div><div class="fg-list">';
    pcs.forEach(function (d) {
      var k = kids[d.id] || [];
      h += '<div class="fg-devc"><div class="fg-row"><span class="fg-tile" style="--tc:#3b82f6">🪟</span><span class="fg-row-m">' + nm(d, devName(d)) + devStatus(d).replace('</small>', (Array.isArray(d.apps) ? ' · ' + d.apps.length + ' ' + E(L('dastur', 'apps', 'прогр.')) : '') + '</small>') + '</span>' + unpairBtn(d) + '</div>' +
        (k.length ? k.map(extLine).join('') :
          '<div class="fg-subrow off"><span class="fg-sub-ic">🧩</span><span class="fg-row-m"><b>' + E(L('Brauzer kengaytmasi', 'Browser extension', 'Расширение браузера')) + '</b><small class="fg-no">❌ ' + E(L('Ulanmagan — saytlar va Shorts/Reels bloklanmaydi', 'Not connected — sites and Shorts/Reels aren\'t blocked', 'Не подключено — сайты и Shorts/Reels не блокируются')) + '</small></span>' +
          (DOWNLOADS_ON ? '<button type="button" class="fg-btn sm" data-fg-extinstall>' + E(L('O\'rnatish', 'Install', 'Установить')) + '</button>' : '') + '</div>') + '</div>';
    });
    phones.forEach(function (d) {
      h += '<div class="fg-devc"><div class="fg-row"><span class="fg-tile" style="--tc:#22c55e">📱</span><span class="fg-row-m">' + nm(d, devName(d)) + devStatus(d) + '</span>' + unpairBtn(d) + '</div></div>';
    });
    if (loose.length) {
      if (pcs.length) h += '<div class="fg-group-t sm">🧩 ' + E(L('Qaysi kompyuterdaligi aniqlanmagan kengaytmalar', 'Extensions not matched to a computer', 'Расширения без компьютера')) + '</div>' +
        '<div class="fg-hint">' + E(L('Kompyuterda Focusgate v' + AGENT_VERSION + ' va kengaytma ishlab tursa — o\'zi bog\'lanadi. Yoki qo\'lda tanlang:', 'With Focusgate v' + AGENT_VERSION + ' running on that computer it links automatically. Or pick it yourself:', 'Если на компьютере запущен Focusgate v' + AGENT_VERSION + ' — привяжется само. Или выберите вручную:')) + '</div>';
      loose.forEach(function (x) {
        h += '<div class="fg-devc"><div class="fg-row"><span class="fg-tile" style="--tc:#f59e0b">🧩</span><span class="fg-row-m">' + nm(x, devName(x)) + devStatus(x) + '</span>' + unpairBtn(x) + '</div>' +
          (pcs.length ? '<div class="fg-subrow"><span class="fg-sub-ic">💻</span><select class="fg-sel" data-fg-link="' + E(x.id) + '"><option value="">' + E(L('Qaysi kompyuterda?', 'Which computer?', 'На каком компьютере?')) + '</option>' +
            pcs.map(function (p) { return '<option value="' + E(p.id) + '">' + E(devName(p)) + '</option>'; }).join('') + '</select></div>' : '') + '</div>';
      });
    }
    return h + '</div>';
  }
  function getCards() {
    if (!DOWNLOADS_ON) return '';
    return '<div class="fg-get">' +
      '<div class="fg-card fg-get-c"><span class="fg-get-ic">🪟</span><b>' + E(L('Windows uchun Focusgate', 'Focusgate for Windows', 'Focusgate для Windows')) + '</b><span>' + E(L('Dasturlarni kuzatadi va bloklaydi. Soat yonida (tray) ishlaydi.', 'Tracks and blocks programs. Lives in the system tray.', 'Отслеживает и блокирует программы. Работает в трее.')) + '</span><a class="fg-btn" href="' + DOWNLOAD_URL + '" download="Focusgate.exe" rel="noopener">⬇ ' + E(L('Yuklab olish', 'Download', 'Скачать')) + '</a></div>' +
      '<div class="fg-card fg-get-c"><span class="fg-get-ic">🧩</span><b>' + E(L('Brauzer kengaytmasi', 'Browser extension', 'Расширение браузера')) + '</b><span>' + E(L('Shorts, Reels va sayt ichidagi bo\'limlarni bloklash.', 'Blocks Shorts, Reels and in-site sections.', 'Блокирует Shorts, Reels и разделы сайтов.')) + '</span><button type="button" class="fg-btn" data-fg-extinstall>⬇ ' + E(L('O\'rnatish', 'Install', 'Установить')) + '</button></div></div>';
  }
  // ⏳ Qo'shimcha ogohlantirishlar va 🔑 PIN-kod
  function extraSettingsHtml() {
    if (!real()) return '';
    var c = cfg(), wa = c.warnAt || [];
    return '<div class="fg-card fg-set"><div class="fg-opt fg-opt-col"><span class="fg-set-ic">⏳</span><span class="fg-set-t"><b>' + E(L('Limit ogohlantirishlari', 'Limit warnings', 'Предупреждения о лимите')) + '</b><small>' + E(L('Kunlik limitning qancha qismi ishlatilganda xabar berilsin (5 daqiqa qolganda — har doim)', 'When to notify as a daily limit gets used (5 minutes left — always)', 'Когда предупреждать по мере расхода лимита (за 5 минут — всегда)')) + '</small>' +
      '<span class="fg-chips">' + [50, 75, 80, 90].map(function (p) { return '<button type="button" class="' + (wa.indexOf(p) !== -1 ? 'on' : '') + '" data-fg-warnat="' + p + '">' + p + '%</button>'; }).join('') + '</span></span></div>' +
      '<div class="fg-opt"><span class="fg-set-ic">🔑</span><span class="fg-set-t"><b>' + E(L('PIN-kod', 'PIN code', 'PIN-код')) + '</b><small>' + E(c.pin ? L('Yoqilgan: limitni o\'chirish, yumshatish, pauza va fokusni to\'xtatish uchun PIN so\'raladi', 'On: turning off or loosening limits, pausing and stopping focus need the PIN', 'Включён: для отключения/ослабления лимитов, паузы и остановки фокуса нужен PIN') : L('Limitlarni o\'zingiz oson o\'chirib qo\'ymasligingiz uchun — PIN ni ishonchli odamga bering', 'So you can\'t switch limits off on a whim — give the PIN to someone you trust', 'Чтобы не отключать лимиты по прихоти — доверьте PIN близкому человеку')) + '</small></span>' +
      '<button type="button" class="fg-btn sm' + (c.pin ? ' ghost' : '') + '" data-fg-pin>' + E(c.pin ? L('O\'zgartirish', 'Change', 'Изменить') : L('O\'rnatish', 'Set PIN', 'Установить')) + '</button></div></div>';
  }
  function pageSettings() {
    return '<div class="fg-card fg-set">' + settingsRows() + '</div>' + extraSettingsHtml() + '<button type="button" class="fg-allbtn" data-fg-weekly><span>📊</span><b>' + E(L('Haftalik hisobot', 'Weekly report', 'Недельный отчёт')) + '</b><em>7 ' + E(L('kun', 'days', 'дн.')) + '</em><i>›</i></button>' + devicesHtml() + (real() ? '<div class="fg-card">' + codeFormHtml() + '</div>' : '') + getCards() +
      '<div class="fg-hint">⚙️ ' + E(L('Bu sozlamalar Profil → Sozlamalar → Focusgate bo\'limida ham bor.', 'These settings also live in Profile → Settings → Focusgate.', 'Эти настройки также есть в Профиль → Настройки → Focusgate.')) + '</div>';
  }

  // ---------- 🏆 Reyting: dunyo va do'stlar ----------
  var SOC = { world: null, board: null, focusing: null, at: 0, loading: false };
  async function loadSocial(force) {
    if (!sbOk() || SOC.loading || (!force && Date.now() - SOC.at < 60000)) return;
    SOC.loading = true;
    try {
      var r = await Promise.all([supabase.rpc('fg_world_stats', { p_days: 7 }), supabase.rpc('fg_friends_board', { p_days: 7 }), supabase.rpc('fg_friends_focus')]);
      SOC.world = r[0].data || null; SOC.board = r[1].data || []; SOC.focusing = r[2].data || [];
      SOC.at = Date.now();
    } catch (e) {}
    SOC.loading = false;
    rerender(); renderTogether();
  }
  function avatar(p) {
    var ph = p.photo || '';
    if (/^https?:\/\//.test(ph) || /^data:image\//.test(ph)) return '<span class="fg-av" style="background-image:url(' + E(ph) + ')"></span>';
    if (ph && ph.length <= 4) return '<span class="fg-av emo">' + E(ph) + '</span>';
    return '<span class="fg-av" style="--tc:' + color(p.id || p.name || '?') + '">' + E(String(p.name || '?').charAt(0).toUpperCase()) + '</span>';
  }
  function pageCompete() {
    if (!sbOk()) return '<div class="fg-card fg-empty">🔐 ' + E(L('Reyting uchun akkauntga kiring.', 'Sign in to see the rankings.', 'Войдите, чтобы увидеть рейтинг.')) + '</div>';
    if (!SOC.at) return '<div class="fg-card fg-empty">⏳ ' + E(L('Yuklanmoqda…', 'Loading…', 'Загрузка…')) + '</div>';
    var w = SOC.world || {}, h = '';
    // 🌍 Dunyo
    var mine = w.my_min, avg = w.avg_min || 0, better = w.better_than_pct;
    h += '<div class="fg-card fg-world"><div class="fg-card-h"><b>🌍 ' + E(L('Dunyo bo\'yicha · 7 kun', 'Worldwide · 7 days', 'В мире · 7 дней')) + '</b><small>' + (w.users || 0) + ' ' + E(L('foydalanuvchi', 'users', 'польз.')) + '</small></div>' +
      '<div class="fg-vs"><div><b>' + (mine != null ? E(fmt(mine)) : '—') + '</b><span>' + E(L('Siz / kun', 'You / day', 'Вы / день')) + '</span></div><i>vs</i><div><b>' + E(fmt(avg)) + '</b><span>' + E(L('O\'rtacha / kun', 'Average / day', 'В среднем / день')) + '</span></div></div>';
    if (better != null) h += '<div class="fg-better"><div class="fg-prog"><i style="width:' + better + '%"></i></div><span>' + (mine <= avg ? '🌿 ' : '📱 ') + E(L('Siz foydalanuvchilarning ' + better + '% idan kamroq ekranga qaraysiz', 'You spend less screen time than ' + better + '% of users', 'У вас меньше экранного времени, чем у ' + better + '% пользователей')) + '</span></div>';
    if ((w.apps || []).length) {
      var amax = Math.max.apply(null, w.apps.map(function (a) { return a.avg_min || 0; }).concat([1]));
      h += '<div class="fg-sec-t">' + E(L('Eng ko\'p vaqt olayotgan dasturlar (o\'rtacha / kun)', 'Biggest time sinks (average / day)', 'Больше всего времени (в среднем / день)')) + '</div><div class="fg-wapps">' + w.apps.map(function (a) {
        return '<div class="fg-wapp">' + tileFor(a.app, 'sm') + '<span class="fg-wapp-n"><b>' + E(a.label || labelOf(a.app)) + '</b><small>' + a.users + ' ' + E(L('kishi', 'people', 'чел.')) + '</small></span><span class="fg-prog"><i style="width:' + ((a.avg_min || 0) / amax * 100).toFixed(1) + '%"></i></span><em>' + E(fmt(a.avg_min || 0)) + '</em></div>';
      }).join('') + '</div>';
    } else h += '<div class="fg-hint">' + E(L('Dasturlar reytingi kamida 3 kishi ishlatgan dasturlar uchun chiqadi (anonim).', 'App averages appear once 3+ people use an app (anonymous).', 'Средние по приложениям появятся, когда их используют 3+ человека (анонимно).')) + '</div>';
    h += '</div>';
    // 👥 Do'stlar
    var board = (SOC.board || []).slice(), mode = UI.board || 'focus';
    board.sort(function (a, b) { return mode === 'focus' ? (b.focus_min - a.focus_min) || (a.screen_min - b.screen_min) : ((a.days ? a.screen_min : 1e9) - (b.days ? b.screen_min : 1e9)); });
    h += '<div class="fg-card fg-board"><div class="fg-card-h"><b>👥 ' + E(L('Do\'stlar bilan musobaqa · 7 kun', 'Friends challenge · 7 days', 'Соревнование с друзьями · 7 дней')) + '</b>' +
      '<div class="fg-seg"><button type="button" class="' + (mode === 'focus' ? 'on' : '') + '" data-fg-board="focus">🎯</button><button type="button" class="' + (mode === 'screen' ? 'on' : '') + '" data-fg-board="screen">📱</button></div></div>' +
      '<div class="fg-board-sub">' + E(mode === 'focus' ? L('Kim ko\'proq fokus qildi', 'Who focused the most', 'Кто больше фокусировался') : L('Kim ekranga kamroq qaradi (kunlik o\'rtacha)', 'Who used screens the least (daily average)', 'У кого меньше экранного времени (в среднем)')) + '</div>';
    board.forEach(function (p, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      var main = mode === 'focus' ? fmt(p.focus_min || 0) : (p.days ? fmt(p.screen_min) : '—');
      var sub = mode === 'focus' ? (p.sessions || 0) + ' ' + L('sessiya', 'sessions', 'сессий') + (p.days ? ' · 📱 ' + fmt(p.screen_min) + '/' + L('kun', 'day', 'день') : '') : '🎯 ' + fmt(p.focus_min || 0) + (p.blocks ? ' · 🛡 ' + p.blocks : '');
      h += '<div class="fg-brow' + (p.me ? ' me' : '') + '"><span class="fg-rank">' + medal + '</span>' + avatar(p) + '<span class="fg-bname"><b>' + E(p.me ? L('Siz', 'You', 'Вы') : (p.name || '—')) + '</b><small>' + E(sub) + (p.has_fg ? '' : ' · ' + L('Focusgate yo\'q', 'no Focusgate', 'без Focusgate')) + '</small></span><em>' + E(main) + '</em></div>';
    });
    if (board.length <= 1) h += '<div class="fg-empty sm">' + E(L('Do\'stlaringiz hali yo\'q yoki ular Focusgate ishlatmayapti. Taklif qiling — birga raqobatlashing!', 'No friends here yet. Invite them and compete together!', 'Друзей пока нет. Пригласите их и соревнуйтесь!')) + '<button type="button" class="fg-btn sm" data-fg-invite>👥 ' + E(L('Do\'stlar', 'Friends', 'Друзья')) + '</button></div>';
    h += '</div>';
    // 🤝 Hozir fokusda
    h += focusingHtml(true);
    // Mukofotlar
    h += '<div class="fg-card fg-rewards"><b>🎁 ' + E(L('Nima uchun mukofot beriladi', 'How you earn rewards', 'За что награды')) + '</b><ul>' +
      '<li>🎯 ' + E(L('Fokus sessiyasini oxirigacha yakunlash: har daqiqa = 1 XP, har 5 daqiqa = 1 🪙', 'Finish a focus session: 1 XP per minute, 1 🪙 per 5 minutes', 'Завершить фокус: 1 XP за минуту, 1 🪙 за 5 минут')) + '</li>' +
      '<li>🤝 ' + E(L('Do\'st bilan birga fokus: +20% bonus', 'Focus with a friend: +20% bonus', 'Фокус с другом: +20% бонус')) + '</li>' +
      '<li>🌿 ' + E(L('Kun bo\'yi barcha limitlarda qolish: +10 🪙', 'Stay within all limits for a day: +10 🪙', 'День в пределах всех лимитов: +10 🪙')) + '</li></ul></div>';
    return h;
  }
  function focusingHtml(withStart) {
    var list = SOC.focusing || [];
    var h = '<div class="fg-card fg-together"><div class="fg-card-h"><b>🤝 ' + E(L('Hozir fokusda', 'Focusing now', 'Сейчас в фокусе')) + '</b>' + (list.length ? '<small class="fg-live-n">● ' + list.length + '</small>' : '') + '</div>';
    if (!list.length) h += '<div class="fg-empty sm">' + E(L('Hozir hech bir do\'stingiz fokusda emas. Siz boshlang — ular qo\'shilishi mumkin!', 'None of your friends are focusing right now. Start one — they can join!', 'Сейчас никто из друзей не в фокусе. Начните — они смогут присоединиться!')) + '</div>';
    list.forEach(function (p) {
      var left = Math.max(0, new Date(p.ends_at).getTime() - Date.now()), min = Math.ceil(left / 60000);
      h += '<div class="fg-brow">' + avatar(p) + '<span class="fg-bname"><b>' + E(p.name || '—') + '</b><small>🎯 ' + E(L(min + ' daqiqa qoldi', min + ' min left', 'осталось ' + min + ' мин')) + (p.together ? ' · 👥 +' + p.together : '') + '</small></span>' +
        (focusLeft() > 0 ? '' : '<button type="button" class="fg-btn sm" data-fg-join="' + E(p.session) + '" data-min="' + min + '">' + E(L('Qo\'shilish', 'Join', 'Присоединиться')) + '</button>') + '</div>';
    });
    if (withStart && focusLeft() <= 0) h += '<button type="button" class="fg-add" data-fg-go="block">🎯 ' + E(L('Fokus boshlash', 'Start focus', 'Начать фокус')) + '</button>';
    return h + '</div>';
  }
  // Hub → Birga bo'limi uchun karta
  function renderTogether() {
    var el = document.getElementById('fg-together'); if (!el) return;
    if (!sbOk()) { el.innerHTML = ''; return; }
    el.className = 'fg-scope fg-tg-wrap';
    el.innerHTML = '<div class="fg-tg-h"><span>🔒</span><b>Focusgate · ' + E(L('Birga fokus', 'Focus together', 'Фокус вместе')) + '</b><button type="button" class="fg-emb-more" data-fg-go="compete">🏆 ' + E(L('Reyting', 'Rankings', 'Рейтинг')) + ' ›</button></div>' + focusingHtml(true);
    if (!SOC.at) loadSocial();
  }

  // ---------- 🔗 Fokus bus: Pomodoro 🍅 + Fokus rejimi 🧘 + Focusgate 🔒 bir-biriga ulangan ----------
  // Pomodoro ish bosqichi yoki Fokus rejimi taymeri ishlasa — Focusgate fokus ro'yxatidagi dasturlar bloklanadi.
  // Har biri alohida ishlayveradi; Focusgate'da qo'lda boshlangan sessiyaga tegilmaydi.
  var SRC = { pomo: ['🍅', ['Pomodoro', 'Pomodoro', 'Pomodoro']], focusmode: ['🧘', ['Fokus rejimi', 'Focus mode', 'Режим фокуса']], focusgate: ['🔒', ['Focusgate', 'Focusgate', 'Focusgate']] };
  // Bog'lanish yoqilganmi: umumiy sozlama (cfg.linkFocus) va manba bo'yicha (cfg.linkOff.pomo / .focusmode)
  function linkOn(src) { var c = cfg(); return c.linkFocus !== false && !(c.linkOff && c.linkOff[src]); }
  function setLink(src, on, after) {
    if (!real()) { needConnect(); return; }
    var c = cfg(), active = (c.focusUntil || 0) > Date.now() && linkOwner() === src;
    if (!on && active && c.strict) { try { toast('🔐 ' + L('Qat\'iy rejim: fokus tugaguncha o\'chirib bo\'lmaydi', 'Strict mode: can\'t turn off until focus ends', 'Строгий режим: нельзя выключить до конца фокуса')); } catch (e) {} return; }
    var apply = function () {
      var cc = cfg(); cc.linkOff = Object.assign({}, cc.linkOff || {});
      if (on) { delete cc.linkOff[src]; cc.linkFocus = true; var st = fgS(); if (st.linkMute === src) st.linkMute = null; } else cc.linkOff[src] = true;
      saveCfg(); save();
      if (!on) window.LUFocusBus.sync(src, 0); // shu manba boshlagan bloklash darhol to'xtaydi
      else { try { window.dispatchEvent(new CustomEvent('lu-fg-relink', { detail: src })); } catch (e) {} } // ishlab turgan Pomodoro darhol qayta ulansin
      try { toast((on ? '🔒 ' : '🔓 ') + SRC[src][0] + ' ' + T(SRC[src][1]) + ' — ' + (on ? L('Focusgate bloklashi yoqildi', 'Focusgate blocking on', 'блокировка Focusgate включена') : L('Focusgate bloklashi o\'chirildi', 'Focusgate blocking off', 'блокировка Focusgate выключена'))); } catch (e) {}
      if (after) after(); rerender();
    };
    if (!on && active) guard(apply); else apply();
  }
  function fgS() { if (!S.focusgate || typeof S.focusgate !== 'object') S.focusgate = {}; return S.focusgate; }
  function linkOwner() { try { return (S.focusgate && S.focusgate.linkSrc) || null; } catch (e) { return null; } }
  window.LUFocusBus = {
    sync: function (src, until, label) {
      if (!real()) return;
      var c = cfg();
      if (!linkOn(src)) until = 0; // bog'lanish o'chirilgan — shu manba boshlagan bloklash ham to'xtaydi
      var now = Date.now(), cur = c.focusUntil || 0, owner = linkOwner(), st = fgS();
      if (until > now) {
        if (st.linkMute === src) return;                          // foydalanuvchi Focusgate'da to'xtatgan
        if (cur > now && owner !== src) return;                   // boshqa sessiya davom etmoqda
        if (owner === src && Math.abs(cur - until) < 30000) return; // o'zgarish yo'q
        var first = owner !== src;
        st.linkSrc = src; st.linkLabel = label || ''; c.focusUntil = until; saveCfg(); save(); rerender();
        if (first) {
          var n = (c.focusApps || []).filter(function (f) { return f.on; }).length;
          try { toast('🔒 Focusgate: ' + (n ? L(n + ' ta dastur bloklandi', n + ' apps blocked', 'заблокировано: ' + n) : L('fokus ro\'yxati bo\'sh', 'focus list is empty', 'список фокуса пуст')) + ' · ' + SRC[src][0] + ' ' + T(SRC[src][1])); } catch (e) {}
          // Do'stlar "hozir fokusda" va reytingda ko'rishi uchun sessiya yozuvi (XP — Pomodoro/Fokus rejimining o'zida)
          var mins = Math.max(1, Math.round((until - now) / 60000));
          st.linkSess = { start: now, src: src };
          supabase.from('fg_sessions').insert({ planned_min: Math.min(600, mins) }).select('id').single().then(function (r) { if (r && r.data && st.linkSess) { st.linkSess.id = r.data.id; save(); } }, function () {});
        }
      } else {
        if (st.linkMute === src) { st.linkMute = null; save(); }
        if (owner !== src) return;
        st.linkSrc = null;
        if (cur > now) { c.focusUntil = 0; saveCfg(); }
        var ls = st.linkSess; st.linkSess = null;
        if (ls && ls.id) supabase.from('fg_sessions').update({ ended_at: new Date().toISOString() }).eq('id', ls.id).then(function () {}, function () {});
        save(); rerender();
      }
    },
    // Pomodoro / Fokus rejimi oynasida: "🔒 Focusgate: 3 ta dastur bloklanadi" + yoqish/o'chirish tugmasi
    badge: function (box, running, src) {
      if (!box) return;
      src = src || (box.id === 'pomo-hero' ? 'pomo' : 'focusmode');
      var el = box.querySelector(':scope > .fg-busbadge');
      if (!real()) { if (el) el.remove(); return; }
      var c = cfg(), on = linkOn(src), n = c.allowOnly ? -1 : (c.focusApps || []).filter(function (f) { return f.on; }).length;
      var what = n < 0 ? L('faqat ruxsat etilganlar ishlaydi', 'only allowed apps work', 'работают только разрешённые') : n ? L(n + ' ta dastur', n + ' apps', n + ' прил.') : L('ro\'yxat bo\'sh — qo\'shing', 'list is empty — add apps', 'список пуст — добавьте');
      var txt = on ? '🔒 Focusgate · ' + (running ? (n < 0 ? what : n ? L(n + ' ta dastur bloklangan', n + ' apps blocked', 'заблокировано: ' + n) : what) : L('boshlaganda bloklanadi: ', 'blocks when started: ', 'заблокирует при старте: ') + what)
        : '🔓 Focusgate · ' + L('bloklash o\'chiq', 'blocking is off', 'блокировка выключена');
      if (!el) {
        el = document.createElement('div'); el.className = 'fg-busbadge';
        el.innerHTML = '<button type="button" class="fg-bus-l"></button><button type="button" class="fg-sw fg-bus-sw" role="switch"><i></i></button>';
        el.querySelector('.fg-bus-l').onclick = function () { try { if (typeof pomoCloseModal === 'function') pomoCloseModal(); } catch (e) {} window.xOpenBlocker('block'); };
        el.querySelector('.fg-bus-sw').onclick = function (e) { e.stopPropagation(); setLink(el.dataset.src, !linkOn(el.dataset.src), function () { window.LUFocusBus.badge(box, el.dataset.run === '1', el.dataset.src); }); };
        box.appendChild(el);
      }
      el.dataset.src = src; el.dataset.run = running ? '1' : '0';
      el.classList.toggle('off', !on);
      var lb = el.querySelector('.fg-bus-l'), sw0 = el.querySelector('.fg-bus-sw');
      if (lb.textContent !== txt) lb.textContent = txt;
      sw0.classList.toggle('on', on); sw0.setAttribute('aria-checked', on ? 'true' : 'false');
      sw0.setAttribute('aria-label', L('Focusgate bilan bloklash', 'Block with Focusgate', 'Блокировать через Focusgate'));
    },
    owner: linkOwner
  };

  // ---------- 🎯 Fokus sessiyalari: server yozuvi, XP/tanga, tasma ----------
  function sess() { try { return (S.focusgate && S.focusgate.sess) || null; } catch (e) { return null; } }
  async function startFocus(min, joinedFrom) {
    var c = cfg();
    c.focusUntil = Date.now() + min * 60000; saveCfg();
    if (!S.focusgate) S.focusgate = {};
    S.focusgate.sess = { id: null, start: Date.now(), end: c.focusUntil, min: min, joined: !!joinedFrom, awarded: false, stopped: false };
    S.focusgate.linkSrc = 'focusgate';
    save(); rerender();
    try { toast('🎯 ' + L('Fokus boshlandi — ' + min + ' daqiqa. Kompyuter 30 soniyada qabul qiladi.', 'Focus started — ' + min + ' min. Your PC picks it up within 30 s.', 'Фокус начат — ' + min + ' мин. ПК получит за 30 с.')); } catch (e) {}
    try {
      var r = await supabase.from('fg_sessions').insert({ planned_min: min, joined_from: joinedFrom || null }).select('id').single();
      if (r.data && sess()) { S.focusgate.sess.id = r.data.id; save(); }
    } catch (e) {}
    try { if (window.xFeedPost) window.xFeedPost('focus', L(min + ' daqiqalik fokus boshladi', 'started a ' + min + '-minute focus', 'начал(а) фокус на ' + min + ' мин') + (joinedFrom ? ' 🤝' : ''), '🎯'); } catch (e) {}
    SOC.at = 0;
  }
  async function stopFocus() {
    var c = cfg(), s = sess(), own = linkOwner();
    c.focusUntil = 0; saveCfg();
    // Pomodoro/Fokus rejimi boshlagan bo'lsa — ular davom etsa ham shu seansda qayta bloklamaymiz
    if (own && own !== 'focusgate') { S.focusgate.linkMute = own; var ls = S.focusgate.linkSess; S.focusgate.linkSess = null; if (ls && ls.id) try { supabase.from('fg_sessions').update({ ended_at: new Date().toISOString() }).eq('id', ls.id).then(function () {}); } catch (e) {} }
    S.focusgate.linkSrc = null; save();
    if (own && own !== 'focusgate') { rerender(); return; }
    if (s) { s.stopped = true; save(); if (s.id) try { await supabase.from('fg_sessions').update({ ended_at: new Date().toISOString() }).eq('id', s.id); } catch (e) {} }
    rerender();
  }
  function joinFocus(sessionId, min) {
    if (!real()) { needConnect(); return; }
    if (focusLeft() > 0) return;
    fgS().joined = true;
    startFocus(Math.max(1, Math.min(600, min || 25)), sessionId);
  }
  // Sessiya o'z vaqtida tugasa — XP va tanga (bir marta)
  function checkFocusDone() {
    var s = sess();
    if (!s || s.awarded || s.stopped || Date.now() < s.end) return;
    s.awarded = true;
    S.focusgate.focusMin = (S.focusgate.focusMin || 0) + s.min;
    S.focusgate.focusDone = (S.focusgate.focusDone || 0) + 1;
    var xp = Math.round(s.min * (s.joined ? 1.2 : 1)), coins = Math.floor(s.min / 5 * (s.joined ? 1.2 : 1));
    try { addXP(xp, '🎯 Focusgate: ' + s.min + ' ' + L('daqiqa fokus', 'min focus', 'мин фокуса')); } catch (e) {}
    if (coins > 0) { S.coins = (S.coins || 0) + coins; try { addTarixLog('in', '🎯 Focusgate: ' + s.min + ' ' + L('daqiqa fokus', 'min focus', 'мин фокуса'), coins, 'fg-focus-' + s.start); } catch (e) {} }
    save();
    try { if (typeof render === 'function') render(); } catch (e) {}
    try { toast('🎉 ' + L('Fokus yakunlandi! +' + xp + ' XP' + (coins ? ', +' + coins + ' 🪙' : ''), 'Focus complete! +' + xp + ' XP' + (coins ? ', +' + coins + ' 🪙' : ''), 'Фокус завершён! +' + xp + ' XP' + (coins ? ', +' + coins + ' 🪙' : ''))); } catch (e) {}
    try { if (window.xFeedPost) window.xFeedPost('focus', L(s.min + ' daqiqa fokusni yakunladi', 'completed ' + s.min + ' minutes of focus', 'завершил(а) ' + s.min + ' мин фокуса'), '🏁'); } catch (e) {}
    SOC.at = 0;
  }

  // ---------- 🧩 Sayt ichida bloklash (kengaytma) ----------
  // [sayt, nom, rang, [[sozlama, nom, ikonka]], bo'limlar]
  var INSITE = [
    ['site:youtube', 'YouTube', '#FF0033', [['yt_shorts', ["Shorts'ni bloklash", 'Block Shorts', 'Блокировать Shorts'], '📹'], ['yt_search', ['Video qidiruvni bloklash', 'Block video search', 'Блокировать поиск видео'], '🔍'], ['yt_pip', ['Picture-in-picture rejimini bloklash', 'Block picture-in-picture mode', 'Блокировать режим «картинка в картинке»'], '🖼'], ['yt_comments', ['Izohlarni yashirish', 'Hide comments', 'Скрыть комментарии'], '💬'], ['yt_home', ['Tavsiyalarni yashirish', 'Hide recommendations', 'Скрыть рекомендации'], '🏠']]],
    ['site:instagram', 'Instagram', '#E1306C', [['ig_reels', ["Reels'ni bloklash", 'Block Reels', 'Блокировать Reels'], '🎞'], ['ig_explore', ["Explore'ni bloklash", 'Block Explore', 'Блокировать «Интересное»'], '🧭'], ['ig_stories', ["Stories'ni bloklash", 'Block Stories', 'Блокировать Stories'], '⭕']]],
    ['site:facebook', 'Facebook', '#1877F2', [['fb_reels', ['Reels va Watch\'ni bloklash', 'Block Reels & Watch', 'Блокировать Reels и Watch'], '🎞'], ['fb_stories', ["Stories'ni bloklash", 'Block Stories', 'Блокировать Stories'], '⭕']]],
    ['site:tiktok', 'TikTok', '#25F4EE', [['tt_fyp', ['"For You" lentasini bloklash', 'Block the For You feed', 'Блокировать ленту «Для вас»'], '🔁'], ['tt_comments', ['Izohlarni yashirish', 'Hide comments', 'Скрыть комментарии'], '💬']]],
    ['site:x', 'X (Twitter)', '#111111', [['x_explore', ["Explore'ni bloklash", 'Block Explore', 'Блокировать «Обзор»'], '🧭'], ['x_trends', ['Trendlarni yashirish', 'Hide trends', 'Скрыть тренды'], '📈']]],
    ['site:reddit', 'Reddit', '#FF4500', [['rd_popular', ['r/popular va r/all ni bloklash', 'Block r/popular and r/all', 'Блокировать r/popular и r/all'], '🔥']]]
  ];
  // Kunlik limit qo'yish mumkin bo'lgan sozlamalar → bo'lim (kengaytma: insite.js LIMSEC bilan bir xil)
  var INSITE_SEC = { yt_shorts: 'shorts', ig_reels: 'reels', fb_reels: 'reels', tt_fyp: 'fyp' };
  var SEC_INFO = { shorts: ['Shorts', '#22b5e8'], search: [['Qidiruv', 'Search', 'Поиск'], '#f59e0b'], pip: ['PiP', '#84cc16'], watch: [['Video', 'Video', 'Видео'], '#a78bfa'], other: [['Boshqa', 'Other', 'Другое'], '#c084fc'],
    reels: ['Reels', '#ec4899'], explore: ['Explore', '#f59e0b'], stories: ['Stories', '#22c55e'], direct: ['Direct', '#3b82f6'], feed: [['Lenta', 'Feed', 'Лента'], '#a78bfa'], fyp: ['For You', '#25F4EE'], following: [['Obunalar', 'Following', 'Подписки'], '#f43f5e'] };
  function secName(k) { var x = SEC_INFO[k]; return x ? (Array.isArray(x[0]) ? T(x[0]) : x[0]) : k; }
  function hasExt() { return FG.devices.some(function (d) { return /^ext-/.test(d.agent_version || ''); }); }
  // 🍩 Oxirgi 7 kunda sayt bo'limlarida o'tgan vaqt (Shorts 88%, Boshqa 12% ...)
  function donutHtml(site) {
    var secs = sections(site, 7), keys = Object.keys(secs).filter(function (k) { return secs[k] >= 30; }).sort(function (a, b) { return secs[b] - secs[a]; });
    var tot = sumArr(keys.map(function (k) { return secs[k]; }));
    var h = '<div class="fg-donut-w"><div class="fg-donut-t">' + E(L('Oxirgi 7 kun', 'Last 7 days of usage', 'Последние 7 дней')) + ' <span class="fg-q" title="' + E(L('Kengaytma (v0.6+) sayt bo\'limlarida o\'tgan vaqtni hisoblaydi', 'The extension (v0.6+) counts time per site section', 'Расширение (v0.6+) считает время по разделам сайта')) + '">?</span></div>';
    if (!tot) return h + '<div class="fg-empty sm">' + E(L('Hali ma\'lumot yo\'q — kengaytma v0.6 bo\'limlarni hisoblay boshlaydi.', 'No data yet — extension v0.6 starts counting sections.', 'Пока нет данных — расширение v0.6 начнёт считать разделы.')) + '</div></div>';
    var off = 25, segs = keys.map(function (k) { var p = secs[k] / tot * 100, seg = '<circle r="15.915" cx="21" cy="21" fill="none" stroke="' + SEC_INFO[k][1] + '" stroke-width="3.2" stroke-dasharray="' + Math.max(0, p - 0.6).toFixed(2) + ' ' + (100 - Math.max(0, p - 0.6)).toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"></circle>'; off = (off - p + 100) % 100; return seg; }).join('');
    return h + '<div class="fg-donut"><svg viewBox="0 0 42 42" aria-hidden="true">' + segs + '</svg><div class="fg-donut-c"><b>' + E(fmt(tot / 60)) + '</b><small>' + E(L('7 kunda', '7 days', 'за 7 дней')) + '</small></div></div>' +
      '<div class="fg-donut-l">' + keys.map(function (k) { return '<span><i style="background:' + SEC_INFO[k][1] + '"></i>' + E(secName(k)) + ' <b>' + (secs[k] / tot * 100).toFixed(1) + '%</b> <small>' + E(fmt(secs[k] / 60)) + '</small></span>'; }).join('') + '</div></div>';
  }
  function inSiteHtml() {
    var c = cfg(), o = c.inSite || {}, lim = c.inSiteLim || {}, h = '<div class="fg-group-t" data-anchor="insite">🧩 ' + E(L('Ilova ichida bloklash', 'In-app blocking', 'Блокировка внутри сайтов')) + ' <small>· ' + E(L('brauzer kengaytmasi', 'browser extension', 'расширение браузера')) + '</small></div>';
    if (real() && !hasExt() && DOWNLOADS_ON) h += '<div class="fg-extnote"><span>🧩</span><div><b>' + E(L('Kengaytma o\'rnatilmagan', 'Extension not installed', 'Расширение не установлено')) + '</b><small>' + E(L('Bu sozlamalar Chrome/Edge kengaytmasi orqali ishlaydi.', 'These settings work through the Chrome/Edge extension.', 'Эти настройки работают через расширение Chrome/Edge.')) + '</small></div><button type="button" class="fg-btn sm" data-fg-extinstall>⬇ ' + E(L('O\'rnatish', 'Install', 'Установить')) + '</button></div>';
    INSITE.forEach(function (s) {
      var n = s[3].filter(function (x) { return o[x[0]]; }).length, open = UI.openSite === s[0];
      h += '<div class="fg-card fg-acc' + (open ? ' open' : '') + '"><button type="button" class="fg-acc-h" data-fg-acc="' + s[0] + '">' + tileFor(s[0]) + '<b>' + E(s[1]) + (n ? ' <small>(' + n + ')</small>' : '') + '</b><span class="fg-chev">⌄</span></button><div class="fg-acc-b">' + (open ? donutHtml(s[0]) : '') +
        s[3].map(function (x) {
          var on = !!o[x[0]], sec = INSITE_SEC[x[0]], row = '<div class="fg-opt"><span class="fg-is-l"><i>' + x[2] + '</i>' + E(T(x[1])) + '</span>' + sw(on, 'data-fg-insite="' + x[0] + '"', c.strict && on && real()) + '</div>';
          if (on && sec) {
            var lm = +lim[x[0]] || 0, today = (sections(s[0], 1, true)[sec] || 0) / 60;
            row += '<div class="fg-islim"><label>' + E(L('Kunlik limit', 'Daily usage limit', 'Дневной лимит')) + ': <select class="fg-sel sm" data-fg-islim="' + x[0] + '">' + [0, 15, 30, 60, 120, 180].map(function (m) { return '<option value="' + m + '"' + (lm === m ? ' selected' : '') + '>' + E(m ? fmt(m) : L('limitsiz — to\'liq blok', 'none — always blocked', 'нет — блок всегда')) + '</option>'; }).join('') + '</select></label>' +
              '<small>' + E(L('Bugun', 'Time spent today', 'Сегодня')) + ': <b>' + E(fmt(today)) + '</b>' + (lm ? (today >= lm ? ' · ⛔ ' + L('limit tugadi', 'limit reached', 'лимит исчерпан') : ' · ' + L('qoldi ', 'left ', 'осталось ') + fmt(lm - today)) : '') + '</small></div>';
          }
          return row;
        }).join('') + '</div></div>';
    });
    return h;
  }
  var EXT_URL = 'downloads/focusgate-extension.zip?v=' + AGENT_VERSION;
  function openExtInstall() {
    var edge = /Edg\//.test(navigator.userAgent);
    var page = edge ? 'edge://extensions' : 'chrome://extensions';
    function step(n, title, body, img) {
      return '<div class="fg-gstep"><span class="fg-gnum">' + n + '</span><div class="fg-gbody"><b>' + title + '</b>' + (body ? '<small>' + body + '</small>' : '') + (img ? '<img src="downloads/guide/' + img + '" alt="" loading="lazy">' : '') + '</div></div>';
    }
    var q = function (ru, en) { return '<span class="fg-q">' + E(ru) + '</span> / <span class="fg-q">' + E(en) + '</span>'; };
    openSheet('<h3>🧩 ' + E(L('Kengaytmani o\'rnatish', 'Install the extension', 'Установка расширения')) + '</h3>' +
      '<p class="fg-p">' + E(L('5 daqiqalik ish. Chrome, Edge, Brave, Opera va Yandex brauzerlarida ishlaydi. Faqat kompyuterda.', 'Takes 5 minutes. Works in Chrome, Edge, Brave, Opera and Yandex. Computer only.', 'Займёт 5 минут. Работает в Chrome, Edge, Brave, Opera и Яндекс. Только на компьютере.')) + '</p>' +
      '<div class="fg-guide">' +
      step(1, E(L('ZIP faylni yuklab oling', 'Download the ZIP', 'Скачайте ZIP')), '<a class="fg-btn sm" href="' + EXT_URL + '" download="focusgate-extension.zip">⬇ focusgate-extension.zip</a>') +
      step(2, E(L('ZIP ni oching (papkaga chiqaring)', 'Extract the ZIP', 'Распакуйте ZIP')),
        E(L('Yuklanmalar papkasida ZIP ustiga sichqonchaning o\'ng tugmasi → ', 'In Downloads, right-click the ZIP → ', 'В «Загрузках» правой кнопкой по ZIP → ')) + q('Извлечь все…', 'Extract All…') + ' → ' + q('Извлечь', 'Extract') + '. ' +
        E(L('"focusgate-extension" papkasi paydo bo\'ladi — ichida manifest.json bor.', 'You get a "focusgate-extension" folder with manifest.json inside.', 'Появится папка «focusgate-extension» с manifest.json внутри.'))) +
      step(3, E(L('Kengaytmalar sahifasini oching va "Developer mode" ni yoqing', 'Open the extensions page and turn on "Developer mode"', 'Откройте страницу расширений и включите «Режим разработчика»')),
        '<span class="fg-copy"><code class="fg-code-in">' + page + '</code><button type="button" class="fg-btn sm ghost" data-fg-copyext="' + page + '">📋 ' + E(L('Nusxalash', 'Copy', 'Копировать')) + '</button></span>' +
        E(L(' — yangi tab ochib, manzil qatoriga qo\'ying va Enter. O\'ng yuqoridagi ', ' — paste into a new tab\'s address bar and press Enter. Top-right switch ', ' — вставьте в адресную строку новой вкладки и нажмите Enter. Переключатель справа вверху ')) + q('Режим разработчика', 'Developer mode') +
        E(L(' ni yoqing' + (edge ? ' (Edge\'da chap pastda)' : '') + '.', (edge ? ' (bottom-left in Edge)' : '') + '.', (edge ? ' (в Edge — слева внизу)' : '') + '.')), 'ext-1.png') +
      step(4, q('Загрузить распакованное', 'Load unpacked') + E(L(' tugmasini bosing va papkani tanlang', ' — then choose the folder', ' — и выберите папку')),
        E(L('2-qadamdagi "focusgate-extension" papkasini tanlang (ichiga kirib, manifest.json ko\'rinadigan papka) → ', 'Pick the "focusgate-extension" folder from step 2 (the one where manifest.json is visible) → ', 'Выберите папку «focusgate-extension» из шага 2 (ту, где виден manifest.json) → ')) + q('Выбор папки', 'Select Folder'), 'ext-2.png') +
      step('✓', E(L('Tayyor! LevelUpDay o\'zi ochiladi — "Ulash" ni bosing', 'Done! LevelUpDay opens — press "Connect"', 'Готово! Откроется LevelUpDay — нажмите «Подключить»')),
        E(L('Qulaylik uchun: brauzerning o\'ng yuqorisidagi 🧩 belgisi → Focusgate yonidagi 📌 — belgi doim ko\'rinib turadi.', 'Tip: click 🧩 in the top-right of the browser → 📌 next to Focusgate to keep it visible.', 'Совет: 🧩 справа вверху браузера → 📌 рядом с Focusgate, чтобы значок был всегда виден.')), 'ext-3.png') +
      '</div>' +
      '<details class="fg-trouble"><summary>❓ ' + E(L('Ishlamadimi? Ko\'p uchraydigan xatolar', 'Didn\'t work? Common problems', 'Не получилось? Частые ошибки')) + '</summary>' +
      '<ul><li><b>"Manifest file is missing"</b> — ' + E(L('noto\'g\'ri papka tanlangan. Papkaga kiring: ichida yana "focusgate-extension" bo\'lsa — o\'shani tanlang. To\'g\'ri papkada manifest.json fayli ko\'rinadi.', 'wrong folder. Open it: if there is another "focusgate-extension" inside, choose that one. The right folder shows manifest.json.', 'выбрана не та папка. Откройте её: если внутри ещё одна «focusgate-extension» — выберите её. В нужной папке виден manifest.json.')) + '</li>' +
      '<li><b>' + E(L('ZIP o\'zini tanlab bo\'lmaydi', 'You can\'t pick the ZIP itself', 'Нельзя выбрать сам ZIP')) + '</b> — ' + E(L('avval 2-qadam: ZIP ni oching (Extract).', 'do step 2 first: extract it.', 'сначала шаг 2: распакуйте.')) + '</li>' +
      '<li><b>' + E(L('"Load unpacked" tugmasi yo\'q', 'No "Load unpacked" button', 'Нет кнопки «Загрузить распакованное»')) + '</b> — ' + E(L('"Developer mode" yoqilmagan (3-qadam).', '"Developer mode" is off (step 3).', '«Режим разработчика» выключен (шаг 3).')) + '</li>' +
      '<li><b>' + E(L('Papkani o\'chirmang', 'Don\'t delete the folder', 'Не удаляйте папку')) + '</b> — ' + E(L('kengaytma shu papkadan ishlaydi. Uni Hujjatlar kabi doimiy joyga ko\'chirib, keyin o\'rnatgan ma\'qul.', 'the extension runs from it. Move it somewhere permanent (e.g. Documents) before installing.', 'расширение работает из неё. Лучше перенести её в постоянное место (например, «Документы»).')) + '</li>' +
      '<li><b>' + E(L('Telefonda ishlamaydi', 'Not on phones', 'Не работает на телефоне')) + '</b> — ' + E(L('kengaytmalar faqat kompyuter brauzerida.', 'extensions only work in desktop browsers.', 'расширения работают только в браузере на компьютере.')) + '</li></ul></details>');
    document.querySelectorAll('[data-fg-copyext]').forEach(function (cp) { cp.onclick = function () { try { navigator.clipboard.writeText(page); toast('📋 ' + page + ' — ' + L('yangi tabga qo\'ying', 'paste into a new tab', 'вставьте в новую вкладку')); } catch (e) {} }; });
  }


  // ---------- 🧩 Ilova ichidagi kartalar: Profil → Statistika va Profil → Sozlamalar ----------
  function statsCardHtml() {
    if (!real()) return '<div class="fg-emb-h"><span class="fg-emb-ic">' + SHIELD.replace(/26/g, '18') + '</span><div><b>' + E(L('Ekran vaqti', 'Screen time', 'Экранное время')) + '</b><small>Focusgate · ' + E(L('ulanmagan', 'not connected', 'не подключено')) + '</small></div>' +
      '<button type="button" class="fg-emb-more" data-fg-go="today">' + E(L('Ulash', 'Connect', 'Подключить')) + ' ›</button></div>' +
      '<div class="fg-empty sm">💻 ' + E(L('Statistika uchun kompyuterga Focusgate.exe yoki brauzerga kengaytmani o\'rnating.', 'Install Focusgate.exe on your PC or the browser extension to see stats.', 'Установите Focusgate.exe на ПК или расширение браузера, чтобы видеть статистику.')) + '</div>';
    var dm = dayModel(0), total = dm.apps.reduce(function (s, a) { return s + a.m; }, 0), max = Math.max.apply(null, dm.hours.concat([0.0001]));
    var week = weekOf(null), prev = week.slice(0, 6).filter(function (x) { return x > 0; });
    var avg = prev.length ? prev.reduce(function (s, x) { return s + x; }, 0) / prev.length : 0;
    var diff = avg ? Math.round((total - avg) / avg * 100) : 0;
    var daily = (cfg().rules || []).filter(function (r) { return r.on && r.kind === 'daily'; });
    var over = daily.filter(function (r) { var m = ruleMin(r, 0); return m > 0 && usedMin(r.app, 0) >= m; });
    var top = dm.apps.slice(0, 4);
    var h = '<div class="fg-emb-h"><span class="fg-emb-ic">' + SHIELD.replace(/26/g, '18') + '</span>' +
      '<div><b>' + E(L('Ekran vaqti', 'Screen time', 'Экранное время')) + '</b><small>Focusgate · ' + E(real() ? (online() ? L('onlayn', 'online', 'онлайн') : ago(FG.devices[0] && FG.devices[0].last_seen)) : L('namuna', 'sample', 'пример')) + '</small></div>' +
      '<button type="button" class="fg-emb-more" data-fg-go="today">' + E(L('Batafsil', 'Details', 'Подробнее')) + ' ›</button></div>';
    h += '<div class="fg-emb-kpis">' +
      '<div><b>' + E(fmt(total)) + '</b><span>' + E(L('Bugun', 'Today', 'Сегодня')) + '</span></div>' +
      '<div class="' + (diff > 0 ? 'up' : 'down') + '"><b>' + (avg ? (diff > 0 ? '▲ ' : '▼ ') + Math.abs(diff) + '%' : '—') + '</b><span>' + E(L('Haftalik o\'rtachaga', 'vs weekly avg', 'к среднему за неделю')) + '</span></div>' +
      '<div class="' + (over.length ? 'up' : 'down') + '"><b>' + (daily.length ? (daily.length - over.length) + '/' + daily.length : '—') + '</b><span>' + E(L('Limitda', 'Within limit', 'В пределах')) + '</span></div></div>';
    h += '<div class="fg-emb-spark" aria-hidden="true">' + dm.hours.map(function (v) { return '<i style="height:' + Math.max(v >= 0.05 ? 6 : 2, v / max * 100) + '%"' + (v >= 0.05 ? '' : ' class="z"') + '></i>'; }).join('') + '</div>' +
      '<div class="fg-emb-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>';
    if (top.length) {
      h += '<div class="fg-emb-top">' + top.map(function (a) {
        var lim = daily.filter(function (x) { return x.app === a.id; })[0], red = lim && ruleMin(lim, 0) > 0 && a.m >= ruleMin(lim, 0);
        return '<button type="button" class="fg-emb-app" data-fg-appopen="' + E(a.id) + '">' + tile(a, 'sm') + '<span class="fg-emb-n">' + E(a.n) + '</span><span class="fg-prog' + (red ? ' red' : '') + '"><i style="width:' + (a.m / top[0].m * 100).toFixed(1) + '%"></i></span><b>' + E(fmt(a.m)) + '</b></button>';
      }).join('') + '</div>';
    } else h += '<div class="fg-empty sm">' + E(L('Bugun hali ma\'lumot yo\'q', 'No data yet today', 'Сегодня пока нет данных')) + '</div>';
    if (SOC.world && SOC.world.my_min != null) {
      var bd = (SOC.board || []).slice().sort(function (a, b) { return (b.focus_min - a.focus_min) || (a.screen_min - b.screen_min); });
      var rank = bd.findIndex(function (p) { return p.me; }) + 1;
      h += '<button type="button" class="fg-emb-soc" data-fg-go="compete"><span>🌍 ' + E(L('O\'rtacha', 'Avg', 'Средн.')) + ' <b>' + E(fmt(SOC.world.avg_min || 0)) + '</b>' + (SOC.world.better_than_pct != null ? ' · ' + E(L(SOC.world.better_than_pct + '% dan yaxshi', 'better than ' + SOC.world.better_than_pct + '%', 'лучше ' + SOC.world.better_than_pct + '%')) : '') + '</span>' +
        (bd.length > 1 ? '<span>👥 #' + rank + ' / ' + bd.length + '</span>' : '') + '<i>›</i></button>';
    } else if (sbOk() && real()) loadSocial();
    if (over.length) h += '<button type="button" class="fg-emb-warn" data-fg-go="limits">⛔ ' + E(over.map(function (x) { return x.label || labelOf(x.app); }).join(', ')) + ' — ' + E(L('limit tugadi', 'limit reached', 'лимит исчерпан')) + ' ›</button>';
    if (!real() && DOWNLOADS_ON) h += '<a class="fg-emb-cta" href="' + DOWNLOAD_URL + '" download="Focusgate.exe" rel="noopener">💻 ' + E(L('Haqiqiy statistika uchun kompyuterni ulang — Focusgate.exe', 'Connect your PC for real stats — Focusgate.exe', 'Подключите ПК для реальной статистики — Focusgate.exe')) + ' ⬇</a>';
    return h;
  }
  function settingsCardHtml() {
    var c = cfg();
    var nL = (c.rules || []).filter(function (x) { return x.on; }).length, nF = (c.focusApps || []).filter(function (x) { return x.on; }).length;
    return (real() || !DOWNLOADS_ON ? '' : '<div class="fg-emb-note">💻 ' + E(L('Kompyuter hali ulanmagan — quyidan Focusgate.exe ni yuklab oling.', 'No computer connected yet — download Focusgate.exe below.', 'Компьютер ещё не подключён — скачайте Focusgate.exe ниже.')) + '</div>') +
      '<div class="fg-emb-set">' + settingsRows() + '</div>' + devicesHtml() +
      '<div class="fg-emb-links">' +
      '<button type="button" data-fg-go="limits"><span>⏳</span><b>' + E(L('Limitlar', 'Limits', 'Лимиты')) + '</b><small>' + nL + ' ' + E(L('faol', 'active', 'активно')) + '</small><i>›</i></button>' +
      '<button type="button" data-fg-go="block"><span>🚫</span><b>' + E(L('Fokusda bloklash', 'Focus blocking', 'Блокировка в фокусе')) + '</b><small>' + nF + ' ' + E(L('dastur', 'apps', 'прил.')) + '</small><i>›</i></button>' +
      '<button type="button" data-fg-go="today"><span>📊</span><b>' + E(L('Ekran vaqti', 'Screen time', 'Экранное время')) + '</b><small>' + E(L('statistika', 'statistics', 'статистика')) + '</small><i>›</i></button></div>' + getCards();
  }
  function renderEmbeds() {
    loadLocal();
    var st = document.getElementById('fg-stats-card'); if (st) st.innerHTML = statsCardHtml();
    var se = document.getElementById('fg-settings-root'); if (se) se.innerHTML = settingsCardHtml();
    try { var sub = document.querySelector('#focusgate-settings-card .fg-set-sub'); if (sub) sub.textContent = L('Ekran vaqti, limitlar va bloklash', 'Screen time, limits and blocking', 'Экранное время, лимиты и блокировка'); } catch (e) {}
  }

  // ---------- 🔑 PIN-kod: bo'shashtiruvchi amallar oldidan so'raladi (2 daqiqa eslab qolinadi) ----------
  function pinOn() { return !!(real() && cfg().pin); }
  async function pinHash(p) {
    var b = new TextEncoder().encode('lud-fg:' + (S.cloudUserId || '') + ':' + p);
    var h = await crypto.subtle.digest('SHA-256', b);
    return Array.prototype.map.call(new Uint8Array(h), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function guard(fn) {
    if (!pinOn() || Date.now() < (FG.pinOk || 0)) { fn(); return; }
    openPinSheet('check', function () { fn(); });
  }
  function openPinSheet(mode, done) {
    var c = cfg(), set = mode === 'set';
    var o = openSheet('<div class="fg-pinbox"><span class="fg-pair-ic">🔑</span><h3>' + E(set ? (c.pin ? L('PIN-kodni o\'zgartirish', 'Change PIN', 'Изменить PIN') : L('PIN-kod o\'rnatish', 'Set a PIN', 'Установить PIN')) : L('PIN-kodni kiriting', 'Enter your PIN', 'Введите PIN')) + '</h3>' +
      '<p class="fg-p">' + E(set ? L('4–8 raqam. Unutsangiz, faqat PIN bilan o\'chirsa bo\'ladi — ishonchli odamga yozib qo\'ying.', '4–8 digits. If you forget it, only the PIN can remove it — give it to someone you trust.', '4–8 цифр. Если забудете, снять его можно только этим PIN — доверьте его близкому.') : L('Bu amal limitlarni yumshatadi — davom etish uchun PIN kerak.', 'This loosens your limits — enter the PIN to continue.', 'Это ослабит лимиты — введите PIN, чтобы продолжить.')) + '</p>' +
      (set && c.pin ? '<input class="fg-in fg-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" data-pin-old placeholder="' + E(L('Joriy PIN', 'Current PIN', 'Текущий PIN')) + '">' : '') +
      (set ? '<input class="fg-in fg-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" data-pin-new placeholder="' + E(L('Yangi PIN', 'New PIN', 'Новый PIN')) + '"><input class="fg-in fg-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" data-pin-rep placeholder="' + E(L('Yana bir marta', 'Repeat', 'Ещё раз')) + '">'
        : '<input class="fg-in fg-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" data-pin-old placeholder="••••">') +
      '<div class="fg-acts">' + (set && c.pin ? '<button type="button" class="fg-btn ghost danger" data-pin-off>' + E(L('PIN ni olib tashlash', 'Remove PIN', 'Снять PIN')) + '</button>' : '<button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button>') +
      '<button type="button" class="fg-btn" data-pin-ok>' + E(L('Tasdiqlash', 'Confirm', 'Подтвердить')) + '</button></div></div>');
    var old = o.querySelector('[data-pin-old]'), nw = o.querySelector('[data-pin-new]'), rp = o.querySelector('[data-pin-rep]');
    setTimeout(function () { try { (old || nw).focus(); } catch (e) {} }, 200);
    function bad(el, msg) { toast('⚠️ ' + msg); if (el) { el.value = ''; el.focus(); el.classList.add('err'); setTimeout(function () { el.classList.remove('err'); }, 600); } }
    async function checkOld() { if (!c.pin) return true; var v = (old && old.value || '').trim(); if (!v || await pinHash(v) !== c.pin) { bad(old, L('PIN noto\'g\'ri', 'Wrong PIN', 'Неверный PIN')); return false; } return true; }
    o.querySelector('[data-pin-ok]').onclick = async function () {
      if (!(await checkOld())) return;
      if (!set) { FG.pinOk = Date.now() + 120000; closeSheet(); if (done) done(); return; }
      var a = (nw.value || '').trim(), b = (rp.value || '').trim();
      if (!/^\d{4,8}$/.test(a)) { bad(nw, L('4–8 ta raqam kiriting', 'Enter 4–8 digits', 'Введите 4–8 цифр')); return; }
      if (a !== b) { bad(rp, L('PIN lar mos emas', 'PINs don\'t match', 'PIN не совпадают')); return; }
      cfg().pin = await pinHash(a); FG.pinOk = Date.now() + 120000; saveCfg(); closeSheet(); rerender();
      toast('🔑 ' + L('PIN-kod o\'rnatildi', 'PIN set', 'PIN установлен'));
    };
    var off = o.querySelector('[data-pin-off]');
    if (off) off.onclick = async function () { if (!(await checkOld())) return; delete cfg().pin; saveCfg(); closeSheet(); rerender(); toast('🔓 ' + L('PIN-kod olib tashlandi', 'PIN removed', 'PIN снят')); };
    o.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); o.querySelector('[data-pin-ok]').click(); } });
  }

  // ---------- Pastki oynalar (sheet) ----------
  var _sheet = null;
  function closeSheet() { if (!_sheet) return; var s = _sheet; _sheet = null; s.classList.remove('on'); setTimeout(function () { s.remove(); }, 220); document.removeEventListener('keydown', escClose, true); }
  function escClose(e) { if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); } }
  function openSheet(html) {
    closeSheet();
    var o = document.createElement('div'); o.className = 'fg-ov';
    o.innerHTML = '<div class="fg-sheet" role="dialog" aria-modal="true"><button type="button" class="fg-x" data-fg-close aria-label="×">✕</button>' + html + '</div>';
    document.body.appendChild(o); _sheet = o;
    requestAnimationFrame(function () { o.classList.add('on'); });
    o.addEventListener('click', function (e) { if (e.target === o || (e.target.closest && e.target.closest('[data-fg-close]'))) closeSheet(); });
    document.addEventListener('keydown', escClose, true);
    return o;
  }
  function needConnect() {
    if (!DOWNLOADS_ON) { openSheet(soonCard().replace('fg-card fg-connect', 'fg-connect in')); return; }
    openSheet('<h3>' + '💻 ' + E(L('Avval kompyuterni ulang', 'Connect your computer first', 'Сначала подключите компьютер')) + '</h3>' + connectCard().replace('fg-card fg-connect', 'fg-connect in'));
  }
  // 🌐 Sayt qo'shish: katalog (guruhlar) yoki istalgan manzil → bloklash yoki kunlik limit
  function openSitePicker() {
    if (!real()) { needConnect(); return; }
    var o = openSheet('<h3>🌐 ' + E(L('Sayt qo\'shish', 'Add a website', 'Добавить сайт')) + '</h3>' +
      '<p class="fg-p">' + E(L('Katalogdan tanlang yoki istalgan sayt manzilini yozing (masalan kun.uz). Butun guruhni bloklash uchun pastdagi kategoriyani tanlang.', 'Pick from the catalog or type any website (e.g. kun.uz). To block a whole group, choose a category below.', 'Выберите из каталога или введите любой сайт (например kun.uz). Чтобы заблокировать целую группу, выберите категорию ниже.')) + '</p>' +
      pickerHtml(null, true) +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-sitelimit>⏳ ' + E(L('Kunlik limit', 'Daily limit', 'Дневной лимит')) + '</button>' +
      '<button type="button" class="fg-btn" data-fg-siteblock>🚫 ' + E(L('Bloklash', 'Block', 'Заблокировать')) + '</button></div>');
    bindPicker(o);
    function pick(kind) {
      var t = readTarget(o);
      if (!t) { toast('👆 ' + L('Saytni tanlang yoki manzilini yozing', 'Pick a site or type its address', 'Выберите сайт или введите адрес')); return; }
      var c = cfg(); c.rules = c.rules || [];
      var ex = c.rules.filter(function (x) { return x.app === t.app && x.kind === kind; })[0];
      if (ex) ex.on = true;
      else c.rules.push(kind === 'daily' ? { id: 'r' + Date.now().toString(36), app: t.app, label: t.label, kind: 'daily', minutes: 30, on: true } : { id: 'r' + Date.now().toString(36), app: t.app, label: t.label, kind: 'always', on: true });
      saveCfg(); closeSheet(); window.xRenderBlocker();
      if (kind === 'daily') { var idx = c.rules.indexOf(ex || c.rules[c.rules.length - 1]); setTimeout(function () { openRuleSheet(idx); }, 120); }
      else toast('🚫 ' + t.label + ' — ' + L('bloklandi', 'blocked', 'заблокирован'));
    }
    o.querySelector('[data-fg-siteblock]').onclick = function () { pick('always'); };
    o.querySelector('[data-fg-sitelimit]').onclick = function () { pick('daily'); };
  }

  // =========================================================
  // 🎁 Mukofotlar ↔ Focusgate: vaqtli mukofot ilova/saytlarga bog'lanadi —
  //   o'sha ilovada o'tirgan vaqt mukofot balansidan avtomatik ayriladi, tugasa (ixtiyoriy) bloklanadi.
  //   Mukofot: r.links = [{app, label}], r.linkBlock (default true). Hisob: S.rwAuto[rid] = {day, min}
  // =========================================================
  function rwLinked() { try { return (S.rewards || []).filter(function (r) { return r && r.rtype === 'time' && Array.isArray(r.links) && r.links.length; }); } catch (e) { return []; } }
  // Mukofot uchun tanlangan qurilmalar (r.linkDevs; bo'sh/yo'q — hammasi). O'chirilgan qurilmalar e'tiborsiz.
  function rwDevs(r) { var ids = Array.isArray(r.linkDevs) ? r.linkDevs.filter(function (id) { return !!devById(id); }) : []; return ids.length ? ids : null; }
  // Bir ilovaning bugungi vaqti — faqat tanlangan qurilmalarda (sayt: eng kattasi, dastur: yig'indi)
  function usedOn(app, devs) {
    if (!devs) return usedMin(app, 0);
    var site = app.indexOf('site:') === 0, best = 0, sum = 0;
    devs.forEach(function (d) {
      var apps = dayModel(0, d).apps, m;
      if (app.indexOf('cat:') === 0) { var k = app.slice(4); m = apps.filter(function (x) { return x.cat === k; }).reduce(function (a, x) { return a + x.m; }, 0); }
      else { var a = apps.filter(function (x) { return x.id === app; })[0]; m = a ? a.m : 0; }
      sum += m; if (m > best) best = m;
    });
    return site ? best : sum;
  }
  function rwUsedNow(r) { var dv = rwDevs(r); return r.links.reduce(function (n, l) { return n + usedOn(l.app, dv); }, 0); }
  // Har bir (ilova, qurilma) bo'yicha bugungi daqiqalar — tarixda "nima uchun ayirildi" ni ko'rsatish uchun
  function rwBreakdown(r) {
    var out = {}, devs = rwDevs(r) || FG.devices.map(function (d) { return d.id; });
    r.links.forEach(function (l) { devs.forEach(function (d) { var m = usedOn(l.app, [d]); if (m > 0) out[l.app + '|' + d] = m; out['h:' + l.app + '|' + d] = appHours(l.app, 0, d); }); });
    return out;
  }
  function rwHistAdd(r, take, before, after, fromTs) {
    S.rwHist = S.rwHist || {};
    var arr = S.rwHist[r.id] = S.rwHist[r.id] || [], now = Date.now(), items = [], firstH = 24;
    var siteBest = {};
    Object.keys(after).forEach(function (k) {
      if (k.indexOf('h:') === 0) {
        var a = after[k] || [], b = before[k] || [];
        for (var i = 0; i < 24; i++) if ((a[i] || 0) - (b[i] || 0) >= 0.5 && i < firstH) firstH = i;
        return;
      }
      var d = Math.round((after[k] || 0) - (before[k] || 0)); if (d < 1) return;
      // Sayt: kompyuter va kengaytma bir xil vaqtni ikkalasi ham sanaydi — faqat eng ko'p sanagan qurilma ko'rsatiladi
      var app0 = k.split('|')[0];
      if (app0.indexOf('site:') === 0) { if (siteBest[app0] && siteBest[app0].d >= d) return; siteBest[app0] = { d: d, k: k }; }
      var p = k.split('|'), app = p[0], dv = devById(p[1]), ln = r.links.filter(function (l) { return l.app === app; })[0];
      items = items.filter(function (x) { return !(app.indexOf('site:') === 0 && x.app === app); });
      items.push({ app: app, label: (ln && ln.label) || labelOf(app), dev: dv ? devName(dv) : '', di: dv ? devIcon(dv) : '', min: d });
    });
    // Boshlanish: o'tirish boshlangan soat (soatlik ma'lumotdan) yoki oxirgi tekshiruv vaqti
    if (firstH < 24) { var hs = new Date(); hs.setHours(firstH, 0, 0, 0); fromTs = Math.max(fromTs || 0, hs.getTime()); }
    if (!items.length) items.push({ app: r.links[0].app, label: r.links[0].label || labelOf(r.links[0].app), dev: '', di: '', min: take });
    var last = arr[arr.length - 1];
    // Ketma-ket (10 daqiqa ichida) bir xil ilovalar — bitta yozuvga qo'shiladi
    if (last && now - last.to < 10 * 60000 && last.items.map(function (x) { return x.app + x.dev; }).join() === items.map(function (x) { return x.app + x.dev; }).join()) {
      last.to = now; last.mins += take; last.items.forEach(function (x, i) { x.min += items[i].min; }); last.left = rwBalance(r);
    } else arr.push({ from: Math.min(fromTs || now, now - take * 60000), to: now, mins: take, items: items, left: rwBalance(r) });
    if (arr.length > 120) arr.splice(0, arr.length - 120);
  }
  function rwBalance(r) {
    var bought = (S.rewardClaims || {})[r.id] || 0;
    var used = ((S.usageLog || {})[r.id] || []).reduce(function (a, u) { return a + (u.mins || 0); }, 0);
    return bought - used;
  }
  function rewardLinked(rid) {
    // Bog'langan paytdagi bugungi vaqt "boshlang'ich nuqta" — undan oldingi o'tirish hisoblanmaydi
    var r = (S.rewards || []).find(function (x) { return x && x.id === rid; }); if (!r) return;
    S.rwAuto = S.rwAuto || {};
    S.rwAuto[rid] = { day: dayStr(0), min: real() && FG.at ? rwUsedNow(r) : -1, bd: real() && FG.at ? rwBreakdown(r) : {}, at: Date.now() };
    try { save(); } catch (e) {}
    rewardSync();
  }
  function rewardSync() {
    var list = rwLinked(), changed = false;
    if (real() && FG.at) {
      var day = dayStr(0);
      S.rwAuto = S.rwAuto || {};
      list.forEach(function (r) {
        var used = rwUsedNow(r), st = S.rwAuto[r.id], bd = rwBreakdown(r);
        if (!st || st.day !== day) st = S.rwAuto[r.id] = { day: day, min: 0, bd: {}, at: Date.now() };
        if (st.min < 0) { st.min = used; st.bd = bd; st.at = Date.now(); changed = true; return; } // bog'langanda ma'lumot hali yo'q edi
        var delta = Math.floor(used - st.min);
        if (delta < 1) return;
        var bal = rwBalance(r), take = Math.min(delta, Math.max(0, bal));
        var prevBd = st.bd || {}, prevAt = st.at;
        st.min += delta; st.bd = bd; st.at = Date.now(); changed = true;
        if (take > 0) {
          S.usageLog = S.usageLog || {}; (S.usageLog[r.id] = S.usageLog[r.id] || []).push({ mins: take, date: day, auto: true });
          try { rwHistAdd(r, take, prevBd, bd, prevAt); } catch (e) {}
          try { if (typeof recordUsage === 'function') recordUsage(r, take, 0); } catch (e) {}
          var left = bal - take, name = (r.icon || '🎁') + ' ' + (typeof rwName === 'function' ? rwName(r) : r.name);
          if (left <= 0) {
            S.rewardClaims[r.id] = 0; S.usageLog[r.id] = [];
            toast('⏳ ' + name + ' — ' + L('vaqt tugadi', 'time is up', 'время вышло') + (r.linkBlock === false ? '' : ' · 🔒 ' + L('bloklandi', 'blocked', 'заблокировано')));
          } else if (left <= 5 && bal > 5) toast('⏳ ' + name + ': ' + L(left + ' daq qoldi', left + ' min left', 'осталось ' + left + ' мин'));
        }
      });
    }
    // Vaqt tugaganda bloklash: har bir bog'langan ilova uchun Focusgate qoidasi (rw: mukofot id)
    if (real() && FG.cfg) {
      var c = cfg(), want = {}, cfgChanged = false;
      c.rules = c.rules || [];
      list.forEach(function (r) {
        if (r.linkBlock === false) return;
        var block = rwBalance(r) <= 0;
        r.links.forEach(function (l) { want[r.id + '|' + l.app] = { r: r, l: l, on: block }; });
      });
      c.rules = c.rules.filter(function (x) { if (!x.rw) return true; var k = x.rw + '|' + x.app; if (!want[k]) { cfgChanged = true; return false; } return true; });
      Object.keys(want).forEach(function (k) {
        var w = want[k], ex = c.rules.filter(function (x) { return x.rw && x.rw + '|' + x.app === k; })[0];
        if (!ex) { c.rules.push({ id: 'rw' + w.r.id + '_' + Math.random().toString(36).slice(2, 7), app: w.l.app, label: '🎁 ' + (w.l.label || labelOf(w.l.app)), kind: 'always', on: w.on, rw: w.r.id }); cfgChanged = true; }
        else if (ex.on !== w.on) { ex.on = w.on; cfgChanged = true; }
      });
      if (cfgChanged) { saveCfg(); rerender(); }
    }
    if (changed) { try { save(); } catch (e) {} try { if (typeof renderRewards === 'function') renderRewards(); } catch (e) {} }
  }

  // 🔗 Ilova/sayt tanlash oynasi (mukofotlar uchun): qidiruv + har birining yonida yoqish tugmasi
  function pickApps(selected, done, opts) {
    opts = opts || {};
    var sel = {}; (selected || []).forEach(function (x) { sel[x.app] = x.label || labelOf(x.app); });
    var apps = [], seen = {};
    function addApp(id, n, grp) { if (!id || seen[id] || (/\.exe$/.test(id) && (JUNK_EXE.test(id) || id === 'explorer.exe'))) return; seen[id] = 1; apps.push([id, n || labelOf(id), grp]); }
    knownApps().forEach(function (a) { if (!a.site) addApp(a.id, a.n, 'apps'); });
    installed().forEach(function (a) { addApp(a.id, a.n, 'apps'); });
    SITE_GROUPS.forEach(function (g) { g[4].forEach(function (x) { addApp(x[0], x[1], 'sites'); }); });
    Object.keys(sel).forEach(function (k) { addApp(k, sel[k], k.indexOf('cat:') === 0 ? 'cats' : k.indexOf('site:') === 0 ? 'sites' : 'apps'); });
    function row(a) {
      return '<div class="fg-opt fg-pk" data-q="' + E((a[1] + ' ' + a[0] + ' ' + (DOMAIN[a[0]] || '')).toLowerCase()) + '">' +
        '<span class="fg-site-l">' + tileFor(a[0], 'sm') + '<span class="fg-site-n"><b>' + E(a[1]) + '</b><small>' + E(niceExe(a[0]) === a[0] ? a[0] : (DOMAIN[a[0]] || niceExe(a[0]))) + '</small></span></span>' +
        sw(!!sel[a[0]], 'data-pk="' + E(a[0]) + '" data-pkl="' + E(a[1]) + '"') + '</div>';
    }
    var g1 = apps.filter(function (a) { return a[2] === 'apps'; }), g2 = apps.filter(function (a) { return a[2] === 'sites'; });
    if (opts.cats) CAT_LIST.filter(function (c) { return c[0] !== 'other'; }).forEach(function (c) { addApp('cat:' + c[0], c[1] + ' ' + T(c[2]), 'cats'); });
    var g0 = apps.filter(function (a) { return a[2] === 'cats'; });
    var o = openSheet('<h3>' + (opts.plain ? '📋 ' + E(opts.title || L('Ilova va saytlarni tanlang', 'Choose apps and sites', 'Выберите приложения и сайты')) : '🔗 ' + E(L('Ilova yoki saytga bog\'lash', 'Link to apps or sites', 'Привязать к приложениям и сайтам'))) + '</h3>' +
      (opts.plain ? '' : '<p class="fg-p">' + E(L('Tanlangan ilova/saytlarda o\'tirgan vaqt shu mukofot balansidan avtomatik ayriladi.', 'Time spent in the chosen apps/sites is taken from this reward\'s balance automatically.', 'Время в выбранных приложениях/сайтах автоматически списывается с баланса этой награды.')) + '</p>') +
      (real() || opts.plain ? '' : '<div class="fg-hint">💻 ' + E(L('Vaqt avtomatik hisoblanishi uchun kompyuterda Focusgate ulangan bo\'lishi kerak. Hozircha tanlab qo\'yishingiz mumkin.', 'Automatic tracking needs Focusgate connected on your computer. You can choose now anyway.', 'Для автоучёта нужен подключённый Focusgate на компьютере. Выбрать можно уже сейчас.')) + '</div>') +
      '<input class="fg-in fg-custom" maxlength="80" autocomplete="off" inputmode="url" placeholder="🔍 ' + E(L('Qidiring yoki sayt manzilini yozing: kun.uz', 'Search, or type a website: kun.uz', 'Поиск или адрес сайта: kun.uz')) + '">' +
      '<div class="fg-pick-new" hidden></div>' +
      '<div class="fg-pkbox">' + (g0.length ? '<div class="fg-pkg"><div class="fg-pick-t">🗂 ' + E(L('Kategoriyalar', 'Categories', 'Категории')) + '</div><div class="fg-card fg-pkl">' + g0.map(row).join('') + '</div></div>' : '') + (g1.length ? '<div class="fg-pkg"><div class="fg-pick-t">💻 ' + E(L('Ilovalar', 'Apps', 'Приложения')) + ' <em>' + g1.length + '</em></div><div class="fg-card fg-pkl">' + g1.map(row).join('') + '</div></div>' : '') +
      '<div class="fg-pkg"><div class="fg-pick-t">🌐 ' + E(L('Saytlar', 'Websites', 'Сайты')) + ' <em>' + g2.length + '</em></div><div class="fg-card fg-pkl">' + g2.map(row).join('') + '</div></div></div>' +
      (targetDevs().length > 1 && !opts.plain ? '<div class="fg-pick-t">🔗 ' + E(L('Qaysi qurilmalarda hisoblansin', 'Count on which devices', 'На каких устройствах считать')) + '</div><div class="fg-card fg-pkdevs">' + targetDevs().map(function (d, i) {
        var on = !Array.isArray(opts.devs) || !opts.devs.length || opts.devs.indexOf(d.id) !== -1;
        return '<label class="fg-pkdev"><input type="checkbox" data-pk-dev="' + E(d.id) + '"' + (on ? ' checked' : '') + '><span>' + devIcon(d) + ' ' + (i + 1) + ' · ' + E(devName(d)) + '</span></label>';
      }).join('') + '<small class="fg-pkdev-n">' + E(L('Bloklash (vaqt tugaganda) barcha qurilmalarda ishlaydi.', 'Blocking (when time runs out) applies on all devices.', 'Блокировка (когда время кончится) действует на всех устройствах.')) + '</small></div>' : '') +
      (opts.plain ? '' : '<label class="fg-pk-block"><input type="checkbox" data-pk-block' + (opts.block === false ? '' : ' checked') + '> ' + E(L('Vaqt tugasa — bloklansin', 'Block when the time runs out', 'Блокировать, когда время закончится')) + '</label>') +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-pk-save>' + E(L('Saqlash', 'Save', 'Сохранить')) + ' <b data-pk-n></b></button></div>');
    var inp = o.querySelector('.fg-custom'), nw = o.querySelector('.fg-pick-new');
    function count() { var n = Object.keys(sel).length; o.querySelector('[data-pk-n]').textContent = n ? '(' + n + ')' : ''; }
    function bindSw(root) {
      root.querySelectorAll('[data-pk]').forEach(function (b) {
        b.onclick = function () { var k = b.getAttribute('data-pk'), on = !sel[k]; if (on) sel[k] = b.getAttribute('data-pkl'); else delete sel[k];
          o.querySelectorAll('[data-pk="' + k.replace(/"/g, '') + '"]').forEach(function (x) { x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); count(); };
      });
    }
    bindSw(o); count();
    inp.oninput = function () {
      var q = inp.value.trim().toLowerCase();
      o.querySelectorAll('.fg-pkbox .fg-pk').forEach(function (r) { r.hidden = !!q && r.getAttribute('data-q').indexOf(q) === -1; });
      o.querySelectorAll('.fg-pkg').forEach(function (g) { g.hidden = !g.querySelector('.fg-pk:not([hidden])'); });
      var site = q ? siteFromInput(q) : null;
      if (site && !seen[site.app]) { nw.hidden = false; nw.innerHTML = '<div class="fg-pick-t">＋ ' + E(L('Yangi sayt', 'New website', 'Новый сайт')) + '</div>' + row([site.app, site.label]); bindSw(nw); }
      else { nw.hidden = true; nw.innerHTML = ''; }
    };
    o.querySelector('[data-pk-save]').onclick = function () {
      var out = Object.keys(sel).map(function (k) { return { app: k, label: sel[k] }; });
      var bk = o.querySelector('[data-pk-block]'), block = bk ? !!bk.checked : true;
      var dvs = Array.prototype.slice.call(o.querySelectorAll('[data-pk-dev]')), devs = dvs.filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-pk-dev'); });
      if (dvs.length && !devs.length) { try { toast('⚠️ ' + L('Kamida bitta qurilmani tanlang', 'Pick at least one device', 'Выберите хотя бы одно устройство')); } catch (e) {} return; }
      if (devs.length === dvs.length) devs = []; // hammasi = cheklovsiz (yangi qurilmalar ham hisoblanadi)
      closeSheet(); if (done) done(out, block, devs);
    };
  }
  // 📜 Mukofot tarixi: qachon, qaysi ilovada, qaysi qurilmada o'tirgani uchun vaqt ayirildi
  function rewardHistory(rid) {
    var r = (S.rewards || []).find(function (x) { return x && x.id === rid; }); if (!r) return;
    var arr = ((S.rwHist || {})[rid] || []).slice().reverse();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var hm = function (ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    var dl = function (ts) { var d = new Date(ts), t0 = new Date(); t0.setHours(0, 0, 0, 0); var k = Math.round((t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return k === 0 ? L('Bugun', 'Today', 'Сегодня') : k === 1 ? L('Kecha', 'Yesterday', 'Вчера') : d.toLocaleDateString(); };
    var dv = rwDevs(r);
    var h = '<h3>📜 ' + E((r.icon || '🎁') + ' ' + (typeof rwName === 'function' ? rwName(r) : r.name)) + '</h3>' +
      '<p class="fg-p">' + E(L('Bog\'langan ilovalarda o\'tirgan vaqtingiz uchun mukofotdan ayirilgan daqiqalar.', 'Minutes taken from this reward for the time you spent in the linked apps.', 'Минуты, списанные с награды за время в привязанных приложениях.')) + '</p>' +
      '<div class="fg-rwh-meta">🔗 ' + r.links.map(function (l) { return E(l.label || labelOf(l.app)); }).join(', ') + ' · ' + (dv ? dv.map(function (id) { var d = devById(id); return d ? devIcon(d) + ' ' + E(devName(d)) : ''; }).join(', ') : E(L('barcha qurilmalar', 'all devices', 'все устройства'))) + '</div>';
    if (!arr.length) h += '<div class="fg-empty">' + E(L('Hali hech narsa ayirilmagan.', 'Nothing has been taken yet.', 'Пока ничего не списано.')) + '</div>';
    var lastDay = '';
    arr.forEach(function (e) {
      var day = dl(e.to); if (day !== lastDay) { h += '<div class="fg-rwh-day">' + E(day) + '</div>'; lastDay = day; }
      h += '<div class="fg-rwh-it"><div class="fg-rwh-top"><b>' + hm(e.from) + '–' + hm(e.to) + '</b><em>−' + e.mins + ' ' + E(L('daq', 'min', 'мин')) + '</em></div>' +
        '<div class="fg-rwh-why">' + e.items.map(function (x) { return tileFor(x.app, 'sm') + '<span>' + E(L(x.label + (x.dev ? ' (' + x.dev + ')' : '') + ' da ' + x.min + ' daq o\'tirdingiz', 'You spent ' + x.min + ' min in ' + x.label + (x.dev ? ' (' + x.dev + ')' : ''), x.min + ' мин в ' + x.label + (x.dev ? ' (' + x.dev + ')' : ''))) + '</span>'; }).join('</div><div class="fg-rwh-why">') + '</div>' +
        '<small>' + E(L('Shuning uchun mukofotingizdan ' + e.mins + ' daq ishlatildi', 'So ' + e.mins + ' min of your reward was used', 'Поэтому списано ' + e.mins + ' мин награды')) + (e.left != null ? ' · ' + E(L('qoldi: ', 'left: ', 'осталось: ') + Math.max(0, e.left) + ' ' + L('daq', 'min', 'мин')) : '') + '</small></div>';
    });
    openSheet(h + '<div class="fg-acts"><button type="button" class="fg-btn" data-fg-close>' + E(L('Yopish', 'Close', 'Закрыть')) + '</button></div>');
  }
  // Nishon tanlash: so'nggi 7 kunda ishlatilganlar + mashhur saytlar + qo'lda kiritish
  function pickerHtml(sel, onlySites) {
    var used = knownApps().filter(function (a) { return !a.site && !JUNK_EXE.test(a.id) && a.id !== 'explorer.exe'; }).slice(0, 10).map(function (a) { return [a.id, a.n]; });
    var usedIds = {}; used.forEach(function (x) { usedIds[x[0]] = 1; });
    var all = installed().filter(function (a) { return !usedIds[a.id]; }).map(function (a) { return [a.id, a.n]; });
    var sites = [];
    SITE_GROUPS.forEach(function (g) { g[4].forEach(function (x) { sites.push([x[0], x[1], g[0]]); }); });
    var nIn = {}; installed().concat(knownApps()).forEach(function (a) { var k = catOf(a.id); nIn[k] = nIn[k] || {}; nIn[k][a.id] = 1; });
    var cats = CAT_LIST.filter(function (c) { return c[0] !== 'other'; }).map(function (c) { var n = Object.keys(nIn[c[0]] || {}).length; return ['cat:' + c[0], c[1] + ' ' + T(c[2]) + (n ? ' · ' + n : '')]; });
    if (onlySites) { used = []; all = []; cats = CAT_LIST.filter(function (c) { return c[0] === 'social' || c[0] === 'fun' || c[0] === 'games'; }).map(function (c) { return ['cat:' + c[0], c[1] + ' ' + T(c[2])]; }); }
    if (sel && !used.concat(all, sites, cats).some(function (x) { return x[0] === sel; })) used.unshift([sel, labelOf(sel)]);
    var first = onlySites ? '' : sel || (used[0] || all[0] || sites[0])[0];
    function chips(items) { return items.map(function (x) { return '<button type="button" class="' + (x[0] === first ? 'on' : '') + '" data-fg-pick="' + E(x[0]) + '" data-label="' + E(x[1]) + '"' + (x[2] ? ' data-sg="' + x[2] + '"' : '') + ' data-q="' + E((x[1] + ' ' + x[0] + ' ' + (DOMAIN[x[0]] || '')).toLowerCase()) + '">' + tileFor(x[0], 'sm') + '<span>' + E(x[1]) + '</span></button>'; }).join(''); }
    function siteBlock() {
      return '<div class="fg-pick-g fg-sites"><div class="fg-pick-t">' + E(L('Saytlar', 'Websites', 'Сайты')) + ' <em>' + sites.length + '</em></div>' +
        '<div class="fg-sgtabs"><button type="button" class="on" data-fg-sg="">' + E(L('Hammasi', 'All', 'Все')) + '</button>' + SITE_GROUPS.map(function (g) { return '<button type="button" data-fg-sg="' + g[0] + '">' + g[1] + ' ' + E(T(g[2])) + '</button>'; }).join('') + '</div>' +
        '<div class="fg-pick wrap">' + chips(sites) + '</div></div>';
    }
    function grp(title, items) { return items.length ? '<div class="fg-pick-g"><div class="fg-pick-t">' + E(title) + ' <em>' + items.length + '</em></div><div class="fg-pick wrap">' + chips(items) + '</div></div>' : ''; }
    return '<input class="fg-in fg-custom" maxlength="80" autocomplete="off" inputmode="url" placeholder="🔍 ' + E(L('Qidiring yoki istalgan sayt manzilini yozing: kun.uz', 'Search, or type any website: kun.uz', 'Поиск или любой сайт: kun.uz')) + '">' +
      '<div class="fg-pickbox">' + (onlySites ? '' : grp(L('Kategoriyalar — butun guruhga limit', 'Categories — limit a whole group', 'Категории — лимит на всю группу'), cats)) + grp(L('Ko\'p ishlatilgan', 'Most used', 'Часто используемые'), used) +
      grp(L('Kompyuterdagi dasturlar', 'Apps on your computer', 'Программы на компьютере'), all) +
      '<div class="fg-pick-new" hidden></div>' +
      siteBlock() +
      (onlySites ? grp(L('Butun kategoriya (dastur + saytlar)', 'Whole category (apps + sites)', 'Вся категория (приложения + сайты)'), cats) : '') +
      (real() && !all.length && !onlySites ? '<div class="fg-pick-note">' + E(L('Dasturlar ro\'yxati Focusgate yangilangach (v0.2+) shu yerda chiqadi.', 'The full app list appears here once Focusgate updates (v0.2+).', 'Полный список появится после обновления Focusgate (v0.2+).')) + '</div>' : '') +
      '<div class="fg-pick-none" hidden>' + E(L('Topilmadi — "Saqlash" ni bossangiz, yozganingiz qo\'shiladi.', 'Not found — press "Save" to add what you typed.', 'Не найдено — нажмите «Сохранить», чтобы добавить введённое.')) + '</div></div>';
  }
  // Yozilgan matn sayt manziliga o'xshasa: "site:kun.uz" (mashhur bo'lsa — uning kaliti)
  function siteFromInput(v) {
    var kw = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[\/?#\s]/)[0];
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(kw) || /\.exe$/.test(kw)) return null;
    for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === 'site:' + kw || DOMAIN[SITES[i][0]] === kw) return { app: SITES[i][0], label: SITES[i][1] };
    var base = kw.split('.')[0];
    for (var j = 0; j < SITES.length; j++) if (SITES[j][0] === 'site:' + base) return { app: SITES[j][0], label: SITES[j][1] };
    return { app: 'site:' + kw, label: kw };
  }
  // Tanlagich: qidiruv + bitta tanlov
  function bindPicker(o) {
    var inp = o.querySelector('.fg-custom'), none = o.querySelector('.fg-pick-none'), nw = o.querySelector('.fg-pick-new'), sg = '';
    one(o, '[data-fg-pick]');
    function filter() {
      var q = inp.value.trim().toLowerCase(), any = false;
      o.querySelectorAll('[data-fg-pick]').forEach(function (b) {
        if (b.closest('.fg-pick-new')) return;
        var inTab = q || !sg || !b.hasAttribute('data-sg') || b.getAttribute('data-sg') === sg;
        var hit = (!q || b.getAttribute('data-q').indexOf(q) !== -1) && inTab;
        if (sg && !q && !b.hasAttribute('data-sg')) hit = true;
        b.hidden = !hit; if (hit && q) any = true; if (q) b.classList.remove('on');
      });
      o.querySelectorAll('.fg-pick-g').forEach(function (g) { g.hidden = !g.querySelector('[data-fg-pick]:not([hidden])') && !g.classList.contains('fg-sites'); });
      // Istalgan sayt: yozilgan manzil uchun rasmli tayyor variant
      var site = q ? siteFromInput(q) : null, exists = site && o.querySelector('.fg-sites [data-fg-pick="' + site.app.replace(/"/g, '') + '"]');
      if (nw) {
        if (site && !exists) {
          nw.innerHTML = '<div class="fg-pick-t">＋ ' + E(L('Yangi sayt', 'New website', 'Новый сайт')) + '</div><div class="fg-pick wrap"><button type="button" class="on" data-fg-pick="' + E(site.app) + '" data-label="' + E(site.label) + '" data-q="">' + tile({ id: site.app, n: site.label, c: color(site.app) }, 'sm') + '<span>' + E(site.label) + '</span></button></div>';
          nw.hidden = false; any = true;
          o.querySelectorAll('[data-fg-pick]').forEach(function (b) { if (!b.closest('.fg-pick-new')) b.classList.remove('on'); });
          one(o, '[data-fg-pick]');
        } else { nw.hidden = true; nw.innerHTML = ''; }
      }
      if (none) none.hidden = any || !q;
      if (q && (!nw || nw.hidden)) { var vis = o.querySelectorAll('[data-fg-pick]:not([hidden])'); if (vis.length === 1) vis[0].classList.add('on'); }
    }
    inp.oninput = filter;
    o.querySelectorAll('[data-fg-sg]').forEach(function (t) { t.onclick = function () { sg = t.getAttribute('data-fg-sg'); o.querySelectorAll('[data-fg-sg]').forEach(function (x) { x.classList.toggle('on', x === t); }); filter(); }; });
  }
  function readTarget(o) {
    var sb = o.querySelector('[data-fg-pick].on:not([hidden])');
    if (sb) { var pa = sb.getAttribute('data-fg-pick'); return { app: pa, label: pa.indexOf('cat:') === 0 ? labelOf(pa) : sb.getAttribute('data-label') }; }
    var cu = (o.querySelector('.fg-custom').value || '').trim().toLowerCase();
    if (cu) {
      if (/\.exe$/.test(cu)) { var ex = cu.replace(/^.*[\\/]/, ''), kn = knownApps().filter(function (x) { return x.id === ex; })[0]; return { app: ex, label: kn ? kn.n : ex.replace(/\.exe$/, '') }; }
      var sf = siteFromInput(cu); if (sf) return sf;
      var kw = cu.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      var base = kw.split('.')[0];
      // mashhur sayt bo'lsa — agent bilan bir xil kalit (youtube.com → site:youtube), aks holda to'liq domen (kun.uz)
      for (var i = 0; i < SITES.length; i++) if (SITES[i][0] === 'site:' + base) return { app: SITES[i][0], label: SITES[i][1] };
      return { app: 'site:' + kw, label: kw };
    }
    return null;
  }
  function one(o, sel, cb) { o.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { o.querySelectorAll(sel).forEach(function (x) { x.classList.toggle('on', x === b); }); if (cb) cb(b); }; }); }

  function openRuleSheet(idx) {
    if (!real()) { needConnect(); return; }
    var c = cfg(), r = idx != null ? c.rules[idx] : null, strictLock = !!(c.strict && r && r.on);
    var kinds = [['daily', '⏳', ['Kunlik limit', 'Daily limit', 'Дневной лимит'], ['Masalan: kuniga 45 daqiqa', 'e.g. 45 minutes a day', 'Например: 45 минут в день']], ['schedule', '🗓', ['Jadval bo\'yicha', 'On a schedule', 'По расписанию'], ['Ish/dars vaqtida bloklash', 'Block during work or study hours', 'Блокировать в рабочие часы']], ['always', '🚫', ['Doimiy blok', 'Always block', 'Всегда блокировать'], ['Umuman ochilmaydi', 'Never opens', 'Никогда не открывать']], ['session', '⏲', ['Seans limiti', 'Session limit', 'Лимит сессии'], ['Har ochilishda N daqiqa', 'N minutes per launch', 'N минут за запуск']]];
    var kind = r ? r.kind : 'daily', mins = r && r.minutes ? r.minutes : 45, days = r && r.days && r.days.length ? r.days.slice() : [1, 2, 3, 4, 5];
    var o = openSheet('<h3>' + (r ? '✏️ ' + E(L('Limitni tahrirlash', 'Edit limit', 'Изменить лимит')) : '＋ ' + E(L('Limit qo\'shish', 'Add limit', 'Добавить лимит'))) + '</h3>' +
      '<div class="fg-lbl">' + E(L('Nimani cheklaysiz?', 'What do you want to limit?', 'Что ограничить?')) + '</div>' + pickerHtml(r && r.app) +
      '<div class="fg-lbl">' + E(L('Qanday cheklaysiz?', 'How do you want to limit it?', 'Как ограничить?')) + '</div>' +
      '<div class="fg-kinds">' + kinds.map(function (k) { return '<button type="button" class="' + (kind === k[0] ? 'on' : '') + '" data-fg-kindsel="' + k[0] + '"><span>' + k[1] + '</span><b>' + E(T(k[2])) + '</b><small>' + E(T(k[3])) + '</small></button>'; }).join('') + '</div>' +
      '<div class="fg-kopt" data-k="mins"><div class="fg-lbl">' + E(L('Necha daqiqa?', 'How many minutes?', 'Сколько минут?')) + ' <b class="fg-mins">' + E(fmt(mins)) + '</b></div><input type="range" class="fg-range" min="5" max="480" step="5" value="' + mins + '" data-fg-range>' +
        '<label class="fg-pk-block" data-k="perday"><input type="checkbox" data-fg-perday' + (r && r.perDay ? ' checked' : '') + '> 📅 ' + E(L('Har kuni har xil limit (masalan dam olish kunlari ko\'proq)', 'Different limit per day (e.g. more on weekends)', 'Разный лимит по дням (например больше в выходные)')) + '</label>' +
        '<div class="fg-perday"' + (r && r.perDay ? '' : ' hidden') + '>' + DAYS().map(function (d, i) { var v = r && r.perDay && r.perDay[String(i + 1)] != null ? r.perDay[String(i + 1)] : mins; return '<label><span>' + E(d) + '</span><input type="number" class="fg-in" min="0" max="1440" step="5" inputmode="numeric" data-fg-pd="' + (i + 1) + '" value="' + v + '"></label>'; }).join('') + '<small>' + E(L('daqiqa · 0 — o\'sha kuni limit yo\'q', 'minutes · 0 — no limit that day', 'минут · 0 — без лимита в этот день')) + '</small></div></div>' +
      '<div class="fg-kopt" data-k="sched"><div class="fg-lbl">' + E(L('Kunlar va vaqt', 'Days and time', 'Дни и время')) + '</div><div class="fg-days">' + DAYS().map(function (d, i) { return '<button type="button" class="' + (days.indexOf(i + 1) !== -1 ? 'on' : '') + '" data-fg-dow="' + (i + 1) + '">' + E(d) + '</button>'; }).join('') + '</div>' +
      '<div class="fg-times"><label>' + E(L('Dan', 'From', 'С')) + '<input type="time" class="fg-in" data-fg-from value="' + E((r && r.from) || '09:00') + '"></label><label>' + E(L('Gacha', 'To', 'До')) + '<input type="time" class="fg-in" data-fg-to value="' + E((r && r.to) || '18:00') + '"></label></div></div>' +
      (targetDevs().length > 1 ? '<div class="fg-lbl">📍 ' + E(L('Qaysi qurilmalarda?', 'On which devices?', 'На каких устройствах?')) + '</div><div class="fg-days fg-devsel">' +
        '<button type="button" class="' + (ruleDevs(r) ? '' : 'on') + '" data-fg-devall>🌐 ' + E(L('Hammasi', 'All', 'Все')) + '</button>' +
        targetDevs().map(function (d) { var on = (ruleDevs(r) || []).indexOf(d.id) !== -1; return '<button type="button" class="' + (on ? 'on' : '') + '" data-fg-devsel="' + E(d.id) + '">' + devIcon(d) + ' ' + E(devName(d)) + '</button>'; }).join('') +
        '</div><small class="fg-p fg-devhint">' + E(L('Kompyuter tanlansa — undagi brauzer kengaytmasi ham. Hech biri tanlanmasa — hamma qurilmada.', 'Picking a computer includes its browser extension. Nothing picked — all devices.', 'Выбран компьютер — включая его расширение. Ничего не выбрано — все устройства.')) + '</small>' : '') +
      (strictLock ? '<div class="fg-note">🔐 ' + E(L('Qat\'iy rejim: bu limitni faqat kuchaytirish mumkin.', 'Strict mode: this limit can only be tightened.', 'Строгий режим: лимит можно только ужесточить.')) + '</div>' : '') +
      '<div class="fg-acts">' + (r && !strictLock ? '<button type="button" class="fg-btn ghost danger" data-fg-del>🗑 ' + E(L('O\'chirish', 'Delete', 'Удалить')) + '</button>' : '<button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button>') +
      '<button type="button" class="fg-btn" data-fg-save>' + E(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    function vis() { o.querySelector('[data-k="mins"]').style.display = (kind === 'daily' || kind === 'session') ? '' : 'none'; o.querySelector('[data-k="perday"]').style.display = kind === 'daily' ? '' : 'none'; o.querySelector('.fg-perday').style.display = kind === 'daily' ? '' : 'none'; o.querySelector('[data-k="sched"]').style.display = kind === 'schedule' ? '' : 'none'; }
    o.querySelector('[data-fg-perday]').onchange = function () { var pd = o.querySelector('.fg-perday'); pd.hidden = !this.checked; if (this.checked) pd.querySelectorAll('[data-fg-pd]').forEach(function (x) { x.value = rg.value; }); };
    bindPicker(o);
    one(o, '[data-fg-kindsel]', function (b) { kind = b.getAttribute('data-fg-kindsel'); vis(); });
    o.querySelectorAll('[data-fg-dow]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); }; });
    // 📍 Qurilmalar: "Hammasi" yoki bir nechtasi
    var devAll = o.querySelector('[data-fg-devall]');
    var devSync = function () { if (devAll) devAll.classList.toggle('on', !o.querySelector('[data-fg-devsel].on')); };
    if (devAll) devAll.onclick = function () { o.querySelectorAll('[data-fg-devsel]').forEach(function (x) { x.classList.remove('on'); }); devSync(); };
    o.querySelectorAll('[data-fg-devsel]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); devSync(); }; });
    var rg = o.querySelector('[data-fg-range]'), mEl = o.querySelector('.fg-mins');
    rg.oninput = function () { mEl.textContent = fmt(+rg.value); };
    vis();
    var del = o.querySelector('[data-fg-del]');
    // cfg() saqlash paytida qayta olinadi — oyna ochiq turganda fonda yangilangan bo'lishi mumkin
    if (del) del.onclick = function () { var go = function () { var cc = cfg(), k = cc.rules.indexOf(r); if (k === -1) k = idx; if (k !== -1) cc.rules.splice(k, 1); saveCfg(); closeSheet(); rerender(); }; if (r && r.on) guard(go); else go(); };
    o.querySelector('[data-fg-save]').onclick = function () {
      var tg = readTarget(o); if (!tg) return;
      var nr = { id: r ? r.id : 'r' + Date.now().toString(36), app: tg.app, label: tg.label, kind: kind, on: true };
      var pickedDevs = Array.prototype.map.call(o.querySelectorAll('[data-fg-devsel].on'), function (b) { return b.getAttribute('data-fg-devsel'); });
      if (pickedDevs.length) nr.devs = pickedDevs;
      else if (!o.querySelector('[data-fg-devall]') && r && r.devs) nr.devs = r.devs; // tanlov ko'rinmagan bo'lsa — eskisi saqlanadi
      if (kind === 'daily' || kind === 'session') nr.minutes = +rg.value;
      if (kind === 'daily' && o.querySelector('[data-fg-perday]').checked) {
        nr.perDay = {}; o.querySelectorAll('[data-fg-pd]').forEach(function (x) { nr.perDay[x.getAttribute('data-fg-pd')] = Math.max(0, Math.min(1440, Math.round(+x.value || 0))); });
      }
      if (kind === 'schedule') {
        nr.days = Array.prototype.map.call(o.querySelectorAll('[data-fg-dow].on'), function (b) { return +b.getAttribute('data-fg-dow'); });
        nr.from = o.querySelector('[data-fg-from]').value || '09:00'; nr.to = o.querySelector('[data-fg-to]').value || '18:00';
      }
      // Kuchaytirishmi? Kunlik limit — har bir hafta kunida daqiqalar kamaygan yoki teng (0 = limitsiz — yumshatish)
      var dayMins = function (x, w) { var v = x.perDay && x.perDay[String(w)]; v = v != null ? +v : (x.minutes || 0); return v > 0 ? v : 1e9; };
      var tighter = !!r && nr.app === r.app && devsCover(nr.devs, r.devs) && (kind === r.kind ? (kind === 'always' || (kind === 'daily' ? [1, 2, 3, 4, 5, 6, 7].every(function (w) { return dayMins(nr, w) <= dayMins(r, w); }) : kind === 'session' ? (nr.minutes || 0) <= (r.minutes || 0) : JSON.stringify([nr.days, nr.from, nr.to]) === JSON.stringify([r.days, r.from, r.to]))) : kind === 'always');
      if (strictLock && !tighter && kind !== 'schedule') {
        try { toast('🔐 ' + L('Qat\'iy rejimda limitni yumshatib bo\'lmaydi', 'Strict mode: limits can\'t be loosened', 'Строгий режим: лимит нельзя ослабить')); } catch (e) {} return;
      }
      var commit = function () {
        var cc = cfg();
        if (r) { var k = -1; cc.rules.forEach(function (x, i) { if (x.id === r.id) k = i; }); if (k === -1) cc.rules.push(nr); else cc.rules[k] = nr; } else cc.rules.push(nr);
        saveCfg(); closeSheet(); rerender();
        try { toast('🛡 ' + L('Saqlandi — qurilmalar 30 soniyada qabul qiladi', 'Saved — devices pick it up within 30 s', 'Сохранено — устройства получат за 30 с') + (nr.devs ? ' · 📍 ' + ruleDevLabel(nr) : '')); } catch (e) {}
      };
      if (r && r.on && !tighter) guard(commit); else commit();
    };
  }
  function openFocusAppSheet() {
    if (!real()) { needConnect(); return; }
    var o = openSheet('<h3>＋ ' + E(L('Fokusda bloklash', 'Block during focus', 'Блокировать в фокусе')) + '</h3><div class="fg-lbl">' + E(L('Qaysi dastur yoki sayt?', 'Which app or site?', 'Какое приложение или сайт?')) + '</div>' + pickerHtml() +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-fg-save>' + E(L('Qo\'shish', 'Add', 'Добавить')) + '</button></div>');
    bindPicker(o);
    o.querySelector('[data-fg-save]').onclick = function () {
      var tg = readTarget(o); if (!tg) return;
      var c = cfg(); c.focusApps = c.focusApps || [];
      if (!c.focusApps.some(function (f) { return f.app === tg.app; })) c.focusApps.push({ app: tg.app, label: tg.label, on: true });
      saveCfg(); closeSheet(); rerender();
    };
  }
  // 🕒 Ilova qaysi vaqtlarda ishlatilgan (tanlangan kun) + qurilmalar bo'yicha
  function appWhenHtml(id) {
    var hrs = appHours(id, UI.day, UI.dev), max = Math.max.apply(null, hrs.concat([0.0001]));
    var rg = hourRanges(hrs), pad = function (n) { return String(n).padStart(2, '0') + ':00'; };
    var dayLbl = UI.day === 0 ? L('Bugun', 'Today', 'Сегодня') : UI.day === -1 ? L('Kecha', 'Yesterday', 'Вчера') : (-UI.day) + ' ' + L('kun oldin', 'days ago', 'дн. назад');
    var dv = UI.dev !== 'all' ? devById(UI.dev) : null;
    var h = '<div class="fg-lbl">🕒 ' + E(L('Qaysi vaqtlarda', 'When it was used', 'Когда использовалось')) + ' · ' + E(dayLbl) + (dv ? ' · ' + devIcon(dv) + ' ' + E(devName(dv)) : '') + '</div>' +
      '<div class="fg-card fg-when"><div class="fg-chart sm">' + hrs.map(function (v, i) {
        return '<div class="fg-col' + (v >= 0.05 ? '' : ' z') + '" title="' + pad(i) + ' — ' + E(fmt(v)) + '"><i style="height:' + Math.max(v / max * 100, v >= 0.05 ? 4 : 0) + '%"></i><span>' + (i % 3 === 0 ? i : '') + '</span></div>';
      }).join('') + '</div>' +
      (rg.length ? '<div class="fg-ranges">' + rg.map(function (r) { return '<span>' + pad(r.a) + '–' + pad(r.b % 24 === 0 && r.b ? 24 : r.b).replace('24:00', '00:00') + ' <b>' + E(fmt(r.m)) + '</b></span>'; }).join('') + '</div>'
        : '<div class="fg-empty sm">' + E(L('Bu kunda ishlatilmagan', 'Not used on this day', 'В этот день не использовалось')) + '</div>') + '</div>';
    if (real() && statDevs().length > 1) {
      var per = statDevs().map(function (d, i) { var m = appHours(id, UI.day, d.id).reduce(function (s, v) { return s + v; }, 0); return { d: d, i: i, m: m }; }).filter(function (x) { return x.m >= 0.5; });
      if (per.length) {
        var pm = Math.max.apply(null, per.map(function (x) { return x.m; }));
        h += '<div class="fg-lbl">' + E(L('Qurilmalar bo\'yicha', 'By device', 'По устройствам')) + '</div><div class="fg-card fg-perdev">' + per.map(function (x) {
          return '<div class="fg-perdev-r"><span>' + devIcon(x.d) + ' ' + (x.i + 1) + ' · ' + E(devName(x.d)) + '</span><span class="fg-prog"><i style="width:' + (x.m / pm * 100).toFixed(1) + '%"></i></span><b>' + E(fmt(x.m)) + '</b></div>';
        }).join('') + '</div>';
      }
    }
    return h;
  }
  function openApp(id) {
    var a = knownApps().filter(function (x) { return x.id === id; })[0] || mkApp(id, labelOf(id), 0);
    var today = usedMin(id, 0), week = weekOf(id), wmax = Math.max.apply(null, week.concat([0.0001]));
    var nonzero = week.filter(function (x) { return x > 0; });
    var dn = DAYS(), labels = []; for (var i = -6; i <= 0; i++) { var d = new Date(); d.setDate(d.getDate() + i); labels.push(dn[(d.getDay() + 6) % 7]); }
    var idx = -1; (cfg().rules || []).forEach(function (x, i) { if (x.app === id && idx === -1) idx = i; });
    var lim = idx !== -1 ? cfg().rules[idx] : null;
    var td = dayModel(0).apps.filter(function (x) { return x.id === id; })[0], opensToday = td ? td.o || 0 : 0;
    var o = openSheet('<div class="fg-appd">' + tile(a, 'lg') + '<div><h3>' + E(a.n) + '</h3><small>' + E(a.exe) + ' · ' + E(T(CATS[a.cat] || CATS.other)) + '</small></div></div>' +
      '<div class="fg-kpis in"><div><b>' + E(fmt(today)) + '</b><span>' + E(L('Bugun', 'Today', 'Сегодня')) + '</span></div><div><b>' + E(fmt(nonzero.length ? nonzero.reduce(function (s, x) { return s + x; }, 0) / nonzero.length : 0)) + '</b><span>' + E(L('O\'rtacha', 'Daily avg', 'В среднем')) + '</span></div><div><b>' + E(fmt(week.reduce(function (s, x) { return s + x; }, 0))) + '</b><span>' + E(L('7 kunda', '7 days', 'За 7 дней')) + '</span></div></div>' +
      '<div class="fg-lbl">' + E(L('Oxirgi 7 kun', 'Last 7 days', 'Последние 7 дней')) + '</div><div class="fg-week">' + week.map(function (v, i) { return '<div class="' + (i === 6 ? 'now' : '') + '" title="' + E(fmt(v)) + '"><i style="height:' + Math.max(v ? 4 : 0, v / wmax * 100) + '%"></i><span>' + labels[i] + '</span></div>'; }).join('') + '</div>' +
      appWhenHtml(id) +
      (lim ? '<div class="fg-note">⏳ ' + E(lim.kind === 'daily' ? L('Kunlik limit', 'Daily limit', 'Дневной лимит') + ': ' + fmt(ruleMin(lim, 0)) + (lim.perDay ? ' · 📅 ' + L('kunlar bo\'yicha', 'per day', 'по дням') : '') : ruleDesc(lim)) + '</div>' : '') +
      (opensToday ? '<div class="fg-note">🔁 ' + E(L('Bugun ' + opensToday + ' marta ochildi', 'Opened ' + opensToday + ' times today', 'Сегодня открыто ' + opensToday + ' раз')) + '</div>' : '') +
      (INSITE.some(function (x) { return x[0] === id; }) ? donutHtml(id) : '') +
      '<div class="fg-lbl">' + E(L('Kategoriya', 'Category', 'Категория')) + '</div><div class="fg-catpick">' + CAT_LIST.map(function (c) { return '<button type="button" class="' + (a.cat === c[0] ? 'on' : '') + '" data-fg-setcat="' + c[0] + '" style="--cc:' + c[3] + '">' + c[1] + ' ' + E(T(c[2])) + '</button>'; }).join('') + '</div>' +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-blocknow>🚫 ' + E(L('Doimiy bloklash', 'Always block', 'Всегда блокировать')) + '</button><button type="button" class="fg-btn" data-fg-limitnow>⏳ ' + E(lim ? L('Limitni o\'zgartirish', 'Edit limit', 'Изменить лимит') : L('Limit qo\'yish', 'Set a limit', 'Поставить лимит')) + '</button></div>');
    o.querySelectorAll('[data-fg-setcat]').forEach(function (b) {
      b.onclick = function () {
        if (!real()) { needConnect(); return; }
        var c = cfg(); c.cats = c.cats || {}; c.cats[id] = b.dataset.fgSetcat; saveCfg();
        o.querySelectorAll('[data-fg-setcat]').forEach(function (x) { x.classList.toggle('on', x === b); });
        rerender();
        try { toast(catInfo(b.dataset.fgSetcat)[1] + ' ' + a.n + ' → ' + T(catInfo(b.dataset.fgSetcat)[2])); } catch (e) {}
      };
    });
    o.querySelector('[data-fg-limitnow]').onclick = function () {
      if (lim) { openRuleSheet(idx); return; }
      if (!real()) { needConnect(); return; }
      var c = cfg(); c.rules.push({ id: 'r' + Date.now().toString(36), app: id, label: a.n, kind: 'daily', minutes: 60, on: true });
      openRuleSheet(c.rules.length - 1);
    };
    o.querySelector('[data-fg-blocknow]').onclick = function () {
      if (!real()) { needConnect(); return; }
      var c = cfg(); c.rules.push({ id: 'r' + Date.now().toString(36), app: id, label: a.n, kind: 'always', on: true });
      saveCfg(); closeSheet(); rerender();
      try { toast('🚫 ' + a.n + ' — ' + L('bloklandi', 'blocked', 'заблокировано')); } catch (e) {}
    };
  }
  function openAllApps() {
    var all = installed(), today = {}; dayModel(0).apps.forEach(function (a) { today[a.id] = a.m; });
    var rules = cfg().rules || [];
    var o = openSheet('<h3>💻 ' + E(L('Kompyuterdagi dasturlar', 'Apps on your computer', 'Программы на компьютере')) + ' <small class="fg-h-n">' + all.length + '</small></h3>' +
      '<input class="fg-in fg-all-q" autocomplete="off" placeholder="🔍 ' + E(L('Dastur qidirish…', 'Search apps…', 'Поиск программ…')) + '">' +
      '<div class="fg-all">' + (all.length ? all.map(function (a) {
        var r = rules.filter(function (x) { return x.app === a.id && x.on; })[0];
        return '<button type="button" class="fg-all-r" data-fg-appopen="' + E(a.id) + '" data-q="' + E((a.n + ' ' + a.id).toLowerCase()) + '">' + tileFor(a.id, 'sm') + '<span class="fg-all-n"><b>' + E(a.n) + '</b><small>' + E(a.id) + '</small></span>' +
          (r ? '<em class="fg-tag' + (r.kind === 'always' ? ' red' : '') + '">' + E(r.kind === 'daily' ? '⏳ ' + fmt(r.minutes) : r.kind === 'always' ? '🚫' : r.kind === 'schedule' ? '🗓' : '⏲') + '</em>' : '') +
          '<span class="fg-all-t">' + (today[a.id] ? E(fmt(today[a.id])) : '') + '</span><i>›</i></button>';
      }).join('') : '<div class="fg-empty">' + E(L('Ro\'yxat hali kelmagan. Focusgate\'ni yangilang (v0.2+) — bir necha daqiqada barcha dasturlar shu yerda chiqadi.', 'No list yet. Update Focusgate (v0.2+) — all apps appear here within minutes.', 'Списка пока нет. Обновите Focusgate (v0.2+) — программы появятся через пару минут.')) + '</div>') + '</div>');
    var q = o.querySelector('.fg-all-q');
    q.oninput = function () { var v = q.value.trim().toLowerCase(); o.querySelectorAll('.fg-all-r').forEach(function (r) { r.hidden = !!v && r.getAttribute('data-q').indexOf(v) === -1; }); };
    setTimeout(function () { try { if (window.matchMedia('(pointer: fine)').matches) q.focus(); } catch (e) {} }, 250);
  }
  function allAppsBtn() {
    var n = installed().length;
    return '<button type="button" class="fg-allbtn" data-fg-allapps><span>💻</span><b>' + E(L('Kompyuterdagi barcha dasturlar', 'All apps on your computer', 'Все программы на компьютере')) + '</b><em>' + (n || '—') + '</em><i>›</i></button>';
  }
  function soon() { try { toast('🧩 ' + L('Brauzer kengaytmasi tez orada!', 'Browser extension coming soon!', 'Расширение браузера скоро!')); } catch (e) {} }

  // ---------- 🔌 Qurilmani uzish / kengaytmani kompyuterga bog'lash ----------
  function kindWord(k) { return k === 'ext' ? L('brauzer kengaytmasi', 'browser extension', 'расширение браузера') : k === 'phone' ? L('telefon', 'phone', 'телефон') : L('kompyuter', 'computer', 'компьютер'); }
  function unpairAsk(id) {
    var d = devById(id); if (!d) return;
    var k = devKind(d), c = cfg();
    // Qat'iy rejim: qurilmani uzish — limitlarni o'chirish bilan teng
    if (c.strict && real()) { toast('🔐 ' + L('Qat\'iy rejimda qurilmani uzib bo\'lmaydi — avval Sozlamalarda qat\'iy rejimni o\'chiring', 'Strict mode: devices can\'t be removed — turn strict mode off in Settings first', 'Строгий режим: нельзя отключить устройство — сначала выключите строгий режим')); return; }
    guard(function () {
      var kids = FG.devices.filter(function (x) { return x.parent_id === d.id; });
      var o = openSheet('<h3>🔌 ' + E(L('Uzish', 'Remove', 'Отключить')) + ': ' + E(devName(d)) + '</h3><p class="fg-p">' +
        E(L('Shu ' + kindWord(k) + 'da Focusgate ishlashdan to\'xtaydi: vaqt hisoblanmaydi va hech narsa bloklanmaydi. Statistikasi saqlanib qoladi.', 'Focusgate stops working on this ' + kindWord(k) + ': no tracking and nothing is blocked. Its stats are kept.', 'Focusgate перестанет работать на этом устройстве: учёт и блокировка остановятся. Статистика сохранится.')) +
        (kids.length ? '<br><br>🧩 ' + E(L('Shu kompyuterdagi kengaytma alohida ishlashda davom etadi — uni ham uzish uchun yonidagi ✕ ni bosing.', 'The extension on this computer keeps working on its own — press ✕ next to it to remove it too.', 'Расширение на этом компьютере продолжит работать — чтобы отключить и его, нажмите ✕ рядом.')) : '') +
        '</p><div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn danger" data-fg-unpairok>' + E(L('Uzish', 'Remove', 'Отключить')) + '</button></div>');
      o.querySelector('[data-fg-unpairok]').onclick = async function () {
        this.disabled = true;
        var r = await supabase.from('fg_devices').delete().eq('id', d.id);
        if (r.error) { toast('⚠️ ' + r.error.message); this.disabled = false; return; }
        closeSheet(); toast('🔌 ' + devName(d) + ' — ' + L('uzildi', 'removed', 'отключено')); load(true);
      };
    });
  }
  // ✏️ Qurilmaga o'z nomini berish (masalan "Uy kompyuteri — Shodruz"). Bo'sh qoldirilsa — avtomatik nom qaytadi
  function renameAsk(id) {
    var d = devById(id); if (!d) return;
    var o = openSheet('<h3>✏️ ' + E(L('Qurilma nomi', 'Device name', 'Название устройства')) + '</h3>' +
      '<p class="fg-p">' + E(L('Adashmaslik uchun tushunarli nom bering: "Uy kompyuteri", "Ish noutbuki", "Shodruz — Chrome"…', 'Give it a clear name so you don\'t mix them up: "Home PC", "Work laptop", "Shodruz — Chrome"…', 'Дайте понятное название, чтобы не путать: «Домашний ПК», «Рабочий ноутбук»…')) + '</p>' +
      '<input class="fg-in" data-fg-renin maxlength="40" autocomplete="off" value="' + E(d.label || '') + '" placeholder="' + E(String(d.name || '')) + '">' +
      '<small class="fg-p" style="display:block;margin-top:6px;opacity:.75">' + E(L('Avtomatik nom: ', 'Automatic name: ', 'Автоматическое имя: ') + (d.name || '—')) + '</small>' +
      '<div class="fg-acts">' + (d.label ? '<button type="button" class="fg-btn ghost" data-fg-renreset>↩️ ' + E(L('Avtomatik nom', 'Automatic name', 'Авто-имя')) + '</button>' : '<button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button>') +
      '<button type="button" class="fg-btn" data-fg-renok>' + E(L('Saqlash', 'Save', 'Сохранить')) + '</button></div>');
    var inp = o.querySelector('[data-fg-renin]');
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 150);
    var save = async function (val) {
      var r = await supabase.rpc('fg_rename_device', { p_dev: id, p_label: val });
      if (r.error) { toast('⚠️ ' + r.error.message); return; }
      d.label = r.data || null; closeSheet(); rerender(); load(true);
      toast('✏️ ' + devName(d));
    };
    o.querySelector('[data-fg-renok]').onclick = function () { save(inp.value.trim()); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') save(inp.value.trim()); };
    var rs = o.querySelector('[data-fg-renreset]'); if (rs) rs.onclick = function () { save(''); };
  }
  async function linkExt(id, parent) {
    if (!parent) return;
    var r = await supabase.rpc('fg_link_device', { p_dev: id, p_parent: parent });
    if (r.error) { toast('⚠️ ' + r.error.message); return; }
    var p = devById(parent); toast('🔗 ' + L('Kengaytma bog\'landi: ', 'Extension linked to ', 'Расширение привязано: ') + (p ? devName(p) : '')); load(true);
  }

  // 🔐 Qat'iy rejimni o'chirish — darhol emas, 24 soatdan keyin (o'ylab ko'rish vaqti); fokus paytida — umuman yo'q
  function strictOffAsk() {
    var c = cfg();
    if (focusLeft() > 0) { toast('🔐 ' + L('Fokus tugaguncha qat\'iy rejimni o\'chirib bo\'lmaydi', 'Strict mode can\'t be turned off until focus ends', 'Нельзя выключить строгий режим до конца фокуса')); return; }
    if (c.strictOffAt) {
      var o2 = openSheet('<h3>🔐 ' + E(L('Qat\'iy rejim o\'chirilmoqda', 'Strict mode is turning off', 'Строгий режим выключается')) + '</h3><p class="fg-p">' + E(L('O\'chish vaqti: ', 'Turns off at: ', 'Выключится: ') + new Date(c.strictOffAt).toLocaleString()) + '</p>' +
        '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Yopish', 'Close', 'Закрыть')) + '</button><button type="button" class="fg-btn" data-strict-keep>🔐 ' + E(L('Qat\'iy rejimda qolish', 'Keep strict mode', 'Оставить строгий режим')) + '</button></div>');
      o2.querySelector('[data-strict-keep]').onclick = function () { delete cfg().strictOffAt; saveCfg(); closeSheet(); rerender(); };
      return;
    }
    guard(function () {
      var o = openSheet('<h3>🔐 ' + E(L('Qat\'iy rejimni o\'chirish', 'Turn off strict mode', 'Выключить строгий режим')) + '</h3><p class="fg-p">' + E(L('Qat\'iy rejim 24 soatdan keyin o\'chadi — bu vaqt ichida fikringizni o\'zgartirishingiz mumkin. Shungacha limitlar avvalgidek ishlaydi.', 'Strict mode turns off in 24 hours — you can change your mind until then. Limits keep working as before.', 'Строгий режим выключится через 24 часа — до этого можно передумать. Лимиты продолжат работать.')) + '</p>' +
        '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-strict-off>' + E(L('24 soatdan keyin o\'chirish', 'Turn off in 24 h', 'Выключить через 24 ч')) + '</button></div>');
      o.querySelector('[data-strict-off]').onclick = function () { cfg().strictOffAt = Date.now() + 24 * 3600e3; saveCfg(); closeSheet(); rerender(); toast('⏳ ' + L('Qat\'iy rejim 24 soatdan keyin o\'chadi', 'Strict mode turns off in 24 hours', 'Строгий режим выключится через 24 часа')); };
    });
  }
  function strictTick() { var c = FG.cfg; if (real() && c && c.strict && c.strictOffAt && Date.now() >= c.strictOffAt && !(focusLeft() > 0)) { c.strict = false; delete c.strictOffAt; saveCfg(); rerender(); } }
  setInterval(strictTick, 60000);

  // ---------- 🔗 Kompyuterni ulash (#fgpair=XXXX-XXXX) ----------
  var _pairWait = 0;
  function pairFromHash() {
    var m = /fgpair=([A-Za-z2-9]{4}-[A-Za-z2-9]{4})/.exec(location.hash || '');
    // Akkauntga kirilmagan paytda kelgan kod — kirgandan keyin davom etamiz (15 daqiqa ichida)
    if (!m) { try { var pend = JSON.parse(sessionStorage.getItem('fgPendingPair') || 'null'); if (pend && sbOk() && Date.now() - pend.at < 14 * 60000) { sessionStorage.removeItem('fgPendingPair'); m = [0, pend.code]; } } catch (e) {} }
    if (!m) { if (/^#focusgate/.test(location.hash || '')) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} setTimeout(function () { window.xOpenBlocker(); }, 300); } return; }
    var code = m[1].toUpperCase();
    if (!sbOk()) {
      if (_pairWait++ < 40) { setTimeout(pairFromHash, 1500); return; } // sessiya tiklanishini kutamiz
      try { sessionStorage.setItem('fgPendingPair', JSON.stringify({ code: code, at: Date.now() })); history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      openSheet('<h3>🔐 ' + E(L('Avval akkauntga kiring', 'Sign in first', 'Сначала войдите')) + '</h3><p class="fg-p">' + E(L('Qurilmani ulash uchun LevelUpDay akkauntingizga kiring — kirganingizdan keyin ulash oynasi o\'zi ochiladi (kod 15 daqiqa amal qiladi).', 'Sign in to your LevelUpDay account — the connect window reopens by itself after you sign in (the code is valid for 15 minutes).', 'Войдите в аккаунт LevelUpDay — окно подключения откроется само после входа (код действует 15 минут).')) + '</p>');
      return;
    }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    var o = openSheet('<div class="fg-pair"><span class="fg-pair-ic" data-pi-ic>💻</span><h3 data-pi-t>' + E(L('Qurilmani ulash', 'Connect a device', 'Подключить устройство')) + '</h3>' +
      '<div class="fg-pair-dev" data-pi-dev>⏳</div>' +
      '<p class="fg-p">' + E(L('Focusgate shu kodni ko\'rsatyaptimi? Tasdiqlasangiz, qurilma akkauntingizga ulanadi. Siz o\'zingiz boshlamagan bo\'lsangiz — bekor qiling.', 'Does Focusgate show this code? Confirm to link the device to your account. If you didn\'t start this yourself — cancel.', 'Focusgate показывает этот код? Подтвердите, чтобы привязать устройство. Если вы этого не начинали — отмените.')) + '</p>' +
      '<div class="fg-code">' + E(code) + '</div>' +
      '<div class="fg-acts"><button type="button" class="fg-btn ghost" data-fg-close>' + E(L('Bekor qilish', 'Cancel', 'Отмена')) + '</button><button type="button" class="fg-btn" data-fg-pairok>✅ ' + E(L('Ulash', 'Connect', 'Подключить')) + '</button></div></div>');
    // Qaysi qurilma ulanmoqda (nomi, turi, qachon) — begona havola bilan ulab yubormaslik uchun
    supabase.functions.invoke('focusgate', { body: { action: 'pair_info', code: code } }).then(function (r) {
      var box = o.querySelector('[data-pi-dev]'); if (!box) return;
      var d = r && r.data, err = (r && r.error) || (d && d.error);
      if (err || !d || !d.name) {
        var msg = String((d && d.error) || (err && err.message) || err || '');
        box.innerHTML = '⚠️ ' + E(/expired|410/.test(msg) ? L('Kod eskirgan — Focusgate\'da qayta ulashni bosing', 'The code expired — start connecting again in Focusgate', 'Код устарел — начните подключение заново') : /already|409/.test(msg) ? L('Bu kod allaqachon ishlatilgan', 'This code was already used', 'Код уже использован') : L('Qurilma ma\'lumotini olib bo\'lmadi', 'Couldn\'t load device info', 'Не удалось получить данные устройства'));
        if (/expired|410|already|409/.test(msg)) { var ok = o.querySelector('[data-fg-pairok]'); if (ok) ok.disabled = true; }
        return;
      }
      var ic = d.kind === 'ext' ? '🧩' : d.kind === 'phone' ? '📱' : '💻';
      o.querySelector('[data-pi-ic]').textContent = ic;
      o.querySelector('[data-pi-t]').textContent = d.kind === 'ext' ? L('Brauzer kengaytmasini ulash', 'Connect the browser extension', 'Подключить расширение') : d.kind === 'phone' ? L('Telefonni ulash', 'Connect the phone', 'Подключить телефон') : L('Kompyuterni ulash', 'Connect the computer', 'Подключить компьютер');
      box.innerHTML = '<b>' + E(d.name) + '</b><small>' + E(L('So\'rov ', 'Requested ', 'Запрос ') + (d.age_sec < 60 ? L('hozirgina', 'just now', 'только что') : Math.round(d.age_sec / 60) + ' ' + L('daqiqa oldin', 'min ago', 'мин назад'))) + '</small>';
    }, function () {});
    o.querySelector('[data-fg-pairok]').onclick = async function () {
      var b = this; b.disabled = true; b.textContent = '…';
      try {
        var r = await supabase.functions.invoke('focusgate', { body: { action: 'pair_approve', code: code } });
        var err = r.error || (r.data && r.data.error);
        if (err) throw new Error(typeof err === 'string' ? err : (err.message || 'error'));
        closeSheet();
        var kd = r.data && r.data.device && r.data.device.kind;
        try { toast('✅ ' + (kd === 'ext' ? L('Kengaytma ulandi! U shu kompyuterdagi Focusgate\'ni o\'zi topadi.', 'Extension connected! It finds Focusgate on this computer by itself.', 'Расширение подключено! Оно само найдёт Focusgate на этом компьютере.') : L('Qurilma ulandi! Bir daqiqada statistika paydo bo\'ladi.', 'Device connected! Stats appear within a minute.', 'Устройство подключено! Статистика появится через минуту.'))); } catch (e) {}
        await load(true);
        window.xOpenBlocker('today');
      } catch (e) {
        b.disabled = false; b.textContent = L('Qayta urinish', 'Try again', 'Повторить');
        var msg = String(e && e.message || e);
        try { toast('⚠️ ' + (/expired|410/.test(msg) ? L('Kod eskirgan — Focusgate\'da "Akkauntga ulash" ni qayta bosing', 'Code expired — press "Connect account" in Focusgate again', 'Код устарел — снова нажмите «Подключить» в Focusgate') : L('Ulab bo\'lmadi: ', 'Could not connect: ', 'Не удалось: ') + msg)); } catch (e2) {}
      }
    };
  }
  window.addEventListener('hashchange', function () { _pairWait = 0; pairFromHash(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('[data-fg-codein]')) { e.preventDefault(); codeGo(e.target); } });

  // ---------- Chizish ----------
  function render() {
    loadLocal();
    var v = document.getElementById('view-blocker'); if (!v) return;
    if (!FG.loaded && sbOk()) { load(); }
    var page = UI.tab === 'limits' ? pageLimits() : UI.tab === 'block' ? pageBlock() : UI.tab === 'settings' ? pageSettings() : UI.tab === 'compete' ? pageCompete() : pageToday();
    if (UI.tab === 'compete' && sbOk()) loadSocial();
    // Qidiruv matni va fokus qayta chizishda yo'qolmasin
    var si = v.querySelector('[data-fg-search]'), sq = si ? si.value : '', sf = si && document.activeElement === si;
    v.innerHTML = '<div class="fg' + (real() ? ' is-real' : ' is-demo') + '">' + hero() + connectCard() + (real() ? searchHtml() : '') + nav() + '<div class="fg-page" data-p="' + UI.tab + '">' + page + '</div>' + (real() ? '' : demoNote()) + '</div>';
    if (sq) { var ni = v.querySelector('[data-fg-search]'); if (ni) { ni.value = sq; searchRun(ni); if (sf) ni.focus(); } }
    bindSort(v);
  }
  // ↕️ Bosib turib sudrash (Sortable.js — vendor/)
  function bindSort(root) {
    if (typeof Sortable === 'undefined' || !root) return;
    root.querySelectorAll('.fg-list[data-sort]').forEach(function (list) {
      if (list._sort) return;
      list._sort = Sortable.create(list, {
        animation: 180, delay: 170, delayOnTouchOnly: false, touchStartThreshold: 6, draggable: '.fg-sortable',
        filter: '.fg-sw, .fg-del', preventOnFilter: false, ghostClass: 'fg-ghost', chosenClass: 'fg-chosen', dragClass: 'fg-drag',
        onEnd: function (ev) {
          if (ev.oldIndex === ev.newIndex) return;
          if (!real()) { rerender(); needConnect(); return; }
          var c = cfg();
          if (list.dataset.sort === 'focus') {
            var order = Array.prototype.map.call(list.querySelectorAll('[data-app]'), function (x) { return x.dataset.app; });
            c.focusApps.sort(function (a, b) { return order.indexOf(a.app) - order.indexOf(b.app); });
          } else {
            var ids = [];
            root.querySelectorAll('.fg-list[data-sort="blocked"] [data-id], .fg-list[data-sort="daily"] [data-id]').forEach(function (x) { ids.push(x.dataset.id); });
            c.rules.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
          }
          saveCfg();
          setTimeout(rerender, 0); // data-fg-edit indekslari yangilansin
        }
      });
    });
  }
  function visible() { var v = document.getElementById('view-blocker'); return !!(v && v.style.display !== 'none' && v.offsetParent !== null); }
  function rerender() { if (visible()) { var y = window.scrollY; render(); window.scrollTo(0, y); } renderEmbeds(); }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var inView = t.closest('#view-blocker'), inSheet = t.closest('.fg-sheet'), inEmb = t.closest('.fg-scope');
    if (!inView && !inSheet && !inEmb) return;
    var b, c = cfg();
    if ((b = t.closest('[data-fg-soon]'))) { soon(); return; }
    if ((b = t.closest('[data-fg-go]'))) { window.xOpenBlocker(b.dataset.fgGo); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e2) {} return; }
    if (!t.closest('.fg-search')) document.querySelectorAll('#view-blocker .fg-search-r').forEach(function (x) { x.hidden = true; });
    if ((b = t.closest('[data-fg-appopen]'))) { openApp(b.dataset.fgAppopen); return; }
    if ((b = t.closest('[data-fg-weekly]'))) { openWeekly(); return; }
    if ((b = t.closest('[data-fg-allapps]'))) { openAllApps(); return; }
    if ((b = t.closest('[data-fg-extinstall]'))) { if (DOWNLOADS_ON) openExtInstall(); return; }
    if ((b = t.closest('[data-fg-addsite]'))) { openSitePicker(); return; }
    if ((b = t.closest('[data-fg-codego]'))) { codeGo(b); return; }
    if ((b = t.closest('[data-fg-join]'))) { joinFocus(b.dataset.fgJoin, +b.dataset.min); return; }
    if ((b = t.closest('[data-fg-invite]'))) { try { if (typeof openFriendsModal === 'function') openFriendsModal(); } catch (e2) {} return; }
    if ((b = t.closest('[data-fg-board]'))) { UI.board = b.dataset.fgBoard; rerender(); return; }
    if ((b = t.closest('.fg-sw[data-fg-insite]'))) {
      if (!real()) { needConnect(); return; }
      var ik = b.dataset.fgInsite, ion = !!(c.inSite || {})[ik];
      if (ion && c.strict) return;
      var itog = function () { var cc = cfg(); cc.inSite = cc.inSite || {}; cc.inSite[ik] = !ion; saveCfg(); rerender(); };
      if (ion) guard(itog); else itog();
      return;
    }
    if ((b = t.closest('[data-fg-unpair]'))) { unpairAsk(b.dataset.fgUnpair); return; }
    if ((b = t.closest('[data-fg-rename]'))) { renameAsk(b.dataset.fgRename); return; }
    if ((b = t.closest('.fg-sw[data-fg-set]'))) {
      var k = b.dataset.fgSet;
      if (k === 'reward') { LOCAL.reward = !LOCAL.reward; saveLocal(); }
      else if (k === 'tg') { if (!FG.tg) return; var pr = Object.assign({}, FG.tg.prefs || {}); pr.fg = pr.fg === false; FG.tg.prefs = pr; supabase.from('telegram_links').update({ prefs: pr }).eq('user_id', S.cloudUserId).then(function () {}); }
      else if (k === 'tgweekly') { if (!FG.tg) return; var pw = Object.assign({}, FG.tg.prefs || {}); var wasOn = !(pw.fg === false || pw.fgweekly === false); pw.fgweekly = !wasOn; if (!wasOn) pw.fg = true; FG.tg.prefs = pw; supabase.from('telegram_links').update({ prefs: pw }).eq('user_id', S.cloudUserId).then(function () {}); }
      else if (real() && k === 'strict' && c.strict) { strictOffAsk(); }
      else if (real()) { c[k] = !(k === 'strict' ? c.strict : c[k] !== false); if (k === 'strict') delete c.strictOffAt; saveCfg(); if (k === 'share') SOC.at = 0; }
      else { needConnect(); return; }
      rerender(); return;
    }
    if (!inView) return;
    if ((b = t.closest('[data-fg-tab]'))) { UI.tab = b.dataset.fgTab; render(); return; }
    if ((b = t.closest('[data-fg-acc]'))) { var k2 = b.dataset.fgAcc; UI.openSite = UI.openSite === k2 ? null : k2; rerender(); return; }
    if ((b = t.closest('[data-fg-badge]'))) { badgeGo(b); return; }
    if ((b = t.closest('[data-fg-setup]'))) { UI.setupOpen = !UI.setupOpen; render(); return; }
    if ((b = t.closest('[data-fg-setupstep]'))) { setupGo(b.dataset.fgSetupstep); return; }
    if ((b = t.closest('[data-fg-reset]'))) { UI.day = 0; UI.dev = 'all'; UI.metric = 'time'; UI.kind = 'all'; UI.cat = 'all'; UI.hr = -1; UI.hide = {}; render(); return; }
    if ((b = t.closest('[data-fg-hr]'))) { var hr = +b.dataset.fgHr; UI.hr = UI.hr === hr ? -1 : hr; rerender(); return; }
    if ((b = t.closest('[data-fg-hide]'))) { var hk = b.dataset.fgHide; UI.hide[hk] = !UI.hide[hk]; if (UI.hide.a && UI.hide.b) UI.hide[hk === 'a' ? 'b' : 'a'] = false; rerender(); return; }
    if ((b = t.closest('[data-fg-eye]'))) { UI.hide = UI.hide.a || UI.hide.b ? {} : { b: true }; rerender(); return; }
    if ((b = t.closest('[data-fg-hist]'))) { openHistory(); return; }
    if ((b = t.closest('[data-fg-moresites]'))) { UI.allSites = !UI.allSites; rerender(); return; }
    if ((b = t.closest('[data-fg-pause]'))) { if (!real()) { needConnect(); return; } startPause(+b.dataset.fgPause); return; }
    if ((b = t.closest('[data-fg-resume]'))) { c.pauseUntil = 0; saveCfg(); rerender(); return; }
    if ((b = t.closest('[data-fg-pin]'))) { openPinSheet('set'); return; }
    if ((b = t.closest('[data-fg-warnat]'))) { var wp = +b.dataset.fgWarnat, wa = (c.warnAt || []).slice(), wi = wa.indexOf(wp); if (wi === -1) wa.push(wp); else wa.splice(wi, 1); c.warnAt = wa.sort(function (x, y) { return x - y; }); saveCfg(); rerender(); return; }
    if ((b = t.closest('[data-fg-allowmode]'))) {
      if (!real()) { needConnect(); return; }
      var am = b.dataset.fgAllowmode === '1';
      if (!!c.allowOnly === am) return;
      if (!am && focusLeft() > 0) { if (c.strict) { toast('🔐 ' + L('Qat\'iy rejim: fokus tugaguncha o\'zgartirib bo\'lmaydi', 'Strict mode: can\'t change until focus ends', 'Строгий режим: нельзя менять до конца фокуса')); return; } guard(function () { cfg().allowOnly = false; saveCfg(); rerender(); }); return; }
      c.allowOnly = am; saveCfg(); rerender(); return;
    }
    if ((b = t.closest('[data-fg-addallow]'))) { if (!real()) { needConnect(); return; } pickApps(c.allowApps || [], function (out) { cfg().allowApps = out.map(function (x) { return { app: x.app, label: x.label, on: true }; }); saveCfg(); rerender(); }, { plain: true, cats: true, title: L('Fokusda ruxsat etilganlar', 'Allowed during focus', 'Разрешено во время фокуса') }); return; }
    if ((b = t.closest('[data-fg-aldel]'))) { c.allowApps.splice(+b.dataset.fgAldel, 1); saveCfg(); rerender(); return; }
    if ((b = t.closest('[data-fg-addmode]'))) { openModeSheet(null); return; }
    if ((b = t.closest('[data-fg-modeedit]'))) { openModeSheet(+b.dataset.fgModeedit); return; }
    if ((b = t.closest('[data-fg-addmindful]'))) {
      if (!real()) { needConnect(); return; }
      pickApps(c.mindful || [], function (out) {
        var prev = {}; (cfg().mindful || []).forEach(function (f) { prev[f.app] = f; });
        cfg().mindful = out.map(function (x) { return { app: x.app, label: x.label, on: prev[x.app] ? prev[x.app].on !== false : true }; }); saveCfg(); rerender();
      }, { plain: true, title: L('Ongli ochish: qaysilar?', 'Mindful opening: which ones?', 'Осознанное открытие: что именно?') });
      return;
    }
    if ((b = t.closest('[data-fg-mfdel]'))) { var mi = +b.dataset.fgMfdel; guard(function () { cfg().mindful.splice(mi, 1); saveCfg(); rerender(); }); return; }
    if ((b = t.closest('[data-fg-mfsec]'))) { c.mindfulSec = +b.dataset.fgMfsec; saveCfg(); rerender(); return; }
    if ((b = t.closest('[data-fg-mfmin]'))) { c.mindfulMin = +b.dataset.fgMfmin; saveCfg(); rerender(); return; }
    if ((b = t.closest('[data-fg-catf]'))) { UI.cat = b.dataset.fgCatf; render(); return; }
    if ((b = t.closest('[data-fg-day]'))) { UI.day = Math.max(-(HIST_DAYS - 1), Math.min(0, UI.day + (+b.dataset.fgDay))); UI.hr = -1; render(); return; }
    if ((b = t.closest('.fg-date-l'))) { var di = b.querySelector('input'); try { if (di && di.showPicker && e.target !== di) di.showPicker(); } catch (e3) {} return; }
    if ((b = t.closest('[data-fg-kind]'))) { UI.kind = b.dataset.fgKind; render(); return; }
    if ((b = t.closest('[data-fg-dev]'))) { UI.dev = b.dataset.fgDev; render(); return; }
    if ((b = t.closest('[data-fg-chart]'))) { UI.chart = b.dataset.fgChart; render(); return; }
    if ((b = t.closest('[data-fg-min]'))) { UI.focusMin = +b.dataset.fgMin; render(); return; }
    if ((b = t.closest('[data-fg-addlimit]'))) { openRuleSheet(null); return; }
    if ((b = t.closest('[data-fg-addfocus]'))) { openFocusAppSheet(); return; }
    if ((b = t.closest('[data-fg-edit]'))) { openRuleSheet(+b.dataset.fgEdit); return; }
    if ((b = t.closest('[data-fg-app]'))) { openApp(b.dataset.fgApp); return; }
    if ((b = t.closest('[data-fg-focus]'))) {
      if (!real()) { needConnect(); return; }
      if (!c.allowOnly && !(c.focusApps || []).some(function (f) { return f.on; })) { try { toast('➕ ' + L('Avval fokusda bloklanadigan dastur qo\'shing', 'Add an app to block during focus first', 'Сначала добавьте приложение для блокировки')); } catch (e2) {} return; }
      startFocus(UI.focusMin, null);
      return;
    }
    if ((b = t.closest('[data-fg-stop]'))) { if (c.strict) return; guard(stopFocus); return; }
    if ((b = t.closest('[data-fg-withfocus]'))) { try { window.xOpenFocus(null, true, UI.focusMin); } catch (e2) {} return; }
    if ((b = t.closest('[data-fg-withpomo]'))) { try { pomoOpenModal(); } catch (e2) {} return; }
    if ((b = t.closest('[data-fg-fadel]'))) { var fi = +b.dataset.fgFadel; guard(function () { cfg().focusApps.splice(fi, 1); saveCfg(); rerender(); }); return; }
    if ((b = t.closest('.fg-sw')) && !b.hasAttribute('data-pk')) {
      if (!real()) { needConnect(); return; }
      var d = b.dataset, off = null; // off — o'chirish (yumshatish) amali: PIN bo'lsa so'raladi
      if (d.fgRule != null) { var r = c.rules[+d.fgRule]; if (c.strict && r.on) return; if (r.on) off = function () { r.on = false; }; else r.on = true; }
      else if (d.fgFa != null) { var f = c.focusApps[+d.fgFa]; if (c.strict && f.on && focusLeft() > 0) return; if (f.on && focusLeft() > 0) off = function () { f.on = false; }; else f.on = !f.on; }
      else if (d.fgMode != null) { var md = c.modes[+d.fgMode]; if (c.strict && md.on) return; if (md.on) off = function () { md.on = false; }; else { md.on = true; try { toast((md.icon || '🎭') + ' ' + md.name + ' — ' + L('yoqildi', 'on', 'включён')); } catch (e2) {} } }
      else if (d.fgMf != null) { var mf = c.mindful[+d.fgMf]; if (mf.on !== false) off = function () { mf.on = false; }; else mf.on = true; }
      else if (d.fgSite != null) {
        var key = d.fgSite, ex = c.rules.filter(function (x) { return x.app === key && x.kind === 'always'; })[0];
        if (ex) { if (c.strict && ex.on) return; if (ex.on) off = function () { ex.on = false; }; else ex.on = true; }
        else { var s = SITES.filter(function (x) { return x[0] === key; })[0]; c.rules.push({ id: 'r' + Date.now().toString(36), app: key, label: s ? s[1] : key, kind: 'always', on: true }); }
      }
      if (off) { guard(function () { off(); saveCfg(); rerender(); }); return; }
      saveCfg(); rerender();
    }
  });
  document.addEventListener('change', function (e) {
    var s = e.target; if (!s || !s.matches) return;
    if (s.matches('[data-fg-link]') && s.closest('#view-blocker, .fg-scope')) { linkExt(s.dataset.fgLink, s.value); return; }
    if (!s.closest('#view-blocker')) return;
    if (s.matches('[data-fg-cat], [data-fg-fcat]')) { UI.cat = s.value; render(); return; }
    if (s.matches('[data-fg-fdev]')) { UI.dev = s.value; render(); return; }
    if (s.matches('[data-fg-fmetric]')) { UI.metric = s.value === 'opens' ? 'opens' : 'time'; UI.hr = -1; render(); return; }
    if (s.matches('[data-fg-fkind]')) { UI.kind = s.value; render(); return; }
    if (s.matches('[data-fg-date]')) {
      var p = String(s.value || '').split('-'); if (p.length !== 3) return;
      var t0 = new Date(); t0.setHours(0, 0, 0, 0);
      var off = Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - t0) / 864e5);
      UI.day = Math.max(-(HIST_DAYS - 1), Math.min(0, off)); UI.hr = -1; render(); return;
    }
    if (s.matches('[data-fg-mincustom]')) { var m = Math.round(+s.value || 0); if (m >= 1 && m <= 600) { UI.focusMin = m; setTimeout(render, 0); } return; }
    if (s.matches('[data-fg-islim]')) {
      var c = cfg(), k = s.dataset.fgIslim, nv = +s.value || 0, ov = +((c.inSiteLim || {})[k]) || 0;
      var looser = (ov === 0 && nv > 0) || (ov > 0 && nv > ov);
      var setLim = function () { var cc = cfg(); cc.inSiteLim = cc.inSiteLim || {}; if (nv) cc.inSiteLim[k] = nv; else delete cc.inSiteLim[k]; saveCfg(); rerender(); };
      if (looser && c.strict) { toast('🔐 ' + L('Qat\'iy rejimda limitni yumshatib bo\'lmaydi', 'Strict mode: limits can\'t be loosened', 'Строгий режим: лимит нельзя ослабить')); rerender(); return; }
      if (looser) guard(setLim); else setLim();
    }
  });
  document.addEventListener('input', function (e) { var s = e.target; if (s && s.matches && s.matches('#view-blocker [data-fg-search]')) searchRun(s); });
  document.addEventListener('keydown', function (e) {
    var s = e.target; if (!s || !s.matches) return;
    if (e.key === 'Escape' && s.matches('#view-blocker [data-fg-search]')) { s.value = ''; searchRun(s); }
    if ((e.key === 'Enter' || e.key === ' ') && s.matches('#view-blocker .fg-row[data-fg-app]')) { e.preventDefault(); openApp(s.dataset.fgApp); }
  });
  // Fokus taymeri va avtoyangilanish
  setInterval(function () {
    var el = document.querySelector('#view-blocker [data-fg-live]');
    if (el) { var left = focusLeft(); if (left <= 0) rerender(); else el.textContent = mmss(left); }
    var pl = document.querySelector('#view-blocker [data-fg-plive]');
    if (pl) { var pleft = pauseLeft(); if (pleft <= 0) rerender(); else pl.textContent = mmss(pleft); }
    try { checkFocusDone(); } catch (e) {}
  }, 1000);
  setInterval(function () { if (real() && (visible() || document.querySelector('#fg-stats-card') || rwLinked().length)) load(); }, 60000);

  // 🧹 Profil → Reset: Focusgate statistikasi (ekran vaqti, bloklash tarixi, fokus sessiyalari) — serverda va qurilmalarda
  async function resetStats() {
    var st = fgS();
    ['goodDays', 'focusMin', 'focusDone', 'rewarded', 'pauses', 'sess', 'linkSess'].forEach(function (k) { delete st[k]; });
    try { save(); } catch (e) {}
    FG.rows = []; FG.events = []; _dmCache = {}; SOC.at = 0;
    if (!sbOk()) { rerender(); return { ok: true, local: true }; }
    var r = await supabase.functions.invoke('focusgate', { body: { action: 'reset_stats' } });
    var err = r.error || (r.data && r.data.error);
    if (err) throw new Error(typeof err === 'string' ? err : (err.message || 'reset_failed'));
    if (FG.cfg && r.data && r.data.at) FG.cfg.statsResetAt = r.data.at; // keyingi saqlashda yo'qolmasin
    await load(true);
    return r.data;
  }
  window.xRenderBlocker = function () { render(); if (sbOk()) load(); };
  window.xOpenBlocker = function (tab) { if (tab) UI.tab = tab; try { showTab('blocker'); } catch (e) { render(); } };
  window.LUFocusgate = { renderEmbeds: function () { renderEmbeds(); if (sbOk()) load(); }, open: function (tab) { window.xOpenBlocker(tab); }, reload: function () { return load(true); }, renderTogether: renderTogether, pickApps: pickApps, resetStats: resetStats, rewardLinked: rewardLinked, rewardHistory: rewardHistory, rewardSync: function () { try { rewardSync(); } catch (e) {} }, version: AGENT_VERSION, downloads: DOWNLOADS_ON, _state: FG, _soc: SOC };
  function boot() { try { renderEmbeds(); } catch (e) {} try { pairFromHash(); } catch (e) {} setTimeout(function () { if (sbOk()) load(true); }, 2500); }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
