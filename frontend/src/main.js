import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/responsive.css'
import { watchTableLabels } from './utils/tableLabels'
import { initAnalytics } from './analytics'

// Счётчик до монтирования: первый просмотр страницы уйдёт через роутер
initAnalytics()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Подписи колонок для таблиц-карточек на телефоне
watchTableLabels()
