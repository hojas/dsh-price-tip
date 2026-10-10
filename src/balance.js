/**
 * Account-balance helpers — the pure half of the balance display.
 *
 * Like `src/policy.js`, this file is plain ES module JavaScript with no imports
 * and no browser or Node globals beyond `Date`, so it can be:
 *   1. imported directly by `test/balance.test.mjs`, and
 *   2. inlined verbatim into the browser bundle `client.js` by
 *      `scripts/build-client.mjs` (which strips the `export` keywords).
 *
 * The amount grammar is the one the DeepSeek Platform accepts for wallet
 * balances: an optional sign, digits with an optional fraction, and an optional
 * decimal exponent (`0E-16`, `5.0000000000000000`, `1e+3`). Formatting mirrors
 * the Platform web client — two decimals, digit grouping, positive amounts
 * truncated to cents, positive sub-cent amounts shown as `<0.01`, negative
 * amounts rounded half-up with a minimum displayed magnitude of 0.01 — so a
 * balance reads the same here as in 设置 → 账户. It is implemented on the decimal
 * text rather than `Number`, and without big.js, because this plugin stays
 * dependency-free and must not silently lose precision.
 */

/** Decimal grammar accepted for a wallet amount. */
const DECIMAL_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Code point of the ASCII digit `5`, the half-up rounding threshold. */
const DIGIT_FIVE = 53;

/** Currency symbol for a wallet currency code. */
export function currencySymbol(currency) {
  if (currency === 'CNY') return '¥';
  if (currency === 'USD') return '$';
  return '';
}

/**
 * Normalize a decimal string into digits plus a decimal-point position.
 * @param text - amount matching `DECIMAL_PATTERN`.
 * @returns the sign, the significant digit run, and where its point sits.
 */
function decompose(text) {
  let body = text.trim();
  const negative = body.startsWith('-');
  if (negative || body.startsWith('+')) body = body.slice(1);
  const [mantissa, exponentText] = body.toLowerCase().split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const point = mantissa.indexOf('.');
  const integerPart = point === -1 ? mantissa : mantissa.slice(0, point);
  const fractionPart = point === -1 ? '' : mantissa.slice(point + 1);
  return {
    negative,
    digits: `${integerPart}${fractionPart}`,
    pointIndex: integerPart.length + exponent,
  };
}

/**
 * Split decomposed digits into integer and fraction text.
 * @param parsed - result of `decompose`.
 * @returns integer digits (never empty) and fraction digits (possibly empty).
 */
function splitAtPoint(parsed) {
  if (parsed.pointIndex <= 0) {
    return { integer: '0', fraction: `${'0'.repeat(-parsed.pointIndex)}${parsed.digits}` };
  }
  if (parsed.pointIndex >= parsed.digits.length) {
    return { integer: `${parsed.digits}${'0'.repeat(parsed.pointIndex - parsed.digits.length)}`, fraction: '' };
  }
  return {
    integer: parsed.digits.slice(0, parsed.pointIndex),
    fraction: parsed.digits.slice(parsed.pointIndex),
  };
}

/** Whether a digit run contributes nothing to the value. */
function isZeroRun(text) {
  return /^0*$/.test(text);
}

/** Group an integer digit run with thousands separators. */
function groupDigits(integer) {
  return integer.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Increment a non-negative integer digit run by one. */
function incrementDigits(integer) {
  const digits = integer.replace(/^0+(?=\d)/, '');
  const out = [];
  let carry = 1;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const value = digits.charCodeAt(index) - 48 + carry;
    out.unshift(String(value % 10));
    carry = value > 9 ? 1 : 0;
  }
  if (carry === 1) out.unshift('1');
  return out.join('');
}

/**
 * Round a two-digit cent text half-up using the first dropped fraction digit.
 * @param cents - the two kept fraction digits.
 * @param rest - every dropped fraction digit.
 * @returns the rounded cent text and whether it carried into the integer.
 */
function roundCents(cents, rest) {
  if (rest === '' || rest.charCodeAt(0) < DIGIT_FIVE) return { cents, carry: false };
  const value = Number(cents) + 1;
  if (value <= 99) return { cents: `${value}`.padStart(2, '0'), carry: false };
  return { cents: '00', carry: true };
}

/**
 * Format a wallet amount the way the Platform web client does.
 * @param amount - validated decimal balance string.
 * @param symbol - currency symbol, e.g. `¥`.
 * @returns the signed currency text, or an em dash for a malformed amount.
 */
export function formatBalance(amount, symbol = '¥') {
  if (typeof amount !== 'string' || !DECIMAL_PATTERN.test(amount.trim())) return '—';
  const parsed = decompose(amount);
  const { integer, fraction } = splitAtPoint(parsed);
  const cents = `${fraction}00`.slice(0, 2);
  if (!parsed.negative) {
    // Platform truncates a positive balance to cents, never rounding it up.
    if (isZeroRun(integer) && isZeroRun(fraction)) return `${symbol}0.00`;
    if (isZeroRun(integer) && isZeroRun(cents)) return `<${symbol}0.01`;
    return `${symbol}${groupDigits(integer)}.${cents}`;
  }
  // Platform rounds a negative balance half-up and never displays below 0.01.
  const rounded = roundCents(cents, fraction.slice(2));
  const integerText = rounded.carry ? incrementDigits(integer) : integer;
  if (isZeroRun(integerText) && isZeroRun(rounded.cents)) return `-${symbol}0.01`;
  return `-${symbol}${groupDigits(integerText)}.${rounded.cents}`;
}

/**
 * Whether a wallet amount is a valid, strictly positive decimal.
 * @param amount - candidate balance string.
 * @returns true when the text parses and is greater than zero.
 */
export function isPositiveDecimal(amount) {
  if (typeof amount !== 'string' || !DECIMAL_PATTERN.test(amount.trim())) return false;
  const parsed = decompose(amount);
  if (parsed.negative) return false;
  const { integer, fraction } = splitAtPoint(parsed);
  return !(isZeroRun(integer) && isZeroRun(fraction));
}

/**
 * The snapshot a store reports before it can read anything at all: no account
 * service is mounted, so the panel hides the block instead of showing an error.
 */
const EMPTY_BALANCE = Object.freeze({
  phase: 'unavailable',
  wallets: [],
  bonusWallets: [],
  links: null,
  fetchedAt: null,
  busy: false,
  stale: false,
});

/**
 * Create the observable balance store behind the panel's `useBalance` hook.
 *
 * The store is created before the optional `remote.account` service is known:
 * `attach` hands it the reader once that service appears, and the panel's first
 * mount calls `refresh`. No polling happens on its own — a credential change
 * refreshes only a store the user has already opened.
 * @returns the store: snapshot source, `attach`, `refresh`, and disposal.
 */
export function createBalanceStore() {
  let loader = null;
  let snapshot = EMPTY_BALANCE;
  let inFlight = null;
  let disposed = false;
  const listeners = new Set();

  const publish = (next) => {
    if (disposed) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  /** Failure that keeps the last successful reading visible and marks it stale. */
  const failure = (previous) => (previous.fetchedAt === null
    ? { ...EMPTY_BALANCE, phase: 'failed', links: previous.links }
    : { ...previous, busy: false, stale: true });

  /** Map one reader outcome onto the next snapshot. */
  const settle = (next, previous) => {
    if (next.phase === 'ready') {
      return {
        phase: 'ready',
        wallets: next.wallets ?? [],
        bonusWallets: next.bonusWallets ?? [],
        links: next.links ?? previous.links,
        fetchedAt: Date.now(),
        busy: false,
        stale: false,
      };
    }
    if (next.phase === 'signed-out') {
      return { ...EMPTY_BALANCE, phase: 'signed-out', links: next.links ?? previous.links };
    }
    return failure(previous);
  };

  const refresh = () => {
    if (disposed || loader === null) return Promise.resolve(snapshot);
    if (inFlight !== null) return inFlight;
    const previous = snapshot;
    publish({
      ...previous,
      phase: previous.fetchedAt === null ? 'loading' : 'ready',
      busy: true,
      stale: false,
    });
    inFlight = Promise.resolve().then(loader).then(
      (next) => {
        inFlight = null;
        publish(settle(next, previous));
      },
      () => {
        inFlight = null;
        publish(failure(previous));
      },
    );
    return inFlight;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Wire the reader in once the optional account service is available. */
    attach(load) {
      loader = load;
      publish({ ...EMPTY_BALANCE, phase: 'idle' });
    },
    refresh,
    /** Refresh after a credential change, but never read before a first open. */
    refreshIfLoaded() {
      if (snapshot.phase === 'idle' || snapshot.phase === 'unavailable') return Promise.resolve(snapshot);
      return refresh();
    },
    dispose() {
      disposed = true;
      inFlight = null;
      listeners.clear();
    },
  };
}
