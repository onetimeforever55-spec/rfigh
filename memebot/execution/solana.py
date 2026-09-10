"""Live executor: real swaps on Solana through Jupiter.

Flow for every trade:
    quote (Jupiter) -> price-impact guard -> build unsigned tx (Jupiter)
    -> sign locally with the wallet key -> send via RPC -> poll for confirmation

The private key never leaves this process; Jupiter only ever sees the public
key. Requires the extras in requirements-live.txt.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging

from ..datasources.jupiter import Jupiter, Quote
from ..datasources.solana_rpc import SolanaRPC
from ..models import OrderResult, TokenSnapshot
from .base import Executor

log = logging.getLogger(__name__)

SOL_MINT = "So11111111111111111111111111111111111111112"
LAMPORTS_PER_SOL = 1_000_000_000
# Keep enough SOL unspent to pay transaction and priority fees.
SOL_FEE_BUFFER = 0.02


class LiveExecutionError(RuntimeError):
    pass


def _load_keypair(secret: str):
    """Accept either a base58 string (Phantom export) or a JSON byte array."""
    try:
        from solders.keypair import Keypair
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise LiveExecutionError(
            "live mode needs the Solana extras: pip install -r requirements-live.txt"
        ) from exc

    secret = secret.strip()
    if secret.startswith("["):
        return Keypair.from_bytes(bytes(json.loads(secret)))
    return Keypair.from_base58_string(secret)


class SolanaExecutor(Executor):
    name = "solana"

    def __init__(self, cfg, http, dex, secrets) -> None:
        self.cfg = cfg
        self.dex = dex
        self.jupiter = Jupiter(http, secrets.jupiter_api_key)
        self.rpc = SolanaRPC(http, secrets.solana_rpc_url)
        self._keypair = _load_keypair(secrets.wallet_private_key or "")
        self.pubkey = str(self._keypair.pubkey())
        self._decimals: dict[str, int] = {}
        log.info("live executor ready, wallet %s", self.pubkey)

    # --- helpers ---------------------------------------------------------
    async def _sol_price_usd(self) -> float:
        prices = await self.jupiter.price_usd([SOL_MINT])
        price = prices.get(SOL_MINT, 0.0)
        if price <= 0:
            raise LiveExecutionError("could not determine the SOL/USD price")
        return price

    async def _decimals_for(self, mint: str) -> int:
        if mint not in self._decimals:
            info = await self.rpc.get_mint_info(mint)
            if info is None:
                raise LiveExecutionError(f"mint {mint} not found on chain")
            self._decimals[mint] = info.decimals
        return self._decimals[mint]

    def _check_impact(self, quote: Quote, urgent: bool) -> str | None:
        limit = self.cfg.execution.max_price_impact_pct
        if not urgent and quote.price_impact_pct > limit:
            return f"price impact {quote.price_impact_pct:.2f}% > {limit:.2f}%"
        return None

    async def _sign_and_send(self, swap_tx_b64: str) -> str:
        from solders.transaction import VersionedTransaction

        raw = VersionedTransaction.from_bytes(base64.b64decode(swap_tx_b64))
        signed = VersionedTransaction(raw.message, [self._keypair])
        encoded = base64.b64encode(bytes(signed)).decode()

        signature = await self.rpc.call(
            "sendTransaction",
            [
                encoded,
                {
                    "encoding": "base64",
                    "skipPreflight": False,
                    "maxRetries": self.cfg.execution.max_swap_retries,
                    "preflightCommitment": "confirmed",
                },
            ],
        )
        if not signature:
            raise LiveExecutionError("RPC accepted no signature for the swap")
        await self._confirm(signature)
        return signature

    async def _confirm(self, signature: str) -> None:
        deadline = asyncio.get_event_loop().time() + self.cfg.execution.confirm_timeout_s
        while asyncio.get_event_loop().time() < deadline:
            result = await self.rpc.call(
                "getSignatureStatuses", [[signature], {"searchTransactionHistory": False}]
            )
            status = ((result or {}).get("value") or [None])[0]
            if status:
                if status.get("err"):
                    raise LiveExecutionError(f"swap {signature} failed on chain: {status['err']}")
                if status.get("confirmationStatus") in ("confirmed", "finalized"):
                    return
            await asyncio.sleep(2.0)
        raise LiveExecutionError(f"swap {signature} not confirmed in time")

    # --- Executor API ----------------------------------------------------
    async def buy(self, snap: TokenSnapshot, usd_amount: float) -> OrderResult:
        try:
            sol_price = await self._sol_price_usd()
            lamports = int(usd_amount / sol_price * LAMPORTS_PER_SOL)
            if lamports <= 0:
                return OrderResult(ok=False, error="computed a zero-lamport buy")

            balance = await self.rpc.get_sol_balance(self.pubkey)
            spendable = max(0.0, balance - SOL_FEE_BUFFER)
            if lamports / LAMPORTS_PER_SOL > spendable:
                return OrderResult(
                    ok=False,
                    error=f"insufficient SOL: need {lamports / LAMPORTS_PER_SOL:.4f}, "
                    f"spendable {spendable:.4f}",
                )

            quote = await self.jupiter.quote(
                SOL_MINT, snap.mint, lamports, self.cfg.execution.slippage_bps
            )
            if (problem := self._check_impact(quote, urgent=False)):
                return OrderResult(ok=False, error=problem)

            decimals = await self._decimals_for(snap.mint)
            qty = quote.out_amount / (10**decimals)
            if qty <= 0:
                return OrderResult(ok=False, error="quote returned zero output")

            tx = await self.jupiter.swap_transaction(
                quote, self.pubkey,
                priority_fee_lamports=self.cfg.execution.priority_fee_lamports,
            )
            signature = await self._sign_and_send(tx)

            spent_usd = quote.in_amount / LAMPORTS_PER_SOL * sol_price
            log.info("BUY %s: %.4f tokens for $%.2f (%s)", snap.symbol, qty, spent_usd, signature)
            return OrderResult(
                ok=True, qty=qty, price_usd=spent_usd / qty, value_usd=spent_usd,
                fee_usd=0.0, tx_signature=signature,
            )
        except Exception as exc:  # noqa: BLE001 - report, never crash the engine
            log.error("live buy of %s failed: %s", snap.symbol, exc)
            return OrderResult(ok=False, error=str(exc))

    async def sell(self, snap: TokenSnapshot, qty: float, *, urgent: bool = False) -> OrderResult:
        try:
            decimals = await self._decimals_for(snap.mint)

            # Never try to sell more than the wallet actually holds: a dust
            # mismatch would make the whole transaction fail.
            on_chain = await self.rpc.get_token_balance(self.pubkey, snap.mint)
            qty = min(qty, on_chain)
            amount = int(qty * (10**decimals))
            if amount <= 0:
                return OrderResult(ok=False, error="no token balance to sell")

            slippage = self.cfg.execution.slippage_bps
            if urgent:
                # Getting out matters more than the price when liquidity is
                # being pulled.
                slippage = min(5_000, slippage * 3)

            quote = await self.jupiter.quote(snap.mint, SOL_MINT, amount, slippage)
            if (problem := self._check_impact(quote, urgent)):
                return OrderResult(ok=False, error=problem)

            sol_price = await self._sol_price_usd()
            proceeds_usd = quote.out_amount / LAMPORTS_PER_SOL * sol_price
            if proceeds_usd <= 0:
                return OrderResult(ok=False, error="quote returned zero output")

            tx = await self.jupiter.swap_transaction(
                quote, self.pubkey,
                priority_fee_lamports=self.cfg.execution.priority_fee_lamports,
            )
            signature = await self._sign_and_send(tx)

            log.info("SELL %s: %.4f tokens for $%.2f (%s)", snap.symbol, qty, proceeds_usd, signature)
            return OrderResult(
                ok=True, qty=qty, price_usd=proceeds_usd / qty, value_usd=proceeds_usd,
                fee_usd=0.0, tx_signature=signature,
            )
        except Exception as exc:  # noqa: BLE001
            log.error("live sell of %s failed: %s", snap.symbol, exc)
            return OrderResult(ok=False, error=str(exc))

    async def available_cash_usd(self) -> float | None:
        try:
            balance = await self.rpc.get_sol_balance(self.pubkey)
            sol_price = await self._sol_price_usd()
            return max(0.0, balance - SOL_FEE_BUFFER) * sol_price
        except Exception as exc:  # noqa: BLE001
            log.warning("could not read wallet balance: %s", exc)
            return None
