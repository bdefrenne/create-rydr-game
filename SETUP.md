# Setting up a new RYDR game — agent guide

You are an AI agent creating a new RYDR game from this template. Do every step below
end-to-end; ask the user only for the game idea, a slug/title, and a free port if `3400`
is taken. **Delete this file from the new game when done.**

## 1. Get into a fresh game folder

This template is the **source — never build the game inside it.** Create a new **sibling
folder** and work there:

```bash
npx degit bdefrenne/create-rydr-game ../rydr-<game>   # fresh copy, no git history
cd ../rydr-<game>
git init                 # start a fresh local repo
npm install              # installs deps AND fetches @rydr/game-sdk so you can read it
```
(If the user already ran `degit` and you're inside the new folder, just `git init && npm install`.)

## 2. Learn the SDK — by loading and reading the package

**If you don't already know the `@rydr/game-sdk` API, that's expected — load it and read it.**
After `npm install` (step 1) the package is on disk; read it instead of guessing:
- `node_modules/@rydr/game-sdk/dist/index.d.ts` — the exact, authoritative API:
  `connectToPlatform`, `PlatformSession` (`hardware`, `identity`, `onButton`,
  `setChrome`/`setRoute`, `startActivity`/`finishActivity`, trainer control, lifecycle),
  `HardwareSnapshot`, `ScopedIdentity`, `Capability`, `createDevHarness`.
- `node_modules/@rydr/game-sdk/README.md` — usage + an API overview.

Then read this repo's `CLAUDE.md` for the guest **rules** (content-only, SDK-only, etc.).
The package is the source of truth — never invent SDK methods.

## 3. Name the game (replace the placeholders)

Pick a kebab-case **slug** and a human **title** (ask the user). Replace every occurrence:
- `__SLUG__` → slug (e.g. `flappy-bike`) — `package.json` (`name` → `@rydr/game-<slug>`, and
  the `dev` script) and `src/main.ts` (`gameId`).
- `__TITLE__` → title (e.g. `RYDR Flappy Bike`) — `index.html` `<title>` (+ the demo text)
  and `package.json` (`description` + `dev` script).
- Port defaults to `3400` (in `vite.config.ts` **and** the `dev` script's
  `--game http://localhost:<port>`); change both only if it clashes with something running.

## 4. Build the game

The game gets **full hardware access — there are no capabilities to choose** (don't pass a
`capabilities` list; `connectToPlatform({ gameId })` grants everything).

Implement it in `src/`: read live values from `session.hardware` (power/cadence/HR/speed)
and `session.identity` (`ftp` is always a usable number — no fallback); drive resistance
with `setSimulation`/`setTargetPower` if relevant; `setChrome(false)` for immersive play;
`setRoute(path)` for shareable URLs; and bracket the ride with
`startActivity`/`finishActivity` so the **shell** records the FIT.

## 5. Run it locally

```bash
npm run dev   # your game + the RYDR shell at http://localhost:3100 (power slider / trainer)
```

## 6. Create the GitHub repo + push

```bash
git add -A && git commit -m "Initial RYDR game: <slug>"
# Create the remote first — `gh repo create <owner>/<repo> --private --source=. --push`,
# or ask the user to create github.com/<owner>/<repo> and then:
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

## 7. Deploy + register in the library

- Connect the repo to **Vercel** → it deploys on every push to `main` (the build clones only
  the **public** `@rydr/game-sdk`, so no tokens/secrets are needed). Note the production URL.
- Register the game at **https://rydr-platform.vercel.app/admin.html** (enter the admin
  secret): slug / title / icon / accent / URL. Leave **Live** unchecked to keep it a draft —
  preview it on the shell via `?admin`, then check **Live** to publish.
