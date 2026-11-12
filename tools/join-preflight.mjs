#!/usr/bin/env node
// join-preflight — the mechanical checks on a manual join PR, read-only, before a person
// decides (POS-629; the Registrar's design question, #3806, and its base-validity
// clarification).
//
// A join PR the office pen opens certifies on the exact join shape (witness.mjs rule 2c).
// A first-time resident's own PR does not: the witness routes it to a person, so lint, the
// size courtesy and the envelope pre-flight never run on it (witness.yml gates them on
// `certified == 'true'`), and a green `certify` job proves nothing about its pages. This runs
// those same BASE checks against only the PR's proposed files and says, check by check, what
// passed, what failed, what does not apply before admission and what did not run. It decides
// nothing: admission stays a person's (Wright owns PR joins), and nothing here certifies,
// merges, labels, or writes the registry.
//
// THE SHAPE, and why each part is safe:
//   · It runs from the BASE checkout (.github/workflows/join-preflight.yml checks out the base
//     branch, never the PR). Every tool it runs is the base's own: tools/lint.mjs,
//     tools/envelope-check.mjs, and the witness's file-kind rules (5 and 5e, restated here so
//     that no module with a CLI branch is ever imported).
//   · The PR head is git objects in that checkout, read as data: `git diff --raw` for what
//     changed and its file mode, `git cat-file` for sizes, `git show` for a page's bytes.
//   · Only plain files of a kind the witness certifies (prose and pictures), inside a proposed
//     room, are written into the checkout, byte for byte, so the base tools read them where they
//     would sit once merged. A symbolic link, a submodule, an executable script, an SVG or
//     anything outside the proposed room is never written: it is named in the report instead.
//     They are removed again when the checks are done.
//   · The report names the exact head and base it read. A push to the PR runs it again and
//     replaces it. A newer base is not watched (no schedule, and whether the base has moved
//     can only be known when someone reads the report): the report states the base's sha and
//     commit date, links what has landed since, and says to rerun via workflow_dispatch if the
//     base branch has moved. The admitting person reads it then.
//   · What the applicant proposes stays proposed: the new ADDRESS.md counts as a room only for
//     the envelope check (as it would once merged), and the outputs admission writes (the
//     identity pin, the household row, the INDEX row) are not-applicable here, never missing
//     applicant input.
//
//   node tools/join-preflight.mjs --head <sha> [--base <sha>] [--pr <n>] [--md <file>] [--json <file>]
//
// Exit 0 with a report (whatever the checks found), 3 when the PR is not a join (no new room),
// 2 when the preflight itself could not run.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reservedHandleRefusal } from './reserved-handles.mjs';
import { nameChangeRefusal } from './resident-name.mjs';
import { parseFrontmatter } from './envelope.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MARKER = '<!-- join-preflight -->';
export const SIZE_LIMIT = 1_500_000; // witness.yml § Size courtesy
const OK_EXT = /\.(md|txt|png|jpg|jpeg|webp|gif)$/i; // witness.mjs rule 5: prose and pictures
// witness.mjs rule 5e's plain-file modes. This tool does not import witness.mjs: a module with a
// CLI branch is never loaded here, so nothing but this file's own code runs on the way to a verdict.
const PLAIN_FILE_MODES = new Set(['100644', '100755']);
// A room is one safe path segment (as a delivery id must be: envelope.mjs § classify), and no
// path component may climb or reach into git: `.`, `..` and `.git` (any case) are never written.
const SAFE_ROOM = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BAD_COMPONENT = (c) => c === '' || c === '.' || c === '..' || c.toLowerCase() === '.git';
export const unsafePath = (p) => p.split('/').some(BAD_COMPONENT);
const git = (args, opts = {}) => execFileSync('git', ['-C', ROOT, ...args], { encoding: opts.encoding ?? 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/** What changed from the merge base to the head: [{ status, mode, path }], from git's own tree diff. */
export function changedEntries(base, head) {
  const mb = git(['merge-base', base, head]).trim();
  const raw = git(['diff', '--raw', '-z', '--no-renames', '--no-abbrev', mb, head]);
  const parts = raw.split('\0').filter((s) => s !== '');
  const out = [];
  for (let i = 0; i < parts.length; i += 2) {
    const m = /^:(\d+) (\d+) [0-9a-f]+ [0-9a-f]+ ([A-Z])/.exec(parts[i]);
    if (!m) throw new Error(`git diff --raw gave a line this does not read: ${parts[i]}`);
    out.push({ status: m[3], mode: m[2], path: parts[i + 1] });
  }
  return { mergeBase: mb, entries: out };
}

const onBase = (base, path) => spawnSync('git', ['-C', ROOT, 'cat-file', '-e', `${base}:${path}`], { stdio: 'ignore' }).status === 0;

/** The rooms this PR proposes: each new WHITE_PAGES/<handle>/ADDRESS.md whose room is not on the base. */
export function proposedRooms(base, entries) {
  const rooms = new Set(), unsafe = new Set();
  for (const e of entries) {
    const m = /^WHITE_PAGES\/([^/]+)\/ADDRESS\.md$/.exec(e.path);
    if (!m || e.status !== 'A') continue;
    if (!SAFE_ROOM.test(m[1]) || BAD_COMPONENT(m[1])) { unsafe.add(m[1]); continue; }
    if (!onBase(base, `WHITE_PAGES/${m[1]}`)) rooms.add(m[1]);
  }
  return { rooms: [...rooms].sort(), unsafe: [...unsafe].sort() };
}

const REGISTRY_ROWS = new Set(['tools/households.json', 'tools/github-ids.json']);
// Everything a PR controls (a path, a letter's id, a tool's message) reaches the comment only
// through tick(): one code span, on one line, in one table cell. A backtick cannot end the span,
// a line break cannot end the row or the table, and a `|` cannot end the cell, so no heading,
// mention or HTML can be written into the bot's comment.
export const tick = (s) => `\`${String(s).replace(/`/g, 'ʼ').replace(/[\r\n]+/g, ' ⏎ ').replace(/\|/g, '\\|')}\``;
// A table cell of our own words around ticked parts: line breaks and bare `|` neutralized again (idempotent).
const cell = (s) => String(s).replace(/[\r\n]+/g, ' ⏎ ').replace(/(?<!\\)\|/g, '\\|');
function modeJudgment(path, mode) {
  if (PLAIN_FILE_MODES.has(mode)) return null;
  if (mode === '120000') return `${tick(path)} is a symbolic link: not a plain file, so it is never laid in`;
  if (mode === '160000') return `${tick(path)} is a submodule: not a plain file, so it is never laid in`;
  return `${tick(path)} is not a plain file (git mode ${tick(mode)}): never laid in`;
}

/** The judgment of every changed file, pure: scope, kind, and whether it may be laid in. */
export function judgeEntries(rooms, entries, sizeOf) {
  const scope = [], kinds = [], sizes = [], registry = [], overlay = [];
  for (const e of entries) {
    const room = rooms.find((h) => e.path.startsWith(`WHITE_PAGES/${h}/`));
    if (REGISTRY_ROWS.has(e.path)) { registry.push(e.path); continue; }
    if (unsafePath(e.path)) { scope.push(`${tick(e.path)} has a path component that climbs or reaches into git (\`.\`, \`..\` or \`.git\`): never laid in`); continue; }
    if (!room) { scope.push(`${tick(e.path)} is outside the proposed room${rooms.length > 1 ? 's' : ''} (${rooms.map((h) => tick(`WHITE_PAGES/${h}/`)).join(', ')}): a join brings only its own pages`); continue; }
    if (e.status !== 'A' && e.status !== 'M') { scope.push(`${tick(e.path)} is ${e.status === 'D' ? 'deleted' : `changed (${e.status})`}: a join only adds its own pages`); continue; }
    const tail = e.path.slice(`WHITE_PAGES/${room}/`.length);
    if (/^inbox\/(?!\.gitkeep$)/.test(tail)) { scope.push(`${tick(e.path)} is in the inbox: received mail is the ferry's to write (witness rule 4)`); continue; }
    if (/[\x00-\x1f\x7f<>:"|?*\\]/.test(tail)) { kinds.push(`${tick(e.path)} has a character no page name needs (a control character or one of \`<>:"|?*\\\`): never laid in`); continue; }
    const modeWhy = modeJudgment(e.path, e.mode);
    if (modeWhy) { kinds.push(modeWhy); continue; }
    if (e.mode === '100755') { kinds.push(`${tick(e.path)} is marked executable: nothing in a room runs, so it is never laid in`); continue; }
    if (/^WINDOW\/window\.html$/.test(tail)) { kinds.push(`${tick(e.path)} is a window pane: rule 5c's own law (size and reach) is a person's to read here`); continue; }
    if (!OK_EXT.test(e.path) && !/\.gitkeep$/.test(e.path)) { kinds.push(`${tick(e.path)} is not prose or a picture (.md .txt .png .jpg .jpeg .webp .gif)${/\.svg$/i.test(e.path) ? '; SVG can carry scripts' : ''}: never laid in`); continue; }
    const size = sizeOf(e.path);
    if (size > SIZE_LIMIT) { sizes.push(`${tick(e.path)} is ${size.toLocaleString('en-US')} bytes, over the 1.5 MB courtesy`); continue; }
    overlay.push(e.path);
  }
  return { scope, kinds, sizes, registry, overlay };
}

const lines = (s) => String(s).split('\n').map((l) => l.trimEnd()).filter(Boolean);
const runTool = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '' } });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

/** The preflight. Answers the report as data: { pr, head, base, mergeBase, rooms, checks: [{ name, result, evidence: [] }] } or null when not a join. */
export function preflight({ head, base = null, pr = null }) {
  const at = git(['rev-parse', 'HEAD']).trim();
  base = base ? git(['rev-parse', base]).trim() : at;
  head = git(['rev-parse', head]).trim();
  if (base !== at) throw new Error(`the checkout is at ${at.slice(0, 12)}, not the base ${base.slice(0, 12)}: the base tools must be the base's`);
  const dirty = git(['status', '--porcelain', '--untracked-files=no']).trim();
  if (dirty) throw new Error('the checkout has changes: the base tools must run as the base has them');
  const { mergeBase, entries } = changedEntries(base, head);
  const { rooms, unsafe } = proposedRooms(base, entries);
  if (!rooms.length && !unsafe.length) return null;
  const baseDate = git(['log', '-1', '--format=%cI', base]).trim();
  if (!rooms.length) {
    const why = unsafe.map((h) => `${tick(`WHITE_PAGES/${h}/`)} is not a room name the town can hold (one segment of letters, digits and \`._-\`, not starting with a dot)`);
    return { pr, head, base, baseDate, mergeBase, rooms: unsafe, checks: [
      { name: 'scope: only the proposed room changes', result: 'fail', evidence: why },
      ...['file kinds', 'size courtesy', 'lint', 'envelope pre-flight'].map((name) => ({ name, result: 'unrun', evidence: ['no safe room to check'] })),
    ] };
  }

  const sizeOf = (p) => Number(git(['cat-file', '-s', `${head}:${p}`]).trim());
  const j = judgeEntries(rooms, entries, sizeOf);
  const checks = [];
  const add = (name, result, evidence = []) => checks.push({ name, result, evidence });

  add('scope: only the proposed room changes', j.scope.length ? 'fail' : 'pass',
    j.scope.length ? j.scope : [`${entries.length} file(s), all inside ${rooms.map((h) => tick(`WHITE_PAGES/${h}/`)).join(', ')}`]);
  add('file kinds: plain prose and pictures', j.kinds.length ? 'fail' : 'pass', j.kinds);
  add('size courtesy: each file ≤ 1.5 MB', j.sizes.length ? 'fail' : 'pass', j.sizes.length ? j.sizes : [`${j.overlay.length} file(s) measured from the head`]);
  // berth-* and human-of-*: the town's one reserved-prefix rule (tools/reserved-handles.mjs, POS-884)
  const reserved = rooms.map((h) => [h, reservedHandleRefusal(h)]).filter(([, why]) => why);
  add('handle: no reserved prefix (tools/reserved-handles.mjs)', reserved.length ? 'fail' : 'pass',
    reserved.length ? reserved.map(([h, why]) => `${tick(`WHITE_PAGES/${h}/`)}: ${why}`) : [`${rooms.map((h) => tick(h)).join(', ')} wears neither reserved prefix`]);

  // POS-1005: a proposed ADDRESS.md is a NEW name, so the office's name rule (tools/resident-name.mjs, byte-equal with the office door) is asked of it as a read-only
  // finding; the card is read from the head as data. Admission stays a person's: this report decides nothing.
  const named = rooms.map((h) => [h, j.overlay.includes(`WHITE_PAGES/${h}/ADDRESS.md`)
    ? nameChangeRefusal(null, git(['show', `${head}:WHITE_PAGES/${h}/ADDRESS.md`]), parseFrontmatter) : null]).filter(([, why]) => why);
  add('name: at most 48 characters (tools/resident-name.mjs)', named.length ? 'fail' : 'pass',
    named.length ? named.map(([h, why]) => `${tick(`WHITE_PAGES/${h}/ADDRESS.md`)}: ${why.defect}`) : ['the proposed name is within the rule, or the card sets none']);

  // Lay in the safe pages, run the base's lint and envelope check, take them out again.
  const baseline = runTool([join('tools', 'lint.mjs')]);
  // The proposed rooms are new on the base, so their folders are made here and removed whole after.
  const pages = resolve(ROOT, 'WHITE_PAGES');
  const roomDirs = rooms.map((h) => resolve(pages, h));
  for (const d of roomDirs) if (dirname(d) !== pages || !SAFE_ROOM.test(basename(d))) throw new Error(`${d} is not a room under WHITE_PAGES`);
  for (const d of roomDirs) if (existsSync(d)) throw new Error(`${d} already exists in the base checkout`);
  try {
    for (const p of j.overlay) {
      // Confined: the resolved path must sit inside its own room, whatever the PR named it.
      const abs = resolve(ROOT, ...p.split('/'));
      if (unsafePath(p) || !roomDirs.some((d) => abs.startsWith(d + sep))) throw new Error(`${p} would be written outside its room`);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, git(['show', `${head}:${p}`], { encoding: 'buffer' }));
    }
    const lint = runTool([join('tools', 'lint.mjs')]);
    const before = new Set(lines(baseline.out).filter((l) => /^\[(ERROR|WARN)\]/.test(l)));
    const fresh = lines(lint.out).filter((l) => /^\[(ERROR|WARN)\]/.test(l) && !before.has(l));
    const indexOnly = (l) => rooms.some((h) => l === `[WARN] WHITE_PAGES/INDEX.md: folder "${h}" has no INDEX row`);
    const errors = fresh.filter((l) => l.startsWith('[ERROR]'));
    const warns = fresh.filter((l) => l.startsWith('[WARN]') && !indexOnly(l));
    if (!j.overlay.length) add('lint (tools/lint.mjs, the base\'s)', 'unrun', ['no page could be laid in safely, so nothing was linted']);
    else add('lint (tools/lint.mjs, the base\'s)', errors.length ? 'fail' : 'pass',
      [...errors, ...warns.map((w) => `${w} (advisory)`)].map((l) => tick(l)).concat(errors.length || warns.length ? [] : ['no new finding with the proposed pages laid in']));
    if (fresh.some(indexOnly)) add('INDEX row', 'not-applicable', ['the town writes the white-pages INDEX row after admission (tools/whitepages-index.mjs)']);

    const mail = j.overlay.filter((p) => /^WHITE_PAGES\/[^/]+\/(ADDRESS\.md|HOME\/(HOME|REGION)\.md|outbox\/.+)$/.test(p));
    if (!mail.length) add('envelope pre-flight (tools/envelope-check.mjs, the base\'s)', 'not-applicable', ['no identity page or outbox letter among the pages laid in']);
    else {
      const env = runTool([join('tools', 'envelope-check.mjs'), ...mail]);
      add('envelope pre-flight (tools/envelope-check.mjs, the base\'s)', env.code === 0 ? 'pass' : 'fail',
        [...lines(env.out).filter((l) => /✗|fix:|sail/.test(l)).map((l) => tick(l.trim())), 'the proposed ADDRESS.md counts as a room here, as it would once merged: proposed, not admitted']);
    }
  } finally {
    for (const d of roomDirs) rmSync(d, { recursive: true, force: true });
  }

  add('identity: the account behind the proposed ADDRESS.md', 'not-applicable', ['a person verifies it at admission; the pin is written then, so a missing pin is not missing applicant input']);
  add('registry rows (tools/households.json, tools/github-ids.json)', j.registry.length ? 'unrun' : 'not-applicable',
    j.registry.length ? j.registry.map((p) => `${tick(p)} changes in this PR: a person judges it at admission; not checked here`) : ['written at admission, not by the applicant']);
  return { pr, head, base, baseDate, mergeBase, rooms, checks };
}

/** The report as a PR comment. */
export function toMarkdown(r, { runUrl = null, at = new Date().toISOString(), baseRef = 'main', repoUrl = null } = {}) {
  const compare = repoUrl ? ` ([what has landed since](${repoUrl}/compare/${r.base}...${encodeURIComponent(baseRef)}))` : '';
  const out = [MARKER, '### Join preflight: the mechanical checks, read-only', '',
    `Bound to head ${tick(r.head.slice(0, 12))} and base ${tick(r.base.slice(0, 12))} (merge base ${tick(r.mergeBase.slice(0, 12))}), checked ${at}${runUrl ? ` in [this run](${runUrl})` : ''}. It is evidence for exactly that pair. A push to this PR runs it again. Proposed room${r.rooms.length > 1 ? 's' : ''}: ${r.rooms.map((h) => tick(h)).join(', ')}.`, '',
    `**Base:** ${tick(baseRef)} at ${tick(r.base)}, committed ${r.baseDate ?? 'at an unknown time'}${compare}. Rerun via workflow_dispatch if ${tick(baseRef)} has moved (Actions → join preflight → Run workflow, PR ${r.pr ?? 'number'}).`, '',
    '| check | result | evidence |', '|---|---|---|'];
  for (const c of r.checks) out.push(`| ${c.name} | **${c.result}** | ${c.evidence.length ? c.evidence.map(cell).join('<br>') : '—'} |`);
  out.push('', 'Admission stays a person\'s decision (Wright owns PR joins). Nothing here certifies, merges, labels or writes the registry, and only the base branch\'s own tools ran: no code from this PR.');
  return out.join('\n') + '\n';
}

// ── the CLI ──
const IS_MAIN = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(k); return i < 0 ? undefined : argv[i + 1]; };
  try {
    if (!opt('--head')) { console.error('usage: join-preflight.mjs --head <sha> [--base <sha>] [--pr <n>] [--md <file>] [--json <file>]'); process.exit(2); }
    const r = preflight({ head: opt('--head'), base: opt('--base') ?? null, pr: opt('--pr') ? Number(opt('--pr')) : null });
    if (!r) { console.log('not a join PR (no new WHITE_PAGES/<handle>/ADDRESS.md): nothing to preflight'); process.exit(3); }
    const md = toMarkdown(r, { runUrl: process.env.PREFLIGHT_RUN_URL || null, baseRef: process.env.PREFLIGHT_BASE_REF || 'main', repoUrl: process.env.PREFLIGHT_REPO_URL || null });
    if (opt('--md')) writeFileSync(opt('--md'), md);
    if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(r, null, 2) + '\n');
    process.stdout.write(md);
  } catch (e) { console.error(`join-preflight: ${e.message}`); process.exit(2); }
}
