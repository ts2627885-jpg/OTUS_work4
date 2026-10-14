// Каталог событий АЗС-Пульта. Названия уходят в Метрику как идентификаторы целей,
// поэтому менять их после запуска не стоит. Параметры не содержат персональных данных.
export const EVENTS = Object.freeze({
  LOGIN_SUCCESS: 'login_success', // { role }
  LOGIN_FAILED: 'login_failed', // { reason: 'invalid_credentials' | 'error' }
  LOGOUT: 'logout', // выход по кнопке, без параметров
  REGISTER_SUCCESS: 'register_success', // без параметров
  STATION_CREATE: 'station_create', // без параметров
  STATION_UPDATE: 'station_update', // { station_id }
  ANALYTICS_TAB_SELECT: 'analytics_tab_select', // { tab }
  RECOMMENDATIONS_GENERATE: 'recommendations_generate', // { saved, closed }
  RECOMMENDATION_COMPLETE: 'recommendation_complete', // { priority }
  DATA_IMPORT_UPLOAD: 'data_import_upload', // { files_count }
})
