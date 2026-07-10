/**
 * Voice-over Editor host — the per-game authoring page for conversations + French voice-over.
 *
 * This is boilerplate that is IDENTICAL in every RYDR game (only the gameId differs): connect to the
 * shell, gate on `session.identity.isAdmin`, and mount the shared editor. It's reached via the shell
 * deep-link `/game/__SLUG__/voice-over-editor` (see vite.config.ts's extensionless-routes rewrite +
 * build input), mirroring how a game hosts its world editor.
 *
 * Conversations are this game's OWN `shared` gamedata (collection `conversations`); synthesis is
 * relayed through the shell (`session.generateVoiceover`) so the game never holds the TTS key.
 * Author lines in code with `defineConversation` (see src/conversations.ts). This host imports that
 * module so the editor is CODE-AWARE: it lists your code-defined conversations, shows a sync diff, and
 * a "Sync from code" button pushes/prunes them (you can also author extra ad-hoc conversations here).
 */
import { connectToPlatform } from "@rydr/game-sdk";
import { mountVoiceoverEditor } from "@rydr/game-sdk/voiceover-editor";
import { listDefinedConversations } from "@rydr/game-sdk/conversations";
// Import every module that declares conversations so the registry is populated in THIS editor bundle.
import "../conversations";

function showGate(msg: string): void {
  const gate = document.createElement("div");
  gate.style.cssText =
    "position:fixed;inset:0;display:grid;place-items:center;padding:32px;text-align:center;" +
    "font:15px/1.6 system-ui,sans-serif;color:#cdd3e0;background:#0d0f14";
  gate.textContent = msg;
  document.body.appendChild(gate);
}

async function boot(): Promise<void> {
  const session = await connectToPlatform({ gameId: "__SLUG__", handshakeTimeoutMs: 4000 }).catch(() => null);
  if (!session) {
    showGate("This editor must run inside the RYDR shell. Open /game/__SLUG__/voice-over-editor.");
    return;
  }
  session.ready();
  if (session.identity.isAdmin !== true) {
    showGate("Admin mode required. Sign in to the platform as an admin, then reopen this editor.");
    return;
  }
  session.setPowerBar(false);
  session.setMenu(false);
  mountVoiceoverEditor(document.getElementById("root")!, { session, definitions: listDefinedConversations() });
}

void boot();
