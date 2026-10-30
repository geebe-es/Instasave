const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const python = process.env.INSTASAVE_BUILD_PYTHON || path.join(root, 'python-service/.venv/Scripts/python.exe');
function run(bin, args, cwd = root) {
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(bin)}: ${result.status}`);
}
function npm(args, cwd) { run(process.execPath, [process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js'), ...args], cwd); }
async function backend() {
  await require('esbuild').build({ entryPoints: ['backend/src/desktop.ts'], outfile: 'desktop-dist/backend.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22' });
}
async function pythonBuild() {
  fs.mkdirSync('resources', { recursive: true });
  run(python, ['scripts/python-notices.py']);
  run(python, ['-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'downloader-service', '--distpath', '../dist-python', '--workpath', '../.desktop-build/python', '--specpath', '../.desktop-build', '--collect-all', 'yt_dlp', '--collect-all', 'instaloader', '--collect-all', 'uvicorn', '--copy-metadata', 'fastapi', '--copy-metadata', 'pydantic', 'desktop_entry.py'], path.join(root, 'python-service'));
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'python') return pythonBuild();
  await backend();
  await require('./assets.cjs')();
  if (mode === 'dev') {
    const launchEnv = { ...process.env, INSTASAVE_BUILD_PYTHON: python };
    delete launchEnv.ELECTRON_RUN_AS_NODE;
    const electron = spawn(require('electron'), ['.', '--desktop-dev'], { stdio: 'inherit', windowsHide: true, env: launchEnv });
    electron.on('exit', code => { process.exitCode = code || 0; });
    return;
  }
  npm(['run', 'build'], path.join(root, 'frontend'));
  await pythonBuild();
  const { build, Platform } = require('electron-builder');
  await build({ config: require('../electron-builder.cjs'), targets: Platform.WINDOWS.createTarget(mode === 'release' ? ['nsis'] : ['dir'], require('builder-util').Arch.x64) });
}
main().catch(error => { console.error(error); process.exit(1); });
