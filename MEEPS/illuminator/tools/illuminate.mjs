#!/usr/bin/env node
// illuminate.mjs — the Illuminator's instrument.
//
// Drives codex's built-in `image_gen` tool headless and harvests the PNG it
// produces. One prompt file in, one image file out. The judgment — writing a
// faithful prompt from a resident's words, and LOOKING at the result before
// it enters a letter — is the Illuminator's, not this script's.
//
// Usage:
//   node illuminate.mjs <promptFile> <outPath>                 generate one candidate (downscaled — the default)
//   node illuminate.mjs <promptFile> <outPath> --keep-full     generate at full harvest size (archival/pixel-art)
//   node illuminate.mjs --check                                verify the instrument works (no generation)
//
// Two codex-on-Windows quirks this script exists to absorb (verified 2026-07-01):
//   1. The prompt must be piped via STDIN — a positional prompt arg hangs codex
//      on "Reading additional input from stdin".
//   2. codex's sandboxed shell cannot copy its own output ("windows sandbox:
//      spawn setup refresh"), so the PNG lands under
//      C:/Users/<user>/.codex/generated_images/<uuid>/ig_*.png with an opaque
//      name. We snapshot that tree before the run and harvest what's new after.
//
// Machine-local by design (needs the codex CLI + its ChatGPT subscription auth).
// No secrets in this file. Node built-ins only.

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const GENERATED = join(homedir(), '.codex', 'generated_images');
const TIMEOUT_MS = 10 * 60 * 1000; // codex generation runs a few minutes; 10 is generous
// The engine's built-in image_gen tool is model-gated. Plain gpt-5.4 was removed
// from the current ChatGPT-backed Codex catalogue in September 2026;
// gpt-5.4-mini is its current skill-capable successor and passed a real raster
// generation + harvest proof on 2026-09-05. Pin image runs here so the machine's
// global reasoning-model default stays untouched. Override with ILLUMINATE_MODEL.
const MODEL = process.env.ILLUMINATE_MODEL || 'gpt-5.4-mini';
const CODEX_ENTRY = join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');

// The built-in image tool authenticates through the Codex process's ChatGPT
// subscription and needs no OpenAI API key. Never let a broadly inherited key
// silently switch this child onto metered API auth; an explicit API-image
// fallback, if Keemin ever authorizes one, must be a separate instrument.
export function codexSubscriptionEnv(source = process.env) {
  const env = { ...source };
  delete env.OPENAI_API_KEY;
  return env;
}

// Candidate size policy (town image-courtesy, 2026-07-02): an offer is for
// JUDGMENT, not archival — a resident choosing between compositions doesn't
// need multi-MB files, and every enclosure lives in the town's repo forever
// (git keeps history; the size you commit is the size the town carries).
// Candidates are downscaled to ≤ MAX_DIM px on the longest side and saved as
// JPEG — ~150-350 KB for painterly night scenes vs ~2.4 MB raw. The CHOSEN
// image may be regenerated/kept at full size as the single archival copy
// (--keep-full), which also serves pixel-art where JPEG would smear.
const MAX_DIM = 1280;
const JPEG_QUALITY = 85;

function log(m) { process.stdout.write(m + '\n'); }
function fail(m) { process.stderr.write('illuminate: ' + m + '\n'); process.exit(1); }

export function isValidPngBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45) return false;
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return false;

  let offset = 8;
  let sawHeader = false;
  let sawImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const next = offset + 12 + length;
    if (next > bytes.length) return false;

    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13) return false;
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      if (width < 1 || height < 1 || width > 32_768 || height > 32_768) return false;
      sawHeader = true;
    }
    if (type === 'IDAT' && length > 0) sawImageData = true;
    if (type === 'IEND') return length === 0 && sawHeader && sawImageData && next === bytes.length;
    offset = next;
  }
  return false;
}

function decodePng(value) {
  if (typeof value === 'string') {
    const dataUrl = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    const encoded = dataUrl?.[1] ?? (value.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/=]+$/.test(value) ? value : null);
    if (!encoded) return null;
    const bytes = Buffer.from(encoded, 'base64');
    return isValidPngBytes(bytes) ? bytes : null;
  }
  return null;
}

export function extractPngFromJsonl(text) {
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const candidates = [];
      if (
        event?.type === 'event_msg' &&
        event?.payload?.type === 'image_generation_end' &&
        event?.payload?.status === 'completed'
      ) {
        candidates.push(event.payload.result);
      }
      if (
        event?.type === 'item.completed' &&
        ['image_generation', 'image_generation_call'].includes(event?.item?.type)
      ) {
        candidates.push(event.item.result, event.item.image_url);
      }
      for (const candidate of candidates) {
        const bytes = decodePng(candidate);
        if (bytes && !found.some((existing) => existing.equals(bytes))) found.push(bytes);
      }
    } catch {
      // stderr and ordinary prose may share the captured stream; ignore them.
    }
  }
  if (found.length > 1) throw new Error(`ambiguous Codex event stream: ${found.length} distinct generated PNGs`);
  return found[0] ?? null;
}

export function extractThreadIdFromJsonl(text) {
  for (const line of text.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event?.type === 'thread.started' && typeof event.thread_id === 'string') return event.thread_id;
    } catch {
      // Ignore non-JSON diagnostics.
    }
  }
  return null;
}

function isValidPngFile(file) {
  try {
    return isValidPngBytes(readFileSync(file));
  } catch {
    return false;
  }
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true, timeout: 5_000,
      });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // The process may have exited between the completed event and cleanup.
  }
}

function runCodexJson(prompt, scratch) {
  return new Promise((resolve, reject) => {
    if (!existsSync(CODEX_ENTRY)) {
      reject(new Error(`Codex Node entrypoint not found: ${CODEX_ENTRY}`));
      return;
    }
    const child = spawn(process.execPath, [
      CODEX_ENTRY, 'exec', '--json', '-m', MODEL, '--skip-git-repo-check',
      '--sandbox', 'workspace-write', '--cd', scratch, '-',
    ], {
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      env: codexSubscriptionEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let pending = '';
    let settled = false;
    let completionScheduled = false;
    let capturedBytes = 0;
    const maxCapture = 64 * 1024 * 1024;

    const release = () => {
      killProcessTree(child.pid);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      child.removeAllListeners();
      child.unref();
    };

    const capture = (chunk, stream) => {
      capturedBytes += chunk.length;
      if (capturedBytes > maxCapture) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          release();
          reject(new Error('codex JSON event stream exceeded 64 MB'));
        }
        return false;
      }
      if (stream === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
      return true;
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Codex can leave a helper process holding inherited stdio handles even
      // after turn.completed. We already own the complete event line, so close
      // our side explicitly rather than keeping illuminate alive on stale pipes.
      release();
      resolve(result);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      release();
      reject(new Error(`codex image generation exceeded ${TIMEOUT_MS / 60000} minutes`));
    }, TIMEOUT_MS);

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      release();
      reject(error);
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      if (!capture(chunk, 'stdout')) return;
      pending += text;

      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event?.type === 'turn.completed' && !completionScheduled) {
            // The full image event precedes turn.completed. Codex may leave a
            // helper holding inherited pipes open, so the event—not process
            // teardown—is the stable completion boundary. Keep a short bounded
            // grace period so diagnostics already in stderr can drain.
            completionScheduled = true;
            setTimeout(() => finish({ stdout, stderr, code: 0, completed: true }), 250);
            return;
          }
        } catch {
          // Keep capturing. Non-JSON diagnostics can appear on stdout.
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      capture(chunk, 'stderr');
    });

    child.on('close', (code) => finish({ stdout, stderr, code, completed: false }));
    child.stdin.end(prompt);
  });
}

// every image file under GENERATED, flat, with mtimes
function snapshotImages() {
  const out = new Map();
  if (!existsSync(GENERATED)) return out;
  for (const sub of readdirSync(GENERATED)) {
    const dir = join(GENERATED, sub);
    let entries;
    try { entries = statSync(dir).isDirectory() ? readdirSync(dir) : []; } catch { continue; }
    for (const f of entries) {
      const p = join(dir, f);
      try { out.set(p, statSync(p).mtimeMs); } catch { /* races are fine */ }
    }
  }
  return out;
}

// Downscale via .NET System.Drawing through PowerShell — reliably present on
// this box, no npm/imagemagick dependency; consistent with this instrument
// being machine-local anyway. Writes JPEG at `quality`, longest side ≤ maxDim.
function shrinkImage(inPath, outJpgPath, maxDim, quality) {
  const shrinkDir = mkdtempSync(join(tmpdir(), 'illuminate-shrink-'));
  const ps1 = join(shrinkDir, 'shrink.ps1');
  writeFileSync(ps1, `param($in,$out,[int]$maxDim,[int]$quality)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($in)
$scale = [Math]::Min(1.0, $maxDim / [Math]::Max($img.Width, $img.Height))
$w = [Math]::Max(1, [int]($img.Width * $scale)); $h = [Math]::Max(1, [int]($img.Height * $scale))
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $w, $h)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
$bmp.Save($out, $codec, $ep)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
`);
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, inPath, outJpgPath, String(maxDim), String(quality)], { encoding: 'utf8' });
  rmSync(shrinkDir, { recursive: true, force: true });
  if (r.status !== 0 || !existsSync(outJpgPath)) {
    return { ok: false, detail: (r.stderr || r.stdout || 'unknown').slice(-300) };
  }
  return { ok: true };
}

async function main() {
const rawArgs = process.argv.slice(2);
const keepFull = rawArgs.includes('--keep-full');
const args = rawArgs.filter((a) => a !== '--keep-full');

if (args[0] === '--check') {
  let version;
  try {
    if (!existsSync(CODEX_ENTRY)) throw new Error('entrypoint missing');
    const result = spawnSync(process.execPath, [CODEX_ENTRY, '--version'], { encoding: 'utf8', shell: false, windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr || 'version command failed');
    version = result.stdout.trim();
  }
  catch { fail('codex CLI not found on PATH — the instrument needs it'); }
  log(`codex: ${version}`);
  log(`model: ${MODEL} (image_gen is model-gated; override with ILLUMINATE_MODEL)`);
  log(`harvest dir: ${GENERATED} (${existsSync(GENERATED) ? 'exists' : 'will be created by codex on first generation'})`);
  log('check: OK (no generation attempted — a real run is the true test)');
  process.exit(0);
}

const [promptFile, outPath] = args;
if (!promptFile || !outPath) fail('usage: node illuminate.mjs <promptFile> <outPath> | --check');
if (!existsSync(promptFile)) fail(`prompt file not found: ${promptFile}`);

const userPrompt = readFileSync(promptFile, 'utf8').trim();
if (!userPrompt) fail('prompt file is empty');

// The wrapper instruction: a NATURAL raster-generation request. codex now routes
// image gen through its built-in `imagegen` skill; an over-rigid wrapper that
// demanded a "NO-IMAGE-CAPABILITY" sentinel made the model take that escape
// branch instead of generating (verified 2026-07-01 — a plain request succeeds,
// the sentinel-laden one fails). So: ask plainly, note the file needn't be copied
// (the sandbox can't, and harvesting is external), and let the harvest-diff below
// be the real success check — a new PNG means success, none means failure.
const fullPrompt = `Generate a raster image with your built-in image generation tool from the description below. Generate it directly — you do not need to copy or move the output file anywhere; that harvesting is handled outside this session. Do not substitute ASCII art, SVG, or a placeholder; if you genuinely cannot generate a raster image, say so plainly and why.\n\nDescription:\n${userPrompt}`;

const before = snapshotImages();
const scratch = mkdtempSync(join(tmpdir(), 'illuminate-'));

log('illuminate: generating (codex image_gen, a few minutes)...');
let run;
try {
  run = await runCodexJson(fullPrompt, scratch);
} catch (error) {
  fail(`codex spawn failed: ${error instanceof Error ? error.message : String(error)}`);
}
const output = (run.stdout || '') + (run.stderr || '');
// Success/failure is decided by the harvest-diff below (a new PNG appeared or it
// didn't), not by parsing prose — the model's phrasing is not a stable contract.

// Harvest the current structured event first. Keep the generated_images diff as
// backward compatibility for older Codex builds and desktop-originated runs.
let newest = null;
const inlinePng = extractPngFromJsonl(run.stdout || '');
if (inlinePng) {
  const inlinePath = join(scratch, 'image-gen-inline.png');
  writeFileSync(inlinePath, inlinePng);
  newest = { p: inlinePath, mtime: Date.now(), mode: 'Codex JSON event' };
} else {
  const after = snapshotImages();
  const threadId = extractThreadIdFromJsonl(run.stdout || '');
  if (!threadId) {
    fail('codex JSON omitted thread.started; refusing an uncorrelated generated_images harvest');
  }
  const changed = [];
  for (const [p, mtime] of after) {
    if (before.has(p) && before.get(p) === mtime) continue;
    if (!/\.png$/i.test(p) || !isValidPngFile(p)) continue;
    if (basename(dirname(p)) !== threadId) continue;
    changed.push({ p, mtime, mode: `generated_images side channel (${threadId})` });
  }
  if (changed.length > 1) {
    fail(`ambiguous image harvest: ${changed.length} validated PNGs changed for this run`);
  }
  newest = changed[0] ?? null;
}
if (!newest) {
  fail(`no new image appeared under ${GENERATED} — codex output tail:\n` + output.slice(-600));
}

mkdirSync(dirname(outPath), { recursive: true });
log(`illuminate: harvested ${newest.p} via ${newest.mode} (${(statSync(newest.p).size / 1024 / 1024).toFixed(2)} MB full)`);

let finalPath = outPath;
if (keepFull) {
  copyFileSync(newest.p, finalPath);
} else {
  // candidate mode (default): downscale per the town's image-courtesy policy.
  // JPEG output — if the asked-for extension isn't .jpg/.jpeg, swap it and say so.
  if (!/\.jpe?g$/i.test(finalPath)) {
    finalPath = finalPath.replace(/\.[^.\\/]+$/, '') + '.jpg';
    log(`illuminate: candidate saved as JPEG — output path adjusted to ${finalPath}`);
  }
  const shrunk = shrinkImage(newest.p, finalPath, MAX_DIM, JPEG_QUALITY);
  if (!shrunk.ok) {
    // Fail-soft to a truthfully named PNG rather than losing the render or
    // placing PNG bytes behind a .jpg extension.
    const fallbackPng = /\.png$/i.test(outPath)
      ? outPath
      : outPath.replace(/\.[^.\\/]+$/, '') + '.png';
    copyFileSync(newest.p, fallbackPng);
    finalPath = fallbackPng;
    log(`illuminate: WARNING — downscale failed (${shrunk.detail}); wrote FULL-SIZE instead. Shrink before it enters a letter.`);
  }
}

const size = statSync(finalPath).size;
log(`illuminate: wrote ${finalPath} (${(size / 1024 / 1024).toFixed(2)} MB${keepFull ? ', full — archival/--keep-full' : ''})`);
if (size < 10_000) log('illuminate: WARNING — suspiciously small file; look at it before trusting it');
if (!keepFull && size > 700_000) log('illuminate: NOTE — candidate is over ~0.7 MB even after downscale; consider a tighter crop or re-render');
log('illuminate: now LOOK at it before it enters a letter. That part is yours.');
rmSync(scratch, { recursive: true, force: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
