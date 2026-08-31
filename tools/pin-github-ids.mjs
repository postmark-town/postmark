// pin-github-ids — binds each resident to their IMMUTABLE GitHub account ID.
//
// The witness certifies PRs by matching the author against the `github:`
// binding in resident ADDRESS files. But a GitHub *login* is mutable: accounts
// rename, and an abandoned login can be re-registered by a stranger — who
// would then inherit the old binding. The durable identity is the numeric
// account ID, which survives renames and dies with the account.
//
// This tool maintains tools/github-ids.json:
//
//   { "<resident-slug>": { "login": "<login-at-pin-time>", "id": 123, "pinned": "YYYY-MM-DD" } }
//
// Rules:
//   - A slug with no pin gets one: resolve the ADDRESS `github:` login via the
//     GitHub API and record its ID. This runs on the town clock, so a new
//     resident is pinned within hours of their join merging — while the login
//     still belongs to the human who wrote it.
//   - An existing pin is NEVER overwritten here. A pin moving to a different
//     account is a re-binding — a human decision, made by editing the registry
//     deliberately, not by a scheduled job following a changed string.
//   - If an ADDRESS `github:` login drifts from its pinned login, that is
//     reported but harmless: the witness binds by ID, so the stale string is
//     cosmetic (the resident can update it at leisure).
//   - A handle with MINTED HISTORY is not auto-pinned — a late pin re-derives
//     its past (the tulip class) — UNLESS the office pen has already sealed
//     `registry: <handle> = gh:<id>` onto the stamp-ledger, in which case the
//     pin is written from the LEDGER's id and is inert in the economy by
//     construction. See the block above the loop.
//
// Env: GITHUB_TOKEN optional (raises the API rate limit; the town has ~30
// residents, so even unauthenticated works for a full backfill).
// Exit code is always 0 — an unresolvable login is a warning, not a clock
// failure; that resident simply stays login-bound (the witness's fallback)
// until it resolves.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sealedAccountIds } from './stamp-mint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = join(ROOT, 'tools', 'github-ids.json');
const WP = join(ROOT, 'WHITE_PAGES');

function frontmatter(text) {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  const fm = {};
  for (const line of text.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !line.trim().startsWith('#')) fm[m[1]] = m[2].trim();
  }
  return fm;
}

async function resolveLogin(login) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'postmark-pin-github-ids' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers });
  if (!res.ok) return null;
  const j = await res.json();
  return typeof j.id === 'number' ? { id: j.id, login: j.login } : null;
}

const registry = existsSync(REGISTRY_PATH) ? JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) : {};
// THE TOWN'S DAY, NOT THE WIRE'S (the 2026-08-31 gift-blackout class): pinned:
// dates are FROM-GENESIS grouping truth the economy replays; the UTC day this
// derived put every 8 PM-midnight ET pin on tomorrow's date.
const today = new Intl.DateTimeFormat("en-CA",
  { timeZone: process.env.TOWN_TZ ?? "America/New_York" }).format(new Date());
let pinned = 0, warned = 0;

// The economy reads this registry as FROM-GENESIS grouping truth: replay
// derives June with whatever is here NOW. So a handle with minted history may
// never be auto-pinned — a late pin regroups its whole past and turns replay
// red (the tulip class, third bite 2026-08-08: this very clock re-created a
// reverted pin from the ADDRESS line four hours after the human fix). The
// standing grammar already says it: "never edit github-ids.json for minted
// handles" — their pins are a human ceremony (dated ledger registry: lines).
const MINTED = new Set();
try {
  const ledger = readFileSync(join(ROOT, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  for (const m of ledger.matchAll(/MINT → ([a-z0-9._-]+) ·/g)) MINTED.add(m[1]);
} catch { /* no ledger, no restriction */ }

// UNLESS the ceremony has already happened. A handle whose identity the office
// pen sealed onto the ledger as `registry: <handle> = gh:<id>` can be pinned
// safely, because a pin dated today necessarily falls after that line and is
// therefore INERT in the economy (stamp-mint.mjs § householdKeys — the ledger
// outranks the file), and because the witness now binds such a handle from the
// ledger regardless of this file. So the pin here is confirmation, not
// authority, and writing it keeps the register complete — which matters: the
// 08-24 hand-edit that turned June red began as an honest attempt to close a
// gap this refusal had left open in the register's own tripwire.
//
// The id comes from the LEDGER, never from resolving the ADDRESS login: those
// can disagree, and the sealed line is the one that has been through the pen.
const SEALED = sealedAccountIds(ROOT);

for (const d of readdirSync(WP).sort()) {
  if (d === 'TEMPLATE') continue;
  const ap = join(WP, d, 'ADDRESS.md');
  try {
    if (!statSync(join(WP, d)).isDirectory() || !existsSync(ap)) continue;
  } catch { continue; }
  const login = (frontmatter(readFileSync(ap, 'utf8').replace(/\r/g, '')).github || '').replace(/^@/, '');
  if (!login) continue;

  const pin = registry[d];
  if (pin) {
    if (pin.login.toLowerCase() !== login.toLowerCase()) {
      console.log(`note: ${d} — ADDRESS says github: ${login}, pinned to ${pin.login} (id ${pin.id}). Binding rides the ID; the string is cosmetic. Re-binding to a different account is a human edit of this registry.`);
    }
    continue;
  }

  if (MINTED.has(d)) {
    const sealedId = SEALED.get(d);
    if (sealedId == null) {
      console.log(`skip: ${d} — has minted history and no pin; auto-pinning would regroup its past from genesis (the tulip class). Pinning a minted handle is a human ceremony: a dated ledger registry: line, or a deliberate registry edit that stamp-verify blesses.`);
      warned++;
      continue;
    }
    registry[d] = { login, id: sealedId, pinned: today, note: `id from the sealed ledger line (registry: ${d} = gh:${sealedId}); minted handle, so this pin is inert in the economy and confirms the ledger rather than overriding it` };
    console.log(`pinned: ${d} -> ${login} (id ${sealedId}, from the sealed ledger line)`);
    pinned++;
    continue;
  }

  const resolved = await resolveLogin(login);
  if (!resolved) {
    console.log(`warn: ${d} — could not resolve github login "${login}" (404 or API error); left unpinned (witness falls back to login-compare).`);
    warned++;
    continue;
  }
  registry[d] = { login: resolved.login, id: resolved.id, pinned: today };
  console.log(`pinned: ${d} -> ${resolved.login} (id ${resolved.id})`);
  pinned++;
}

const sorted = Object.fromEntries(Object.entries(registry).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(REGISTRY_PATH, JSON.stringify(sorted, null, 2) + '\n');
console.log(`pin-github-ids: ${pinned} newly pinned, ${warned} unresolved, ${Object.keys(sorted).length} total pins.`);
