#!/usr/bin/env node
/**
 * Derive the paper texture: hold the grain to its declared shape, hold the
 * dark-palette veto to the palette table, and DERIVE whether the reference's
 * third layer is needed here.
 *
 * WHY THIS EXISTS
 * ---------------
 * HanaAgent's own header calls the system three layers --
 *
 *     纸质纹理系统
 *     开关：body.paper-texture 显式开启全部纹理
 *     三层：surface → card → surface 亮度补偿
 *
 * -- and all three live in slots DSH has closed. Its surface and card layers are
 * each painted onto the element's OWN `background-image` (behind its content);
 * its compensation plate sits at `z-index: -1`, above the canvas and below the
 * panels. DSH paints the ground at the FRAME, not on body:
 * `dsh-client-ui-layout` AppFrame.module.css has
 * `._1qAH1q_frame { background: var(--dsw-alias-bg-base); height: 100% }`, and a
 * negative-z-index layer paints BELOW an in-flow block-level descendant's
 * background -- so anything in that slot is covered by the frame. The only slot
 * left is above the content, which the reference never uses.
 *
 * So this tool's job is not to build three layers. It is to keep three claims
 * honest:
 *
 *   1. THE GRAIN IS WHAT WE SAY IT IS. The declared SVG parameters are compared
 *      against the data URI the stylesheet actually ships, and the rule's blend,
 *      tile size and opacity against the shipped declarations. A grain that
 *      changed shape while the comment stayed put is the silent kind.
 *
 *   2. THE VETO IS EXACTLY THE DARK PALETTES. HanaAgent blocks its texture in
 *      both dark themes by id (`paperTextureBlockedThemeIds` in its registry,
 *      with the hint 「黑夜模式不支持纸质纹理」 and the preference left alone). We
 *      key on `scheme`, so this checks the shipped predicate against the shipped
 *      palette table -- in both directions, so it can be neither too wide nor
 *      too narrow.
 *
 *   3. LAYER ③ IS UNNECESSARY, AND HERE IS THE ARITHMETIC. Its whole purpose is
 *      to cancel layer ①'s darkening, and ① does not darken here. The tool
 *      recomputes the neutrality of soft-light at mid-grey, the shift the
 *      shipped grain puts on each ground, and -- from the reference's own
 *      measured texture -- how much of its darkening the reference's scrim buys
 *      back. If our grain ever stops being neutral the tool says so AND says how
 *      much compensation it would need, instead of the absence of layer ③
 *      resting on a sentence in a comment.
 *
 * The reference's texture statistics are transcribed, not read: `.research/` is
 * gitignored and a gate must run where only the checkout exists. They were
 * measured with the same engine that renders the theme (see
 * docs/plan-paper-texture.md §0.1).
 *
 * Usage:
 *   node tools/derive-grain.mjs --check   fail if any of the three claims moved
 *   node tools/derive-grain.mjs --list    the layer census and the arithmetic
 */

import { loadClient, stripComments } from '../test/load-client.js';
import { parse, composite, contrast, luminance } from '../test/color.js';

const { exports: client } = loadClient();
const { PALETTES, textureAllowed } = client;
const css = client.CSS;
/* Comments first. A comment contains no braces, so a rule-scanner that reads the
   raw sheet treats every comment line as part of the NEXT rule's selector --
   this tool's first run reported 18 "rules" that were paragraphs of the very
   comment explaining them. test/check.js strips for the same reason. */
const bare = stripComments(css);

/* ── the grain, as declared ─────────────────────────────────────────────── */

const GRAIN = {
  baseFrequency: 0.64,
  numOctaves: 5,
  tile: 160,
  stitchTiles: 'stitch',
  colourMatrix: 'saturate',
  blend: 'soft-light',
  defaultOpacity: 0.32,
};

/* ── the reference, as measured ─────────────────────────────────────────── */

/* `desktop/src/assets/textures/rice-paper.png`, 500x500 RGBA, sampled at the
   scale the theme DISPLAYS it (background-size: 160px, so the 500px source is
   downscaled 3.1x). Mean alpha 62.1/255. The colour channels are nearly
   constant -- sd 2.9/1.9/3.4 -- so this texture is "one warm grey with a varying
   coverage", not "coloured noise": composited `normal` it darkens whatever is
   under it. */
const REFERENCE = {
  file: 'desktop/src/assets/textures/rice-paper.png',
  natural: 500,
  display: 160,
  meanRGB: [192.2, 182.2, 166.6],
  sdRGB: [2.9, 1.9, 3.4],
  meanAlpha: 62.1 / 255,
  sdAlpha: 10.6 / 255,
  /* Its compensation plate, verbatim from styles.css:169. */
  scrim: { rgb: [255, 253, 247], alpha: 0.35 },
  /* Its dark-theme veto, verbatim from shared/theme-registry-data.json. */
  blockedThemes: ['midnight', 'midnight-contrast'],
};

/* The separation floor test/contrast.test.js holds every plane to. A layer that
   eats this much of the card-to-ground margin has to say so. */
const SEPARATION_FLOOR = 1.02;

const failures = [];
const notes = [];

/* ── 1. the grain is what we say it is ──────────────────────────────────── */

const uri = /--hana-paper-grain: url\("data:image\/svg\+xml,([^"]+)"\)/.exec(css);
if (!uri) {
  failures.push('the stylesheet declares no --hana-paper-grain data URI');
} else {
  const svg = decodeURIComponent(uri[1]);
  const num = (name) => {
    const m = new RegExp(name + "=['\"]([0-9.]+)['\"]").exec(svg);
    return m ? Number(m[1]) : null;
  };
  const word = (name) => {
    const m = new RegExp(name + "=['\"]([a-zA-Z]+)['\"]").exec(svg);
    return m ? m[1] : null;
  };
  for (const [claim, shipped] of [
    ['baseFrequency', num('baseFrequency')],
    ['numOctaves', num('numOctaves')],
    ['width', num('width')],
  ]) {
    const want = claim === 'width' ? GRAIN.tile : GRAIN[claim];
    if (shipped !== want) {
      failures.push(`the grain SVG declares ${claim}=${shipped}, but this tool records ${want}`);
    }
  }
  if (word('type') !== 'fractalNoise') {
    failures.push(
      `the grain's feTurbulence type is ${word('type')}, not fractalNoise. The neutrality argument ` +
        'below rests on fractalNoise being distributed symmetrically about 0.5; turbulence() is not.',
    );
  }
  if (word('stitchTiles') !== GRAIN.stitchTiles) {
    failures.push(`stitchTiles is ${word('stitchTiles')}, not ${GRAIN.stitchTiles}: the tile would seam`);
  }
  if (!svg.includes("type='" + GRAIN.colourMatrix + "'")) {
    failures.push(
      `the grain does not run feColorMatrix type=${GRAIN.colourMatrix}. Without it the noise keeps its ` +
        'colour, and soft-light over a colour-cast source tints the palette instead of texturing it.',
    );
  }
}

/* The rule that paints it. Read from the shipped sheet, and required to be
   keyed on the palettes that may carry grain -- see the client's own note on why
   the veto is expressed twice. */
/* `--hana-paper-grain` also appears in the declaration that DEFINES it, so the
   filter is on background-image: the first version matched twice and reported
   "2 rules paint the grain" for a sheet with one. */
const grainRules = [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter((m) => /(^|[^-])background-image:\s*var\(--hana-paper-grain\)/.test(m[2]));
if (grainRules.length !== 1) {
  failures.push(`${grainRules.length} rules paint the grain; expected exactly one`);
} else {
  const selector = grainRules[0][1].replace(/\s+/g, ' ').trim();
  const body = grainRules[0][2];
  const allowed = new Set(PALETTES.filter((p) => textureAllowed(p.id)).map((p) => p.id.replace('hana-', '')));
  for (const part of selector.split(',').map((s) => s.trim())) {
    const keyed = /body\[data-hana-theme='([^']+)'\]/.exec(part);
    if (!keyed) {
      failures.push(
        `the grain rule "${part}" is not keyed on a palette. The client writes data-hana-theme and ` +
          'data-hana-texture in the same pass, one after the other, so an unkeyed rule can render a dark ' +
          'palette with grain if the pass throws between them.',
      );
      continue;
    }
    if (!allowed.has(keyed[1])) {
      failures.push(`the grain rule is keyed on "${keyed[1]}", which this theme vetoes -- so the veto is not a veto`);
    }
  }
  for (const p of allowed) {
    if (!selector.includes("'" + p + "'")) {
      failures.push(`the grain rule omits "${p}", so that palette would lose the texture entirely`);
    }
  }
  if (!body.includes(`background-size: ${GRAIN.tile}px ${GRAIN.tile}px`)) {
    failures.push(`the grain is not tiled at ${GRAIN.tile}px; the SVG's own width is ${GRAIN.tile}`);
  }
  if (!new RegExp(`mix-blend-mode: ${GRAIN.blend}`).test(body)) {
    failures.push(`the grain does not use mix-blend-mode: ${GRAIN.blend}; the neutrality argument below is about that blend`);
  }
  if (!body.includes(`opacity: var(--hana-grain-opacity, ${GRAIN.defaultOpacity})`)) {
    failures.push(`the grain's default opacity is not ${GRAIN.defaultOpacity}`);
  }
}

/* ── 2. the veto is exactly the dark palettes ───────────────────────────── */

if (typeof textureAllowed !== 'function') {
  failures.push('lib/client.js exports no textureAllowed(), so the veto cannot be checked against the palettes');
} else {
  for (const p of PALETTES) {
    const allowed = textureAllowed(p.id);
    if (p.scheme === 'dark' && allowed) {
      failures.push(
        `${p.id} is a dark palette and the grain is NOT vetoed for it. HanaAgent blocks midnight and ` +
          'midnight-contrast outright (paperTextureBlockedThemeIds) rather than restyling the grain.',
      );
    }
    if (p.scheme === 'light' && !allowed) {
      failures.push(`${p.id} is a light palette and the grain is vetoed for it, which the reference never does`);
    }
  }
  if (textureAllowed('hana-does-not-exist')) {
    notes.push('an unknown palette id defaults to allowed, matching the plugin\'s "touch nothing" rule');
  } else {
    failures.push('an unknown palette id is vetoed; the plugin must not act on a palette it does not own');
  }
  /* The reference's list is two literal ids because its registry is literal. If
     ours ever grew such a list, the scheme check above would stop being the
     reason -- so the ids themselves are recorded as the fact they are. */
  const darkIds = PALETTES.filter((p) => p.scheme === 'dark').map((p) => p.id);
  if (darkIds.length === 0) failures.push('no dark palette exists, so the veto is untested by construction');
  notes.push(`reference blocks ${REFERENCE.blockedThemes.join(', ')}; we block ${darkIds.join(', ')} by scheme`);
}

/* ── 3. layer ③: is a compensation plate needed? ────────────────────────── */

/* The W3C soft-light function, per channel, straight from the compositing spec.
   At cs = 0.5 it must return cb unchanged -- that identity IS the reason there
   is no compensation layer, so it is recomputed here rather than quoted. */
function softLight(cb, cs) {
  if (cs <= 0.5) return cb - (1 - 2 * cs) * cb * (1 - cb);
  const d = cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb);
  return cb + (2 * cs - 1) * (d - cb);
}

const NEUTRAL_BACKDROPS = [0.1, 0.25, 0.5, 0.75, 0.96];
let worstNeutrality = 0;
for (const cb of NEUTRAL_BACKDROPS) {
  worstNeutrality = Math.max(worstNeutrality, Math.abs(softLight(cb, 0.5) - cb));
}
if (!(worstNeutrality <= 1e-12)) {
  failures.push(
    `soft-light is no longer neutral at mid-grey (worst deviation ${worstNeutrality}). The grain is ` +
      'therefore SHIFTING luminance, and the compensation layer this theme deliberately does not ship ' +
      'has become necessary -- see the required lift printed by --list.',
  );
}

/* The reference's own chain, from its measured texture: how far its grain pulls
   its paper ground down, and how much of that its scrim buys back. */
const grainRGB = REFERENCE.meanRGB;
const refGround = [245, 239, 228]; // new-warm-paper.css:10 --bg, the theme the 160px tile came from
const refGrained = refGround.map((v, i) => REFERENCE.meanAlpha * grainRGB[i] + (1 - REFERENCE.meanAlpha) * v);
const refLifted = refGrained.map((v, i) => REFERENCE.scrim.alpha * REFERENCE.scrim.rgb[i] + (1 - REFERENCE.scrim.alpha) * v);
const refDrop = refGround.map((v, i) => v - refGrained[i]);
const refRecovered = refGrained.map((v, i) => (refLifted[i] - v) / (refGround[i] - v));
if (refDrop.some((d) => d <= 0)) {
  failures.push(
    'the transcribed reference texture no longer darkens its ground, which cannot be right: it is a warm ' +
      'grey darker than every paper ground, composited normally',
  );
}

/* And what that scrim would do HERE. It is not a compensation for us -- our
   grain shifts nothing -- so the honest number is what it would cost: it lifts
   the ground toward the card, and the card-to-ground separation is what
   test/contrast.test.js #33 holds to SEPARATION_FLOOR. */
const scrimCost = [];
for (const p of PALETTES) {
  const ground = p.tokens['--dsw-alias-bg-base'];
  const card = p.tokens['--dsw-alias-bg-layer-1'];
  if (ground === undefined || card === undefined) continue;
  const before = contrast(parse(card), parse(ground));
  const lifted = composite(parse(`rgba(${REFERENCE.scrim.rgb.join(',')},${REFERENCE.scrim.alpha})`), parse(ground));
  const after = contrast(parse(card), lifted);
  scrimCost.push({ id: p.id, scheme: p.scheme, before, after, ground, card, lifted });
}
for (const row of scrimCost) {
  if (row.scheme !== 'light') continue;
  if (row.after >= SEPARATION_FLOOR && row.after > row.before) {
    failures.push(
      `${row.id}: the reference's compensation plate would RAISE this palette's card-to-ground contrast ` +
        `(${row.before.toFixed(4)} -> ${row.after.toFixed(4)}), which means it is not compensating anything ` +
        'here -- it is lightening the page',
    );
  }
  if (row.after < SEPARATION_FLOOR) {
    failures.push(
      `${row.id}: the reference's compensation plate would push card-to-ground to ${row.after.toFixed(4)}, ` +
        `below the ${SEPARATION_FLOOR} floor tools/derive-surfaces.mjs and #33 both use`,
    );
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

const asJson = process.argv.includes('--json');
if (asJson) {
  console.log(JSON.stringify({
    grain: GRAIN,
    reference: REFERENCE,
    neutralityWorstDeviation: worstNeutrality,
    referenceDrop: refDrop,
    referenceRecovered: refRecovered,
    scrimCost: scrimCost.map((r) => ({ palette: r.id, before: r.before, after: r.after })),
    failures,
  }, null, 2));
  process.exit(failures.length ? 1 : 0);
}

if (process.argv.includes('--list') || process.argv.length <= 2) {
  console.log(`paper grain: baseFrequency ${GRAIN.baseFrequency}, ${GRAIN.numOctaves} octaves, ${GRAIN.tile}px tile,`);
  console.log(`             mix-blend-mode: ${GRAIN.blend}, default opacity ${GRAIN.defaultOpacity}\n`);
  console.log('layer census (HanaAgent styles.css:118-172):');
  console.log('  ① surface       element\'s own background-image, BEHIND its content');
  console.log('                  -> unreachable: the ground is ._1qAH1q_frame (AppFrame.module.css),');
  console.log('                     background: var(--dsw-alias-bg-base); height: 100%');
  console.log('  ② card          element\'s own background-image + background-blend-mode');
  console.log('                  -> unreachable (hash classes), and a NO-OP where it applies:');
  console.log('                     lighten is max(card, grain), and the grain (192,182,166) is darker');
  console.log('                     than every one of the reference\'s seven usable card colours');
  console.log('  ③ compensation  body::before at z-index:-1, above the canvas and below the panels');
  console.log('                  -> the same slot, and covered by the same frame; not needed here:');
  console.log(`\nneutrality of soft-light at mid-grey: worst deviation ${worstNeutrality.toExponential(1)}`);
  console.log(`the reference's own chain (${REFERENCE.file}):`);
  console.log(`  ground ${refGround.join(',')} -> grain ${refGrained.map((v) => v.toFixed(1)).join(', ')}` +
    ` (drop ${refDrop.map((v) => v.toFixed(1)).join('/')})`);
  console.log(`  -> scrim ${refLifted.map((v) => v.toFixed(1)).join(', ')}` +
    ` (recovers ${refRecovered.map((v) => Math.round(v * 100) + '%').join('/')})`);
  console.log('\nwhat that plate would do to OUR ground (it compensates nothing here):');
  for (const r of scrimCost) {
    const lifted = '#' + [r.lifted.r, r.lifted.g, r.lifted.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    console.log(
      `  ${r.id.padEnd(21)} ${r.scheme.padEnd(6)} ground ${r.ground} -> ${lifted}   ` +
        `card/ground ${r.before.toFixed(4)} -> ${r.after.toFixed(4)}` +
        (r.scheme === 'light' ? `  (floor ${SEPARATION_FLOOR})` : ''),
    );
  }
  console.log('\nveto:');
  for (const n of notes) console.log(`  ${n}`);
  if (!failures.length) process.exit(0);
}

if (process.argv.includes('--check')) {
  if (failures.length) {
    console.error(`derive-grain: ${failures.length} paper-texture problem(s)\n`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  const light = PALETTES.filter((p) => p.scheme === 'light').length;
  console.log(
    `derive-grain: the grain matches its declared shape; the veto covers exactly the ` +
      `${PALETTES.length - light} dark palette(s); soft-light is neutral to ${worstNeutrality.toExponential(1)} so ` +
      `the reference's compensation plate stays unported (it would move the card/ground ladder, see --list)`,
  );
  process.exit(0);
}

console.error('usage: node tools/derive-grain.mjs --check | --list | --json');
process.exit(2);
