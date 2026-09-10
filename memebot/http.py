"""Small async HTTP helper with retries, backoff and rate limiting.

Every outbound call in the bot goes through `HttpClient`, which makes the
whole data layer trivially mockable in tests: swap the client, no network.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

import aiohttp

log = logging.getLogger(__name__)

RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


class HttpError(RuntimeError):
    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class RateLimiter:
    """Simple token-bucket limiter, shared per host."""

    def __init__(self, rate_per_sec: float) -> None:
        self.min_interval = 1.0 / rate_per_sec if rate_per_sec > 0 else 0.0
        self._last = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        if self.min_interval <= 0:
            return
        async with self._lock:
            wait = self._last + self.min_interval - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = time.monotonic()


class HttpClient:
    def __init__(
        self,
        *,
        timeout_s: float = 15.0,
        max_retries: int = 3,
        rate_per_sec: float = 4.0,
        user_agent: str = "memebot/1.0",
    ) -> None:
        self._timeout = aiohttp.ClientTimeout(total=timeout_s)
        self._max_retries = max_retries
        self._limiter = RateLimiter(rate_per_sec)
        self._headers = {"User-Agent": user_agent, "Accept": "application/json"}
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self) -> "HttpClient":
        await self.start()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def start(self) -> None:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=self._timeout, headers=self._headers
            )

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
        self._session = None

    async def get_json(
        self, url: str, *, params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        return await self._request("GET", url, params=params, headers=headers)

    async def post_json(
        self, url: str, *, json: Any = None, headers: dict[str, str] | None = None,
    ) -> Any:
        return await self._request("POST", url, json=json, headers=headers)

    async def _request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        await self.start()
        assert self._session is not None
        last_error: Exception | None = None

        for attempt in range(self._max_retries + 1):
            await self._limiter.acquire()
            try:
                async with self._session.request(
                    method, url, params=params, json=json, headers=headers
                ) as resp:
                    if resp.status in RETRYABLE_STATUS:
                        body = (await resp.text())[:200]
                        last_error = HttpError(
                            f"{method} {url} -> {resp.status}: {body}", resp.status
                        )
                        if attempt < self._max_retries:
                            await self._backoff(attempt, resp)
                            continue
                        raise last_error
                    if resp.status >= 400:
                        body = (await resp.text())[:300]
                        raise HttpError(
                            f"{method} {url} -> {resp.status}: {body}", resp.status
                        )
                    return await resp.json(content_type=None)
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_error = exc
                if attempt < self._max_retries:
                    await self._backoff(attempt)
                    continue
                raise HttpError(f"{method} {url} failed: {exc}") from exc

        raise HttpError(f"{method} {url} failed: {last_error}")

    async def _backoff(self, attempt: int, resp: aiohttp.ClientResponse | None = None) -> None:
        delay = min(2.0 ** attempt, 12.0) + random.uniform(0, 0.4)
        if resp is not None:
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                try:
                    delay = max(delay, float(retry_after))
                except ValueError:
                    pass
        log.debug("retrying in %.1fs (attempt %d)", delay, attempt + 1)
        await asyncio.sleep(delay)
