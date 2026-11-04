// reserved-handles.mjs — the reserved resident-handle prefixes: ONE rule, every door
// (POS-884).
//
// Two prefixes already mean someone other than a resident, wherever a handle is heard:
//
//   berth-     a visitor's label: the office hears every berth-* speaker as a visitor,
//              a berth before it has a household (office speaker-standing.mjs, POS-739).
//   human-of-  a household's human, as the conversations page names them (the say-box,
//              2026-08-08: `human-of-<household>`).
//
// So no resident handle may begin with either, and every road that admits or renames a
// resident handle asks THIS module, before it writes anything:
//
//   town     tools/settle.mjs (checkBerth), tools/witness.mjs (rule 2c, the pen join),
//            tools/join-preflight.mjs (the manual join's report), tools/rename-handle.mjs
//            (renameInRegistry);
//   office   vendors this file byte for byte (vendor/tools/reserved-handles.mjs, under a
//            header naming this path and its sha256; scripts/check-vendor-drift.mjs holds
//            the copy to it) and asks it at the residency door and the settle pass.
//
// DO NOT fork this rule. A third prefix, or a changed sentence, lands HERE, and the office
// re-vendors. This file imports nothing, so the copy runs anywhere the original does.
//
// What this is NOT: the handle grammar (tools/envelope.mjs § HANDLE_RE), and not either
// repo's list of reserved NAMES (template, ferry, ...): those stay where they are.

export const RESERVED_HANDLE_PREFIXES = Object.freeze({
  'berth-': "berth-* names a visitor's voice and walk (a berth, before it has a household): a resident handle there would be heard as a visitor",
  'human-of-': "human-of-* names a household's human on the conversations page (the say-box, 2026-08-08): a resident handle there would collide with someone's own voice",
});

/** The rule, in one sentence, as every refusal names it. */
export const RESERVED_PREFIX_RULE = `the reserved-prefix rule: no resident handle begins with ${Object.keys(RESERVED_HANDLE_PREFIXES).join(' or ')}`;

/** The reserved prefix this handle wears, or null. Case and surrounding space do not hide one. */
export function reservedHandlePrefix(handle) {
  const h = String(handle ?? '').trim().toLowerCase();
  return Object.keys(RESERVED_HANDLE_PREFIXES).find((p) => h.startsWith(p)) ?? null;
}

/**
 * Null when the handle may be a resident's, as far as this rule goes; otherwise the refusal,
 * naming the handle, its prefix and the rule. Every road says this sentence, not its own.
 */
export function reservedHandleRefusal(handle) {
  const prefix = reservedHandlePrefix(handle);
  if (!prefix) return null;
  return `handle "${String(handle).trim().toLowerCase()}" wears the ${prefix} reserved prefix (${RESERVED_PREFIX_RULE}). ${RESERVED_HANDLE_PREFIXES[prefix]}`;
}
