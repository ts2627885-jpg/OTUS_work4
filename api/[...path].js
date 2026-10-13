// Vercel: все запросы /api/* обрабатывает Express-приложение из собранного backend/dist.
// createApp только строит приложение и не открывает порт: слушание нужно лишь при локальном запуске.
const createApp = require('../backend/dist/server.js').default;

const app = createApp();

module.exports = app;
