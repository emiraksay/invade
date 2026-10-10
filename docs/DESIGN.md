# Design

Source: Figma "RiskWalk (Copy)": https://www.figma.com/design/0HVELJrA313HiBhM2hBGMd/RiskWalk--Copy-
Original design by Emir's cousin; this copy is ours to edit. Frames are 440×956 (iPhone).

## Screens (snapshots in `docs/design/`)

| File | Figma frame | Route / view |
|---|---|---|
| `01-signin.png` | SignIn (263:1186) | `/`: profile, name and colour |
| `02-join-create.png` | Join/Create (263:1203) | `/`: create, or join by code |
| `03-lobby-owner.png` | MatchLobby/LobbyOwner (347:1048) | `/lobby/:code`: teams, switch/kick, code, settings, start |
| `04-lobby-settings.png` | MatchLobby/LobbySettigns (347:1435) | lobby settings sheet |
| `05-idle.png` | Idle (310:1876) | `/play`: team stats tab with per-player details |
| `06-base-map.png` | Base (298:26565) | `/play`: map tab during the Walk Phase (timer and stats bar) |
| `07-place.png` | Place (298:26644) | Move Phase: Place step |
| `08-attack.png` | Attack (298:26842) | Move Phase: Attack step |
| `09-log.png` | LOG (457:3277) | Battle log |

Other frames in Figma: Repose and Move variants, the kick popup, the non-owner lobby, and components (Buttons, LoadingBar, NumberBar, NumberCircle, PlayerItem, PlayerInfo, Navbar, SettingsButton, Text Input).

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
