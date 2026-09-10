"""Console + rotating file logging."""

from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

from rich.logging import RichHandler


def setup_logging(level: str = "INFO", log_file: str | None = None) -> None:
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers.clear()

    console = RichHandler(rich_tracebacks=True, show_path=False, log_time_format="%H:%M:%S")
    console.setFormatter(logging.Formatter("%(message)s"))
    root.addHandler(console)

    if log_file:
        path = Path(log_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            path, maxBytes=5_000_000, backupCount=3
        )
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
        )
        root.addHandler(file_handler)

    # aiohttp is chatty at DEBUG and drowns out the trading log.
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
