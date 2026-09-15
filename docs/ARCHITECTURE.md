# Architecture

Living document. Describes the layers, the dependency rule, and the design pattern catalog.
Updated as each piece is implemented.

## Layout

| Folder      | Role                                                         |
| ----------- | ------------------------------------------------------------ |
| `frontend/` | Vite + React + TypeScript single-page app                    |
| `backend/`  | Express + TypeScript REST API                                |
| `shared/`   | zod schemas that define the API contract, used by both sides |
| `docs/`     | This file and the endpoint reference                         |

## Backend layout: feature modules

Each feature lives in one folder under `backend/src/modules/` with everything it needs:

```
modules/<feature>/
├── <feature>.routes.ts       endpoints and their middleware chain
├── <feature>.controller.ts   validated input in, one service call, presenter out
├── <Feature>Service.ts       the use cases and rules
├── <feature>.presenter.ts    domain objects to contract shapes
├── ports/                    interfaces the service depends on (repositories, providers)
└── adapters/                 implementations of those ports (Drizzle, Pixabay, argon2, ...)
```

Modules: `health`, `auth`, `collections`, `items`, `images` (search, storage, ingestion), `sharing`,
`notifications`. Around them sit three shared layers:

| Folder            | Role                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/`         | Shared kernel: entities, events, errors, access policies. Framework-free, used by every module.                                                                  |
| `infrastructure/` | Cross-cutting adapters: database client, schema, and migrations; event bus; logging; outbound fetch type. Ports for these sit next to their adapters.            |
| `http/`           | Express plumbing every module reuses: `ApiError`, validation, auth, rate limit, and error middleware, cookie helpers, and `router.ts`, which mounts each module. |

### Dependency rule

```
routes -> controller -> service -> ports <- adapters        (inside a module)
module -> domain, http, infrastructure                        (a module may use the shared layers)
module A -> module B                                          (only through B's service or port types)
container.ts                                                  (the only file that instantiates adapters)
```

A module never imports another module's adapters. `ItemService` calls `CollectionService.authorize`
and `ImageService.ensureStored`; it does not know Drizzle or Pixabay exist. Because each module's
boundary is explicit, any of them could become its own deployable later: the event bus port becomes a
queue, the images module becomes a worker, and nothing above the boundary changes.

## Frontend rules

- One folder per feature under `src/features/`. Features never import each other.
- Cross-feature composition happens only in pages and the router.
- All HTTP goes through the single gateway in `src/lib/api/`.

## Pattern catalog

| Pattern                                 | Where                                                                                                                                                  | What it lets us swap                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Adapter                                 | `backend/src/infrastructure/logging/pinoLogger.ts`                                                                                                     | pino sits behind the `Logger` port; services never import pino                                               |
| Chain of Responsibility                 | `backend/src/app.ts` middleware order                                                                                                                  | add or remove cross-cutting steps (auth, rate limits) without touching routes                                |
| Composition root (dependency injection) | `backend/src/container.ts`                                                                                                                             | swap any infrastructure implementation in one place                                                          |
| Strategy                                | `modules/health/ports/HealthIndicator.ts`, `infrastructure/db/DatabaseHealthIndicator.ts`, `modules/images/adapters/storage/StorageHealthIndicator.ts` | one indicator per dependency; the health route aggregates whatever the container registers                   |
| Repository                              | `modules/*/ports/*Repository.ts` (interfaces), `modules/*/adapters/Drizzle*Repository.ts`                                                              | Postgres for any store; services never see SQL                                                               |
| Strategy                                | `modules/auth/ports/PasswordHasher.ts`, `modules/auth/ports/TokenService.ts`                                                                           | argon2 and jose sit behind these as adapters; AuthService never imports either                               |
| Strategy                                | `modules/images/ports/ImageProvider.ts`, `modules/images/ports/StorageBackend.ts`                                                                      | Pixabay for Unsplash; local disk for S3, R2, or Supabase; the services only see the ports                    |
| Strategy                                | `modules/auth/ports/OAuthProvider.ts`, `modules/auth/adapters/GoogleOAuthProvider.ts`                                                                  | Google today, any OpenID Connect provider tomorrow; AuthService only ever sees a verified profile            |
| Decorator                               | `modules/images/adapters/CachedImageProvider.ts`                                                                                                       | wraps any ImageProvider with the 24-hour cache Pixabay requires and coalesces identical concurrent searches  |
| Adapter                                 | `modules/images/adapters/pixabay/pixabayAdapter.ts`                                                                                                    | translates Pixabay's response into the domain's ProviderImage, validated with zod at the boundary            |
| Factory                                 | `modules/images/adapters/storage/storageFactory.ts`                                                                                                    | selects the storage strategy from STORAGE_DRIVER; nothing else knows which one is running                    |
| Observer                                | `infrastructure/events/EventBus.ts`, `infrastructure/events/InMemoryEventBus.ts`, `modules/notifications/NotificationService.ts`                       | board changes are published as domain events; notifications subscribe, and publishers never know who listens |

## Error flow

Services and repositories throw domain errors (`backend/src/domain/errors`) that carry a `kind`
(`not_found`, `forbidden`, `conflict`, `invalid`) and no HTTP knowledge. The error handler
(`backend/src/http/middleware/errorHandler.ts`) is the single place where kinds become status codes
and the shared error envelope. Controllers throw `ApiError` only for HTTP-specific failures.

## Data model

Schema lives in `backend/src/infrastructure/db/schema`, one table per file, with migrations
generated by drizzle-kit into `backend/drizzle`. Enums are defined from the domain constants and a
test asserts they match the API contract.

| Table                | Purpose                 | Notable decisions                                                                                                                                    |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | Accounts                | Email stored lowercased and unique                                                                                                                   |
| `collections`        | Boards                  | `visibility` enum; nullable unique `share_slug`; partial index on public boards for Explore                                                          |
| `images`             | Downloaded files        | Unique per `(provider, provider_image_id)` so a photo is downloaded once and shared by many items; `blurhash` and `palette` filled in after download |
| `collection_items`   | An image inside a board | Unique per `(collection_id, image_id)`; `position` for ordering; `added_by` kept on user deletion via `restrict`                                     |
| `collection_members` | Roles                   | The owner also has an `owner` row, so authorization is one lookup for every role                                                                     |
| `notifications`      | Inbox                   | Composite index on `(recipient_id, read_at, created_at)` serves both the unread badge and the list                                                   |

## Anatomy of a request

Using auth as the example, a request passes through these files in `modules/auth/`:

1. `auth.routes.ts` declares the endpoint and its middleware chain: rate limit, `validate` with a schema from `@wumboo/shared`, `requireAuth` where needed.
2. `auth.controller.ts` reads the validated input, calls one service method, and hands the result to a presenter. No business rules.
3. `AuthService.ts` holds the rules (duplicate emails, credential checks, decoy hashing, Google linking) and depends only on ports.
4. `ports/` declare what the service needs: `UserRepository`, `PasswordHasher`, `TokenService`, `OAuthProvider`.
5. `adapters/` implement them: `DrizzleUserRepository`, `Argon2PasswordHasher`, `JoseTokenService`, `GoogleOAuthProvider`.
6. `user.presenter.ts` converts domain objects into the response shapes promised by the contract.
7. `container.ts` wires 4 and 5 together once. Tests replace any piece through `ContainerOverrides`.

Tests sit beside the code they cover: `Name.test.ts` for unit and route tests, `Name.db.test.ts` for
tests that need Postgres (`pnpm test:db`). Service tests use the in-memory fakes from `src/testing/fakes`,
route tests use the real adapters with in-memory repositories, and the Drizzle adapters are tested
against the real database.

## Authorization

`CollectionService.authorize(collectionId, actorId, level)` is the single enforcement point. It loads
the board and the actor's membership, then applies the pure policy functions in
`domain/policies/collectionAccess.ts` for the requested level (`view`, `edit`, `manage`). Every service
that touches a board, including items and sharing, calls it first, so a rule changes in one file.
Unknown boards raise `NotFoundError`; insufficient roles raise `ForbiddenError` with a message that
says what role would have been needed.

## Image pipeline

Pixabay's terms forbid permanent hotlinking and its image URLs expire after 24 hours, so a saved image
must be ours. Saving an item (`ItemService.add`) runs:

1. `CollectionService.authorize(..., 'edit')`.
2. `ImageService.ensureStored(provider, providerImageId)`: return the existing `images` row if this
   provider image was ever saved before; otherwise look the image up through the provider strategy,
   download the 1280px file (https only, image types only, size-capped), write it through the
   `StorageBackend` under `images/<uuid>.<ext>`, and insert the row. If two saves race, the unique
   index on `(provider, provider_image_id)` makes one insert lose; the loser deletes its file and
   returns the winner's row.
3. Insert the `collection_items` row at the next position and touch the board.

`GET /api/images/:id` streams from storage with a one-year immutable cache header, because an image id
never changes content. The database is the source of truth and storage is a cache that can be rebuilt:
if the file behind a row is missing (a lost disk, a volume mounted after the first boot), `open` looks
the image up through the provider again, downloads it, writes it back under the same key, and then
serves it. Concurrent requests for the same lost file share one download, and the log records the
restore so a misconfigured host is still visible. Search goes through `CachedImageProvider`, so
repeated queries never reach Pixabay within 24 hours and identical concurrent queries share one
request.

`PIXABAY_BASE_URL` can point at a mock server for local verification without a key; download URLs on
`localhost` are allowed over plain http for the same reason.

## Events and notifications

Services publish domain events (`domain/events`) after a board changes: `item.added`, `item.updated`,
`item.removed`, `collection.updated`, `member.added`. `NotificationService.register(bus)` subscribes to
all of them and writes one notification per member other than the actor. The in-memory bus runs
handlers concurrently and logs a failing handler instead of failing the request, so a notification
problem can never break a save. Because the port is just `publish` and `subscribe`, a queue-backed
bus could replace the in-memory one without touching any publisher or subscriber.

## Timestamps

`updated_at` and `read_at` are written with the database's `now()`, never the Node clock. App and
database servers rarely agree on the time to the millisecond (a Docker VM and its host included), and
boards are ordered by activity, so the database must own the clock.

## Frontend

`frontend/` is a Vite single-page app: React 19, TypeScript, Tailwind v4 with shadcn/ui (Base UI
primitives), TanStack Query for server state, React Router for navigation, react-hook-form with the
zod schemas from `@wumboo/shared` for forms.

| Folder                 | Role                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`             | Composition root: `providers.tsx` (query client, theme, tooltips, toasts), `router.tsx` (lazy routes), `layout/` (shell, nav, user menu)                                                                                                                                                              |
| `src/lib/api/`         | The one HTTP gateway (`HttpClient` facade over fetch), `ApiError`, and the query-key factory. Features never call fetch.                                                                                                                                                                              |
| `src/features/<name>/` | One slice per feature: `api.ts` (typed calls), `queries.ts` (TanStack hooks), `components/`, `pages/`. Components and hooks never import another feature; pages may, because pages are where features are composed (Discover uses search results, the items save mutation, and the collections list). |
| `src/components/ui/`   | Generated shadcn primitives. `src/components/common/` holds app-level composites (EmptyState, PageHeader, PageSkeleton).                                                                                                                                                                              |
| `src/testing/`         | `render.tsx` renders with the real providers and a memory router; `stubApi` answers fetch by method and path.                                                                                                                                                                                         |

Rules: all HTTP goes through `lib/api`; error toasts are global unless a query or mutation sets
`meta.silentError` (forms show errors inline); the session is a query (`useSession`) where a 401 is a
normal null answer, and mutations update it directly so the UI never waits for a refetch; routes that
need a user wrap in `RequireAuth`, which returns visitors to where they were after login.

In development Vite proxies `/api` to the backend so cookies stay first-party. Tests sit beside the
component they cover (`Name.test.tsx`).

### Optimistic updates

Item and board mutations (`frontend/src/features/items/queries.ts`, `frontend/src/features/collections/queries.ts`) update the
TanStack Query cache in `onMutate`, keep a snapshot, roll back in `onError`, and invalidate in
`onSettled`, so removing, captioning, and renaming feel instant and a failed request restores the
previous state. Removing an image offers Undo in the toast, which re-saves the same provider image
with its caption and tags; the backend reuses the stored file, so undo costs no new download.

### Discover

The query, orientation, and color live in the URL (`/?q=fog&orientation=vertical&color=blue`), so
searches are shareable and back/forward works; the input debounces before writing the URL. Results
are an infinite query paged by Pixabay's `page`, auto-loaded by an IntersectionObserver sentinel with
a "Load more" button as the keyboard and no-observer fallback. Each card paints the 150px preview
blurred underneath while the 640px image loads, sized by the real aspect ratio so nothing shifts.
Arriving from a board's "Add images" button carries `?board=<id>`, which turns Save into a one-click
action into that board; otherwise Save opens the board picker, which can also create a board inline.
A 409 from the API (already on that board) is shown as saved rather than as an error.

### Sharing and notifications

The share panel (`features/sharing/components/SharePanel.tsx`) is role-aware: owners create or revoke
the link and manage members; other members see the link, the list, and a Leave button. It receives the
board as a prop from the page, and the link mutations patch the cached board with the visibility change
the server applies (private becomes link-only), so the panel updates without waiting for the refetch.
`/s/:slug` renders the read-only shared board and, for members, a link into the full editor.

Notifications poll the inbox every 15 seconds while signed in (`features/notifications/queries.ts`),
which is enough for "someone added to your board" and needs no socket. Marking read is optimistic so the
badge clears at once. `text.ts` turns each notification type into one sentence from the reader's point
of view ("Grace added you to Kitchens").

## Enforcement

The rules above are checked by ESLint (`eslint.config.mjs`, `pnpm lint`) with eslint-plugin-boundaries,
using the TypeScript resolver so `.js` specifiers and the `@/` alias resolve to real files:

- Backend: `domain` imports only `domain`; `http` and `infrastructure` may use module ports but never
  module code; services, routes, controllers, and presenters may use other modules' services and ports
  but no adapters, not even their own; adapters may use ports, domain, infrastructure, and other
  adapters; only the composition files (`container.ts`, `app.ts`, `server.ts`, `http/router.ts`, the
  repository factory, seed, and migrate) may import anything.
- Frontend: features import only themselves and shared code; pages may import other features; the
  `app/` folder may import anything; shared code imports only shared code.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, Prettier, the unit suites, the Postgres-backed
repository tests against a service container, and the production build on every push and pull request.

### Landing hero

`/` is `ExploreCanvas` (`frontend/src/components/explore/`), a full-viewport stage outside the app
shell. Public boards from `GET /api/explore` are placed at twelve fixed slots on a stage 40% larger
than the viewport; each slot has a depth from 0.3 to 1 and the images translate against the cursor
by `travel * depth`, spring-smoothed with `motion`. A pale dot replaces the native cursor and grows
over images. Reduced-motion and touch users get the same scatter with no tracking and the native
cursor. The two stage colors are tokens (`--stage`, `--stage-ink`) in `src/index.css`. The feel is
tuned in `useParallax.ts` (`DEFAULT_TUNING`): travel, stiffness, damping, cursor stiffness; the dot
size and hover scale are constants at the top of `ExploreCanvas.tsx`. Search lives at `/discover`.
