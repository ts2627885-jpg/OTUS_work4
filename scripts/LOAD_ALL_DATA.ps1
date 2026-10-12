# Полная загрузка ВСЕх данных

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "АЗС-ПУЛЬТ v2.1 - ПОЛНАЯ ЗАГРУЗКА ВСЕХ ДАННЫХ" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$dataDir = Join-Path $projectRoot "_data"

# PostgreSQL paths
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$schemaFile = Join-Path $dataDir "schema.sql"

# Database credentials
$dbHost = "localhost"
$dbPort = "5432"
$dbUser = "postgres"
$dbPassword = $env:DB_PASSWORD
if (-not $dbPassword) { Write-Error "Задайте переменную DB_PASSWORD"; exit 1 }
$dbName = "azs_pult"

# Step 1: Recreate database
Write-Host "ЭТАП 1: Переинициализация базы данных" -ForegroundColor Yellow
Write-Host ""

Write-Host "  1.1 Удаление старой БД..."
& $psqlPath -h $dbHost -U $dbUser -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null
Write-Host "      ✅ Удалено"

Write-Host "  1.2 Создание новой БД..."
& $psqlPath -h $dbHost -U $dbUser -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
Write-Host "      ✅ Создано"

Write-Host "  1.3 Загрузка расширенной схемы..."
& $psqlPath -h $dbHost -U $dbUser -d $dbName -f $schemaFile 2>&1 | Out-Null
Write-Host "      ✅ Загружена"
Write-Host ""

# Step 2: Create test users and AZS stations
Write-Host "ЭТАП 2: Создание пользователей и АЗС" -ForegroundColor Yellow
Write-Host ""

Set-Location $backendDir
python seed_users.py

Write-Host ""

# Step 3: Load ALL data
Write-Host "ЭТАП 3: Загрузка всех данных" -ForegroundColor Yellow
Write-Host ""

python load_final_data.py

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Green
Write-Host "✅ ЗАГРУЗКА ЗАВЕРШЕНА" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Green
Write-Host ""

Write-Host "📊 СТАТИСТИКА ОЖИДАЕМЫХ ДАННЫХ:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  sales_data:        25,767+ записей"
Write-Host "  competitor_prices: 59,942 записей ✅"
Write-Host "  weather_data:      2,390 записей"
Write-Host "  traffic_data:      1,021 запись"
Write-Host "  promotions:        95+ записей"
Write-Host "  shop_sales:        16,730 записей"
Write-Host ""
Write-Host "  ВСЕГО: ~105,945 записей"
Write-Host ""

Write-Host "🎯 СЛЕДУЮЩИЕ ШАГИ:" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Backend:  cd backend && npm run dev"
Write-Host "  2. Frontend: cd frontend && npm run dev"
Write-Host "  3. Открыть: http://localhost:5173"
Write-Host "  4. Логин:   admin / admin123"
Write-Host ""
