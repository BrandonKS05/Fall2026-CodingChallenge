# Architecture

Living document. Describes the layers, the dependency rule, and the design pattern catalog.
Updated as each piece is implemented.

## Layout

| Folder      | Role                                                        |
| ----------- | ----------------------------------------------------------- |
| `frontend/` | Vite + React + TypeScript single-page app                   |
| `backend/`  | Express + TypeScript REST API                               |
| `shared/`   | zod schemas that define the API contract, used by both sides |
| `docs/`     | This file and the endpoint reference                        |

## Backend dependency rule

```
api  -->  services  -->  ports  <--  infrastructure
                 \        |
                  \-> domain (framework-free, used by every layer)

container.ts is the composition root and the only module that imports infrastructure.
```

## Frontend rules

- One folder per feature under `src/features/`. Features never import each other.
- Cross-feature composition happens only in pages and the router.
- All HTTP goes through the single gateway in `src/lib/api/`.

## Pattern catalog

| Pattern | Where | What it lets us swap |
| ------- | ----- | -------------------- |
| Adapter | `backend/src/infrastructure/logging/pinoLogger.ts` | pino sits behind the `Logger` port; services never import pino |
| Chain of Responsibility | `backend/src/app.ts` middleware order | add or remove cross-cutting steps (auth, rate limits) without touching routes |
| Composition root (dependency injection) | `backend/src/container.ts` | swap any infrastructure implementation in one place |
