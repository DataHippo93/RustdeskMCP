# ADK Sync Runner watchdog: keeps QuickBooks (ADK company) + Method Integration running. Plain PowerShell, no AI.
$ErrorActionPreference = 'SilentlyContinue'
$log = 'C:\ProgramData\ADK\watchdog.log'
$company = 'Q:\sandy maine inc (adirondack fragrance).qbw'
$qbExe = 'C:\Program Files\Intuit\QuickBooks Enterprise Solutions 24.0\QBWEnterpriseWholesale.exe'
$method = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Method\Method Integration Engine for use with QuickBooks.appref-ms'
function Log($m) { Add-Content $log ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) }
if ((Get-Item $log).Length -gt 1MB) { Move-Item $log "$log.old" -Force }
if (-not (Test-Path 'Q:\')) { net use Q: '\\QBSERVER\company files' /persistent:yes | Out-Null; Log 'remapped Q:' }
$qb = Get-Process QBW -EA 0
if (-not $qb) {
  Log 'QuickBooks not running -> starting ADK company'
  Start-Process $qbExe   # reopens the last company (Sandy Maine Inc)
  Start-Sleep 90
} elseif (-not $qb.Responding) { Log 'WARN QuickBooks not responding' }
elseif ($qb.MainWindowTitle -and $qb.MainWindowTitle -notmatch '^Sandy Maine') { Log ('WARN wrong company open for Method: ' + $qb.MainWindowTitle) }
if (-not (Get-Process MethodIntegrationQB -EA 0)) {
  Log 'Method not running -> starting'
  Start-Process $method
}
$hb = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Set-Content 'C:\ProgramData\ADK\watchdog.heartbeat' ("$hb qb=" + [bool](Get-Process QBW -EA 0) + " method=" + [bool](Get-Process MethodIntegrationQB -EA 0))
