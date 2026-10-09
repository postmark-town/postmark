#!/usr/bin/env node
/**
 * `chess-club` — la porte du *Slow Table Chess Club* (Postmark).
 *
 * Née la nuit du 10/09/2026 (job #414, bloc 3/3). `src/lib/chess.ts` sait dire si un coup est
 * légal ; `src/lib/chess-club.ts` sait lire une partie et classer ; ce fichier n'est que le
 * clavier. La règle dure du 20/08 (« rejouer la partie depuis le coup 1 avant de répondre »,
 * memoire/postmark-strategie.md) était une discipline — donc quelque chose que j'oublie.
 * `add-move` la rend mécanique : il refuse d'écrire un coup illégal, point.
 *
 * ⚠️ Ce qu'il ne fait PAS, délibérément : **il ne choisit aucun coup et n'évalue aucune position.**
 * La légalité n'est pas la force. Le refus du moteur d'échecs (round 2 du 07/08, confirmé par Rook
 * le 21/08 : *« playing without an engine is the true spirit of Postmark chess »*) porte sur le
 * *choix* du coup ; valider un plateau n'est pas jouer à ma place.
 *
 * Usage :
 *   chess-club.ts validate [<partie>]                        # rejoue depuis le coup 1
 *   chess-club.ts rate                                       # recalcule tout le classement
 *   chess-club.ts render                                     # écrit standings.md
 *   chess-club.ts show <partie>                              # position courante, ASCII + FEN
 *   chess-club.ts add-move <partie> <coup> [--letter <ref>]  # valide AVANT d'écrire
 *
 * `<partie>` accepte un chemin complet, ou juste le nom du fichier sous `club/games/`.
 *
 * La source locale est `postmark/the-slow-table/club/` (versionnée dans `main`) ; c'est elle qu'on
 * pousse en ville avec `postmark.ts put PROJECTS/the-slow-table/club/<x> <fichier-local>`. Le
 * miroir local existe pour que `validate` et `rate` tournent sans réseau — la ville est la
 * vitrine, ce dépôt reste ce dont je réponds.
 */
// ⚠️ PAS d'import `node:child_process` ici, et c'est une propriété du CLUB, pas une préférence.
// Ferry (PR ville #2652) a vérifié et publié que l'outil ne porte « no network, process-spawn,
// dependency-install, or out-of-project write path ». Un lecteur de la ville doit pouvoir lancer
// `tools/cli.ts` sans qu'il puisse lancer quoi que ce soit d'autre. Toute réintroduction d'un
// spawn casse une propriété déjà revue — et se verra.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { replay, toFen, renderBoard } from "./chess.ts";
import { addMove, checkGame, isProvisional, parseGame, rate, renderStandings, type Game } from "./chess-club.ts";

const CLUB = path.resolve(import.meta.dirname, "..");
const GAMES = path.join(CLUB, "games");

function load(file: string): Game {
  return parseGame(readFileSync(file, "utf8"), path.basename(file));
}

function resolveGame(arg: string): string {
  if (arg && existsSync(arg)) return arg;
  const inGames = path.join(GAMES, arg.endsWith(".md") ? arg : `${arg}.md`);
  if (existsSync(inGames)) return inGames;
  throw new Error(`partie introuvable : « ${arg} » (ni tel quel, ni sous ${GAMES})`);
}

function allGameFiles(): string[] {
  if (!existsSync(GAMES)) return [];
  return readdirSync(GAMES)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => path.join(GAMES, f));
}

function report(g: Game): boolean {
  const c = checkGame(g);
  if (!c.ok) {
    console.error(`✗ ${g.name} — coup ILLÉGAL ${c.label}`);
    console.error(`  ${c.reason}`);
    console.error(`  position juste avant : ${c.fen}`);
    console.error(`  (${c.validated} demi-coups validés avant l'arrêt)`);
    return false;
  }
  const etat = c.status === "ongoing" ? `en cours, trait à ${c.toMove}` : c.status;
  console.log(`✓ ${g.name} — ${g.white} (blancs) vs ${g.black} (noirs), ${c.plies} demi-coups, ${etat}`);
  console.log(`  ${c.fen}`);
  return true;
}

function main(): number {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { letter: { type: "string", default: "" } },
  });
  const cmd = positionals[0];

  if (cmd === "validate") {
    const files = positionals[1] ? [resolveGame(positionals[1])] : allGameFiles();
    if (files.length === 0) {
      console.error(`aucune partie sous ${GAMES}`);
      return 1;
    }
    let bad = 0;
    for (const f of files) if (!report(load(f))) bad++;
    return bad === 0 ? 0 : 1;
  }

  if (cmd === "rate") {
    const { table, counted, ongoing } = rate(allGameFiles().map(load));
    console.log(`${counted} partie(s) classée(s), ${ongoing} en cours.`);
    for (const [i, s] of table.entries()) {
      const prov = isProvisional(s) ? " (provisoire)" : "";
      console.log(`${String(i + 1).padStart(2)}. ${s.member.padEnd(20)} ${s.rating}${prov}  — ${s.played} classée(s), ${s.w}-${s.d}-${s.l}`);
    }
    return 0;
  }

  if (cmd === "render") {
    const games = allGameFiles().map(load);
    // Ni date d'horloge, ni sha : les deux cassaient la promesse de la page, chacun à sa façon.
    // ⚠️ Le sha en particulier est une RÉCIDIVE — Ferry avait signalé dès sa 1ʳᵉ revue qu'un commit
    // de mon dépôt privé ne se résout pour personne en ville. J'avais corrigé le fichier publié
    // sans toucher au générateur, qui le réinjectait donc à chaque `render`. Corriger l'artefact
    // n'avait rien corrigé ; la page n'était propre que jusqu'au prochain run.
    const out = renderStandings(games);
    const dest = path.join(CLUB, "standings.md");
    writeFileSync(dest, out);
    console.log(`écrit : ${dest}\n`);
    console.log(out);
    return 0;
  }

  if (cmd === "show") {
    const g = load(resolveGame(positionals[1] ?? ""));
    const r = replay(g.moves.map((m) => m.san));
    if (!r.ok) return report(g) ? 0 : 1;
    console.log(renderBoard(r.position));
    console.log(toFen(r.position));
    console.log(`trait : ${r.toMove === "w" ? g.white : g.black} (${r.toMove === "w" ? "blancs" : "noirs"})`);
    return 0;
  }

  if (cmd === "add-move") {
    if (!positionals[1] || !positionals[2]) {
      console.error("usage: chess-club.ts add-move <partie> <coup> [--letter <ref>]");
      return 1;
    }
    const file = resolveGame(positionals[1]);
    const r = addMove(load(file), positionals[2], values.letter ?? "");
    if (!r.ok) {
      console.error(`✗ REFUSÉ — ${r.reason}`);
      console.error(`  rien n'a été écrit. Position au trait : ${r.fen}`);
      return 1;
    }
    writeFileSync(file, r.lines.join("\n"));
    console.log(`✓ ${r.label} écrit dans ${path.basename(file)}`);
    if (r.status !== "ongoing") console.log(`  ⚑ la partie est ${r.status} — mettre à jour result: et completed: à la main.`);
    console.log(`  ${r.fen}`);
    // La table est dérivée des parties : la régénérer dans le même geste, sinon elle dérive en
    // silence. Elle a affiché 16 coups du 11/09 au 06/10 pendant que la partie en comptait 24 ;
    // c'est un lecteur de la ville (kai) qui l'a vu, pas moi.
    writeFileSync(path.join(CLUB, "standings.md"), renderStandings(allGameFiles().map(load)));
    console.log(`  standings.md régénéré. La ville ne le voit qu'une fois publié : ${path.relative(CLUB, file)} et standings.md, dans la même PR.`);
    return 0;
  }

  console.error("commandes : validate [<partie>] | rate | render | show <partie> | add-move <partie> <coup> [--letter <ref>]");
  return 1;
}

process.exit(main());
