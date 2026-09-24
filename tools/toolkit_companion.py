#!/usr/bin/env python3
"""Loopback-only bridge that starts/stops a Toolkit recorder for Spark Trace."""

from __future__ import annotations

import argparse
import atexit
import json
import re
import signal
import subprocess
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SAFE_SESSION_ID = re.compile(r"[^a-zA-Z0-9_.-]+")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CaptureManager:
    def __init__(self, toolkit_dir: Path, data_root: Path, python_bin: Path, runner: Path) -> None:
        self.toolkit_dir = toolkit_dir.resolve()
        self.data_root = data_root.expanduser().resolve()
        self.python_bin = python_bin.expanduser().resolve()
        self.runner = runner.resolve()
        self.lock = threading.Lock()
        self.process: subprocess.Popen[str] | None = None
        self.log_handle: Any | None = None
        self.capture: dict[str, Any] | None = None

    def configuration_error(self) -> str | None:
        if not self.toolkit_dir.is_dir():
            return f"Toolkit directory not found: {self.toolkit_dir}"
        if not self.python_bin.is_file():
            return f"Toolkit Python not found: {self.python_bin}. Complete the Toolkit setup first."
        if not self.runner.is_file():
            return f"Capture runner not found: {self.runner}"
        return None

    def status(self) -> dict[str, Any]:
        with self.lock:
            error = self.configuration_error()
            active = self.process is not None and self.process.poll() is None
            capture = dict(self.capture) if self.capture else None
            if capture:
                capture["status"] = "recording" if active else capture.get("status", "stopped")
            return {"ok": error is None, "error": error, "active": active, "capture": capture}

    def start(self, session_id: str, user_name: str) -> dict[str, Any]:
        with self.lock:
            error = self.configuration_error()
            if error:
                raise ValueError(error)
            if self.process is not None and self.process.poll() is None:
                raise RuntimeError("A Toolkit capture is already running.")
            safe_id = SAFE_SESSION_ID.sub("-", session_id).strip(".-") or "spark-session"
            session_dir = self.data_root / safe_id
            records_dir = session_dir / "records"
            if session_dir.exists():
                raise ValueError(f"Session directory already exists: {session_dir}")
            records_dir.mkdir(parents=True, exist_ok=False)
            log_path = session_dir / "toolkit-recorder.log"
            metadata_path = session_dir / "capture-metadata.json"
            metadata = {
                "schema": "spark-trace/toolkit-capture/v1",
                "sessionId": safe_id,
                "startedAt": now(),
                "sessionDir": str(session_dir),
                "recordsDir": str(records_dir),
                "userName": user_name,
            }
            metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
            self.log_handle = log_path.open("w", encoding="utf-8")
            command = [str(self.python_bin), str(self.runner), "--data-dir", str(records_dir), "--user-name", user_name]
            self.process = subprocess.Popen(command, cwd=self.toolkit_dir, stdout=self.log_handle, stderr=subprocess.STDOUT, text=True)
            self.capture = {**metadata, "status": "recording", "pid": self.process.pid, "logPath": str(log_path)}
            return dict(self.capture)

    def stop(self) -> dict[str, Any]:
        with self.lock:
            if self.process is None or self.capture is None:
                return {"status": "idle"}
            process = self.process
            capture = self.capture
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=12)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    try:
                        process.wait(timeout=4)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=2)
            capture["status"] = "stopped"
            capture["stoppedAt"] = now()
            (Path(capture["sessionDir"]) / "capture-metadata.json").write_text(json.dumps(capture, indent=2) + "\n", encoding="utf-8")
            if self.log_handle:
                self.log_handle.close()
            self.process = None
            self.log_handle = None
            return dict(capture)


def allowed_origin(origin: str | None) -> str | None:
    if not origin:
        return None
    parsed = urlparse(origin)
    if parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}:
        return origin
    return None


def handler_for(manager: CaptureManager):
    class CompanionHandler(BaseHTTPRequestHandler):
        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def send_json(self, status: HTTPStatus, body: dict[str, Any]) -> None:
            encoded = json.dumps(body).encode("utf-8")
            self.send_response(status)
            origin = allowed_origin(self.headers.get("Origin"))
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.NO_CONTENT)
            origin = allowed_origin(self.headers.get("Origin"))
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Vary", "Origin")
            self.end_headers()

        def read_body(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 8_192:
                raise ValueError("Request body is too large")
            raw = self.rfile.read(length) if length else b"{}"
            value = json.loads(raw.decode("utf-8"))
            if not isinstance(value, dict):
                raise ValueError("Request body must be a JSON object")
            return value

        def do_GET(self) -> None:  # noqa: N802
            if self.path in {"/health", "/v1/captures/status"}:
                self.send_json(HTTPStatus.OK, manager.status())
                return
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

        def do_POST(self) -> None:  # noqa: N802
            try:
                body = self.read_body()
                if self.path == "/v1/captures/start":
                    session_id = str(body.get("sessionId", ""))
                    user_name = str(body.get("userName", "anonymous"))[:80]
                    if not session_id:
                        raise ValueError("sessionId is required")
                    self.send_json(HTTPStatus.CREATED, {"capture": manager.start(session_id, user_name)})
                    return
                if self.path == "/v1/captures/stop":
                    self.send_json(HTTPStatus.OK, {"capture": manager.stop()})
                    return
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            except ValueError as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except RuntimeError as error:
                self.send_json(HTTPStatus.CONFLICT, {"error": str(error)})
            except Exception as error:  # defensive local service boundary
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Companion failed: {error}"})

    return CompanionHandler


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    default_toolkit = repo_root.parent / "workflow-induction-toolkit"
    parser = argparse.ArgumentParser(description="Run the local Spark Trace Workflow Toolkit companion")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--toolkit-dir", type=Path, default=default_toolkit)
    parser.add_argument("--data-root", type=Path, default=repo_root.parent / "spark-trace-sessions")
    parser.add_argument("--python-bin", type=Path, default=None, help="Defaults to <toolkit-dir>/.venv/bin/python")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    toolkit_dir = args.toolkit_dir.expanduser().resolve()
    python_bin = args.python_bin or toolkit_dir / ".venv" / "bin" / "python"
    manager = CaptureManager(toolkit_dir, args.data_root, Path(python_bin), Path(__file__).with_name("toolkit_capture.py"))
    server = ThreadingHTTPServer((args.host, args.port), handler_for(manager))
    atexit.register(manager.stop)
    print(f"Spark Trace Toolkit companion listening at http://{args.host}:{args.port}")
    print(f"Session traces will be stored in {manager.data_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        manager.stop()


if __name__ == "__main__":
    main()
