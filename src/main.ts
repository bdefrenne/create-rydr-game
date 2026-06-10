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
  const powerEl = document.getElementById("power")!;
  session.hardware.subscribe((hw) => {
    powerEl.textContent = String(Math.round(hw.power));
  });

  // --- Lifecycle hooks you'll likely use (uncomment as needed) ---
  // session.identity.ftp / .weightKg / .displayName  → scoped, PII-free player data
  //   (ftp is ALWAYS a usable number — the platform defaults it; no fallback needed)
  // session.setMenu(false)              → hide the shell's in-game platform menu (hamburger) during immersive play
  // session.setMenu(true)               → show it again on menus
  // session.setRoute("play")            → project your internal route into the top URL
  //
  // Backend services are live (leaderboards, saveRun/getRun, replays/ghosts, game-data store,
  // asset upload, shared worlds via session.getWorld()/applyWorld, in-game editors via
  // session.identity.isAdmin, realtime rooms) — see the SDK README for each. Leaderboard boards are
  // declared in package.json's `rydr.boards` (see SETUP.md), then submitScore("<id>", value) works.
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
  // Persistence is optional — a session-only game needs none. When you do need it,
  // saves/content/leaderboards live on the SDK session (one shared backend for all
  // RYDR games; never stand up your own) — see @rydr/game-sdk for the API.
}

void boot();
