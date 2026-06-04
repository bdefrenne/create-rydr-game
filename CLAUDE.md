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
- **The shell records the activity + FIT.** Bracket a session with
  `session.startActivity(...)` / `session.finishActivity(...)`; do not build your own FIT
  encoder or write activities to a backend.
- **Immersive play:** `session.setChrome(false)` hides the navbar during play,
  `setChrome(true)` restores it on menus. Project internal routes with
  `session.setRoute(path)` so the top URL is shareable/deep-linkable (honor
  `session.initialPath` on load).
- **Only game-specific data** goes to a backend you stand up yourself; user/power/FIT/
  leaderboards are platform services.

## The SDK is your reference — read it from the package

Don't learn the API from this file. The **`@rydr/game-sdk` package is the single source of
truth** (it ships its own docs + types). After `npm install`, read:

- **`node_modules/@rydr/game-sdk/dist/index.d.ts`** — the exact, current API: the full
  `PlatformSession` (`hardware`, `identity`, `onButton`, `setChrome`/`setRoute`,
  `startActivity`/`finishActivity`, trainer control, lifecycle), `HardwareSnapshot`,
  `ScopedIdentity`, the `Capability` union, and `createDevHarness`.
- **`node_modules/@rydr/game-sdk/README.md`** — usage + an API overview.

If anything about the API is unclear, open those — never guess.
