#!/usr/bin/env node
/**
 * Derive the 薄染 (thin-wash) ladder, and hold every wash token to its step.
 *
 * WHY THIS EXISTS
 * ---------------
 * HanaAgent does not hand-pick hover alphas. It declares ONE four-step ladder per
 * theme -- `--overlay-subtle / -light / -medium / -strong` -- and every hover,
 * press, selection and quiet surface draws from it. Measured from the source
 * themes (the second column is the file each palette is ported from):
 *
 *             subtle  light  medium  strong
 *   paper       .03    .04     .08     .15     themes/new-warm-paper.css
 *   coral       .03    .05     .08     .15     themes/coral.css
 *   midnight    .03    .05     .08     .15     themes/midnight.css
 *   vivid       .04    .07     .11     .18     themes/midnight-contrast.css
 *
 * Two things are worth reading off that table. First, the STEPS ARE NOT UNIVERSAL:
 * the contrast variant runs heavier at every step, which is the whole point of it.
 * Second, the HUE is the theme's own ink -- rgba(42,38,34,·) in paper, rgba(26,48,73,·)
 * in coral, pure white in the dark themes. DSH has no such ladder, so hana's wash
 * tokens were each picked by hand, and they drifted in exactly the way a hand-picked
 * set drifts: 斑斓 -- the CONTRAST palette -- ended up with the LIGHTEST fills of the
 * four (.04/.07 against 青夜's .05/.08), i.e. backwards.
 *
 * THE HUE IS DERIVED, NOT TRANSCRIBED -- and the rule is the REFERENCE'S, not
 * "always the ink". Light palettes tint the wash with their ink, and there the
 * derivation is exact: paper's label-primary IS rgb(42,38,34) and coral's IS
 * rgb(26,48,73), the same triples the reference writes by hand. Dark palettes
 * flip POLARITY and use pure white -- that is the polarity flip HanaAgent
 * legislates for its overlays (`styles.css:58-59` records the box-shadow incident
 * it caused) -- so white is what the derivation must produce there.
 *
 * The first version of this file used the ink for all four, which would have
 * rewritten 青夜's six correct white washes to a near-white blue (#E1EAF0) and
 * called it a "1/255 deviation". The shipped values were the faithful ones and the
 * tool was the thing that was wrong; the drift report is what surfaced it.
 *
 * WHAT IT CHECKS
 * --------------
 *   --check   the shipped alphas match the ladder for each palette's own theme
 *   --json    the changes, in the form .research/apply-changes.cjs consumes
 *   --list    the ladder and its consumers, the planning view
 *
 * A step with no consumer is an ERROR unless it is named in UNCONSUMED with a
 * reason, so a declared-but-unused step cannot quietly accumulate.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadClient } from '../test/load-client.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { PALETTES } = loadClient().exports;

/* Transcribed from each palette's source theme. Keys are the reference's own
   custom-property suffixes; the ORDER is the ladder and is asserted. */
const LADDER = {
  'hana-paper': { theme: 'themes/new-warm-paper.css', subtle: 0.03, light: 0.04, medium: 0.08, strong: 0.15 },
  'hana-midnight': { theme: 'themes/midnight.css', subtle: 0.03, light: 0.05, medium: 0.08, strong: 0.15 },
  'hana-coral': { theme: 'themes/coral.css', subtle: 0.03, light: 0.05, medium: 0.08, strong: 0.15 },
  'hana-midnight-vivid': { theme: 'themes/midnight-contrast.css', subtle: 0.04, light: 0.07, medium: 0.11, strong: 0.18 },
};
const STEPS = ['subtle', 'light', 'medium', 'strong'];

/* Which shipped wash token belongs to which step, and WHY. Every entry names the
   reference rule that puts it there -- a mapping argued from a component rather
   than from the token's English name. */
const CONSUMERS = {
  light: [
    ['--dsw-alias-interactive-bg-hover', 'a:hover, and HanaAgent puts --overlay-light on .processFoldSummary:hover'],
    ['--dsw-specific-sidebar-nav-item-hover', 'the same hover step, one level down a nav tree'],
  ],
  medium: [
    ['--dsw-alias-interactive-bg-active', 'the pressed step'],
    ['--dsw-alias-button-ghost-active-fill', 'a ghost button held down'],
    ['--dsw-specific-sidebar-nav-item-active', 'the selected nav row'],
  ],
};

/* Declared by the reference, no consumer here, and each for a stated reason. If a
   consumer is ever added, this map must shrink -- that is what makes it a record
   rather than a skip. */
const UNCONSUMED = {
  subtle:
    'the quietest step. Consumed in CSS, not through a registered token: the process ' +
    'region paints --hana-wash, which is this step. See lib/client.js.',
  strong:
    'the heaviest step. In HanaAgent it lands on the Windows scrollbar thumb and on ' +
    "midnight's segmented-control slider. DSH draws scrollbars from --dsw-alias-scrollbar-* as " +
    'OPAQUE colours and has no slider token, so there is nothing here for it to tint. ' +
    'It is deliberately not given an invented consumer: a step nobody reads is worse than ' +
    'a step that is honestly absent.',
};

/* Light: the palette's ink. Dark: pure white, per the reference's polarity flip. */
const inkOf = (palette) => (palette.scheme === 'dark' ? '#FFFFFF' : palette.tokens['--dsw-alias-label-primary']);
const rgba = (hex, alpha) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
};

const failures = [];
const changes = {};

/* Exported so tools/derive-glass.mjs can read the ladder rather than restate it:
   a glass chip's hover step IS the palette's hover step, and two copies of that
   table would be exactly the drift this project keeps finding. The script body
   below is therefore guarded -- importing this file must not run the gate. */
export { LADDER, STEPS, CONSUMERS, UNCONSUMED, inkOf, rgba };

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
for (const palette of PALETTES) {
  const lad = LADDER[palette.id];
  if (!lad) { failures.push(`no ladder declared for ${palette.id}; add its source theme`); continue; }
  const tokens = palette.tokens;
  const ink = inkOf(palette);
  if (!ink) { failures.push(`${palette.id} has no --dsw-alias-label-primary to take the hue from`); continue; }

  /* The ladder must ascend. A theme whose steps cross cannot be read as a scale,
     and crossing is precisely the drift this tool was written to stop. */
  for (let i = 1; i < STEPS.length; i += 1) {
    if (!(lad[STEPS[i]] > lad[STEPS[i - 1]])) {
      failures.push(`${palette.id}: the ladder does not ascend at ${STEPS[i]} (${lad[STEPS[i]]} <= ${lad[STEPS[i - 1]]})`);
    }
  }

  for (const step of STEPS) {
    const consumers = CONSUMERS[step] || [];
    if (consumers.length === 0 && !UNCONSUMED[step]) {
      failures.push(`${palette.id}: step ${step} has no consumer and no recorded reason`);
      continue;
    }
    const want = rgba(ink, lad[step]);
    for (const [name] of consumers) {
      const from = tokens[name];
      if (from === undefined) { failures.push(`${palette.id}: ${name} is not supplied at all`); continue; }
      if (from !== want) {
        (changes[palette.id] ||= {})[name] = { from, to: want, step, theme: lad.theme };
        failures.push(
          `${palette.id}: ${name} is ${from}, but the ${step} step of ${lad.theme} is ${want}`,
        );
      }
    }
  }
}

const check = process.argv.includes('--check');
const asJson = process.argv.includes('--json');

if (asJson) {
  /* Only the mismatches, in the applier's shape. The `step`/`theme` keys are extra
     and the applier ignores them; they make the diff self-explaining. */
  console.log(JSON.stringify(changes, null, 2));
  process.exit(0);
}

if (process.argv.includes('--list')) {
  for (const palette of PALETTES) {
    const lad = LADDER[palette.id];
    if (!lad) continue;
    console.log(`\n${palette.id}  (${lad.theme})  wash hue ${inkOf(palette)}`);
    for (const step of STEPS) {
      const consumers = (CONSUMERS[step] || []).map(([n]) => n.replace('--dsw-alias-', '').replace('--dsw-specific-', '§'));
      console.log(`  ${step.padEnd(7)} ${String(lad[step]).padEnd(5)} ${consumers.join(', ') || '(none — ' + UNCONSUMED[step].slice(0, 40) + '…)'}`);
    }
  }
  process.exit(0);
}

if (check) {
  if (failures.length) {
    console.error(`derive-wash: ${failures.length} wash token(s) are off the ladder\n`);
    for (const f of failures) console.error('  ✗ ' + f);
    console.error('\nRun `node tools/derive-wash.mjs --json > .research/wash-changes.json` and apply it.');
    process.exit(1);
  }
  const total = STEPS.reduce((n, s) => n + (CONSUMERS[s] || []).length, 0);
  console.log(
    `derive-wash: all ${total * PALETTES.length} wash values sit on their palette's own ladder ` +
      `(${Object.keys(LADDER).length} ladders transcribed from the reference themes)`,
  );
  process.exit(0);
}

console.error('usage: node tools/derive-wash.mjs --check | --json | --list');
process.exit(2);
}
