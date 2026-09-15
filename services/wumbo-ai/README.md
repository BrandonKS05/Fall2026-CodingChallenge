# Wumbo AI

The in-app assistant for Wumboo: one FastAPI service, one endpoint, and a React
widget that drops onto any page. It answers questions about the app — where
things live, what follower-only means, why a message went to requests — from a
system prompt, not from anyone's data. It has no access to the Wumboo database,
no session, and no ability to act on a person's behalf.

## Running it

```bash
cd services/wumbo-ai
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env          # then put your key in it
.venv/bin/uvicorn app.main:app --reload --port 8000
```

`GET /api/health` reports whether a key is configured. Without one the service
still runs: every reply is the fallback sentence, so the widget degrades instead
of the page breaking.

```bash
.venv/bin/python -m pytest      # 8 tests, none of which call the API
```

## The endpoint

`POST /api/chat`

```json
{ "message": "How do I share a board?", "conversation_history": [
  { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }
] }
```

Answers `{ "reply": "..." }`. The API is stateless — the browser holds the
conversation and sends it back each time, and the service replays the last
`WUMBO_HISTORY_TURNS` of it. Send `X-Session-Id` so the rate limiter can tell
tabs apart.

| Status | When |
| --- | --- |
| 200 | A reply, whether from the model or the fallback |
| 422 | Empty or overlong message, or a role other than user/assistant |
| 429 | Over the per-minute or per-hour limit; `Retry-After` says how long |

## Configuration

Everything is an environment variable; see `.env.example`. `OPENAI_API_KEY` is
the only required one. `WUMBO_MODEL` is a plain model name so switching models
never touches code — set it to whatever your account can reach. Set
`WUMBO_TEMPERATURE=` (empty) if you move to a reasoning model that rejects the
parameter.

`WUMBO_ALLOWED_ORIGINS` is the CORS list. The widget calls this service
directly, so the site's origin has to be in it.

## What to know before deploying

- **Rate limiting is in this process.** Two instances mean two separate budgets.
  Move the buckets in `rate_limit.py` to Redis before scaling out.
- **The session id comes from the browser**, so it can be forged. The limiter
  keys on the client address as well, which is what makes forging pointless.
- **The system prompt is the product.** When Wumboo gains a feature, `prompt.py`
  is where the assistant learns about it — otherwise it will cheerfully say the
  feature does not exist.
- Replies are not streamed. The endpoint returns the whole answer, which keeps
  the contract to one JSON object; switching to server-sent events later would
  not change the widget's shape much.

## Layout

```
services/wumbo-ai/
├── app/
│   ├── main.py        FastAPI app: CORS, health, /api/chat, the limiter
│   ├── config.py      settings from the environment
│   ├── schemas.py     the request/response contract and its size limits
│   ├── prompt.py      everything the assistant knows about Wumboo
│   ├── chat.py        the OpenAI call and every fallback path
│   └── rate_limit.py  sliding windows, per minute and per hour
└── tests/test_chat.py
```
