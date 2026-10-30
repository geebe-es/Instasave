const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const root = path.resolve(__dirname, '..');

test('desktop: startup, isolation, offline UI, layout, IPC validation and shutdown', { timeout: 120000 }, async () => {
  const packaged = process.env.INSTASAVE_TEST_EXE;
  const userData = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'instasave-test-'));
  const downloadDir = path.join(userData, 'downloads');
  await fs.mkdir(downloadDir);
  await fs.writeFile(path.join(userData, 'preferences.json'), JSON.stringify({ downloadFolder: downloadDir }));
  const launchEnv = { ...process.env, ...(packaged ? { PATH: process.env.SystemRoot + '\\System32' } : {}) };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({ executablePath: packaged || require('electron'), args: [...(packaged ? [] : ['.', '--desktop-dev']), `--user-data-dir=${userData}`], cwd: root, env: launchEnv, timeout: 60000 });
  let pids = [];
  try {
    application.process().stderr.on('data', data => process.stderr.write(data));
    let page;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      page = application.windows().find(window => window.url().startsWith('http:'));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(page, 'main window loaded');
    await page.locator('h1').waitFor();
    await page.getByRole('button', { name: 'Escolher pasta' }).waitFor();
    await page.evaluate(() => window.desktop.minimize());
    const second = require('node:child_process').spawn(packaged || require('electron'), [...(packaged ? [] : ['.', '--desktop-dev']), `--user-data-dir=${userData}`], { cwd: root, env: launchEnv, windowsHide: true, stdio: 'ignore' });
    assert.equal(await new Promise(resolve => second.once('exit', resolve)), 0);
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('http:')).isMinimized()), false);
    await application.evaluate(async ({ clipboard }) => { await clipboard.writeText('https://www.instagram.com/p/Abcde12/'); });
    await page.getByRole('button', { name: 'Colar link' }).click();
    await page.waitForFunction(() => document.querySelector('input').value === 'https://www.instagram.com/p/Abcde12/');
    assert.equal(await page.getByLabel('Link do Instagram').inputValue(), 'https://www.instagram.com/p/Abcde12/');
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    assert.equal(await page.evaluate(() => document.fonts.check('800 25px Manrope')), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(16, 11, 34)');
    await assert.rejects(page.evaluate(() => window.desktop.openFile('C:\\Windows\\System32\\cmd.exe')));
    const url = page.url();
    if (packaged) assert.equal((await fetch(`${url}/health`)).status, 403);
    await page.getByLabel('Link do Instagram').fill('https://127.0.0.1/p/Abcde12/');
    await page.getByRole('button', { name: 'Baixar imagem' }).click();
    await page.locator('.status.error').waitFor();
    assert.ok((await page.locator('.status.error').textContent()).length > 5);
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    for (const [width, height] of [[1366,768],[1920,1080],[2560,1440],[720,560]]) {
      await application.evaluate(({ BrowserWindow }, size) => { const window = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('http:')); window.setSize(...size); }, [width, height]);
      await page.screenshot({ path: path.join(root, `test-results/${packaged ? 'packaged' : 'dev'}-${width}.png`) });
      const overflow = await page.evaluate(() => [...document.querySelectorAll('header, main, footer, input, button, .downloader')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className));
      assert.deepEqual(overflow, []);
    }
    await page.evaluate(() => window.desktop.maximize());
    await page.evaluate(() => window.desktop.maximize());
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Baixar imagem' }).click();
    assert.match(await page.locator('.status.error').textContent(), /Sem conexão/);
    await page.context().setOffline(false);
    // Controlled media verifies the native save path and byte preservation;
    // it does not claim to validate Instagram's live access policy.
    const image = await require('sharp')({ create: { width: 64, height: 64, channels: 3, background: '#ff3d81' } }).png().toBuffer();
    await application.evaluate(({ session, net }, bytes) => {
      session.fromPartition('instasave').protocol.handle('http', request => {
        if (new URL(request.url).pathname === '/api/instagram/download/00000000-0000-0000-0000-000000000000') return new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="image.png"' } });
        return net.fetch(request, { bypassCustomProtocolHandlers: true });
      });
    }, [...image]);
    for (const filename of ['image.png', 'image (1).png']) {
      await page.evaluate(() => window.desktop.download('00000000-0000-0000-0000-000000000000'));
      await page.waitForFunction(name => [...document.querySelectorAll('.download-state')].some(element => element.textContent.includes('Download concluído!')), filename);
      for (let attempt = 0; attempt < 50; attempt++) {
        try { if ((await fs.readFile(path.join(downloadDir, filename))).equals(image)) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.deepEqual(await fs.readFile(path.join(downloadDir, filename)), image);
    }
    await application.evaluate(({ shell }) => { global.openedPaths = []; shell.openPath = async file => { global.openedPaths.push(file); return ''; }; shell.showItemInFolder = file => global.openedPaths.push(file); });
    await page.getByRole('button', { name: 'Abrir arquivo', exact: true }).first().click();
    await page.locator('.download-state').first().getByRole('button', { name: 'Abrir pasta', exact: true }).click();
    const openedPaths = await application.evaluate(() => global.openedPaths);
    assert.deepEqual(openedPaths, [path.join(downloadDir, 'image.png'), path.join(downloadDir, 'image.png')]);
    // Generate a small valid video with audio for the frozen-engine diagnostic.
    const video = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff3d81'; ctx.fillRect(0,0,64,64);
      const audio = new AudioContext(); const oscillator = audio.createOscillator();
      const destination = audio.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start();
      const stream = canvas.captureStream(10); stream.addTrack(destination.stream.getAudioTracks()[0]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
      const finished = new Promise(resolve => { recorder.onstop = async () => resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]); });
      recorder.start(); setTimeout(() => recorder.stop(), 400);
      const bytes = await finished; stream.getTracks().forEach(track => track.stop()); oscillator.stop(); await audio.close(); return bytes;
    });
    await fs.mkdir(path.join(root, 'test-results/fixtures'), { recursive: true });
    await fs.writeFile(path.join(root, 'test-results/fixtures/image.png'), image);
    await fs.writeFile(path.join(root, 'test-results/fixtures/video.webm'), Buffer.from(video));
    pids = await application.evaluate(({ app }) => app.getAppMetrics().filter(metric => metric.type === 'Utility').map(metric => metric.pid));
  } finally {
    await application.close();
  }
  for (const pid of pids) {
    let exists = false;
    try { process.kill(pid, 0); exists = true; } catch {}
    assert.equal(exists, false, `process ${pid} stopped`);
  }
  const log = await fs.readFile(path.join(userData, 'logs/desktop.log'), 'utf8');
  assert.match(log, /READY/);
  assert.match(log, /STOPPED/);
  const pythonPid = Number(log.match(/PYTHON_PID (\d+)/)?.[1]);
  if (pythonPid) {
    let exists = false;
    try { process.kill(pythonPid, 0); exists = true; } catch {}
    assert.equal(exists, false, 'Python process stopped');
  }
});

test('startup failure displays retry and details instead of a blank window', { timeout: 30000, skip: !!process.env.INSTASAVE_TEST_EXE }, async () => {
  const env = { ...process.env, INSTASAVE_BUILD_PYTHON: path.join(root, 'missing-python.exe') };
  delete env.ELECTRON_RUN_AS_NODE;
  const userData = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'instasave-error-test-'));
  const application = await electron.launch({ executablePath: require('electron'), args: ['.', '--desktop-dev', `--user-data-dir=${userData}`], cwd: root, env });
  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: 'Tentar novamente' }).waitFor();
    await page.getByRole('button', { name: 'Ver detalhes' }).waitFor();
    await page.screenshot({ path: path.join(root, 'test-results/startup-error.png') });
  } finally { await application.close(); }
});
