'use strict';
/**
 * Static gates — the failures that no runtime test can catch.
 *
 * Each judgement below exists because its violation is silent. A stray
 * character in a stylesheet does not throw: it makes the browser drop one rule
 * and carry on, which reads as "the theme mostly works" rather than as a bug.
 * A token misspelled in a table produces no error at all. A side effect that is
 * never reversed looks fine until the plugin is stopped or updated.
 *
 * The harness's own component sources were read to derive these rules; where a
 * rule encodes a specific measured behaviour, the comment says which.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { loadClient, readCss, stripComments } = require('./load-client');

const ROOT = path.join(__dirname, '..');
const allowlist = JSON.parse(fs.readFileSync(path.join(__dirname, 'token-allowlist.json'), 'utf8'));
const allowedColourTokens = new Set(allowlist.tokens);

const { exports: client, source } = loadClient();
const css = readCss(client);
const bare = stripComments(css);

const failures = [];
let assertions = 0;
const check = (ok, message) => {
  assertions += 1;
  if (!ok) failures.push(message);
};

/* ── stylesheet hygiene ─────────────────────────────────────────────────── */

/* 1 — a backtick inside the stylesheet. The bundle builds its CSS by joining
   string literals, so a backtick is not a syntax error here; it would instead
   travel into the browser and, in any consumer that later wraps this sheet in a
   template literal, terminate the string early. */
check(!css.includes('`'), 'CSS contains a backtick');

/* 2 — `${` in a stylesheet is template-interpolation syntax, never CSS. In this
   bundle it cannot interpolate, so it would reach the browser verbatim and kill
   the enclosing rule. */
check(!css.includes('${'), 'CSS contains "${" (template interpolation in a stylesheet)');

/* 3 — comment balance. An early closing marker ends the comment but leaves the
   comment text itself balanced, so the damage is the residue that follows:
   stray words glued onto a selector, which discards the whole rule. Neither a
   parser nor a brace count detects it — and this very file originally tripped
   over it, by spelling the closing marker out inside this sentence. */
const openComments = (css.match(/\/\*/g) || []).length;
const closeComments = (css.match(/\*\//g) || []).length;
check(
  openComments === closeComments,
  `CSS comment markers are unbalanced: ${openComments} opening vs ${closeComments} closing`,
);

/* 4 — brace balance, measured outside comments. */
const opens = (bare.match(/\{/g) || []).length;
const closes = (bare.match(/\}/g) || []).length;
check(opens === closes, `CSS braces are unbalanced: ${opens} "{" vs ${closes} "}"`);

/* 5 — hash-based selectors. DSH class names are build artefacts and their
   hashes change between releases; several prefixes documented in the research
   no longer exist on 2.0.5 at all. This theme must therefore stand only on
   tokens, deliberately-global hooks (md-code-block, md-table-wide) and data-*
   attributes. A hash selector is a silent break at the next upgrade. */
const hashSelector = /\._?[A-Za-z0-9-]*_[A-Za-z0-9]+/g;
const hashHits = [...new Set((bare.match(hashSelector) || []))];
check(hashHits.length === 0, `CSS uses hash-shaped class selectors: ${hashHits.join(', ')}`);
check(!/\[class[\^*]?=/.test(bare), 'CSS uses an attribute-substring class selector ([class*=...])');

/* 6 — nothing may be declared on :root. A custom property declared on :root
   whose value references a variable that is only defined on `body` computes to
   the guaranteed-invalid value, and every declaration that consumes it is
   dropped. Declaring on body removes the hazard rather than documenting it. */
check(!/:root/.test(bare), 'CSS declares on :root; structural variables must live on body');

/* 7 — the colour layer must not leak into the stylesheet. Registered colour
   tokens are applied by DSH as INLINE styles on <body>, and inline beats any
   rule. A palette declared here would look correct in isolation and be
   silently overridden the moment any other token-writing plugin is installed. */
const declared = [...bare.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map((m) => m[1]);
const declaredColours = [...new Set(declared.filter((n) => allowedColourTokens.has(n)))];
check(
  declaredColours.length === 0,
  `CSS declares registered colour tokens (must go through theme.register instead): ${declaredColours.join(', ')}`,
);

/* 8 — every rule must be scoped to a hana theme. An unscoped rule would apply
   to the built-in themes too, which is exactly the "installed a theme and it
   repainted my UI" failure this plugin is built to avoid.
 *
 * A rule may narrow the scope to ONE palette as well (body[data-hana-theme='coral']),
 * which is a narrowing rather than an escape -- but only if the value it names is
 * a palette this plugin actually ships. The first version tested the literal
 * prefix `body[data-hana-theme]`, and that is a proxy for "scoped" rather than the
 * thing itself: it rejected a correct palette-keyed rule while cheerfully
 * accepting `body[data-hana-theme='no-such-palette']`. It now resolves the value
 * against the shipped palette ids, so a typo is caught instead of waved through. */
const paletteAttrs = new Set(client.PALETTES.map((p) => p.id.replace('hana-', '')));
const scopedToHana = (s) => {
  if (s.startsWith('body[data-hana-theme]')) return true;
  const m = /^body\[data-hana-theme='([^']*)'\]/.exec(s);
  return m !== null && paletteAttrs.has(m[1]);
};
const selectors = [...bare.matchAll(/(^|\})([^{}]+)\{/g)]
  .map((m) => m[2].trim())
  .filter((s) => s && !s.startsWith('@'))
  .flatMap((s) => s.split(',').map((part) => part.trim()));
const unscoped = selectors.filter((s) => s && !scopedToHana(s));
check(unscoped.length === 0, `CSS has rules not scoped to body[data-hana-theme]: ${unscoped.join(' | ')}`);
check(
  paletteAttrs.size === 4 && [...paletteAttrs].every((v) => /^[a-z-]+$/.test(v)),
  `the scoping check derived ${paletteAttrs.size} palette attribute value(s) from PALETTES ` +
    `(${[...paletteAttrs].join(', ')}); with none, a palette-keyed rule would be checked against nothing`,
);

/* 9 — `!important` would mean fighting the cascade instead of out-specifying it,
   and it also beats the user's own overrides. Phase 2's radius work is designed
   to win on specificity, so this staying empty is a design signal. */
check(!bare.includes('!important'), 'CSS uses !important; win on specificity instead');

/* 14 — every --hana-* token must actually be read somewhere in the sheet.
   HanaAgent ships five dead tokens (--user-bg is defined by all eleven of its
   themes and consumed by none), which is precisely how a token list rots: it
   looks deliberate, it is documented, and deleting it takes courage because
   nobody knows whether something out of tree reads it. Keeping the set at
   exactly what is used removes the question. */
const hanaDeclared = [...new Set(declared.filter((n) => n.startsWith('--hana-')))];
const deadHana = hanaDeclared.filter(
  (n) => (bare.match(new RegExp('var\\(\\s*' + n + '\\s*[,)]', 'g')) || []).length === 0,
);
check(
  deadHana.length === 0,
  `dead --hana-* tokens (declared but never read): ${deadHana.join(', ')}`,
);

/* 15 — markdown rules must target DESCENDANTS of the flow-kind anchor, never the
   anchor element itself. Measured on the live page: 72 assistant-step elements
   exist and only 51 contain markdown -- the other 21 are step labels. A rule on
   the container would style those markers too, which is invisible in a short
   conversation and obvious in a long one. */
const anchorOnly = selectors.filter((s) => /\[data-chat-flow-kind='assistant-step'\]$/.test(s.trim()));
check(
  anchorOnly.length === 0,
  'a rule targets the flow-kind container itself, so it would also style the 21 markdown-free step labels: ' +
    anchorOnly.join(' | '),
);

/* 16 — never pin a build-hash class name. The markdown root is `_markdown_177e0_5`
   and the step element is `V0s2hW_flowItem` on this build; both change between
   releases. Judgement 5 catches a hash used as a class selector, but a hash
   spelled inside an attribute value would slip past it. */
const pinnedHash = /[A-Za-z0-9]+_[A-Za-z0-9]{4,}_\d+/.exec(bare);
check(
  pinnedHash === null,
  `CSS pins a build-hash name (${pinnedHash ? pinnedHash[0] : ''}) — it will break on the next harness release`,
);

/* 18 — settingsScope.bind() must be called with a SPEC OBJECT.
 *
 * The real signature is bind({ namespace, decode? }); a bare string leaves
 * spec.namespace and spec.decode undefined, so the bound scope matches no
 * describe row (status stays 'unavailable' for EVERY namespace) and every write
 * is issued against remote.settings.mutate(undefined, ...). Both failures are
 * silent: the switch looks like it works, applies in memory, and is gone on the
 * next boot. This cost a full debugging session, so it is a build gate now. */
const bindCalls = [...source.matchAll(/bind\(\s*([^)]*)/g)].map((m) => m[1].trim());
const stringBinds = bindCalls.filter((arg) => /^["']/.test(arg));
check(
  stringBinds.length === 0,
  `settingsScope.bind() called with a bare string (${stringBinds.join(' | ')}) — it needs { namespace: ... }`,
);
const hasSpecBind = bindCalls.some((arg) => /^\{[^}]*namespace\s*:/.test(arg));
check(hasSpecBind, 'no settingsScope.bind({ namespace: ... }) call found; settings would never persist');

/* 19 — the remembered palette may be cleared in exactly ONE place.
 *
 * DSH re-adopts `settings.theme.preference` from the settings document on every
 * update, and it can only ever hold a built-in id -- so a hana palette is knocked
 * out every time ANY setting is written, including this plugin's own. The first
 * version cleared the remembered palette when it saw that revert, on the theory
 * that a revert meant the user had chosen a built-in theme. It cannot mean that:
 * a revert and a deliberate choice produce the same event. The result was that
 * the first write wiped the only durable copy of the user's selection and the
 * palette became unselectable for the rest of the session.
 *
 * So: clearing is allowed only from the explicit 「跟随 DSH」 control, and the
 * restore path must re-apply instead of forgetting. */
const paletteClears = [...source.matchAll(/prefs\.set\(\s*["']palette["']\s*,\s*["']["']\s*\)/g)].length;
check(
  paletteClears === 1,
  `the remembered palette is cleared in ${paletteClears} place(s); it must be exactly 1 (the 「跟随 DSH」 control) — ` +
    'clearing anywhere else destroys the only durable copy when DSH re-adopts its own preference',
);
check(
  /function ensurePaletteApplied\(/.test(source),
  'no ensurePaletteApplied() path exists, so a palette knocked out by DSH re-adopting its preference would never come back',
);
check(
  /function scheduleEnsurePalette\(/.test(source),
  'the palette re-apply is not deferred; it must run after the whole theme/change emit (see judgement 20)',
);

/* 20 — the theme/change listener must not call theme.setTheme() synchronously.
 *
 * publish() emits synchronously. A re-entrant setTheme from inside the listener
 * therefore runs the presenter with OUR snapshot first, and then -- when the
 * outer emit resumes -- the presenter runs again with the STALE built-in
 * snapshot, applies its empty token map and removes the tokens just restored.
 * The result is the worst kind of state: the theme service reports our palette
 * as active, this plugin's stylesheet is still applied (so typography stays),
 * and every colour has silently reverted. Deferring past the emit is the only
 * ordering that survives. */
const themeChangeArgs = callArgs(source, 'ctx.on("theme/change"');
check(
  themeChangeArgs !== null,
  'no ctx.on("theme/change") listener found; the palette could never be restored',
);
if (themeChangeArgs !== null) {
  check(
    !/theme\.setTheme\(/.test(themeChangeArgs),
    'the theme/change listener calls theme.setTheme() synchronously — the stale outer emit will wipe the tokens it restores',
  );
}

/* 21 — the palette must ride an override LAYER, not only a registration.
 *
 * dsh-client-ui-theme's composeActive() folds every override layer onto whatever
 * theme is active, so a layer survives `adopt()` re-reading
 * settings.theme.preference -- which can only ever hold a built-in id -- on every
 * settings write and at every boot. Registering alone cannot: the presenter
 * removes each token it previously applied and then applies the new active
 * theme's, and the built-in pair carry no tokens at all. Re-calling setTheme()
 * from the theme/change listener does not fix it either (judgement 20).
 *
 * This mirrors dsh-theme-endfield, which layers its palette the same way. The
 * original design rejected overrideTokens for fear of repainting built-in
 * themes; that property is exactly what makes it durable, and it is gated here
 * on a palette actually being remembered. */
check(
  /theme\.overrideTokens\(/.test(source),
  'the palette is never applied as an override layer, so DSH re-adopting its persisted built-in preference will wipe it',
);
check(
  /var overrideDispose = null;/.test(source),
  'the override layer has no retained disposer; it could not be released on unload or replaced on a palette change',
);

/* 22 — re-layering the override must be idempotent.
 *
 * theme.overrideTokens() emits theme/change, and reconcile() is a theme/change
 * listener, so an unguarded applyOverride() recurses: reconcile -> override ->
 * emit -> reconcile. A guard on the palette identity makes it a no-op unless the
 * choice actually changed. */
check(
  /var overrideFor = null;/.test(source) && /if \(wanted === overrideFor\) return;/.test(source),
  'applyOverride() is not guarded by the palette it was built from — overrideTokens() emits theme/change, so it would recurse through reconcile()',
);

/* 23 — the panel's active marker must reflect the remembered palette, not
 * theme.preference. DSH re-adopts its own built-in preference on every settings
 * write and at every boot, so a marker keyed to the preference lights on click
 * and disappears on the next restart. */
check(
  /buttonStyle\(storedPalette\(\) === def\.id\)/.test(source),
  'the palette marker is not keyed to the remembered palette; it will vanish whenever DSH re-adopts its own preference',
);

/* ── bundle hygiene ─────────────────────────────────────────────────────── */

/* 10 — the client half must never call localStorage.
 *
 * DSH Desktop serves the UI on a fixed loopback port (43120) and only moves to
 * the next port on a real bind collision, so the origin is normally stable --
 * an earlier note here claimed a random port per launch, and that was wrong.
 * The rule stands anyway: an origin-scoped store is lost the moment the port
 * does move, it is invisible to the Host half, and it does not follow the user
 * across profiles. Settings go through the host namespace. */
check(
  !/\blocalStorage\b/.test(source),
  'client.js references localStorage (origin-scoped: lost whenever the loopback port moves, and invisible to the Host half)',
);

/* 11 — the bundle must compile and register exactly one module. */
let compiled = true;
try {
  new vm.Script(source, { filename: 'lib/client.js' });
} catch (e) {
  compiled = false;
}
check(compiled, 'lib/client.js does not compile as a script');
check(
  client.name === JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name,
  'the module name exported by client.js does not match package.json "name"',
);

/* ── lifecycle reversibility ────────────────────────────────────────────── */

/** Extract the argument text of a call, balancing parentheses. */
function callArgs(text, callee) {
  const at = text.indexOf(callee);
  if (at < 0) return null;
  let depth = 0;
  let start = -1;
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') {
      depth += 1;
      if (start < 0) start = i + 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i);
    }
  }
  return null;
}

/** Extract a function's brace-delimited body, given its signature text. */
function functionBody(text, signature) {
  const at = text.indexOf(signature);
  if (at < 0) return null;
  const open = text.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

/* 12 — one disposer must reverse every side effect apply() registers:
   stylesheet, body attribute, serif class, reading-size factor, theme
   registrations, the theme subscription and the settings binding.

   The chain is followed one level rather than matched literally: apply()
   delegates to detach()/unmount()/unregisterThemes(), so checking only the
   disposer's own text would either fail a correctly factored teardown or pass
   a detach() that does nothing. Each link is asserted where it belongs. */
const effectBody = callArgs(source, 'ctx.effect(');
check(effectBody !== null, 'apply() never calls ctx.effect(...) — nothing would be reclaimed on unload');

const detachBody = functionBody(source, 'function detach(');
const unmountBody = functionBody(source, 'function unmount(');
const unregisterBody = functionBody(source, 'function unregisterThemes(');

if (effectBody) {
  /* The disposer itself must reach every teardown helper. */
  for (const [needle, what] of [
    ['prefs.dispose()', 'the settings subscription'],
    ['offTheme', 'the theme/change subscription'],
    ['detach()', 'the document-level state'],
    ['overrideDispose', 'the palette override layer'],
    ['unregisterThemes()', 'the theme registrations'],
  ]) {
    check(effectBody.includes(needle), `the ctx.effect disposer does not release ${what} (missing \`${needle}\`)`);
  }
}

/* detach() is the single definition of "leave the document as found" — every
   "not ours" path funnels through it, so it is the one place that must be
   complete. */
check(detachBody !== null, 'apply() has no detach() helper; the teardown is not centralised');
if (detachBody) {
  for (const [needle, what] of [
    ['unmount()', 'the stylesheet'],
    ['removeAttribute(BODY_ATTR)', 'the body attribute'],
    ['classList.remove(SERIF_CLASS)', 'the serif class'],
    ['removeProperty(SERIF_SCALE_VAR)', 'the inline reading-size factor'],
    ['removeAttribute(TEXTURE_ATTR)', 'the paper-texture attribute'],
    ['removeAttribute(SHAPE_ATTR)', 'the radii attribute'],
    ['removeProperty(GRAIN_VAR)', 'the inline grain intensity'],
    ['clearShiki()', 'the inline syntax palette'],
    ['clearBrandMark()', 'the sidebar seal registration'],
  ]) {
    check(detachBody.includes(needle), `detach() does not release ${what} (missing \`${needle}\`)`);
  }
}

check(
  unmountBody !== null && unmountBody.includes('styleTeardown()'),
  'unmount() does not call the stylesheet teardown returned by insertCss()',
);
check(
  unregisterBody !== null && unregisterBody.includes('themeDisposers['),
  'unregisterThemes() does not invoke the disposers returned by theme.register()',
);
const mountBody = functionBody(source, 'function mount(');
check(mountBody !== null && mountBody.includes('insertCss(CSS)'), 'mount() does not call insertCss(CSS)');
check(
  (source.match(/insertCss\(/g) || []).length === 2,
  'insertCss() should be called from exactly one place (its definition plus mount()); ' +
    `found ${(source.match(/insertCss\(/g) || []).length} occurrences`,
);

/* 26 — the syntax palette must be applied on the palette path, and released on
 * the detach path.
 *
 * --shiki-* is a second colour channel: it is NOT one of the 89 registered
 * tokens, so the theme service never writes it and the L1b tables are the only
 * thing that can. Two ways to lose it, and neither is visible:
 *
 *   - never applied  -> the harness keeps its own colours, which follow the
 *     active colorScheme while hana's code SURFACE follows the chosen palette;
 *     measured in-engine that mismatch put 4 of 5 exercised token colours below
 *     AA in three palettes, and 5 of 5 below AA in the window where a dark
 *     palette is painted before the preference is pinned.
 *   - never released -> a detached theme leaves eleven inline custom properties
 *     on <body>, so the next theme's code blocks keep hana's syntax colours.
 */
/* 28 — the slot service must be resolved BEFORE reconcile() runs.
 *
 * `var` hoisting makes a later assignment read as `undefined` at every earlier
 * call site. reconcile() is the function that mounts the visual layer, so if the
 * slot lookup sits next to the settings panel — which is where it naturally
 * wants to live, since that is the other thing using it — then the first pass
 * sees no slots at all and the seal silently fails to appear until some
 * unrelated re-render happens to run reconcile() again.
 *
 * That is the same trap as reading SCALE_DEFAULT before FIELD_DEFAULTS is
 * assigned, which this file already guards, and it is invisible to any test
 * that only ever inspects the final state. */
const slotsReadAt = source.indexOf('ctx.get("slots")');
const reconcileAt = source.indexOf('function reconcile(');
check(slotsReadAt >= 0, 'the plugin never reads the slot service');
check(
  slotsReadAt >= 0 && reconcileAt >= 0 && slotsReadAt < reconcileAt,
  'ctx.get("slots") appears AFTER reconcile() is defined, so the first reconcile pass would ' +
    'see undefined and the seal would not appear until an unrelated re-render',
);

const reconcileBody = functionBody(source, 'function reconcile(');
check(reconcileBody !== null, 'no reconcile() found; the visual state has no single owner');
if (reconcileBody !== null) {
  check(
    /applyShiki\(/.test(reconcileBody),
    'reconcile() never calls applyShiki(), so the syntax palette would never be applied and ' +
      'code blocks would keep colours chosen for a different surface',
  );
}
/* The seal is the one place this theme replaces shipped UI, which makes its
   registration the easiest thing in the file to leave behind on unload. */
const reconcileHasSeal = /applyBrandMark\(/.test(reconcileBody || '');
check(
  reconcileHasSeal,
  'reconcile() never calls applyBrandMark(), so the sidebar seal setting would do nothing',
);
const applyBrandMarkBody = functionBody(source, 'function applyBrandMark(');
check(
  applyBrandMarkBody !== null && applyBrandMarkBody.includes('clearBrandMark()'),
  'applyBrandMark() cannot clear its own registration, so switching the seal off would leave it on',
);
check(
  /isOn\("sealMark"\)/.test(applyBrandMarkBody || ''),
  'applyBrandMark() does not consult the sealMark preference — the seal would be unconditional',
);

const applyShikiBody = functionBody(source, 'function applyShiki(');
check(
  applyShikiBody !== null && applyShikiBody.includes('clearShiki()'),
  'applyShiki() has no path that clears the layer for an unknown palette; switching palettes ' +
    'would leave the previous palette’s syntax colours behind',
);

/* 13 — the user's font-size preference must never be frozen.
 *
 * The whole point of overriding font SHORTHANDS instead of hardcoding a size is
 * that --dsh-content-font-size keeps flowing. A later edit that writes a literal
 * px size here would look like a tidy simplification and would silently break
 * Settings > Appearance for every reader of this theme. */
const markdownDecls = [...bare.matchAll(/(--dsw-font-markdown-[a-z-]+)\s*:\s*([^;]+);/g)]
  .filter((m) => !/^--dsw-font-markdown-code/.test(m[1])); // code stays at the harness size
check(
  markdownDecls.length > 0,
  'the serif layer declares no --dsw-font-markdown-* tokens; the reading typography is not applied',
);
/* The harness hardcodes the small family (`--dsw-font-markdown-small: 12px/20px`)
   and never routes it through the user's size, so there is nothing to preserve
   there -- only the compensation factor applies. Every other role DOES derive
   from it and must keep doing so. */
const FIXED_SIZE_ROLE = /^--dsw-font-markdown-small/;
for (const [, name, value] of markdownDecls) {
  if (!FIXED_SIZE_ROLE.test(name)) {
    check(
      /var\(--dsh-content-font-size/.test(value),
      `${name} no longer derives from --dsh-content-font-size, so the Appearance font-size row would stop affecting it`,
    );
  }
  check(
    /var\(--hana-serif-scale\)/.test(value),
    `${name} is not scaled by --hana-serif-scale, so the reading-size compensation would apply to only part of the text`,
  );
}

/* 14 — the factor has exactly two homes: the stylesheet literal (first paint,
   before the settings scope is ready) and the schema default. They must agree,
   or the text would visibly jump the moment the scope binds. */
const cssScale = /--hana-serif-scale\s*:\s*([0-9.]+)\s*;/.exec(bare);
check(cssScale !== null, 'the stylesheet does not declare a default --hana-serif-scale');
if (cssScale !== null) {
  const expected = String(Number(client.DEFAULTS.serifScale) / 100);
  check(
    Number(cssScale[1]) === Number(expected),
    `stylesheet --hana-serif-scale is ${cssScale[1]} but the setting default ${client.DEFAULTS.serifScale}% implies ${expected}`,
  );
}

/* ── package wiring ─────────────────────────────────────────────────────── */

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const patchPath = path.join(ROOT, pkg.dsh.bundle.patch);
check(fs.existsSync(patchPath), `package.json declares dsh.bundle.patch "${pkg.dsh.bundle.patch}" which does not exist`);

const patch = fs.readFileSync(patchPath, 'utf8');
const rowId = /-\s*id:\s*([A-Za-z0-9-]+)/.exec(patch);
const skin = JSON.parse(fs.readFileSync(path.join(ROOT, 'skin.json'), 'utf8'));
check(
  rowId !== null && rowId[1] === skin.wiring.id,
  `cordis.patch.yml row id "${rowId ? rowId[1] : '(none)'}" does not match skin.json wiring.id "${skin.wiring.id}"`,
);
check(
  new RegExp(`name:\\s*'?${pkg.name}'?`).test(patch),
  `cordis.patch.yml does not mount the package name "${pkg.name}"`,
);
check(
  skin.bodyAttr === 'data-hana-theme',
  `skin.json bodyAttr "${skin.bodyAttr}" does not match the attribute client.js sets`,
);
check(
  pkg.exports['./client'] === './lib/client.js',
  'package.json must export "./client" — it is how the web module roster finds the client bundle',
);

/* 27 — every preview skin.json names must exist, and every palette must have one.
 *
 * The shipped schema carries a single `preview: { light, dark }` pair — verified
 * against all ten skins distributed with the reference desktop build, none of
 * which declares a `themes[]` array at all. Four palettes cannot fit in two
 * slots, so the pair points at the two primary ones and each `themes[]` entry
 * carries its own: hana's own extension, since `themes[]` is hana's own
 * extension to begin with.
 *
 * Without this judgement the two extra previews were simply ORPHANED — present
 * in assets/, referenced only by the READMEs, invisible to anything reading the
 * manifest. That is the same shape as a dead token: an artifact that looks
 * deliberate, is documented, and is reached by nothing. */
const allPreviews = [
  ...Object.entries(skin.preview || {}).map(([mode, rel]) => [`preview.${mode}`, rel]),
  ...(skin.themes || []).flatMap((t) =>
    t.preview ? [[`themes[${t.id}].preview`, t.preview]] : [],
  ),
];
check(allPreviews.length > 0, 'skin.json declares no preview images at all');
const missingPreviews = allPreviews.filter(([, rel]) => !fs.existsSync(path.join(ROOT, rel)));
check(
  missingPreviews.length === 0,
  `skin.json points at preview images that do not exist: ${missingPreviews
    .map(([where, rel]) => `${where} -> ${rel}`)
    .join(', ')}`,
);
const palettesWithoutPreview = (skin.themes || []).filter((t) => !t.preview).map((t) => t.id);
check(
  palettesWithoutPreview.length === 0,
  `these palettes ship no preview, so a skin browser would show the wrong image for them: ` +
    palettesWithoutPreview.join(', '),
);

/* 17 — the published file list must cover everything the loader reads.
 *
 * `files` decides what an npm/git install actually receives. A new runtime file
 * that nobody adds to the list works perfectly in a `link:` dev install -- where
 * the whole checkout is present -- and breaks only for the people installing it
 * from a registry, which is exactly the audience that cannot debug it. */
const RUNTIME_PATHS = [
  pkg.main,
  pkg.exports['.'],
  pkg.exports['./client'],
  pkg.dsh.bundle.patch,
  './skin.json',
  './README.md',
  './LICENSE',
];
const fileEntries = pkg.files || [];
const coveredBy = (rel) => {
  const clean = rel.replace(/^\.\//, '');
  return fileEntries.some((entry) => clean === entry || clean.startsWith(entry.replace(/\/$/, '') + '/'));
};
check(fileEntries.length > 0, 'package.json has no "files" list, so an install ships the entire checkout');
const missingFromFiles = RUNTIME_PATHS.filter((rel) => rel && !coveredBy(rel));
check(
  missingFromFiles.length === 0,
  `package.json "files" omits runtime paths, so a published install would be broken: ${missingFromFiles.join(', ')}`,
);
for (const rel of RUNTIME_PATHS) {
  if (!rel) continue;
  check(fs.existsSync(path.join(ROOT, rel)), `package.json points at "${rel}", which does not exist`);
}

/* ── the process wash ─────────────────────────────────────────────────────
 *
 * HanaAgent's chat paints its whole process region with ONE translucent tint
 * (`--tool-bg: rgba(26,48,73,0.03)` in coral, black at 3% in paper, white at 3%
 * in midnight) and leaves the items inside unboxed. An earlier revision of this
 * theme did the opposite: it gave every [data-turn-process-member] a fill, a
 * 1px border, a 6px radius and a shadow, which turned each tool call into its
 * own card and made a one-line summary the loudest object on the page. That is
 * the defect the theme's user reported, so it is asserted here rather than left
 * to a comment.
 *
 * The wash must be DERIVED from a token, not a hex: `color-mix` of the
 * palette's own ink at a low percentage reproduces HanaAgent's --tool-bg in all
 * four ports, because the ink is near-black in paper, near-white in the two
 * midnight palettes and rgb(26,48,73) in coral — the same light/dark split
 * HanaAgent writes out by hand. A literal here would be a second, unmanaged
 * copy of a colour, which is the thing this project exists to prevent.
 */
const washDecl = /--hana-wash:\s*color-mix\(in srgb,\s*var\(--dsw-alias-label-primary\)\s*(\d+(?:\.\d+)?)%,\s*transparent\)/;
const washMatch = css.match(washDecl);
check(
  washMatch !== null,
  'CSS does not define --hana-wash as color-mix(in srgb, var(--dsw-alias-label-primary) N%, transparent). ' +
    'The process wash must be derived from the palette ink: a literal is a second copy of a colour, and a ' +
    'wash of some other token stops matching HanaAgent’s --tool-bg.',
);
if (washMatch) {
  check(
    Number(washMatch[1]) <= 5,
    `--hana-wash mixes ${washMatch[1]}% of the ink; HanaAgent's --tool-bg is 3% and anything past 5% stops ` +
      'being a tint and becomes a panel again',
  );
}
for (const [hook, why] of [
  ['[data-turn-process-member]', 'the flow items inside the process window'],
  ['[data-turn-process-tool-calls]', 'the collapsed one-line summary'],
]) {
  const rule = css.match(new RegExp('body\\[data-hana-theme\\] ' + hook.replace(/[[\]]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  check(rule !== null, `CSS has no rule for ${hook} (${why})`);
  if (!rule) continue;
  check(
    /background:\s*var\(--hana-wash\)/.test(rule[1]),
    `${hook} (${why}) does not paint var(--hana-wash)`,
  );
  for (const banned of ['border:', 'border-radius:', 'box-shadow:']) {
    check(
      !rule[1].includes(banned),
      `${hook} (${why}) declares "${banned}", which boxes each item into its own card. HanaAgent paints one ` +
        'wash behind the whole region and leaves the items inside unboxed; the harness already supplies the ' +
        'collapsed row’s own .5px separator.',
    );
  }
}

/* ── the 方角 clamp ──────────────────────────────────────────────────────
 *
 * HanaAgent treats geometry as a theme dimension: new-warm-paper.css:62-69
 * overrides the global radius scale and its header names the rule
 * 「极方圆角 + 0.5px hairline」 / 「controls are seals, 方」, applied to the whole app.
 * DSH has no radius token at all -- 256 declarations, none reading a custom
 * property, 254 of 256 keyed on a build hash (tools/scan-geometry.mjs) -- so the
 * reference's one-token override has to become a global clamp.
 *
 * The clamp must win on SPECIFICITY, because judgement 1 forbids !important, and
 * the arithmetic is the whole mechanism: DSH's radius selectors reach (3,0) on
 * exactly three rules, so the universal needs (0,3,1). These judgements pin the
 * parts that would fail silently -- a clamp that loses the cascade looks exactly
 * like a clamp that was never written.
 */
const sealSel = "body[" + "data-hana-theme" + "][" + "data-hana-shape" + "='seal']";
check(
  css.includes("--dsw-corner-shape:"),
  'the seal block does not set --dsw-corner-shape. That is lever L1: DSH drives corner ' +
    'shape from one property applied to every element, and superellipse(1.5) is softer ' +
    'than a circle, so without it the clamp alone cannot reach 方.',
);
check(
  css.includes(sealSel + " *[class]"),
  'the seal clamp does not carry the (0,3,1) selector "' + sealSel + ' *[class]". DSH has ' +
    'three radius rules at (3,0); at (0,2,1) the clamp loses to them and those surfaces keep ' +
    'their shipped radius while everything around them squares. Verified in a real engine by ' +
    'test/verify/seal-check.mjs, which measures 3px at (0,1,0)/(0,2,0)/(0,3,0) in seal mode ' +
    'and DSH\'s shipped 6/6/10px in soft mode.',
);
{
  const tier = (prop) => {
    const m = css.match(new RegExp("--" + prop + ":\\s*(\\d+(?:\\.\\d+)?)px"));
    return m ? Number(m[1]) : null;
  };
  const t = {
    sm: tier("hana-seal-radius-sm"),
    md: tier("hana-seal-radius"),
    lg: tier("hana-seal-radius-lg"),
    input: tier("hana-seal-radius-input"),
  };
  check(
    t.sm !== null && t.md !== null && t.lg !== null && t.input !== null,
    'the seal tiers are not all declared: ' + JSON.stringify(t),
  );
  if (t.sm !== null && t.md !== null && t.lg !== null && t.input !== null) {
    check(
      t.sm <= t.md && t.md <= t.lg && t.lg < t.input,
      'the seal tiers are not ordered sm <= md <= lg < input: ' + JSON.stringify(t),
    );
    /* The reference's own numbers, so this is a port and not a taste: --radius-sm 2,
       --radius-md/--radius-card 3, --radius-lg/--radius-chat-card 4, and
       --radius-chat-surface 6 for the composer -- the one softness HanaAgent keeps. */
    check(
      t.md <= 3 && t.lg <= 4 && t.input <= 6,
      'the seal tiers exceed HanaAgent\'s scale (sm 2 / md 3 / lg 4 / chat-surface 6): ' +
        JSON.stringify(t),
    );
  }
}

/* HanaAgent legislates --border-width: 0.5px as part of the same rule, and DSH
   already draws most of its own hairlines at .5px. Where THIS theme declares a
   hairline it must match, or the theme's own lines are the heaviest on screen.
 *
 * ONE EXCEPTION, and it was found by a real rule rather than imagined: the
 * reference's markdown link is `border-bottom: 1px solid rgba(var(--link-rgb),
 * 0.35)` (styles.css, 「链接」). Its 0.5px is the STRUCTURAL hairline -- cards,
 * rails, table grids -- while a link's underline is its own 1px rule. The first
 * version of this judgement knew only 0.5px and 2px and failed a faithful port,
 * which is the judgement being incomplete rather than the port being wrong. The
 * exemption is deliberately narrow: 1px, bottom edge only, on the link rule. */
{
  /* The whole declaration, not just up to `solid`: the exemption below is about
     WHICH declaration it is (the link rule's, and only that one), so a match that
     stopped at the width could not tell it from any other 1px bottom border. */
  /* Scanned on the COMMENT-STRIPPED sheet. The first version read the raw one, and
     the block above quotes the reference's own `border-bottom: 1px solid
     rgba(var(--link-rgb), 0.35)` in prose -- so the judgement reported a border
     that does not exist in the shipped CSS. A commented-out declaration is not a
     declaration, which is the same reason tools/derive-grain.mjs strips first. */
  const borderWidths = [...bare.matchAll(/border(?:-(?:top|bottom|left|right))?:\s*(\d+(?:\.\d+)?)px solid[^;]*/g)]
    .map((m) => ({ width: Number(m[1]), text: m[0].replace(/\s+/g, ' ').trim() }));
  const hanaHairlines = borderWidths.filter((b) => b.width < 2);
  const LINK_RULE = 'border-bottom: 1px solid var(--hana-link-rule)';
  const heavy = borderWidths
    .filter((b) => b.width !== 0.5 && b.width !== 2)
    .filter((b) => b.text !== LINK_RULE);
  check(
    heavy.length === 0,
    "the theme draws a border at " + JSON.stringify([...new Set(heavy.map((b) => b.width))]) +
      "px. HanaAgent's rule is " +
      '--border-width: 0.5px, and the only heavier strokes it sanctions are the 2px left rule it uses ' +
      'for blockquotes and callouts, and the 1px underline on its markdown links. ' +
      "Offending: " + JSON.stringify([...new Set(heavy.map((b) => b.text))]),
  );
  check(hanaHairlines.length > 0, 'no sub-2px hairline found at all — did the borders get removed?');

  /* And the borders written through a VARIABLE have to be checked too. The first
     version of this judgement only looked at literal px values, so
     `border: var(--hana-chip-edge) solid ...` walked straight past it: the
     mutation that set --hana-chip-edge back to 1px was NOT CAUGHT. A rule that
     reads the declarations but not what they resolve to is a rule that measures
     the shape of the theme rather than the theme. */
  const edgeProps = [...bare.matchAll(/(--hana-[a-z-]*edge[a-z-]*):\s*(\d+(?:\.\d+)?)px/g)];
  check(
    edgeProps.length > 0,
    'no --hana-*-edge variable found; the hairline width is no longer a named value',
  );
  const fatEdges = edgeProps.filter((m) => Number(m[2]) !== 0.5).map((m) => m[1] + ': ' + m[2] + 'px');
  check(
    fatEdges.length === 0,
    'these edge variables are not 0.5px: ' + fatEdges.join(', ') +
      ". HanaAgent's rule is --border-width: 0.5px, and a var() hides the value from any " +
      'literal-only check.',
  );
}

/* ── the 焦点墨环 ────────────────────────────────────────────────────────
 *
 * HanaAgent deletes the DEFAULT focus ring globally (styles.css:288,
 * `:focus, :focus-visible { outline: none !important }`, asserted by its own
 * vitest) and then draws its own per component -- and the ring it draws is ONE
 * colour, `var(--accent)`, at 1px or 2px with an offset of +/-2px. DSH's ring
 * GEOMETRY is already that; its COLOUR is five different families across 31
 * rules, every one of them keyed on a build hash. Under 珊瑚 two of those are
 * #A8432A and #F37E63, and #F37E63 measures 2.45:1 on its ground -- below the
 * 3:1 WCAG 1.4.11 asks of a non-text indicator. That is the 橙框.
 *
 * So this block is one property, `outline-color`, and every judgement below
 * guards a way it can fail while still looking written.
 */
const focusSel = "body[" + "data-hana-theme" + "][" + "data-hana-focus" + "='accent']";
{
  /* The attribute has to be WRITTEN, or these rules are dead CSS that passes
     every text assertion ever written about them. */
  check(
    /setAttribute\(\s*FOCUS_ATTR/.test(source),
    'nothing sets the focus attribute, so every --hana-ring rule is dead CSS: the ring would stay ' +
      'whatever DSH shipped while the stylesheet looks correct',
  );
  check(
    /removeAttribute\(\s*FOCUS_ATTR\s*\)/.test(source),
    'the focus attribute is never removed on detach, so it survives the plugin being stopped',
  );

  /* Find the rule itself, selector and body, so the specificity below is read off
     the shipped text rather than off a constant repeated from this file. The
     finder accepts the SHORTHAND too -- it did not at first, and the mutation
     that swaps outline-color for `outline: 1px solid var(--hana-ring)` then made
     the rule unfindable, so the judgement reported "no rule sets outline-color"
     and the shorthand assertion never ran. A guard that can only see the correct
     spelling cannot catch a wrong one. */
  const ringRule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(
    (m) => /(^|[^-])outline[a-z-]*\s*:[^;}]*var\(--hana-ring\)/.test(m[2]),
  );
  check(ringRule !== undefined, 'no rule sets an outline from var(--hana-ring)');
  if (ringRule) {
    const ringSelector = ringRule[1].trim();
    const parts = ringSelector.split(',').map((s) => s.trim());

    /* Only the COLOUR may change. Writing the `outline` shorthand would give a
       ring to elements that deliberately have none -- DSH ships 32 of those,
       every one of them an input that shows focus some other way. */
    check(
      /(^|[^-])outline-color:\s*var\(--hana-ring\)/.test(ringRule[2]),
      'the focus rule does not set outline-color: var(--hana-ring)',
    );
    check(
      !/(^|[^-])outline\s*:/.test(ringRule[2]),
      'the focus rule writes the outline SHORTHAND. outline-color is inert while outline-style is ' +
        'none, which is what keeps this from inventing an indicator on the 32 DSH rules that ' +
        'deliberately have none; the shorthand would override that.',
    );

    /* `:focus-visible *` is not decoration: exactly one DSH rule paints a ring on
       a DESCENDANT of the focused element, and `:focus-visible` alone never
       matches it, so that one ring keeps the old colour and the app is left with
       two focus colours. */
    check(
      parts.includes(focusSel + ' :focus-visible'),
      'the focus rule does not carry the plain selector "' + focusSel + ' :focus-visible"',
    );
    check(
      parts.includes(focusSel + ' :focus-visible *'),
      'the focus block does not carry the descendant selector "' + focusSel + ' :focus-visible *". ' +
        'DSH has exactly one rule that rings a descendant of the focused element ' +
        '(._6nu5Ca_memberButton:focus-visible ._6nu5Ca_memberLabelWrap); without it that ring stays ' +
        'on the old colour and the app is left with two focus colours.',
    );

    /* Specificity. Judgement 1 forbids !important, so the rule must out-rank the
       real ceiling of DSH's 31 outline rules, which is measured at (0,3,0). The
       selector carries body + two attributes + a pseudo-class = (0,3,1); with one
       attribute it would be (0,2,1) and lose. This is the same arithmetic as the
       seal clamp's, and it fails just as silently. */
    const attrs = (parts[0].match(/\[[^\]]+\]/g) || []).length;
    const pseudo = (parts[0].match(/:(?!:)[\w-]+/g) || []).length;
    check(
      attrs === 2 && pseudo === 1,
      'the focus selector "' + parts[0] + '" is (' + attrs + ' attribute, ' + pseudo + ' pseudo-class). ' +
        '(0,3,1) needs exactly two attributes and one pseudo-class on top of body; at (0,2,1) it loses ' +
        'to the (0,3,0) DSH rule that rings a workflow member label.',
    );
  }

  /* Every palette must resolve to a ring, and to a DISTINCT rule rather than by
     accident. tools/derive-focus.mjs does the colour binding (it needs the
     reference); this only insists the resolution exists at all. */
  const generic = [...css.matchAll(/--hana-ring:\s*var\(\s*(--[A-Za-z0-9-]+)\s*\)/g)].map((m) => m[1]);
  check(
    generic.length > 0,
    'no --hana-ring is declared at all; the focus rule would resolve to nothing and every ring ' +
      'would fall back to inherit',
  );
}

/* ── the 玻璃层 ──────────────────────────────────────────────────────────
 *
 * The reference's `--bg-glass` dresses the small chips that hover over content
 * (its find box, markdown badge, preview hint, code-copy tooltip). DSH has one
 * surface with that job -- the 回到底部 button, position: sticky over the message
 * list -- plus the design system's own toolbar token, which DSH ships with an
 * alpha (#54555780) and nothing installed paints.
 *
 * The failure this guards is the one this theme actually committed: flattening a
 * translucent surface into an opaque plate. It is invisible in review, because a
 * hex and an rgba look equally deliberate, and it is invisible at rest, because
 * the plate only differs from the page when something is behind it.
 */
{
  const glassProps = [
    '--dsw-alias-button-floating-fill',
    '--dsw-alias-button-tool-bar-fill',
    '--dsw-alias-button-tool-bar-fill-invisible',
  ];
  for (const palette of client.PALETTES) {
    for (const name of glassProps) {
      const value = palette.tokens[name];
      check(value !== undefined, palette.id + ' does not supply ' + name);
      if (value === undefined) continue;
      const alpha = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(value);
      check(
        alpha !== null,
        palette.id + ': ' + name + ' is ' + value + ', an opaque colour. This token IS the design ' +
          "system's translucent-surface slot (DSH ships #54555780 / #54555799) and the reference's " +
          '--bg-glass is the same idea; an opaque value here is a chip painted as a sticker.',
      );
      if (alpha) {
        const a = Number(alpha[1]);
        check(
          a >= 0 && a <= 0.95,
          palette.id + ': ' + name + ' has alpha ' + a + '. The reference caps its glass at .94 ' +
            '(and only in the CONTRAST variants); anything at or above .95 is a plate again.',
        );
      }
    }
    check(
      palette.tokens['--dsw-alias-button-tool-bar-fill-invisible'] !== undefined &&
        /,\s*0\s*\)/.test(palette.tokens['--dsw-alias-button-tool-bar-fill-invisible']),
      palette.id + ': button-tool-bar-fill-invisible is not alpha 0, so the family loses the ' +
        'bottom of its ladder (0 -> glass -> opaque)',
    );
  }
}

/* ── the 纸纹暗色否决 ───────────────────────────────────────────────────
 *
 * HanaAgent does not restyle its paper grain for dark themes, it does not apply
 * it: `paperTextureBlockedThemeIds: ["midnight", "midnight-contrast"]` lives in
 * its registry, `isPaperTextureEffectivelyEnabled = enabled && !blocked`, and
 * the settings switch is rendered disabled with the hint
 * 「黑夜模式不支持纸质纹理，切回浅色主题后会按原设置恢复」 -- a hint that makes a
 * promise about the STORED preference, which is the part an implementation can
 * break without anyone noticing until the user switches back.
 *
 * tools/derive-grain.mjs checks what the veto DOES (it runs the shipped
 * predicate against the shipped palette table, and checks the CSS keying).
 * These judgements are the source-level half it cannot see.
 */
{
  check(
    /function textureAllowed\(/.test(source),
    'lib/client.js has no textureAllowed(), so nothing vetoes the paper grain in the dark palettes',
  );
  check(
    /TEXTURE_ATTR,\s*prefs\.isOn\("paperTexture"\)\s*&&\s*textureAllowed\(/.test(source),
    'the texture attribute is not gated on textureAllowed(); the veto would exist and never be consulted',
  );
  check(
    /textureAllowed\(claimant\)/.test(source),
    'the veto is not applied to the SAME palette the body attribute is written from. Reading the claimant ' +
      'twice from two expressions is how the two could ever disagree on screen.',
  );

  /* The reference's promise, as an invariant rather than a comment: nothing may
     write this preference EXCEPT the generic settings toggle. A veto that does
     `prefs.set("paperTexture", "0")` looks like it works -- the grain does stop
     -- and silently destroys the user's choice, so the grain never comes back
     when they return to a light palette. */
  const directWrites = [...source.matchAll(/prefs\.set\(\s*["']paperTexture["']/g)].length;
  check(
    directWrites === 0,
    `the paperTexture preference is written directly in ${directWrites} place(s). The veto must withhold the ` +
      'ATTRIBUTE, not the preference: HanaAgent\'s hint promises 「切回浅色主题后会按原设置恢复」, and a write ' +
      'here is what makes that promise false.',
  );

  /* And the switch must be disabled, not merely off: the difference is the
     user's whole understanding of whether their switch is broken or
     inapplicable. */
  check(
    /disabled:\s*textureBlocked/.test(source),
    'the paper-texture switch is not disabled while vetoed; HanaAgent disables it (InterfaceTab passes ' +
      '`on={blocked ? false : enabled} disabled={blocked}`) rather than showing a switch that does nothing',
  );
  check(
    source.includes('黑夜模式不支持纸质纹理'),
    'the panel does not carry the hint that explains the veto',
  );
}

/* ── 字距寄存器 · 链接细线 ──────────────────────────────────────────────
 *
 * Two items from docs/plan-square-geometry.md §7, and both turn on the same
 * question the geometry ledger asks: which parts of a 76-declaration reference
 * register survive into a host whose every element is a build hash.
 *
 * The tracking register is a PAIR -- a label value and an explicit zero -- and
 * the zero changes no pixel today. It is written down because it is an invariant
 * a mutation can break, which is worth more than a comment saying "data is not
 * tracked".
 *
 * The link rule is a border-bottom because that is what HanaAgent uses, and the
 * reason this theme previously gave for NOT using one (that colouring the
 * harness's reserved transparent hit-area border would shrink the click target)
 * was a category error: colouring a border that already exists does not narrow
 * it. What DOES narrow it is changing the width, which is a separate edit -- so
 * the judgement below pins the three transparent borders the hit area is made of,
 * because those are the thing that must survive.
 */
{
  for (const token of ['--hana-track-label', '--hana-track-data']) {
    const declared = new RegExp(token + ':\\s*[^;]+;').test(bare);
    check(declared, `the tracking register does not declare ${token}`);
    check(
      new RegExp('var\\(\\s*' + token + '\\s*[,)]').test(bare),
      `${token} is declared and never read`,
    );
  }
  check(
    /--hana-track-label:\s*0\.05em/.test(bare) || /--hana-track-label:\s*0\.08em/.test(bare),
    'the label tracking is outside the band the reference uses for short labels (.05-.08em on its ' +
      'reading surface, .02-.18em across the register)',
  );
  check(
    /--hana-track-data:\s*0\s*;/.test(bare),
    'the data tracking is not exactly 0. HanaAgent zeroes data-like text EXPLICITLY rather than by ' +
      'inheritance, and the whole point of the pair is that the two ends differ.',
  );
  const th = /\[data-chat-flow-kind='assistant-step'\] th\s*\{([^}]*)\}/.exec(bare);
  const td = /\[data-chat-flow-kind='assistant-step'\] td\s*\{([^}]*)\}/.exec(bare);
  check(th !== null && /letter-spacing:\s*var\(--hana-track-label\)/.test(th[1]),
    'table headers do not take the label tracking; a header is the one thing HanaAgent tracks in its reading surface');
  check(td !== null && /letter-spacing:\s*var\(--hana-track-data\)/.test(td[1]),
    'table cells do not take the explicit zero');

  /* The link rule itself. */
  const linkRule = /\[data-chat-flow-kind='assistant-step'\] a\s*\{([^}]*)\}/.exec(bare);
  check(linkRule !== null, 'no link rule for the reading surface');
  if (linkRule) {
    check(
      /text-decoration:\s*none/.test(linkRule[1]),
      'the link rule does not clear text-decoration. HanaAgent sets `text-decoration: none` on its ' +
        'anchors and draws a border instead; leaving the harness underline on gives a link two lines.',
    );
    check(
      /border-bottom:\s*1px solid var\(--hana-link-rule\)/.test(linkRule[1]),
      'the link rule is not the reference\'s 1px bottom border in var(--hana-link-rule)',
    );
  }
  const linkHover = /\[data-chat-flow-kind='assistant-step'\] a:hover[^{]*\{([^}]*)\}/.exec(bare);
  check(
    linkHover !== null && /text-decoration:\s*none/.test(linkHover[1]),
    'the link hover does not clear text-decoration. The harness\'s own hover is ' +
      '`text-decoration: underline`, so without this the resting border and the hover underline stack.',
  );
  check(
    linkHover !== null && /border-bottom-color:\s*var\(--hana-link-rule-hover\)/.test(linkHover[1]),
    'the link hover does not take the rule to its full-strength colour',
  );

  /* And the hit area, which is the thing the old comment was actually worried
     about. The harness makes the anchor easier to click with THREE further
     zero-alpha borders (3px left/right, 2px top) and pulls them back with
     negative margins; only the BOTTOM one is the reference's to colour. Writing
     the `border` shorthand here -- the one-character edit that looks tidier --
     resets all four sides and deletes the horizontal enlargement, which is the
     part a text link is actually clicked on. */
  if (linkRule) {
    check(
      !/(^|[^-])border\s*:/.test(linkRule[1]),
      'the link rule writes the `border` SHORTHAND. That resets all four sides, including the three ' +
        'zero-alpha borders the harness uses as the anchor\'s hit area -- colouring the bottom border is ' +
        'the reference\'s treatment, and removing the other three is what would really shrink the target.',
    );
  }
}

/* ── the geometry ledger, validated OFFLINE ─────────────────────────────
 *
 * tools/scan-geometry.mjs --check regenerates the ledger from the installed
 * packages, so it belongs in `npm test` and NOT in the flake's check list: the
 * nix build sandbox has no DSH profile and no desktop app, and a gate that fails
 * there for environmental reasons is worse than one that is honestly scoped.
 * test/surfaces.test.js is offline for the same reason, which is why
 * scan-surface-roles --check is likewise absent from the flake.
 *
 * What CAN be checked offline is that the committed artifact is not corrupt or
 * truncated -- the failure mode where a ledger loses half its rows and every
 * assertion that reads it quietly gets easier.
 */
{
  /* HANA_GEOMETRY, mirroring HANA_ALLOWLIST in test/tokens.test.js: the mutation
     suite runs this file against a MUTATED copy, and without an override the
     mutation would be invisible here and the gate would be decoration. */
  const ledgerPath = process.env.HANA_GEOMETRY || path.join(__dirname, 'geometry-sites.json');
  check(fs.existsSync(ledgerPath), 'test/geometry-sites.json is missing; run npm run geometry:scan');
  if (fs.existsSync(ledgerPath)) {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const entries = ledger.entries || [];
    check(
      entries.length === ledger.source.sites && entries.length > 200,
      `the geometry ledger has ${entries.length} entries against a recorded ${ledger.source.sites}; ` +
        'a truncated ledger makes every reader of it pass more easily',
    );
    const bad = entries.filter((e) => !e.pkg || !e.module || !e.value || typeof e.reachable !== 'boolean');
    check(bad.length === 0, `${bad.length} geometry ledger entries are missing pkg/module/value/reachable`);
    const circles = entries.filter((e) => /999px|50%|100px/.test(e.value)).length;
    check(
      circles > 0 && circles < entries.length / 2,
      `the ledger reports ${circles} circle/pill sites out of ${entries.length}, which cannot be right ` +
        'in either direction — the seal clamp\'s whole cost argument rests on this count',
    );
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length) {
  console.error(`check: ${failures.length} FAILED\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}

console.log(
  `check: ${assertions} static judgements pass ` +
    `(${selectors.length} scoped rule(s), ${declared.length} declaration(s), ${css.split('\n').length} CSS lines)`,
);
