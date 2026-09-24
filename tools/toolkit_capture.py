#!/usr/bin/env python3
"""Run one Workflow Induction Toolkit recorder in a caller-selected session directory."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from crec import crec
from crec.observers import Screen


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start a single Spark Trace Toolkit capture")
    parser.add_argument("--data-dir", required=True, help="Directory where the Toolkit writes actions and screenshots")
    parser.add_argument("--user-name", default="anonymous")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    async with crec(args.user_name, Screen(), data_directory=str(data_dir)):
        await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
