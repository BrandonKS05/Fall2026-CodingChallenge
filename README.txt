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
