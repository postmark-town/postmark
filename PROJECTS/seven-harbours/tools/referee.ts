/**
 * seven harbours: replay a game from phase 1 and print the phase pages (README rule 9).
 *
 *   node tools/referee.ts games/game-1.json            # every phase, as markdown
 *   node tools/referee.ts games/game-1.json --state    # the state after the last phase, as JSON
 *
 * It reads map.md next to this folder, checks the board, opens every seal (commit, then reveal)
 * and resolves each phase in turn. It never reads the clock and has nothing random in it: anyone
 * who runs it on the same record gets the same pages.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMap, replay, placesHeld, type Board, type GameRecord, type PhaseReport, type State } from "./engine.ts";

const file = process.argv[2];
if (!file) {
  console.error("usage: node tools/referee.ts <game.json> [--state]");
  process.exit(2);
}
const board = parseMap(readFileSync(path.resolve(import.meta.dirname, "../map.md"), "utf8"));
const game = JSON.parse(readFileSync(file, "utf8")) as GameRecord;
const { states, reports } = replay(board, game);

if (process.argv.includes("--state")) {
  console.log(JSON.stringify(states[states.length - 1], null, 2));
} else {
  console.log(`# ${game.id}: ${reports.length} phase(s) resolved\n`);
  console.log(page(board, states[0], null));
  reports.forEach((r, i) => console.log(page(board, states[i + 1], r)));
}

function page(b: Board, s: State, r: PhaseReport | null): string {
  const out: string[] = [];
  out.push(r ? `## Phase ${r.phase}` : "## Start");
  if (r) {
    out.push("", "| Player | Seal |", "|---|---|");
    for (const [p, why] of Object.entries(r.sealed)) out.push(`| ${p} | ${why} |`);
    if (r.removed.length) out.push("", "Removed before the phase: " + r.removed.map((x) => `${x.player} ${x.at} (${x.by})`).join(", "));
    out.push("", "| Player | Order | Result |", "|---|---|---|");
    for (const o of r.orders) out.push(`| ${o.player} | \`${o.text}\` | ${o.status === "void" ? `void: ${o.reason}${o.result ? `; ${o.result}` : ""}` : o.result ?? ""} |`);
    if (r.sunk.length) out.push("", "Sunk: " + r.sunk.map((x) => `${x.owner} at ${x.at}`).join(", "));
    if (r.built.length) out.push("", "Built: " + r.built.map((x) => `${x.owner} at ${x.at}`).join(", "));
    if (Object.keys(r.removalsOwed).length) out.push("", "Removals owed next phase: " + Object.entries(r.removalsOwed).map(([p, n]) => `${p} ${n}`).join(", "));
    for (const n of r.note) out.push("", `Note: ${n}.`);
  }
  out.push("", "| Place | Ship | Held by |", "|---|---|---|");
  for (const c of b.order) {
    const ship = s.ships.find((x) => x.at === c);
    const held = b.places[c].counts ? s.owners[c] ?? "nobody" : "";
    if (ship || held) out.push(`| ${b.places[c].name}${b.places[c].counts ? " ★" : ""} | ${ship?.owner ?? ""} | ${held} |`);
  }
  out.push("", "Places held: " + Object.keys(s.homes).map((p) => `${p} ${placesHeld(s, p).length}`).join(", "));
  if (s.winners) out.push("", `**The game is over. ${s.winners.length === 1 ? "Winner" : "Shared win"}: ${s.winners.join(", ")}.**`);
  out.push("");
  return out.join("\n");
}
