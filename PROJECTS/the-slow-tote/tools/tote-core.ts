/**
 * tote — la banque de paris de Postmark (pari mutuel pur, en stamps).
 *
 * Ce module ne fait que LIRE et CALCULER : il n'écrit aucune lettre, n'ouvre aucun pari, ne touche
 * aucun réseau. Il est volontairement SANS dépendance hors `node:crypto`, pour qu'une copie
 * byte-identique (`postmark/the-slow-tote/tools/tote-core.ts`) puisse être lancée par n'importe quel
 * résident depuis un clone de la ville (un test garde les deux copies identiques).
 *
 * LA LOI (décidée, pas rouverte)
 *  - Pari mutuel : les gagnants se partagent toute la cagnotte au prorata de leurs mises. Commission 0.
 *    La banque ne parie jamais et ne garde rien.
 *  - Miser = une lettre à la banque avec `pays: N`, `market: <id>` et soit `pick: <issue>` (ouvert),
 *    soit `commit: sha256(<issue>:<sel>:<handle>)` (scellé ; révélé par une lettre `reveal: <id de la
 *    lettre de mise>` + `issue:` + `sel:`, livrée APRÈS la clôture et au plus tard `reveals_by`).
 *  - Une mise ne compte que si la ligne de transfert existe dans le grand livre des stamps.
 *  - Clôture : la ville ne publie que des DATES (pas d'heure de crossing) dans ses grands livres. Un
 *    marché se clôt donc à une date : un transfert daté ≤ `closes` compte, daté après = remboursé.
 *  - Annulé / sans gagnant / source ambiguë = tout le monde remboursé. Non révélé à temps = remboursé
 *    sans gain (la mise sort de la cagnotte).
 *  - Arrondis : parts entières, plus grand reste d'abord (méthode du plus fort reste) entre les
 *    GAGNANTS ; à égalité, la mise la plus ancienne dans le grand livre. Toute la cagnotte est
 *    distribuée, la banque ne garde pas une miette.
 *  - Jamais de marché sur un vote ; un joueur et son foyer ne parient pas sur leur propre partie.
 *
 * LE LIVRE (book) : JSONL chaîné, chaque ligne = sha256(précédente + JSON canonique de ses champs).
 * Il est ajout-seul : `auditBook` accepte tout livre dont la chaîne tient et dont chaque ligne est
 * ré-dérivable de zéro depuis le grand livre ; les lignes dérivables mais pas encore publiées sont
 * « en retard » (à ajouter), jamais une raison de réécrire l'histoire.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const BANK_DEFAULT = "lupi";
const GENESIS = "slow-tote-v1";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;
const FORBIDDEN_VOTE_RE = /\b(vote|votes|voting|ballot|ballots|poll|election|referendum)\b/i;
/** Les seules natures de source acceptées : un fait public, jamais une décision de la ville. */
export const SOURCE_KINDS = ["game-result", "engine-verdict", "town-metric"] as const;

// ---------------------------------------------------------------------------------------- lecture

export interface Transfer { line: number; date: string; from: string; to: string; n: number; letter: string }
export interface Void { line: number; date: string; letter: string; from: string; to: string; n: number; reason: string }
export interface Ledger { transfers: Transfer[]; voids: Void[]; lines: number; /** meeps de la dernière ligne `rules:` */ meeps?: string[] }

/** Lit `WHITE_PAGES/stamp-ledger.md`. Seules les lignes de transfert par lettre et leurs `void` comptent. */
export function parseLedger(text: string): Ledger {
  const transfers: Transfer[] = [];
  const voids: Void[] = [];
  const lines = text.split("\n");
  const tr = /^- (\d{4}-\d{2}-\d{2}) · ([a-z0-9][a-z0-9._-]*) → ([a-z0-9][a-z0-9._-]*) · (\d+) · via: mail:(\S+) · sig: /;
  const vd = /^- (\d{4}-\d{2}-\d{2}) · void · mail:(\S+) · from (\S+) to (\S+) · (\d+) · (.+?) · sig: /;
  lines.forEach((l, i) => {
    let m = tr.exec(l);
    if (m) transfers.push({ line: i + 1, date: m[1], from: m[2], to: m[3], n: Number(m[4]), letter: m[5] });
    else if ((m = vd.exec(l))) voids.push({ line: i + 1, date: m[1], letter: m[2], from: m[3], to: m[4], n: Number(m[5]), reason: m[6] });
  });
  const rules = [...text.matchAll(/^- \d{4}-\d{2}-\d{2} · rules: \S+ · meeps: (\S+)/gm)].pop();
  return { transfers, voids, lines: lines.length, meeps: rules ? rules[1].split(",") : [] };
}

export interface Delivery { date: string; line: number; from: string; to: string }
/** Lit `WHITE_PAGES/mail-ledger.md` : id de lettre → date de livraison. */
export function parseMailLedger(text: string): Map<string, Delivery> {
  const out = new Map<string, Delivery>();
  const re = /^- (\d{4}-\d{2}-\d{2}) · (\S+) · ([a-z0-9][a-z0-9._-]*) → ([a-z0-9][a-z0-9._-]*)/;
  text.split("\n").forEach((l, i) => {
    const m = re.exec(l);
    if (m && m[2] !== "BOUNCE" && !out.has(m[2])) out.set(m[2], { date: m[1], line: i + 1, from: m[3], to: m[4] });
  });
  return out;
}

export interface Letter {
  id: string; from: string; to: string;
  pays?: number; market?: string; pick?: string; commit?: string;
  reveal?: string; issue?: string; sel?: string;
  tote?: string; settles?: string[];
}

export function parseLetter(text: string): Letter | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const l of m[1].split("\n")) {
    const k = /^([A-Za-z_-]+):\s*(.*)$/.exec(l.trim());
    if (k) fm[k[1].toLowerCase()] = k[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!fm.id || !fm.from || !fm.to) return null;
  const letter: Letter = { id: fm.id, from: fm.from, to: fm.to };
  if (fm.pays && /^\d+$/.test(fm.pays)) letter.pays = Number(fm.pays);
  for (const k of ["market", "pick", "commit", "reveal", "issue", "sel", "tote"] as const) if (fm[k]) letter[k] = fm[k];
  if (fm.settles) letter.settles = fm.settles.split(",").map((s) => s.trim()).filter(Boolean);
  return letter;
}

// ---------------------------------------------------------------------------------------- marchés

export interface Market {
  id: string;
  question: string;
  issues: string[];
  opens: string;
  /** Dernière DATE de grand livre où une mise compte (incluse). */
  closes: string;
  /** Dernière date de livraison d'une lettre `reveal:` (incluse). Défaut : closes + 2 jours. */
  reveals_by?: string;
  source: { kind: (typeof SOURCE_KINDS)[number]; ref: string; rule: string };
  cancels_if: string;
  /** Handles des joueurs de l'épreuve (eux et leur foyer ne parient pas). */
  parties: string[];
  resolution?: { outcome: string; evidence: string; date: string };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const revealsBy = (m: Market): string => m.reveals_by ?? addDays(m.closes, 2);

/** Les défauts d'un marché avant ouverture. Liste vide = ouvrable. */
export function validateMarket(m: Market): string[] {
  const bad: string[] = [];
  if (!m.id || !SLUG_RE.test(m.id)) bad.push("id : slug minuscule de 3 à 61 caractères");
  if (!m.question?.trim()) bad.push("question absente");
  if (!Array.isArray(m.issues) || m.issues.length < 2) bad.push("au moins 2 issues");
  else {
    if (new Set(m.issues).size !== m.issues.length) bad.push("issues en double");
    for (const i of m.issues) if (!i || /[:\s]/.test(i)) bad.push(`issue « ${i} » : ni espace ni deux-points (le scellé les sépare par « : »)`);
  }
  if (!DATE_RE.test(m.opens ?? "")) bad.push("opens : AAAA-MM-JJ");
  if (!DATE_RE.test(m.closes ?? "")) bad.push("closes : AAAA-MM-JJ");
  else if (DATE_RE.test(m.opens ?? "") && m.closes <= m.opens) bad.push("closes doit suivre opens");
  if (m.reveals_by !== undefined && (!DATE_RE.test(m.reveals_by) || m.reveals_by <= m.closes)) bad.push("reveals_by doit suivre closes");
  if (!m.source || !(SOURCE_KINDS as readonly string[]).includes(m.source.kind)) bad.push(`source.kind ∈ ${SOURCE_KINDS.join(" | ")} (jamais un vote de la ville)`);
  else {
    if (!m.source.ref?.trim()) bad.push("source.ref : où lire le résultat dans le registre public");
    if (!m.source.rule?.trim()) bad.push("source.rule : comment le résultat devient une issue");
  }
  if (!m.cancels_if?.trim()) bad.push("cancels_if absent : ce qui annule le marché");
  const text = [m.question, ...(m.issues ?? []), m.source?.ref, m.source?.rule].join(" ");
  if (FORBIDDEN_VOTE_RE.test(text)) bad.push("le marché parle d'un vote : interdit (la richesse n'achète pas la décision)");
  if (!Array.isArray(m.parties) || m.parties.some((p) => !HANDLE_RE.test(p))) bad.push("parties : liste de handles");
  if (m.resolution && Array.isArray(m.issues) && !["cancelled", "ambiguous", ...m.issues].includes(m.resolution.outcome)) {
    bad.push(`resolution.outcome « ${m.resolution.outcome} » : une issue du marché, cancelled ou ambiguous`);
  }
  return bad;
}

// ---------------------------------------------------------------------------------------- les mises

export interface World {
  bank: string;
  ledger: Ledger;
  mail: Map<string, Delivery>;
  letters: Map<string, Letter>;
  /** foyer d'un handle (ou le handle lui-même s'il est inconnu). */
  householdOf: (handle: string) => string;
  meeps: Set<string>;
  /** date du jour (UTC) : décide si la clôture et la fenêtre de révélation sont passées. */
  asof: string;
}

export type Reason =
  | "late" | "early" | "no-pick" | "pick-and-commit" | "unknown-issue" | "own-game" | "meep" | "bank-bet" | "zero-stake"
  | "unrevealed" | "cancelled" | "no-winner" | "no-letter" | "other-market";

/** Une chose que le grand livre dit et que la loi ne prévoit pas : l'audit rougit, personne n'est payé sur cette base. */
export interface Anomaly { kind: "duplicate-transfer" | "payment-amount" | "payment-recipient" | "payment-unknown-bet" | "payment-twice" | "bad-resolution"; letter?: string; detail: string }

/**
 * Les transferts qui comptent : ni annulés par la ville (un `void` sur la même lettre, mêmes parties), ni en double.
 * Un même id de lettre ne porte qu'UN transfert : le premier (ordre du grand livre) compte, les suivants sont des
 * anomalies (le pot ne grossit pas, et rien n'est remboursé automatiquement : à régler à la main).
 */
export function liveTransfers(w: World): { live: Transfer[]; duplicates: Transfer[] } {
  const voided = new Set(w.ledger.voids.map((v) => `${v.letter}|${v.from}|${v.to}`));
  const seen = new Set<string>();
  const live: Transfer[] = [];
  const duplicates: Transfer[] = [];
  for (const t of w.ledger.transfers) {
    if (voided.has(`${t.letter}|${t.from}|${t.to}`)) continue;
    if (seen.has(t.letter)) { if (t.from === w.bank || t.to === w.bank) duplicates.push(t); continue; }
    seen.add(t.letter);
    live.push(t);
  }
  return { live, duplicates };
}

export interface Bet {
  letter: string; bettor: string; stake: number; line: number; date: string;
  sealed: boolean;
  /** issue choisie (ouverte, ou révélée). Absente pour un scellé non encore révélé. */
  issue?: string;
  reveal?: { letter: string; date: string };
  /** `live` compte dans la cagnotte ; `pending` : scellé, révélation encore possible ; `refused` : remboursé. */
  status: "live" | "pending" | "refused";
  reason?: Reason;
}

export const commitFor = (issue: string, sel: string, handle: string): string =>
  createHash("sha256").update(`${issue}:${sel}:${handle}`).digest("hex");

export interface Orphan { letter: string; from: string; n: number; line: number; date: string; reason: "no-letter" | "other-market" }

/** Toutes les mises d'un marché, dans l'ordre du grand livre, avec leur statut. */
export function readBets(m: Market, w: World): Bet[] {
  const bets: Bet[] = [];
  const byHousehold = new Set(m.parties.map((p) => w.householdOf(p)));
  const rb = revealsBy(m);
  const reveals = [...w.letters.values()].filter((l) => l.reveal && l.to === w.bank);
  for (const t of liveTransfers(w).live) {
    if (t.to !== w.bank) continue;
    const l = w.letters.get(t.letter);
    if (!l || l.market !== m.id) continue;
    const b: Bet = { letter: t.letter, bettor: t.from, stake: t.n, line: t.line, date: t.date, sealed: false, status: "live" };
    const refuse = (reason: Reason) => { b.status = "refused"; b.reason = reason; };
    if (t.n < 1) refuse("zero-stake");
    else if (l.pick && l.commit) { b.sealed = false; refuse("pick-and-commit"); }
    else if (!l.pick && !l.commit) refuse("no-pick");
    else if (l.pick) {
      b.issue = l.pick;
      if (!m.issues.includes(l.pick)) refuse("unknown-issue");
    } else b.sealed = true;
    if (b.status !== "refused") {
      if (t.from === w.bank) refuse("bank-bet");
      else if (w.meeps.has(t.from)) refuse("meep");
      else if (m.parties.includes(t.from) || byHousehold.has(w.householdOf(t.from))) refuse("own-game");
      else if (t.date < m.opens) refuse("early");
      else if (t.date > m.closes) refuse("late");
    }
    if (b.status !== "refused" && b.sealed) {
      // La première révélation valable (ordre de livraison) l'emporte.
      const valid = reveals
        .filter((r) => r.reveal === t.letter && r.from === t.from && r.issue && r.sel !== undefined)
        .map((r) => ({ r, d: w.mail.get(r.id) }))
        .filter((x): x is { r: Letter; d: Delivery } => !!x.d && x.d.date > m.closes && x.d.date <= rb)
        .filter((x) => m.issues.includes(x.r.issue!) && commitFor(x.r.issue!, x.r.sel!, t.from) === l.commit)
        .sort((a, c) => a.d.date.localeCompare(c.d.date) || a.d.line - c.d.line);
      if (valid.length) {
        b.issue = valid[0].r.issue;
        b.reveal = { letter: valid[0].r.id, date: valid[0].d.date };
      } else if (w.asof > rb) refuse("unrevealed");
      else b.status = "pending";
    }
    bets.push(b);
  }
  return bets;
}

/** Les transferts à la banque sans lettre ou vers un marché inconnu (à rembourser à la main). */
export function findOrphans(markets: Market[], w: World): Orphan[] {
  const known = new Set(markets.map((m) => m.id));
  const out: Orphan[] = [];
  for (const t of liveTransfers(w).live) {
    if (t.to !== w.bank) continue;
    const l = w.letters.get(t.letter);
    if (!l) out.push({ letter: t.letter, from: t.from, n: t.n, line: t.line, date: t.date, reason: "no-letter" });
    else if (!l.market || !known.has(l.market)) out.push({ letter: t.letter, from: t.from, n: t.n, line: t.line, date: t.date, reason: "other-market" });
  }
  return out;
}

// ---------------------------------------------------------------------------------------- état et règlement

export type Phase = "not-open" | "open" | "revealing" | "resolvable" | "resolved" | "cancelled";

export interface Due { to: string; amount: number; kind: "payout" | "refund"; bets: string[]; reason?: Reason }

export interface MarketState {
  market: Market;
  phase: Phase;
  bets: Bet[];
  pools: Record<string, number>;
  /** somme des mises vivantes (la cagnotte). */
  pot: number;
  /** mises scellées dont la révélation est encore possible. */
  pending: number;
  dues: Due[];
  /** résolution écrite que la loi ne reconnaît pas (issue mal orthographiée) : ignorée, le marché reste non résolu. */
  error?: string;
}

/** Part entière de chacun : plus fort reste d'abord, à égalité la mise la plus ancienne. */
export function splitPool(pot: number, winners: { id: string; stake: number; line: number }[]): Map<string, number> {
  const W = winners.reduce((s, x) => s + x.stake, 0);
  if (!(W > 0)) throw new Error("splitPool : les mises gagnantes totalisent 0, rien à partager");
  const out = new Map<string, number>();
  const rem: { id: string; r: number; line: number }[] = [];
  let given = 0;
  for (const x of winners) {
    const share = Math.floor((x.stake * pot) / W);
    out.set(x.id, share);
    given += share;
    rem.push({ id: x.id, r: (x.stake * pot) % W, line: x.line });
  }
  rem.sort((a, b) => b.r - a.r || a.line - b.line);
  for (let i = 0; i < pot - given; i++) out.set(rem[i].id, out.get(rem[i].id)! + 1);
  return out;
}

function addDue(dues: Due[], to: string, amount: number, kind: Due["kind"], bet: string, reason?: Reason): void {
  const hit = dues.find((d) => d.to === to && d.kind === kind && d.reason === reason);
  if (hit) { hit.amount += amount; hit.bets.push(bet); } else dues.push({ to, amount, kind, bets: [bet], reason });
}

export function marketState(m: Market, w: World): MarketState {
  const bets = readBets(m, w);
  const live = bets.filter((b) => b.status === "live");
  const pools: Record<string, number> = Object.fromEntries(m.issues.map((i) => [i, 0]));
  for (const b of live) pools[b.issue!] += b.stake;
  const pot = live.reduce((s, b) => s + b.stake, 0);
  const pending = bets.filter((b) => b.status === "pending").reduce((s, b) => s + b.stake, 0);
  const dues: Due[] = [];
  // Ce qui est dû quoi qu'il arrive : les mises refusées (tardives, interdites, non révélées…).
  for (const b of bets) if (b.status === "refused" && b.stake > 0) addDue(dues, b.bettor, b.stake, "refund", b.letter, b.reason);
  let phase: Phase;
  if (w.asof < m.opens) phase = "not-open";
  else if (w.asof <= m.closes) phase = "open";
  else if (bets.some((b) => b.status === "pending")) phase = "revealing";
  else phase = "resolvable";
  const r = m.resolution;
  let error: string | undefined;
  if (r && r.outcome !== "cancelled" && r.outcome !== "ambiguous" && !m.issues.includes(r.outcome)) {
    // Une faute de frappe n'est pas une annulation : tout rembourser en silence serait décider à la place de la source.
    error = `résolution « ${r.outcome} » : ni une issue du marché (${m.issues.join(", ")}) ni cancelled | ambiguous. Ignorée.`;
  }
  if (r && !error) {
    const cancelled = r.outcome === "cancelled" || r.outcome === "ambiguous";
    // Une annulation vaut à tout moment depuis l'ouverture (mises scellées en attente comprises) ; un
    // résultat seulement une fois tout révélé ou la fenêtre passée. Écrit trop tôt, il n'est pas appliqué.
    if (phase === "not-open" || (!cancelled && (phase === "revealing" || phase === "open"))) {
      // le marché reste ce qu'il est.
    } else {
      const winners = live.filter((b) => b.issue === r.outcome);
      if (cancelled || winners.length === 0) {
        const why: Reason = cancelled ? "cancelled" : "no-winner";
        for (const b of bets) if (b.status !== "refused") addDue(dues, b.bettor, b.stake, "refund", b.letter, why);
        phase = "cancelled";
      } else {
        const shares = splitPool(pot, winners.map((b) => ({ id: b.letter, stake: b.stake, line: b.line })));
        for (const b of winners) addDue(dues, b.bettor, shares.get(b.letter)!, "payout", b.letter);
        phase = "resolved";
      }
    }
  }
  return { market: m, phase, bets, pools, pot, pending, dues, ...(error ? { error } : {}) };
}

/** Peut-on écrire la résolution ? Raison du refus, ou null. */
export function cannotResolve(m: Market, w: World, outcome: string): string | null {
  if (m.resolution) return "déjà résolu";
  if (outcome !== "cancelled" && outcome !== "ambiguous" && !m.issues.includes(outcome)) return `issue inconnue « ${outcome} » (issues : ${m.issues.join(", ")} ; ou cancelled | ambiguous)`;
  if (outcome === "cancelled" || outcome === "ambiguous") return w.asof < m.opens ? "pas ouvert : rien à annuler" : null;
  if (w.asof <= m.closes) return `pas clos : la clôture est ${m.closes} inclus, on résout à partir du ${addDays(m.closes, 1)}`;
  if (w.asof <= revealsBy(m) && marketState(m, w).pending > 0) return `des mises scellées peuvent encore être révélées jusqu'au ${revealsBy(m)} inclus`;
  return null;
}

// ---------------------------------------------------------------------------------------- paiements

export interface PaidInfo {
  /** ids de lettres de mise dont le remboursement ou le gain a été confirmé dans le grand livre. */
  paid: Map<string, { ledgerLine: number; letter: string; amount: number }>;
  voided: { letter: string; reason: string }[];
  /** ce que le grand livre a déjà versé, mise par mise, y compris par des paiements partiels qu'un second complète. */
  credited: Map<string, number>;
  /** paiements que le grand livre contredit (mauvais montant, mauvais destinataire, mise inconnue, double règlement). Jamais comptés payés. */
  anomalies: Anomaly[];
}

/** Ce que la loi doit à chaque mise, une par une : destinataire, montant exact, nature. Vide tant que rien n'est réglé ni refusé. */
export function expectedPerBet(st: MarketState): Map<string, { to: string; amount: number; kind: Due["kind"] }> {
  const exp = new Map<string, { to: string; amount: number; kind: Due["kind"] }>();
  for (const b of st.bets) if (b.status === "refused" && b.stake > 0) exp.set(b.letter, { to: b.bettor, amount: b.stake, kind: "refund" });
  const r = st.market.resolution;
  if (st.phase === "cancelled") {
    for (const b of st.bets) if (b.status !== "refused") exp.set(b.letter, { to: b.bettor, amount: b.stake, kind: "refund" });
  } else if (st.phase === "resolved" && r) {
    const winners = st.bets.filter((b) => b.status === "live" && b.issue === r.outcome);
    const shares = splitPool(st.pot, winners.map((b) => ({ id: b.letter, stake: b.stake, line: b.line })));
    for (const b of winners) exp.set(b.letter, { to: b.bettor, amount: shares.get(b.letter)!, kind: "payout" });
  }
  return exp;
}

/**
 * Lit ce que la banque a déjà payé : ses lettres `tote:` + `settles:` et leur transfert (ou leur void).
 * Un transfert compte s'il va au bon destinataire et ne dépasse pas ce qui reste dû sur les mises qu'il règle.
 * Plusieurs lettres peuvent régler la même mise (un solde après un versement trop court) : on additionne, et la
 * mise est payée quand la somme égale la dette. Un versement trop court que personne ne complète reste une
 * anomalie (l'audit rougit) ; un dépassement n'est jamais compté.
 */
export function readPayments(st: MarketState, w: World): PaidInfo {
  const paid: PaidInfo["paid"] = new Map();
  const voided: PaidInfo["voided"] = [];
  const anomalies: Anomaly[] = [];
  const credited: PaidInfo["credited"] = new Map();
  const partials: { letter: string; bets: string[]; detail: string }[] = [];
  const exp = expectedPerBet(st);
  const byLetter = new Map(liveTransfers(w).live.filter((t) => t.from === w.bank).map((t) => [t.letter, t]));
  const cands = [...w.letters.values()].filter((l) => l.from === w.bank && l.tote === st.market.id && l.settles);
  // Ordre du grand livre : le premier règlement valable d'une mise l'emporte, un second est un trop-payé.
  cands.sort((a, b) => (byLetter.get(a.id)?.line ?? Infinity) - (byLetter.get(b.id)?.line ?? Infinity) || (a.id < b.id ? -1 : 1));
  for (const l of cands) {
    const t = byLetter.get(l.id);
    if (!t) {
      const v = w.ledger.voids.find((x) => x.letter === l.id);
      if (v) voided.push({ letter: l.id, reason: v.reason });
      continue;
    }
    const unknown = l.settles!.filter((s) => !exp.has(s));
    if (unknown.length) {
      anomalies.push({ kind: "payment-unknown-bet", letter: l.id, detail: `${l.id} (ligne ${t.line}) règle ${unknown.join(", ")}, dont la loi ne doit rien (mise inconnue, perdante ou marché non réglé)` });
      continue;
    }
    // Refusé seulement si TOUTES les mises nommées sont déjà payées : un solde écrit avec les mises d'origine
    // (noe, 25/10) règle ce qui reste ouvert ; le déjà-payé n'absorbe rien, `left` le compte à 0.
    const twice = l.settles!.filter((s) => paid.has(s));
    if (twice.length === l.settles!.length) {
      anomalies.push({ kind: "payment-twice", letter: l.id, detail: `${l.id} (ligne ${t.line}) règle ${twice.join(", ")}, déjà réglée par ${paid.get(twice[0])!.letter}` });
      continue;
    }
    const recipients = new Set(l.settles!.map((s) => exp.get(s)!.to));
    if (recipients.size !== 1 || !recipients.has(t.to)) {
      anomalies.push({ kind: "payment-recipient", letter: l.id, detail: `${l.id} (ligne ${t.line}) paie ${t.to}, la loi doit à ${[...recipients].join(" et ")}` });
      continue;
    }
    const left = l.settles!.reduce((sum, id) => sum + exp.get(id)!.amount - (credited.get(id) ?? 0), 0);
    if (t.n > left) {
      anomalies.push({ kind: "payment-amount", letter: l.id, detail: `${l.id} (ligne ${t.line}) paie ${t.n} à ${t.to}, la loi ne doit plus que ${left}` });
      continue;
    }
    let give = t.n;
    for (const s of l.settles!) {
      const take = Math.min(give, exp.get(s)!.amount - (credited.get(s) ?? 0));
      credited.set(s, (credited.get(s) ?? 0) + take);
      give -= take;
    }
    if (t.n < left) partials.push({ letter: l.id, bets: l.settles!, detail: `${l.id} (ligne ${t.line}) paie ${t.n} à ${t.to}, la loi devait encore ${left}` });
    for (const s of l.settles!) if (credited.get(s) === exp.get(s)!.amount && !paid.has(s)) paid.set(s, { ledgerLine: t.line, letter: l.id, amount: t.n });
  }
  // Un versement court que rien n'a complété : la dette reste ouverte et l'audit le dit.
  for (const p of partials) if (p.bets.some((b) => !paid.has(b))) anomalies.push({ kind: "payment-amount", letter: p.letter, detail: p.detail });
  return { paid, voided, credited, anomalies };
}

export interface Payment { to: string; amount: number; kind: Due["kind"]; settles: string[]; why: string }

/** Ce qu'il reste à payer : les dettes dont toutes les mises ne sont pas déjà confirmées payées. */
export function outstanding(st: MarketState, paid: PaidInfo): Payment[] {
  const out: Payment[] = [];
  for (const d of st.dues) {
    const rest = d.bets.filter((id) => !paid.paid.has(id));
    if (rest.length === 0) continue;
    const part = rest.reduce((sum, id) => sum + (paid.credited.get(id) ?? 0), 0);
    const amount = d.bets.length === rest.length && part === 0 ? d.amount : amountFor(st, d, rest) - part;
    out.push({ to: d.to, amount, kind: d.kind, settles: rest, why: d.reason ?? (d.kind === "payout" ? "win" : "refund") });
  }
  return out;
}

function amountFor(st: MarketState, d: Due, rest: string[]): number {
  if (d.kind === "refund") return st.bets.filter((b) => rest.includes(b.letter)).reduce((s, b) => s + b.stake, 0);
  const r = st.market.resolution!;
  const live = st.bets.filter((b) => b.status === "live" && b.issue === r.outcome);
  const shares = splitPool(st.pot, live.map((b) => ({ id: b.letter, stake: b.stake, line: b.line })));
  return rest.reduce((s, id) => s + (shares.get(id) ?? 0), 0);
}

export function paymentLetterId(bank: string, date: string, p: Payment, marketId: string): string {
  const tag = createHash("sha256").update([...p.settles].sort().join(",")).digest("hex").slice(0, 6);
  return `${bank}-${date}-to-${p.to}-tote-${marketId}-${p.kind}-${tag}`;
}

/** Corps d'une lettre `pays:` (frontmatter + texte court et vérifiable). */
export function renderPaymentLetter(bank: string, date: string, marketId: string, p: Payment, st: MarketState): string {
  const id = paymentLetterId(bank, date, p, marketId);
  const sentence = p.kind === "payout"
    ? `Your winning stake${p.settles.length > 1 ? "s" : ""} on market ${marketId} (outcome: ${st.market.resolution?.outcome}) pay${p.settles.length > 1 ? "" : "s"} ${p.amount} from a pot of ${st.pot}.`
    : `Your stake${p.settles.length > 1 ? "s" : ""} on market ${marketId} come${p.settles.length > 1 ? "" : "s"} back whole: ${p.amount} (${p.why}).`;
  return `---\nid: ${id}\nfrom: ${bank}\nto: ${p.to}\ndate: ${date}\npays: ${p.amount}\ntote: ${marketId}\nsettles: ${p.settles.join(",")}\n---\n\n${sentence}\n\nThe pot, the bets and the shares are in the public book, the-slow-tote/book/book.jsonl, which is recomputed from the stamp ledger by\n\`node tools/audit.ts --town <clone of the town>\` (inside the-slow-tote/). The bank keeps nothing.\n`;
}

// ---------------------------------------------------------------------------------------- le livre chaîné

export interface BookEvent {
  type: "market" | "bet" | "refused" | "reveal" | "resolution" | "due" | "paid";
  market: string;
  [k: string]: unknown;
}
export interface BookLine extends BookEvent { seq: number; prev: string; hash: string }

const canon = (o: unknown): string => JSON.stringify(o, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
export const genesisHash = (): string => sha(GENESIS);
const eventKey = (e: BookEvent): string => canon(e);

/** Tous les évènements ré-dérivables d'un marché, dans un ordre déterministe (date puis rang). */
export function deriveEvents(m: Market, w: World): { e: BookEvent; at: string; rank: number; line: number }[] {
  const st = marketState(m, w);
  const out: { e: BookEvent; at: string; rank: number; line: number }[] = [];
  const mdef = { ...m, resolution: undefined };
  out.push({ e: { type: "market", market: m.id, def_sha256: sha(canon(mdef)) }, at: m.opens, rank: 0, line: 0 });
  for (const b of st.bets) {
    if (b.status === "refused") {
      out.push({ e: { type: "refused", market: m.id, letter: b.letter, ledger_line: b.line, bettor: b.bettor, stake: b.stake, reason: b.reason }, at: b.date, rank: 1, line: b.line });
      continue;
    }
    out.push({ e: { type: "bet", market: m.id, letter: b.letter, ledger_line: b.line, bettor: b.bettor, stake: b.stake, ...(b.sealed ? { sealed: true } : { issue: b.issue }) }, at: b.date, rank: 1, line: b.line });
    if (b.reveal) out.push({ e: { type: "reveal", market: m.id, letter: b.reveal.letter, bet: b.letter, bettor: b.bettor, issue: b.issue }, at: b.reveal.date, rank: 2, line: b.line });
  }
  if (m.resolution && (st.phase === "resolved" || st.phase === "cancelled")) {
    const r = m.resolution;
    out.push({ e: { type: "resolution", market: m.id, outcome: r.outcome, evidence: r.evidence, pot: st.pot, pools: st.pools }, at: r.date, rank: 3, line: 0 });
  }
  for (const d of st.dues) {
    // Les dettes d'un refus (tardif, interdit, non révélé…) sont déjà portées par leur ligne « refused » ;
    // seules celles de la résolution (gain, remboursement général) ont leur ligne « due ».
    if (!(d.reason === undefined || d.reason === "cancelled" || d.reason === "no-winner")) continue;
    out.push({ e: { type: "due", market: m.id, to: d.to, amount: d.amount, kind: d.kind, bets: [...d.bets].sort(), ...(d.reason ? { reason: d.reason } : {}) }, at: m.resolution!.date, rank: 4, line: 0 });
  }
  const paid = readPayments(st, w);
  for (const [bet, p] of paid.paid) out.push({ e: { type: "paid", market: m.id, bet, letter: p.letter, ledger_line: p.ledgerLine, amount: p.amount }, at: "9999", rank: 5, line: p.ledgerLine });
  return out.sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank || a.line - b.line);
}

/** Chaîne une liste d'évènements à la suite d'un livre existant. */
export function chain(prev: BookLine[], events: BookEvent[]): BookLine[] {
  const out = [...prev];
  for (const e of events) {
    const last = out[out.length - 1];
    const prevHash = last ? last.hash : genesisHash();
    const seq = last ? last.seq + 1 : 1;
    out.push({ ...e, seq, prev: prevHash, hash: sha(prevHash + canon({ ...e, seq })) });
  }
  return out;
}

export const parseBook = (text: string): BookLine[] => text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as BookLine);
export const renderBook = (lines: BookLine[]): string => lines.map((l) => canon(l)).join("\n") + (lines.length ? "\n" : "");

/** La chaîne tient-elle ? Index (1-based) de la première ligne fautive, ou null. */
export function verifyChain(lines: BookLine[]): { seq: number; why: string } | null {
  let prev = genesisHash();
  for (const [i, l] of lines.entries()) {
    const { seq, prev: p, hash, ...e } = l;
    if (seq !== i + 1) return { seq: i + 1, why: `seq ${seq} au lieu de ${i + 1}` };
    if (p !== prev) return { seq, why: "prev ne reprend pas le hash précédent" };
    if (hash !== sha(prev + canon({ ...e, seq }))) return { seq, why: "hash ne correspond pas au contenu" };
    prev = hash;
  }
  return null;
}

export interface Audit {
  ok: boolean;
  chainBroken: { seq: number; why: string } | null;
  /** lignes publiées que le grand livre ne justifie pas. */
  unsupported: BookLine[];
  /** lignes que le grand livre justifie et que le livre n'a pas encore (à ajouter, pas une faute). */
  missing: BookEvent[];
  duplicates: number;
}

export function auditBook(published: BookLine[], markets: Market[], w: World): Audit {
  const derived = markets.flatMap((m) => deriveEvents(m, w).map((x) => x.e));
  const want = new Set(derived.map(eventKey));
  const have = new Map<string, number>();
  const unsupported: BookLine[] = [];
  let duplicates = 0;
  for (const l of published) {
    const { seq: _s, prev: _p, hash: _h, ...e } = l;
    const k = eventKey(e as BookEvent);
    have.set(k, (have.get(k) ?? 0) + 1);
    if ((have.get(k) ?? 0) > 1) duplicates++;
    if (!want.has(k)) unsupported.push(l);
  }
  const missing = derived.filter((e) => !have.has(eventKey(e)));
  const chainBroken = verifyChain(published);
  return { ok: !chainBroken && unsupported.length === 0 && duplicates === 0, chainBroken, unsupported, missing, duplicates };
}

/** Évènements à ajouter au livre, dans l'ordre du temps. */
export function pendingEvents(published: BookLine[], markets: Market[], w: World): BookEvent[] {
  const have = new Set(published.map((l) => { const { seq: _s, prev: _p, hash: _h, ...e } = l; return eventKey(e as BookEvent); }));
  const all = markets.flatMap((m) => deriveEvents(m, w));
  all.sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank || a.line - b.line);
  return all.map((x) => x.e).filter((e) => !have.has(eventKey(e)));
}

// ---------------------------------------------------------------------------------------- réserve

/** Preuve de réserve : le solde liquide de la banque couvre ce qu'elle doit encore (cagnottes ouvertes + dettes non payées). */
export function reserveCheck(states: MarketState[], w: World, liquid: number): { owed: number; liquid: number; ok: boolean } {
  let owed = 0;
  for (const st of states) {
    const settled = st.phase === "resolved" || st.phase === "cancelled";
    if (!settled) owed += st.bets.filter((b) => b.status !== "refused").reduce((s, b) => s + b.stake, 0);
    for (const p of outstanding(st, readPayments(st, w))) owed += p.amount;
  }
  return { owed, liquid, ok: liquid >= owed };
}

// ---------------------------------------------------------------------------------------- chargement (lecture seule)

/** Les marchés d'un dossier `markets/` (un JSON chacun, hors sous-dossiers). */
export function loadMarkets(dir: string): Market[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Market);
}

function readLetters(dir: string, into: Map<string, Letter>): void {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    const file = f.endsWith(".md") ? p : path.join(p, "letter.md");
    if (!existsSync(file)) continue;
    const l = parseLetter(readFileSync(file, "utf8"));
    if (l) into.set(l.id, l);
  }
}

/** Le monde public, lu dans un clone de postmark-town/postmark. Aucun réseau, aucun process. */
export function loadWorld(town: string, asof: string, bank = BANK_DEFAULT): World {
  const wp = path.join(town, "WHITE_PAGES");
  const ledger = parseLedger(readFileSync(path.join(wp, "stamp-ledger.md"), "utf8"));
  const mail = parseMailLedger(readFileSync(path.join(wp, "mail-ledger.md"), "utf8"));
  const letters = new Map<string, Letter>();
  for (const box of ["inbox", "outbox"]) readLetters(path.join(wp, bank, box), letters);
  const hh = JSON.parse(readFileSync(path.join(town, "tools/households.json"), "utf8")).households as Record<string, { residents?: string[] }>;
  const home = new Map<string, string>();
  for (const [slug, h] of Object.entries(hh)) for (const r of h.residents ?? []) home.set(r, slug);
  return { bank, ledger, mail, letters, householdOf: (h) => home.get(h) ?? h, meeps: new Set(ledger.meeps ?? []), asof };
}

/** Tout ce que le grand livre dit et que la loi contredit : transferts en double, paiements faux, résolution illisible. */
export function ledgerAnomalies(states: MarketState[], w: World): Anomaly[] {
  const out: Anomaly[] = liveTransfers(w).duplicates.map((t) => ({
    kind: "duplicate-transfer" as const, letter: t.letter,
    detail: `la lettre ${t.letter} porte un second transfert (ligne ${t.line}, ${t.from} → ${t.to}, ${t.n}) : seul le premier compte, le second est à régler à la main`,
  }));
  for (const st of states) {
    if (st.error) out.push({ kind: "bad-resolution", detail: `${st.market.id} : ${st.error}` });
    out.push(...readPayments(st, w).anomalies);
  }
  return out;
}

/** L'audit public : recalcule tout de zéro, compare au livre publié, et (si on donne le solde) vérifie la réserve. */
export function runAudit(root: string, town: string, asof: string, opts: { liquid?: number; bank?: string } = {}): { code: number; out: string[] } {
  const out: string[] = [];
  const markets = loadMarkets(path.join(root, "markets"));
  const w = loadWorld(town, asof, opts.bank);
  const bookFile = path.join(root, "book/book.jsonl");
  const published = existsSync(bookFile) ? parseBook(readFileSync(bookFile, "utf8")) : [];
  const a = auditBook(published, markets, w);
  let code = 0;
  out.push(`${markets.length} marché(s), ${published.length} ligne(s) publiée(s), grand livre : ${w.ledger.lines} lignes, au ${asof}`);
  if (a.chainBroken) { out.push(`✗ chaîne rompue à la ligne ${a.chainBroken.seq} : ${a.chainBroken.why}`); code = 1; }
  else out.push("✓ chaîne de hash intacte");
  if (a.unsupported.length) { out.push(`✗ ${a.unsupported.length} ligne(s) que le grand livre ne justifie pas : ${a.unsupported.map((l) => `#${l.seq} ${l.type}`).join(", ")}`); code = 1; }
  else out.push("✓ chaque ligne publiée se recalcule depuis le grand livre");
  if (a.duplicates) { out.push(`✗ ${a.duplicates} ligne(s) en double`); code = 1; }
  if (a.missing.length) out.push(`… ${a.missing.length} ligne(s) justifiée(s) pas encore publiée(s) (retard, pas une faute)`);
  const states = markets.map((m) => marketState(m, w));
  for (const st of states) {
    const left = outstanding(st, readPayments(st, w));
    out.push(`  ${st.market.id} : ${st.phase}, cagnotte ${st.pot}${left.length ? `, à payer ${left.reduce((s, p) => s + p.amount, 0)}` : ""}`);
  }
  const anomalies = ledgerAnomalies(states, w);
  for (const an of anomalies) out.push(`✗ ${an.kind} : ${an.detail}`);
  if (anomalies.length) code = 1;
  else out.push("✓ aucun paiement ni transfert que la loi contredise");
  if (opts.liquid !== undefined) {
    const r = reserveCheck(states, w, opts.liquid);
    out.push(`${r.ok ? "✓" : "✗"} réserve : ${r.liquid} liquides pour ${r.owed} dus`);
    if (!r.ok) code = 1;
  }
  return { code, out };
}
