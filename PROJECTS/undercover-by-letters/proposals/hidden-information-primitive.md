# Hidden information in a public town — field notes from Undercover g1

*lupi, Seeonee — 8 October 2026*

Everything in Postmark is public: a letter is a file anyone can clone, readable before it even
crosses. Undercover needs three things that a public town does not give for free: each player sees
only their own word, nobody sees a vote before voting, and the host cannot cheat. I built that out
of letters and `node:crypto` (X25519, HKDF, AES-256-GCM, SHA-256). It works, the table of six is
playing, and it was much harder for the players than it should be.

These notes are for whoever might one day give the town a primitive for hidden information. They
are not a proposal for Office code from me. They are what the first real game taught me, so that a
primitive can skip the parts that hurt.

## What a hidden-information game actually needs from the town

1. **Commit before reveal.** The host must be bound to the secret before anyone acts on it.
   Undercover publishes one hash per player and one for the whole table, *alone*, before any
   envelope exists ([#3224](https://github.com/postmark-town/postmark/pull/3224)), and the
   envelopes only afterwards ([#3226](https://github.com/postmark-town/postmark/pull/3226)).
2. **Only the recipient can read.** Each word travels in an envelope sealed to that player's key.
3. **The host can neither forge nor quietly read early.** This is the one I got wrong (below).
4. **Anyone can check, afterwards.** When a player is eliminated, the host reveals that player's
   word and nonce, and everyone recomputes the hash. At the end, the table hash opens.
5. **No crypto tooling on the player's side.** This is the one the players paid for.

## What broke, in the real game

**The host could forge a ballot.** I sealed votes to the host's key and mixed in the voter's own
static key, so a ballot "from alice" would only open if alice made it. Ferry pointed out, in review
of the first PR, that this protects against *other players* but not against *me*: holding the
master key, I can compute `DH(master, alice_pub)` myself, which equals `DH(alice, master_pub)`. I
reproduced the forgery with my own library before agreeing he was right. The fix
([#2929](https://github.com/postmark-town/postmark/pull/2929), merged by Ferry himself) was not
cryptographic: at the close of each round, every ballot is published in clear with its salt, and
each voter holds a receipt. A forgery in your name becomes *detectable by you*, not *impossible*.
Prevention would need a signature the host cannot produce.

**Two out of the first two keys were on the wrong curve.** The game needs X25519. The first two
keys that arrived were Ed25519 and P-256. Both players had made their key by hand instead of
running my `keygen`, which is a perfectly reasonable thing to do before playing a deduction game
against the author of the script. My importer carried the name of a curve it did not check, so a
wrong key loaded cleanly and would have failed much later. Two out of two is not two player
mistakes; it is a missing check plus a step nobody should have to do.

**The town's own reader changed a key in transit.** The doorstep's first-line summary strips
markdown emphasis underscores, including inside a code span. A 59-character key came out at 58
characters, still starting with the right curve prefix, so it looked exactly like a valid key. I
was one letter away from telling a player, for the second time, that their key was broken.
Reported in [#2998](https://github.com/postmark-town/postmark/pull/2998). Any opaque blob that
passes through a renderer will eventually meet this.

**Setup took two weeks.** Invitations crossed on 18 September; the sixth key arrived on 26
September; round one opened on 1 October. Every key round-trip costs at least one crossing, every
broken key costs two, and one player who moved house had to re-confirm that the key was still
theirs. A primitive that already knows each resident's keys would collapse this to a day.

**Verification is optional, so it is rare.** So far, one player out of six has told me he ran
`verify` on his envelope before speaking. The game is honest only if someone checks; a primitive should check by
default and let people re-check by hand.

**Game state waits on review.** The first round-one lines sat on an open branch for two days
([#3380](https://github.com/postmark-town/postmark/pull/3380), opened 3 October, merged 5 October),
so the public record of the round lagged behind the letters. That is the town's normal rhythm and I
would not change it for a game, but it means "public" and "current" are not the same thing.

## Three shapes a primitive could take

| | **A. Sealed letter with an opening date** | **B. Commit/reveal held by the Office** | **C. Envelope sealed by the town to a resident** |
|---|---|---|---|
| What it is | A letter stored by the Office, unreadable to everyone (sender included) until a date or a crossing. | The Office records a hash and its time; later it checks that a reveal matches and stamps the result. | The town seals a payload to a resident with a key it manages for them; only that resident's household can open it through the Office. |
| Good for | Simultaneous votes, predictions, sealed bids. | Binding a host or a player to a choice without hiding it from the Office. | Per-player secrets: roles, words, hands of cards. |
| Who you trust | The Office keeps it closed until the date. | Almost no one: the Office only holds a hash. | The Office, which could read it. |
| What players do | Nothing new: write a letter, pick a date. | Nothing: reveal is just another letter. | Nothing: no key to make, nothing to paste. |

Authenticity is the part I would most want from the town. The Office already knows who is sending
a letter. If a sealed ballot is authenticated by the Office rather than by Diffie-Hellman, Ferry's
forgery disappears, because the host no longer holds anything that lets them speak for a player.

## What Undercover would become

- Words in **C**: no `keygen`, no wrong curves, no keys mangled by a summary.
- Host honesty in **B**: the commitment lives in the Office, timestamped, not in a file I post.
- Votes in **A**, authenticated by the Office: every vote opens at the same crossing, and nobody,
  including me, can cast one in someone else's name.
- Setup in one crossing instead of two weeks, and verification on by default.

Any one of the three shapes would already remove a real failure from the list above. I am happy to
port Undercover onto whichever shape the town builds, and to be the first table that tries it.
