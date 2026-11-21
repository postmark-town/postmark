// town-clock.test.mjs — the clock's commit jobs land their own job's outputs and nothing else,
// and they land them through a pull request, never by pushing main.
//   node --test tools/town-clock.test.mjs
// Zero-dep. The workflow is read as text, and the steps that carry the
// boundary run for real: each step's own `run:` text, in bash, against
// throwaway towns (a bare origin and clones of it), as the runner would.
//
// POS-973: the herbarium and atlas jobs run code under PROJECTS/ with a
// read-only token and hand their change over as a patch. Only the commit jobs
// hold contents: write, and they run no project code, so a commit job's list
// is the boundary between code that ran read-only and the write token. Each
// accepts its own job's outputs, named exactly, and refuses anything else:
// the generators beside them, a new file, another folder, an executable mode,
// a symlink.
//
// POS-938: POS-597's ruleset makes the town's main take changes only through a
// pull request, and GitHub Actions can't be listed as its bypass. So a commit
// job pushes its commit to its own clock/<run>-<attempt>-<job> branch, opens a
// PR into the branch the run checked out, squash-merges it under the clock's
// own subject, and deletes the branch. A refused merge brings the base in and
// tries again, three tries in all. Here the test's origin holds the ruleset as
// a pre-receive hook (main takes no push but the PR merge's), and `gh` is a
// stub on PATH that answers `pr create` and `pr merge` against that origin, the
// way GitHub would. The stub can refuse the first N merges, moving main under
// the PR each time, as a resident's commit landing mid-run would. The real gh
// can't be reached from here: the stub comes first on PATH, and the step runs
// with no token, an empty gh config and a repo name that doesn't exist.
//
// THE FLIPS (run on a scratch copy, never in the tree):
//   · the atlas lists widened back to the whole folder (the handover's
//     `git add PROJECTS/build-the-town/atlas/`, the commit job's
//     `$2 !~ /^PROJECTS\/build-the-town\/atlas\//`): the generators then ride
//     the handover, a changed generator and a new extra.mjs are committed, and
//     both atlas tests red;
//   · a commit job that pushes main directly (the clock before POS-938): the
//     origin's hook refuses it, and its landing test reds;
//   · one try instead of three: the race test reds;
//   · the merge-in deleted (the fetch, merge and push between tries): the race
//     test reds on the second head not holding the moved main, and the
//     conflict test on a second merge try;
//   · the branch delete removed: the landing test reds on the leftover branch.
//
// The last test is A TEXT PIN, the weakest instrument: it reads the workflow's
// permissions as text, so it holds their shape, not their effect.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WF = readFileSync(join(HERE, '..', '.github', 'workflows', 'town-clock.yml'), 'utf8').replace(/\r/g, '');
const JOBS = WF.slice(WF.indexOf('\njobs:\n'));

const HERB = 'PROJECTS/the-resident-herbarium';
const ATLAS = 'PROJECTS/build-the-town/atlas';
const CLOCK = {
  herbarium: { folder: HERB, generator: `${HERB}/render.mjs`, subject: 'town-clock: herbarium regrow', outputs: [`${HERB}/specimens.json`, `${HERB}/herbarium.html`] },
  atlas: {
    folder: ATLAS,
    generator: `${ATLAS}/render-town.mjs`,
    subject: 'town-clock: atlas refresh',
    outputs: [`${ATLAS}/town.json`, `${ATLAS}/THE-ATLAS.md`, `${ATLAS}/REGIONS.md`, `${ATLAS}/town.html`, `${ATLAS}/ground.html`, 'WHITE_PAGES/INDEX.md'],
  },
};

// The run the commit step believes it is in.
const RUN = { GITHUB_REF_NAME: 'main', GITHUB_RUN_ID: '4242', GITHUB_RUN_ATTEMPT: '1', GITHUB_REPOSITORY: 'test/not-the-town' };
const branchOf = (name) => `clock/${RUN.GITHUB_RUN_ID}-${RUN.GITHUB_RUN_ATTEMPT}-${name}`;

// The base town: both projects with their generators, data and outputs, plus
// the town's own tools and a workflow, for patches to reach for.
const BASE = {
  [`${HERB}/grow.mjs`]: 'export const grow = 1;\n',
  [`${HERB}/render.mjs`]: 'export const render = 1;\n',
  [`${HERB}/README.md`]: '# the resident herbarium\n',
  [`${HERB}/specimens.json`]: '[]\n',
  [`${HERB}/herbarium.html`]: '<p>herbarium</p>\n',
  [`${ATLAS}/town-atlas.mjs`]: 'export const atlas = 1;\n',
  [`${ATLAS}/render-town.mjs`]: 'export const renderTown = 1;\n',
  [`${ATLAS}/render-town-debug.mjs`]: 'export const debug = 1;\n',
  [`${ATLAS}/validate.mjs`]: 'export const validate = 1;\n',
  [`${ATLAS}/README.md`]: '# atlas\n',
  [`${ATLAS}/placements.json`]: '{}\n',
  [`${ATLAS}/town.json`]: '{"town":1}\n',
  [`${ATLAS}/THE-ATLAS.md`]: '# the atlas\n',
  [`${ATLAS}/REGIONS.md`]: '# regions\n',
  [`${ATLAS}/town.html`]: '<p>town</p>\n',
  [`${ATLAS}/ground.html`]: '<p>ground</p>\n',
  'WHITE_PAGES/INDEX.md': '# index\n',
  'WHITE_PAGES/alice/ADDRESS.md': '---\nhandle: alice\n---\n',
  'tools/ferry.mjs': 'export const ferry = 1;\n',
  '.github/workflows/town-clock.yml': 'name: town clock\n',
};

// POS-597's ruleset, as the test's origin holds it: main takes no push but the
// PR merge's (the stub sets GH_STUB_MERGE=1 for its own push, and nothing else does).
const RULESET_HOOK = [
  '#!/bin/sh',
  'while read -r old new ref; do',
  '  if [ "$ref" = refs/heads/main ] && [ "$GH_STUB_MERGE" != 1 ]; then',
  '    echo "origin: main takes changes only through a pull request" >&2',
  '    exit 1',
  '  fi',
  'done',
  'exit 0',
  '',
].join('\n');

// A stand-in for gh: `pr create` and `pr merge`, against the test's bare origin,
// as GitHub would answer them. Every call is logged to $GH_STUB_DIR/calls. The
// first $GH_STUB_REFUSE merges are refused, each after a resident's commit lands
// on the base, as a race would; with $GH_STUB_CONFLICT set, that commit writes
// into the named file instead, where the clock writes. Each merge try logs its
// number, the PR head and the base tip to $GH_STUB_DIR/tries. A merge squashes
// the head onto the base under --subject, pinned to --match-head-commit, and is
// refused as GitHub refuses it when the squash conflicts.
const GH_STUB = [
  '#!/usr/bin/env bash',
  'set -eo pipefail',
  'printf "%s\\n" "$*" >> "$GH_STUB_DIR/calls"',
  'O="$GH_STUB_ORIGIN"',
  'what="$1 $2"; shift 2',
  'url=""; base=""; head=""; method=""; subject=""; match=""',
  'while [ $# -gt 0 ]; do',
  '  case "$1" in',
  '    --base) base=$2; shift 2 ;;',
  '    --head) head=$2; shift 2 ;;',
  '    --subject) subject=$2; shift 2 ;;',
  '    --match-head-commit) match=$2; shift 2 ;;',
  '    --squash|--merge|--rebase) method=$1; shift ;;',
  '    --repo|--title|--body) shift 2 ;;',
  '    https://*) url=$1; shift ;;',
  '    *) echo "stub gh: unexpected argument $1" >&2; exit 2 ;;',
  '  esac',
  'done',
  'case "$what" in',
  '  "pr create")',
  '    git --git-dir="$O" rev-parse -q --verify "refs/heads/$head" > /dev/null || { echo "stub gh: no branch $head on origin" >&2; exit 1; }',
  '    printf "%s %s\\n" "$base" "$head" > "$GH_STUB_DIR/pr"',
  '    echo "https://github.test/town/pull/1"',
  '    ;;',
  '  "pr merge")',
  '    [ "$url" = "https://github.test/town/pull/1" ] || { echo "stub gh: no such PR $url" >&2; exit 1; }',
  '    read -r base head < "$GH_STUB_DIR/pr"',
  '    n=$(( $(cat "$GH_STUB_DIR/merges" 2> /dev/null || echo 0) + 1 ))',
  '    echo "$n" > "$GH_STUB_DIR/merges"',
  '    w="$GH_STUB_DIR/work-$n"',
  '    git clone -q -c core.autocrlf=false "$O" "$w"',
  '    git -C "$w" config user.name "github stub"',
  '    git -C "$w" config user.email "stub@github.test"',
  '    git -C "$w" checkout -q "$base"',
  '    tip=$(git --git-dir="$O" rev-parse "refs/heads/$head")',
  '    printf "%s %s %s\\n" "$n" "$tip" "$(git --git-dir="$O" rev-parse "refs/heads/$base")" >> "$GH_STUB_DIR/tries"',
  '    if [ "$n" -le "${GH_STUB_REFUSE:-0}" ]; then',
  '      if [ -n "${GH_STUB_CONFLICT:-}" ]; then',
  '        echo "a resident line, where the clock writes" >> "$w/$GH_STUB_CONFLICT"',
  '      else',
  '        r="race-$GH_STUB_RUN-$n"',
  '        mkdir -p "$w/WHITE_PAGES/$r"',
  '        echo "$r" > "$w/WHITE_PAGES/$r/ADDRESS.md"',
  '      fi',
  '      git -C "$w" add -A',
  '      git -C "$w" commit -qm "a resident commit, under the clock PR"',
  '      GH_STUB_MERGE=1 git -C "$w" push -q origin "HEAD:refs/heads/$base"',
  '      echo "stub gh: Base branch was modified. Review and try the merge again." >&2',
  '      exit 1',
  '    fi',
  '    [ "$method" = --squash ] || { echo "stub gh: this test expects --squash, got $method" >&2; exit 1; }',
  '    [ "$match" = "$tip" ] || { echo "stub gh: the head is $tip, not $match" >&2; exit 1; }',
  '    git -C "$w" merge -q --squash "origin/$head" > /dev/null 2>&1 || { echo "stub gh: Pull Request is not mergeable" >&2; exit 1; }',
  '    git -C "$w" commit -qm "$subject"',
  '    GH_STUB_MERGE=1 git -C "$w" push -q origin "HEAD:refs/heads/$base"',
  '    ;;',
  '  *) echo "stub gh: unexpected command $what" >&2; exit 2 ;;',
  'esac',
  '',
].join('\n');

const PATH_KEY = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';

function git(cwd, args, { input } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

// the text of one job: from its "  name:" line to the next job (or the end)
function job(name) {
  const m = new RegExp('^  ' + name + ':\\n([\\s\\S]*?)(?=^  [a-z][\\w-]*:\\n|(?![\\s\\S]))', 'm').exec(JOBS);
  assert.ok(m, `town-clock.yml has a job ${name}`);
  return m[1];
}

// one step of a job: its `run:` text, dedented, and its working-directory if it names one
function step(jobName, stepName) {
  const lines = job(jobName).split('\n');
  const at = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  assert.ok(at >= 0, `job ${jobName} has a step "${stepName}"`);
  let wd = null;
  let runAt = -1;
  for (let i = at + 1; i < lines.length && !/^\s+- name: /.test(lines[i]); i++) {
    const w = /^\s+working-directory: (\S+)\s*$/.exec(lines[i]);
    if (w) wd = w[1];
    if (/^\s+run: \|\s*$/.test(lines[i])) { runAt = i; break; }
  }
  assert.ok(runAt > 0, `step "${stepName}" of ${jobName} has a run: block`);
  const indent = lines[runAt + 1].match(/^\s*/)[0].length;
  const body = [];
  for (let i = runAt + 1; i < lines.length; i++) {
    if (lines[i].trim() && lines[i].match(/^\s*/)[0].length < indent) break;
    body.push(lines[i].slice(indent));
  }
  return { script: body.join('\n'), wd };
}

// As GitHub runs a `run:` block: bash --noprofile --norc -eo pipefail.
function bash(script, cwd, env) {
  return spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}

function withTown(fn) {
  const root = mkdtempSync(join(tmpdir(), 'town-clock-'));
  let n = 0;
  const seed = join(root, 'seed');
  const origin = join(root, 'origin.git');
  const stubBin = join(root, 'stub-bin');
  const ghConfig = join(root, 'gh-config');
  const clone = () => {
    const dir = join(root, `clone-${++n}`);
    git(root, ['clone', '-q', '-c', 'core.autocrlf=false', origin, dir]);
    git(dir, ['config', 'user.name', 'town-clock test']);
    git(dir, ['config', 'user.email', 'clock@test.local']);
    return dir;
  };
  const temp = () => mkdtempSync(join(root, 'runner-temp-'));
  try {
    mkdirSync(seed);
    git(seed, ['init', '-q', '-b', 'main']);
    git(seed, ['config', 'core.autocrlf', 'false']);
    git(seed, ['config', 'user.name', 'town-clock test']);
    git(seed, ['config', 'user.email', 'clock@test.local']);
    for (const [p, c] of Object.entries(BASE)) {
      mkdirSync(dirname(join(seed, p)), { recursive: true });
      writeFileSync(join(seed, p), c);
    }
    git(seed, ['add', '-A']);
    git(seed, ['commit', '-qm', 'base']);
    git(root, ['clone', '-q', '--bare', seed, origin]);
    writeFileSync(join(origin, 'hooks', 'pre-receive'), RULESET_HOOK, { mode: 0o755 });
    mkdirSync(stubBin);
    writeFileSync(join(stubBin, 'gh'), GH_STUB, { mode: 0o755 });
    mkdirSync(ghConfig);

    // The generator job's handover, run after `edit` has changed a clone the way its generators would.
    const handover = (name, edit) => {
      const gen = clone();
      edit(gen);
      const t = temp();
      const out = join(t, 'gh-output');
      writeFileSync(out, '');
      const { script, wd } = step(name, 'Hand the change over as a patch');
      const r = bash(script, wd ? join(gen, wd) : gen, { RUNNER_TEMP: t, GITHUB_OUTPUT: out });
      assert.equal(r.status, 0, r.stderr);
      return { changed: /^changed=true$/m.test(readFileSync(out, 'utf8')), patch: join(t, `${name}.patch`) };
    };

    // A hand-built patch: each [path, content, mode] staged on a fresh clone through
    // its index (content null removes the path), then diffed as the handover does.
    const hostile = (entries) => {
      const dir = clone();
      for (const [path, content, mode = '100644'] of entries) {
        if (content === null) { git(dir, ['update-index', '--force-remove', path]); continue; }
        const blob = git(dir, ['hash-object', '-w', '--stdin'], { input: content }).trim();
        git(dir, ['update-index', '--add', '--cacheinfo', `${mode},${blob},${path}`]);
      }
      const file = join(root, `hostile-${n}.patch`);
      writeFileSync(file, git(dir, ['diff', '--cached', '--binary']));
      return file;
    };

    // The commit job's step, run on `patch` in a fresh clone, with the gh stub
    // refusing its first `refuse` merges. Reports what reached origin's main, its
    // tip, the clock branches left on origin, and every gh call.
    const commit = (name, patch, { refuse = 0, conflict = '' } = {}) => {
      const runner = clone();
      const before = git(origin, ['rev-parse', 'main']).trim();
      const t = temp();
      mkdirSync(join(t, 'handover'));
      copyFileSync(patch, join(t, 'handover', `${name}.patch`));
      const stubDir = temp();
      const r = bash(step(`${name}-commit`, 'Apply, commit and land through a pull request').script, runner, {
        ...RUN,
        RUNNER_TEMP: t,
        [PATH_KEY]: stubBin + delimiter + process.env[PATH_KEY],
        GH_STUB_DIR: stubDir,
        GH_STUB_RUN: basename(stubDir),
        GH_STUB_ORIGIN: origin,
        GH_STUB_REFUSE: String(refuse),
        GH_STUB_CONFLICT: conflict,
        GH_TOKEN: '',
        GH_CONFIG_DIR: ghConfig,
      });
      const after = git(origin, ['rev-parse', 'main']).trim();
      const landed = after === before ? [] : git(origin, ['diff', '--name-only', before, after]).split('\n').filter(Boolean);
      const callsFile = join(stubDir, 'calls');
      const calls = existsSync(callsFile) ? readFileSync(callsFile, 'utf8').split('\n').filter(Boolean) : [];
      const triesFile = join(stubDir, 'tries');
      const tries = existsSync(triesFile)
        ? readFileSync(triesFile, 'utf8').split('\n').filter(Boolean).map((l) => { const [n, head, base] = l.split(' '); return { n: Number(n), head, base }; })
        : [];
      const branches = git(origin, ['for-each-ref', '--format=%(refname)', 'refs/heads/clock/']).split('\n').filter(Boolean);
      const branchHead = branches.length ? git(origin, ['rev-parse', branches[0]]).trim() : null;
      const tip = { subject: git(origin, ['log', '-1', '--format=%s', 'main']).trim(), parent: git(origin, ['log', '-1', '--format=%P', 'main']).trim() };
      return { ...r, before, after, landed, calls, tries, branches, branchHead, tip };
    };

    // Is commit a an ancestor of commit b in origin? 0 is yes, 1 is no; anything else is a broken read.
    const isAncestor = (a, b) => {
      const r = spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: origin, encoding: 'utf8' });
      if (r.status !== 0 && r.status !== 1) throw new Error(`merge-base --is-ancestor ${a} ${b}: exit ${r.status} ${r.stderr}`);
      return r.status === 0;
    };
    const show = (rev, path) => git(origin, ['show', `${rev}:${path}`]);

    return fn({ handover, hostile, commit, isAncestor, show });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// The resident commits the stub lands under a refused PR (one file each, named for the run and the try).
const races = (paths) => paths.filter((p) => /^WHITE_PAGES\/race-[^/]+\//.test(p));
const notRaces = (paths) => paths.filter((p) => !/^WHITE_PAGES\/race-[^/]+\//.test(p));

for (const [name, { folder, generator, subject, outputs }] of Object.entries(CLOCK)) {
  test(`${name}: the handover names its outputs exactly, and its commit job lands them and only them, through a squash-merged PR`, () => withTown(({ handover, commit }) => {
    assert.equal(handover(name, () => {}).changed, false, 'an unchanged run handed something over');

    // Every file in the project's folder moves, and a new one appears, as if its
    // generators rewrote their own folder. Only the outputs are handed over.
    const h = handover(name, (gen) => {
      for (const p of Object.keys(BASE).filter((p) => p.startsWith(`${folder}/`))) writeFileSync(join(gen, p), `${BASE[p]}moved\n`);
      writeFileSync(join(gen, folder, 'extra.mjs'), 'export const extra = 1;\n');
      writeFileSync(join(gen, 'WHITE_PAGES', 'INDEX.md'), '# index\n\n- alice\n');
    });
    assert.ok(h.changed, 'a changed run handed nothing over');
    const c = commit(name, h.patch);
    assert.equal(c.status, 0, `the commit job did not land its own job's handover:\n${c.stdout}${c.stderr}`);
    // It went through a PR from its own branch into the branch the run checked out, merged once.
    assert.deepEqual(c.calls.map((l) => l.split(' ').slice(0, 2).join(' ')), ['pr create', 'pr merge'], `the gh calls were not one create and one merge:\n${c.calls.join('\n')}`);
    assert.match(c.calls[0], new RegExp(`--base main --head ${branchOf(name)} `), `the PR was not from ${branchOf(name)} into main: ${c.calls[0]}`);
    assert.deepEqual([...c.landed].sort(), [...outputs].sort(), `the commit landed more or less than the outputs:\n${c.landed.join('\n')}`);
    // One squash commit on main, under the subject the clock has always written.
    assert.equal(c.tip.parent, c.before, 'main took more than one commit');
    assert.equal(c.tip.subject, subject, 'the commit on main does not carry the clock subject');
    assert.deepEqual(c.branches, [], `the clock branch was left on origin: ${c.branches.join(' ')}`);
  }));

  test(`${name}: a refused merge brings main into the branch and merges again; the third refusal fails and leaves the PR open`, () => withTown(({ hostile, commit, isAncestor }) => {
    const output = outputs[0];
    // Each run changes the output anew; the second is cut from main after the first landed.
    const change = (tag) => hostile([[output, `${BASE[output]}${tag}\n`]]);

    // Refused once: main moved under the PR. The clock merges main in and lands on top of it.
    const once = commit(name, change('raced once'), { refuse: 1 });
    assert.equal(once.status, 0, `one refusal stopped the clock:\n${once.stdout}${once.stderr}`);
    assert.equal(once.calls.filter((l) => l.startsWith('pr merge')).length, 2, `not two merge tries:\n${once.calls.join('\n')}`);
    // Between the tries, the branch took the moved main: the second try's head holds the
    // base it met, and the first try's head (the control) doesn't.
    const [first, second] = once.tries;
    assert.notEqual(second.base, first.base, 'main did not move between the tries');
    assert.ok(!isAncestor(second.base, first.head), 'the first head already held the moved main, so this case separates nothing');
    assert.ok(isAncestor(second.base, second.head), 'the branch was not brought up to the moved main before the second merge');
    assert.equal(once.tip.subject, subject, 'the clock commit is not the tip of main');
    assert.equal(races(once.landed).length, 1, 'the resident commit under the PR is not on main');
    assert.deepEqual(notRaces(once.landed), [output], 'the clock landed more or less than its change');
    assert.deepEqual(once.branches, [], `the clock branch was left on origin: ${once.branches.join(' ')}`);

    // Refused three times: the job fails, main holds no clock commit, and the PR's branch stays for a hand.
    const thrice = commit(name, change('raced thrice'), { refuse: 3 });
    assert.notEqual(thrice.status, 0, 'three refusals did not fail the job');
    assert.match(thrice.stdout, /refused three times/, `the job failed, but not at the third refusal:\n${thrice.stdout}${thrice.stderr}`);
    assert.equal(thrice.calls.filter((l) => l.startsWith('pr merge')).length, 3, `not three merge tries:\n${thrice.calls.join('\n')}`);
    assert.deepEqual(notRaces(thrice.landed), [], 'a refused clock commit reached main');
    assert.equal(races(thrice.landed).length, 3, 'the three resident commits are not on main');
    assert.deepEqual(thrice.branches, [`refs/heads/${branchOf(name)}`], 'the open PR lost its branch');
  }));

  test(`${name}: a main that conflicts with the clock's change fails the job at the merge-in, and leaves the PR open`, () => withTown(({ hostile, commit, show }) => {
    const output = outputs[0];
    // The clock appends a line to its output; the resident commit under the PR appends another in the same place.
    const c = commit(name, hostile([[output, `${BASE[output]}the clock line\n`]]), { refuse: 1, conflict: output });
    assert.notEqual(c.status, 0, 'a conflicting main did not fail the job');
    assert.match(`${c.stdout}${c.stderr}`, /CONFLICT/, `the job failed, but not at the merge-in:\n${c.stdout}${c.stderr}`);
    assert.equal(c.tries.length, 1, `the job tried the merge again over a conflict:\n${c.calls.join('\n')}`);
    // Main holds the resident's line and not the clock's.
    assert.equal(c.tip.subject, 'a resident commit, under the clock PR', 'main does not end at the resident commit');
    assert.match(show('main', output), /a resident line, where the clock writes/);
    assert.doesNotMatch(show('main', output), /the clock line/, 'the clock change reached main over a conflict');
    // The PR stays open on the head it was opened with, with no half-done merge pushed.
    assert.deepEqual(c.branches, [`refs/heads/${branchOf(name)}`], 'the open PR lost its branch');
    assert.equal(c.branchHead, c.tries[0].head, 'the PR branch moved after the conflict');
  }));

  test(`${name}: the commit job refuses every patch that reaches past its outputs`, () => withTown(({ hostile, commit }) => {
    const output = outputs[0];
    const cases = [
      ['a changed generator', [[generator, 'process.stdout.write("redrawn");\n']]],
      ['a new file beside the outputs', [[`${folder}/extra.mjs`, 'export const extra = 1;\n']]],
      ['the project\'s own prose', [[`${folder}/README.md`, '# rewritten\n']]],
      ['an output with a generator riding along', [[output, '{"town":2}\n'], [generator, 'export const renderTown = 2;\n']]],
      ['a deleted generator', [[generator, null]]],
      ['the town\'s tools', [['tools/ferry.mjs', 'export const ferry = 2;\n']]],
      ['a workflow', [['.github/workflows/town-clock.yml', 'name: not the clock\n']]],
      ['an output made executable', [[output, BASE[output], '100755']]],
      ['an output made a symlink', [[output, '../../../tools/ferry.mjs', '120000']]],
    ];
    for (const [what, entries] of cases) {
      const c = commit(name, hostile(entries));
      assert.notEqual(c.status, 0, `${what} was accepted:\n${c.stdout}`);
      assert.match(c.stdout, /refused/, `${what} failed, but not at the allowlist:\n${c.stdout}${c.stderr}`);
      assert.deepEqual(c.landed, [], `${what} reached origin`);
      assert.deepEqual(c.calls, [], `${what} reached gh`);
      assert.deepEqual(c.branches, [], `${what} pushed a clock branch`);
    }
    // The control: a plain change to one output is accepted.
    const ok = commit(name, hostile([[output, `${BASE[output]}control\n`]]));
    assert.equal(ok.status, 0, `a plain output change was refused:\n${ok.stdout}${ok.stderr}`);
    assert.deepEqual(ok.landed, [output]);
  }));
}

test('A TEXT PIN on the permissions: read by default, contents: write only on the ferry and the two commit jobs, pull-requests: write only on the commit jobs, no credential left by the generator jobs', () => {
  const block = (text, indent) => {
    const pad = ' '.repeat(indent);
    const m = new RegExp(`^${pad}permissions:\\n((?:${pad}  \\S.*\\n)*)`, 'm').exec(text);
    return m ? m[1].split('\n').map((l) => l.trim()).filter(Boolean) : null;
  };
  assert.deepEqual(block(WF.slice(0, WF.indexOf('\njobs:\n') + 1), 0), ['contents: read'], 'the workflow default is not contents: read alone');
  const jobs = [...JOBS.matchAll(/^  ([a-z][\w-]*):\n/gm)].map((m) => m[1]);
  const perms = Object.fromEntries(jobs.map((n) => [n, block(job(n), 4)]));
  assert.deepEqual(perms, {
    ferry: ['contents: write'],
    herbarium: ['contents: read'],
    'herbarium-commit': ['contents: write', 'pull-requests: write'],
    atlas: ['contents: read'],
    'atlas-commit': ['contents: write', 'pull-requests: write'],
  }, 'a job was added, or its permissions moved; this pin names every job');
  for (const n of ['herbarium', 'atlas']) {
    const checkouts = (job(n).match(/uses: actions\/checkout@/g) ?? []).length;
    const uncredentialed = (job(n).match(/^\s+persist-credentials: false$/gm) ?? []).length;
    assert.ok(checkouts > 0 && uncredentialed === checkouts, `${n} keeps a credential on disk after its checkout`);
  }
  for (const n of ['herbarium-commit', 'atlas-commit']) {
    assert.doesNotMatch(job(n).replace(/^\s*#.*$/gm, ''), /\b(node|npm|npx)\b/, `${n} runs code`);
  }
});
