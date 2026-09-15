# API Reference

All endpoints are prefixed with `/api`. Request and response shapes are defined by the zod
schemas in `shared/`. This file is updated as each route is implemented.

| Method | Path                                 | Status |
| ------ | ------------------------------------ | ------ |
| GET    | /api/health                          | done   |
| POST   | /api/auth/register                   | done   |
| POST   | /api/auth/login                      | done   |
| POST   | /api/auth/logout                     | done   |
| GET    | /api/auth/me                         | done   |
| GET    | /api/auth/providers                  | done   |
| GET    | /api/auth/google                     | done   |
| GET    | /api/auth/google/callback            | done   |
| GET    | /api/collections                     | done   |
| POST   | /api/collections                     | done   |
| GET    | /api/collections/:id                 | done   |
| PATCH  | /api/collections/:id                 | done   |
| DELETE | /api/collections/:id                 | done   |
| GET    | /api/explore                         | done   |
| GET    | /api/search                          | done   |
| POST   | /api/collections/:id/items           | done   |
| PATCH  | /api/collections/:id/items/:itemId   | done   |
| DELETE | /api/collections/:id/items/:itemId   | done   |
| GET    | /api/images/:id                      | done   |
| POST   | /api/collections/:id/share-link      | done   |
| DELETE | /api/collections/:id/share-link      | done   |
| GET    | /api/shared/:slug                    | done   |
| GET    | /api/collections/:id/members         | done   |
| POST   | /api/collections/:id/members         | done   |
| PATCH  | /api/collections/:id/members/:userId | done   |
| DELETE | /api/collections/:id/members/:userId | done   |
| GET    | /api/notifications                   | done   |
| POST   | /api/notifications/read              | done   |

Health runs every registered indicator: a database round-trip and a storage probe that writes, reads back, and deletes a small file. Returns 200 with `status: "ok"` when all pass, otherwise 503 with `status: "degraded"`, so a deploy with an unmounted volume or bad bucket credentials never takes traffic.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptimeSeconds": 12,
  "timestamp": "2026-09-14T20:40:13.021Z",
  "checks": {
    "database": { "status": "ok", "latencyMs": 26 },
    "storage": { "status": "ok", "latencyMs": 3 }
  }
}
```

## Error envelope

Every non-2xx response has this shape. Clients switch on `code`, never on `message`.

```json
{ "error": { "code": "NOT_FOUND", "message": "No route for GET /api/nope", "details": null } }
```

| Code             | Status | When                                                                                               |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------- |
| VALIDATION_ERROR | 400    | Body, query, or params failed a zod schema, or the JSON was malformed. `details` holds the issues. |
| UNAUTHORIZED     | 401    | No valid session                                                                                   |
| FORBIDDEN        | 403    | Session is valid but lacks the role for this action                                                |
| NOT_FOUND        | 404    | Unknown route or resource                                                                          |
| CONFLICT         | 409    | Duplicate email, duplicate membership, and similar                                                 |
| RATE_LIMITED     | 429    | Too many requests                                                                                  |
| UPSTREAM_ERROR   | 502    | Pixabay or storage failed                                                                          |
| INTERNAL_ERROR   | 500    | Unexpected failure; message is generic in production                                               |

Every response also carries an `x-request-id` header, generated or propagated from the caller, that appears in the server logs.

## Authentication

Sessions are JWTs in an `httpOnly`, `SameSite=Lax` cookie named `trove_session`, valid for 7 days.
The browser sends it automatically; the frontend never reads or stores the token. `Secure` is set in
production. Register and login are rate limited to 20 attempts per 15 minutes per client.

| Endpoint                  | Body                                    | Response                                                                                                            |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register` | `{ email, password (8+), displayName }` | 201 `{ user }` and sets the cookie. 409 if the email is taken.                                                      |
| `POST /api/auth/login`    | `{ email, password }`                   | 200 `{ user }` and sets the cookie. 401 for bad credentials, with the same message whether or not the email exists. |
| `POST /api/auth/logout`   | none                                    | 204 and clears the cookie.                                                                                          |
| `GET /api/auth/me`        | none                                    | 200 `{ user }` for a valid session, `{ user: null }` otherwise. Never 401, so the client can probe quietly.         |

`user` is `{ id, email, displayName, createdAt }`. Emails are trimmed and lowercased before use.

## Collections

A collection (board) is returned as:

```json
{
  "id": "…",
  "owner": { "id": "…", "displayName": "Ada" },
  "title": "Kitchen ideas",
  "description": "",
  "visibility": "private",
  "shareSlug": null,
  "previewImageIds": [],
  "itemCount": 0,
  "role": "owner",
  "createdAt": "…",
  "updatedAt": "…"
}
```

`role` is the requesting user's role (`owner`, `editor`, `viewer`) or `null` for a non-member.
`previewImageIds` holds up to four recent image ids for the cover mosaic, each viewable at `/api/images/:id`.

| Endpoint                          | Auth     | Notes                                                                                                      |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/collections`            | required | Boards the user owns or was added to, most recently updated first. `{ collections }`                       |
| `POST /api/collections`           | required | `{ title, description?, visibility? }` → 201 with the board. The caller becomes owner.                     |
| `GET /api/collections/:id`        | optional | `{ collection, items }`. Members always see it; non-members only if `unlisted` or `public`, otherwise 403. |
| `PATCH /api/collections/:id`      | required | Any of `title`, `description`, `visibility`. Owner only (403 otherwise). Empty body is 400.                |
| `DELETE /api/collections/:id`     | required | Owner only. 204. Items and memberships cascade.                                                            |
| `GET /api/explore?page=&perPage=` | optional | Public boards, newest first. `perPage` is capped at 50. `{ collections }`                                  |

Validation failures return `details` as `[{ path, code, message }]`, where `path` names the request part, e.g. `body.title` or `params.id`.

## Search

`GET /api/search?q=&page=&perPage=&orientation=&color=` needs no session. Results come from Pixabay
through a 24-hour cache and are rate limited to 30 requests per minute per client.

```json
{
  "results": [
    {
      "provider": "pixabay",
      "providerImageId": "195893",
      "previewUrl": "…150px…",
      "previewWidth": 150,
      "previewHeight": 84,
      "displayUrl": "…640px…",
      "width": 4000,
      "height": 2250,
      "tags": ["blossom", "bloom"],
      "credit": { "name": "Josch13", "profileUrl": "…" },
      "sourceUrl": "https://pixabay.com/photos/…"
    }
  ],
  "page": 1,
  "perPage": 30,
  "total": 500
}
```

`previewUrl` and `displayUrl` are the provider's temporary URLs, for display only. Saving sends
`providerImageId`, never a URL. `orientation` is `all`, `horizontal`, or `vertical`; `color` is one of
Pixabay's color names. Show "Images from Pixabay" wherever results appear.

## Items

An item is an image on a board:

```json
{
  "id": "…",
  "collectionId": "…",
  "caption": "Warm wood",
  "tags": ["wood"],
  "position": 0,
  "addedBy": { "id": "…", "displayName": "Ada" },
  "createdAt": "…",
  "updatedAt": "…",
  "image": {
    "id": "…",
    "url": "/api/images/…",
    "width": 4000,
    "height": 2250,
    "blurhash": null,
    "palette": [],
    "tags": ["blossom"],
    "credit": { "name": "Josch13", "profileUrl": "…" },
    "sourceUrl": "…",
    "provider": "pixabay",
    "providerImageId": "195893"
  }
}
```

| Endpoint                                    | Auth            | Notes                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/collections/:id/items`           | editor or owner | `{ provider, providerImageId, caption?, tags? }`. Downloads the image into storage on first save, reuses it afterwards. 201 with the item. 404 if the provider has no such image, 409 if it is already on the board.                                                                                                                   |
| `PATCH /api/collections/:id/items/:itemId`  | editor or owner | Any of `caption`, `tags`, `position`, `collectionId`. A different `collectionId` moves the item to that board (needs edit rights there too) and appends it. 409 if the destination already has the image.                                                                                                                              |
| `DELETE /api/collections/:id/items/:itemId` | editor or owner | 204. The stored image is kept because other boards may reference it.                                                                                                                                                                                                                                                                   |
| `GET /api/images/:id`                       | none            | Streams the stored file with `Cache-Control: public, max-age=31536000, immutable`. A file missing from storage is re-downloaded from the provider first (once, however many requests arrive), so the database stays the source of truth and storage is a cache that rebuilds itself. 404 only if the provider no longer has the image. |

`GET /api/collections/:id` now returns the board's items ordered by `position`, then newest first.

## Sharing

Two ways to share a board. A **share link** lets anyone with the URL view it. **Members** are accounts
that collaborate with a role.

| Endpoint                                      | Auth                            | Notes                                                                                                                                             |
| --------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/collections/:id/share-link`        | owner                           | Returns `{ slug }`, creating it on first call. A `private` board becomes `unlisted` so the link works; `public` boards are unchanged. Idempotent. |
| `DELETE /api/collections/:id/share-link`      | owner                           | 204. An `unlisted` board goes back to `private`; a `public` one stays public.                                                                     |
| `GET /api/shared/:slug`                       | optional                        | Same shape as `GET /api/collections/:id`. `role` is filled in when the viewer happens to be a member. 404 for an unknown or revoked slug.         |
| `GET /api/collections/:id/members`            | member                          | `{ members: [{ userId, email, displayName, role, joinedAt }] }`, owner first. Non-members get 403 even on public boards.                          |
| `POST /api/collections/:id/members`           | owner                           | `{ email, role? }` where role is `editor` (default) or `viewer`. 201 with the member. 404 if no account has that email, 409 if already a member.  |
| `PATCH /api/collections/:id/members/:userId`  | owner                           | `{ role }`. The owner's own role cannot change (400).                                                                                             |
| `DELETE /api/collections/:id/members/:userId` | owner, or the member themselves | 204. Members may leave; the owner cannot be removed (400).                                                                                        |

The frontend builds the share URL from the slug (for example `/s/<slug>`), so the API stays host-agnostic.

## Notifications

Every change to a board notifies its other members: `item_added`, `item_updated`, `item_removed`,
`collection_updated`, and `member_added` (which also reaches the person invited).

| Endpoint                       | Auth     | Notes                                                                                                                                                                     |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/notifications`       | required | `{ notifications, unreadCount }`, newest first, 50 at most. Each has `type`, `collection: { id, title }`, `actor: { id, displayName }`, `payload`, `readAt`, `createdAt`. |
| `POST /api/notifications/read` | required | `{ ids?: [] }` marks those read, or everything when `ids` is omitted. 204.                                                                                                |

`payload` carries what the type needs: `itemId` and `imageId` for item events (so a thumbnail can be
shown via `/api/images/:imageId`), `changes` for board updates, `userId` and `role` for invitations.

## Sign in with Google

Available when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; `GET /api/auth/providers`
returns `{ google: true }` so the client knows to show the button.

| Endpoint                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/google`          | Sets a short-lived `trove_oauth_state` cookie and redirects the browser to Google's consent screen.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `GET /api/auth/google/callback` | Google redirects here with `code` and `state`. The state must match the cookie. The code is exchanged server-side, the ID token is verified against Google's keys, and the account is matched by Google id, else linked by verified email, else created without a password. On success the session cookie is set and the browser is redirected to `APP_URL/boards`; on failure to `APP_URL/login?error=<reason>` where reason is `google_denied`, `oauth_state`, `google_failed`, or `google_unavailable`. |

Register `<APP_URL>/api/auth/google/callback` (for local development `http://localhost:5173/api/auth/google/callback`)
as an authorized redirect URI in the Google Cloud console. Google-only accounts cannot log in with a
password; the login endpoint says so with a 401.
