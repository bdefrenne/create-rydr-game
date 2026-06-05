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
  `setChrome`/`setRoute`, trainer control, lifecycle, and the **backend services** —
  `submitScore`/`getLeaderboard`, `saveRun`/`getRun`, `saveReplay`/`getReplays`, the data-store
  methods, `getUploadUrl`, `joinRoom`), `HardwareSnapshot`, `ScopedIdentity`, `Capability`, `createDevHarness`.
- `node_modules/@rydr/game-sdk/README.md` — usage + an API overview, incl. *Backend services*.

Then read this repo's `CLAUDE.md` for the guest **rules** (content-only, SDK-only, etc.).
The package is the source of truth — never invent SDK methods.

## 3. Name the game (replace the placeholders)

Pick a kebab-case **slug** and a human **title** (ask the user). Replace every occurrence:
- `__SLUG__` → slug (e.g. `flappy-bike`) — `package.json` (`name` → `@rydr/game-<slug>`,
  the `rydr.slug` block, and the `dev` script) and `src/main.ts` (`gameId`).
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
  The board only reaches the platform when you **register** (step 7) — submitting to an id that
  isn't declared+registered is rejected.
- Port defaults to `3400` (in `vite.config.ts` **and** the `dev` script's
  `--game http://localhost:<port>`); change both only if it clashes with something running.

## 4. Build the game

The game gets **full hardware access — there are no capabilities to choose** (don't pass a
`capabilities` list; `connectToPlatform({ gameId })` grants everything).

Implement it in `src/`: read live values from `session.hardware` (power/cadence/HR/speed)
and `session.identity` (`ftp` is always a usable number — no fallback); drive resistance
with `setSimulation`/`setTargetPower` if relevant; `setChrome(false)` for immersive play;
`setRoute(path)` for shareable URLs. **Do nothing for activity/FIT recording** — the
platform records every session automatically from its own hardware stream; there is no
recording API to call.

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
- Register the game from the terminal — it reads slug/title/icon/accent **and `boards`** from
  `package.json`'s `rydr` block and POSTs to the platform registry. **The admin secret stays
  out of your (the AI's) view** — ask the user to run it with the secret in their env, or to
  paste it at the prompt:

  ```bash
  RYDR_ADMIN_SECRET=… npm run register -- --url https://<your-game>.vercel.app   # draft
  #                                                                       add --live to publish
  ```

  Drafts don't appear in the public library; preview on the shell via `?admin`, then re-run
  with `--live` (or flip **Live** in `?admin`) to publish.

- **Registering is a separate step from deploying.** A Vercel deploy ships your *code*; it does
  **not** touch the registry. Changing `rydr.boards` (or title/icon) only reaches the platform
  when you **re-run `npm run register`** — otherwise a newly-declared board never appears and
  `submitScore` to it is rejected.
- **The repo is the source of truth.** `register` overwrites the whole manifest entry, so editing
  boards in `?admin` is a *transient* quick-edit — the next `register` from the repo clobbers it.
  Mirror any keeper edits back into `package.json`'s `rydr.boards`.
