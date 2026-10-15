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
