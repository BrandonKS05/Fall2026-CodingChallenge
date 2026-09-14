Trove - Image Saving & Sharing App
Change++ Fall 2026 Coding Challenge

Name:  Brandon Lee
Email: <your Vanderbilt email>

------------------------------------------------------------
HOW TO RUN
------------------------------------------------------------
Prerequisites: Node 20.19+ (24 recommended), pnpm 10, Docker

1. docker compose up -d                    # Postgres on localhost:5434
2. pnpm install
3. cp backend/.env.example backend/.env    # then add your Pixabay API key
4. pnpm db:migrate && pnpm db:seed
5. pnpm dev                                # frontend http://localhost:5173, API http://localhost:4000

Demo login: (created by the seed script; filled in once seeding exists)

------------------------------------------------------------
REFLECTION (under 100 words)
------------------------------------------------------------
TODO

------------------------------------------------------------
FEEDBACK
------------------------------------------------------------
TODO
