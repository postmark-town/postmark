/**
 * `chess` — l'échiquier partagé que les parties par lettres n'ont pas.
 *
 * POURQUOI CE FICHIER EXISTE (incident du 20/08, memoire/postmark-strategie.md) :
 * une partie par correspondance n'a pas de plateau commun. Chaque camp ne tient que le *texte*
 * des coups précédents, et quand on répond à la prose d'une lettre plutôt qu'à la position,
 * la plausibilité narrative remplace la légalité — sans que personne ne s'en aperçoive.
 * Deux coups réellement impossibles ont ainsi été joués dans la partie contre `rook-of-garrison`
 * (`7.dxe5`, son pion d n'a jamais quitté d2 ; `7...Qxd1`, mon propre cavalier d6 bouche la
 * colonne) et sont restés trois jours au tableau. Ce module est la reconstruction explicite
 * rendue mécanique.
 *
 * CE QU'IL NE FAIT PAS, ET C'EST VOULU : il n'évalue rien, ne suggère rien, ne classe aucun coup
 * comme meilleur qu'un autre. Il n'y a pas de fonction d'évaluation ici et il ne doit pas y en
 * avoir. **La légalité n'est pas la force** : valider un coup n'est pas le choisir. Le refus du
 * moteur d'échecs porte sur la force du choix, jamais sur l'exactitude du plateau (round 2 du
 * 07/08 — préférence assumée, et `rook-of-garrison` lui-même tient le sans-moteur pour l'esprit
 * du jeu).
 *
 * Zéro dépendance, modules natifs Node >= 22.
 */

// ── Représentation ────────────────────────────────────────────────────────────
//
// Une case est un entier 0..63 avec `sq = rang * 8 + colonne` : 0 = a1, 7 = h1, 63 = h8.
// Une pièce est une lettre : majuscule = blancs (`PNBRQK`), minuscule = noirs (`pnbrqk`).
// Une case vide est la chaîne vide.

/** Couleur au trait. */
export type Color = "w" | "b";

/** Type de pièce, en majuscule, indépendant de la couleur. */
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";

/** Droits de roque encore vivants. */
export type Castling = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };

/** Un état complet du jeu — tout ce qu'il faut pour connaître les coups légaux. */
export type Position = {
  /** 64 cases, index 0 = a1. Chaîne vide = case vide. */
  board: string[];
  turn: Color;
  castling: Castling;
  /** Case de prise en passant (la case *traversée* par le pion), ou null. */
  epTarget: number | null;
  /** Demi-coups depuis la dernière prise ou poussée de pion (règle des 50 coups). */
  halfmove: number;
  /** Numéro du coup complet, commence à 1. */
  fullmove: number;
};

/** Un coup concret sur l'échiquier, une fois résolu depuis son SAN. */
export type Move = {
  from: number;
  to: number;
  piece: PieceType;
  color: Color;
  /** Pièce prise (lettre brute), ou chaîne vide. */
  captured: string;
  /** Vrai si c'est une prise en passant (la case d'arrivée est alors vide avant le coup). */
  enPassant: boolean;
  /** Pièce de promotion, ou null. */
  promotion: PieceType | null;
  /** "K" petit roque, "Q" grand roque, ou null. */
  castle: "K" | "Q" | null;
};

/** Les composantes d'un SAN, une fois analysé — avant toute confrontation à la position. */
export type ParsedSan = {
  castle: "K" | "Q" | null;
  piece: PieceType;
  /** Colonne de départ imposée par la désambiguïsation (0..7), ou null. */
  fromFile: number | null;
  /** Rangée de départ imposée par la désambiguïsation (0..7), ou null. */
  fromRank: number | null;
  to: number | null;
  capture: boolean;
  promotion: PieceType | null;
  /** `+` ou `#` annoncé dans le texte. Purement informatif : on ne s'y fie jamais. */
  check: "+" | "#" | null;
};

const FILES = "abcdefgh";

/** État terminal (ou non) d'une position. */
export type GameStatus =
  | "ongoing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "fifty-move";

/**
 * Les seuls états qui ferment une partie **d'eux-mêmes**. Tout le reste laisse le jeu ouvert.
 *
 * Trois catégories vivent dans `GameStatus` et les confondre casse le club :
 * - **terminal** — mat, pat, matériel insuffisant : la partie est finie, personne n'a rien à
 *   déclarer ;
 * - **informatif** — `check` : le roi est attaqué, ce qui est précisément le moment où le joueur
 *   DOIT pouvoir jouer. Traiter ça comme une fin rendait impossible d'enregistrer la sortie
 *   d'échec, donc toute partie mourait au premier échec ;
 * - **réclamable** — triple répétition et règle des cinquante coups : au jeu de correspondance
 *   comme à la pendule, ces deux-là ne s'appliquent que si un joueur les INVOQUE. `CLUB.md` le dit
 *   en toutes lettres pour la répétition (« ends only when a player claims it in a letter ») et ne
 *   nomme pas les cinquante coups comme un résultat automatique. Les proclamer d'office aurait
 *   annulé des parties que personne n'avait demandé d'arrêter.
 *
 * Les trois seams repérées par Ferry (PR ville #2652) tenaient à cette confusion pour deux d'entre
 * elles. Le statut reste rendu tel quel par `statusOf` — c'est une *description*, et c'est ici
 * qu'on décide ce qu'elle autorise.
 */
export function isTerminal(status: GameStatus): boolean {
  return status === "checkmate" || status === "stalemate" || status === "insufficient-material";
}

/** Les états qu'un joueur peut invoquer pour clore la partie, sans que rien ne le fasse à sa place. */
export function isClaimable(status: GameStatus): boolean {
  return status === "threefold-repetition" || status === "fifty-move";
}

// ── Utilitaires de cases ──────────────────────────────────────────────────────

/** `12` → `"e2"`. */
export function squareName(sq: number): string {
  return FILES[sq % 8] + String(Math.floor(sq / 8) + 1);
}

/** `"e2"` → `12`, ou null si le texte n'est pas une case. */
export function squareIndex(name: string): number | null {
  if (name.length !== 2) return null;
  const f = FILES.indexOf(name[0]!);
  const r = Number(name[1]) - 1;
  if (f < 0 || r < 0 || r > 7) return null;
  return r * 8 + f;
}

const fileOf = (sq: number): number => sq % 8;
const rankOf = (sq: number): number => Math.floor(sq / 8);

/** Couleur de la pièce posée sur une case, ou null si la case est vide. */
function colorAt(board: string[], sq: number): Color | null {
  const p = board[sq];
  if (!p) return null;
  return p === p.toUpperCase() ? "w" : "b";
}

const other = (c: Color): Color => (c === "w" ? "b" : "w");

/** Nom français d'une pièce, pour les messages d'erreur — c'est un module qui doit se faire lire. */
const NOMS: Record<PieceType, string> = {
  P: "pion",
  N: "cavalier",
  B: "fou",
  R: "tour",
  Q: "dame",
  K: "roi",
};

const COULEURS: Record<Color, string> = { w: "blanc", b: "noir" };
/** Accord au féminin pour « la tour » / « la dame ». */
const FEMININ: Record<PieceType, boolean> = { P: false, N: false, B: false, R: true, Q: true, K: false };

/** « le fou c1 », « la tour a8 » — le sujet des messages d'erreur. */
function nomme(type: PieceType, sq: number): string {
  return `${FEMININ[type] ? "la" : "le"} ${NOMS[type]} ${squareName(sq)}`;
}

/** « son propre pion », accordé. */
function sonPropre(type: PieceType): string {
  return FEMININ[type] ? `sa propre ${NOMS[type]}` : `son propre ${NOMS[type]}`;
}

// ── Position initiale ─────────────────────────────────────────────────────────

/** La position de départ des échecs. Chaque appel rend un objet neuf : rien n'est partagé. */
export function initialPosition(): Position {
  const board = new Array<string>(64).fill("");
  const back = "RNBQKBNR";
  for (let f = 0; f < 8; f++) {
    board[f] = back[f]!; // rangée 1, blancs
    board[8 + f] = "P"; // rangée 2
    board[48 + f] = "p"; // rangée 7
    board[56 + f] = back[f]!.toLowerCase(); // rangée 8, noirs
  }
  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epTarget: null,
    halfmove: 0,
    fullmove: 1,
  };
}

/** Copie profonde — les positions sont traitées comme immuables par tout le module. */
export function clonePosition(p: Position): Position {
  return {
    board: p.board.slice(),
    turn: p.turn,
    castling: { ...p.castling },
    epTarget: p.epTarget,
    halfmove: p.halfmove,
    fullmove: p.fullmove,
  };
}

/** FEN complet — utile pour dire une position dans une lettre, et pour les tests. */
export function toFen(p: Position): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const piece = p.board[r * 8 + f]!;
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      row += piece;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  const c =
    (p.castling.wK ? "K" : "") +
    (p.castling.wQ ? "Q" : "") +
    (p.castling.bK ? "k" : "") +
    (p.castling.bQ ? "q" : "");
  const ep = p.epTarget === null ? "-" : squareName(p.epTarget);
  return `${rows.join("/")} ${p.turn} ${c || "-"} ${ep} ${p.halfmove} ${p.fullmove}`;
}

// ── Géométrie des pièces ──────────────────────────────────────────────────────

/** Décalages (dcolonne, drangée) des pièces glissantes et du cavalier. */
const DIRS: Record<"B" | "R" | "Q" | "K" | "N", ReadonlyArray<readonly [number, number]>> = {
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  Q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  K: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  N: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
};

const SLIDING: Record<string, boolean> = { B: true, R: true, Q: true };

/** Case atteinte depuis `sq` par un décalage, ou null si on sort de l'échiquier. */
function shift(sq: number, df: number, dr: number): number | null {
  const f = fileOf(sq) + df;
  const r = rankOf(sq) + dr;
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return r * 8 + f;
}

/**
 * `sq` est-elle attaquée par un camp ? Sert au roque, à l'échec, et à la légalité en général.
 * Ne tient pas compte de la prise en passant : aucun roi n'est jamais pris en passant.
 */
export function isAttacked(board: string[], sq: number, by: Color): boolean {
  const up = by === "w";
  // Pions : ils attaquent EN DIAGONALE, dans leur sens de marche.
  const pawnDr = up ? -1 : 1; // on remonte depuis la case attaquée vers l'attaquant
  for (const df of [-1, 1]) {
    const from = shift(sq, df, pawnDr);
    if (from !== null && board[from] === (up ? "P" : "p")) return true;
  }
  // Cavaliers et roi : décalages fixes.
  for (const [df, dr] of DIRS.N) {
    const from = shift(sq, df, dr);
    if (from !== null && board[from] === (up ? "N" : "n")) return true;
  }
  for (const [df, dr] of DIRS.K) {
    const from = shift(sq, df, dr);
    if (from !== null && board[from] === (up ? "K" : "k")) return true;
  }
  // Pièces glissantes : on remonte chaque rayon jusqu'au premier obstacle.
  for (const [type, dirs] of [["B", DIRS.B] as const, ["R", DIRS.R] as const]) {
    const own = up ? type : type.toLowerCase();
    const queen = up ? "Q" : "q";
    for (const [df, dr] of dirs) {
      let cur = shift(sq, df, dr);
      while (cur !== null) {
        const p = board[cur]!;
        if (p) {
          if (p === own || p === queen) return true;
          break;
        }
        cur = shift(cur, df, dr);
      }
    }
  }
  return false;
}

/** Case du roi d'un camp, ou -1 s'il n'y en a pas (positions de test tronquées). */
export function kingSquare(board: string[], color: Color): number {
  const k = color === "w" ? "K" : "k";
  return board.indexOf(k);
}

/** Le camp au trait est-il en échec ? */
export function inCheck(p: Position, color: Color = p.turn): boolean {
  const k = kingSquare(p.board, color);
  if (k < 0) return false;
  return isAttacked(p.board, k, other(color));
}

// ── Génération des coups ──────────────────────────────────────────────────────

function mkMove(o: Partial<Move> & Pick<Move, "from" | "to" | "piece" | "color">): Move {
  return {
    captured: "",
    enPassant: false,
    promotion: null,
    castle: null,
    ...o,
  };
}

const PROMOTIONS: PieceType[] = ["Q", "R", "B", "N"];

/**
 * Coups pseudo-légaux d'UNE pièce : géométrie et obstacles respectés, mais l'auto-échec n'est
 * pas encore filtré. La séparation compte pour les diagnostics — « ce coup existe mais cloue le
 * roi » n'est pas la même erreur que « cette pièce ne peut pas aller là ».
 */
export function pseudoMovesFrom(p: Position, from: number): Move[] {
  const piece = p.board[from]!;
  if (!piece) return [];
  const color = colorAt(p.board, from)!;
  const type = piece.toUpperCase() as PieceType;
  const out: Move[] = [];

  if (type === "P") {
    const dr = color === "w" ? 1 : -1;
    const startRank = color === "w" ? 1 : 6;
    const lastRank = color === "w" ? 7 : 0;
    const one = shift(from, 0, dr);
    if (one !== null && !p.board[one]) {
      if (rankOf(one) === lastRank) {
        for (const promo of PROMOTIONS) out.push(mkMove({ from, to: one, piece: "P", color, promotion: promo }));
      } else {
        out.push(mkMove({ from, to: one, piece: "P", color }));
        // Double poussée : seulement depuis la rangée de départ, et seulement si la case
        // intermédiaire est libre elle aussi.
        if (rankOf(from) === startRank) {
          const two = shift(from, 0, dr * 2);
          if (two !== null && !p.board[two]) out.push(mkMove({ from, to: two, piece: "P", color }));
        }
      }
    }
    for (const df of [-1, 1]) {
      const to = shift(from, df, dr);
      if (to === null) continue;
      const target = p.board[to]!;
      if (target && colorAt(p.board, to) !== color) {
        if (rankOf(to) === lastRank) {
          for (const promo of PROMOTIONS)
            out.push(mkMove({ from, to, piece: "P", color, captured: target, promotion: promo }));
        } else {
          out.push(mkMove({ from, to, piece: "P", color, captured: target }));
        }
      } else if (!target && p.epTarget === to) {
        // Prise en passant : la case d'arrivée est vide, le pion pris est à côté.
        const victim = to - dr * 8;
        out.push(mkMove({ from, to, piece: "P", color, captured: p.board[victim]!, enPassant: true }));
      }
    }
    return out;
  }

  const dirs = DIRS[type as "N" | "B" | "R" | "Q" | "K"];
  for (const [df, dr] of dirs) {
    let cur = shift(from, df, dr);
    while (cur !== null) {
      const target = p.board[cur]!;
      if (target) {
        if (colorAt(p.board, cur) !== color) out.push(mkMove({ from, to: cur, piece: type, color, captured: target }));
        break;
      }
      out.push(mkMove({ from, to: cur, piece: type, color }));
      if (!SLIDING[type]) break;
      cur = shift(cur, df, dr);
    }
  }

  if (type === "K") out.push(...castlingMoves(p, color));
  return out;
}

/**
 * Roques disponibles. Trois conditions distinctes, chacune vérifiée séparément parce que chacune
 * donne un message d'erreur différent : le droit existe-t-il encore, le chemin est-il libre,
 * le roi part-il / traverse-t-il / arrive-t-il sur une case attaquée.
 */
function castlingMoves(p: Position, color: Color): Move[] {
  const out: Move[] = [];
  const home = color === "w" ? 4 : 60; // e1 ou e8
  if (p.board[home] !== (color === "w" ? "K" : "k")) return out;
  if (isAttacked(p.board, home, other(color))) return out; // on ne roque pas en étant en échec
  const rights = color === "w" ? { K: p.castling.wK, Q: p.castling.wQ } : { K: p.castling.bK, Q: p.castling.bQ };
  const rookHome = color === "w" ? { K: 7, Q: 0 } : { K: 63, Q: 56 };
  const rookLetter = color === "w" ? "R" : "r";

  if (rights.K) {
    const [f1, g1] = [home + 1, home + 2];
    if (!p.board[f1] && !p.board[g1] && p.board[rookHome.K] === rookLetter) {
      if (!isAttacked(p.board, f1, other(color)) && !isAttacked(p.board, g1, other(color)))
        out.push(mkMove({ from: home, to: g1, piece: "K", color, castle: "K" }));
    }
  }
  if (rights.Q) {
    const [d1, c1, b1] = [home - 1, home - 2, home - 3];
    if (!p.board[d1] && !p.board[c1] && !p.board[b1] && p.board[rookHome.Q] === rookLetter) {
      // b1/b8 peut être attaquée : le roi n'y passe pas. Seules d et c comptent.
      if (!isAttacked(p.board, d1, other(color)) && !isAttacked(p.board, c1, other(color)))
        out.push(mkMove({ from: home, to: c1, piece: "K", color, castle: "Q" }));
    }
  }
  return out;
}

/** Tous les coups pseudo-légaux du camp au trait. */
export function pseudoMoves(p: Position, color: Color = p.turn): Move[] {
  const out: Move[] = [];
  for (let sq = 0; sq < 64; sq++) {
    if (p.board[sq] && colorAt(p.board, sq) === color) out.push(...pseudoMovesFrom(p, sq));
  }
  return out;
}

/** Applique un coup sans rien vérifier. Interne : passer par `applySan` ou `legalMoves`. */
export function makeMove(p: Position, m: Move): Position {
  const n = clonePosition(p);
  const b = n.board;
  const isWhite = m.color === "w";
  const letter = (t: PieceType): string => (isWhite ? t : t.toLowerCase());

  b[m.from] = "";
  if (m.enPassant) b[m.to - (isWhite ? 1 : -1) * 8] = "";
  b[m.to] = letter(m.promotion ?? m.piece);

  if (m.castle) {
    // La tour suit le roi. Les cases sont fixes : c'est du roque orthodoxe, pas du Chess960.
    const rookFrom = m.castle === "K" ? (isWhite ? 7 : 63) : isWhite ? 0 : 56;
    const rookTo = m.castle === "K" ? m.to - 1 : m.to + 1;
    b[rookFrom] = "";
    b[rookTo] = letter("R");
  }

  // Droits de roque : perdus dès que le roi ou la tour bouge — ou dès que la tour est PRISE
  // sur sa case d'origine, le cas qu'on oublie.
  if (m.piece === "K") {
    if (isWhite) {
      n.castling.wK = false;
      n.castling.wQ = false;
    } else {
      n.castling.bK = false;
      n.castling.bQ = false;
    }
  }
  for (const [sq, key] of [[0, "wQ"], [7, "wK"], [56, "bQ"], [63, "bK"]] as const) {
    if (m.from === sq || m.to === sq) n.castling[key] = false;
  }

  // Prise en passant : la case traversée n'est offerte QUE le coup suivant.
  n.epTarget = null;
  if (m.piece === "P" && Math.abs(rankOf(m.to) - rankOf(m.from)) === 2) {
    n.epTarget = (m.from + m.to) / 2;
  }

  n.halfmove = m.piece === "P" || m.captured ? 0 : n.halfmove + 1;
  if (!isWhite) n.fullmove += 1;
  n.turn = other(m.color);
  return n;
}

/** Les coups VRAIMENT jouables : pseudo-légaux, moins ceux qui laissent son propre roi en échec. */
export function legalMoves(p: Position, color: Color = p.turn): Move[] {
  return pseudoMoves(p, color).filter((m) => {
    const after = makeMove(p, m);
    return !inCheck(after, color);
  });
}

// ── Analyse du SAN ────────────────────────────────────────────────────────────

const SAN_RE =
  /^(?:(O-O-O|0-0-0)|(O-O|0-0)|([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([QRBNqrbn]))?)([+#])?$/;

/**
 * Analyse un SAN en ses composantes. Tolère et ignore les suffixes d'appréciation (`!`, `?`,
 * `!?`, `??`…), les points de suspension d'un coup noir (`15...c5`), les espaces, et les
 * caractères `0` à la place des `O` du roque.
 * Rend null si le texte n'est pas un coup du tout.
 */
export function parseSan(input: string): ParsedSan | null {
  let san = input.trim();
  // « 15. » ou « 15... » collé au coup. Le point est EXIGÉ : sans lui, `0-0` perdrait son
  // premier zéro et le petit roque deviendrait illisible.
  san = san.replace(/^\d+\.+\s*/, "");
  san = san.replace(/[!?]+$/, ""); // appréciations : lues, jetées
  san = san.replace(/[+#]+$/, (m) => m[0]!); // « +!? » déjà nettoyé ; on garde un seul signe
  san = san.replace(/\s+/g, "");
  if (!san) return null;
  const m = SAN_RE.exec(san);
  if (!m) return null;

  const [, longCastle, shortCastle, pieceLetter, fromFile, fromRank, capture, target, promo, check] = m;
  if (longCastle || shortCastle) {
    return {
      castle: longCastle ? "Q" : "K",
      piece: "K",
      fromFile: null,
      fromRank: null,
      to: null,
      capture: false,
      promotion: null,
      check: (check as "+" | "#") ?? null,
    };
  }
  const to = squareIndex(target!);
  if (to === null) return null;
  return {
    castle: null,
    piece: (pieceLetter as PieceType) ?? "P",
    fromFile: fromFile ? FILES.indexOf(fromFile) : null,
    fromRank: fromRank ? Number(fromRank) - 1 : null,
    to,
    capture: Boolean(capture),
    promotion: promo ? (promo.toUpperCase() as PieceType) : null,
    check: (check as "+" | "#") ?? null,
  };
}

/** Les coups légaux compatibles avec un SAN analysé — 0 si illégal, >1 si ambigu. */
function matchLegal(p: Position, parsed: ParsedSan): Move[] {
  return legalMoves(p).filter((m) => {
    if (parsed.castle) return m.castle === parsed.castle;
    if (m.castle) return false;
    if (m.piece !== parsed.piece) return false;
    if (m.to !== parsed.to) return false;
    if (parsed.fromFile !== null && fileOf(m.from) !== parsed.fromFile) return false;
    if (parsed.fromRank !== null && rankOf(m.from) !== parsed.fromRank) return false;
    // Un `x` annoncé sur une case où rien n'est pris est une affirmation FAUSSE sur le plateau —
    // exactement la classe d'erreur pour laquelle ce module existe. On refuse. L'inverse (`Ne5`
    // écrit là où il y a une prise) est toléré : c'est une notation avare, pas un mensonge.
    if (parsed.capture && !m.captured) return false;
    if (parsed.promotion && m.promotion !== parsed.promotion) return false;
    if (!parsed.promotion && m.promotion && m.promotion !== "Q") return false; // « e8 » nu = dame
    return true;
  });
}

/** Rend le SAN canonique d'un coup légal — désambiguïsation minimale, `+`/`#` inclus. */
export function toSan(p: Position, m: Move): string {
  if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
  let s = "";
  if (m.piece === "P") {
    if (m.captured) s += FILES[fileOf(m.from)] + "x";
    s += squareName(m.to);
    if (m.promotion) s += "=" + m.promotion;
  } else {
    s += m.piece;
    // Désambiguïsation : colonne d'abord, rangée ensuite, les deux en dernier recours.
    const rivals = legalMoves(p).filter(
      (o) => o.piece === m.piece && o.to === m.to && o.from !== m.from && !o.castle,
    );
    if (rivals.length) {
      const sameFile = rivals.some((o) => fileOf(o.from) === fileOf(m.from));
      const sameRank = rivals.some((o) => rankOf(o.from) === rankOf(m.from));
      if (!sameFile) s += FILES[fileOf(m.from)];
      else if (!sameRank) s += String(rankOf(m.from) + 1);
      else s += squareName(m.from);
    }
    if (m.captured) s += "x";
    s += squareName(m.to);
  }
  const after = makeMove(p, m);
  if (inCheck(after)) s += legalMoves(after).length === 0 ? "#" : "+";
  return s;
}

// ── Diagnostics : pourquoi ce coup est-il refusé ? ────────────────────────────

/** Première case occupée sur le rayon de `from` vers `to`, si les deux sont alignés. */
function firstBlocker(board: string[], from: number, to: number): number | null {
  const df = Math.sign(fileOf(to) - fileOf(from));
  const dr = Math.sign(rankOf(to) - rankOf(from));
  const alignedDiag = Math.abs(fileOf(to) - fileOf(from)) === Math.abs(rankOf(to) - rankOf(from));
  const alignedLine = fileOf(to) === fileOf(from) || rankOf(to) === rankOf(from);
  if (!alignedDiag && !alignedLine) return null;
  let cur = shift(from, df, dr);
  while (cur !== null && cur !== to) {
    if (board[cur]) return cur;
    cur = shift(cur, df, dr);
  }
  return null;
}

/** Cases voisines occupées par ses propres pièces, sur les rayons d'une pièce glissante. */
function propresBlocages(p: Position, sq: number, type: PieceType, color: Color): number[] {
  const dirs = DIRS[type as "B" | "R" | "Q"] ?? [];
  const out: number[] = [];
  for (const [df, dr] of dirs) {
    const n = shift(sq, df, dr);
    if (n !== null && p.board[n] && colorAt(p.board, n) === color) out.push(n);
  }
  return out;
}

/**
 * La phrase qui explique le refus. C'est le vrai livrable de ce module : un moteur qui dit
 * seulement « illégal » ne sert à rien dans une lettre — il faut pouvoir écrire au voisin
 * *pourquoi*, en une phrase qu'il puisse vérifier sur son propre plateau.
 */
export function explainIllegal(p: Position, parsed: ParsedSan, san: string): string {
  const color = p.turn;
  const camp = color === "w" ? "blanc" : "noir";

  if (parsed.castle) return explainCastle(p, parsed.castle, color);

  const to = parsed.to!;
  const letter = color === "w" ? parsed.piece : parsed.piece.toLowerCase();

  // Les candidats : les pièces du bon type, du bon camp, compatibles avec la désambiguïsation.
  const candidates: number[] = [];
  for (let sq = 0; sq < 64; sq++) {
    if (p.board[sq] !== letter) continue;
    if (parsed.fromFile !== null && fileOf(sq) !== parsed.fromFile) continue;
    if (parsed.fromRank !== null && rankOf(sq) !== parsed.fromRank) continue;
    candidates.push(sq);
  }

  const tousDuType: number[] = [];
  for (let sq = 0; sq < 64; sq++) if (p.board[sq] === letter) tousDuType.push(sq);

  if (candidates.length === 0) {
    if (tousDuType.length === 0)
      return `il n'y a aucun ${NOMS[parsed.piece]} ${camp} sur l'échiquier : ${san} n'a pas d'auteur possible`;
    const où = tousDuType.map((s) => squareName(s)).join(", ");
    if (parsed.piece === "P" && parsed.fromFile !== null)
      return `aucun pion ${camp} de la colonne ${FILES[parsed.fromFile]} ne peut jouer ${san} — les pions ${camp}s sont en ${où}`;
    return `aucun ${NOMS[parsed.piece]} ${camp} ne correspond à la désambiguïsation de ${san} — ${NOMS[parsed.piece]}${tousDuType.length > 1 ? "s" : ""} ${camp}${tousDuType.length > 1 ? "s" : ""} en ${où}`;
  }

  // Cas 1 — la case d'arrivée est occupée par une pièce du même camp.
  if (p.board[to] && colorAt(p.board, to) === color) {
    const occ = p.board[to]!.toUpperCase() as PieceType;
    return `la case ${squareName(to)} est occupée par ${sonPropre(occ)} : ${san} est impossible`;
  }

  // Cas 2 — une prise annoncée sur une case vide, hors prise en passant.
  if (parsed.capture && !p.board[to] && p.epTarget !== to) {
    return `${san} annonce une prise, mais ${squareName(to)} est vide (et aucune prise en passant n'est offerte)`;
  }

  // Cas 3 — un candidat atteint la case, mais le coup laisse son propre roi en échec.
  const pseudo = candidates.flatMap((sq) => pseudoMovesFrom(p, sq)).filter((m) => m.to === to);
  if (pseudo.length > 0) {
    const k = kingSquare(p.board, color);
    const enÉchecAvant = k >= 0 && isAttacked(p.board, k, other(color));
    const m = pseudo[0]!;
    if (enÉchecAvant)
      return `le roi ${camp} est en échec en ${squareName(k)} et ${san} ne pare pas l'échec`;
    return `${san} est géométriquement possible mais laisse le roi ${camp} en échec en ${squareName(k)} : ${nomme(parsed.piece, m.from)} est clouée`;
  }

  // Cas 4 — aucun candidat n'atteint la case. On dit pourquoi, pièce par pièce.
  const raisons: string[] = [];
  for (const sq of candidates) {
    if (parsed.piece === "P") {
      raisons.push(explainPawn(p, sq, to, color, parsed));
      continue;
    }
    // Le cas le plus parlant d'abord : une pièce qui n'a AUCUN coup légal. Dire « son chemin
    // passe par d2 » serait exact mais trop étroit — le fou c1 de Rook n'allait pas seulement
    // pas en e3, il n'allait nulle part. C'est cette phrase-là qu'il faut pouvoir lui écrire.
    const murs = propresBlocages(p, sq, parsed.piece, color);
    if (pseudoMovesFrom(p, sq).length === 0 && murs.length > 0) {
      const nomsMurs = murs
        .map((s) => `${NOMS[p.board[s]!.toUpperCase() as PieceType]} ${squareName(s)}`)
        .join(" et ");
      raisons.push(
        `${nomme(parsed.piece, sq)} est muré par ses propres ${nomsMurs} : il n'a aucun coup légal, ${san} ne peut pas exister`,
      );
      continue;
    }
    const bloc = firstBlocker(p.board, sq, to);
    if (bloc !== null) {
      const bp = p.board[bloc]!.toUpperCase() as PieceType;
      const à = colorAt(p.board, bloc) === color ? sonPropre(bp) : `${FEMININ[bp] ? "la" : "le"} ${NOMS[bp]} adverse`;
      raisons.push(`${nomme(parsed.piece, sq)} ne peut pas atteindre ${squareName(to)} : son chemin passe par ${squareName(bloc)}, occupée par ${à}`);
      continue;
    }
    raisons.push(`${nomme(parsed.piece, sq)} ne va pas en ${squareName(to)} : ce n'est pas un déplacement de ${NOMS[parsed.piece]}`);
  }
  return raisons.join(" ; ");
}

/** Le détail des pions, qui ont quatre façons distinctes de ne pas pouvoir jouer un coup. */
function explainPawn(p: Position, from: number, to: number, color: Color, parsed: ParsedSan): string {
  const dr = color === "w" ? 1 : -1;
  const sameFile = fileOf(from) === fileOf(to);
  const diag = Math.abs(fileOf(to) - fileOf(from)) === 1 && rankOf(to) - rankOf(from) === dr;
  if (diag) {
    return `le pion ${squareName(from)} ne peut pas prendre en ${squareName(to)} : la case est vide et aucune prise en passant n'y est offerte`;
  }
  if (sameFile) {
    const step = shift(from, 0, dr);
    if (step !== null && p.board[step]) {
      const bp = p.board[step]!.toUpperCase() as PieceType;
      const à = colorAt(p.board, step) === color ? sonPropre(bp) : `${FEMININ[bp] ? "la" : "le"} ${NOMS[bp]} adverse`;
      return `le pion ${squareName(from)} est bloqué : ${squareName(step)} est occupée par ${à}`;
    }
    if (rankOf(to) - rankOf(from) === dr * 2)
      return `le pion ${squareName(from)} n'est plus sur sa rangée de départ : il ne peut plus avancer de deux cases`;
    if (p.board[to])
      return `le pion ${squareName(from)} ne prend pas droit devant lui : ${squareName(to)} est occupée`;
    return `le pion ${squareName(from)} ne va pas en ${squareName(to)}`;
  }
  // Le cas de l'incident du 20/08 : `dxe5` alors que le pion d n'a jamais bougé de d2.
  const distance = Math.abs(rankOf(to) - rankOf(from));
  return `le pion ${squareName(from)} ne peut pas ${parsed.capture ? "prendre" : "aller"} en ${squareName(to)} : une prise de pion se fait d'UNE case en diagonale, et il y a ${distance} rangée${distance > 1 ? "s" : ""} d'écart`;
}

/** Les trois façons distinctes de ne pas pouvoir roquer. */
function explainCastle(p: Position, side: "K" | "Q", color: Color): string {
  const camp = color === "w" ? "blanc" : "noir";
  const nom = side === "K" ? "le petit roque" : "le grand roque";
  const home = color === "w" ? 4 : 60;
  if (p.board[home] !== (color === "w" ? "K" : "k"))
    return `${nom} est impossible : le roi ${camp} n'est pas sur sa case d'origine (${squareName(home)})`;
  const right = color === "w" ? (side === "K" ? p.castling.wK : p.castling.wQ) : side === "K" ? p.castling.bK : p.castling.bQ;
  if (!right) return `${nom} ${camp} est perdu : le roi ou la tour concernée a déjà bougé (ou la tour a été prise)`;
  const between = side === "K" ? [home + 1, home + 2] : [home - 1, home - 2, home - 3];
  const occupée = between.find((s) => p.board[s]);
  if (occupée !== undefined) {
    const bp = p.board[occupée]!.toUpperCase() as PieceType;
    return `${nom} est impossible : ${squareName(occupée)} est encore occupée par ${sonPropre(bp)}`;
  }
  if (isAttacked(p.board, home, other(color)))
    return `${nom} est impossible : le roi ${camp} est en échec, et on ne roque pas pour sortir d'un échec`;
  const traversée = (side === "K" ? [home + 1, home + 2] : [home - 1, home - 2]).find((s) =>
    isAttacked(p.board, s, other(color)),
  );
  if (traversée !== undefined)
    return `${nom} est impossible : le roi traverserait ${squareName(traversée)}, qui est attaquée`;
  return `${nom} est impossible dans cette position`;
}

// ── Application d'un coup depuis son texte ───────────────────────────────────

/** Ce que rend `applySan` : le coup joué, ou la raison motivée du refus. */
export type ApplyResult =
  | { ok: true; move: Move; san: string; position: Position }
  | { ok: false; reason: string };

/** Joue un SAN sur une position. N'évalue rien : il dit oui, ou il dit pourquoi non. */
export function applySan(p: Position, san: string): ApplyResult {
  const parsed = parseSan(san);
  if (!parsed) return { ok: false, reason: `« ${san} » n'est pas un coup lisible en notation algébrique` };
  const matches = matchLegal(p, parsed);
  if (matches.length === 1) {
    const m = matches[0]!;
    return { ok: true, move: m, san: toSan(p, m), position: makeMove(p, m) };
  }
  if (matches.length > 1) {
    const où = matches.map((m) => squareName(m.from)).join(", ");
    return {
      ok: false,
      reason: `${san} est ambigu : ${matches.length} pièces peuvent jouer ce coup (${où}). Précisez la colonne ou la rangée de départ.`,
    };
  }
  return { ok: false, reason: explainIllegal(p, parsed, san) };
}

// ── Rejouer une partie entière ───────────────────────────────────────────────

/** Le verdict d'une partie rejouée depuis le coup 1. */
export type ReplayResult =
  | {
      ok: true;
      position: Position;
      /** Les SAN canoniques, tels que le moteur les réécrit. */
      sans: string[];
      status: GameStatus;
      /** Le camp au trait à la fin, si la partie continue. */
      toMove: Color;
    }
  | {
      ok: false;
      /** Numéro du coup complet où ça casse (1 = premier coup blanc). */
      moveNumber: number;
      side: Color;
      /** Le texte du coup refusé, tel qu'il était écrit. */
      san: string;
      reason: string;
      /** La position JUSTE AVANT le coup fautif — celle qu'il faut rendre au correspondant. */
      position: Position;
      /** Les coups validés avant l'erreur. */
      sans: string[];
    };

/**
 * Rejoue une liste de coups depuis la position initiale.
 *
 * C'est la fonction qui rend mécanique la règle dure du 20/08 : *rejouer la partie depuis le
 * coup 1 avant de répondre*. Elle s'arrête au PREMIER coup illégal et le nomme — numéro, camp,
 * texte, raison — plutôt que de continuer sur une position déjà fausse.
 */
export function replay(moves: string[]): ReplayResult {
  let p = initialPosition();
  const sans: string[] = [];
  const seen = new Map<string, number>();
  countPosition(seen, p);

  for (let i = 0; i < moves.length; i++) {
    const raw = moves[i]!;
    const side: Color = p.turn;
    const moveNumber = p.fullmove;
    const res = applySan(p, raw);
    if (!res.ok) {
      return { ok: false, moveNumber, side, san: raw.trim(), reason: res.reason, position: p, sans };
    }
    sans.push(res.san);
    p = res.position;
    countPosition(seen, p);
  }

  return { ok: true, position: p, sans, status: statusOf(p, seen), toMove: p.turn };
}

/**
 * Clé de répétition : pièces, trait, droits de roque, case d'en passant. Pas les compteurs.
 *
 * 🪤 `[14/09]` **La case d'en passant ne compte QUE si la prise est réellement jouable.** Défaut
 * trouvé par HAL, du club, en auditant cet outil sur mon invitation — avec sa reproduction, que
 * j'ai tirée rouge avant d'y toucher :
 *
 * > `1. Nf3 a5 2. Ng1 Nf6 3. Nf3 Ng8 4. Ng1 Nf6 5. Nf3 Ng8`
 *
 * Après `1...a5`, le champ FEN porte `a6` alors qu'aucun pion blanc ne peut prendre là. L'identité
 * de position de la FIDE (9.2.3) ne distingue cette case que si la prise en passant est *possible* :
 * un fantôme ne change aucun coup légal. En découpant la FEN verbatim, une seule position légale se
 * scindait en deux clés — première occurrence sous `a6`, les deux suivantes sous `-` — et la
 * triple répétition passait inaperçue.
 *
 * ⚠️ **Légale, pas géométrique**, et c'est HAL qui a insisté sur le mot : un pion adjacent mais
 * CLOUÉ ne peut pas prendre, donc sa case se normalise aussi en `-`. Le test est donc fait sur
 * `legalMoves`, jamais sur la présence d'un pion à côté.
 */
function repetitionKey(p: Position): string {
  const [pieces, trait, roque, ep] = toFen(p).split(" ");
  const priseReelle = ep !== "-" && legalMoves(p).some((m) => m.enPassant);
  return [pieces, trait, roque, priseReelle ? ep : "-"].join(" ");
}

function countPosition(seen: Map<string, number>, p: Position): void {
  const k = repetitionKey(p);
  seen.set(k, (seen.get(k) ?? 0) + 1);
}

/**
 * Matériel insuffisant, au sens strict de la FIDE (mat *impossible*, pas seulement improbable) :
 * R vs R, R+F vs R, R+C vs R, et R+F vs R+F sur cases de même couleur.
 * Tout le reste est laissé « en cours » — le module ne devine pas.
 */
export function insufficientMaterial(p: Position): boolean {
  const pieces: Array<{ type: PieceType; color: Color; sq: number }> = [];
  for (let sq = 0; sq < 64; sq++) {
    const c = p.board[sq];
    if (!c) continue;
    pieces.push({ type: c.toUpperCase() as PieceType, color: colorAt(p.board, sq)!, sq });
  }
  if (pieces.some((x) => x.type === "P" || x.type === "R" || x.type === "Q")) return false;
  const minors = pieces.filter((x) => x.type === "B" || x.type === "N");
  if (minors.length === 0) return true; // R vs R
  if (minors.length === 1) return true; // R+pièce mineure vs R
  if (minors.length === 2 && minors.every((x) => x.type === "B") && minors[0]!.color !== minors[1]!.color) {
    // Deux fous de camps opposés : nul seulement s'ils sont sur des cases de MÊME couleur.
    const sqColor = (s: number): number => (fileOf(s) + rankOf(s)) % 2;
    return sqColor(minors[0]!.sq) === sqColor(minors[1]!.sq);
  }
  return false;
}

/**
 * L'état d'une position. La répétition triple est comptée pour de vrai (le rejeu part toujours
 * du coup 1, donc l'historique est là et le coût est nul) — elle est *constatée*, pas
 * réclamée : aux échecs c'est un droit qu'un joueur invoque, jamais une fin automatique.
 */
export function statusOf(p: Position, seen?: Map<string, number>): GameStatus {
  const legal = legalMoves(p);
  if (legal.length === 0) return inCheck(p) ? "checkmate" : "stalemate";
  if (insufficientMaterial(p)) return "insufficient-material";
  if (seen && (seen.get(repetitionKey(p)) ?? 0) >= 3) return "threefold-repetition";
  if (p.halfmove >= 100) return "fifty-move";
  return inCheck(p) ? "check" : "ongoing";
}

// ── Lecture d'une liste de coups écrite à la main ─────────────────────────────

/**
 * Extrait les coups d'un texte de partie : « 1.e4 e5 2.Nf3 Nc6 » ou une liste à puces, avec
 * numéros, points de suspension, commentaires entre accolades ou parenthèses, et marqueur de
 * résultat final. Ce qui sort est une suite de SAN nus, dans l'ordre.
 */
export function parseMoveText(text: string): string[] {
  let t = text;
  t = t.replace(/\{[^}]*\}/g, " "); // commentaires PGN
  t = t.replace(/\([^)]*\)/g, " "); // variantes / apartés
  t = t.replace(/^\s*[-*•]\s*/gm, " "); // listes à puces markdown
  t = t.replace(/\$\d+/g, " "); // annotations numériques (NAG)
  const tokens = t.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    const clean = tok.replace(/^\d+\.+/, "").replace(/[,;]$/, "");
    if (!clean) continue;
    if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(clean)) continue;
    if (/^\d+\.*$/.test(clean)) continue; // un numéro de coup isolé
    if (parseSan(clean)) out.push(clean);
  }
  return out;
}

/** Rendu texte d'un échiquier, pour lire une position dans un terminal ou une lettre. */
export function renderBoard(p: Position): string {
  const lines: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let line = `${r + 1} `;
    for (let f = 0; f < 8; f++) line += (p.board[r * 8 + f] || ".") + " ";
    lines.push(line.trimEnd());
  }
  lines.push("  a b c d e f g h");
  return lines.join("\n");
}
