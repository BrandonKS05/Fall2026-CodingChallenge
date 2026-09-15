"""The call to OpenAI, and what to say when it cannot be made.

Every failure path ends in the same friendly sentence rather than an error: the
widget sits in the corner of a working app, so a bad minute for this service
must not look like a bad minute for Wumboo.
"""

from __future__ import annotations

import logging

import openai

from .config import Settings
from .prompt import SYSTEM_PROMPT
from .schemas import ChatTurn

log = logging.getLogger("wumbo_ai")

FALLBACK_REPLY = (
    "I can't reach my brain right now, sorry. Try again in a moment — and if it keeps "
    "happening, everything I know about is also in Settings and on the board pages themselves."
)


class WumboChat:
    """Wraps the OpenAI client so the route stays about HTTP."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: openai.AsyncOpenAI | None = None
        if settings.configured:
            self._client = openai.AsyncOpenAI(
                api_key=settings.openai_api_key,
                timeout=settings.wumbo_request_timeout_seconds,
                max_retries=1,
            )
        else:
            log.warning("OPENAI_API_KEY is not set; every reply will be the fallback")

    async def reply(self, message: str, history: list[ChatTurn]) -> str:
        if self._client is None:
            return FALLBACK_REPLY

        # The system prompt leads every request unchanged, which is what lets the
        # provider serve it from its own prompt cache on the second turn onward.
        payload: dict[str, object] = {
            "model": self._settings.wumbo_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                *self._turns(message, history),
            ],
            # The newer parameter name: `max_tokens` is rejected by the reasoning
            # models, this one is accepted everywhere.
            "max_completion_tokens": self._settings.wumbo_max_tokens,
        }
        if self._settings.wumbo_temperature is not None:
            payload["temperature"] = self._settings.wumbo_temperature

        try:
            response = await self._client.chat.completions.create(**payload)  # type: ignore[arg-type]
        except openai.RateLimitError:
            log.warning("OpenAI rate limit reached")
            return FALLBACK_REPLY
        except openai.AuthenticationError:
            log.error("OpenAI rejected the API key")
            return FALLBACK_REPLY
        except openai.BadRequestError as error:
            # Usually a model name the account cannot reach, or a parameter that
            # model does not take. Worth shouting about in the log.
            log.error("OpenAI rejected the request: %s", error)
            return FALLBACK_REPLY
        except openai.APIStatusError as error:
            log.error("OpenAI returned %s: %s", error.status_code, error)
            return FALLBACK_REPLY
        except openai.APIConnectionError:
            log.error("Could not reach OpenAI")
            return FALLBACK_REPLY

        choice = response.choices[0] if response.choices else None
        text = (choice.message.content or "").strip() if choice else ""
        if choice and choice.finish_reason == "length" and not text:
            log.warning("Reply hit the token ceiling before producing any text")
        return text or FALLBACK_REPLY

    def _turns(self, message: str, history: list[ChatTurn]) -> list[dict[str, str]]:
        """The last few turns, then what was just typed.

        History arrives from the browser, so it is treated as a claim rather than
        a record: it is trimmed, and the roles are already validated to be
        user/assistant. The worst a caller can do is lie about their own past.
        """
        recent = history[-self._settings.wumbo_history_turns :]
        turns = [{"role": turn.role, "content": turn.content} for turn in recent]
        # A conversation reads better when it starts with the person, not a reply.
        while turns and turns[0]["role"] != "user":
            turns.pop(0)
        return [*turns, {"role": "user", "content": message}]
