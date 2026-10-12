# 🎨 АЗС-Пульт Frontend v2.1

Vue 3 + Vite + Pinia - современный фронтенд для управления ценовой политикой АЗС.

## 📋 Содержание

1. [Архитектура](#архитектура)
2. [Установка](#установка)
3. [Структура проекта](#структура-проекта)
4. [Компоненты](#компоненты)
5. [Сторы (Pinia)](#сторы-pinia)
6. [API клиент](#api-клиент)
7. [Маршрутизация](#маршрутизация)
8. [Стили и Темизация](#стили-и-темизация)
9. [Развертывание](#развертывание)

## 🏗️ Архитектура

```
┌─────────────────────────────────────┐
│   Vue 3 Frontend (Vite)             │
├─────────────────────────────────────┤
│   Components / Views / Pages        │
├─────────────────────────────────────┤
│   Pinia Stores (Auth, Data)         │
├─────────────────────────────────────┤
│   Vue Router (SPA Routing)          │
├─────────────────────────────────────┤
│   API Client (Axios + Interceptors) │
├─────────────────────────────────────┤
│   Backend API (http://localhost:3001)
└─────────────────────────────────────┘
```

## 📦 Установка

### Требования
- **Node.js** 16+ (рекомендуется 20+)
- **npm** 8+ или **pnpm** 7+

### Быстрый старт

```bash
cd frontend

# Установить зависимости
npm install

# Копировать переменные окружения
cp .env.example .env

# Запустить dev сервер (автоматически откроется на http://localhost:3000)
npm run dev
```

### Production сборка

```bash
# Собрать оптимизированный пакет
npm run build

# Локальный preview сборки
npm run preview
```

## 📁 Структура проекта

```
frontend/
├── src/
│   ├── api/                    # API клиенты для каждого модуля
│   │   ├── client.js          # Аксиос с JWT интерцепторами
│   │   ├── auth.js            # Аутентификация
│   │   ├── azs.js             # АЗС станции
│   │   ├── recommendations.js # Рекомендации
│   │   ├── import.js          # Импорт данных
│   │   └── admin.js           # Администрирование
│   │
│   ├── components/            # Переиспользуемые компоненты
│   │   └── layout/
│   │       ├── AppHeader.vue  # Заголовок с юзер меню
│   │       └── AppSidebar.vue # Боковое меню навигации
│   │
│   ├── stores/                # Pinia сторы (глобальное состояние)
│   │   └── auth.js            # Авторизация и юзер данные
│   │
│   ├── views/                 # Страницы приложения
│   │   ├── LoginView.vue      # Вход
│   │   ├── RegisterView.vue   # Регистрация
│   │   ├── DashboardView.vue  # Главная панель
│   │   ├── AzsListView.vue    # Список АЗС
│   │   ├── AzsDetailView.vue  # Детали АЗС
│   │   ├── RecommendationsView.vue   # Рекомендации
│   │   ├── DataImportView.vue # Импорт данных
│   │   ├── AdminView.vue      # Администрация
│   │   └── NotFoundView.vue   # 404 страница
│   │
│   ├── router/
│   │   └── index.js           # Vue Router конфигурация
│   │
│   ├── App.vue                # Root компонент
│   └── main.js                # Entry point
│
├── index.html                 # HTML шаблон
├── vite.config.js             # Vite конфигурация
├── package.json               # Dependencies
├── .env.example               # Шаблон переменных окружения
└── public/                    # Статичные файлы
```

## 🧩 Компоненты

### Layout компоненты

#### AppHeader.vue
```vue
<!-- Заголовок приложения с логотипом и юзер меню -->
<AppHeader />
```

**Функциональность:**
- Логотип и название приложения
- Информация о текущем пользователе
- Кнопка выхода
- Отображение роли пользователя

#### AppSidebar.vue
```vue
<!-- Боковое меню навигации с правами доступа -->
<AppSidebar />
```

**Функциональность:**
- Динамическая навигация по правам
- Активное состояние текущей страницы
- Группировка меню по разделам
- Адаптивная версия для мобильных

## 📊 Сторы (Pinia)

### Auth Store

```javascript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// Состояние
authStore.user              // { id, username, email, role, permissions }
authStore.token             // JWT токен
authStore.isAuthenticated   // boolean
authStore.loading           // boolean

// Вычисляемые свойства
authStore.isAdmin()         // true если роль admin
authStore.isManager()       // true если роль manager
authStore.isAnalyst()       // true если роль analyst
authStore.isViewer()        // true если роль viewer
authStore.hasPermission('azs_view_all')  // Проверка прав

// Действия
await authStore.register(username, email, password)
await authStore.login(username, password)
authStore.logout()
authStore.restoreFromStorage()
```

**Особенности:**
- Автоматическое сохранение токена в localStorage
- Восстановление сессии при перезагрузке
- Интеграция с API клиентом

## 🔌 API клиент

### Axios интерцепторы

```javascript
// Автоматически добавляет Bearer токен ко всем запросам
client.interceptors.request.use(config => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

// Обрабатывает 401 и логирует юзера
client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      authStore.logout()
      router.push('/login')
    }
    return Promise.reject(error)
  }
)
```

### API модули

#### authAPI
```javascript
import { authAPI } from '@/api/auth'

await authAPI.register(username, email, password)
await authAPI.login(username, password)
await authAPI.logout()
await authAPI.getProfile()
```

#### azsAPI
```javascript
import { azsAPI } from '@/api/azs'

await azsAPI.getAll({ limit: 50, offset: 0 })
await azsAPI.getById(id)
await azsAPI.create(data)
await azsAPI.update(id, data)
await azsAPI.delete(id)
await azsAPI.getSales(azsId, { from, to })
await azsAPI.getTraffic(azsId, { from, to })
await azsAPI.getCompetitors(azsId)
await azsAPI.getWeather(azsId, { from, to })
```

#### recommendationsAPI
```javascript
import { recommendationsAPI } from '@/api/recommendations'

await recommendationsAPI.getForAzs(azsId, filters)
await recommendationsAPI.getAll(filters)
await recommendationsAPI.getById(id)
await recommendationsAPI.markAsCompleted(id, data)
await recommendationsAPI.generate(azsId)
await recommendationsAPI.getAnalytics(azsId, dateRange)
```

#### importAPI
```javascript
import { importAPI } from '@/api/import'

await importAPI.importCSV(file, dataType)  // Загрузить CSV
await importAPI.getHistory(filters)        // История импортов
await importAPI.getDetails(importId)       // Детали импорта
await importAPI.retry(importId)            // Повторить импорт
await importAPI.getTemplates()             // Получить шаблоны
await importAPI.downloadTemplate(name)    // Скачать шаблон
```

#### adminAPI
```javascript
import { adminAPI } from '@/api/admin'

// Управление пользователями
await adminAPI.users.getAll()
await adminAPI.users.create(userData)
await adminAPI.users.update(id, userData)
await adminAPI.users.delete(id)

// Управление ролями
await adminAPI.roles.getAll()
await adminAPI.roles.create(roleData)

// Логирование
await adminAPI.logs.getLoginLogs()
await adminAPI.logs.getAuditLogs()

// Статистика
await adminAPI.stats.getOverall()
await adminAPI.stats.getUserStats()
```

## 🗺️ Маршрутизация

### Маршруты с проверкой прав

```javascript
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { requiresAuth: false }  // Публичная страница
  },
  {
    path: '/azs',
    name: 'AzsList',
    component: AzsListView,
    meta: {
      requiresAuth: true,
      requiredPermissions: ['azs_view_all', 'azs_view_own']
    }
  },
  // ...
]
```

### Route Guards

```javascript
// Автоматическая проверка перед входом на страницу
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // Требует авторизацию
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  
  // Проверка прав
  if (to.meta.requiredPermissions) {
    const hasPermission = to.meta.requiredPermissions.some(
      perm => authStore.hasPermission(perm)
    )
    if (!hasPermission) {
      next({ name: 'Dashboard' })
      return
    }
  }
  
  next()
})
```

## 🎨 Стили и Темизация

### Цветовая схема

```javascript
// Primary gradient
#667eea -> #764ba2 (Purple-blue)

// Text
#333    (Dark gray for headings)
#666    (Gray for body)
#999    (Light gray for labels)

// Backgrounds
#f5f5f5 (Page background)
#ffffff (Cards)
```

### CSS переменные (опционально добавить)

```css
:root {
  --primary-light: #667eea;
  --primary-dark: #764ba2;
  --text-primary: #333;
  --text-secondary: #666;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --border-color: #e0e0e0;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

## 🚀 Развертывание

### Docker сборка

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview"]
```

### Docker Compose

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://backend:3001
    depends_on:
      - backend
```

### Production окружение

```bash
# .env.production
VITE_API_URL=https://api.azs-pult.com
```

### Nginx конфигурация

```nginx
server {
    listen 80;
    server_name azs-pult.com;

    root /app/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📚 Дополнительные ресурсы

- [Vue 3 Документация](https://vuejs.org/)
- [Vite Документация](https://vitejs.dev/)
- [Pinia Документация](https://pinia.vuejs.org/)
- [Vue Router Документация](https://router.vuejs.org/)
- [Axios Документация](https://axios-http.com/)

## 🐛 Debugging

### Включить логирование

```javascript
// main.js
if (import.meta.env.DEV) {
  window.__DEBUG__ = true
}
```

### Vue DevTools

```bash
# Установить расширение для Chrome/Firefox
# Chrome: Vue.js devtools
# Firefox: Vue.js devtools
```

### Сетевые запросы

```javascript
// Открыть Developer Tools (F12) -> Network tab
// Все запросы к /api будут видны с заголовками и телом
```

---

**Готово к использованию! 🎉**

Фронтенд полностью интегрирован с бэкенд API и готов к расширению с новыми компонентами и функциями.
