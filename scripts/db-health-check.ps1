# Проверка доступности АЗС-Пульт: бэкенд (3001), сеть до базы, SQL-запрос к базе.
# Если бэкенд не отвечает, перезапускает его (npm run dev из папки backend).
# Запускается Планировщиком заданий, см. scripts/register-health-check.ps1.
# Пароли из переменных окружения пользователя (DB_*) в лог не пишутся.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$logDir = Join-Path $env:LOCALAPPDATA 'azs-pult'
$log = Join-Path $logDir 'health.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Log([string]$message) {
  $line = '{0} {1}' -f (Get-Date -Format 's'), $message
  Add-Content -Path $log -Value $line -Encoding utf8
}

# Ограничиваем размер лога, чтобы он не рос бесконечно
if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) {
  Move-Item -Force $log "$log.old"
}

# 1. Бэкенд
$backendOk = $false
try {
  $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3001/api/health' -TimeoutSec 5
  $backendOk = ($r.StatusCode -eq 200)
} catch { $backendOk = $false }

# 2. Сеть до базы (порт пулера Supabase из DB_HOST / DB_PORT)
$dbHost = [Environment]::GetEnvironmentVariable('DB_HOST', 'User')
$dbPort = [Environment]::GetEnvironmentVariable('DB_PORT', 'User')
$netOk = $false
if ($dbHost) {
  $t = Test-NetConnection -ComputerName $dbHost -Port ([int]$dbPort) -WarningAction SilentlyContinue
  $netOk = [bool]$t.TcpTestSucceeded
}

# 3. SQL-запрос к базе через psql (с ограничением по времени)
$sqlOk = $false
if ($netOk -and (Test-Path $psql)) {
  $url = [Environment]::GetEnvironmentVariable('SUPABASE_DB_URL', 'User')
  if ($url) {
    $env:PGCONNECT_TIMEOUT = '20'
    $p = Start-Process -FilePath $psql -ArgumentList @($url, '-X', '-q', '-tA', '-c', 'select 1') -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\hc_out.txt" -RedirectStandardError "$env:TEMP\hc_err.txt"
    if ($p.WaitForExit(40000)) { $sqlOk = ($p.ExitCode -eq 0) } else { $p.Kill() }
  }
}

Write-Log ("backend={0} network={1} sql={2}" -f $(if ($backendOk) {'ok'} else {'DOWN'}), $(if ($netOk) {'ok'} else {'DOWN'}), $(if ($sqlOk) {'ok'} else {'FAIL'}))

# 4. Перезапуск бэкенда, если он не отвечает (и база при этом доступна по сети)
if (-not $backendOk) {
  if (-not $netOk) {
    Write-Log 'backend down, database network unreachable: restart skipped'
    exit 0
  }
  Write-Log 'backend down: restarting'
  Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object {
    & taskkill /PID $_.OwningProcess /T /F 2>&1 | Out-Null
  }
  Start-Sleep -Seconds 3
  $env:PORT = '3001'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $backend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') -RedirectStandardError (Join-Path $logDir 'backend.err.log') | Out-Null
  Start-Sleep -Seconds 20
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3001/api/health' -TimeoutSec 5
    Write-Log ("restart result: health={0}" -f $r.StatusCode)
  } catch {
    Write-Log 'restart result: health still failing'
  }
}
