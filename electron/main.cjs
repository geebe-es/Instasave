const { app, BrowserWindow, ipcMain, session, utilityProcess, dialog, shell, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomBytes, randomUUID } = require('node:crypto');
const metadata = require('../package.json');
const root = path.resolve(__dirname, '..');
const dev = !app.isPackaged && process.argv.includes('--desktop-dev');
const token = randomBytes(32).toString('hex');
let mainWindow, splash, python, backend, vite, origin, pythonOrigin, tempDir, prefsFile, logFile;
let quitting = false, stopped = false, startupFailed = false;
let status = { message: 'Inicializando…', error: false };
let preferences = {}, downloadFolder;
let stoppingPython = false;
const files = new Map(), activeDownloads = new Set();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setName(metadata.desktop.productName);
app.setAppUserModelId(metadata.desktop.appId);
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => {
    const window = mainWindow && !mainWindow.isDestroyed() && !startupFailed ? mainWindow : splash;
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(start).catch(fail);
}
function log(message) {
  // Only fixed lifecycle codes are persisted; library output can contain source URLs.
  if (logFile) fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
}
function update(message, error = false) {
  status = { message, error };
  if (splash && !splash.isDestroyed()) splash.webContents.send('app:status', status);
}
function secure(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const current = new URL(window.webContents.getURL());
    const target = new URL(url);
    if (target.origin === current.origin && target.pathname === current.pathname && target.search === current.search) return;
    event.preventDefault();
    if (target.protocol === 'https:' && ['www.instagram.com', 'instagram.com'].includes(target.hostname)) shell.openExternal(target.href);
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
}
function options() {
  return { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: dev, partition: 'instasave' };
}
async function start() {
  const userData = app.getPath('userData');
  await fsp.mkdir(path.join(userData, 'logs'), { recursive: true });
  logFile = path.join(userData, 'logs', 'desktop.log');
  if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) await fsp.rename(logFile, `${logFile}.previous`).catch(() => {});
  prefsFile = path.join(userData, 'preferences.json');
  try { preferences = JSON.parse(await fsp.readFile(prefsFile, 'utf8')); } catch {}
  downloadFolder = typeof preferences.downloadFolder === 'string' && path.isAbsolute(preferences.downloadFolder) && fs.existsSync(preferences.downloadFolder) ? preferences.downloadFolder : app.getPath('downloads');
  await fsp.mkdir(downloadFolder, { recursive: true });
  const tempRoot = path.join(app.getPath('temp'), 'InstaSave');
  await fsp.mkdir(tempRoot, { recursive: true });
  // The single-instance lock makes old session directories safe to remove.
  for (const entry of await fsp.readdir(tempRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && /^session-[\w-]+$/.test(entry.name)) await fsp.rm(path.join(tempRoot, entry.name), { recursive: true, force: true }).catch(() => {});
  }
  tempDir = await fsp.mkdtemp(path.join(tempRoot, 'session-'));
  const icon = app.isPackaged ? path.join(process.resourcesPath, 'icon.ico') : path.join(root, 'resources/icon.ico');
  splash = new BrowserWindow({ width: 500, height: 380, resizable: false, frame: false, backgroundColor: '#100b22', icon, webPreferences: options() });
  secure(splash);
  registerIpc();
  await splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.on('closed', () => { if (!mainWindow && !quitting) app.quit(); });
  const ses = session.fromPartition('instasave');
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write');
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (origin && new URL(details.url).origin === origin && details.webContentsId === mainWindow?.webContents.id) headers['x-instasave-token'] = token;
    callback({ requestHeaders: headers });
  });
  update('Preparando serviços…');
  await startPython();
  await startBackend();
  if (quitting || startupFailed) return;
  update('Preparando interface…');
  if (dev) {
    const { createServer } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/vite/dist/node/index.js')).href);
    const react = (await import(pathToFileURL(path.join(root, 'frontend/node_modules/@vitejs/plugin-react/dist/index.js')).href)).default;
    vite = await createServer({ configFile: false, root: path.join(root, 'frontend'), publicDir: path.join(root, 'assets'), plugins: [react()], server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: origin, headers: { 'x-instasave-token': token } } } } });
    await vite.listen();
    origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  }
  if (quitting || startupFailed) return;
  update('Carregando aplicativo…');
  mainWindow = new BrowserWindow({ width: 1200, height: 800, minWidth: 720, minHeight: 560, show: false, frame: false, backgroundColor: '#100b22', icon, webPreferences: options() });
  secure(mainWindow);
  ses.on('will-download', handleDownload);
  mainWindow.on('closed', () => app.quit());
  mainWindow.webContents.on('render-process-gone', () => fail(new Error('RENDERER_EXITED')));
  await mainWindow.loadURL(origin);
  if (quitting || startupFailed) return;
  update('Pronto!');
  mainWindow.show();
  splash.hide();
  log('READY');
}
async function health(url) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && !quitting && !startupFailed) {
    try {
      const response = await fetch(`${url}/health`, { headers: { 'x-instasave-token': token }, signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {}
    await sleep(150);
  }
  throw new Error('HEALTH_TIMEOUT');
}
async function startPython() {
  const readyFile = path.join(tempDir, 'ready.json');
  await fsp.rm(readyFile, { force: true });
  const executable = app.isPackaged ? path.join(process.resourcesPath, 'python/downloader-service.exe') : (process.env.INSTASAVE_BUILD_PYTHON || path.join(root, 'python-service/.venv/Scripts/python.exe'));
  python = spawn(executable, app.isPackaged ? [] : [path.join(root, 'python-service/desktop_entry.py')], {
    cwd: tempDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUTF8: '1', INSTASAVE_SERVICE_TOKEN: token, INSTASAVE_TEMP_DIR: path.join(tempDir, 'media'), INSTASAVE_READY_FILE: readyFile, INSTASAVE_PARENT_PID: String(process.pid) }
  });
  python.on('error', () => fail(new Error('PYTHON_START_FAILED')));
  log(`PYTHON_PID ${python.pid || 0}`);
  python.on('exit', () => { if (!quitting && !stoppingPython) fail(new Error('PYTHON_EXITED')); });
  python.stdout.on('data', data => { if (dev) process.stdout.write(data); });
  python.stderr.on('data', data => { if (dev) process.stderr.write(data); else log('PYTHON_DIAGNOSTIC: details suppressed to protect source data'); });
  const deadline = Date.now() + 45000;
  while (!fs.existsSync(readyFile) && Date.now() < deadline && !startupFailed && !quitting) await sleep(100);
  const { port } = JSON.parse(await fsp.readFile(readyFile, 'utf8'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  pythonOrigin = `http://127.0.0.1:${port}`;
  await health(pythonOrigin);
}
async function startBackend() {
  backend = utilityProcess.fork(path.join(root, 'desktop-dist/backend.cjs'), [], { cwd: tempDir, stdio: 'pipe', serviceName: 'InstaSave API', env: { ...process.env, INSTASAVE_DESKTOP: '1', INSTASAVE_SERVICE_TOKEN: token, PYTHON_SERVICE_URL: pythonOrigin || '', INSTASAVE_WEB_ROOT: path.join(root, 'dist') } });
  backend.on('exit', () => { if (!quitting) fail(new Error('BACKEND_EXITED')); });
  backend.stdout.on('data', data => { if (dev) process.stdout.write(data); });
  backend.stderr.on('data', data => { if (dev) process.stderr.write(data); else log('BACKEND_DIAGNOSTIC'); });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('BACKEND_START_TIMEOUT')), 30000);
    backend.once('message', message => { clearTimeout(timer); resolve(message.port); });
    backend.once('exit', () => { clearTimeout(timer); reject(new Error('BACKEND_EXITED')); });
  });
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  origin = `http://127.0.0.1:${port}`;
  await health(origin);
}
function trusted(event) {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) return false;
  if (event.sender === splash?.webContents) return frame.url === pathToFileURL(path.join(__dirname, 'splash.html')).href;
  return event.sender === mainWindow?.webContents && origin && new URL(frame.url).origin === origin;
}
function registerIpc() {
  const handle = (channel, fn) => ipcMain.handle(channel, (event, ...args) => { if (!trusted(event)) throw new Error('Forbidden'); return fn(...args); });
  handle('window:minimize', () => (mainWindow?.isVisible() ? mainWindow : splash)?.minimize());
  handle('window:maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
  handle('window:close', () => app.quit());
  handle('app:info', () => ({ version: app.getVersion(), productName: metadata.desktop.productName, downloadFolder, ...status }));
  handle('app:retry', () => { app.relaunch(); app.quit(); });
  handle('app:details', () => shell.openPath(logFile));
  handle('clipboard:read', async () => (await clipboard.readText()).slice(0, 2048));
  handle('download:start', id => {
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid media');
    mainWindow.webContents.downloadURL(`${origin}/api/instagram/download/${id}`, { headers: { 'x-instasave-token': token } });
  });
  handle('download:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { defaultPath: downloadFolder, properties: ['openDirectory', 'createDirectory'] });
    if (!result.canceled && result.filePaths[0]) {
      downloadFolder = result.filePaths[0];
      await fsp.writeFile(`${prefsFile}.tmp`, JSON.stringify({ downloadFolder }), { mode: 0o600 });
      await fsp.rename(`${prefsFile}.tmp`, prefsFile);
    }
    return downloadFolder;
  });
  handle('download:open-folder', id => {
    if (id === undefined) return shell.openPath(downloadFolder);
    if (typeof id !== 'string' || !files.has(id)) throw new Error('Invalid download');
    shell.showItemInFolder(files.get(id));
  });
  handle('download:open-file', id => {
    if (typeof id !== 'string' || !files.has(id)) throw new Error('Invalid download');
    return shell.openPath(files.get(id));
  });
}
function handleDownload(event, item, webContents) {
  const url = new URL(item.getURL());
  if (webContents !== mainWindow?.webContents || url.origin !== origin || !/^\/api\/instagram\/download\/[\w-]+$/.test(url.pathname)) { event.preventDefault(); return; }
  const filename = path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (!/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i.test(filename)) {
    event.preventDefault();
    mainWindow.webContents.send('download:status', { state: 'error', message: 'Não foi possível obter o arquivo. Analise o link novamente e tente baixar outra vez.' });
    return;
  }
  let destination;
  try {
    for (let index = 0; index < 10000; index++) {
      const parsed = path.parse(filename);
      destination = path.join(downloadFolder, index ? `${parsed.name} (${index})${parsed.ext}` : filename);
      try { fs.closeSync(fs.openSync(destination, 'wx')); break; } catch (error) { if (error.code !== 'EEXIST' || index === 9999) throw error; }
    }
  } catch { event.preventDefault(); mainWindow.webContents.send('download:status', { state: 'error', message: 'Não foi possível salvar nesta pasta. Escolha outra pasta e tente novamente.' }); return; }
  const id = randomUUID();
  activeDownloads.add(item);
  item.setSavePath(destination);
  const send = value => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('download:status', { id, filename, ...value }); };
  send({ state: 'progress', percent: 0 });
  item.on('updated', () => {
    const total = item.getTotalBytes();
    send({ state: 'progress', percent: total > 0 ? Math.floor(item.getReceivedBytes() / total * 100) : null });
  });
  item.once('done', (_event, state) => {
    activeDownloads.delete(item);
    if (state === 'completed') { files.set(id, destination); send({ state: 'completed', percent: 100 }); }
    else { fs.rmSync(destination, { force: true }); send({ state: 'error', message: 'Download interrompido. Tente novamente.' }); }
  });
}
function fail(error) {
  if (quitting || startupFailed) return;
  startupFailed = true;
  log(/^[A-Z_]+$/.test(error.message) ? error.message : 'STARTUP_FAILED');
  if (dev) console.error(error);
  update('Não foi possível iniciar o aplicativo.', true);
  mainWindow?.hide();
  if (splash && !splash.isDestroyed()) { splash.show(); splash.focus(); }
  else { dialog.showErrorBox('InstaSave', 'Não foi possível iniciar o aplicativo. Consulte os logs na pasta de dados do aplicativo.'); app.quit(); }
}
async function shutdown() {
  for (const item of activeDownloads) item.cancel();
  await vite?.close();
  if (backend?.pid) {
    const exited = new Promise(resolve => backend.once('exit', resolve));
    backend.postMessage('shutdown');
    await Promise.race([exited, sleep(3000)]);
    if (backend.pid) backend.kill();
  }
  await stopPython();
  if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => log('TEMP_CLEANUP_DEFERRED'));
  log('STOPPED');
}
async function stopPython() {
  stoppingPython = true;
  try {
  if (python && python.exitCode === null && python.pid) {
    const exited = new Promise(resolve => python.once('exit', resolve));
    if (pythonOrigin) await fetch(`${pythonOrigin}/shutdown`, { method: 'POST', headers: { 'x-instasave-token': token }, signal: AbortSignal.timeout(1000) }).catch(() => {});
    await Promise.race([exited, sleep(4000)]);
    if (python.exitCode === null) {
      await new Promise(resolve => {
        const killer = spawn('taskkill.exe', ['/PID', String(python.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('exit', resolve); killer.once('error', resolve);
      });
      await Promise.race([exited, sleep(1000)]);
    }
  }
  } finally { python = undefined; pythonOrigin = undefined; stoppingPython = false; }
}
app.on('before-quit', event => {
  if (stopped) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  shutdown().catch(() => log('SHUTDOWN_ERROR')).finally(() => { stopped = true; app.quit(); });
});
app.on('window-all-closed', () => app.quit());
process.on('SIGTERM', () => app.quit());
process.on('SIGINT', () => app.quit());
