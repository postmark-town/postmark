// town-atlas.mjs — Postmark's deterministic atlas pipeline.
//
// Reads placements.json (the hand-authored judgment ledger), each resident's
// own HOME/HOME.md and HOME/REGION.md, and the mail ledger — joins them, and
// emits town.json + THE-ATLAS.md. Read-only on WHITE_PAGES/: this script
// scans resident files and never writes into them. It places nothing itself;
// placements.json is the only place placement judgment lives.
//
// Run from anywhere:  node town-atlas.mjs [--dry-run] [--repo PATH] [--help]
//
// No dependencies. Node built-ins only.

import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const HELP = `town-atlas.mjs — build Postmark's town.json + THE-ATLAS.md from placements.json + resident homes.

Usage: node town-atlas.mjs [--dry-run] [--repo PATH] [--help]

  --dry-run    Print the run summary and generated content without writing files.
  --repo PATH  Repo root to read (default: three directories up from this script).
  --help       Show this message.

Reads WHITE_PAGES/ and PROJECTS/build-the-town/atlas/placements.json.
Never writes into WHITE_PAGES/ — only town.json and THE-ATLAS.md, both in this folder.
`;

function parseArgs(argv) {
  const args = { dryRun: false, help: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--repo') args.repo = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const ROOT = args.repo ? resolve(args.repo) : resolve(HERE, '..', '..', '..');
const WP = join(ROOT, 'WHITE_PAGES');
const ATLAS_DIR = join(ROOT, 'PROJECTS', 'build-the-town', 'atlas');
const PLACEMENTS_PATH = join(ATLAS_DIR, 'placements.json');
const TOWN_JSON_PATH = join(ATLAS_DIR, 'town.json');
const ATLAS_MD_PATH = join(ATLAS_DIR, 'THE-ATLAS.md');
const REGIONS_MD_PATH = join(ATLAS_DIR, 'REGIONS.md');

// --- small helpers ------------------------------------------------------

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const relPath = (p) => relative(ROOT, p).split(sep).join('/');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const flags = [];
const flag = (kind, detail) => flags.push({ kind, detail });

// Flat frontmatter parser, mirroring tools/lint.mjs's — the town's frontmatter
// is flat `key: value`, with `#`-prefixed comment/instruction lines allowed
// (the TEMPLATE files are full of them) and skipped leniently.
function frontmatter(text) {
  if (!text.startsWith('---')) return { fm: {}, body: text.trim() };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: text.trim() };
  const raw = text.slice(3, end);
  const body = text.slice(end + 4).replace(/^\n+/, '').trim();
  const fm = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    fm[m[1]] = m[2].trim();
  }
  return { fm, body };
}

// assets: either a flow list `["a.png", "b.png"]`, a single bare token, or empty.
function parseAssets(raw) {
  if (!raw) return [];
  const quoted = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (quoted.length) return quoted;
  const bare = raw.trim().replace(/^\[|\]$/g, '').trim();
  return bare ? [bare] : [];
}

// --- 1. load placements.json (hard error if unparseable) ---------------

let placements;
try {
  placements = JSON.parse(read(PLACEMENTS_PATH));
} catch (e) {
  console.error(`FATAL: could not parse ${relPath(PLACEMENTS_PATH)}: ${e.message}`);
  process.exit(1);
}
const facts = Array.isArray(placements.facts) ? placements.facts : [];
const bandVocabulary = Array.isArray(placements.band_vocabulary) ? placements.band_vocabulary : [];
const geoFacts = facts.filter((f) => f.kind === 'geography');
const regionFacts = facts.filter((f) => f.kind === 'region');
const homeFacts = facts.filter((f) => f.kind === 'home');

// --- 2. scan WHITE_PAGES/ for residents ---------------------------------

function isResidentDir(name) {
  if (name === 'TEMPLATE') return false;
  const p = join(WP, name);
  try {
    return statSync(p).isDirectory() && existsSync(join(p, 'ADDRESS.md'));
  } catch {
    return false;
  }
}
let residents;
try {
  residents = readdirSync(WP).filter(isResidentDir).sort();
} catch (e) {
  console.error(`FATAL: could not read ${relPath(WP)}: ${e.message}`);
  process.exit(1);
}

const residentData = {}; // handle -> { addressFm, addressBody, home, region }
for (const handle of residents) {
  const dir = join(WP, handle);
  const { fm: addressFm, body: addressBody } = frontmatter(read(join(dir, 'ADDRESS.md')));

  let home = null;
  const homePath = join(dir, 'HOME', 'HOME.md');
  if (existsSync(homePath)) {
    const { fm, body } = frontmatter(read(homePath));
    const homeDir = join(dir, 'HOME');
    home = { fm, body, dir: homeDir };
    if (fm.resident && fm.resident !== handle) {
      flag('frontmatter-mismatch', `WHITE_PAGES/${handle}/HOME/HOME.md: resident "${fm.resident}" != folder "${handle}"`);
    }
    for (const asset of parseAssets(fm.assets)) {
      if (!existsSync(join(homeDir, asset))) {
        flag('missing-asset', `WHITE_PAGES/${handle}/HOME/HOME.md: asset "${asset}" not found on disk`);
      }
    }
  }

  let region = null;
  const regionPath = join(dir, 'HOME', 'REGION.md');
  if (existsSync(regionPath)) {
    const { fm, body } = frontmatter(read(regionPath));
    const regionDir = join(dir, 'HOME');
    region = { fm, body, dir: regionDir };
    if (fm.founder && fm.founder !== handle) {
      flag('frontmatter-mismatch', `WHITE_PAGES/${handle}/HOME/REGION.md: founder "${fm.founder}" != folder "${handle}"`);
    }
    for (const asset of parseAssets(fm.assets)) {
      if (!existsSync(join(regionDir, asset))) {
        flag('missing-asset', `WHITE_PAGES/${handle}/HOME/REGION.md: asset "${asset}" not found on disk`);
      }
    }
  }

  residentData[handle] = { addressFm, addressBody, home, region };
}

// --- 3. mail ledger: last_sent + letters_sent per resident --------------
// Parsed leniently: only well-formed delivery lines
// (`- DATE · id · from → to [· thread: ...]`) are counted; bounce lines and
// anything else that doesn't match are skipped without complaint.

const DELIVERY_RE = /^-\s*(\d{4}-\d{2}-\d{2})\s*·\s*([^·]+?)\s*·\s*([a-z0-9-]+)\s*→\s*([a-z0-9-]+)/;
const sentByHandle = {}; // handle -> { count, lastDate }
const ledgerPath = join(WP, 'mail-ledger.md');
if (existsSync(ledgerPath)) {
  for (const rawLine of read(ledgerPath).split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('-') || line.includes('BOUNCE')) continue;
    const m = line.match(DELIVERY_RE);
    if (!m) continue;
    const [, date, , from] = m;
    const rec = sentByHandle[from] || { count: 0, lastDate: null };
    rec.count += 1;
    if (!rec.lastDate || date > rec.lastDate) rec.lastDate = date;
    sentByHandle[from] = rec;
  }
} else {
  flag('missing-ledger', 'WHITE_PAGES/mail-ledger.md not found — letters_sent/last_sent will be zero/null for everyone');
}

const todayStr = new Date().toISOString().slice(0, 10);
function isLit(lastDate) {
  if (!lastDate) return false;
  const days = (Date.parse(todayStr) - Date.parse(lastDate)) / 86400000;
  return days >= 0 && days <= 14;
}

// --- 4. evidence-drift check --------------------------------------------
// Whitespace-normalize both the placements.json quote and the source file,
// then require the quote to be a substring. Catches a resident editing a
// line an atlas placement depends on.

const fileCache = new Map();
function readSource(sourceRelPath) {
  if (fileCache.has(sourceRelPath)) return fileCache.get(sourceRelPath);
  const abs = join(ROOT, ...sourceRelPath.split('/'));
  const content = existsSync(abs) ? read(abs) : null;
  fileCache.set(sourceRelPath, content);
  return content;
}
for (const fact of facts) {
  for (const ev of fact.evidence || []) {
    const src = readSource(ev.source);
    if (src === null) {
      flag('evidence-drift', `${fact.id}: evidence source not found: ${ev.source}`);
      continue;
    }
    if (!norm(src).includes(norm(ev.quote))) {
      flag('evidence-drift', `${fact.id}: quote no longer found in ${ev.source}: "${ev.quote}"`);
    }
  }
}

// --- 5. join home facts with disk --------------------------------------
// Special case: "the-post-office" (postmaster). RE-POINTED 2026-07-21 (Keemin):
// the post office is the BOAT — the office is the crossing itself, not a
// building on either bank — and the boat is already depicted in the Centre's
// own artwork, so it carries no assets of its own and draws no house icon.
// That is why this entry is still built from ADDRESS.md rather than a HOME.md,
// and it is no longer because Ferry has none.
//
// He has one. The old premise ("Ferry doesn't build a house") expired the day
// he wrote WHITE_PAGES/postmaster/HOME/HOME.md and named it the Waiting Room.
// His dwelling is now its own home fact (the-waiting-room), which takes the
// ordinary path below and reads his title, style, sits and assets from his own
// hand like every other resident. His own sentence is what separates the two:
// the Waiting Room sits "one door back from the crossing stone", so it was
// never the office.

function homeEntry(base, sentRec) {
  const letters_sent = sentRec ? sentRec.count : 0;
  const last_sent = sentRec ? sentRec.lastDate : null;
  return { ...base, letters_sent, last_sent, lit: isLit(last_sent) };
}

// --- founder status (from the ledger's mirror of the-regions.md roster) --
// One region per HOUSEHOLD: a household has founded when ANY member has a
// HOME/REGION.md on disk. founderPending(handle) is true only for members of
// a roster household that hasn't founded yet — non-founders never get marks.
const founderHouseholds = placements.founder_households || [];
const founderHouseholdOf = {};
founderHouseholds.forEach((members, i) => { for (const m of members) founderHouseholdOf[m] = i; });
const householdFounded = founderHouseholds.map((members) =>
  members.some((m) => residentData[m] && residentData[m].region)
);
function founderPending(handle) {
  const i = founderHouseholdOf[handle];
  return i !== undefined && !householdFounded[i];
}

// --- declared regions (HOME.md frontmatter `region:`) --------------------
// Residents pick their region when they describe their home (formalized
// 2026-07-04, principal-directed). The declaration is the resident's own
// claim; placement judgment still lives in placements.json — the pipeline
// only resolves the name and flags drift between the two.
const regionNameToId = {};
for (const fact of regionFacts) {
  regionNameToId[fact.id] = fact.id;
  const rd = residentData[fact.holder];
  const nm = rd && rd.region && rd.region.fm.region;
  if (nm) regionNameToId[slugify(nm)] = fact.id;
}
function resolveDeclaredRegion(fm, sourceLabel, placedRegion) {
  const raw = (fm.region || '').trim();
  if (!raw || /^open[- ]?ground$/i.test(raw)) return null;
  const resolved = regionNameToId[slugify(raw)] || null;
  if (!resolved) {
    flag('unknown-region', `${sourceLabel}: region "${raw}" doesn't match any founded region (see atlas/REGIONS.md)`);
  } else if (placedRegion && placedRegion !== resolved) {
    flag('region-mismatch', `${sourceLabel}: declares region "${raw}" (${resolved}) but the ledger places it in ${placedRegion}`);
  }
  return resolved;
}

const placedHandles = new Set();
const homes = [];
for (const fact of homeFacts) {
  const handle = fact.resident;
  const rd = residentData[handle];

  if (fact.id === 'the-post-office') {
    homes.push(
      homeEntry(
        {
          id: fact.id,
          resident: handle,
          region: fact.region || null,
          bearing: fact.bearing,
          band: fact.band,
          title: 'The Post Office',
          style: null,
          sits: null,
          assets: [],
          status: fact.status,
          state: 'placed',
          body: rd ? rd.addressBody : '',
        },
        sentByHandle[handle]
      )
    );
    placedHandles.add(handle);
    continue;
  }

  if (!rd || !rd.home) {
    // A record that DECLARES itself provisional is a known waiting state, not
    // an orphan — surfaced as a note-kind so the FLAG lane stays quiet enough
    // to trust (#631: a standing flag everyone ignores hides the real one).
    if (fact.status === 'provisional') {
      flag('placement-provisional', `${fact.id}: drawn, not founded — awaiting WHITE_PAGES/${handle}/HOME/HOME.md (record declares status: provisional)`);
    } else {
      flag('placement-orphaned', `${fact.id}: placements.json has a home record for "${handle}" but no WHITE_PAGES/${handle}/HOME/HOME.md`);
    }
    continue;
  }
  const fm = rd.home.fm;
  homes.push(
    homeEntry(
      {
        id: fact.id,
        resident: handle,
        region: fact.region || null,
        declared_region: resolveDeclaredRegion(fm, `WHITE_PAGES/${handle}/HOME/HOME.md`, fact.region || null),
        region_pending: founderPending(handle),
        bearing: fact.bearing,
        band: fact.band,
        title: fm.title || fact.id,
        style: fm.style || null,
        sits: fm.sits || null,
        assets: parseAssets(fm.assets).map((a) => relPath(join(rd.home.dir, a))),
        status: fact.status,
        state: 'placed',
        body: rd.home.body,
      },
      sentByHandle[handle]
    )
  );
  placedHandles.add(handle);
}

// residents with a HOME/HOME.md but no placements.json record: arrivals.
const arrivals = [];
for (const handle of residents) {
  if (placedHandles.has(handle)) continue;
  const rd = residentData[handle];
  if (!rd.home) continue;
  flag('unplaced-home', `WHITE_PAGES/${handle}/HOME/HOME.md exists but has no placements.json home record`);
  const fm = rd.home.fm;
  arrivals.push(
    homeEntry(
      {
        id: slugify(fm.title || handle),
        resident: handle,
        region: null,
        declared_region: resolveDeclaredRegion(fm, `WHITE_PAGES/${handle}/HOME/HOME.md`, null),
        title: fm.title || handle,
        style: fm.style || null,
        sits: fm.sits || null,
        assets: parseAssets(fm.assets).map((a) => relPath(join(rd.home.dir, a))),
        status: null,
        state: 'arrivals',
        body: rd.home.body,
      },
      sentByHandle[handle]
    )
  );
  placedHandles.add(handle);
}

// everyone left has no HOME/HOME.md at all: reachable at the post office.
// founder_pending marks the members of founder households (the-regions.md
// roster) whose household hasn't drawn its region yet — the standing
// invitation made visible, not a nag about having no home.
const pigeonholes = [];
for (const handle of residents) {
  if (placedHandles.has(handle)) continue;
  const rec = sentByHandle[handle];
  pigeonholes.push({
    resident: handle,
    lit: isLit(rec ? rec.lastDate : null),
    letters_sent: rec ? rec.count : 0,
    last_sent: rec ? rec.lastDate : null,
    founder_pending: founderPending(handle),
  });
}

homes.sort((a, b) => a.resident.localeCompare(b.resident));
arrivals.sort((a, b) => a.resident.localeCompare(b.resident));
pigeonholes.sort((a, b) => a.resident.localeCompare(b.resident));

// --- 6. join region facts with disk -------------------------------------

const regions = [];
for (const fact of regionFacts) {
  const handle = fact.holder;
  const rd = residentData[handle];
  if (!rd || !rd.region) {
    // Same provisional carve-out as the home path (#631): the-headland is
    // drawn-not-founded by design, and its record says so.
    if (fact.status === 'provisional') {
      flag('placement-provisional', `${fact.id}: drawn, not founded — awaiting WHITE_PAGES/${handle}/HOME/REGION.md (record declares status: provisional)`);
    } else {
      flag('placement-orphaned', `${fact.id}: placements.json has a region record for "${handle}" but no WHITE_PAGES/${handle}/HOME/REGION.md`);
    }
    continue;
  }
  const fm = rd.region.fm;
  const home_ids = homeFacts.filter((h) => h.region === fact.id).map((h) => h.id);
  regions.push({
    id: fact.id,
    name: fm.region || fact.id,
    holder: handle,
    bearing: fact.bearing,
    band: fact.band,
    style: fm.style || null,
    assets: parseAssets(fm.assets).map((a) => relPath(join(rd.region.dir, a))),
    status: fact.status,
    body: rd.region.body,
    home_ids,
  });
}
// residents with a REGION.md but no placements.json record founding it.
for (const handle of residents) {
  const rd = residentData[handle];
  if (!rd.region) continue;
  if (regionFacts.some((f) => f.holder === handle)) continue;
  flag('unplaced-region', `WHITE_PAGES/${handle}/HOME/REGION.md exists but has no placements.json region record`);
}

// --- 6.5. illumination queue ---------------------------------------------
// Homes and regions described in words but not yet pictured: a real body
// (content beyond the frontmatter, > ~80 chars trimmed) and no assets on
// record. Scanned straight off residentData — independent of placements.json,
// so a home/region nobody has placed yet still shows up here if it qualifies.
// (The post office is exempt: Ferry has no HOME/HOME.md to illuminate.)

const isNonTrivial = (body) => !!body && body.trim().length > 80;

const illumination_queue = [];
for (const handle of residents) {
  const rd = residentData[handle];
  if (rd.home && isNonTrivial(rd.home.body) && parseAssets(rd.home.fm.assets).length === 0) {
    const title = rd.home.fm.title || handle;
    illumination_queue.push({
      kind: 'home',
      id: slugify(title),
      holder: handle,
      title,
      source: relPath(join(rd.home.dir, 'HOME.md')),
    });
  }
  if (rd.region && isNonTrivial(rd.region.body) && parseAssets(rd.region.fm.assets).length === 0) {
    const title = rd.region.fm.region || handle;
    illumination_queue.push({
      kind: 'region',
      id: slugify(title),
      holder: handle,
      title,
      source: relPath(join(rd.region.dir, 'REGION.md')),
    });
  }
}
illumination_queue.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

// --- 7. assemble town.json -----------------------------------------------

const open_ground = geoFacts.filter((f) => f.status === 'open');

// The Centre's own words travel into town.json like every home's do, so a
// renderer can show them in-panel rather than pointing away. Read at assembly
// time from the founding description (read-only, like everything else).
const centreSourceRel = 'PROJECTS/build-the-town/the-town-centre.md';
const centreSourcePath = join(ROOT, ...centreSourceRel.split('/'));
const centreBody = existsSync(centreSourcePath)
  ? readFileSync(centreSourcePath, 'utf8').replace(/\r\n/g, '\n').trim()
  : null;

const town = {
  schema_version: 1,
  town: {
    name: 'Postmark',
    centre: {
      id: 'town-centre',
      title: 'The Town Centre',
      image: 'PROJECTS/build-the-town/the-town-centre.png',
      description_source: centreSourceRel,
      body: centreBody,
    },
  },
  geography: geoFacts,
  regions,
  homes,
  arrivals,
  pigeonholes,
  open_ground,
  illumination_queue,
  flags,
};

// --- 8. THE-ATLAS.md ------------------------------------------------------

function bandRank(band) {
  const i = bandVocabulary.indexOf(band);
  return i === -1 ? bandVocabulary.length : i;
}

// "N of the Centre, high-slope" — or, for the thing that IS the Centre
// (bearing "-" / absent), "at the Centre, quayside".
function placePhrase(fact) {
  const atCentre = !fact.bearing || fact.bearing === '-';
  return atCentre
    ? `at the Centre, ${fact.band}`
    : `${fact.bearing} of the Centre, ${fact.band}`;
}

function factDescription(fact) {
  if (fact.kind === 'geography') return fact.statement;
  if (fact.kind === 'region') {
    const name = regions.find((r) => r.id === fact.id)?.name || fact.id;
    return `${name}, founded by ${fact.holder} — ${placePhrase(fact)}.`;
  }
  if (fact.kind === 'home') {
    const title = homes.find((h) => h.id === fact.id)?.title
      || arrivals.find((h) => h.id === fact.id)?.title
      || fact.id;
    const inRegion = fact.region ? ` in ${fact.region}` : '';
    return `${title}, home of ${fact.resident}${inRegion} — ${placePhrase(fact)}.`;
  }
  return fact.id;
}

function generateAtlasMarkdown() {
  const lines = [];
  const push = (...ls) => lines.push(...ls);

  push('# THE-ATLAS.md');
  push('');
  push(
    '*Generated by `town-atlas.mjs` from `placements.json` and each resident’s own `HOME/`. ' +
      'Do not edit this file by hand — to change a placement, edit `placements.json`; to change your home, edit your own `HOME/`.*'
  );
  push('');

  // --- 1. The map in words ---
  push('## 1. The map in words');
  push('');
  const water = geoFacts.find((f) => f.id === 'the-water');
  const hill = geoFacts.find((f) => f.id === 'the-hill-is-north');
  push(
    'Postmark sits along one waterway and one hill, with Ferry’s lamplit crossing-place at the Centre where the two meet the mail.'
  );
  push('');
  if (water) push(water.statement, '');
  if (hill) push(hill.statement, '');
  push('Walking out from the Centre, region by region:');
  push('');
  const orderedRegions = [...regions].sort((a, b) => bandRank(a.band) - bandRank(b.band));
  for (const r of orderedRegions) {
    const style = r.style ? r.style : 'character not yet described';
    push(`- **${r.name}** (${r.bearing} of the Centre, ${r.band}), held by ${r.holder} — ${style}.`);
  }
  push('');

  // --- 2. Settled & derived facts ---
  push('## 2. Settled & derived facts');
  push('');
  push(
    'Every geography and placement fact the atlas renders, in the order the ledger placed them. ' +
      'This is the section to diff a new spatial claim against before a PR opens.'
  );
  push('');
  const placedFacts = facts.filter((f) => f.status !== 'open');
  for (const fact of placedFacts) {
    push(`### ${fact.id} — ${fact.status}`);
    push('');
    push(factDescription(fact));
    if (fact.evidence && fact.evidence.length) {
      push('');
      push('Evidence:');
      for (const ev of fact.evidence) push(`- "${ev.quote}" — \`${ev.source}\``);
    }
    if (fact.notes) {
      push('');
      push(`*${fact.notes}*`);
    }
    push('');
  }

  // --- 3. Open ground ---
  push('## 3. Open ground');
  push('');
  if (open_ground.length) {
    for (const fact of open_ground) {
      push(fact.statement);
      push('');
    }
  } else {
    push('Nothing currently marked open — check back after the next placements.json update.');
    push('');
  }
  push('This is an invitation, not a gap: the town would rather you claim it in your own words than have the atlas guess.');
  push('');

  // --- Described, not yet pictured ---
  push('## Described, not yet pictured');
  push('');
  push(
    'These places have words but no image yet. The town’s Illuminator office offers residents three generated ' +
      'candidates drawn from their own words — accepting one is optional, and declining is always fine.'
  );
  push('');
  if (illumination_queue.length) {
    for (const q of illumination_queue) {
      const possessive = q.kind === 'home' ? `${q.holder}’s home` : `${q.holder}’s region`;
      push(`- **${q.title}**, ${possessive} — \`${q.source}\``);
    }
  } else {
    push('Every described place currently carries its own image.');
  }
  push('');

  // --- 4. Residents awaiting homes ---
  push('## 4. Residents awaiting homes');
  push('');
  if (pigeonholes.length) {
    push(`${pigeonholes.length} resident(s) are reachable at the post office — no \`HOME/\` yet, and that is an honest, ordinary state:`);
    push('');
    for (const p of pigeonholes) push(`- ${p.resident}${p.founder_pending ? ' — **founder**; their household\'s region not yet drawn (the-regions.md invitation stands)' : ''}`);
  } else {
    push('Every resident currently has a home. (This will not stay true — new residents arrive without one, and that is fine.)');
  }
  push('');
  push('Want a place on the map? See [`TOWN_BULLETIN/build-your-home.md`](../../../TOWN_BULLETIN/build-your-home.md).');
  push('');

  // --- 5. Provenance ---
  push('## 5. Provenance');
  push('');
  push(
    'This file and `town.json` are generated wholly by `town-atlas.mjs` from `placements.json` and resident `HOME/` files — never hand-edited. ' +
      'No timestamps or git SHAs are embedded here on purpose: given unchanged inputs, the generator produces byte-identical output, so provenance for *when* something changed lives in git history, not in this file.'
  );
  push('');
  push('To change a placement: edit `placements.json` (with evidence) and regenerate. To change your own home or region: edit your `HOME/` and regenerate.');
  push('');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// --- 8.5. REGIONS.md — the central region list -----------------------------
// One browsable page per Keemin's direction (2026-07-04): every founded
// region with its image and the founder's own description, so a resident
// picking a region for their new home has one place to read them all.
// Generated like THE-ATLAS.md: a VIEW over the residents' living REGION.md
// files, never hand-edited — the source files stay authoritative.

function generateRegionsMarkdown() {
  const lines = [];
  const push = (...ls) => lines.push(...ls);

  push('# REGIONS.md — the regions of Postmark, in their founders’ own words');
  push('');
  push(
    '*Generated by `town-atlas.mjs` from each founder’s own `HOME/REGION.md`. Do not edit this file by hand — ' +
      'the founder’s file is the living text; this is the reading room.*'
  );
  push('');
  push('**Describing a home?** Pick the region it belongs to from this list and name it in your `HOME.md` frontmatter (`region: <name>`) — read a few below and choose where your house honestly belongs; each region says what kind of homes belong there. If your home truly stands on unclaimed ground instead, write `region: open-ground` and expect the atlas-keeper to ask about it (open ground per `THE-ATLAS.md § 3` is real, but rarer now the map has bones).');
  push('');
  push('**Founding a region?** That’s the founder households’ thank-you — see [`the-regions.md`](../the-regions.md) for the roster and the how.');
  push('');
  const orderedRegions = [...regions].sort((a, b) => bandRank(a.band) - bandRank(b.band));
  for (const r of orderedRegions) {
    push('---');
    push('');
    push(`## ${r.name}`);
    push('');
    push(`*founded by **${r.holder}** — ${r.bearing} of the Centre, ${r.band}${r.style ? ` — ${r.style}` : ''}. Use \`region: ${r.id}\` in your HOME.md.*`);
    push('');
    const img = (r.assets || []).find((a) => existsSync(join(ROOT, ...a.split('/'))));
    if (img) {
      push(`![${r.name}](../../../${img})`);
      push('');
    }
    // drop the body's own leading H1 — this page already carries the heading
    push(r.body.replace(/^#\s+[^\n]*\n+/, ''));
    push('');
    push(`*Living source: \`WHITE_PAGES/${r.holder}/HOME/REGION.md\` — homes here so far: ${r.home_ids.length ? r.home_ids.join(', ') : 'none yet'}.*`);
    push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const atlasMarkdown = generateAtlasMarkdown();
const regionsMarkdown = generateRegionsMarkdown();
const townJsonText = JSON.stringify(town, null, 2) + '\n';

// --- 9. write or dry-run ---------------------------------------------------

if (args.dryRun) {
  console.log(`--- DRY RUN: would write ${relPath(TOWN_JSON_PATH)} (${townJsonText.length} bytes) ---`);
  console.log(`--- DRY RUN: would write ${relPath(ATLAS_MD_PATH)} (${atlasMarkdown.length} bytes) ---`);
  console.log(`--- DRY RUN: would write ${relPath(REGIONS_MD_PATH)} (${regionsMarkdown.length} bytes) ---`);
} else {
  writeFileSync(TOWN_JSON_PATH, townJsonText);
  writeFileSync(ATLAS_MD_PATH, atlasMarkdown);
  writeFileSync(REGIONS_MD_PATH, regionsMarkdown);
}

// --- 10. run summary --------------------------------------------------------

console.log(`Postmark atlas — ${residents.length} residents scanned.`);
console.log(`  placed homes: ${homes.length}`);
console.log(`  arrivals:     ${arrivals.length}`);
console.log(`  pigeonholes:  ${pigeonholes.length}`);
console.log(`  regions:      ${regions.length}`);
const litCount = [...homes, ...arrivals].filter((h) => h.lit).length + pigeonholes.filter((p) => p.lit).length;
console.log(`  lit (sent within 14 days): ${litCount}`);
console.log('');
// Note-kinds are known, self-declared waiting states — printed beneath the
// FLAG lane so the flags that demand a look stay few enough to get one (#631).
const NOTE_KINDS = new Set(['placement-provisional']);
const hardFlags = flags.filter((f) => !NOTE_KINDS.has(f.kind));
const noteFlags = flags.filter((f) => NOTE_KINDS.has(f.kind));
if (hardFlags.length) {
  for (const f of hardFlags) console.log(`FLAG: [${f.kind}] ${f.detail}`);
} else {
  console.log('No flags.');
}
for (const f of noteFlags) console.log(`note: [${f.kind}] ${f.detail}`);

process.exit(0);
