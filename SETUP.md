# Setting up a new RYDR game — agent guide

You are an AI agent creating a new RYDR game from this template. **All 8 steps are mandatory —
"creating a game" includes shipping it.** The job is not done until the game is deployed to Vercel
and registered on the platform (steps 6–8, **Live** by default); do not stop at local dev or treat
shipping as optional. Steps 6–8 need a few inputs from the user — **ask for them up front and
proceed**, don't use them as a reason to skip: the game idea, a slug/title, a free port if `3400`
is taken, and the GitHub `<owner>` for the repo (step 6). Step 8 (registration) is done by the user
in the platform admin UI while signed in as an admin — no secret, no CLI. Step 6 uses the **`gh`
CLI** — if it's not installed, have the user install + `gh auth login` up front (don't hand-create
the repo). The only legitimate reason to stop before step 8 is the user **explicitly** saying they
don't want to ship yet.
**Delete this file from the new game when done.**

## 0. Prerequisites — install these before you start

These are a **gate**, not a step you reach later. Set them up *before* step 1:

- **`gh` (GitHub CLI)** and **`vercel` (Vercel CLI)** must both be **installed and
  authenticated** — they are required, not optional. If either is missing, install it now
  (`brew install gh` / `npm i -g vercel` on macOS, or https://cli.github.com /
  https://vercel.com/cli) and authenticate (`gh auth login`, `vercel login`). A missing CLI is
  **never** a reason to skip a step or to do something by hand instead.
- **Gather these inputs from the user up front** (don't use a missing one as a reason to skip):
  the game idea, a slug/title, a free port if `3400` is taken, and the GitHub `<owner>` for the repo
  (step 6). Registration (step 8) is done by the user in the platform admin UI (`/admin.html`) while
  signed in as an admin — no secret to gather.

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
  `setMenu`/`setRoute`, trainer control, lifecycle, and the **backend services** —
  `startRun`/`saveRun`/`getRun` (runs + their scores), `getLeaderboard`, `saveReplay`/`getReplays`,
  the data-store methods, `getUploadUrl`, `joinRoom`), `HardwareSnapshot`, `ScopedIdentity`, `Capability`.
- `node_modules/@rydr/game-sdk/README.md` — usage + an API overview, incl. *Backend services*.

Then read this repo's `CLAUDE.md` for the guest **rules** (content-only, SDK-only, etc.).
The package is the source of truth — never invent SDK methods.

## 3. Name the game (replace the placeholders)

Pick a kebab-case **slug** and a human **title** (ask the user). Replace every occurrence:
- `__SLUG__` → slug (e.g. `flappy-bike`) — `package.json` (`name` → `@rydr/game-<slug>`,
  the `rydr.slug` block, the `dev` script, **and the `deploy:link` script**), `src/main.ts`
  (`gameId`), and `src/voice-over-editor/host.ts` (`gameId` + the deep-link message).
- `__TITLE__` → title (e.g. `RYDR Flappy Bike`) — `index.html` `<title>` (+ the demo text),
  `voice-over-editor.html` `<title>`, and `package.json` (`description`, `rydr.title`, and the `dev` script).
- Optionally set `rydr.icon` / `rydr.accent` in `package.json` (used by the library tile);
  the defaults are fine.
- **Leaderboards (only if your game scores).** `rydr.boards` ships empty (`[]`) — a session-only
  game leaves it so. If your game ranks players, declare one board per ranking in `rydr.boards`,
  then submit to it when a run completes: `session.saveRun({ scores: [{ boardId: "<id>", value }] })`.
  Each board is
  `{ id, valueType, sort, aggregate, label? }` — `sort` is `"asc"` (lower wins, e.g. time) or
  `"desc"`; `aggregate` is `"best"|"last"|"sum"`; `valueType` is one of the display hints in the
  SDK's `boards.ts` (`score`, `time`, `distance`, `speed`, `percent`, `duration`, `count`). E.g.:
  ```jsonc
  "boards": [{ "id": "score", "label": "High Scores", "valueType": "score", "sort": "desc", "aggregate": "best" }]
  ```
  The board only reaches the platform when you **register** (step 8) — submitting to an id that
  isn't declared+registered is rejected.

  **Don't partition boards by input source yourself.** The shell auto-splits every board by
  power source (keyboard vs trainer) — a trainerless effort never ranks against a pedalled one —
  appending it to your `key` on both submit and read, symmetrically. Pass only your own dimension
  (e.g. a track id) as `key`; in-game you always read back the board matching the current input,
  and the platform `/leaderboards` hub shows the trainer boards.
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
and `session.identity` (`ftp` is always a usable number — no fallback). For a steady control
signal, prefer **`session.hardware.current.smoothedPower`** (an SDK EMA — don't hand-roll a
filter) over raw `power`; tune it per game with `rydr.powerSmoothing` (seconds) in
`package.json`, or omit for the 0.06s default. Drive resistance
Read controller buttons with `session.onButton`/`session.isDown` (canonical, source-agnostic
`A`/`B`/`Y`/`Z`/`UP`/`DOWN`/`LEFT`/`RIGHT`; house convention A=confirm, Z=back);
`session.hardware.current.controllerConnected`
tells you whether a non-keyboard controller (Zwift Play/gamepad/phone) is connected, so you can
vary behaviour by input setup (e.g. an XP multiplier) — it never reveals which device. Drive resistance
with `setSimulation`/`setTargetPower` if relevant; `setMenu(false)` for immersive play;
`setPowerBar(false)` to hide the shell's trainerless power bar where it doesn't belong (e.g. an
editor or menu), `setPowerBar(true)` during play (both default to visible);
`setMenu(false)`/`setMenu(true)` to hide/show the shell's in-game platform menu — the hamburger
that opens Exit + hardware (also defaults to visible); `setRoute(path)` for shareable URLs. **Do nothing for activity/FIT recording** — the
platform records every session automatically from its own hardware stream; there is no
recording API to call.

> **Voice-over is scaffolded — leave it in.** The template ships a per-game voice-over editor
> (`voice-over-editor.html` + `src/voice-over-editor/host.ts`, a vite build input + a
> `/voice-over-editor` route rewrite) — the same in every RYDR game. Admins reach it at
> `/game/<slug>/voice-over-editor` to generate French TTS for conversations you author in code with
> `defineConversation` (see `src/main.ts` + `CLAUDE.md`). Set a character's `voice` in Character
> Studio first. A game with no dialogue can ignore it, but don't delete the entry.

> **Deep links — your host must serve them.** The shell mounts your game at
> `game.url/<tail>`, so any route you project via `setRoute` becomes a real URL on your
> origin (and is shareable/refreshable). On a direct hit / refresh of e.g.
> `/game/<you>/play/abc`, Vercel receives a request for `/play/abc` — with no rewrite it 404s
> *before* your `index.html` ever loads, and the shell shows "not found". The scaffolded
> `vercel.json` already ships the SPA catch-all that fixes this:
>
> ```json
> "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
> ```
>
> This is safe: Vercel applies `rewrites` only *after* a filesystem miss, so real documents
> (`index.html`, `editor.html`, `run-editor.html`) and `/assets/*` are still served directly —
> only client routes fall through to `index.html`, which boots and routes from
> `session.initialPath`. Keep separate documents as real build inputs and you're done.

**Backend — don't reach for it too soon.** A session-only game (read hardware, play, let the
platform record the activity) is complete and needs no backend. If/when you *do* need more, the
shell backs it on the SDK session — never stand up your own: **runs + leaderboards** (`startRun`/
`saveRun`/`getRun` + `getLeaderboard`), **replays/ghosts** (`saveReplay`/
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
scope/team; nothing is hardcoded). The build installs only the **public** npm package
`@rydr/game-sdk` (from the registry — not a GitHub clone), so no tokens/secrets are needed. Project
name convention: **`rydr-game-<slug>`** (already encoded in the `deploy:link` script).

```bash
npm run deploy:link    # `vercel link` → creates/links project rydr-game-<slug> (writes .vercel/, gitignored)
vercel git connect     # wire the pushed GitHub repo → auto-deploy on every push to main
npm run deploy         # `vercel --prod` → first production deploy; prints the production URL
```

Note the printed **production URL** for the next step. After this, ordinary `git push` to `main`
redeploys automatically — you only re-run `npm run deploy` for an out-of-band manual deploy.

## 8. Register in the library (LIVE by default)

Registration is done by a **platform admin** in the RYDR admin UI at **`/admin.html`** on the
platform — there is no CLI and no secret. Admin access is simply being **signed in to the platform
with an admin-role account** (Supabase `app_metadata.role === 'admin'`); the AI never handles any
credential. Since the AI can't sign in, **the register step is performed by the user** — walk them
through it (or hand them the values to paste).

1. The user opens **`/admin.html`** on the platform while signed in as an admin.
2. Click **Add**, then fill the form from this game's `package.json` `rydr` block:
   **Slug** (immutable id), **Title**, **Icon**, **Accent** (hex), **Entry URL**
   (`https://<your-game>.vercel.app`), plus each **leaderboard board** from `rydr.boards`.
3. Leave **Live** checked to publish immediately, or uncheck it to register a **draft**.
4. **Save.**

A **draft** doesn't show in the public library but is previewable on the shell when signed in as a
platform admin. Flip **Live** on later (same form) to publish.

- **Registering is a separate step from deploying.** A Vercel deploy ships your *code*; it does
  **not** touch the registry. Adding a board (or changing title/icon) only reaches the platform when
  the admin **edits the game's entry in `/admin.html`** — otherwise a newly-declared board never
  appears and a `saveRun` score to it is rejected.
- **The registry is the source of truth at runtime.** `session.boards` comes from the registry
  entry (not `package.json`), so keep `rydr.boards` in the repo as the canonical record and mirror
  any board you add in `/admin.html` back into it.

## ✅ Definition of done

A **Live game is not proof the repo step happened** — `vercel --prod` deploys straight from local
even with no GitHub repo. Verify **every** box below before you claim the game is done. An unchecked
GitHub-repo box means the game is **not done**, no matter what's live.

- [ ] **GitHub repo exists and `main` is pushed** — `gh repo view <owner>/rydr-game-<slug>` succeeds
      and `git remote -v` shows `origin`.
- [ ] **Vercel project linked *and* git-connected** — `.vercel/` exists and `vercel git connect` was
      run (so pushes to `main` auto-deploy).
- [ ] **Production deploy succeeded** — `npm run deploy` printed a production URL.
- [ ] **Registered in the library** — the user added the game in `/admin.html` (Live by default, or
      draft if they asked), with the Entry URL pointing at the production deploy.
- [ ] **`SETUP.md` deleted** from the new game folder.
