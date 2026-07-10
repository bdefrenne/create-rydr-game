import { defineConversation } from "@rydr/game-sdk/conversations";

/**
 * Your game's conversations — declared at MODULE SCOPE so BOTH your game (src/main.ts) and the
 * voice-over editor host (src/voice-over-editor/host.ts) can import them. The editor lists these,
 * shows a sync diff, and pushes them to the platform; your game `open()`s them to play.
 *
 * Speaker ids (e.g. "narrator") are **casting keys** — assign each a voice + English persona context
 * in the editor's Characters tab (they don't need to be catalog characters). Per-line `style` / `speed`
 * are code-authored here and shown read-only in the editor.
 */
export const INTRO = defineConversation("intro", [
  { speaker: "narrator", text: "Bienvenue ! Prêt à commencer ?" },
  { speaker: "narrator", text: "Appuie sur A pour continuer." },
]);

// In your game (src/main.ts), play it:
//   import { INTRO } from "./conversations";
//   const convo = await INTRO.open(document.body, session);
//   session.onButton((e) => { if (e.name === "A" && e.edge === "down") convo.advance(); });
