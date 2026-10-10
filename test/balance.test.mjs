/**
 * Unit tests for `src/balance.js`: the wallet-amount formatter and the
 * observable store behind the panel's balance block.
 *
 * The formatting expectations mirror DeepSeek Platform's web client, so the
 * cases include the decimal strings Platform actually emits (`0E-16`,
 * `5.0000000000000000`) and the truncate/round/sub-cent boundaries.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createBalanceStore, currencySymbol, formatBalance, isPositiveDecimal } from '../src/balance.js';

test('currency symbols follow the wallet code', () => {
  assert.equal(currencySymbol('CNY'), '¥');
  assert.equal(currencySymbol('USD'), '$');
  assert.equal(currencySymbol('EUR'), '');
});

test('positive balances truncate to cents and group digits', () => {
  assert.equal(formatBalance('0'), '¥0.00');
  assert.equal(formatBalance('0E-16'), '¥0.00');
  assert.equal(formatBalance('5.0000000000000000'), '¥5.00');
  assert.equal(formatBalance('110.00'), '¥110.00');
  assert.equal(formatBalance('10.'), '¥10.00');
  assert.equal(formatBalance('.5'), '¥0.50');
  assert.equal(formatBalance('1e3'), '¥1,000.00');
  assert.equal(formatBalance('1234567.8'), '¥1,234,567.80');
  // Platform rounds a positive balance down, never up.
  assert.equal(formatBalance('1234.567'), '¥1,234.56');
  assert.equal(formatBalance('0.019'), '¥0.01');
});

test('positive sub-cent balances read as <0.01', () => {
  assert.equal(formatBalance('0.005'), '<¥0.01');
  assert.equal(formatBalance('0.0000001'), '<¥0.01');
});

test('negative balances round half-up with a 0.01 floor', () => {
  assert.equal(formatBalance('-0.004'), '-¥0.01');
  assert.equal(formatBalance('-0.005'), '-¥0.01');
  assert.equal(formatBalance('-0.015'), '-¥0.02');
  assert.equal(formatBalance('-1234.567'), '-¥1,234.57');
  assert.equal(formatBalance('-0.999'), '-¥1.00');
  assert.equal(formatBalance('-9.999'), '-¥10.00');
});

test('malformed amounts render as an em dash', () => {
  for (const value of [undefined, null, 0, '', 'abc', '1,000', '+5', '1.2.3']) {
    assert.equal(formatBalance(value), '—', `${String(value)} should not format`);
  }
});

test('the currency symbol is a parameter', () => {
  assert.equal(formatBalance('110', '$'), '$110.00');
  assert.equal(formatBalance('-110.5', '$'), '-$110.50');
});

test('positive-decimal detection only accepts non-zero positives', () => {
  assert.equal(isPositiveDecimal('0.01'), true);
  assert.equal(isPositiveDecimal('1e3'), true);
  assert.equal(isPositiveDecimal('0'), false);
  assert.equal(isPositiveDecimal('0E-16'), false);
  assert.equal(isPositiveDecimal('0.000'), false);
  assert.equal(isPositiveDecimal('-1'), false);
  assert.equal(isPositiveDecimal('abc'), false);
  assert.equal(isPositiveDecimal(undefined), false);
});

test('the store stays unavailable until the account service arrives', async () => {
  const store = createBalanceStore();
  assert.equal(store.getSnapshot().phase, 'unavailable');
  await store.refresh();
  assert.equal(store.getSnapshot().phase, 'unavailable', 'no reader means no read');
  assert.equal(store.getSnapshot().busy, false);
});

test('attach moves the store to idle without reading', async () => {
  let calls = 0;
  const store = createBalanceStore();
  store.attach(async () => { calls += 1; return { phase: 'ready', wallets: [], bonusWallets: [] }; });
  assert.equal(store.getSnapshot().phase, 'idle');
  assert.equal(calls, 0, 'attaching must not read');
  await store.refreshIfLoaded();
  assert.equal(calls, 0, 'an unopened store does not refresh on a credential change');
});

test('refresh publishes loading, then a ready snapshot with wallets', async () => {
  const listeners = [];
  const store = createBalanceStore();
  store.subscribe(() => listeners.push(store.getSnapshot().phase));
  store.attach(async () => ({
    phase: 'ready',
    wallets: [{ currency: 'CNY', balance: '110.00' }],
    bonusWallets: [{ currency: 'CNY', balance: '10.00' }],
    links: { topUpUrl: 'https://platform.deepseek.com/top_up' },
  }));
  await store.refresh();
  const ready = store.getSnapshot();
  assert.deepEqual(listeners, ['idle', 'loading', 'ready']);
  assert.equal(ready.phase, 'ready');
  assert.equal(ready.busy, false);
  assert.equal(ready.stale, false);
  assert.equal(typeof ready.fetchedAt, 'number');
  assert.deepEqual(ready.wallets, [{ currency: 'CNY', balance: '110.00' }]);
  assert.deepEqual(ready.bonusWallets, [{ currency: 'CNY', balance: '10.00' }]);
  assert.equal(ready.links.topUpUrl, 'https://platform.deepseek.com/top_up');
});

test('concurrent refreshes share one read', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const store = createBalanceStore();
  store.attach(async () => {
    calls += 1;
    await gate;
    return { phase: 'ready', wallets: [], bonusWallets: [] };
  });
  const first = store.refresh();
  const second = store.refresh();
  assert.equal(first, second, 'the in-flight read is returned as-is');
  assert.equal(store.getSnapshot().busy, true);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().busy, false);
});

test('a failed refresh keeps the last reading and marks it stale', async () => {
  let fail = false;
  const store = createBalanceStore();
  const read = async () => {
    if (fail) throw new Error('offline');
    return { phase: 'ready', wallets: [{ currency: 'CNY', balance: '5' }], bonusWallets: [] };
  };
  store.attach(read);
  await store.refresh();
  const first = store.getSnapshot();
  fail = true;
  await store.refresh();
  const stale = store.getSnapshot();
  assert.equal(stale.phase, 'ready');
  assert.equal(stale.stale, true);
  assert.equal(stale.busy, false);
  assert.deepEqual(stale.wallets, first.wallets, 'the last successful reading stays visible');
  assert.equal(stale.fetchedAt, first.fetchedAt, 'the timestamp still names the successful read');
});

test('a first failed read reports a failure without inventing a balance', async () => {
  const store = createBalanceStore();
  store.attach(async () => { throw new Error('offline'); });
  await store.refresh();
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.phase, 'failed');
  assert.deepEqual(snapshot.wallets, []);
  assert.equal(snapshot.fetchedAt, null);
});

test('the store reports a signed-out account and a failed host outcome', async () => {
  const store = createBalanceStore();
  let outcome = { phase: 'signed-out', links: { topUpUrl: 'https://platform.deepseek.com/top_up' } };
  store.attach(async () => outcome);
  await store.refresh();
  assert.equal(store.getSnapshot().phase, 'signed-out');
  assert.equal(store.getSnapshot().links.topUpUrl, 'https://platform.deepseek.com/top_up');

  outcome = { phase: 'failed' };
  await store.refresh();
  assert.equal(store.getSnapshot().phase, 'failed');
});

test('refreshIfLoaded re-reads once the user has opened the panel', async () => {
  let calls = 0;
  const store = createBalanceStore();
  store.attach(async () => {
    calls += 1;
    return { phase: 'ready', wallets: [], bonusWallets: [] };
  });
  await store.refresh();
  assert.equal(calls, 1);
  await store.refreshIfLoaded();
  assert.equal(calls, 2, 'a credential change refreshes a store that has been opened');
});

test('dispose stops notifications and further reads', async () => {
  let calls = 0;
  const store = createBalanceStore();
  let notified = 0;
  store.attach(async () => {
    calls += 1;
    return { phase: 'ready', wallets: [], bonusWallets: [] };
  });
  store.subscribe(() => { notified += 1; });
  await store.refresh();
  const seen = notified;
  assert.ok(seen > 0);
  store.dispose();
  await store.refresh();
  assert.equal(calls, 1, 'a disposed store does not read');
  assert.equal(notified, seen, 'a disposed store does not notify');
});
