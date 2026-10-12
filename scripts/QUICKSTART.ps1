# Быстрый старт за 2 минуты

Write-Host "🚀 АЗС-Пульт v2.1 - Быстрый старт" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

# Меню
Write-Host "Выберите вариант:" -ForegroundColor Yellow
Write-Host "1. Полная установка (пересоздать БД + загрузить данные)"
Write-Host "2. Только загрузить данные (БД уже создана)"
Write-Host "3. Запустить backend"
Write-Host "4. Запустить frontend"
Write-Host "5. Запустить оба (backend + frontend)"
Write-Host ""

$choice = Read-Host "Введите номер (1-5)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "⏳ Полная установка..." -ForegroundColor Yellow
        & "$PSScriptRoot\SETUP_COMPLETE.ps1"
    }
    "2" {
        Write-Host ""
        Write-Host "⏳ Загрузка данных..." -ForegroundColor Yellow
        Set-Location $backend
        python load_final_data.py
    }
    "3" {
        Write-Host ""
        Write-Host "⏳ Запуск backend на http://localhost:3001..." -ForegroundColor Yellow
        Set-Location $backend
        npm run dev
    }
    "4" {
        Write-Host ""
        Write-Host "⏳ Запуск frontend на http://localhost:5173..." -ForegroundColor Yellow
        Set-Location "$root\frontend"
        npm run dev
    }
    "5" {
        Write-Host ""
        Write-Host "⏳ Запуск backend и frontend..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Backend:"
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit -Command `"Set-Location '$backend'; npm run dev`""
        Start-Sleep -Seconds 2
        Write-Host "Frontend:"
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit -Command `"Set-Location '$root\frontend'; npm run dev`""
        Write-Host ""
        Write-Host "✅ Оба процесса запущены в отдельных окнах"
        Write-Host ""
        Write-Host "Frontend: http://localhost:5173"
        Write-Host "Backend:  http://localhost:3001"
    }
    default {
        Write-Host "❌ Неверный выбор" -ForegroundColor Red
    }
}
