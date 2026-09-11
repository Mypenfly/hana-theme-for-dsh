'use strict';
/**
 * The runtime gate.
 *
 * Every other suite in this repo reads SOURCE TEXT or the shipped TABLES. This
 * one executes the plugin. That distinction matters here more than it usually
 * would, because "the theme fails silently" is a runtime property: a token the
 * presenter wipes, a listener that re-enters, a deferred re-apply that loses a
 * race, a settings write that lands nowhere. None of those are visible in the
 * text of a file, and the one severe bug in this project's history (§5.7, the
 * four-layer settings-persistence chain) was made entirely of them.
 *
 * The lesson that bug produced was "① explicit contract + ② visible durability
 * state + ③ a judgement". ① and ② shipped. ③ never did — until now.
 *
 * See test/harness.js for the environment, and test/selftest.js for the proof
 * that this suite is not vacuous.
 */

const { createEnvironment } = require('./harness');

let failures = 0;
let assertions = 0;
const ok = (condition, message) => {
  assertions += 1;
  if (!condition) {
    failures += 1;
    console.error('  ✗ ' + message);
  }
};
const eq = (actual, expected, message) => {
  assertions += 1;
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    failures += 1;
    console.error(`  ✗ ${message}\n      expected ${b}\n      actual   ${a}`);
  }
};

/** Section header, so a failure says which behaviour broke. */
const section = (title) => console.log(`\n${title}`);

/* ═══════════════════════════════════════════════════════════════════════════
   1 — the negative promise: installing this theme changes nothing
   ═══════════════════════════════════════════════════════════════════════════
   This is the most important behaviour in the plugin and the one a README can
   only assert. `enabled` defaults to ON, so the "installed quietly" property
   rests entirely on every visual layer being gated behind a palette actually
   being CLAIMED — not behind a manual switch. If that gate ever slips, the
   failure is "I installed a theme and it repainted my UI", which is the exact
   complaint this architecture was chosen to make impossible. */
section('1 — contributes nothing until a palette is claimed');
{
  const env = createEnvironment();
  env.assertLive();
  const before = env.snapshot();
  env.apply();
  const after = env.snapshot();

  eq(after, before, 'apply() touched the document with no palette claimed');
  ok(env.theme._overrides.size === 0, 'an override layer exists before any palette was claimed');
  ok(
    env.theme.getTheme().preference === 'light',
    'the theme preference was changed by merely mounting the plugin',
  );
  /* It must still have registered, or the palette would be unselectable — the
     gate is on the VISUAL layer, not on registration. */
  ok(
    env.theme.getTheme().themes.filter((t) => t.id.startsWith('hana-')).length === 4,
    'the four palettes were not registered, so they could never be selected',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 — reversibility: unload leaves the document exactly as found
   ═══════════════════════════════════════════════════════════════════════════
   check.js asserts the disposer chain STATICALLY (does the text mention each
   teardown call). Only this can assert the property itself. It is also what the
   syntax layer needs: eleven inline custom properties that fail to be removed
   would leak into whatever theme the user switches to next, and a leaked
   --shiki-* is invisible until someone reads code in another theme. */
section('2 — detach() is complete');
{
  const env = createEnvironment();
  env.assertLive();
  const pristine = env.snapshot();

  env.apply();
  env.claimPalette('hana-midnight');
  const claimed = env.snapshot();
  ok(
    claimed.bodyAttrs['data-hana-theme'] === 'midnight',
    'claiming hana-midnight did not set data-hana-theme',
  );
  ok(claimed.styleTags.length === 1, 'the stylesheet was not mounted after claiming a palette');

  env.dispose();
  eq(env.snapshot(), pristine, 'dispose() did not leave the document as it was found');
  ok(env.theme._overrides.size === 0, 'the override layer survived dispose()');
  ok(
    env.theme.getTheme().themes.filter((t) => t.id.startsWith('hana-')).length === 0,
    'the theme registrations survived dispose()',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 — the syntax layer
   ═══════════════════════════════════════════════════════════════════════════
   L1b is new code with no runtime history. Three things must hold: the values
   reach the DOM, they FOLLOW the palette (that is what makes the transient
   colorScheme window harmless), and they are removed on detach. */
section('3 — the syntax palette is applied, follows the palette, and is removed');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-midnight');

  const names = env.client.SHIKI_NAMES || [];
  ok(names.length === 11, `SHIKI_NAMES should hold 11 names, found ${names.length}`);

  const inline = () => env.document.body.style._dump();
  const midnight = env.client.SHIKI['hana-midnight'];
  for (const name of names) {
    eq(inline()[name], midnight[name], `${name} did not reach the DOM for hana-midnight`);
  }

  /* Switching palettes must REPLACE, not merge. A stale value from the previous
     palette is the silent-failure shape: one wrong colour in one code block. */
  env.claimPalette('hana-coral');
  const coral = env.client.SHIKI['hana-coral'];
  for (const name of names) {
    eq(inline()[name], coral[name], `${name} kept the previous palette's value after switching`);
  }
  ok(
    inline()['--shiki-token-comment'] !== midnight['--shiki-token-comment'],
    'the two palettes happen to share this value, so the replacement test proves nothing',
  );

  /* The eleven names are exactly the harness's set — no more, no fewer. */
  eq(
    Object.keys(coral).sort(),
    (env.client.SHIKI_NAMES || []).slice().sort(),
    'SHIKI_NAMES does not match a shipped table',
  );

  env.dispose();
  const leftover = Object.keys(env.snapshot().bodyInline).filter((k) => k.startsWith('--shiki-'));
  eq(leftover, [], 'syntax properties survived detach()');
}

/* ═══════════════════════════════════════════════════════════════════════════
   4 — the override layer is rebuilt only when the choice changes
   ═══════════════════════════════════════════════════════════════════════════
   overrideTokens() EMITS theme/change, and reconcile() is itself a
   theme/change listener. Re-layering unconditionally recurses forever. The
   guard is the `overrideFor` identity check, and losing it is an infinite loop
   rather than a wrong colour — so it is worth pinning. */
section('4 — re-layering is deduplicated');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-paper');

  const overridesAfterClaim = env.theme._events.filter((e) => e.reason === 'override').length;
  ok(overridesAfterClaim === 1, `expected 1 override layer creation, saw ${overridesAfterClaim}`);

  /* Churn every OTHER preference. Each write is a settings update, each update
     runs adopt(), each adopt() publishes, each publish runs reconcile — and a
     reconcile for an unchanged palette must not re-layer. */
  for (let i = 0; i < 5; i += 1) env.theme.settingsWritten();
  env.flushTimers();

  const after = env.theme._events.filter((e) => e.reason === 'override').length;
  ok(after === 1, `re-layered ${after - 1} extra time(s) for an unchanged palette`);
  ok(env.theme._overrides.size === 1, `expected 1 live layer, saw ${env.theme._overrides.size}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   5 — the §5.7 regression: a settings write must not lose the palette
   ═══════════════════════════════════════════════════════════════════════════
   Reproduces the chain that took four rounds to fix:
     write a setting -> settings document updates -> adopt() assigns
     preference = the persisted built-in -> the presenter wipes the inline
     tokens -> the screen reverts.
   The palette must come back, and it must come back via the OVERRIDE LAYER
   (which adopt() cannot reach), not by a re-entrant setTheme() from the
   listener (which loses the race — judgement 20). */
section('5 — §5.7: the palette survives a settings write');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-midnight');

  const bg = () => env.document.body.style.getPropertyValue('--dsw-alias-bg-base');
  const expected = env.client.TOKENS.midnight['--dsw-alias-bg-base'];
  eq(bg(), expected, 'the palette was not painted in the first place');

  /* DSH re-adopts its own persisted preference; the third-party id is never
     written to the settings document, so this is what the user sees. */
  env.theme.settingsWritten();
  env.flushTimers();

  eq(bg(), expected, 'the palette was lost when the settings document was updated');
  ok(
    env.theme.getTheme().active.id === 'hana-midnight',
    `the preference was left on "${env.theme.getTheme().active.id}" instead of being pinned back`,
  );
  ok(
    env.document.body.getAttribute('data-hana-theme') === 'midnight',
    'the body attribute was lost, which would silently drop the whole typography layer',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6 — the deferred re-apply is an ORDERING guarantee, so assert the order
   ═══════════════════════════════════════════════════════════════════════════
   publish() emits synchronously, so a re-entrant setTheme runs the presenter
   with our snapshot first and then again with the STALE built-in snapshot,
   wiping what was restored. Deferring past the whole emit is the only ordering
   that survives. This asserts the deferral is load-bearing by observing the
   state BEFORE the deferred callback runs. */
section('6 — the re-apply is deferred past the whole emit');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-midnight');

  env.theme.settingsWritten();
  /* Deliberately NOT flushed yet. */
  const unflushed = env.document.body.style.getPropertyValue('--dsw-alias-bg-base');
  ok(
    unflushed !== env.client.TOKENS.midnight['--dsw-alias-bg-base'],
    'the palette was already correct before the deferred pass, so this proves nothing about ordering',
  );

  env.flushTimers();
  eq(
    env.document.body.style.getPropertyValue('--dsw-alias-bg-base'),
    env.client.TOKENS.midnight['--dsw-alias-bg-base'],
    'the deferred pass did not restore the palette',
  );

  /* And the timer must not be re-armed for ever. */
  const pending = env.timers.length;
  env.flushTimers();
  ok(pending === 0 || env.timers.length <= pending, 'the deferred pass re-arms itself without end');
}

/* ═══════════════════════════════════════════════════════════════════════════
   7 — the settings write gate
   ═══════════════════════════════════════════════════════════════════════════
   A write only lands when mode==='host' AND status==='ready' AND writable.
   Testing `writable` alone is the classic bug: a host-mode describe view
   answers writable=true while this namespace is still unserved, so the write
   reaches no durable store, the dirty mark is cleared, and the setting is gone
   on reload. The scope in the harness reports exactly that shape. */
section('7 — a write before the scope is served stays dirty and replays');
{
  const env = createEnvironment({ durable: false });
  env.assertLive();
  env.apply();

  env.claimPalette('hana-midnight');
  eq(env.settings.writes, [], 'a write landed while the namespace was unserved');

  /* Item ② of the lesson §5.7 produced: "an explicit contract + a VISIBLE
     durability state". The panel must SAY the setting did not persist, and it
     must say it WHILE the namespace is unserved — which is exactly when a
     silent switch would look fine. A silently non-persisting switch is worse
     than a broken one: the user keeps setting it and keeps losing it. */
  ok(
    /⚠️|未能写入/.test(env.panelText()),
    'the panel does not warn that the settings did not persist, so the user would never find out',
  );

  /* The user's edit is not lost — it is held, and replayed on the next ready
     transition. */
  env.settings.goReady();
  env.flushTimers();
  ok(
    env.settings.writes.some(([k, v]) => k === 'palette' && v === 'hana-midnight'),
    `the held edit never replayed once the namespace became ready; writes: ${JSON.stringify(env.settings.writes)}`,
  );
  ok(
    !/⚠️/.test(env.panelText()),
    'the panel still warns about persistence after the write actually landed',
  );

  const healthy = createEnvironment({ durable: true });
  healthy.assertLive();
  healthy.apply();
  healthy.claimPalette('hana-midnight');
  ok(
    /已保存/.test(healthy.panelText()),
    'the panel does not confirm that the settings were saved',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8 — the settings panel renders, and its controls are wired to real rows
   ═══════════════════════════════════════════════════════════════════════════ */
section('8 — the settings panel');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();

  let tree = null;
  try {
    tree = env.renderSettings();
  } catch (e) {
    ok(false, `rendering the settings panel threw: ${e.message}`);
  }
  if (tree) {
    ok(tree && tree.type === 'div', 'the panel root is not a div');
    const labels = env.buttons(tree).map((b) => b.text);
    for (const wanted of ['纸本', '青夜', '珊瑚', '斑斓', '跟随 DSH']) {
      ok(labels.includes(wanted), `the panel has no "${wanted}" control`);
    }
    ok(labels.length === 5, `expected 5 button controls, found ${labels.length}: ${labels.join(', ')}`);
  }

  /* 「跟随 DSH」 is the escape hatch, and check.js pins that clearing the
     remembered palette happens in exactly ONE place. Here is that place, driven. */
  env.claimPalette('hana-coral');
  ok(
    env.document.body.getAttribute('data-hana-theme') === 'coral',
    'the coral palette did not take effect',
  );
  env.clickButton('跟随 DSH');
  ok(
    env.document.body.getAttribute('data-hana-theme') === null,
    '「跟随 DSH」 did not hand the palette back',
  );
  eq(env.theme._overrides.size, 0, '「跟随 DSH」 left the override layer in place');
}

/* ═══════════════════════════════════════════════════════════════════════════
   9 — the master kill switch
   ═══════════════════════════════════════════════════════════════════════════ */
section('9 — the enabled switch unregisters and detaches');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-paper');
  const pristine = createEnvironment();
  pristine.assertLive();
  const clean = pristine.snapshot();

  /* The switch is a checkbox, not a button, so drive it through the tree. */
  const tree = env.renderSettings();
  const boxes = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'input' && node.props && node.props.type === 'checkbox') boxes.push(node);
    for (const c of node.children || []) walk(c);
  };
  walk(tree);
  ok(boxes.length >= 4, `expected several checkboxes in the panel, found ${boxes.length}`);
  boxes[0].props.onChange(); // 「启用花笺主题」
  env.flushTimers();

  eq(env.snapshot(), clean, 'switching the theme off did not restore the document');
  ok(
    env.theme.getTheme().themes.filter((t) => t.id.startsWith('hana-')).length === 0,
    'the palettes stayed registered after the theme was switched off',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   10 — the pinned preference beats a mismatched OS scheme
   ═══════════════════════════════════════════════════════════════════════════
   composeActive() picks the override's light or dark half from the ACTIVE
   theme's colorScheme. With the preference on `system` and a light OS, choosing
   a DARK palette would otherwise show its light partner. ensurePaletteApplied()
   pins the preference, and this is what proves the pinning is doing work. */
section('10 — a dark palette is not swapped for its light partner');
{
  const env = createEnvironment();
  env.assertLive();
  /* Preference on `system`, OS light. */
  env.theme.setTheme('system');
  env.apply();

  env.claimPalette('hana-midnight');
  eq(
    env.document.body.style.getPropertyValue('--dsw-alias-bg-base'),
    env.client.TOKENS.midnight['--dsw-alias-bg-base'],
    'a dark palette rendered its light partner because the preference stayed on `system`',
  );
  ok(
    env.theme.getTheme().active.id === 'hana-midnight',
    `the preference was left on "${env.theme.getTheme().active.id}"`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   11 — the ornament switches reach the DOM
   ═══════════════════════════════════════════════════════════════════════════
   Four user-facing settings whose whole job is to write one attribute or one
   inline custom property. check.js can see that the plumbing is spelled right;
   only this can see that a slider actually moves anything.

   The out-of-range cases matter most. preferredScale()/preferredGrain() fall
   back to the stylesheet default rather than writing a broken value, and the
   reason is specific: an invalid factor would make every markdown `font`
   SHORTHAND invalid, so the text would silently fall back to the inherited size
   instead of merely not being scaled — a failure that looks like a layout
   choice. That guard is worth a test rather than a comment. */
section('11 — the ornament settings reach the DOM');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-paper');

  const inline = () => env.document.body.style._dump();
  const attrs = () => env.document.body._attrs();
  const classes = () => env.document.body.classList._dump();

  /* Defaults, as shipped. The stylesheet's literal and the schema default must
     agree or the first paint jumps when the scope binds (check.js asserts they
     agree in source; here is the value that actually lands). */
  eq(attrs()['data-hana-shape'], 'soft', 'the default corner setting is not soft');
  eq(attrs()['data-hana-texture'], 'off', 'paper texture is not off by default');
  eq(classes(), ['hana-serif'], 'serif reading type is not on by default');
  eq(inline()['--hana-serif-scale'], '1.15', 'the default reading-size factor is not the stylesheet literal');
  eq(inline()['--hana-grain-opacity'], '0.32', 'the default grain intensity is wrong');

  env.setRange('衬线字号补偿', 130);
  eq(inline()['--hana-serif-scale'], '1.3', 'the reading-size slider did not reach the DOM');

  env.toggle('衬线阅读体');
  ok(!classes().includes('hana-serif'), 'switching serif off left the class in place');

  env.toggle('纸质纹理');
  eq(attrs()['data-hana-texture'], 'on', 'the paper-texture switch did not reach the DOM');
  env.setRange('纹理强度', 48);
  eq(inline()['--hana-grain-opacity'], '0.48', 'the grain slider did not reach the DOM');

  env.toggle('极方圆角');
  eq(attrs()['data-hana-shape'], 'seal', 'the corner switch did not reach the DOM');

  /* Out of range / unparseable must fall back, never write a broken value. */
  for (const bogus of ['999', '-5', 'abc', '']) {
    env.setRange('衬线字号补偿', bogus);
    eq(
      inline()['--hana-serif-scale'],
      '1.15',
      `an out-of-range reading-size factor (${JSON.stringify(bogus)}) was written instead of falling back`,
    );
  }
  for (const bogus of ['999', '-5', 'abc']) {
    env.setRange('纹理强度', bogus);
    eq(
      inline()['--hana-grain-opacity'],
      '0.32',
      `an out-of-range grain intensity (${JSON.stringify(bogus)}) was written instead of falling back`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   12 — the sidebar seal
   ═══════════════════════════════════════════════════════════════════════════
   The one place this theme replaces shipped UI, which makes it the easiest
   thing in the file to leave behind on unload and the easiest to make
   unconditional by accident. Both are checked, plus the negative promise: with
   no palette claimed it must not register even when switched on, because a
   brand mark appearing under the BUILT-IN themes would be the exact "installed
   a theme and it repainted my UI" failure this architecture exists to prevent.
*/
section('12 — the sidebar seal');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette('hana-paper');

  const sealSeat = () => env.slotRegistrations.find((r) => r.spec.name === 'sidebar.brand.mark');
  ok(!sealSeat(), 'the seal registered even though its switch is off by default');

  env.toggle('侧栏印章');
  const seat = sealSeat();
  ok(!!seat, 'switching the seal on did not register into sidebar.brand.mark');
  if (seat) {
    /* The component must be callable with the owner props the slot passes, and
       must draw the VERIFIED colour pair — naming the pair is what lets
       contrast.test.js check that it has one. */
    const tree = seat.component({ size: 22 });
    const style = tree && tree.props && tree.props.style;
    ok(!!style, 'the seal component rendered nothing');
    if (style) {
      eq(style.background, `var(${env.client.SEAL_COLORS.fill})`, 'the seal fill is not the verified fill token');
      eq(style.color, `var(${env.client.SEAL_COLORS.ink})`, 'the seal ink is not the verified ink token');
      eq(style.width, '22px', 'the seal ignored the size the slot asked for');
      ok(
        typeof style.fontSize === 'string' && parseFloat(style.fontSize) < 22,
        'the glyph is not scaled inside the requested square',
      );
    }
    eq(tree.children, [env.client.SEAL_GLYPH], 'the seal does not render its glyph');
  }

  env.toggle('侧栏印章');
  ok(!sealSeat(), 'switching the seal off left it registered');

  /* And the whole-theme path: unload must take it with it. */
  env.toggle('侧栏印章');
  ok(!!sealSeat(), 'the seal did not come back on');
  env.dispose();
  ok(!sealSeat(), 'dispose() left the seal registration behind');
}

/* ═══════════════════════════════════════════════════════════════════════════
   13 — the seal stays silent under the built-in themes
   ═══════════════════════════════════════════════════════════════════════════ */
section('13 — the seal obeys the quiet-install promise');
{
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  /* Switched ON, but no palette claimed. */
  env.toggle('侧栏印章');
  ok(
    !env.slotRegistrations.some((r) => r.spec.name === 'sidebar.brand.mark'),
    'the seal registered while no hana palette was claimed, so it would replace the brand mark ' +
      'under the built-in themes too',
  );

  /* Claiming a palette afterwards must bring it up, or the switch would appear
     to do nothing until a reload. */
  env.claimPalette('hana-coral');
  ok(
    env.slotRegistrations.some((r) => r.spec.name === 'sidebar.brand.mark'),
    'the seal did not appear when a palette was claimed after the switch was thrown',
  );
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures) {
  console.error(`\nruntime: ${failures} FAILED of ${assertions} assertions`);
  process.exit(1);
}
console.log(`\nruntime: ${assertions} assertions pass (plugin executed, not read)`);
