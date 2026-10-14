const q = new URLSearchParams(location.search);
chrome.storage.local.get('cfg', (o) => { const l = o && o.cfg && o.cfg.lang; render(['uz', 'en', 'ru'].includes(l) ? l : (navigator.language || 'en').slice(0, 2)); });
function render(lang) {
const T = {
  uz: { t: 'Bu sayt hozir bloklangan', always: 'Bu sayt doimiy bloklangan.', daily: (m) => `Bugungi limit tugadi${m ? ' (' + m + ' daqiqa)' : ''}. Ertaga yana ochiladi.`, schedule: 'Jadval bo\'yicha hozir bloklangan.', focus: 'Fokus sessiyasi davom etmoqda — tugagach ochiladi.', close: 'Tabni yopish',
    quotes: ['Kichik qadamlar katta natija beradi.', 'Diqqatingiz — eng qimmatli boyligingiz.', 'Hozir fokus qilsangiz, keyin xotirjam dam olasiz.', 'Bugungi tanlov ertangi sizni yaratadi.'] },
  en: { t: 'This site is blocked right now', always: 'This site is always blocked.', daily: (m) => `Today's limit is used up${m ? ' (' + m + ' min)' : ''}. It opens again tomorrow.`, schedule: 'Blocked by your schedule right now.', focus: 'A focus session is running — it opens when it ends.', close: 'Close tab',
    quotes: ['Small steps lead to big results.', 'Your attention is your most valuable asset.', 'Focus now, relax guilt-free later.', 'Today\'s choices build tomorrow\'s you.'] },
  ru: { t: 'Этот сайт сейчас заблокирован', always: 'Этот сайт заблокирован всегда.', daily: (m) => `Дневной лимит исчерпан${m ? ' (' + m + ' мин)' : ''}. Завтра снова откроется.`, schedule: 'Сейчас заблокировано по расписанию.', focus: 'Идёт сессия фокуса — откроется после неё.', close: 'Закрыть вкладку',
    quotes: ['Маленькие шаги ведут к большим результатам.', 'Внимание — ваш самый ценный ресурс.', 'Сфокусируйтесь сейчас — отдохнёте без чувства вины.', 'Сегодняшний выбор создаёт завтрашнего вас.'] },
}[lang] || null;
const t = T || {
  t: 'Bu sayt hozir bloklangan', always: 'Bu sayt doimiy bloklangan.', daily: (m) => `Bugungi limit tugadi${m ? ' (' + m + ' daqiqa)' : ''}.`, schedule: 'Jadval bo\'yicha bloklangan.', focus: 'Fokus sessiyasi davom etmoqda.', close: 'Tabni yopish', quotes: ['Diqqatingiz — eng qimmatli boyligingiz.'] };
document.getElementById('t').textContent = t.t;
document.getElementById('site').textContent = q.get('l') || q.get('k') || '';
const r = q.get('r');
document.getElementById('why').textContent = r === 'daily' ? t.daily(q.get('m')) : (t[r] || t.always);
document.getElementById('q').textContent = '“' + t.quotes[Math.floor(Math.random() * t.quotes.length)] + '”';
document.getElementById('close').textContent = t.close;
document.getElementById('close').onclick = () => chrome.runtime.sendMessage({ type: 'fg:closeTab' });
}
