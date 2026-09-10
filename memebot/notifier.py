"""Optional Telegram notifications. Silently disabled when unconfigured."""

from __future__ import annotations

import logging

from .http import HttpClient

log = logging.getLogger(__name__)


class Notifier:
    def __init__(self, http: HttpClient, bot_token: str | None, chat_id: str | None) -> None:
        self.http = http
        self.bot_token = bot_token
        self.chat_id = chat_id

    @property
    def enabled(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    async def send(self, text: str) -> None:
        if not self.enabled:
            return
        try:
            await self.http.post_json(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json={
                    "chat_id": self.chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
        except Exception as exc:  # noqa: BLE001 - notifications never block trading
            log.warning("telegram notification failed: %s", exc)
