# create-rydr-game

Template for a new game on the **RYDR platform**. Scaffold it:

```bash
npx degit bdefrenne/create-rydr-game rydr-game-<slug>   # e.g. rydr-game-pong
cd rydr-game-<slug>
```

Then open the folder in your AI agent and say:

> Set this up per `SETUP.md` as `<slug>` / `<title>` on port `<port>`, then build `<your game idea>`.

The agent follows [`SETUP.md`](./SETUP.md) to scaffold a fresh sibling folder, replace the
placeholders, and build the game; [`CLAUDE.md`](./CLAUDE.md) documents the guest conventions
(content-only, SDK-only dependency, **full** hardware access, power/identity/FIT and a shared
game-data store from the shell).

Local dev (`npm run dev`) runs your game **plus** the RYDR shell at http://localhost:3100 —
with a power slider, or a real trainer if one is paired. To ship, the agent follows `SETUP.md`
steps 6–8: push to a GitHub repo, deploy to a per-game Vercel project (GitHub-connected, so
pushes auto-deploy), then `npm run register` to add it to the platform as a draft anyone can
test via the shell's `?admin`.
