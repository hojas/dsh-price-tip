#!/usr/bin/env node
/**
 * Generate the served browser bundle `client.js` from `src/client.js` (template)
 * and `src/policy.js` (pricing rule).
 *
 * The Host serves `client.js` verbatim, so the artifact is committed. This
 * script keeps it in lockstep with its sources:
 *   - the package name comes from `package.json`, so the module id can never
 *     drift from the manifest;
 *   - the pricing rule is inlined textually, so the browser and the tests run
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
/** Template with the `@@PACKAGE_NAME@@` and policy markers. */
export const TEMPLATE_PATH = path.join(ROOT, 'src', 'client.js');
/** Pricing-rule module inlined into the bundle. */
export const POLICY_PATH = path.join(ROOT, 'src', 'policy.js');
/** Generated bundle served to the browser. */
export const BUNDLE_PATH = path.join(ROOT, 'client.js');
/** Marker replaced by the policy source. */
const MARKER = '// @@INLINE:policy@@';

/**
 * Strip ES module syntax from a source file that only declares things.
 * @param source - contents of `src/policy.js`.
 * @returns the same source as a plain script body.
 */
export function inlinePolicy(source) {
  if (/^\s*import\s/m.test(source)) {
    throw new Error('src/policy.js must not import anything: the bundle inlines it as a plain script');
  }
  if (/^\s*export\s+(default|\{|\*)/m.test(source)) {
    throw new Error('src/policy.js may only use `export const` / `export function` declarations');
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
  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  const markers = template.split(MARKER).length - 1;
  if (markers !== 1) {
    throw new Error(`src/client.js must contain exactly one "${MARKER}" marker, found ${markers}`);
  }
  const policy = inlinePolicy(readFileSync(POLICY_PATH, 'utf8'));
  const banner = [
    '// GENERATED FILE — do not edit.',
    '// Sources: src/client.js (template) + src/policy.js (pricing rule).',
    '// Rebuild with: node scripts/build-client.mjs',
    '',
  ].join('\n');
  const rendered = template
    .replace(MARKER, () => policy.trimEnd())
    .replaceAll('@@PACKAGE_NAME@@', manifest.name);
  const bundle = banner + rendered;
  // Fail the build on a syntax error instead of shipping a broken bundle.
  new vm.Script(bundle, { filename: 'client.js' });
  if (bundle.includes('@@PACKAGE_NAME@@')) throw new Error('package-name placeholder was not substituted');
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
      console.log('client.js is up to date with src/client.js + src/policy.js');
    } else {
      console.error('client.js is STALE — run: node scripts/build-client.mjs');
      process.exitCode = 1;
    }
  } else {
    const bytes = writeBundle();
    console.log(`client.js written (${bytes} bytes)`);
  }
}
