/**
 * seven harbours: the adjudication engine.
 *
 * Zero dependencies, Node 22 (`node tools/referee.ts …`, tests: `node --test tools/engine.test.ts`).
 * It reads the board from map.md, refuses impossible orders (README rule 8), resolves a phase with
 * the standard Diplomacy logic (README rule 4), counts places, builds and removes ships (rule 5),
 * declares the end (rule 6), and checks every reveal against its commit (Sealed orders).
 *
 * Nothing here is random and nothing reads the clock: the same inputs give the same verdict, and a
 * game replayed from phase 1 gives the same state. Every choice the README does not make is named
 * in the README under "What the engine decides that the rules do not say".
 *
 * Resolution follows Lucas Kruijswijk's algorithm ("The Math of Adjudication"): each move is
 * resolved from the strengths the rules define, a cycle is settled by guessing both outcomes, and a
 * cycle with two consistent outcomes is a ring of ships moving round, which all succeed. There are
 * no convoys on this board, so no convoy paradox can arise.
 */
import { createHash } from "node:crypto";

// ─── the board ──────────────────────────────────────────────────────────────────────────────────

export type Kind = "harbour" | "water" | "island";
export interface Place { code: string; name: string; kind: Kind; counts: boolean; touches: string[] }
export interface Board { places: Record<string, Place>; order: string[] }

/** Reads the adjacency table of map.md. Rows whose Code cell is not a place code are skipped. */
export function parseMap(md: string): Board {
  const places: Record<string, Place> = {};
  const order: string[] = [];
  for (const line of md.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length !== 6 || cells[0] !== "" || cells[5] !== "") continue;
    const [, rawName, code, kind, touches] = cells;
    if (!/^[A-Z]+(-R)?$/.test(code)) continue;
    if (kind !== "harbour" && kind !== "water" && kind !== "island") throw new Error(`map: ${code} has unknown kind "${kind}"`);
    if (places[code]) throw new Error(`map: ${code} is listed twice`);
    places[code] = {
      code,
      name: rawName.replace("★", "").trim(),
      kind,
      counts: rawName.includes("★"),
      touches: touches.split(",").map((s) => s.trim()).filter(Boolean),
    };
    order.push(code);
  }
  return { places, order };
}

/** Problems with a board; empty when it is fit to play on. map.md promises the table is symmetric. */
export function checkBoard(b: Board): string[] {
  const out: string[] = [];
  for (const code of b.order) {
    const p = b.places[code];
    for (const t of p.touches) {
      if (!b.places[t]) out.push(`${code} touches unknown place ${t}`);
      else if (t === code) out.push(`${code} touches itself`);
      else if (!b.places[t].touches.includes(code)) out.push(`${code} touches ${t} but ${t} does not touch ${code}`);
    }
    if (new Set(p.touches).size !== p.touches.length) out.push(`${code} lists a neighbour twice`);
  }
  return out;
}

export function touches(b: Board, from: string, to: string): boolean {
  return b.places[from]?.touches.includes(to) ?? false;
}

/** Shortest number of moves between two places (Infinity if unreachable). */
export function distance(b: Board, from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; frontier.length; d++) {
    const next: string[] = [];
    for (const p of frontier) {
      for (const t of b.places[p].touches) {
        if (t === to) return d;
        if (!seen.has(t)) { seen.add(t); next.push(t); }
      }
    }
    frontier = next;
  }
  return Infinity;
}

const mapIndex = (b: Board, code: string) => b.order.indexOf(code);

// ─── orders ─────────────────────────────────────────────────────────────────────────────────────

export type Order =
  | { kind: "hold"; at: string }
  | { kind: "move"; at: string; to: string }
  | { kind: "support"; at: string; target: string; dest: string | null }
  | { kind: "remove"; at: string };

/**
 * One order line. The forms are the README's: `hold SAL`, `move SAL-R STILL`,
 * `support LAN-R move SAL-R GULL`, `support LAN-R hold SAL-R`, and `remove SAL-R` for rule 5.
 * Words are case-insensitive; extra spaces are ignored.
 */
export function parseOrder(line: string): Order | { error: string } {
  const w = line.trim().split(/\s+/).filter(Boolean);
  const verb = (w[0] ?? "").toLowerCase();
  const code = (i: number) => (w[i] ?? "").toUpperCase();
  if (verb === "hold" && w.length === 2) return { kind: "hold", at: code(1) };
  if (verb === "move" && w.length === 3) return { kind: "move", at: code(1), to: code(2) };
  if (verb === "remove" && w.length === 2) return { kind: "remove", at: code(1) };
  if (verb === "support") {
    const how = (w[2] ?? "").toLowerCase();
    if (how === "hold" && w.length === 4) return { kind: "support", at: code(1), target: code(3), dest: null };
    if (how === "move" && w.length === 5) return { kind: "support", at: code(1), target: code(3), dest: code(4) };
  }
  return { error: "cannot read this order (forms: hold X · move X Y · support X move Y Z · support X hold Y · remove X)" };
}

export const orderText = (o: Order): string =>
  o.kind === "hold" ? `hold ${o.at}`
  : o.kind === "move" ? `move ${o.at} ${o.to}`
  : o.kind === "remove" ? `remove ${o.at}`
  : o.dest === null ? `support ${o.at} hold ${o.target}` : `support ${o.at} move ${o.target} ${o.dest}`;

// ─── sealed orders ──────────────────────────────────────────────────────────────────────────────

/**
 * The exact text that is hashed: each order line trimmed, inner spaces collapsed to one, empty
 * lines dropped, joined by a single "\n", no newline at the end. Case is kept as written.
 */
export function canonicalOrders(text: string): string {
  return text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean).join("\n");
}

/** sha256(orders + salt), lowercase hex: the one line of a commit letter. */
export function commitFor(orders: string, salt: string): string {
  return createHash("sha256").update(canonicalOrders(orders) + salt, "utf8").digest("hex");
}

/**
 * A reveal letter's body: the order lines, then one last line `salt: <salt>`. The salt is
 * everything after "salt:" and the one space that follows it, up to the end of the line, kept as
 * written: commitFor hashes the salt as given, so a salt with spaces at either end must come back
 * with them or its reveal would no longer match.
 */
export function parseReveal(body: string): { orders: string; salt: string } | null {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const m = /^\s*salt: ?(.*)$/i.exec(lines.pop() ?? "");
  if (!m || !m[1]) return null;
  return { orders: lines.join("\n"), salt: m[1] };
}

export function revealMatches(commit: string, orders: string, salt: string): boolean {
  return /^[0-9a-f]{64}$/i.test(commit.trim()) && commit.trim().toLowerCase() === commitFor(orders, salt);
}

// ─── state ──────────────────────────────────────────────────────────────────────────────────────

export interface Ship { at: string; owner: string }
export interface State {
  phase: number;                         // phases already resolved (0 before the first)
  homes: Record<string, string>;         // player → their harbour
  ships: Ship[];                         // in map order
  owners: Record<string, string | null>; // every place that counts → who holds it
  removalsOwed: Record<string, number>;  // removals a player must order in the next phase
  winners: string[] | null;              // set once the game has ended
}

export const PHASES = 12;
export const BUILD_PHASES = [2, 4, 6, 8, 10];
export const WIN_AT = 8;

/** Rule 2: each player starts with a ship in their harbour and one in its Roads. */
export function initialState(b: Board, homes: Record<string, string>): State {
  const problems = checkBoard(b);
  if (problems.length) throw new Error(`board: ${problems.join("; ")}`);
  const players = Object.keys(homes).sort();
  if (players.length < 5 || players.length > 7) throw new Error(`rule 1: 5 to 7 players, not ${players.length}`);
  const seen = new Set<string>();
  const ships: Ship[] = [];
  for (const p of players) {
    const h = homes[p];
    if (b.places[h]?.kind !== "harbour") throw new Error(`${p}: ${h} is not a harbour`);
    if (seen.has(h)) throw new Error(`${h} is given twice`);
    seen.add(h);
    const roads = b.places[h].touches[0];
    ships.push({ at: h, owner: p }, { at: roads, owner: p });
  }
  const owners: Record<string, string | null> = {};
  for (const c of b.order) if (b.places[c].counts) owners[c] = null;
  for (const p of players) owners[homes[p]] = p;
  const sortedHomes = Object.fromEntries(players.map((p) => [p, homes[p]]));
  return { phase: 0, homes: sortedHomes, ships: sortShips(b, ships), owners, removalsOwed: {}, winners: null };
}

const sortShips = (b: Board, ships: Ship[]) => [...ships].sort((x, y) => mapIndex(b, x.at) - mapIndex(b, y.at));

export function placesHeld(s: State, player: string): string[] {
  return Object.keys(s.owners).filter((c) => s.owners[c] === player);
}

// ─── the phase report ───────────────────────────────────────────────────────────────────────────

export interface OrderLine { player: string; text: string; status: "ok" | "void"; reason?: string; result?: string }
export interface PhaseReport {
  phase: number;
  sealed: Record<string, string>;        // player → "revealed" or why their ships held
  orders: OrderLine[];
  removed: { player: string; at: string; by: "player" | "engine" }[];
  moved: { from: string; to: string; owner: string }[];
  sunk: Ship[];
  built: Ship[];
  count: Record<string, { places: number; ships: number }>;
  removalsOwed: Record<string, number>;
  note: string[];
  winners: string[] | null;
}

// ─── resolution ─────────────────────────────────────────────────────────────────────────────────

type Eff = { kind: "hold" } | { kind: "move"; to: string } | { kind: "support"; target: string; dest: string | null };
interface Unit { at: string; owner: string; eff: Eff }

export interface Resolution { success: Set<string>; dislodged: Set<string>; cut: Set<string>; ring: boolean; paradox: boolean }

/**
 * The adjudicator proper. `units` holds every ship with its effective order: an order that was
 * void is already a hold, and a support that matches no order is already a hold (rule 8).
 * Returns the moves that succeed, the ships dislodged, the supports cut.
 */
export function adjudicate(units: Unit[]): Resolution {
  const at = new Map(units.map((u) => [u.at, u]));
  const movesInto = new Map<string, Unit[]>();
  const moveSupports = new Map<string, Unit[]>();
  const holdSupports = new Map<string, Unit[]>();
  for (const u of units) {
    if (u.eff.kind === "move") movesInto.set(u.eff.to, [...(movesInto.get(u.eff.to) ?? []), u]);
    if (u.eff.kind === "support") {
      const m = u.eff.dest === null ? holdSupports : moveSupports;
      m.set(u.eff.target, [...(m.get(u.eff.target) ?? []), u]);
    }
  }
  const dest = (u: Unit) => (u.eff.kind === "move" ? u.eff.to : null);
  const opponent = (u: Unit): Unit | null => {
    const d = dest(u);
    const o = d === null ? undefined : at.get(d);
    return o && dest(o) === u.at ? o : null;
  };

  const UNRESOLVED = 0, GUESSING = 1, RESOLVED = 2;
  const state = new Map<string, number>();
  const result = new Map<string, boolean>();
  const deps: string[] = [];
  let ring = false, paradox = false;

  // A support is cut by a move into the supporter from another player, unless that move comes from
  // the place the support is aimed at: then only by dislodging it. A player never cuts their own.
  const supportHolds = (s: Unit): boolean => {
    if (s.eff.kind !== "support") return false;
    const into = s.eff.dest ?? s.eff.target;
    for (const m of movesInto.get(s.at) ?? []) {
      if (m.owner === s.owner) continue;
      if (m.at !== into) return false;
      if (resolve(m.at)) return false;
    }
    return true;
  };
  const count = (list: Unit[] | undefined, except?: string) =>
    (list ?? []).filter((s) => s.owner !== except && supportHolds(s)).length;

  const holdStrength = (place: string): number => {
    const u = at.get(place);
    if (!u) return 0;
    if (u.eff.kind === "move") return resolve(u.at) ? 0 : 1;
    return 1 + count(holdSupports.get(place));
  };
  const attackStrength = (m: Unit): number => {
    const d = dest(m)!;
    const def = at.get(d);
    const gone = def && def.eff.kind === "move" && !opponent(m) && resolve(def.at);
    if (!def || gone) return 1 + count(moveSupports.get(m.at));
    if (def.owner === m.owner) return 0;
    return 1 + count(moveSupports.get(m.at), def.owner);
  };
  const defendStrength = (m: Unit) => 1 + count(moveSupports.get(m.at));
  const preventStrength = (m: Unit): number => {
    const o = opponent(m);
    if (o && resolve(o.at)) return 0;
    return 1 + count(moveSupports.get(m.at));
  };

  const judge = (place: string): boolean => {
    const m = at.get(place)!;
    const d = dest(m)!;
    const att = attackStrength(m);
    const o = opponent(m);
    if (o ? att <= defendStrength(o) : att <= holdStrength(d)) return false;
    for (const rival of movesInto.get(d) ?? []) if (rival !== m && att <= preventStrength(rival)) return false;
    return true;
  };

  function resolve(place: string): boolean {
    const st = state.get(place) ?? UNRESOLVED;
    if (st === RESOLVED) return result.get(place)!;
    if (st === GUESSING) {
      if (!deps.includes(place)) deps.push(place);
      return result.get(place)!;
    }
    const mark = deps.length;
    result.set(place, false); state.set(place, GUESSING);
    const first = judge(place);
    if (deps.length === mark) {
      if (state.get(place) !== RESOLVED) { result.set(place, first); state.set(place, RESOLVED); }
      return first;
    }
    if (deps[mark] !== place) {
      deps.push(place);
      result.set(place, first);
      return first;
    }
    for (const p of deps.slice(mark)) state.set(p, UNRESOLVED);
    deps.length = mark;
    result.set(place, true); state.set(place, GUESSING);
    const second = judge(place);
    if (first === second) {
      for (const p of deps.slice(mark)) state.set(p, UNRESOLVED);
      deps.length = mark;
      result.set(place, first); state.set(place, RESOLVED);
      return first;
    }
    // Two consistent outcomes (fail→fail, succeed→succeed) is a ring of ships moving round: they
    // all move. No consistent outcome cannot come from moves and supports alone; if it ever did,
    // every move in the cycle fails and the report says so.
    const cycle = [place, ...deps.slice(mark).filter((p) => p !== place)];
    const allMove = first === false && second === true;
    if (allMove) ring = true; else paradox = true;
    for (const p of cycle) { result.set(p, allMove); state.set(p, RESOLVED); }
    deps.length = mark;
    return resolve(place);
  }

  const success = new Set<string>();
  for (const u of units) if (u.eff.kind === "move" && resolve(u.at)) success.add(u.at);
  const dislodged = new Set<string>();
  for (const u of units) {
    if (u.eff.kind === "move" && success.has(u.at)) continue;
    if ((movesInto.get(u.at) ?? []).some((m) => success.has(m.at))) dislodged.add(u.at);
  }
  const cut = new Set<string>();
  for (const u of units) if (u.eff.kind === "support" && !supportHolds(u)) cut.add(u.at);
  return { success, dislodged, cut, ring, paradox };
}

// ─── one phase ──────────────────────────────────────────────────────────────────────────────────

export interface PhaseInput {
  /** The revealed orders of each player whose reveal matched their commit. */
  orders: Record<string, string[]>;
  /** Players whose ships hold without reading their orders, with the reason (rule 7). */
  sealed?: Record<string, string>;
}

export function resolvePhase(b: Board, before: State, input: PhaseInput): { state: State; report: PhaseReport } {
  if (before.winners) throw new Error("the game is over");
  const phase = before.phase + 1;
  const players = Object.keys(before.homes).sort();
  const report: PhaseReport = {
    phase, sealed: {}, orders: [], removed: [], moved: [], sunk: [], built: [], count: {}, removalsOwed: {}, note: [], winners: null,
  };
  for (const p of players) {
    const why = input.sealed?.[p];
    report.sealed[p] = why ?? (input.orders[p] ? "revealed" : "no orders: ships hold");
  }
  let ships = before.ships.map((s) => ({ ...s }));
  const lines: { player: string; line: OrderLine; order: Order | null }[] = [];
  for (const p of players) {
    if (input.sealed?.[p]) continue;
    for (const text of input.orders[p] ?? []) {
      if (!text.trim()) continue;
      const parsed = parseOrder(text);
      const line: OrderLine = { player: p, text: text.trim(), status: "ok" };
      if ("error" in parsed) { line.status = "void"; line.reason = parsed.error; lines.push({ player: p, line, order: null }); continue; }
      line.text = orderText(parsed);
      lines.push({ player: p, line, order: parsed });
    }
  }
  const voidLine = (l: OrderLine, reason: string) => { l.status = "void"; l.reason = reason; };
  const shipAt = (place: string) => ships.find((s) => s.at === place);

  // Rule 5, removals owed from the last build count: the player's own `remove` orders first, then
  // the engine removes the farthest from their harbour.
  for (const p of players) {
    let owed = before.removalsOwed[p] ?? 0;
    for (const l of lines.filter((x) => x.player === p && x.order?.kind === "remove")) {
      const s = shipAt(l.order!.at);
      if (owed === 0) voidLine(l.line, "no removal is owed");
      else if (!s) voidLine(l.line, `no ship at ${l.order!.at}`);
      else if (s.owner !== p) voidLine(l.line, `the ship at ${s.at} is not yours`);
      else {
        ships = ships.filter((x) => x !== s); owed--;
        report.removed.push({ player: p, at: s.at, by: "player" }); l.line.result = "removed";
      }
    }
    while (owed > 0) {
      const mine = ships.filter((s) => s.owner === p);
      if (!mine.length) break;
      const far = farthest(b, mine, before.homes[p]);
      ships = ships.filter((x) => x !== far); owed--;
      report.removed.push({ player: p, at: far.at, by: "engine" });
    }
  }

  // Rule 8: every order checked against the board before anything moves.
  const byShip = new Map<string, typeof lines>();
  for (const l of lines) {
    if (l.line.status === "void" || !l.order || l.order.kind === "remove") continue;
    const o = l.order;
    const s = shipAt(o.at);
    if (!b.places[o.at]) { voidLine(l.line, `${o.at} is not a place on the map`); continue; }
    if (report.removed.some((r) => r.at === o.at && r.player === l.player) && !s) { voidLine(l.line, `the ship at ${o.at} was removed`); continue; }
    if (!s) { voidLine(l.line, `no ship at ${o.at}`); continue; }
    if (s.owner !== l.player) { voidLine(l.line, `the ship at ${o.at} is not yours`); continue; }
    byShip.set(o.at, [...(byShip.get(o.at) ?? []), l]);
  }
  for (const [place, list] of byShip) {
    if (list.length > 1) { for (const l of list) voidLine(l.line, `two orders for the ship at ${place}: it holds`); byShip.delete(place); continue; }
    const why = invalidity(b, list[0].order!);
    if (why) { voidLine(list[0].line, why); byShip.delete(place); }
  }
  const units: Unit[] = ships.map((s) => {
    const l = byShip.get(s.at)?.[0];
    const o = l?.order;
    const eff: Eff = !o || o.kind === "hold" || o.kind === "remove" ? { kind: "hold" }
      : o.kind === "move" ? { kind: "move", to: o.to } : { kind: "support", target: o.target, dest: o.dest };
    return { at: s.at, owner: s.owner, eff };
  });
  const unitAt = new Map(units.map((u) => [u.at, u]));
  for (const u of units) {
    if (u.eff.kind !== "support") continue;
    const t = unitAt.get(u.eff.target);
    const l = byShip.get(u.at)![0].line;
    let why: string | null = null;
    if (!t) why = `no ship at ${u.eff.target}`;
    else if (u.eff.dest === null && t.eff.kind === "move") why = `the ship at ${t.at} was ordered to move, not to hold`;
    else if (u.eff.dest !== null && (t.eff.kind !== "move" || t.eff.to !== u.eff.dest)) why = `support of a move that was never ordered (${t.at} to ${u.eff.dest})`;
    if (why) { voidLine(l, why); u.eff = { kind: "hold" }; }
  }

  const r = adjudicate(units);
  if (r.ring) report.note.push("a ring of ships moved round together");
  if (r.paradox) report.note.push("a cycle of orders had no consistent outcome: every move in it failed");
  for (const u of units) {
    const l = byShip.get(u.at)?.[0]?.line;
    if (!l || l.status === "void") continue;
    if (u.eff.kind === "move") l.result = r.success.has(u.at) ? "moved" : "bounced";
    else if (u.eff.kind === "support") l.result = r.cut.has(u.at) ? "support cut" : "support given";
    else l.result = "held";
    if (r.dislodged.has(u.at)) l.result += ", sunk";
  }
  for (const l of lines) if (l.line.status === "void" && l.order?.kind !== "remove" && !l.line.result) {
    const u = l.order ? unitAt.get(l.order.at) : undefined;
    if (u && u.owner === l.player && r.dislodged.has(u.at)) l.line.result = "sunk";
  }

  const next: Ship[] = [];
  for (const u of units) {
    if (r.dislodged.has(u.at)) { report.sunk.push({ at: u.at, owner: u.owner }); continue; }
    if (u.eff.kind === "move" && r.success.has(u.at)) {
      next.push({ at: u.eff.to, owner: u.owner });
      report.moved.push({ from: u.at, to: u.eff.to, owner: u.owner });
    } else next.push({ at: u.at, owner: u.owner });
  }
  report.orders = lines.map((l) => l.line);

  const after: State = {
    phase, homes: { ...before.homes }, ships: sortShips(b, next), owners: { ...before.owners }, removalsOwed: {}, winners: null,
  };

  // Places change hands only at the end of an even phase (rule 5: "at the end of an even phase").
  if (phase % 2 === 0) {
    for (const s of after.ships) if (b.places[s.at].counts) after.owners[s.at] = s.owner;
    const held = (p: string) => placesHeld(after, p).length;
    const top = Math.max(...players.map(held));
    if (top >= WIN_AT) after.winners = players.filter((p) => held(p) === top);
    else if (phase === PHASES) after.winners = players.filter((p) => held(p) === top);
    if (!after.winners && BUILD_PHASES.includes(phase)) {
      for (const p of players) {
        const mine = after.ships.filter((s) => s.owner === p).length;
        const diff = held(p) - mine;
        if (diff > 0) {
          const free = buildSites(b, after, p).slice(0, diff);
          for (const h of free) { const s = { at: h, owner: p }; after.ships.push(s); report.built.push(s); }
          if (free.length < diff) report.note.push(`${p} was owed ${diff} build(s) and had room for ${free.length}`);
        } else if (diff < 0) after.removalsOwed[p] = -diff;
      }
      after.ships = sortShips(b, after.ships);
    }
  }
  for (const p of players) report.count[p] = { places: placesHeld(after, p).length, ships: after.ships.filter((s) => s.owner === p).length };
  report.removalsOwed = { ...after.removalsOwed };
  report.winners = after.winners;
  return { state: after, report };
}

/** Why an order is impossible on the board itself, or null. */
function invalidity(b: Board, o: Order): string | null {
  if (o.kind === "move") {
    if (!b.places[o.to]) return `${o.to} is not a place on the map`;
    if (o.to === o.at) return "a ship cannot move to where it already is";
    if (!touches(b, o.at, o.to)) return `${o.at} does not touch ${o.to}`;
  }
  if (o.kind === "support") {
    if (!b.places[o.target]) return `${o.target} is not a place on the map`;
    if (o.dest !== null && !b.places[o.dest]) return `${o.dest} is not a place on the map`;
    if (o.target === o.at) return "a ship cannot support itself";
    const into = o.dest ?? o.target;
    if (into === o.at) return "a ship cannot support a move into its own place";
    if (!touches(b, o.at, into)) return `${o.at} does not touch ${into}, so it cannot support there`;
  }
  return null;
}

/** Harbours where a player may build: held by them and empty; their own harbour first, then map order. */
export function buildSites(b: Board, s: State, player: string): string[] {
  const home = s.homes[player];
  return b.order
    .filter((c) => b.places[c].kind === "harbour" && s.owners[c] === player && !s.ships.some((x) => x.at === c))
    .sort((x, y) => (x === home ? -1 : y === home ? 1 : mapIndex(b, x) - mapIndex(b, y)));
}

/** The ship the engine removes: the farthest from the player's harbour; a tie goes to map order. */
export function farthest(b: Board, mine: Ship[], home: string): Ship {
  return [...mine].sort((x, y) => distance(b, y.at, home) - distance(b, x.at, home) || mapIndex(b, x.at) - mapIndex(b, y.at))[0];
}

// ─── a whole game ───────────────────────────────────────────────────────────────────────────────

export interface SealedPhase {
  commits: Record<string, string>;
  reveals: Record<string, { orders: string; salt: string }>;
}
export interface GameRecord { id: string; homes: Record<string, string>; phases: SealedPhase[] }

/** Commit then reveal: only a reveal that matches its commit is read; any other player's ships hold. */
export function openSeals(players: string[], p: SealedPhase): PhaseInput {
  const orders: Record<string, string[]> = {};
  const sealed: Record<string, string> = {};
  for (const pl of players) {
    const c = p.commits[pl];
    const r = p.reveals[pl];
    if (!c) sealed[pl] = "no commit delivered: ships hold";
    else if (!r) sealed[pl] = "no reveal delivered: ships hold";
    else if (!revealMatches(c, r.orders, r.salt)) sealed[pl] = "the reveal does not match the commit: ships hold";
    else orders[pl] = canonicalOrders(r.orders).split("\n").filter(Boolean);
  }
  return { orders, sealed };
}

/** Plays a game record from phase 1. The same record always gives the same states and reports. */
export function replay(b: Board, g: GameRecord): { states: State[]; reports: PhaseReport[] } {
  const players = Object.keys(g.homes).sort();
  const states = [initialState(b, g.homes)];
  const reports: PhaseReport[] = [];
  for (const p of g.phases) {
    const { state, report } = resolvePhase(b, states[states.length - 1], openSeals(players, p));
    states.push(state); reports.push(report);
    if (state.winners) break;
  }
  return { states, reports };
}

// ─── the draw (23 October 2026) ─────────────────────────────────────────────────────────────────

export interface Entrant { handle: string; choices: string[] }

/**
 * The seat draw as announced on 16 October and run on 23 October. Order: sha256(handle + ":" +
 * seed), lowercase hex, ascending; the first seven play, the rest are reserves in that order.
 * Harbours: first choices in draw order, then second choices, then "any" filled with the first
 * free harbour in map order. A choice that names no harbour counts as "any". The last step was
 * not in the announcement; it is written in the draw letters of 23 October
 * (`lupi-2026-10-23-to-<handle>-seven-harbours-the-draw-result`).
 */
export function drawSeats(b: Board, entrants: Entrant[], seed: string, seats = 7) {
  const harbourByName = new Map<string, string>();
  for (const c of b.order) if (b.places[c].kind === "harbour") harbourByName.set(b.places[c].name.toLowerCase(), c);
  const ranked = entrants
    .map((e) => ({ ...e, hash: createHash("sha256").update(`${e.handle}:${seed}`, "utf8").digest("hex") }))
    .sort((x, y) => (x.hash < y.hash ? -1 : x.hash > y.hash ? 1 : 0));
  const players = ranked.slice(0, seats);
  const homes: Record<string, string> = {};
  const taken = new Set<string>();
  const pick = (handle: string, h: string | undefined) => {
    if (h && !taken.has(h) && !homes[handle]) { homes[handle] = h; taken.add(h); }
  };
  for (const round of [0, 1]) {
    for (const p of players) pick(p.handle, harbourByName.get((p.choices[round] ?? "").trim().toLowerCase()));
  }
  for (const p of players) {
    if (homes[p.handle]) continue;
    pick(p.handle, b.order.find((c) => b.places[c].kind === "harbour" && !taken.has(c)));
  }
  return { order: ranked.map((r) => ({ handle: r.handle, hash: r.hash })), homes, reserves: ranked.slice(seats).map((r) => r.handle) };
}
