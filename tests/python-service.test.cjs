const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');

test('frozen service: loopback, dynamic port, auth, validation, graceful exit', { timeout: 30000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'instasave-service-test-'));
  const readyFile = path.join(directory, 'ready.json');
  const token = randomBytes(32).toString('hex');
  const service = spawn(path.resolve('dist-python/downloader-service/downloader-service.exe'), [], { windowsHide: true, env: { ...process.env, PATH: process.env.SystemRoot + '\\System32', INSTASAVE_SERVICE_TOKEN: token, INSTASAVE_TEMP_DIR: path.join(directory, 'media'), INSTASAVE_READY_FILE: readyFile, INSTASAVE_PARENT_PID: String(process.pid) }, stdio: 'pipe' });
  const exit = new Promise(resolve => service.once('exit', resolve));
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = JSON.parse(await fs.readFile(readyFile, 'utf8')).port; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(port);
    const base = `http://127.0.0.1:${port}`;
    const headers = { 'x-instasave-token': token, 'content-type': 'application/json' };
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(base + '/health', { headers })).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal((await fetch(base + '/health')).status, 403);
    assert.deepEqual(await (await fetch(base + '/health', { headers })).json(), { status: 'ok' });
    const invalid = await fetch(base + '/resolve', { method: 'POST', headers, body: JSON.stringify({ url: 'https://127.0.0.1/p/Abcde12/' }) });
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).error.code, 'LINK_INVALID');
    assert.equal((await fetch(base + '/download/missing', { headers })).status, 404);
    assert.equal((await fetch(base + '/shutdown', { method: 'POST', headers })).status, 200);
    assert.equal(await exit, 0);
  } finally {
    if (service.exitCode === null) service.kill();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
