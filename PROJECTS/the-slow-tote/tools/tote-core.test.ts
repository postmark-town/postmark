/**
 * Tests that pin the rules of tote-core.ts. Run them from inside the-slow-tote/:
 *
 *   node --test tools/tote-core.test.ts
 *
 * They build tiny in-memory worlds (no town clone, no network). Each test names the rule it holds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  marketState, splitPool, outstanding, readPayments, readBets, findOrphans, ledgerAnomalies, liveTransfers, validateMarket,
  type Market, type World, type Letter, type Transfer,
} from "./tote-core.ts";

const BANK = "lupi";

const market = (over: Partial<Market> = {}): Market => ({
  id: "kai-game-1",
  question: "Who wins lupi-vs-kai-1?",
  issues: ["white", "black", "draw"],
  opens: "2026-10-20",
  closes: "2026-10-25",
  source: { kind: "game-result", ref: "PROJECTS/the-slow-table/club/games/lupi-vs-kai-1.md", rule: "result: field" },
  cancels_if: "the game is abandoned",
  parties: ["lupi", "kai"],
  ...over,
});

interface Spec { id: string; from: string; n: number; date: string; line: number; pick: string }
const bet = (id: string, from: string, n: number, pick: string, line: number, date = "2026-10-22"): Spec => ({ id, from, n, date, line, pick });

function world(specs: Spec[], extra: { letters?: Letter[]; transfers?: Transfer[]; voids?: World["ledger"]["voids"]; asof?: string } = {}): World {
  const transfers: Transfer[] = [];
  const letters = new Map<string, Letter>();
  for (const s of specs) {
    transfers.push({ line: s.line, date: s.date, from: s.from, to: BANK, n: s.n, letter: s.id });
    letters.set(s.id, { id: s.id, from: s.from, to: BANK, pays: s.n, market: "kai-game-1", pick: s.pick });
  }
  transfers.push(...(extra.transfers ?? []));
  for (const l of extra.letters ?? []) letters.set(l.id, l);
  return {
    bank: BANK,
    ledger: { transfers, voids: extra.voids ?? [], lines: 1000 },
    mail: new Map(), letters,
    householdOf: (h) => h,
    meeps: new Set(),
    asof: extra.asof ?? "2026-10-26",
  };
}

const resolved = (outcome = "black") => market({ resolution: { outcome, evidence: "result: 0-1", date: "2026-10-26" } });
const payLetter = (id: string, to: string, settles: string[]): Letter => ({ id, from: BANK, to, tote: "kai-game-1", settles });
const stampsTo = (line: number, letter: string, to: string, n: number): Transfer => ({ line, date: "2026-10-27", from: BANK, to, n, letter });
const BASE = [bet("l1", "ann", 10, "white", 1), bet("l2", "bob", 10, "black", 2)];

test("a payment of the exact amount to the right person is paid, and the audit sees no anomaly", () => {
  const w = world(BASE, { letters: [payLetter("p1", "bob", ["l2"])], transfers: [stampsTo(50, "p1", "bob", 20)] });
  const st = marketState(resolved(), w);
  const paid = readPayments(st, w);
  assert.deepEqual(outstanding(st, paid), []);
  assert.deepEqual(ledgerAnomalies([st], w), []);
});

test("a payment of the wrong amount is not paid: it stays owed and the audit flags it", () => {
  const w = world(BASE, { letters: [payLetter("p1", "bob", ["l2"])], transfers: [stampsTo(50, "p1", "bob", 1)] });
  const st = marketState(resolved(), w);
  assert.equal(outstanding(st, readPayments(st, w)).length, 1);
  assert.deepEqual(ledgerAnomalies([st], w).map((a) => a.kind), ["payment-amount"]);
});

test("a payment to the wrong recipient is not paid, even for the right amount", () => {
  const w = world(BASE, { letters: [payLetter("p1", "bob", ["l2"])], transfers: [stampsTo(50, "p1", "sock", 20)] });
  const st = marketState(resolved(), w);
  assert.equal(outstanding(st, readPayments(st, w)).length, 1);
  assert.deepEqual(ledgerAnomalies([st], w).map((a) => a.kind), ["payment-recipient"]);
});

test("a payment that settles a bet the law owes nothing on (a loser) is flagged", () => {
  const w = world(BASE, { letters: [payLetter("p1", "ann", ["l1"])], transfers: [stampsTo(50, "p1", "ann", 10)] });
  const st = marketState(resolved(), w);
  assert.deepEqual(ledgerAnomalies([st], w).map((a) => a.kind), ["payment-unknown-bet"]);
});

test("a second payment for a bet already settled is an overpayment, flagged", () => {
  const w = world(BASE, {
    letters: [payLetter("p1", "bob", ["l2"]), payLetter("p2", "bob", ["l2"])],
    transfers: [stampsTo(50, "p1", "bob", 20), stampsTo(51, "p2", "bob", 20)],
  });
  const st = marketState(resolved(), w);
  assert.deepEqual(outstanding(st, readPayments(st, w)), []);
  assert.deepEqual(ledgerAnomalies([st], w).map((a) => a.kind), ["payment-twice"]);
});

test("a short payment completed by a second letter on the same bet closes the debt, and nothing is owed twice", () => {
  const w = world(BASE, {
    letters: [payLetter("p1", "bob", ["l2"]), payLetter("p2", "bob", ["l2"])],
    transfers: [stampsTo(50, "p1", "bob", 1), stampsTo(51, "p2", "bob", 19)],
  });
  const st = marketState(resolved(), w);
  assert.deepEqual(outstanding(st, readPayments(st, w)), []);
  assert.deepEqual(ledgerAnomalies([st], w), []);
});

test("a short payment alone leaves only the difference owed, and the audit stays red", () => {
  const w = world(BASE, { letters: [payLetter("p1", "bob", ["l2"])], transfers: [stampsTo(50, "p1", "bob", 1)] });
  const st = marketState(resolved(), w);
  assert.deepEqual(outstanding(st, readPayments(st, w)).map((p) => p.amount), [19]);
  assert.deepEqual(ledgerAnomalies([st], w).map((a) => a.kind), ["payment-amount"]);
});

test("a top-up that overshoots what is left is not counted, and the debt stays open", () => {
  const w = world(BASE, {
    letters: [payLetter("p1", "bob", ["l2"]), payLetter("p2", "bob", ["l2"])],
    transfers: [stampsTo(50, "p1", "bob", 1), stampsTo(51, "p2", "bob", 20)],
  });
  const st = marketState(resolved(), w);
  assert.deepEqual(outstanding(st, readPayments(st, w)).map((p) => p.amount), [19]);
  assert.deepEqual(ledgerAnomalies([st], w).map((a) => a.kind), ["payment-amount", "payment-amount"]);
});

// noe, 25/10 : bob a 10 sur l2 et 10 sur l3, noir gagne, la loi doit 15 sur chacune. La banque verse 20 sous [l2, l3]
// (l2 pleine, l3 à 5), puis le solde de 10 sous [l2, l3] encore, comme le README le dit.
const TWO_BETS = [bet("l1", "ann", 10, "white", 1), bet("l2", "bob", 10, "black", 2), bet("l3", "bob", 10, "black", 3)];

test("a top-up naming the original bets closes a debt whose first bet the short payment already filled", () => {
  const w = world(TWO_BETS, {
    letters: [payLetter("p1", "bob", ["l2", "l3"]), payLetter("p2", "bob", ["l2", "l3"])],
    transfers: [stampsTo(50, "p1", "bob", 20), stampsTo(51, "p2", "bob", 10)],
  });
  const st = marketState(resolved(), w);
  assert.deepEqual(outstanding(st, readPayments(st, w)), []);
  assert.deepEqual(ledgerAnomalies([st], w), []);
  assert.equal(readPayments(st, w).paid.get("l2")!.letter, "p1", "a bet already paid keeps the letter that paid it");
});

test("a top-up naming the bets still open gives the same result, and the short payment alone stays red with what is left", () => {
  const ok = world(TWO_BETS, {
    letters: [payLetter("p1", "bob", ["l2", "l3"]), payLetter("p2", "bob", ["l3"])],
    transfers: [stampsTo(50, "p1", "bob", 20), stampsTo(51, "p2", "bob", 10)],
  });
  const st = marketState(resolved(), ok);
  assert.deepEqual(ledgerAnomalies([st], ok), []);
  const alone = world(TWO_BETS, { letters: [payLetter("p1", "bob", ["l2", "l3"])], transfers: [stampsTo(50, "p1", "bob", 20)] });
  const sa = marketState(resolved(), alone);
  assert.deepEqual(outstanding(sa, readPayments(sa, alone)).map((p) => [p.settles, p.amount]), [[["l3"], 10]]);
  const a = ledgerAnomalies([sa], alone);
  assert.deepEqual(a.map((x) => x.kind), ["payment-amount"]);
  assert.match(a[0].detail, /encore 30/);
  const shortTop = world(TWO_BETS, {
    letters: [payLetter("p1", "bob", ["l2", "l3"]), payLetter("p2", "bob", ["l2", "l3"])],
    transfers: [stampsTo(50, "p1", "bob", 20), stampsTo(51, "p2", "bob", 4)],
  });
  const ss = marketState(resolved(), shortTop);
  const b = ledgerAnomalies([ss], shortTop);
  assert.deepEqual(b.map((x) => x.kind), ["payment-amount", "payment-amount"]);
  assert.match(b[1].detail, /p2.*paie 4.*encore 10/, "a short top-up reports what was left, not the full due");
});

test("a top-up that overshoots even with an already-paid bet in it is not counted", () => {
  const w = world(TWO_BETS, {
    letters: [payLetter("p1", "bob", ["l2", "l3"]), payLetter("p2", "bob", ["l2", "l3"])],
    transfers: [stampsTo(50, "p1", "bob", 20), stampsTo(51, "p2", "bob", 11)],
  });
  const st = marketState(resolved(), w);
  assert.deepEqual(outstanding(st, readPayments(st, w)).map((p) => p.amount), [10]);
  assert.ok(ledgerAnomalies([st], w).some((x) => x.kind === "payment-amount"));
});

test("a refund is checked against the stake, a letter settling two bets against their sum", () => {
  const late = bet("l3", "bob", 5, "black", 3, "2026-10-27");
  const m = resolved();
  const good = world([...BASE, late], { letters: [payLetter("r1", "bob", ["l3"])], transfers: [stampsTo(50, "r1", "bob", 5)] });
  const st = marketState(m, good);
  assert.deepEqual(ledgerAnomalies([st], good), []);
  const short = world([...BASE, late], { letters: [payLetter("r1", "bob", ["l3"])], transfers: [stampsTo(50, "r1", "bob", 4)] });
  assert.deepEqual(ledgerAnomalies([marketState(m, short)], short).map((a) => a.kind), ["payment-amount"]);
});

test("a stake of 0 is refused, owes no refund, and cannot make splitPool divide by zero", () => {
  const w = world([bet("l1", "ann", 0, "black", 1), bet("l2", "bob", 10, "black", 2), bet("l3", "cat", 10, "white", 3)]);
  const st = marketState(resolved(), w);
  assert.equal(st.bets[0].status, "refused");
  assert.equal(st.bets[0].reason, "zero-stake");
  assert.equal(st.pot, 20);
  assert.ok(st.dues.every((d) => d.amount > 0));
  assert.throws(() => splitPool(10, [{ id: "a", stake: 0, line: 1 }]), /0/);
});

test("a transfer the town voided is not a bet; a transfer carrying an already used letter id is flagged and not counted", () => {
  const voided = world(BASE, { voids: [{ line: 90, date: "2026-10-23", letter: "l2", from: "bob", to: BANK, n: 10, reason: "insufficient-balance" }] });
  assert.equal(readBets(market(), voided).length, 1);
  assert.equal(findOrphans([market()], voided).length, 0);
  assert.equal(liveTransfers(voided).live.length, 1);

  const dup = world(BASE, { transfers: [{ line: 60, date: "2026-10-22", from: "bob", to: BANK, n: 12, letter: "l2" }] });
  const st = marketState(resolved(), dup);
  assert.equal(st.pot, 20, "the pot stays 20: the second transfer on l2 does not count");
  assert.deepEqual(ledgerAnomalies([st], dup).map((a) => a.kind), ["duplicate-transfer"]);
});

test("a misspelled outcome is an error and resolves nothing; cancelled and ambiguous still cancel", () => {
  const w = world(BASE);
  const typo = marketState(resolved("blck"), w);
  assert.match(typo.error!, /blck/);
  assert.notEqual(typo.phase, "cancelled");
  assert.equal(typo.dues.length, 0);
  assert.deepEqual(ledgerAnomalies([typo], w).map((a) => a.kind), ["bad-resolution"]);
  assert.ok(validateMarket(resolved("blck")).some((b) => b.includes("blck")));
  for (const o of ["cancelled", "ambiguous"]) assert.equal(marketState(resolved(o), w).phase, "cancelled");
});
