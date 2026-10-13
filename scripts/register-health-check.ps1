# Регистрирует задание Планировщика заданий: проверка АЗС-Пульта каждые 5 минут.
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\register-health-check.ps1
# Удалить задание: schtasks /Delete /TN "AZS-Pult-Health" /F

$taskName = 'AZS-Pult-Health'
$script = Join-Path $PSScriptRoot 'db-health-check.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Проверка бэкенда и базы АЗС-Пульт, перезапуск бэкенда при падении' -Force | Out-Null
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State | Format-Table -AutoSize | Out-String
