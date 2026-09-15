Wumboo - Image Saving & Sharing App
Change++ Fall 2026 Coding Challenge

Name:  Brandon Lee
Email: <your Vanderbilt email>

Wumboo is a Pinterest-style app built around the sentence in the challenge: you find something,
save it somewhere, and then cannot find it again. Search millions of free photos (Pixabay), save
them to boards, organize and caption them, share a board by link or invite people to work on it
with roles, and get notified when a shared board changes.

------------------------------------------------------------
LIVE DEMO
------------------------------------------------------------
App:  https://wumbo.brandonnlee.com                 (frontend on Vercel)
API:  https://api.wumbo.brandonnlee.com/api/health  (backend on Railway)
The demo login below works there too. The frontend reaches the API through a same-origin /api
rewrite, so the two hosts behave like one site. Deployment notes: docs/DEPLOYMENT.md.

------------------------------------------------------------
HOW TO RUN
------------------------------------------------------------
Prerequisites: Node 20.19+ (24 recommended), pnpm 10 (corepack enable), Docker Desktop.

1. cp backend/.env.example backend/.env
   Then set PIXABAY_API_KEY (free key from https://pixabay.com/api/docs/) and JWT_SECRET
   (any 32+ character string, e.g. the output of `openssl rand -hex 32`).
2. docker compose up -d           # Postgres on localhost:5434
3. pnpm install
4. pnpm db:migrate                # creates the tables
5. pnpm db:seed                   # demo accounts and eight boards, five public (downloads ~60 photos)
6. pnpm dev                       # frontend http://localhost:5173, API http://localhost:4000

Demo login:  demo@wumboo.app / demo-password-123
Second user: sam@wumboo.app  / demo-password-123 (shares the "Tide pools" board with the demo user)

Optional: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env to enable
"Continue with Google" (register http://localhost:5173/api/auth/google/callback as the redirect URI).

Checks: pnpm typecheck, pnpm lint, pnpm test (unit and route tests, no database needed),
pnpm --filter @wumboo/backend test:db (repository tests against the Docker Postgres).

------------------------------------------------------------
WHAT IS INSIDE
------------------------------------------------------------
backend/   Express 5 + TypeScript REST API, Postgres via Drizzle, grouped by feature module
frontend/  Vite + React 19 + TypeScript, Tailwind + shadcn/ui, TanStack Query, React Router
shared/    The API contract: zod schemas both sides import, so client and server cannot drift
docs/      ARCHITECTURE.md (layers, design patterns, decisions) and API.md (every endpoint)

Features: accounts (email/password and Google), boards with private / link-only / public
visibility, image search with filters, save with one click, captions and tags, move between
boards, remove with undo, share links, collaborators with editor/viewer roles, notifications,
Explore page for public boards, dark mode. Saved images are downloaded and served by the API,
because Pixabay's URLs expire; searches are cached for 24 hours as Pixabay requires.

------------------------------------------------------------
REFLECTION (under 100 words)
------------------------------------------------------------
I treated this like a small production system instead of a demo: a shared zod contract, a
backend split into feature modules with ports and adapters, and lint rules that enforce the
boundaries. The most instructive bug was ordering breaking in tests because the Node clock and
the Postgres clock disagreed by milliseconds, which is why every timestamp now comes from the
database. Reading Pixabay's terms also changed the design: hotlinking is not allowed, so saving
downloads the image.

------------------------------------------------------------
FEEDBACK
------------------------------------------------------------
The prompt is a great size for a week. Two suggestions: the rubric's point totals do not match
their headers (Core Features says "up to 3" but lists a 5-point tier), and it would help to say
up front whether graders run the project locally or expect a deployed link, since that decides
how much effort belongs in setup instructions versus hosting.
