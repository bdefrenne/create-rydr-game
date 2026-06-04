# RYDR game conventions (content-only guest)

This project runs **inside the RYDR platform shell** as a content-only iframe guest.
Hard rules — keep to these:

- **The SDK is your only platform dependency.** Depend on `@rydr/game-sdk` (public git dep)
  and nothing else from the platform. **Never** add `@rydr/platform` to `package.json` — the
  shell is fetched via `npx` for local dev only (see the `dev` script), so production builds
  stay token-free.
- **No chrome.** The shell owns the navbar, background, hardware UI, and profile. Your
  `index.html` body stays transparent; you render only game content.
- **Hardware + identity come from the shell**, via `session.hardware` and `session.identity`.
  Never connect to BLE/Bluetooth or read a profile yourself.
- **The shell records the activity + FIT.** Bracket a session with
  `session.startActivity(...)` / `session.finishActivity(...)`; do not build your own FIT
  encoder or write activities to a backend.
- **Immersive play:** `session.setChrome(false)` hides the navbar during play,
  `setChrome(true)` restores it on menus. Project internal routes with
  `session.setRoute(path)` so the top URL is shareable/deep-linkable (honor
  `session.initialPath` on load).
- **Only game-specific data** goes to a backend you stand up yourself; user/power/FIT/
  leaderboards are platform services.

## Staying current

This skeleton mirrors the `@rydr/game-sdk` surface and the platform's guest contract. If
something here looks out of date with the SDK (new capabilities, changed session methods,
dev-shell invocation), trust the SDK and update accordingly — the platform + SDK repos are
the source of truth.
