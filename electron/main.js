'use strict';
/* Desktop wrapper: runs the local server in-process and shows it in a native window. */
const { app, BrowserWindow, shell, Menu, nativeTheme, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const IS_MAC = process.platform === 'darwin';

// Apps launched from Finder / the Start menu / a desktop launcher don't get the PATH your
// terminal has, so `claude` (usually installed via npm) wouldn't be found. Borrow the
// login shell's PATH on macOS/Linux, and add the usual npm global folders everywhere.
function fixPath() {
  const extra = [];
  if (process.platform !== 'win32') {
    try {
      const shellPath = process.env.SHELL || (IS_MAC ? '/bin/zsh' : '/bin/bash');
      const out = execFileSync(shellPath, ['-ilc', 'printf "__P__%s__P__" "$PATH"'], { encoding: 'utf8', timeout: 5000 });
      const m = out.match(/__P__(.*)__P__/);
      if (m) extra.push(...m[1].split(':'));
    } catch {}
    extra.push('/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local/bin'), path.join(os.homedir(), '.npm-global/bin'), path.join(os.homedir(), '.claude/local'));
  } else {
    if (process.env.APPDATA) extra.push(path.join(process.env.APPDATA, 'npm'));
    extra.push(path.join(os.homedir(), '.local', 'bin'));
  }
  const sep = process.platform === 'win32' ? ';' : ':';
  const parts = [...(process.env.PATH || '').split(sep), ...extra].filter(Boolean);
  process.env.PATH = [...new Set(parts)].join(sep);
}

// Window size/position memory
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } }
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {}
}

let win = null;
let serverMod = null;
let baseUrl = null;

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width || 1280,
    height: st.height || 840,
    x: st.x, y: st.y,
    minWidth: 420,
    minHeight: 480,
    title: 'Claude Code',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262624' : '#faf9f5',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    // On macOS the traffic lights sit on top of the sidebar, like claude.ai's desktop app
    ...(IS_MAC ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 19 } } : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  if (st.maximized) win.maximize();

  win.loadURL(`${baseUrl}/?shell=electron&os=${process.platform}`);
  win.once('ready-to-show', () => win.show());

  // Links in Claude's answers open in your normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });

  for (const ev of ['resize', 'move', 'close']) win.on(ev, () => saveState(win));
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const send = js => win && win.webContents.executeJavaScript(js).catch(() => {});
  const template = [
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Chat', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('newChat()') },
        { label: 'Search Chats', accelerator: 'CmdOrCtrl+K', click: () => send('openSearch()') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('settingsDialog()') },
        { type: 'separator' },
        IS_MAC ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => send('toggleCollapse()') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Same ID the installer gives its shortcuts, so a pinned taskbar icon and the
// running window are treated as one app on Windows
if (process.platform === 'win32') app.setAppUserModelId('local.claude-code-ui');

// One copy of the app at a time; opening it again focuses the existing window
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    fixPath();
    process.env.NO_OPEN = '1';
    if (!process.env.DEFAULT_CWD) process.env.DEFAULT_CWD = os.homedir();
    try {
      serverMod = require(path.join(__dirname, '..', 'server.js'));
      // A fixed port keeps your settings (stored per address) the same between launches
      const port = await serverMod.start(Number(process.env.PORT) || 3457);
      baseUrl = `http://localhost:${port}`;
    } catch (e) {
      dialog.showErrorBox('Claude Code couldn\'t start', String(e && e.message || e));
      app.quit();
      return;
    }
    buildMenu();
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });

  app.on('window-all-closed', () => { if (!IS_MAC) app.quit(); });
  app.on('before-quit', () => { if (serverMod) serverMod.stopAll(); });
}
