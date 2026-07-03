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
- **Difficulty is live — honor it.** `session.identity.ftp` is the rider's difficulty knob and they
  can retune it mid-ride. Subscribe with `session.onIdentityChange((id) => …)` and apply the new
  `id.ftp` to your scaling; don't snapshot it once at init or mid-ride changes won't take effect
  until the next launch.
- **Two power values — use the right one; don't hand-roll a filter.** The snapshot gives you
  both `hw.power` (raw, jumpy, arrives at the trainer's native rate ~10Hz) and **`hw.smoothedPower`**
  (an SDK-provided, frame-rate-independent EMA). Drive **continuous control** (cursor, position,
  speed) off `smoothedPower` so it doesn't jitter; show **raw `power`** for a watts readout / metrics
  where the true instantaneous number matters. Smoothing defaults to 0.06s; override per game with
  `rydr.powerSmoothing` (seconds) in `package.json` to make it smoother/snappier.
- **Stream rate is yours to cap.** The shell streams at the trainer's native rate by default; call
  `session.setHardwareRate(hz)` to cap it (anti-aliased — a ceiling, never an upsampler), or
  `session.setHardwareRate(null)` for no limit. Callable any time.
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
- **Highlights are opt-in (and the only thing the shell can't capture for you).** Because
  your game runs cross-origin, the shell can't read your canvas — *you* grab the pixels and
  call `session.captureMoment(canvasOrBlob, { label })` (a still) or `session.captureClip(blob,
  { label })` (a short video, e.g. `canvas.captureStream()` → `MediaRecorder`). The shell
  uploads them and attaches them to the session; the player shares them from the results
  screen. Keep a short rolling clip buffer, cap clips ~3–6s, prefer `video/mp4`, and for a
  WebGL still use `preserveDrawingBuffer: true` (or capture in the same frame) or it reads blank.
- **Immersive play:** the shell navbar is always hidden while a game runs (no game control
  needed). `session.setMenu(false)`/`(true)` hides/shows the shell's in-game platform menu —
  the hamburger that opens Exit + hardware (defaults to visible). Project internal routes with
  `session.setRoute(path)` so the top URL is shareable/deep-linkable. On a cold
  load the shell **mounts your game at `game.url/<tail>`** — i.e. the deep-link tail
  arrives as the iframe's real URL, so your own router/host resolves it directly.
  **This means your deploy MUST serve every path you project via `setRoute`:** a SPA
  rewrite for client routes (e.g. rewrite `/play` → `/index.html`), and a real built
  file for separate documents (e.g. `run-editor.html`). The same tail is also handed
  to you as `session.initialPath` for back-compat, but it's redundant for cold loads
  now that the URL is authoritative. Decide per route what is deep-linkable:
  deep-linkable states (a level, a menu) should restore; transient states
  (`gameover`, mid-run) have no context to restore, so route them to a sane entry
  point instead of booting into a dead screen.
- **`/replay/:runId` is REQUIRED if you save replays.** A replay is only watchable inside
  the game, so the platform deep-links a finished run to
  `https://rydr-platform.vercel.app/game/{slug}/replay/{runId}` — which arrives as your route
  `replay/{runId}` (the iframe URL and `session.initialPath`). On that route, read the `runId`
  tail, `await session.getReplay(runId)`, and play it back **read-only** (no hardware input, no
  recording, no score/run save). The URL carries only the `runId` — which level/mission and the
  frames all come from the replay/run you fetch by id, so the route is the same shape for every
  game. Run-finished Telegram notifications and leaderboard "watch ghost" links point straight
  here, so a game that calls `saveReplay` but doesn't serve this route ships a dead link. A
  session-only game (no `saveReplay`) doesn't need it.
- **The backend is a platform service — you never stand up your own.** A session-only game
  (read hardware, play, let the platform record the activity) needs no backend at all; don't
  reach for it too soon. When you *do*, the shell backs it **through the SDK session** — there
  is nothing to add or host: **runs + leaderboards** (`startRun`/`saveRun`/`getRun` +
  `getLeaderboard`), **replays/ghosts** (`saveReplay`/`getReplays`), a generic gameId-namespaced
  **game-data store** (`shared` content, `player` saves, `public` UGC), **asset hosting**
  (`getUploadUrl`), and **realtime rooms** (`joinRoom` → presence, *trusted* opponent `telemetry`,
  opaque `send`/`setState`, and server-stamped `scheduleEvent` for fair, head-start-free
  countdowns/turns; your own watts are injected by the shell — you only read opponents').
  See `@rydr/game-sdk`'s README (*Backend services*) for how each works; don't learn the API
  from this file.
- **Leaderboard boards are declared in *this repo*.** Boards are declarative config the game
  owns — declare them in `package.json`'s `rydr.boards`, then `npm run register` pushes them to
  the platform so a run's `saveRun({ scores: [{ boardId, value }] })` works (an unknown `boardId`
  is rejected). The repo
  is the source of truth. See `SETUP.md`.
- **Shipping is mandatory, not optional.** Creating a game isn't done until **all three** ship
  deliverables exist, in order: (1) **pushed to a GitHub repo** (`rydr-game-<slug>`, created via the
  `gh` CLI) → (2) **deployed** to its per-game, GitHub-connected Vercel project (`npm run deploy:link`
  + `npm run deploy`) → (3) **registered** (`npm run register`, secret from a gitignored `.env.local`)
  — **Live by default** so it appears in the public library (pass `--draft` to register hidden,
  testable via `?admin`). A live deploy is **not** proof the repo exists — `vercel --prod` ships from
  local without one; the GitHub repo is a required deliverable, not a side effect. Don't stop at local
  dev. See `SETUP.md` (steps 6–8 + its Definition of done) — the only reason to skip is the user
  explicitly saying they don't want to ship yet.

## The SDK is your reference — read it from the package

Don't learn the API from this file. The **`@rydr/game-sdk` package is the single source of
truth** (it ships its own docs + types). After `npm install`, read:

- **`node_modules/@rydr/game-sdk/dist/index.d.ts`** — the exact, current API: the full
  `PlatformSession` (`hardware`, `identity`, `onButton`, `isDown`/`buttonsDown`,
  `setMenu`/`setRoute`, trainer control, lifecycle, **backend services** —
  `startRun`/`saveRun`/`getRun`, `getLeaderboard`, the `get`/`save`/`list` data methods,
  `getUploadUrl`, `joinRoom`), `HardwareSnapshot`, `ScopedIdentity`, the backend types
  (`BoardDefinition`, `GameDoc`, `RoomHandle`), and the `Capability` union.

**Controller buttons.** The canonical, source-agnostic vocabulary is `UP`/`DOWN`/`LEFT`/
`RIGHT` plus the four raw face buttons `A`/`B`/`Y`/`Z` (the game assigns meaning — the
platform never decides "confirm" vs "back"). The **house convention** is `A` = confirm /
primary action, `Z` = back / cancel, with `B`/`Y` as contextual extras. Every controller
(keyboard, phone, Zwift Play/Click) is normalised to these names. Buttons deliver **real
hold edges**: `onButton` fires `{name, edge, repeat}` with `edge: "down"` on press and `"up"`
on release. **By default `onButton(cb)` gives you one `down` per physical press** — the shell
swallows the re-emits some controllers (Zwift Play/Ride) send while a button is held, so menus
and discrete actions never double-fire. For hold-to-repeat / charge, opt in with
`onButton(cb, { repeats: true })` and branch on `e.repeat` (`false` = fresh press, `true` =
still-held re-emit). For continuous actions (hold-to-brake, steer), poll `session.isDown("A")`
/ `session.buttonsDown()` in your game loop instead of tracking edges yourself. Multiple
buttons can be held at once (e.g. `LEFT` + `A`) — each is an independent edge/held-state. The
neutral `PRIMARY`/`SECONDARY` names were removed in SDK v3.0.0 — never use them (nor the
pre-1.15 `"OK"`/`"CANCEL"`).
- **`node_modules/@rydr/game-sdk/README.md`** — usage + an API overview.

If anything about the API is unclear, open those — never guess.
