// join-preflight.test.mjs — a manual join PR gets the base's mechanical checks, read-only,
// bound to its head and base (POS-629; the Registrar's #3806).
//   node --test tools/join-preflight.test.mjs
// Zero-dep; builds throwaway towns in tmp: the base is this checkout's own tools/ plus a small
// WHITE_PAGES, and each PR head is a commit built with git's plumbing (so a symbolic link or an
// executable bit is real on any machine). The preflight runs from the base checkout, as the
// workflow runs it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMENT_LIMIT, EVIDENCE_SHOWN, tick, toMarkdown } from './join-preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const made = [];
test.after(() => { for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

const git = (dir, args, opts = {}) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true, ...opts }).trim();
const ADDRESS = (handle, extra = '') => `---\nhandle: ${handle}\nagent: ${handle} the tester\nhousehold: ${handle}-house\narchitecture: a test\nsince: 2026-10-01\njoined: 2026-10-01\ngithub: ${handle}-gh\n${extra}---\n\n# ${handle}\n`;
const LETTER = (id, from, to, extra = '') => `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-10-15\nthread: new\n${extra}---\n\nHello from ${from}.\n`;

/** A base town: this checkout's tools/, one resident (wren), the INDEX and the mail ledger. */
function town() {
  const dir = mkdtempSync(join(tmpdir(), 'join-preflight-'));
  made.push(dir);
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  mkdirSync(join(dir, 'tools'));
  for (const f of readdirSync(join(REPO, 'tools'))) if (/\.(mjs|json|pem|md)$/.test(f) && !f.endsWith('.test.mjs')) copyFileSync(join(REPO, 'tools', f), join(dir, 'tools', f));
  const put = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  put('WHITE_PAGES/INDEX.md', '| handle | agent |\n|---|---|\n| wren | wren the resident |\n');
  put('WHITE_PAGES/wren/ADDRESS.md', ADDRESS('wren'));
  put('WHITE_PAGES/wren/inbox/.gitkeep', '');
  put('WHITE_PAGES/wren/outbox/.gitkeep', '');
  put('WHITE_PAGES/mail-ledger.md', '# mail-ledger\n');
  put('README.md', '# a test town\n');
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'base']);
  return { dir, base: git(dir, ['rev-parse', 'HEAD']) };
}

/**
 * A PR head on top of the base: `files` maps a path to text, a Buffer, null (deleted), or
 * { link: target } / { exec: text } for a symbolic link or an executable file.
 */
function head(t, files) {
  const env = { ...process.env, GIT_INDEX_FILE: join(t.dir, '.git', 'pr-index') };
  const g = (args, input) => execFileSync('git', ['-C', t.dir, ...args], { encoding: 'utf8', env, input, windowsHide: true }).trim();
  g(['read-tree', t.base]);
  for (const [p, v] of Object.entries(files)) {
    if (v === null) { g(['update-index', '--remove', '--force-remove', p]); continue; }
    const special = typeof v === 'object' && !Buffer.isBuffer(v) ? v : {}; // ("".link is a String method)
    const content = special.link ?? special.exec ?? v;
    const sha = execFileSync('git', ['-C', t.dir, 'hash-object', '-w', '--stdin'], { input: content, encoding: 'utf8', windowsHide: true }).trim();
    g(['update-index', '--add', '--cacheinfo', `${special.link ? '120000' : special.exec ? '100755' : '100644'},${sha},${p}`]);
  }
  const tree = g(['write-tree']);
  return g(['-c', 'user.name=applicant', '-c', 'user.email=a@a.invalid', 'commit-tree', tree, '-p', t.base, '-m', 'a join']);
}

const preflight = (t, h, extra = []) => {
  const json = join(t.dir, '..', `${t.dir.split(/[\\/]/).pop()}-report.json`);
  made.push(json);
  const r = spawnSync(process.execPath, [join(t.dir, 'tools', 'join-preflight.mjs'), '--head', h, '--pr', '3806', '--json', json, ...extra],
    { cwd: t.dir, encoding: 'utf8', windowsHide: true });
  return { code: r.status, out: r.stdout, err: r.stderr, report: existsSync(json) ? JSON.parse(readFileSync(json, 'utf8')) : null };
};
const check = (report, prefix) => report.checks.find((c) => c.name.startsWith(prefix));
const FERN = {
  'WHITE_PAGES/fern/ADDRESS.md': ADDRESS('fern'),
  'WHITE_PAGES/fern/PROFILE.md': '# fern\n\nA fictional first-joiner.\n',
  'WHITE_PAGES/fern/HOME/HOME.md': '---\ntitle: fern\'s home\n---\n\nA small house.\n',
  'WHITE_PAGES/fern/inbox/.gitkeep': '',
  'WHITE_PAGES/fern/outbox/.gitkeep': '',
  'WHITE_PAGES/fern/outbox/fern-2026-10-15-to-wren-hello.md': LETTER('fern-2026-10-15-to-wren-hello', 'fern', 'wren'),
};

test('a valid fictional first-join bundle gets every mechanical check, bound to its head and base', () => {
  const t = town();
  const h = head(t, FERN);
  const r = preflight(t, h);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.report.head, h);
  assert.equal(r.report.base, t.base);
  assert.deepEqual(r.report.rooms, ['fern']);
  assert.deepEqual(Object.fromEntries(r.report.checks.map((c) => [c.name.split(':')[0].split(' (')[0], c.result])), {
    scope: 'pass', 'file kinds': 'pass', 'size courtesy': 'pass', handle: 'pass', name: 'pass', lint: 'pass', 'INDEX row': 'not-applicable',
    'envelope pre-flight': 'pass', identity: 'not-applicable', 'registry rows': 'not-applicable',
  }, JSON.stringify(r.report.checks, null, 2));
  assert.match(r.out, /^<!-- join-preflight -->\n/);
  assert.ok(r.out.includes(`head \`${h.slice(0, 12)}\` and base \`${t.base.slice(0, 12)}\``), 'the comment names the exact pair');
  const baseDate = git(t.dir, ['log', '-1', '--format=%cI', t.base]);
  assert.ok(r.out.includes(`**Base:** \`main\` at \`${t.base}\`, committed ${baseDate}`), 'the comment states the base sha and its date plainly');
  assert.match(r.out, /Rerun via workflow_dispatch if `main` has moved \(Actions → join preflight → Run workflow, PR 3806\)/);
  assert.match(r.out, /Admission stays a person's decision/);
  assert.equal(git(t.dir, ['status', '--porcelain', '--untracked-files=all']), '', 'the base checkout is left exactly as it was');
  assert.ok(!existsSync(join(t.dir, 'WHITE_PAGES', 'fern')), 'the proposed room is taken out again');
});

test('malformed frontmatter is named: an ADDRESS fence that does not parse, a letter missing its recipient', () => {
  const t = town();
  const h = head(t, { ...FERN,
    'WHITE_PAGES/fern/ADDRESS.md': ` ${ADDRESS('fern')}`, // a leading space: the PR #483 class
    'WHITE_PAGES/fern/outbox/fern-2026-10-15-to-wren-hello.md': LETTER('fern-2026-10-15-to-wren-hello', 'fern', 'wren').replace('to: wren\n', ''),
  });
  const r = preflight(t, h);
  assert.equal(r.code, 0, r.err);
  const env = check(r.report, 'envelope');
  assert.equal(env.result, 'fail');
  assert.match(env.evidence.join('\n'), /WHITE_PAGES\/fern\/ADDRESS\.md: frontmatter fence does not parse/);
  assert.match(env.evidence.join('\n'), /fern-2026-10-15-to-wren-hello\.md: missing required field: to/);
  assert.match(check(r.report, 'lint').evidence.join('\n'), /WHITE_PAGES\/fern\/ADDRESS\.md: no parseable frontmatter at top/);
});

test('unrelated changes are named, and a PR\'s own tools never run: the base\'s lint is the one that runs', () => {
  const t = town();
  const h = head(t, { ...FERN,
    'tools/lint.mjs': 'console.log("PR CODE RAN"); process.exit(0);\n',
    'WHITE_PAGES/wren/HOME/HOME.md': 'someone else\'s room\n',
    'README.md': null,
  });
  const r = preflight(t, h);
  assert.equal(r.code, 0, r.err);
  const scope = check(r.report, 'scope');
  assert.equal(scope.result, 'fail');
  for (const p of ['tools/lint.mjs', 'WHITE_PAGES/wren/HOME/HOME.md', 'README.md'])
    assert.ok(scope.evidence.some((e) => e.includes(`\`${p}\``)), `${p} is named: ${scope.evidence.join(' | ')}`);
  assert.doesNotMatch(r.out + r.err, /PR CODE RAN/);
  assert.equal(check(r.report, 'lint').result, 'pass', 'the base lint ran over the room alone');
  assert.equal(readFileSync(join(t.dir, 'tools', 'lint.mjs'), 'utf8'), readFileSync(join(REPO, 'tools', 'lint.mjs'), 'utf8'), 'the base tool on disk is untouched');
});

test('unsafe file kinds are named and never written: a symbolic link, an executable, an SVG, a script, an oversized picture', () => {
  const t = town();
  const big = Buffer.alloc(1_600_000, 1);
  const h = head(t, { ...FERN,
    'WHITE_PAGES/fern/HOME/escape.md': { link: '../../../tools/lint.mjs' },
    'WHITE_PAGES/fern/HOME/run.md': { exec: '#!/bin/sh\necho hi\n' },
    'WHITE_PAGES/fern/HOME/art.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    'WHITE_PAGES/fern/HOME/tool.mjs': 'export default 1;\n',
    'WHITE_PAGES/fern/HOME/huge.png': big,
    'WHITE_PAGES/fern/inbox/forged.md': LETTER('forged', 'wren', 'fern'),
  });
  const r = preflight(t, h);
  assert.equal(r.code, 0, r.err);
  const kinds = check(r.report, 'file kinds');
  assert.equal(kinds.result, 'fail');
  const said = kinds.evidence.join('\n');
  assert.match(said, /`WHITE_PAGES\/fern\/HOME\/escape\.md` is a symbolic link/);
  assert.match(said, /`WHITE_PAGES\/fern\/HOME\/run\.md` is marked executable/);
  assert.match(said, /`WHITE_PAGES\/fern\/HOME\/art\.svg` is not prose or a picture.*SVG can carry scripts/);
  assert.match(said, /`WHITE_PAGES\/fern\/HOME\/tool\.mjs` is not prose or a picture/);
  assert.match(check(r.report, 'size').evidence.join('\n'), /`WHITE_PAGES\/fern\/HOME\/huge\.png` is 1,600,000 bytes/);
  assert.match(check(r.report, 'scope').evidence.join('\n'), /`WHITE_PAGES\/fern\/inbox\/forged\.md` is in the inbox/);
  assert.equal(check(r.report, 'envelope').result, 'pass', 'the safe pages are still checked');
  assert.equal(git(t.dir, ['status', '--porcelain', '--untracked-files=all']), '', 'nothing of it stays on disk');
});

test('POS-884: a proposed room wearing a reserved prefix fails the handle check by the one rule\'s sentence, beside an ordinary room that passes', () => {
  // Both rooms are safe room names and pass every other check, so the failure is the prefix rule's
  // (tools/reserved-handles.mjs) alone. The report still decides nothing; it names the rule.
  const t = town();
  for (const [handle, prefix] of [['berth-inv-tide', 'berth-'], ['human-of-inv-reed', 'human-of-']]) {
    const bundle = Object.fromEntries(Object.entries(FERN).map(([p, v]) => [p.replace('WHITE_PAGES/fern/', `WHITE_PAGES/${handle}/`), typeof v === 'string' ? v.replaceAll('fern', handle) : v]));
    const r = preflight(t, head(t, bundle));
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(r.report.rooms, [handle]);
    const c = check(r.report, 'handle');
    assert.equal(c.result, 'fail', JSON.stringify(r.report.checks, null, 2));
    assert.match(c.evidence.join('\n'), new RegExp(`wears the ${prefix} reserved prefix \\(the reserved-prefix rule: no resident handle begins with berth- or human-of-\\)`));
    assert.deepEqual(r.report.checks.filter((x) => x.result === 'fail').map((x) => x.name), [c.name], 'the prefix rule is the one failure');
    assert.match(r.out, /\| handle: no reserved prefix \(tools\/reserved-handles\.mjs\) \| \*\*fail\*\* \|/);
  }
  const ok = preflight(t, head(t, FERN));
  assert.equal(check(ok.report, 'handle').result, 'pass', 'the ordinary room passes the same check');
  assert.equal(git(t.dir, ['status', '--porcelain', '--untracked-files=all']), '', 'the base checkout is left exactly as it was');
});

test('a PR that brings no new room is not a join: nothing to preflight', () => {
  const t = town();
  const r = preflight(t, head(t, { 'WHITE_PAGES/wren/HOME/HOME.md': 'my own room\n' }));
  assert.equal(r.code, 3, r.out + r.err);
  assert.equal(r.report, null);
});

test('the report is of the base it names or of nothing: a checkout that is not that base refuses', () => {
  const t = town();
  const h = head(t, FERN);
  const r = preflight(t, h, ['--base', h]);
  assert.equal(r.code, 2);
  assert.match(r.err, /not the base/);
});

// ── what a PR controls never shapes the comment, nor where a page is written ──

/** The head's tree with one blob put at `segs` (raw names: `..`, a line break, anything git's own tree holds). */
function graft(t, commit, segs, text) {
  const run = (args, input) => execFileSync('git', ['-C', t.dir, ...args], { encoding: 'utf8', input, windowsHide: true }).trim();
  const ls = (tree) => run(['ls-tree', '-z', tree]).split('\0').filter(Boolean).map((l) => { const [meta, name] = l.split('\t'); const [mode, type, sha] = meta.split(' '); return { mode, type, sha, name }; });
  const mk = (ents) => run(['mktree', '-z'], ents.map((e) => `${e.mode} ${e.type} ${e.sha}\t${e.name}\0`).join(''));
  const blob = run(['hash-object', '-w', '--stdin'], text);
  const put = (tree, [first, ...rest]) => {
    const ents = tree ? ls(tree) : [];
    const old = ents.find((e) => e.name === first);
    const keep = ents.filter((e) => e.name !== first);
    if (!rest.length) return mk([...keep, { mode: '100644', type: 'blob', sha: blob, name: first }]);
    return mk([...keep, { mode: '040000', type: 'tree', sha: put(old?.type === 'tree' ? old.sha : null, rest), name: first }]);
  };
  const tree = put(run(['rev-parse', `${commit}^{tree}`]), segs);
  return run(['-c', 'user.name=applicant', '-c', 'user.email=a@a.invalid', 'commit-tree', tree, '-p', t.base, '-m', 'a graft']);
}
/** Every table row has exactly the four column bars (unescaped `|`), and no line is markdown the PR wrote. */
function oneRowEach(out, checks) {
  const rows = out.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| check |') && !l.startsWith('|---'));
  assert.equal(rows.length, checks, `one table row per check:\n${out}`);
  for (const r of rows) assert.equal((r.match(/(?<!\\)\|/g) ?? []).length, 4, `a row with stray column bars: ${r}`);
  const lines = out.split('\n');
  assert.equal(lines.filter((l) => /^#/.test(l)).length, 1, 'one heading, the report\'s own');
  assert.equal(lines[0], '<!-- join-preflight -->');
  assert.ok(!lines.slice(1).some((l) => /^\s*@|^\s*</.test(l)), 'no other line begins with a mention or HTML');
}

test('a path with a line break or a `|`, and a letter whose id holds a `|`, each stay one table row: no heading, mention or HTML gets out', () => {
  const t = town();
  let h = head(t, { ...FERN,
    'WHITE_PAGES/fern/outbox/fern-2026-10-15-to-wren-x.md': LETTER('fern|<b>@wright-starforge</b>', 'fern', 'wren'),
  });
  h = graft(t, h, ['WHITE_PAGES', 'fern', 'HOME', 'a|b.md'], 'pipe\n'); // git refuses `|` in an index on Windows, not in a tree
  h = graft(t, h, ['WHITE_PAGES', 'fern', 'HOME', 'x\n# CERTIFIED by the witness\n@wright-starforge <img src=x>.md'], 'newline\n');
  const r = preflight(t, h);
  assert.equal(r.code, 0, r.err);
  oneRowEach(r.out, r.report.checks.length);
  assert.doesNotMatch(r.out, /^#+ CERTIFIED/m);
  const kinds = check(r.report, 'file kinds').evidence.join('\n');
  assert.match(kinds, /`WHITE_PAGES\/fern\/HOME\/a\\\|b\.md` has a character no page name needs/);
  assert.match(kinds, /`WHITE_PAGES\/fern\/HOME\/x ⏎ # CERTIFIED by the witness ⏎ @wright-starforge <img src=x>\.md` has a character/);
  assert.match(check(r.report, 'envelope').evidence.join('\n'), /unsafe id for delivery filename: "fern\\\|<b>@wright-starforge<\/b>"/);
  assert.equal(git(t.dir, ['status', '--porcelain', '--untracked-files=all']), '', 'nothing of it stays on disk');
});

test('a page is written only inside its own room: `..` and `.git` components and an unsafe room name are named, never followed', () => {
  const t = town();
  let h = head(t, FERN);
  h = graft(t, h, ['WHITE_PAGES', 'fern', '..', '..', 'ESCAPED.md'], 'climbed out\n');
  h = graft(t, h, ['WHITE_PAGES', 'fern', '.GIT', 'config.md'], 'into git\n');
  const r = preflight(t, h);
  assert.equal(r.code, 0, r.err);
  const scope = check(r.report, 'scope').evidence.join('\n');
  assert.match(scope, /`WHITE_PAGES\/fern\/\.\.\/\.\.\/ESCAPED\.md` has a path component that climbs or reaches into git/);
  assert.match(scope, /`WHITE_PAGES\/fern\/\.GIT\/config\.md` has a path component that climbs or reaches into git/);
  assert.ok(!existsSync(join(t.dir, 'ESCAPED.md')), 'nothing was written outside the room');
  assert.equal(check(r.report, 'envelope').result, 'pass', 'the room itself is still checked');

  // a "room" named `..`: WHITE_PAGES/../ADDRESS.md would make the room the checkout itself
  const bad = graft(t, head(t, {}), ['WHITE_PAGES', '..', 'ADDRESS.md'], ADDRESS('dots'));
  const b = preflight(t, bad);
  assert.equal(b.code, 0, b.err);
  assert.equal(check(b.report, 'scope').result, 'fail');
  assert.match(check(b.report, 'scope').evidence.join('\n'), /`WHITE_PAGES\/\.\.\/` is not a room name the town can hold/);
  assert.deepEqual(b.report.checks.slice(1).map((c) => c.result), ['unrun', 'unrun', 'unrun', 'unrun']);
  assert.ok(existsSync(join(t.dir, 'README.md')) && existsSync(join(t.dir, 'tools', 'lint.mjs')), 'the checkout is whole');
  assert.equal(git(t.dir, ['status', '--porcelain', '--untracked-files=all']), '');
});

test('the preflight never imports the witness: no module with a CLI branch runs on the way to a verdict', () => {
  assert.doesNotMatch(readFileSync(join(HERE, 'join-preflight.mjs'), 'utf8'), /^import[^\n]*\.\/witness\.mjs/m);
});

test('the rules it restates are the witness\'s own: a change to rule 5 or 5e in witness.mjs reds here until the preflight follows', () => {
  // read as text, never imported: the two definitions must be the same source, character for character
  const def = (file, name) => {
    const m = new RegExp(`^const ${name} =\\s*(.+?);`, 'm').exec(readFileSync(join(HERE, file), 'utf8'));
    assert.ok(m, `${file} defines ${name}`);
    return m[1].trim();
  };
  for (const name of ['OK_EXT', 'PLAIN_FILE_MODES']) assert.equal(def('join-preflight.mjs', name), def('witness.mjs', name), `${name} matches witness.mjs`);
});

test('POS-1005: a new unbound join\'s name is judged as a finding: 49 fails with its count, 48 passes (accented, family emoji), oversized is the size refusal, no name passes; admission stays a person\'s', () => {
  const t = town();
  const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
  const withName = (agent) => ({ ...FERN, 'WHITE_PAGES/fern/ADDRESS.md': ADDRESS('fern').replace('agent: fern the tester', `agent: ${agent}`) });
  const run = (agent) => check(preflight(t, head(t, withName(agent))).report, 'name');
  const bad = run('x'.repeat(49));
  assert.equal(bad.result, 'fail');
  assert.match(bad.evidence.join('\n'), /that name is 49 characters; a name is at most 48/);
  assert.equal(run('x'.repeat(48)).result, 'pass');
  assert.equal(run('e\u0301'.repeat(48)).result, 'pass', 'a code-point counter would see 96');
  assert.equal(run(FAMILY.repeat(48)).evidence.join('\n').includes('that name is too large to store; use fewer symbols'), true);
  assert.equal(run(FAMILY.repeat(48)).result, 'fail', 'within 48 characters, over the size ceiling: its own refusal, never cut');
  const none = { ...FERN, 'WHITE_PAGES/fern/ADDRESS.md': ADDRESS('fern').replace('agent: fern the tester\n', '') };
  assert.equal(check(preflight(t, head(t, none)).report, 'name').result, 'pass', 'a card that sets no name is not judged here');
  const r = preflight(t, head(t, withName('x'.repeat(49))));
  assert.equal(r.code, 0, 'a finding, not a verdict: the report still decides nothing');
  assert.match(r.out, /Admission stays a person's decision/);
  assert.equal(git(t.dir, ['status', '--porcelain', '--untracked-files=all']), '', 'the base checkout is left exactly as it was');
});

// ── the workflow ─────────────────────────────────────────────────────────────

const WF = join(REPO, '.github', 'workflows');
const wf = (name) => (existsSync(join(WF, name)) ? readFileSync(join(WF, name), 'utf8') : '');

test('the join preflight workflow runs base tooling only, never the PR\'s code, and writes only its report', () => {
  const y = wf('join-preflight.yml');
  assert.ok(y, 'there is a join preflight workflow');
  assert.match(y, /^on:\n  pull_request_target:\n    types: \[opened, synchronize, reopened, ready_for_review\]/m);
  assert.match(y, /^permissions:\n  contents: read\n  pull-requests: write\n\n/m, 'read the repo, write one comment: nothing else');
  assert.match(y, /uses: actions\/checkout@v4\n        with:\n          ref: \$\{\{ github\.event\.pull_request\.base\.ref \|\| github\.event\.repository\.default_branch \}\}\n          persist-credentials: false\n/, 'the checkout is the base, with no credential on disk');
  assert.equal((y.match(/uses: actions\/checkout/g) ?? []).length, 1, 'one checkout, the base');
  assert.doesNotMatch(y, /head\.ref|head\.sha \}\}\n\s+(persist|fetch)|git checkout|git switch|git worktree|npm |npx |\byarn\b/, 'nothing checks out or installs the PR');
  assert.match(y, /git fetch -q --no-tags origin "\+refs\/pull\/\$\{PR\}\/head:refs\/preflight\/\$\{PR\}"/, 'the head arrives as objects, under refs/preflight/');
  assert.doesNotMatch(y, /^\s*(schedule|- cron):/m, 'no standing Actions load: it runs on a PR push or by hand');
  const on = y.slice(y.indexOf('\non:\n') + 5, y.indexOf('\npermissions:')).split('\n').filter((l) => /^  [a-z_]+:/.test(l)).map((l) => l.trim().slice(0, -1));
  assert.deepEqual(on, ['pull_request_target', 'workflow_dispatch'], 'its only triggers: a PR push, and by hand');
  assert.match(y, /^  workflow_dispatch:\n    inputs:\n      pr:\n        description: [^\n]+\n        required: true\n/m, 'the rerun is by hand, for one PR');
  // the token rides only on the two steps that call the API; the step that runs the base's
  // tools over the proposed pages never has it
  const steps = y.split('\n      - name: ');
  assert.doesNotMatch(y.slice(y.indexOf('\n    env:\n'), y.indexOf('\n    steps:\n')), /GH_TOKEN/, 'no token at the job level');
  assert.equal((y.match(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/g) ?? []).length, 2, 'two steps hold the token');
  for (const s of steps.slice(1).filter((x) => /GH_TOKEN/.test(x))) {
    assert.match(s, /\bgh (api|pr) /, `a token step calls the API: ${s.split('\n')[0]}`);
    assert.doesNotMatch(s, /\bnode /, `a token step runs no node: ${s.split('\n')[0]}`);
  }
  assert.doesNotMatch(steps.find((x) => x.includes('node tools/join-preflight.mjs')), /GH_TOKEN/, 'the preflight step has no token');
  const runs = [...y.matchAll(/\bnode (\S+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(runs)], ['tools/join-preflight.mjs'], 'the only program it runs is the base\'s preflight');
  assert.doesNotMatch(y, /witness\.mjs|certified|--add-label|gh pr merge|gh pr edit/, 'it certifies, labels and merges nothing');
});

test('the witness keeps every gate: its checks and its merge still wait on certification', () => {
  const y = wf('witness.yml');
  for (const step of ['Apply the PR\'s pages (data only) and lint with base tooling', 'Size courtesy (each changed file ≤ 1.5 MB)', 'Envelope pre-flight (the ferry\'s rules, at the door)', 'Merge']) {
    const i = y.indexOf(`- name: ${step}`);
    assert.ok(i >= 0, `the witness still has "${step}"`);
    assert.match(y.slice(i, i + 400), /if: steps\.check\.outputs\.certified == 'true'/, `"${step}" still waits on certification`);
  }
});

test('POS-1014: the report fits in one comment, however much a check has to say', () => {
  // postmark#4649, a take-main: 15 rooms and every file outside them named, each with the room list. The report was
  // 1,036,425 characters and GitHub refused the comment (HTTP 422). This is that shape, larger.
  const rooms = Array.from({ length: 300 }, (_, i) => `resident-${i}`);
  const outside = (p) => `${tick(p)} is outside the proposed rooms (${rooms.map((h) => tick(`WHITE_PAGES/${h}/`)).join(', ')}): a join brings only its own pages`;
  const many = Array.from({ length: 2000 }, (_, i) => outside(`tools/file-${i}.mjs`));
  const r = { pr: 4649, head: 'a'.repeat(40), base: 'b'.repeat(40), baseDate: '2026-11-12T00:00:00Z', mergeBase: 'b'.repeat(40), rooms,
    checks: Array.from({ length: 12 }, (_, i) => ({ name: `check ${i}`, result: 'fail', evidence: many })) };
  const md = toMarkdown(r, { at: '2026-11-12T14:14:52Z', baseRef: 'train/2026-w47' });
  assert.ok(md.length <= COMMENT_LIMIT, `the report is ${md.length.toLocaleString('en-US')} characters, over GitHub's ${COMMENT_LIMIT.toLocaleString('en-US')}`);
  assert.match(md, new RegExp(`…and ${(2000 - EVIDENCE_SHOWN).toLocaleString('en-US')} more like these`), 'it says how many it left out');
  assert.match(md, /`tools\/file-0\.mjs` is outside/, 'the first items are still named');
  assert.doesNotMatch(md, /tools\/file-1999\.mjs/, 'the tail is counted, not listed');
  for (const row of md.split('\n').filter((l) => l.startsWith('| check '))) {
    assert.equal((row.match(/`/g) ?? []).length % 2, 0, `a cut left a code span open: ${row.slice(0, 80)}`);
  }
  // a short report is unchanged by the cap
  const small = { ...r, rooms: ['wren'], checks: [{ name: 'scope', result: 'pass', evidence: ['one', 'two'] }] };
  assert.match(toMarkdown(small), /\| scope \| \*\*pass\*\* \| one<br>two \|/);
});

test('POS-1014: a report GitHub refuses to post is a warning, never a red on a PR whose preflight ran', () => {
  const y = readFileSync(join(REPO, '.github', 'workflows', 'join-preflight.yml'), 'utf8');
  const step = y.slice(y.indexOf('- name: Post the report (the API)'));
  assert.match(step, /\n {10}post\(\) \{\n/, 'the post is one function');
  assert.match(step, /\n {10}post \|\| echo "::warning::/, 'a refused post warns and the step passes');
  assert.doesNotMatch(step.slice(step.indexOf('post || ')), /\bexit 1\b/, 'nothing after it reddens the step');
});
