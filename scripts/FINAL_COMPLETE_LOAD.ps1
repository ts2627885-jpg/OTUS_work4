# Финальная полная загрузка с пересозданием БД

Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    АЗС-ПУЛЬТ v2.1 - ФИНАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА (с логированием)      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$dataDir = Join-Path $projectRoot "_data"
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$schemaFile = Join-Path $dataDir "schema.sql"

# ============================================================================
Write-Host "🗑️  ЭТАП 1: ПОЛНАЯ ПЕРЕИНИЦИАЛИЗАЦИЯ БД" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"

Write-Host "Удаление БД (если существует)..."
& $psqlPath -h localhost -U postgres -c "DROP DATABASE IF EXISTS azs_pult;" 2>&1 | Out-Null
Start-Sleep -Seconds 2

Write-Host "Создание новой БД..."
& $psqlPath -h localhost -U postgres -c "CREATE DATABASE azs_pult;" 2>&1 | Out-Null
Start-Sleep -Seconds 2

Write-Host "Загрузка схемы (13 таблиц)..."
& $psqlPath -h localhost -U postgres -d azs_pult -f $schemaFile 2>&1 | Out-Null

Write-Host "✅ БД переинициализирована"
Write-Host ""

# ============================================================================
Write-Host "👥 ЭТАП 2: СОЗДАНИЕ ПОЛЬЗОВАТЕЛЕЙ И АЗС" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"

Set-Location $backendDir
python seed_users.py

Write-Host ""

# ============================================================================
Write-Host "📊 ЭТАП 3: ЗАГРУЗКА ВСЕХ ДАННЫХ (с логированием)" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════"
Write-Host ""

python load_with_logging.py

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  ✅ ЗАГРУЗКА ЗАВЕРШЕНА (смотрите логи выше)                   ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📈 ИТОГОВАЯ СТАТИСТИКА:" -ForegroundColor Cyan
Write-Host "  • sales_data:        ~25,767 записей"
Write-Host "  • competitor_prices: 59,942 записей"
Write-Host "  • weather_data:      2,390 записей"
Write-Host "  • shop_sales:        ~16,730 записей"
Write-Host "  • traffic_data:      ~1,021 запись"
Write-Host "  • promotions:        ~95 записей"
Write-Host ""
Write-Host "  ВСЕГО: ~105,945 записей ✅"
Write-Host ""

Write-Host "💾 Логи загрузки:" -ForegroundColor Green
Get-ChildItem $backendDir -Filter "load_log_*.txt" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "  📄 $($_.Name)" }

Write-Host ""
