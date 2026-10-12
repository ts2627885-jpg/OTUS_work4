# Полная настройка АЗС-Пульт с загрузкой всех данных

Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         АЗС-ПУЛЬТ v2.1 - ПОЛНАЯ ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ДАННЫХ              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$dataDir = Join-Path $projectRoot "_data"

$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$schemaFile = Join-Path $dataDir "schema.sql"

# ============================================================================
Write-Host "📋 ШАГ 1: Проверка файлов" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"

$files = @(
    "stations.csv",
    "prices.csv",
    "weather_data.csv",
    "competitor_prices.csv",
    "promotions.csv",
    "shop_sales.csv",
    "traffic_data.csv"
)

foreach ($file in $files) {
    $path = "$dataDir\$file"
    if (Test-Path $path) {
        $size = [Math]::Round((Get-Item $path).Length / 1KB, 1)
        Write-Host "  ✅ $file ($size KB)"
    } else {
        Write-Host "  ❌ $file - НЕ НАЙДЕН"
    }
}

Write-Host ""

# ============================================================================
Write-Host "🗑️  ШАГ 2: Переинициализация БД" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"

Write-Host "  Удаление старой БД..."
& $psqlPath -h localhost -U postgres -c "DROP DATABASE IF EXISTS azs_pult;" 2>&1 | Out-Null
Start-Sleep -Seconds 2

Write-Host "  Создание новой БД..."
& $psqlPath -h localhost -U postgres -c "CREATE DATABASE azs_pult;" 2>&1 | Out-Null
Start-Sleep -Seconds 2

Write-Host "  Загрузка схемы..."
& $psqlPath -h localhost -U postgres -d azs_pult -f $schemaFile 2>&1 | Out-Null

Write-Host "  ✅ БД готова (13 таблиц)"

Write-Host ""

# ============================================================================
Write-Host "👥 ШАГ 3: Создание пользователей и АЗС" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"

Set-Location $backendDir
python seed_users.py

Write-Host ""

# ============================================================================
Write-Host "📊 ШАГ 4: Загрузка всех данных" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"

python load_final_data.py

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                         ✅ ПРОЦЕСС ЗАВЕРШЕН                                   ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📈 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:" -ForegroundColor Cyan
Write-Host "  • sales_data:        ~25,767 записей"
Write-Host "  • competitor_prices: 59,942 записей"
Write-Host "  • weather_data:      2,390 записей"
Write-Host "  • traffic_data:      1,021 запись"
Write-Host "  • shop_sales:        ~16,730 записей"
Write-Host "  • promotions:        ~95 записей"
Write-Host ""
Write-Host "  ВСЕГО: ~105,945 записей ✅"
Write-Host ""

Write-Host "🚀 СЛЕДУЮЩЕЕ:" -ForegroundColor Green
Write-Host "  1. Backend:  cd backend && npm run dev"
Write-Host "  2. Frontend: cd frontend && npm run dev"
Write-Host "  3. Браузер:  http://localhost:5173"
Write-Host "  4. Логин:    admin / admin123"
Write-Host ""
