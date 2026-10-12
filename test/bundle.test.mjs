/**
 * Structural tests for the shipped bundle: the generated `client.js` must match
 * its sources, register into the expected slot with the expected options, and
 * pull in nothing but the platform module table.
 *
 * These tests do not render React or emulate a DOM; they exercise the module
 * wrapper, the plugin lifecycle, and the manifest only.
 */

import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { ROOT, bundleIsCurrent } from '../scripts/build-client.mjs';

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const bundleSource = readFileSync(path.join(ROOT, 'client.js'), 'utf8');

/**
 * Load the bundle with a stubbed loader and capture its registration. The bundle
 * body runs in this realm (so its arrays compare equal to ours) and doubles as a
 * syntax check.
 * @returns the registration object it handed to `window.__ModuleLoader__`.
 */
function loadRegistration() {
  let registration;
  const window = {
    __ModuleLoader__: {
      load(definition) {
        assert.equal(registration, undefined, 'the bundle must register exactly once');
        registration = definition;
      },
    },
  };
  // eslint-disable-next-line no-new-func -- the bundle is a classic script, not a module
  new Function('window', bundleSource)(window);
  assert.notEqual(registration, undefined, 'the bundle did not register with the module loader');
  return registration;
}

/**
 * Materialize the bundle factory with a recording `require`.
 * @returns the plugin exports and the module ids the factory asked for.
 */
function materialize() {
  const requested = [];
  const fakeReact = { createElement: () => ({}), Fragment: Symbol('Fragment') };
  const plugin = loadRegistration().factory((specifier) => {
    requested.push(specifier);
    if (specifier === 'react') return fakeReact;
    throw new Error(`unexpected require("${specifier}")`);
  });
  return { plugin, requested };
}

test('the committed client.js is up to date with its sources', () => {
  assert.ok(bundleIsCurrent(), 'run: node scripts/build-client.mjs');
});

test('the bundle registers under the package name and requires only React', () => {
  const registration = loadRegistration();
  assert.equal(registration.id, manifest.name);
  const { plugin, requested } = materialize();
  assert.deepEqual(requested, ['react']);
  const staticRequires = [...bundleSource.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(staticRequires)], ['react']);
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual(plugin.inject, ['slots', 'locale']);
});

test('apply() owns its dictionaries and one sidebar footer entry', () => {
  const { plugin } = materialize();
  const effects = [];
  const injections = [];
  const registrations = [];
  const dictionaries = [];
  const localeListeners = new Set();
  const optionalInjections = [];
  let activeLocale = 'zh';
  const publishLocale = (id) => {
    activeLocale = id;
    for (const listener of [...localeListeners]) listener();
  };
  const ctx = {
    effect(callback, label) {
      effects.push({ callback, label });
      return () => {};
    },
    inject(services, callback) {
      optionalInjections.push({ services, callback });
      return () => {};
    },
    locale: {
      register(namespace, dict) {
        dictionaries.push({ namespace, dict });
        return () => {};
      },
      getSnapshot: () => ({ active: activeLocale }),
      subscribe(listener) {
        localeListeners.add(listener);
        return () => localeListeners.delete(listener);
      },
    },
    slots: {
      inject(key, callback) {
        injections.push({ key, callback });
        return () => {};
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };

  plugin.apply(ctx);

  assert.deepEqual(effects.map((effect) => effect.label), [
    'price-tip: dictionaries',
    'price-tip: balance lifetime',
  ]);
  for (const effect of effects) effect.callback();
  assert.deepEqual(injections.map((injection) => injection.key), ['sidebar.footer.action']);
  for (const injection of injections) injection.callback();

  // The account namespace is optional: it arrives through a parked injection
  // rather than the plugin's required list, so profiles without it still load.
  assert.deepEqual(plugin.inject, ['slots', 'locale']);
  assert.equal(optionalInjections.length, 1);
  assert.deepEqual(optionalInjections[0].services, ['remote', 'remote.account']);

  assert.equal(dictionaries.length, 1);
  assert.equal(dictionaries[0].namespace, 'price-tip');
  const { zh, en } = dictionaries[0].dict;
  assert.ok(Object.keys(zh).length > 10, 'the dictionary should cover the visible copy');
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'zh and en must cover the same keys');
  for (const [key, value] of Object.entries({ ...zh, ...en })) {
    assert.equal(typeof value, 'string', `${key} must be a string`);
    if (key.endsWith('.sep')) continue; // the join separator is intentionally empty in Chinese
    assert.notEqual(value.trim(), '', `${key} must not be empty`);
  }

  assert.equal(registrations.length, 1);
  const registration = registrations[0];
  const { inject, ...stableOptions } = registration.options;
  assert.deepEqual(stableOptions, {
    name: 'sidebar.footer.action',
    id: 'price-tip',
    order: 20,
    locale: 'price-tip',
  });
  assert.equal(typeof registration.component, 'function');
  assert.equal(registration.component.name, 'PriceTip');

  // The switch time follows the Harness locale, so the component needs the active
  // locale as an observable hook source wired to the locale service: the renderer
  // turns `hooks.activeLocale` into the `useActiveLocale` selector prop.
  assert.equal(typeof inject, 'function');
  const face = inject();
  assert.deepEqual(Object.keys(face), ['hooks', 'refreshBalance']);
  const source = face.hooks.activeLocale;
  assert.equal(typeof source.getSnapshot, 'function');
  assert.equal(typeof source.subscribe, 'function');
  assert.equal(source.getSnapshot(), 'zh');
  const notifications = [];
  const unsubscribe = source.subscribe(() => notifications.push(activeLocale));
  publishLocale('en');
  assert.deepEqual(notifications, ['en'], 'the source must forward locale changes');
  assert.equal(source.getSnapshot(), 'en');
  unsubscribe();
  publishLocale('zh');
  assert.deepEqual(notifications, ['en'], 'unsubscribing must stop notifications');
  assert.equal(source.getSnapshot(), 'zh');
  assert.match(bundleSource, /useActiveLocale\(/, 'the component must read the locale through the hook');

  // The balance is an observable source too, and its own refresh action is what
  // the panel calls when it opens.
  const balance = face.hooks.balance;
  assert.equal(typeof balance.getSnapshot, 'function');
  assert.equal(typeof balance.subscribe, 'function');
  assert.equal(balance.getSnapshot().phase, 'unavailable', 'no account service has been injected yet');
  assert.equal(typeof face.refreshBalance, 'function');
  assert.match(bundleSource, /useBalance\(/, 'the component must read the balance through the hook');
});

test('the optional account injection reads the balance into the hook source', async () => {
  const { plugin } = materialize();
  const optionalInjections = [];
  const registrations = [];
  let subscription = null;
  const account = {
    calls: [],
    async getState() {
      this.calls.push('getState');
      return { ok: true, value: { status: 'credential-stored', links: { topUpUrl: 'https://platform.deepseek.com/top_up' } } };
    },
    async getBalance(metadata) {
      this.calls.push('getBalance');
      this.metadata = metadata;
      return {
        ok: true,
        value: {
          status: 'ready',
          value: [{ currency: 'CNY', balance: '110.00' }],
          bonusWallets: [{ currency: 'USD', balance: '0' }],
        },
      };
    },
  };
  const ctx = {
    effect: (callback) => { callback(); return () => {}; },
    inject(services, callback) { optionalInjections.push({ services, callback }); },
    locale: { register: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
    slots: {
      inject: (_key, callback) => callback(),
      register: (options, component) => { registrations.push({ options, component }); return () => {}; },
    },
  };
  plugin.apply(ctx);
  assert.equal(optionalInjections.length, 1);
  assert.deepEqual(optionalInjections[0].services, ['remote', 'remote.account']);

  const effects = [];
  optionalInjections[0].callback({
    remote: {
      account,
      $on(event, listener) { subscription = { event, listener }; return () => { subscription = null; }; },
    },
    effect(callback, label) { effects.push({ callback, label }); return () => {}; },
  });
  for (const effect of effects) effect.callback();
  assert.deepEqual(effects.map((effect) => effect.label), ['price-tip: balance refresh']);
  assert.equal(subscription.event, 'credentials/record-updated');
  assert.equal(account.calls.length, 0, 'attaching must not read');

  // The face the renderer binds is what the panel uses: the hook source plus the
  // refresh action it calls on open.
  const face = registrations[0].options.inject();
  const seen = [];
  face.hooks.balance.subscribe(() => seen.push(face.hooks.balance.getSnapshot().phase));
  await face.refreshBalance();
  assert.deepEqual(account.calls, ['getState', 'getBalance']);
  assert.equal(account.metadata.version, manifest.version);
  assert.equal(account.metadata.locale, 'zh');
  assert.equal(typeof account.metadata.timezoneOffsetSeconds, 'number');
  const snapshot = face.hooks.balance.getSnapshot();
  assert.equal(snapshot.phase, 'ready');
  assert.deepEqual(snapshot.wallets, [{ currency: 'CNY', balance: '110.00' }]);
  assert.deepEqual(snapshot.bonusWallets, [{ currency: 'USD', balance: '0' }]);
  assert.equal(snapshot.links.topUpUrl, 'https://platform.deepseek.com/top_up');
  assert.deepEqual(seen, ['loading', 'ready']);
});

test('the visible copy is translated through the locale namespace', () => {
  // Every literal in the client body should live in the dictionaries rather than
  // in the render tree: count the t('...') keys and require them all to exist.
  const { plugin } = materialize();
  const dictionaries = [];
  const ctx = {
    effect: (callback) => { callback(); return () => {}; },
    inject: (services, callback) => {},
    locale: { register: (namespace, dict) => { dictionaries.push({ namespace, dict }); return () => {}; } },
    slots: { inject: () => {}, register: () => {} },
  };
  plugin.apply(ctx);
  assert.equal(dictionaries.length, 1);
  const keys = new Set(Object.keys(dictionaries[0].dict.zh));
  // Collect every literal handed to the translate seat, including the arms of a
  // ternary, and keep the dotted ones (dictionary keys always have a namespace).
  const used = new Set();
  for (const call of bundleSource.matchAll(/\bt\(([^()]*)\)/g)) {
    for (const literal of call[1].matchAll(/'([^']+)'/g)) {
      if (literal[1].includes('.')) used.add(literal[1]);
    }
  }
  assert.ok(used.size > 12, 'expected the component to use the translate seat');
  for (const key of used) {
    assert.ok(keys.has(key), `t('${key}') has no dictionary entry`);
  }
  for (const key of keys) {
    assert.ok(used.has(key), `dictionary key '${key}' is never used`);
  }
});

test('the manifest matches the patch, the client entry, and the display metadata', () => {
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.dsh.client.immediately, true);
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-sidebar',
  ]);
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.exports['./client'], './client.js');
  assert.equal(manifest.exports['.'], './index.js');

  const patch = readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8');
  assert.match(patch, /-\s*insert:/);
  assert.match(patch, /id:\s*price-tip/);
  assert.ok(patch.includes(`name: '${manifest.name}'`), 'the patch row must name this package');

  for (const locale of ['zh', 'en']) {
    const metadata = JSON.parse(readFileSync(path.join(ROOT, 'locale', `${locale}.json`), 'utf8'));
    assert.equal(typeof metadata.meta.title, 'string');
    assert.ok(metadata.meta.title.length > 0);
    assert.equal(typeof metadata.meta.description, 'string');
    assert.ok(metadata.meta.description.length > 0);
  }

  assert.equal(manifest.icon, './icon.svg');
  const icon = statSync(path.join(ROOT, 'icon.svg'));
  assert.ok(icon.size > 0 && icon.size < 256 * 1024, 'the icon must be under 256 KiB');
  assert.match(readFileSync(path.join(ROOT, 'icon.svg'), 'utf8'), /^<svg[\s>]/);
});

test('the files field ships every runtime artifact and document', () => {
  // A tarball or GitHub install only receives what `files` matches, so a missing
  // entry silently breaks the plugin for everyone who installs it.
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // npm/pnpm `files` semantics: an exact path, a glob, or a bare directory whose
  // whole subtree is included.
  const matchesFilesGlob = (pattern, file) =>
    file === pattern ||
    file.startsWith(`${pattern}/`) ||
    new RegExp(`^${pattern.split('*').map(escape).join('[^/]*')}$`).test(file);
  const shipped = [
    'index.js',
    'client.js',
    'cordis.patch.yml',
    'icon.svg',
    'locale/zh.json',
    'locale/en.json',
    'README.md',
    'README.en.md',
    'docs/development.md',
    'docs/verification.md',
  ];
  for (const file of shipped) {
    assert.ok(
      manifest.files.some((pattern) => matchesFilesGlob(pattern, file)),
      `${file} is not matched by the files field and would be missing from an install`,
    );
    statSync(path.join(ROOT, file));
  }
});

test('every document linked from the README exists', () => {
  // The English edition mirrors the canonical README, so it gets the same link check.
  for (const file of ['README.md', 'README.en.md']) {
    const readme = readFileSync(path.join(ROOT, file), 'utf8');
    const links = [...readme.matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((match) => match[1]);
    assert.ok(links.length >= 3, `${file} should link to the topic documents`);
    for (const target of links) {
      statSync(path.join(ROOT, target));
    }
  }
});

test('the documents stay well-formed', () => {
  const documents = [
    'README.md',
    'README.en.md',
    'docs/development.md',
    'docs/verification.md',
  ];
  for (const file of documents) {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(text, /^# /m, `${file} needs a top-level heading`);
    assert.equal(
      (text.match(/^```/gm) ?? []).length % 2,
      0,
      `${file} has an unbalanced code fence`,
    );
    let columns = null;
    text.split('\n').forEach((line, index) => {
      if (!line.trim().startsWith('|')) {
        columns = null;
        return;
      }
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').length;
      if (columns === null) columns = cells;
      else assert.equal(cells, columns, `${file}:${index + 1} has ${cells} table cells, expected ${columns}`);
    });
  }
});

test('the host half is a valid plugin module', async () => {
  const host = await import('../index.js');
  assert.equal(typeof host.apply, 'function');
});
