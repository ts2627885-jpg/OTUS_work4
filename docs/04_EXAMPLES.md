# АЗС-Пульт: примеры запросов

Состояние на 13.10.2026. Адрес: `http://localhost:3001/api` (замените на свой). Все примеры в формате curl; в PowerShell используйте `curl.exe` или `Invoke-RestMethod`.

Обозначения:
- `$TOKEN` — access_token из ответа входа;
- `$STATION` — id станции, например `4201e4e8-8875-45a4-9e43-65e968b59982` (АЗС 125 в тестовых данных);
- ответы показаны сокращённо.

## 1. Вход и профиль

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<пароль>"}'
```
Ответ `200`:
```json
{ "success": true, "data": { "token": { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": "24h" }, "user": { "id": "...", "username": "admin", "role": "admin" } } }
```

```bash
curl http://localhost:3001/api/auth/profile -H "Authorization: Bearer $TOKEN"
```

Регистрация (роль новых пользователей — `viewer`):
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"ivanov1","email":"ivanov@example.ru","password":"Passw0rd!"}'
```
Ответ `201` с токеном. Повторный логин `ivanov1` — `409` при повторной регистрации: `{"success":false,"error":"Логин уже занят","code":"USERNAME_EXISTS"}`.

## 2. Станции

```bash
# список (manager видит только назначенные)
curl http://localhost:3001/api/azs -H "Authorization: Bearer $TOKEN"

# одна станция
curl http://localhost:3001/api/azs/$STATION -H "Authorization: Bearer $TOKEN"

# создать (admin)
curl -X POST http://localhost:3001/api/azs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"АЗС 130","address":"Федеральная трасса, 12 км","region":"Tver region","fuelTypes":["A92","DT"],"status":"active"}'

# изменить (admin; manager — назначенную станцию)
curl -X PUT http://localhost:3001/api/azs/$STATION \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"inactive"}'

# удалить (admin; нельзя, если есть цены или продажи — 409)
curl -X DELETE http://localhost:3001/api/azs/$STATION -H "Authorization: Bearer $TOKEN"
```

Данные станции за период:
```bash
curl "http://localhost:3001/api/azs/$STATION/sales?days=30" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/azs/$STATION/traffic?days=14" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/azs/$STATION/weather?days=14" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/azs/$STATION/competitors" -H "Authorization: Bearer $TOKEN"
```

## 3. Цены и дашборд

```bash
curl http://localhost:3001/api/prices -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/dashboard?days=28" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/dashboard?days=7&date=2026-09-20" -H "Authorization: Bearer $TOKEN"
```

Ответ `dashboard`: `asOfDate`, `window`, `stations` (объём, тренды, позиция относительно конкурентов), `urgent`.

## 4. Аналитика

```bash
# вкладки: prices, competitors, traffic, factors, volume, shop, promotions
curl "http://localhost:3001/api/analytics/prices?azsId=$STATION&window=365" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/analytics/competitors?azsId=$STATION" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/analytics/promotions?promoWindow=14" -H "Authorization: Bearer $TOKEN"
```
Неизвестная вкладка → `404`, например `/api/analytics/no-such-tab`.

Правила расчёта (кэшируется по версии данных, холодный расчёт ~10 с):
```bash
curl http://localhost:3001/api/analysis/rules -H "Authorization: Bearer $TOKEN"
```

## 5. Рекомендации

```bash
# список с фильтрами
curl "http://localhost:3001/api/recommendations?status=active&priority=URGENT" -H "Authorization: Bearer $TOKEN"

# рекомендации станции
curl http://localhost:3001/api/recommendations/azs/$STATION -H "Authorization: Bearer $TOKEN"

# пересчёт по всем станциям (admin; сохраняет новые и закрывает устаревшие)
curl -X POST http://localhost:3001/api/recommendations/generate -H "Authorization: Bearer $TOKEN"
# ответ: {"success":true,"data":{"asOfDate":"...","saved":12,"closed":3, ...}}

# отметить выполненной (admin или manager своей станции)
curl -X POST http://localhost:3001/api/recommendations/<id>/complete -H "Authorization: Bearer $TOKEN"

# сверка станций из аналитики с приложением (admin)
curl http://localhost:3001/api/stations/check -H "Authorization: Bearer $TOKEN"
```

## 6. Импорт данных

```bash
# история загрузок
curl http://localhost:3001/api/import/history -H "Authorization: Bearer $TOKEN"

# сводка по датам
curl http://localhost:3001/api/import/summary -H "Authorization: Bearer $TOKEN"

# загрузка CSV (admin или manager), поле файла — file; можно несколько файлов
curl -X POST http://localhost:3001/api/import/csv -H "Authorization: Bearer $TOKEN" \
  -F "file=@_data/_BD/pipeline/data/weather_data.csv"
```

Ответ: результат по каждому файлу. Неизвестный формат — не ошибка запроса, а `ok:false` у файла:
```json
{ "success": true, "data": { "files": [ { "fileName": "unknown.csv", "ok": false, "error": "Тип файла не распознан по заголовкам" } ] } }
```

## 7. Администрирование (только admin)

```bash
# пользователи
curl http://localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN"

# создать пользователя
curl -X POST http://localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"username":"analyst2","email":"analyst2@example.ru","password":"Analyst2!pass","role":"analyst"}'

# сменить роль
curl -X PUT http://localhost:3001/api/admin/users/<id> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"manager"}'

# назначить станции менеджеру (заменяет список целиком)
curl -X PUT http://localhost:3001/api/admin/users/<id>/azs -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"azsIds":["4201e4e8-8875-45a4-9e43-65e968b59982"]}'

# настройки расчёта правил
curl http://localhost:3001/api/admin/settings -H "Authorization: Bearer $TOKEN"
curl -X PUT http://localhost:3001/api/admin/settings -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"price_window_days":30,"comp_window_days":14,"elasticity_days":365,"r2_min":0.36}'

# журналы
curl "http://localhost:3001/api/admin/logs/audit?limit=20" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3001/api/admin/logs/login?limit=20" -H "Authorization: Bearer $TOKEN"

# резервная копия (admin): файл в backend/backups
curl -X POST http://localhost:3001/api/admin/backup -H "Authorization: Bearer $TOKEN"

# план теста цен: черновик (admin, заменяет прежние черновики), просмотр
curl -X POST http://localhost:3001/api/admin/price-test/draft -H "Authorization: Bearer $TOKEN"
curl http://localhost:3001/api/admin/price-test -H "Authorization: Bearer $TOKEN"
```

## 8. Ошибки: что ожидать

| Ситуация | Запрос | Ответ |
|---|---|---|
| нет токена | `GET /api/azs` | `401` `{"success":false,"error":"Missing authorization token","code":"AUTHENTICATION_ERROR"}` |
| неверный пароль | `POST /api/auth/login` | `401` `{"success":false,"error":"Invalid credentials",...}` |
| нет прав (viewer создаёт станцию) | `POST /api/azs` | `403` |
| станция не найдена или нет доступа (manager) | `GET /api/azs/<id>` | `404` `{"success":false,"error":"Not found"}` |
| короткое название станции | `POST /api/azs` с `"name":"x"` | `400` с текстом валидации |
| некорректный JSON | `POST /api/auth/login` с телом `{"username":` | `400` `{"error":"Некорректный JSON в запросе","code":"BAD_REQUEST"}` |
| повторная регистрация | `POST /api/auth/register` | `409` `{"error":"Логин уже занят","code":"USERNAME_EXISTS"}` |
| неизвестный маршрут | `GET /api/no-such-route` | `404` в JSON |
| ошибка сервера или базы | любой | `500` `{"error":"Internal server error","code":"INTERNAL_ERROR"}`; подробности в журнале |

## 9. Скрипты проверки

```bash
# все эндпоинты по ролям и ошибкам (только чтение и отказы; создаёт и удаляет тестовую станцию)
ADMIN_PASSWORD=... MANAGER_PASSWORD=... ANALYST_PASSWORD=... VIEWER_PASSWORD=... node scripts/api-test.mjs

# записи (пересчёт, импорт, настройки, резервные копии): только тестовый бэкенд на localhost:3005
ADMIN_PASSWORD=... MANAGER_PASSWORD=... API_BASE=http://localhost:3005/api node scripts/api-write-test.mjs

# сводка по журналам за сутки
node scripts/analyze-logs.mjs --hours=24
```
