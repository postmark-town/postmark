// town-clock.test.mjs — the clock's commit jobs land their own job's outputs and nothing else.
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
// THE FLIP is the atlas lists widened back to the whole folder (the handover's
// `git add PROJECTS/build-the-town/atlas/`, the commit job's
// `$2 !~ /^PROJECTS\/build-the-town\/atlas\//`): the generators then ride the
// handover, a changed generator and a new extra.mjs are committed, and both
// atlas tests red.
//
// The last test is A TEXT PIN, the weakest instrument: it reads the workflow's
// permissions as text, so it holds their shape, not their effect.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WF = readFileSync(join(HERE, '..', '.github', 'workflows', 'town-clock.yml'), 'utf8').replace(/\r/g, '');
const JOBS = WF.slice(WF.indexOf('\njobs:\n'));

const HERB = 'PROJECTS/the-resident-herbarium';
const ATLAS = 'PROJECTS/build-the-town/atlas';
const CLOCK = {
  herbarium: { folder: HERB, generator: `${HERB}/render.mjs`, outputs: [`${HERB}/specimens.json`, `${HERB}/herbarium.html`] },
  atlas: {
    folder: ATLAS,
    generator: `${ATLAS}/render-town.mjs`,
    outputs: [`${ATLAS}/town.json`, `${ATLAS}/THE-ATLAS.md`, `${ATLAS}/REGIONS.md`, `${ATLAS}/town.html`, `${ATLAS}/ground.html`, 'WHITE_PAGES/INDEX.md'],
  },
};

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

    // The commit job's apply step, run on `patch` in a fresh clone; reports what reached origin.
    const commit = (name, patch) => {
      const runner = clone();
      const before = git(origin, ['rev-parse', 'main']).trim();
      const t = temp();
      mkdirSync(join(t, 'handover'));
      copyFileSync(patch, join(t, 'handover', `${name}.patch`));
      const r = bash(step(`${name}-commit`, 'Apply, commit and push').script, runner, { RUNNER_TEMP: t });
      const after = git(origin, ['rev-parse', 'main']).trim();
      const landed = after === before ? [] : git(origin, ['diff', '--name-only', before, after]).split('\n').filter(Boolean);
      return { ...r, landed };
    };

    return fn({ handover, hostile, commit });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const [name, { folder, generator, outputs }] of Object.entries(CLOCK)) {
  test(`${name}: the handover names its outputs exactly, and its commit job lands them and only them`, () => withTown(({ handover, commit }) => {
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
    assert.equal(c.status, 0, `the commit job refused its own job's handover:\n${c.stdout}${c.stderr}`);
    assert.deepEqual([...c.landed].sort(), [...outputs].sort(), `the commit landed more or less than the outputs:\n${c.landed.join('\n')}`);
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
    }
    // The control: a plain change to one output is accepted.
    const ok = commit(name, hostile([[output, `${BASE[output]}control\n`]]));
    assert.equal(ok.status, 0, `a plain output change was refused:\n${ok.stdout}${ok.stderr}`);
    assert.deepEqual(ok.landed, [output]);
  }));
}

test('A TEXT PIN on the permissions: read by default, write only on the ferry and the two commit jobs, no credential left by the generator jobs', () => {
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
    'herbarium-commit': ['contents: write'],
    atlas: ['contents: read'],
    'atlas-commit': ['contents: write'],
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
