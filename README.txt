Wumboo - Image Saving & Sharing App
Change++ Fall 2026 Coding Challenge

Name:  Brandon Lee
Email: jin.woo.lee@vanderbilt.edu

Wumboo is a Pinterest-style app for the thing that happens to everyone: you find something,
save it somewhere, and then cannot find it again. Search millions of free photos (Pixabay),
keep them on boards, caption and reorder them, share a board by link or invite people to edit
it with you, and hear about it when a shared board changes.

============================================================
START HERE - IT IS ALREADY RUNNING
============================================================

    https://wumbo.brandonnlee.com

Nothing to install. Sign in with the demo account, or browse signed out to see
what a visitor gets.

    demo@wumboo.app / demo-password-123
    sam@wumboo.app  / demo-password-123   (shares a board with the demo account,
                                           so you can see collaboration)

------------------------------------------------------------
RUNNING IT LOCALLY (optional)
------------------------------------------------------------
Prerequisites: Node 20.19+ (24 recommended), pnpm 10 (corepack enable), Docker Desktop.

1. cp backend/.env.example backend/.env
   Set PIXABAY_API_KEY (free: https://pixabay.com/api/docs/) and JWT_SECRET (any 32+ characters).
2. docker compose up -d     # Postgres on localhost:5434
3. pnpm install
4. pnpm db:migrate
5. pnpm db:seed             # demo accounts and eight boards (downloads ~60 photos)
6. pnpm dev                 # app on http://localhost:5173, API on :4000

Everything else in backend/.env is optional: Google sign-in, OPENAI_API_KEY for the
recommendation feed and the assistant, Resend for real verification emails. Without Resend the
sign-up code is printed to the server log, which is how a fresh clone signs up with no mail
service.

Checks: pnpm typecheck, pnpm lint, pnpm test, and pnpm --filter @wumboo/backend test:db
(repository tests against the Docker Postgres).

------------------------------------------------------------
HOW IT IS BUILT
------------------------------------------------------------
React 19 + TypeScript with Tailwind and shadcn/ui on the front, Express 5 + TypeScript and
Postgres behind it, and a shared package of zod schemas both sides import so the client and the
server cannot drift apart.

    docs/ARCHITECTURE.md   the layers, the dependency rule that lint enforces, the design
                           pattern catalog, and why each decision went the way it did
    docs/API.md            every endpoint

------------------------------------------------------------
REFLECTION (under 100 words)
------------------------------------------------------------
The new thing was embeddings and vector search: pgvector, HNSW indexes. What it reinforced:
calling the model and storing the vector is never one decision. Every option had a side effect
with a wide blast radius. Embedding inside the request made a save hang whenever OpenAI did.
Embedding after meant the save landed before the vector existed, so the profile had nothing to
learn from. An in-memory queue loses rows on restart. I made the row its own queue and folded
interactions in once the vector arrived. Every wrong choice failed silently, so the call had to
be mine.

------------------------------------------------------------
FEEDBACK
------------------------------------------------------------
The prompt is a great size for a week. Two suggestions: the rubric's point totals do not match
their headers (Core Features says "up to 3" but lists a 5-point tier), and it would help to say
up front whether graders run the project locally or expect a deployed link, since that decides
how much effort belongs in setup instructions versus hosting.

Future projects could include a starter repo with scaffolding, Postgres, and environment setup
already in place. That would put more of the time budget into the design decisions you're
actually grading.
