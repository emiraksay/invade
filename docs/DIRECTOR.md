# The AI Director

Status: **proposal** (Varya, 10 Oct 2026). Engine rules and the server writer are built and tested
(`packages/engine/src/director.ts`, `apps/web/server/director.ts`); nothing is wired to the app yet.
It assumes the **weekly format** (7 zones, one fight a day, see the "Invade Weekly" proposal).
Needs Emir's OK and a new entry in `DECISIONS.md` before it ships (see "Decision to log").

## What it is

Every morning an AI **Director** reads the whole week and issues **one decree** that changes the
rules of that day: steps after 20:00 count double, a duel between two players, a zone that revolts,
and so on. The goal is a week that stays close and fun until Sunday night, and a reason for
*everyone* to walk, not only the fittest player.

It is the game's plot twist, done safely: the AI makes the choice and tells the story, but the
**code** decides what is allowed and what each decree does. The AI can never invent a rule, a number
or a winner.

## Principles

1. **Code owns the rules.** The engine lists today's allowed decrees with exact parameters. The
   model picks one by its number. Anything else is rejected.
2. **Announced before it counts.** The decree is published in the morning and never changes during
   the day. Nothing is retroactive.
3. **Fair by construction.** Most decrees apply to both teams. Help for the trailing team is
   limited (at most 2 per week) and only when the gap is real.
4. **Never blocks the game.** If the model is slow, down or answers nonsense, the engine's own
   deterministic choice and a template text are used. The game never waits.
5. **Same facts, same options.** Eligibility is a pure function of the week's state, so it is
   testable, replayable and explainable ("why did they get reinforcements?").

## The daily loop

| Time (Europe/Madrid) | What happens |
|---|---|
| 07:00 | Server builds the week's state, the engine lists the allowed decrees, the Director picks one and writes the announcement. Stored as an event; everyone's phone and the big screen show it (Realtime). |
| All day | Players walk and sync as usual. The decree card shows live progress where it applies (duel score, "3 of 4 teammates at 4,000"). |
| 20:00 (night march only) | Reminder: "Sync now, the night march starts". |
| 23:59 | The day's battle is resolved with `applyDecree`: soldiers and zone points after the decree. Results screen shows the decree's effect in one line each. |
| 00:00 | The decree expires. A new day, a new decree at 07:00. |

## The decree menu

All parameters come from small fixed lists in the engine (`director.ts`, "Tuning").

| Decree | What it does | When it is allowed | Parameters |
|---|---|---|---|
| **Quiet** | Nothing: a plain battle | Always | – |
| **Night March** | Steps from a set hour to midnight count double (can push a player over a milestone) | Not two days in a row | from 19:00, 20:00 or 21:00 |
| **Duel** | Two players of similar level, one per team. Whoever walks more today wins soldiers for their team | Players whose recent daily averages are within 35% of each other; nobody in two duels; not two days in a row | prize 4 soldiers; up to 3 pairs offered |
| **All Hands** | A team where every member walks at least N steps gets extra soldiers. Both teams can earn it | Not two days in a row | N = 4,000 or 6,000; prize 4 |
| **Double Stakes** | Today's zone is worth twice its points | Day 3 or later, and only while the week is still open | points × 2 |
| **Reinforcements** | The trailing team's soldiers count 50% more today | Trailing by 2+ points, not on the final day, comeback budget left | +50% |
| **Rebellion** | A zone the leader holds revolts and is fought for again today, next to the zone of the day | Only when the week would otherwise be **decided** (the trailing team can't catch up even taking every point left), comeback budget left | one option per zone the leader holds |

**Comeback budget:** Reinforcements and Rebellion together, at most 2 per week.
**Decided week:** `trailing points + points left < leader points` (`isDecided`).

## How the AI decides

Input to the model (JSON): team names, day of the week, points, points left, today's zone, zones
held, every player's steps on the previous days, the last 3 decrees, and the numbered list of
allowed decrees with the reason each is allowed.

Instructions, in short:
- Keep the week exciting and close until the final day; get everyone walking.
- If one team is running away, prefer a comeback decree when offered.
- If it's close, raise tension (double stakes late, a well-matched duel).
- Prefer variety; a quiet day is fine now and then.
- Write a headline (1–3 words) and a 2–3 sentence announcement in a war-chronicle tone, using first
  names and exact numbers. No shaming, at most one emoji, no invented facts.

Output (structured JSON, validated with Zod): `{ option: number, title: string, story: string }`.
`option` must be an index into today's list; otherwise the fallback is used.

**Fallback** (`fallbackDecree`): Rebellion → Reinforcements → Double Stakes → Duel → Night March →
Quiet, the first one allowed, with a template announcement (`templateAnnouncement`).

Model: `claude-opus-5-5` with low effort and structured output, the same setup as the nudges.
One call per game per day, so the cost is negligible.

### Example

Friday (day 5). Black leads 4–0 with 3 points left, so the week is decided.

> **Born Rises**
> Born has had enough of Black's rule. Tonight it is fought for again, right next to the Harbour.
> White, two zones at once: the week isn't over yet. ⚔️

On Tuesday with the score at 1–1, the same Director might pick a duel instead:

> **Duel at Dawn**
> Varya (8,500 a day) against Emir (8,750 a day). Whoever walks more today wins 4 soldiers for their team.

## Resolving the day

`applyDecree(decree, facts, zonePoints)` returns the soldiers each team brings, what the zone is
worth, and the extra zone (Rebellion). Base soldiers are the usual milestones (5k = 4, 10k = 8,
12k = 10). The weekly rules add the team bonus and compare per player if teams are uneven.

**Night March needs "steps after the hour".** Steps arrive as daily totals from the Shortcut. We
take the last report before the hour as the baseline: `late = final total − total at the hour`.
With no report before the hour there is no baseline and no double steps, so the 20:00 reminder asks
everyone to sync. (Hourly automatic syncs would remove this limit.)

## Data and API

- **Storage:** an `events` row with `type = 'decree'` and the `DayDecree` as payload
  (`{ day, decree, title, story, writer }`). No migration: the events table is generic, like
  `battle`.
- **Issue:** `POST /api/director` (called by a Vercel cron at 07:00, protected by a secret). Idempotent:
  if today's decree exists, it is returned, not reissued.
- **Read:** clients get decrees with the other events (Realtime), like battles.
- **History:** this week's decree events become `DirectorState.history`.

## UI

- **Walk screen:** a decree card under the stats bar: headline, story and live progress (duel
  score, all-hands checklist, night-march countdown).
- **Big screen (/table):** the headline as a banner, and the story read out at the 07:00 reveal.
- **Results (midnight):** one line per effect, e.g. "Duel: Varya won, +4 for White".
- **Rules screen:** the full menu and the comeback rules, so nobody thinks the AI is cheating.

## What's built and what's next

| Part | State |
|---|---|
| Engine: menu, eligibility, fairness rules, validation, fallback, `applyDecree` | ✅ built, 17 tests |
| Server: Claude writer, structured output, fallback, templates | ✅ built, 4 tests (not routed) |
| Weekly format (zones per day, points, weekly reset) | ⏳ needed first |
| `POST /api/director` + cron + `decree` events | ⏳ |
| Walk screen card, /table banner, results lines | ⏳ |
| Night march baseline from step reports | ⏳ |

## Decision to log (needs Emir)

Decision 14 says *"Code computes all numbers; Claude only writes words."* The Director keeps the
first half (every number and every allowed option comes from code) and extends the second: **Claude
also chooses one of the options the code allows.** Suggested entry:

> **19 | AI Director**: each morning Claude picks one decree from a list the engine allows (exact
> parameters), and announces it. Code owns eligibility, effects and fairness limits; invalid picks
> fall back to the engine's choice. | Keeps the week close and gives the AI a real role in the game
> | AI inventing rules or numbers; a fixed random schedule (no story, no reaction to the game)

## Open questions

1. Is a decree issued at 07:00 early enough, or should it come the evening before?
2. Should players see *why* a decree was allowed (the `why` text), or only the story?
3. Comeback budget: 2 per week, or 1?
4. Do we want a duel prize in soldiers, or in points?
5. Should the Director also send each player a personal line (merging with the AI General)?
