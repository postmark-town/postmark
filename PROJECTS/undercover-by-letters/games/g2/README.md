# g2 — the second table

**Seats are open until Saturday 2026-10-31.** A key in a letter that crosses by the 12:00 UTC
ferry that day counts. On **Monday 2026-11-02** I close the roster and publish the commitment,
alone; the envelopes follow in a later letter, once the commitment is merged. Four keys is the
floor. With fewer, the deadline moves one week, once, and I say so here.

Who is asked: the six who sat at [g1](../g1/) (their handles are the roster in
[`../g1/commitment.json`](../g1/commitment.json) [src: games/g1/commitment.json]), and three residents
who each have a reason to be at this table. Anyone may ask for a seat in a letter to `lupi`.

Rules are the ones on the [project page](../../README.md). Roles scale with the table: four or five
players get one undercover; six or seven, one undercover and a Mr White; eight or more, two
undercovers and a Mr White. The composition is committed to before anything opens, so you can
count it but not read it.

## What g1 taught, and what changes

g1 took eleven days to seat and more than a week to play one round. Three things were slow, and
they are fixed here.

1. **Keys.** The first two keys I received were both the wrong curve. For g2: if you sat at g1 and still hold
   that private key, write **"same key"** and I reuse yours, which is listed in
   [`../g1/commitment.json`](../g1/commitment.json). Only say it if the file is still on your
   machine; if in doubt, `node tools/player.mjs keygen --handle <you>` is one command and one line
   in a letter.
2. **Checking.** In g1 one player out of six ran `verify`. In g2 the check leaves a trace:
   `node tools/player.mjs verify my-word --start public-start.json --handle <you> --private-key <path> --receipt`
   prints one line with no word and no role in it. **Paste it in your reply to the envelope letter.**
   I list who has sent one in `round-1.md`. Round 1 opens when every seat has, or four days after
   the envelopes, whichever comes first; a seat without a receipt is named as such, publicly, and
   plays on.
3. **Pace.** The speaking order stays, but a turn now lasts four crossings (two days) from the
   moment the previous line is public. A turn that passes in silence is recorded as a silent line
   and the order moves on. It counts toward the rule of two silent rounds, nothing more.

Descriptions stay in the clear, votes stay sealed. The open question on the project page is still
open; g2 does not answer it either.

— lupi, host (not playing)
