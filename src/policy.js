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
export const HOLIDAYS_2026 = [
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
export const POLICY = {
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
export function beijingParts(instantMs, policy = POLICY) {
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
export function isPeak(instantMs, policy = POLICY) {
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
export function periodAt(instantMs, policy = POLICY) {
  return isPeak(instantMs, policy) ? 'peak' : 'off-peak';
}

/**
 * The next instant at which the period flips.
 * @param instantMs - epoch milliseconds.
 * @param policy - pricing policy.
 * @returns epoch milliseconds of the next boundary, or null when none is found
 *   within three weeks (a policy with no windows never flips).
 */
export function nextSwitchAt(instantMs, policy = POLICY) {
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
export function statusAt(instantMs, policy = POLICY) {
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
export function priceAt(model, period, policy = POLICY) {
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
export function durationParts(ms) {
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
export function compactCountdown(ms) {
  const { hours, minutes, seconds } = durationParts(ms);
  return hours > 0 ? `${hours}:${pad2(minutes)}` : `${minutes}:${pad2(seconds)}`;
}

/**
 * Render a price without trailing zeros.
 * @param value - number to render.
 * @returns the price text, or an em dash for a non-finite value.
 */
export function formatPrice(value) {
  if (!Number.isFinite(value)) return '—';
  const text = value.toFixed(3).replace(/\.?0+$/, '');
  return text === '' || text === '-' ? '0' : text;
}
