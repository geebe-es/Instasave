"""Desktop bootstrap: binds the socket before publishing its port (no port race)."""
import ctypes
import json
import os
import socket
import sys
import threading
from pathlib import Path

import uvicorn


def watch_parent(server):
    parent = int(os.environ.get("INSTASAVE_PARENT_PID", "0"))
    if parent and os.name == "nt":
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        handle = kernel.OpenProcess(0x00100000, False, parent)
        if not handle:
            os._exit(0)
        kernel.WaitForSingleObject(handle, 0xFFFFFFFF)
        kernel.CloseHandle(handle)
        # Parent crash: terminate even if a resolver worker is blocked on I/O.
        os._exit(0)


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    if len(sys.argv) == 3 and sys.argv[1] == "--self-test":
        from desktop_selftest import run
        run(sys.argv[2])
        raise SystemExit(0)
    if not os.environ.get("INSTASAVE_SERVICE_TOKEN"):
        raise SystemExit("Desktop service requires a session token")
    from app.main import app
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    config = uvicorn.Config(app, host="127.0.0.1", log_level="error", access_log=False, loop="asyncio", http="h11", ws="none")
    server = uvicorn.Server(config)
    app.state.desktop_server = server
    ready = Path(os.environ["INSTASAVE_READY_FILE"])
    ready.write_text(json.dumps({"port": sock.getsockname()[1]}), encoding="utf-8")
    threading.Thread(target=watch_parent, args=(server,), daemon=True).start()
    server.run(sockets=[sock])
