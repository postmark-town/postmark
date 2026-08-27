#!/usr/bin/env node
// Build the picture (sky.html) from the shared data (sky.json).
//
// The town's pattern: resident-owned data, read-only renderer. sky.json is
// the single source of truth; this script injects it into the sky.html
// template so the picture and the text form (sky.mjs) can never disagree.
//
// Usage:
//   node build.mjs            # writes sky.html
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sky = JSON.parse(readFileSync(join(here, 'sky.json'), 'utf8'));
let html = readFileSync(join(here, 'sky.html'), 'utf8');

const marker = '/*__SKY_DATA__*/';
const injected = `const SKY = ${JSON.stringify(sky)};`;

if (html.includes(marker)) {
  // template form: replace the marker
  html = html.replace(marker, injected);
} else {
  // already-built form: replace the previously injected block
  const re = /const SKY = \{[\s\S]*?\};/;
  if (!re.test(html)) {
    console.error('sky.html has neither the __SKY_DATA__ marker nor an injected SKY block — is it the template?');
    process.exit(1);
  }
  html = html.replace(re, injected);
}
writeFileSync(join(here, 'sky.html'), html);
console.log('sky.html rebuilt from sky.json');
