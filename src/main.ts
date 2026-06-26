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
  // session.onButton((e) => {...})   → button edges: e.name PRIMARY/SECONDARY/UP/DOWN/LEFT/RIGHT, e.edge down/up
  // session.isDown("PRIMARY")        → poll a held button in your game loop
  // hw.controllerConnected           → true when a non-keyboard controller (Zwift Play/gamepad/phone) is
  //   connected (false on keyboard-only). Vary behaviour by input setup, e.g. an XP multiplier:
  //     const xpMul = session.hardware.current.controllerConnected ? 1.5 : 1.0;
  //   The platform never tells you WHICH device — just whether a real controller is present.
  //
  // --- Lifecycle hooks you'll likely use (uncomment as needed) ---
  // session.identity.ftp / .weightKg / .displayName  → scoped, PII-free player data
  //   (ftp is ALWAYS a usable number — the platform defaults it; no fallback needed)
  // session.setMenu(false)              → hide the shell's in-game platform menu (hamburger) during immersive play
  // session.setMenu(true)               → show it again on menus
  // session.setRoute("play")            → project your internal route into the top URL
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
  // session.identity.isAdmin, realtime rooms) — see the SDK README for each. Leaderboard boards are
  // declared in package.json's `rydr.boards` (see SETUP.md), then a run's
  // `saveRun({ scores: [{ boardId: "<id>", value }] })` submits to it.
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
  // Persistence is optional — a session-only game needs none. When you do need it,
  // saves/content/leaderboards live on the SDK session (one shared backend for all
  // RYDR games; never stand up your own) — see @rydr/game-sdk for the API.
}

void boot();
