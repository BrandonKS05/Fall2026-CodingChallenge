# Deployment

Backend on Railway at `https://api.wumbo.brandonnlee.com`, frontend on Vercel at `https://wumbo.brandonnlee.com`,
Postgres from Railway's plugin, images on a Railway volume.
The frontend calls the API through a same-origin `/api` rewrite, so cookies stay first-party and no
CORS or `SameSite=None` work is needed.

## Backend (Railway)

Create a service from this repository with the **root directory left at the repo root**. The backend
imports `@wumboo/shared` from the workspace, so a service rooted at `backend/` cannot build.
`railway.json` at the repo root supplies the build and deploy settings:

| Setting            | Value                                      | Why                                                                              |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Pre-deploy command | `pnpm --filter @wumboo/backend db:migrate` | applies pending migrations before the new version starts serving                 |
| Start command      | `pnpm --filter @wumboo/backend start`      | runs the server with tsx (a runtime dependency)                                  |
| Health check       | `/api/health`                              | returns 503 while the database is unreachable, so bad deploys never take traffic |

Add a **Postgres** service and a **Volume** mounted at `/data` on the backend service, then set:

| Variable                                   | Value                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                                |
| `DATABASE_URL`                             | reference the Postgres service's `DATABASE_URL` (the internal `.railway.internal` host)     |
| `JWT_SECRET`                               | 32+ random characters, e.g. `openssl rand -hex 32`                                          |
| `PIXABAY_API_KEY`                          | your key                                                                                    |
| `APP_URL`                                  | the frontend origin, `https://wumbo.brandonnlee.com` (no trailing slash)                    |
| `CORS_ORIGIN`                              | same value as `APP_URL`                                                                     |
| `STORAGE_DRIVER`                           | `local`                                                                                     |
| `STORAGE_LOCAL_DIR`                        | `/data/images` (inside the volume, so images survive deploys)                               |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional; add `<APP_URL>/api/auth/google/callback` as a redirect URI in Google Cloud        |
| `OPENAI_API_KEY`                           | optional; embeddings for the recommendation feed. Without it the feed is popularity-ordered |
| `RESEND_API_KEY`, `EMAIL_FROM`             | optional, but both or neither; without them sign-up cannot send a verification code         |
| `WUMBO_AI_URL`                             | the assistant service's internal Railway URL; `/api/chat` is forwarded there                |

`PORT` is injected by Railway and read automatically. Do not set `PIXABAY_BASE_URL`.

Seed the production database by setting `SEED_DEMO=true` on the service: the server seeds on its next boot,
after it starts listening, so the health check passes while images download. The flag is safe to leave on
because the seed is idempotent and resumable: it creates only what is missing, so a boot cut short mid-seed
(a redeploy, a provider outage) finishes on the next one. (A one-off shell also works: `railway ssh` then
`pnpm --filter @wumboo/backend db:seed`.)

Saved images live on the volume; if a file is ever lost anyway, the API re-downloads it from the provider
the next time it is requested. The volume is still what keeps a redeploy from re-downloading every image.

## Assistant (Railway)

`services/wumbo-ai` is a second Railway service from the same repository, with its root
directory set to `services/wumbo-ai`. It needs only `OPENAI_API_KEY`; the build and start
commands come from `nixpacks.toml` in that folder.

That file is there for a reason: the folder also contains a `package.json`, purely as a hook so
`pnpm dev` starts the service with everything else. Without `providers = ["python"]` the builder
sees that file and tries to build a Node service, which fails.

It does not need a public domain. The browser never calls it: the API forwards `/api/chat` to
whatever `WUMBO_AI_URL` points at, so the internal `.railway.internal` host is enough and there
is no CORS to configure. With the service missing or asleep the widget says it cannot reach its
brain and nothing else is affected.

## Frontend (Vercel)

Import the repository, set the **root directory to `frontend`**, framework Vite, build command
`pnpm build`, output `dist`. Vercel installs the workspace from the repo root automatically.
`frontend/vercel.json` proxies `/api/*` to the API domain and serves `index.html` for every other
path so client-side routes work on reload. There is no `VITE_API_URL`: the browser only ever talks to
its own origin, which is what keeps the session cookie first-party.

## Checklist after the first deploy

1. `https://api.wumbo.brandonnlee.com/api/health` answers 200 with `database: ok` and
   `storage: ok`. A `storage` error means the directory `STORAGE_LOCAL_DIR` points at is not writable,
   usually because the volume is not mounted at `/data`.
2. `https://wumbo.brandonnlee.com/api/health` answers the same through the rewrite.
3. Register, log in, and reload: the session persists (cookie is `Secure`, `SameSite=Lax`, same-site via the rewrite).
4. Search returns real results, saving downloads an image, and the image still loads after a redeploy (volume).
5. If Google is configured, "Continue with Google" completes on the production domain.
