# RustDeskMCP for QBSERVER (ADK fork)

Hardened build of RustDeskMCP. Claude drives QBSERVER through a RustDesk session from Clark's PC. QBSERVER runs stock RustDesk only.

## Changes from upstream fork (src/agent_bridge.rs)
- Bearer token required on every request (`RUSTDESK_MCP_TOKEN`, 24+ chars). No token set = server refuses everything.
- Requests with an `Origin` header are refused (blocks any website in your browser from driving the session).
- `Host` must be 127.0.0.1 / localhost (blocks DNS rebinding).
- CORS `*` headers removed. Body capped at 1 MB.
- Only RustDesk IDs in `RUSTDESK_MCP_ALLOWED_IDS` (comma separated) can be opened.

## Build
GitHub > Actions > "Windows RustDeskMCP build (ADK)" > Run workflow. Download artifact `RustDeskMCP-windows-x64` (unsigned; Windows SmartScreen will warn).

## Install on Clark's PC
1. Unzip to `C:\RustDeskMCP\`.
2. PowerShell (once):
   `setx RUSTDESK_MCP_TOKEN "<long random token>"`
   `setx RUSTDESK_MCP_ALLOWED_IDS "<QBSERVER RustDesk ID>"`
3. Sign out/in (or reboot) so the variables load. Start `C:\RustDeskMCP\RustDeskMCP.exe`.
4. Settings > Security > Enable MCP server.
5. Install Node.js LTS. Claude desktop > Settings > Developer > Edit Config, add:
```json
{
  "mcpServers": {
    "rustdesk": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:59940/mcp", "--header", "Authorization:${AUTH}"],
      "env": { "AUTH": "Bearer <same token>" }
    }
  }
}
```
6. Quit Claude from the tray, reopen, confirm `rustdesk` tools appear.

## On QBSERVER
Stock RustDesk, permanent password, start with Windows, never sleep, stay signed in.
