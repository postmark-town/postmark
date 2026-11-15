// resident-name.mjs (town) — the same rule as postmark-office src/resident-name.mjs (POS-1005): a name is at most 48 reader-characters, then a 500-byte ceiling.
// WITNESS PARITY: keep the limits, the counter and the words byte-equal with the office, or the two doors drift. This copy adds `nameChangeRefusal`, the
// DIFF-AWARE form the PR lane and the retained berth writer ask: a name that is NEW or CHANGED is judged; a name already on file, left as it is, never is.
//
// how long a resident's NAME may be, and how it is counted (POS-1005).
//
// Darko, 2026-11-11 22:17 EST: "48 characters". Wright, 2026-11-12 07:40Z: "48 reader-characters is the one rule residents are told, and one size ceiling
// stays behind it." So a name is judged in TWO steps, in this order, and each has its own plain refusal:
//
//   1. THE CHARACTER RULE: at most NAME_LIMIT (48) reader-characters, i.e. GRAPHEMES, counted as a reader sees them (a family emoji, a flag, a letter with its
//      combining marks are one). Not UTF-16 units, not code points: 48 family emoji are 528 units and 48 flags are 96, and both are 48. Over it is REFUSED
//      with the limit and the actual count; never trimmed.
//   2. THE SIZE CEILING: at most NAME_BYTES (500) UTF-8 bytes, AFTER the character check, as a transport guard and not a second name rule. One
//      reader-character can carry any number of stacked marks, so 48 of them have no upper size by themselves; 48 family emoji are 1,200 bytes and meet it.
//      Its refusal is its own words: "that name is too large to store; use fewer symbols". It is never raised and never trimmed.
//
// WHERE IT IS ASKED: every door that SETS or CHANGES a name (the joins, the declaration and the keyless begin, ADDRESS `agent` and so PROFILE
// `display_name`) asks `nameRefusal` BEFORE anything is parked, written or committed. It is NOT a lint over the corpus: a name already on file over the limit
// is left as it is, and an edit that does not change the name (or sends it back unchanged) is not judged by it. Nothing here renames, normalises or migrates.

export const NAME_LIMIT = 48;
export const NAME_BYTES = 500;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The number of reader-characters (graphemes) in `text`. */
export function graphemeCount(text) {
  let n = 0;
  for (const _ of segmenter.segment(String(text ?? ""))) n++;
  return n;
}

/**
 * `null` when `name` may be set, else the refusal: `{ code, defect, hint }` in the office's refusal shape. `name` is what would be WRITTEN (already trimmed);
 * an empty name is not judged (the doors default or clear it themselves).
 */
export function nameRefusal(name) {
  const text = String(name ?? "");
  if (!text) return null;
  const count = graphemeCount(text);
  if (count > NAME_LIMIT)
    return { code: 422, defect: `that name is ${count} characters; a name is at most ${NAME_LIMIT}`, hint: `choose a name of ${NAME_LIMIT} characters or fewer` };
  if (Buffer.byteLength(text, "utf8") > NAME_BYTES)
    return { code: 413, defect: "that name is too large to store; use fewer symbols", hint: `a name is at most ${NAME_LIMIT} characters, and complex symbols (emoji, stacked marks) take up more room than plain letters; use fewer of them` };
  return null;
}

/**
 * Judge the name a PR's ADDRESS.md would leave, against the one already on base. `base` / `head` are the cards' text (`base` null for a new card).
 * Returns `null` when the name is unchanged (a legacy over-limit name stays as it is), absent, or within the rule; else the refusal `{ code, defect, hint }`.
 */
export function nameChangeRefusal(base, head, parse) {
  const nameOf = (card) => {
    if (card == null) return "";
    const fm = parse(card);
    return typeof fm?.agent === "string" ? fm.agent.trim() : "";
  };
  const next = nameOf(head);
  if (!next || next === nameOf(base)) return null;
  return nameRefusal(next);
}
