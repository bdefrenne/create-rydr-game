# RYDR game conventions (content-only guest)

> **⚠️ This is the TEMPLATE, not a game.** To create a game, scaffold a **new sibling
> folder** and work *there* — never modify this template in place:
> `npx degit bdefrenne/create-rydr-game ../rydr-game-<slug> && cd ../rydr-game-<slug>`
> then follow `SETUP.md`. (If you're reading this inside `create-rydr-game`, do that first.)

## Todo mapping

When creating a task via the `todo` MCP (per the global "always work from the
todo" rule): work on **this template tool itself** goes under the **RYDR**
project → **Platform** board (`PLAT`). **If you are in a game scaffolded from
this template** (not `create-rydr-game`), replace this line with that game's own
board — a scaffolded game does *not* belong on Platform.

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

- **The SDK is your only platform dependency.** Depend on `@rydr/game-sdk` (public **npm** package,
  resolved from the registry — **NOT** a git dep) and nothing else from the platform. Upgrade by
  bumping the semver range + `npm install` (never hand-edit `package-lock.json`); a new SDK version is
  installable only after its publish CI runs, **not** on a bare git tag. **Never** add `@rydr/platform`
  to `package.json` — the shell is fetched via `npx` for local dev only (see the `dev` script), so
  production builds stay token-free.
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
  needed). `session.setActivity("playing"|"menu")` marks active gameplay vs menu screens (and
  drives the shell's resistance easing); the shell's in-game platform menu (Exit + hardware) is summoned by the MENU button / M key, not a persistent button.
  Project internal routes with
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
- **Menu resistance — `session.setActivity("playing" | "menu")`.** Tell the shell whether the
  rider is racing or navigating. Call `setActivity("playing")` when your gameplay loop is live, and
  `setActivity("menu")` on every other screen — **including your title/menu screen at boot** (the
  scaffold does this right after `ready()`). The shell eases trainer resistance (~35%) while not
  `"playing"` so the rider keeps spinning between efforts, and restores full resistance the instant
  play resumes. Your game sets **no** resistance value — only the state; the shell owns the policy (a
  rider can disable it in Settings). **Default is `"menu"`** — a game that never reports stays eased
  (safe, never stuck at full). You only toggle the two: the shell auto-resets you to the eased state
  on pause / exit / crash, so there's nothing to clean up.
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
- **Conversations & voice-over are built in — every game gets a `/voice-over-editor`.** Author NPC
  dialogue in code with `defineConversation(id, [{ speaker, text }])` from `@rydr/game-sdk/conversations`
  (`speaker` = a shared character id; its `voice`, set in Character Studio, drives Gemini French TTS).
  `await def.open(host, session)` pops the dialogue card and plays each line's cached MP3; `advance()`
  steps it. Voice-over is a pure enhancement — with nothing generated yet, lines are silent typewriter
  text. Audio is **generated in your game's own editor**, scaffolded identically for every game:
  `voice-over-editor.html` + `src/voice-over-editor/host.ts`, reached at
  `/game/<slug>/voice-over-editor` (admin only). **Write each line as one short caption (≤120 chars) —
  split a long beat into sequential lines (`intro-1`, `intro-2`) rather than cramming or truncating —
  and use NO dash punctuation (em dash —, en dash –, spaced hyphen " - "); use a comma/period or split
  instead (in-word hyphens like "Prépare-toi" are fine). `defineConversation` warns in the console on
  either.** Conversations are your game's own `shared` gamedata
  (collection `conversations`); the shell holds the TTS key and relays synthesis
  (`session.generateVoiceover`). Running the game as admin auto-registers your code lines into the
  editor. **Do not remove or rename the `voice-over-editor.html` entry / its vite build input + route
  rewrite** — that's the per-game editor and it's the same in every game.
- **Sound is via `@rydr/game-sdk/sounds` (`createSoundBank`) — and the platform owns master volume.**
  Play events by stable key through a `SoundBank`. The rider's master game-audio level is **shell-owned**
  (set from the phone controller's volume keys / hardware) and the SDK scales every `SoundBank` by it
  **automatically — you write no code for it**. Keep using `setMasterVolume`/`setBusVolume` for your own
  mix; the platform master multiplies on top.
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
- **Never re-derive a platform scale — import it.** A leaderboard row hands you
  `BoardEntry.ftpDifficulty` in raw **watts**, so if you draw the rider's difficulty badge, get the
  level and its colour from **`@rydr/game-sdk/difficulty`** (`levelForWatts` → 1 → 50,
  `visualForLevel` → `{ fill, accent, glow, ink }` CSS strings). Guitar hero learned this the
  expensive way: it hand-ported the shell's ladder to avoid an SDK dependency, the shell's ladder
  then changed, and for months the same rider's watts drew a bronze "3" in-game beside a
  ramp-coloured "26" in the chrome. If a platform concept you need isn't in the SDK yet, add it to
  the SDK — copying it into your game is how you end up disagreeing with the shell.
- **Leaderboard boards are declared in *this repo*.** Boards are declarative config the game
  owns — declare them in `package.json`'s `rydr.boards`; they become authoritative when the game's
  registry row is upserted (step 8) so a run's `saveRun({ scores: [{ boardId, value }] })` ranks with
  the right sort/aggregate (an unregistered board still records, just defaulted to `desc`/`best`).
  Keep `rydr.boards` in the repo as the canonical record. See `SETUP.md`.
- **Shipping is mandatory, not optional.** Creating a game isn't done until **all three** ship
  deliverables exist, in order: (1) **pushed to a GitHub repo** (`rydr-game-<slug>`, created via the
  `gh` CLI) → (2) **deployed** to its per-game, GitHub-connected Vercel project (`npm run deploy:link`
  + `npm run deploy`) → (3) **registered** by **you** — upsert the game into Supabase `public.games`
  via a `register_<slug>` migration + `supabase db push` in the `../rydr-platform` sibling (no admin
  secret; the `supabase` CLI must be connected — the one thing to ask the user if it isn't). **Live**
  so it appears in the public library (or a hidden draft via `isLive:false`, testable on the shell
  while signed in as a platform admin; admin UI `/admin.html` is the fallback). A live deploy is
  **not** proof the repo exists — `vercel --prod` ships from
  local without one; the GitHub repo is a required deliverable, not a side effect. Don't stop at local
  dev. See `SETUP.md` (steps 6–8 + its Definition of done) — the only reason to skip is the user
  explicitly saying they don't want to ship yet.

## The SDK is your reference — read it from the package

Don't learn the API from this file. The **`@rydr/game-sdk` package is the single source of
truth** (it ships its own docs + types). After `npm install`, read:

- **`node_modules/@rydr/game-sdk/dist/index.d.ts`** — the exact, current API: the full
  `PlatformSession` (`hardware`, `identity`, `onButton`, `isDown`/`buttonsDown`, `axis`/`stick`,
  `vibrate`, `setActivity`, `setRoute`, lifecycle, **backend services** —
  `startRun`/`saveRun`/`getRun`, `getLeaderboard`, the `get`/`save`/`list` data methods,
  `getUploadUrl`, `joinRoom`), `HardwareSnapshot`, `ScopedIdentity`, the backend types
  (`BoardDefinition`, `GameDoc`, `RoomHandle`), and the `Capability` union.

**Controller buttons.** The canonical, source-agnostic vocabulary is `UP`/`DOWN`/`LEFT`/
`RIGHT` (D-pad **and** left stick), the right-stick directions `RUP`/`RDOWN`/`RLEFT`/`RRIGHT`,
the four **positional** face buttons `DIAMOND_UP`/`DIAMOND_DOWN`/`DIAMOND_LEFT`/`DIAMOND_RIGHT`
(named by position on the pad, never by letter — the bottom button is printed `A` on an Xbox
pad, `✕` on a DualSense and `B` on a Switch Pro, so a letter would lie to most riders), the two
shoulder triggers `LT`/`RT` (plain clicks, no analog travel), the stick presses
`LSTICK_PRESS`/`RSTICK_PRESS`, and `OPTIONS` — the game's OWN menu/options button, distinct from
the platform's own overlay menu (keyboard `M`/phone `MENU`/gamepad Start, which never reaches a
game) — use it to open your in-game pause/options screen (the game assigns meaning to all of
these — the platform never decides "confirm" vs "back"). The **house convention** is
`DIAMOND_DOWN` = confirm / primary action and `DIAMOND_RIGHT` = back / cancel (matching Xbox,
PlayStation and Nintendo), with `DIAMOND_UP`/`DIAMOND_LEFT` contextual and `LT`/`RT` as extra
contextual inputs (no convention). Not every controller exposes `LT`/`RT`, the `R*` directions, a
stick press, or `OPTIONS`, so never gate a required flow behind them alone. **Never hardcode a
button letter in on-screen
text** — print `session.buttonLabel("DIAMOND_DOWN")` (resolves to `"A"`/`"✕"`/`"B"` for the pad
the rider actually holds) or use a keycap from `@rydr/game-sdk/ui`. Every controller (keyboard,
phone, Zwift Play/Click) is normalised to these names. Buttons deliver **real
hold edges**: `onButton` fires `{name, edge, repeat}` with `edge: "down"` on press and `"up"`
on release. **By default `onButton(cb)` gives you one `down` per physical press** — the shell
swallows the re-emits some controllers (Zwift Play/Ride) send while a button is held, so menus
and discrete actions never double-fire. For hold-to-repeat / charge, opt in with
`onButton(cb, { repeats: true })` and branch on `e.repeat` (`false` = fresh press, `true` =
still-held re-emit). For continuous actions (hold-to-brake, steer), poll
`session.isDown("DIAMOND_DOWN")` / `session.buttonsDown()` in your game loop instead of
tracking edges yourself. Multiple buttons can be held at once (e.g. `LEFT` + `DIAMOND_DOWN`) —
each is an independent edge/held-state. The letter names `A`/`B`/`Y`/`Z` were removed in SDK
v5.0 (protocol 26, positional rename) and the neutral `PRIMARY`/`SECONDARY` in v3.0.0 — never
use them (nor the pre-1.15 `"OK"`/`"CANCEL"`).

**Analog / hall-effect input.** When a controller has hall joysticks, each stick reports a
continuous position. Read `session.axis(name)` — the stick axes `LX`/`LY`/`RX`/`RY` give `-1..1`
(right/up = +1) and are the **only** axes: the shoulder triggers `LT`/`RT` are plain clicks with no
analog travel, read via `isDown`/`onButton` only. For a joystick prefer
`session.stick("LSTICK" | "RSTICK", { deadzone })`, which applies the correct **radial** deadzone
(per-axis deadzoning gives a square zone + fast diagonals; `deadzone` defaults to `0.1`) and returns
`{ x, y, magnitude, angle }`. Pick by
need: `stick()` for 2D movement/aim, `isDown`/`onButton` for ON/OFF.
The digital and analog streams run in **parallel** (`isDown("RLEFT")` and `stick("RSTICK")` both
work), so use either or both. `axis()`/`stick()` are **always readable**:
on a plain, non-hall controller the value is quantized to the endpoints (`-1`/`0`/`+1`) and
rests at `0` until a sample arrives, so never branch on "does this controller have hall?" — and never
*require* an analog axis for a flow that must work everywhere (fall back to the digital button). The
keyboard emulates axes for local dev (arrow keys → left stick, numpad `8`/`4`/`5`/`6` → right
stick), so `axis()`/`stick()` work without a controller.

**Menu navigation — don't hand-roll it.** For any DOM menu (start screen, level/song picker,
pause, results), use the shared spatial-nav engine instead of writing your own focus/selection
logic on top of `onButton`. Mark focusable elements `[data-nav]` and construct
`createSpatialNav({ session, root, onBack })` from **`@rydr/game-sdk/nav`**: it moves a
`[nav-focused]` ring to the nearest item in the pressed direction (grids, columns, lists — one
engine, no per-layout code), activates on `A` via the element's own `click`, and backs out on
`B`/`Z`. Session wiring, the focus ring, scroll-into-view, and editable-field focus are built in
(each opt-out); style the ring with `[nav-focused] { … }` or accept the SDK default. It's the
same engine the platform shell uses, so your menus match the rest of RYDR. Only fully in-canvas
(WebGL) menus with no DOM elements skip it and read `onButton` directly. See
`node_modules/@rydr/game-sdk/nav/README.md`.

**The in-game OPTION menu — don't build your own either.** `mountOptionMenu(document.body,
{ session, title, items })` from **`@rydr/game-sdk/ui`** is the shared overlay every game opens on
`OPTIONS`: your game's name big at the top **in your own font** (it inherits the page's), a free
`Resume` row, then your rows — `{ label, onSelect, shortcut?, hint?, disabled?, danger? }`. A row's
`shortcut` is the button that does the same thing *during play*, drawn as `Shortcut [Y]` so the rider
learns it (binding it in gameplay is still your job). Gate it to your play phase with
`canOpen: () => phase === "playing"`. **It cannot pause your game** — freeze your own loop and timers
in `onOpen`/`onClose` — but it does guarantee a game that keeps running can't be *driven*: it takes
the controller over while up (`session.grabInput`), so your `onButton` handlers go quiet,
`isDown`/`stick` read resting, and anything held is released first. It also declares
`setActivity("menu")` while up and `"playing"` on close, so trainer resistance eases on the pause
screen with no code from you. See `node_modules/@rydr/game-sdk/ui/README.md`.
- **`node_modules/@rydr/game-sdk/README.md`** — usage + an API overview.

If anything about the API is unclear, open those — never guess.
