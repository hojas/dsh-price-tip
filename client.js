// GENERATED FILE — do not edit.
// Sources: src/client.js (template) + src/policy.js (pricing rule) + src/balance.js (account balance).
// Rebuild with: node scripts/build-client.mjs
/**
 * Browser half of the price-tip bundle.
 *
 * This is the file the Host serves as `client.js`; `scripts/build-client.mjs`
 * substitutes the package name and inlines `src/policy.js` at the marker below,
 * so this file must stay a single self-contained script. It uses only `react`
 * from the platform module table and the Host's `--dsw-alias-*` theme tokens.
 */
window.__ModuleLoader__.load({
  id: 'dsh-price-tip',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /**
 * DeepSeek API peak / off-peak pricing rule — the single source of truth for
 * this plugin.
 *
 * This file is plain ES module JavaScript with no imports and no browser or
 * Node globals beyond `Date`, so it can be:
 *   1. imported directly by `test/policy.test.mjs`, and
 *   2. inlined verbatim into the browser bundle `client.js` by
 *      `scripts/build-client.mjs` (which strips the `export` keywords).
 * `test/bundle.test.mjs` fails if the committed `client.js` drifts from it.
 *
 * Rule in force (checked 2026-10-10 against the official pricing page):
 *   - 高峰时段（peak）: 北京时间 周一至周五，09:00–12:00 与 14:00–18:00，
 *     不含中国法定节假日。
 *   - 其余时间（含周末与法定节假日全天）为空闲时段（off-peak）。
 *   - 空闲时段价格为高峰时段价格的 50%。
 *
 * Sources:
 *   - 价格页（中文）: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *   - 价格页（英文）: https://api-docs.deepseek.com/quick_start/pricing
 *
 * Documented assumptions (see README.md for the reasoning):
 *   - Every peak window is half-open: `[09:00, 12:00)`. The official page writes
 *     only "9:00 - 12:00", so the exact second the tier flips is unspecified.
 *   - A request is billed by the tier of its completion moment (the convention
 *     the official docs stated while the earlier discount scheme was live), so
 *     the badge describes "now", not "when you started".
 */

/** Milliseconds in one minute. */
const MINUTE_MS = 60_000;
/** Milliseconds in one day. */
const DAY_MS = 86_400_000;

/**
 * 2026 年中国大陆法定节假日中落在周一至周五的日期。
 * 周末本身全天计为空闲时段，因此周末日期（以及调休上班的周末）无需列出。
 */
const HOLIDAYS_2026 = [
  '2026-01-01', // 元旦
  '2026-01-02', // 元旦
  '2026-02-16', // 春节
  '2026-02-17', // 春节
  '2026-02-18', // 春节
  '2026-02-19', // 春节
  '2026-02-20', // 春节
  '2026-02-23', // 春节
  '2026-04-06', // 清明节
  '2026-05-01', // 劳动节
  '2026-05-04', // 劳动节
  '2026-05-05', // 劳动节
  '2026-06-19', // 端午节
  '2026-09-25', // 中秋节
  '2026-10-01', // 国庆节
  '2026-10-02', // 国庆节
  '2026-10-05', // 国庆节
  '2026-10-06', // 国庆节
  '2026-10-07', // 国庆节
];

/**
 * The pricing policy. Pure data: safe to serialize, diff, and assert on.
 */
const POLICY = {
  /** Identifies this revision of the rule; shown in the panel footer. */
  id: 'deepseek-peak-offpeak-2026-09-10',
  /** Human-readable revision dates. */
  verifiedAt: '2026-10-10',
  effectiveFrom: '2026-09-10T04:00:00Z', // 北京时间 2026-09-10 12:00
  /** Where the rule and the price table come from. */
  source: {
    label: 'DeepSeek 官方价格页',
    url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  },
  schedule: {
    /** 北京时间固定 UTC+8，无夏令时。 */
    utcOffsetMinutes: 480,
    /** 高峰时段，[起, 止) 分钟数，按北京时间当日 0 点起算。 */
    peakWindows: [
      [9 * 60, 12 * 60], // 09:00–12:00
      [14 * 60, 18 * 60], // 14:00–18:00
    ],
    /** 周末全天为空闲时段。 */
    weekendOffPeak: true,
    /** 落在工作日的法定节假日，全天为空闲时段。 */
    holidays: HOLIDAYS_2026,
    /** 节假日日历覆盖的年份；年份未覆盖时界面标注为估算。 */
    calendarYears: [2026],
  },
  /** 空闲时段 = 高峰价格 × 该系数。 */
  offPeakMultiplier: 0.5,
  currency: 'CNY',
  /** 价格单位：元 / 百万 tokens。 */
  priceUnit: 'perMillionTokens',
  /**
   * 价目表（高峰价，单位：元 / 百万 tokens）。
   * 空闲价由 `offPeakMultiplier` 推导，避免同一数字写两遍而产生漂移。
   */
  models: [
    {
      id: 'deepseek-flash',
      label: 'DeepSeek-V4.1-Flash',
      peakPrice: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    },
    {
      id: 'deepseek-v4-pro',
      label: 'DeepSeek-V4-Pro',
      peakPrice: { cacheHit: 0.3, cacheMiss: 9, output: 27 },
      /** 官方价格页与发布说明对该模型的计价描述不一致，面板中额外标注。 */
      pricingUncertain: true,
    },
  ],
};

/** Zero-pad a number to two digits. @param value - number to pad. @returns the padded text. */
function pad2(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

/**
 * Break an instant into Beijing wall-clock parts.
 * @param instantMs - epoch milliseconds.
 * @param policy - pricing policy supplying the UTC offset.
 * @returns Beijing calendar fields plus the instant of that day's 00:00.
 */
function beijingParts(instantMs, policy = POLICY) {
  const offset = policy.schedule.utcOffsetMinutes * MINUTE_MS;
  const shifted = new Date(instantMs + offset);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    year,
    month,
    day,
    hour,
    minute,
    second: shifted.getUTCSeconds(),
    /** 0 = 周日 … 6 = 周六 */
    weekday: shifted.getUTCDay(),
    minuteOfDay: hour * 60 + minute,
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
    dayStartMs: Date.UTC(year, month - 1, day) - offset,
  };
}

/** Holiday membership sets, cached per policy object. */
const holidaySets = new WeakMap();

/** @param policy - pricing policy. @returns the holiday date-key set for that policy. */
function holidaySet(policy) {
  let set = holidaySets.get(policy);
  if (set === undefined) {
    set = new Set(policy.schedule.holidays);
    holidaySets.set(policy, set);
  }
  return set;
}

/**
 * Whether an instant bills at peak price.
 * @param instantMs - epoch milliseconds.
 * @param policy - pricing policy.
 * @returns true for a Beijing weekday inside a peak window that is not a holiday.
 */
function isPeak(instantMs, policy = POLICY) {
  const parts = beijingParts(instantMs, policy);
  const weekend = parts.weekday === 0 || parts.weekday === 6;
  if (weekend && policy.schedule.weekendOffPeak) return false;
  if (holidaySet(policy).has(parts.dateKey)) return false;
  for (const [start, end] of policy.schedule.peakWindows) {
    if (parts.minuteOfDay >= start && parts.minuteOfDay < end) return true;
  }
  return false;
}

/**
 * The billing period at an instant.
 * @param instantMs - epoch milliseconds.
 * @param policy - pricing policy.
 * @returns `'peak'` or `'off-peak'`.
 */
function periodAt(instantMs, policy = POLICY) {
  return isPeak(instantMs, policy) ? 'peak' : 'off-peak';
}

/**
 * The next instant at which the period flips.
 * @param instantMs - epoch milliseconds.
 * @param policy - pricing policy.
 * @returns epoch milliseconds of the next boundary, or null when none is found
 *   within three weeks (a policy with no windows never flips).
 */
function nextSwitchAt(instantMs, policy = POLICY) {
  const current = isPeak(instantMs, policy);
  const { dayStartMs } = beijingParts(instantMs, policy);
  const candidates = [];
  for (let day = 0; day < 21; day += 1) {
    const base = dayStartMs + day * DAY_MS;
    for (const [start, end] of policy.schedule.peakWindows) {
      candidates.push(base + start * MINUTE_MS, base + end * MINUTE_MS);
    }
  }
  candidates.sort((left, right) => left - right);
  for (const at of candidates) {
    if (at <= instantMs) continue;
    // Windows are half-open, so the period *at* a boundary is already the new
    // period: a window start is peak, a window end is off-peak.
    if (isPeak(at, policy) !== current) return at;
  }
  return null;
}

/**
 * Everything the UI needs about "now".
 * @param instantMs - epoch milliseconds.
 * @param policy - pricing policy.
 * @returns period, next switch instant, remaining time, and calendar coverage.
 */
function statusAt(instantMs, policy = POLICY) {
  const parts = beijingParts(instantMs, policy);
  const next = nextSwitchAt(instantMs, policy);
  return {
    period: isPeak(instantMs, policy) ? 'peak' : 'off-peak',
    nextSwitchAt: next,
    msUntilSwitch: next === null ? null : Math.max(0, next - instantMs),
    /** False when the holiday calendar does not cover the current year. */
    calendarCovered: policy.schedule.calendarYears.includes(parts.year),
    year: parts.year,
    dateKey: parts.dateKey,
    beijingMinuteOfDay: parts.minuteOfDay,
  };
}

/**
 * Effective price for one model in one period.
 * @param model - policy model entry.
 * @param period - `'peak'` or `'off-peak'`.
 * @param policy - pricing policy.
 * @returns effective prices, the peak reference prices, and whether a discount applied.
 */
function priceAt(model, period, policy = POLICY) {
  const factor = period === 'off-peak' ? policy.offPeakMultiplier : 1;
  return {
    currency: policy.currency,
    effective: {
      cacheHit: model.peakPrice.cacheHit * factor,
      cacheMiss: model.peakPrice.cacheMiss * factor,
      output: model.peakPrice.output * factor,
    },
    standard: model.peakPrice,
    discounted: factor !== 1,
  };
}

/**
 * Split a duration into clock parts, rounding up to the next whole second.
 * @param ms - duration in milliseconds.
 * @returns hours, minutes, seconds.
 */
function durationParts(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Compact countdown for the collapsed badge: `H:MM` above an hour, `M:SS` below.
 * @param ms - duration in milliseconds.
 * @returns the compact clock text.
 */
function compactCountdown(ms) {
  const { hours, minutes, seconds } = durationParts(ms);
  return hours > 0 ? `${hours}:${pad2(minutes)}` : `${minutes}:${pad2(seconds)}`;
}

/**
 * Render a price without trailing zeros.
 * @param value - number to render.
 * @returns the price text, or an em dash for a non-finite value.
 */
function formatPrice(value) {
  if (!Number.isFinite(value)) return '—';
  const text = value.toFixed(3).replace(/\.?0+$/, '');
  return text === '' || text === '-' ? '0' : text;
}


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
function currencySymbol(currency) {
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
function formatBalance(amount, symbol = '¥') {
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
function isPositiveDecimal(amount) {
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
function createBalanceStore() {
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


    /** Locale namespace owned by this plugin. */
    const NS = 'price-tip';

    /**
     * Client build version reported to the Platform account endpoints. The Host
     * derives the `x-client-version` header from it; `scripts/build-client.mjs`
     * inlines this package's own version, which is the only build identity a
     * standalone bundle can honestly claim.
     */
    const CLIENT_VERSION = '1.1.0';

    /** Simplified Chinese copy (key-set source of truth). */
    const zh = {
      'state.offPeak': '空闲时段',
      'state.peak': '高峰时段',
      'pill.halfPrice': '5折',
      'panel.title': 'DeepSeek 价格时段',
      'panel.close': '关闭',
      'panel.enterPeak': '{time} 进入高峰时段',
      'panel.enterOffPeak': '{time} 进入空闲时段',
      'panel.rulePeak': '高峰：工作日 09:00–12:00、14:00–18:00（北京时间）',
      'panel.calendarGap': '节假日日历未覆盖 {year} 年，高峰判断按工作日估算。',
      'panel.table': '元 / 百万 tokens（划线为高峰价）',
      'panel.modelNote': 'v4-pro 计价在官方文档间有出入，以价格页为准',
      'panel.effective': '生效',
      'panel.verified': '核对',
      'panel.source': '官方价格页',
      'balance.title': '账户余额',
      'balance.toppedUp': '充值余额',
      'balance.granted': '赠送余额',
      'balance.loading': '读取中…',
      'balance.signedOut': '登录后查看余额',
      'balance.failed': '暂时读不到余额',
      'balance.empty': '暂无余额',
      'balance.refresh': '刷新',
      'balance.topUp': '去充值',
      'balance.updated': '更新于 {time}',
      'balance.stale': '刷新失败，显示上次结果',
      'cheer.offPeak': '站起来蹬',
      'cheer.offPeakNote': '便宜时段，尽管使劲用',
      'cheer.peak': '心疼着蹬',
      'cheer.peakNote': '贵时段，蹬一下心疼一下',
      'col.model': '模型',
      'col.cacheHit': '缓存命中',
      'col.cacheMiss': '缓存未命中',
      'col.output': '输出',
      'unit.hour': '小时',
      'unit.minute': '分',
      'unit.second': '秒',
      'unit.sep': '',
      'aria.badge': 'DeepSeek 价格时段：{state}，{time}后切换到{next}',
    };

    /** English copy, same key set. */
    const en = {
      'state.offPeak': 'Off-peak',
      'state.peak': 'Peak',
      'pill.halfPrice': '50% off',
      'panel.title': 'DeepSeek pricing period',
      'panel.close': 'Close',
      'panel.enterPeak': 'Peak starts {time}',
      'panel.enterOffPeak': 'Off-peak starts {time}',
      'panel.rulePeak': 'Peak: weekdays 09:00–12:00, 14:00–18:00 (Beijing time)',
      'panel.calendarGap': 'The holiday calendar does not cover {year}; peak hours are estimated by weekday.',
      'panel.table': 'CNY per 1M tokens (struck = peak price)',
      'panel.modelNote': 'v4-pro pricing differs between official sources; the price page is used',
      'panel.effective': 'Effective',
      'panel.verified': 'Verified',
      'panel.source': 'Official price page',
      'balance.title': 'Account balance',
      'balance.toppedUp': 'Topped-up balance',
      'balance.granted': 'Granted balance',
      'balance.loading': 'Loading…',
      'balance.signedOut': 'Sign in to view your balance',
      'balance.failed': 'Balance temporarily unavailable',
      'balance.empty': 'No balance',
      'balance.refresh': 'Refresh',
      'balance.topUp': 'Top up',
      'balance.updated': 'Updated {time}',
      'balance.stale': 'Refresh failed; showing the last reading',
      'cheer.offPeak': 'Stand up and pedal',
      'cheer.offPeakNote': 'cheap hours — go all out',
      'cheer.peak': 'Wince as you pedal',
      'cheer.peakNote': 'peak rates — every push stings',
      'col.model': 'Model',
      'col.cacheHit': 'Cache hit',
      'col.cacheMiss': 'Cache miss',
      'col.output': 'Output',
      'unit.hour': 'h',
      'unit.minute': 'm',
      'unit.second': 's',
      'unit.sep': ' ',
      'aria.badge': 'DeepSeek pricing: {state}, switching to {next} in {time}',
    };

    /** Plugin-scoped styles; rendered as a React element so unmounting removes them. */
    const css = [
      '.dpt_row{flex:none;align-items:center;gap:8px;width:calc(100% + 4px);margin:4px -2px;display:flex;position:relative}',
      '.dpt_rowRail{width:36px;margin:8px 0 10px}',
      '.dpt_badge{box-sizing:border-box;border-radius:var(--dsw-radius-md);cursor:pointer;width:auto;min-width:0;height:42px;color:var(--dsw-alias-label-primary);background:0 0;border:none;flex:1;align-items:center;gap:8px;margin:0;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}',
      '.dpt_badge:hover,.dpt_badge[data-open=true]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dpt_badge:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}',
      '.dpt_badgeRail{flex:none;justify-content:center;gap:0;width:36px;height:36px;margin:0;padding:0}',
      '.dpt_icon{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary)}',
      '.dpt_offPeak .dpt_icon{color:var(--dsw-alias-state-success-primary)}',
      '.dpt_peak .dpt_icon{color:var(--dsw-alias-state-warn-primary)}',
      '.dpt_label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none}',
      '.dpt_badgeCheer{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;font-size:13px;font-weight:500}',
      '.dpt_offPeak .dpt_badgeCheer{color:var(--dsw-alias-state-success-primary)}',
      '.dpt_peak .dpt_badgeCheer{color:var(--dsw-alias-state-warn-primary)}',
      '.dpt_count{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums;flex:none}',
      '.dpt_panel{position:fixed;left:12px;bottom:96px;z-index:40;isolation:isolate;width:392px;max-width:calc(100vw - 24px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;box-shadow:var(--dsw-elevation-prominent);overflow:hidden}',
      // The host menu colour is 94% opaque, so a translucent panel lets the page behind
      // it bleed through (readable under contrast enhancement). Layering it over the
      // opaque base keeps the menu tint and makes the surface solid; the backdrop blur
      // would then be a no-op, so it is dropped.
      '.dpt_panel::before{z-index:-1;border-radius:inherit;background:var(--dsw-specific-menu);content:"";pointer-events:none;position:absolute;inset:0}',
      '.dpt_body{max-height:min(64vh,560px);overflow-y:auto;padding:12px 14px 10px;font-size:13px;line-height:20px}',
      '.dpt_head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.dpt_title{font-size:14px;font-weight:500;line-height:20px}',
      '.dpt_close{corner-shape:round;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;padding:0;display:grid}',
      '.dpt_close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dpt_stateRow{display:flex;align-items:center;gap:6px;margin-top:8px}',
      '.dpt_dot{width:8px;height:8px;border-radius:999px;flex:none;background:var(--dsw-alias-label-tertiary)}',
      '.dpt_dotOff{background:var(--dsw-alias-state-success-primary)}',
      '.dpt_dotPeak{background:var(--dsw-alias-state-warn-primary)}',
      '.dpt_state{font-size:14px;font-weight:500}',
      '.dpt_pill{margin-left:auto;color:var(--dsw-alias-state-success-primary);border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;padding:1px 8px;font-size:11px;line-height:16px}',
      '.dpt_countValue{font-size:20px;font-weight:500;line-height:26px;font-variant-numeric:tabular-nums;margin-top:10px}',
      '.dpt_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;margin-top:4px}',
      '.dpt_cheer{display:flex;align-items:baseline;gap:8px;margin-top:10px;font-size:13px;line-height:20px}',
      '.dpt_cheerPhrase{font-weight:500}',
      '.dpt_cheerNote{color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dpt_cheerOff .dpt_cheerPhrase{color:var(--dsw-alias-state-success-primary)}',
      '.dpt_cheerPeak .dpt_cheerPhrase{color:var(--dsw-alias-state-warn-primary)}',
      '.dpt_rule{margin-top:10px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dpt_balance{margin-top:10px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.dpt_sectionHead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
      '.dpt_sectionTitle{color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dpt_sectionActions{display:flex;align-items:baseline;gap:10px}',
      '.dpt_action{color:var(--dsw-alias-link);background:0 0;border:none;padding:0;font-family:inherit;font-size:12px;line-height:16px;cursor:pointer;text-decoration:none}',
      '.dpt_action:hover:not(:disabled){text-decoration:underline}',
      '.dpt_action:disabled{color:var(--dsw-alias-label-caption);cursor:default}',
      '.dpt_balanceRow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:6px}',
      '.dpt_balanceLabel{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px}',
      '.dpt_balanceValue{font-size:14px;font-weight:500;line-height:18px;font-variant-numeric:tabular-nums}',
      '.dpt_balanceState{margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}',
      '.dpt_balanceNote{margin-top:4px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}',
      '.dpt_note{margin-top:6px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}',
      '.dpt_tableTitle{margin-top:10px;color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dpt_table{width:100%;border-collapse:collapse;margin-top:4px;font-variant-numeric:tabular-nums}',
      '.dpt_table th{color:var(--dsw-alias-label-caption);font-weight:400;font-size:11px;line-height:16px;text-align:right;padding:2px 0}',
      '.dpt_table th:first-child{text-align:left}',
      '.dpt_table td{padding:4px 0;font-size:12px;line-height:16px;text-align:right;vertical-align:top}',
      '.dpt_table td:first-child{text-align:left;color:var(--dsw-alias-label-secondary)}',
      '.dpt_table tbody tr+tr td{border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.dpt_priceNow{color:var(--dsw-alias-label-primary)}',
      '.dpt_priceWas{margin-left:4px;color:var(--dsw-alias-label-caption);font-size:11px}',
      '.dpt_foot{margin-top:4px;display:flex;justify-content:space-between;align-items:baseline;gap:8px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}',
      '.dpt_link{color:var(--dsw-alias-link);text-decoration:none}',
      '.dpt_link:hover{text-decoration:underline}',
    ].join('');

    /**
     * Fill `{name}` placeholders in a localized string.
     * @param text - dictionary value.
     * @param values - replacement values by placeholder name.
     * @returns the filled text.
     */
    function fill(text, values) {
      return text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
    }

    /**
     * A ticking "now" that re-reads the clock every second, aligned to the second.
     * @returns current epoch milliseconds, updated once per second.
     */
    function useNow() {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        let timer;
        const tick = () => {
          setNow(Date.now());
          timer = setTimeout(tick, 1000 - (Date.now() % 1000));
        };
        timer = setTimeout(tick, 1000 - (Date.now() % 1000));
        return () => clearTimeout(timer);
      }, []);
      return now;
    }

    /**
     * Localized duration text, e.g. `3小时12分` or `3h 12m 45s`.
     * @param t - translate seat.
     * @param parts - duration parts from `durationParts`.
     * @param withSeconds - always include the seconds component.
     * @returns the duration text.
     */
    function durationText(t, parts, withSeconds) {
      const pieces = [];
      if (parts.hours > 0) pieces.push(`${parts.hours}${t('unit.hour')}`);
      if (parts.hours > 0 || parts.minutes > 0) pieces.push(`${parts.minutes}${t('unit.minute')}`);
      if (withSeconds || pieces.length === 0) pieces.push(`${parts.seconds}${t('unit.second')}`);
      return pieces.join(t('unit.sep'));
    }

    /**
     * Format an instant in the viewer's local time, adding the date when it is
     * not today. The clock style follows the **Harness** locale rather than the
     * browser's, so a Chinese interface shows 24-hour time instead of "09:00 AM".
     * @param instantMs - epoch milliseconds, or null.
     * @param localeId - active Harness locale id (`zh`, `en`, …); undefined follows the browser.
     * @returns the local time text.
     */
    function localInstantText(instantMs, localeId) {
      if (instantMs === null) return '—';
      const date = new Date(instantMs);
      const sameDay = date.toDateString() === new Date().toDateString();
      return new Intl.DateTimeFormat(localeId ?? undefined, sameDay
        ? { hour: '2-digit', minute: '2-digit' }
        : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    }

    /**
     * Read the signed-in account's balance through the optional account Remote
     * namespace. The Host projects only wallet currency/balance strings, so this
     * never sees a token.
     * @param account - the `remote.account` namespace service.
     * @param localeId - active Harness locale id.
     * @returns a store outcome: `ready`, `signed-out`, or `failed`.
     */
    async function loadBalance(account, localeId) {
      const identity = {
        version: CLIENT_VERSION,
        locale: localeId,
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      };
      const state = await account.getState();
      if (state === null || typeof state !== 'object' || state.ok !== true || state.value === null) {
        return { phase: 'failed' };
      }
      const links = state.value.links ?? null;
      if (state.value.status !== 'credential-stored') return { phase: 'signed-out', links };
      const result = await account.getBalance(identity);
      if (result === null || typeof result !== 'object' || result.ok !== true) return { phase: 'failed' };
      const balance = result.value;
      // A null balance means the grant is absent or changed; the Provider also
      // clears an unauthorized credential and emits its own signed-out notice.
      if (balance === null) return { phase: 'signed-out', links };
      if (balance.status !== 'ready') return { phase: 'failed' };
      return { phase: 'ready', wallets: balance.value, bonusWallets: balance.bonusWallets, links };
    }

    /** Crescent-moon glyph: off-peak. @param props - size in pixels. @returns the icon element. */
    function IconMoon({ size }) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
      }, h('path', { d: 'M12.6 10.3A5.5 5.5 0 0 1 5.7 3.4a5.5 5.5 0 1 0 6.9 6.9Z' }));
    }

    /** Sun glyph: peak. @param props - size in pixels. @returns the icon element. */
    function IconSun({ size }) {
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
      }, [
        h('circle', { key: 'disc', cx: 8, cy: 8, r: 3.1 }),
        h('path', {
          key: 'rays',
          d: 'M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1',
        }),
      ]);
    }

    /**
     * Account-balance block for the panel. It reads the signed-in DeepSeek
     * account through the optional account namespace, so a profile without one
     * (or an API-key-only setup that never signed in) shows either nothing or a
     * single muted line instead of a broken section.
     * @param props - translate seat, balance snapshot, active locale, and a refresh callback.
     * @returns the block element, or null when no account service is mounted.
     */
    function BalanceBlock({ t, balance, localeId, onRefresh }) {
      if (balance.phase === 'unavailable') return null;
      const ready = balance.phase === 'ready';
      const rows = balance.wallets.map((wallet, index) => ({
        key: `toppedUp-${index}`,
        label: t('balance.toppedUp'),
        value: formatBalance(wallet.balance, currencySymbol(wallet.currency)),
      }));
      // Granted wallets are noise at zero, which is their usual state; the
      // account settings page hides them on the same condition.
      balance.bonusWallets.forEach((wallet, index) => {
        if (!isPositiveDecimal(wallet.balance)) return;
        rows.push({
          key: `granted-${index}`,
          label: t('balance.granted'),
          value: formatBalance(wallet.balance, currencySymbol(wallet.currency)),
        });
      });

      let stateText = null;
      if (balance.phase === 'loading' || balance.phase === 'idle') stateText = t('balance.loading');
      else if (balance.phase === 'signed-out') stateText = t('balance.signedOut');
      else if (balance.phase === 'failed') stateText = t('balance.failed');
      else if (rows.length === 0) stateText = t('balance.empty');

      return h('div', { className: 'dpt_balance' }, [
        h('div', { key: 'head', className: 'dpt_sectionHead' }, [
          h('span', { key: 'title', className: 'dpt_sectionTitle' }, t('balance.title')),
          h('span', { key: 'actions', className: 'dpt_sectionActions' }, [
            ready && balance.links !== null && balance.links.topUpUrl
              ? h('a', {
                key: 'topUp',
                className: 'dpt_action',
                href: balance.links.topUpUrl,
                target: '_blank',
                rel: 'noreferrer noopener',
              }, t('balance.topUp'))
              : null,
            h('button', {
              key: 'refresh',
              type: 'button',
              className: 'dpt_action',
              onClick: onRefresh,
              disabled: balance.busy,
            }, t('balance.refresh')),
          ]),
        ]),
        ...rows.map((row) => h('div', { key: row.key, className: 'dpt_balanceRow' }, [
          h('span', { key: 'label', className: 'dpt_balanceLabel' }, row.label),
          h('span', { key: 'value', className: 'dpt_balanceValue' }, row.value),
        ])),
        stateText === null ? null : h('div', { key: 'state', className: 'dpt_balanceState' }, stateText),
        ready
          ? h('div', { key: 'note', className: 'dpt_balanceNote' },
            balance.stale ? t('balance.stale') : fill(t('balance.updated'), { time: localInstantText(balance.fetchedAt, localeId) }))
          : null,
      ]);
    }

    /**
     * Detail panel: current state, live countdown, the rule, and the price table.
     * @param props - translate seat, current status, active locale, and close callback.
     * @returns the panel element.
     */
    function Panel({ t, status, onClose, localeId, balance, onRefreshBalance }) {
      const panelRef = React.useRef(null);

      // Read the balance when the panel opens; the store dedupes an in-flight read.
      React.useEffect(() => { onRefreshBalance(); }, [onRefreshBalance]);

      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === 'Escape') onClose();
        };
        const onPointerDown = (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('[data-price-tip-trigger]') !== null) return;
          if (panelRef.current !== null && !panelRef.current.contains(target)) onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onPointerDown, true);
        return () => {
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('mousedown', onPointerDown, true);
        };
      }, [onClose]);

      const offPeak = status.period === 'off-peak';
      const untilSwitch = durationText(t, durationParts(status.msUntilSwitch), true);
      const columns = ['cacheHit', 'cacheMiss', 'output'];
      const uncertain = POLICY.models.some((model) => model.pricingUncertain);

      const priceRow = (model) => {
        const price = priceAt(model, status.period);
        return h('tr', { key: model.id }, [
          h('td', { key: 'model' }, model.label),
          ...columns.map((kind) => h('td', { key: kind }, [
            h('span', { key: 'now', className: 'dpt_priceNow' }, formatPrice(price.effective[kind])),
            price.discounted
              ? h('s', { key: 'was', className: 'dpt_priceWas' }, formatPrice(price.standard[kind]))
              : null,
          ])),
        ]);
      };

      return h('div', { className: 'dpt_panel', ref: panelRef, role: 'dialog', 'aria-label': t('panel.title') },
        h('div', { className: 'dpt_body' }, [
          h('div', { key: 'head', className: 'dpt_head' }, [
            h('span', { key: 'title', className: 'dpt_title' }, t('panel.title')),
            h('button', {
              key: 'close', type: 'button', className: 'dpt_close',
              'aria-label': t('panel.close'), title: t('panel.close'), onClick: onClose,
            }, '×'),
          ]),
          h('div', { key: 'state', className: 'dpt_stateRow' }, [
            h('span', {
              key: 'dot',
              className: `dpt_dot ${offPeak ? 'dpt_dotOff' : 'dpt_dotPeak'}`,
              'aria-hidden': true,
            }),
            h('span', { key: 'label', className: 'dpt_state' }, t(offPeak ? 'state.offPeak' : 'state.peak')),
            offPeak ? h('span', { key: 'pill', className: 'dpt_pill' }, t('pill.halfPrice')) : null,
          ]),
          // Big remaining time, then the same switch as an absolute local time.
          h('div', { key: 'count', className: 'dpt_countValue' }, untilSwitch),
          h('div', { key: 'when', className: 'dpt_meta' },
            fill(t(offPeak ? 'panel.enterPeak' : 'panel.enterOffPeak'), {
              time: localInstantText(status.nextSwitchAt, localeId),
            })),
          // Emotional value: nudge the user to spend freely while it is cheap and
          // to take it easy while it is not. Copy lives in the dictionaries.
          h('div', {
            key: 'cheer',
            className: `dpt_cheer ${offPeak ? 'dpt_cheerOff' : 'dpt_cheerPeak'}`,
          }, [
            h('span', { key: 'phrase', className: 'dpt_cheerPhrase' },
              t(offPeak ? 'cheer.offPeak' : 'cheer.peak')),
            h('span', { key: 'note', className: 'dpt_cheerNote' },
              t(offPeak ? 'cheer.offPeakNote' : 'cheer.peakNote')),
          ]),
          // Signed-in account balance, when this profile has an account service.
          h(BalanceBlock, {
            key: 'balance', t, balance, localeId, onRefresh: onRefreshBalance,
          }),
          h('div', { key: 'tableTitle', className: 'dpt_tableTitle' }, t('panel.table')),
          h('table', { key: 'table', className: 'dpt_table' }, [
            h('thead', { key: 'head' }, h('tr', null, [
              h('th', { key: 'model' }, t('col.model')),
              ...columns.map((kind) => h('th', { key: kind }, t(kind === 'cacheHit'
                ? 'col.cacheHit'
                : kind === 'cacheMiss' ? 'col.cacheMiss' : 'col.output'))),
            ])),
            h('tbody', { key: 'body' }, POLICY.models.map(priceRow)),
          ]),
          uncertain ? h('div', { key: 'modelNote', className: 'dpt_note' }, t('panel.modelNote')) : null,
          status.calendarCovered
            ? null
            : h('div', { key: 'calendarGap', className: 'dpt_note' },
              fill(t('panel.calendarGap'), { year: status.year })),
          // Fine print: the rule, then provenance.
          h('div', { key: 'rule', className: 'dpt_rule' }, t('panel.rulePeak')),
          h('div', { key: 'foot', className: 'dpt_foot' }, [
            h('span', { key: 'dates' },
              `${t('panel.effective')} ${POLICY.effectiveFrom.slice(0, 10)} · ${t('panel.verified')} ${POLICY.verifiedAt}`),
            h('a', {
              key: 'source', className: 'dpt_link', href: POLICY.source.url,
              target: '_blank', rel: 'noreferrer noopener',
            }, t('panel.source')),
          ]),
        ]),
      );
    }

    /**
     * Sidebar footer entry: a badge with the live pricing period and a countdown.
     * @param props - slot props: `wide` from the sidebar, the `t` seat, the
     *   `useActiveLocale` / `useBalance` selector hooks, and the refresh action.
     * @returns the badge row and, while open, the detail panel.
     */
    function PriceTip({ wide, t, useActiveLocale, useBalance, refreshBalance }) {
      const now = useNow();
      const [open, setOpen] = React.useState(false);
      const close = React.useCallback(() => setOpen(false), []);
      const status = React.useMemo(() => statusAt(now), [now]);
      const activeLocale = useActiveLocale((id) => id);
      const balance = useBalance((snapshot) => snapshot);
      const offPeak = status.period === 'off-peak';
      const stateLabel = t(offPeak ? 'state.offPeak' : 'state.peak');
      const nextLabel = t(offPeak ? 'state.peak' : 'state.offPeak');
      const countdown = compactCountdown(status.msUntilSwitch);
      const description = fill(t('aria.badge'), {
        state: stateLabel,
        next: nextLabel,
        time: durationText(t, durationParts(status.msUntilSwitch), false),
      });
      // `wide` is false only in the collapsed rail; an absent prop means the roomy column.
      const roomy = wide !== false;

      return h(React.Fragment, null, [
        h('style', { key: 'style' }, css),
        h('div', { key: 'row', className: roomy ? 'dpt_row' : 'dpt_row dpt_rowRail' }, [
          h('button', {
            key: 'badge',
            type: 'button',
            'data-price-tip-trigger': '',
            'data-open': open ? 'true' : 'false',
            className: [
              'dpt_badge',
              roomy ? '' : 'dpt_badgeRail',
              offPeak ? 'dpt_offPeak' : 'dpt_peak',
            ].filter(Boolean).join(' '),
            title: description,
            'aria-label': description,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          }, [
            h('span', { key: 'icon', className: 'dpt_icon' },
              h(offPeak ? IconMoon : IconSun, { size: roomy ? 16 : 18 })),
            roomy ? h('span', { key: 'label', className: 'dpt_label' }, stateLabel) : null,
            // The slogan rides along in the sidebar so the nudge is visible without
            // opening the panel; it ellipsizes first when the column is narrow.
            roomy ? h('span', {
              key: 'cheer',
              className: 'dpt_badgeCheer',
            }, t(offPeak ? 'cheer.offPeak' : 'cheer.peak')) : null,
            roomy ? h('span', { key: 'count', className: 'dpt_count' }, countdown) : null,
          ]),
        ]),
        open ? h(Panel, {
          key: 'panel', t, status, localeId: activeLocale, balance, onRefreshBalance: refreshBalance, onClose: close,
        }) : null,
      ]);
    }

    /** Services this client plugin needs before it can register. */
    const inject = ['slots', 'locale'];

    /**
     * Client plugin body: own the dictionaries and the sidebar footer entry.
     * @param ctx - client root context.
     * @returns {void}
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'price-tip: dictionaries');
      // Stable observable source (created once, so the renderer's hook cache keeps
      // one identity): the active Harness locale, consumed by the component as the
      // `useActiveLocale` selector hook so the switch time follows the UI language.
      const activeLocale = {
        getSnapshot: () => ctx.locale.getSnapshot().active,
        subscribe: (listener) => ctx.locale.subscribe(listener),
      };
      // Balance is an optional addition: a profile without the account controller
      // keeps the badge and simply never renders the block. `ctx.inject` is the
      // park-until-available form, so nothing here is a hard dependency.
      const balance = createBalanceStore();
      ctx.effect(() => () => balance.dispose(), 'price-tip: balance lifetime');
      ctx.inject(['remote', 'remote.account'], (accountCtx) => {
        const account = accountCtx.remote.account;
        balance.attach(() => loadBalance(account, ctx.locale.getSnapshot().active));
        // A sign-in, sign-out, or credential swap arrives as a record update; only
        // a store the user has already opened re-reads, so nothing polls in the
        // background. Disposal lives with this optional fiber.
        accountCtx.effect(
          () => accountCtx.remote.$on('credentials/record-updated', () => { balance.refreshIfLoaded(); }),
          'price-tip: balance refresh',
        );
      });
      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'price-tip',
        order: 20,
        locale: NS,
        inject: () => ({
          hooks: { activeLocale, balance },
          refreshBalance: () => balance.refresh(),
        }),
      }, PriceTip));
    }

    return { inject, apply };
  },
});
