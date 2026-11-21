#!/usr/bin/env node
// household-select.mjs — the identity and membership facts a check needs, and nothing else (POS-1151).
//
// WHY: twice (2026-11-17, 2026-11-19) a diagnostic found the right household and then printed the WHOLE
// record, consent-shaped fields included (Rei's receipt; POS-1151). The fix is the shape of the output:
// this tool builds a NEW object holding only allowlisted fields, one by one, BEFORE anything is printed,
// saved or logged. No record is spread, cloned or printed, so a field this file doesn't name can never
// reach the output, whatever the registry grows.
//
//   node tools/household-select.mjs --handle <resident>            the household a resident belongs to
//   node tools/household-select.mjs --household <slug>             one household by its slug
//   node tools/household-select.mjs --account <github login>       the household an account is bound to
//     [--fields household,residents,accounts,member_of]            a subset of the allowlist (default: all of it)
//     [--registry <path to households.json>]                      default: tools/households.json beside this file
//
// THE ALLOWLIST is ALLOWED below: the slug, residents, accounts and member_of. Any other field name asked
// for is refused (exit 2) with the allowlist named, and no record is read. Out: one JSON line per match,
// {household, ...the fields asked}; nothing found is one line {found: false} and exit 1.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED = Object.freeze(["household", "residents", "accounts", "member_of"]);

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? [v] : []);

/**
 * The selected facts of one household, built field by field from the allowlist. `fields` must be a subset
 * of ALLOWED; the record is only read, never copied whole. Arrays are copied as fresh string arrays.
 */
export function selectHousehold(slug, record, fields = ALLOWED) {
  const out = {};
  for (const f of fields) {
    if (f === "household") out.household = String(slug);
    else if (f === "residents") out.residents = strings(record?.residents);
    else if (f === "accounts") out.accounts = strings(record?.accounts);
    else if (f === "member_of") out.member_of = strings(record?.member_of);
  }
  return out;
}

/** The matches for a query against the registry's households, each already reduced to `fields`. */
export function query(registry, { handle = null, household = null, account = null }, fields = ALLOWED) {
  const hh = registry?.households ?? {};
  const lc = (s) => String(s).toLowerCase();
  const hits = [];
  for (const [slug, rec] of Object.entries(hh)) {
    const match = (household !== null && slug === household)
      || (handle !== null && strings(rec?.residents).includes(handle))
      || (account !== null && strings(rec?.accounts).some((a) => lc(a) === lc(account)));
    if (match) hits.push(selectHousehold(slug, rec, fields));
  }
  return hits;
}

/** --fields parsed against the allowlist: { fields } or { refused } naming what isn't allowed. */
export function fieldsOf(arg) {
  if (arg === null || arg === undefined) return { fields: [...ALLOWED] };
  const asked = String(arg).split(",").map((s) => s.trim()).filter(Boolean);
  const bad = asked.filter((f) => !ALLOWED.includes(f));
  if (bad.length) return { refused: `not allowed: ${bad.join(", ")}. This tool prints only ${ALLOWED.join(", ")} (POS-1151).` };
  return { fields: ["household", ...asked.filter((f) => f !== "household")] };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] ?? null : null; };
  const f = fieldsOf(opt("--fields"));
  if (f.refused) { console.error(`household-select: ${f.refused}`); process.exit(2); }
  const q = { handle: opt("--handle"), household: opt("--household"), account: opt("--account") };
  if ([q.handle, q.household, q.account].filter((v) => v !== null).length !== 1) {
    console.error("household-select: give exactly one of --handle, --household or --account"); process.exit(2);
  }
  const path = opt("--registry") ?? join(dirname(fileURLToPath(import.meta.url)), "households.json");
  const hits = query(JSON.parse(readFileSync(path, "utf8")), q, f.fields);
  if (!hits.length) { console.log(JSON.stringify({ found: false })); process.exit(1); }
  for (const h of hits) console.log(JSON.stringify(h));
}
