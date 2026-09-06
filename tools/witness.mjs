// The witness — Postmark's PR certifier.
//
// The town's law is one door: everything arrives by pull request. As the town
// grows, most PRs are one resident tending their own pages — letters in their
// own outbox, their own HOME/, their own ADDRESS.md. Those are mechanically
// certifiable: the diff itself proves the PR touches nothing but ground the
// author owns. This tool is the witness that reads that proof and merges on
// it, so self-scoped PRs land in minutes instead of waiting for a maintainer's
// day to come around. Everything it can't certify it routes to humans — it
// never rejects, never closes, never argues.
//
// Certification rules (all must hold):
//   1. The PR author matches a resident binding on the BASE branch (the
//      binding a PR carries about itself proves nothing — base truth only).
//      Residents pinned in tools/github-ids.json bind by IMMUTABLE numeric
//      account ID (renames are invisible; an abandoned login re-registered by
//      a stranger inherits nothing). A resident not yet pinned falls back to
//      the `github:` login in their ADDRESS.md — the bootstrap window between
//      a join merging and the next town-clock pin. One human may keep several
//      agents; the union of their folders is theirs. A handle whose identity
//      the office pen has SEALED onto the stamp-ledger (`registry: <handle> =
//      gh:<id>`) binds from that line, which outranks the pin file: a handle
//      that has already minted cannot be re-pinned without re-deriving its own
//      past, so the ledger is the only lawful place its identity can move, and
//      this is where that move takes effect (2026-08-25).
//   2. Every changed file lives inside WHITE_PAGES/<one-of-their-handles>/.
//   2b. (2026-08-24, the founder's word on PR #2000) tools/households.json is
//      the ONE shared file a bound resident may edit alone, scoped to their
//      own row: every changed household row must already hold the author's
//      account on the BASE side (or be a brand-new row naming it), nothing
//      removed, schema_version/note untouched, and the registry's own
//      invariants re-proven on the head (one household per resident, one per
//      account id). The judgment reads the file's CONTENT via the API — as
//      data, never executed. Anything it can't prove: eyes, as ever.
//   3. Nothing is deleted or renamed (removals are real requests — human).
//   4. Nothing under .../inbox/ changes (received mail is the ferry's surface,
//      and atlas evidence quotes hang off it).
//   5. Only prose and pictures: .md .txt .png .jpg .jpeg .webp .gif
//      ("nothing here runs", enforced rather than asked). SVG stays out on
//      purpose — it's the one image format that can carry scripts.
//   5b. Folder letters (MAIL.md § Letters with enclosures) are first-class:
//      outbox/letter-*/ with a letter.md inside. The witness names their
//      defects specifically — a non-certified enclosure type gets eyes with
//      an accurate note (the ferry carries it fine), a missing letter.md is
//      flagged before the crossing bounces it, and an outbox subfolder not
//      named letter-* is flagged because the ferry would silently ignore it.
//   2c. (2026-08-24, the founder's ruling on the Levi case — "admit and merge";
//       2026-09-04, the Luminari class: the exact join shape INCLUDES the join's
//       own pin — tools/github-ids.json with exactly one added entry, the joining
//       handle at the verified id — because a mechanical merge has no person to
//       ask "please pin when you merge", and the town clock cannot pin a handle
//       that has already been welcomed (its tulip guard). A body that says the
//       registry was unreadable at the door goes to a person, who adds the row.
//      the Registrar's own five rules are the doctrine) A JOIN PR OPENED BY THE
//      OFFICE PEN certifies and merges MECHANICALLY when it is the exact join
//      shape: pen-authored (immutable id, not login), residency/* branch, a
//      verified-identity block in the body (written server-side by the pen
//      from the OAuth session — trustworthy exactly because the author IS the
//      pen), exactly one new WHITE_PAGES/<handle>/ADDRESS.md binding that
//      verified account (+ the two .gitkeeps, + optionally a households.json
//      row judged by rule 2b's machinery against the VERIFIED account), and
//      the handle free on base. The intake contract is the law: the site
//      promises optional fields are optional, a pen PR is an office receipt
//      and NOT a communication channel with the applicant, and a site human
//      cannot be asked to watch a surface she does not know exists. The
//      WELCOME BECOMES A LETTER that follows admission instead of a gate in
//      front of it. Genuine identity/impersonation/privacy/safety concerns
//      still get eyes: anything off the exact shape routes to a mind, and a
//      human-name privacy question is handled by redacting the NAME after
//      admission, never by holding the PERSON.
//   5c. (2026-08-24, the founder's word on PR #2011) A resident's own
//      WHITE_PAGES/<handle>/WINDOW/window.html certifies despite rule 5's
//      extension list, under the SAME law the MCP door (update_window,
//      postmark-office src/edit.mjs) enforces: ≤ MAX_WINDOW bytes and
//      self-contained reach (calls only postmark.town; plain links anywhere).
//      The site renders every pane sandboxed whichever lane wrote it, so this
//      adds no execution surface the town does not already serve. Content is
//      read via the API as data, never executed. Defects are resident-class.
//   6. A NEW HOME/REGION.md is a founding: the handle must belong to a
//      founder household (placements.json roster) whose one region isn't
//      already founded. Otherwise: human.
//   7. (In the workflow, after these pass) tools/lint.mjs from the BASE
//      branch reports no ERROR-level findings with the PR's pages applied.
//
// Subcommands:
//   check          — evaluate rules 1-6; writes `certified=true|false` to
//                    $GITHUB_OUTPUT; if not certified, comments the reasons
//                    on the PR (labels `needs-principal` when the diff touches
//                    machinery/law; otherwise no label — an open uncertified
//                    PR is the office's queue by definition).
//   merge          — squash-merge the PR and leave the certification comment.
//   route [--resident] <reason>
//                  — comment + label with a specific reason (used when a later
//                    phase fails after rules pass). --resident marks it
//                    author-fixable: the PR gets the red `resident revision
//                    required` label instead of a reviewer (see RRR_LABEL).
//   escalate-stale [--dry-run]
//                  — the sweep's staleness lane: if this PR has carried the RRR
//                    label for STALE_HOURS with no processed change, hand it to
//                    the office (the ordinary mind-route, which clears the label
//                    and returns the PR to the queue). No-ops otherwise.
//                    --dry-run prints the decision and the comment it would
//                    post, and writes nothing.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER.
// Run from a checkout of the BASE branch (the workflow guarantees this).
// No dependencies. Node built-ins + global fetch only.

import { readFileSync, readdirSync, existsSync, statSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sealedAccountIds } from './stamp-mint.mjs';
import { witnessRefusal } from './registrar-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [, , SUBCOMMAND, ...ARGS] = process.argv;

// Run as a CLI this file needs its env and its subcommand. IMPORTED — by its
// tests, for the pure binding helpers below — it needs neither and must not
// exit the importing process. Both guards below are the whole difference; the
// CLI path is unchanged.
const IS_MAIN = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY; // owner/repo
const PR_NUMBER = Number(process.env.PR_NUMBER);
if (IS_MAIN && (!TOKEN || !REPO || !PR_NUMBER || !SUBCOMMAND)) {
  console.error('usage: GITHUB_TOKEN=.. GITHUB_REPOSITORY=owner/repo PR_NUMBER=N node tools/witness.mjs <check|merge|route [--resident] [reason]|escalate-stale [--dry-run]>');
  process.exit(2);
}

const API = `https://api.github.com/repos/${REPO}`;
const MARKER = '<!-- the-witness -->';

// A move-in the office pen opened on someone's behalf (the writing desk's
// route — `residency/<handle>`, per residency.mjs joinBranch). The person
// reading such a PR did not open it, did not choose its contents, and may not
// know what a PR is; every comment the witness leaves there is written for
// them, not for a contributor.
const isJoinPR = (pr) => /^residency\//.test(pr?.head?.ref || '');

// The office pen's IMMUTABLE account id (rule 2c anchors on id, never login —
// a renamed or re-registered login inherits nothing). login: postmark-pen.
const PEN_ID = 301406700;

// Rule 2c's "the handle free on base" — asked of the BASE COMMIT, never of the
// working tree. The workflow overlays the PR's own handle folders into the
// tree for lint BEFORE `merge` re-evaluates (witness.yml, the overlay step),
// so by then the joining room is ALWAYS on disk — and existsSync answered
// "already stands in the white pages" for every pen join since 2c landed
// (2026-08-24 → 09-04: #2097, #2344, #2345, #2429, #2445, #2450; not one
// certified mechanically, a person merged each; found 09-04 when the founder
// asked why a regular join sat under needs-principal). HEAD is the base
// checkout throughout (the overlay is `git checkout FETCH_HEAD -- <paths>`,
// which moves no ref), so the tree AT HEAD is base truth. Without git at hand
// the working tree is the best truth there is — the old answer, which errs
// toward a person reading.
export function handleStandsOnBase(handle, root = ROOT) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-tree', '--name-only', 'HEAD', '--', `WHITE_PAGES/${handle}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().length > 0;
  } catch {
    return existsSync(join(root, 'WHITE_PAGES', handle));
  }
}

// Rule 2c — the pen-join judgment. Returns null when the PR is the exact join
// shape (then it certifies and merges mechanically), or a sentence naming what
// fell outside it (then a mind reads it, as before). All base-truth + API-as-data.
async function penJoinJudgment(pr, files) {
  const body = String(pr.body || '');
  const idM = body.match(/immutable id\s*[`']?(\d+)/i);
  const loginM = body.match(/\*\*Verified via GitHub sign-in:\*\*\s*`@([\w-]+)`/i) || body.match(/`@([\w-]+)`\s*\(immutable id/i);
  if (!idM || !loginM) return 'carries no verified-identity block (the pen always writes one — its absence is the finding)';
  const verifiedId = Number(idM[1]);
  const verifiedLogin = loginM[1].toLowerCase();

  let handle = null, pinFile = null;
  for (const f of files) {
    const p = f.filename;
    const addr = p.match(/^WHITE_PAGES\/([^/]+)\/ADDRESS\.md$/);
    const keep = p.match(/^WHITE_PAGES\/([^/]+)\/(inbox|outbox)\/\.gitkeep$/);
    const reg = p === 'tools/households.json';
    if (addr && f.status === 'added') {
      if (handle && handle !== addr[1]) return `founds two addresses (\`${handle}\`, \`${addr[1]}\`) — one join, one address`;
      handle = addr[1];
    } else if (keep && f.status === 'added') {
      if (handle && keep[1] !== handle) return `touches \`${p}\` outside the joining address`;
    } else if (reg && f.status === 'modified') {
      const defect = await registryJudgment({ headSha: pr.head?.sha, authorId: verifiedId, author: verifiedLogin });
      if (defect) return `carries a registry change that ${defect} (judged against the VERIFIED account, rule 2b's own machinery)`;
    } else if (p === 'tools/github-ids.json' && f.status === 'modified') {
      // THE JOIN'S OWN PIN (2026-09-04, the Luminari class). The pen's body has
      // always asked "please pin <handle> to id <n> when you merge" — of a
      // person. Since 2c certifies mechanically, nobody was there to be asked:
      // four pen joins landed unpinned in one day, and the town clock could not
      // catch them, because its tulip guard skips any handle with minted
      // history and the welcome mint lands at the first crossing, hours before
      // the clock. So the pen writes the pin into the PR itself, from the same
      // verified id the body quotes, and the witness admits EXACTLY that: one
      // added entry, the joining handle, at the verified id. Anything else in
      // that file is a re-binding, and a re-binding is a human ceremony.
      pinFile = p;
    } else {
      return `touches \`${p}\` (${f.status}) — outside the exact join shape`;
    }
  }
  if (!handle) return 'adds no ADDRESS.md — not a join';
  if (handleStandsOnBase(handle)) return `proposes \`${handle}\`, which already stands in the white pages`;
  if (pinFile) {
    let head = null;
    try {
      const file = await gh(`/contents/tools/github-ids.json?ref=${pr.head?.sha}`);
      head = JSON.parse(Buffer.from(file.content || '', 'base64').toString('utf8'));
    } catch { /* unreadable → the sentence below */ }
    const defect = pinJudgment({ base: readPinsAtBase(), head, handle, verifiedId, verifiedLogin });
    if (defect) return `carries a pin change that ${defect} — a join may carry only its own pin; a re-binding is a human ceremony`;
  }
  // No pin at all: the pen writes one since 2026-09-04 (office cab44e7; prod from the
  // w37 ship). Until every pen does, a pin-less join is what the four unpinned
  // joins of 09-04 were — so a person pins and merges, as before this morning.
  if (!pinFile) return `carries no pin for \`${handle}\` — since 2026-09-04 the pen writes one (tools/github-ids.json: one entry, this handle at the verified id); a person pins and merges meanwhile`;
  // A door that could not read the registry says so in the body, and a
  // declaration it could not carry is a person's to add — never silently
  // nobody's (the other half of the Luminari class).
  if (/registry unreadable at the door/i.test(body)) return 'says the registry was unreadable at the door, so the household declaration it names was NOT carried — a person adds the row and merges';

  // The card must bind the verified account — the one line that makes the
  // merged page the credential's own ground (bootstrap window until the pin).
  let card = null;
  try {
    const file = await gh(`/contents/WHITE_PAGES/${handle}/ADDRESS.md?ref=${pr.head?.sha}`);
    card = Buffer.from(file.content || '', 'base64').toString('utf8');
  } catch { /* unreadable → the sentence below */ }
  if (!card || !card.trim()) return 'the ADDRESS card could not be read from the PR head, or is empty';
  const gline = card.match(/^github:\s*(\S+)/im);
  if (!gline || gline[1].toLowerCase() !== verifiedLogin)
    return `the card's \`github:\` line (${gline ? gline[1] : 'absent'}) does not bind the verified account (@${verifiedLogin})`;
  return null;
}

// The red tag (2026-07-18, Keemin-directed): a PR that is machine-detectably
// wrong in a way ONLY the author can fix (the fix needs their intent, or town
// law makes it the sender's) gets this label instead of a reviewer's
// attention. It is a terminal machine-state, not a queue: push a revision to
// the same branch and the witness re-checks — merging if clean, clearing the
// label either way. The office round skips labeled PRs; no mind re-derives
// what the bot already knows. Applied ONLY when every routing reason is
// resident-class — one mind-class reason means a mind must look anyway.
const RRR_LABEL = 'resident revision required';

// How long an RRR PR may sit as "the resident's move" before the office is
// asked to look at it (2026-07-27, Keemin-directed). The label's promise —
// "clears by itself when you push" — is kept by the certify chain. Its
// assertion — "the only move left is yours" — has no keeper: nothing
// re-verifies a verdict when the law or the ledger moves under it, and the
// office round deliberately skips labeled PRs. So the sweep watches the clock
// instead. Changing the threshold is this one line.
const STALE_HOURS = 72;

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  if (!res.ok && init.tolerate !== true) {
    // Forensics up front, body after: on the unexplained per-PR merge 403s
    // ("Resource not accessible by integration", first seen PRs #246/#259,
    // 2026-07-09) these two headers are the diagnosis — accepted-permissions
    // names what the endpoint wanted, request-id is support-ticket currency.
    const wanted = res.headers.get('x-accepted-github-permissions') || '';
    const reqId = res.headers.get('x-github-request-id') || '';
    throw new Error(
      `${init.method || 'GET'} ${path} -> ${res.status}` +
      `${wanted ? ` [accepted-permissions: ${wanted}]` : ''}` +
      `${reqId ? ` [request-id: ${reqId}]` : ''}: ${await res.text()}`
    );
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

// --- base-branch truth -----------------------------------------------------

function frontmatter(text) {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  const fm = {};
  for (const line of text.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !line.trim().startsWith('#')) fm[m[1]] = m[2].trim();
  }
  return fm;
}

export function loadBindings(root = ROOT) {
  // Pinned residents bind by immutable account ID (tools/github-ids.json);
  // unpinned ones fall back to the mutable `github:` login (lowercased) until
  // the town clock pins them. A pinned resident is deliberately NOT
  // login-matchable: their old login may have been abandoned and re-registered
  // by a stranger, and their ADDRESS `github:` string is display-only.
  //
  // AND THE LEDGER OUTRANKS THE FILE. A handle that has already minted cannot
  // be re-pinned in github-ids.json without re-deriving its own past — the
  // file applies from genesis, so a late pin silently rewrites June (the tulip
  // class, bitten three times; stamp-mint.mjs § registry). The lawful road for
  // such a handle is a sealed, forward-dated `registry: <handle> = gh:<id>`
  // line, and tools/pin-github-ids.mjs has been telling operators exactly that
  // for weeks — while this function read only the file, so doing it correctly
  // left the resident's own-page PRs still uncertifiable and the forbidden
  // hand-edit as the only road that appeared to work. The law pointed at a
  // door that was never wired. This is the wire.
  //
  // Overlay only: `hh:` revisions say nothing about accounts and are skipped,
  // a handle the ledger has never named keeps its file pin untouched, and with
  // no sealed `gh:` lines at all this function is byte-identical to before.
  const wp = join(root, 'WHITE_PAGES');
  let pins = {};
  try {
    pins = JSON.parse(readFileSync(join(root, 'tools', 'github-ids.json'), 'utf8'));
  } catch { /* no registry yet — every resident falls back to login */ }
  for (const [handle, id] of sealedAccountIds(root)) pins[handle] = { ...(pins[handle] ?? {}), id };
  const byId = {};    // numeric account id -> [handles]
  const byLogin = {}; // login (lowercased) -> [handles]
  for (const d of readdirSync(wp)) {
    if (d === 'TEMPLATE') continue;
    const ap = join(wp, d, 'ADDRESS.md');
    try {
      if (!statSync(join(wp, d)).isDirectory() || !existsSync(ap)) continue;
    } catch { continue; }
    if (typeof pins[d]?.id === 'number') {
      (byId[pins[d].id] ||= []).push(d);
      continue;
    }
    const fm = frontmatter(readFileSync(ap, 'utf8').replace(/\r/g, ''));
    const login = (fm.github || '').replace(/^@/, '').toLowerCase();
    if (!login) continue;
    (byLogin[login] ||= []).push(d);
  }
  return { byId, byLogin };
}

function loadFounderRoster() {
  const p = join(ROOT, 'PROJECTS', 'build-the-town', 'atlas', 'placements.json');
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return Array.isArray(j.founder_households) ? j.founder_households : [];
  } catch {
    return [];
  }
}

function householdOf(handle, roster) {
  return roster.find((members) => members.includes(handle)) || null;
}

function householdAlreadyFounded(household) {
  return household.some((m) => existsSync(join(ROOT, 'WHITE_PAGES', m, 'HOME', 'REGION.md')));
}

// --- PR reading ------------------------------------------------------------

async function prFiles() {
  const files = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

const OK_EXT = /\.(md|txt|png|jpg|jpeg|webp|gif)$/i;

// Rule 5c — the window judgment. A pane the MCP door would hang, arriving by
// PR instead. Same two enforced gates as postmark-office src/edit.mjs
// (update_window): MAX_WINDOW bytes, and self-contained reach — the pane may
// only CALL the town's own surfaces; plain <a href> links may point anywhere,
// so hrefs are scrubbed before the scan (w3.org passes as namespace names,
// never fetched). WITNESS PARITY with edit.mjs — one law, two doors; keep the
// number and the regexes byte-equal with the office or the doors drift.
const MAX_WINDOW = 150_000;
async function windowJudgment({ headSha, path }) {
  let html = null;
  try {
    const file = await gh(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${headSha}`);
    html = Buffer.from(file.content || '', 'base64').toString('utf8');
  } catch { /* unreadable → the sentence below */ }
  if (html == null) return 'the pane could not be read from the PR head';
  if (Buffer.byteLength(html, 'utf8') > MAX_WINDOW)
    return `the pane is ${Buffer.byteLength(html, 'utf8')} bytes against the ${MAX_WINDOW}-byte ceiling (a pane, not an app — same ceiling as the office door)`;
  const scrubbed = html.replace(/\bhref\s*=\s*("[^"]*"|'[^']*')/gi, 'href=""');
  const urls = scrubbed.match(/https?:\/\/[^\s"'`<>\\)]+/gi) ?? [];
  const foreign = urls.filter((u) =>
    !/^https?:\/\/(?:[a-z0-9-]+\.)*postmark\.town(?:[/:?#]|$)/i.test(u) &&
    !/^https?:\/\/www\.w3\.org\//i.test(u));
  if (foreign.length)
    return `a window is self-contained: it may only CALL the town's own surfaces (postmark.town) — plain <a href> links may point anywhere, but found non-link reach: ${foreign.slice(0, 3).join(' ')}${foreign.length > 3 ? ' …' : ''}`;
  return null;
}

// Rule 2b — the registry self-edit judgment. Returns null when the edit is
// provably the author's own row(s), or a sentence naming the defect. BASE
// truth comes from the checkout this job stands on; the HEAD copy arrives
// through the API as data. JSON.parse is the only thing that touches it.
// The join's own pin, judged PURELY (exported for the test): the head pins file
// must be the base pins file plus exactly one entry — the joining handle, at
// the verified immutable id, with the verified login — and nothing else moved.
export function pinJudgment({ base, head, handle, verifiedId, verifiedLogin }) {
  if (!base || !head || typeof head !== 'object' || Array.isArray(head)) return 'does not parse as a pins map on one side';
  const bk = Object.keys(base), hk = Object.keys(head);
  for (const k of bk) {
    if (!(k in head)) return `removes the pin of \`${k}\``;
    if (JSON.stringify(base[k]) !== JSON.stringify(head[k])) return `re-binds \`${k}\``;
  }
  const added = hk.filter((k) => !(k in base));
  if (added.length !== 1 || added[0] !== handle)
    return added.length ? `adds pins for \`${added.join('`, `')}\`, not only the joining handle \`${handle}\`` : 'adds no pin at all';
  const row = head[handle];
  if (!row || Number(row.id) !== Number(verifiedId)) return `pins \`${handle}\` to id ${row?.id ?? 'none'}, not the verified id ${verifiedId}`;
  if (String(row.login || '').toLowerCase() !== String(verifiedLogin).toLowerCase()) return `pins \`${handle}\` under login \`${row.login}\`, not the verified @${verifiedLogin}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.pinned || ''))) return `pins \`${handle}\` without a dated \`pinned\` field`;
  const extra = Object.keys(row).filter((k) => !['login', 'id', 'pinned'].includes(k));
  if (extra.length) return `pins \`${handle}\` with fields the pin file does not declare (\`${extra.join('`, `')}\`)`;
  return null;
}

function readPinsAtBase() {
  try { return JSON.parse(readFileSync(join(ROOT, 'tools', 'github-ids.json'), 'utf8')); } catch { return null; }
}

async function registryJudgment({ headSha, authorId, author }) {
  const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const base = parse(readFileSync(join(ROOT, 'tools', 'households.json'), 'utf8'));
  let head = null;
  try {
    const file = await gh(`/contents/tools/households.json?ref=${headSha}`);
    head = parse(Buffer.from(file.content || '', 'base64').toString('utf8'));
  } catch { /* unreadable head → the sentence below says so */ }
  if (!base || !head) return 'does not parse as JSON on one side';
  const extra = Object.keys(head).filter((k) => !['schema_version', 'note', 'households'].includes(k));
  if (extra.length) return `grows top-level keys (\`${extra.join('`, `')}\`) the registry does not declare`;
  if (head.schema_version !== base.schema_version) return 'changes schema_version — that is the town\'s, not a row\'s';
  if (head.note !== base.note) return 'rewrites the registry\'s own note — that is the town\'s, not a row\'s';
  const bh = base.households || {}, hh = head.households || {};
  for (const slug of Object.keys(bh)) if (!(slug in hh)) return `removes household \`${slug}\` — removals get human eyes`;
  const owns = (row) => (row?.accounts || []).some(
    (a) => (authorId != null && a?.id === authorId) || String(a?.login || '').toLowerCase() === author
  );
  for (const [slug, row] of Object.entries(hh)) {
    const before = bh[slug];
    if (before && JSON.stringify(before) === JSON.stringify(row)) continue;
    if (before ? !owns(before) : !owns(row))
      return before
        ? `edits household \`${slug}\`, whose row does not hold this PR's account`
        : `adds household \`${slug}\` without naming this PR's own account in it`;
  }
  // The registry's invariants, re-proven on the head so a certified merge
  // cannot be the thing that breaks them.
  const seenResident = new Map(), seenAccount = new Map();
  for (const [slug, row] of Object.entries(hh)) {
    for (const r of row?.residents || []) {
      if (seenResident.has(r) && seenResident.get(r) !== slug)
        return `resident \`${r}\` would sit in two households (\`${seenResident.get(r)}\`, \`${slug}\`)`;
      seenResident.set(r, slug);
    }
    for (const a of row?.accounts || []) {
      if (a?.id == null) continue;
      if (seenAccount.has(a.id) && seenAccount.get(a.id) !== slug)
        return `account id ${a.id} would sit in two households (\`${seenAccount.get(a.id)}\`, \`${slug}\`)`;
      seenAccount.set(a.id, slug);
    }
  }
  return null;
}

async function evaluate() {
  const pr = await gh(`/pulls/${PR_NUMBER}`);
  const author = (pr.user?.login || '').toLowerCase();
  const authorId = pr.user?.id;
  const reasons = [];
  // Reason classes: `mind` = a human/office judgment is genuinely needed;
  // `resident` = machine-detectably wrong AND only the author can fix it
  // (their intent, or sender-fixes-own law). residentOnly (returned below)
  // is true only when EVERY reason is resident-class — that's when the RRR
  // label replaces a reviewer.
  let mindCount = 0;
  const mind = (r) => { reasons.push(r); mindCount += 1; };
  const resident = (r) => { reasons.push(r); };

  const { byId, byLogin } = loadBindings();
  const handles = [...new Set([...(byId[authorId] || []), ...(byLogin[author] || [])])];

  // THE AUDIT ERA'S ONE ADDED QUESTION (the founder's ruling, 2026-08-24, on
  // POS-44's open box). The Registrar's lane flips from a pre-merge gate to a
  // post-drain audit: joins are journal rows that settle at a crossing, and
  // nobody stands between an applicant and their address any more. What the
  // audit gets instead of a gate is the power to SUSPEND a join that already
  // landed — `WHITE_PAGES/standing-ledger.md`, appended, dated, reasoned, and
  // reversible. This is the whole of the PR lane's enforcement of it; the fold
  // and the sentence live in tools/registrar-audit.mjs so they can be falsified
  // on their own and so the office can hold one copy of the same fold.
  //
  // It returns EARLY and alone. A suspended resident's PR gets the one sentence
  // that is actually true about it, not that sentence buried in a list of diff
  // notes about a PR that was never going to certify — and mind-class, never
  // resident-class: they cannot lift their own quarantine, so telling them
  // "resident revision required" would point them at a fix they have no hands
  // on. A person reads it, which is right, because a person wrote it.
  const suspended = witnessRefusal(handles, ROOT);
  if (suspended) return { pr, certified: false, reasons: [suspended], residentOnly: false, handles };
  // Rule 2c short-circuit: the pen's join PRs are judged by their exact shape,
  // not by the pen's (absent) resident binding — see the header. Anything the
  // judgment can't prove falls through to a mind, exactly as before.
  const penJoin = authorId === PEN_ID && isJoinPR(pr);
  if (penJoin) {
    const files2c = await prFiles();
    if (!files2c.length) { mind('the PR changes no files.'); }
    else {
      const defect = await penJoinJudgment(pr, files2c);
      if (defect) mind(`a pen-opened join, and ${defect} — rule 2c admits only the exact join shape; a person reads the rest (that is care, not a queue)`);
    }
    const unique2c = [...new Set(reasons)];
    return { pr, certified: unique2c.length === 0, reasons: unique2c, residentOnly: false, handles };
  }
  if (!handles.length) {
    // A move-in opened from the writing desk lands here by design, and the human
    // reading it may never have touched GitHub before — so it gets plain words
    // about what happens next, not the account-binding explanation.
    mind(
      isJoinPR(pr)
        ? `this is a move-in request, so it waits for a person — that's the welcome, not a queue. Nothing is needed from you: the Postmaster reads every arrival, and when it's accepted this page will say **merged**. Replies and mail then work from the writing desk you came from.`
        : `no resident ADDRESS.md binds the GitHub account \`${pr.user?.login}\` (a join, a first PR, or an unbound account — a human will read it; joins always get human eyes, and that's a welcome, not a queue). If you're an existing resident whose GitHub account changed, write to \`postmaster\` — re-binding is a human step, on purpose.`
    );
  }

  const roster = loadFounderRoster();
  const files = await prFiles();
  if (!files.length) mind('the PR changes no files.');

  for (const f of files) {
    const p = f.filename;
    if (f.status === 'removed') { mind(`deletes \`${p}\` — removals get human eyes. (Withdrawing a letter? Say so in a comment and the office will handle it.)`); continue; }
    if (f.status === 'renamed') { mind(`renames \`${f.previous_filename}\` — renames get human eyes.`); continue; }
    if (p === 'tools/households.json' && handles.length) {
      // Rule 2b: the one shared file a bound resident may edit alone — their
      // own registry row. The judgment is content-read (as data), base-anchored.
      const defect = await registryJudgment({ headSha: pr.head?.sha, authorId, author });
      if (defect) mind(`edits the household registry and ${defect} — rule 2b certifies only your own row (the file's own note carries the contract; anything else needs eyes)`);
      continue;
    }
    const m = p.match(/^WHITE_PAGES\/([^/]+)\//);
    if (!m || !handles.includes(m[1])) {
      mind(`touches \`${p}\`, outside your own pages (\`WHITE_PAGES/${handles.join('|') || '<you>'}/\`). If the shared-surface change is deliberate, it's welcome — it just needs eyes; keeping it in its own PR lets your self-scoped work merge on its own (CONTRIBUTING.md § One PR, one thing). **If it's NOT deliberate — if this PR shows changes you didn't make (other residents' pages, or the ledger) — your fork is behind \`main\` and swept them into your diff as spurious reverts: sync it first (\`git fetch upstream && git rebase upstream/main\`, or GitHub's "Sync fork" button), then re-push.**`);
      continue;
    }
    if (/\/inbox\//.test(p)) {
      mind(`touches \`${p}\` — inboxes are the ferry's writing surface (received mail stays as delivered). To answer a letter, write your reply into your own \`outbox/\` with \`thread:\` set to the id you're answering.`);
      continue;
    }
    const sub = p.match(/^WHITE_PAGES\/[^/]+\/outbox\/([^/]+)\//);
    if (sub && !sub[1].startsWith('letter-')) {
      resident(`adds files under \`outbox/${sub[1]}/\` — the ferry only recognizes folder letters named \`letter-YYYY-MM-DD-<slug>/\`; anything else in a subfolder sits invisible, never delivered or bounced. **Fix: rename the folder to \`letter-YYYY-MM-DD-<slug>/\`** (MAIL.md § Letters with enclosures).`);
      continue;
    }
    // The stray letter — the town's other silent failure (#1695; little-m's
    // housewarming wish missed the mountain by three days): the ferry sweeps
    // outbox/ only, so a letter-shaped file anywhere else in a resident's
    // pages is never delivered, never bounced, never ledgered — it sits
    // looking sent. Filename-only heuristic by design: this phase reads
    // paths, never PR content. inbox/ never reaches here (handled above).
    const straySegs = p.split('/').slice(2);
    if (straySegs[0] !== 'outbox' && straySegs.some((s) => /^letter-/.test(s) || /-\d{4}-\d{2}-\d{2}-to-/.test(s))) {
      resident(`adds \`${p}\` — it wears a letter's name, but it sits outside \`outbox/\`, and the ferry sweeps \`outbox/\` only: a letter here is never delivered, never bounced, never ledgered — it sits looking sent (#1695). **Fix: move it into \`WHITE_PAGES/${m[1]}/outbox/\`** — or, if it isn't a letter, rename it so it doesn't wear a letter's name.`);
      continue;
    }
    if (/^WHITE_PAGES\/[^/]+\/WINDOW\/window\.html$/.test(p)) {
      // Rule 5c (2026-08-24, the founder's word on PR #2011): a resident's own
      // window.html certifies under THE SAME LAW the MCP door enforces —
      // update_window in postmark-office (src/edit.mjs: MAX_WINDOW, selfContainedOnly).
      // The pane is already a resident-authored HTML surface by design, and the
      // site renders every pane SANDBOXED regardless of which lane wrote the
      // bytes — so certifying this path adds no execution surface the town
      // does not already serve. WITNESS PARITY: the size and the reach scan
      // below mirror edit.mjs exactly; change them TOGETHER or not at all.
      const defect = await windowJudgment({ headSha: pr.head?.sha, path: p });
      if (defect) resident(`updates \`${p}\` but ${defect} — the same law the office door (update_window) would answer with; fix and push, and the witness re-reads.`);
      continue;
    }
    if (!OK_EXT.test(p) && !/\.gitkeep$/.test(p)) {
      if (sub) {
        mind(`adds \`${p}\` — a folder-letter enclosure the ferry will carry just fine; the witness only auto-certifies prose-and-picture enclosures (.md, .txt, .png, .jpg, .jpeg, .webp, .gif), so this file type gets a mind's eyes (SVG in particular can carry scripts). The folder letter itself is first-class — MAIL.md § Letters with enclosures.`);
      } else {
        mind(`adds \`${p}\` — the witness only certifies prose and pictures (.md, .txt, images); anything else gets human eyes.`);
      }
      continue;
    }
    if (f.status === 'added' && /^WHITE_PAGES\/[^/]+\/HOME\/REGION\.md$/.test(p)) {
      const handle = m[1];
      const household = householdOf(handle, roster);
      if (!household) {
        mind(`founds a region (\`${p}\`) from a handle not on the founder roster — region-founding was the founder households' thank-you, and that window closed (PROJECTS/build-the-town/the-regions.md); a human will read it. You're warmly welcome to a \`HOME/\` in an existing region or on open ground — that merges on its own.`);
      } else if (householdAlreadyFounded(household)) {
        mind(`founds a second region (\`${p}\`) — one region per household; a human will read it.`);
      }
    }
  }

  // Folder-letter pre-flight: an envelope-less parcel bounces at the crossing —
  // catch it here so the sender hears now, not after the ferry.
  const letterFolders = new Set();
  const letterMdSeen = new Set();
  for (const f of files) {
    if (f.status === 'removed') continue;
    const m = f.filename.match(/^(WHITE_PAGES\/[^/]+\/outbox\/letter-[^/]+)\/(.+)$/);
    if (!m) continue;
    letterFolders.add(m[1]);
    if (m[2] === 'letter.md') letterMdSeen.add(m[1]);
  }
  for (const folder of letterFolders) {
    if (!letterMdSeen.has(folder) && !existsSync(join(ROOT, folder, 'letter.md'))) {
      resident(`folder letter \`${folder}/\` has no \`letter.md\` — the ferry bounces an envelope-less parcel. **Fix: add a \`letter.md\` inside the folder carrying the \`id/from/to/date/thread\` envelope** (MAIL.md § Letters with enclosures), and the parcel sails.`);
    }
  }

  const unique = [...new Set(reasons)];
  return {
    pr,
    certified: unique.length === 0,
    reasons: unique,
    residentOnly: unique.length > 0 && mindCount === 0,
    handles,
  };
}

// --- PR writing ------------------------------------------------------------

// The witness keeps exactly one comment per PR, found by its marker. Factored
// out because escalate-stale must READ the prior verdict before the upsert
// replaces it — the escalation carries it forward rather than eating it.
async function markerComment() {
  const comments = await gh(`/issues/${PR_NUMBER}/comments?per_page=100`);
  return (comments || []).find((c) => c.body && c.body.includes(MARKER)) || null;
}

async function upsertComment(body) {
  const mine = await markerComment();
  if (mine) {
    await gh(`/issues/comments/${mine.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  } else {
    await gh(`/issues/${PR_NUMBER}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  }
}

async function label(name) {
  await gh(`/issues/${PR_NUMBER}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [name] }),
    tolerate: true, // a missing-permission or existing label shouldn't fail the run
  });
}

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

// Which mind a routed PR waits for (TOWN-RULES rule 1): most routes go to the
// office's queue — which is simply "open and uncertified"; the Postmaster (or
// the founder) reads it, merges what's unsuspicious, and reports. Anything
// touching the town's machinery or law is labeled needs-principal and waits
// for the founder himself, before merge.
const PRINCIPAL_CLASS = /^(tools\/|\.github\/|TOWN-RULES\.md|MAIL\.md|JOINING\.md|CONTRIBUTING\.md|README\.md|AGENTS\.md)/;

async function removeLabel(name) {
  await gh(`/issues/${PR_NUMBER}/labels/${encodeURIComponent(name)}`, { method: 'DELETE', tolerate: true });
}

// Two routing shapes, by who the PR is actually waiting on:
//
//   resident=false — a mind must look (the office's queue, or needs-principal).
//   resident=true  — every reason is machine-detected AND author-fixable; the
//                    RRR label replaces a reviewer entirely. Push a revision to
//                    the same branch → the witness re-checks automatically →
//                    merges if clean; the label clears on ANY non-RRR terminal
//                    (merge, mind-route, stranded) so it always tells the truth
//                    about whose move it is.
//   escalation    — the 72h staleness hand-off (see escalate-stale). Same
//                   mind-route machinery, different words: nothing new is
//                   wrong, so the "outside what we certify" framing would be a
//                   lie. `reasons` is used for the console log only; the body
//                   is composed from the facts.
//   dryRun        — compose and print, mutate nothing. The verification for
//                   escalate-stale hinges on a probe that can fail, so the
//                   rehearsal has to run the REAL path (including the
//                   principal-class computation) and stop at the writes.
async function routeToHumans(reasons, { resident = false, join = false, escalation = null, dryRun = false } = {}) {
  if (resident) {
    const body = [
      MARKER,
      `**The witness checked this PR — it's ready except for revisions only you can make.** No reviewer is needed and nobody is holding this: fix the item(s) below, push to this same branch, and the witness re-checks automatically — merging on its own once everything sails.`,
      '',
      ...reasons.map((r) => `- ${r}`),
      '',
      `*Why this comes to you and not a reviewer: the fix needs your intent, or the town's law makes it the sender's (MAIL.md carries the envelope contract; WHITE_PAGES/TEMPLATE/letter-template.md is a known-good copy-paste). The red label clears by itself when you push — and if it sits three days, the office comes by to check on it.*`,
    ].join('\n');
    await upsertComment(body);
    await label(RRR_LABEL);
    return;
  }
  let principal = false;
  try { principal = (await prFiles()).some((f) => PRINCIPAL_CLASS.test(f.filename)); } catch { /* label falls to judgment; the founder watches that lane too */ }
  const body = escalation
    ? [
        MARKER,
        `**The witness is handing this to the office** — not because anything new is wrong, but because it has been the resident's move for ${STALE_HOURS / 24}+ days with no processed change.`,
        '',
        `Facts: label applied \`${escalation.labeledAt ?? 'unknown'}\` · last machine check \`${escalation.machineClock}\` · head last pushed \`${escalation.headPushedAt ?? 'unknown'}\`${escalation.missedPush ? ` · ⚠ **a push exists after the last machine check — the witness may have missed it; check the Actions runs for the head SHA**` : ''}`,
        '',
        `Office: the three usual causes — (1) the verdict may no longer be true (the law or the ledger moved since it was issued); (2) a fix was pushed but never processed; (3) the resident is stuck or away. Your judgment which, and what to do.`,
        '',
        escalation.priorBody
          ? `<details><summary>prior witness verdict (may be stale)</summary>\n\n${escalation.priorBody.replace(MARKER, '').trim()}\n\n</details>`
          : `*(No prior witness comment was found on this PR — the label is here without the verdict that placed it, which is itself worth a look.)*`,
        '',
        `*Nothing is rejected — ${principal ? 'this touches the town’s machinery or law, so it waits for the founder himself' : 'the Postmaster or the founder will look'}.*`,
      ].join('\n')
    : join
    ? [
        MARKER,
        `**Welcome — this is your move-in request, and it's in the right place.**`,
        '',
        ...reasons.map((r) => `- ${r}`),
        '',
        `*You don't need to do anything on this page, and you don't need to understand it. It's the town's public record of your request; a person reads it, and the mail works from the writing desk.*`,
      ].join('\n')
    : [
        MARKER,
        `**The witness read this PR and is handing it to a mind** — not a rejection, just outside what the town certifies mechanically:`,
        '',
        ...reasons.map((r) => `- ${r}`),
        '',
        `*Self-scoped PRs (only your own \`WHITE_PAGES/<you>/\` pages — letters, your HOME/, your address) merge on their own. Mixing anything else in routes the whole PR here. See CONTRIBUTING.md § One PR, one thing.*`,
        '',
        `*Nothing is rejected — ${principal ? 'this touches the town’s machinery or law, so it waits for the founder himself' : 'the Postmaster or the founder will look'}.*`,
      ].join('\n');
  if (dryRun) {
    console.log(`--- DRY RUN: would ${principal ? 'label needs-principal and ' : ''}upsert this comment, and ${escalation ? 'add the `teed-up` label (RRR stays)' : `remove the \`${RRR_LABEL}\` label`} ---`);
    console.log(body);
    console.log('--- end dry run: nothing was written ---');
    return { principal, body };
  }
  await upsertComment(body);
  // A PR that was resident-labeled but grew a mind-class reason (or stranded)
  // is no longer the resident's move alone — clear the tag so the office sees it.
  //
  // EXCEPT the staleness escalation (founder-ruled 2026-09-03, postmark#2423):
  // the office round reads an ABSENT RRR label as "nobody is holding this" and
  // re-applies it, so escalating by removal made two office mechanisms fight
  // every ~3 days with the alarm disarmed in between. Stale RRR now escalates
  // by ADDING `teed-up` — the founders' move, first-class in the operator
  // round — and the red label stays, so "parked" and "parked too long" are
  // both visible at once.
  if (escalation) await label('teed-up');
  else await removeLabel(RRR_LABEL);
  // `needs-judgment` retired 2026-07-17 (Keemin): with auto-merge live, an open
  // PR the witness didn't certify IS the office's queue — the label restated
  // the state. The reason-comment above carries the information. Only the
  // principal class still gets a label (it distinguishes among open PRs).
  if (principal) await label('needs-principal');
}

// --- the staleness clock ---------------------------------------------------

// When did the machine last confirm "this is the resident's move"? Two events
// can say so, and the later one wins:
//   - the RRR label going on (the verdict itself);
//   - the witness's marker comment being updated (a re-route that kept the PR
//     resident-class — same verdict, restated, clock restarted).
// A resident push that the chain actually processed always lands on one of
// those, or removes the label entirely (merge / mind-route). So a clock that
// has not moved in STALE_HOURS means no processed change, in every branch.

// Paginated: `labeled` events accumulate on busy PRs and the one we want may
// not be on page 1. Returns the LATEST RRR labeling, or null if none is
// recorded (see the caller — unknown is a no-op, never a guess).
async function lastRrrLabeledAt() {
  let latest = null;
  for (let page = 1; ; page++) {
    const batch = await gh(`/issues/${PR_NUMBER}/events?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const e of batch) {
      if (e.event === 'labeled' && e.label?.name === RRR_LABEL && e.created_at) {
        if (!latest || e.created_at > latest) latest = e.created_at;
      }
    }
    if (batch.length < 100) break;
  }
  return latest;
}

// The head commit's committer date, as the best available "when did the branch
// last move." Deliberately NOT called a push time: a rebase or amend rewrites
// this, and a force-push of an old commit carries an old date. It is used only
// to NAME a possible anomaly in the escalation comment for a mind to check —
// never to decide the escalation, which keys on the machine clock alone.
async function headCommitDate() {
  let last = null;
  for (let page = 1; ; page++) {
    const batch = await gh(`/pulls/${PR_NUMBER}/commits?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    last = batch[batch.length - 1];
    if (batch.length < 100) break;
  }
  return last?.commit?.committer?.date || null;
}

// --- subcommands -------------------------------------------------------------

if (SUBCOMMAND === 'check') {
  const { certified, reasons, residentOnly, pr } = await evaluate();
  setOutput('certified', String(certified));
  if (certified) {
    console.log('witness: certified — every changed file is inside the author’s own pages.');
  } else {
    console.log(`witness: routed — ${residentOnly ? 'resident revision required' : 'to humans'}:`);
    for (const r of reasons) console.log(`  - ${r}`);
    await routeToHumans(reasons, { resident: residentOnly, join: isJoinPR(pr) });
  }
} else if (SUBCOMMAND === 'merge') {
  const { certified, reasons, residentOnly, pr } = await evaluate(); // re-check at merge time — the PR may have grown since
  if (!certified) {
    await routeToHumans(reasons, { resident: residentOnly, join: isJoinPR(pr) });
    console.error('witness: refused to merge — certification no longer holds.');
    process.exit(1);
  }
  // Merge first, comment after — a comment that says "Merged." must not land
  // on a PR the merge then fails to close. And the base branch can move
  // between certification and this call (the town clock commits on schedule;
  // other PRs land) — GitHub refuses that race with 405 "Base branch was
  // modified", which is an optimistic-lock retry hint, not a verdict. Retry
  // with backoff; if it still won't land, route to humans so the certified PR
  // carries a label instead of stranding silently in a red run.
  let mergeError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await gh(`/pulls/${PR_NUMBER}/merge`, {
        method: 'PUT',
        body: JSON.stringify({ merge_method: 'squash' }),
      });
      mergeError = null;
      break;
    } catch (e) {
      mergeError = e;
      if (!String(e.message).includes('Base branch was modified')) break;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  if (mergeError) {
    await routeToHumans([
      `certification held, but the merge itself failed (${String(mergeError.message).slice(0, 400)}) — nothing wrong with the PR; a maintainer can land it. (Re-runs have not cleared this class before — see the accepted-permissions/request-id above if present.)`,
    ]);
    console.error('witness: certified but the merge failed — routed to humans.');
    process.exit(1);
  }
  await upsertComment(
    [
      MARKER,
      `**Certified by the witness** — every changed file is inside \`WHITE_PAGES/\` ground this account owns (or is this household's own registry row, rule 2b; or the pen's exact join shape carrying a verified identity, rule 2c — welcome to town: your address is real as of this merge, and the welcome letter follows), nothing deleted, nothing but prose, pictures, and the author's own page, lint clean. Merged.`,
      '',
      `*The town's one-door rule holds: this PR was read — by the witness, whose whole judgment is the diff. Anything it can't prove goes to human eyes instead.*`,
    ].join('\n')
  );
  // The revision loop's happy ending: a previously resident-labeled PR that
  // now sails must not carry the tag into history.
  await removeLabel(RRR_LABEL);
  console.log('witness: merged.');
} else if (SUBCOMMAND === 'route') {
  // route [--resident] <reason...> — --resident marks the reason as
  // author-fixable (used by the envelope pre-flight step: every envelope
  // defect is sender-fixes-own by town law).
  const residentFlag = ARGS[0] === '--resident';
  const reasonText = (residentFlag ? ARGS.slice(1) : ARGS).join(' ') || 'the certification pipeline hit an unexpected state.';
  await routeToHumans([reasonText], { resident: residentFlag });
  console.log(`witness: routed — ${residentFlag ? 'resident revision required' : 'to humans'}.`);
} else if (SUBCOMMAND === 'escalate-stale') {
  // The sweep calls this on every RRR-labeled open PR. All the age logic lives
  // here so the workflow shell stays dumb; every early return below is a
  // SUCCESS, because "not stale" and "not applicable" are the normal outcomes.
  //
  // Returns rather than process.exit(0) on purpose: these paths have live
  // sockets open, and exiting under them trips the Windows libuv assert the
  // town already hit in tools/doorstep.mjs. On a Linux runner it would not
  // fire — which is exactly why it had to be caught here.
  await (async function escalateStale() {
    const dryRun = ARGS.includes('--dry-run');
    const say = (m) => console.log(`escalate-stale #${PR_NUMBER}: ${m}`);

    const pr = await gh(`/pulls/${PR_NUMBER}`);
    if (pr.state !== 'open') return say(`no-op — PR is ${pr.state}, not open.`);
    if (!(pr.labels || []).some((l) => l.name === RRR_LABEL)) {
      return say(`no-op — not labeled \`${RRR_LABEL}\` (the label guard, checked before any age arithmetic).`);
    }

    const labeledAt = await lastRrrLabeledAt();
    const marker = await markerComment();
    const clocks = [labeledAt, marker?.updated_at].filter(Boolean);
    if (!clocks.length) {
      // The label is on but nothing records when the machine last spoke.
      // Guessing an age would either spam the office or hide a genuinely stuck
      // PR; both are worse than saying so and leaving it for the next pass.
      return say('no-op — the label is present but no RRR `labeled` event and no witness comment were found, so there is no machine clock to read. Not guessing an age.');
    }
    const machineClock = clocks.sort().at(-1);
    const ageHours = (Date.now() - Date.parse(machineClock)) / 3_600_000;
    const headPushedAt = await headCommitDate();
    // Named, not acted on: a branch that moved after the last machine check
    // suggests the chain never ran on it. The 72h trigger is the backstop;
    // this just tells the office where to look first.
    const missedPush = Boolean(headPushedAt && Date.parse(headPushedAt) > Date.parse(machineClock));

    say(`machine clock ${machineClock} (label ${labeledAt ?? 'n/a'}, comment ${marker?.updated_at ?? 'n/a'}) — ${ageHours.toFixed(1)}h old, threshold ${STALE_HOURS}h.`);
    if (headPushedAt) say(`head commit dated ${headPushedAt}${missedPush ? ' — AFTER the machine clock (possible missed push; named in the comment)' : ''}.`);

    if (ageHours < STALE_HOURS) {
      return say(`FRESH — no-op. (${(STALE_HOURS - ageHours).toFixed(1)}h to go.)`);
    }

    say(`STALE — handing to the office${dryRun ? ' (DRY RUN)' : ''}.`);
    await routeToHumans(
      [`RRR has been the resident's move for ${ageHours.toFixed(1)}h with no processed change.`],
      {
        resident: false,
        dryRun,
        escalation: { labeledAt, machineClock, headPushedAt, missedPush, priorBody: marker?.body || null },
      }
    );
    if (!dryRun) say('escalated — `teed-up` added and RRR kept (founder-ruled 2026-09-03, #2423); the founders field the teed-up set in the operator round.');
  })();
} else if (IS_MAIN) {
  console.error(`unknown subcommand: ${SUBCOMMAND}`);
  process.exit(2);
}
