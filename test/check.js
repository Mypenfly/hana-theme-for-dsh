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
   repainted my UI" failure this plugin is built to avoid. */
const selectors = [...bare.matchAll(/(^|\})([^{}]+)\{/g)]
  .map((m) => m[2].trim())
  .filter((s) => s && !s.startsWith('@'))
  .flatMap((s) => s.split(',').map((part) => part.trim()));
const unscoped = selectors.filter((s) => s && !s.startsWith('body[data-hana-theme]'));
check(unscoped.length === 0, `CSS has rules not scoped to body[data-hana-theme]: ${unscoped.join(' | ')}`);

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
