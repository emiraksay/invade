# Pitch notes: why the AI is essential, and how we built this

For the 16:00 judging. One page. Read it once before, then talk, don't read.

## The one-liner

**Invade: play, walk, conquer.** Friends form two teams. Every step you take today, straight from Apple Health, becomes soldiers your team uses tonight to take a shared map. Fitness apps die because nothing is at stake; here your steps matter to your friends, every day.

## What the AI does, and what it is not allowed to do

Decision 14 in our log: *AI must be essential, not decoration. Code computes every number; Claude only writes words.*

| | Code decides (engine, tested) | Claude writes |
|---|---|---|
| **The Nudge** (live today) | who on your team is short of a milestone, how many steps to go, how many soldiers it adds, whether it unlocks the team bonus, who comes first | one personal message per teammate, warm, specific to those numbers, ready to send in one tap |
| Night strategist (next) | the exact win odds of every possible attack | which attacks to recommend and why, in plain words |
| Commentator (next) | the battle results | the call of each battle and the shareable nightly recap |

Why the split: a game people bet their effort on needs numbers nobody can argue with. The engine is pure TypeScript with 35 tests; the same rulebook runs on the server and in the app. Claude gets the facts as JSON and returns JSON, validated. If the model is down or slow, a template message takes over and the screen says so. The feature can never break the demo.

**Live example on stage:** tap *Who needs a nudge?* The list and the numbers come from the engine; the sentence comes from Claude Opus 5.5, structured output, about one second, a fraction of a cent per tap.

## How we built it today (the "how hard did you push the agents" question)

- **Four people, one morning.** Everything a judge sees was built between 09:00 and 14:30 on top of a walking skeleton (join, sync, walk screen) merged early this morning.
- **Every builder runs Claude Code in their own worktree**, small PRs, squash merges, CI on every PR: typecheck, lint, 68 tests, build, and a check that the server bundle is current. about 15 PRs merged by noon, around 20 by freeze.
- **Agents reviewing agents.** Each batch of work got a cold review from a fresh agent that did not write the code, with a checklist, plus a specialist review (three.js on iPhone Safari). Confirmed findings only were fixed: error boundary, WebGL context loss, render-on-demand for battery, tone mapping.
- **Dev previews with fake data** (`/preview/walk`, `/preview/table`, `/preview/map`) so screens were checked at phone width before the database existed, and bugs found there, not on stage.
- **A decisions log** (`docs/DECISIONS.md`) so no agent, and no person, undoes a decision by accident. Rules, contracts and docs are the single source of truth for every Claude session.
- **Token count:** fill in from `npx ccusage@latest daily` on each laptop before 16:00: ______.

## Questions they will ask

- **"Why not let the AI decide who attacks whom?"** Because then the game is the AI's, not the friends'. The AI advises; people choose; code keeps score.
- **"What if the model refuses or is down?"** Template fallback, the screen says "Claude is offline", the game continues.
- **"Health data?"** Only today's step total, sent by the player's own Shortcut with a private token that we store hashed. Reads are public by design, writes only through the server.
- **"Is this a fitness app or a game?"** A game that happens to make you walk. The map is the scoreboard.
- **"Real money?"** Not today, decision 15. Virtual stakes; real pots need a licence in Spain, that's the business model question, not the product.
- **"What's next?"** Tonight: the night phase, place, move, attack in secret, Ready, reveal. Then the strategist and the commentator, same rule: code computes, Claude narrates.
