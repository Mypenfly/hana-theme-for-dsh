'use strict';
/**
 * The contrast gate.
 *
 * HanaAgent's original palettes fail WCAG AA in nine places, which is why this
 * project's palettes are measured rather than copied. Every value asserted here
 * is read out of the shipped token tables in `lib/client.js` — never from a
 * second copy — so a palette edit that breaks readability fails the build
 * instead of shipping.
 *
 * Run with `--verbose` to print every measured pair; that output is the
 * documentation for the "adjusted, not chosen" values in the source comments.
 */

const { loadClient } = require('./load-client');
const { parse, luminance, contrast } = require('./color');

const { exports: client } = loadClient();
/* Iterate the palettes the plugin actually registers, so adding one to
   lib/client.js automatically subjects it to every assertion below. */
const PALETTES = client.PALETTES;
const THEMES = Object.fromEntries(PALETTES.map((p) => [p.id, p.tokens]));
const SCHEME_OF = Object.fromEntries(PALETTES.map((p) => [p.id, p.scheme]));

const AA = 4.5;
const NON_TEXT = 1.06; // decorative separators only need to be perceptible

/**
 * Pairs that carry meaning and therefore must stay readable. `min` is the WCAG
 * AA text threshold unless the pair is a non-text boundary.
 */
const PAIRS = [
  { id: 1, fg: 'label-primary', bg: 'bg-base', min: AA, why: 'body text on the ground' },
  { id: 2, fg: 'label-primary', bg: 'bg-layer-1', min: AA, why: 'text on raised cards' },
  { id: 3, fg: 'label-secondary', bg: 'bg-base', min: AA, why: 'secondary text' },
  { id: 4, fg: 'label-tertiary', bg: 'bg-base', min: AA, why: 'tertiary text' },
  { id: 5, fg: 'state-business-primary', bg: 'bg-base', min: AA, why: 'links (MarkdownText paints .markdown a with this)' },
  { id: 6, fg: 'state-business-primary', bg: 'bg-layer-1', min: 3.0, why: 'links inside cards' },
  { id: 7, fg: 'label-primary-foreground', bg: 'button-primary-fill', min: AA, why: 'label on a filled primary button' },
  { id: 8, fg: 'state-error-primary', bg: 'bg-base', min: AA, why: 'error text' },
  { id: 9, fg: 'state-success-primary', bg: 'bg-base', min: AA, why: 'success text' },
  { id: 10, fg: 'border-l1', bg: 'bg-base', min: NON_TEXT, why: 'separator perceptibility' },
  { id: 11, fg: 'label-primary', bg: 'bubble', min: AA, why: 'assistant text in its bubble' },
  { id: 12, fg: 'label-primary', bg: 'markdown-code-block', min: AA, why: 'code block text' },

  /* Extensions beyond the original spec, added because the DOM was read rather
     than assumed. Each one is a real rendered pair in DSH 0.1.2-rc.1. */
  { id: 17, fg: 'label-primary-inverted', bg: 'button-contrast-fill', min: AA, why: 'Toast.module.css pairs exactly these two, and its surface is button-contrast-fill, NOT the unused --dsw-alias-toast-bg' },
  { id: 18, fg: 'label-tertiary', bg: 'bg-layer-2', min: AA, why: 'tertiary text in the sunken sidebar' },
  { id: 19, fg: 'label-primary', bg: 'bg-layer-2', min: AA, why: 'sidebar text' },
  { id: 20, fg: 'state-warn-label', bg: 'bg-base', min: AA, why: 'warning label (used by the connection pill)' },
  { id: 21, fg: 'label-primary', bg: 'markdown-inline-code', min: AA, why: 'inline code text' },
  { id: 22, fg: 'label-primary', bg: 'input-major', min: AA, why: 'composer input text' },
  { id: 23, fg: 'label-secondary', bg: 'bubble', min: 3.0, why: 'secondary text inside a bubble' },
];

const failures = [];
const measured = [];

for (const [themeName, tokens] of Object.entries(THEMES)) {
  /* Token names in the harness carry an `alias-` or `specific-` family prefix
     that the assertion table omits, so probe both families rather than making
     every entry repeat it. */
  const get = (name) => {
    for (const prefix of ['--dsw-alias-', '--dsw-specific-']) {
      const value = tokens[prefix + name];
      if (value !== undefined) return value;
    }
    throw new Error(`${themeName} is missing a value for "${name}"`);
  };

  for (const pair of PAIRS) {
    const ratio = contrast(get(pair.fg), get(pair.bg));
    const ok = ratio >= pair.min;
    measured.push({ themeName, ...pair, ratio, ok });
    if (!ok) {
      failures.push(
        `#${pair.id} ${themeName}: ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1 ` +
          `(needs ${pair.min}:1) — ${pair.why}`,
      );
    }
  }
}

/* ── reflective assertions ────────────────────────────────────────────────
   These do not measure a pair; they pin a *relationship*, so that a later
   palette edit cannot quietly invert a polarity that the whole design rests on.
   Assertion 13/14 encode the single most important rule in this theme: the two
   modes use opposite foregrounds, because hana-midnight's accent is lighter
   than its ground while hana-paper's is darker. */

/* #13/#14 are checked per SCHEME, not per theme name: with four palettes the
   rule that matters is "a light palette's solid-fill foreground is light, a dark
   palette's is dark", and keying it to two specific ids would silently stop
   covering every palette added later. */
let polarityAssertions = 0;
const polarity = [];
for (const p of PALETTES) {
  polarityAssertions += 1;
  const lum = luminance(parse(p.tokens['--dsw-alias-label-primary-foreground']));
  polarity.push(`${p.id}=${lum.toFixed(3)}`);
  if (p.scheme === 'light' && !(lum > 0.7)) {
    failures.push(`#13 ${p.id} is a light palette but its label-primary-foreground luminance is ${lum.toFixed(3)} (needs > 0.7)`);
  }
  if (p.scheme === 'dark' && !(lum < 0.2)) {
    failures.push(`#14 ${p.id} is a dark palette but its label-primary-foreground luminance is ${lum.toFixed(3)} (needs < 0.2)`);
  }
}

/* #15 — links must be readable AND not shout, in every palette.
   Originally this compared hana-paper against hana-midnight for near-equality.
   Four palettes with genuinely different hues cannot be equal -- coral's warm
   stop and the vivid palette's light blue sit at opposite ends of a dark/light
   ground -- so the intent is kept as a band: clear AA at the bottom, and below
   the "maximum contrast white-on-black" look at the top. */
const linkRatios = PALETTES.map((p) => ({
  id: p.id,
  ratio: contrast(p.tokens['--dsw-alias-state-business-primary'], p.tokens['--dsw-alias-bg-base']),
}));
const minLink = Math.min(...linkRatios.map((x) => x.ratio));
const maxLink = Math.max(...linkRatios.map((x) => x.ratio));
const linkSpread = linkRatios.map((x) => `${x.id.replace('hana-', '')} ${x.ratio.toFixed(2)}`).join(', ');
if (!(minLink >= AA)) failures.push(`#15 a link falls below AA somewhere: ${linkSpread}`);
if (!(maxLink <= 11)) failures.push(`#15 a link is so high-contrast it reads as a headline: ${linkSpread}`);

/* #16 — every colour value must be a literal CSS colour.
 *
 * Not stylistic pedantry: a value that references another variable would be
 * resolved in the *theme layer*, where only the 89 registered tokens exist, so
 * `var(--warm-paper-ink)` would silently compute to nothing. This is the exact
 * drift HanaAgent hit, where a settings-page copy of the palette wrote `rgb()`
 * while the stylesheet wrote hex. */
const LITERAL = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|transparent)$/;
for (const [themeName, tokens] of Object.entries(THEMES)) {
  for (const [name, value] of Object.entries(tokens)) {
    if (!LITERAL.test(String(value).trim())) {
      failures.push(`#16 ${themeName} ${name} = ${JSON.stringify(value)} is not a literal CSS colour`);
    }
  }
}

/* ── #24/#25 — the paper grain must not shift luminance ─────────────────────
 *
 * This is §5.2's acceptance criterion ("texture on vs off must move the composite
 * contrast by less than 0.3") turned into arithmetic instead of a promise.
 *
 * The grain is a full-viewport overlay composited with `mix-blend-mode:
 * soft-light`. Soft-light is what makes neutrality a property of the design
 * rather than something to patch afterwards: at a blend value of exactly 0.5 the
 * W3C soft-light function returns the backdrop unchanged, and feTurbulence's
 * `fractalNoise` is distributed symmetrically about 0.5. So the noise perturbs
 * local luminance without shifting the mean -- which is why the theme ships NO
 * warm-white compensation layer, unlike the multiply-based sketch in the spec.
 *
 * The model below is the compositing spec, not an approximation of a screenshot:
 * soft-light per channel in sRGB, then the overlay's own alpha folded in.
 */
function softLight(cb, cs) {
  if (cs <= 0.5) return cb - (1 - 2 * cs) * cb * (1 - cb);
  const d = cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb);
  return cb + (2 * cs - 1) * (d - cb);
}

/** The mean colour a backdrop takes under the grain at overlay alpha `k`. */
function grained(background, k, samples) {
  const base = parse(background);
  const out = { r: 0, g: 0, b: 0, a: 1 };
  for (const key of ['r', 'g', 'b']) {
    let sum = 0;
    for (const cs of samples) {
      const cb = base[key] / 255;
      sum += (1 - k) * cb + k * softLight(cb, cs);
    }
    out[key] = (sum / samples.length) * 255;
  }
  return out;
}

/* Symmetric about 0.5, which is the assumption fractalNoise justifies. */
const NOISE_SAMPLES = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];

/* The neutrality property itself, stated directly. If this ever fails, the grain
   has stopped being luminance-neutral and a compensation layer becomes
   necessary -- so it is asserted before the aggregates that depend on it. */
for (const cb of [0.1, 0.25, 0.5, 0.75, 0.96]) {
  if (Math.abs(softLight(cb, 0.5) - cb) > 1e-12) {
    failures.push(`#24 soft-light is not neutral at mid-grey for backdrop ${cb}: got ${softLight(cb, 0.5)}`);
  }
}

const GRAIN_LEVELS = [0.32, 0.6]; // the shipped default, and the maximum the slider allows
let grainAssertions = 0;
for (const [themeName, tokens] of Object.entries(THEMES)) {
  const base = tokens['--dsw-alias-bg-base'];
  const fg = tokens['--dsw-alias-label-primary'];
  const clean = contrast(fg, base);
  for (const k of GRAIN_LEVELS) {
    grainAssertions += 1;
    const delta = Math.abs(contrast(fg, grained(base, k, NOISE_SAMPLES)) - clean);
    measured.push({
      themeName,
      id: 25,
      fg: 'label-primary (under grain)',
      bg: `bg-base @ ${Math.round(k * 100)}%`,
      ratio: contrast(fg, grained(base, k, NOISE_SAMPLES)),
      min: 0,
      ok: delta < 0.3,
    });
    if (!(delta < 0.3)) {
      failures.push(
        `#25 ${themeName}: grain at ${Math.round(k * 100)}% moves composite contrast by ` +
          `${delta.toFixed(3)} (limit 0.3)`,
      );
    }
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (process.argv.includes('--verbose')) {
  let current = null;
  for (const m of measured) {
    if (m.themeName !== current) {
      current = m.themeName;
      console.log(`\n${current}`);
    }
    console.log(
      `  ${String(m.ratio.toFixed(2)).padStart(6)}:1  (min ${String(m.min).padStart(4)})  ${m.fg} on ${m.bg}`,
    );
  }
  console.log(
    `\nreflective: foreground polarity ${polarity.join(' ')} | link contrast ${linkSpread}`,
  );
}

const assertions =
  PAIRS.length * Object.keys(THEMES).length + polarityAssertions + 2 + 1 + grainAssertions;
if (failures.length) {
  console.error(`contrast: ${failures.length} FAILED of ${assertions} assertions\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(
  `contrast: ${assertions} assertions pass (${PAIRS.length} pairs x ${Object.keys(THEMES).length} palettes ` +
    `+ ${polarityAssertions} polarity + 2 link band + 1 soft-light neutrality + ${grainAssertions} grain-composite)`,
);
