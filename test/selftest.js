'use strict';
/**
 * Does the runtime suite actually catch anything?
 *
 * This is the guard against the failure mode that makes a test suite worse than
 * no suite at all. A test that passes for the wrong reason looks exactly like a
 * test that passes for the right one, and nothing in a green run tells them
 * apart. This repo has already been on the wrong side of that: 91 contrast
 * assertions were passing while an entire colour channel was unreadable.
 *
 * So each mutation below takes the REAL bundle, injects a bug that either
 * actually happened in this project's history or is a plausible next one, runs
 * test/runtime.test.js in a fresh process against the mutated copy, and requires
 * it to fail.
 *
 * Two things make this honest rather than decorative:
 *
 *   1. The injection itself is verified. If the anchor text is not found — say
 *      because someone refactored the line — the mutation is reported as
 *      INAPPROPRIATE and counted as a failure. A mutation that silently did not
 *      apply would "pass" while proving nothing, which is the exact trap this
 *      file exists to close.
 *   2. The expected SECTION is checked in the output, not merely a non-zero
 *      exit. "Something failed" would also be satisfied by an unrelated crash.
 *
 * Usage: node test/selftest.js [--verbose]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'lib', 'client.js');

/**
 * Each mutation names the behaviour it breaks and the text that is supposed to
 * appear in the failure. `find` must appear EXACTLY once.
 *
 * `marker` defaults to the section header, so most mutations assert "the right
 * section noticed". A mutation may instead name an exact message when the
 * failure legitimately happens earlier — the syntax-palette one is caught by
 * assertLive() before any section runs, which is a stronger outcome, not a
 * weaker one.
 */
const MUTATIONS = [
  {
    id: 'override-layer-rebuilt-every-pass',
    why: 'loses the identity guard that stops overrideTokens() re-emitting theme/change into its own listener — the recursion §5.7 was made of',
    section: '4 —',
    find: '        if (wanted === overrideFor) return;\n',
    replace: '',
  },
  {
    id: 'reapply-not-deferred',
    why: 'runs the palette re-apply synchronously inside the emit, so the stale outer snapshot lands last and wipes it (judgement 20, §5.7④)',
    section: '6 —',
    find: '        ensureTimer = setTimeout(function () {\n          ensureTimer = null;\n          ensurePaletteApplied();\n        }, 0);',
    replace: '        ensureTimer = 0;\n        ensurePaletteApplied();',
  },
  {
    id: 'bind-with-bare-string',
    why: 'the exact §5.7① bug: scope.bind("name") leaves spec.namespace undefined, so the scope matches no describe row and every write goes nowhere — silently, in both directions',
    section: '7 —',
    find: 'scope = binder.bind({ namespace: NS });',
    replace: 'scope = binder.bind(NS);',
  },
  {
    id: 'write-gate-checks-writable-only',
    why: 'the classic form of the durability bug: a host-mode describe view answers writable=true while this namespace is still unserved, so the write lands nowhere and the dirty mark is cleared anyway',
    section: '7 —',
    find: 'return !!snap && snap.mode === "host" && snap.status === "ready" && !!snap.writable;',
    replace: 'return !!snap && !!snap.writable;',
  },
  {
    id: 'durability-warning-removed',
    why: 'silently drops the visible "did not persist" state — item ② of the lesson §5.7 produced, and the half that stops a user setting a switch that keeps forgetting',
    section: '7 —',
    find: 'prefs.durable() ? "（设置已保存）" : "（⚠️ 设置未能写入配置，重启后会丢失）"',
    replace: '"（设置已保存）"',
  },
  {
    id: 'palette-preference-not-pinned',
    why: 'stops re-asserting the preference, so a dark palette renders its LIGHT partner whenever the preference sits on `system` (composeActive picks the half from the active colorScheme)',
    section: '10 —',
    find: '          theme.setTheme(stored);\n        } catch (e) {\n          /* not registered yet; the next theme/change will retry */',
    replace: '          /* mutated: do not pin */\n        } catch (e) {\n          /* not registered yet; the next theme/change will retry */',
  },
  {
    id: 'syntax-palette-never-applied',
    why: 'drops the L1b apply, so code blocks keep colours chosen for a surface this palette does not have',
    section: '3 —',
    /* Caught EARLIER than section 3, by assertLive(): the harness notices the
       plugin stopped doing its core job before any behavioural section runs. */
    marker: 'expected 11 inline syntax properties',
    find: '        applyShiki(active === null ? stored : active);\n',
    replace: '',
  },
  {
    id: 'syntax-palette-never-cleared',
    why: 'leaves eleven inline custom properties on <body> after unload, so the next theme inherits this one’s code colours',
    section: '2 —',
    find: '        body.style.removeProperty(GRAIN_VAR);\n        clearShiki();',
    replace: '        body.style.removeProperty(GRAIN_VAR);',
  },
  {
    id: 'detach-leaves-body-attribute',
    why: 'leaves data-hana-theme set, so the whole typography stylesheet keeps matching after the theme is gone',
    section: '2 —',
    find: '        body.removeAttribute(BODY_ATTR);\n',
    replace: '',
  },
  {
    id: 'scale-out-of-range-not-rejected',
    why: 'writes an invalid factor into the markdown font SHORTHANDS, which makes every one of them invalid — the text then falls back to the inherited size instead of merely not being scaled, and that reads as a layout choice rather than a bug',
    section: '11 —',
    find: 'if (!Number.isFinite(n) || n < SCALE_MIN || n > SCALE_MAX) {',
    replace: 'if (false) {',
  },
  {
    id: 'seal-registered-unconditionally',
    why: 'drops both conditions on the seal — the opt-in switch and the claimed palette — so a brand mark replaces the shipped logo even under the built-in themes, which is the "I installed a theme and it repainted my UI" failure the whole architecture exists to prevent',
    section: '12 —',
    find: '        var want = claimed !== null && prefs.isOn("sealMark");',
    replace: '        var want = true;',
  },
  {
    id: 'seal-not-cleared-on-detach',
    why: 'leaves the sidebar brand-mark registration behind after unload, so the shipped logo never comes back',
    section: '12 —',
    find: '        clearShiki();\n        clearBrandMark();',
    replace: '        clearShiki();',
  },
  {
    id: 'contributes-without-a-claimed-palette',
    why: 'breaks the negative promise the architecture exists for: something is styled even though no hana palette was ever selected — "I installed a theme and it repainted my UI"',
    section: '1 —',
    find: 'return paletteById(stored) === null ? null : stored;',
    replace: 'return paletteById(stored) === null ? "hana-paper" : stored;',
  },

  /* ── the token gates (test/tokens.test.js) ────────────────────────────────
   * These mutate DIFFERENT files, which is why a mutation may name its target
   * and its suite. The P0 finding was that a name a shipped UI reads can be
   * declared by nobody, and the failure is silent: `var()` with no fallback
   * makes the declaration invalid at computed-value time, so the property
   * disappears instead of defaulting. A gate for that has to be shown to fail
   * when the supply is removed, or it is just decoration. */
  {
    id: 'read-name-not-supplied',
    why: 'drops the binding that supplies --dsw-alias-link, the name dsh-client-ui-primitives reads with no fallback — links silently lose their colour',
    suite: 'tokens',
    marker: 'with no fallback',
    find: '      "--dsw-alias-link": "--dsw-alias-brand-text",\n',
    replace: '',
  },
  {
    id: 'binding-points-at-a-role-that-does-not-exist',
    why: 'typos the binding target, so the palette would gain a declaration whose value is `undefined` — a CSS custom property with no value, which is exactly the silent hole the binding exists to close',
    suite: 'tokens',
    marker: 'which that palette does not define',
    find: '"--dsw-alias-separator-primary": "--dsw-alias-border-l1",',
    replace: '"--dsw-alias-separator-primary": "--dsw-alias-border-l1-typo",',
  },
  {
    id: 'declined-read-not-recorded',
    why: 'strips the recorded decline for --dsw-alias-font-mono from the generated allow-list, so the theme neither supplies it nor says why — the exact "nobody noticed" state the ledger exists to prevent',
    suite: 'tokens',
    marker: 'must say so in DECLINED_READS',
    file: 'test/token-allowlist.json',
    /* The anchor starts at the comma so the removal leaves VALID JSON. Without
       it the mutation fails as a parse error, which the suite does report — but
       for the wrong reason, and a mutation caught by a syntax error proves
       nothing about the gate it is supposed to exercise. */
    find: ',\n      "declined": "a FONT channel, not a colour: this theme restyles the reading typography (--dsw-font-markdown-*) and deliberately leaves the UI chrome face alone. Its fallback, `ui-monospace, monospace`, is already the right stack."\n',
    replace: '\n',
  },

  /* ── the ink ramp (test/contrast.test.js #29) ─────────────────────────────
   * Both mutations restore a value this project actually shipped. A gate for
   * "the hierarchy has a shape" is worth nothing unless it fails on the shape
   * that was there before. */
  {
    id: 'caption-tied-to-tertiary',
    why: 'restores 纸本\'s shipped caption, which was byte-identical to its tertiary — two named levels of hierarchy rendered as one colour, and the reason the theme documented five ink stops while shipping four',
    suite: 'ramp',
    marker: 'the SAME COLOUR',
    find: '      "--dsw-alias-label-caption": "#7C7066",\n',
    replace: '      "--dsw-alias-label-caption": "#6B6158",\n',
  },
  {
    id: 'ramp-middle-made-arbitrary',
    why: 'restores 珊瑚\'s shipped secondary, which sat 60% off the even step between its two anchors — the palette read with a visibly different hierarchy from its siblings',
    suite: 'ramp',
    marker: 'is not geometric',
    find: '      "--dsw-alias-label-secondary": "#405062",\n',
    replace: '      "--dsw-alias-label-secondary": "#314153",\n',
  },
  {
    id: 'hover-toward-the-surface',
    why: 'restores 珊瑚\'s shipped hover fill, the only state in the theme that made a primary button WEAKER (12.52:1 -> 10.80:1) exactly when the pointer said it was the target',
    suite: 'ramp',
    marker: 'moves TOWARD the surface',
    find: '      "--dsw-alias-button-primary-hover": "#091E36",\n',
    replace: '      "--dsw-alias-button-primary-hover": "#243A55",\n',
  },
  {
    id: 'layer-3-paints-nothing',
    why: 'restores 青夜\'s shipped bg-layer-3, whose lightness was EXACTLY the ground\'s — a surface read by 21 stylesheets that painted nothing, and the value that broke the nesting model',
    suite: 'ramp',
    marker: 'nesting must go deeper',
    find: '      "--dsw-alias-bg-layer-3": "#303E47",\n',
    replace: '      "--dsw-alias-bg-layer-3": "#3C4A52",\n',
  },
];

const verbose = process.argv.includes('--verbose');
const SUITES = {
  runtime: path.join(__dirname, 'runtime.test.js'),
  tokens: path.join(__dirname, 'tokens.test.js'),
  ramp: path.join(__dirname, 'contrast.test.js'),
};
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-selftest-'));

/** Original text of every file a mutation targets, read once. */
const sources = new Map();
const sourceOf = (rel) => {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!sources.has(abs)) sources.set(abs, fs.readFileSync(abs, 'utf8'));
  return sources.get(abs);
};

const suiteNames = [...new Set(MUTATIONS.map((m) => m.suite || 'runtime'))];
console.log(
  `selftest: ${MUTATIONS.length} mutations against ` +
    suiteNames.map((s) => 'test/' + s + '.test.js').join(' + ') + '\n',
);

let missed = 0;
let inapplicable = 0;

for (const m of MUTATIONS) {
  const target = m.file || BUNDLE;
  const original = sourceOf(target);
  const occurrences = original.split(m.find).length - 1;

  /* Guard one: a mutation that did not apply proves nothing. */
  if (occurrences !== 1) {
    inapplicable += 1;
    console.error(`INAPPLICABLE  ${m.id}`);
    console.error(`              anchor found ${occurrences} time(s), expected exactly 1 — the code moved; update this mutation`);
    if (verbose) console.error(`              anchor: ${JSON.stringify(m.find.slice(0, 90))}`);
    continue;
  }

  /* The mutated copy is written to the scratch dir, never over the real file,
     and HANA_BUNDLE points the suite at it. A mutation whose target is not the
     bundle is written to a sibling copy so its path can be handed over too. */
  const mutated = original.replace(m.find, m.replace);
  const file = path.join(scratch, `${m.id}${path.extname(target) || '.js'}`);
  fs.writeFileSync(file, mutated);

  const suite = SUITES[m.suite || 'runtime'];
  const started = Date.now();
  const run = spawnSync(process.execPath, [suite], {
    encoding: 'utf8',
    env: {
      ...process.env,
      /* The bundle travels through HANA_BUNDLE (both loaders honour it) and a
         generated data file through HANA_ALLOWLIST (test/tokens.test.js honours
         it). Either way the real file is never written. */
      ...(target === BUNDLE ? { HANA_BUNDLE: file } : { HANA_ALLOWLIST: file }),
    },
    /* A mutated bundle can run away rather than fail politely — removing the
       override-identity guard produces unbounded re-layering, which churns for
       thirteen seconds before the stack finally gives. A HANG IS A FAILURE, so
       the timeout is short and a timeout counts as caught. */
    timeout: 6000,
  });
  const elapsed = Date.now() - started;

  /* A subprocess that could not start is an environment problem, not a caught
     bug, and counting it as "caught" would be the very vacuity this file exists
     to prevent. Say so plainly and stop. */
  if (run.error && run.error.code !== 'ETIMEDOUT') {
    console.error(`\nCANNOT SPAWN ${process.execPath}: ${run.error.message}`);
    console.error('This self-test runs the runtime suite in a child process. Verify by hand with:');
    console.error('  HANA_BUNDLE=<mutated-copy> node test/runtime.test.js');
    fs.rmSync(scratch, { recursive: true, force: true });
    process.exit(2);
  }

  const timedOut = !!(run.error && run.error.code === 'ETIMEDOUT');
  const output = `${run.stdout || ''}${run.stderr || ''}`;

  /* Guard two: it must fail, and it must fail in the RIGHT place. A non-zero
     exit alone would also be satisfied by an unrelated crash — and a timeout
     alone would be satisfied by a slow machine, so a timeout must ALSO show the
     expected marker before it counts. */
  const failed = run.status !== 0 || timedOut;
  const expected = m.marker || m.section;
  const rightSection = output.includes(expected);

  if (failed && rightSection) {
    console.log(`ok            ${m.id}${timedOut ? '  (runaway, killed at 6s)' : ''}`);
    if (verbose) {
      console.log(`              caught by ${JSON.stringify(expected)}  in ${elapsed}ms`);
    }
  } else if (timedOut) {
    console.log(`INCONCLUSIVE  ${m.id} — timed out without reaching "${expected}"`);
    missed += 1;
  } else if (failed) {
    console.log(`WRONG PLACE   ${m.id} (suite failed, but without "${expected}")`);
    if (verbose) console.log(output.split('\n').filter((l) => l.includes('✗')).slice(0, 4).join('\n'));
    missed += 1;
  } else {
    console.log(`NOT CAUGHT    ${m.id} — the suite passed against a known-broken bundle`);
    missed += 1;
  }

  fs.unlinkSync(file);
}

/* The baseline: the unmutated sources must pass every suite involved, or "it
   failed" means nothing. */
let baselineBad = 0;
for (const name of suiteNames) {
  const run = spawnSync(process.execPath, [SUITES[name]], { encoding: 'utf8', timeout: 30000 });
  if (run.status !== 0) {
    console.error(`\nBASELINE FAILED — the unmutated sources do not pass test/${name}.test.js:`);
    console.error(`${run.stdout || ''}${run.stderr || ''}`);
    baselineBad += 1;
  }
}
if (baselineBad) missed += 1;
else console.log(`\nbaseline      unmutated sources pass ${suiteNames.length} suite(s)`);

fs.rmSync(scratch, { recursive: true, force: true });

console.log(
  `\nselftest: ${MUTATIONS.length - missed - inapplicable}/${MUTATIONS.length} mutations caught` +
    (inapplicable ? `, ${inapplicable} inapplicable` : ''),
);

if (missed || inapplicable) {
  console.error(
    '\nThe runtime suite is not trustworthy until every mutation is caught. A mutation that is\n' +
      'not caught is a behaviour nothing is guarding; one that is INAPPLICABLE is a guard that\n' +
      'was silently disconnected by a refactor.',
  );
  process.exit(1);
}
