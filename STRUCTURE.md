# Sentinel Atlas Structure

- `client/src/pages/Home.tsx`: analyst dashboard, synthetic lab, and card-based cyber-defense roguelike.
- `server/routers.ts`: safety-bounded reasoning, deterministic simulations, game scoring, and evaluation record creation.
- `server/db.ts`: persistence for threat analyses, simulations, quarantine records, XP progression, game runs, and evaluation corpus.
- `drizzle/schema.ts`: database schema for users, threat analyses, simulations, zombie quarantine, player progress, game runs, evaluation records, and learning candidates.
- `server/*test.ts`: safety, catalog, scoring, and auth tests.

The game is intentionally UI-native rather than an offensive execution engine. Any future lab adapter must sit behind a separate policy gate, explicit scope, human approval, isolated environment, snapshot/cleanup lifecycle, and no inherited access to production systems.
