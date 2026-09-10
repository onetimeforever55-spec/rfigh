from .base import Executor
from .paper import PaperExecutor

__all__ = ["Executor", "PaperExecutor", "build_executor"]


def build_executor(cfg, http, dex, secrets):
    """Pick an executor from config. Imports the live one lazily so that the
    Solana dependencies are only required when actually trading live."""
    if cfg.execution.mode == "paper":
        return PaperExecutor(cfg, dex)
    from .solana import SolanaExecutor

    return SolanaExecutor(cfg, http, dex, secrets)
