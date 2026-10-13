// Vercel: все запросы /api/* переписаны в /api/index?path=<остальной путь> (см. vercel.json).
// Восстанавливаем исходный путь и передаём запрос Express-приложению из собранного backend/dist.
// createApp только строит приложение и не открывает порт: слушание нужно лишь при локальном запуске.
const createApp = require('../backend/dist/server.js').default;

const app = createApp();

module.exports = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const sub = url.searchParams.get('path');
  if (sub !== null) {
    url.searchParams.delete('path');
    req.url = `/api/${sub}${url.search}`;
  }
  return app(req, res);
};
