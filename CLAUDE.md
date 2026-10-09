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
- **Support the experience the RIDER chose.** They pick an intensity and whether it has a BAND, in the shell (PLAT-1661); your game reads that and adapts. Steady means no band (`minWatts === maxWatts === targetWatts`), so keep your demands flat; Dynamic means a band around the target that you are free to move within. It says nothing about the trainer: ERG is held only if a game asks (`setDemand`), so a game where the player simply reacts to the screen never asks, is never held, and pushing harder always produces more watts. Structured workouts are selected and executed by the platform. Read the choice, the full plan and live position through `session.training`; games adapt content without owning a workout clock or ERG target. Actual watts always drive gameplay bonuses, even above a prescribed target.
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
- **Which of YOUR experiences a rider may see is YOUR decision — the shell only states their tier.**
  `session.identity.accessTier` is `free` | `beta` | `all_access`, and you read it with the SDK's
  `tierAtLeast(...)`, **never** by comparing the string (`tier === "beta"` silently excludes every
  `all_access` rider from content they are entitled to, and breaks outright the day a rung is added):
  ```ts
  import { tierAtLeast } from "@rydr/game-sdk";
  if (tierAtLeast(session.identity.accessTier, "all_access")) showUnfinishedCareerMode();
  ```
  Two rungs, two different jobs. **`all_access` hides work in progress** — only a dozen accounts hold
  it, so a mode gated on it is invisible to every beta tester and visible to the people building it;
  that is how you ship a half-built mode without hiding the whole game. **`beta` is the paid-tier
  line** for later, when free riders exist. The shell holds no list of your songs, tracks or levels
  and never will: it hands you a calibrated fact, exactly like `ftp`, and you decide.
  It is a **UI hint** (like `isAdmin`): it says what to OFFER. The day real money hangs on a tier,
  enforcement has to be server-side too.
- **The platform records the activity + FIT automatically — you do nothing.** Every
  session is recorded by the shell from its own hardware stream. There is **no** activity
  API on the SDK; never build your own FIT encoder or write activities to a backend.
- **Highlights are opt-in: screenshot the moments worth keeping.** Call
  `session.captureScreen({ label, fallback: canvas })` when the moment is good (the podium, an
  overtake), right after a render or inside `requestAnimationFrame` (so a WebGL canvas isn't read
  back blank), and keep the scene up until it resolves. It never rejects —
  ignore a `{ ok: false, reason }`. The shot is attached to the rider's current activity. On a
  shell with `session.canCaptureScreen` (desktop app) the shell grabs the frame itself, HTML over
  the canvas included; elsewhere the SDK pictures your `fallback` canvas on a worker. Don't add
  `preserveDrawingBuffer: true` for it. For an image or clip you made yourself:
  `session.captureMoment(blob, { label })` / `session.captureClip(blob, { label })` (a short video,
  e.g. `canvas.captureStream()` → `MediaRecorder`; cap ~3–6s, prefer `video/mp4`).
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
- **ERG is the one exception, and almost certainly not yours.** Resistance is rider-owned and
  `setSimulation` is a no-op, but a game whose entire point is a *prescribed* target — a structured
  workout — can take the trainer's control point: `session.setErgMode(true)`, then
  `session.setTargetPower(watts)` as the target moves (cheap to call every frame; an unchanged
  target writes nothing). Gate it on `session.hardware.current.ergSupported` and **always draw the
  target too** — a dumb trainer, the trainerless power slider and the keyboard have no ERG, and that
  rider must still be able to ride your workout by holding the number themselves. `setTargetPower`
  alone does nothing without `setErgMode(true)` first (grabbing the trainer stays explicit), and the
  shell releases the control point on exit/crash — so there's nothing to clean up, but *do* drop ERG
  on your own pause screen: the shell can't tell "paused" from "recovery interval".
  **If your game isn't a workout app, don't touch this** — read "the one rule" above: you create
  demand and the rider answers it; you don't prescribe watts.
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
  countdowns/turns; your own watts are injected by the shell — you only read opponents'). Rooms are
  the shell's **grant**: your registry row must not have `multiplayer` turned off, or `joinRoom`
  hands you a loopback room with only you in it and says nothing. `joinRoom` also returns
  SYNCHRONOUSLY, before the room exists — wait for `open`/`presence`/`state` — and `close` carries a
  `reason` you must read: `"dropped"` is transient and the shell is already reconnecting (never
  start your own rejoin loop beside it), `"superseded"` means another socket took your slot — the
  rider's own second tab, usually — and is terminal for that handle, `"refused"` is permanent,
  `undefined` means an older shell and is UNKNOWN, never transient. **And if you put bots — or anything else no player drives — in a
  room, exactly one client must own each of them, chosen by presence AND liveness and never
  latched:** a backgrounded tab keeps its socket and its election while its render loop is frozen,
  which is how a whole bot field stops existing for everyone. Read the gotchas in `src/main.ts`
  before you build on it; they are all bugs a player reported, not theory.
  See `@rydr/game-sdk`'s README (*Backend services*) for how each works; don't learn the API
  from this file.
- **Saves survive a network blink — do NOT write your own cache for them.** `saveData` is durable
  as of `@rydr/core-data` 0.10.0 (PLAT-1560): a write the network refuses is kept on disk by the
  shell and replayed when the rider is back online, and — the part that matters for your code — a
  `getData`/`listData` for a key with a write still pending returns **your pending value**, not the
  server's older copy. So a hydrate-on-boot reads what the rider last did, offline or not.

  This is worth stating because the obvious defensive move is now the wrong one. Racing hand-rolled
  a `localStorage` cache per document, which was right at the time and is now redundant — and its
  `hydrate()` overwrote that cache with the server's copy on the next boot, which is where the
  rider's offline progress actually died. Guitar Hero had no cache and lost a save outright. Both
  are fixed by the platform, for every game, with no game change.

  What you still own: your in-memory state, and not treating a resolved `saveData` as proof the
  server has it. It means "safe" — written or durably queued — which is the guarantee you want.
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
- **The first score a run sends is its MAIN score.** Every score in `saveRun({ scores })` is ranked,
  but only the FIRST can become a community feed card, and with it the push and the email that tell
  podium riders someone passed them (PLAT-1879). Send the headline result first (the song score, the
  race result); checkpoints, rollups and side stats (kills, splits) after it. A checkpoint sent first
  would announce "Alice beat your score" about numbers no rider can find.
- **Shipping is mandatory, not optional.** Creating a game isn't done until **all three** ship
  deliverables exist, in order: (1) **pushed to a GitHub repo** (`rydr-game-<slug>`, created via the
  `gh` CLI, **under `bdefrenne`** so it sits with every other RYDR game) → (2) **deployed** to its
  per-game, GitHub-connected Vercel project (`npm run deploy:link` + `npm run deploy`), then wired
  with the **manual deploy button** (`.github/workflows/deploy-production.yml` + a project-scoped
  `VERCEL_TOKEN`, SETUP.md step 7.2 — without it a push by anyone but the account owner never ships,
  because Vercel Hobby blocks on the commit author) → (3) **registered** by **you** — upsert the game into Supabase `public.games`
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
the rider actually holds) or use a keycap from `@rydr/game-sdk/ui`. **A keycap needs the rider's
lettering handed to it** — pass `glyphSet: session.hardware.current.glyphSet` (or `press: session`,
which also wires the pressed sink) to `createKeycap`/`createDpadKeycap`/`createButtonKeycap`/
`mountLabeledDiamond`, and `press:` to `mountSoloLabeledDiamond` (the only one of them that takes no
`glyphSet`). Give it neither and it does **not** fail loudly: it falls back to the Xbox set and
prints the wrong letter forever. That is worst on a Switch pad, where confirm is printed `B` and
back `A` — the exact opposite of the Xbox letters — so an unlettered cap names the button that does
the other thing. Build caps where the session is reachable, or park it in one small module the cap
builders read (the platform shell does this in `src/platform/shellKeycaps.ts`). Every controller (keyboard,
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

## Platform-owned training (PLAT-1623)

Describe supported experiences in `rydr.training` and the registry's `training` object: optional `steady`, `dynamic`, and `workouts` string descriptions. Missing means legacy Dynamic behaviour; never advertise support a game has not implemented. **Steady/Dynamic is the rider's choice, not the game's, and it means "is there a band"** (PLAT-1661): read `session.training.current.intensity` (`minWatts`/`maxWatts` collapse to the target in steady) and `subscribe()` for changes, and use existing `setActivity` for menu/play transitions. `setDemand(level)` asks the trainer to hold a point in that band; `releaseTrainer()` stops asking. **Since PLAT-1663 a release hands the trainer back to the rider's own ERG target, not to nothing** — that target is a standing hold the rider set, and a game only ever borrows the trainer from it. So releasing is no longer a way to get the rider above `maxWatts`: if a sprint needs headroom, ask for it with `setDemand`. `session.training.setEffort(...)` still exists because the SDK type declares it, but the host ignores it — a guest cannot put the trainer somewhere the rider did not ask for. `session.training.supported` detects older hosts; `current` and `subscribe` provide the complete workout plan and authoritative live progress. Games must not create a training clock or end the platform ride on exit. The default workout overlay and coordinated pause controls are deferred.

### Where the numbers come from

The historical menu-easing and game-owned ERG guidance above is superseded: report menu/playing with `session.setActivity`, and consume the rider's effort choice and workout snapshots through `session.training`. Training-aware games never command their own ERG targets. Menus restore base ERG; active workouts retain priority and keep running.

Two different numbers, easy to confuse:

- **`identity.ftp`** is the rider's OWN functional threshold power in watts, as they stated it in their profile. It is no longer a difficulty they picked (that dial was deleted in PLAT-1628) — express `%FTP` demands against it exactly as before, only the meaning changed.
- **`training.baseTargetWatts`** is the intensity they chose for THIS ride, already scaled from that FTP. It is what Steady holds them at and what Dynamic swings them around, so it — not raw watts — is what your demands should be relative to. It is the same number as `training.intensity.targetWatts`; prefer that one.
- **`training.ergTargetWatts`** is a DIFFERENT number and not yours to aim at: what the trainer is physically holding right now, which since PLAT-1663 is the rider's own ERG target whenever your game is not asking. Read it to report, never to size a challenge.

Workout FTP still comes from workout progress and is separate from both.

## Sequence stages — being part of a mash up (PLAT-1629)

A **sequence** is an authored run of several games back to back: a short race, then a song, then a
survival wave. The platform owns the order and the rider's progress through it. Your game is handed
**one stage** and told nothing else — not what came before, not what comes next, not how many stages
there are. That is what lets a mash up be re-authored without touching a single game.

Optional. Implement it and your game can appear in a sequence; ignore it and nothing changes.

```ts
session.onStage(async (stage) => {
  if (stage.offeringId !== "one-song") {
    return session.finishStage("unavailable", { reason: "This game has no such mode" });
  }
  const { songId, difficulty } = stage.settings ?? {};
  const result = await playSong(String(songId), String(difficulty));
  session.finishStage(result.won ? "completed" : "failed", { runIds: [result.runId] });
});
```

**You define the mode vocabulary.** `offeringId` is your name for something directly launchable
("short-race", "one-song", "five-minute-survival"). The platform stores it, hands it back and never
parses it, and the same goes for `settings`. You validate both — you own your content, and the
platform cannot know a track was removed or a song is not unlocked for this rider.

**Three outcomes, and the difference is load-bearing.** `"completed"` and `"failed"` are both real
ENDINGS: the rider played the thing and it resolved, so the sequence moves on either way.
`"unavailable"` means NOTHING was played — an unknown `offeringId`, settings this build rejects,
missing content — and the platform shows an error the rider can act on rather than marching them
past a stage they never saw. Never report `"failed"` for a launch problem or `"unavailable"` for a
lost race.

**Registering the handler is how you declare support.** The SDK acks the shell for you as soon as
your handler runs, and a game with no handler is auto-reported `"unavailable"`, so forgetting to
answer can never strand a mash up. There is no capability to request and nothing to add to the
registry.

**Reach a `finishStage` on every path.** Nothing else ends a stage. Not `saveRun`, not a route
change, not `setActivity("menu")` — a game legitimately does all three mid-stage, which is exactly
why none of them can mean "advance". A handler that throws is reported `"unavailable"` on your
behalf, but a sentence you wrote is a better explanation for the rider than an error string.

**You are also launched at your own deep link.** The shell navigates you there as well as sending
the stage, so trust `stage` over the URL: the message carries what a URL cannot express. It is also
why a game built before this contract still reaches roughly the right screen in a sequence, and why
the URL alone is never enough to call a game sequence-compatible.

**Only the rider leaves a sequence.** `requestExit()` is refused while one is running — the shell's
platform menu owns *Skip stage* and *Stop the sequence* — so do not build your own way out, and
never call `finishStage` just to escape one. The ride recording spans the whole sequence and keeps
going afterwards; finishing a sequence is not finishing a ride, and none of that is yours to end.

`session.stage` is the live spec or `null`. Outside a sequence `onStage` never fires and
`finishStage` is a no-op, so no gameplay code needs to branch on whether one is running.

## Group workouts — being a block of a shared session (PLAT-1667)

A room of riders rides **one workout, together, on one clock**, and the host cycles through a list of
games from the platform MENU. Your game is one entry in that rotation: when the host reaches it you
own the screen, until they move on.

**The full contract is `training/README.md` in `@rydr/game-sdk`**, which ships with the package. Read
it before adapting a game. The four things that catch people out:

- **You do not own the clock, the power, or when your turn ends.** Position comes from
  `session.training`; the workout prescribes watts and the platform holds the trainer there (do not
  call `setDemand` — a workout outranks it); and the host decides when you come off, with no warning.
- **Position is not monotonic.** The host can skip and restart segments, so `position` jumps forward
  AND backward at any moment. Derive state from it rather than accumulating it, and never replay cues
  you already fired because time moved back over them.
- **You can be mounted at ANY position**, mid-effort included — second 2347, fourteen seconds into a
  30-second effort. Render the truth on your FIRST snapshot; never animate in from zero.
- **`participants` includes bots, and you must not care.** A rider alone gets a bot pacer, so there is
  never an empty room and your game needs no "riding alone" branch. `isBot` is for wording and
  leaderboards, never for geometry. Rank by `compliance`, never by `power`: everyone rides the same
  %FTP at different watts, so ranking by watts builds a heaviest-rider-wins leaderboard.

A game suited to a workout block takes its input from the **gamepad, not the pedals** — aim, steer,
time a press, hit a note. If your controller *is* the pedals, a workout block has already taken it:
everyone is held at the same target, so everyone performs identically.

Declare support in the registry's `training.workouts` before a host can put you in a rotation. The
lobby lists only games that declare it.
