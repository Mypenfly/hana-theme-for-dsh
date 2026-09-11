'use strict';
/**
 * A virtual environment the plugin can actually RUN in.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until now every assertion in this repo read either SOURCE TEXT (check.js) or
 * the shipped TABLES (contrast.test.js). Not one line of runtime logic was ever
 * executed — and "the theme fails silently" is precisely a runtime property.
 * The one severe bug in this project's history (§5.7, the four-layer
 * settings-persistence chain) was 100% runtime behaviour, and the lesson drawn
 * from it was "① explicit contract + ② visible durability state + ③ a
 * judgement". Items ① and ② shipped. Item ③ never did.
 *
 * There is a worse trap than having no runtime test, and this harness exists to
 * close it. `test/load-client.js` builds a sandbox with no `document` at all,
 * and `apply()` runs in it *without throwing*: the very first line,
 *
 *     var body = typeof document !== "undefined" && document.body ? document.body : null;
 *
 * makes `body` null and every visual path returns early. So a runtime test
 * written against that sandbox would pass on every assertion while testing
 * nothing. A vacuous test is worse than no test: no test at all leaves you
 * knowing you have not tested, a vacuous one leaves you believing you have.
 *
 * So this module is built to be impossible to run vacuously:
 *
 *   - `document` EXISTS, with real attribute/inline-property state that can be
 *     compared before and after;
 *   - the theme service models the two mechanisms that made §5.7 possible —
 *     the presenter writing tokens as INLINE styles and wiping what it applied
 *     before, and `adopt()` re-reading the persisted built-in preference on
 *     every settings write;
 *   - `assertLive()` is exported, and every suite calls it FIRST, so a harness
 *     that silently degraded to no-ops fails loudly instead of passing.
 *
 * test/selftest.js is the other half: it injects the real historical bugs into
 * a copy of the bundle and asserts this suite catches each one.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE = path.join(__dirname, '..', 'lib', 'client.js');

/**
 * Which bundle to execute.
 *
 * Normally the shipped one. test/selftest.js points HANA_BUNDLE at a copy with
 * a KNOWN BUG injected, and asserts this suite fails — which is the only way to
 * tell a real gate from a vacuous one.
 */
function bundlePath() {
  return process.env.HANA_BUNDLE || BUNDLE;
}

/* ── DOM ───────────────────────────────────────────────────────────────────
 * Only what the plugin actually touches. Everything observable (attributes,
 * inline custom properties, child nodes) is real state, because "leave the
 * document exactly as it was found" is only assertable if there is state to
 * compare.
 */

function createStyle() {
  const props = new Map();
  return {
    setProperty(name, value) {
      props.set(name, String(value));
    },
    getPropertyValue(name) {
      return props.has(name) ? props.get(name) : '';
    },
    removeProperty(name) {
      props.delete(name);
    },
    /** The inline map, for equality assertions. */
    _dump() {
      return Object.fromEntries([...props].sort((a, b) => a[0].localeCompare(b[0])));
    },
  };
}

function createClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    _dump: () => [...set].sort(),
  };
}

function createDocument() {
  const doc = {
    createElement(tag) {
      return createElement(tag, doc);
    },
  };

  const html = createElement('html', doc);
  const head = createElement('head', doc);
  const body = createElement('body', doc);
  doc.documentElement = html;
  doc.head = head;
  doc.body = body;
  html.appendChild(head);
  html.appendChild(body);

  /* The one selector insertCss()'s fallback path uses. Deliberately narrow: a
     fake that answers every selector would hide a real one.
     Attachment is COMPUTED by walking the tree, never tracked in a side list —
     a registry that removeChild forgets to update reports a removed <style> as
     still present, which reads as "detach() leaks the stylesheet" when the
     plugin is in fact correct. */
  doc.querySelectorAll = (selector) => {
    const m = /^style\[data-plugin="(.+)"\]$/.exec(selector);
    if (!m) throw new Error(`the harness DOM cannot evaluate selector: ${selector}`);
    const all = [];
    collect(html, all);
    return all.filter(
      (el) => el.tagName === 'STYLE' && el.getAttribute('data-plugin') === m[1],
    );
  };

  return doc;
}

/** Every element in the subtree, document order. */
function collect(root, out) {
  for (const child of root.children) {
    out.push(child);
    collect(child, out);
  }
  return out;
}

function createElement(tag, doc) {
  const el = {
    tagName: String(tag).toUpperCase(),
    attributes: new Map(),
    children: [],
    parentNode: null,
    style: createStyle(),
    classList: createClassList(),
    textContent: '',
    setAttribute(n, v) {
      el.attributes.set(n, String(v));
    },
    getAttribute(n) {
      return el.attributes.has(n) ? el.attributes.get(n) : null;
    },
    removeAttribute(n) {
      el.attributes.delete(n);
    },
    hasAttribute(n) {
      return el.attributes.has(n);
    },
    appendChild(child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    removeChild(child) {
      const i = el.children.indexOf(child);
      if (i >= 0) el.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    /**
     * Element-level querySelectorAll, scoped to this element's subtree.
     *
     * This is NOT optional. insertCss()'s fallback path calls
     * `head.querySelectorAll(STYLE_TOKEN)`, and a DOM that only answers on
     * `document` makes that throw — inside reconcile(), inside a listener that
     * the plugin deliberately wraps in try/catch. The stylesheet silently never
     * mounts and the only evidence is an empty style-tag list. That is the same
     * shape as every bug this project is built against, and it is why
     * assertLive() drives the plugin for real instead of probing for methods.
     */
    querySelectorAll(selector) {
      if (!doc) return [];
      const matches = doc.querySelectorAll(selector);
      return matches.filter((node) => {
        let p = node.parentNode;
        while (p) {
          if (p === el) return true;
          p = p.parentNode;
        }
        return false;
      });
    },
    /** Every attribute, sorted — the comparable state for reversibility. */
    _attrs() {
      return Object.fromEntries([...el.attributes].sort((a, b) => a[0].localeCompare(b[0])));
    },
  };
  return el;
}

/* ── the theme service ─────────────────────────────────────────────────────
 * Models dsh-client-ui-theme's ThemeRuntime plus the presenter in ui-layout.
 *
 * The two behaviours that matter, both quoted from the installed bundle:
 *
 *   1. ThemePresenter.apply() removes every token it previously applied and
 *      then applies the new active theme's. The built-in pair carry
 *      `tokens: {}`, so selecting a built-in wipes the inline tokens while
 *      leaving any stylesheet — and therefore any typography — untouched.
 *
 *   2. adopt() assigns `this.preference = section.preference` unconditionally,
 *      and runs on EVERY settings update. The persisted preference can only
 *      ever be a built-in id, so a third-party theme is knocked out every time
 *      ANY setting is written, including the plugin's own.
 *
 * Both are reproduced here rather than stubbed, because §5.7 is exactly what
 * happens when they meet, and a stub would make its regression test vacuous.
 */

const BUILT_IN_PREFERENCES = new Set(['light', 'dark', 'system']);

function createThemeService(body, { systemDark = false } = {}) {
  const themes = new Map(); // id -> { id, colorScheme, tokens }
  const overrides = new Map(); // source -> { seq, modes }
  const events = [];
  let seq = 0;
  let preference = 'light';
  let persisted = 'light'; // what settings.yaml holds; only ever a built-in
  let revision = 0;
  let appliedTokens = [];

  /* Built-ins exist and carry NO tokens — the fact the whole colour strategy
     is built around. */
  for (const id of ['light', 'dark']) {
    themes.set(id, { id, colorScheme: id, tokens: {} });
  }

  const listeners = [];

  function resolveActiveId() {
    if (preference === 'system') return systemDark ? 'dark' : 'light';
    return preference;
  }

  /* composeActive(): fold override layers onto the active definition, later
     layers winning per token, each value picked for the active colorScheme. */
  function composeActive() {
    const active = themes.get(resolveActiveId());
    if (!active) return { id: resolveActiveId(), colorScheme: 'light', tokens: {} };
    if (overrides.size === 0) return active;
    const ordered = [...overrides.values()].sort((a, b) => a.seq - b.seq);
    const tokens = { ...active.tokens };
    for (const layer of ordered) {
      for (const [name, modes] of Object.entries(layer.modes)) {
        tokens[name] = active.colorScheme === 'dark' ? modes.dark : modes.light;
      }
    }
    return { id: active.id, colorScheme: active.colorScheme, tokens };
  }

  /* The presenter: wipe what was applied, then write the composed tokens as
     INLINE styles on <body>. */
  function present() {
    const composed = composeActive();
    for (const name of appliedTokens) body.style.removeProperty(name);
    appliedTokens = Object.keys(composed.tokens);
    for (const name of appliedTokens) body.style.setProperty(name, composed.tokens[name]);
    /* The presenter switches this from colorScheme, never from the id. */
    if (composed.colorScheme === 'dark') body.setAttribute('data-ds-dark-theme', '');
    else body.removeAttribute('data-ds-dark-theme');
  }

  function publish(reason) {
    revision += 1;
    present();
    events.push({ reason, revision, preference, active: resolveActiveId() });
    for (const fn of [...listeners]) fn(service.getTheme());
  }

  const service = {
    getTheme() {
      const composed = composeActive();
      return {
        preference,
        fontSize: 17,
        active: { id: composed.id, colorScheme: composed.colorScheme, tokens: composed.tokens },
        themes: [...themes.values()],
        revision,
      };
    },

    register(definition) {
      if (themes.has(definition.id)) {
        throw new Error(`duplicate theme id: ${definition.id}`);
      }
      themes.set(definition.id, { ...definition });
      publish('register');
      let done = false;
      return () => {
        if (done) return;
        done = true;
        themes.delete(definition.id);
        if (preference === definition.id) preference = persisted;
        publish('unregister');
      };
    },

    overrideTokens(source, modes) {
      /* Validated at runtime in the real service: a bare string throws. */
      for (const [name, value] of Object.entries(modes)) {
        if (typeof value === 'string' || !value || typeof value.light !== 'string' || typeof value.dark !== 'string') {
          throw new Error(`overrideTokens expects { light, dark } for ${name}`);
        }
      }
      seq += 1;
      overrides.set(source, { seq, modes });
      publish('override');
      let live = true;
      return () => {
        if (!live) return;
        live = false;
        // A newer layer for the same source supersedes this disposer.
        if (overrides.get(source) && overrides.get(source).seq !== seq) return;
        overrides.delete(source);
        publish('unoverride');
      };
    },

    /** setTheme: a built-in is persisted, a third-party id is memory-only. */
    setTheme(id) {
      if (!themes.has(id) && !BUILT_IN_PREFERENCES.has(id)) {
        throw new Error(`unknown theme: ${id}`);
      }
      preference = id;
      if (BUILT_IN_PREFERENCES.has(id)) persisted = id;
      publish('setTheme');
    },

    /** The settings document was updated; adopt() re-reads the persisted value. */
    settingsWritten() {
      const before = preference;
      preference = persisted;
      if (before !== preference || true) publish('adopt');
    },

    on(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    /** Test-side introspection. */
    _events: events,
    _overrides: overrides,
    _setSystemDark(v) {
      systemDark = v;
      if (preference === 'system') publish('system-flip');
    },
  };

  return service;
}

/* ── the settings scope ────────────────────────────────────────────────────
 * Models the three-condition gate the plugin documents:
 *
 *     snap.mode === 'host' && snap.status === 'ready' && writable === true
 *
 * and the failure that makes checking `writable` alone wrong: a host-mode
 * describe view answers writable=true while THIS namespace is still unserved
 * (status 'unavailable'), so the write reaches no durable store, the dirty mark
 * is cleared, and the setting vanishes on reload.
 */

function createSettingsScope({ durable = true } = {}) {
  const store = {};
  const writes = [];
  const listeners = [];
  let ready = durable;

  const scope = {
    getSnapshot() {
      return {
        mode: 'host',
        status: ready ? 'ready' : 'unavailable',
        writable: true, // true even when unserved — the trap
        value: { ...store },
      };
    },
    set(name, value) {
      if (!ready) {
        // The real path: accepted, resolves, and lands nowhere durable.
        return Promise.resolve();
      }
      store[name] = String(value);
      writes.push([name, String(value)]);
      for (const fn of [...listeners]) fn();
      return Promise.resolve();
    },
    subscribe(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };

  return {
    binder: {
      /** bind() takes a SPEC OBJECT; the harness records how it was called. */
      bind(spec) {
        if (typeof spec === 'string' || !spec || typeof spec.namespace !== 'string') {
          throw new Error('bind() requires { namespace }');
        }
        return scope;
      },
    },
    scope,
    store,
    writes,
    goReady() {
      ready = true;
      for (const fn of [...listeners]) fn();
    },
    _ready: () => ready,
  };
}

/* ── React ─────────────────────────────────────────────────────────────────
 * A recording stub. useState returns the initial value; createElement captures
 * the real element tree, which is all a settings panel needs.
 */
function createReact() {
  return {
    useState(init) {
      const value = typeof init === 'function' ? init() : init;
      return [value, () => {}];
    },
    useEffect() {},
    createElement(type, props, ...children) {
      const kids = [];
      const flat = (c) => {
        if (Array.isArray(c)) c.forEach(flat);
        else if (c !== null && c !== undefined && c !== false) kids.push(c);
      };
      children.forEach(flat);
      return { type, props: props || {}, children: kids };
    },
  };
}

/* ── the environment ─────────────────────────────────────────────────────── */

/**
 * Build a runnable environment and load the REAL bundle into it.
 *
 * @param {object} [options]
 * @param {boolean} [options.durable] settings scope starts durably served
 * @param {boolean} [options.withSlots] provide a `slots` service
 * @param {boolean} [options.withStyles] provide the dynamic runner's `styles`
 * @returns the environment, with `apply` ready to call
 */
function createEnvironment(options = {}) {
  const {
    durable = true,
    withSlots = true,
    withStyles = false,
  } = options;

  const document = createDocument();
  const theme = createThemeService(document.body);
  const settings = createSettingsScope({ durable });
  const React = createReact();

  const slotRegistrations = [];
  const slots = {
    inject(name, fn) {
      return fn();
    },
    register(spec, component) {
      slotRegistrations.push({ spec, component });
      const dispose = () => {
        const i = slotRegistrations.findIndex((r) => r.spec === spec);
        if (i >= 0) slotRegistrations.splice(i, 1);
      };
      return dispose;
    },
  };

  const effects = [];
  const timers = [];
  const themeListeners = [];
  const injectedSpecs = [];

  let stylesInserted = [];
  const styles = withStyles
    ? {
        insert(css) {
          stylesInserted.push(css);
          return () => {
            stylesInserted = stylesInserted.filter((c) => c !== css);
          };
        },
      }
    : undefined;

  const ctx = {
    get(name) {
      if (name === 'theme') return theme;
      if (name === 'settingsScope') return settings.binder;
      if (name === 'slots') return withSlots ? slots : undefined;
      return undefined;
    },
    on(event, fn) {
      if (event !== 'theme/change') throw new Error(`unexpected event: ${event}`);
      themeListeners.push(fn);
      return () => {
        const i = themeListeners.indexOf(fn);
        if (i >= 0) themeListeners.splice(i, 1);
      };
    },
    inject(spec, fn) {
      injectedSpecs.push(spec);
      // The settings service is already settled in this environment.
      if (spec.includes('settings')) {
        fn({ settings: { register: (...args) => registerSettings(...args) } });
      }
      return () => {};
    },
    effect(setup, label) {
      const disposer = typeof setup === 'function' ? setup() : undefined;
      effects.push({ disposer, label });
      return () => {};
    },
  };

  const settingsRegistrations = [];
  function registerSettings(...args) {
    settingsRegistrations.push(args);
  }

  /* Timers are captured, not fired: the deferred re-apply
     (setTimeout(..., 0)) is an ORDERING guarantee, and proving it requires
     control over when it runs rather than hoping. */
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout(fn, ms) {
      const handle = { fn, ms, cleared: false };
      timers.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      if (handle) handle.cleared = true;
      const i = timers.indexOf(handle);
      if (i >= 0) timers.splice(i, 1);
    },
    document,
    React,
    window: {
      __ModuleLoader__: {
        load(entry) {
          if (captured) throw new Error('client.js registered the module twice');
          captured = entry;
        },
      },
    },
  };
  if (styles) sandbox.styles = styles;
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;

  let captured = null;
  const source = fs.readFileSync(bundlePath(), 'utf8');
  const context = vm.createContext(sandbox);
  new vm.Script(source, { filename: bundlePath() }).runInContext(context);
  if (!captured) throw new Error('client.js did not call window.__ModuleLoader__.load');

  const client = captured.factory((name) => {
    if (name === 'react') return React;
    throw new Error(`client.js required("${name}")`);
  });

  /* The theme service must reach the plugin's listener the way the real one
     does: publish() calls every subscriber synchronously. */
  theme.on((snapshot) => {
    for (const fn of [...themeListeners]) fn(snapshot);
  });

  const env = {
    client,
    ctx,
    document,
    theme,
    settings,
    slots,
    slotRegistrations,
    settingsRegistrations,
    injectedSpecs,
    effects,
    timers,
    get styles() {
      return stylesInserted;
    },
    React,

    apply() {
      client.apply(ctx);
      return env;
    },

    /** Run every pending deferred callback, oldest first. */
    flushTimers() {
      let guard = 0;
      while (timers.length && guard < 100) {
        guard += 1;
        const t = timers.shift();
        if (!t.cleared) t.fn();
      }
      return env;
    },

    /** Drive the settings scope's async bind retry. */
    flushBind() {
      return env.flushTimers();
    },

    /** Everything observable about the document, for equality assertions. */
    snapshot() {
      return {
        bodyAttrs: document.body._attrs(),
        bodyClasses: document.body.classList._dump(),
        bodyInline: document.body.style._dump(),
        styleTags: document
          .querySelectorAll('style[data-plugin="hana-theme-for-dsh"]')
          .map((el) => ({ plugin: el.getAttribute('data-plugin'), length: el.textContent.length })),
      };
    },

    /** Call the registered ctx.effect disposers — i.e. unload the plugin. */
    dispose() {
      for (const { disposer } of [...effects].reverse()) {
        if (typeof disposer === 'function') disposer();
      }
      env.flushTimers();
      return env;
    },
  };

  /* B1's whole point: a sandbox that silently degraded to no-ops must fail
     loudly rather than pass. So this drives the plugin for real — apply it,
     claim a palette through the actual settings panel, and assert the
     observables appeared. Probing for methods is not enough: the harness can
     have every method it needs and still let the plugin fail silently (see the
     note on element-level querySelectorAll).
     Memoised, and run against a THROWAWAY environment so the caller's stays
     pristine. */
  let liveChecked = false;
  env.assertLive = function assertLive() {
    if (liveChecked) return true;

    const problems = [];
    if (!document.body) problems.push('document.body is missing');
    if (!document.head || typeof document.head.querySelectorAll !== 'function') {
      problems.push('document.head.querySelectorAll is missing (insertCss needs it)');
    }
    if (typeof document.createElement !== 'function') problems.push('document.createElement is missing');
    if (typeof theme.register !== 'function') problems.push('the theme service is missing register()');
    if (typeof theme.overrideTokens !== 'function') problems.push('the theme service is missing overrideTokens()');
    if (typeof settings.binder.bind !== 'function') problems.push('the settings binder is missing bind()');
    if (typeof React.createElement !== 'function') problems.push('the React stub is missing createElement()');
    if (problems.length) {
      throw new Error(
        'the runtime harness is not live, so every assertion below would be vacuous:\n  - ' +
          problems.join('\n  - '),
      );
    }

    /* The behavioural half: prove the plugin can actually be observed doing its
       job. If any of these fail, the sandbox is letting reconcile() exit early
       and every test in this suite would pass while testing nothing. */
    const probe = createEnvironment(options);
    probe.apply();
    const before = probe.snapshot();
    if (Object.keys(before.bodyAttrs).length !== 0 || before.styleTags.length !== 0) {
      throw new Error('the harness is not live: the plugin contributed to a document with no palette claimed');
    }
    probe.claimPalette('hana-paper');
    const after = probe.snapshot();
    const shiki = Object.keys(after.bodyInline).filter((k) => k.startsWith('--shiki-'));
    const observed = [
      [after.bodyAttrs['data-hana-theme'] === 'paper', 'data-hana-theme was not set after claiming a palette'],
      [after.styleTags.length === 1, `expected 1 mounted stylesheet, saw ${after.styleTags.length}`],
      [shiki.length === 11, `expected 11 inline syntax properties, saw ${shiki.length}`],
      [Object.keys(after.bodyInline).length >= 100, `expected the palette + syntax layer inline, saw ${Object.keys(after.bodyInline).length} properties`],
      [probe.theme._overrides.size === 1, 'the palette override layer was not created'],
    ];
    const failed = observed.filter(([ok]) => !ok).map(([, why]) => why);
    if (failed.length) {
      throw new Error(
        'the runtime harness cannot observe the plugin working, so every assertion in this suite ' +
          'would be vacuous:\n  - ' + failed.join('\n  - '),
      );
    }

    liveChecked = true;
    return true;
  };

  /** Render the settings panel the plugin registered, as a React tree. */
  env.renderSettings = function renderSettings() {
    const seat = slotRegistrations.find((r) => r.spec && r.spec.name === 'settings.section');
    if (!seat) throw new Error('the plugin registered no settings.section seat');
    return seat.component();
  };

  /** Every element in a tree that carries an onClick, with its text. */
  env.buttons = function buttons(tree) {
    const out = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.props && typeof node.props.onClick === 'function') {
        out.push({ node, text: textOf(node) });
      }
      for (const child of node.children || []) walk(child);
    };
    walk(tree);
    return out;
  };

  /** Click the named control in the real settings panel. */
  env.clickButton = function clickButton(label) {
    const found = env.buttons(env.renderSettings()).find((b) => b.text === label);
    if (!found) {
      const available = env.buttons(env.renderSettings()).map((b) => b.text);
      throw new Error(`no settings control labelled "${label}"; available: ${available.join(', ')}`);
    }
    found.node.props.onClick();
    env.flushTimers();
    return env;
  };

  /** What a user does to activate the theme: click a palette in the panel. */
  env.claimPalette = function claimPalette(paletteId) {
    const def = (client.PALETTES || []).find((p) => p.id === paletteId);
    if (!def) throw new Error(`unknown palette: ${paletteId}`);
    return env.clickButton(def.name);
  };

  /** All the text the settings panel currently renders. */
  env.panelText = function panelText() {
    return textOf(env.renderSettings());
  };

  /** Every form control in the panel, keyed by its aria-label. */
  env.controls = function controls() {
    const out = new Map();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'input' && node.props && node.props['aria-label']) {
        out.set(node.props['aria-label'], node);
      }
      for (const c of node.children || []) walk(c);
    };
    walk(env.renderSettings());
    return out;
  };

  /** Flip a checkbox the way a user does. */
  env.toggle = function toggle(ariaLabel) {
    const control = env.controls().get(ariaLabel);
    if (!control) {
      throw new Error(
        `no control labelled "${ariaLabel}"; panel has: ${[...env.controls().keys()].join(', ')}`,
      );
    }
    control.props.onChange();
    env.flushTimers();
    return env;
  };

  /** Drag a range slider the way a user does. */
  env.setRange = function setRange(ariaLabel, value) {
    const control = env.controls().get(ariaLabel);
    if (!control) {
      throw new Error(
        `no control labelled "${ariaLabel}"; panel has: ${[...env.controls().keys()].join(', ')}`,
      );
    }
    control.props.onChange({ target: { value: String(value) } });
    env.flushTimers();
    return env;
  };

  return env;
}

/** Depth-first concatenation of the string children in an element tree. */
function textOf(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children || []).map(textOf).join('');
}

module.exports = {
  createEnvironment,
  createDocument,
  createThemeService,
  createSettingsScope,
  createReact,
  BUNDLE,
};
