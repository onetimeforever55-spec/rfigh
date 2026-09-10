from __future__ import annotations

import time
from typing import Any

import pytest

from memebot.config import Config, SOL_MINT
from memebot.models import TokenSnapshot


def make_pair(
    *,
    mint: str = "MintAAA",
    symbol: str = "PEPE",
    price_usd: float = 0.001,
    liquidity_usd: float = 80_000.0,
    market_cap_usd: float = 1_500_000.0,
    age_minutes: float = 120.0,
    vol_h1: float = 60_000.0,
    vol_h24: float = 500_000.0,
    buys_h1: int = 400,
    sells_h1: int = 200,
    buys_m5: int = 40,
    sells_m5: int = 20,
    change_m5: float = 3.0,
    change_h1: float = 25.0,
    change_h24: float = 90.0,
    quote_mint: str = SOL_MINT,
    dex_id: str = "raydium",
    chain_id: str = "solana",
    socials: bool = True,
) -> dict[str, Any]:
    """A DexScreener pair payload that passes screening by default."""
    created = int(time.time() * 1000 - age_minutes * 60_000)
    return {
        "chainId": chain_id,
        "dexId": dex_id,
        "pairAddress": f"Pair{mint}",
        "url": f"https://dexscreener.com/solana/{mint}",
        "baseToken": {"address": mint, "symbol": symbol, "name": f"{symbol} Coin"},
        "quoteToken": {"address": quote_mint, "symbol": "SOL"},
        "priceUsd": str(price_usd),
        "priceNative": str(price_usd / 150),
        "liquidity": {"usd": liquidity_usd},
        "marketCap": market_cap_usd,
        "fdv": market_cap_usd,
        "pairCreatedAt": created,
        "txns": {
            "m5": {"buys": buys_m5, "sells": sells_m5},
            "h1": {"buys": buys_h1, "sells": sells_h1},
            "h6": {"buys": buys_h1 * 4, "sells": sells_h1 * 4},
            "h24": {"buys": buys_h1 * 12, "sells": sells_h1 * 12},
        },
        "volume": {"m5": vol_h1 / 12, "h1": vol_h1, "h6": vol_h1 * 5, "h24": vol_h24},
        "priceChange": {"m5": change_m5, "h1": change_h1, "h6": change_h1 * 2, "h24": change_h24},
        "info": {"socials": [{"type": "twitter"}] if socials else []},
    }


def make_snapshot(**kwargs: Any) -> TokenSnapshot:
    return TokenSnapshot.from_dexscreener(make_pair(**kwargs))


@pytest.fixture
def cfg() -> Config:
    return Config()


@pytest.fixture
def snap() -> TokenSnapshot:
    return make_snapshot()
