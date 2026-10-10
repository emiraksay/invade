# Design

Source: Figma "RiskWalk (Copy)": https://www.figma.com/design/0HVELJrA313HiBhM2hBGMd/RiskWalk--Copy-
Original design by Emir's cousin; this copy is ours to edit. Frames are 440×956 (iPhone).

## Screens

Snapshots are in `docs/design/`: `06-base-map.png` is the Base walk screen, `09-log.png` is Base with the LOG bottom bar (the target for /walk).

| Figma frame | App route | Status |
|---|---|---|
| Join/Create (263:1203) + team choice | `/join` | ✅ built (skeleton styling) |
| (MVP "Connect Health" onboarding) | `/connect` | ✅ built |
| **Base (298:26565) + LOG bottom bar (457:3277)** | `/walk`: the **core screen** | ✅ skeleton → issue #6 (Figma fidelity + Map3D) |
| Base, large, for the projector | `/table` | issue #7 |
| SignIn / splash (263:1186) | — | later |
| MatchLobby owner/non-owner, kick popup, LobbySettings | — | later (one fixed campaign today) |
| Idle (team stats), LOG list | — | later |
| Place / Repose / Move / Attack (night phase) | — | after the hackathon (pitch only) |

## Visual language

- Dark warm-brown/black background with a subtle texture; white and grey territories with glowing white outlines.
- Wide display font for headings (WHITE, BLACK, START, SWITCH TEAM); clean sans-serif for body text.
- Stats bar icons: territories (castle), soldiers (helmet), steps (shoe), flags (regions).
- Bottom nav: profile, map (globe), settings.

## Map decision

The Figma map is a **set of rendered images** (the `Map` component has `Map`, `image 4`, `image 5` and `Group 458` layers), not separate territories:
- `Map` (JPEG) is an earlier green-island style.
- `image 4` is a Monument Valley screenshot used as mood reference. **Never ship it** (it's copyrighted).
- `image 5` and `Group 458 / image 1` are the **dark glowing renders** we match. `image 5` shows a Place state with green "+" markers on the territories.

We build the map **live in three.js**, matching the dark render: extruded tiles, glowing white edges, pillar height = soldiers. The territory polygons come from `generateMap()` in the engine. The renders are used as the visual reference and for splash art.

Figma pages: **Risk x Walk** is the Version A design (the game). **MVP** holds the cousin's written spec and the balancing table, which our rules borrow from. **Ideas, Sctech and Wireframe** hold earlier explorations.
