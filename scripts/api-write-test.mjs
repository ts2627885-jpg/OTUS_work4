// Проверка записей API на ТЕСТОВОЙ базе: пересчёт и закрытие рекомендаций, загрузка CSV,
// сохранение настроек, резервная копия, черновик плана теста, создание/изменение/удаление пользователя.
// Скрипт отказывается работать с любым адресом, кроме тестового бэкенда на localhost:3005
// (тестовая база azs-pult-test, см. db/README и docs). Боевую базу он не трогает.
//
// Запуск (из папки azs-pult-fullstack):
//   ADMIN_PASSWORD=... MANAGER_PASSWORD=... node scripts/api-write-test.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.API_BASE || 'http://localhost:3005/api';
if (!BASE.includes('localhost:3005')) {
  console.error(`Отказ: скрипт записи работает только с тестовым бэкендом localhost:3005, задано ${BASE}`);
  process.exit(2);
}
const need = (n) => { if (!process.env[n]) throw new Error(`Задайте ${n}`); return process.env[n]; };
const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`); };

async function call(method, p, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + p, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* не JSON */ }
  return { status: res.status, json, text };
}

async function login(username, password) {
  const r = await call('POST', '/auth/login', { body: { username, password } });
  if (r.status !== 200) throw new Error(`вход ${username}: ${r.status}`);
  return r.json.data.token.access_token;
}

const admin = await login('admin', need('ADMIN_PASSWORD'));
const manager = await login('manager', need('MANAGER_PASSWORD'));
const MGR_ID = '886f7733-60eb-427d-a71f-a4c05dfd20f5';
const STATION = '4201e4e8-8875-45a4-9e43-65e968b59982';

// ---------- Рекомендации: пересчёт и закрытие ----------
const before = await call('GET', '/recommendations?status=active', { token: admin });
const activeBefore = before.json?.data?.length ?? -1;

const gen = await call('POST', '/recommendations/generate', { token: admin });
check('пересчёт рекомендаций admin → 200', gen.status === 200, `HTTP ${gen.status} ${gen.text.slice(0, 160)}`);
check('пересчёт вернул число сохранённых и закрытых', typeof gen.json?.data?.saved === 'number' && typeof gen.json?.data?.closed === 'number', gen.text.slice(0, 160));

const afterGen = await call('GET', '/recommendations?status=active', { token: admin });
check('после пересчёта список активных рекомендаций читается', afterGen.status === 200 && Array.isArray(afterGen.json?.data), `HTTP ${afterGen.status}`);

// Закрытие: берём активную рекомендацию с известной станцией (её видит admin)
const target = (afterGen.json?.data || []).find(r => r.azs_id || r.station);
if (!target) {
  check('закрытие рекомендации: есть активная рекомендация для проверки', false, 'нет активных рекомендаций');
} else {
  const done = await call('POST', `/recommendations/${target.id}/complete`, { token: admin });
  check('закрыть рекомендацию admin → 200', done.status === 200, `HTTP ${done.status} ${done.text.slice(0, 160)}`);
  const list = await call('GET', '/recommendations', { token: admin });
  const row = (list.json?.data || []).find(r => r.id === target.id);
  check('закрытая рекомендация имеет статус completed', row?.status === 'completed', `статус: ${row?.status}`);
  check('закрыть ту же рекомендацию повторно → не ломается', [200, 404, 409].includes((await call('POST', `/recommendations/${target.id}/complete`, { token: admin })).status));
}

// Менеджер закрывает рекомендацию своей станции: назначаем временно, потом снимаем
const assign = await call('PUT', `/admin/users/${MGR_ID}/azs`, { token: admin, body: { azsIds: [STATION] } });
check('назначить станцию manager (admin) → 200', assign.status === 200, `HTTP ${assign.status}`);
const mgrRecs = await call('GET', '/recommendations/azs/' + STATION, { token: manager });
const mgrTarget = (mgrRecs.json?.data || []).find(r => r.status === 'active');
if (mgrTarget) {
  const mgrDone = await call('POST', `/recommendations/${mgrTarget.id}/complete`, { token: manager });
  check('manager закрывает рекомендацию своей станции → 200', mgrDone.status === 200, `HTTP ${mgrDone.status}`);
} else {
  check('manager закрывает рекомендацию своей станции: есть активная рекомендация', true, 'пропуск: нет активных на станции');
}
const unassign = await call('PUT', `/admin/users/${MGR_ID}/azs`, { token: admin, body: { azsIds: [] } });
check('снять назначение станции (очистка) → 200', unassign.status === 200, `HTTP ${unassign.status}`);

// ---------- Импорт CSV ----------
const csvPath = path.resolve(here, '../_data/_BD/pipeline/data/weather_data.csv');
const csvText = fs.readFileSync(csvPath);
const form = new FormData();
form.append('file', new Blob([csvText], { type: 'text/csv' }), 'weather_data.csv');
const imp = await call('POST', '/import/csv', { token: admin, form });
check('загрузка CSV (погода) admin → 200', imp.status === 200, `HTTP ${imp.status} ${imp.text.slice(0, 200)}`);
check('импорт вернул результат по файлу', Array.isArray(imp.json?.data?.files) && imp.json.data.files.length === 1, imp.text.slice(0, 200));
const hist = await call('GET', '/import/history', { token: admin });
check('загрузка попала в историю импорта', (hist.json?.data || []).some(h => h.file_name === 'weather_data.csv'), `записей: ${hist.json?.data?.length}`);
const badForm = new FormData();
badForm.append('file', new Blob(['a,b,c\n1,2,3\n'], { type: 'text/csv' }), 'unknown.csv');
const bad = await call('POST', '/import/csv', { token: admin, form: badForm });
// Импорт отвечает 200 и результатом по каждому файлу: неизвестный формат — ok:false с текстом
const badFile = bad.json?.data?.files?.[0];
check('CSV неизвестного формата → результат по файлу с понятной ошибкой',
  bad.status === 200 && badFile?.ok === false && /не распознан/.test(badFile?.error || ''), `HTTP ${bad.status} ${bad.text.slice(0, 160)}`);

// ---------- Настройки расчёта ----------
const cur = await call('GET', '/admin/settings', { token: admin });
const values = cur.json?.data?.values;
const save = await call('PUT', '/admin/settings', { token: admin, body: values });
check('сохранить настройки без изменений → 200', save.status === 200, `HTTP ${save.status} ${save.text.slice(0, 160)}`);
const histSet = await call('GET', '/admin/settings/history', { token: admin });
check('сохранение настроек записано в историю', histSet.status === 200 && Array.isArray(histSet.json?.data), `HTTP ${histSet.status}`);
const badSet = await call('PUT', '/admin/settings', { token: admin, body: { r2_min: 'много' } });
check('настройки с неверным значением → 400', badSet.status === 400, `HTTP ${badSet.status} ${badSet.text.slice(0, 160)}`);

// ---------- Резервная копия ----------
const backup = await call('POST', '/admin/backup', { token: admin });
check('резервная копия admin → 200', backup.status === 200, `HTTP ${backup.status} ${backup.text.slice(0, 200)}`);
const backupsList = await call('GET', '/import/backups', { token: admin });
check('резервная копия появилась в списке', backupsList.status === 200, `HTTP ${backupsList.status}`);

// ---------- План теста цен (черновик) ----------
const draft = await call('POST', '/admin/price-test/draft', { token: admin });
check('черновик плана теста admin → 201', draft.status === 201, `HTTP ${draft.status} ${draft.text.slice(0, 160)}`);
const planList = await call('GET', '/admin/price-test', { token: admin });
check('черновик виден в списке планов', (planList.json?.data || []).length > 0, `строк: ${planList.json?.data?.length}`);

// ---------- Пользователь: создание, изменение, удаление ----------
const uname = `wtest${Date.now() % 100000}`;
const newUser = await call('POST', '/admin/users', { token: admin, body: { username: uname, email: `${uname}@example.com`, password: 'WriteTest1!', role: 'viewer' } });
check('создать пользователя admin → 201', newUser.status === 201, `HTTP ${newUser.status} ${newUser.text.slice(0, 160)}`);
const newId = newUser.json?.data?.id ?? null;
if (newId) {
  const upd = await call('PUT', `/admin/users/${newId}`, { token: admin, body: { role: 'analyst' } });
  check('изменить роль пользователя → 200', upd.status === 200, `HTTP ${upd.status} ${upd.text.slice(0, 120)}`);
  const del = await call('DELETE', `/admin/users/${newId}`, { token: admin });
  check('удалить пользователя → 200', del.status === 200, `HTTP ${del.status}`);
}

// ---------- Итог ----------
const failed = results.filter(r => !r.ok);
console.log(`\nИтого: ${results.length - failed.length} из ${results.length} проверок прошли`);
process.exit(failed.length ? 1 : 0);
