# API Reference

All endpoints are prefixed with `/api`. Request and response shapes are defined by the zod
schemas in `shared/`. This file is updated as each route is implemented.

| Method | Path | Status |
| ------ | ---- | ------ |
| GET | /api/health | done |

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
