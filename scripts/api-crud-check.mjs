// Проверка CRUD станций и ролей через API АЗС-Пульт (см. docs/API.md).
// Создаёт тестовую станцию, читает, меняет, удаляет. Пишет в базу — запускать по согласованию.
//
// Запуск (из папки azs-pult-fullstack):
//   node scripts/api-crud-check.mjs
// Переменные:
//   API_BASE                          по умолчанию http://localhost:3001/api
//   ADMIN_PASSWORD, MANAGER_PASSWORD, VIEWER_PASSWORD — пароли тестовых учётных записей (обязательны)

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
// Пароли не хранятся в репозитории: задаются переменными окружения
function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Задайте переменную ${name} (пароль тестовой учётной записи)`);
  return process.env[name];
}
const creds = {
  admin: ['admin', requireEnv('ADMIN_PASSWORD')],
  manager: ['manager', requireEnv('MANAGER_PASSWORD')],
  viewer: ['viewer', requireEnv('VIEWER_PASSWORD')],
};

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* ответ без тела */ }
  return { status: res.status, json };
}

async function login([username, password]) {
  const r = await call('POST', '/auth/login', null, { username, password });
  if (r.status !== 200) throw new Error(`login ${username} -> ${r.status}`);
  return r.json.data.token.access_token;
}

const tokens = {};
for (const [role, c] of Object.entries(creds)) tokens[role] = await login(c);

const stamp = Date.now();
const name = `ТЕСТ CRUD ${stamp}`;
let id = null;

try {
  // CREATE
  const created = await call('POST', '/azs', tokens.admin, { name, address: 'тест', region: 'тест', fuelTypes: ['A92'], status: 'active' });
  check('CREATE admin POST /azs → 201', created.status === 201, `status ${created.status}`);
  id = created.json?.data?.id ?? null;
  check('CREATE возвращает id и название', !!id && created.json.data.name === name);

  // READ
  const one = await call('GET', `/azs/${id}`, tokens.admin);
  check('READ admin GET /azs/:id → 200', one.status === 200 && one.json?.data?.name === name);
  const list = await call('GET', '/azs', tokens.admin);
  check('READ список содержит созданную станцию', list.status === 200 && list.json.data.some(s => s.id === id));

  // UPDATE
  const upd = await call('PUT', `/azs/${id}`, tokens.admin, { status: 'inactive', address: 'тест 2' });
  check('UPDATE admin PUT /azs/:id → 200', upd.status === 200, `status ${upd.status}`);
  const after = await call('GET', `/azs/${id}`, tokens.admin);
  check('UPDATE изменения сохранены, название не потеряно',
    after.json?.data?.status === 'inactive' && after.json?.data?.address === 'тест 2' && after.json?.data?.name === name);

  // ПРАВА: нельзя создавать без admin
  const viewerCreate = await call('POST', '/azs', tokens.viewer, { name: 'ТЕСТ viewer' });
  check('ROLE viewer POST /azs → 403', viewerCreate.status === 403, `status ${viewerCreate.status}`);
  const managerCreate = await call('POST', '/azs', tokens.manager, { name: 'ТЕСТ manager' });
  check('ROLE manager POST /azs → 403', managerCreate.status === 403, `status ${managerCreate.status}`);

  // ПРАВА: manager без назначения не видит и не меняет станцию
  const managerGet = await call('GET', `/azs/${id}`, tokens.manager);
  check('ROLE manager GET чужой станции → 404', managerGet.status === 404, `status ${managerGet.status}`);
  const managerPut = await call('PUT', `/azs/${id}`, tokens.manager, { status: 'active' });
  check('ROLE manager PUT чужой станции → 403/404', [403, 404].includes(managerPut.status), `status ${managerPut.status}`);

  // VALIDATION
  const bad = await call('POST', '/azs', tokens.admin, { name: 'x' });
  check('VALIDATION короткое название → 400', bad.status === 400, `status ${bad.status}`);

  // DELETE
  const del = await call('DELETE', `/azs/${id}`, tokens.admin);
  check('DELETE admin DELETE /azs/:id → 200', del.status === 200, `status ${del.status}`);
  const gone = await call('GET', `/azs/${id}`, tokens.admin);
  check('DELETE после удаления GET → 404', gone.status === 404, `status ${gone.status}`);
  id = null;
} finally {
  // Если тест упал до удаления, станцию всё равно удаляем, чтобы не оставить мусор в базе
  if (id) {
    const cleanup = await call('DELETE', `/azs/${id}`, tokens.admin);
    console.log(`cleanup: DELETE /azs/${id} → ${cleanup.status}`);
  }
}

const failed = results.filter(r => !r.ok).length;
console.log(`\nИтого: ${results.length - failed} из ${results.length} проверок прошли`);
process.exit(failed ? 1 : 0);
