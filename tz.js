// 🕒 Davlat vaqti — Sozlamalar → "Vaqt": yoqilsa ilova profil davlatining vaqt mintaqasida ishlaydi
// (masalan O'zbekiston tanlangan, odam Amerikada — kun, soat, eslatmalar Toshkent vaqti bilan).
// O'chiq bo'lsa (sukut) — qurilma vaqti. Boshqa skriptlardan OLDIN yuklanadi.
// Usul: haqiqiy vaqt (epoch, getTime/toISOString/Date.now) o'zgarmaydi — faqat "mahalliy" ko'rinish
// (getHours, getDate, setHours, new Date(y,m,d), toLocale*, Intl.DateTimeFormat) tanlangan mintaqaga o'tkaziladi.
(function () {
  'use strict';
  var MAP = {"AF":"Asia/Kabul","AL":"Europe/Tirane","DZ":"Africa/Algiers","AS":"Pacific/Pago_Pago","AD":"Europe/Andorra","AO":"Africa/Luanda","AI":"America/Anguilla","AQ":"Antarctica/McMurdo","AG":"America/Antigua","AR":"America/Argentina/Buenos_Aires","AM":"Asia/Yerevan","AW":"America/Aruba","AU":"Australia/Sydney","AT":"Europe/Vienna","AZ":"Asia/Baku","BS":"America/Nassau","BH":"Asia/Bahrain","BD":"Asia/Dhaka","BB":"America/Barbados","BY":"Europe/Minsk","BE":"Europe/Brussels","BZ":"America/Belize","BJ":"Africa/Porto-Novo","BM":"Atlantic/Bermuda","BT":"Asia/Thimphu","BO":"America/La_Paz","BQ":"America/Kralendijk","BA":"Europe/Sarajevo","BW":"Africa/Gaborone","BR":"America/Sao_Paulo","IO":"Indian/Chagos","BN":"Asia/Brunei","BG":"Europe/Sofia","BF":"Africa/Ouagadougou","BI":"Africa/Bujumbura","CV":"Atlantic/Cape_Verde","KH":"Asia/Phnom_Penh","CM":"Africa/Douala","CA":"America/Toronto","KY":"America/Cayman","CF":"Africa/Bangui","TD":"Africa/Ndjamena","CL":"America/Santiago","CN":"Asia/Shanghai","CX":"Indian/Christmas","CC":"Indian/Cocos","CO":"America/Bogota","KM":"Indian/Comoro","CG":"Africa/Brazzaville","CD":"Africa/Kinshasa","CK":"Pacific/Rarotonga","CR":"America/Costa_Rica","HR":"Europe/Zagreb","CU":"America/Havana","CW":"America/Curacao","CY":"Asia/Nicosia","CZ":"Europe/Prague","CI":"Africa/Abidjan","DK":"Europe/Copenhagen","DJ":"Africa/Djibouti","DM":"America/Dominica","DO":"America/Santo_Domingo","EC":"America/Guayaquil","EG":"Africa/Cairo","SV":"America/El_Salvador","GQ":"Africa/Malabo","ER":"Africa/Asmara","EE":"Europe/Tallinn","SZ":"Africa/Mbabane","ET":"Africa/Addis_Ababa","FK":"Atlantic/Stanley","FO":"Atlantic/Faroe","FJ":"Pacific/Fiji","FI":"Europe/Helsinki","FR":"Europe/Paris","GF":"America/Cayenne","PF":"Pacific/Tahiti","TF":"Indian/Kerguelen","GA":"Africa/Libreville","GM":"Africa/Banjul","GE":"Asia/Tbilisi","DE":"Europe/Berlin","GH":"Africa/Accra","GI":"Europe/Gibraltar","GR":"Europe/Athens","GL":"America/Nuuk","GD":"America/Grenada","GP":"America/Guadeloupe","GU":"Pacific/Guam","GT":"America/Guatemala","GG":"Europe/Guernsey","GN":"Africa/Conakry","GW":"Africa/Bissau","GY":"America/Guyana","HT":"America/Port-au-Prince","VA":"Europe/Vatican","HN":"America/Tegucigalpa","HK":"Asia/Hong_Kong","HU":"Europe/Budapest","IS":"Atlantic/Reykjavik","IN":"Asia/Kolkata","ID":"Asia/Jakarta","IR":"Asia/Tehran","IQ":"Asia/Baghdad","IE":"Europe/Dublin","IM":"Europe/Isle_of_Man","IL":"Asia/Jerusalem","IT":"Europe/Rome","JM":"America/Jamaica","JP":"Asia/Tokyo","JE":"Europe/Jersey","JO":"Asia/Amman","KZ":"Asia/Almaty","KE":"Africa/Nairobi","KI":"Pacific/Tarawa","KW":"Asia/Kuwait","KG":"Asia/Bishkek","LA":"Asia/Vientiane","LV":"Europe/Riga","LB":"Asia/Beirut","LS":"Africa/Maseru","LR":"Africa/Monrovia","LY":"Africa/Tripoli","LI":"Europe/Vaduz","LT":"Europe/Vilnius","LU":"Europe/Luxembourg","MO":"Asia/Macau","MG":"Indian/Antananarivo","MW":"Africa/Blantyre","MY":"Asia/Kuala_Lumpur","MV":"Indian/Maldives","ML":"Africa/Bamako","MT":"Europe/Malta","MH":"Pacific/Majuro","MQ":"America/Martinique","MR":"Africa/Nouakchott","MU":"Indian/Mauritius","YT":"Indian/Mayotte","MX":"America/Mexico_City","FM":"Pacific/Pohnpei","MD":"Europe/Chisinau","MC":"Europe/Monaco","MN":"Asia/Ulaanbaatar","ME":"Europe/Podgorica","MS":"America/Montserrat","MA":"Africa/Casablanca","MZ":"Africa/Maputo","MM":"Asia/Yangon","NA":"Africa/Windhoek","NR":"Pacific/Nauru","NP":"Asia/Kathmandu","NL":"Europe/Amsterdam","NC":"Pacific/Noumea","NZ":"Pacific/Auckland","NI":"America/Managua","NE":"Africa/Niamey","NG":"Africa/Lagos","NU":"Pacific/Niue","NF":"Pacific/Norfolk","KP":"Asia/Pyongyang","MK":"Europe/Skopje","MP":"Pacific/Saipan","NO":"Europe/Oslo","OM":"Asia/Muscat","PK":"Asia/Karachi","PW":"Pacific/Palau","PS":"Asia/Gaza","PA":"America/Panama","PG":"Pacific/Port_Moresby","PY":"America/Asuncion","PE":"America/Lima","PH":"Asia/Manila","PN":"Pacific/Pitcairn","PL":"Europe/Warsaw","PT":"Europe/Lisbon","PR":"America/Puerto_Rico","QA":"Asia/Qatar","RO":"Europe/Bucharest","RU":"Europe/Moscow","RW":"Africa/Kigali","RE":"Indian/Reunion","BL":"America/St_Barthelemy","SH":"Atlantic/St_Helena","KN":"America/St_Kitts","LC":"America/St_Lucia","MF":"America/Marigot","PM":"America/Miquelon","VC":"America/St_Vincent","WS":"Pacific/Apia","SM":"Europe/San_Marino","ST":"Africa/Sao_Tome","SA":"Asia/Riyadh","SN":"Africa/Dakar","RS":"Europe/Belgrade","SC":"Indian/Mahe","SL":"Africa/Freetown","SG":"Asia/Singapore","SX":"America/Lower_Princes","SK":"Europe/Bratislava","SI":"Europe/Ljubljana","SB":"Pacific/Guadalcanal","SO":"Africa/Mogadishu","ZA":"Africa/Johannesburg","GS":"Atlantic/South_Georgia","KR":"Asia/Seoul","SS":"Africa/Juba","ES":"Europe/Madrid","LK":"Asia/Colombo","SD":"Africa/Khartoum","SR":"America/Paramaribo","SJ":"Arctic/Longyearbyen","SE":"Europe/Stockholm","CH":"Europe/Zurich","SY":"Asia/Damascus","TW":"Asia/Taipei","TJ":"Asia/Dushanbe","TZ":"Africa/Dar_es_Salaam","TH":"Asia/Bangkok","TL":"Asia/Dili","TG":"Africa/Lome","TK":"Pacific/Fakaofo","TO":"Pacific/Tongatapu","TT":"America/Port_of_Spain","TN":"Africa/Tunis","TM":"Asia/Ashgabat","TC":"America/Grand_Turk","TV":"Pacific/Funafuti","TR":"Europe/Istanbul","UG":"Africa/Kampala","UA":"Europe/Kyiv","AE":"Asia/Dubai","GB":"Europe/London","US":"America/New_York","UM":"Pacific/Wake","UY":"America/Montevideo","UZ":"Asia/Tashkent","VU":"Pacific/Efate","VE":"America/Caracas","VN":"Asia/Ho_Chi_Minh","VG":"America/Tortola","VI":"America/St_Thomas","WF":"Pacific/Wallis","EH":"Africa/El_Aaiun","YE":"Asia/Aden","ZM":"Africa/Lusaka","ZW":"Africa/Harare","AX":"Europe/Mariehamn"};
  window.LUD_TZ_MAP = MAP;
  var tz = null;
  try { tz = localStorage.getItem('ludTz'); } catch (e) {}
  var dev = null;
  try { dev = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
  // Qurilma soati qo'lda surilgan bo'lsa (masalan Toshkent mintaqasida turib soat Amerika vaqtiga qo'yilgan) —
  // haqiqiy vaqt serverdan olinadi: farq (ms) localStorage.ludSkew da saqlanadi va Date.now()/new Date() ga qo'shiladi
  var skew = 0;
  try { skew = +localStorage.getItem('ludSkew') || 0; } catch (e) {}
  window.LUD_TZ = { active: false, tz: tz, device: dev, skew: skew };
  if (!tz) return;
  var D = Date, P = D.prototype, ODTF = Intl.DateTimeFormat;
  try { new ODTF('en-US', { timeZone: tz }); } catch (e) { return; }
  var fmt = new ODTF('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var getTime = P.getTime, setTime = P.setTime, cache = {}, onow = D.now;
  function now() { return onow() + skew; }
  // Mintaqa farqi (daqiqa, UTC'dan sharqqa) shu lahzada — 15 daqiqalik bo'laklarda keshlanadi
  function off(t) {
    var k = Math.floor(t / 900000);
    if (cache[k] != null) return cache[k];
    var p = {};
    fmt.formatToParts(new D(t)).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = D.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
    return (cache[k] = Math.round((asUTC - (t - ((t % 1000) + 1000) % 1000)) / 60000));
  }
  // "Devor soati" (mahalliy vaqt UTC sifatida) → haqiqiy vaqt
  function wallToUtc(w) { var t = w - off(w) * 60000; return w - off(t) * 60000; }
  function view(d) { var t = getTime.call(d); return isNaN(t) ? new D(NaN) : new D(t + off(t) * 60000); }
  ['FullYear', 'Month', 'Date', 'Day', 'Hours', 'Minutes', 'Seconds', 'Milliseconds'].forEach(function (n) {
    var g = P['getUTC' + n];
    P['get' + n] = function () { return g.call(view(this)); };
  });
  P.getYear = function () { return P.getFullYear.call(this) - 1900; };
  P.getTimezoneOffset = function () { var t = getTime.call(this); return isNaN(t) ? NaN : -off(t); };
  ['FullYear', 'Month', 'Date', 'Hours', 'Minutes', 'Seconds', 'Milliseconds'].forEach(function (n) {
    var su = P['setUTC' + n];
    P['set' + n] = function () {
      var v = view(this); su.apply(v, arguments);
      var w = getTime.call(v);
      return setTime.call(this, isNaN(w) ? NaN : wallToUtc(w));
    };
  });
  ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(function (n) {
    var o = P[n];
    P[n] = function (loc, opt) { opt = Object.assign({}, opt || {}); if (!opt.timeZone) opt.timeZone = tz; return o.call(this, loc, opt); };
  });
  var LOCAL_STR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/, oparse = D.parse;
  function parse(s) { return (typeof s === 'string' && LOCAL_STR.test(s.trim())) ? wallToUtc(oparse(s.trim() + 'Z')) : oparse(s); }
  function LDate(a, b, c, d, e, f, g) {
    if (!(this instanceof LDate)) return new D().toString();
    var n = arguments.length;
    if (n === 0) return new D(now());
    if (n === 1) return new D(typeof a === 'string' ? parse(a) : (a instanceof D ? getTime.call(a) : a));
    var y = +a, w = D.UTC(y, b, n > 2 ? c : 1, n > 3 ? d : 0, n > 4 ? e : 0, n > 5 ? f : 0, n > 6 ? g : 0);
    if (y >= 0 && y < 100) { var tmp = new D(w); tmp.setUTCFullYear(1900 + y); w = getTime.call(tmp); }
    return new D(wallToUtc(w));
  }
  LDate.prototype = P;
  LDate.now = now; LDate.UTC = D.UTC; LDate.parse = parse;
  try { Object.defineProperty(LDate, 'name', { value: 'Date' }); } catch (e) {}
  window.Date = LDate;
  function DTF(loc, opt) { opt = Object.assign({}, opt || {}); if (!opt.timeZone) opt.timeZone = tz; return new ODTF(loc, opt); }
  DTF.prototype = ODTF.prototype; DTF.supportedLocalesOf = ODTF.supportedLocalesOf;
  Intl.DateTimeFormat = DTF;
  window.LUD_TZ.active = true;

  // Haqiqiy vaqtni o'z serverimizdan (javob sarlavhasidagi Date) tekshiramiz; 90 soniyadan katta farq — tuzatiladi
  function measure() {
    var t0 = onow();
    fetch('manifest.json?clock=' + t0, { cache: 'no-store' }).then(function (r) {
      var h = r.headers.get('date'); if (!h) return;
      var t1 = onow(), server = oparse(h) + 500 + (t1 - t0) / 2; // sarlavha soniya aniqligida
      var s2 = server - t1; if (Math.abs(s2) < 90000) s2 = 0;
      if (Math.abs(s2 - skew) < 60000) return;
      try { if (s2) localStorage.setItem('ludSkew', String(Math.round(s2))); else localStorage.removeItem('ludSkew'); } catch (e) { return; }
      skew = s2; window.LUD_TZ.skew = s2;
      // Sahifa noto'g'ri soat bilan chizilgan — bir marta qayta yuklaymiz
      try { if (sessionStorage.getItem('ludSkewReload')) return; sessionStorage.setItem('ludSkewReload', '1'); } catch (e) {}
      location.reload();
    }).catch(function () {});
  }
  if (document.readyState === 'complete') setTimeout(measure, 500); else window.addEventListener('load', function () { setTimeout(measure, 500); });
})();
