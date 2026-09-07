# Setting up a new RYDR game — agent guide

You are an AI agent creating a new RYDR game from this template. **All 8 steps are mandatory —
"creating a game" includes shipping it.** The job is not done until the game is deployed to Vercel
and registered on the platform (steps 6–8, **Live** by default); do not stop at local dev or treat
shipping as optional. Steps 6–8 need a few inputs from the user — **ask for them up front and
proceed**, don't use them as a reason to skip: the game idea, a slug/title, a free port if `3400`
is taken, and the GitHub `<owner>` for the repo (step 6). Step 8 (registration) you do **yourself**
via a Supabase migration + `supabase db push` (see step 8) — the only thing you may need to ask the
user is to *connect* the `supabase` CLI (`supabase login`/`link`) if it isn't already. Step 6 uses the
**`gh` CLI** — if it's not installed, have the user install + `gh auth login` up front (don't
hand-create the repo). The only legitimate reason to stop before step 8 is the user **explicitly**
saying they don't want to ship yet.
**Delete this file from the new game when done.**

## 0. Prerequisites — install these before you start

These are a **gate**, not a step you reach later. Set them up *before* step 1:

- **`gh` (GitHub CLI)**, **`vercel` (Vercel CLI)**, and **`supabase` (Supabase CLI)** must all be
  **installed and authenticated** — they are required, not optional. If any is missing, install it now
  (`brew install gh supabase/tap/supabase` / `npm i -g vercel` on macOS, or https://cli.github.com /
  https://vercel.com/cli / https://supabase.com/docs/guides/cli) and authenticate (`gh auth login`,
  `vercel login`, `supabase login`). The `supabase` CLI registers the game in step 8 (its RYDR project
  must be linked — normally already done in the `../rydr-platform` sibling). A missing CLI is **never**
  a reason to skip a step or to do something by hand instead.
- **Gather these inputs from the user up front** (don't use a missing one as a reason to skip):
  the game idea, a slug/title, a free port if `3400` is taken, and the GitHub `<owner>` for the repo
  (step 6). Registration (step 8) you do yourself via a `supabase db push` migration — nothing to
  gather except, if the `supabase` CLI isn't connected, asking the user to `supabase login`/`link`.

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
  `connectToPlatform`, `PlatformSession` (`hardware`, `identity`, `onButton`, `axis`/`stick`,
  `vibrate` (controller rumble), `setActivity`, `setRoute`, lifecycle,
  and the **backend services** —
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
`package.json`, or omit for the 0.06s default.
Read controller buttons with `session.onButton`/`session.isDown` (canonical, source-agnostic:
the positional face diamond `DIAMOND_UP`/`DIAMOND_DOWN`/`DIAMOND_LEFT`/`DIAMOND_RIGHT`,
`UP`/`DOWN`/`LEFT`/`RIGHT`, right-stick `RUP`/`RDOWN`/`RLEFT`/`RRIGHT`, trigger clicks `LT`/`RT`,
stick presses `LSTICK_PRESS`/`RSTICK_PRESS`, and `OPTIONS` (the game's OWN menu/options button —
distinct from the platform's own overlay menu, which never reaches a game); house convention
DIAMOND_DOWN=confirm, DIAMOND_RIGHT=back — print labels via `session.buttonLabel(name)`, never a
hardcoded letter). For
hall-effect analog, the stick axes `session.axis("LX"|"LY"|"RX"|"RY")` give `-1..1` (the only axes —
`LT`/`RT` are plain clicks, digital only) and
`session.stick("LSTICK", { deadzone })` gives a radially-deadzoned `{ x, y, magnitude, angle }` (deadzone defaults to `0.1`) — always readable
(quantized to endpoints on a plain controller), with the digital `isDown`/`onButton` still firing in
parallel, so use either or both. `session.hardware.current.controllerConnected`
tells you whether a non-keyboard controller (Zwift Play/gamepad/phone) is connected, so you can
vary behaviour by input setup (e.g. an XP multiplier) — it never reveals which device.
**Do not try to drive resistance** — `setSimulation`/`setTargetPower` are no-ops on the shell
(trainer feel is rider-owned, tuned with the shift paddles and persisted per trainer). What you MUST
call is `setActivity("playing"|"menu")`: the shell eases resistance ~35% on any non-playing screen so
riders can spin while navigating, and **a game that never reports stays eased through all gameplay**.
Use `setPowerBar(false)` to hide the shell's trainerless power bar where it doesn't belong (e.g. an
editor or menu), `setPowerBar(true)` during play (both default to visible); the shell's in-game
platform menu (Exit + hardware) is summoned by the MENU button / M key, never drawn as a persistent
button; `setRoute(path)` for shareable URLs. **Do nothing for activity/FIT recording** — the
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
npm run dev          # your game + the RYDR shell at http://localhost:3100 (power slider / trainer)
npm run dev:frozen   # same, but HMR off — edits never reload the tab; refresh manually to pull changes
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

## 8. Register in the library (LIVE by default) — **do it yourself, don't punt to the user**

Registration is an **upsert into the platform's Supabase `public.games` table**, gated by RLS
(admin role). **There is no admin secret and no `register` script** (the old `ADMIN_SECRET` model is
gone). The AI **can and should register the game itself** via a Supabase migration — the only thing
to ask the user for is *connecting* (authenticating the CLI), and only if it isn't already.

### Prerequisite (the one thing you may need to ask the user)
The **`supabase` CLI** must be installed + **authenticated** (`supabase login`) and the **RYDR
platform project linked**. In the normal workspace the platform is the sibling repo `../rydr-platform`
with the project already linked (`supabase/.temp/` present). Verify with `supabase projects list`
(the RYDR project shows `"linked": true`). If it's not authenticated/linked, that's the *only* step to
hand to the user: “run `supabase login` (and `supabase link` in `../rydr-platform`)”. Nothing else.

### Register via a migration (the self-service path)
Work in the **platform repo** (`../rydr-platform`), NOT the game repo — the migration writes the
registry row:

1. Add `supabase/migrations/<UTC-timestamp>_register_<slug>.sql`, mirroring the idempotent upsert in
   `0005_seed_games.sql`. The row is `(slug, title, status, boards jsonb, manifest jsonb)` and
   `manifest` is the full `GameManifest` built from this game's `package.json` `rydr` block. Board
   objects use the key **`id`** (not `boardId`). `status` = `live` (or `draft` if the user asked):
   ```sql
   insert into public.games (slug, title, status, boards, manifest)
   select g->>'slug', coalesce(g->>'title',''),
     case when (g->>'isLive')::boolean is false then 'draft' else 'live' end,
     coalesce(g->'boards','[]'::jsonb), g
   from jsonb_array_elements($json$
   [ { "slug":"<slug>", "title":"<Title>", "icon":"<icon>", "accent":"<#hex>",
       "url":"https://rydr-game-<slug>.vercel.app",
       "capabilities":["power","cadence","heartRate","speed","buttons","identity"],
       "boards":[ /* each rydr.boards entry: {id,label,valueType,sort,aggregate} */ ],
       "isLive":true } ]
   /* Optional artwork: "squareImage" (1:1) and "coverImage" (3:1), each an object
      { "original", "large", "small" } of WebP URLs. Easiest to add by uploading in /admin.html
      (Edit game → Upload square/cover): it opens a cropper, encodes WebP at large/small/original,
      stores them on R2, and writes the URL set into the manifest for you. */
   $json$::jsonb) g
   on conflict (slug) do update set
     title=excluded.title, status=excluded.status, boards=excluded.boards,
     manifest=excluded.manifest, updated_at=now();
   ```
2. **`supabase db push --dry-run`** — confirm it lists **ONLY your new migration**. If any other
   migration is unexpectedly pending, **STOP** (don't push someone else's WIP) and resolve first.
3. **`supabase db push`** — applies it to the linked remote. The game is now Live.
4. **Verify** with a public read (live rows are anon-readable):
   `curl "$VITE_SUPABASE_URL/rest/v1/games?slug=eq.<slug>&select=slug,status,boards" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"`
   (URL + publishable key are in `../rydr-platform/.env.local`) → expect `"status":"live"`.
5. **Commit the migration** in `../rydr-platform` so repo history matches the remote DB. Stage only
   your file (the platform tree may hold unrelated WIP) and commit.

For a **draft** instead of Live, set `"isLive": false` (→ `status: draft`): hidden from the public
library, previewable on the shell by admins. Flip live later with another upsert migration.

**Fallback (no CLI / no platform access):** the admin UI at **`/admin.html`** (signed in as an
admin) → **Add**, fill Slug / Title / Icon / Accent / Entry URL + each board, Live, Save.
Optional **square/cover images** upload here too (Upload square/cover → crop → stored on R2 as WebP).

- **Registering is separate from deploying.** A Vercel deploy ships *code*; it does not touch the
  registry. A newly-declared board only becomes authoritative once its row is upserted (unregistered
  boards still record — `submit_score` defaults sort/aggregate to `desc`/`best` — they're just not
  configured/visible until registered).
- **The registry is the runtime source of truth.** `session.boards` comes from the registry row (not
  `package.json`), so keep `rydr.boards` in the repo as the canonical record and mirror it into the
  `manifest`/`boards` you upsert.

## ✅ Definition of done

A **Live game is not proof the repo step happened** — `vercel --prod` deploys straight from local
even with no GitHub repo. Verify **every** box below before you claim the game is done. An unchecked
GitHub-repo box means the game is **not done**, no matter what's live.

- [ ] **GitHub repo exists and `main` is pushed** — `gh repo view <owner>/rydr-game-<slug>` succeeds
      and `git remote -v` shows `origin`.
- [ ] **Vercel project linked *and* git-connected** — `.vercel/` exists and `vercel git connect` was
      run (so pushes to `main` auto-deploy).
- [ ] **Production deploy succeeded** — `npm run deploy` printed a production URL.
- [ ] **Registered in the library** — you upserted the game into Supabase `public.games` via a
      `register_<slug>` migration + `supabase db push` (Live by default, or draft if asked), verified
      with the public read, and committed the migration in `../rydr-platform`. Entry URL points at the
      production deploy. (Fallback: admin added it in `/admin.html`.)
- [ ] **`SETUP.md` deleted** from the new game folder.
