// stamp-invite.test.mjs — Bring a neighbour, the invite mint (POS-816).
//   node --test tools/stamp-invite.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys; every
// household and every ledger line here is invented.
//
// The law (POS-576, Darko 2026-10-11 09:53, amended 2026-10-22 20:40 and 22:06;
// POS-816, Darko 2026-10-28 23:07, 2026-11-02 23:56 and 2026-11-03 00:08 EDT):
//   - "an invited household's join bundle is 10 stamps, 5 more than an ordinary
//     join, paid at settle": the welcome's 5, and this 5 as its own line;
//   - "its inviter gets 10" when the new household sends its first letter or
//     claims its home "within 30 days";
//   - "at most 10 paid invitations per household per month", counted in the
//     month it is paid ("Month paid");
//   - the inviter's 10 waits "A week" after that first letter or home;
//   - "Founders' household and the town earn none", of which the founders' half
//     is repealed (POS-816/d, 2026-11-03 09:31 EDT: "this should pay like any
//     other under the new NOMOS"); "meeps can't be named".
//
// In order:
//   1. the grammar classifies as its own kind, both sides, and no sibling
//      grammar mistakes it;
//   2. the lines pin their amounts and refuse a forging key or day;
//   3. the verb writes the invited side after the welcome and the inviter side
//      after the week, and refuses what the fold would refuse;
//   4. the verifier holds every term, each by its own falsifier, with a lawful
//      control beside each red;
//   5. the quest row is on the board.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyEntry, inviteInvitedLine, inviteInviterLine, INVITE_PAY, INVITE_WITHIN_DAYS,
  INVITE_CAP_PER_MONTH, INVITE_HOLD_DAYS, INVITE_TOWN_HOUSE, judgeInviteLine, inviteState, townDayOf,
  parseStampLedger, foldBalances, sealChain, signSeal,
  giftLine, welcomeLine, firstIdeaLine, stageMintLine, questPayLine, mintLine, transferLine, rulesV2Line,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_CLI = join(HERE, 'stamp-mint.mjs');

// ── the invented town ───────────────────────────────────────────────────────
// keep was invited by castle (named carl) on 2026-10-27 (a town day); castle
// keeps carl, cleo and moth (moth becomes a meep in the meep falsifier);
// starforge and the-town are the founders' and the town's own houses; nook was
// invited by starforge (it pays like any other); hall by the-town (it pays
// nothing); tower was invited by nobody. lodge1..lodge11 were each
// invited by castle, for the cap.
const INVITED_AT = '2026-10-27T20:39:04.552Z';
const LODGES = Array.from({ length: 11 }, (_, i) => `lodge${i + 1}`);
const LODGE_AT = '2026-10-31T15:00:00.000Z';
function households() {
  const h = {
    keep: { residents: ['dora'], accounts: [{ id: 4 }], invited_by: { by: 'castle', named: 'carl', at: INVITED_AT } },
    castle: { residents: ['carl', 'cleo', 'moth'], accounts: [{ id: 5 }] },
    starforge: { residents: ['wren'], accounts: [{ id: 6 }] },
    'the-town': { residents: ['pen'], accounts: [{ id: 7 }] },
    nook: { residents: ['nell'], accounts: [{ id: 8 }], invited_by: { by: 'starforge', named: 'wren', at: INVITED_AT } },
    tower: { residents: ['tess'], accounts: [{ id: 9 }] },
    hall: { residents: ['hugo'], accounts: [{ id: 10 }], invited_by: { by: 'the-town', named: 'pen', at: INVITED_AT } },
  };
  LODGES.forEach((slug, i) => { h[slug] = { residents: [`lou${i + 1}`], accounts: [{ id: 100 + i }], invited_by: { by: 'castle', named: 'cleo', at: LODGE_AT } }; });
  return h;
}
function pins() {
  const p = { dora: { id: 4 }, carl: { id: 5 }, cleo: { id: 5 }, moth: { id: 5 }, wren: { id: 6 }, pen: { id: 7 }, nell: { id: 8 }, tess: { id: 9 }, hugo: { id: 10 } };
  LODGES.forEach((_, i) => { p[`lou${i + 1}`] = { id: 100 + i }; });
  return p;
}
function town({ mail = [] } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-invite-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins()));
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ households: households() }));
  for (const handle of Object.keys(pins())) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${mail.join('\n')}\n`);
  return repo;
}
function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
function runMint(repo, args) {
  try { return { ok: true, out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') }; }
}

// The lines, written the way the grammar writes them, with every field movable
// so a falsifier changes exactly one thing.
const WELCOME = (handle = 'dora', household = 'gh:4', date = '2026-10-28') => welcomeLine({ date, handle, household });
const INVITED = ({ n = 5, by = 'the-town', handle = 'dora', invited = 'hh:keep', inviter = 'hh:castle', date = '2026-10-28' } = {}) =>
  `- ${date} · MINT → ${handle} · ${n} · for: invite:${invited}/${inviter}/invited · by: ${by}`;
const INVITER = ({ n = 10, by = 'the-town', handle = 'carl', invited = 'hh:keep', inviter = 'hh:castle', activated = '2026-10-28', date = '2026-11-04' } = {}) =>
  `- ${date} · MINT → ${handle} · ${n} · for: invite:${invited}/${inviter}/inviter/${activated} · by: ${by}`;

// ── 1 · the grammar ─────────────────────────────────────────────────────────

test('1 · both sides classify as one kind, invite, each naming both houses', () => {
  assert.equal(inviteInvitedLine({ date: '2026-10-28', handle: 'dora', invited: 'hh:keep', inviter: 'hh:castle' }), INVITED());
  assert.equal(inviteInviterLine({ date: '2026-11-04', handle: 'carl', invited: 'hh:keep', inviter: 'hh:castle', activated: '2026-10-28' }), INVITER());
  assert.deepEqual(classifyEntry(INVITED()),
    { kind: 'invite', side: 'invited', date: '2026-10-28', handle: 'dora', n: 5, invited: 'hh:keep', inviter: 'hh:castle', activated: null, by: 'the-town' });
  assert.deepEqual(classifyEntry(INVITER()),
    { kind: 'invite', side: 'inviter', date: '2026-11-04', handle: 'carl', n: 10, invited: 'hh:keep', inviter: 'hh:castle', activated: '2026-10-28', by: 'the-town' });
  assert.equal(classifyEntry(INVITED({ invited: 'hh:cadaeic.space', inviter: 'gh:704250' })).inviter, 'gh:704250', 'any household key, dots and all');
});

test('1 · no sibling grammar mistakes an invite, and an invite mistakes none of them', () => {
  const siblings = [
    [giftLine({ date: '2026-10-28', handle: 'dora', n: 5, slug: 'invite', by: 'keeminlee' }), 'gift'],
    [firstIdeaLine({ date: '2026-10-28', handle: 'dora', mark: 'dora/invite' }), 'first-idea'],
    [welcomeLine({ date: '2026-10-28', handle: 'dora', household: 'gh:4' }), 'welcome'],
    [questPayLine({ date: '2026-10-28', handle: 'dora', quest: 'read-v2-feedback', household: 'gh:4' }), 'quest-pay'],
    [stageMintLine({ date: '2026-10-28', handle: 'dora', n: 2, post: 'dora/invite', stage: 'confirmed' }), 'post-stage'],
    [mintLine({ date: '2026-10-28', handle: 'dora', cause: 'a-1', side: 'sent' }), 'mint'],
    [transferLine({ date: '2026-10-28', from: 'dora', to: 'carl', n: 2, id: 'a-1' }), 'transfer'],
  ];
  for (const [line, kind] of siblings) assert.equal(classifyEntry(line).kind, kind, line);
  for (const bad of [
    INVITED().replace(' · by: the-town', ''),                                          // no authority
    INVITED({ n: 0 }),                                                                  // a zero is never a line
    INVITED().replace('/invited ·', ' ·'),                                              // no side
    INVITER().replace('/2026-10-28 ·', ' ·'),                                           // an inviter side with no activation day
    INVITED().replace('/invited ·', '/invited/2026-10-28 ·'),                           // an invited side carrying a day
    INVITED().replace('/hh:castle/', '/castle/'),                                       // an inviter that is not a key
  ]) assert.notEqual(classifyEntry(bad).kind, 'invite', bad);
});

// ── 2 · the lines ───────────────────────────────────────────────────────────

test('2 · the lines pin 5 and 10 and the-town, and refuse a forging key or day', () => {
  // LAW POS-576/a: "10 and 10"; POS-816 settled: the invited side's 5 more is its own line.
  assert.deepEqual(INVITE_PAY, { invited: 5, inviter: 10 }, 'the invited 5 more beside the welcome 5, and the inviter 10');
  assert.equal(INVITE_PAY.invited + 5, 10, 'with the welcome, the invited join bundle is 10');
  assert.throws(() => inviteInvitedLine({ date: '2026-10-28', handle: 'dora', invited: 'hh:keep · by: keeminlee', inviter: 'hh:castle' }), /invited household must be a key/);
  assert.throws(() => inviteInvitedLine({ date: '2026-10-28', handle: 'dora', invited: 'hh:keep', inviter: 'hh:castle/x' }), /inviter household must be a key/);
  assert.throws(() => inviteInviterLine({ date: '2026-11-04', handle: 'carl', invited: 'hh:keep', inviter: 'hh:castle', activated: 'soon' }), /activation must be a town day/);
  assert.equal(townDayOf(INVITED_AT), '2026-10-27', 'the invitation\'s town day is read on the town clock');
});

// ── 3 · the verb ────────────────────────────────────────────────────────────

const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;
function founded() {
  const repo = town({ mail: [D('2026-10-27', 'a-1', 'dora', 'carl'), D('2026-10-27', 'b-1', 'carl', 'dora')] });
  const { pub, priv } = keypair();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [MINT_CLI, '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  return { repo, pub, keyFile };
}
const inviteLines = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8').split('\n').filter((l) => l.includes('for: invite:'));
const invitedArgs = (keyFile, date = '2026-10-28', extra = []) => ['--invite-mint', 'dora', '--side', 'invited', '--invited', 'hh:keep', '--inviter', 'hh:castle', '--date', date, '--key', keyFile, ...extra];
const inviterArgs = (keyFile, { date = '2026-11-04', activated = '2026-10-28', handle = 'carl' } = {}) =>
  ['--invite-mint', handle, '--side', 'inviter', '--invited', 'hh:keep', '--inviter', 'hh:castle', '--activated', activated, '--date', date, '--key', keyFile];

test('3 · --invite-mint pays the invited 5 more only after its welcome, once, and it verifies', () => {
  const { repo, pub, keyFile } = founded();
  const early = runMint(repo, invitedArgs(keyFile));
  assert.equal(early.ok, false, 'no welcome yet');
  assert.match(early.out, /the rest of its join bundle, and its house holds no welcome bundle yet/);
  assert.equal(inviteLines(repo).length, 0);

  const balance = () => foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'))).get('dora') ?? 0;
  const beforeWelcome = balance();
  const welcomed = runMint(repo, ['--welcome', 'dora', '--household', 'gh:4', '--date', '2026-10-28', '--key', keyFile]);
  assert.equal(welcomed.ok, true, welcomed.out);
  const paid = runMint(repo, invitedArgs(keyFile));
  assert.equal(paid.ok, true, paid.out);
  assert.match(inviteLines(repo)[0], /^- 2026-10-28 · MINT → dora · 5 · for: invite:hh:keep\/hh:castle\/invited · by: the-town · sig: /);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  // LAW POS-576/a: "an invited household's join bundle is 10 stamps, 5 more than an ordinary join".
  assert.equal(balance() - beforeWelcome, 10, 'the invited join bundle is 10: the welcome 5 and the invite 5');

  const twice = runMint(repo, invitedArgs(keyFile));
  assert.equal(twice.ok, false);
  assert.match(twice.out, /already paid its invited side \(one line per invited house and side, ever\)/);
  assert.equal(inviteLines(repo).length, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('3 · invite stamps are spendable: they fund a later pays that would otherwise void', () => {
  // The precedent is stamp-mint.test.mjs "gift: funds a later pays that would
  // otherwise void". dora holds her 2 letter stamps, the welcome's 5 and the
  // invite's 5; her paying letter mints her 1 more before it settles: 13. A
  // pays of 12 settles only if the invite's 5 is counted (without it, 8).
  const { repo, pub, keyFile } = founded();
  assert.equal(runMint(repo, ['--welcome', 'dora', '--household', 'gh:4', '--date', '2026-10-28', '--key', keyFile]).ok, true);
  assert.equal(runMint(repo, invitedArgs(keyFile)).ok, true);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, `${readFileSync(ml, 'utf8')}- 2026-10-29 · c-1 · dora → tess · pays: 12 · thread: new\n`);
  execFileSync(process.execPath, [MINT_CLI, '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  const text = readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  assert.match(text, /- 2026-10-29 · dora → tess · 12 · via: mail:c-1/, 'a transfer');
  assert.doesNotMatch(text, /void · mail:c-1/);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('3 · --invite-mint pays the inviter a week after the activation, never sooner, and never twice', () => {
  const { repo, pub, keyFile } = founded();
  const soon = runMint(repo, inviterArgs(keyFile, { date: '2026-11-03' }));
  assert.equal(soon.ok, false, 'six days after the activation');
  assert.match(soon.out, /less than a week after the activation \(2026-10-28\): it waits 7 days/);
  const paid = runMint(repo, inviterArgs(keyFile, { date: '2026-11-04' }));
  assert.equal(paid.ok, true, paid.out);
  assert.match(inviteLines(repo)[0], /^- 2026-11-04 · MINT → carl · 10 · for: invite:hh:keep\/hh:castle\/inviter\/2026-10-28 · by: the-town · sig: /);
  assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true);
  const housemate = runMint(repo, inviterArgs(keyFile, { date: '2026-11-05', handle: 'cleo' }));
  assert.equal(housemate.ok, false, 'one inviter line per invitation, whichever resident of the house');
  assert.match(housemate.out, /already paid its inviter side/);
  rmSync(repo, { recursive: true, force: true });
});

test('3 · --invite-mint refuses a lying house, an inviter the invited house never named, and a bad side', () => {
  const { repo, keyFile } = founded();
  const lying = runMint(repo, inviterArgs(keyFile, { handle: 'tess' }));
  assert.equal(lying.ok, false);
  assert.match(lying.out, /the inviter side names household "hh:castle" but "tess" is gh:9/);
  const stranger = runMint(repo, ['--invite-mint', 'tess', '--side', 'inviter', '--invited', 'hh:keep', '--inviter', 'gh:9', '--activated', '2026-10-28', '--date', '2026-11-04', '--key', keyFile]);
  assert.equal(stranger.ok, false);
  assert.match(stranger.out, /hh:keep's own record names its inviter as castle, not gh:9/);
  const sideless = runMint(repo, ['--invite-mint', 'dora', '--side', 'both', '--invited', 'hh:keep', '--inviter', 'hh:castle', '--date', '2026-10-28', '--key', keyFile]);
  assert.equal(sideless.ok, false);
  assert.match(sideless.out, /--side must be invited or inviter/);
  const dayless = runMint(repo, ['--invite-mint', 'carl', '--side', 'inviter', '--invited', 'hh:keep', '--inviter', 'hh:castle', '--date', '2026-11-04', '--key', keyFile]);
  assert.equal(dayless.ok, false);
  assert.match(dayless.out, /--activated belongs to the inviter side/);
  assert.equal(inviteLines(repo).length, 0);
  rmSync(repo, { recursive: true, force: true });
});

// ── 4 · the verifier ────────────────────────────────────────────────────────

function verdict(lines) {
  const { pub, priv } = keypair();
  const repo = town();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const all = ['- 2026-06-12 · rules: stamps-v1', ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  const v = verifyStampLedger(repo, { pubkeyPem: pub, registry: { households: households() } });
  rmSync(repo, { recursive: true, force: true });
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)), 'the lines must be properly signed, or this tests the seal instead of the law');
  return v;
}
const green = (lines, why) => { const v = verdict(lines); assert.equal(v.ok, true, `${why}\n${v.problems.join('\n')}`); return v; };
const red = (lines, re) => {
  const v = verdict(lines);
  assert.equal(v.ok, false, String(re));
  assert.ok(v.problems.some((p) => re.test(p)), `${re}\n${v.problems.join('\n')}`);
};

test('4 · GREEN: a welcome, the invited 5 more, and the inviter 10 a week after the activation', () => {
  const v = green([WELCOME(), INVITED(), INVITER()], 'the lawful invitation');
  assert.equal(v.minted, 5 + 5 + 10);
});

test('4 · the amounts: the invited side is exactly 5 and the inviter side exactly 10', () => {
  // LAW POS-576/a: "10 and 10" (an invited join bundle of 10, the inviter 10).
  red([WELCOME(), INVITED({ n: 10 })], /an invite's invited side pays exactly 5 \(got 10\)/);
  red([WELCOME(), INVITED({ n: 4 })], /an invite's invited side pays exactly 5 \(got 4\)/);
  red([INVITER({ n: 9 })], /an invite's inviter side pays exactly 10 \(got 9\)/);
  red([INVITER({ n: 20 })], /an invite's inviter side pays exactly 10 \(got 20\)/);
  red([INVITER({ by: 'keeminlee' })], /an invite is the town's mint \(by: "keeminlee", must be the-town\)/);
  green([WELCOME(), INVITED(), INVITER()], 'the control: 5 and 10');
});

test('4 · the 30 days: the activation is within 30 days of the invitation, and not before it', () => {
  // LAW POS-576/b: "its first letter or its home within 30 days". The invitation's town day is 2026-10-27.
  assert.equal(INVITE_WITHIN_DAYS, 30);
  green([INVITER({ activated: '2026-11-26', date: '2026-12-03' })], 'the 30th day is within');
  red([INVITER({ activated: '2026-11-27', date: '2026-12-04' })], /the activation \(2026-11-27\) is more than 30 days after the invitation \(2026-10-27\)/);
  red([INVITER({ activated: '2026-10-26', date: '2026-11-04' })], /the activation \(2026-10-26\) is before the invitation \(2026-10-27\)/);
});

test('4 · the week: the inviter is paid at least 7 town days after the activation', () => {
  // LAW POS-816/a (Darko 2026-11-03 00:08 EDT): "A week".
  assert.equal(INVITE_HOLD_DAYS, 7);
  red([INVITER({ activated: '2026-10-28', date: '2026-11-03' })], /less than a week after the activation \(2026-10-28\)/);
  red([INVITER({ activated: '2026-10-28', date: '2026-10-28' })], /less than a week after the activation/);
  green([INVITER({ activated: '2026-10-28', date: '2026-11-04' })], 'the seventh day');
});

test('4 · the cap: at most 10 paid a month per inviting house, counted in the month it is paid', () => {
  // LAW POS-576/c: "let's do 10 a month"; POS-816/b: "Month paid".
  assert.equal(INVITE_CAP_PER_MONTH, 10);
  const lodge = (i, { date = '2026-11-20', activated = '2026-11-01', handle = 'carl' } = {}) =>
    INVITER({ invited: `hh:${LODGES[i]}`, activated, date, handle });
  const ten = LODGES.slice(0, 10).map((_, i) => lodge(i));
  green(ten, 'ten in November');
  red([...ten, lodge(10)], /hh:castle already holds 10 paid invitations in 2026-11, the month this one is paid in: at most 10 a month/);
  red([...ten, lodge(10, { handle: 'cleo' })], /already holds 10 paid invitations in 2026-11/);
  // Month paid, not month activated: the eleventh, activated in November and
  // paid in December, is December's first.
  green([...ten, lodge(10, { activated: '2026-11-25', date: '2026-12-02' })], 'the eleventh, paid in December');
  // the cap is the inviter's alone: an eleventh invited house still gets its 5 more
  green([WELCOME('lou11', 'gh:110'), INVITED({ handle: 'lou11', invited: 'hh:lodge11' }), ...ten], 'the eleventh invitee\'s own 5 is not capped');
});

test('4 · the founders pay like any other (cap and meeps included); the town\'s own household pays neither side, under any spelling', () => {
  // LAW POS-816/d (Darko 2026-11-03 09:31 EDT): "this should pay like any other under the new NOMOS".
  // Until 2026-11-03 this asserted POS-576/e ("No, never", Darko 2026-10-22 22:06): an invitation from
  // starforge was red on both sides, "an invitation from the founders' household or the town's own
  // (hh:starforge) pays neither side".
  assert.equal(INVITE_TOWN_HOUSE, 'hh:the-town');
  const welcome = WELCOME('nell', 'gh:8');
  const invited = INVITED({ handle: 'nell', invited: 'hh:nook', inviter: 'hh:starforge' });
  const inviter = INVITER({ handle: 'wren', invited: 'hh:nook', inviter: 'hh:starforge' });
  const v = green([welcome, invited, inviter], 'the founders\' invitation pays the 5 more and the 10');
  assert.equal(v.minted, 5 + 5 + 10, 'both sides, the amounts any other house\'s invitation pays');
  green([welcome, invited, INVITER({ handle: 'wren', invited: 'hh:nook', inviter: 'gh:6' })], 'and under the house\'s account spelling');
  // like any other: the 10 a month is theirs too, counted in the month paid
  const full = inviteState();
  full.counts.set('hh:starforge|2026-11', INVITE_CAP_PER_MONTH);
  const judge = (line, state) => judgeInviteLine(classifyEntry(line), { canon: (k) => k, invitationOf: () => ({ by: 'starforge', at: INVITED_AT }), houseAt: () => 'hh:starforge', isMeep: () => false, state });
  assert.match(judge(INVITER({ handle: 'wren', invited: 'hh:nook', inviter: 'hh:starforge', date: '2026-11-20' }), full),
    /hh:starforge already holds 10 paid invitations in 2026-11, the month this one is paid in: at most 10 a month/);
  assert.equal(judge(INVITER({ handle: 'wren', invited: 'hh:nook', inviter: 'hh:starforge', date: '2026-12-02' }), full), null, 'the next month has room');
  // MEEPS STAY OUT (POS-655): the Starforge household's meep is paid on neither side
  red([rulesV2Line('2026-10-01', ['wren']), welcome, invited, inviter], /invite pay to meep "wren" \(meeps stay outside the currency\)/);
  // the town's own household still pays neither side (it is the town's, not a household's)
  red([WELCOME('hugo', 'gh:10'), INVITED({ handle: 'hugo', invited: 'hh:hall', inviter: 'hh:the-town' })], /an invitation from the town's own household \(hh:the-town\) pays neither side/);
  red([INVITER({ handle: 'pen', invited: 'hh:hall', inviter: 'hh:the-town' })], /from the town's own household \(hh:the-town\)/);
  red([INVITER({ handle: 'pen', invited: 'hh:hall', inviter: 'gh:7' })], /from the town's own household \(hh:the-town\)/);
  green([WELCOME(), INVITED()], 'the control: an ordinary house\'s invitation');
});

test('4 · meeps: a meep is never paid on either side', () => {
  // LAW POS-576: "households and residents can be named, meeps can't"; the meep law holds on every mint.
  red([rulesV2Line('2026-10-01', ['moth']), INVITER({ handle: 'moth' })], /invite pay to meep "moth" \(meeps stay outside the currency\)/);
  green([rulesV2Line('2026-10-01', ['moth']), INVITER({ handle: 'carl' })], 'the control: a resident of the same house');
});

test('4 · the record: the invited house\'s own row names the inviter, the recipient is of its side\'s house, once per side', () => {
  red([WELCOME('tess', 'gh:9'), INVITED({ handle: 'tess', invited: 'hh:tower', inviter: 'hh:castle' })], /hh:tower's own record names no invitation/);
  red([INVITER({ handle: 'tess', inviter: 'gh:9' })], /hh:keep's own record names its inviter as castle, not gh:9/);
  red([INVITER({ handle: 'tess' })], /the inviter side names household "hh:castle" but "tess" is gh:9/);
  red([WELCOME(), INVITED({ handle: 'carl' })], /the invited side names household "hh:keep" but "carl" is gh:5/);
  red([INVITED()], /hh:keep's 5 more is the rest of its join bundle, and its house holds no welcome bundle yet/);
  red([WELCOME(), INVITED(), INVITED({ date: '2026-10-29' })], /hh:keep's invitation already paid its invited side/);
  red([INVITER(), INVITER({ handle: 'cleo', date: '2026-11-05' })], /hh:keep's invitation already paid its inviter side/);
  red([WELCOME(), INVITED({ inviter: 'hh:keep' })], /an invite names one house on both sides \(hh:keep\)/);
  green([WELCOME(), INVITED({ invited: 'gh:4' }), INVITER({ invited: 'gh:4', inviter: 'gh:5' })], 'a house under its account spelling is the same house');
});

// ── 5 · the quest row ──────────────────────────────────────────────────────

test('5 · Bring a neighbour is on the board: monthly, paid automatically, in the words Darko picked, and the word "real" stays out', () => {
  const reg = JSON.parse(readFileSync(join(HERE, '..', 'quest-registry.json'), 'utf8'));
  const row = reg.quests.find((q) => q.id === 'bring-a-neighbour');
  assert.ok(row, 'the row is on the board (POS-816: "the quest row goes on the board")');
  // POS-816/g (Darko 2026-11-03 09:42 EST: "if it's easier to just make a monthly cadence and keep things
  // flat that's fine with me"). Until 2026-11-03 this asserted 'ongoing', which the office reads as a funding pot.
  assert.equal(row.cadence, 'monthly');
  assert.equal(row.target, INVITE_CAP_PER_MONTH, 'the board\'s target is the cap it is paid under');
  assert.equal(row.validation, 'automatic');
  assert.equal(row.subtype, undefined, 'a quest, not a pot');
  // POS-816/e, option B (Darko 2026-11-03 09:31 EDT: "B"), whole. Until 2026-11-03 the file carried option A:
  // "Invite someone you'd like to have in town: send them postmark.town/join/?invite=<your handle>. When they
  // join, their household gets 10 stamps instead of 5. A week after their household sends its first letter or
  // claims its home, the town thanks yours with 10 stamps."
  assert.equal(row.source, 'Invite someone you\'d like to have in town. If they settle in, the town says thanks to you both: 10 stamps to their household when they join, and 10 to yours a week after their first letter or home. Your link: postmark.town/join/?invite=<your handle>.');
  for (const text of [row.title, row.source, row.reward, row.resets, row.awaits])
    assert.doesNotMatch(String(text), /\breal\b/i, `Little Bird 2026-10-30: keep "real" out of the town's words: ${text}`);
  for (const text of [row.source, row.reward, row.resets, row.awaits, row.derivation])
    assert.doesNotMatch(String(text), /founders/i, `POS-816/d: the founders pay like any other, so no word of the row says they do not: ${text}`);
  // POS-816/f, option A (Darko 2026-11-03 09:31 EDT: "A"): STAMPS.md's hold sentence does not name who holds it.
  const stamps = readFileSync(join(HERE, '..', 'STAMPS.md'), 'utf8').replace(/\*\*/g, '').replace(/\s+/g, ' ');
  assert.ok(stamps.includes('The town then waits a week before it pays, so a new household is looked at before anyone is thanked for it, and the payout can be held in that week, always with a reason.'));
  assert.doesNotMatch(stamps.split('### Bringing a neighbour')[1].split('### A vote')[0], /Little Bird/, 'option B named who holds it; A does not');
  assert.match(row.derivation, /invite:<invited-key>\/<inviter-key>\/invited/, 'the row reads the ledger\'s invite lines, the invited side');
  assert.match(row.derivation, /invite:<invited-key>\/<inviter-key>\/inviter\/<day>/, 'and the inviter side');
});
