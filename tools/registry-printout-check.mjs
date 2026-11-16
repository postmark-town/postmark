#!/usr/bin/env node
// registry-printout-check.mjs — tools/households.json and tools/github-ids.json are the drain's alone (POS-345 d).
//
//   node tools/registry-printout-check.mjs --registry <file|url> [--range <base>..<head>] [--repo PATH]
//
// The two files are the STORE's printout: the office's registry-drain renders
// them from the store's `households` / `household_pins` rows and commits them as
// the Postmark Pen. Darko's ruling (2026-10-04) is that the store is the record
// and every reader reads it; a hand edit to a printout is a second writer the
// store never hears of. From 09-22 to 10-03 ten such hand commits landed, and on
// 10-04 five file-only binds held a clearing.
//
// Two rules, each named when it fails:
//
//   THE AUTHOR   every commit in the range that touches either file is the
//                pen's (its noreply author email). A person's commit, or a PR
//                branch editing either file, is refused. A hand repair goes to
//                the store (a ceremony), and the drain prints it.
//   THE RECORD   every house the committed tools/households.json holds is the
//                store's house, field for field, and every pin in
//                tools/github-ids.json is the store's pin. The house is
//                compared with the store's row AS THE PUBLIC MAY SEE IT: the
//                household's private `human` name is not printed (POS-394;
//                Darko 2026-10-05, Wright 2026-10-12), so the store's row is
//                projected without it, and a printed house that carries a
//                `human` key at all is refused, whatever its value and even
//                when it equals the store's. The office's GET /households and
//                its drain already leave it out; this is the town's own check. The store may hold
//                MORE than the file (a bind after the drain's commit is the
//                ordinary case by the time CI runs), never less or different.
//                --registry names the store's read: the office's GET /households
//                (tools/registry-source.mjs). One that does not answer fails the
//                check; it never passes for want of a record.
//
// Exit 0 when both hold, 1 when either fails (each failure printed), 2 on usage.

import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistrySource, registryArg } from './registry-source.mjs';

export const PEN_EMAIL = '301406700+postmark-pen@users.noreply.github.com';
export const PRINTOUTS = ['tools/households.json', 'tools/github-ids.json'];

/** JSON with every object's keys sorted, so two spellings of one record compare equal. */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** The keys a printed house never carries: the household's private name (POS-394). */
export const PRIVATE_HOUSE_KEYS = Object.freeze(['human']);

/** A house as the public may see it: every key but the private ones, in order. Copies; never mutates. */
export function publicHouse(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return rec;
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !PRIVATE_HOUSE_KEYS.includes(k)));
}

/** THE RECORD, pure: what in the printouts the store does not hold as written. */
export function printoutAgainstStore({ households, pins }, store) {
  const problems = [];
  const storeHouses = store.registry?.households ?? {};
  for (const [slug, rec] of Object.entries(households?.households ?? {})) {
    // A printed private key is refused BEFORE any comparison and whatever it
    // holds (null included): matching the store would only mean the store's
    // private value was printed. The value is never quoted.
    const leaked = rec && typeof rec === 'object' && PRIVATE_HOUSE_KEYS.some((k) => Object.hasOwn(rec, k));
    if (leaked) problems.push(`tools/households.json's "${slug}" prints the private \`human\` field — the public printout must not carry it at all (POS-394; the office's drain prints the house without it)`);
    if (!Object.hasOwn(storeHouses, slug)) problems.push(`tools/households.json holds the house "${slug}", which the store does not`);
    else if (!leaked && canonical(rec) !== canonical(publicHouse(storeHouses[slug]))) problems.push(`tools/households.json's "${slug}" differs from the store's row`);
  }
  for (const [handle, pin] of Object.entries(pins ?? {})) {
    if (!Object.hasOwn(store.pins ?? {}, handle)) problems.push(`tools/github-ids.json pins "${handle}", which the store does not`);
    else if (canonical(pin) !== canonical(store.pins[handle])) problems.push(`tools/github-ids.json's pin for "${handle}" differs from the store's`);
  }
  return problems;
}

/** THE AUTHOR, pure: commits `[{ sha, email, name, files }]` touching a printout that are not the pen's. */
export function foreignWriters(commits) {
  return commits
    .filter((c) => c.files.some((f) => PRINTOUTS.includes(f)))
    .filter((c) => String(c.email).toLowerCase() !== PEN_EMAIL)
    .map((c) => `${c.sha.slice(0, 9)} by ${c.name} <${c.email}> edits ${c.files.filter((f) => PRINTOUTS.includes(f)).join(' and ')} — only the office's drain (the Postmark Pen) writes the printouts; a repair goes to the store`);
}

function commitsIn(repo, range) {
  const out = execFileSync('git', ['-C', repo, 'log', '--format=%x1e%H%x1f%ae%x1f%an', '--name-only', range, '--', ...PRINTOUTS], { encoding: 'utf8' });
  return out.split('\x1e').filter((b) => b.trim()).map((b) => {
    const [head, ...rest] = b.split('\n');
    const [sha, email, name] = head.split('\x1f');
    return { sha, email, name, files: rest.map((s) => s.trim()).filter(Boolean) };
  });
}

function fileAt(repo, ref, path) {
  try { return JSON.parse(execFileSync('git', ['-C', repo, 'show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); }
  catch { return null; }
}

async function main() {
  const argv = process.argv;
  const arg = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
  const repo = resolve(arg('--repo') ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const reg = registryArg(argv);
  if (!reg) { console.error('usage: registry-printout-check.mjs --registry <file|url> [--range <base>..<head>] [--repo PATH]'); process.exit(2); }
  let range = arg('--range') ?? 'HEAD~1..HEAD';
  // A push that opens a branch has no "before" (all zeros): judge its tip commit.
  if (/^0{40}\.\./.test(range)) range = `${range.split('..')[1]}~1..${range.split('..')[1]}`;
  const head = range.split('..')[1] || 'HEAD';

  const problems = [];
  problems.push(...foreignWriters(commitsIn(repo, range)));
  let store;
  try { store = await loadRegistrySource(reg); }
  catch (e) { problems.push(`the store's read did not answer: ${e.message} — the printouts cannot be judged against nothing`); }
  if (store) {
    problems.push(...printoutAgainstStore({ households: fileAt(repo, head, PRINTOUTS[0]), pins: fileAt(repo, head, PRINTOUTS[1]) }, store));
  }
  if (problems.length) {
    console.error(`✗ registry printouts (${range}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`✓ registry printouts (${range}): every edit is the drain's, and every house and pin is the store's`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
