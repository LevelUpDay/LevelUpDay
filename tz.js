// 🕒 "Vaqt — davlat bo'yicha" funksiyasi olib tashlandi (xatolarga sabab bo'layotgan edi).
// Endi ilova har doim qurilma vaqtida ishlaydi. Eski sozlama qolgan bo'lsa — tozalanadi
// (extras.js ishga tushganda S.tzByCountry o'chiriladi va soat-himoyasi qayta tiklanadi).
(function () {
  var had = false;
  try { had = !!(localStorage.getItem('ludTz') || localStorage.getItem('ludSkew')); localStorage.removeItem('ludTz'); localStorage.removeItem('ludSkew'); } catch (e) {}
  var dev = null;
  try { dev = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
  window.LUD_TZ = { active: false, tz: null, device: dev, skew: 0, cleared: had };
})();
