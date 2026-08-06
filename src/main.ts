import { connectToPlatform } from "@rydr/game-sdk";

/**
 * Minimal RYDR guest: connect to the platform, then render live power.
 * Replace the demo with your game — read hardware from `session.hardware`, identity from
 * `session.identity`, and use the lifecycle hooks below. See CLAUDE.md for the conventions.
 */
async function boot(): Promise<void> {
  // Games get FULL hardware access — there's nothing to choose. Just pass your gameId.
  const session = await connectToPlatform({ gameId: "__SLUG__" });
  session.ready();

  // Trainer resistance: tell the shell when the rider is racing vs navigating your menus, so it can
  // ease resistance (~35%) on menus and hold FULL resistance in play. You ALWAYS boot into your own
  // menus, so declare that now — then flip to "playing" when your gameplay loop actually starts
  // (e.g. `session.setActivity("playing")` on race start) and back to "menu" on results/pause. That's
  // the whole contract: the shell auto-resets you to the eased state on pause/exit/crash, so you only
  // ever toggle the two. (Menu is the default if you never call it — a game that forgets stays eased.)
  session.setActivity("menu");

  // --- Demo: show the live power the shell bridges from the trainer/slider. ---
  // `hw.power` is raw; for a steady control signal read `hw.smoothedPower` (an SDK EMA) instead —
  // tune it with `rydr.powerSmoothing` in package.json (seconds), or omit for the 0.06s default.
  const powerEl = document.getElementById("power")!;
  session.hardware.subscribe((hw) => {
    powerEl.textContent = String(Math.round(hw.power));
  });

  // By default the shell streams hardware at the trainer's native rate (~10 Hz, varies by trainer).
  // Cap it if you want fewer updates: session.setHardwareRate(4) → ~4 Hz (anti-aliased — power is
  // the interval mean). It's a ceiling, never an upsampler. Callable any time, so you can cap in
  // menus and lift the cap during play; session.setHardwareRate(null) restores the native rate.

  // --- Controller input (canonical, source-agnostic) ---
  // session.onButton((e) => {...})   → button edges, e.edge down/up. e.name is positional:
  //   DIAMOND_UP/DIAMOND_DOWN/DIAMOND_LEFT/DIAMOND_RIGHT (face diamond), UP/DOWN/LEFT/RIGHT (d-pad + left
  //   stick), RUP/RDOWN/RLEFT/RRIGHT (right stick), LT/RT (trigger clicks), LSTICK_PRESS/RSTICK_PRESS.
  //   Default: ONE `down` per press (held-button re-emits swallowed) — right for menus.
  //   Hold-to-repeat: session.onButton((e) => {...}, { repeats: true }) then branch on e.repeat.
  // session.isDown("DIAMOND_DOWN")   → poll a held button in your game loop
  //   House convention: DIAMOND_DOWN = confirm, DIAMOND_RIGHT = back; DIAMOND_UP/DIAMOND_LEFT and LT/RT
  //   contextual (game-assigned). On-screen text: session.buttonLabel(name), never a hardcoded letter.
  // session.axis("LX")               → analog hall-effect stick value: LX/LY/RX/RY -1..1 (right/up +1).
  //   Sticks are the ONLY axes — LT/RT are plain clicks (no analog travel), read them with isDown/onButton.
  // session.stick("LSTICK", { deadzone: 0.1 }) → joystick as { x, y, magnitude, angle }, radially deadzoned (use for 2D move/aim).
  //   Always readable: continuous on hall hardware, quantized to endpoints (-1/0/+1) on a plain controller;
  //   the digital direction edges keep firing in parallel (shell owns the threshold) — use either or both.
  //   Keyboard emulates axes too (dev): arrow keys → left stick (LX/LY), i/j/k/l → right stick (RX/RY).
  // session.vibrate("hit")           → rumble the controller. Named: "tick" | "hit" | "success" | "gameOver",
  //   or custom: session.vibrate({ pattern: [100, 50, 100], intensity: 1 }) (on/off ms + 0..1 strength).
  //   Needs the `buttons` capability; best-effort — a silent no-op with no controller / on Safari.
  // hw.controllerConnected           → true when a non-keyboard controller (Zwift Play/gamepad/phone) is
  //   connected (false on keyboard-only). Vary behaviour by input setup, e.g. an XP multiplier:
  //     const xpMul = session.hardware.current.controllerConnected ? 1.5 : 1.0;
  //   The platform never tells you WHICH device — just whether a real controller is present.
  //
  // --- Menu navigation (DOM menus) — use the shared engine, don't hand-roll focus ---
  // For any HTML/CSS menu (start screen, level/song picker, pause, results), mark the focusable
  // elements `[data-nav]` and drive them with the platform's spatial-nav engine — the SAME one the
  // shell uses, so your menus feel identical to the rest of RYDR:
  //   import { createSpatialNav } from "@rydr/game-sdk/nav";
  //   const nav = createSpatialNav({ session, root: document.body, onBack: () => {/* pause/close */} });
  // It moves a `[nav-focused]` ring to the NEAREST item in the pressed direction (works for grids,
  // columns, and lists alike — no per-layout code), activates on A via the element's own `click`, and
  // backs out on B/Z. Session wiring, the focus ring, scroll-into-view, and editable-field focus are
  // all built in (each opt-out). Seed focus with nav.focusFirst(); style the ring with
  // `[nav-focused] { … }` or pass `ring: false` for the SDK default. See @rydr/game-sdk/nav's README.
  // (Only fully in-canvas/WebGL menus — no DOM elements — skip this and read session.onButton directly.)
  //
  // --- Lifecycle hooks you'll likely use (uncomment as needed) ---
  // session.identity.ftp / .weightKg / .displayName  → scoped, PII-free player data
  //   (ftp is ALWAYS a usable number — the platform defaults it; no fallback needed)
  //   `identity.ftp` is the rider's DIFFICULTY knob, and it's LIVE: the rider can retune it mid-ride.
  //   Read it at init for your baseline, then subscribe so changes apply WITHOUT a relaunch:
  //     let ftp = session.identity.ftp;                         // baseline at launch
  //     session.onIdentityChange((id) => { ftp = id.ftp; });    // re-tuned mid-ride → apply live
  //   Scale your difficulty off `ftp` (e.g. target watts = ftp * intensity). If you only read it
  //   once at init, the rider's mid-ride change won't take effect until the next launch.
  // session.setActivity("playing" | "menu") → declare racing vs any non-racing screen so the shell
  //   holds FULL resistance in play and EASES it (~35%) on menus (see the active call after ready()
  //   above). Default is "menu"; the shell resets you to it on pause/exit/crash — you only toggle.
  // session.setRoute("play")            → project your internal route into the top URL
  // NOTE: there's no "menu chrome" call — the shell's platform menu is summoned on demand (MENU
  //   button / M key), and the trainerless power bar stays visible everywhere so a keyboard rider
  //   can always pedal. Only an editor hides it, with session.setPowerBar(false).
  //
  // --- Replay route (REQUIRED if you save replays) ---
  // A replay is only watchable inside the game, so the platform deep-links finished runs to
  // `/game/<slug>/replay/<runId>`, which reaches you as the route `replay/<runId>` (see CLAUDE.md).
  // Serve it: read the runId tail, fetch the replay, and play it back read-only (no input/recording).
  //   const path = session.initialPath ?? location.pathname.replace(/^\//, "");
  //   const m = /^replay\/(.+)$/.exec(path);
  //   if (m) {
  //     const r = await session.getReplay(m[1]);
  //     if (r) { /* play r.body.frames read-only — no hardware input, no score/run save */ }
  //   }
  //
  // Backend services are live (runs + leaderboards via startRun/saveRun/getRun, replays/ghosts,
  // game-data store, asset upload, shared worlds via session.getWorld(), in-game editors via
  // session.identity.isAdmin, realtime rooms) — see the SDK README for each. Name each run at the
  // start with `startRun(name, tags?)` — a title + short qualifiers (e.g.
  // `startRun("Silverstone GP", ["3 laps"])`) — which the platform shows verbatim in the activity
  // Breakdown, as the leaderboard board label, and in WR/PB pings (it never reads your breakdown blob).
  // Leaderboard boards are declared in package.json's `rydr.boards` (see SETUP.md), then a run's
  // `saveRun({ scores: [{ boardId: "<id>", value }] })` submits to it (one run's name+tags label every
  // board it submits to). For a parameterized board, select the family member with `key`:
  // `saveRun({ scores: [{ boardId: "lap", value, key: trackId }] })`.
  //
  // --- 3D world (optional) — render a shared platform environment in three.js ---
  // Import from `@rydr/game-sdk/three` (needs `three`). `loadWorld` fetches + decodes + caches the
  // world ONCE and returns a handle, so a restart never reloads the map. Hold the handle across runs:
  //   const world = await loadWorld(await session.getWorld(id), { placement, mergeStatics: true });
  //   world.attach(scene);   // start / resume
  //   world.detach();        // restart that may resume — cheap, keeps it decoded + on the GPU
  //   world.dispose();       // real teardown / switching worlds — frees GPU memory + evicts the cache
  // NEVER geometry.dispose() the world group yourself — it's shared with the cache; use dispose().
  // `mergeStatics: true` collapses the world to ≈one draw call per material (big render-CPU win) —
  // you write no merge code. Articulated objects (turrets, wheels): mergeByMaterial(group, { boundaries }).
  //
  // --- Realtime multiplayer (optional) — the shell owns the socket, so it's trusted by construction ---
  //   const room = session.joinRoom("race-1");
  //   room.on("presence",  (members) => {/* roster — each is { playerId, name } */});
  //   room.on("telemetry", (t) => {/* a peer's REAL hardware: t.playerId, t.power, t.cadence, t.heartRate */});
  //   room.on("event",     (e) => {/* server-stamped orchestration — act at e.at: e.name, e.payload, e.from */});
  //   room.send({ x, y });                       // opaque per-tick message to peers
  //   room.setState({ phase: "racing" });        // opaque shared state (last-write-wins; late joiners get it)
  //   room.scheduleEvent("go", { run: 0 }, at);  // a fair, head-start-free transition on the shared clock
  // YOUR watts are injected into the room by the shell automatically — you only ever READ opponents'
  // telemetry. Position/score travel over the opaque channel (not cheat-proof); telemetry is trusted.
  //
  // There is NO activity/FIT API. The platform records every session automatically
  // from its own hardware stream — your game does nothing for recording.
  //
  // --- Highlights (optional) — capture shareable moments from your own canvas ---
  // The shell attaches these to the recorded session; the player sees them on the post-game
  // results screen + in profile history, and can share them (Strava/IG/…) from there.
  //   await session.captureMoment(myCanvas, { label: "finish" });   // a still (Blob/canvas/dataURL)
  //   await session.captureClip(clipBlob,  { label: "sprint" });    // a short video clip
  // captureClip wants a finished video Blob — typically canvas.captureStream() → MediaRecorder.
  // Tips: keep a short rolling MediaRecorder buffer so a clip can include the seconds BEFORE the
  // moment; cap it ~3–6s and downscale to keep uploads small; prefer video/mp4 where supported
  // (Safari) — webm (Chrome) shares poorly to some targets. For a WebGL still, create the context
  // with `preserveDrawingBuffer: true` or capture in the same frame as a render, or it reads blank.
  //
  // --- Conversations & voice-over (optional) — spoken NPC dialogue in French, generated once ---
  // Author conversations IN CODE at module scope in `src/conversations.ts` (already scaffolded), then
  // play them here. `speaker` is a casting key (e.g. "narrator") you assign a voice to in the editor.
  //   import { INTRO } from "./conversations";
  //   const convo = await INTRO.open(document.body, session); // pops the card + plays each line's MP3
  //   session.onButton((e) => { if (e.name === "DIAMOND_DOWN" && e.edge === "down") convo.advance(); });
  // Voice-over is a pure enhancement: with no audio yet, lines show as silent typewriter text.
  // To generate: open your game's editor (scaffolded: voice-over-editor.html + src/voice-over-editor/)
  // at /game/__SLUG__/voice-over-editor (admin). It imports src/conversations.ts, so it lists your
  // code-defined conversations with a "Sync from code" button; then cast each speaker's voice + context
  // in the Characters tab and "Generate all missing". No in-game sync button needed — the editor owns it.
  //
  // Persistence is optional — a session-only game needs none. When you do need it,
  // saves/content/leaderboards live on the SDK session (one shared backend for all
  // RYDR games; never stand up your own) — see @rydr/game-sdk for the API.
}

void boot();
