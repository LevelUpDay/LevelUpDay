// ============================================================
// ToDoList PWA — Service Worker (v19 — index.html endi 3 ta faylga
// bo'lingani sababli yangilandi: styles.css va script.js endi
// alohida fayllar bo'lgani uchun PRECACHE_URLS ro'yxatiga qo'shildi.
// Aks holda ular birinchi ochilishda darhol keshlanmay, faqat
// keyingi "cache-first" oqimi orqali keshlanardi — offline holatda
// ilova birinchi marta ochilganda CSS/JS yo'qolib qolishi mumkin edi.)
// ============================================================

// MUHIM: har safar index.html/styles.css/script.js (yoki boshqa kod)ni
// yangilab qayta joylashtirganingizda, bu raqamni oshiring (v19 -> v20 -> ...).
// Shunda eski kesh butunlay o'chiriladi va yangi fayllar qayta yuklanadi.
const CACHE_VERSION = 'v159';
const CACHE_NAME = `todolist-cache-${CACHE_VERSION}`;
// Fon tovushlari (sounds/*.mp3, ~0.8 MB) — alohida, versiyalar o'rtasida o'chirilmaydigan kesh
const SOUND_CACHE = 'lud-sounds-v2';

// 🧭 Ilova bo'limlari manzillari (router.js bilan bir xil)
const ROUTE_SLUGS = ['tasks', 'profile', 'rewards', 'goals', 'hub', 'focusgate', 'spin', 'coins', 'chest', 'ielts', 'sat', 'cefr', 'leaderboard', 'pomodoro', 'stats', 'shop', 'boss', 'feed', 'inbox', 'matrix'];

// Pre-cache qilinadigan asosiy fayllar
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './extras.js',
  './extras.css',
  './designs.js',
  './designs.css',
  './ui-kit.js',
  './ui-kit.css',
  './widgets.js',
  './widgets.css',
  './blocks.js',
  './tz.js',
  './fg-icons.js',
  './blocker.js',
  './blocker.css',
  './account.js',
  './account.css',
  './ops.js',
  './ops.css',
  './admin.js',
  './mobile.css',
  './blocks.css',
  './404.html',
  './effects.js',
  './effects.css',
  './exam-prep.js',
  './exam-prep.css',
  './router.js',
  './pomo-scene.js',
  './pomo-scene.css',
  './manifest.json',
  './icons/logo.svg',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './vendor/supabase-2.117.2.js',
  './vendor/Sortable-1.15.0.min.js'
];

// Eslatma: admin.html ATAYLAB shu ro'yxatga QO'SHILMAGAN — u faqat
// to'g'ridan-to'g'ri havola orqali ochiladigan alohida (asosiy ilova
// navigatsiyasiga ulanmagan) sahifa, shu sababli har bir oddiy
// foydalanuvchi uchun keraksiz oldindan yuklashning hojati yo'q.
// Baribir ochilganda pastdagi network-first/cache-first oqimi orqali
// avtomatik keshlanadi (agar admin uni ochsa).

// Eslatma 2: Supabase JS SDK (https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)
// ATAYLAB PRECACHE_URLS ro'yxatiga QO'SHILMAGAN — bu tashqi CDN skripti
// pastdagi "cache-first + fon-yangilash" oqimi orqali birinchi so'rovda
// o'zi avtomatik keshlanadi, shuning uchun oldindan sanab o'tirishning
// hojati yo'q (va CDN vaqtincha ishlamay qolsa ham install bosqichi
// buzilib qolmaydi).

// Eslatma 3: Fokus rejimidagi ambient tovushlar (yomg'ir, oq shovqin,
// lo-fi pad va h.k.) tashqi mp3/wav fayl sifatida YO'Q — ular ilova
// ichida Web Audio API (AudioContext + oscillator/noise buffer) orqali
// real vaqtda generatsiya qilinadi. Shuning uchun bu Service Worker
// hech qanday audio faylni keshlamaydi va bilan bog'liq alohida
// qoidaga ehtiyoj yo'q.

// ---------------- INSTALL ----------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Har bir faylni alohida keshga yuklash
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const request = new Request(url, { cache: 'reload' });
            const response = await fetch(request);
            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[SW] Pre-cache xatosi:', url, err);
          }
        })
      );

      // Yangi SW tayyor bo'lishi bilan kutmasdan ishga tushadi
      self.skipWaiting();
    })()
  );
});

// ---------------- ACTIVATE ----------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Eski versiyadagi keshlar tozalanadi
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== SOUND_CACHE)
          .map((name) => {
            console.log('[SW] Eski kesh o\'chirilmoqda:', name);
            return caches.delete(name);
          })
      );
      // Barcha ochiq oynalarni zudlik bilan nazoratga olish
      await self.clients.claim();
    })()
  );
});

// ---------------- FETCH ----------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Faqat GET so'rovlarini qayta ishlaymiz
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 0. Supabase so'rovlari (auth, REST/PostgREST, realtime): Service
  // Worker BUTUNLAY chetlab o'tadi — bular har doim jonli tarmoqdan
  // ketishi shart (login holati, ma'lumotlar bazasi javoblari va h.k.
  // hech qachon eski keshdan qaytarilmasligi kerak, aks holda
  // autentifikatsiya yoki ma'lumotlar eskirib qolishi mumkin).
  if (url.hostname.endsWith('.supabase.co')) {
    return;
  }

  // 0.1 worldtimeapi.org (haqiqiy server vaqti — "soat firibgarligi"
  // / clock-tamper tekshiruvi uchun ishlatiladi, qarang: fetchServerTimeSafe()):
  // Service Worker BUTUNLAY chetlab o'tadi. AVVAL bu so'rov pastdagi
  // cache-first oqimiga tushib qolardi — birinchi muvaffaqiyatli javob
  // SW keshiga saqlanib qolar, keyingi barcha chaqiruvlar esa (hatto
  // fetch() ichida `cache:'no-store'` yozilgan bo'lsa ham, chunki bu
  // faqat brauzer HTTP keshiga tegishli, SW CacheStorage'ga emas)
  // O'SHA ESKI, DONGAB QOLGAN vaqtni qaytarardi. Natijada foydalanuvchi
  // tizim soatini orqaga surib "firibgarlik" qilsa ham, tekshiruv buni
  // sezmay qolishi mumkin edi. Endi bu so'rov har doim jonli tarmoqdan
  // ketadi va hech qachon keshlanmaydi.
  if (url.hostname === 'worldtimeapi.org') {
    return;
  }

  // 0. Yuklab olinadigan fayllar (Focusgate.exe) — SW umuman aralashmaydi (keshga 6 MB yozilmasin, eski versiya qolmasin)
  if (url.origin === self.location.origin && url.pathname.indexOf('/downloads/') !== -1) return;

  // 0.1 Fon tovushlari: bir marta yuklanadi, keyin doim keshdan (oflayn ham ishlaydi)
  if (url.origin === self.location.origin && url.pathname.indexOf('/sounds/') !== -1) {
    event.respondWith(caches.open(SOUND_CACHE).then((c) => c.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request).then((r) => {
      if (r && r.ok) c.put(request, r.clone());
      return r;
    }))));
    return;
  }

  // 1. HTML sahifa so'rovlari (Navigatsiya): Network-First
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    // 🧭 Bo'lim manzillari (/LevelUpDay/profile ...) — aslida bitta sahifa: index.html qaytaramiz
    var seg = url.pathname.replace(/\/$/, '').split('/').pop().toLowerCase();
    // ⚡ Tez ochilish: sahifa va kod shu versiya keshidan (CACHE_VERSION) darhol beriladi.
    // Yangi versiya chiqsa — brauzer yangi sw.js ni o'rnatadi, u hamma fayllarni oldindan yuklab oladi
    // va ilova o'zi bir marta qayta yuklanadi (script.js → controllerchange). Eski HTML + yangi JS aralashmaydi.
    if (url.origin === self.location.origin && ROUTE_SLUGS.indexOf(seg) !== -1) {
      event.respondWith(cacheFirstVersioned(new Request(new URL('./', self.registration.scope).href)));
      return;
    }
    event.respondWith(url.origin === self.location.origin ? cacheFirstVersioned(request) : networkFirstFallingBackToCache(request));
    return;
  }

  // 1.1 Ilovaning o'z kodi (JS/CSS/manifest): versiyalangan keshdan (har ochilishda 4 MB qayta yuklanmasin)
  if (url.origin === self.location.origin && /\.(js|css|json|webmanifest)$/.test(url.pathname) && !url.pathname.endsWith('/sw.js')) {
    event.respondWith(cacheFirstVersioned(request));
    return;
  }

  // 2. Tashqi rasmlar (masalan, flagcdn.com bayroqlari) va statik fayllar: Cache-First
  event.respondWith(cacheFirstWithNetworkFallbackAndCache(request));
});

// Versiyalangan kesh: bor bo'lsa — darhol (tarmoq kutilmaydi); yo'q bo'lsa — tarmoqdan olib keshga yoziladi.
// Navigatsiya so'rovlarida "?src=..." kabi parametrlar bo'lsa ham index.html topiladi.
async function cacheFirstVersioned(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request, { ignoreSearch: true }) ||
    (request.mode === 'navigate' ? await cache.match(new URL('./', self.registration.scope).href) || await cache.match('./index.html') : null);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && res.ok && request.method === 'GET') cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    return networkFirstFallingBackToCache(request);
  }
}

// HTML uchun: Network-First (Internet bo'lsa yangi kod, bo'lmasa kesh)
//
// MUHIM TUZATISH: ilgari bu yerda oddiy `fetch(request)` chaqirilardi.
// Muammo shundaki, bu faqat Service Worker keshini chetlab o'tardi —
// BRAUZERNING O'ZINING HTTP keshini (disk cache) chetlab o'tmasdi.
// Ba'zi hostinglar HTML uchun ham cache sarlavhalari yuborgani sabab,
// brauzer "tarmoqdan olyapman" deb turib, aslida o'zining eski HTTP
// keshidan javob qaytarib yuborishi mumkin edi — natijada yangilangan
// index.html HECH QACHON ko'rinmasdi, garchi SW "network-first"
// siyosatini to'g'ri bajarayotgan bo'lsa ham. Endi so'rov doim
// `cache: 'no-store'` bilan yuboriladi — bu brauzerni HAR SAFAR
// haqiqiy tarmoqqa murojaat qilishga majbur qiladi.
async function networkFirstFallingBackToCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const freshRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
      credentials: request.credentials,
      redirect: 'follow',
      cache: 'no-store' // <-- brauzer HTTP keshini ham chetlab o'tadi
    });
    const networkResponse = await fetch(freshRequest);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // Offline zaxira sahifasi
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;

    return new Response('Offline: Sahifa keshda topilmadi.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Statik va dynamic resurslar uchun: Cache-First + Avto-keshlash
async function cacheFirstWithNetworkFallbackAndCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  // Keshda bo'lsa darhol beriladi
  if (cached) {
    // Fonda yangilab qo'yish (Stale-while-revalidate)
    //
    // MUHIM TUZATISH: ilgari cache.put()ning natijasi (Promise) .then()
    // ichida qaytarilmagan (return qilinmagan) edi. Shu sababli, agar
    // tarmoq javobi tugallanmasdan uzilib qolsa (masalan foydalanuvchi
    // sahifani yopib yuborsa yoki ulanish beqaror bo'lsa), cache.put()
    // ichkarida bosh (floating) Promise sifatida qolib ketardi va uning
    // xatoligi HECH QANDAY .catch() bilan ushlanmay, konsolda
    // "Uncaught (in promise) NetworkError" ko'rinishida chiqib turardi
    // — garchi funksionallikka ta'siri bo'lmasa ham. Endi cache.put()
    // ham .then() ichidan qaytariladi, shu bilan u asosiy zanjirga
    // qo'shiladi va pastdagi .catch() uni ham qamrab oladi.
    fetch(request).then((networkResponse) => {
      if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
        return cache.put(request, networkResponse);
      }
    }).catch(() => {/* Offline yoki tarmoq uzilishi — e'tiborsiz qoldiriladi */});

    return cached;
  }

  // Keshda bo'lmasa tarmoqdan olinadi va keshga saqlanadi (masalan, yangi flagcdn rasmlari)
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('Offline: Resurs yuklanmadi.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// ---------------- 🔔 PUSH (send-reminders edge function'dan) ----------------
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'LevelUpDay', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'LevelUpDay', {
    body: d.body || '',
    tag: d.tag || 'lud',
    icon: './icons/icon-192.png',
    badge: './icons/favicon-32.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  // 🍅 Pomodoro bildirishnomasi tugmalari: ⏸ / ▶ / ⏭ — ochiq sahifaga yuboriladi, sahifa yo'q bo'lsa ilova ochiladi
  if (event.action && event.action.indexOf('pomo-') === 0) {
    event.notification.close();
    event.waitUntil((async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const w = wins.find((c) => c.url.startsWith(self.registration.scope));
      if (w) { w.postMessage({ type: 'pomo-action', action: event.action }); return; }
      if (event.action !== 'pomo-close') await self.clients.openWindow(new URL('./?action=pomodoro&pa=' + event.action, self.registration.scope).href);
    })());
    return;
  }
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); return; }
    }
    await self.clients.openWindow(target);
  })());
});

// ============================================================
// 🌙 BACKGROUND SYNC — ilova yopiq bo'lsa ham, internet/wifi qaytganda
// navbatdagi task o'zgarishlarini Supabase'ga yuboradi.
// ------------------------------------------------------------
// script.js tomonidan IndexedDB (lud_bgsync) ga yozilgan navbat (task
// upsert/delete) va sessiya tokenini shu yerda o'qib, to'g'ridan-to'g'ri
// Supabase REST API'ga yuboramiz (bu yerda to'liq ilova holati yo'q,
// shuning uchun faqat tasklar — oddiy va xavfsiz, murakkab birlashtirish
// talab qilmaydigan yagona navbat). Tanga/XP/sozlamalar (app_state,
// profiles) ESA bu yerda sinxronlanmaydi — ular bulut bilan uch tomonlama
// birlashtirishni talab qiladi va faqat ilova ochilganda, to'liq holat
// bilan sinxronlanadi (hozirgidek) — tangalar xavfsiz qoladi.
// Eslatma: Background Sync API hozircha asosan Android/Chrome'da ishlaydi;
// qo'llamaydigan brauzerda (iPhone/Safari) bu kod chaqirilmaydi — ilova
// ochilganda avvalgidek sinxronlanadi, hech narsa buzilmaydi.
// ============================================================
const BG_DB_NAME = 'lud_bgsync', BG_DB_VER = 1, BG_STORE = 'kv';
const BG_SB_URL = 'https://zzcvpenkevxlurgpjltz.supabase.co';
const BG_SB_ANON = 'sb_publishable_KbjJQoICYY8BoIqeBw_OKQ_xTTk_yu8';

function bgDb() {
  return new Promise((resolve) => {
    try {
      const rq = indexedDB.open(BG_DB_NAME, BG_DB_VER);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(BG_STORE); } catch (e) {} };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}
function bgGet(key) {
  return bgDb().then((db) => new Promise((resolve) => {
    if (!db) return resolve(null);
    try {
      const rq = db.transaction(BG_STORE, 'readonly').objectStore(BG_STORE).get(key);
      rq.onsuccess = () => resolve(rq.result == null ? null : rq.result);
      rq.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  }));
}
function bgSet(key, val) {
  return bgDb().then((db) => new Promise((resolve) => {
    if (!db) return resolve(false);
    try {
      const tx = db.transaction(BG_STORE, 'readwrite');
      tx.objectStore(BG_STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) { resolve(false); }
  }));
}

// access_token muddati tugagan bo'lsa, refresh_token bilan yangisini olamiz
async function bgRefreshToken(session) {
  try {
    const r = await fetch(`${BG_SB_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: BG_SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.access_token) return null;
    const next = { uid: session.uid, access_token: d.access_token, refresh_token: d.refresh_token || session.refresh_token };
    await bgSet('session', next);
    return next;
  } catch (e) { return null; }
}

async function bgAuthedFetch(url, opts, session) {
  const headers = Object.assign({ apikey: BG_SB_ANON, Authorization: `Bearer ${session.access_token}` }, opts.headers || {});
  let r = await fetch(url, Object.assign({}, opts, { headers }));
  if (r.status === 401) {
    const fresh = await bgRefreshToken(session);
    if (fresh) {
      headers.Authorization = `Bearer ${fresh.access_token}`;
      r = await fetch(url, Object.assign({}, opts, { headers }));
    }
  }
  return r;
}

async function bgSyncTodos() {
  const session = await bgGet('session');
  const queue = await bgGet('queue');
  if (!session || !session.access_token || !queue || queue.uid !== session.uid) return;
  const ups = queue.ups || {}, dels = queue.dels || {};
  const upIds = Object.keys(ups), delIds = Object.keys(dels).map(Number);
  if (!upIds.length && !delIds.length) return;

  let okUp = true, okDel = true;
  if (upIds.length) {
    const rows = upIds.map((k) => ({
      user_id: session.uid, task_id: Number(k), order_index: ups[k].orderIndex || 0,
      task_data: ups[k].task, updated_at: new Date().toISOString()
    }));
    const r = await bgAuthedFetch(`${BG_SB_URL}/rest/v1/todos?on_conflict=user_id,task_id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    }, session);
    okUp = r.ok;
    if (okUp) upIds.forEach((k) => delete ups[k]);
  }
  if (delIds.length) {
    const r = await bgAuthedFetch(`${BG_SB_URL}/rest/v1/todos?user_id=eq.${session.uid}&task_id=in.(${delIds.join(',')})`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    }, session);
    okDel = r.ok;
    if (okDel) delIds.forEach((id) => delete dels[id]);
  }
  await bgSet('queue', { uid: session.uid, ups, dels });

  try {
    const clientsList = await self.clients.matchAll();
    clientsList.forEach((c) => c.postMessage({ type: 'lud-bg-sync-done' }));
  } catch (e) {}

  // Muvaffaqiyatsiz qolgan qism bo'lsa, xatolik tashlaymiz — brauzer o'zi
  // keyinroq (backoff bilan) qayta urinib ko'radi (Background Sync API'ning o'z kafolati)
  if (!okUp || !okDel) throw new Error('lud-todos-sync: incomplete, will retry');
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'lud-todos-sync') event.waitUntil(bgSyncTodos());
});
