"""The request and response contract, and the limits that keep it cheap.

Validation here is the first rate limit: a caller cannot make one request cost
more by sending a novel's worth of history.
"""

from typing import Literal

from pydantic import BaseModel, Field

MAX_MESSAGE_CHARS = 2000
MAX_HISTORY_MESSAGES = 40


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    conversation_history: list[ChatTurn] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)


class ChatResponse(BaseModel):
    reply: str
