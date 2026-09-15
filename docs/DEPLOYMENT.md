# Deployment

Backend on Railway, frontend on Vercel, Postgres from Railway's plugin, images on a Railway volume.
The frontend calls the API through a same-origin `/api` rewrite, so cookies stay first-party and no
CORS or `SameSite=None` work is needed.

## Backend (Railway)

Create a service from this repository with the **root directory left at the repo root**. The backend
imports `@trove/shared` from the workspace, so a service rooted at `backend/` cannot build.
`railway.json` at the repo root supplies the build and deploy settings:

| Setting            | Value                                     | Why                                                                              |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Pre-deploy command | `pnpm --filter @trove/backend db:migrate` | applies pending migrations before the new version starts serving                 |
| Start command      | `pnpm --filter @trove/backend start`      | runs the server with tsx (a runtime dependency)                                  |
| Health check       | `/api/health`                             | returns 503 while the database is unreachable, so bad deploys never take traffic |

Add a **Postgres** service and a **Volume** mounted at `/data` on the backend service, then set:

| Variable                                   | Value                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                            |
| `DATABASE_URL`                             | reference the Postgres service's `DATABASE_URL` (the internal `.railway.internal` host) |
| `JWT_SECRET`                               | 32+ random characters, e.g. `openssl rand -hex 32`                                      |
| `PIXABAY_API_KEY`                          | your key                                                                                |
| `APP_URL`                                  | the frontend origin, e.g. `https://trove.vercel.app` (no trailing slash)                |
| `CORS_ORIGIN`                              | same value as `APP_URL`                                                                 |
| `STORAGE_DRIVER`                           | `local`                                                                                 |
| `STORAGE_LOCAL_DIR`                        | `/data/images` (inside the volume, so images survive deploys)                           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional; add `<APP_URL>/api/auth/google/callback` as a redirect URI in Google Cloud    |

`PORT` is injected by Railway and read automatically. Do not set `PIXABAY_BASE_URL`.

Seed the production database by setting `SEED_DEMO=true` on the service: the server seeds on its next boot,
after it starts listening, so the health check passes while images download. The flag is safe to leave on
because the seed is idempotent and resumable: it creates only what is missing, so a boot cut short mid-seed
(a redeploy, a provider outage) finishes on the next one. (A one-off shell also works: `railway ssh` then
`pnpm --filter @trove/backend db:seed`.)

Saved images live on the volume; if a file is ever lost anyway, the API re-downloads it from the provider
the next time it is requested. The volume is still what keeps a redeploy from re-downloading every image.

## Frontend (Vercel)

Import the repository, set the **root directory to `frontend`**, framework Vite, build command
`pnpm build`, output `dist`. Vercel installs the workspace from the repo root automatically.
`frontend/vercel.json` proxies `/api/*` to the Railway domain and serves `index.html` for every other
path so client-side routes work on reload. Replace the placeholder domain in that file with the
backend's public Railway domain.

## Checklist after the first deploy

1. `https://trovebackend-production.up.railway.app/api/health` answers 200 with `database: ok` and
   `storage: ok`. A `storage` error means the directory `STORAGE_LOCAL_DIR` points at is not writable,
   usually because the volume is not mounted at `/data`.
2. `https://fall2026-coding-challenge-frontend.vercel.app/api/health` answers the same through the rewrite.
3. Register, log in, and reload: the session persists (cookie is `Secure`, `SameSite=Lax`, same-site via the rewrite).
4. Search returns real results, saving downloads an image, and the image still loads after a redeploy (volume).
5. If Google is configured, "Continue with Google" completes on the production domain.
