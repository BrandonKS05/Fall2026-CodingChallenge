Wumboo 
Change++ Fall 2026 Coding Challenge

Name:  Brandon Lee
Email: jin.woo.lee@vanderbilt.edu

Wumboo is a Pinterest-style app where you can search millions of free photos (Pixabay),
keep them on boards, caption and reorder them, share a board by link or invite people to 
edit it with you, and hear about it when a shared board changes.

    docs/ARCHITECTURE.md   Full design 
                          
    docs/API.md            Every endpoint


https://wumbo.brandonnlee.com

Sign in with the demo account

    demo@wumboo.app / demo-password-123
    sam@wumboo.app  / demo-password-123  

Or run it yourself. Needs Node 20.19+, pnpm 10 (corepack enable), and Docker.

    cp backend/.env.example backend/.env   # set PIXABAY_API_KEY and JWT_SECRET
    docker compose up -d                   # Postgres on localhost:5434
    pnpm install
    pnpm db:migrate
    pnpm db:seed                           # demo accounts and boards
    pnpm dev                               # app on :5173, API on :4000

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
Future projects could include a starter repo with scaffolding, Postgres, and environment setup
already in place. That would put more of the time budget into the design decisions you're
actually grading.
