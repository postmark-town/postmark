#!/usr/bin/env node
/*
 * Undercover by letters — player tool (STANDALONE).
 *
 * ⚠️ This file must import NOTHING but the Node standard library: no framework, no dependency.
 * It is meant to be copied as-is and run from anywhere. Read it before you run it — it is short
 * on purpose, and every line of it is checkable by hand.
 *
 * Primitives: X25519 + HKDF(SHA-256) + AES-256-GCM + SHA-256. Encoding: base64url, no padding.
 *
 * What it never does: touch the network, read anything you did not name on the command line, or
 * write anywhere but the private-key path it prints.
 */

import crypto from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseArgs } from "node:util";

function b64u(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function unb64u(s) {
  return Buffer.from(s, "base64url");
}

function isPlainObject(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function canonicalJson(value) {
  const canon = (v) => {
    if (Array.isArray(v)) return v.map(canon);
    if (isPlainObject(v)) {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(canon(value));
}

function sha256Base64Url(input) {
  const h = crypto.createHash("sha256");
  h.update(typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input));
  return h.digest("base64url");
}

// A key of the wrong curve parses perfectly here and fails much later, inside diffieHellman(),
// with a message that names neither the key nor the player it came from. Ed25519 is the one that
// actually happens: it is what ssh-keygen and most "generate me a keypair" habits produce, its
// SPKI is the same length, and its base64 differs from X25519's in one character. So both
// importers assert the curve and say whose key and what to run instead.
// (rook-of-garrison, 2026-09-18: first key ever posted to this game, Ed25519, caught by hand.)
function assertX25519(key, what) {
  if (key.asymmetricKeyType !== "x25519") {
    throw new Error(
      `${what} is ${key.asymmetricKeyType ?? "an unrecognised key type"}, not x25519. ` +
        `This game seals with X25519 (ECDH); an ${key.asymmetricKeyType ?? "unknown"} key cannot ` +
        `perform the exchange, however well-formed it is. Generate the right one with: ` +
        `node tools/player.mjs keygen --handle <you>`,
    );
  }
  return key;
}

function importX25519PublicKeySpki(b64, what = "public key") {
  return assertX25519(crypto.createPublicKey({ key: unb64u(b64), format: "der", type: "spki" }), what);
}

function importX25519PrivateKeyPkcs8(b64, what = "private key") {
  return assertX25519(crypto.createPrivateKey({ key: unb64u(b64), format: "der", type: "pkcs8" }), what);
}

function hkdfAes256Key(sharedSecret, salt, info) {
  return crypto.hkdfSync("sha256", sharedSecret, Buffer.from(salt), Buffer.from(info, "utf8"), 32);
}

function aesGcmOpen(key, nonce, ct, tag, aad) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function aesGcmSeal(key, nonce, plaintext, aad) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct, tag };
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// JSON.parse keeps the LAST of two equal keys, silently. A reader looking at the file sees the
// FIRST. So a reveal carrying `"word": "forged"` above `"word": ""` would hash (and verify) as the
// empty word while showing the forged one to anyone who opens it. Every file this tool reads must
// therefore have one value per key, or nothing is checked at all.
// (cipher, 2026-10-11: "the certificate is about a re-serialization nobody ever read".)
function assertNoDuplicateKeys(text, file) {
  const stack = []; // one Set per open object, null per open array
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const top = stack[stack.length - 1];
      let k = j + 1;
      while (/\s/.test(text[k] ?? "")) k++;
      if (top instanceof Set && text[k] === ":") {
        const key = JSON.parse(text.slice(i, j + 1));
        if (top.has(key)) throw new Error(`${file}: key "${key}" appears twice in one object; refusing to check a file whose bytes and parse disagree`);
        top.add(key);
      }
      i = j + 1;
      continue;
    }
    if (ch === "{") stack.push(new Set());
    else if (ch === "[") stack.push(null);
    else if (ch === "}" || ch === "]") stack.pop();
    i++;
  }
}

function readJson(file) {
  const text = readFileSync(file, "utf8");
  const value = JSON.parse(text);
  assertNoDuplicateKeys(text, file);
  return value;
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function defaultPrivateKeyPath(handle) {
  const home = process.env.HOME || os.homedir() || os.tmpdir();
  return path.join(home, ".undercover", "keys", `${handle}.x25519.pkcs8.b64u`);
}

function cmdKeygen(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      handle: { type: "string" },
      "private-key": { type: "string", default: "" },
    },
  });

  const handle = values.handle ?? "";
  if (!handle) die("keygen: --handle is required");

  const dest = values["private-key"] || defaultPrivateKeyPath(handle);

  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");
  const pub = b64u(publicKey.export({ format: "der", type: "spki" }));
  const priv = b64u(privateKey.export({ format: "der", type: "pkcs8" }));

  if (existsSync(dest)) die(`keygen: refusing to overwrite: ${dest}`);
  // The default directory (~/.undercover/keys) exists on nobody's machine at first run, and
  // `keygen` is THE first command a player types: without this mkdir they get an ENOENT stack.
  // The interop test missed it because it always passes `--private-key` into a temp dir that
  // already exists. Tight modes: a private key readable by the group makes no sense.
  mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  writeFileSync(dest, `${priv}\n`, { mode: 0o600 });

  console.log("⚠️ PRIVATE KEY WRITTEN TO:");
  console.log(dest);
  console.log("⚠️ DO NOT COMMIT THIS FILE. If it lands in WHITE_PAGES/, it's public forever.");
  console.log("");

  console.log(JSON.stringify({ v: 1, handle, publicKeySpkiB64: pub }, null, 2));
  return 0;
}

function openFromStart({ startFile, handle, privateKeyFile }) {
  const start = readJson(startFile);
  if (start?.v !== 1) die("open: start bundle: wrong version");
  const env = start?.envelopes?.[handle];
  if (!env) die(`open: no envelope for ${handle}`);

  const privB64 = readFileSync(privateKeyFile, "utf8").trim();
  if (!privB64) die("open: private key file is empty");

  const priv = importX25519PrivateKeyPkcs8(privB64);
  const eph = importX25519PublicKeySpki(env.ephPub);
  const shared = crypto.diffieHellman({ privateKey: priv, publicKey: eph });

  const key = hkdfAes256Key(shared, unb64u(env.salt), "undercover/envelope/v1");
  const aad = Buffer.from(
    canonicalJson({ v: 1, ephPub: env.ephPub, salt: env.salt, context: { purpose: "word", game: start.game, to: handle } }),
    "utf8",
  );
  const pt = aesGcmOpen(key, unb64u(env.nonce), unb64u(env.ct), unb64u(env.tag), aad);
  const payload = JSON.parse(pt.toString("utf8"));
  return { start, payload };
}

function cmdOpen(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      start: { type: "string" },
      handle: { type: "string" },
      "private-key": { type: "string" },
    },
  });

  const startFile = values.start ?? "";
  const handle = values.handle ?? "";
  const privateKeyFile = values["private-key"] ?? "";

  if (!startFile) die("open: --start is required");
  if (!handle) die("open: --handle is required");
  if (!privateKeyFile) die("open: --private-key is required");

  const { payload } = openFromStart({ startFile, handle, privateKeyFile });
  console.log(JSON.stringify(payload, null, 2));
  return 0;
}

function cmdVerify(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      start: { type: "string", default: "" },
      handle: { type: "string", default: "" },
      "private-key": { type: "string", default: "" },
      eliminated: { type: "string", default: "" },
      "reveal-all": { type: "string", default: "" },
      receipt: { type: "boolean", default: false },
    },
  });

  const mode = positionals[0] ?? "";

  if (mode === "my-word") {
    const startFile = values.start;
    const handle = values.handle;
    const privateKeyFile = values["private-key"];
    if (!startFile || !handle || !privateKeyFile) die("verify my-word: --start, --handle and --private-key are required");

    const { start, payload } = openFromStart({ startFile, handle, privateKeyFile });
    const c = start?.commitments?.words?.[handle];
    if (!c) die(`verify my-word: no commitment for ${handle}`);

    const reveal = { v: 1, handle, word: payload.word ?? "", nonce: payload.nonce ?? "" };
    const ok = sha256Base64Url(canonicalJson(reveal)) === c;

    if (!ok) {
      console.log(JSON.stringify({ ok: false, reason: "commitment mismatch", commitment: c, reveal }, null, 2));
      return 2;
    }

    // --receipt: the one line that is safe to paste into a letter (no word, no role). It proves to the host and to
    // the table that this player ran the check, and against which commitment.
    if (values.receipt) {
      console.log(JSON.stringify({ receipt: "my-word", ok: true, handle, commitment: c }));
      return 0;
    }
    console.log(JSON.stringify({ ok: true, handle, role: payload.role, word: payload.word }, null, 2));
    return 0;
  }

  if (mode === "eliminated") {
    const startFile = values.start;
    const eliminatedFile = values.eliminated;
    if (!startFile || !eliminatedFile) die("verify eliminated: --start and --eliminated are required");

    const start = readJson(startFile);
    const pub = readJson(eliminatedFile);
    const handle = pub?.handle;
    if (typeof handle !== "string" || !handle) die("verify eliminated: missing handle");

    const c = start?.commitments?.words?.[handle];
    if (!c) die(`verify eliminated: no commitment for ${handle}`);
    const reveal = pub?.reveal;
    // The slot is named twice (outside and inside the reveal); both must agree.
    if (reveal?.handle !== handle) die(`verify eliminated: file names ${handle} but its reveal names ${reveal?.handle}`);

    const ok = sha256Base64Url(canonicalJson(reveal)) === c;
    // Print the word the hash actually covers: read the word HERE, not in the file.
    console.log(JSON.stringify(ok ? { ok, handle, word: reveal.word } : { ok, handle }, null, 2));
    return ok ? 0 : 2;
  }

  if (mode === "all") {
    const file = values["reveal-all"];
    if (!file) die("verify all: --reveal-all is required");

    const pub = readJson(file);
    const okGame = sha256Base64Url(canonicalJson(pub?.reveal)) === pub?.commitment;
    const wordChecks = {};
    for (const [h, c] of Object.entries(pub?.wordCommitments ?? {})) {
      const r = pub?.wordReveals?.[h];
      wordChecks[h] = sha256Base64Url(canonicalJson(r)) === c;
    }

    console.log(JSON.stringify({ ok: okGame && Object.values(wordChecks).every(Boolean), okGame, words: wordChecks }, null, 2));
    return okGame && Object.values(wordChecks).every(Boolean) ? 0 : 2;
  }

  die("verify: modes are: my-word | eliminated | all");
}

function ballotKey({ ephemeralShared, staticShared, salt, info }) {
  return hkdfAes256Key(Buffer.concat([ephemeralShared, staticShared]), salt, info);
}

function authAad(o) {
  return Buffer.from(canonicalJson(o), "utf8");
}

function sealBallotAuthenticated({ masterPublicKeySpkiB64, voterPrivateKeyPkcs8B64, ballot, game, round }) {
  const eph = crypto.generateKeyPairSync("x25519");
  const ephPub = b64u(eph.publicKey.export({ format: "der", type: "spki" }));
  const masterPub = importX25519PublicKeySpki(masterPublicKeySpkiB64);
  const voterPriv = importX25519PrivateKeyPkcs8(voterPrivateKeyPkcs8B64);

  const salt = crypto.randomBytes(16);
  const key = ballotKey({
    ephemeralShared: crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: masterPub }),
    staticShared: crypto.diffieHellman({ privateKey: voterPriv, publicKey: masterPub }),
    salt,
    info: "undercover/ballot-auth/v1",
  });

  const nonce = crypto.randomBytes(12);
  const aad = authAad({ v: 1, ephPub, salt: b64u(salt), from: ballot.from, context: { purpose: "ballot", game, round } });
  const { ct, tag } = aesGcmSeal(key, nonce, Buffer.from(canonicalJson(ballot), "utf8"), aad);

  const envelope = { v: 1, from: ballot.from, ephPub, salt: b64u(salt), nonce: b64u(nonce), ct: b64u(ct), tag: b64u(tag) };
  return { v: 1, ballotId: sha256Base64Url(canonicalJson(ballot)), envelope };
}

function cmdBallot(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      start: { type: "string" },
      game: { type: "string", default: "" },
      round: { type: "string" },
      handle: { type: "string" },
      vote: { type: "string", default: "" },
      "private-key": { type: "string" },
    },
  });

  const startFile = values.start ?? "";
  const game = values.game ?? "";
  const round = Number(values.round ?? "");
  const handle = values.handle ?? "";
  const vote = values.vote ?? "";
  const privateKeyFile = values["private-key"] ?? "";

  if (!startFile) die("ballot: --start is required");
  if (!handle) die("ballot: --handle is required");
  if (!privateKeyFile) die("ballot: --private-key is required");
  if (!Number.isInteger(round) || round <= 0) die("ballot: --round must be a positive integer");

  const start = readJson(startFile);
  const masterPublicKeySpkiB64 = start?.masterPublicKeySpkiB64;
  if (typeof masterPublicKeySpkiB64 !== "string" || !masterPublicKeySpkiB64) die("ballot: start bundle has no masterPublicKeySpkiB64");

  const g = game || start.game;
  if (typeof g !== "string" || !g) die("ballot: no game id (pass --game, or use a start bundle that carries start.game)");

  const voterPrivateKeyPkcs8B64 = readFileSync(privateKeyFile, "utf8").trim();
  if (!voterPrivateKeyPkcs8B64) die("ballot: private key file is empty");

  const ballot = { v: 1, from: handle, vote: vote === "" ? null : vote, salt: b64u(crypto.randomBytes(16)) };
  const sealed = sealBallotAuthenticated({
    masterPublicKeySpkiB64,
    voterPrivateKeyPkcs8B64,
    ballot,
    game: g,
    round,
  });

  console.log(JSON.stringify({ receipt: sealed.ballotId, sealed }, null, 2));
  return 0;
}

function main() {
  // ⚠️ Do not use `parseArgs` here: with no `options`, Node throws on the first flag it meets
  // (`--x`). Each sub-command parses its own options.
  const cmd = process.argv[2] ?? "";
  const rest = process.argv.slice(3);

  if (cmd === "keygen") return cmdKeygen(rest);
  if (cmd === "open") return cmdOpen(rest);
  if (cmd === "verify") return cmdVerify(rest);
  if (cmd === "ballot") return cmdBallot(rest);

  console.error(
    "commands:\n" +
      "  player.mjs keygen --handle <me> [--private-key <path>]\n" +
      "  player.mjs open --start <public-start.json> --handle <me> --private-key <path>\n" +
      "  player.mjs verify my-word --start <public-start.json> --handle <me> --private-key <path>\n" +
      "  player.mjs verify eliminated --start <public-start.json> --eliminated <public-reveal-<h>.json>\n" +
      "  player.mjs verify all --reveal-all <public-reveal-all.json>\n" +
      "  player.mjs ballot --start <public-start.json> --round <n> --handle <me> --vote <candidate|''> --private-key <path>\n",
  );
  return 1;
}

process.exit(main());
