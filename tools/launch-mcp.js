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
const os = require('os');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 59940;
const WAIT_MS = Number(process.env.RUSTDESK_MCP_WAIT_MS) > 0 ? Number(process.env.RUSTDESK_MCP_WAIT_MS) : 30000; // leave margin under Claude desktop's start timeout
const LOCK = path.join(os.tmpdir(), 'rustdeskmcp-launch.lock');
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

// Returns true if a start was attempted (by us or a concurrent launcher), false if it cannot work.
function startGui() {
  if (!fs.existsSync(GUI_EXE)) { log(`RustDeskMCP not found at ${GUI_EXE}; set RUSTDESK_MCP_EXE`); return false; }
  // Two launchers starting together must not spawn two GUIs: only the lock holder spawns.
  try {
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs < WAIT_MS) { log('another launcher is starting RustDeskMCP; waiting'); return true; }
    fs.unlinkSync(LOCK); // stale
  } catch {}
  try { fs.closeSync(fs.openSync(LOCK, 'wx')); } catch { log('another launcher is starting RustDeskMCP; waiting'); return true; }
  // Same env handoff as rdrestart.ps1, and like it, HKCU wins so GUI and proxy agree after a token rotation.
  const env = { ...process.env };
  for (const n of GUI_ENV) { const v = userEnv(n) || process.env[n]; if (v) env[n] = v; }
  if (!env.RUSTDESK_MCP_TOKEN) log('warning: RUSTDESK_MCP_TOKEN not set; RustDeskMCP will refuse every request');
  try {
    // If the GUI is already running with its MCP port down, this only raises the existing window.
    const gui = spawn(GUI_EXE, [], { detached: true, stdio: 'ignore', env, cwd: path.dirname(GUI_EXE) });
    gui.on('error', (e) => log(`failed to start RustDeskMCP: ${e.message}`));
    gui.unref(); // must outlive this launcher
  } catch (e) { log(`failed to start RustDeskMCP: ${e.message}`); return false; }
  log('RustDeskMCP was not running; started it');
  return true;
}

async function waitForPort() {
  if (await portOpen()) return true;
  if (!startGui()) return false;
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await portOpen()) { try { fs.unlinkSync(LOCK); } catch {} return true; }
  }
  return false;
}

(async () => {
  const auth = process.env.RUSTDESK_MCP_AUTH || userEnv('RUSTDESK_MCP_AUTH');
  if (!auth) { log('RUSTDESK_MCP_AUTH not set in user environment'); process.exit(1); }

  if (!(await waitForPort())) {
    log(`nothing listening on ${HOST}:${PORT}. RustDeskMCP did not start, failed to bind, or another process holds the port.`);
    process.exit(1);
  }

  const proxy = path.join(__dirname, 'mcp-remote', 'node_modules', 'mcp-remote', 'dist', 'proxy.js');
  const child = spawn(process.execPath, [proxy, `http://${HOST}:${PORT}/mcp`, '--header', 'Authorization:${RUSTDESK_MCP_AUTH}'],
    { stdio: 'inherit', env: { ...process.env, RUSTDESK_MCP_AUTH: auth }, windowsHide: true });
  child.on('exit', (code) => process.exit(code ?? 1));
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
})();
