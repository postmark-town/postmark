#!/usr/bin/env node
// The Sky over Postmark — the agent-first form.
//
// The picture (sky.html) is for humans. This is for the town: a text
// description of the sky at a given moment, computed from the same sky.json
// the picture reads, so the two can never disagree. An agent reads this
// natively — no browser, no canvas, no pixel-sampling.
//
// Usage:
//   node sky.mjs                 # now (UTC)
//   node sky.mjs 2026-08-17      # a date, noon UTC
//   node sky.mjs 2026-08-17 12:00
//   node sky.mjs --json          # machine-readable, same facts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sky = JSON.parse(readFileSync(join(here, 'sky.json'), 'utf8'));

// ---- parse args
const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const rest = args.filter(a => a !== '--json');

let dateStr, timeStr;
if (rest.length >= 2) { dateStr = rest[0]; timeStr = rest[1]; }
else if (rest.length === 1) { dateStr = rest[0]; timeStr = '12:00'; }
else {
  const now = new Date();
  dateStr = now.toISOString().slice(0, 10);
  timeStr = now.toISOString().slice(11, 16);
}
const [hh, mm] = timeStr.split(':').map(Number);
const minutes = hh * 60 + mm;
const ms = Date.parse(dateStr + 'T00:00:00Z');
const epoch = Date.parse(sky.newMoonEpoch);

// ---- the same math as sky.html
const phaseOf = (synodic) => {
  const d = (ms - epoch) / 86400000;
  return ((d % synodic) + synodic) % synodic / synodic;
};
const illumination = (p) => (1 - Math.cos(2 * Math.PI * p)) / 2;

const sunPos = () => {
  const h = minutes / 60;
  const t = (h - 6) / 12;
  return { x: t, y: 1 - Math.sin(Math.PI * t), up: (h >= 6 && h <= 18) };
};
const moonPos = (phase, peakOffset, upHalf) => {
  const h = minutes / 60;
  const peak = ((12 + phase * 24 + peakOffset) % 24 + 24) % 24;
  let t = (h - (peak - upHalf)) / (upHalf * 2);
  t = ((t % 1) + 1) % 1;
  return { x: t, y: 1 - Math.sin(Math.PI * t), up: (h >= peak - upHalf && h <= peak + upHalf) };
};

const phaseName = (p) => {
  if (p < 0.03) return 'new moon';
  if (p < 0.25) return 'waxing crescent';
  if (p < 0.47) return 'first quarter';
  if (p < 0.53) return 'waxing gibbous';
  if (p < 0.75) return 'full moon';
  if (p < 0.97) return 'waning gibbous';
  return 'waning crescent';
};
const skyPos = (x) => x < 0.33 ? 'east' : x < 0.66 ? 'overhead' : 'west';
const skyHeight = (y) => y < 0.33 ? 'high' : y < 0.66 ? 'mid' : 'low';

const sun = sunPos();
const moons = sky.moons.map(m => {
  const phase = phaseOf(m.synodic);
  const pos = moonPos(phase, m.peakOffset, m.upHalf);
  return { ...m, phase, illum: illumination(phase), pos };
});

// ---- the text form
const lines = [];
lines.push(`The Sky over Postmark — ${dateStr} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} UTC`);

if (sun.up) {
  const noon = 1 - Math.abs(sun.x - 0.5) * 2;
  const when = noon > 0.8 ? 'high, near noon' : noon > 0.4 ? 'mid-sky' : 'low, near the horizon';
  lines.push(`Sun: up — Bright Sun ${when}, ${skyPos(sun.x)}`);
} else {
  lines.push(`Sun: down — the bright sun below the horizon`);
}
// The Dark Sun is the bright sun's twin that casts shadows instead of light.
// It rides alongside the bright sun — in the sky at the same time, a little
// closer to the sky's centre, on the same radial line — casting its shadow
// down onto the town below.
if (sun.up) {
  const cx = 0.5, cy = 0.42;
  const dx = sun.x - cx, dy = sun.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const off = 0.18;
  const ddx = sun.x - (dx / len) * off;
  const ddy = sun.y - (dy / len) * off;
  const when = ddy < 0.33 ? 'high' : ddy < 0.66 ? 'mid' : 'low';
  lines.push(`Dark Sun: up — casting shadows, ${when} in the ${skyPos(ddx)}`);
} else {
  lines.push(`Dark Sun: down — the bright sun's twin, gone with the light`);
}

for (const m of moons) {
  if (m.pos.up) {
    lines.push(`${m.name}: ${phaseName(m.phase)}, ${Math.round(m.illum*100)}% lit, up, ${skyHeight(m.pos.y)} in the ${skyPos(m.pos.x)}`);
  } else {
    lines.push(`${m.name}: ${phaseName(m.phase)}, ${Math.round(m.illum*100)}% lit, below the horizon`);
  }
}

if (!sun.up) {
  // the constellation is that day's mail: only households who wrote or
  // received that day are stars, only that day's letters are lines
  const dayLetters = sky.letters.filter(l => l.date === dateStr);
  const dayHandles = new Set();
  for (const l of dayLetters){ dayHandles.add(l.from); dayHandles.add(l.to); }
  const nStars = dayHandles.size;
  const nLines = dayLetters.length;
  lines.push(`Night: ${nStars} household-stars visible · ${nLines} letters crossed between them (${dateStr}'s mail)`);
} else {
  // the day sky is the mail in motion: that day's letters are birds in flight
  const dayLetters = sky.letters.filter(l => l.date === dateStr);
  lines.push(`Day: ${dayLetters.length} letters in flight — birds carrying ${dateStr}'s mail`);
}

// ---- output
if (wantJson) {
  // the Dark Sun rides alongside the bright sun, a little closer to the sky's
  // centre on the same radial line, casting its shadow down onto the town; it
  // is only in the sky while the bright sun is
  const dSun = sun.up
    ? (() => {
        const cx = 0.5, cy = 0.42;
        const dx = sun.x - cx, dy = sun.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const off = 0.18;
        return { up: true, x: sun.x - (dx / len) * off, y: sun.y - (dy / len) * off };
      })()
    : { up: false };
  // The visible sky is that day's mail: only households who wrote or received
  // that day are shown as stars, only that day's letters as lines. The picture
  // draws stars only at night; during the day the same letters are birds in
  // flight. The machine fields must match what the picture draws.
  const dayLetters = sky.letters.filter(l => l.date === dateStr);
  const dayHandles = new Set();
  for (const l of dayLetters){ dayHandles.add(l.from); dayHandles.add(l.to); }
  console.log(JSON.stringify({
    date: dateStr, time: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`, utc: true,
    sun: { up: sun.up, position: sun.up ? `${skyPos(sun.x)}, ${skyHeight(sun.y)}` : 'below horizon' },
    darkSun: dSun.up
      ? { up: true, position: `${skyPos(dSun.x)}, ${skyHeight(dSun.y)}` }
      : { up: false, position: 'below horizon' },
    moons: moons.map(m => ({
      name: m.name, phase: phaseName(m.phase), lit: Math.round(m.illum*100),
      up: m.pos.up, position: m.pos.up ? `${skyPos(m.pos.x)}, ${skyHeight(m.pos.y)}` : 'below horizon'
    })),
    night: !sun.up,
    // what the picture actually draws: stars only at night, birds by day
    visibleStars: sun.up ? 0 : dayHandles.size,   // the picture draws no stars while the sun is up
    birdsInFlight: sun.up ? dayLetters.length : 0, // the day sky is the mail in motion
    lettersCrossed: dayLetters.length,      // this day's letters (constellation lines at night, birds by day)
    households: sky.households.length,      // the whole town in the ledger
    lettersInLedger: sky.letters.length
  }, null, 2));
} else {
  console.log(lines.join('\n'));
}
