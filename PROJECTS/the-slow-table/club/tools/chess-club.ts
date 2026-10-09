/**
 * `chess-club` — la tenue du *Slow Table Chess Club* : lire une partie, classer, rendre la table.
 *
 * Née la nuit du 10/09/2026 (job #414, bloc 3/3). `chess.ts` sait dire si un coup est légal ; ce
 * module est ce qui fait qu'on le lui demande, et la CLI `bin/chess-club.ts` n'est que sa porte.
 * La logique vit ici et pas dans `bin/` pour une raison bête et suffisante : la suite du projet est
 * scopée `src/**\/*.test.ts`, donc un calcul d'Elo écrit dans `bin/` ne serait couvert par rien.
 *
 * ⚠️ Ce module **n'évalue aucune position et ne choisit aucun coup**. Il compte des résultats.
 * La légalité n'est pas la force ; un classement n'est pas un conseil.
 */
import { isTerminal, replay, toFen } from "./chess.ts";

/** Un demi-coup tel qu'il est écrit dans le tableau : le SAN, et la lettre qui l'a porté. */
export type HalfMove = { san: string; letter: string };

export type Game = {
  /** Nom du fichier, sans le chemin — c'est lui qui départage à date égale. */
  name: string;
  white: string;
  black: string;
  opened: string;
  /** Date d'achèvement, vide tant que `result` vaut `*`. */
  completed: string;
  /** `1-0` | `0-1` | `1/2-1/2` | `*` */
  result: string;
  moves: HalfMove[];
  /** Les lignes brutes, pour réécrire le fichier sans le reformater. */
  lines: string[];
};

const EMPTY = new Set(["", "—", "-", "…", "..."]);

/**
 * Lit un fichier de partie : frontmatter `clé: valeur` entre deux `---`, puis un tableau
 * `| n | blanc | lettre | noir | lettre |`. Le tableau plutôt qu'une liste de SAN parce qu'il se
 * lit aussi bien par un résident de la ville que par ce module — la ville publie du markdown.
 *
 * La numérotation fait foi : un tableau qui saute du coup 7 au coup 9 lève, au lieu de décaler
 * silencieusement toute la partie d'un demi-coup. C'est le mode de panne d'une transcription
 * recopiée à la main, et il est indétectable une fois la position reconstruite.
 */
export function parseGame(raw: string, name: string): Game {
  // ⚠️ `\r?\n` et pas `\n` : sur un checkout Windows chaque ligne garde son `\r`, et comme `.` ne
  // matche PAS `\r` en JS, le `(.*)$` du frontmatter échoue — le fichier se lit alors sans AUCUNE
  // métadonnée, `white`/`black` retombent sur `?`, et le classement fusionne tout le club sous un
  // seul membre `?`. Les coups, eux, continuaient de passer : la panne était donc silencieuse et
  // ne ressemblait pas à une erreur de lecture. Repéré par Ferry (PR ville #2652), reproduit ici.
  const lines = raw.split(/\r?\n/);
  const meta: Record<string, string> = {};
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length && lines[i]!.trim() !== "---"; i++) {
      const m = /^([A-Za-z_]+):\s*(.*)$/.exec(lines[i]!);
      if (m) meta[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "");
    }
  }

  const moves: HalfMove[] = [];
  let expected = 1;
  for (const line of lines) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const num = Number(cells[0]);
    if (!Number.isInteger(num) || num < 1) continue;
    if (num !== expected) {
      throw new Error(`${name} : le tableau des coups saute du coup ${expected - 1} au coup ${num}`);
    }
    expected = num + 1;
    const w = cells[1]!;
    const b = cells[3] ?? "";
    if (!EMPTY.has(w)) moves.push({ san: w, letter: cells[2] ?? "" });
    if (!EMPTY.has(b)) moves.push({ san: b, letter: cells[4] ?? "" });
  }

  return {
    name,
    white: meta.white ?? "?",
    black: meta.black ?? "?",
    opened: meta.opened ?? "",
    completed: meta.completed ?? "",
    result: meta.result ?? "*",
    moves,
    lines,
  };
}

export type GameCheck =
  | { ok: true; plies: number; toMove: string; status: string; fen: string }
  | { ok: false; label: string; reason: string; fen: string; validated: number };

/** Rejoue une partie depuis le coup 1. Rend le verdict, jamais un jugement sur la qualité. */
export function checkGame(g: Game): GameCheck {
  const r = replay(g.moves.map((m) => m.san));
  if (!r.ok) {
    return {
      ok: false,
      label: `${r.moveNumber}${r.side === "w" ? "." : "..."}${r.san}`,
      reason: r.reason,
      fen: toFen(r.position),
      validated: r.sans.length,
    };
  }
  return {
    ok: true,
    plies: r.sans.length,
    toMove: r.toMove === "w" ? g.white : g.black,
    status: r.status,
    fen: toFen(r.position),
  };
}

// ── Elo ──────────────────────────────────────────────────────────────────────

export const START_RATING = 1200;

/**
 * Le K du club, écrit ici exactement comme il est écrit dans CLUB.md — n'importe qui doit pouvoir
 * refaire le calcul à la main, sinon le classement est un oracle et pas un registre.
 */
export function kFactor(rating: number, played: number): number {
  if (rating > 2400) return 16;
  if (played < 10) return 32;
  return 24;
}

export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export type Standing = { member: string; rating: number; played: number; w: number; d: number; l: number };
export type Ratings = { table: Standing[]; counted: number; ongoing: number };

/**
 * Recalcule tout depuis zéro, dans un ordre déterministe : date d'achèvement, puis nom de fichier.
 * Rien n'est incrémental — un classement qu'on ne peut pas refaire de bout en bout est un
 * classement dont on ne peut pas prouver une seule ligne.
 */
export function rate(games: Game[]): Ratings {
  const done = games
    .filter((g) => g.result !== "*")
    .sort((a, b) => (a.completed || a.opened).localeCompare(b.completed || b.opened) || a.name.localeCompare(b.name));

  const by = new Map<string, Standing>();
  const get = (member: string): Standing => {
    let s = by.get(member);
    if (!s) {
      s = { member, rating: START_RATING, played: 0, w: 0, d: 0, l: 0 };
      by.set(member, s);
    }
    return s;
  };
  // Un joueur d'une partie EN COURS existe au club, à 1200 et 0 partie classée. Le taire ferait
  // croire que le club a moins de membres qu'il n'en a.
  for (const g of games) {
    get(g.white);
    get(g.black);
  }

  for (const g of done) {
    const W = get(g.white);
    const B = get(g.black);
    const sw = g.result === "1-0" ? 1 : g.result === "0-1" ? 0 : 0.5;
    // Les deux K sont lus AVANT la mise à jour : la partie qui fait passer un joueur à 10 est
    // encore comptée à K=32 pour lui. Sinon le même résultat vaudrait deux choses selon l'ordre.
    const kw = kFactor(W.rating, W.played);
    const kb = kFactor(B.rating, B.played);
    const ew = expectedScore(W.rating, B.rating);
    const nw = Math.round(W.rating + kw * (sw - ew));
    const nb = Math.round(B.rating + kb * (1 - sw - (1 - ew)));
    W.rating = nw;
    B.rating = nb;
    W.played++;
    B.played++;
    if (sw === 1) {
      W.w++;
      B.l++;
    } else if (sw === 0) {
      W.l++;
      B.w++;
    } else {
      W.d++;
      B.d++;
    }
  }

  const table = [...by.values()].sort(
    (a, b) => b.rating - a.rating || b.played - a.played || a.member.localeCompare(b.member),
  );
  return { table, counted: done.length, ongoing: games.length - done.length };
}

/** Fewer than 5 rated games — la note existe, elle ne prétend pas mesurer. */
export function isProvisional(s: Standing): boolean {
  return s.played < 5;
}

// ── standings.md ─────────────────────────────────────────────────────────────

/**
 * Rend `standings.md` en entier. Aucune valeur n'y est saisie à la main : c'est toute la garantie
 * qu'offre cette page, et elle le dit d'elle-même en première ligne.
 */
/**
 * ⚠️ `commit` est OPTIONNEL, et c'est une correction du Postmaster (PR ville #2652, 10/09) : la
 * page promettait *« re-run the tool and you get this file back »* en citant un sha de MON dépôt,
 * que personne dans la ville ne peut lire. Une promesse de reproductibilité adossée à une source
 * invisible n'est pas une promesse. Quand le sha n'est pas lisible par le lecteur visé, on ne
 * l'écrit pas : la page renvoie alors à `tools/`, qui est publié à côté d'elle.
 */
/**
 * ⚠️ La page ne porte AUCUNE date de génération, et c'est délibéré.
 *
 * `render` promet au lecteur que relancer l'outil rend le même fichier. Une date prise sur
 * `new Date()` cassait cette promesse **à minuit** : corpus identique, diff le lendemain — et la
 * promesse ne pouvait se vérifier que le jour même. Un test qui ne peut échouer que demain ne
 * protège rien aujourd'hui. (3ᵉ couture signalée par Ferry, PR ville #2652.)
 *
 * La réparation évidente — dériver la date des parties — a été essayée et jetée : la dernière date
 * lisible dans `games/` est une date d'*ouverture* (2026-08-10), alors que la page reflète des
 * coups joués le 07/09. Stable, donc, mais fausse pour le lecteur ; on aurait troqué une promesse
 * cassée contre une affirmation inexacte.
 *
 * Ce qui reste vrai sans condition : la page est une fonction de `games/`. C'est tout ce qu'elle
 * dit désormais. `meta.date` est conservé dans la signature pour les appelants qui veulent dater
 * un rendu ponctuel, mais le rendu ne l'utilise plus.
 */
export function renderStandings(games: Game[], meta: { date?: string; commit?: string | null } = {}): string {
  const { table, counted, ongoing } = rate(games);

  const rows = table.map((s, i) => {
    const prov = isProvisional(s) ? " *(provisional)*" : "";
    return `| ${i + 1} | ${s.member} | ${s.rating}${prov} | ${s.played} | ${s.w}–${s.d}–${s.l} |`;
  });

  const gameRows = games
    .slice()
    .sort((a, b) => (a.opened || "").localeCompare(b.opened || "") || a.name.localeCompare(b.name))
    .map((g) => {
      const c = checkGame(g);
      const state = !c.ok
        ? `**illegal move in record: ${c.label}**`
        : c.status !== "ongoing"
          ? c.status
          : `${c.toMove} to move`;
      const n = Math.ceil(g.moves.length / 2);
      return `| [${g.name.replace(/\.md$/, "")}](games/${g.name}) | ${g.white} | ${g.black} | ${g.opened} | ${n} | ${g.result} | ${state} |`;
    });

  const plural = counted === 1 ? "game" : "games";
  const source = meta.commit ? ` at commit \`${meta.commit}\`` : "";
  return `# Standings — the Slow Table Chess Club

*Generated by \`node tools/cli.ts render\`, from \`games/\`${source}.
Nothing on this page is typed by hand — run the tool in [tools/](tools/) and you get this file back.*

**${counted} rated ${plural}, ${ongoing} still in progress.** With a sample this thin, a rating
here is a starting position and not a verdict. See [CLUB.md](CLUB.md) for the formula, and for
an honest account of how little this table currently measures.

| # | Member | Rating | Rated games | W–D–L |
|---|---|---|---|---|
${rows.join("\n") || "| — | *no members yet* | — | — | — |"}

*(provisional)* = fewer than 5 rated games. Everyone starts at ${START_RATING}.

## Games

| Game | White | Black | Opened | Moves | Result | State |
|---|---|---|---|---|---|---|
${gameRows.join("\n") || "| — | — | — | — | — | — | — |"}
`;
}

// ── add-move ─────────────────────────────────────────────────────────────────

export type AddResult =
  | { ok: true; lines: string[]; san: string; label: string; fen: string; status: string }
  | { ok: false; reason: string; fen: string };

/**
 * Ajoute un demi-coup au tableau — **après** avoir rejoué toute la partie et vérifié la légalité.
 * Si le moteur refuse, rien n'est rendu à écrire et la raison est portée telle quelle.
 *
 * C'est le seul geste du club qui a des dents. Les autres commandes constatent ; celle-ci empêche,
 * et c'est ce qui transforme la règle dure du 20/08 (« rejouer depuis le coup 1 avant de
 * répondre ») en mécanisme plutôt qu'en discipline — donc en quelque chose que je n'oublie pas.
 */
export function addMove(g: Game, san: string, letter: string): AddResult {
  const sans = g.moves.map((m) => m.san);
  const before = replay(sans);
  if (!before.ok) {
    return {
      ok: false,
      reason: `la partie est déjà fautive AVANT ce coup (${before.moveNumber}${before.side === "w" ? "." : "..."}${before.san} : ${before.reason}) — corriger la transcription d'abord`,
      fen: toFen(before.position),
    };
  }
  // Seuls les états TERMINAUX refusent un coup. `check` est l'instant où il faut justement pouvoir
  // jouer, et la répétition comme les cinquante coups se réclament par lettre — voir `isTerminal`.
  if (isTerminal(before.status)) {
    return { ok: false, reason: `cette partie est terminée (${before.status}) : on n'y ajoute pas de coup`, fen: toFen(before.position) };
  }

  const after = replay([...sans, san]);
  if (!after.ok) {
    return {
      ok: false,
      reason: `${after.moveNumber}${after.side === "w" ? "." : "..."}${after.san} : ${after.reason}`,
      fen: toFen(before.position),
    };
  }

  const canonical = after.sans[after.sans.length - 1]!;
  const white = before.position.turn === "w";
  const moveNumber = before.position.fullmove;
  const lines = g.lines.slice();

  if (white) {
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i]!.split("|");
      if (lines[i]!.trimStart().startsWith("|") && Number.isInteger(Number(cells[1]?.trim()))) last = i;
    }
    // Partie neuve, tableau encore vide : on écrit sous la ligne séparatrice `|---|`. Jusqu'au
    // 07/10 aucune partie n'avait été ouverte de mon côté avec les Blancs, et le premier coup
    // était refusé faute de ligne numérotée où s'accrocher.
    if (last === -1) last = lines.findIndex((l) => /^\s*\|\s*:?-{3,}/.test(l));
    if (last === -1) return { ok: false, reason: `${g.name} : aucun tableau de coups où insérer`, fen: toFen(before.position) };
    lines.splice(last + 1, 0, `| ${moveNumber} | ${canonical} | ${letter} |  |  |`);
  } else {
    let done = false;
    for (let i = 0; i < lines.length && !done; i++) {
      const parts = lines[i]!.split("|");
      if (Number(parts[1]?.trim()) !== moveNumber) continue;
      parts[4] = ` ${canonical} `;
      parts[5] = ` ${letter} `;
      lines[i] = parts.join("|");
      done = true;
    }
    if (!done) return { ok: false, reason: `${g.name} : ligne du coup ${moveNumber} introuvable`, fen: toFen(before.position) };
  }

  return {
    ok: true,
    lines,
    san: canonical,
    label: `${moveNumber}${white ? "." : "..."}${canonical}`,
    fen: toFen(after.position),
    status: after.status,
  };
}
