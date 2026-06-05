# RYDR game conventions (content-only guest)

> **⚠️ This is the TEMPLATE, not a game.** To create a game, scaffold a **new sibling
> folder** and work *there* — never modify this template in place:
> `npx degit bdefrenne/create-rydr-game ../rydr-<game> && cd ../rydr-<game>`
> then follow `SETUP.md`. (If you're reading this inside `create-rydr-game`, do that first.)

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
- **Shipping is part of the flow.** The standard new-game lifecycle ends by **deploying to a
  per-game Vercel project** (`npm run deploy:link` + `npm run deploy`, GitHub-connected) and
  **registering as a draft** (`npm run register`, secret from a gitignored `.env.local`) so anyone
  can test it via the shell's `?admin`. See `SETUP.md` (steps 6–8) for the commands.

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
