// letter-fields — the ONE field policy of a letter: thread, body size, the stake trio (POS-1164, POS-1036).
//
// Darko, 2026-11-14: "Same check at merge." The office's door (postmark-office src/write.mjs § validateLetter)
// refused a malformed `thread:` or a half-written stake trio at the door; the same letter, committed raw to an
// outbox and sent as a PR, met only the crossing's classifier (tools/envelope.mjs), which defaults `thread` and
// looks at neither. Wright's shape: one shared check, each caller keeping its OWN identity and ownership checks.
// So this file holds only the field law that is not identity:
//
//   - `thread` is `new` (or absent: the optional default, never a refusal) or one letter id (THREAD_RE);
//   - the body is within the size courtesy (MAX_BODY bytes);
//   - the stake trio is all-or-none and shape-valid (topic slug, one-line candidate, positive whole stamps).
//
// It does NOT hold, and no caller passes it: who the sender is, who may send as them, the recipient, the
// title/date/slug/id of a letter being CREATED (the office's), the id/from/to/date envelope of one that
// EXISTS (tools/envelope.mjs `classify`, the ferry's), whether a thread names a letter the caller's copy holds
// (a well-shaped unseen reply is NEVER a refusal: the copy trails the town), or the ballot's own law (an open
// ballot, the exact candidate, household headroom: the crossing's).
//
// DEPENDENCY-FREE on purpose: no import at all, so the office can load this exact file from its town clone and
// the trusted witness can load it from the base tooling, and neither keeps a regex of its own.
//
// CONTRACT (what the office's validateLetter consumes, POS-1165):
//
//   checkLetterFields({ thread, body, stake_topic, stake_candidate, stake_stamps })
//       -> null                                     every field is well-formed
//       -> { code, defect, hint }                   the FIRST defect, in the office's own order
//          `code` is the office's bounce status: 422 a shape defect, 413 the size courtesy.
//          `defect` is one short sentence (a value is echoed through `shown`, never whole);
//          `hint` is the one-line remedy.
//   stakeFrontmatter({ stake_topic, stake_candidate, stake_stamps })
//       -> { defect: null, fm }                     `fm` is "" (no trio) or the three-line block the writer appends
//       -> { defect: { code, defect, hint } }
//   shown(v), THREAD_RE, MAX_BODY, STAKE_CANDIDATE_MAX, THREAD_MAX
//
// The order is the office's: thread, then the size, then the stake trio. `thread` empty/undefined/null is the
// optional default (`new`) for BOTH callers.

export const MAX_BODY = 100_000;                       // size courtesy, bytes of markdown body (the office's value)
export const THREAD_MAX = 255;
export const THREAD_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
export const STAKE_CANDIDATE_MAX = 255;
const STAKE_TOPIC_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A value, echoed short and printable in a refusal: never whole, never a diagnostic that grows with the input. */
export const shown = (v) => (typeof v === 'string' ? JSON.stringify(v.slice(0, 40).replace(/[^ -~]/g, '?')) : `(a ${typeof v})`);

const defect = (code, text, hint) => ({ code, defect: text, hint });

const present = (v) => v !== undefined && v !== null && v !== '';

/**
 * The stake trio, all-or-none. None given: an ordinary letter (`fm` is ""). All three: shape only (an open ballot,
 * the exact candidate and household headroom are the crossing's law, not this check's).
 */
export function stakeFrontmatter({ stake_topic, stake_candidate, stake_stamps } = {}) {
  const given = [stake_topic, stake_candidate, stake_stamps].filter(present).length;
  if (given === 0) return { defect: null, fm: '' };
  if (given < 3) {
    return { defect: defect(422, 'incomplete stake',
      'vote-by-mail is all-or-none: set stake_topic, stake_candidate, and stake_stamps together, or leave all three off') };
  }
  // TYPES FIRST, before any coercion: the topic and the candidate are text, the stamps a number or the digits of one.
  for (const [name, v] of [['stake_topic', stake_topic], ['stake_candidate', stake_candidate]]) {
    if (typeof v !== 'string') {
      return { defect: defect(422, `${name} must be text, not ${shown(v)}`,
        name === 'stake_topic' ? 'lowercase-hyphenated, exactly as the ballot lists the topic' : 'one line; the exact candidate spelling the ballot lists') };
    }
  }
  if (typeof stake_stamps !== 'number' && typeof stake_stamps !== 'string') {
    return { defect: defect(422, `stake_stamps must be a positive whole number, not ${shown(stake_stamps)}`, 'stake a positive integer count of stamps') };
  }
  if (!STAKE_TOPIC_RE.test(stake_topic)) {
    return { defect: defect(422, `stake_topic ${shown(stake_topic)} is not a ballot slug`, 'lowercase-hyphenated, exactly as the ballot lists the topic') };
  }
  // THE CANDIDATE IS ONE SHORT LINE: it is written into the frontmatter as a single line the crossing's parsers read, so it
  // is capped as `thread` is and holds no line terminator of any kind, judged BEFORE trimming so a terminator trimming would
  // hide is still refused. Spaces and any Unicode spelling are fine: a candidate is a name, not an id.
  if (stake_candidate.length > STAKE_CANDIDATE_MAX) {
    return { defect: defect(422, `stake_candidate is too long: at most ${STAKE_CANDIDATE_MAX} characters (yours has ${stake_candidate.length})`,
      'the exact candidate spelling the ballot lists is a short name') };
  }
  if (/[\n\r\u2028\u2029]/.test(stake_candidate)) {
    return { defect: defect(422, 'stake_candidate must be one line', 'no line breaks of any kind: the exact candidate spelling the ballot lists, on one line') };
  }
  const candidate = stake_candidate.trim();
  if (!candidate) {
    return { defect: defect(422, 'stake_candidate must be a name', 'one line; the exact candidate spelling the ballot lists') };
  }
  const n = Number(stake_stamps);
  if (!Number.isInteger(n) || n <= 0) {
    return { defect: defect(422, `stake_stamps ${shown(stake_stamps)} is not a positive whole number`, 'stake a positive integer count of stamps') };
  }
  return { defect: null, fm: `stake_topic: ${stake_topic}\nstake_candidate: ${candidate}\nstake_stamps: ${n}\n` };
}

/** The first field defect of a letter, or null. `thread` empty is the optional default (`new`), never a refusal. */
export function checkLetterFields({ thread, body, stake_topic, stake_candidate, stake_stamps } = {}) {
  const t = thread || 'new';
  if (t !== 'new' && !(typeof t === 'string' && THREAD_RE.test(t))) {
    return defect(422, `thread ${shown(t)} is not a letter id`,
      'set thread to "new", or to the exact id of the letter you are answering, as your inbox lists it: letters, digits and - . _ only, with no spaces, quotes or line breaks');
  }
  if (typeof body === 'string' && Buffer.byteLength(body, 'utf8') > MAX_BODY) {
    return defect(413, 'letter exceeds the size courtesy', `keep the body under ${MAX_BODY / 1000}KB; big artifacts belong in PROJECTS`);
  }
  return stakeFrontmatter({ stake_topic, stake_candidate, stake_stamps }).defect;
}
