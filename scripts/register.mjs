#!/usr/bin/env node
/**
 * Register (or update) this game in the RYDR platform library — no /admin.html needed.
 *
 * Reads the game's manifest from package.json's `rydr` block, the deployed URL from
 * `--url` (or $RYDR_GAME_URL), and the **admin secret from your environment** ($RYDR_ADMIN_SECRET)
 * or an interactive prompt — so the secret never has to be typed where an AI can see it.
 *
 * Usage:
 *   RYDR_ADMIN_SECRET=… npm run register -- --url https://<your-game>.vercel.app [--live]
 *   # or omit the env var and paste the secret when prompted.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const rydr = pkg.rydr ?? {};
const slug = rydr.slug || (pkg.name || "").replace(/^@rydr\/game-/, "");
const url = arg("url") || process.env.RYDR_GAME_URL;
const host = "rydr.bdefrenne.partykit.dev"; // the one shared RYDR backend — not configurable

if (!slug || !rydr.title || !url) {
  console.error("Missing slug/title (package.json `rydr`) or --url / $RYDR_GAME_URL.");
  process.exit(1);
}

async function getSecret() {
  if (process.env.RYDR_ADMIN_SECRET) return process.env.RYDR_ADMIN_SECRET.trim();
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const secret = await new Promise((res) => rl.question("Admin secret: ", res));
  rl.close();
  return secret.trim();
}

const manifest = {
  slug,
  title: rydr.title,
  icon: rydr.icon || "gamepad",
  accent: rydr.accent || "#4a73c0",
  url: url.replace(/\/$/, ""),
  isLive: hasFlag("live"), // draft by default; pass --live to publish
};

const secret = await getSecret();
if (!secret) {
  console.error("No admin secret provided.");
  process.exit(1);
}

const endpoint = `https://${host}/parties/games/index/admin/upsert`;
const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
  body: JSON.stringify(manifest),
});
const body = await res.text();
if (!res.ok) {
  console.error(`Register failed (${res.status}): ${body}`);
  process.exit(1);
}
console.error(
  `Registered "${slug}" → ${manifest.url} (${manifest.isLive ? "LIVE" : "draft"}). ` +
    `It will appear in the library${manifest.isLive ? "" : " once you mark it Live (or via ?admin)"}.`,
);
