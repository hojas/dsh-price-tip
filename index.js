/**
 * Host half of the price-tip bundle.
 *
 * The reminder itself is a Client-side decoration: it needs no session state, no
 * Remote call, and no scheduler, because the pricing rule is a pure function of
 * the wall clock. Everything the user sees is rendered by `client.js` into the
 * sidebar footer, so this half only has to exist for the bundle row to activate.
 *
 * @returns {void}
 */
export function apply() {}
