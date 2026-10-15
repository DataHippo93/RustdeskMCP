# Restart the RustDeskMCP UI process (the one serving 127.0.0.1:59940) when a session goes stale after a remote reboot.
$p = (Get-NetTCPConnection -LocalPort 59940 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($p) { Stop-Process -Id $p -Force; Start-Sleep 2 }
foreach ($n in 'RUSTDESK_MCP_TOKEN','RUSTDESK_MCP_AUTH','RUSTDESK_MCP_ALLOWED_IDS') {
  [Environment]::SetEnvironmentVariable($n, [Environment]::GetEnvironmentVariable($n,'User'), 'Process') }
Start-Process 'C:\Program Files\RustDeskMCP\RustDeskMCP.exe'
Start-Sleep 12
"listening pid: " + (Get-NetTCPConnection -LocalPort 59940 -State Listen -ErrorAction SilentlyContinue).OwningProcess
