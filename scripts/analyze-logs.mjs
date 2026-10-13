// Сводка по журналам АЗС-Пульт (файлы logs/app-ГГГГ-ММ-ДД.log, по одной JSON-записи в строке).
// Выводит, что чаще всего ломается: уровни, пути и коды ответов, частые сообщения, последние ошибки.
//
// Запуск (из папки azs-pult-fullstack):
//   node scripts/analyze-logs.mjs                 последние 24 часа
//   node scripts/analyze-logs.mjs --hours=168     за неделю
//   LOG_DIR=путь node scripts/analyze-logs.mjs    другая папка с логами
//
// Вывод удобно передать AI для разбора: он текстовый и компактный.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const logDir = process.env.LOG_DIR || path.resolve(here, '../backend/logs');
const hoursArg = process.argv.find(a => a.startsWith('--hours='));
const hours = hoursArg ? Number(hoursArg.split('=')[1]) : 24;
const since = Date.now() - hours * 3600 * 1000;

if (!fs.existsSync(logDir)) {
  console.log(`Папка с логами не найдена: ${logDir}`);
  process.exit(0);
}

const entries = [];
for (const file of fs.readdirSync(logDir).filter(f => /^app-.*\.log$/.test(f))) {
  for (const line of fs.readFileSync(path.join(logDir, file), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (Date.parse(e.timestamp) >= since) entries.push(e);
    } catch {
      // битая строка пропускается
    }
  }
}

const count = (items, keyFn) => {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const byLevel = count(entries, e => e.level);
const warnsErrors = entries.filter(e => e.level === 'warn' || e.level === 'error');
const http = entries.filter(e => e.data && e.data.statusCode);
const endpoints = count(http, e => `${e.data.statusCode} ${e.data.method} ${e.data.path}`);
const messages = count(warnsErrors, e => `${e.level} | ${e.message}${e.error ? ` | ${e.error.message}` : ''}`);
const contexts = count(warnsErrors, e => e.context);

console.log(`Журналы: ${logDir}`);
console.log(`Период: последние ${hours} ч, записей: ${entries.length}`);
console.log('\n== Уровни');
for (const [k, v] of byLevel) console.log(`  ${k}: ${v}`);

console.log('\n== Ответы с ошибками по эндпоинтам (статус метод путь)');
for (const [k, v] of endpoints.filter(([k]) => !/^2|^3/.test(k)).slice(0, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`);

console.log('\n== Частые предупреждения и ошибки (уровень | сообщение | детали)');
for (const [k, v] of messages.slice(0, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`);

console.log('\n== По контексту (модуль)');
for (const [k, v] of contexts.slice(0, 10)) console.log(`  ${String(v).padStart(4)}  ${k}`);

console.log('\n== Последние 15 ошибок и предупреждений');
for (const e of warnsErrors.slice(-15)) {
  const extra = e.data ? ` ${JSON.stringify({ code: e.data.code, path: e.data.path, status: e.data.statusCode })}` : '';
  const err = e.error ? ` | ${e.error.name}: ${e.error.message}` : '';
  console.log(`  ${e.timestamp} ${e.level} [${e.context || '-'}] ${e.message}${err}${extra}`);
}
