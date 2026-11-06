// witness-test-fixture.mjs — a scratch town for the witness chain's tests
// (tools/witness-chain.test.mjs, tools/witness-verify.test.mjs). Not a test.
//
// A bare origin and a clone of it, holding invented ledgers, an invented
// witness key published at WITNESS/witness-pubkey.pem and a DIFFERENT invented
// stamp key at tools/stamp-pubkey.pem. Nothing here reads the real town.

import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

export const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@postmark.invalid',
  GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@postmark.invalid',
};

export function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

export const mailLine = (n) => `- 2026-11-0${1 + (n % 5)} · writer-${n}-2026-11-01-note · writer-${n} → reader-${n} · thread: t${n}`;
export const stampLine = (n) => `- 2026-11-01 · MINT → writer-${n} · 1 · for: letter · sig: invented${n}`;

export function scratchTown(t, { witnessKey = keypair(), stampKey = keypair(), publishKey = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'witness-town-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const origin = join(root, 'origin.git');
  const repo = join(root, 'town');
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  git(repo, 'remote', 'add', 'origin', origin);

  const put = (path, text, cwd = repo) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  };
  const ledgers = { mail: [mailLine(1), mailLine(2)], stamps: [stampLine(1)] };
  const writeLedgers = (cwd = repo) => {
    put('WHITE_PAGES/mail-ledger.md', `# Mail ledger\n\n${ledgers.mail.join('\n')}\n`, cwd);
    put('WHITE_PAGES/stamp-ledger.md', `# Stamp ledger\n\n${ledgers.stamps.join('\n')}\n`, cwd);
  };
  writeLedgers();
  put('WHITE_PAGES/crossing-ledger.md', '# Crossing ledger\n\n');
  put('PROJECTS/the-town-seal/seal.json', '{"townSeal":"invented"}\n');
  put('tools/stamp-pubkey.pem', stampKey.publicPem);
  if (publishKey) put('WITNESS/witness-pubkey.pem', witnessKey.publicPem);
  const commit = (msg, cwd = repo) => { git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', msg); };
  commit('the town');
  git(repo, 'push', '-q', 'origin', 'main');
  git(repo, 'fetch', '-q', 'origin');

  /** Another clone of the same origin: a second publisher. */
  const clone = (name) => {
    const dir = join(root, name);
    execFileSync('git', ['clone', '-q', origin, dir]);
    return dir;
  };
  /** A crossing's worth of change: one more mail line and stamp line, committed and pushed from the main clone. */
  const crossing = (n) => {
    git(repo, 'pull', '-q', '--rebase', 'origin', 'main');
    ledgers.mail.push(mailLine(n));
    ledgers.stamps.push(stampLine(n));
    writeLedgers();
    commit(`ferry: crossing ${n}`);
    git(repo, 'push', '-q', 'origin', 'HEAD:main');
    git(repo, 'fetch', '-q', 'origin');
    return git(repo, 'rev-parse', 'HEAD').trim();
  };
  return { root, origin, repo, git, put, commit, clone, crossing, ledgers, writeLedgers, witnessKey, stampKey, owed: join(root, 'owed') };
}
