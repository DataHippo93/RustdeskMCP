# RustDeskMCP for QBSERVER (ADK fork)

Hardened build of RustDeskMCP. Claude drives QBSERVER (and Sync Runner) through a RustDesk session from Clark's PC (CLARK-MAINGEAR). The remote machines run stock RustDesk only. Nothing AI-related is installed on them.

## Machines
| Machine | RustDesk ID |
|---|---|
| QBSERVER | 427551931 |
| Sync Runner | 323508260 |

## Changes from upstream (src/agent_bridge.rs)
- Bearer token required on every request (`RUSTDESK_MCP_TOKEN`, 24+ chars). No token set = server refuses everything.
- Requests with an `Origin` header are refused (blocks any website in a browser from driving the session).
- `Host` must be 127.0.0.1 / localhost (blocks DNS rebinding).
- CORS `*` headers removed. Body capped at 1 MB.
- Only RustDesk IDs in `RUSTDESK_MCP_ALLOWED_IDS` (comma separated) can be opened.

Verified 2026-10-15 on CLARK-MAINGEAR: live desktop frames pulled from QBSERVER (1680x1050) and Sync Runner (1366x768) with saved passwords; no/wrong token 401, Origin 403, bad Host 403, non-allowlisted ID refused, 13 tools listed with valid token.

## Build
GitHub > Actions > "Windows RustDeskMCP build (ADK)" > Run workflow (about 50 min cold). Artifact `RustDeskMCP-windows-x64` (unsigned).

## Install on Clark's PC (as installed 2026-10-15)
- App: `C:\RustDeskMCP\app\RustDeskMCP.exe` (portable; own config in `%APPDATA%\RustDeskMCP`, separate from stock RustDesk).
- Starts at logon: shortcut in the user Startup folder.
- MCP option: `enable-mcp-server = 'Y'` in `%APPDATA%\RustDeskMCP\config\RustDeskMCP_local.toml`.
- User env vars: `RUSTDESK_MCP_TOKEN` (generated locally, 48 chars), `RUSTDESK_MCP_AUTH` (`Bearer <token>`), `RUSTDESK_MCP_ALLOWED_IDS=427551931,323508260`.
- Bridge: mcp-remote 0.14.3 pinned in `C:\RustDeskMCP\mcp-remote` (no npx fetch at launch). 0.1.x does NOT work: it rejects protocol 2025-11-25.
- Launcher `C:\RustDeskMCP\launch-mcp.js` (copy in `tools/launch-mcp.js`) reads `RUSTDESK_MCP_AUTH` from HKCU\Environment, so it works however Claude desktop was started. Token never sits in the config file.
- Claude desktop config entry:
```json
"rustdesk": { "command": "node", "args": ["C:\\RustDeskMCP\\launch-mcp.js"] }
```
- If the `rustdesk` tools don't show up: fully quit Claude desktop from the tray and reopen (it gives up after 3 failed starts).

## One-time password setup
Open RustDeskMCP by hand, connect to each ID, type the password (BWS `QBSERVER_AND_SYNC_RUNNER_RUSTDESK_PWD`), tick **Remember password**. After that, sessions open without a password and it never passes through Claude. If the remote password changes, repeat this.

## Rotating the token
Regenerate `RUSTDESK_MCP_TOKEN` and `RUSTDESK_MCP_AUTH`, then restart RustDeskMCP and Claude desktop.

## On the remote machines
Stock RustDesk, permanent password, start with Windows, never sleep, stay signed in.

## Incident 2026-10-14/15: Method sync down, ghost tray icons on Sync Runner
Root cause: QBSERVER has three adapters. The Panini mIDeal check scanner's USB network adapter (192.168.4.171) had the same metric as the LAN NIC (NIC2, 192.168.250.48), so QuickBooks wrote `ServerIp=192.168.4.171` into the company files' `.ND` files. Sync Runner (192.168.250.236) cannot reach 192.168.4.x, so QuickBooks there could not open company files, Method retried every minute and each failed engine launch left a dead tray icon. QuickBooks on QBSERVER also crashed 10/14 6:47 PM.

Fixes applied:
- QBSERVER: NIC2 metric 10, Panini adapter metric 900 and DNS registration off. Re-applied at startup and hourly by SYSTEM task `ADK QB NIC priority` (`C:\ProgramData\ADK\qb-nic-priority.ps1`). `QuickBooksDB34` set to Automatic (was Manual) and restarted. DB server listens on dynamic port 64792 (not 5537x); 8019 is QBCFMonitor.
- `.ND` files are rewritten by whichever QuickBooks client opens the file first. A QuickBooks session open since before a NIC change keeps advertising the old address; close it and reopen.
- Sync Runner: timezone fixed (was Pacific). Watchdog task `ADK Sync Runner watchdog` (every 5 min + at logon, `C:\ProgramData\ADK\sr-watchdog.ps1`, copy in `tools/sr-watchdog.ps1`) reopens QuickBooks (last company, Sandy Maine Inc) and Method if either stops, logs to `C:\ProgramData\ADK\watchdog.log`, heartbeat in `watchdog.heartbeat`.
- Method (adkfragrancefarm account) syncs the **Sandy Maine Inc** file, not YC Works. It must stay open on Sync Runner.
- Ghost icons: cleared by restarting Explorer. They only build up when Method loops on QuickBooks failures.

Monitoring: Cowork scheduled task "QB machines watch (Sync Runner + QBSERVER)" every 2 h 6:57 AM to 8:57 PM ET, runs `tools/sr-health.txt` through `rdterm.js` on Clark's PC. It may restart Explorer and the watchdog on Sync Runner; it never touches QBSERVER services or QuickBooks.

Known gaps: Sync Runner `AutoAdminLogon=0`, so after a reboot nothing runs until someone signs in. RustDesk terminal does not open on QBSERVER (desktop works); use Win+R PowerShell there.

## QBSERVER: Web Connector under its own Windows user (2026-10-15)
QBSERVER now auto signs in a dedicated local user `qbsync` at boot (Sysinternals Autologon, password in BWS `QBSERVER_QBSYNC_WINDOWS_PWD`), locks it, and runs the Web Connector and the `QBWC Watchdog` there. Administrator's session no longer starts the Web Connector, so people can use QuickBooks as Administrator while syncs run. Full setup and undo: `yc-qb-web-connector` `docs/unattended-mode-setup.md`, "How QBSERVER is actually set up".

What this changes for remote work:
- After a reboot RustDesk shows the console session, which is qbsync's (locked). Unlock with the qbsync password via `rdact.js` `typeEnv`, never by typing it in a command line.
- To work as Administrator, sign in as Administrator from the lock screen ("Other user"); qbsync's session keeps running in the background. Do not sign qbsync out.
- A Windows update reboot can take 30+ minutes and reboots twice on Server 2016.

## When a session goes stale
After the remote machine reboots, RustDeskMCP can keep serving the last frame ("Restarting") and terminal sessions return nothing. Restart the RustDeskMCP UI process on Clark's PC with `C:\RustDeskMCP\rdrestart.ps1` (copy in `tools/rdrestart.ps1`). It reloads the `RUSTDESK_MCP_*` variables from the user environment first; started without them the server answers "MCP token not set".

## Diagnostic tools (on Clark's PC, C:\RustDeskMCP)
- `node rdterm.js <id> <cmdfile> [waitSec]` runs PowerShell text in a RustDesk terminal and prints output (Sync Runner only).
- `node rdact.js <id> <actions.json> <out.png>` clicks/types/hotkeys then saves a frame. `{"typeEnv":"VAR"}` types a secret from env without echoing it.
- `node qbtest.js <id> <out.png>` grabs a screenshot.
