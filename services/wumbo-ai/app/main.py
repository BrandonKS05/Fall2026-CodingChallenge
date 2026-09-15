"""Wumbo AI: one endpoint, and the guards around it.

Runs as its own service so the rest of Wumboo neither knows nor cares that it
exists. Start it with:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .chat import WumboChat
from .config import Settings, get_settings
from .rate_limit import SlidingWindowLimiter
from .schemas import ChatRequest, ChatResponse

logging.basicConfig(level=logging.INFO)

settings = get_settings()
app = FastAPI(title="Wumbo AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "X-Session-Id"],
)

chat = WumboChat(settings)
limiter = SlidingWindowLimiter(
    per_minute=settings.wumbo_rate_limit_per_minute,
    per_hour=settings.wumbo_rate_limit_per_hour,
)


def caller_key(request: Request, x_session_id: str | None = Header(default=None)) -> str:
    """Who is being limited.

    The session id comes from the browser, so it can be forged; the client
    address is the backstop that makes forging pointless. Both together means a
    tab gets its own budget without one address being able to buy more by
    rotating ids.
    """
    address = request.client.host if request.client else "unknown"
    session = (x_session_id or "anonymous")[:64]
    return f"{address}:{session}"


@app.get("/api/health")
def health(config: Settings = Depends(get_settings)) -> dict[str, object]:
    """Says whether a key is present, never what it is."""
    return {"status": "ok", "model": config.wumbo_model, "configured": config.configured}


@app.post("/api/chat", response_model=ChatResponse)
async def post_chat(body: ChatRequest, key: str = Depends(caller_key)) -> ChatResponse | JSONResponse:
    decision = limiter.check(key)
    if not decision.allowed:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(decision.retry_after)},
            content={
                "detail": "Too many messages. Give me a moment to catch up.",
                "retry_after": decision.retry_after,
            },
        )

    reply = await chat.reply(body.message, body.conversation_history)
    return ChatResponse(reply=reply)
