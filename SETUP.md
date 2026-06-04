# Setting up a new RYDR game from this template

You are an AI agent setting up a new game scaffolded from `create-rydr-game`.
Do the steps below, then help the user build their game. Delete this file when done.

## 1. Replace the placeholders

Pick a unique kebab-case **slug** and a human **title**. The dev **port** defaults to
`3400` (taken: racing 3000, guitar-hero 3200, tower-defense 3300) — change it only if 3400
clashes, in `vite.config.ts` **and** the `dev` script's `--game http://localhost:<port>`.

Replace every occurrence across the repo:
- `__SLUG__` → the slug (e.g. `flappy-bike`) — in `package.json` (`name` becomes
  `@rydr/game-<slug>`, and the `dev` script) and `src/main.ts` (`gameId`).
- `__TITLE__` → the title (e.g. `RYDR Flappy Bike`) — in `index.html` `<title>` (+ the demo
  text) and `package.json` (`description` + `dev` script).

## 2. Choose capabilities

In `src/main.ts`, set `capabilities` to what the game needs — a subset of
`power | cadence | heartRate | speed | buttons | identity`. `power` + `identity` is the
minimum. The shell grants the subset it allows (least privilege).

## 3. Build the game

Implement it in `src/`. Read live values from `session.hardware` (power/cadence/HR/speed),
player data from `session.identity` (playerId, displayName, weightKg, ftp). Use
`session.setChrome(false)` for immersive play, `session.setRoute(path)` to project your
internal route into the shell URL, and `session.startActivity/finishActivity` so the
**shell** records the FIT. Read `CLAUDE.md` first — it lists the hard rules.

## 4. Run it

`npm install && npm run dev` → your game + the RYDR shell at http://localhost:3100
(with a power slider, or a real trainer if paired). Iterate.

## 5. Deploy + register

- Create a GitHub repo, push `main`, connect it to Vercel — it auto-deploys on push and
  the build clones only the **public** `@rydr/game-sdk` (no secrets needed). Note the URL.
- Add the game to the library at https://rydr-platform.vercel.app/admin.html (enter the
  admin secret): slug / title / icon / accent / URL / capabilities. Leave **Live** unchecked
  to keep it a draft; preview it on the shell via `?admin`, then check Live to publish.
