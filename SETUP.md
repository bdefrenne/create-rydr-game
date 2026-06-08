# Setting up a new RYDR game — agent guide

You are an AI agent creating a new RYDR game from this template. **All 8 steps are mandatory —
"creating a game" includes shipping it.** The job is not done until the game is deployed to Vercel
and registered on the platform (steps 6–8, **Live** by default); do not stop at local dev or treat
shipping as optional. Steps 6–8 need a few inputs from the user — **ask for them up front and
proceed**, don't use them as a reason to skip: the game idea, a slug/title, a free port if `3400`
is taken, the GitHub `<owner>` for the repo (step 6), and the user's private `.env.local` (holding
`ADMIN_SECRET`) pasted into the new repo before registering (step 8). Step 6 uses the **`gh` CLI** —
if it's not installed, have the user install + `gh auth login` up front (don't hand-create the repo).
The only legitimate reason to stop before step 8 is the user **explicitly** saying they don't want
to ship yet.
**Delete this file from the new game when done.**

## 0. Prerequisites — install these before you start

These are a **gate**, not a step you reach later. Set them up *before* step 1:

- **`gh` (GitHub CLI)** and **`vercel` (Vercel CLI)** must both be **installed and
  authenticated** — they are required, not optional. If either is missing, install it now
  (`brew install gh` / `npm i -g vercel` on macOS, or https://cli.github.com /
  https://vercel.com/cli) and authenticate (`gh auth login`, `vercel login`). A missing CLI is
  **never** a reason to skip a step or to do something by hand instead.
- **Gather these inputs from the user up front** (don't use a missing one as a reason to skip):
  the game idea, a slug/title, a free port if `3400` is taken, the GitHub `<owner>` for the repo
  (step 6), and the user's private `.env.local` (holding `ADMIN_SECRET`) to paste into the new
  repo before registering (step 8).

## 1. Get into a fresh game folder

This template is the **source — never build the game inside it.** Create a new **sibling
folder** and work there:

```bash
npx degit bdefrenne/create-rydr-game ../rydr-game-<slug>   # fresh copy, no git history
cd ../rydr-game-<slug>
git init                 # start a fresh local repo
npm install              # installs deps AND fetches @rydr/game-sdk so you can read it
```
(If the user already ran `degit` and you're inside the new folder, just `git init && npm install`.)

## 2. Learn the SDK — by loading and reading the package

**If you don't already know the `@rydr/game-sdk` API, that's expected — load it and read it.**
After `npm install` (step 1) the package is on disk; read it instead of guessing:
- `node_modules/@rydr/game-sdk/dist/index.d.ts` — the exact, authoritative API:
  `connectToPlatform`, `PlatformSession` (`hardware`, `identity`, `onButton`,
  `setChrome`/`setRoute`, trainer control, lifecycle, and the **backend services** —
  `submitScore`/`getLeaderboard`, `saveRun`/`getRun`, `saveReplay`/`getReplays`, the data-store
  methods, `getUploadUrl`, `joinRoom`), `HardwareSnapshot`, `ScopedIdentity`, `Capability`.
- `node_modules/@rydr/game-sdk/README.md` — usage + an API overview, incl. *Backend services*.

Then read this repo's `CLAUDE.md` for the guest **rules** (content-only, SDK-only, etc.).
The package is the source of truth — never invent SDK methods.

## 3. Name the game (replace the placeholders)

Pick a kebab-case **slug** and a human **title** (ask the user). Replace every occurrence:
- `__SLUG__` → slug (e.g. `flappy-bike`) — `package.json` (`name` → `@rydr/game-<slug>`,
  the `rydr.slug` block, the `dev` script, **and the `deploy:link` script**) and `src/main.ts`
  (`gameId`).
- `__TITLE__` → title (e.g. `RYDR Flappy Bike`) — `index.html` `<title>` (+ the demo text)
  and `package.json` (`description`, `rydr.title`, and the `dev` script).
- Optionally set `rydr.icon` / `rydr.accent` in `package.json` (used by the library tile);
  the defaults are fine.
- **Leaderboards (only if your game scores).** `rydr.boards` ships empty (`[]`) — a session-only
  game leaves it so. If your game ranks players, declare one board per ranking in `rydr.boards`,
  then call `session.submitScore("<id>", value)` with that id. Each board is
  `{ id, valueType, sort, aggregate, label? }` — `sort` is `"asc"` (lower wins, e.g. time) or
  `"desc"`; `aggregate` is `"best"|"last"|"sum"`; `valueType` is one of the display hints in the
  SDK's `boards.ts` (`score`, `time`, `distance`, `speed`, `percent`, `duration`, `count`). E.g.:
  ```jsonc
  "boards": [{ "id": "score", "label": "High Scores", "valueType": "score", "sort": "desc", "aggregate": "best" }]
  ```
  The board only reaches the platform when you **register** (step 8) — submitting to an id that
  isn't declared+registered is rejected.
- Port defaults to `3400` (in `vite.config.ts` **and** the `dev` script's
  `--game http://localhost:<port>`); change both only if it clashes with something running.

## 4. Build the game

**Before you design the mechanic, read `CLAUDE.md`'s "The one rule: power is the controller".**
The rider's **watts** must drive the core action (FTP-relative — scale by `power / identity.ftp`),
and the game must *create reasons to modulate effort* (SEE → REACT → PUSH → SEE). Not cadence, not
heart rate. **A game where power isn't the primary control is wrong** — that's the single most
common mistake.

The game gets **full hardware access — there are no capabilities to choose** (don't pass a
`capabilities` list; `connectToPlatform({ gameId })` grants everything).

Implement it in `src/`: read live values from `session.hardware` (power/cadence/HR/speed)
and `session.identity` (`ftp` is always a usable number — no fallback); drive resistance
with `setSimulation`/`setTargetPower` if relevant; `setChrome(false)` for immersive play;
`setRoute(path)` for shareable URLs. **Do nothing for activity/FIT recording** — the
platform records every session automatically from its own hardware stream; there is no
recording API to call.

> **Deep links — make your host serve them.** The shell mounts your game at
> `game.url/<tail>`, so any route you project via `setRoute` becomes a real URL on your
> origin (and is shareable/refreshable). Your Vercel deploy **must** resolve those paths:
> add a SPA rewrite for each client route (e.g. `{ "source": "/(play|...)", "destination":
> "/index.html" }` in `vercel.json`) and keep separate documents (e.g. `run-editor.html`)
> as real build inputs. A projected route your host doesn't serve will 404 on refresh.

**Backend — don't reach for it too soon.** A session-only game (read hardware, play, let the
platform record the activity) is complete and needs no backend. If/when you *do* need more, the
shell backs it on the SDK session — never stand up your own: **leaderboards** (`submitScore`/
`getLeaderboard`), **run records** (`saveRun`/`getRun`), **replays/ghosts** (`saveReplay`/
`getReplays`), a shared **game-data store** (`player` saves, `public` UGC, `shared` content),
**asset hosting** (`getUploadUrl`), and **realtime rooms** (`joinRoom`). See `@rydr/game-sdk`'s
README (*Backend services*) for each API.

## 5. Run it locally

```bash
npm run dev   # your game + the RYDR shell at http://localhost:3100 (power slider / trainer)
```

## 6. Create the GitHub repo + push

**The GitHub repo is mandatory and comes before deploy.** The deploy below is **GitHub-connected**
(Vercel auto-deploys on every push to `main`), so without the repo the deploy isn't wired correctly
— and `npm run deploy` succeeding from local is **not** evidence this step is done. **Use the `gh`
CLI** — it's required (see Prerequisites). If it still isn't available, install + `gh auth login`
**now** (`brew install gh` on macOS, or https://cli.github.com); a missing `gh` is **never** a
reason to skip creating the repo.

```bash
git add -A && git commit -m "Initial RYDR game: <slug>"
gh repo create <owner>/rydr-game-<slug> --private --source=. --push
```

(Last resort only if the user genuinely can't install `gh`: still create the repo — have them make
`github.com/<owner>/rydr-game-<slug>` empty, then `git remote add origin … && git push -u origin main`.
Skipping the repo is not an option.)

(Naming convention — all the same `rydr-game-<slug>`: the folder, the GitHub repo, and the Vercel
project, matching the `@rydr/game-<slug>` package name.)

## 7. Deploy to a per-game Vercel project (GitHub-connected)

Uses the **Vercel CLI** — install it once and `vercel login` (the project adopts your logged-in
scope/team; nothing is hardcoded). The build clones only the **public** `@rydr/game-sdk`, so no
tokens/secrets are needed. Project name convention: **`rydr-game-<slug>`** (already encoded in the
`deploy:link` script).

```bash
npm run deploy:link    # `vercel link` → creates/links project rydr-game-<slug> (writes .vercel/, gitignored)
vercel git connect     # wire the pushed GitHub repo → auto-deploy on every push to main
npm run deploy         # `vercel --prod` → first production deploy; prints the production URL
```

Note the printed **production URL** for the next step. After this, ordinary `git push` to `main`
redeploys automatically — you only re-run `npm run deploy` for an out-of-band manual deploy.

## 8. Register in the library (LIVE by default)

Register reads slug/title/icon/accent **and `boards`** from `package.json`'s `rydr` block and POSTs
to the platform registry. The **admin secret never enters the AI's view**: it lives in a gitignored
**`.env.local`** (the template's `*.local` rule keeps it out of git) as `ADMIN_SECRET=…`.

```bash
# One-time per repo: paste your private .env.local (containing ADMIN_SECRET=…) into the repo root.
#   ⚠️ Never commit it, and never add it to the public create-rydr-game template.
npm run register -- --url https://<your-game>.vercel.app   # LIVE (isLive:true) by default
#                                                            add --draft to register as a hidden draft
```

`register` auto-loads `.env.local`, so no secret is typed inline. **Ask the user to paste their
`.env.local` into the new repo** before running it (or to paste the secret at the interactive
prompt). By default the game registers **Live** — it appears in the public library immediately. Pass
`--draft` (or flip **Live** off in `?admin`) for the "anyone can test it, not yet public" state: a
draft doesn't show in the public library but is previewable on the shell via `?admin`.

- **Registering is a separate step from deploying.** A Vercel deploy ships your *code*; it does
  **not** touch the registry. Changing `rydr.boards` (or title/icon) only reaches the platform
  when you **re-run `npm run register`** — otherwise a newly-declared board never appears and
  `submitScore` to it is rejected.
- **The repo is the source of truth.** `register` overwrites the whole manifest entry, so editing
  boards in `?admin` is a *transient* quick-edit — the next `register` from the repo clobbers it.
  Mirror any keeper edits back into `package.json`'s `rydr.boards`.

## ✅ Definition of done

A **Live game is not proof the repo step happened** — `vercel --prod` deploys straight from local
even with no GitHub repo. Verify **every** box below before you claim the game is done. An unchecked
GitHub-repo box means the game is **not done**, no matter what's live.

- [ ] **GitHub repo exists and `main` is pushed** — `gh repo view <owner>/rydr-game-<slug>` succeeds
      and `git remote -v` shows `origin`.
- [ ] **Vercel project linked *and* git-connected** — `.vercel/` exists and `vercel git connect` was
      run (so pushes to `main` auto-deploy).
- [ ] **Production deploy succeeded** — `npm run deploy` printed a production URL.
- [ ] **Registered in the library** — `npm run register -- --url …` succeeded (Live by default, or
      `--draft` if the user asked).
- [ ] **`SETUP.md` deleted** from the new game folder.
