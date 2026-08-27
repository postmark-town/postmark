// account-match.mjs — does this registry account name this actor?
//
// ONE RULE, ONE HOME. `tools/households.json` rows carry `accounts: [{ login,
// id? }]`, and three places decide whether one of those entries IS the person in
// front of them: the witness (who may edit a household row in a PR), and
// settle's two halves (which house already holds this credential, and is this
// account already known to it). They used to each spell the test out, and they
// all spelled it the same wrong way.
//
// ── THE HOLE ────────────────────────────────────────────────────────────────
//
// The old shape was `a.id === actorId || a.login === actorLogin` — an OR, not a
// fallback. A login match ALONE was sufficient, even when both sides carried
// ids that disagreed. **GitHub releases abandoned logins for re-registration.**
// So a stranger who registers a resident's old login and opens a PR satisfied
// the login half against a row that still lists that string, and the witness
// certified them as the row's owner.
//
// This is not a newly-noticed risk. `tools/pin-github-ids.mjs` opens by naming
// it, and `tools/witness.mjs § loadBindings` already states the law in full:
//
//   "A pinned resident is deliberately NOT login-matchable: their old login may
//    have been abandoned and re-registered by a stranger, and their ADDRESS
//    `github:` string is display-only."
//
// The law was written. `owns()` was where it was not applied. This module is
// that law, made into the single function all three sites call.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// ID FIRST, AND A LOGIN MATCHES ONLY WHERE NO ID IS ON RECORD.
//
// The ROW's pinned-ness decides, not the actor's. If the account entry carries
// an id, only an id may match it — including when the actor has no id at all.
// That is deliberately stricter than "compare ids when both sides have them": a
// caller with no verified identity must not be able to reach a pinned account by
// naming it, and that is exactly the recycled-login attack.
//
// A legacy row with a login and no id keeps matching by login, because for those
// the login is the only road that has ever existed. Closing the hole must not
// close that road, or every unpinned household silently stops being findable.
//
// ── VENDORED, AND IT MUST MOVE IN LOCKSTEP ─────────────────────────────────
//
// The office repo carries the identical rule as `accountMatches` in
// `src/residency.mjs`, for its own two sites (`houseForAccount`, and the
// account-append check in `planRegistryJoin`). Two repos cannot share a module,
// so the grammar has two homes and the trade is named rather than hidden: if
// this rule changes, it changes in both repos in the same round.

/**
 * @param {{login?: string, id?: number|string}|null|undefined} account
 *        one entry from a household row's `accounts: []`
 * @param {number|string|null|undefined} actorId    the actor's VERIFIED GitHub id
 * @param {string|null|undefined} actorLogin        the actor's login (display-grade)
 * @returns {boolean}
 */
export function accountMatches(account, actorId, actorLogin) {
  if (!account) return false;
  if (account.id != null) {
    // Pinned: an id is on record, so an id is the only thing that may match it.
    return actorId != null && Number(account.id) === Number(actorId);
  }
  const want = actorLogin ? String(actorLogin).toLowerCase() : null;
  return Boolean(want && account.login && String(account.login).toLowerCase() === want);
}

/** Does any account on this row name the actor? */
export const rowHoldsAccount = (row, actorId, actorLogin) =>
  (row?.accounts || []).some((a) => accountMatches(a, actorId, actorLogin));

/**
 * A household that carries this LOGIN on a PINNED account — i.e. one the strict
 * rule above will refuse to match unless the caller brings the id.
 *
 * This exists to REFUSE, never to authorise, and the distinction is the whole
 * reason it is safe: comparing logins to decide "this is suspicious, stop and
 * get human eyes" costs an attacker nothing they could exploit, while comparing
 * logins to decide "this is the owner" is the hole itself.
 *
 * Why it is needed: `settle` reads a berth's self-declared `github:` line and
 * has no verified id of its own (settle.mjs § header: it "deliberately does NOT
 * pin github ids — tools/github-ids.json needs the Registrar's verified numeric
 * id"). So when the pins cannot resolve that login, settle knows a name and
 * nothing more. Merging on it would walk an arriving stranger into a pinned
 * house; forking silently would fork a house for someone who may already have
 * one. Both are guesses. The town already has a third answer for exactly this
 * shape — refuse, and cost the berth only its place in this batch.
 *
 * @returns {string|null} the household key, or null
 */
export function pinnedHouseNamingLogin(doc, login) {
  const want = String(login ?? "").toLowerCase();
  if (!want) return null;
  for (const [key, rec] of Object.entries(doc?.households ?? {})) {
    for (const a of rec.accounts ?? []) {
      if (a?.id != null && a?.login && String(a.login).toLowerCase() === want) return key;
    }
  }
  return null;
}
