import { defineConfig } from "vite";
import { resolve } from "path";
import { existsSync } from "node:fs";

/**
 * LOCAL SDK DEVELOPMENT — the canonical RYDR way. READ THIS before changing the SDK + a game together.
 *
 * To change `@rydr/game-sdk` and see it in this game WITHOUT publishing: check out the SDK repo as a
 * SIBLING folder (`../rydr-game-sdk`). That's it — the block below then aliases every
 * `@rydr/game-sdk[/subpath]` import to the SDK's SOURCE, so your edits show up on the next reload
 * with NO publish, NO version bump, NO `tsc -w`, and NO cache to clear. Absent sibling (CI/prod/a
 * standalone clone) → the published npm package, unchanged. Keep tsconfig.json `paths` in sync.
 *
 * Why this and not the alternatives (the mistakes that keep biting):
 *  - Publishing just to test a change is the slow path — only publish when you're ready to SHIP.
 *  - Copying the SDK's `dist/` into node_modules is wiped by the next `npm install`.
 *  - A bare `node_modules` dep is PRE-BUNDLED by Vite and served from an in-memory cache until a full
 *    dev-server restart, so a rebuilt SDK serves stale ("X is not a function" for an API you added).
 *    Aliasing to SOURCE sidesteps the pre-bundler entirely — no staleness, no `optimizeDeps` dance.
 * The one regex alias covers ALL subpaths (`/three`, `/ui`, `/conversations`, …) — never enumerate them.
 */
const sdkSrc = resolve(__dirname, "../rydr-game-sdk/src");
const linkSdk = existsSync(sdkSrc);

export default defineConfig({
  // `NO_HMR=1` (the `dev:frozen` script) disables HMR so edits never reload the running tab —
  // the built version stays usable while you code; manual refresh serves freshly transformed source.
  server: { port: 3400, hmr: process.env.NO_HMR ? false : undefined }, // change only if this clashes with another local dev server
  resolve: {
    // `@rydr/game-sdk` → src/index.ts, `@rydr/game-sdk/three` → src/three/index.ts, etc.
    alias: linkSdk ? [{ find: /^@rydr\/game-sdk(\/.*)?$/, replacement: `${sdkSrc}$1/index.ts` }] : [],
    // If your game renders 3D via `@rydr/game-sdk/three`, dedupe `three` so the game and the aliased
    // SDK source don't bundle two THREE instances (broken instanceof). No-op if you don't use three.
    dedupe: ["three"],
  },
  plugins: [
    {
      // Map the shell's extensionless deep-links to their real build entry. The game itself is
      // index.html (served by default); the voice-over editor is a separate full-page guest the
      // shell mounts at /game/__SLUG__/voice-over-editor.
      name: "extensionless-routes",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url?.split("?")[0] || "";
          if (url === "/voice-over-editor") req.url = "/voice-over-editor.html";
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "voice-over-editor": resolve(__dirname, "voice-over-editor.html"),
      },
    },
  },
});
