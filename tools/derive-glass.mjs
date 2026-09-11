#!/usr/bin/env node
/**
 * Derive the glass layer: the surfaces that FLOAT, and hold them to the
 * reference's own `--bg-glass`.
 *
 * WHY THIS EXISTS
 * ---------------
 * HanaAgent spends one token, `--bg-glass`, on the small chips that hover over
 * content that scrolls underneath them: its find box, the markdown diagnostics
 * badge, the preview hint, the code-block copy tooltip. Measured across all 11
 * source themes the COLOUR has no rule -- five take `--bg-card`, five take
 * `--bg` (the ground), and `warm-paper` takes neither. It is hand-picked per
 * theme, so it is TRANSCRIBED here, exactly the way the wash ladder is.
 *
 * The ALPHA does have a rule, and it is the useful half: nine themes sit at
 * .92 and the two at .94 are precisely the two CONTRAST variants
 * (`high-contrast`, `midnight-contrast`). Less bleed-through is what a contrast
 * theme is for, so 斑斓 -- our port of `midnight-contrast` -- is .94 and the
 * other three are .92. That rule is asserted below against each palette's
 * source theme rather than restated as a list of one exception.
 *
 * WHERE IT LANDS, AND WHY ONLY THERE
 * ----------------------------------
 * DSH has no token whose job is "a chip over content". Scanning every rule that
 * paints a `--dsw-*` surface AND takes the element out of flow
 * (absolute/fixed/sticky, or a z-index stack) leaves:
 *
 *   --dsw-specific-menu                11 rules   popovers -- and the reference
 *                                                  keeps EVERY menu opaque
 *                                                  (`var(--bg-card)` in all 11
 *                                                  themes, so ours is already
 *                                                  faithful and is NOT changed)
 *   --dsw-alias-bg-layer-1/2            7 rules   shared with every card in the
 *                                                  app, so they cannot be made
 *                                                  translucent without making
 *                                                  the whole page glass
 *   --dsw-alias-button-floating-fill    1 rule    the 回到底部 button: sticky,
 *                                                  34x34, floating over the
 *                                                  message list. This is the
 *                                                  one, and it is the only one.
 *   --dsw-alias-button-tool-bar-fill    0 call    the design system declares it
 *                                                  as a 50%-alpha surface, ships
 *                                                  the rule, and renders it from
 *                                                  no call site at all
 *
 * So the family is small on purpose. A chip that floats gets glass; a card in
 * the flow stays opaque; a menu stays opaque because the reference says so.
 *
 * WHY HOVER IS NOT `alpha + 0.10`
 * -------------------------------
 * DSH's own step for its toolbar surface is .50 -> .60. Carried to .92 that is
 * 1.02, clamped to 1.00 -- and the composite difference between .92 and 1.00
 * over paper is about 1/255. An invisible hover. The reference does something
 * else instead: it lays an INK WASH over the chip
 * (`.findBox button:hover { background: var(--overlay-subtle) }`,
 * `.bridgeAgentMenuItem:hover { background: rgba(0,0,0,0.04) }`). So hover here
 * is the glass colour stepped toward the palette's ink by the palette's own
 * hover step -- read from tools/derive-wash.mjs, never copied -- with the alpha
 * unchanged. HOVER_FLOOR then proves the step is a step.
 *
 * WHAT IT CHECKS
 * --------------
 *   --check   every glass token matches its palette's source theme
 *   --json    the changes, in the form .research/apply-changes.cjs consumes
 *   --list    the family and the floating-surface census, the planning view
 */

import { loadClient } from '../test/load-client.js';
import { parse, composite, deltaE } from '../test/color.js';
import { LADDER, inkOf } from './derive-wash.mjs';

const { PALETTES } = loadClient().exports;

/* Transcribed from each palette's own source theme -- but only the SHAPE of the
   choice, not the colour. The reference hand-picks WHICH surface its glass is
   (five themes take the card, five the ground, one neither), so that choice is
   the fact worth recording; the triple then comes from OUR palette's own token,
   the way `derive-wash` takes the ladder from the reference and the hue from
   the palette. Transcribing the literal instead would drop 纸本's chip on a
   colour (`#FBF7EE`) that appears nowhere else in this theme, because our card
   there is the DERIVED paper-on-paper step rather than a copied value. */
const GLASS = {
  'hana-paper': { theme: 'themes/new-warm-paper.css:12', alpha: 0.92, equals: 'card' },
  'hana-midnight': { theme: 'themes/midnight.css:10', alpha: 0.92, equals: 'ground' },
  'hana-coral': { theme: 'themes/coral.css:10', alpha: 0.92, equals: 'card' },
  'hana-midnight-vivid': { theme: 'themes/midnight-contrast.css:10', alpha: 0.94, equals: 'ground' },
};
const SURFACE_OF = { card: '--dsw-alias-bg-layer-1', ground: '--dsw-alias-bg-base' };

/* Which shipped token carries which step of the family, and why. Every entry
   names the DSH surface that makes it a member -- the mapping is argued from a
   consumer, never from the token's English name. */
const CHIPS = {
  '--dsw-alias-button-floating-fill': {
    step: 'fill',
    why: 'the 回到底部 button in dsh-client-ui-chat (`.V0s2hW_toBottom`, position: sticky, 34x34): the one surface installed today that floats over content',
  },
  '--dsw-alias-button-tool-bar-fill': {
    step: 'fill',
    why: 'the design system\'s own translucent surface -- DSH ships it as #54555780, i.e. 50% -- so it is the token whose MEANING is glass',
  },
  '--dsw-alias-button-floating-hover': { step: 'hover', why: 'the same chip, pointed at' },
  '--dsw-alias-button-tool-bar-hover': { step: 'hover', why: 'DSH ships .60 against the fill\'s .50: hover is a step of the same surface' },
  '--dsw-alias-button-tool-bar-fill-invisible': {
    step: 'invisible',
    why: 'the same colour at alpha 0, so the family reads as one ladder: 0 -> .92 (or .94) -> 1.00',
  },
};

/* Recorded leaks: members of the design system's glass vocabulary with no live
   call site. The RULE is shipped -- `._toolbar_cfgyt_65` in dsh-web-frontend's
   bundled CSS, `.toolbar` in dsh-client-ui-primitives/lib/Button.module.css --
   but the class is applied to nothing: in the whole web frontend bundle that
   hash occurs exactly once, in the class map export. If a DSH upgrade starts
   rendering the variant, this list must shrink; that is what makes it a record
   instead of a skip. */
const UNPAINTED = {
  '--dsw-alias-button-tool-bar-fill':
    'the shipped .toolbar rule has no call site, so the token is declared and never applied. ' +
    'Supplied anyway, because leaving it opaque would be this theme overriding a translucent ' +
    'surface with a sticker the moment DSH renders it.',
  '--dsw-alias-button-tool-bar-hover': 'same',
  '--dsw-alias-button-tool-bar-fill-invisible': 'same',
};

/* The smallest hover step worth shipping. Measured (OKLab dE of the composited
   chip): .0221 paper, .0313 midnight, .0279 coral, .0516 vivid. The naive
   `alpha + 0.10` clamp lands at .0015, so the floor is set well clear of a real
   step and well above a fake one. */
const HOVER_FLOOR = 0.015;

const hexOf = (h) => {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
/* Alpha 0 is written as a bare 0, matching the convention already in the
   palettes -- the first run of this tool produced `0.00` and every one of the
   four `-invisible` tokens read as a mismatch when only the spelling differed. */
const rgba = (h, a) => {
  const [r, g, b] = hexOf(h);
  return `rgba(${r},${g},${b},${a === 0 ? '0' : a.toFixed(2)})`;
};

const failures = [];
const changes = [];

for (const palette of PALETTES) {
  const glass = GLASS[palette.id];
  const lad = LADDER[palette.id];
  if (!glass) { failures.push(`no glass value declared for ${palette.id}; add its source theme`); continue; }
  if (!lad) { failures.push(`${palette.id}: no wash ladder, so there is no hover step to read`); continue; }

  /* The alpha rule, asserted rather than transcribed twice: a CONTRAST source
     theme is the one at .94. Written as an implication so a fifth palette
     cannot arrive with a silently wrong alpha. */
  const isContrast = /contrast\.css$/.test(lad.theme);
  const wantAlpha = isContrast ? 0.94 : 0.92;
  if (glass.alpha !== wantAlpha) {
    failures.push(
      `${palette.id}: ${glass.theme} is ${isContrast ? 'a contrast' : 'not a contrast'} theme, ` +
        `so its glass alpha is ${wantAlpha}, but ${glass.alpha} is recorded`,
    );
  }

  const tokens = palette.tokens;
  const ink = inkOf(palette);
  if (!ink) { failures.push(`${palette.id} has no --dsw-alias-label-primary to take the hover wash from`); continue; }

  /* The colour comes from OUR token, so it cannot become an orphan: whatever the
     palette's card or ground is today -- derived, corrected, re-derived -- the
     chip is that colour, and the only thing coming from the reference is which
     of the two it is and how transparent. */
  const source = SURFACE_OF[glass.equals];
  const colour = tokens[source];
  if (!colour) { failures.push(`${palette.id}: the glass is the ${glass.equals}, but ${source} is not supplied`); continue; }
  if (!/^#[0-9a-fA-F]{6}$/.test(colour)) {
    failures.push(`${palette.id}: ${source} is ${colour}, not an opaque hex, so the glass cannot be built from it`);
    continue;
  }

  const base = hexOf(colour);
  const fill = rgba(colour, glass.alpha);
  const hover = rgba(hex(mix(base, hexOf(ink), lad.light)), glass.alpha);
  const invisible = rgba(colour, 0);
  const ground = tokens['--dsw-alias-bg-base'];
  if (!ground) { failures.push(`${palette.id} supplies no --dsw-alias-bg-base to composite against`); continue; }

  const fillOver = composite(parse(fill), parse(ground));

  /* The provenance label has to agree with the palette. `card` and `ground` are
     two different colours in every one of these palettes, so a mislabelled entry
     silently picks the wrong paper -- and the result still looks like paper. */
  const other = SURFACE_OF[glass.equals === 'card' ? 'ground' : 'card'];
  if (glass.equals === 'ground' && tokens[other] !== undefined && tokens[other] === colour && tokens[other] !== ground) {
    failures.push(`${palette.id}: the glass is labelled the ground but resolves to the same colour as ${other}`);
  }

  for (const [name, spec] of Object.entries(CHIPS)) {
    const want = spec.step === 'fill' ? fill : spec.step === 'hover' ? hover : invisible;
    const from = tokens[name];
    if (from === undefined) { failures.push(`${palette.id}: ${name} is not supplied at all`); continue; }
    if (from !== want) {
      changes.push({ palette: palette.id, name, from, to: want, step: spec.step, theme: glass.theme });
      failures.push(`${palette.id}: ${name} is ${from}, but the ${spec.step} of ${glass.theme} is ${want}`);
    }
  }

  /* The hover must be a visible step, and the check has to read the values the
     palette SHIPS rather than the ones derived above. The first version compared
     the derivation against itself: it would have passed just as happily against a
     shipped hover that was invisible, because the mutation never entered the
     arithmetic. `npm run selftest` caught exactly that -- the mutation that
     clamps DSH's .50 -> .60 step onto .92 failed on the value check and never
     reached this one. */
  const shippedFill = tokens['--dsw-alias-button-floating-fill'];
  const shippedHover = tokens['--dsw-alias-button-floating-hover'];
  if (typeof shippedFill === 'string' && typeof shippedHover === 'string') {
    const shippedStep = deltaE(
      composite(parse(shippedHover), parse(ground)),
      composite(parse(shippedFill), parse(ground)),
    );
    if (!(shippedStep >= HOVER_FLOOR)) {
      failures.push(
        `${palette.id}: the SHIPPED hover ${shippedHover} moves the glass chip by dE ` +
          `${shippedStep.toFixed(4)} against a floor of ${HOVER_FLOOR} -- at ` +
          `.${String(Math.round(glass.alpha * 100))} alpha a colour-only hover is invisible (DSH's own ` +
          '+0.10 alpha step clamps to 1.00 here and lands at dE 0.002), which is why the hover step is ' +
          'a wash (see the header)',
      );
    }
  }

  /* Note, for the reader of a --check failure above: the reference's dark
     themes take `--bg`, so their glass composites to exactly the ground and the
     chip is told apart by its hairline and shadow rather than by lightness.
     `--list` prints that distance, which is why the tool demands none. */
}

const asJson = process.argv.includes('--json');

if (asJson) {
  /* The applier's shape: { paletteId: { token: { from, to } } }. `step`/`theme`
     are extra keys it ignores, and they make the diff self-explaining. */
  const out = {};
  for (const c of changes) {
    (out[c.palette] ||= {})[c.name] = { from: c.from, to: c.to, step: c.step, theme: c.theme };
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (process.argv.includes('--list')) {
  for (const palette of PALETTES) {
    const g = GLASS[palette.id];
    const lad = LADDER[palette.id];
    if (!g || !lad) continue;
    const colour = palette.tokens[SURFACE_OF[g.equals]];
    if (!colour) continue;
    const fill = rgba(colour, g.alpha);
    const hover = rgba(hex(mix(hexOf(colour), hexOf(inkOf(palette)), lad.light)), g.alpha);
    console.log(`\n${palette.id}  (${g.theme})  glass = the ${g.equals} ${colour} = ${fill}`);
    console.log(`  hover   ${hover}   (ink ${inkOf(palette)} at the ladder's light step ${lad.light})`);
    console.log(`  ground  ${palette.tokens['--dsw-alias-bg-base']}`);
    const over = composite(parse(fill), parse(palette.tokens['--dsw-alias-bg-base']));
    console.log(
      `  over the ground the chip moves it by dE ${deltaE(over, parse(palette.tokens['--dsw-alias-bg-base'])).toFixed(4)}` +
        (g.equals === 'ground' ? '  <- 0 by construction: a dark theme\'s glass IS the page' : ''),
    );
  }
  console.log('\nfloating-surface census (tokens painted by a rule that leaves the flow):');
  console.log('  specific-menu                 11  popovers -- reference keeps menus OPAQUE, so unchanged');
  console.log('  bg-layer-1 / bg-layer-2        7  shared with every card; cannot be glassed alone');
  console.log('  button-floating-fill           1  the 回到底部 chip -- this is the glass slot');
  console.log('  button-tool-bar-fill           0 CSS rule, 0 call sites: the .toolbar variant is never rendered');
  console.log('  (census from the surface-role ledger and the installed bundles; scan-surface-roles scans CSS,');
  console.log('   so a declared-but-unrendered surface still counts as one this theme must supply)');
  console.log('\nunpainted members of the family:');
  for (const [name, why] of Object.entries(UNPAINTED)) console.log(`  ${name}: ${why}`);
  process.exit(0);
}

if (process.argv.includes('--check')) {
  if (failures.length) {
    console.error(`derive-glass: ${failures.length} glass value(s) are off the reference\n`);
    for (const f of failures) console.error('  ✗ ' + f);
    console.error('\nRun `node tools/derive-glass.mjs --json > .research/glass-changes.json` and apply it.');
    process.exit(1);
  }
  const n = Object.keys(CHIPS).length * PALETTES.length;
  console.log(
    `derive-glass: all ${n} glass values match their palette's own source theme ` +
      `(${Object.keys(GLASS).length} transcribed, alpha .92/.94 by contrast variant)`,
  );
  process.exit(0);
}

console.error('usage: node tools/derive-glass.mjs --check | --json | --list');
process.exit(2);
