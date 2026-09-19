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
The hardest part to implement was embeddings and vector search. Even after making it
functional, there was no one good solution that allowed fast and accurate experience.
I learned that almost every option had a side effect with a wide blast radius. So I 
had to make a decision with the least harmful trade off. I learned that something
as simple as a data ingestion pipeline has no perfect answer and even the best option
had its flaws and downside.
------------------------------------------------------------
FEEDBACK
------------------------------------------------------------
Future projects could include a starter repo with scaffolding, Postgres, and environment setup
already in place. That would put more of the time budget into the design decisions you're
actually grading.
