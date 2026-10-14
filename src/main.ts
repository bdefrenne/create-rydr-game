import { connectToPlatform } from "@rydr/game-sdk";

/**
 * Minimal RYDR guest: connect to the platform, then render live power.
 * Replace the demo with your game — read hardware from `session.hardware`, identity from
 * `session.identity`, and use the lifecycle hooks below. See CLAUDE.md for the conventions.
 */
/** The power the rider chose for this ride. Everything your game demands should scale to it. */
let intensityTarget = 0;

async function boot(): Promise<void> {
  // Games get FULL hardware access — there's nothing to choose. Just pass your gameId.
  const session = await connectToPlatform({ gameId: "__SLUG__" });
  session.ready();

  // The RIDER chooses how hard to ride and whether to hold it Steady or ride it Dynamic, in the
  // shell (PLAT-1661). Your game READS that and builds a different experience around it.
  //
  //   steady  — NO band. `intensity.minWatts === maxWatts === targetWatts`. Keep your demands flat.
  //   dynamic — a band around the target, and it is yours to move within.
  //
  // It says nothing about HOW the trainer is ridden: that is the rider's pick, per game (PLAT-1846).
  // A rider who rides your game in ERG is held at `intensity.targetWatts`; one who picks Gears or
  // Fixed (L1 + R1, remembered for your game) pedals freely. If your game has no target of its own
  // (the player just reacts to the screen), never call setDemand: a rider who wants pushing harder
  // to produce more watts picks Gears for it. Honour the window either way and steady/dynamic falls
  // out for free.
  //
  // Express demands against `intensity.targetWatts`, never in watts of your own: it is the one
  // number that means the same effort to a 150 W beginner and a 415 W pro, so one authored
  // challenge lands fairly on every body.
  session.training.subscribe((training) => {
    document.body.dataset["effort"] = training.effort; // "steady" | "dynamic"
    // Scale whatever your game asks of the rider against this, rather than naming watts yourself.
    intensityTarget = training.intensity?.targetWatts ?? training.baseTargetWatts;
  });
  session.setActivity("menu");

  // --- Demo: show the live power the shell bridges from the trainer/slider. ---
  // `hw.power` is raw; for a steady control signal read `hw.smoothedPower` (an SDK EMA) instead —
  // tune it with `rydr.powerSmoothing` in package.json (seconds), or omit for the 0.06s default.
  const powerEl = document.getElementById("power")!;
  session.hardware.subscribe((hw) => {
    // Shown as a SHARE of what the rider chose, not as bare watts, because that is the number your
    // game should actually reason about: 1.0 means they are giving exactly what they signed up for,
    // and it means the same thing for a 150 W beginner and a 415 W pro.
    const share = intensityTarget > 0 ? hw.power / intensityTarget : 0;
    powerEl.textContent = `${Math.round(hw.power)} W (${share.toFixed(2)}x)`;
  });

  // By default the shell streams hardware at the trainer's native rate (~10 Hz, varies by trainer).
  // Cap it if you want fewer updates: session.setHardwareRate(4) → ~4 Hz (anti-aliased — power is
  // the interval mean). It's a ceiling, never an upsampler. Callable any time, so you can cap in
  // menus and lift the cap during play; session.setHardwareRate(null) restores the native rate.

  // --- Controller input (canonical, source-agnostic) ---
  // session.onButton((e) => {...})   → button edges, e.edge down/up. e.name is positional:
  //   DIAMOND_UP/DIAMOND_DOWN/DIAMOND_LEFT/DIAMOND_RIGHT (face diamond), UP/DOWN/LEFT/RIGHT (d-pad + left
  //   stick), RUP/RDOWN/RLEFT/RRIGHT (right stick), LT/RT (trigger clicks), LSTICK_PRESS/RSTICK_PRESS.
  //   OPTIONS never reaches a game on RYDR: like MENU it opens the platform menu, where your
  //   mountOptionMenu rows (below) are drawn. Don't bind it.
  //   Default: ONE `down` per press (held-button re-emits swallowed) — right for menus.
  //   Hold-to-repeat: session.onButton((e) => {...}, { repeats: true }) then branch on e.repeat.
  // session.isDown("DIAMOND_DOWN")   → poll a held button in your game loop
  //   House convention: DIAMOND_DOWN = confirm, DIAMOND_RIGHT = back; DIAMOND_UP/DIAMOND_LEFT and LT/RT
  //   contextual (game-assigned). On-screen text: session.buttonLabel(name), never a hardcoded letter.
  //   An @rydr/game-sdk/ui keycap needs the lettering handed to it as well — pass
  //   `glyphSet: session.hardware.current.glyphSet` (or `press: session`); given neither it
  //   quietly prints Xbox letters, which on a Switch pad name the opposite button.
  // session.axis("LX")               → analog hall-effect stick value: LX/LY/RX/RY -1..1 (right/up +1).
  //   Sticks are the ONLY axes — LT/RT are plain clicks (no analog travel), read them with isDown/onButton.
  // session.stick("LSTICK", { deadzone: 0.1 }) → joystick as { x, y, magnitude, angle }, radially deadzoned (use for 2D move/aim).
  //   Always readable: continuous on hall hardware, quantized to endpoints (-1/0/+1) on a plain controller;
  //   the digital direction edges keep firing in parallel (shell owns the threshold) — use either or both.
  //   Keyboard emulates axes too (dev): arrow keys → left stick (LX/LY), numpad 8/4/5/6 → right stick (RX/RY).
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
  // --- The in-game OPTION menu — use the shared one, don't build your own ---
  // Every game needs "the rider opened the menu mid-play": the SDK ships that menu, so all games
  // share one look, animation and behaviour. Your game's name goes big at the top IN YOUR FONT (it
  // inherits the page's), `Resume` is free, and you add the rest:
  //   import { mountOptionMenu } from "@rydr/game-sdk/ui";
  //   const menu = mountOptionMenu(document.body, {
  //     session,
  //     title: "My Game",                   // your name, your font
  //     canOpen: () => phase === "playing", // so it never opens on top of your own menus
  //     onOpen:  () => { paused = true },   // YOU freeze your loop — see below
  //     onClose: () => { paused = false },
  //     items: [
  //       { label: "Restart", shortcut: "DIAMOND_UP", onSelect: () => restart() },
  //       { label: "Back to menu", onSelect: () => router.go("/") },
  //     ],
  //   });
  // It opens itself on OPTIONS; ▲▼ move, A picks, OPTIONS/B resume. A row's `shortcut` is the button
  // that does the same thing DURING PLAY, drawn as `Shortcut [Y]` so the rider learns it — binding it
  // in gameplay is still your job. Rows also take hint / disabled / danger / keepOpen.
  // IT CANNOT PAUSE YOUR GAME — no library can; freeze your own loop/timers in onOpen/onClose. What it
  // does guarantee is that a game which keeps running can't be DRIVEN: it takes the controller over
  // while up (session.grabInput), so your onButton handlers go quiet, isDown/stick read resting, and
  // anything held is released first. It does NOT call setActivity and never touches the trainer: the
  // rider keeps riding what they were riding (menus never ease resistance, PLAT-1623).
  // ON RYDR THERE IS ONE MENU (PLAT-1795): the shell draws these rows inside its own platform menu,
  // under Resume, instead of this overlay. MENU and OPTIONS (the shell's, not yours) open it, its opening/closing
  // runs canOpen/onOpen/onClose, and a press runs your row's own callback. Same code; only the
  // overlay (an older shell) draws shortcut, hint and your font, so make each label stand alone.
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
  // session.identity.accessTier → what content this rider is entitled to: "free" | "beta" |
  //   "all_access". Read it with the SDK's tierAtLeast(), NEVER by comparing the string — a bare
  //   `=== "beta"` locks all_access riders out of content they're entitled to:
  //     import { tierAtLeast } from "@rydr/game-sdk";
  //     if (tierAtLeast(session.identity.accessTier, "all_access")) showWorkInProgressMode();
  //   Gate on "all_access" to hide a mode that isn't finished (a dozen accounts hold it, so beta
  //   testers never see it); gate on "beta" for the eventual free/paid line. The shell knows
  //   nothing about your tracks or levels — which ones are free is your call, not the registry's.
  // session.setActivity("playing" | "menu") → declare racing vs any non-racing screen so the shell
  //   restores base ERG in menus and applies the selected effort preference in play.
  //   Active workouts retain their targets; menu state never pauses their clock.
  // session.setRoute("play")            → project your internal route into the top URL
  // NOTE: there's no "menu chrome" call — the shell's platform menu is summoned on demand (MENU
  //   button / M key), and the trainerless power bar stays visible everywhere so a keyboard rider
  //   can always pedal. Only an editor hides it, with session.setPowerBar(false).
  // session.setRideHud({ live: "compact", workout: false })
  //   → the shell's ride HUD over your game: the live card "full" | "compact" (its readings row
  //     only) | "hidden", and the workout's rep panel / details on or off. Each call is the whole
  //     view; setRideHud() with nothing shows everything again. Omit it and the rider gets it all.
  // session.setRideHud({ menu: "compact", column: document.querySelector(".menu-column") })
  //   → on your MENUS (while you report setActivity("menu")) the HUD becomes the riding home's bar
  //     across the top: "full" (with its chart) or "compact" (one flat line), lined up with your menu
  //     column (an element the SDK follows as it resizes, or { x, width }). "playing" flies it back
  //     to the corner. Only ask if you report your activity on every screen; lay the menu out under
  //     it with var(--rydr-hud-bottom, 0px).
  // session.setRideHud({ live: "compact", lowRateWarning: true })
  //   → if your game judges power as it happens, ask the shell to warn a rider whose trainer is too
  //     slow for it (about one reading per second): it measures the rate and, only when low, shows
  //     "Slow trainer" on the HUD and explains it in the platform menu. You draw nothing. Per screen:
  //     on for gameplay, off on your menus.
  // session.rideHudArea / session.onRideHudArea((area) => layout(area))
  //   → WHERE that HUD is, measured by the shell, in your own CSS pixels: `rects` (one box per
  //     block on screen) and `bounds` (the box around them; null when nothing is drawn). It changes
  //     during a ride (a workout adds panels, setRideHud removes some, a resize), so follow it and
  //     keep that space free. From CSS: var(--rydr-hud-bottom, 0px), also -left/-top/-right/-width/
  //     -height on :root. An editor's setPowerBar(false) takes the HUD away too.
  //
  // --- Sequence stages (optional) — let the platform put your game in a MASH UP ---
  // A sequence is an authored run of several games back to back: a short race, then a song, then a
  // survival wave. The PLATFORM owns the order; you are handed one stage and told nothing else — not
  // what came before, not what comes next, not that a sequence exists beyond your own stage.
  // Implement it and your game can appear in one; skip it and nothing changes.
  // TWO HALVES, and you need both: DECLARE your launchable modes in `rydr.offerings` in
  // package.json (see SETUP.md — that's what a sequence is authored against), then implement
  // `onStage` below to play one. Declaring without implementing means every stage that names you
  // reports "unavailable"; implementing without declaring means no sequence can name you at all.
  //   session.onStage(async (stage) => {
  //     // `stage.offeringId` is YOUR name for a launchable mode. You define the vocabulary; the
  //     // platform stores it and hands it back, and never parses it.
  //     if (stage.offeringId !== "one-song") {
  //       return session.finishStage("unavailable", { reason: "This game has no such mode" });
  //     }
  //     const { songId, difficulty } = stage.settings ?? {};   // opaque to the platform; YOU validate
  //     const result = await playSong(String(songId), String(difficulty));
  //     session.finishStage(result.won ? "completed" : "failed", { runIds: [result.runId] });
  //   });
  // Three outcomes, and the difference matters: "completed" and "failed" are both real ENDINGS (the
  // rider played it; the sequence moves on either way), while "unavailable" means NOTHING was played
  // — an unknown offeringId, settings this build rejects, missing content — so the platform shows an
  // error the rider can act on instead of marching them past a stage they never saw.
  // Four things to know:
  //  1. **Registering the handler is how you DECLARE you support sequences.** The SDK acks the shell
  //     for you, and a game with NO handler is auto-reported "unavailable" — so you can never strand
  //     a mash up by forgetting to answer. Report `unavailable` yourself only for a mode you don't have.
  //  2. **You are ALSO launched at your own deep link** (the platform navigates you there as well), so
  //     trust `stage` over the URL. The message carries what a URL cannot express: Guitar Hero's
  //     pacing targets have no path segment, and never will.
  //  3. **Reach a `finishStage` on EVERY path, including the ones where you give up.** Nothing else
  //     ends a stage — not `saveRun`, not a route change, not `setActivity("menu")`, because a game
  //     legitimately does all three mid-stage. A handler that throws is reported "unavailable" for
  //     you, but your own sentence is a better explanation for the rider than an error message.
  //  4. **Only the RIDER leaves a sequence.** Your `requestExit()` is refused while one is running
  //     (the shell's platform menu owns Skip stage and Stop sequence), so don't build your own
  //     "back to the mash up" — and don't call `finishStage` just to get out of one.
  // `session.stage` is the current spec or `null`, readable any time; outside a sequence `onStage`
  // never fires and `finishStage` is a no-op, so none of your gameplay code needs to branch on it.
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
  // Put the run's MAIN score FIRST. Every score is ranked, but only the first one can become a feed
  // card and the "someone beat your record" push + email (PLAT-1879). Checkpoints, rollups and side
  // stats go after it, or riders get told about records they never lost.
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
  // Five things that WILL bite, and have bitten every game that shipped a room so far:
  //  1. **Your registry row must say `multiplayer`** (a checkbox in /admin.html). Rooms are the
  //     shell's grant, not your declaration — if it's off, the shell hosts nothing and you get a
  //     loopback room with only yourself in it. It's on by default for a new game.
  //  2. **`joinRoom` returns SYNCHRONOUSLY, before anything is connected.** `members` is empty and
  //     `state` is `{}` until the server's hello lands. Wait for `open`/`presence`/`state` — never
  //     read the handle on the next line. A join the shell never answers produces no error and no
  //     `close`, so if you need to know, time it out yourself.
  //  3. **`close` tells you WHY — read it.** `(reason)` is "dropped" (TRANSIENT: the shell is
  //     already reconnecting and will re-open the same room — hold your state, and do NOT start
  //     your own rejoin loop or two of them race through one socket), "superseded" (ANOTHER SOCKET
  //     TOOK YOUR SLOT — usually the rider's own second tab. Terminal for this handle: nothing will
  //     re-open, so do not hold state waiting. Re-joining evicts them and they evict you straight
  //     back, so make it the RIDER's choice, never an automatic retry), "full" (at capacity; the
  //     SDK stopped retrying on purpose), "refused" (the registry says this game is not
  //     multiplayer — PERMANENT, never retry, just carry on single-player) or "left" (you called
  //     `leave()`). `undefined` means an older shell that cannot say: treat as unknown, never as
  //     transient.
  //  4. **There is no matchmaking, listing or discovery.** `joinRoom` takes any string, and joining
  //     an id nobody is in silently CREATES an empty room — so "wrong code" and "I'm first" are
  //     indistinguishable. Decide which one you meant from the player's intent, not from the room.
  //  5. **BOTS AND ANYTHING ELSE NOBODY DRIVES need an owner.** Fill a lobby with bots and every
  //     client will happily simulate its own — so two players race two different fields. The five
  //     rules below are not a suggestion: both games that shipped bots in a room arrived at them
  //     separately, and each paid for one of them in a bug a player reported.
  //       a. **Exactly ONE client owns each non-human entity**, and everyone else replays or
  //          corrects toward what that client says. Pick it with the same election you use for any
  //          other host job — there is one host per room, not one per job.
  //       b. **Ownership is a function of PRESENCE AND LIVENESS, recomputed every read, never
  //          latched.** The roster says who is in the room; it does NOT say whose client is still
  //          ticking. A backgrounded tab has its `requestAnimationFrame` frozen while its socket
  //          stays open, so it keeps its slot and keeps winning the election while doing no work.
  //          Judge a peer by whether their own stream has gone quiet relative to the rate THEY were
  //          sending at, and treat "every peer went quiet at once" as your own link, not theirs.
  //       c. **Make it STICKY, and hand it on only forwards.** Once the field has moved to someone
  //          else, do not give it back when the original wakes up: their simulation has been stopped
  //          for however long they were away, so handing authority back snaps every entity to a
  //          stale position.
  //       d. **Roster and results go in `setState`; per-tick motion goes in `send`.** State reaches
  //          a late joiner in their hello and survives a reconnect; a message is delivered once and
  //          is gone. Anything a newcomer must agree with you about — who is on the grid, who
  //          finished — belongs in state, or they will derive their own answer and be wrong.
  //       e. **Solo is the same code path with `owns() === true`.** Do not write a single-player
  //          mode and a multiplayer mode; write one, in which a player alone owns everything.
  //     If your entities are deterministic from a seed, prefer simulating them everywhere and using
  //     the owner's stream as a CORRECTION — a correction only has to arrive often enough to bound
  //     the drift, not often enough to animate. If they are not (their AI reads the local world),
  //     you have to replay the owner's stream outright. Either way the ownership rules above hold.
  // The room id is namespaced per game by the shell (`{yourSlug}:{roomId}`), so you cannot collide
  // with another game and cannot reach one either.
  //
  // There is NO activity/FIT API. The platform records every session automatically
  // from its own hardware stream — your game does nothing for recording.
  //
  // --- Highlights (optional) — screenshot the moments worth keeping (PLAT-1842) ---
  // Call it when the moment is good — the podium, an overtake — not on a timer. The shot is
  // attached to the rider's current activity; they see it in its Highlights and can share it.
  //   requestAnimationFrame(() => {                    // runs right after your loop's render
  //     void session.captureScreen({ label: "Podium", fallback: myCanvas });
  //   });
  // It never rejects: `{ ok: true, by }` or `{ ok: false, reason }` (unsupported / no-activity /
  // rate-limited / obscured / failed) — ignore a refusal, don't show it. Keep the scene on screen
  // until it resolves. When `session.canCaptureScreen` (desktop app) the SHELL grabs the frame —
  // HTML over your canvas included — for one message; elsewhere the SDK pictures `fallback`, your
  // canvas, encoding + uploading on a worker. Called after a render and before the frame is shown
  // (right after render(), or in requestAnimationFrame as above), a WebGL canvas needs NO
  // `preserveDrawingBuffer` (which costs every frame).
  // To upload an image or clip you made yourself:
  //   await session.captureMoment(myBlob, { label: "finish" });   // a still (Blob/canvas/dataURL)
  //   await session.captureClip(clipBlob,  { label: "sprint" });  // a short video clip
  // captureClip wants a finished video Blob — typically canvas.captureStream() → MediaRecorder.
  // Tips: keep a short rolling MediaRecorder buffer so a clip can include the seconds BEFORE the
  // moment; cap it ~3–6s and downscale to keep uploads small; prefer video/mp4 where supported
  // (Safari) — webm (Chrome) shares poorly to some targets.
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

// Training contract (PLAT-1623, PLAT-1661, PLAT-1925).
//
// READ: `session.training.current` + `.subscribe()`.
//   · `effort` — "steady" | "dynamic". The RIDER's choice, not yours. Your own setEffort() is
//     ignored: a guest must not put the trainer somewhere the rider did not ask for.
//   · `intensity` — { group, targetWatts, minWatts, maxWatts, ftp }. Scale your demands to
//     `targetWatts` rather than naming watts yourself.
//   · `ergTargetWatts` — what the trainer is ACTUALLY holding, which is not always what you asked
//     for. No ERG-capable trainer, the rider riding your game on Gears or Fixed, and a workout
//     outranking you all look identical from in here. Render from this, not from your own request.
//
// WRITE (optional): `session.training.setDemand(level)` moves the trainer to a point in the
// rider's band. It only moves it while the rider rides your game in ERG (PLAT-1846), where the
// trainer is otherwise held at `targetWatts`.
//   · 0 is `minWatts`, 1 is `maxWatts`. Normalized, not watts, so one authored curve fits every
//     rider and survives a retune of the band. In steady those are the same number.
//   · `session.training.releaseTrainer()` stops ASKING, which returns the trainer to the rider's
//     game target (in ERG) rather than to their legs. So a release is no route above `maxWatts`:
//     if a SPRINT needs headroom, ask for it with setDemand.
//   · Call it as often as you like. The platform caps how often it writes to the trainer.
//   · `session.training.setGameTarget(watts | null)` (PLAT-1849, SDK 11.2+) is ONLY for a game
//     whose difficulty is a power the rider picks in-game: the shell rebuilds the band around it,
//     for this run only. See the SDK's training README.
//
// SHOW THE GAME TARGET BEFORE EACH RUN (PLAT-1925, protocol 52). Every game does it: the rider
// chooses how hard to ride IN the game, on the screen they see before a run (a start card, a lobby),
// and the choice is their saved GAME TARGET, shared by every game (280 W here is 280 W in the next).
//   import { mountGameTargetPicker } from "@rydr/game-sdk/ui";
//   const picker = mountGameTargetPicker(preRunPanel, { session });
//   // while that row has focus: if (picker.handle(name)) return;   (LEFT / RIGHT, 5 W a press)
//   // when the screen closes: picker.dispose();
// The shell owns the ladder; the picker only draws it. A game whose difficulty is its OWN watts for a
// run (setGameTarget above) shows its own control for those runs instead.
//
// Keep session.setActivity("menu" | "playing") accurate: "menu" puts the rider on their MENU
// setting (the Menu ERG by default), "playing" on the one they picked for your game.
// Never run another workout clock or derive gameplay bonuses from the target: use actual watts.
