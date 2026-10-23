"""Small Waitress wrapper with signal-driven shutdown for Windows and test runners."""

from __future__ import annotations

import signal
import threading
from typing import Any

from waitress.server import create_server


def serve_flask_app(app: Any, *, host: str, port: int, threads: int = 4) -> None:
    """Run a WSGI app and close Waitress cleanly when the parent process stops it."""
    server = create_server(app, host=host, port=port, threads=threads)
    close_lock = threading.Lock()
    closed = False

    def close_server() -> None:
        nonlocal closed
        with close_lock:
            if closed:
                return
            closed = True
        server.close()

    def handle_shutdown(_signum, _frame) -> None:
        # Close outside the signal callback so the dispatcher can finish active requests.
        threading.Thread(target=close_server, name="waitress-shutdown", daemon=True).start()

    previous_handlers = {}
    for shutdown_signal in (
        signal.SIGTERM,
        signal.SIGINT,
        getattr(signal, "SIGBREAK", None),
    ):
        if shutdown_signal is None:
            continue
        try:
            previous_handlers[shutdown_signal] = signal.getsignal(shutdown_signal)
            signal.signal(shutdown_signal, handle_shutdown)
        except (ValueError, OSError):
            # Signal handlers can only be installed from the main thread.
            continue

    try:
        server.run()
    finally:
        close_server()
        for shutdown_signal, previous_handler in previous_handlers.items():
            signal.signal(shutdown_signal, previous_handler)
