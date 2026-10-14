// Google Analytics 4: загрузка gtag.js, просмотры страниц и события.
// Подключается только если задан VITE_GOOGLE_ANALYTICS_ID (ID вида G-XXXXXXXXXX).

const MEASUREMENT_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID || null

export const GA_ENABLED = MEASUREMENT_ID !== null

let initialized = false

// Команды до загрузки gtag.js складываются в dataLayer (так же работает официальный сниппет Google)
function gtag() {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(arguments)
}

export function initGA() {
  if (!GA_ENABLED || initialized) return
  initialized = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  gtag('js', new Date())
  // send_page_view: false — просмотры отправляет роутер, иначе первый просмотр придёт дважды
  gtag('config', MEASUREMENT_ID, { send_page_view: false })
}

export function gaPageView(path) {
  if (!GA_ENABLED) return
  gtag('event', 'page_view', {
    page_location: window.location.origin + path,
    page_path: path,
  })
}

export function gaEvent(name, params) {
  if (!GA_ENABLED) return
  gtag('event', name, params)
}
