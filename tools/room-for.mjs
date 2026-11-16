// room-for.mjs — which ROOM does a historical handle stand in today?
//
// Town #2622 (Ferry, 2026-09-09). Two office instruments lost the same resident
// across the committed `wesley-seeker` → `eloise-stellanova` rename, even though
// the paper moved intact and the immutable GitHub id never changed:
//
//   reconcile.mjs   two delivered letters became MISSING, both reading
//                   `recipient room "wesley-seeker" not found`, while both
//                   artifacts sat in WHITE_PAGES/eloise-stellanova/inbox/
//   welcome-audit   `eloise-stellanova` read as joined with zero office letters
//                   and therefore NEVER welcomed: 1 — her welcome and its
//                   follow-up were delivered under the prior handle
//
// Both instruments resolve a LEDGER ROW's recipient to a room by the handle
// written on the row, and a row keeps the handle of its day. The registry
// already carries the edge — `tools/rename-handle.mjs` writes it, ADD-never-
// remove, and the invariant is that the old handle survives carrying the same
// account id:
//
//   "wesley-seeker": { "login": "wesleymons22-coder", "id": 324643059,
//                      "pinned": "2026-09-04", "retired": "2026-09-09",
//                      "renamed_to": "eloise-stellanova" }
//
// So the record had what the audits needed and they did not read it. This is
// that read, in one place, so a rename can never again present as lost mail or
// as an owed welcome.
//
// ── WHY THE DATE IS AN ARGUMENT ─────────────────────────────────────────────
//
// `atDate` is the LEDGER ROW'S OWN DATE, and it is the difference between
// following a rename and inventing one. The physical move is what makes the
// redirect true: `WHITE_PAGES/wesley-seeker/` BECAME
// `WHITE_PAGES/eloise-stellanova/`, so mail delivered before the rename is in
// the new room and mail "delivered" to the old handle afterwards is not — the
// folder was gone. A row dated after the retirement that still names the old
// handle is a genuine anomaly, and Ferry's own line on #2622 governs it: "A
// true absent artifact must still stay loud."
//
// Called with no date, this follows the chain unconditionally — the right
// reading for "where does this person live now", which is what the welcome
// audit asks of a ROOM rather than of a row.
//
// Chains fold (a → b → c), each hop tested against its own `retired` stamp,
// with a seen-set so a registry that ever gained a cycle reports a cycle
// instead of hanging the round that runs it.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REGISTRY_REL = 'tools/github-ids.json';

export function loadRegistry(repo = join(dirname(fileURLToPath(import.meta.url)), '..')) {
  return JSON.parse(readFileSync(join(repo, ...REGISTRY_REL.split('/')), 'utf8'));
}

/**
 * The room a handle's mail is in today.
 *
 * @param {object} registry  tools/github-ids.json, parsed
 * @param {string} handle    the handle as written on the row
 * @param {string|null} atDate  the row's own YYYY-MM-DD, or null for "now"
 * @returns {{ room: string, renamed: boolean, chain: string[], reason: string|null }}
 *   `room` is always a handle — the original one when nothing redirects it, so
 *   a caller can use the answer unconditionally. `renamed` says whether the
 *   record moved it, which is what a report needs to explain itself.
 */
export function roomFor(registry, handle, atDate = null) {
  const chain = [handle];
  const seen = new Set([handle]);
  let at = handle;

  for (;;) {
    const row = registry?.[at];
    const to = row?.renamed_to;
    if (!to) break;

    // The one guard: a row written AFTER the handle was retired did not go to
    // the room the rename made, because the old folder no longer existed to
    // receive it. Stay loud rather than redirect it somewhere plausible.
    if (atDate && row.retired && String(atDate) > String(row.retired)) {
      return { room: at, renamed: chain.length > 1, chain,
        reason: `"${at}" was retired ${row.retired}; this row is dated ${atDate}, after the room was gone` };
    }
    if (seen.has(to)) {
      return { room: at, renamed: chain.length > 1, chain: [...chain, to],
        reason: `the registry's rename chain loops at "${to}" — read it by hand` };
    }
    seen.add(to);
    chain.push(to);
    at = to;
  }

  return { room: at, renamed: chain.length > 1, chain, reason: null };
}
