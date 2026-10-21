const q = new URLSearchParams(location.search);
chrome.storage.local.get('cfg', (o) => { const l = o && o.cfg && o.cfg.lang; render(['uz', 'en', 'ru'].includes(l) ? l : (navigator.language || 'en').slice(0, 2)); });
function render(lang) {
const T = {
  uz: { t: 'Bu sayt hozir bloklangan', always: 'Bu sayt doimiy bloklangan.', daily: (m) => `Bugungi limit tugadi${m ? ' (' + m + ' daqiqa)' : ''}. Ertaga yana ochiladi.`, schedule: 'Jadval bo\'yicha hozir bloklangan.', focus: 'Fokus sessiyasi davom etmoqda — tugagach ochiladi.', close: 'Tabni yopish',
    mode: (n) => `«${n}» rejimi yoqilgan — bu sayt shu rejimda bloklangan.`, allow: 'Hozir faqat ruxsat etilgan saytlar ochiladi.', break: 'Majburiy tanaffus — biroz dam oling.', weekly: 'Haftalik limit tugadi.', opens: 'Bugun bu saytni ochish soni tugadi.', total: 'Bugungi umumiy ekran vaqti limiti tugadi.', keyword: 'Bu sahifada taqiqlangan so\'z bor.', adult: 'Kattalar uchun kontent bloklangan.', tasks: 'Buning o\'rniga:',
    mt: 'Nafas oling…', mwhy: (s) => `Bu saytni ochishdan oldin ${s} soniya o'ylab ko'ring: rostdan ham kerakmi?`, mq: 'Rostdan ham kerakmi?', yes: (m) => `Ha, kerak (${m} daq)`, no: 'Yo\'q, yopish',
    quotes: ['Kichik qadamlar katta natija beradi.', 'Diqqatingiz — eng qimmatli boyligingiz.', 'Hozir fokus qilsangiz, keyin xotirjam dam olasiz.', 'Bugungi tanlov ertangi sizni yaratadi.'] },
  en: { t: 'This site is blocked right now', always: 'This site is always blocked.', daily: (m) => `Today's limit is used up${m ? ' (' + m + ' min)' : ''}. It opens again tomorrow.`, schedule: 'Blocked by your schedule right now.', focus: 'A focus session is running — it opens when it ends.', close: 'Close tab',
    mode: (n) => `The “${n}” mode is on — this site is blocked in it.`, allow: 'Only allowed sites open right now.', break: 'Mandatory break — rest a little.', weekly: 'Weekly limit reached.', opens: 'You have used up today\'s opens for this site.', total: 'Today\'s total screen-time limit is reached.', keyword: 'This page contains a blocked keyword.', adult: 'Adult content is blocked.', tasks: 'Instead, do this:',
    mt: 'Take a breath…', mwhy: (s) => `Take ${s} seconds before opening this site: do you really need it?`, mq: 'Do you really need it?', yes: (m) => `Yes, I need it (${m} min)`, no: 'No, close it',
    quotes: ['Small steps lead to big results.', 'Your attention is your most valuable asset.', 'Focus now, relax guilt-free later.', 'Today\'s choices build tomorrow\'s you.'] },
  ru: { t: 'Этот сайт сейчас заблокирован', always: 'Этот сайт заблокирован всегда.', daily: (m) => `Дневной лимит исчерпан${m ? ' (' + m + ' мин)' : ''}. Завтра снова откроется.`, schedule: 'Сейчас заблокировано по расписанию.', focus: 'Идёт сессия фокуса — откроется после неё.', close: 'Закрыть вкладку',
    mode: (n) => `Включён режим «${n}» — в нём этот сайт заблокирован.`, allow: 'Сейчас открываются только разрешённые сайты.', break: 'Обязательный перерыв — отдохните.', weekly: 'Недельный лимит исчерпан.', opens: 'Открытия этого сайта на сегодня закончились.', total: 'Общий лимит экранного времени исчерпан.', keyword: 'На странице запрещённое слово.', adult: 'Контент для взрослых заблокирован.', tasks: 'Вместо этого:',
    mt: 'Сделайте вдох…', mwhy: (s) => `Подумайте ${s} секунд, прежде чем открыть сайт: это правда нужно?`, mq: 'Это правда нужно?', yes: (m) => `Да, нужно (${m} мин)`, no: 'Нет, закрыть',
    quotes: ['Маленькие шаги ведут к большим результатам.', 'Внимание — ваш самый ценный ресурс.', 'Сфокусируйтесь сейчас — отдохнёте без чувства вины.', 'Сегодняшний выбор создаёт завтрашнего вас.'] },
}[lang] || null;
const t = T || {
  t: 'Bu sayt hozir bloklangan', always: 'Bu sayt doimiy bloklangan.', daily: (m) => `Bugungi limit tugadi${m ? ' (' + m + ' daqiqa)' : ''}.`, schedule: 'Jadval bo\'yicha bloklangan.', focus: 'Fokus sessiyasi davom etmoqda.', close: 'Tabni yopish',
  mode: (n) => `«${n}» rejimida bloklangan.`, allow: 'Fokusda faqat ruxsat etilgan saytlar.', mt: 'Nafas oling…', mwhy: (s) => `${s} soniya o'ylab ko'ring.`, mq: 'Rostdan ham kerakmi?', yes: (m) => `Ha (${m} daq)`, no: 'Yo\'q', quotes: ['Diqqatingiz — eng qimmatli boyligingiz.'] };
const $ = (id) => document.getElementById(id);
$('site').textContent = q.get('l') || q.get('k') || '';
$('q').textContent = '“' + t.quotes[Math.floor(Math.random() * t.quotes.length)] + '”';
// 🌬 Ongli ochish: N soniya nafas, keyin "Ha, kerak" / "Yo'q"
if (q.get('mode') === 'mindful') {
  const secs = Math.min(60, Math.max(3, +q.get('s') || 10)), mins = Math.min(240, Math.max(1, +q.get('m') || 15)), url = q.get('u') || '';
  document.title = 'Focusgate — ' + t.mt;
  $('t').textContent = t.mt;
  $('why').textContent = t.mwhy(secs);
  $('go').hidden = true;
  const yes = $('yes'), no = $('close'), br = $('breath');
  yes.hidden = false; yes.disabled = true; no.textContent = t.no; br.hidden = false;
  let left = secs;
  const tick = () => {
    br.textContent = left > 0 ? String(left) : '✓';
    yes.textContent = left > 0 ? t.yes(mins) + ' · ' + left : t.yes(mins);
    if (left <= 0) { clearInterval(iv); yes.disabled = false; $('why').textContent = t.mq; }
    left--;
  };
  const iv = setInterval(tick, 1000); tick();
  yes.onclick = () => chrome.runtime.sendMessage({ type: 'fg:grant', key: q.get('k'), min: mins }, () => { if (/^https?:/.test(url)) location.replace(url); });
  no.onclick = () => chrome.runtime.sendMessage({ type: 'fg:mindfulNo', key: q.get('k'), label: q.get('l') });
  return;
}
$('t').textContent = t.t;
const r = q.get('r');
$('why').textContent = r === 'daily' ? t.daily(q.get('m')) : r === 'mode' ? t.mode(q.get('n') || '') : (t[r] || t.always);
$('close').textContent = t.close;
// 📝 LevelUpDay vazifalari: "buning o'rniga" (sayt cfg.tasks ga bugungi ochiq vazifalarni yozadi)
chrome.storage.local.get('cfg', (o) => {
  const tasks = ((o && o.cfg && o.cfg.tasks) || []).slice(0, 3), box = $('tasks');
  if (!tasks.length || !box || !t.tasks) return;
  box.hidden = false;
  box.innerHTML = '<b></b>' + tasks.map(() => '<a class="task" target="_blank" rel="noopener"></a>').join('');
  box.querySelector('b').textContent = t.tasks;
  box.querySelectorAll('a').forEach((a, i) => { a.textContent = '📌 ' + String(tasks[i].t || '').slice(0, 80); a.href = 'https://levelupday.github.io/LevelUpDay/#tasks'; });
});
$('close').onclick = () => chrome.runtime.sendMessage({ type: 'fg:closeTab' });
}
