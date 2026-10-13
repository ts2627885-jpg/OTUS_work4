// Тесты всех эндпоинтов АЗС-Пульт: корректность ответов по ролям и обработка ошибок (см. docs/API.md).
// Записи, которые пересчитывают данные (рекомендации, импорт, настройки, резервные копии), проверяются
// только на отказ в доступе для неподходящих ролей — сами операции не выполняются.
// Тестовая станция создаётся и удаляется в конце.
//
// Запуск (из папки azs-pult-fullstack); пароли тестовых учёток задаются переменными окружения:
//   ADMIN_PASSWORD=... MANAGER_PASSWORD=... ANALYST_PASSWORD=... VIEWER_PASSWORD=... node scripts/api-test.mjs
//   API_BASE — по умолчанию http://localhost:3001/api

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
const pw = (name) => {
  if (!process.env[`${name}_PASSWORD`]) throw new Error(`Задайте ${name}_PASSWORD`);
  return process.env[`${name}_PASSWORD`];
};
const USERS = {
  admin: ['admin', pw('ADMIN')],
  manager: ['manager', pw('MANAGER')],
  analyst: ['analyst', pw('ANALYST')],
  viewer: ['viewer', pw('VIEWER')],
};
const STATION = '4201e4e8-8875-45a4-9e43-65e968b59982';   // АЗС 125, есть данные
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const ROLES = ['admin', 'manager', 'analyst', 'viewer'];

const results = [];
const tokens = {};

async function call(method, path, { token, body, raw, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (raw !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = raw;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* не JSON */ }
  return { status: res.status, json, text };
}

/** Проверка: ожидаемый статус и (опционально) условие на тело ответа */
function expect(name, res, status, check) {
  let ok = res.status === status;
  let detail = `HTTP ${res.status}`;
  if (ok && check) {
    const r = check(res);
    if (r !== true) { ok = false; detail += ` — ${r}`; }
  }
  if (!ok && status !== res.status) detail += ` (ожидали ${status})`;
  results.push({ name, ok, detail: ok ? '' : detail });
}

async function login(role) {
  const [username, password] = USERS[role];
  const r = await call('POST', '/auth/login', { body: { username, password } });
  if (r.status !== 200) throw new Error(`вход ${role}: ${r.status} ${r.text}`);
  return r.json.data.token.access_token;
}

// ---------- Вход и регистрация ----------
for (const role of ROLES) tokens[role] = await login(role);
const adminToken = tokens.admin;

expect('вход admin → 200', await call('POST', '/auth/login', { body: { username: 'admin', password: USERS.admin[1] } }), 200,
  (r) => (r.json?.data?.token?.access_token ? true : 'нет токена'));
expect('вход с неверным паролем → 401', await call('POST', '/auth/login', { body: { username: 'admin', password: 'Wrong123!' } }), 401,
  (r) => (r.json?.success === false ? true : 'нет success=false'));
expect('вход без пароля → 400', await call('POST', '/auth/login', { body: { username: 'admin' } }), 400);
expect('регистрация с неверным email → 400', await call('POST', '/auth/register', { body: { username: 'zzcheck1', email: 'не-email', password: 'Passw0rd!x' } }), 400);
expect('регистрация занятого логина → 409 с понятным текстом',
  await call('POST', '/auth/register', { body: { username: 'admin', email: 'dup-check@example.com', password: 'Passw0rd!x' } }), 409,
  (r) => (r.json?.error === 'Логин уже занят' ? true : `текст: ${r.json?.error}`));

// ---------- Профиль и авторизация ----------
expect('профиль без токена → 401', await call('GET', '/auth/profile'), 401);
expect('профиль с неверным токеном → 401', await call('GET', '/auth/profile', { token: 'abc.def.ghi' }), 401);
expect('профиль с заголовком не Bearer → 401', await call('GET', '/auth/profile', { headers: { Authorization: 'Basic x' } }), 401);
expect('профиль viewer → 200 с ролью viewer', await call('GET', '/auth/profile', { token: tokens.viewer }), 200,
  (r) => (r.json?.data?.role === 'viewer' ? true : `роль: ${r.json?.data?.role}`));

// ---------- Служебные ----------
expect('health без токена → 200', await call('GET', '/health'), 200);
expect('неизвестный маршрут → 404 в JSON', await call('GET', '/api/no-such-route', { token: adminToken }), 404,
  (r) => (r.json?.success === false ? true : 'не JSON-ответ'));

// ---------- Станции (чтение) ----------
for (const role of ROLES) {
  expect(`список станций ${role} → 200`, await call('GET', '/azs', { token: tokens[role] }), 200,
    (r) => (Array.isArray(r.json?.data) ? true : 'data не массив'));
}
expect('станция admin → 200', await call('GET', `/azs/${STATION}`, { token: adminToken }), 200,
  (r) => (r.json?.data?.id === STATION ? true : 'id не совпал'));
expect('станция с несуществующим id → 404', await call('GET', `/azs/${MISSING_ID}`, { token: adminToken }), 404);
expect('станция с некорректным id → 404', await call('GET', '/azs/not-a-uuid', { token: adminToken }), 404);
expect('manager без назначения → 404 на станцию', await call('GET', `/azs/${STATION}`, { token: tokens.manager }), 404);

for (const sub of ['sales?days=30', 'traffic?days=14', 'weather?days=14', 'competitors']) {
  expect(`станция/${sub.split('?')[0]} admin → 200`, await call('GET', `/azs/${STATION}/${sub}`, { token: adminToken }), 200,
    (r) => (Array.isArray(r.json?.data) ? true : 'data не массив'));
  expect(`станция/${sub.split('?')[0]} manager без назначения → 404`, await call('GET', `/azs/${STATION}/${sub}`, { token: tokens.manager }), 404);
}

// ---------- Цены, дашборд, рекомендации, аналитика (чтение, все роли) ----------
for (const role of ROLES) {
  expect(`цены ${role} → 200`, await call('GET', '/prices', { token: tokens[role] }), 200);
  expect(`дашборд ${role} → 200`, await call('GET', '/dashboard?days=28', { token: tokens[role] }), 200,
    (r) => (r.json?.data?.stations ? true : 'нет stations'));
  expect(`рекомендации ${role} → 200`, await call('GET', '/recommendations', { token: tokens[role] }), 200,
    (r) => (Array.isArray(r.json?.data) ? true : 'data не массив'));
  expect(`правила расчёта ${role} → 200`, await call('GET', '/analysis/rules', { token: tokens[role] }), 200);
  expect(`общая статистика ${role} → 200`, await call('GET', '/admin/stats/overall', { token: tokens[role] }), 200);
}
expect('рекомендации станции admin → 200', await call('GET', `/recommendations/azs/${STATION}`, { token: adminToken }), 200);
for (const tab of ['prices', 'competitors', 'traffic', 'factors', 'volume', 'shop', 'promotions']) {
  expect(`аналитика ${tab} admin → 200`, await call('GET', `/analytics/${tab}`, { token: adminToken }), 200,
    (r) => (r.json?.data?.sections ? true : 'нет sections'));
}
expect('аналитика неизвестной вкладки → 404', await call('GET', '/analytics/no-such-tab', { token: adminToken }), 404);

// ---------- Импорт и проверки станций: только роли по политике ----------
expect('история импорта viewer → 200', await call('GET', '/import/history', { token: tokens.viewer }), 200);
expect('сводка импорта viewer → 200', await call('GET', '/import/summary', { token: tokens.viewer }), 200);
expect('резервные копии admin → 200', await call('GET', '/import/backups', { token: adminToken }), 200);
expect('резервные копии viewer → 403', await call('GET', '/import/backups', { token: tokens.viewer }), 403);
expect('сверка станций admin → 200', await call('GET', '/stations/check', { token: adminToken }), 200);
expect('сверка станций viewer → 403', await call('GET', '/stations/check', { token: tokens.viewer }), 403);
expect('загрузка CSV без файла (admin) → 400', await call('POST', '/import/csv', { token: adminToken }), 400);
expect('загрузка CSV viewer → 403', await call('POST', '/import/csv', { token: tokens.viewer }), 403);

// ---------- Администрирование: только admin ----------
const adminOnly = [
  ['GET', '/admin/users'], ['GET', `/admin/users/${MISSING_ID}/azs`], ['GET', '/admin/settings'],
  ['GET', '/admin/settings/history'], ['GET', '/admin/settings/export'], ['GET', '/admin/price-test'],
  ['GET', '/admin/logs/audit?limit=5'], ['GET', '/admin/logs/login?limit=5'],
];
for (const [method, path] of adminOnly) {
  expect(`${method} ${path.split('?')[0]} admin → 200`, await call(method, path, { token: adminToken }), 200);
  for (const role of ['manager', 'analyst', 'viewer']) {
    expect(`${method} ${path.split('?')[0]} ${role} → 403`, await call(method, path, { token: tokens[role] }), 403);
  }
}
expect('настройки: viewer записать → 403', await call('PUT', '/admin/settings', { token: tokens.viewer, body: {} }), 403);
expect('пересчёт рекомендаций: viewer → 403', await call('POST', '/recommendations/generate', { token: tokens.viewer }), 403);
expect('черновик плана теста: analyst → 403', await call('POST', '/admin/price-test/draft', { token: tokens.analyst }), 403);
expect('резервная копия: viewer → 403', await call('POST', '/admin/backup', { token: tokens.viewer }), 403);

// ---------- Рекомендации: закрытие ----------
expect('закрыть несуществующую рекомендацию (admin) → 404', await call('POST', `/recommendations/${MISSING_ID}/complete`, { token: adminToken }), 404);
expect('закрыть рекомендацию (viewer) → 403', await call('POST', `/recommendations/${MISSING_ID}/complete`, { token: tokens.viewer }), 403);

// ---------- Станции: создание, изменение, удаление (с очисткой) ----------
const created = await call('POST', '/azs', { token: adminToken, body: { name: `ТЕСТ API ${Date.now()}`, fuelTypes: ['A92'] } });
expect('создать станцию admin → 201', created, 201);
const newId = created.json?.data?.id ?? null;
try {
  expect('создать станцию viewer → 403', await call('POST', '/azs', { token: tokens.viewer, body: { name: 'ТЕСТ viewer' } }), 403);
  expect('создать станцию с коротким названием → 400', await call('POST', '/azs', { token: adminToken, body: { name: 'x' } }), 400);
  if (newId) {
    expect('изменить станцию admin → 200', await call('PUT', `/azs/${newId}`, { token: adminToken, body: { status: 'inactive' } }), 200,
      (r) => (r.json?.data?.status === 'inactive' ? true : 'статус не обновился'));
    expect('изменить станцию с несуществующим id → 404', await call('PUT', `/azs/${MISSING_ID}`, { token: adminToken, body: { status: 'active' } }), 404);
  }
} finally {
  if (newId) {
    const del = await call('DELETE', `/azs/${newId}`, { token: adminToken });
    results.push({ name: 'удалить тестовую станцию admin → 200 (очистка)', ok: del.status === 200, detail: del.status === 200 ? '' : `HTTP ${del.status}` });
  }
}
expect('удалить станцию manager → 403', await call('DELETE', `/azs/${STATION}`, { token: tokens.manager }), 403);

// ---------- Ошибки формата запроса ----------
expect('некорректный JSON в теле → 400', await call('POST', '/auth/login', { raw: '{"username": ' }), 400,
  (r) => (r.json?.success === false ? true : 'не JSON-ответ'));

// ---------- Итог ----------
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(`\nИтого: ${results.length - failed.length} из ${results.length} проверок прошли`);
process.exit(failed.length ? 1 : 0);
