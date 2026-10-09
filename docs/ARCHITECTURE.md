# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Vite + React + TypeScript, mobile-first PWA, deployed on Vercel | Opens from a link/QR with no install; the same app runs on the Mac (Table view) and on iPhones (Player view) |
| Game rules | `packages/engine`: pure TypeScript, no UI or network code, unit-tested with Vitest | Shared by the app (odds, previews) and the server (authoritative state) |
| Server | Vercel functions in `apps/web/api/*` (Node) | Imports the engine directly; holds the secret keys |
| Data + live sync | Supabase: Postgres, anonymous auth, Realtime | Everyone sees state changes instantly |
| AI | Claude API, called from the server only | The dealer's lines, the nightly recap, the odds advice |
| Steps | The browser's motion sensor on iPhone (`DeviceMotionEvent`, needs one permission tap) plus a simulated source in demo mode | Native HealthKit is the post-hackathon roadmap |

## Two views, one app

| Route | Device | Shows |
|---|---|---|
| `/` | phone | Splash, profile (name and colour), create or join a game |
| `/lobby/:code` | phone | Two team lists, host controls (switch, kick, ban), settings |
| `/play/:code` | phone | Player view: Walk Phase timer and step counter, then Place → Attack → Move, team stats, nav bar |
| `/table/:code` | Mac / projector | Table view: the big map, dice animations, live odds, the dealer's voice, the battle log, a QR code to join |

## Data flow

```
phone/mac ──reads──▶ Supabase (games.state, players, events) ◀──Realtime── everyone
    │
    └──writes──▶ POST /api/* (Vercel) ──▶ engine.applyAction(state, action)
                                       ──▶ UPDATE games SET state, version = version + 1 WHERE version = expected
                                       ──▶ INSERT events (battle, captured, steps_converted, …)
                                       ──▶ /api/dealer → Claude → INSERT events (dealer_line)
```

- **The server is the only writer.** Clients never write game state directly (RLS blocks it).
- **Optimistic concurrency:** each action sends `expectedVersion`. On a `409 conflict` the client refetches and retries.
- **The Move Phase is turn-based** (`activeTeam`, then `moveStep`: place → attack → fortify) so two phones can't race each other.
- **Randomness** lives only on the server (an injected `Rng`), so dice can't be faked from a phone.

## Contracts (change only with a heads-up in chat)

- `packages/engine/src/types.ts`: GameState, Player, Territory, actions, events
- `packages/engine/src/index.ts`: engine function signatures
- `packages/engine/src/api.ts`: HTTP request and response types
- `supabase/migrations/0001_init.sql`: DB schema and RLS

## AI: what is code and what is the LLM

| Feature | Computed by code | What the LLM does |
|---|---|---|
| Handicap | `computeHandicap`: median of recent walk phases → personal steps-per-soldier | Nothing (it's transparent maths) |
| Battle odds | `battleOdds`: exact dynamic programming over Risk dice | Nothing |
| Season odds | `seasonOdds`: Monte Carlo simulation | Turns the numbers into advice: "Walk 4,000 more steps to flip it" |
| Anti-cheat | `assessSteps`: heuristics on cadence and regularity | Nothing |
| Dealer | — | Casino-host lines, taunts and the nightly recap; spoken through the browser's built-in speech synthesis |

## Environment variables (`.env.example`)

| Name | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client | no (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only | **yes** |
| `ANTHROPIC_API_KEY` | Vercel only | **yes** |
