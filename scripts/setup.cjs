const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
}
for (const directory of ['frontend', 'backend']) run(process.execPath, [process.env.npm_execpath, '--prefix', directory, 'ci']);
const venv = path.join(root, 'python-service/.venv');
const python = path.join(venv, 'Scripts/python.exe');
if (!fs.existsSync(python)) {
  // O lock usa wheels de Python 3.14; 3.15 ainda tentaria compilar nativo.
  const py314 = spawnSync('py', ['-3.14', '--version'], { windowsHide: true, stdio: 'ignore' });
  if (!py314.error && py314.status === 0) run('py', ['-3.14', '-m', 'venv', venv]);
  else run(process.env.INSTASAVE_BUILD_PYTHON || 'python', ['-m', 'venv', venv]);
}
run(python, ['-m', 'pip', 'install', '-r', 'python-service/requirements-lock.txt']);
