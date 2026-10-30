"""Manual/CI Windows desktop check; requires optional .tools/ui pywinauto + Pillow."""
import os
from pathlib import Path
import sys
import time
import ctypes

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / ".tools" / "ui"
sys.path[:0] = [str(TOOL), str(TOOL / "win32"), str(TOOL / "win32" / "lib"), str(TOOL / "pythonwin")]
DLL = os.add_dll_directory(str(TOOL / "pywin32_system32"))
from pywinauto import Application
import win32gui
import win32ui
from PIL import Image

def capture(window, destination):
    rect = window.rectangle()
    dc_handle = win32gui.GetWindowDC(window.handle)
    dc = win32ui.CreateDCFromHandle(dc_handle)
    target = dc.CreateCompatibleDC()
    bitmap = win32ui.CreateBitmap()
    bitmap.CreateCompatibleBitmap(dc, rect.width(), rect.height())
    target.SelectObject(bitmap)
    ctypes.windll.user32.PrintWindow(window.handle, target.GetSafeHdc(), 2)
    image = Image.frombuffer('RGB', (rect.width(), rect.height()), bitmap.GetBitmapBits(True), 'raw', 'BGRX', 0, 1)
    image.save(str(destination))
    win32gui.DeleteObject(bitmap.GetHandle())
    target.DeleteDC(); dc.DeleteDC(); win32gui.ReleaseDC(window.handle, dc_handle)

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode in {"start", "install"}:
        application = Application(backend="win32").start(f'"{ROOT / "release/InstaSave-Setup-1.0.0.exe"}"')
        window = application.top_window()
        window.wait("visible", timeout=30)
        (ROOT / "test-results/installer-pid.txt").write_text(str(application.process))
    else:
        application = Application(backend="win32").connect(process=int((ROOT / "test-results/installer-pid.txt").read_text()))
        window = application.top_window()
    if mode == "install":
        capture(window, ROOT / 'test-results/installer-welcome.png')
        print('WELCOME', flush=True)
        window.child_window(control_id=1).click()
        time.sleep(1)
        capture(window, ROOT / 'test-results/installer-progress.png')
        print('INSTALLING', flush=True)
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            if 'conclu' in window.child_window(control_id=1).window_text().lower() and window.child_window(control_id=1).is_enabled():
                break
            time.sleep(.5)
        else:
            raise RuntimeError('Installer did not finish')
        capture(window, ROOT / 'test-results/installer-complete.png')
        for checkbox in window.descendants(class_name='Button'):
            if 'Abrir InstaSave' in checkbox.window_text():
                checkbox.uncheck()
        window.child_window(control_id=1).click()
        print('INSTALLED', flush=True)
        raise SystemExit(0)
    if mode == "next":
        window.child_window(control_id=1).click()
        time.sleep(1)
    if mode == "finish":
        for checkbox in window.descendants(class_name="Button"):
            if "Abrir InstaSave" in checkbox.window_text():
                checkbox.uncheck()
        window.child_window(control_id=1).click()
        raise SystemExit(0)
    if mode == "cancel":
        window.child_window(control_id=2).click()
        time.sleep(.5)
        application.top_window().child_window(control_id=6).click()
        raise SystemExit(0)
    capture(window, ROOT / f"test-results/installer-{mode}.png")
    print([(control.control_id(), control.class_name(), control.window_text()) for control in window.descendants() if control.is_visible()])
