// Единая точка аналитики: события уходят одновременно в Яндекс.Метрику и Google Analytics.
// Что подключено, решает наличие переменных VITE_YANDEX_METRIKA_ID и VITE_GOOGLE_ANALYTICS_ID.
import { METRIKA_ENABLED, initMetrika, metrikaPageView, metrikaGoal } from './metrika'
import { GA_ENABLED, initGA, gaPageView, gaEvent } from './ga'

// VITE_ANALYTICS_DEBUG=true печатает события в консоль, даже если счётчики не заданы
const DEBUG = import.meta.env.VITE_ANALYTICS_DEBUG === 'true'

// Эти поля не уходят в аналитику ни при каких условиях (152-ФЗ, пароли и токены)
const FORBIDDEN_PARAMS = ['username', 'email', 'password', 'token', 'login', 'phone']
const MAX_STRING_LENGTH = 100

const sanitize = (params) =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([key]) => !FORBIDDEN_PARAMS.includes(key.toLowerCase()))
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? value.slice(0, MAX_STRING_LENGTH) : value,
      ])
  )

export const isAnalyticsEnabled = () => METRIKA_ENABLED || GA_ENABLED

export function initAnalytics() {
  initMetrika()
  initGA()
}

export function trackPageView(path) {
  metrikaPageView(window.location.origin + path)
  gaPageView(path)
}

export function trackEvent(name, params = {}) {
  const safe = sanitize(params)
  if (DEBUG) console.info('[analytics]', name, safe)
  metrikaGoal(name, safe)
  gaEvent(name, safe)
}
