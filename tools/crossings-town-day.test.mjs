// crossings-town-day.test.mjs — the contract of townDay(date?) in tools/crossings.mjs.
//   node --test tools/crossings-town-day.test.mjs
// Zero-dep; synthetic instants only.
//
// townDay is the town's one "what day is it": the mint rule's day boundary, not
// the wire's UTC day. Ballot-pass, pin-github-ids, rename-handle, settle, the
// registrar audit and quest-progress all date things through it, so its shape
// is pinned here rather than inferred from any one caller:
//   - the result is YYYY-MM-DD;
//   - TOWN_TZ unset (or never touched) means America/New_York;
//   - TOWN_TZ set means that zone;
//   - TOWN_TZ is read at CALL time, not at import;
//   - TOWN_TZ set to the empty string is NOT "unset": the `??` hands '' to Intl,
//     which throws a RangeError (ferry.mjs's own `||` form falls back instead;
//     townDay deliberately does not). This pins what the code does today.
//   - a passed date is the instant formatted; an absent one is "now".

import test from 'node:test';
import assert from 'node:assert/strict';
import { townDay } from './crossings.mjs';

// 2026-11-02T03:00:00Z: UTC is already Nov 2; New York (EST, DST ended the day
// before) is 22:00 on Nov 1.
const NY_BEHIND_UTC = new Date('2026-11-02T03:00:00Z');
// 2026-11-02T10:00:00Z: three different days at once.
//   America/New_York (EST, 05:00) → 2026-11-02
//   Pacific/Pago_Pago (UTC-11, 23:00 the day before) → 2026-11-01
//   Pacific/Kiritimati (UTC+14, 00:00 the day after) → 2026-11-03
const THREE_DAYS = new Date('2026-11-02T10:00:00Z');

// Save/restore process.env.TOWN_TZ around every case, including "was unset".
function withTownTz(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'TOWN_TZ');
  const before = process.env.TOWN_TZ;
  if (value === undefined) delete process.env.TOWN_TZ;
  else process.env.TOWN_TZ = value;
  try {
    return fn();
  } finally {
    if (had) process.env.TOWN_TZ = before;
    else delete process.env.TOWN_TZ;
  }
}

test('townDay returns a YYYY-MM-DD string', () => {
  withTownTz(undefined, () => {
    assert.match(townDay(NY_BEHIND_UTC), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(townDay(), /^\d{4}-\d{2}-\d{2}$/);
  });
  withTownTz('Pacific/Kiritimati', () => {
    assert.match(townDay(THREE_DAYS), /^\d{4}-\d{2}-\d{2}$/);
  });
});

test('TOWN_TZ unset: America/New_York, not the UTC day', () => {
  withTownTz(undefined, () => {
    assert.equal(townDay(NY_BEHIND_UTC), '2026-11-01');
    assert.equal(townDay(THREE_DAYS), '2026-11-02');
    // The wire's day would be the UTC one; the two must differ for this to mean anything.
    assert.notEqual(townDay(NY_BEHIND_UTC), NY_BEHIND_UTC.toISOString().slice(0, 10));
  });
});

test('TOWN_TZ set: that zone is used instead of America/New_York', () => {
  withTownTz('Pacific/Pago_Pago', () => {
    assert.equal(townDay(THREE_DAYS), '2026-11-01');
  });
  withTownTz('Pacific/Kiritimati', () => {
    assert.equal(townDay(THREE_DAYS), '2026-11-03');
  });
  withTownTz('UTC', () => {
    assert.equal(townDay(NY_BEHIND_UTC), '2026-11-02');
  });
});

test('TOWN_TZ is read at call time: changing it after import changes the next answer', () => {
  // crossings.mjs was imported above; nothing about TOWN_TZ was captured then.
  withTownTz(undefined, () => {
    assert.equal(townDay(THREE_DAYS), '2026-11-02');
    process.env.TOWN_TZ = 'Pacific/Kiritimati';
    assert.equal(townDay(THREE_DAYS), '2026-11-03');
    process.env.TOWN_TZ = 'Pacific/Pago_Pago';
    assert.equal(townDay(THREE_DAYS), '2026-11-01');
    delete process.env.TOWN_TZ;
    assert.equal(townDay(THREE_DAYS), '2026-11-02');
  });
});

test("TOWN_TZ set to '' is not 'unset': `??` passes it to Intl, which throws (pinned as it is today)", () => {
  withTownTz('', () => {
    assert.throws(() => townDay(THREE_DAYS), RangeError);
    assert.throws(() => townDay(), RangeError);
  });
});

test('a passed date is the instant formatted; an absent one is now', () => {
  withTownTz(undefined, () => {
    // A passed date does not depend on the clock.
    assert.equal(townDay(new Date('2001-02-03T12:00:00Z')), '2001-02-03');
    // Absent (and explicit undefined) means now, in the town's zone: bracket it
    // with the same formatter on either side, so a midnight rollover mid-test
    // cannot flake it.
    const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    for (const call of [() => townDay(), () => townDay(undefined)]) {
      const before = fmt(new Date());
      const got = call();
      const after = fmt(new Date());
      assert.ok(got === before || got === after, `${got} is neither ${before} nor ${after}`);
    }
    // And the passed date wins over now: a 2001 instant cannot be today.
    assert.notEqual(townDay(new Date('2001-02-03T12:00:00Z')), townDay());
  });
});
