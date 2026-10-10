# Demo day: rehearsal checklist and script

Judging **16:00**. Feature freeze **14:30**. Rehearsal **15:30**, twice, on the real phones and the Mac. Decision #13: the demo is the real day's map on the Mac plus a live sync on stage; the night phase is shown only as the next step.

## Roles (fill in at 15:00)

| Role | Who |
|---|---|
| Talks (the 90-second script below) | |
| Drives the Mac (`/table` on the projector) | |
| Phone A: syncs on stage (iPhone, Shortcut installed, team White) | |
| Phone B: shows `/walk` to the judges afterwards (team Black) | |
| Backup: runs the fallback commands if something fails | |

## Before 15:30 (everything must be ticked)

**Deploy**
- [ ] `main` is deployed on Vercel (Emir redeploys; Kateryna's commits are blocked on the Hobby team).
- [ ] `https://invade.vercel.app/api/health` returns `ok` and `database: ok: INVADE game found`.
- [ ] Vercel env has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SHORTCUT_URL`, `ANTHROPIC_API_KEY`.

**Players and data**
- [ ] At least 3 players per team have joined (`/join`), with real names.
- [ ] Every walking player has the Invade Sync Shortcut installed and has synced at least once today (their name shows steps on `/walk`).
- [ ] One player on each team is **just below a milestone** (e.g. 4,700 or 9,600 steps) so a live sync on stage crosses it. Check at 15:00 and plan who walks the last few hundred steps.
- [ ] The Nudge shows at least one teammate with a message, written by Claude (footer says "words by Claude").

**Devices**
- [ ] Mac: `/table` open full-screen in Safari (⌃⌘F), bookmarks bar hidden, 100% brightness, Do Not Disturb on, charger connected, projector/HDMI tested, text readable from 3 m.
- [ ] Phone A and B: battery > 60%, brightness max, Do Not Disturb, Safari with `/walk` open and logged in, Low Power Mode **off** (it disables WebGL and animations).
- [ ] Phones and Mac on the same Wi-Fi or a hotspot that works in the judging room; the live dot on `/walk` shows "● Live".
- [ ] A second browser tab with `/table` ready on Phone B, in case the Mac dies.

**Fallbacks ready (paste into Notes on Phone B)**
- Apple Health sync fails → the backup posts a demo sync from a laptop (replace the token with the player's sync code from their Connect screen):
  ```bash
  curl -X POST https://invade.vercel.app/api/steps -H 'content-type: application/json' \
    -d '{"token":"INV-XXXX-XXXX-XXXX","steps":10050,"day":"2026-10-10","source":"demo"}'
  ```
- 3D map does not appear on a phone → nothing to do, the SVG map shows automatically.
- Claude is down → the nudge shows template text; say "the numbers are the game's, the words are usually Claude's".
- Realtime stalls (no "● Live") → reload the page; the snapshot reloads everything.
- Vercel is down → `npm run dev` on the Mac with `.env.local`, show `localhost:5173/table`.

## The 90-second script (rehearse twice)

| Time | Say | Do / what they see |
|---|---|---|
| 0–10 s | "Fitness apps die because nothing is at stake. In Invade, every step you take today is a soldier your team uses tonight." | Mac: `/table`, the live map, both teams' columns. |
| 10–25 s | "This is today, for real. Two teams of friends have been walking since nine this morning, straight from Apple Health." | Point at the columns: names, steps, soldiers, the team bonus. |
| 25–45 s | "Watch the map." → Phone A taps **Sync from Apple Health**. | The player's steps jump, a milestone is crossed, soldiers march into the HQ: the ripple runs across the team's half on the Mac within a second. **Stop talking and let it land.** |
| 45–65 s | "Who's holding the team back? Ask." → Phone A taps **Who needs a nudge?** | Read Claude's line aloud. Tap **Send**, the share sheet opens. "The game picks who and the numbers; Claude writes the words." |
| 65–80 s | "And tonight?" | Scroll to the **Tonight** card: soldiers marching in per team, then place, move, attack in secret, Ready, reveal. "That's the night phase, next on the roadmap." |
| 80–90 s | "One link, no app store, no account beyond a name. Real steps, real friends, one map." | Hand Phone B to a judge with `/walk` open. Let them tap a territory. |

**Golden rules:** let the judges hold a phone · never explain the AI before they see it · if something is slow, keep talking about the players on screen · the backup person watches the Mac, not the judges.

## After the rehearsal (15:45)

- [ ] Note anything that broke; only bugs get fixed after 14:30 (see CONTRIBUTING.md).
- [ ] Set Phone A's player to a few hundred steps below a milestone again for the real run.
- [ ] Charge everything.
