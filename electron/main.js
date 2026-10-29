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

const RELEASES_URL = 'https://github.com/JaxsonLeiskau/roundtable/releases/latest';
// Any number of windows can be open, each on its own chat; chats run side by side
const wins = new Set();
const current = () => BrowserWindow.getFocusedWindow() || [...wins].pop() || null;
let serverMod = null;
let baseUrl = null;

function createWindow(url) {
  const st = loadState();
  const prev = current();
  const pos = prev && !prev.isMaximized() ? (([x, y]) => ({ x: x + 32, y: y + 32 }))(prev.getPosition()) : { x: st.x, y: st.y };
  const win = new BrowserWindow({
    width: st.width || 1280,
    height: st.height || 840,
    ...pos,
    minWidth: 420,
    minHeight: 480,
    title: 'Roundtable',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262624' : '#faf9f5',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    // On macOS the traffic lights sit on top of the sidebar, like claude.ai's desktop app
    ...(IS_MAC ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 19 } } : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  if (st.maximized && !prev) win.maximize();
  wins.add(win);

  win.loadURL(url && url.startsWith(baseUrl) ? url : `${baseUrl}/?shell=electron&os=${process.platform}${url && url.startsWith('#') ? url : ''}`);
  // the window title always reads "Roundtable", whatever the page is showing
  win.on('page-title-updated', e => e.preventDefault());
  win.once('ready-to-show', () => win.show());

  // Links in Claude's answers open in your normal browser, never inside the app
  // ...except the app's own pages ("Open in new window"), which open as another app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl)) createWindow(url);
    else if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });

  for (const ev of ['resize', 'move', 'close']) win.on(ev, () => saveState(win));
  win.on('closed', () => { wins.delete(win); });
  return win;
}

// Automatic updates from GitHub Releases. On Windows and Linux the new version downloads in
// the background and installs on restart (the sidebar shows a "Restart to update" button).
// Mac apps must be code-signed to self-update, so there the button opens the download page.
const update = { status: 'idle', version: null, error: null };
let updater = null;
function setupUpdates() {
  serverMod.setAppHooks({
    desktop: true,
    version: app.getVersion(),
    getUpdate: () => update,
    installUpdate: () => {
      if (update.status === 'ready' && updater) { serverMod.stopAll(); setImmediate(() => updater.quitAndInstall()); }
      else shell.openExternal(RELEASES_URL);
    },
  });
  if (!app.isPackaged) return; // nothing to update when running from source
  try { updater = require('electron-updater').autoUpdater; } catch { return; }
  updater.autoDownload = !IS_MAC;
  updater.autoInstallOnAppQuit = true;
  updater.on('update-available', i => { update.version = i.version; update.status = IS_MAC ? 'available' : 'downloading'; });
  updater.on('update-downloaded', i => { update.version = i.version; update.status = 'ready'; });
  updater.on('update-not-available', () => { if (update.status !== 'ready') update.status = 'idle'; });
  updater.on('error', e => { update.error = String((e && e.message) || e).slice(0, 300); if (update.status !== 'ready') update.status = 'idle'; });
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

function buildMenu() {
  const send = js => { const w = current(); if (w) w.webContents.executeJavaScript(js).catch(() => {}); };
  const template = [
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Chat', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('newChat()') },
        { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow('#/') },
        { label: 'Search Chats', accelerator: 'CmdOrCtrl+K', click: () => send('openSearch()') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => send('settingsDialog()') },
        { label: 'Check for Updates…', click: () => {
          if (!app.isPackaged || !updater) return shell.openExternal(RELEASES_URL);
          const win = current();
          updater.checkForUpdates().then(r => {
            const latest = r && r.updateInfo && r.updateInfo.version;
            if (!latest || latest === app.getVersion()) dialog.showMessageBox(win, { message: 'You\'re up to date', detail: `Roundtable ${app.getVersion()} is the latest version.` });
            else dialog.showMessageBox(win, { message: `Version ${latest} is available`, detail: IS_MAC ? 'Opening the download page…' : 'It\'s downloading now. A "Restart to update" button will appear in the sidebar when it\'s ready.' }).then(() => { if (IS_MAC) shell.openExternal(RELEASES_URL); });
          }).catch(e => {
            const raw = String((e && e.message) || e);
            const why = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|network/i.test(raw) ? 'Your computer seems to be offline, or GitHub can\'t be reached right now.'
              : /\b404\b/.test(raw) ? 'The update page on GitHub wasn\'t found. If the project was renamed or made private, updates can\'t be checked.'
              : 'Something went wrong talking to GitHub.';
            dialog.showMessageBox(win, { type: 'warning', message: 'Couldn\'t check for updates', detail: `${why}\n\nYou can always download the latest version from the Releases page.`, buttons: ['OK', 'Open Releases page', 'Show details'], defaultId: 0 })
              .then(r => { if (r.response === 1) shell.openExternal(RELEASES_URL); if (r.response === 2) dialog.showMessageBox(win, { message: 'Error details', detail: raw.slice(0, 2000) }); });
          });
        } },
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

// Same ID the installer gives its shortcuts (kept from the app's old name so updates carry over), so a pinned taskbar icon and the
// running window are treated as one app on Windows
if (process.platform === 'win32') app.setAppUserModelId('local.claude-code-ui');

// One copy of the app at a time; opening it again focuses the existing window
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = current();
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
      dialog.showErrorBox('Roundtable couldn\'t start', String(e && e.message || e));
      app.quit();
      return;
    }
    setupUpdates();
    buildMenu();
    createWindow();
    app.on('activate', () => { if (!wins.size) createWindow(); });
  });

  app.on('window-all-closed', () => { if (!IS_MAC) app.quit(); });
  app.on('before-quit', () => { if (serverMod) serverMod.stopAll(); });
}
