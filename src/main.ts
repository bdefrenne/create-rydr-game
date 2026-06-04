import { connectToPlatform, createDevHarness } from "@rydr/game-sdk";

/**
 * Minimal RYDR guest: connect to the platform, then render live power.
 * Replace the demo with your game — read hardware from `session.hardware`, identity from
 * `session.identity`, and use the lifecycle hooks below. See CLAUDE.md for the conventions.
 */
async function boot(): Promise<void> {
  // Standalone dev (not embedded in the shell) → a mock platform for the handshake.
  // The shell's bottom power slider (or a real trainer) drives power when embedded.
  if (window.parent === window) createDevHarness({ ui: false });

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
  // session.setChrome(false)            → hide the shell navbar during immersive play
  // session.setChrome(true)             → show it again on menus
  // session.setRoute("play")            → project your internal route into the top URL
  // session.startActivity("cycling")    → the SHELL records the activity + FIT
  // session.finishActivity({ sport: "cycling", durationMs })
  // session.submitScore(boardId, value) → leaderboards (when the data services land)
}

void boot();
