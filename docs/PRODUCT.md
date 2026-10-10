# Invade: product spec

**One purpose:** every step you take today becomes strength your team uses tonight to take the map.
**Tagline (Figma splash):** "Play. Walk. Conquer."

**Why it exists:** fitness apps are abandoned within weeks because nothing is at stake. In Invade your steps matter to a team of friends, every day, on a shared map.

**Source:** the cousin's Figma "RiskWalk". Version A (the map game) is the game. From the MVP page we borrow the milestone soldiers, the step cap, the team bonus, phase timers, Ready, nudges and sharing. See `docs/DESIGN.md`.

## The game

- **Teams:** White vs Black, up to 4 players each.
- **The map:** 24 irregular territories (Barcelona neighbourhoods), split evenly between the teams. Each team has an HQ (the crown). Generated deterministically by `generateMap()` in the engine.
- **Campaign:** 30 days. Each day is a ☀️ Walk Phase and then a 🌙 Night Phase. A team wins by holding ≥ 51% of the territories, or the most territories at the end.

### ☀️ Walk Phase: steps → soldiers (built)

- **Steps come only from Apple Health**, through the "Invade Sync" iOS Shortcut, so the numbers are always the real ones.
- Daily milestones per player (from the cousin's balancing table):

| Steps today | Soldiers |
|---|---|
| 5,000 | 4 |
| 10,000 | 8 |
| 12,000 | 10 (**cap**; more steps earn nothing) |

- **Team bonus:** when *every* member reaches 5k → +B, and when everyone reaches 10k → +2B, where B = max(1, floor(team size / 2)). For a team of 4 that's +2 / +4; for a pair it's the MVP's +1 / +2.
- **The map is the scoreboard:** as soldiers arrive, your team's half fills and glows.

### 🌙 Night Phase (specified, not built yet)

Both teams plan **at the same time, in secret**:
1. **Place** all new soldiers on your territories.
2. **Move** soldiers between your own adjacent territories.
3. **Attack** an adjacent enemy territory with some of your soldiers.

Everyone taps **Ready**. Then the **reveal** resolves every battle on the map, one by one.

**Battles are an odds roll:**
- The win chance is attackers ÷ (attackers + defenders), shown as "You 58% / Enemy 42%" before you confirm.
- **Win:** the territory flips, and the attackers keep max(1, a − floor(d/2)).
- **Loss:** the attackers are lost, and the defender keeps max(1, d − floor(a/2)).

## AI (each one essential)

| Feature | Status | What it does |
|---|---|---|
| Nudge | next | Spots who is short of the next milestone or blocking the team bonus; writes a personal nudge you send in one tap |
| Night strategist | later | Proposes the best attacks with exact odds and explains why |
| Commentator | later | Calls each battle in the reveal and writes the shareable nightly recap |
| Step integrity | later | Flags implausible reports (Apple Health makes this mostly unnecessary) |

The numbers (odds, milestones, bonuses) are always computed by code. Claude only writes the words.

## Guardrails

- Virtual stakes only. Real-money pots are the business model and need legal advice first (in Spain, likely a DGOJ licence).
- iPhone only for now (Apple Health). Android (Health Connect) and a native app are on the roadmap.

## The demo (judging, 16:00)

Real players walk all day with the Shortcut installed. At judging:
1. The Mac shows the real day's campaign map.
2. A player taps **Sync** on stage, and their real Apple Health steps arrive.
3. A milestone is crossed, and soldiers march into their team's HQ.
4. The Night Phase is shown as tonight's next step.
