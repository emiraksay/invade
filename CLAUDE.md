# Invade

Hackathon project (demo 10 Oct 2026, 16:00; feature freeze 14:30). Two teams of friends; every step you take today, read from Apple Health, becomes soldiers your team uses to take a shared map. Tagline: "Play. Walk. Conquer."

**Read `docs/DECISIONS.md` before proposing any big change.** Don't undo a logged decision without Emir's OK.
Docs: `docs/DECISIONS.md` (why), `docs/PRODUCT.md` (spec), `docs/ARCHITECTURE.md` (stack, data flow, contracts), `docs/DESIGN.md` (Figma screens).

## Layout

- `apps/web`: Vite + React app (phone Player view + Mac Table view) and Vercel API functions in `apps/web/api`
- `packages/engine`: pure TS game rules, shared types and API contracts. No UI/network imports. Tests: `npm test -w packages/engine`
- `supabase/migrations`: DB schema

## Commands

- `npm run dev`: app + local API at http://localhost:5173 (needs `apps/web/.env.local`, see `.env.example`)
- `npm test` / `npm run typecheck` / `npm run lint`: run all three before opening a PR (CI enforces them)
- Server code lives in `apps/web/server` (handlers are pure over a `Repo`, unit-tested). **After changing anything under `apps/web/server` or `packages/engine`, run `npm run build:api -w apps/web` and commit `apps/web/api/[route].js`** (the generated single-file bundle Vercel runs; CI fails if it's stale).
- Steps come only from Apple Health via the "Invade Sync" Shortcut: see `docs/SHORTCUT.md`.

## Contracts

`packages/engine/src/{types,index,api}.ts` and `supabase/migrations/*` are shared contracts. Don't change them casually; if a change is needed, tell the user to announce it to the team first.
The server is the only writer of game state; the LLM never computes odds or rules (code does).

## Git workflow (mandatory, see CONTRIBUTING.md)

- Never commit or push to `main`. Always work on a branch named `feat|fix|chore|docs/<area>-<thing>`.
- Before starting: `git switch main && git pull`, then create the branch.
- Use conventional commits (`feat(engine): ...`). Commit small and push at least hourly.
- Open PRs with `gh pr create --draft --fill` and include `Closes #<issue>`. Squash-merge only.
- Before marking a PR ready: `git pull --rebase origin main` and make sure checks pass.
- Never commit secrets or `.env*` files other than `.env.example`.
- If a change touches shared contracts (engine types, DB schema, function signatures), tell the user to announce it to the team before merging.

## Where rules live

- This file and `CONTRIBUTING.md` are the single source of truth for team rules. Change them only via PR.
- Personal preferences go in `CLAUDE.local.md` (gitignored) or `~/.claude/CLAUDE.md`, never in shared files.
