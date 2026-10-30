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
const python = process.env.INSTASAVE_BUILD_PYTHON || path.join(root, 'python-service/.venv/Scripts/python.exe');
if (!fs.existsSync(python)) run('python', ['-m', 'venv', 'python-service/.venv']);
run(python, ['-m', 'pip', 'install', '-r', 'python-service/requirements-lock.txt']);
