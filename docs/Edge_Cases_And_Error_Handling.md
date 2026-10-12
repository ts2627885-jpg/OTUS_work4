# АЗС-Пульт: Негативные сценарии и Edge Cases

**Версия:** 1.0  
**Дата:** 7 октября 2026  
**Проект:** АЗС-Пульт (Gas Station Pricing & Analytics Platform)  
**Статус:** Error Handling & UX Specification

---

## 📋 Содержание

1. [Типы ошибок](#типы-ошибок)
2. [Аутентификация и авторизация](#1-аутентификация-и-авторизация)
3. [Dashboard и загрузка данных](#2-dashboard-и-загрузка-данных)
4. [Применение рекомендаций](#3-применение-рекомендаций)
5. [Просмотр деталей и анализ](#4-просмотр-деталей-и-анализ)
6. [CSV импорт](#5-csv-импорт)
7. [Просмотр конкурентных цен](#6-просмотр-конкурентных-цен)
8. [Система рекомендаций](#7-система-рекомендаций)
9. [Отслеживание результатов](#8-отслеживание-результатов)
10. [Логирование и аудит](#9-логирование-и-аудит)
11. [Global Error Handling](#10-global-error-handling)

---

## Типы ошибок

### Классификация

```
┌─ ОШИБКИ ВАЛИДАЦИИ (Validation Errors)
│  ├─ Неверный формат данных (email, дата, число)
│  ├─ Пустые обязательные поля
│  ├─ Значение вне диапазона
│  └─ Неверный тип данных
│
├─ ОШИБКИ ДОСТУПА (Authorization & Authentication)
│  ├─ Неверные учетные данные
│  ├─ Токен истек
│  ├─ Недостаточно прав
│  ├─ Попытка доступа к чужим данным
│  └─ Брутфорс атака
│
├─ ОШИБКИ ДАННЫХ (Data Errors)
│  ├─ Отсутствие данных
│  ├─ Несогласованные данные
│  ├─ Конфликты (дублирование)
│  └─ Версионирование данных
│
├─ ОШИБКИ СЕТИ (Network Errors)
│  ├─ Соединение потеряно
│  ├─ Timeout
│  ├─ Server error (5xx)
│  ├─ Rate limiting (429)
│  └─ DNS error
│
├─ ОШИБКИ СИСТЕМЫ (System Errors)
│  ├─ База данных недоступна
│  ├─ Файловая система переполнена
│  ├─ Недостаточно памяти
│  └─ Сервис недоступен
│
└─ ОШИБКИ БИЗНЕС-ЛОГИКИ (Business Logic)
   ├─ Цена ниже себестоимости
   ├─ Нарушение ограничений
   ├─ Конфликт правил
   └─ Операция невозможна в текущем состоянии
```

### Коды ошибок HTTP

```
400 Bad Request        - Ошибка валидации (клиент)
401 Unauthorized       - Требуется аутентификация
403 Forbidden          - Недостаточно прав
404 Not Found          - Ресурс не найден
409 Conflict           - Конфликт (дублирование, версионирование)
413 Payload Too Large  - Файл слишком большой
429 Too Many Requests  - Rate limiting
500 Internal Error     - Ошибка сервера
503 Service Unavailable - Сервис недоступен
504 Gateway Timeout    - Timeout
```

---

# 1. Аутентификация и авторизация

## 1.1 Ошибки входа (Story #1)

### Сценарий 1: Неверный email или пароль

**Что может пойти не так:**
- Пользователь забыл пароль
- Пользователь забыл email
- Опечатка в email (транслитерация)
- Caps Lock включен
- Пароль скопирован с пробелом

**HTTP Status:** 401 Unauthorized

**Ошибка от сервера:**
```json
{
  "error": "invalid_credentials",
  "message": "Email или пароль неверный",
  "timestamp": "2026-10-07T09:15:30Z",
  "errorCode": "AUTH-001",
  "details": null
}
```

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Email или пароль неверный             │
├─────────────────────────────────────────┤
│                                         │
│  ❌ Проверьте правильность введенных   │
│     данных. Пароль чувствителен к     │
│     регистру (A ≠ a)                   │
│                                         │
│  💡 Подсказки:                         │
│     • Caps Lock включен? (если да)     │
│     • Используйте полный email         │
│     • Избегайте пробелов в начале/конце│
│                                         │
│  [Забыли пароль?] [Попробуйте снова]  │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Frontend
interface LoginError {
  message: string;
  hints: string[];
  capsLockDetected: boolean;
}

function handleLoginError(error: any): LoginError {
  const hints: string[] = [];
  
  // Проверка Caps Lock
  let capsLockDetected = false;
  document.addEventListener('keypress', (e) => {
    capsLockDetected = e.getModifierState('CapsLock');
  });
  
  // Добавляем подсказки
  if (capsLockDetected) {
    hints.push('Включен Caps Lock');
  }
  
  if (inputEmail.includes(' ')) {
    hints.push('Email содержит пробелы');
  }
  
  return {
    message: 'Email или пароль неверный',
    hints,
    capsLockDetected
  };
}

// Backend
async function login(email: string, password: string) {
  const user = await User.findByEmail(email.trim());
  
  if (!user) {
    throw new AuthError('AUTH-001', 'Email или пароль неверный');
  }
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isValid) {
    // Логируем неудачную попытку
    await LoginAttempt.log({
      email,
      success: false,
      ip: request.ip,
      userAgent: request.userAgent
    });
    
    throw new AuthError('AUTH-001', 'Email или пароль неверный');
  }
  
  return { token, user };
}
```

---

### Сценарий 2: Брутфорс атака

**Что может пойти не так:**
- Злоумышленник пытается угадать пароль
- Много неудачных попыток входа подряд
- Попытки со множества IP-адресов

**HTTP Status:** 429 Too Many Requests

**Ошибка:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Слишком много попыток входа. Попробуйте через 15 минут",
  "retryAfter": 900,
  "errorCode": "AUTH-002"
}
```

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Доступ временно заблокирован          │
├─────────────────────────────────────────┤
│                                         │
│  🔒 Обнаружено слишком много неудачных │
│     попыток входа с этого устройства   │
│                                         │
│  Повторите попытку через:              │
│  ⏱️  15:00 минут                        │
│                                         │
│  Причины блокировки:                   │
│  • Забыли пароль?                      │
│  • Используете новый браузер?           │
│  • Проблемы с вводом?                  │
│                                         │
│  [Восстановить пароль] [Контакты]     │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Backend - Rate limiting
class LoginAttemptTracker {
  private attempts = new Map<string, LoginAttempt[]>();
  
  async recordAttempt(email: string, ip: string, success: boolean) {
    const key = `${email}:${ip}`;
    const now = Date.now();
    
    if (!this.attempts.has(key)) {
      this.attempts.set(key, []);
    }
    
    const attempts = this.attempts.get(key)!;
    attempts.push({ timestamp: now, success });
    
    // Чистим старые попытки (старше 15 минут)
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    this.attempts.set(key, attempts.filter(a => a.timestamp > fifteenMinutesAgo));
    
    return this.getFailureCount(key);
  }
  
  isBlocked(email: string, ip: string): { blocked: boolean; retryAfter?: number } {
    const key = `${email}:${ip}`;
    const attempts = this.attempts.get(key) || [];
    
    const failedAttempts = attempts.filter(a => !a.success);
    
    if (failedAttempts.length >= 5) {
      const oldestAttempt = failedAttempts[0].timestamp;
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
      
      if (oldestAttempt > fifteenMinutesAgo) {
        const retryAfter = Math.ceil((oldestAttempt + 15 * 60 * 1000 - Date.now()) / 1000);
        return { blocked: true, retryAfter };
      }
    }
    
    return { blocked: false };
  }
}

// Middleware для login
async function loginMiddleware(req, res, next) {
  const { email, ip } = req;
  
  const { blocked, retryAfter } = loginAttemptTracker.isBlocked(email, ip);
  
  if (blocked) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Слишком много попыток входа',
      retryAfter,
      errorCode: 'AUTH-002'
    });
  }
  
  try {
    const result = await login(email, password);
    await loginAttemptTracker.recordAttempt(email, ip, true);
    res.json(result);
  } catch (err) {
    await loginAttemptTracker.recordAttempt(email, ip, false);
    res.status(401).json(err);
  }
}
```

---

### Сценарий 3: Токен истек

**Что может пойти не так:**
- Пользователь работал > 24 часов без обновления
- Сессия разорвалась из-за неактивности
- Многовкладка - одна вкладка выполнила logout

**HTTP Status:** 401 Unauthorized

**Ошибка:**
```json
{
  "error": "token_expired",
  "message": "Сессия истекла. Пожалуйста, войдите снова",
  "errorCode": "AUTH-003"
}
```

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Сессия истекла                        │
├─────────────────────────────────────────┤
│                                         │
│  ⏰ Ваша сессия истекла по истечении    │
│     24 часов неработающего времени      │
│                                         │
│  Данные сохранены, войдите снова       │
│                                         │
│  [Войти]                               │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Frontend - Interceptor для обновления токена
class ApiClient {
  async request(url: string, options: RequestOptions) {
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    // Если 401 - пытаемся обновить токен
    if (response.status === 401) {
      const refreshToken = this.getRefreshToken();
      
      if (refreshToken) {
        try {
          const newToken = await this.refreshAccessToken(refreshToken);
          this.token = newToken;
          
          // Повторяем запрос с новым токеном
          response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${this.token}`
            }
          });
        } catch (err) {
          // Refresh не сработал - редирект на login
          this.redirectToLogin({
            message: 'Сессия истекла. Пожалуйста, войдите снова'
          });
        }
      } else {
        this.redirectToLogin({
          message: 'Требуется аутентификация'
        });
      }
    }
    
    return response;
  }
}

// Backend - Refresh token endpoint
async function refreshAccessToken(req: Request) {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    throw new AuthError('AUTH-004', 'Refresh token не найден');
  }
  
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await User.findById(payload.userId);
    
    if (!user || user.refreshTokenRevoked) {
      throw new Error('Refresh token недействителен');
    }
    
    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      ACCESS_SECRET,
      { expiresIn: '24h' }
    );
    
    return { accessToken: newAccessToken };
  } catch (err) {
    throw new AuthError('AUTH-005', 'Не удалось обновить сессию');
  }
}
```

---

### Сценарий 4: Недостаточно прав (Authorization)

**Что может пойти не так:**
- Manager пытается доступить Admin функцию
- Viewer пытается изменить цену
- Manager пытается управлять пользователями других АЗС

**HTTP Status:** 403 Forbidden

**Ошибка:**
```json
{
  "error": "insufficient_permissions",
  "message": "У вас недостаточно прав для выполнения этого действия",
  "requiredRole": "Admin",
  "userRole": "Manager",
  "errorCode": "AUTH-006"
}
```

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Доступ запрещен                       │
├─────────────────────────────────────────┤
│                                         │
│  🚫 У вас нет доступа к этой функции  │
│                                         │
│  Ваша роль: Manager                    │
│  Требуется: Administrator              │
│                                         │
│  Для получения доступа:                │
│  1. Отправить заявку директору         │
│  2. Или свяжитесь с поддержкой         │
│                                         │
│  [Отправить заявку] [Контакты поддержки]│
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Middleware для проверки прав
function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'insufficient_permissions',
        message: 'У вас недостаточно прав для выполнения этого действия',
        requiredRoles: allowedRoles,
        userRole,
        errorCode: 'AUTH-006'
      });
    }
    
    next();
  };
}

// Использование
app.post(
  '/admin/users',
  authenticate,
  requireRole('Admin'),
  createUserHandler
);

// Frontend - скрывание недоступных функций
function CanAccess({ roles, children, fallback }: {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const userRole = useAuth().user?.role;
  
  if (!roles.includes(userRole)) {
    return fallback || (
      <Tooltip title="У вас нет доступа к этой функции">
        <span style={{ opacity: 0.5 }}>
          {children}
        </span>
      </Tooltip>
    );
  }
  
  return children;
}

// Использование
<CanAccess roles={['Admin']}>
  <button onClick={openAdminPanel}>Администрирование</button>
</CanAccess>
```

---

## 1.2 Ошибки восстановления пароля

### Сценарий 1: Email не найден в системе

**HTTP Status:** 404 Not Found

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Email не найден                       │
├─────────────────────────────────────────┤
│                                         │
│  Пользователь с таким email не        │
│  зарегистрирован в системе              │
│                                         │
│  Возможно вы используете другой email?  │
│  (проверьте с каким email вы            │
│   вводили в профиль)                    │
│                                         │
│  Или свяжитесь с администратором       │
│  для создания аккаунта                  │
│                                         │
│  [Попробовать другой email]             │
│  [Контакты администратора]              │
└─────────────────────────────────────────┘
```

---

### Сценарий 2: Ссылка восстановления истекла

**HTTP Status:** 400 Bad Request

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Ссылка больше не действует            │
├─────────────────────────────────────────┤
│                                         │
│  ⏰ Ссылка на восстановление пароля    │
│     действует только 1 час              │
│                                         │
│  Запросите новую ссылку:                │
│                                         │
│  [Отправить новую ссылку]               │
└─────────────────────────────────────────┘
```

---

# 2. Dashboard и загрузка данных

## 2.1 Отсутствие данных (Story #2)

### Сценарий 1: Данные еще не загружены

**Что может пойти не так:**
- Первый день использования системы
- Новая АЗС добавлена только сегодня
- Файл CSV импортирован, но обработка в процессе

**HTTP Status:** 200 OK (но данные пусты)

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Dashboard                              │
├─────────────────────────────────────────┤
│                                         │
│  📊 Ваш Dashboard                       │
│                                         │
│  ⏳ Данные загружаются...               │
│                                         │
│  Это первый день работы системы.       │
│  Рекомендации появятся через 24 часа   │
│  после первого сбора данных             │
│                                         │
│  Тем временем:                          │
│  • Настройте параметры АЗС             │
│  • Загрузите исторические данные (CSV) │
│  • Добавьте конкурентов в систему       │
│                                         │
│  [Загрузить CSV] [Настройки]            │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Frontend
function Dashboard() {
  const { data, isLoading, error } = useQuery(getDashboardData);
  
  // Специальное состояние: нет данных
  if (!isLoading && (!data || data.recommendations.length === 0)) {
    return <EmptyStateOnboarding />;
  }
  
  if (isLoading) {
    return <LoadingSpinner message="Загружаем ваш Dashboard..." />;
  }
  
  return <DashboardContent data={data} />;
}

function EmptyStateOnboarding() {
  return (
    <EmptyState
      icon="📊"
      title="Добро пожаловать в АЗС-Пульт!"
      subtitle="Ваш Dashboard еще пуст"
      description={
        <>
          <p>Это первый день работы системы. Вот что нужно сделать:</p>
          <ol>
            <li><strong>Дождитесь</strong> 24 часов сбора данных</li>
            <li><strong>Загрузите</strong> исторические данные (CSV)</li>
            <li><strong>Добавьте</strong> конкурентов</li>
          </ol>
        </>
      }
      actions={[
        { label: 'Загрузить CSV', href: '/admin/import' },
        { label: 'Посмотреть руководство', href: '/help/getting-started' }
      ]}
    />
  );
}
```

---

### Сценарий 2: Ошибка при загрузке Dashboard

**HTTP Status:** 500 Internal Server Error или 503 Service Unavailable

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Ошибка загрузки                       │
├─────────────────────────────────────────┤
│                                         │
│  ❌ Не удалось загрузить Dashboard      │
│                                         │
│  Возможные причины:                    │
│  • Сервис временно недоступен          │
│  • Проблема с интернет-соединением     │
│  • Много пользователей в системе       │
│                                         │
│  Попробуйте:                           │
│  1. Обновить страницу (Ctrl+F5)        │
│  2. Проверить интернет                 │
│  3. Подождать несколько минут          │
│                                         │
│  [Обновить] [Контакты поддержки]       │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
interface DashboardError {
  type: 'network' | 'timeout' | 'server' | 'unknown';
  message: string;
  retryAfter?: number;
}

function handleDashboardError(error: any): DashboardError {
  if (error.isNetworkError) {
    return {
      type: 'network',
      message: 'Проблема с интернет-соединением'
    };
  }
  
  if (error.isTimeout) {
    return {
      type: 'timeout',
      message: 'Запрос занял слишком долго. Сервер может быть загружен',
      retryAfter: 5000 // Рекомендуем попробовать через 5 сек
    };
  }
  
  if (error.status >= 500) {
    return {
      type: 'server',
      message: 'Сервер временно недоступен. Мы работаем над исправлением',
      retryAfter: 30000 // Попробовать через 30 сек
    };
  }
  
  return {
    type: 'unknown',
    message: 'Не удалось загрузить Dashboard'
  };
}

// Frontend - Retry с экспоненциальной задержкой
async function fetchDashboardWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await api.get('/dashboard');
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const dashError = handleDashboardError(error);
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 2.2 Сетевые ошибки

### Сценарий 1: Интернет отключился

**Что может пойти не так:**
- Manager работал в offline режиме
- WiFi неожиданно отключился
- Перешел с WiFi на мобильный интернет

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  🔴 Нет подключения к интернету       │
├─────────────────────────────────────────┤
│                                         │
│  Данные на странице могут быть         │
│  устаревшими (загружены 5 минут назад)  │
│                                         │
│  Операции будут синхронизированы      │
│  при восстановлении соединения          │
│                                         │
│  Кэшированные действия (2):             │
│  ✓ Цена изменена на 54.9₽ (ожидается) │
│  ✓ Рекомендация отклонена (ожидается)  │
│                                         │
│  [Проверить соединение]                 │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Frontend - Offline detection
class OfflineManager {
  private isOnline = navigator.onLine;
  private queuedActions: QueuedAction[] = [];
  
  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }
  
  private handleOffline() {
    this.isOnline = false;
    showNotification({
      type: 'warning',
      message: 'Нет подключения к интернету',
      icon: '🔴',
      persistent: true
    });
  }
  
  private async handleOnline() {
    this.isOnline = true;
    showNotification({
      type: 'success',
      message: 'Соединение восстановлено. Синхронизирую данные...',
      autoHide: true
    });
    
    // Синхронизируем очередь
    await this.syncQueuedActions();
  }
  
  async executeAction<T>(action: () => Promise<T>): Promise<T> {
    if (this.isOnline) {
      return action();
    } else {
      // Добавляем в очередь
      const queued: QueuedAction = {
        id: uuid(),
        action,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      this.queuedActions.push(queued);
      
      showNotification({
        message: `Действие добавлено в очередь (${this.queuedActions.length})`,
        type: 'info'
      });
      
      // Когда соединение восстановится, действие будет выполнено
      return new Promise((resolve, reject) => {
        queued.resolve = resolve;
        queued.reject = reject;
      });
    }
  }
  
  private async syncQueuedActions() {
    for (const action of this.queuedActions) {
      try {
        action.status = 'syncing';
        const result = await action.action();
        action.status = 'completed';
        action.resolve?.(result);
      } catch (error) {
        action.status = 'failed';
        action.reject?.(error);
      }
    }
    
    this.queuedActions = this.queuedActions.filter(a => a.status !== 'completed');
  }
}

// Использование в компонентах
const offlineManager = new OfflineManager();

async function applyPrice(newPrice: number) {
  await offlineManager.executeAction(async () => {
    return api.post('/prices/apply', { newPrice });
  });
}
```

---

# 3. Применение рекомендаций

## 3.1 Валидация цены (Story #3)

### Сценарий 1: Цена ниже себестоимости

**Что может пойти не так:**
- Manager случайно вводит минусовую цену
- Система получила неверную себестоимость
- Manager хочет сознательно установить убыточную цену

**HTTP Status:** 400 Bad Request

**Ошибка:**
```json
{
  "error": "validation_error",
  "message": "Цена не может быть ниже себестоимости",
  "field": "price",
  "value": 52,
  "minAllowed": 55,
  "costPrice": 55,
  "errorCode": "PRICE-001"
}
```

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  ⚠️ КРИТИЧНАЯ ОШИБКА                   │
├─────────────────────────────────────────┤
│                                         │
│  Цена не может быть ниже себестоимости  │
│                                         │
│  Себестоимость (cost_price): 55.0₽    │
│  Ваша цена:                  52.0₽    │
│  Разница:                    -3.0₽    │
│                                         │
│  ❌ При этой цене АЗС теряет            │
│     деньги. Операция заблокирована      │
│                                         │
│  Что делать:                            │
│  1. Введите цену >= 55.0₽              │
│  2. Если себестоимость неверна,        │
│     свяжитесь с администратором        │
│  3. Для срочной операции запросите     │
│     Override у директора                │
│                                         │
│  [Исправить цену] [Запросить Override]  │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Frontend - Real-time validation
function PriceInput({ costPrice, onPriceChange }) {
  const [price, setPrice] = useState(costPrice);
  const [error, setError] = useState<string | null>(null);
  
  const handleChange = (value: number) => {
    setPrice(value);
    
    if (value < costPrice) {
      setError(`Цена не может быть ниже себестоимости (${costPrice}₽)`);
    } else {
      setError(null);
      onPriceChange(value);
    }
  };
  
  return (
    <div>
      <input
        type="number"
        value={price}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        style={{
          borderColor: error ? 'red' : 'green',
          backgroundColor: error ? '#ffe6e6' : 'white'
        }}
      />
      {error && (
        <div style={{ color: 'red', marginTop: '8px', fontWeight: 'bold' }}>
          ❌ {error}
        </div>
      )}
      <button disabled={!!error || price === costPrice}>
        Применить цену
      </button>
    </div>
  );
}

// Backend - Validation
async function applyPrice(priceChange: {
  azs_id: string;
  newPrice: number;
  userRole: string;
}) {
  const azs = await AZS.findById(priceChange.azs_id);
  
  if (priceChange.newPrice < azs.costPrice) {
    // Если Manager - отклоняем
    if (priceChange.userRole !== 'Admin' && priceChange.userRole !== 'Director') {
      throw new ValidationError(
        'PRICE-001',
        'Цена не может быть ниже себестоимости',
        {
          field: 'price',
          minAllowed: azs.costPrice,
          costPrice: azs.costPrice
        }
      );
    }
    
    // Если Admin/Director - требуем явного подтверждения
    if (!priceChange.explicit_override) {
      throw new ValidationError(
        'PRICE-002',
        'Требуется явное подтверждение для цены ниже себестоимости',
        {
          requiresOverride: true,
          costPrice: azs.costPrice
        }
      );
    }
    
    // Логируем override
    await PriceAudit.log({
      azs_id: azs.id,
      oldPrice: azs.price,
      newPrice: priceChange.newPrice,
      overrideReason: 'Below cost price',
      overriddenBy: priceChange.userId
    });
  }
  
  azs.price = priceChange.newPrice;
  await azs.save();
}
```

---

### Сценарий 2: Цена содержит невалидные символы

**Что может пойти не так:**
- Ввод букв вместо цифр
- Неправильный формат (много запятых)
- Копирование цены из другой программы (форматирование)

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Ошибка в вводе цены                  │
├─────────────────────────────────────────┤
│                                         │
│  Цена должна быть числом (например:   │
│  54.5 или 54,5)                        │
│                                         │
│  Текущее значение: 54.5₽ руб            │
│  (автоматически исправлено)            │
│                                         │
│  Формат: до 5 цифр, разделитель       │
│  . или , (максимум 2 знака после)      │
└─────────────────────────────────────────┘
```

---

## 3.2 Ошибки разрешения (Story #3)

### Сценарий 1: Manager не имеет прав на эту АЗС

**HTTP Status:** 403 Forbidden

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Доступ запрещен                       │
├─────────────────────────────────────────┤
│                                         │
│  У вас нет доступа к АЗС #127          │
│                                         │
│  Вы назначены на АЗС:                  │
│  • АЗС #42 (Тверская обл)              │
│  • АЗС #43 (Тверская обл)              │
│                                         │
│  Если нужен доступ к этой АЗС,        │
│  отправьте заявку администратору       │
│                                         │
│  [Отправить заявку]                    │
└─────────────────────────────────────────┘
```

---

# 4. Просмотр деталей и анализ

## 4.1 Отсутствие данных для анализа (Story #4)

### Сценарий 1: Недостаточно данных для расчета R²

**Что может пойти не так:**
- Рекомендация основана на < 7 днях данных
- История конкурента очень короткая
- Мало вариативности в данных (все цены одинаковые)

**HTTP Status:** 200 OK (но с предупреждением)

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Подробный анализ                      │
├─────────────────────────────────────────┤
│                                         │
│  Правило: PRICE-001                    │
│  Выравнивание цены с конкурентами      │
│                                         │
│  Текущая цена:      55.5₽              │
│  Рекомендуемая:     54.9₽              │
│  Изменение:        -₽0.6 (-1%)         │
│                                         │
│  ⚠️ НИЗКАЯ УВЕРЕННОСТЬ (R² = 0.45)    │
│                                         │
│  Модель на 45% объясняет вариацию.     │
│  Для более надежной рекомендации       │
│  нужно больше данных (минимум 30 дней) │
│                                         │
│  История данных:                       │
│  • Срок: 3 дня (нужно 30)              │
│  • Точек данных: 12 (нужно 50+)        │
│                                         │
│  Рекомендуем подождать неделю         │
│  и вернуться к этому анализу            │
│                                         │
│  [Применить с осторожностью] [Отмена]  │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
interface PriceRecommendation {
  rule: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number; // R² или другой метрик
  minConfidenceRequired: number;
  dataQuality: {
    dataPoints: number;
    minRequired: number;
    daysOfHistory: number;
    minRequired: number;
    dataVariance: number; // стандартное отклонение
  };
  warning?: string;
  isReliable: boolean;
}

function RecommendationDetails({ rec }: { rec: PriceRecommendation }) {
  const confidencePercent = Math.round(rec.confidence * 100);
  const isReliable = rec.confidence >= rec.minConfidenceRequired;
  
  return (
    <div style={{
      borderLeft: isReliable ? '4px solid green' : '4px solid orange'
    }}>
      {!isReliable && (
        <Alert severity="warning">
          <strong>⚠️ НИЗКАЯ УВЕРЕННОСТЬ</strong>
          <p>Модель на {confidencePercent}% объясняет вариацию</p>
          <p>Причины:</p>
          <ul>
            {rec.dataQuality.dataPoints < rec.dataQuality.minRequired && (
              <li>Недостаточно точек данных: {rec.dataQuality.dataPoints}/{rec.dataQuality.minRequired}</li>
            )}
            {rec.dataQuality.daysOfHistory < rec.dataQuality.minRequired && (
              <li>Мало истории: {rec.dataQuality.daysOfHistory}/{rec.dataQuality.minRequired} дней</li>
            )}
            {rec.dataQuality.dataVariance < 0.1 && (
              <li>Мало вариативности в данных (все цены почти одинаковые)</li>
            )}
          </ul>
        </Alert>
      )}
      
      <button disabled={!isReliable}>
        Применить рекомендацию
      </button>
    </div>
  );
}
```

---

# 5. CSV импорт

## 5.1 Ошибки валидации файла (Story #6)

### Сценарий 1: Неверный формат даты

**Что может пойти не так:**
- CSV содержит даты в формате DD.MM.YYYY, а система ожидает YYYY-MM-DD
- Даты в русской локали (1 января вместо 1 January)
- Смешанные форматы в разных строках

**HTTP Status:** 400 Bad Request

**Ошибка:**
```json
{
  "error": "validation_error",
  "message": "Ошибка в строках: 1245, 3456, 8901",
  "errorCode": "IMPORT-001",
  "details": {
    "field": "date",
    "expectedFormat": "YYYY-MM-DD (ISO 8601)",
    "exampleInvalid": "01.10.2026",
    "exampleValid": "2026-10-01",
    "rowsAffected": [1245, 3456, 8901]
  }
}
```

**UX Решение:**

```
┌─────────────────────────────────────────────────┐
│  Ошибка при импорте CSV                        │
├─────────────────────────────────────────────────┤
│                                         │
│  ❌ Найдено 3 ошибки в формате даты   │
│                                         │
│  Проблема: Неверный формат даты       │
│                                         │
│  Ожидаемый формат:  YYYY-MM-DD         │
│                     (например: 2026-10-07)
│                                         │
│  Ошибки в строках: 1245, 3456, 8901   │
│                                         │
│  Пример ошибок:                        │
│  • Строка 1245: "01.10.2026" ❌        │
│                  "2026-10-01" ✓        │
│  • Строка 3456: "1/10/26" ❌           │
│                  "2026-10-01" ✓        │
│                                         │
│  Решение:                              │
│  1. Скачайте CSV ошибочных строк     │
│  2. Исправьте даты в Excel            │
│  3. Загрузите исправленный файл        │
│                                         │
│  [Скачать ошибочные строки] [Отмена]  │
└─────────────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Frontend - Download errors as CSV
async function downloadErrorRows() {
  const csv = createCSVFromErrors(validationErrors.rowsAffected);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `import_errors_${Date.now()}.csv`;
  link.click();
}

// Backend - Validation and error reporting
async function importCSV(file: File) {
  const errors: ValidationError[] = [];
  const successfulRows: any[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // Валидация даты
      if (row.date && !isValidISO8601Date(row.date)) {
        errors.push({
          rowNumber: i + 1,
          field: 'date',
          value: row.date,
          expectedFormat: 'YYYY-MM-DD',
          message: `Ожидается YYYY-MM-DD, получено ${row.date}`
        });
        continue;
      }
      
      // Если валидна - добавляем в успешные
      successfulRows.push(row);
    } catch (err) {
      errors.push({
        rowNumber: i + 1,
        message: err.message
      });
    }
  }
  
  // Возвращаем результат с детальной информацией об ошибках
  return {
    success: errors.length === 0,
    successCount: successfulRows.length,
    errorCount: errors.length,
    errors: errors.slice(0, 100), // Показываем первые 100 ошибок
    hasMoreErrors: errors.length > 100,
    errorsSummary: groupErrorsByField(errors)
  };
}

function groupErrorsByField(errors: ValidationError[]) {
  const summary = new Map<string, any>();
  
  for (const error of errors) {
    if (!summary.has(error.field)) {
      summary.set(error.field, {
        field: error.field,
        count: 0,
        examples: [],
        expectedFormat: error.expectedFormat
      });
    }
    
    const entry = summary.get(error.field)!;
    entry.count++;
    
    if (entry.examples.length < 3) {
      entry.examples.push({
        row: error.rowNumber,
        value: error.value
      });
    }
  }
  
  return Array.from(summary.values());
}
```

---

### Сценарий 2: Файл слишком большой

**HTTP Status:** 413 Payload Too Large

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Файл слишком большой                 │
├─────────────────────────────────────────┤
│                                         │
│  📁 Размер файла: 150 MB               │
│     Максимум:     50 MB                │
│                                         │
│  Решение: Разбейте на части            │
│                                         │
│  Рекомендуем разделить файл на:        │
│  • sales_2026_09_part1.csv (50 MB)     │
│  • sales_2026_09_part2.csv (50 MB)     │
│  • sales_2026_09_part3.csv (50 MB)     │
│                                         │
│  Инструменты для разбиения:            │
│  • Excel: сохранить несколько файлов  │
│  • Python: pandas.read_csv(...,        │
│    chunksize=10000)                    │
│  • Linux: split command                │
│                                         │
│  [Как разбить файл?] [Попробовать снова]│
└─────────────────────────────────────────┘
```

---

### Сценарий 3: Дублирующиеся данные

**HTTP Status:** 409 Conflict

**UX Решение:**

```
┌─────────────────────────────────────────────┐
│  Найдены дублирующиеся данные             │
├─────────────────────────────────────────────┤
│                                         │
│  ⚠️ 50,000 новых строк                 │
│     2,500 строк уже в базе             │
│                                         │
│  Пересечение по полям:                 │
│  (azs_id, created_at, price_type)      │
│                                         │
│  Что делать с дубликатами?              │
│                                         │
│  [ ] Пропустить (не импортировать)    │
│  [✓] Обновить существующие             │
│  [ ] Ошибка (отменить импорт)          │
│                                         │
│  Если выбрать "Обновить":              │
│  • Старые значения будут заменены      │
│  • Изменения будут залогированы        │
│  • Это не может быть отменено           │
│                                         │
│  [Продолжить] [Отмена]                 │
└─────────────────────────────────────────────┘
```

---

# 6. Просмотр конкурентных цен

## 6.1 Отсутствие данных конкурентов (Story #7)

### Сценарий 1: Нет данных о конкурентах

**HTTP Status:** 200 OK (но данные пусты)

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Конкуренты                             │
├─────────────────────────────────────────┤
│                                         │
│  📍 Поиск конкурентов в радиусе 5 км...│
│                                         │
│  Конкурентов не найдено                 │
│                                         │
│  Возможные причины:                    │
│  • Вы единственная АЗС в этом районе   │
│  • Радиус поиска слишком мал (< 2 км)  │
│  • Соседние АЗС еще не добавлены       │
│                                         │
│  Что делать:                            │
│  1. Увеличьте радиус поиска             │
│  2. Добавьте конкурентов вручную        │
│  3. Импортируйте список конкурентов     │
│                                         │
│  Радиус поиска: 5 км [Изменить]        │
│                                         │
│  [+ Добавить конкурента вручную]        │
│  [Импортировать список]                 │
└─────────────────────────────────────────┘
```

---

### Сценарий 2: Данные конкурента устарели

**HTTP Status:** 200 OK (но с предупреждением)

**UX Решение:**

```
┌───────────────────────────────────────────────┐
│  Конкуренты                                   │
├───────────────────────────────────────────────┤
│                                         │
│  Конкурент "РОСНЕФТЬ #25"              │
│  📍 2.3 км                              │
│                                         │
│  Цена: 54.5₽                           │
│  ⚠️ Данные обновлены: 2 часа назад     │
│     (система обновляет каждые 30 мин)  │
│                                         │
│  Возможные причины:                    │
│  • API конкурента недоступен           │
│  • Ошибка синхронизации                │
│  • Проблема с интернет-соединением     │
│                                         │
│  [Обновить сейчас] [Проверить статус] │
└───────────────────────────────────────────────┘
```

---

# 7. Система рекомендаций

## 7.1 Ошибки генерации рекомендаций (Story #8)

### Сценарий 1: Недостаточно данных для рекомендации

**HTTP Status:** 200 OK (рекомендации пусты)

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Рекомендации                           │
├─────────────────────────────────────────┤
│                                         │
│  🤔 Рекомендаций нет                   │
│                                         │
│  Почему?                                │
│  Система нуждается в большем объеме     │
│  данных для надежных рекомендаций       │
│                                         │
│  Текущее состояние:                    │
│  ✓ Дней истории: 3 (минимум 7)        │
│  ✓ Цены: 4 записи (минимум 50)        │
│  ✗ Объемы продаж: нет данных           │
│  ✗ Данные конкурентов: неполные        │
│                                         │
│  План:                                  │
│  1️⃣ Подождите 4 дня (до 11 октября)   │
│  2️⃣ Загрузите данные объемов продаж   │
│  3️⃣ Добавьте конкурентов               │
│                                         │
│  Когда вернетесь - рекомендации       │
│  появятся автоматически                │
│                                         │
│  [Загрузить объемы] [Добавить конкурентов]│
└─────────────────────────────────────────┘
```

---

### Сценарий 2: Ошибка вычисления рекомендации

**HTTP Status:** 500 Internal Server Error

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Ошибка в системе рекомендаций         │
├─────────────────────────────────────────┤
│                                         │
│  ❌ Не удалось рассчитать рекомендации │
│                                         │
│  Ошибка: Некорректные данные            │
│         себестоимости                   │
│                                         │
│  Что произошло:                         │
│  Система обнаружила, что цена           │
│  себестоимости = 0₽, что невозможно    │
│                                         │
│  Требуемое действие:                    │
│  Администратор должен исправить         │
│  параметры АЗС                          │
│                                         │
│  [Отправить уведомление админу]        │
│  [Проверить параметры АЗС]              │
└─────────────────────────────────────────┘
```

---

# 8. Отслеживание результатов

## 8.1 Несоответствие между прогнозом и фактом (Story #9)

### Сценарий 1: Рекомендация не сработала как ожидалось

**Что может пойти не так:**
- Выручка упала вместо роста
- Объем упал больше, чем предполагалось
- Конкурент изменил цену после применения рекомендации

**UX Решение:**

```
┌─────────────────────────────────────────────┐
│  Результат рекомендации                    │
├─────────────────────────────────────────────┤
│                                         │
│  Правило: PRICE-001                    │
│  "Выравнивание цены"                    │
│                                         │
│  📅 Применено:  5 октября, 09:30       │
│  Цена:        55.5₽ → 54.9₽            │
│                                         │
│  📊 РЕЗУЛЬТАТ: НЕ СРАБОТАЛО             │
│                                         │
│  Прогноз:      +₽240/день              │
│  Факт:         -₽130/день (❌ -54%)    │
│  Точность:     0% (модель ошиблась)    │
│                                         │
│  Анализ что пошло не так:              │
│  ⚠️ На следующий день конкурент       │
│     "ЛУКОЙЛ" снизил цену на ₽1.5      │
│                                         │
│  ⚠️ Были автомобильные работы на      │
│     проезжей части → трафик упал      │
│     на 25%                             │
│                                         │
│  Урок:                                 │
│  Рекомендация базировалась на старых   │
│  данных конкурентов. В будущем система │
│  учтет оба фактора                     │
│                                         │
│  [Подробный анализ] [Добавить комментарий]│
└─────────────────────────────────────────────┘
```

---

# 9. Логирование и аудит

## 9.1 Ошибки логирования (Story #10)

### Сценарий 1: Логи не записались

**HTTP Status:** 500 Internal Server Error

**UX Решение:**

```
┌─────────────────────────────────────────┐
│  Предупреждение о логировании          │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ Не удалось записать лог действия   │
│                                         │
│  Ваше действие выполнено, но:          │
│  • Изменение цены: ✓ Успешно           │
│  • Запись в лог: ✗ Ошибка             │
│                                         │
│  Это влияет на аудит и историю         │
│  Администратор уведомлен и работает   │
│  над исправлением                      │
│                                         │
│  [Понял] [Контакты поддержки]          │
└─────────────────────────────────────────┘
```

**Реализация:**

```typescript
// Backend - Resilient logging
async function applyPrice(change: PriceChange) {
  // Основная операция
  await AZS.updatePrice(change.azs_id, change.newPrice);
  
  // Логирование в отдельном потоке с retry логикой
  logPriceChange(change).catch((err) => {
    // Даже если логирование не сработало, уведомляем пользователя
    // но не блокируем основную операцию
    logger.error('Logging failed:', err);
    
    // Отправляем уведомление админу
    notifyAdmins({
      level: 'warning',
      message: 'Audit logging failed for price change',
      details: change
    });
    
    // Пытаемся залогировать в резервную базу
    await fallbackAuditLog.save(change);
  });
  
  return { success: true };
}

// Функция логирования с retry
async function logPriceChange(change: PriceChange, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await AuditLog.create({
        userId: change.userId,
        action: 'PRICE_CHANGE',
        azs_id: change.azs_id,
        oldValue: change.oldPrice,
        newValue: change.newPrice,
        timestamp: new Date(),
        ip: change.ip,
        userAgent: change.userAgent
      });
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

---

# 10. Global Error Handling

## 10.1 Общие сетевые ошибки

### Таблица обработки ошибок

| HTTP | Ошибка | Сообщение пользователю | Действие | Retry |
|------|--------|----------------------|---------|-------|
| 400 | Bad Request | "Проверьте введенные данные" | Показать помощь | Нет |
| 401 | Unauthorized | "Сессия истекла. Войдите снова" | Redirect на login | Да (refresh token) |
| 403 | Forbidden | "У вас нет доступа" | Показать запрос доступа | Нет |
| 404 | Not Found | "Ресурс не найден" | Вернуться назад | Нет |
| 409 | Conflict | "Данные конфликтуют. Обновите" | Refresh + retry | Да |
| 413 | Payload Too Large | "Файл слишком большой" | Помощь по разбиению | Нет |
| 429 | Too Many Requests | "Слишком много запросов. Подождите" | Exponential backoff | Да |
| 500 | Server Error | "Ошибка сервера. Мы работаем" | Retry через 30с | Да (3x) |
| 503 | Service Unavailable | "Сервис на обслуживании" | Показать время возврата | Да (polling) |
| 504 | Gateway Timeout | "Запрос занял слишком долго" | Retry с увеличением timeout | Да (2x) |

---

## 10.2 Компонент для показа ошибок

```typescript
interface ErrorConfig {
  type: 'validation' | 'network' | 'auth' | 'permission' | 'server' | 'business';
  code: string;
  message: string;
  suggestions?: string[];
  actions?: ErrorAction[];
  retryable?: boolean;
  duration?: number; // Auto-hide after N ms
}

interface ErrorAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

function ErrorBanner({ error }: { error: ErrorConfig }) {
  const icons: Record<string, string> = {
    validation: '❌',
    network: '🔴',
    auth: '🔒',
    permission: '🚫',
    server: '⚠️',
    business: '⚠️'
  };
  
  const colors: Record<string, string> = {
    validation: '#ff6b6b',
    network: '#ff6b6b',
    auth: '#ffa500',
    permission: '#ffa500',
    server: '#ff6b6b',
    business: '#ffa500'
  };
  
  return (
    <div style={{
      backgroundColor: colors[error.type],
      color: 'white',
      padding: '16px',
      borderRadius: '4px',
      marginBottom: '16px'
    }}>
      <div style={{ fontSize: '20px', marginBottom: '8px' }}>
        {icons[error.type]} {error.message}
      </div>
      
      {error.suggestions && (
        <ul>
          {error.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      
      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
        {error.actions?.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 10.3 Retry стратегия

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Не retry для валидации и перми ошибок
      if (error.status === 400 || error.status === 403) {
        throw error;
      }
      
      // Для других ошибок - retry
      if (attempt < config.maxRetries - 1) {
        const delay = Math.min(
          config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// Использование
async function loadDashboard() {
  return retryWithBackoff(() => api.get('/dashboard'));
}
```

---

## 10.4 Notification Service

```typescript
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

class NotificationService {
  private notifications = new Map<string, Notification>();
  private observers: ((notifications: Notification[]) => void)[] = [];
  
  show(notification: Omit<Notification, 'id'>) {
    const id = uuid();
    const notif: Notification = { ...notification, id };
    
    this.notifications.set(id, notif);
    this.notifyObservers();
    
    // Auto-hide после duration
    if (notif.duration) {
      setTimeout(() => this.hide(id), notif.duration);
    }
    
    return id;
  }
  
  hide(id: string) {
    this.notifications.delete(id);
    this.notifyObservers();
  }
  
  subscribe(observer: (notifications: Notification[]) => void) {
    this.observers.push(observer);
    return () => {
      this.observers.splice(this.observers.indexOf(observer), 1);
    };
  }
  
  private notifyObservers() {
    const notifs = Array.from(this.notifications.values());
    this.observers.forEach(obs => obs(notifs));
  }
}

// Использование в компонентах
function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setNotifications);
    return unsubscribe;
  }, []);
  
  return {
    notifications,
    success: (message: string) => notificationService.show({
      type: 'success',
      message,
      duration: 3000
    }),
    error: (message: string) => notificationService.show({
      type: 'error',
      message,
      duration: 5000
    }),
    warning: (message: string) => notificationService.show({
      type: 'warning',
      message,
      duration: 4000
    })
  };
}
```

---

## Заключение

Этот документ описывает полный набор негативных сценариев и edge cases для каждой ключевой функции АЗС-Пульт. 

**Ключевые принципы обработки ошибок:**

1. **Ясность** - пользователь всегда понимает что произошло
2. **Помощь** - предложить конкретные действия для решения
3. **Resilience** - система продолжает работать даже при ошибках
4. **Logging** - все ошибки логируются для анализа
5. **Retry** - автоматические попытки для сетевых ошибок

---

**Версия:** 1.0  
**Последнее обновление:** 7 октября 2026  
**Статус:** Ready for Implementation  
**Автор:** Product Manager + AI Assistant
