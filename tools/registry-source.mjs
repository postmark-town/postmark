// registry-source.mjs — where a town tool reads the household registry from (POS-345).
//
// Darko's ruling, 2026-10-04: git can be written to, the store reads git, the
// store is the record, and every reader reads the store. tools/households.json
// and tools/github-ids.json are the store's PRINTOUT — the office's
// registry-drain renders them from the store's `households` / `household_pins`
// rows — so a town tool that decides from them decides from a copy. This town
// cannot reach the store, so the record comes to it one of two ways:
//
//   --registry <file>   the office runs the tool and writes the file from the
//                       store (`loadRegistryRows`) beside the run;
//   --registry <url>    town CI and anyone else fetch the office's public
//                       GET /households (https://postmark.town/api/households).
//
// Both carry the same document. The office's read answers
//   { read: "households", registry: <tools/households.json's object>, pins: <tools/github-ids.json's object>, … }
// and a file may carry that, or the compact `{ households, pins }` the welcome
// pass writes. Either way this returns `{ registry, pins }` in the printouts'
// own shapes, so a tool that parsed the files reads it with nothing between.
//
// A --registry that cannot be read is a REFUSAL (the caller exits non-zero,
// naming it), never a quiet fall back to the printouts. Without --registry a
// tool reads the printouts, as it did — that is a hand run from a checkout, and
// it says so in its own words where it matters.

import { readFileSync } from 'node:fs';

/** `{ registry, pins }` from either document shape, or throws naming what is wrong. */
export function registrySourceFrom(doc, where = 'the registry') {
  if (!doc || typeof doc !== 'object') throw new Error(`${where} is not a JSON object`);
  const registry = doc.registry && typeof doc.registry === 'object'
    ? doc.registry
    : (doc.households && typeof doc.households === 'object' ? { households: doc.households } : null);
  const pins = doc.pins && typeof doc.pins === 'object' ? doc.pins : null;
  if (!registry || !registry.households || typeof registry.households !== 'object' || !pins) {
    throw new Error(`${where} is not { registry, pins } (the office's GET /households) or { households, pins }`);
  }
  return { registry, pins };
}

/** Read a --registry argument: an http(s) URL is fetched, anything else is a file path. */
export async function loadRegistrySource(arg, { fetchImpl = globalThis.fetch } = {}) {
  if (/^https?:\/\//i.test(String(arg))) {
    let res;
    try { res = await fetchImpl(arg, { headers: { accept: 'application/json' } }); }
    catch (e) { throw new Error(`--registry ${arg} did not answer (${e?.message ?? e})`); }
    if (!res.ok) throw new Error(`--registry ${arg} answered ${res.status}`);
    let doc;
    try { doc = await res.json(); } catch (e) { throw new Error(`--registry ${arg} did not answer JSON (${e?.message ?? e})`); }
    return registrySourceFrom(doc, `--registry ${arg}`);
  }
  let doc;
  try { doc = JSON.parse(readFileSync(arg, 'utf8')); }
  catch (e) { throw new Error(`--registry ${arg} could not be read (${e?.message ?? e})`); }
  return registrySourceFrom(doc, `--registry ${arg}`);
}

/** The value after `--registry` in an argv, or null. */
export function registryArg(argv = process.argv) {
  const i = argv.indexOf('--registry');
  return i === -1 ? null : (argv[i + 1] ?? '');
}

/**
 * For a CLI: the registry source named on the command line, or null when none
 * was. Exits 1 with the reason when one was named and cannot be read.
 */
export async function registryFromArgv(argv = process.argv, { tool = 'this tool' } = {}) {
  const arg = registryArg(argv);
  if (arg === null) return null;
  try { return await loadRegistrySource(arg); }
  catch (e) { console.error(`FATAL: ${tool}: ${e.message} — nothing was decided`); process.exit(1); }
}
