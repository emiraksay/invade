# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Vite + React + TypeScript, mobile-first, on Vercel | Opens from a link with no install; one app for the iPhone (Player view) and the Mac (big screen) |
| Rules | `packages/engine`: pure TypeScript, Vitest | One rulebook used by the server (the truth) and the app (preview) |
| Server | Vercel functions in `apps/web/api/*` | Imports the engine directly and holds the secrets |
| Data and live sync | Supabase: Postgres, RLS, Realtime | Every screen updates within about a second |
| Steps | **Apple Health via the "Invade Sync" iOS Shortcut** | Web apps can't read HealthKit. A Shortcut can, and posts today's total to our API |
| AI | Claude API, server-side only | Nudges first; strategist and commentator later |

## How game data works (follow these rules)

1. **The server is the source of truth.** Clients send facts (step totals) and intentions (night orders, later); the server validates, applies the engine and stores.
2. **Store facts, derive the rest.** Tables hold `step_reports` and `events`. Soldiers, team bonus, team totals and map fill are computed by the engine (`summarizeTeamDay`) and never stored as truth.
3. **One rulebook.** Never re-implement a rule in the UI; import it from `@invade/engine`.
4. **Idempotent writes.** The Shortcut sends *cumulative* steps for the day. `report_steps()` keeps the max per (player, day) atomically, so resends never double-count.
5. **The server owns the clock.** The game day is computed in the game timezone (`gameDayOf`); phase deadlines are server timestamps.
6. **Snapshot, then subscribe.** Load state once, then apply Realtime changes; reload the snapshot after reconnecting.
7. **Optimistic UI where it helps,** with the server's confirmed value always winning.
8. **Read freely, write through the API.** RLS allows reads only. Every write goes through `apps/web/api/*`, which authenticates (sync token), validates with zod and returns `ApiResult` (`{ ok, data } | { ok, error }`), never leaking internals.
9. **The map renderers never read game data directly.** They draw a `MapView` built by `apps/web/src/map/model.ts` from engine output (`DEFAULT_MAP`, `summarizeTeamDay`). When the night phase adds territory state to the engine contracts, only `model.ts` changes.

## Steps data flow

```
Apple Health ── "Invade Sync" Shortcut (automation at set times, or the in-app Sync button)
   └─ POST /api/steps { token, day, steps }
        → hash the token → look up the player in player_secrets
        → zod validation (0 ≤ steps ≤ 100k, day within ±1 of the server's game day)
        → report_steps(): atomic keep-max → before/after
        → engine soldiersGained(before, after) > 0 → INSERT events { type: 'milestone' }
Supabase Realtime ── step_reports and events changes ──▶ every open screen
Screens ── engine.summarizeTeamDay(...) ──▶ team totals, soldiers, map fill
```

**Apple Watch:** Health stores steps from both the iPhone and the Watch. The Shortcut counts iPhone-recorded steps only, to avoid double counting (verified against the Health app).

## Contracts (announce changes in chat before merging)

- `packages/engine/src/types.ts`: domain types
- `packages/engine/src/steps.ts`: milestones, cap, team bonus, keep-max rule
- `packages/engine/src/map.ts`: the deterministic map
- `packages/engine/src/api.ts`: HTTP request/response types and `ApiResult`
- `supabase/migrations/*`: the schema. **One owner** (backend) creates migrations, to avoid ordering clashes between branches.

## Environment variables (`.env.example`)

| Name | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client | no (public by design) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel functions only | **yes** |
| `ANTHROPIC_API_KEY` | Vercel functions only | **yes** |
