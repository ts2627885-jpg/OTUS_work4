// Обновляет фикстуры мок-режима реальными ответами backend.
// Запуск: node scripts/refresh-mock-fixtures.mjs  (backend должен работать на 3001, пароль admin — из CLAUDE.md)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const BASE = process.env.API_URL || 'http://localhost:3001/api'
const USER = process.env.MOCK_USER || 'admin'
const PASSWORD = process.env.MOCK_PASSWORD || 'Admin123456'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks', 'fixtures', 'responses.json')

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD })
})
const loginJson = await login.json()
if (!login.ok) throw new Error(`вход не выполнен: ${login.status}`)
const token = loginJson.data.token.access_token

const get = async (p) => {
  const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`${p} -> ${r.status}`)
  return r.json()
}

const out = { 'POST /auth/login': loginJson }
const azs = await get('/azs')
out['/azs'] = azs
const stationTabs = ['prices', 'competitors', 'traffic', 'volume', 'shop']
const allTabs = ['prices', 'competitors', 'traffic', 'factors', 'volume', 'shop', 'promotions']
for (const { id } of azs.data) {
  out[`/azs/${id}`] = await get(`/azs/${id}`)
  for (const sub of ['sales', 'traffic', 'weather', 'competitors']) out[`/azs/${id}/${sub}`] = await get(`/azs/${id}/${sub}`)
  for (const t of stationTabs) out[`/analytics/${t}?azsId=${id}`] = await get(`/analytics/${t}?azsId=${id}`)
}
out['/prices'] = await get('/prices')
out['/recommendations'] = await get('/recommendations')
out['/analysis/rules'] = await get('/analysis/rules')
out['/dashboard'] = await get('/dashboard')
out['/stations/check'] = await get('/stations/check')
for (const t of allTabs) out[`/analytics/${t}`] = await get(`/analytics/${t}`)
for (const p of ['/admin/stats/overall', '/admin/users', '/admin/settings', '/admin/logs/login', '/admin/logs/audit', '/admin/price-test', '/import/history', '/import/summary']) {
  out[p] = await get(p)
}
fs.writeFileSync(OUT, JSON.stringify(out))
console.log(`фикстуры обновлены: ${Object.keys(out).length} ответов, ${fs.statSync(OUT).size} байт`)
