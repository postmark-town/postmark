#!/usr/bin/env node
// One reporting bundle; no mint, crossing transport, log-file or URL registry.
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = `Usage: node MEEPS/postmaster/tools/round-checks.mjs --repo PATH
  --round oversight|mail|town --phase open|prepush

Run reconcile, lint and stamp-verify once per invocation. Welcome audit runs
ONLY for mail/open. Invoke once at round open and once before its push, not
after each operation. JSON retains every raw report and exit status; exit zero
does NOT mean reconcile's advisory anomalies or verifier limitations vanished.
No writes, network registry, mint or mail transport. Each checker is loaded from
the supplied repository: lint and welcome infer their root from that location.
`;

export function checkPlan({ repo, round, phase }) {
  if (!repo || !['oversight', 'mail', 'town'].includes(round) || !['open', 'prepush'].includes(phase)) throw new Error('Require --repo, --round oversight|mail|town and --phase open|prepush');
  repo = realpathSync(resolve(repo));
  if (!statSync(repo).isDirectory()) throw new Error('--repo is not a directory');
  const plan = [
    { name: 'reconcile', command: process.execPath, path: 'tools/reconcile.mjs', args: ['--repo', repo, '--json'] },
    { name: 'lint', command: process.execPath, path: 'tools/lint.mjs', args: [] },
    { name: 'stamp-verify', command: process.execPath, path: 'tools/stamp-verify.mjs', args: ['--repo', repo] },
  ];
  if (round === 'mail' && phase === 'open') plan.push({ name: 'welcome-audit', command: 'python', path: 'MEEPS/postmaster/memory/welcome-audit.py', args: [] });
  for (const item of plan) {
    const path = join(repo, item.path);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Missing checker ${item.path}`);
    const rel = relative(repo, realpathSync(path));
    if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(path) !== realpathSync(path)) throw new Error(`Checker must be a plain in-repository path: ${item.path}`);
    item.argv = [path, ...item.args];
  }
  return { repo, round, phase, plan };
}

export function runRoundChecks(options) {
  const { repo, round, phase, plan } = checkPlan(options);
  const checks = plan.map(({ name, command, argv }) => {
    const r = spawnSync(command, argv, { cwd: repo, encoding: 'utf8', windowsHide: true,
      maxBuffer: 64 * 1024 * 1024, timeout: 120000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' } });
    return { name, argv, exit_code: r.status, signal: r.signal ?? null,
      error: r.error?.message ?? null, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  });
  return { schema: 'postmark-round-checks/v1', repo, round, phase, checks,
    completed_without_process_errors: checks.every((c) => c.exit_code === 0 && !c.error),
    interpretation: 'Process exit statuses only. Read every report: reconcile advisory anomalies, lint warnings and skipped stamp checks remain material. Not live-store proof or permission to fix/mint.' };
}

function main(argv) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) { process.stdout.write(usage); return; }
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!['--repo', '--round', '--phase'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(options, key.slice(2))) throw new Error('Invalid, duplicate or incomplete argument');
    options[key.slice(2)] = argv[i + 1];
  }
  const report = runRoundChecks(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.completed_without_process_errors) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`round-checks: ${error.message}`); process.exitCode = 1; }
}
