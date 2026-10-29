// Launches mcp-remote for RustDeskMCP. Reads the token from HKCU\Environment so it works
// no matter which environment Claude desktop was started with. Token never written to disk config.
//
// The MCP endpoint (127.0.0.1:59940) only exists while the RustDeskMCP GUI is running. Claude
// desktop often starts before it (boot, wake from sleep, after rdrestart.ps1), and mcp-remote
// exits immediately when nothing is listening, which shows up as "rustdesk couldn't start".
// So: if the port is down, start RustDeskMCP ourselves, then wait for the port before proxying.
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 59940;
const WAIT_MS = Number(process.env.RUSTDESK_MCP_WAIT_MS || 45000); // stay under Claude desktop's start timeout
const GUI_EXE = process.env.RUSTDESK_MCP_EXE || 'C:\\Program Files\\RustDeskMCP\\RustDeskMCP.exe';
const GUI_ENV = ['RUSTDESK_MCP_TOKEN', 'RUSTDESK_MCP_AUTH', 'RUSTDESK_MCP_ALLOWED_IDS'];

const log = (msg) => process.stderr.write(`[launch-mcp] ${msg}\n`);

function userEnv(name) {
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true });
    const m = out.match(new RegExp(name + '\\s+REG_\\w+\\s+(.+)'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

function portOpen() {
  return new Promise((resolve) => {
    const s = net.connect({ host: HOST, port: PORT });
    const done = (ok) => { s.destroy(); resolve(ok); };
    s.setTimeout(1000, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

function startGui() {
  if (!fs.existsSync(GUI_EXE)) { log(`RustDeskMCP not found at ${GUI_EXE}; set RUSTDESK_MCP_EXE`); return; }
  // Same env handoff as rdrestart.ps1: the GUI reads its token and allow-list from its own env.
  const env = { ...process.env };
  for (const n of GUI_ENV) { const v = process.env[n] || userEnv(n); if (v) env[n] = v; }
  const gui = spawn(GUI_EXE, [], { detached: true, stdio: 'ignore', env, cwd: path.dirname(GUI_EXE) });
  gui.on('error', (e) => log(`failed to start RustDeskMCP: ${e.message}`));
  gui.unref(); // must outlive this launcher
  log('RustDeskMCP was not running; started it');
}

async function waitForPort() {
  if (await portOpen()) return true;
  startGui();
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await portOpen()) return true;
  }
  return false;
}

(async () => {
  const auth = process.env.RUSTDESK_MCP_AUTH || userEnv('RUSTDESK_MCP_AUTH');
  if (!auth) { log('RUSTDESK_MCP_AUTH not set in user environment'); process.exit(1); }

  if (!(await waitForPort())) {
    log(`nothing listening on ${HOST}:${PORT} after ${WAIT_MS}ms. Is "Enable MCP server" on in RustDeskMCP Settings > Security?`);
    process.exit(1);
  }

  const proxy = path.join(__dirname, 'mcp-remote', 'node_modules', 'mcp-remote', 'dist', 'proxy.js');
  const child = spawn(process.execPath, [proxy, `http://${HOST}:${PORT}/mcp`, '--header', 'Authorization:${RUSTDESK_MCP_AUTH}'],
    { stdio: 'inherit', env: { ...process.env, RUSTDESK_MCP_AUTH: auth }, windowsHide: true });
  child.on('exit', (code) => process.exit(code ?? 1));
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
})();
