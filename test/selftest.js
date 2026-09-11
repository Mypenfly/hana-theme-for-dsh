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
const SUITE = path.join(__dirname, 'runtime.test.js');

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
    id: 'contributes-without-a-claimed-palette',
    why: 'breaks the negative promise the architecture exists for: something is styled even though no hana palette was ever selected — "I installed a theme and it repainted my UI"',
    section: '1 —',
    find: 'return paletteById(stored) === null ? null : stored;',
    replace: 'return paletteById(stored) === null ? "hana-paper" : stored;',
  },
];

const verbose = process.argv.includes('--verbose');
const original = fs.readFileSync(BUNDLE, 'utf8');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-selftest-'));

console.log(`selftest: ${MUTATIONS.length} mutations against test/runtime.test.js\n`);

let missed = 0;
let inapplicable = 0;

for (const m of MUTATIONS) {
  const occurrences = original.split(m.find).length - 1;

  /* Guard one: a mutation that did not apply proves nothing. */
  if (occurrences !== 1) {
    inapplicable += 1;
    console.error(`INAPPLICABLE  ${m.id}`);
    console.error(`              anchor found ${occurrences} time(s), expected exactly 1 — the code moved; update this mutation`);
    if (verbose) console.error(`              anchor: ${JSON.stringify(m.find.slice(0, 90))}`);
    continue;
  }

  const mutated = original.replace(m.find, m.replace);
  const file = path.join(scratch, `${m.id}.js`);
  fs.writeFileSync(file, mutated);

  const started = Date.now();
  const run = spawnSync(process.execPath, [SUITE], {
    encoding: 'utf8',
    env: { ...process.env, HANA_BUNDLE: file },
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

/* The baseline: the unmutated bundle must pass, or "it failed" means nothing. */
const baseline = spawnSync(process.execPath, [SUITE], { encoding: 'utf8', timeout: 30000 });
if (baseline.status !== 0) {
  console.error('\nBASELINE FAILED — the unmutated bundle does not pass its own suite:');
  console.error(`${baseline.stdout || ''}${baseline.stderr || ''}`);
  missed += 1;
} else {
  console.log('\nbaseline      unmutated bundle passes');
}

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
