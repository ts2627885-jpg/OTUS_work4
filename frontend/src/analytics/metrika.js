// Яндекс.Метрика: загрузка счётчика, просмотры страниц и цели (события).
// Подключается только если задан VITE_YANDEX_METRIKA_ID.

const COUNTER_ID = Number(import.meta.env.VITE_YANDEX_METRIKA_ID) || null
const TAG_URL = 'https://mc.yandex.ru/metrika/tag.js'

export const METRIKA_ENABLED = COUNTER_ID !== null

let initialized = false

// Очередь вызовов до загрузки tag.js: вызовы не теряются, Метрика выполнит их после загрузки
const ym = (...args) => {
  if (!window.ym) {
    window.ym = function queueCall() {
      const queue = (window.ym.a = window.ym.a || [])
      queue.push(arguments)
    }
    window.ym.l = Date.now()
  }
  window.ym(...args)
}

export function initMetrika() {
  if (!METRIKA_ENABLED || initialized) return
  initialized = true

  const script = document.createElement('script')
  script.async = true
  script.src = TAG_URL
  document.head.appendChild(script)

  // defer: первый просмотр отправляет роутер, а не загрузка скрипта
  ym(COUNTER_ID, 'init', {
    defer: true,
    ssl: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    // Запись действий пользователя (вебвизор) отключена: на экранах есть пароли
    webvisor: false,
  })
}

export function metrikaPageView(url) {
  if (!METRIKA_ENABLED) return
  ym(COUNTER_ID, 'hit', url)
}

export function metrikaGoal(name, params) {
  if (!METRIKA_ENABLED) return
  ym(COUNTER_ID, 'reachGoal', name, params)
}
