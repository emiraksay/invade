# Design assets

Exported from Figma **"RiskWalk (Copy)"** (file key `0HVELJrA313HiBhM2hBGMd`, page `0:1`) through the Figma MCP connector.

**This export is partial.** The connector is on the Figma **Starter plan**, which has a small tool-call quota. The quota ran out after about 10 calls ("You've reached the Figma MCP tool call limit on the Starter plan"). Every later Figma call failed, including `get_design_context`, `get_screenshot` and `download_assets`. Everything listed below was exported before the limit. Everything else is under [Not obtainable / gaps](#not-obtainable--gaps).

All SVGs are unmodified Figma exports (original fills, sizes and ids). Figma adds `preserveAspectRatio="none"` and `style="display:block"` to the root element. When you resize an icon in CSS, keep its aspect ratio.

## Icons: `apps/web/src/assets/icons/` (21 SVG)

| File | Figma node | What it is | Used in the app |
|---|---|---|---|
| `stat-territories-castle.svg` | `310:1352` (in PlayerInfo `310:1612`) | Castle / gate, white, 25.5×18.7 | Stats bar: territories owned |
| `stat-soldiers-helmet.svg` | `311:1316` (PlayerInfo) | Soldier with helmet, white, 22.2×21.6 | Stats bar: soldiers |
| `stat-steps-shoe.svg` | `310:1347` (PlayerInfo) | Sneaker, white, 20×19 | Stats bar: steps |
| `stat-flags.svg` | `310:1346` (PlayerInfo) | Flag, white, 15×17 | Stats bar: flags / regions |
| `nav-profile-active.svg` | vector in Navbar-Players `310:982` | Soldier/profile glyph, **white** (active state), 34.5×33.6 | Bottom nav: profile / players tab |
| `nav-map-globe-inactive.svg` | vector in Navbar-Players `310:982` | Globe, **#555555** (inactive state), 38×38 | Bottom nav: map tab |
| `nav-settings-active.svg` | vector exported from Navbar `310:982` | Gear (`ic:round-settings`), **white**, 44.9×44.9 | Bottom nav: settings tab, active |
| `nav-settings-inactive.svg` | vector exported from Navbar `310:982` | Same gear, **#555555** | Bottom nav: settings tab, inactive |
| `settings-cog-alt.svg` | vector in Navbar `310:982` (layer not identified) | Rounded "flower" cog, white, 31×31 | Probably the lobby GAME SETTINGS / SettingsButton cog. Not confirmed. |
| `navbar-players-active.svg` | `310:982` | Full navbar (bg `#161616` at 70%, radius 10) with the profile tab active | Bottom nav reference, or drop-in |
| `navbar-map-active.svg` | `348:2308` | Full navbar with the map tab active | Same |
| `navbar-settings-active.svg` | `348:2307` | Full navbar with the settings tab active | Same |
| `copy.svg` | `310:2254` (Text Field Icons / Copy `310:2272`) | Copy, outline, stroke `#D9D9D9` 2px, 18×22 | Lobby code field: copy code |
| `paste.svg` | `310:2251` (Text Field Icons / Paste `310:2273`) | Clipboard paste, fill `#D9D9D9`, 18×20 | Join screen code field: paste code |
| `kick-x.svg` | `348:1904` (PlayerItem / Button) | Thin X, white, 18×17 | Lobby owner: kick player |
| `switch-team-arrow.svg` | `348:1655` (Group 475; `348:1656` Group 476 is identical) | One half of the switch-teams arrow pair: down arrow, white stroke, 8.2×22 | Lobby owner: switch team. Draw it twice. Put the second copy 13.8px to the right, rotated 180°. |
| `dropdown-caret.svg` | Polygon 5 in `310:1442` (PlayerItem / Opens) | Triangle, `#828282`, 21.7×9.8, points up | Expandable player row (Idle). The design rotates it 180°. |
| `avatar-placeholder.svg` | Ellipse 7 in `179:1658` (PlayerItem) | White circle, 41×41 | Player avatar placeholder (lobby, idle list) |
| `attack-skip.svg` | `298:26419` (`octicon:skip-16`, Buttons / BlueButton) | Circle with slash, white, 25×25 | ATTACK pill button icon (Move phase) |
| `button-blue-pressed-bg.svg` | Buttons / BlueButtonPressed `196:734` | Button shape: `#27679C`, 50% black overlay, inner shadow, black stroke, 166×66 | Pressed blue/accent button background |
| `button-negative-pressed-bg.svg` | Buttons / NegativeButtonPressed `196:759` | Same shape in `#9C2727` | Pressed negative button background |

## Images: `apps/web/src/assets/images/` (0 PNG)

Nothing was exported. See the gaps below.

## Reference renders: `docs/design/components/` (5 PNG, 1x)

These are the screenshots that came back with `get_design_context`. They are visual targets only, not assets. Each shows every variant of its component on Figma's canvas, with Figma's dashed component-set border.

| File | Figma node | Size |
|---|---|---|
| `buttons-178-1187.png` | Buttons `178:1187` (BlueButton, NegativeButton, both pressed) | 373×173 |
| `navbar-348-2309.png` | Navbar `348:2309` (3 variants) | 260×237 |
| `playerinfo-310-1612.png` | PlayerInfo `310:1612` (stats bar) | 214×47 |
| `text-field-icons-310-2274.png` | Text Field Icons `310:2274` | 100×64 |
| `playeritem-347-1152.png` | PlayerItem `347:1152` (Opens, Default, Button) | 1024×215 |

The screen snapshots `01`–`09` in `docs/design/` live on branch `feat/contracts`, not on this branch.

## Tokens

Tokens are in `apps/web/src/styles/tokens.css` (CSS custom properties) and `apps/web/src/styles/tokens.ts` (typed object). Both files hold the same values.

- **The Figma file defines no variables** (`get_variable_defs` returned `{}`). The values come from component code and SVG fills. Values marked *approx* were sampled from the screen PNGs on `feat/contracts`.
- **Colours**
  - Background: about `#110d0b`, with a centre glow of about `#251f1b` (warm brown/black)
  - Row surface: `rgba(0,0,0,.2)`, highlighted row about `#242120`
  - Pill button: `rgba(71,71,71,.55)`
  - Navbar: `rgba(22,22,22,.7)`
  - Text: primary `#fff`, secondary `#d9d9d9`, muted `#828282`, disabled/inactive `#555555`
  - Accent (blue button): `#27679c`. Negative button: `#9c2727`. Pressed buttons add a 50% black overlay, and their text is `#7e7e7e` / `#848484`.
  - Teams: white `#fff`, black `#000` (approx)
  - Loading bar: track about `#262626`, fill about `#d9d9d9`
- **Fonts:** Turret Road (display), Montserrat 400/700 (body and numbers), Bowlby One SC (pressed-button label). All three are on Google Fonts. See `apps/web/src/assets/fonts/README.md`.
- **Font sizes:** buttons 24px uppercase, pressed 21px, rank 25px, player name 20px bold, stat numbers 15.65px
- **Radii:** navbar 10, row 17, pill 20, pressed button about 2
- **Spacing:** pill padding 9/20 with gap 10, row gap 23, stat grid gaps 10/3
- **Shadows:**
  - Row glow: `0 0 5px rgba(180,180,180,.25)`
  - Button text: `0 2.026px 0 #000`
  - Rank text: `0 3.146px 0 #000`
  - Pressed button: inset `0 4px 0 rgba(0,0,0,.4)`

## Not obtainable / gaps

1. **Figma MCP rate limit (root cause of everything below).** The Starter-plan quota ran out mid-export. To finish the export, upgrade the Figma seat or plan, or wait for the quota to reset, then re-run with the node ids in this file. Another option is to export by hand in Figma: select the node, then Export → PNG 2x or SVG.
2. **Images, none exported:**
   - 3D map render, symbol `175:474` "Map". It is a flat raster render, not separate territories. Even once exported it cannot be made interactive, which is why `docs/DESIGN.md` plans an SVG map.
   - `GameBackGround`, symbol `347:1543`
   - The "bgtexture 86"–"bgtexture 95" layers
   - The "Soldior Counters" graphics, e.g. instances `259:3074`…`259:3104` in Idle `259:2978`
   - Splash / logo art: the "WALK WAR" title and SignIn frames `263:1155` / `263:1186`
   - Team visuals and the "image 6" overlay layer used on the map screens
3. **Icons not exported:**
   - **Crown**: lobby owner marker and map crown. It is visible in the lobby screen. Node not inspected; candidates are the vectors `347:1125` / `347:1223` in LobbyOwner.
   - The SettingsButton `196:733` icon. `settings-cog-alt.svg` may be it.
   - The inactive map/players nav variants as separate files. Use the active SVG and recolour to `#555555`, or use the full navbar SVGs.
   - The arrows `Arrow 1` / `Arrow 2` and the attack/move vectors on the Base variants (`363:1393`, `363:1397`, `421:1574`)
   - Any LOG-screen icons (vectors `457:3457` etc.)
4. **Components not inspected (no exact styles):** LoadingBar `178:3164`, NumberBar `179:1026`, NumberCircle `259:4131`, SettingsButton `196:733`, Stage Texts `259:2480`, Map Owner `150:752`, Text Input `42:1247`. As a result:
   - The text-field border and radius are unknown.
   - Loading bar values are sampled, not exact.
   - The stage/timer text style is unknown.
   - The fonts of the "WALK WAR" title and the settings screen are unverified.
5. **Screen references not saved:** Settings `348:2226`, Repose `320:1765`, Move `42:1285`, NotLobbyOwner `310:2139`, kick popup `348:2454`, Idle `259:2978`, LOG `457:3435`, and the Base variants `363:1359`, `421:1516`, `421:1563`, `363:1398`. None of these is in the `feat/contracts` snapshot set, so all are still missing.
6. **Missing states in the design itself:** the Buttons component only has default and pressed states, with no disabled or hover state. The pressed variants use a "SPIN" placeholder label.
7. **Background colours are approximations.** The real background is a textured raster (`GameBackGround` plus the bgtexture layers), so a flat colour or gradient is only a fallback.
