import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/responsive.css'
import { watchTableLabels } from './utils/tableLabels'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Подписи колонок для таблиц-карточек на телефоне
watchTableLabels()
