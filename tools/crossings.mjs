// crossings.mjs — the town's own clock, and the crossing's receipt.
//
// ── THE CLOCK ───────────────────────────────────────────────────────────────
//
// The RATIFIED derivation (Keemin, 2026-07-29) already lives in the office at
// `src/crossings.mjs`, whose header carries the ruling verbatim. Its words,
// unchanged:
//
//   "Fog is the crossing's weather and seeds from the crossing number
//    (ENGINE.md). The ruling: crossings run 00:00 / 12:00 UTC (the ferry's
//    clock), counted from the mail-ledger's first delivery day (2026-06-12).
//    This derivation IS the town clock; raw ferry-run counts (which include
//    off-timetable catch-up boats) are operational history, not the calendar.
//    Crossing 100 lands 2026-08-01 00:00 UTC."
//
// ⚠ THIS IS A SECOND COPY OF THAT ARITHMETIC, and the office's own header says
// that is how two clocks are born. It is here because the ferry is in the town
// repo, the office is a different repository, and the ferry cannot import
// across that seam. The copy is made safe the only way a copy can be: the
// ruling's OWN NAMED LANDMARK — crossing 100 at 2026-08-01T00:00Z — is a
// falsifier in tools/crossing-receipt.test.mjs, so THIS COPY cannot move off
// the ruling without reddening a test that quotes the sentence it broke.
//
// WHAT THAT DOES NOT COVER, said plainly because the first version of this
// header claimed it did ("either side moving off the ruling reds a test"): the
// falsifier below is in the TOWN repo and pins the TOWN's copy. It cannot see
// the office's constants at all. As first written, this comment was a promise
// about a repository this file cannot read.
//
// The office half is pinned separately, by its own landmark, in office
// test/crossings.test.mjs — added 2026-09-10 after the reviewer of this lane
// drifted `src/crossings.mjs`'s epoch a full day and ran the ten office suites
// that read it: 130 pass, 0 fail. Every assertion in them is written relative
// to the constant, which is the right way to write them and the reason none of
// them was watching it. So the pair is symmetric NOW, and it is symmetric
// because two files each pin their own side — not because either one reaches
// across.
//
// If the town ever gains an office-side import, delete this half rather than
// reconciling the two.
//
// ── THE RECEIPT ─────────────────────────────────────────────────────────────
//
// The crossing writes one line to WHITE_PAGES/crossing-ledger.md naming the
// crossing it belongs to and THE TOWN SHA IT CROSSED AT — the save state the
// crossing read, which is the parent of its own commit.
//
// Why it exists (Keemin, 2026-09-10): three readers name the same save state by
// three different means and none of them can check the others. The office index
// hydrates from a town clone at some sha; the settlement window carries
// `as_of: { window, town_sha, world_sha }` (office src/store-writedown.mjs §
// FOLD_INPUT_CONTRACT); the site build builds from a checkout. This is the
// fourth field they were all missing — with it, all three can say WHICH
// CROSSING a given sha is, without a second clock and without asking git.
//
// The shape is deliberately the window receipt's: `crossing` plays the part
// `window` plays there, and `town_sha` is the same field under the same name.
//
// A LINE IS APPENDED ONLY WHEN MAIL MOVED — a crossing that carried nothing
// commits nothing, so there is no sha for it to name that its predecessor does
// not already name. Two runs inside one 12-hour window both stamp the same
// crossing number and that is correct, not a collision: the ruling calls the
// extra run a catch-up boat and says the calendar is the calendar. Readers that
// want "the state at crossing N" take the LAST line for N; `latestCrossing`
// does that.

// 2026-06-12T00:00Z — the mail-ledger's first delivery day.
export const CROSSING_EPOCH_UTC = Date.UTC(2026, 5, 12);
export const CROSSING_MS = 12 * 3600 * 1000;
export const CROSSING_DERIVATION =
  '12h crossings (00:00/12:00 UTC) since the ledger\'s first delivery day 2026-06-12';

export function crossingAt(ms = Date.now()) {
  return Math.max(0, Math.floor((ms - CROSSING_EPOCH_UTC) / CROSSING_MS));
}

export const CROSSING_LEDGER_REL = 'WHITE_PAGES/crossing-ledger.md';

// The file's own preamble, kept HERE rather than only in the file, because the
// ferry re-creates the file if it is ever missing and two spellings of a
// preamble is how a header stops describing its own ledger. The committed
// WHITE_PAGES/crossing-ledger.md is these bytes exactly, and a falsifier says so.
export const CROSSING_LEDGER_PREAMBLE = `# Crossing ledger

One line per crossing that moved mail: which crossing it was (the town clock —
12h crossings since 2026-06-12, the mail-ledger's first delivery day), and the
town sha the crossing READ, which is the parent of its own commit.

Written by tools/ferry.mjs. The grammar, the clock and the reader are
tools/crossings.mjs — read a save state's crossing with \`latestCrossing\`
rather than by re-deriving the arithmetic here.

`;

// The line, and the only grammar for it. A full 40-character sha, never an
// abbreviation: this field exists to be matched against another repository's
// record of the same state, and an abbreviation is a prefix search wearing an
// identity's clothes.
export const CROSSING_RECEIPT_RE =
  /^- (\d{4}-\d{2}-\d{2}) · crossing (\d+) · town: ([0-9a-f]{40}) · (\d+) delivered, (\d+) bounced$/;

export function crossingReceiptLine({ date, crossing, townSha, delivered, bounced }) {
  return `- ${date} · crossing ${crossing} · town: ${townSha} · ${delivered} delivered, ${bounced} bounced`;
}

// Every receipt in the file, oldest first. A line that does not begin `- ` is
// PROSE and is skipped — the ledger's own preamble is prose, and envelope.mjs §
// parseLedgerText draws the line in exactly that place for the mail ledger. A
// line that DOES begin `- ` and does not parse is COUNTED as unrecognized
// rather than silently dropped: a reader that cannot tell "no receipts" from "a
// file full of lines I could not read" is the state-with-no-receipt class.
export function parseCrossingLedgerText(text) {
  const receipts = [];
  let unrecognized = 0;
  for (const line of String(text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('- ')) continue;
    const m = CROSSING_RECEIPT_RE.exec(line);
    if (!m) { unrecognized += 1; continue; }
    receipts.push({
      date: m[1],
      crossing: Number(m[2]),
      town_sha: m[3],
      delivered: Number(m[4]),
      bounced: Number(m[5]),
    });
  }
  return { receipts, unrecognized };
}

// The newest receipt — what a reader holding a checkout asks for when it wants
// to name the crossing its save state belongs to. `null` when the town has
// written none, which is a real answer and not an empty one.
export function latestCrossing(text) {
  const { receipts } = parseCrossingLedgerText(text);
  return receipts.length ? receipts[receipts.length - 1] : null;
}
