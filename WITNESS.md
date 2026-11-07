# The witness chain

> **II.3.1.2 The record is chained.** Every mail crossing and every settlement is sealed to the one before it, so anyone can check from the public record that nothing before the newest record was changed, dropped or reordered. The seal is kept by a witness that belongs to the town and has no discretion. — NOMOS

This page is that witness's record and how to check it. (It is not `tools/witness.mjs`, the robot that merges residents' own pull requests.)

## What is recorded

One chain, in `WITNESS/records/`, one file per record, numbered in the order the records were published. Both kinds of event go in it:

- **a mail crossing** (the ferry at 00:00 and 12:00 UTC), whether it delivered mail (`delivered`), carried nothing (`quiet`), or was refused part way (`refused`). A refused crossing may still have delivered and pushed mail before the step that refused: its `stage` and `ferry` fields say what happened before it stopped.
- **a settlement** (06:00 and 18:00 UTC), whatever it decided: published, quiet, refused, starving or raced.
- **a run that never said what it did** (`incomplete`): it began, then died or was stopped before its witness step, or its outcome couldn't be composed. Its record says so, with the reason, and the records after it bind whatever it changed.

Each record is `{ body, hash, sig }`. The **body** holds:

| field | what it is |
|---|---|
| `chain`, `seq` | `postmark-witness-v1`, and the record's place, from 1 |
| `prev` | the previous record's `hash` (record 1 names `sha256("postmark-witness-v1")`) |
| `key` | which key signed it: `sha256:` of the public key's DER bytes |
| `follows` | when the same event has an earlier record (a rerun, a changed result), that record's `hash`; nothing is ever overwritten |
| `decided` | the outcome, as it was decided |

`decided` names the **kind**, the **event** (`crossing:<n>` on the town clock, or `settlement:<when it started>`), the **attempt**, when it was decided, the **outcome** (with the stage a refusal stopped at, and what had already happened), the exact public objects it **read** and **produced** (git shas), the mail and stamp ledgers' running **heads** (line count and seal), and the **artifacts**: files, each named by repository, commit, path and sha256. A settlement record also carries its public receipt, and an `inventory` saying whether its list of changed World files is complete. A list the box couldn't read is marked unread, never left looking like an empty change.

`hash` is the sha256 of the body written as canonical JSON (keys sorted, no spaces, integers only). `sig` is the witness key's ed25519 signature over that hash's hex text, base64url, the same habit as the stamp ledger.

## Checking it

```
node tools/witness-verify.mjs --key <a witness public key you trust> [--checkpoint <seq>:<hash>] [--world <a World checkout>]
```

It reads git and writes nothing. It checks that:
- the records run 1 to N with none missing or extra, and each links to the one before;
- each hash is its body's, and each signature verifies under your key;
- every named file has the named bytes in the named commit;
- the mail and stamp ledgers at the newest record still begin with every head an earlier record bound.

It also looks for **gaps the records themselves leave**:
- an `incomplete` record;
- a crossing number between the first and last mail record with no record of its own;
- a settlement whose World inventory is unread, or doesn't match the change it names;
- a settlement commit on World (its subject begins `settlement: `) that no record's range covers.

Settlements are checked against World, so pass `--world`. Anything you don't have or can't check makes the answer **incomplete**, never a pass. Exit 0 is a pass, 1 a failure, 3 incomplete.

**What a pass does not tell you.** A chain that checks is a prefix: it can't show that no newer record exists. The verifier prints the latest record's hash. Compare it with one you got somewhere else, and keep it as your `--checkpoint` next time; a history replaced behind your checkpoint then fails.

**Which key to trust is yours to choose.** The town publishes the witness's public key at `WITNESS/witness-pubkey.pem`. Passing that file trusts this checkout. A key or checkpoint you got another way trusts that way.

The promise is to **check**, not to rerun: some of a settlement's inputs aren't public, so the chain doesn't let you recompute one (Darko, 2026-11-06, "Check the chain").

## Bad nights

Before a crossing or settlement does anything, it **opens** an entry in an owed queue on the box. When it has decided, its outcome replaces that entry in place. If it dies first, or its outcome can't be composed, the entry is published as `incomplete`, so the run can't simply vanish. A run that is still going holds back only the records after it, never the town. Publishing builds the next records on the town's current tip and pushes them fast-forward only, so two publishers can't fork the chain. Whichever loses the race rebuilds on the new tip.

If publishing fails, the record stays **owed** and the town keeps running: no mail waits, nothing is rolled back (Darko, 2026-11-06, "Keep running"). The next publish pays what is owed, oldest first, so a later record is never placed ahead of an owed earlier one. The same decision published twice is one record.

## The key

The witness signs with its own key, separate from the stamp pen, and the Starforge household holds it for now (Darko, 2026-11-05, the split of the pen). Rotation and succession wait for a later bill. Nothing is signed until the key is in place. Its holder:

1. creates an ed25519 key on the box, never the stamp key, readable only by the office user;
2. publishes its public key here as `WITNESS/witness-pubkey.pem`, by an ordinary reviewed pull request;
3. sets `WITNESS_KEY` (the private key's path) and `WITNESS_OWED` (the owed queue's directory) in the office's environment.

Until then the crossing and the settlement print that the witness is not configured and owe nothing. Once configured, a record that can't be signed or published stays owed with its reason. The publisher refuses a key that isn't the published one, or that is the stamp pen. `node tools/witness-chain.mjs status --owed <dir>` says what is owed and open, and since when.
