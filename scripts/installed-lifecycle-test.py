"""Run only after this workspace's installer has created a test installation."""
import os
from pathlib import Path
import runpy
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
helpers = runpy.run_path(str(ROOT / 'scripts/installer-ui-test.py'))
Application = helpers['Application']
installation = Path(os.environ['LOCALAPPDATA']) / 'Programs/InstaSave'
shortcut = Path(os.environ['APPDATA']) / 'Microsoft/Windows/Start Menu/Programs/InstaSave.lnk'
assert (installation / 'InstaSave.exe').is_file()
assert shortcut.is_file()
os.environ.pop('ELECTRON_RUN_AS_NODE', None)
for attempt in range(2):
    os.startfile(str(shortcut))
    app = Application(backend='win32').connect(path=str(installation / 'InstaSave.exe'), timeout=30)
    window = app.window(title_re='InstaSave .+alta qualidade')
    window.wait('visible', timeout=30)
    print(f'SHORTCUT_LAUNCH_{attempt + 1}_OK', flush=True)
    window.close()
    app.wait_for_process_exit(timeout=20)
    print('CLOSED', flush=True)

sentinel = Path.home() / 'Downloads' / f'InstaSave-preserve-test-{uuid.uuid4()}.txt'
sentinel.write_text('Personal download preservation test', encoding='utf-8')
try:
    start = subprocess.STARTUPINFO()
    start.dwFlags = subprocess.STARTF_USESHOWWINDOW
    start.wShowWindow = subprocess.SW_HIDE
    subprocess.run([str(installation / 'Uninstall InstaSave.exe'), '/S'], startupinfo=start, check=True, timeout=90)
    deadline = time.monotonic() + 90
    while (installation / 'InstaSave.exe').exists() and time.monotonic() < deadline:
        time.sleep(.5)
    assert not (installation / 'InstaSave.exe').exists(), 'Installation was not removed'
    assert not shortcut.exists(), 'Shortcut was not removed'
    assert sentinel.read_text(encoding='utf-8') == 'Personal download preservation test'
    print('UNINSTALLED_DOWNLOAD_PRESERVED', flush=True)
finally:
    sentinel.unlink(missing_ok=True)
