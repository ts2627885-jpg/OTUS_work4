# 🚀 АЗС-Пульт v2.1 - Руководство установки

## Быстрый старт (5 минут)

### 1️⃣ Вариант A: Автоматическая установка (рекомендуется)

```powershell
cd "C:\Users\user\Desktop\otus\_project\_prog_5\azs_pult_new9\azs-pult-fullstack"
.\SETUP_COMPLETE.ps1
```

Скрипт автоматически:
- Пересоздает БД
- Создает пользователей и АЗС
- Загружает все 84,033 записей

---

### 2️⃣ Вариант B: Ручная установка (пошагово)

#### Шаг 1: Пересоздать БД
```powershell
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

# Удалить старую БД
& $psqlPath -h localhost -U postgres -c "DROP DATABASE IF EXISTS azs_pult;"

# Создать новую БД
& $psqlPath -h localhost -U postgres -c "CREATE DATABASE azs_pult;"

# Загрузить схему
& $psqlPath -h localhost -U postgres -d azs_pult -f "_data\schema.sql"
```

#### Шаг 2: Создать пользователей и АЗС
```powershell
cd backend
python seed_users.py
```

#### Шаг 3: Загрузить все данные
```powershell
python load_final_data.py
```

#### Шаг 4: Запустить приложение
```powershell
# В первом терминале
cd backend
npm run dev

# Во втором терминале
cd frontend
npm run dev
```

---

## 📊 Что загружается

### Таблицы и данные

| Таблица | Записей | Файл | Статус |
|---------|---------|------|--------|
| users | 4 | - | ✅ Создается |
| azs | 5 | stations.csv | ✅ Создается |
| prices | 21 | prices.csv | ✅ Загружается |
| sales_data | 25,767 | prices.csv | ✅ Загружается |
| weather_data | 2,390 | weather_data.csv | ✅ Загружается |
| competitor_prices | 54,690 | competitor_prices.csv | ✅ Загружается |
| promotions | 95 | promotions.csv | ✅ Загружается |
| shop_sales | 35 | shop_sales.csv | ✅ Загружается |
| traffic_data | 1,021 | traffic_data.csv | ✅ Загружается |
| **ВСЕГО** | **84,033** | | ✅ **ГОТОВО** |

---

## 👥 Тестовые учетные данные

```
Username  Password      Role
─────────────────────────────
admin     <ADMIN_PASSWORD>      Администратор
manager   <MANAGER_PASSWORD>    Менеджер
analyst   <ANALYST_PASSWORD>    Аналитик
viewer    <VIEWER_PASSWORD>     Зритель
```

---

## 🌍 АЗС станции

```
1. АЗС 172       - A92, A95, DT
2. АЗС 173       - A92, A95, DT, SUG
3. АЗС 603       - A92, A95, DT, KPG
4. АЗС 604       - A92, A95, DT
```

---

## 🛠️ Структура проекта

```
azs-pult-fullstack/
├── backend/
│   ├── load_final_data.py       ← Загрузка всех данных
│   ├── seed_users.py            ← Создание пользователей
│   ├── load_remaining.py        ← Проверка файлов
│   ├── load_everything.py       ← Альтернативный загрузчик
│   ├── npm run dev              ← Запуск backend
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── routes/
│       └── server.ts
│
├── frontend/
│   ├── src/
│   │   ├── stores/
│   │   ├── api/
│   │   ├── views/
│   │   └── components/
│   └── npm run dev              ← Запуск frontend
│
├── _data/
│   ├── schema.sql               ← Полная схема БД
│   ├── stations.csv             (5 АЗС)
│   ├── prices.csv               (2,390 записей)
│   ├── weather_data.csv         (2,390 записей)
│   ├── competitor_prices.csv    (59,941 записей)
│   ├── promotions.csv           (95 записей)
│   ├── shop_sales.csv           (35 записей)
│   └── traffic_data.csv         (1,021 запись)
│
├── SETUP_COMPLETE.ps1           ← Автоматическая установка
├── SETUP_GUIDE.md               ← Это руководство
├── FINAL_STATUS.md              ← Статус проекта
└── README.md                    ← Основное описание
```

---

## 🔍 Проверка

После установки проверьте:

```sql
-- Подключитесь к БД
psql -h localhost -U postgres -d azs_pult

-- Проверьте таблицы
\dt

-- Проверьте количество записей
SELECT COUNT(*) FROM sales_data;        -- 25,767
SELECT COUNT(*) FROM competitor_prices; -- 54,690
SELECT COUNT(*) FROM weather_data;      -- 2,390
SELECT COUNT(*) FROM promotions;        -- 95
SELECT COUNT(*) FROM shop_sales;        -- 35
SELECT COUNT(*) FROM traffic_data;      -- 1,021

-- Список пользователей
SELECT username, role FROM users;

-- Список АЗС
SELECT name, city FROM azs;
```

---

## 🌐 Доступ к приложению

```
Frontend: http://localhost:5173
Backend:  http://localhost:3001

API Endpoints:
  POST   /api/auth/login         - Вход
  GET    /api/auth/me            - Текущий пользователь
  GET    /api/azs                - Список АЗС
  GET    /api/prices             - Текущие цены
  GET    /api/sales              - Данные о продажах
  GET    /api/weather            - Данные о погоде
  GET    /api/competitors        - Цены конкурентов
```

---

## 📅 Период данных

```
Начало: 01.06.2025  (1 июня 2025)
Конец:  21.09.2026  (21 сентября 2026)
Период: 15 месяцев
Дней:   483 дня
```

---

## 🎯 Ожидаемый результат

После запуска скрипта установки вы получите:

✅ Полная схема БД с 13 таблицами
✅ 4 тестовых пользователя с разными ролями
✅ 5 реальных АЗС станций
✅ 84,033 записей исторических данных
✅ Все индексы для оптимизации
✅ Аналитические представления (views)
✅ Функции для аудита и истории изменений

---

## 🚨 Решение проблем

### PostgreSQL не запущен
```powershell
# Windows
Get-Service postgresql-x64-16 | Start-Service

# Или запустить из SQL Shell
psql -h localhost -U postgres
```

### БД не пересоздается
```powershell
# Закройте все подключения и попробуйте снова
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psqlPath -h localhost -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'azs_pult';"
```

### Python модули не установлены
```powershell
pip install psycopg2-binary python-dotenv bcrypt
```

---

**Версия:** 2.1.0
**Дата:** 08.10.2026
**Статус:** ✅ Готово к использованию
