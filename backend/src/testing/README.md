# Test support

Test files sit next to the code they cover (`Name.test.ts`, or `Name.db.test.ts` for
tests that need Postgres). This folder holds only what tests share:

- `fakes/` — in-memory implementations of the ports, with the same domain errors as the real adapters.
- `testApp.ts` — builds the Express app with a test environment and injected fakes.
- `fakeRepositories.ts` — one consistent set of fakes sharing the same users.
- `testDatabase.ts` — creates, migrates, and truncates the `trove_test` database for `*.db.test.ts`.

Nothing here is imported by production code.
