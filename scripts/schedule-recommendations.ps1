# Регистрирует ежедневный пересчёт рекомендаций в Планировщике заданий Windows.
# Запуск от имени администратора: powershell -ExecutionPolicy Bypass -File scripts\schedule-recommendations.ps1
# Скрипт НЕ запускается автоматически: создание задания — изменение системы, выполните вручную.
param(
  [string]$Time = '03:00',
  [string]$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot '..\backend')).Path
)

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c npm run recommendations:generate" -WorkingDirectory $ProjectDir
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'AZS-Pult recommendations' -Action $action -Trigger $trigger -Settings $settings -Description 'Ежедневный пересчёт рекомендаций АЗС-Пульт' -Force
Write-Output "Задание создано: ежедневно в $Time, каталог $ProjectDir"
