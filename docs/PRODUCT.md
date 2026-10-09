# Invade: product spec

**One line:** Friends put coins into a pot, walk in real life to build armies, and battle over a map for the pot.
**Pitch line:** "Invade: bet on your own steps."

**Why it exists:** Fitness apps are abandoned within weeks because nothing is at stake. StepBet and DietBet (WayBetter) prove that people will bet on their own fitness. Invade adds a social strategy game on top, so you compete against friends instead of a spreadsheet of targets.

**Judge feedback that shaped this:** a judge didn't know Risk and found the first idea too broad. He wanted something investable, possibly casino-related. So: **lead with the bet and the business model, never assume the audience knows Risk, and give battles a casino-table feel.**

## Core game (simplified Risk)

- **Teams:** White and Black, up to 4 players each. A host creates a game and shares a code or QR.
- **Season:** each player pays a virtual-coin buy-in into the pot. A 10% platform fee is shown in the UI.
- **Map:** 16 Barcelona neighbourhoods in 4 regions (`DEFAULT_MAP`). Holding a whole region gives bonus soldiers. Territories are split evenly at the start, with 3 soldiers each.
- **Walk Phase:** players walk in real life. At the end, `soldiers = floor(adjusted_steps / steps_per_soldier)`, where the handicap sets each player's personal rate.
- **Effort bonus:** a team that beats its combined handicapped step target gets 1 reroll per battle in the next Move Phase. Effort must matter more than luck.
- **Move Phase (turn-based, one team at a time):**
  - **Place:** put earned soldiers on your team's territories.
  - **Attack:** attack an adjacent enemy territory. The attacker rolls up to 3 dice and must leave 1 soldier behind; the defender rolls up to 2. Compare the highest pairs; each loss removes one soldier, and ties go to the defender. A territory is captured when the defender reaches 0.
  - **Move (fortify):** optionally move soldiers between your own adjacent territories.
- **Win:** the first team to hold ≥ 51% of territories, or the most territories at season end. The winning team splits the pot after the fee.
- **Host settings:** season length, walk phase length, steps per soldier, majority threshold, buy-in, team names. The host can switch, kick and ban players in the lobby.

## AI features (each must be essential)

1. **Handicapping:** a fair conversion rate per player based on their own walking baseline, like sportsbook handicaps. A transparent statistical baseline, not an overclaimed ML model.
2. **Live odds:** win probability before each battle (exact) and for the season (Monte Carlo): "Black is 62% to take the pot. 4,000 more steps tonight flips it." The maths is code; the LLM only phrases the advice.
3. **Anti-cheat:** flags suspicious steps (implausible cadence, perfectly regular shaking, steps with no time span). Heuristics, and we're honest about that.
4. **AI dealer:** a casino-style host (Claude) that announces battles, taunts the losing team and writes a shareable nightly recap.
5. *Stretch:* "The Idle", an AI army that spawns when teams fall behind their walking pace and invades the laziest team.

## Guardrails

- **Virtual coins only.** No real money in the build. Real-money betting is regulated (in Spain, likely DGOJ licensing); present it as the business model, pending legal advice.
- No spectator betting on other people's games.
- **Demo mode is mandatory:** phases last minutes, a simulated step source, and a live-walk moment where judges walk for 30 seconds and their steps arrive as reinforcements on the big screen.

## The demo loop (priority over everything)

Create game → lobby → Walk Phase → steps-to-soldiers conversion → Move Phase with dice and odds → AI dealer recap.
