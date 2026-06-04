# create-rydr-game

Template for a new game on the **RYDR platform**. Scaffold it:

```bash
npx degit bdefrenne/create-rydr-game my-game
cd my-game
```

Then open the folder in your AI agent and say:

> Set this up per `SETUP.md` as `<slug>` / `<title>` on port `<port>`, then build `<your game idea>`.

The agent follows [`SETUP.md`](./SETUP.md) to replace the placeholders, pick capabilities,
and scaffold the game; [`CLAUDE.md`](./CLAUDE.md) documents the guest conventions (content-only,
SDK-only dependency, power/identity/FIT come from the shell).

Local dev (`npm run dev`) runs your game **plus** the RYDR shell at http://localhost:3100 —
with a power slider, or a real trainer if one is paired. Deploy by pushing to a GitHub repo
connected to Vercel, then register the game at `…/admin.html`.
