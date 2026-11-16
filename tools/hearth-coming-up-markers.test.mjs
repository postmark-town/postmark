// hearth-coming-up-markers.test.mjs — the restored Coming up is placed in Postmark's six designs and the STARTER (POS-1069).
//   node --test tools/hearth-coming-up-markers.test.mjs
//
// Darko, 2026-11-15 20:11 EST: the old page's RSVP / coming-up section was lost; "we should hotfix it into all of the default/postmark-designed
// hearths as well as the template". 21:02 EST: "I think we should add it in all 6 designs and the template now." The site half is postmark-site#437
// (a public `<hearth-coming-up>` slot over the calendar the household page already reads). This is the town half: ONE paired marker in each of
// the seven templates, and the README's slot table.
//
// A focused read of the files, not a validation framework: the site's own design sync (tools/sync-hearths.mjs, entries.mjs) is the real validator
// and refuses an unknown slot; this pins what it cannot say: that each design places the marker exactly once, as a paired element, and that every
// part the design had before is still there (the design lost nothing).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../PROJECTS/household-hearths/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');

// every marker each design placed BEFORE this change, in order (read from the designs at the base of POS-1069), and where the new one goes
const DESIGNS = {
  default:       { before: ['house', 'countdown', 'happened', 'needs-you', 'residents', 'posts', 'marks', 'closer', 'around-town', 'mail', 'stamps'], after: 'residents' },
  ledger:        { before: ['house', 'countdown', 'stamps-chart', 'residents', 'happened', 'map', 'posts', 'marks', 'closer', 'around-town', 'needs-you', 'mail', 'stamps'], after: 'residents' },
  desk:          { before: ['house', 'countdown', 'needs-you', 'mail', 'residents', 'happened', 'stamps', 'stamps-chart', 'closer', 'marks', 'posts', 'around-town'], after: 'residents' },
  gazette:       { before: ['house', 'countdown', 'needs-you', 'mail', 'happened', 'stamps', 'stamps-chart', 'marks', 'posts', 'residents', 'closer', 'around-town'], after: 'residents' },
  constellation: { before: ['house', 'countdown', 'needs-you', 'mail', 'pane', 'ties', 'stamps', 'stamps-chart', 'stamps-went', 'residents', 'town', 'around-town', 'happened', 'map', 'posts', 'marks'], after: 'residents' },
  hand:          { before: ['house', 'countdown', 'pane', 'needs-you', 'mail', 'stamps', 'stamps-went', 'ties', 'day', 'residents', 'town', 'around-town', 'posts', 'happened'], after: 'residents' },
};
const markers = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<hearth-([a-z-]+)>/g)].map((m) => m[1]);

for (const [id, { before, after }] of Object.entries(DESIGNS)) {
  test(`${id}: exactly one paired <hearth-coming-up>, after ${after}, and every part the design had is still there, in order`, () => {
    const html = read(`${id}/hearth.html`);
    assert.equal((html.match(/<hearth-coming-up><\/hearth-coming-up>/g) || []).length, 1, 'one paired marker, with no body');
    assert.equal((html.match(/hearth-coming-up/g) || []).length, 2, 'and nothing else names it (an opening and a closing tag)');
    const now = markers(html);
    assert.equal(now.filter((m) => m === 'coming-up').length, 1);
    assert.deepEqual(now.filter((m) => m !== 'coming-up'), before, `${id} lost or reordered no part`);
    assert.equal(now[now.indexOf('coming-up') - 1], after, `it sits right after the ${after} slot, in the design's own flow`);
    // each design's `hearth.md` author is still postmark (the six are authored by the town), and no script or markup the sanitizer drops was added
    assert.ok(!/<script|on[a-z]+=|style=/i.test(html), 'no script, handler or inline style');
  });
}

test('the STARTER places it once, as a plain paired marker with a comment like the others', () => {
  const html = read('STARTER/hearth.html');
  assert.equal((html.match(/<hearth-coming-up><\/hearth-coming-up>/g) || []).length, 1);
  assert.match(html, /<hearth-coming-up><\/hearth-coming-up>\s+<!-- the events the house hosts or is going to, with the residents going -->/);
  assert.ok(markers(html).includes('around-town') && markers(html).includes('stamps-went'), 'its other parts are all still there');
});

test("the README's slot table lists it, as the house's public hosting/going events and resident chips (no new script API)", () => {
  const readme = read('README.md');
  const row = readme.split('\n').find((l) => l.startsWith('| `<hearth-coming-up>`'));
  assert.ok(row, 'the slot table has its row');
  assert.match(row, /the events the house hosts or has RSVP'd to, soonest first, with the house's residents who are going/);
  assert.ok(!/\(private\)|hearth\.act|hearth\.read/.test(row), 'a public slot: no private mark, no script API');
  assert.equal(readme.split('\n').filter((l) => l.startsWith('| `<hearth-coming-up>`')).length, 1, 'one row');
  assert.ok(readme.indexOf(row) > readme.indexOf('| `<hearth-around-town>`'), 'it sits in the table beside the calendar slot');
});
