#!/usr/bin/env node
/**
 * Generate the served browser bundle `client.js` from `src/client.js` (template),
 * `src/policy.js` (pricing rule), and `src/balance.js` (account-balance helpers).
 *
 * The Host serves `client.js` verbatim, so the artifact is committed. This
 * script keeps it in lockstep with its sources:
 *   - the package name and version come from `package.json`, so the module id
 *     and the Platform client identity can never drift from the manifest;
 *   - both rule modules are inlined textually, so the browser and the tests run
 *     the same code instead of two copies;
 *   - the result is parsed with `node:vm` before it is written.
 *
 * Usage: `node scripts/build-client.mjs` (write) or `--check` (verify only).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

/** Repository root (this file lives in `<root>/scripts`). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Template with the `@@PACKAGE_NAME@@`, `@@CLIENT_VERSION@@`, and inline markers. */
export const TEMPLATE_PATH = path.join(ROOT, 'src', 'client.js');
/** Pricing-rule module inlined into the bundle. */
export const POLICY_PATH = path.join(ROOT, 'src', 'policy.js');
/** Account-balance module inlined into the bundle. */
export const BALANCE_PATH = path.join(ROOT, 'src', 'balance.js');
/** Generated bundle served to the browser. */
export const BUNDLE_PATH = path.join(ROOT, 'client.js');
/** Template marker → module it is replaced by, in source order. */
const INLINE_MARKERS = new Map([
  ['// @@INLINE:policy@@', POLICY_PATH],
  ['// @@INLINE:balance@@', BALANCE_PATH],
]);

/**
 * Strip ES module syntax from a source file that only declares things.
 * @param source - contents of an inlined module.
 * @param label - module path for diagnostics.
 * @returns the same source as a plain script body.
 */
export function inlineModule(source, label) {
  if (/^\s*import\s/m.test(source)) {
    throw new Error(`${label} must not import anything: the bundle inlines it as a plain script`);
  }
  if (/^\s*export\s+(default|\{|\*)/m.test(source)) {
    throw new Error(`${label} may only use \`export const\` / \`export function\` declarations`);
  }
  return source.replace(/^export (?=(?:const|let|var|function|class)\b)/gm, '');
}

/**
 * Render the bundle text from the manifest and sources.
 * @returns the bundle source.
 */
export function renderClient() {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (typeof manifest.name !== 'string' || manifest.name === '') {
    throw new Error('package.json needs a name');
  }
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error('package.json needs a version');
  }
  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  let rendered = template;
  for (const [marker, modulePath] of INLINE_MARKERS) {
    const markers = template.split(marker).length - 1;
    if (markers !== 1) {
      throw new Error(`src/client.js must contain exactly one "${marker}" marker, found ${markers}`);
    }
    rendered = rendered.replace(marker, () => inlineModule(readFileSync(modulePath, 'utf8'), path.relative(ROOT, modulePath)));
  }
  rendered = rendered
    .replaceAll('@@PACKAGE_NAME@@', manifest.name)
    .replaceAll('@@CLIENT_VERSION@@', manifest.version);
  const banner = [
    '// GENERATED FILE — do not edit.',
    '// Sources: src/client.js (template) + src/policy.js (pricing rule) + src/balance.js (account balance).',
    '// Rebuild with: node scripts/build-client.mjs',
    '',
  ].join('\n');
  const bundle = banner + rendered;
  // Fail the build on a syntax error instead of shipping a broken bundle.
  new vm.Script(bundle, { filename: 'client.js' });
  const leftover = bundle.match(/@@[A-Z_]+@@/);
  if (leftover !== null) throw new Error(`template placeholder ${leftover[0]} was not substituted`);
  return bundle;
}

/** Write `client.js` from the sources. @returns the byte length written. */
export function writeBundle() {
  const bundle = renderClient();
  writeFileSync(BUNDLE_PATH, bundle);
  return Buffer.byteLength(bundle);
}

/**
 * Compare the committed bundle with a fresh render.
 * @returns whether the committed artifact is up to date.
 */
export function bundleIsCurrent() {
  let committed;
  try {
    committed = readFileSync(BUNDLE_PATH, 'utf8');
  } catch {
    return false;
  }
  return committed === renderClient();
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (bundleIsCurrent()) {
      console.log('client.js is up to date with src/client.js + src/policy.js + src/balance.js');
    } else {
      console.error('client.js is STALE — run: node scripts/build-client.mjs');
      process.exitCode = 1;
    }
  } else {
    const bytes = writeBundle();
    console.log(`client.js written (${bytes} bytes)`);
  }
}
