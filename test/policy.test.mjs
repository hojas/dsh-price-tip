/**
 * Unit tests for the pricing rule in `src/policy.js`.
 *
 * Every instant is built from a Beijing wall clock (UTC+8, no DST), which is how
 * the official rule is written, so the assertions read like the docs.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOLIDAYS_2026,
  POLICY,
  beijingParts,
  compactCountdown,
  durationParts,
  formatPrice,
  isPeak,
  nextSwitchAt,
  periodAt,
  priceAt,
  statusAt,
} from '../src/policy.js';

/** Epoch milliseconds for a Beijing wall-clock time. */
const bj = (year, month, day, hour = 0, minute = 0, second = 0) =>
  Date.UTC(year, month - 1, day, hour - 8, minute, second);

test('peak windows are half-open: [09:00, 12:00) and [14:00, 18:00) on workdays', () => {
  const wednesday = [2026, 10, 14];
  assert.equal(periodAt(bj(...wednesday, 8, 59, 59)), 'off-peak');
  assert.equal(periodAt(bj(...wednesday, 9, 0, 0)), 'peak');
  assert.equal(periodAt(bj(...wednesday, 11, 59, 59)), 'peak');
  assert.equal(periodAt(bj(...wednesday, 12, 0, 0)), 'off-peak');
  assert.equal(periodAt(bj(...wednesday, 13, 59, 59)), 'off-peak');
  assert.equal(periodAt(bj(...wednesday, 14, 0, 0)), 'peak');
  assert.equal(periodAt(bj(...wednesday, 17, 59, 59)), 'peak');
  assert.equal(periodAt(bj(...wednesday, 18, 0, 0)), 'off-peak');
  assert.equal(periodAt(bj(...wednesday, 23, 0, 0)), 'off-peak');
  assert.equal(periodAt(bj(...wednesday, 3, 0, 0)), 'off-peak');
});

test('weekends are off-peak all day', () => {
  assert.equal(periodAt(bj(2026, 10, 10, 10, 0)), 'off-peak'); // Saturday
  assert.equal(periodAt(bj(2026, 10, 11, 15, 0)), 'off-peak'); // Sunday
});

test('a 调休 make-up workday on a weekend still bills off-peak', () => {
  // 2026-10-10 is an official 调休上班日 (Saturday).
  assert.equal(beijingParts(bj(2026, 10, 10, 10, 0)).weekday, 6);
  assert.equal(periodAt(bj(2026, 10, 10, 10, 0)), 'off-peak');
});

test('Chinese public holidays are off-peak during the peak hours', () => {
  const holidays = [
    [2026, 1, 1], // 元旦 Thursday
    [2026, 2, 17], // 春节 Tuesday
    [2026, 4, 6], // 清明节 Monday
    [2026, 5, 1], // 劳动节 Friday
    [2026, 6, 19], // 端午节 Friday
    [2026, 9, 25], // 中秋节 Friday
    [2026, 10, 1], // 国庆节 Thursday
  ];
  for (const [year, month, day] of holidays) {
    const parts = beijingParts(bj(year, month, day, 10, 0));
    assert.ok(parts.weekday >= 1 && parts.weekday <= 5, `${parts.dateKey} should be a weekday`);
    assert.equal(periodAt(bj(year, month, day, 10, 0)), 'off-peak', `${parts.dateKey} 10:00`);
    assert.equal(periodAt(bj(year, month, day, 15, 0)), 'off-peak', `${parts.dateKey} 15:00`);
  }
});

test('the shipped holiday calendar is sorted, unique, and weekday-only', () => {
  assert.equal(HOLIDAYS_2026.length, 19);
  const sorted = [...HOLIDAYS_2026].sort();
  assert.deepEqual(HOLIDAYS_2026, sorted);
  assert.equal(new Set(HOLIDAYS_2026).size, HOLIDAYS_2026.length);
  for (const key of HOLIDAYS_2026) {
    const [year, month, day] = key.split('-').map(Number);
    const { weekday } = beijingParts(bj(year, month, day, 12, 0));
    assert.ok(weekday >= 1 && weekday <= 5, `${key} is a weekend and does not belong in the calendar`);
  }
});

test('the next switch is the next boundary, and it is a real flip', () => {
  const cases = [
    // [now, expected switch]
    [bj(2026, 10, 14, 8, 0), bj(2026, 10, 14, 9, 0)], // pre-peak -> peak start
    [bj(2026, 10, 14, 9, 30), bj(2026, 10, 14, 12, 0)], // peak -> midday break
    [bj(2026, 10, 14, 12, 30), bj(2026, 10, 14, 14, 0)], // break -> peak start
    [bj(2026, 10, 14, 15, 0), bj(2026, 10, 14, 18, 0)], // peak -> evening
    [bj(2026, 10, 14, 18, 30), bj(2026, 10, 15, 9, 0)], // evening -> next workday
    [bj(2026, 10, 9, 19, 0), bj(2026, 10, 12, 9, 0)], // Friday evening -> Monday (weekend skipped)
    [bj(2026, 10, 1, 10, 0), bj(2026, 10, 8, 9, 0)], // 国庆节 -> first workday after the break
    [bj(2026, 9, 25, 10, 0), bj(2026, 9, 28, 9, 0)], // 中秋节 Friday -> Monday
  ];
  for (const [now, expected] of cases) {
    assert.equal(new Date(nextSwitchAt(now)).toISOString(), new Date(expected).toISOString(), `from ${new Date(now).toISOString()}`);
  }
});

test('the period never flips between now and the reported switch', () => {
  const start = bj(2026, 9, 28, 0, 0);
  const step = 7 * 60_000;
  for (let now = start; now < start + 30 * 86_400_000; now += step) {
    const next = nextSwitchAt(now);
    assert.notEqual(next, null, `no switch found from ${new Date(now).toISOString()}`);
    assert.ok(next > now, 'the switch must be in the future');
    assert.notEqual(periodAt(next), periodAt(now), `no flip at ${new Date(next).toISOString()}`);
    assert.equal(periodAt((now + next) / 2), periodAt(now), 'the period must hold until the switch');
    assert.equal(nextSwitchAt((now + next) / 2), next, 'the switch must be stable across the interval');
  }
});

test('statusAt reports the period, the countdown, and calendar coverage', () => {
  const status = statusAt(bj(2026, 10, 14, 8, 0));
  assert.equal(status.period, 'off-peak');
  assert.equal(status.msUntilSwitch, 60 * 60_000);
  assert.equal(status.year, 2026);
  assert.equal(status.calendarCovered, true);
  assert.equal(status.dateKey, '2026-10-14');

  const uncovered = statusAt(bj(2027, 3, 1, 8, 0));
  assert.equal(uncovered.year, 2027);
  assert.equal(uncovered.calendarCovered, false);
});

test('prices halve in the off-peak window', () => {
  const flash = POLICY.models.find((model) => model.id === 'deepseek-flash');
  const pro = POLICY.models.find((model) => model.id === 'deepseek-v4-pro');
  assert.deepEqual(priceAt(flash, 'peak').effective, { cacheHit: 0.04, cacheMiss: 2, output: 8 });
  assert.deepEqual(priceAt(flash, 'off-peak').effective, { cacheHit: 0.02, cacheMiss: 1, output: 4 });
  assert.deepEqual(priceAt(pro, 'peak').effective, { cacheHit: 0.3, cacheMiss: 9, output: 27 });
  assert.deepEqual(priceAt(pro, 'off-peak').effective, { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 });
  assert.equal(priceAt(flash, 'off-peak').discounted, true);
  assert.equal(priceAt(flash, 'peak').discounted, false);
  assert.equal(POLICY.offPeakMultiplier, 0.5);
});

test('duration formatting', () => {
  assert.deepEqual(durationParts(3 * 3_600_000 + 12 * 60_000 + 45_000), { hours: 3, minutes: 12, seconds: 45 });
  assert.deepEqual(durationParts(-5), { hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(durationParts(1), { hours: 0, minutes: 0, seconds: 1 });
  assert.equal(compactCountdown(3 * 3_600_000 + 12 * 60_000), '3:12');
  assert.equal(compactCountdown(12 * 60_000 + 5_000), '12:05');
  assert.equal(compactCountdown(999), '0:01');
  assert.equal(compactCountdown(0), '0:00');
});

test('price formatting drops trailing zeros', () => {
  assert.equal(formatPrice(0), '0');
  assert.equal(formatPrice(0.02), '0.02');
  assert.equal(formatPrice(0.3), '0.3');
  assert.equal(formatPrice(4.5), '4.5');
  assert.equal(formatPrice(13.5), '13.5');
  assert.equal(formatPrice(27), '27');
  assert.equal(formatPrice(Number.NaN), '—');
});

test('isPeak agrees with periodAt', () => {
  const now = bj(2026, 10, 14, 10, 0);
  assert.equal(isPeak(now), true);
  assert.equal(periodAt(now), 'peak');
});
