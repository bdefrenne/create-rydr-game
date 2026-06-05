# RYDR game conventions (content-only guest)

> **⚠️ This is the TEMPLATE, not a game.** To create a game, scaffold a **new sibling
> folder** and work *there* — never modify this template in place:
> `npx degit bdefrenne/create-rydr-game ../rydr-game-<slug> && cd ../rydr-game-<slug>`
> then follow `SETUP.md`. (If you're reading this inside `create-rydr-game`, do that first.)

## The one rule: power is the controller

A RYDR game is played by **pedaling**. The rider's **power output (watts) is the primary
controller** — like the mouse in an FPS. Not cadence, not heart rate: **power**. Read it from
`session.hardware` (`hw.power`) and map it to your core action (the ship's position, the car's
speed, the turret's fire rate…). **If your game's main mechanic isn't driven by watts, it's wrong.**

- **FTP-relative, never raw watts.** Scale by `power / session.identity.ftp` so a 150 W rider and a
  350 W rider get the same challenge. Hardcoding "above 200 W" anywhere is a bug. (`ftp` is always
  a usable number — no fallback needed.)
- **The game creates demand; the rider responds.** No prescriptive targets — no "hold 250 W for
  4 min", no ERG, no zone bar to sit inside. Instead the *game* makes the rider want to push: a
  surge of enemies → push harder; a hill → dig in; lulls → recover. The pacing of those events
  *is* the workout.
- **The loop: SEE → REACT → PUSH → SEE.** The player sees a threat, pushes, and immediately sees
  the result. Keep current effort visible as *feedback* (a power bar, position, fire rate) —
  feedback is fine; *instructions* are not.
- **Effort is the fun.** Build situations where pushing harder is rewarded and easing off has a
  cost, so the workout emerges from play, not from a timer.

(Cadence/HR from `session.hardware` are fair *secondary* inputs, but never the primary controller.)

This project runs **inside the RYDR platform shell** as a content-only iframe guest.
Hard rules — keep to these:

- **The SDK is your only platform dependency.** Depend on `@rydr/game-sdk` (public git dep)
  and nothing else from the platform. **Never** add `@rydr/platform` to `package.json` — the
  shell is fetched via `npx` for local dev only (see the `dev` script), so production builds
  stay token-free.
- **No chrome.** The shell owns the navbar, background, hardware UI, and profile. Your
  `index.html` body stays transparent; you render only game content.
- **Full access — no capabilities to choose.** `connectToPlatform({ gameId })` grants the
  game **everything**; never pass a `capabilities` list.
- **Hardware + identity come from the shell**, via `session.hardware` and `session.identity`.
  Never connect to BLE/Bluetooth or read a profile yourself. `session.identity.ftp` is
  **always** a usable number (the platform defaults it) — no fallback needed.
- **The platform records the activity + FIT automatically — you do nothing.** Every
  session is recorded by the shell from its own hardware stream. There is **no** activity
  API on the SDK; never build your own FIT encoder or write activities to a backend.
- **Immersive play:** `session.setChrome(false)` hides the navbar during play,
  `setChrome(true)` restores it on menus. Project internal routes with
  `session.setRoute(path)` so the top URL is shareable/deep-linkable (honor
  `session.initialPath` on load).
- **The backend is a platform service — you never stand up your own.** A session-only game
  (read hardware, play, let the platform record the activity) needs no backend at all; don't
  reach for it too soon. When you *do*, the shell backs it **through the SDK session** — there
  is nothing to add or host: **leaderboards** (`submitScore`/`getLeaderboard`), **run records**
  (`saveRun`/`getRun`), **replays/ghosts** (`saveReplay`/`getReplays`), a generic gameId-namespaced
  **game-data store** (`shared` content, `player` saves, `public` UGC), **asset hosting**
  (`getUploadUrl`), and **realtime rooms** (`joinRoom`).
  See `@rydr/game-sdk`'s README (*Backend services*) for how each works; don't learn the API
  from this file.
- **Leaderboard boards are declared in *this repo*.** Boards are declarative config the game
  owns — declare them in `package.json`'s `rydr.boards`, then `npm run register` pushes them to
  the platform so `submitScore(boardId, …)` works (an unknown `boardId` is rejected). The repo
  is the source of truth. See `SETUP.md`.
- **Shipping is mandatory, not optional.** Creating a game isn't done until it's **deployed to a
  per-game Vercel project** (`npm run deploy:link` + `npm run deploy`, GitHub-connected) and
  **registered** (`npm run register`, secret from a gitignored `.env.local`) — **Live by default**
  so it appears in the public library (pass `--draft` to register hidden, testable via `?admin`).
  Don't stop at local dev. See `SETUP.md` (steps 6–8) — the
  only reason to skip is the user explicitly saying they don't want to ship yet.

## The SDK is your reference — read it from the package

Don't learn the API from this file. The **`@rydr/game-sdk` package is the single source of
truth** (it ships its own docs + types). After `npm install`, read:

- **`node_modules/@rydr/game-sdk/dist/index.d.ts`** — the exact, current API: the full
  `PlatformSession` (`hardware`, `identity`, `onButton`, `setChrome`/`setRoute`,
  trainer control, lifecycle, **backend services** — `submitScore`/`getLeaderboard`,
  `saveRun`, the `get`/`save`/`list` data methods, `getUploadUrl`, `joinRoom`),
  `HardwareSnapshot`, `ScopedIdentity`, the backend types (`BoardDefinition`, `GameDoc`,
  `RoomHandle`), and the `Capability` union.
- **`node_modules/@rydr/game-sdk/README.md`** — usage + an API overview.

If anything about the API is unclear, open those — never guess.
