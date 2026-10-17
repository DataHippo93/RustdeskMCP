# ADK Sync Runner watchdog v2: keeps QuickBooks (ADK company) + Method Integration running. Plain PowerShell, no AI.
# v2 (2026-10-16): opens the ADK company file by path (QBLaunch) instead of "last company", and if another
# company (or no company) stays open for 2 checks while nobody has touched the machine for 15 min, it closes
# QuickBooks gracefully and reopens the ADK file. At most one reopen attempt per 30 min. Never force-kills QuickBooks.
$ErrorActionPreference = 'SilentlyContinue'
$dir = 'C:\ProgramData\ADK'
$log = "$dir\watchdog.log"
$state = "$dir\watchdog.state"
$company = 'Q:\sandy maine inc (adirondack fragrance).qbw'
$launch = 'C:\Program Files\Common Files\Intuit\QuickBooks\QBLaunch.exe'
$method = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Method\Method Integration Engine for use with QuickBooks.appref-ms'
function Log($m) { Add-Content $log ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) }
function IdleMin {
  if (-not ('ADKIdle' -as [type])) {
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class ADKIdle { [StructLayout(LayoutKind.Sequential)] struct LII { public uint cbSize; public uint dwTime; } [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LII p); public static double Minutes() { LII l = new LII(); l.cbSize = 8; GetLastInputInfo(ref l); return ((uint)Environment.TickCount - l.dwTime) / 60000.0; } }'
  }
  [ADKIdle]::Minutes()
}
function OpenAdk { Start-Process $launch -ArgumentList ('"' + $company + '"'); Start-Sleep 90 }
if ((Get-Item $log).Length -gt 1MB) { Move-Item $log "$log.old" -Force }
if (-not (Test-Path 'Q:\')) { net use Q: '\\QBSERVER\company files' /persistent:yes | Out-Null; Log 'remapped Q:' }

# state: "<consecutive wrong-company checks> <last reopen attempt yyyy-MM-ddTHH:mm:ss>"
$s = ((Get-Content $state) -join ' ').Split(' ')
$wrong = [int]$s[0]
$last = [datetime]::MinValue; if ($s.Count -gt 1) { [void][datetime]::TryParse($s[1], [ref]$last) }

$qb = Get-Process QBW -EA 0 | Select-Object -First 1
if (-not $qb) {
  Log 'QuickBooks not running -> opening ADK company file'
  OpenAdk; $wrong = 0; $last = Get-Date
} elseif (-not $qb.Responding) {
  Log 'WARN QuickBooks not responding'
} elseif ($qb.MainWindowTitle -and $qb.MainWindowTitle -notmatch '^Sandy Maine') {
  $wrong++
  $idle = IdleMin
  Log ("WARN wrong company open for Method (check {0}, idle {1:N0} min): {2}" -f $wrong, $idle, $qb.MainWindowTitle)
  if ($wrong -ge 2 -and $idle -ge 15 -and ((Get-Date) - $last).TotalMinutes -ge 30) {
    $last = Get-Date
    Log 'closing QuickBooks gracefully to reopen ADK company'
    [void]$qb.CloseMainWindow()
    if ($qb.WaitForExit(60000)) {
      Start-Sleep 5
      OpenAdk
      $t = (Get-Process QBW -EA 0 | Select-Object -First 1).MainWindowTitle
      Log ('reopened, title now: ' + $t)
      if ($t -match '^Sandy Maine') { $wrong = 0 }
    } else {
      Log 'WARN QuickBooks did not close (dialog open?); left it running'
    }
  }
} elseif ($qb.MainWindowTitle) { $wrong = 0 }

if (-not (Get-Process MethodIntegrationQB -EA 0)) {
  Log 'Method not running -> starting'
  Start-Process $method
}
Set-Content $state ("{0} {1:yyyy-MM-ddTHH:mm:ss}" -f $wrong, $last)
$hb = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Set-Content "$dir\watchdog.heartbeat" ("$hb qb=" + [bool](Get-Process QBW -EA 0) + " method=" + [bool](Get-Process MethodIntegrationQB -EA 0))
