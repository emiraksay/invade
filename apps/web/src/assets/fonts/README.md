# Fonts

No font files are committed here. All three fonts used in the Figma design are free on Google Fonts (SIL Open Font License), so load them from Google Fonts or self-host them with `@fontsource`.

| Role | Font | Weights used | Where in the design | Get it |
|---|---|---|---|---|
| Display (wide headings) | **Turret Road** | 400 | WHITE, BLACK, START, SWITCH TEAM, GAME SETTINGS, ATTACK, CANCEL (uppercase, 24px, text-shadow `0 2px 0 #000`) | https://fonts.google.com/specimen/Turret+Road, or `npm i @fontsource/turret-road` |
| Body / numbers | **Montserrat** | 400, 700 | Player names (Bold 20px), ranks (Regular 25px), stat numbers (Regular 15.65px), title "INAVDE : WALKING GAME", tips | https://fonts.google.com/specimen/Montserrat, or `npm i @fontsource/montserrat` |
| Pressed button label | **Bowlby One SC** | 400 | Pressed state of the blue/negative buttons ("SPIN" placeholder, 21px) | https://fonts.google.com/specimen/Bowlby+One+SC, or `npm i @fontsource/bowlby-one-sc` |

Quick start (add to `apps/web/index.html`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Bowlby+One+SC&family=Montserrat:wght@400;700&family=Turret+Road:wght@400&display=swap"
  rel="stylesheet"
/>
```

The CSS variables `--font-display`, `--font-body` and `--font-pressed` in `src/styles/tokens.css` reference these families. Font names come from `get_design_context` output (`Turret_Road:Regular`, `Montserrat:Regular`, `Montserrat:Bold`, `Bowlby_One_SC:Regular`). The "WALK WAR" splash title, the stage texts and the settings screen were not inspected (Figma rate limit), so they may use another font. See `docs/ASSETS.md`.
