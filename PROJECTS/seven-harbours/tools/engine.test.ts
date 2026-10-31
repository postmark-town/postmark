/**
 * Tests that pin engine.ts. Run them from inside seven-harbours/:
 *
 *   node --test tools/engine.test.ts
 *
 * Part 1 is the standard adjudication test suite (DATC, Lucas Kruijswijk, v3.0, section 6), every
 * case that can exist on this board, moved onto the map of map.md. This board has ships only, no
 * coasts, no convoys and no retreats, so sections 6.B (coasts), 6.F-6.G (convoys), 6.H (retreats)
 * and the army/fleet cases of 6.A do not apply. The case number is in each test name; the players
 * are A, B, C, D (the DATC's powers, renamed in order of appearance).
 *
 * Part 2 pins what the README adds: the board itself, sealed orders, builds and removals, the end,
 * determinism and replay, and the draw of 23 October.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseMap, checkBoard, resolvePhase, initialState, replay, commitFor, revealMatches, canonicalOrders, drawSeats, openSeals, parseReveal,
  distance, placesHeld,
  type State, type GameRecord, type SealedPhase,
} from "./engine.ts";

const B = parseMap(readFileSync(path.resolve(import.meta.dirname, "../map.md"), "utf8"));
const HOMES = { A: "SAL", B: "LAN", C: "GRE", D: "COR", E: "MIS" };

function position(ships: Record<string, string>, phase = 0): State {
  const s = initialState(B, HOMES);
  return { ...s, phase, ships: Object.entries(ships).map(([at, owner]) => ({ at, owner })) };
}
function run(ships: Record<string, string>, orders: Record<string, string[]>) {
  return resolvePhase(B, position(ships), { orders });
}
const where = (s: State) => Object.fromEntries(s.ships.map((x) => [x.at, x.owner]));
const line = (r: ReturnType<typeof run>, text: string) => {
  const l = r.report.orders.find((o) => o.text === text);
  assert.ok(l, `no order line "${text}"`);
  return l;
};

// ─── Part 1: the standard test cases ────────────────────────────────────────────────────────────

test("6.A.1 a move to a place that does not touch is void, and the ship holds", () => {
  const r = run({ "SAL-R": "A" }, { A: ["move SAL-R GRE-R"] });
  assert.equal(line(r, "move SAL-R GRE-R").status, "void");
  assert.match(line(r, "move SAL-R GRE-R").reason!, /does not touch/);
  assert.deepEqual(where(r.state), { "SAL-R": "A" });
});

test("6.A.4 a move to its own place is void and does not crash", () => {
  const r = run({ "SAL-R": "A" }, { A: ["move SAL-R SAL-R"] });
  assert.equal(line(r, "move SAL-R SAL-R").status, "void");
  assert.deepEqual(where(r.state), { "SAL-R": "A" });
});

test("6.A.6 an order for another player's ship is void", () => {
  const r = run({ "SAL-R": "A" }, { B: ["move SAL-R STILL"] });
  assert.match(line(r, "move SAL-R STILL").reason!, /not yours/);
  assert.deepEqual(where(r.state), { "SAL-R": "A" });
});

test("6.A.8 a ship cannot support itself to hold", () => {
  const r = run({ GULL: "A", "LAN-R": "A", "SAL-R": "B" }, {
    A: ["move GULL SAL-R", "support LAN-R move GULL SAL-R"],
    B: ["support SAL-R hold SAL-R"],
  });
  assert.equal(line(r, "support SAL-R hold SAL-R").status, "void");
  assert.deepEqual(where(r.state), { "SAL-R": "A", "LAN-R": "A" });
  assert.deepEqual(r.report.sunk, [{ at: "SAL-R", owner: "B" }]);
});

test("6.A.10 a support into a place the supporter does not touch is void", () => {
  const r = run({ SAL: "B", "SAL-R": "A", "LAN-R": "A" }, { A: ["move SAL-R SAL", "support LAN-R move SAL-R SAL"] });
  assert.match(line(r, "support LAN-R move SAL-R SAL").reason!, /does not touch SAL/);
  assert.equal(where(r.state).SAL, "B");
});

test("6.A.11 two ships into one place bounce", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "B" }, { A: ["move SAL-R GULL"], B: ["move LAN-R GULL"] });
  assert.deepEqual(where(r.state), { "SAL-R": "A", "LAN-R": "B" });
});

test("6.A.12 three ships into one place all bounce", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "B", "GRE-R": "C" }, {
    A: ["move SAL-R STILL"], B: ["move LAN-R STILL"], C: ["move GRE-R STILL"],
  });
  assert.equal(where(r.state).STILL, undefined);
  assert.equal(r.report.moved.length, 0);
});

test("6.C.1 three ships moving round all move", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", GULL: "A" }, { A: ["move SAL-R LAN-R", "move LAN-R GULL", "move GULL SAL-R"] });
  assert.equal(r.report.moved.length, 3);
  assert.deepEqual(where(r.state), { "SAL-R": "A", "LAN-R": "A", GULL: "A" });
  assert.ok(r.report.note.some((n) => /ring/.test(n)));
});

test("6.C.2 a ring with a support still moves", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", GULL: "A", STILL: "A" }, {
    A: ["move SAL-R LAN-R", "move LAN-R GULL", "move GULL SAL-R", "support STILL move SAL-R LAN-R"],
  });
  assert.equal(r.report.moved.length, 3);
});

test("6.C.3 a ring broken by one bounce holds whole", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", GULL: "A", STILL: "B" }, {
    A: ["move SAL-R LAN-R", "move LAN-R GULL", "move GULL SAL-R"], B: ["move STILL LAN-R"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.C.7 (no convoys here) a swap is a head-to-head: equal strength bounces", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "B" }, { A: ["move SAL-R LAN-R"], B: ["move LAN-R SAL-R"] });
  assert.deepEqual(where(r.state), { "SAL-R": "A", "LAN-R": "B" });
});

test("6.C.8 no self-dislodgement in a broken ring", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", GULL: "A", STILL: "B", "GRE-R": "C" }, {
    A: ["move SAL-R STILL", "move LAN-R SAL-R", "support GULL move LAN-R SAL-R"],
    B: ["move STILL LAN-R"],
    C: ["move GRE-R LAN-R"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.C.9 no help in dislodging one's own ship in a broken ring", () => {
  const r = run({ "SAL-R": "A", GULL: "A", STILL: "B", "GRE-R": "C", "LAN-R": "C" }, {
    A: ["move SAL-R STILL", "support GULL move LAN-R SAL-R"],
    B: ["move STILL LAN-R"],
    C: ["move GRE-R LAN-R", "move LAN-R SAL-R"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.D.1 a supported hold prevents dislodgement", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "LAN-R": "B", WREN: "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"], B: ["hold LAN-R", "support WREN hold LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "B");
  assert.equal(where(r.state)["SAL-R"], "A");
});

test("6.D.2 a move cuts a support to hold", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "GRE-R": "A", "LAN-R": "B", WREN: "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R", "move GRE-R WREN"], B: ["hold LAN-R", "support WREN hold LAN-R"],
  });
  assert.equal(line(r, "support WREN hold LAN-R").result, "support cut");
  assert.equal(where(r.state)["LAN-R"], "A");
  assert.deepEqual(r.report.sunk, [{ at: "LAN-R", owner: "B" }]);
});

test("6.D.3 a move cuts a support to move", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "LAN-R": "B", "GRE-R": "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"], B: ["hold LAN-R", "move GRE-R STILL"],
  });
  assert.equal(where(r.state)["LAN-R"], "B");
  assert.equal(where(r.state)["SAL-R"], "A");
});

test("6.D.4 a ship supporting a hold can be supported to hold", () => {
  const r = run({ "LAN-R": "B", WREN: "B", STILL: "A", "SAL-R": "A" }, {
    B: ["support LAN-R hold WREN", "support WREN hold LAN-R"], A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "B");
});

test("6.D.5 a ship supporting a move can be supported to hold", () => {
  const r = run({ "LAN-R": "B", GULL: "B", "GRE-R": "B", STILL: "A", "SAL-R": "A" }, {
    B: ["support LAN-R move GRE-R WREN", "support GULL hold LAN-R", "move GRE-R WREN"],
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "B");
  assert.equal(where(r.state).WREN, "B");
});

test("6.D.7 a moving ship cannot be supported to hold", () => {
  const r = run({ "LAN-R": "A", GULL: "A", STILL: "B", "SAL-R": "B", "GRE-R": "B" }, {
    A: ["move LAN-R WREN", "support GULL hold LAN-R"],
    B: ["move STILL LAN-R", "support SAL-R move STILL LAN-R", "move GRE-R WREN"],
  });
  assert.match(line(r, "support GULL hold LAN-R").reason!, /ordered to move/);
  assert.equal(where(r.state)["LAN-R"], "B");
  assert.deepEqual(r.report.sunk, [{ at: "LAN-R", owner: "A" }]);
});

test("6.D.9 a holding ship cannot be supported to move", () => {
  const r = run({ "SAL-R": "A", STILL: "A", WREN: "B", "LAN-R": "B" }, {
    A: ["move SAL-R LAN-R", "support STILL move SAL-R LAN-R"], B: ["support WREN move LAN-R GRE-R", "hold LAN-R"],
  });
  assert.match(line(r, "support WREN move LAN-R GRE-R").reason!, /never ordered/);
  assert.equal(where(r.state)["LAN-R"], "A");
});

test("6.D.10 a player cannot dislodge their own ship", () => {
  const r = run({ "LAN-R": "A", "SAL-R": "A", STILL: "A" }, { A: ["hold LAN-R", "move SAL-R LAN-R", "support STILL move SAL-R LAN-R"] });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.D.10, with foreign supports: still no self-dislodgement", () => {
  const r = run({ "LAN-R": "A", "SAL-R": "A", STILL: "B", GULL: "C" }, {
    A: ["hold LAN-R", "move SAL-R LAN-R"], B: ["support STILL move SAL-R LAN-R"], C: ["support GULL move SAL-R LAN-R"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.D.11 no self-dislodgement of a ship that bounces back", () => {
  const r = run({ "LAN-R": "A", "SAL-R": "A", STILL: "A", "GRE-R": "B" }, {
    A: ["move LAN-R WREN", "move SAL-R LAN-R", "support STILL move SAL-R LAN-R"], B: ["move GRE-R WREN"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.D.12 supporting a foreign ship to dislodge one's own ship does not count", () => {
  const r = run({ "LAN-R": "B", STILL: "B", "SAL-R": "A" }, { B: ["hold LAN-R", "support STILL move SAL-R LAN-R"], A: ["move SAL-R LAN-R"] });
  assert.equal(where(r.state)["LAN-R"], "B");
});

test("6.D.13 nor when one's own ship bounces back", () => {
  const r = run({ "LAN-R": "B", STILL: "B", "SAL-R": "A", "GRE-R": "A" }, {
    B: ["move LAN-R WREN", "support STILL move SAL-R LAN-R"], A: ["move SAL-R LAN-R", "move GRE-R WREN"],
  });
  assert.equal(where(r.state)["LAN-R"], "B");
  assert.equal(r.report.sunk.length, 0);
});

test("6.D.14 supporting the attacker does not save one's own ship", () => {
  const r = run({ "LAN-R": "B", STILL: "B", "SAL-R": "A", GULL: "A", WREN: "A" }, {
    B: ["hold LAN-R", "support STILL move SAL-R LAN-R"],
    A: ["move SAL-R LAN-R", "support GULL move SAL-R LAN-R", "support WREN move SAL-R LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "A");
  assert.deepEqual(r.report.sunk, [{ at: "LAN-R", owner: "B" }]);
});

test("6.D.15 the defender cannot cut the support for the attack on itself", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "LAN-R": "B" }, { A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"], B: ["move LAN-R STILL"] });
  assert.equal(line(r, "support STILL move SAL-R LAN-R").result, "support given");
  assert.equal(where(r.state)["LAN-R"], "A");
});

test("6.D.17 dislodgement cuts supports", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "LAN-R": "B", "GRE-R": "B", WREN: "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"],
    B: ["move LAN-R STILL", "support GRE-R move LAN-R STILL", "move WREN LAN-R"],
  });
  assert.equal(where(r.state).STILL, "B");
  assert.equal(where(r.state)["SAL-R"], "A");
  assert.equal(where(r.state).WREN, "B");
  assert.deepEqual(r.report.sunk, [{ at: "STILL", owner: "A" }]);
});

test("6.D.18 a surviving supporter keeps its support", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "COR-R": "A", "LAN-R": "B", "GRE-R": "B", WREN: "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R", "support COR-R hold STILL"],
    B: ["move LAN-R STILL", "support GRE-R move LAN-R STILL", "move WREN LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "A");
  assert.deepEqual(r.report.sunk, [{ at: "LAN-R", owner: "B" }]);
});

test("6.D.19 even when it survives because one support came from its own side", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "GRE-R": "A", "LAN-R": "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R", "support GRE-R move LAN-R STILL"], B: ["move LAN-R STILL"],
  });
  assert.equal(where(r.state)["LAN-R"], "A");
  assert.equal(where(r.state).STILL, "A");
});

test("6.D.20 a ship cannot cut a support of its own player", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "GRE-R": "A", "LAN-R": "B" }, {
    A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R", "move GRE-R STILL"], B: ["hold LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "A");
});

test("6.D.21 a ship that is dislodged still cuts the support it attacked", () => {
  const r = run({ "LAN-R": "A", "SAL-R": "B", STILL: "B", "GRE-R": "C", "COR-R": "D", ANVIL: "D" }, {
    A: ["hold LAN-R"],
    B: ["move SAL-R LAN-R", "support STILL move SAL-R LAN-R"],
    C: ["move GRE-R STILL"],
    D: ["move COR-R GRE-R", "support ANVIL move COR-R GRE-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "A");
  assert.equal(where(r.state)["GRE-R"], "D");
});

test("6.D.22 an impossible move cannot be supported, not even to defend", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", "TID-R": "B", STILL: "B" }, {
    A: ["move SAL-R GRE-R", "support LAN-R move SAL-R GRE-R"], B: ["move TID-R SAL-R", "support STILL move TID-R SAL-R"],
  });
  assert.equal(line(r, "move SAL-R GRE-R").status, "void");
  assert.equal(line(r, "support LAN-R move SAL-R GRE-R").status, "void");
  assert.equal(where(r.state)["SAL-R"], "B");
});

test("6.D.25 a failing hold support can itself be supported", () => {
  const r = run({ "LAN-R": "B", WREN: "B", STILL: "A", "SAL-R": "A" }, {
    B: ["support LAN-R hold SAL-R", "support WREN hold LAN-R"], A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"],
  });
  assert.equal(line(r, "support LAN-R hold SAL-R").status, "void");
  assert.equal(where(r.state)["LAN-R"], "B");
});

test("6.D.26 a failing move support can itself be supported", () => {
  const r = run({ "LAN-R": "B", WREN: "B", STILL: "A", "SAL-R": "A" }, {
    B: ["support LAN-R move SAL-R GULL", "support WREN hold LAN-R"], A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"],
  });
  assert.equal(where(r.state)["LAN-R"], "B");
});

test("6.D.28 an impossible move leaves a holding ship that can be supported", () => {
  const r = run({ WREN: "A", "LAN-R": "B", "SAL-R": "C", STILL: "C" }, {
    A: ["support WREN hold LAN-R"], B: ["move LAN-R COR-R"], C: ["move SAL-R LAN-R", "support STILL move SAL-R LAN-R"],
  });
  assert.equal(line(r, "support WREN hold LAN-R").result, "support given");
  assert.equal(where(r.state)["LAN-R"], "B");
});

test("6.D.33 an unwanted support is allowed", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", "GRE-R": "B", GULL: "C" }, {
    A: ["move SAL-R STILL", "move LAN-R STILL"], B: ["support GRE-R move SAL-R STILL"], C: ["move GULL SAL-R"],
  });
  assert.equal(where(r.state).STILL, "A");
  assert.equal(where(r.state)["SAL-R"], "C");
});

test("6.D.34 a support into the supporter's own place is void", () => {
  const r = run({ "SAL-R": "A", "TID-R": "A", "LAN-R": "A", STILL: "B", "GRE-R": "C", "COR-R": "C" }, {
    A: ["move SAL-R STILL", "support TID-R move SAL-R STILL", "support LAN-R move SAL-R STILL"],
    B: ["support STILL move GRE-R STILL"],
    C: ["support COR-R move GRE-R STILL", "move GRE-R STILL"],
  });
  assert.match(line(r, "support STILL move GRE-R STILL").reason!, /own place/);
  assert.equal(where(r.state).STILL, "A");
  assert.deepEqual(r.report.sunk, [{ at: "STILL", owner: "B" }]);
});

test("6.E.1 a ship dislodged head-to-head has no effect on its attacker's place", () => {
  const r = run({ "SAL-R": "A", "TID-R": "A", STILL: "A", "LAN-R": "B" }, {
    A: ["move SAL-R LAN-R", "move TID-R SAL-R", "support STILL move SAL-R LAN-R"], B: ["move LAN-R SAL-R"],
  });
  assert.deepEqual(where(r.state), { "SAL-R": "A", "LAN-R": "A", STILL: "A" });
});

test("6.E.2 no self-dislodgement in a head-to-head", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", STILL: "A" }, { A: ["move SAL-R LAN-R", "move LAN-R SAL-R", "support STILL move SAL-R LAN-R"] });
  assert.equal(r.report.moved.length, 0);
});

test("6.E.3 no help in dislodging one's own ship in a head-to-head", () => {
  const r = run({ "SAL-R": "A", STILL: "A", "LAN-R": "B" }, { A: ["move SAL-R LAN-R", "support STILL move LAN-R SAL-R"], B: ["move LAN-R SAL-R"] });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

// 6.E.4 to 6.E.6: SAL-R is the DATC's Holland, the Still its North Sea.
const E4 = {
  ships: { "SAL-R": "A", "GRE-R": "A", "COR-R": "A", STILL: "B", GULL: "B", "IRO-R": "C", "MIS-R": "C", "LAN-R": "C", ASH: "D", SAL: "D" },
  orders: {
    A: ["move SAL-R STILL", "support GRE-R move SAL-R STILL", "support COR-R move SAL-R STILL"],
    B: ["move STILL SAL-R", "support GULL move STILL SAL-R"],
    C: ["move IRO-R STILL", "support MIS-R move IRO-R STILL", "support LAN-R move IRO-R STILL"],
    D: ["move ASH SAL-R", "support SAL move ASH SAL-R"],
  },
};

test("6.E.4 a head-to-head loser that is not dislodged still guards its attacker's place", () => {
  const r = run(E4.ships, E4.orders);
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.E.5 a head-to-head loser dislodged by a third ship still guards", () => {
  const r = run({ ...E4.ships, "TID-R": "C" }, { ...E4.orders, C: [...E4.orders.C, "support TID-R move IRO-R STILL"] });
  assert.equal(where(r.state).STILL, "C");
  assert.equal(where(r.state)["SAL-R"], "A");
  assert.equal(where(r.state).ASH, "D");
  assert.deepEqual(r.report.sunk, [{ at: "STILL", owner: "B" }]);
});

test("6.E.6 a loser saved by its own support to the winner still guards", () => {
  const r = run({ "SAL-R": "A", "GRE-R": "A", STILL: "B", GULL: "B", "COR-R": "B", ASH: "D", SAL: "D" }, {
    A: ["move SAL-R STILL", "support GRE-R move SAL-R STILL"],
    B: ["move STILL SAL-R", "support GULL move STILL SAL-R", "support COR-R move SAL-R STILL"],
    D: ["move ASH SAL-R", "support SAL move ASH SAL-R"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

// 6.E.7 to 6.E.10: the Still is the North Sea; A England, B Germany, C Russia.
const E7 = {
  ships: { STILL: "A", "LAN-R": "A", "TID-R": "B", "IRO-R": "B", "GRE-R": "C", "COR-R": "C" },
  orders: (still: string) => ({
    A: [still, "support LAN-R move GRE-R STILL"],
    B: ["move TID-R STILL", "support IRO-R move TID-R STILL"],
    C: ["move GRE-R STILL", "support COR-R move GRE-R STILL"],
  }),
};

test("6.E.7 no self-dislodgement with a beleaguered garrison", () => {
  const r = run(E7.ships, E7.orders("hold STILL"));
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.E.8 nor when the garrison is in a head-to-head", () => {
  const r = run(E7.ships, E7.orders("move STILL GRE-R"));
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.E.9 when the garrison leaves, the strongest attacker enters", () => {
  const r = run(E7.ships, E7.orders("move STILL MIS-R"));
  assert.equal(where(r.state)["MIS-R"], "A");
  assert.equal(where(r.state).STILL, "C");
});

test("6.E.10 a near-ring with the weaker attacker fails and nobody moves", () => {
  const r = run({ STILL: "A", "LAN-R": "A", "TID-R": "B", "SAL-R": "B", "IRO-R": "B", "GRE-R": "C", "COR-R": "C" }, {
    A: ["move STILL IRO-R", "support LAN-R move GRE-R STILL"],
    B: ["move TID-R STILL", "support SAL-R move TID-R STILL", "move IRO-R TID-R"],
    C: ["move GRE-R STILL", "support COR-R move GRE-R STILL"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.E.12 a support for an attack on one's own ship can still block a third", () => {
  const r = run({ STILL: "A", "LAN-R": "A", "TID-R": "B", "GRE-R": "C", "SAL-R": "C" }, {
    A: ["move STILL SAL-R", "support LAN-R move TID-R STILL"],
    B: ["move TID-R STILL"],
    C: ["move GRE-R STILL", "support SAL-R move GRE-R STILL"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.E.13 a garrison besieged from three sides holds", () => {
  const r = run({ STILL: "A", "GRE-R": "B", "COR-R": "B", "TID-R": "C", "IRO-R": "C", "LAN-R": "D", "SAL-R": "D" }, {
    A: ["hold STILL"],
    B: ["move GRE-R STILL", "support COR-R move GRE-R STILL"],
    C: ["move TID-R STILL", "support IRO-R move TID-R STILL"],
    D: ["move LAN-R STILL", "support SAL-R move LAN-R STILL"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

test("6.E.14 a ship whose move is void still defends with strength one", () => {
  const r = run({ SAL: "A", "SAL-R": "B" }, { A: ["move SAL SAL-R"], B: ["move SAL-R GRE-R"] });
  assert.deepEqual(where(r.state), { SAL: "A", "SAL-R": "B" });
});

test("6.E.15 the friendly head-to-head: nobody moves", () => {
  const r = run({ "SAL-R": "A", "LAN-R": "A", "GRE-R": "A", STILL: "B", GULL: "B", ASH: "B", "TID-R": "C", SAL: "C", "COR-R": "D", "MIS-R": "D" }, {
    A: ["move SAL-R STILL", "support LAN-R move SAL-R STILL", "support GRE-R move SAL-R STILL"],
    B: ["move STILL SAL-R", "support GULL move STILL SAL-R", "support ASH move STILL SAL-R"],
    C: ["move TID-R SAL-R", "support SAL move TID-R SAL-R"],
    D: ["move COR-R STILL", "support MIS-R move COR-R STILL"],
  });
  assert.equal(r.report.moved.length, 0);
  assert.equal(r.report.sunk.length, 0);
});

// ─── Part 2: what the README adds ───────────────────────────────────────────────────────────────

test("map.md: 22 places, 14 that count, every link both ways (the engine checks it first)", () => {
  assert.equal(B.order.length, 22);
  assert.equal(B.order.filter((c) => B.places[c].counts).length, 14);
  assert.deepEqual(checkBoard(B), []);
  for (const c of B.order) if (B.places[c].kind === "harbour") assert.deepEqual(B.places[c].touches, [`${c}-R`]);
  assert.equal(B.places.STILL.touches.length, 7);
  const broken = parseMap(readFileSync(path.resolve(import.meta.dirname, "../map.md"), "utf8").replace("| GULL | island | SAL-R, LAN-R |", "| GULL | island | SAL-R |"));
  assert.match(checkBoard(broken).join(), /LAN-R touches GULL but GULL does not touch LAN-R/);
});

test("rule 2: each player starts with a ship in their harbour and one in its Roads", () => {
  const s = initialState(B, HOMES);
  assert.equal(s.ships.length, 10);
  assert.deepEqual(where(s).SAL, "A");
  assert.deepEqual(where(s)["SAL-R"], "A");
  assert.deepEqual(placesHeld(s, "A"), ["SAL"]);
  assert.equal(s.owners.TID, null, "a harbour nobody plays stays neutral (rule 1)");
  assert.throws(() => initialState(B, { A: "SAL", B: "LAN", C: "GRE", D: "COR" }), /5 to 7/);
});

test("rule 7: a player without orders holds, and the game goes on", () => {
  const r = resolvePhase(B, initialState(B, HOMES), { orders: { A: ["move SAL-R GULL"] } });
  assert.equal(where(r.state).GULL, "A");
  assert.equal(r.report.sealed.B, "no orders: ships hold");
});

test("rule 7: two orders for one ship cannot both be obeyed, so it holds", () => {
  const r = run({ "SAL-R": "A" }, { A: ["move SAL-R GULL", "move SAL-R ASH"] });
  assert.ok(r.report.orders.every((o) => o.status === "void" && /two orders/.test(o.reason!)));
  assert.deepEqual(where(r.state), { "SAL-R": "A" });
});

test("rule 8: an unreadable order and an unknown place are void, with the reason", () => {
  const r = run({ "SAL-R": "A" }, { A: ["sail SAL-R to GULL", "move SAL-R ATLANTIS"] });
  assert.match(r.report.orders[0].reason!, /cannot read/);
  assert.match(r.report.orders[1].reason!, /not a place/);
});

test("orders are case-insensitive and rewritten in one canonical form", () => {
  const r = run({ "SAL-R": "A" }, { A: ["  MOVE   sal-r   gull "] });
  assert.equal(r.report.orders[0].text, "move SAL-R GULL");
  assert.equal(where(r.state).GULL, "A");
});

test("rule 4: a ship that is dislodged is sunk (no retreats)", () => {
  const r = run({ STILL: "A", "SAL-R": "A", "LAN-R": "B" }, { A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"] });
  assert.equal(r.state.ships.filter((s) => s.owner === "B").length, 0);
});

test("rule 5: places change hands only at the end of an even phase", () => {
  const odd = resolvePhase(B, initialState(B, HOMES), { orders: { A: ["move SAL-R GULL"] } });
  assert.equal(odd.state.owners.GULL, null);
  const even = resolvePhase(B, odd.state, { orders: {} });
  assert.equal(even.state.owners.GULL, "A");
});

test("rule 5: one build per extra place, in an empty harbour the player holds", () => {
  // A takes Gull Rock and Little Ash in phases 1-2 and empties Saltmere: 3 places, 2 ships, 1 build.
  let s = initialState(B, HOMES);
  s = resolvePhase(B, s, { orders: { A: ["move SAL-R GULL", "move SAL SAL-R"] } }).state;
  const r = resolvePhase(B, s, { orders: { A: ["move SAL-R ASH"] } });
  assert.deepEqual(placesHeld(r.state, "A"), ["SAL", "GULL", "ASH"]);
  assert.deepEqual(r.report.built, [{ at: "SAL", owner: "A" }]);
  assert.equal(r.report.count.A.ships, 3);
});

test("rule 5: no build in a harbour that is occupied, even one's own", () => {
  let s = initialState(B, HOMES);
  s = resolvePhase(B, s, { orders: { A: ["move SAL-R GULL"] } }).state;
  const r = resolvePhase(B, s, { orders: {} });
  assert.deepEqual(placesHeld(r.state, "A"), ["SAL", "GULL"]);
  assert.deepEqual(r.report.built, [], "Saltmere still has its ship");
});

test("rule 5: fewer places than ships, a removal is owed and taken from the next orders", () => {
  // B holds only Lanternfall after phase 2 with two ships: one removal owed.
  let s = initialState(B, HOMES);
  s = resolvePhase(B, s, { orders: {} }).state;
  const r2 = resolvePhase(B, s, { orders: {} });
  assert.equal(r2.state.removalsOwed.B, 1);
  const r3 = resolvePhase(B, r2.state, { orders: { B: ["remove LAN", "move LAN-R GULL"] } });
  assert.deepEqual(r3.report.removed.filter((x) => x.player === "B"), [{ player: "B", at: "LAN", by: "player" }]);
  assert.equal(where(r3.state).GULL, "B");
  assert.equal(r3.report.removed.length, 5, "every player who took nothing by phase 2 owes one removal");
});

test("rule 5: without a removal order, the engine removes the ship farthest from home", () => {
  let s = initialState(B, HOMES);
  s = resolvePhase(B, s, { orders: { B: ["move LAN-R STILL"] } }).state;
  const r2 = resolvePhase(B, s, { orders: {} });
  assert.equal(r2.state.removalsOwed.B, 1);
  const r3 = resolvePhase(B, r2.state, { orders: { B: ["move STILL GRE-R"] } });
  assert.deepEqual(r3.report.removed.filter((x) => x.player === "B"), [{ player: "B", at: "STILL", by: "engine" }]);
  assert.equal(line(r3, "move STILL GRE-R").status, "void");
  assert.equal(distance(B, "STILL", "LAN"), 2);
});

test("rule 5: a removal order with nothing owed is void", () => {
  const r = run({ "SAL-R": "A" }, { A: ["remove SAL-R"] });
  assert.match(r.report.orders[0].reason!, /no removal is owed/);
  assert.deepEqual(where(r.state), { "SAL-R": "A" });
});

test("rule 6: eight places at the end of an even phase wins outright", () => {
  const s = position({}, 3);
  for (const c of ["SAL", "GULL", "LAN", "WREN", "GRE", "ANVIL", "COR"]) s.owners[c] = "A";
  s.ships = [{ at: "FENNEL", owner: "A" }];
  const r = resolvePhase(B, s, { orders: {} });
  assert.deepEqual(r.state.winners, ["A"]);
  assert.throws(() => resolvePhase(B, r.state, { orders: {} }), /over/);
});

test("rule 6: after phase 12 the most places wins, and a tie is shared", () => {
  const s = position({}, 11);
  s.owners.GULL = "B";
  const r = resolvePhase(B, s, { orders: {} });
  assert.deepEqual(r.state.winners, ["B"]);
  const tie = resolvePhase(B, position({}, 11), { orders: {} });
  assert.deepEqual(tie.state.winners, ["A", "B", "C", "D", "E"]);
});

test("rule 6: seven places at an even phase is not a win", () => {
  const s = position({}, 3);
  for (const c of ["SAL", "GULL", "LAN", "WREN", "GRE", "ANVIL", "COR"]) s.owners[c] = "A";
  assert.equal(resolvePhase(B, s, { orders: {} }).state.winners, null);
});

test("sealed orders: the commit is sha256 of the orders and the salt, and the reveal must match", () => {
  const orders = "move SAL-R GULL\nhold SAL";
  const c = commitFor(orders, "pebble-41");
  assert.match(c, /^[0-9a-f]{64}$/);
  assert.ok(revealMatches(c, orders, "pebble-41"));
  assert.ok(revealMatches(c.toUpperCase(), "  move SAL-R GULL \r\n\r\nhold  SAL\n", "pebble-41"), "spacing and line ends do not matter");
  assert.ok(!revealMatches(c, "move SAL-R ASH\nhold SAL", "pebble-41"), "a changed order does not match");
  assert.ok(!revealMatches(c, orders, "pebble-42"), "a changed salt does not match");
  assert.equal(canonicalOrders(" a  b \n\n c"), "a b\nc");
});

test("sealed orders: a reveal letter is the order lines, then `salt: …` on the last line", () => {
  const body = "move SAL-R GULL\nhold SAL\nsalt: pebble 41\n\n";
  const r = parseReveal(body)!;
  assert.equal(r.salt, "pebble 41");
  assert.ok(revealMatches(commitFor("move SAL-R GULL\nhold SAL", "pebble 41"), r.orders, r.salt));
  assert.equal(parseReveal("hold SAL\r\nsalt: pebble 41\r\n")!.salt, "pebble 41", "line ends are not part of the salt");
  assert.equal(parseReveal("move SAL-R GULL\nhold SAL"), null, "no salt line, nothing to check");
  assert.equal(parseReveal("move SAL-R GULL\nsalt:"), null, "an empty salt is no salt");
});

test("sealed orders: a salt with spaces at either end is kept as written, commit then reveal match", () => {
  const orders = "move SAL-R GULL\nhold SAL";
  const salt = " pebble 41 ";
  const commit = commitFor(orders, salt);
  const r = parseReveal(`${orders}\nsalt: ${salt}\n`)!;
  assert.equal(r.salt, salt);
  assert.ok(revealMatches(commit, r.orders, r.salt), "the salt comes back exactly as it was hashed");
  assert.notEqual(commit, commitFor(orders, "pebble 41"), "the spaces are part of the salt");
  const plain = parseReveal(`${orders}\nsalt: pebble-41\n`)!;
  assert.equal(plain.salt, "pebble-41", "a salt without spaces at its ends is unchanged");
  assert.ok(revealMatches(commitFor(orders, "pebble-41"), plain.orders, plain.salt));
});

test("sealed orders: no commit, no reveal or a wrong reveal, and the ships hold", () => {
  const players = ["A", "B", "C", "D"];
  const good = { orders: "move SAL-R GULL", salt: "x" };
  const p: SealedPhase = {
    commits: { A: commitFor(good.orders, good.salt), C: commitFor(good.orders, good.salt), D: "deadbeef" },
    reveals: { A: good, B: good, D: good },
  };
  const opened = openSeals(players, p);
  assert.deepEqual(opened.orders, { A: ["move SAL-R GULL"] });
  assert.match(opened.sealed!.B, /no commit/);
  assert.match(opened.sealed!.C, /no reveal/);
  assert.match(opened.sealed!.D, /does not match/);
});

// A short game, written as the referee will keep it: commits and reveals as delivered.
function sealed(orders: Record<string, string>): SealedPhase {
  const commits: Record<string, string> = {};
  const reveals: Record<string, { orders: string; salt: string }> = {};
  for (const [p, o] of Object.entries(orders)) {
    const salt = `salt-${p}-${o.length}`;
    commits[p] = commitFor(o, salt);
    reveals[p] = { orders: o, salt };
  }
  return { commits, reveals };
}
const GAME: GameRecord = {
  id: "test-game",
  homes: HOMES,
  phases: [
    sealed({ A: "move SAL-R GULL\nmove SAL SAL-R", B: "move LAN-R GULL", C: "move GRE-R WREN", D: "move COR-R ANVIL", E: "move MIS-R FENNEL" }),
    sealed({ A: "move SAL-R ASH\nsupport LAN-R hold GULL", B: "move LAN-R STILL", C: "move WREN LAN-R\nmove GRE GRE-R", D: "move ANVIL GRE-R", E: "hold FENNEL" }),
    sealed({ A: "hold ASH", B: "remove LAN\nmove STILL SAL-R", C: "support GRE-R move LAN-R GULL\nmove LAN-R GULL" }),
    sealed({ D: "move COR-R ANVIL", E: "move MIS-R MARROW" }),
  ],
};

test("replay: the same record always gives the same states and reports", () => {
  const one = replay(B, GAME);
  const two = replay(B, structuredClone(GAME));
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.equal(one.states.length, GAME.phases.length + 1);
});

test("replay: a game replayed from phase 1 ends where it was played phase by phase", () => {
  const players = Object.keys(GAME.homes).sort();
  let s = initialState(B, GAME.homes);
  for (const p of GAME.phases) s = resolvePhase(B, s, openSeals(players, p)).state;
  assert.deepEqual(replay(B, GAME).states.at(-1), s);
});

test("replay: the order in which players' letters are listed does not change the verdict", () => {
  const shuffled: GameRecord = {
    ...GAME,
    homes: Object.fromEntries(Object.entries(GAME.homes).reverse()),
    phases: GAME.phases.map((p) => ({
      commits: Object.fromEntries(Object.entries(p.commits).reverse()),
      reveals: Object.fromEntries(Object.entries(p.reveals).reverse()),
    })),
  };
  assert.equal(JSON.stringify(replay(B, shuffled).states), JSON.stringify(replay(B, GAME).states));
});

test("replay: a ship's order lines in another order give the same verdict", () => {
  const a = run({ STILL: "A", "SAL-R": "A", "LAN-R": "B", WREN: "B" }, { A: ["move SAL-R LAN-R", "support STILL move SAL-R LAN-R"], B: ["support WREN hold LAN-R"] });
  const b = run({ WREN: "B", "LAN-R": "B", "SAL-R": "A", STILL: "A" }, { B: ["support WREN hold LAN-R"], A: ["support STILL move SAL-R LAN-R", "move SAL-R LAN-R"] });
  assert.deepEqual(a.state, b.state);
});

test("replay: the short game lands where the rules say", () => {
  const { states, reports } = replay(B, GAME);
  // Phase 1: A and B bounce on Gull Rock; the others take their islands.
  assert.equal(reports[0].moved.some((m) => m.to === "GULL"), false);
  // Phase 2: A takes Little Ash; C takes Lanternfall Roads after B left it; D's Anvil ship meets nobody.
  const after2 = states[2];
  assert.deepEqual(placesHeld(after2, "A").sort(), ["ASH", "SAL"]);
  assert.equal(after2.removalsOwed.B, 1, "B holds Lanternfall only, with two ships");
  // C left Wren Key during phase 2, so it was never C's: C holds Greywick only and owes a removal too.
  assert.equal(after2.removalsOwed.C, 1);
  // Phase 3: B removes its harbour ship as ordered; C gave no removal, so the engine takes the
  // farther of its two ships (Lanternfall Roads, two moves from Greywick).
  assert.deepEqual(reports[2].removed, [{ player: "B", at: "LAN", by: "player" }, { player: "C", at: "LAN-R", by: "engine" }]);
  assert.equal(reports.length, 4);
});

// The draw of 23 October 2026, as written in the nine letters lupi-2026-10-23-to-*-seven-harbours-the-draw-result.
test("the draw of 23 October: the engine finds the same order, seats and harbours as the letters", () => {
  const entrants = [
    { handle: "cipher", choices: ["a harbour that rewards reading the neighbours", "any"] },
    { handle: "cookie-of-garrison", choices: [] },
    { handle: "fabel-of-garrison", choices: ["any"] },
    { handle: "glados-letta", choices: ["any"] },
    { handle: "k-of-garrison", choices: ["any"] },
    { handle: "kai", choices: ["Lanternfall", "Tidewell"] },
    { handle: "landfall", choices: ["any"] },
    { handle: "rook-of-garrison", choices: ["any"] },
    { handle: "solan", choices: ["any"] },
  ];
  const d = drawSeats(B, entrants, "24233bb4f38c83553ec958d52d86910541af47d4");
  assert.deepEqual(d.order.map((o) => o.handle), [
    "glados-letta", "landfall", "kai", "k-of-garrison", "rook-of-garrison", "solan", "fabel-of-garrison", "cipher", "cookie-of-garrison",
  ]);
  assert.equal(d.order[0].hash, "119ebe355f6bdf62d2410bc17e3221bbf4f62ab37e78e8f88bcfc757a7d27992");
  assert.equal(d.order[8].hash, "f0a195d174f6494db1500e4cfbefae9fbdbf934b3bdc8e8c176241acd8636300");
  assert.deepEqual(d.homes, {
    "glados-letta": "SAL", landfall: "GRE", kai: "LAN", "k-of-garrison": "COR", "rook-of-garrison": "MIS", solan: "IRO", "fabel-of-garrison": "TID",
  });
  assert.deepEqual(d.reserves, ["cipher", "cookie-of-garrison"]);
});

test("game-1.json holds the seats of the draw", () => {
  const g = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../games/game-1.json"), "utf8")) as GameRecord;
  assert.deepEqual(g.homes, {
    "fabel-of-garrison": "TID", "glados-letta": "SAL", kai: "LAN", "k-of-garrison": "COR", landfall: "GRE", "rook-of-garrison": "MIS", solan: "IRO",
  });
  assert.equal(initialState(B, g.homes).ships.length, 14);
  assert.deepEqual(replay(B, g).states.length, g.phases.length + 1);
});
