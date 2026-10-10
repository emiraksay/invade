# Decisions log

Why things are the way they are. **Read this before proposing to change any of them.** To change a decision, discuss it with Emir first, then add a new entry here (don't edit old ones).

Hackathon: Lytvyn.AI.Foundation AI Hackathon, Barcelona, 9–10 Oct 2026. **Demo/judging: 10 Oct, 16:00.** Feature freeze 14:30.

| # | Decision | Why | Rejected alternatives |
|---|---|---|---|
| 1 | **Build Invade**: a walking game where friends' real steps become soldiers on a shared map | A judge wanted something investable and simple; the mentor said "ship one purpose done fully right" | Trip planner, parent-logistics agent, paper-letter assistant, speaking-habit app, bill-negotiation agent |
| 2 | **Version A (the map game) is the game**: White vs Black, up to 4 per team, map is the battlefield | It's the cousin's polished design and the core idea ("fill the map with your team's steps") | MVP "5 lanes" duel game (kept only its rules, see #3) |
| 3 | **Borrow the MVP's balancing**: 5k→4, 10k→8, 12k→10 soldiers (cap), team bonus when everyone hits 5k/10k | The cousin already balanced it (Figma "Balancing" frame); the cap stops one very fit player from dominating | Linear steps→soldiers, uncapped |
| 4 | **Battles are an odds roll**: P(win) = attackers ÷ (attackers + defenders), shown as "You 58% / Enemy 42%" | Matches the Figma attack screen; effort improves odds, upsets keep suspense | Risk dice (hard to explain), bigger-number-always-wins (no suspense) |
| 5 | **Night phase is simultaneous and secret**, then a reveal | No waiting for turns; the reveal is the dramatic demo moment | Turn-based moves |
| 6 | **Steps come only from Apple Health**, via the "Invade Sync" iOS Shortcut | Always the real number; web apps can't read HealthKit but Shortcuts can | Phone motion sensor (only counts while the page is open) |
| 7 | **Web app, not native**, for today | Everyone joins via a link in 2 minutes; native needs Xcode per phone or a paid Apple account + TestFlight, and hours we don't have | React Native/Expo (Expo Go can't read Health) |
| 8 | **Walking skeleton first, then the core screen** | Real players must join and sync at 09:00 to walk all day; then the Walk screen gets perfected | Journey order with each screen polished (core never ready), core screen first with fake data |
| 9 | **One campaign today, code `INVADE`**, created by `supabase/seed.sql`; players pick their team when joining | Only one game exists at the hackathon | Create-game and lobby screens (in Figma, come later) |
| 10 | **The server is the only writer**; store facts (step reports, events), derive the rest with the engine | No cheating, no drifting numbers, replayable (see ARCHITECTURE.md) | Clients writing directly to the database |
| 11 | **Live 3D map in three.js** in the Figma's dark style; polygons from `generateMap()`. Gate at 13:00 → 2.5D SVG fallback | The Figma map is a flat render; territories must change live | Using the render images as the map |
| 12 | **Hosting: Vercel (app + API) + Supabase (Postgres, Realtime)** | Free, HTTPS anywhere, auto-deploy on merge | Running from a laptop / tunnels |
| 13 | **Today's demo** = the real day's map on the Mac + a live Sync on stage. Night phase and battles appear only as the next step in the pitch | Proves the core with real data; battles can't be built well by 16:00 | Building the night phase today |
| 14 | **AI must be essential**, not decoration: nudges first; strategist and commentator later. Code computes all numbers; Claude only writes words | Judges reward real AI integration | AI that computes rules or odds |
| 15 | **Virtual stakes only**; real-money pots are the business model, pending legal advice (Spain: likely DGOJ) | Gambling regulation | Real money in the build |
| 16 | **Steps count for the whole day; each day is a round** (Walk Phase = the day, as in the cousin's design) | Matches the Health app's daily total exactly; no Shortcut changes; "every day is a new battle" | Counting only from game kickoff (needs a new Shortcut and re-onboarding, numbers wouldn't match Health) |
| 17 | **Player pieces on the map**: every player stands on a territory of their team's half with the soldiers they earned today (badge). Pieces start spread front-line-first by join order; players may share a territory; territories show a starting garrison of 2 (HQ adds the team bonus). Rule: `startingPositions()` in the engine; view: `MapView.pieces` | The cousin's Sctech/Wireframe frames show avatars with soldier badges; makes the map readable for judges | Team-level glow only |
| 18 | **Demo "walk 2,500 steps" button stays OFF** (`VITE_DEMO_SYNC` unset) | Only real Apple Health data in the demo | Judge-only fallback button |
| 19 | **A season is one week (Mon → Sun); Sunday midnight is the final.** Most territory wins, ≥ 51% ends it early (`campaignDays: 7`). Shown by the SeasonBar on /walk and /table | Varya's "Invade Weekly": a story with an ending every week, easy to explain | 30-day campaign |
| 20 | **Invade Weekly extras are next season, not today**: zone of the day, Sat 2 / Sun 3 points, AI comeback twist, coins + team pot (virtual / charity; real money only after legal advice), rivals, forecast | Too big before the 16:00 demo; on the pitch's season slide | Building them today |
