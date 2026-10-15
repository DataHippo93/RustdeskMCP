// Launches mcp-remote for RustDeskMCP. Reads the token from HKCU\Environment so it works
// no matter which environment Claude desktop was started with. Token never written to disk config.
const { execFileSync, spawn } = require('child_process');
const path = require('path');
function userEnv(name) {
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true });
    const m = out.match(new RegExp(name + '\\s+REG_\\w+\\s+(.+)'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const auth = process.env.RUSTDESK_MCP_AUTH || userEnv('RUSTDESK_MCP_AUTH');
if (!auth) { process.stderr.write('RUSTDESK_MCP_AUTH not set in user environment\n'); process.exit(1); }
const proxy = path.join(__dirname, 'mcp-remote', 'node_modules', 'mcp-remote', 'dist', 'proxy.js');
const child = spawn(process.execPath, [proxy, 'http://127.0.0.1:59940/mcp', '--header', 'Authorization:${RUSTDESK_MCP_AUTH}'],
  { stdio: 'inherit', env: { ...process.env, RUSTDESK_MCP_AUTH: auth }, windowsHide: true });
child.on('exit', (code) => process.exit(code ?? 1));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
