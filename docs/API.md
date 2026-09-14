# API Reference

All endpoints are prefixed with `/api`. Request and response shapes are defined by the zod
schemas in `shared/`. This file is updated as each route is implemented.

| Method | Path | Status |
| ------ | ---- | ------ |
| GET | /api/health | done |
| POST | /api/auth/register | done |
| POST | /api/auth/login | done |
| POST | /api/auth/logout | done |
| GET | /api/auth/me | done |

Health runs every registered indicator. Returns 200 with `status: "ok"` when all pass, otherwise 503 with `status: "degraded"`.

```json
{ "status": "ok", "version": "0.1.0", "uptimeSeconds": 12, "timestamp": "2026-09-14T20:40:13.021Z",
  "checks": { "database": { "status": "ok", "latencyMs": 26 } } }
```

## Error envelope

Every non-2xx response has this shape. Clients switch on `code`, never on `message`.

```json
{ "error": { "code": "NOT_FOUND", "message": "No route for GET /api/nope", "details": null } }
```

| Code | Status | When |
| --- | --- | --- |
| VALIDATION_ERROR | 400 | Body, query, or params failed a zod schema, or the JSON was malformed. `details` holds the issues. |
| UNAUTHORIZED | 401 | No valid session |
| FORBIDDEN | 403 | Session is valid but lacks the role for this action |
| NOT_FOUND | 404 | Unknown route or resource |
| CONFLICT | 409 | Duplicate email, duplicate membership, and similar |
| RATE_LIMITED | 429 | Too many requests |
| UPSTREAM_ERROR | 502 | Pixabay or storage failed |
| INTERNAL_ERROR | 500 | Unexpected failure; message is generic in production |

Every response also carries an `x-request-id` header, generated or propagated from the caller, that appears in the server logs.

## Authentication

Sessions are JWTs in an `httpOnly`, `SameSite=Lax` cookie named `trove_session`, valid for 7 days.
The browser sends it automatically; the frontend never reads or stores the token. `Secure` is set in
production. Register and login are rate limited to 20 attempts per 15 minutes per client.

| Endpoint | Body | Response |
| --- | --- | --- |
| `POST /api/auth/register` | `{ email, password (8+), displayName }` | 201 `{ user }` and sets the cookie. 409 if the email is taken. |
| `POST /api/auth/login` | `{ email, password }` | 200 `{ user }` and sets the cookie. 401 for bad credentials, with the same message whether or not the email exists. |
| `POST /api/auth/logout` | none | 204 and clears the cookie. |
| `GET /api/auth/me` | none | 200 `{ user }` for a valid session, otherwise 401. |

`user` is `{ id, email, displayName, createdAt }`. Emails are trimmed and lowercased before use.
