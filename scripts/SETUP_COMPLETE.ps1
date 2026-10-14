# =====================================================
# АЗС-Пульт v2.1 - Полная установка и загрузка данных
# =====================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$dataDir = Join-Path $projectRoot "_data"
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

# Database credentials
$dbHost = "localhost"
$dbPort = "5432"
$dbUser = "postgres"
$dbPassword = $env:DB_PASSWORD
if (-not $dbPassword) { Write-Error "Задайте переменную DB_PASSWORD"; exit 1 }
$dbName = "azs_pult"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "АЗС-Пульт v2.1 - ПОЛНАЯ УСТАНОВКА И ЗАГРУЗКА ДАННЫХ" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Step 1: Drop and recreate database
Write-Host "[1/4] 🗑️  Пересоздание базы данных..." -ForegroundColor Yellow
Write-Host ""

Write-Host "    ⏳ Удаление БД (если существует)..."
& $psqlPath -h $dbHost -U $dbUser -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null

Write-Host "    ⏳ Создание новой БД..."
& $psqlPath -h $dbHost -U $dbUser -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null

Write-Host "    ⏳ Загрузка схемы..."
$schemaFile = Join-Path $dataDir "schema.sql"
& $psqlPath -h $dbHost -U $dbUser -d $dbName -f $schemaFile 2>&1 | Out-Null

Write-Host "    ✅ БД готова" -ForegroundColor Green
Write-Host ""

# Step 2: Create test users and stations
Write-Host "[2/4] 👥 Создание пользователей и АЗС станций..." -ForegroundColor Yellow
Write-Host ""

Set-Location $backendDir
python seed_users.py

Write-Host ""

# Step 3: Load all data
Write-Host "[3/4] 📊 Загрузка всех данных..." -ForegroundColor Yellow
Write-Host ""

python load_final_data.py

Write-Host ""

# Step 4: Verify
Write-Host "[4/4] ✓ Проверка результатов..." -ForegroundColor Yellow
Write-Host ""

$result = & $psqlPath -h $dbHost -U $dbUser -d $dbName -c @"
SELECT
  'Users' as table_name, COUNT(*) as count FROM users UNION ALL
SELECT 'AZS Stations', COUNT(*) FROM azs UNION ALL
SELECT 'Prices', COUNT(*) FROM prices UNION ALL
SELECT 'Sales Data', COUNT(*) FROM sales_data UNION ALL
SELECT 'Weather Data', COUNT(*) FROM weather_data UNION ALL
SELECT 'Competitor Prices', COUNT(*) FROM competitor_prices UNION ALL
SELECT 'Promotions', COUNT(*) FROM promotions UNION ALL
SELECT 'Shop Sales', COUNT(*) FROM shop_sales UNION ALL
SELECT 'Traffic Data', COUNT(*) FROM traffic_data
ORDER BY table_name;
"@ 2>&1

Write-Host $result

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ УСТАНОВКА ЗАВЕРШЕНА" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 ТЕСТОВЫЕ ПОЛЬЗОВАТЕЛИ:" -ForegroundColor Cyan
Write-Host "  admin    : <ADMIN_PASSWORD>    (Администратор)"
Write-Host "  manager  : <MANAGER_PASSWORD>  (Менеджер)"
Write-Host "  analyst  : <ANALYST_PASSWORD>  (Аналитик)"
Write-Host "  viewer   : <VIEWER_PASSWORD>   (Зритель)"
Write-Host ""

Write-Host "🚀 ЗАПУСК ПРИЛОЖЕНИЯ:" -ForegroundColor Cyan
Write-Host "  Backend:  cd backend && npm run dev"
Write-Host "  Frontend: cd frontend && npm run dev"
Write-Host ""
