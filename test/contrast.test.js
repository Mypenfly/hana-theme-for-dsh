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
const { parse, luminance, contrast, oklab, deltaE } = require('./color');

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

/* ── #26/#27 — syntax highlighting ──────────────────────────────────────────
 *
 * WHY THIS SECTION EXISTS, AND WHY IT DID NOT BEFORE
 *
 * The 23 assertion pairs above are a HAND-PICKED list. That is a real weakness:
 * it can only ever cover surfaces somebody thought of, so whatever nobody
 * thought of is unmeasured however green the suite is. This section is the
 * proof — the code block's syntax colours were never in the list, even though
 * the theme is the thing that chooses the code block's *surface*.
 *
 * DSH highlights code with shiki's `css-variables` theme, so every coloured
 * span carries `style="color:var(--shiki-token-X)"`. The harness declares those
 * eleven on `:root` and switches nine of them on `body[data-ds-dark-theme]` —
 * i.e. they follow the active *colorScheme*, while the surface they sit on
 * follows the chosen *palette*. Measured in a real engine before this section
 * was written (test/verify/build-shiki-probe.mjs), that mismatch left 4 of the
 * 5 token colours a sample exercises below AA in three of the four palettes,
 * worst 2.88:1, and 5 of 5 below AA (worst 1.13:1) in the window where a dark
 * palette is painted before the preference is pinned.
 *
 * The fix is L1b in lib/client.js: hana pins all eleven for the claimed
 * palette. These assertions are what keep that honest.
 */
const SYNTAX_TOKENS = [
  '--shiki-token-constant',
  '--shiki-token-string',
  '--shiki-token-string-expression',
  '--shiki-token-comment',
  '--shiki-token-keyword',
  '--shiki-token-parameter',
  '--shiki-token-function',
  '--shiki-token-punctuation',
  '--shiki-token-link',
];

const SHIKI = client.SHIKI;
let syntaxAssertions = 0;
const syntaxSpreads = [];

for (const p of PALETTES) {
  const table = SHIKI[p.id];
  if (!table) {
    failures.push(`#26 ${p.id} has no syntax palette; its code blocks would fall back to the harness's`);
    continue;
  }
  /* The surface the syntax colours actually sit on. CodeBlock.module.css paints
     `pre.shiki` with this token and marks it !important, so it — not
     --shiki-background — is the real backdrop. Measuring against anything else
     would be measuring the wrong thing. */
  const surface = p.tokens['--dsw-alias-markdown-code-block'];
  const ratios = [];

  for (const name of SYNTAX_TOKENS) {
    syntaxAssertions += 1;
    const value = table[name];
    if (value === undefined) {
      failures.push(`#26 ${p.id} ${name} is missing from the syntax palette`);
      continue;
    }
    const ratio = contrast(value, surface);
    ratios.push(ratio);
    measured.push({ themeName: p.id, id: 26, fg: name.replace('--shiki-token-', 'syntax '), bg: `code block ${surface}`, ratio, min: AA, ok: ratio >= AA });
    if (ratio < AA) {
      failures.push(
        `#26 ${p.id}: ${name} = ${value} on the code surface ${surface} = ${ratio.toFixed(2)}:1 ` +
          `(needs ${AA}:1) — code tokens must stay readable, not just the prose`,
      );
    }
  }

  /* #27 — the palette must stay a palette.
     Deriving each colour to exactly the AA floor is the obvious implementation
     and the wrong one: it collapses all nine tokens onto one luminance, so a
     comment becomes as loud as a keyword. tools/derive-shiki.mjs moves every
     token by ONE shared factor instead, which preserves the harness's designed
     prominence ordering. This asserts the outcome of that decision, so a later
     edit cannot quietly flatten it again. */
  if (ratios.length === SYNTAX_TOKENS.length) {
    const spread = Math.max(...ratios) - Math.min(...ratios);
    syntaxSpreads.push(`${p.id.replace('hana-', '')} ${spread.toFixed(2)}`);
    syntaxAssertions += 1;
    if (!(spread >= 0.5)) {
      failures.push(
        `#27 ${p.id}: syntax contrast spread is only ${spread.toFixed(2)} ` +
          `(${syntaxSpreads.join(', ')}) — the palette has been flattened onto one luminance`,
      );
    }
  }
}

/* #28 — the seal's colours must be a pair this suite already measures.
 *
 * The sidebar seal is the one place the theme draws something new — a glyph on a
 * filled square. It would have been easy to give it its own two colours and its
 * own intuition about whether they are readable. Instead it names an existing
 * pair (label on a filled primary button, assertion #1..23 territory), and this
 * assertion is what makes that claim checkable rather than aspirational: if
 * someone re-points the seal at colours nobody verified, the build fails here.
 */
const seal = client.SEAL_COLORS;
if (!seal || typeof seal.fill !== 'string' || typeof seal.ink !== 'string') {
  failures.push(
    '#28 lib/client.js does not export SEAL_COLORS, so the seal\'s readability cannot be checked',
  );
}
if (seal) {
  const strip = (token) => String(token).replace(/^--dsw-(?:alias|specific)-/, '');
  const covered = PAIRS.some((p) => p.fg === strip(seal.ink) && p.bg === strip(seal.fill));
  const first = PALETTES[0].tokens;
  const look = (short) => first['--dsw-alias-' + short] || first['--dsw-specific-' + short];
  const ratio = covered ? null : contrast(look(strip(seal.ink)), look(strip(seal.fill)));
  if (!covered) {
    failures.push(
      `#28 the seal draws ${seal.ink} on ${seal.fill}, which is NOT one of the ${PAIRS.length} ` +
        `asserted pairs (measured ${ratio === null ? 'n/a' : ratio.toFixed(2)}:1 in ${PALETTES[0].id}) — ` +
        'either assert the pair or point the seal at one that is already asserted',
    );
  }
}

/* ── #29: the ink ramp has a shape, not five hand-picked values ────────────
 *
 * `skin.json` and the L1 header both call this theme five ink stops. It shipped
 * as four, with four different rhythms:
 *
 *   palette   primary  secondary  tertiary  caption  dimmed     upper steps
 *   paper      13.12     8.50      5.28      5.28     3.13     .65  .62
 *   midnight    7.51     5.18      4.52      4.52     2.70     .69  .87
 *   coral      12.52     9.73      4.72      4.72     2.91     .78  .49
 *   vivid      11.74     9.50      7.44      7.44     4.90     .81  .78
 *
 * Two failures, and only the first is cosmetic:
 *
 *   · `caption` was IDENTICAL to `tertiary` everywhere — a step of 1.00, i.e.
 *     two named levels of hierarchy rendered as one colour. Upstream DSH keeps
 *     them 14.5 L* apart in both modes.
 *   · the middle step ran from .49 to .87, so "secondary" and "tertiary" meant
 *     visibly different things from palette to palette. 22 and 23 consumers,
 *     all of them prose.
 *
 * The ramp is now geometric: `secondary` is the geometric mean of `primary` and
 * `tertiary` in CONTRAST RATIO, which is what removes the arbitrary middle
 * value, and `caption`/`dimmed` continue below at f^2.5 and f^3.
 *
 * These two assertions state the SHAPE, independently of
 * tools/derive-ink-ramp.mjs, which pins the exact values. Asserting only the
 * values would make the tool and the test the same claim twice; asserting only
 * the shape would let the values drift anywhere the shape permits.
 */
const RAMP_STOPS = ['label-primary', 'label-secondary', 'label-tertiary', 'label-caption', 'label-dimmed'];
/* Every adjacent step must reduce contrast: 1.00 is the bug, and anything above
   .90 is a step a reader cannot see. */
const MAX_STEP = 0.9;
/* The upper ramp is geometric to within this much. An 8-bit colour cannot hit
   an arbitrary ratio exactly -- the achievable contrasts are quantised -- so
   the bound is set by that, not by convenience. The measured worst is 0.33%,
   and the states this catches were 21% (midnight) and 60% (coral) off. */
const GEOMETRIC_TOLERANCE = 0.015;
let rampAssertions = 0;

for (const { id: themeName, tokens } of PALETTES) {
  const at = (short) => tokens['--dsw-alias-' + short];
  const baseId = 'bg-base';
  const ramp = RAMP_STOPS.map((s) => ({ s, c: contrast(at(s), at(baseId)) }));

  for (let i = 1; i < ramp.length; i += 1) {
    rampAssertions += 1;
    const step = ramp[i].c / ramp[i - 1].c;
    if (!(step < MAX_STEP)) {
      failures.push(
        `#29 ${themeName}: ${ramp[i].s} is ${step.toFixed(3)}x ${ramp[i - 1].s} in contrast ` +
          `(${ramp[i].c.toFixed(2)}:1 against ${ramp[i - 1].c.toFixed(2)}:1) — a step of ` +
          `${step >= 0.999 ? 'exactly 1.00 means the two levels are the SAME COLOUR' : `only ${((1 - step) * 100).toFixed(0)}% is not a visible level`}`,
      );
    }
  }

  rampAssertions += 1;
  const [p, s, t] = ramp.map((x) => x.c);
  const evenness = (s * s) / (p * t);
  if (Math.abs(evenness - 1) > GEOMETRIC_TOLERANCE) {
    failures.push(
      `#29 ${themeName}: the upper ink ramp is not geometric — secondary^2/(primary*tertiary) = ` +
        `${evenness.toFixed(4)}, want 1.0000 +/-${GEOMETRIC_TOLERANCE}. Measured ${p.toFixed(2)}:1 / ` +
        `${s.toFixed(2)}:1 / ${t.toFixed(2)}:1, so secondary is not the even step between the two ` +
        'anchors and the palette reads with a different hierarchy from its siblings',
    );
  }
}

/* ── #30: a hover state moves the fill AWAY from the surface ───────────────
 *
 * The whole job of a hover state on a solid button is to make the control more
 * emphatic than it was at rest. Measured as contrast against `bg-base`, that
 * means the ratio must RISE. 珊瑚 shipped the only state in the theme that went
 * the other way — 12.52:1 at rest, 10.80:1 on hover — so its primary button got
 * weaker exactly when the pointer said it was the target.
 *
 * The threshold is a step, not a value: the four palettes legitimately start
 * from very different fills (3.97:1 to 12.52:1), so only the direction and a
 * floor on the size of the move can be shared.
 */
const HOVER_MIN_STEP = 1.1;
let hoverAssertions = 0;
for (const { id: themeName, tokens } of PALETTES) {
  hoverAssertions += 1;
  const base = tokens['--dsw-alias-bg-base'];
  const rest = contrast(tokens['--dsw-alias-button-primary-fill'], base);
  const hover = contrast(tokens['--dsw-alias-button-primary-hover'], base);
  const step = hover / rest;
  if (!(step >= HOVER_MIN_STEP)) {
    failures.push(
      `#30 ${themeName}: the primary button is ${rest.toFixed(2)}:1 against bg-base at rest and ` +
        `${hover.toFixed(2)}:1 on hover — a step of ${step.toFixed(3)}x. ` +
        (step < 1
          ? 'The fill moves TOWARD the surface, so the button looks disabled exactly when it is being pointed at.'
          : `Hover must make the control more emphatic, by at least ${HOVER_MIN_STEP}x.`),
    );
  }
}

/* ── #31: elevation is a model, not four independent choices ───────────────
 *
 * Upstream DSH's own layers are monotone in lightness (dark: 19.7 / 25.7 /
 * 29.4 / 33.3). This theme deliberately inverts that for nesting — `bg-layer-2`
 * is documented in L3 as "the sunken sidebar" — so the rule here is the
 * theme's own, and it has to hold in every palette or it is not a model:
 *
 *   layer-1  raised   (lighter than the ground: a card)
 *   layer-2  recessed (darker: a well inside the page)
 *   layer-3  recessed further than layer-2 (nesting goes deeper, not shallower)
 *   skeleton tracks layer-3 (it is the same surface, pre-content)
 *
 * 青夜 shipped layer-3 at EXACTLY the ground's lightness — so it painted
 * nothing while being read by 21 stylesheets — and 斑斓 shipped it lighter than
 * the ground, breaking the direction entirely.
 */
let elevationAssertions = 0;
for (const { id: themeName, tokens } of PALETTES) {
  const base = oklab(tokens['--dsw-alias-bg-base'], tokens['--dsw-alias-bg-base']).L;
  const d = (name) => (oklab(tokens['--dsw-alias-' + name], tokens['--dsw-alias-bg-base']).L - base) * 100;
  const [d1, d2, d3] = [d('bg-layer-1'), d('bg-layer-2'), d('bg-layer-3')];
  elevationAssertions += 1;
  if (!(d1 > 0)) {
    failures.push(`#31 ${themeName}: bg-layer-1 is ${d1.toFixed(1)} L* from bg-base — a card must be raised`);
  }
  elevationAssertions += 1;
  if (!(d2 < 0)) {
    failures.push(`#31 ${themeName}: bg-layer-2 is ${d2.toFixed(1)} L* from bg-base — the well must be recessed`);
  }
  elevationAssertions += 1;
  if (!(d3 < d2)) {
    failures.push(
      `#31 ${themeName}: bg-layer-3 is ${d3.toFixed(1)} L* from bg-base but bg-layer-2 is ${d2.toFixed(1)} — ` +
        'nesting must go deeper, not shallower' +
        (Math.abs(d3) < 0.5 ? ' (this level paints nothing at all: it IS the ground)' : ''),
    );
  }
  elevationAssertions += 1;
  if (tokens['--dsw-alias-bg-skeleton'] !== tokens['--dsw-alias-bg-layer-3']) {
    failures.push(
      `#31 ${themeName}: bg-skeleton is ${tokens['--dsw-alias-bg-skeleton']} but bg-layer-3 is ` +
        `${tokens['--dsw-alias-bg-layer-3']} — the skeleton is the same surface before content arrives, ` +
        'and every other palette keeps them equal',
    );
  }
}

/* ── #32: link ink and error ink must be told apart ────────────────────────
 *
 * This one is RECORDED, not thresholded, and the distinction is deliberate.
 * Measured with WCAG contrast the pair looks fine (珊瑚's link is 5.59:1 on the
 * ground); measured with perceptual distance 珊瑚's link and its error ink are
 * delta-E 0.019 apart — the same colour. 青夜 measures 0.030. The other two
 * separate them by hue family (a blue link against a red error) and measure
 * 0.208 and 0.228.
 *
 * A threshold here would be dishonest in both directions. There is no
 * principled value below which a reader is confused; and the collision is not
 * fixable by moving the error hue, because 珊瑚's link ink IS its coral accent
 * darkened to AA, which lands in the same dark-red region the error occupies.
 * Searching the red band for the most separated error reaches only 0.080.
 * Fixing it properly means giving the palette a non-coral link — a design
 * decision, not a repair.
 *
 * So the numbers are pinned. A palette may sit at 0.019, but it may not do so
 * SILENTLY: any edit that moves the separation is caught here and has to be
 * re-recorded, which is the point. `--verbose` prints the whole table.
 */
const LINK_ERROR_SEPARATION = {
  'hana-paper': 0.208,
  'hana-midnight': 0.03,
  'hana-coral': 0.019,
  'hana-midnight-vivid': 0.228,
};
const SEPARATION_TOLERANCE = 0.02;
let separationAssertions = 0;
for (const { id: themeName, tokens } of PALETTES) {
  separationAssertions += 1;
  if (!(themeName in LINK_ERROR_SEPARATION)) {
    failures.push(
      `#32 ${themeName} has no recorded link/error separation — measure ` +
        'deltaE(state-business-primary, state-error-primary) and record it, so the value is a decision ' +
        'rather than an accident',
    );
    continue;
  }
  const measured = deltaE(
    tokens['--dsw-alias-state-business-primary'],
    tokens['--dsw-alias-state-error-primary'],
    tokens['--dsw-alias-bg-base'],
  );
  const recorded = LINK_ERROR_SEPARATION[themeName];
  if (Math.abs(measured - recorded) > SEPARATION_TOLERANCE) {
    failures.push(
      `#32 ${themeName}: link and error ink are delta-E ${measured.toFixed(3)} apart, but ` +
        `${recorded.toFixed(3)} is recorded — an unrecorded change to how distinguishable they are` +
        (measured < 0.05 ? ' (this is a near-match: the two inks are effectively the same colour)' : ''),
    );
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
    `\nreflective: foreground polarity ${polarity.join(' ')} | link contrast ${linkSpread}` +
      `\nsyntax contrast spread: ${syntaxSpreads.join(' | ')}`,
  );
}

const assertions =
  PAIRS.length * Object.keys(THEMES).length +
  polarityAssertions +
  2 +
  1 +
  grainAssertions +
  syntaxAssertions +
  1 + // #28, the seal reuses an asserted pair
  rampAssertions +
  hoverAssertions +
  elevationAssertions +
  separationAssertions;
if (failures.length) {
  console.error(`contrast: ${failures.length} FAILED of ${assertions} assertions\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(
  `contrast: ${assertions} assertions pass (${PAIRS.length} pairs x ${Object.keys(THEMES).length} palettes ` +
    `+ ${polarityAssertions} polarity + 2 link band + 1 soft-light neutrality + ${grainAssertions} grain-composite ` +
    `+ ${syntaxAssertions} syntax: ${SYNTAX_TOKENS.length} tokens x ${PALETTES.length} palettes + ${PALETTES.length} spread ` +
    `+ 1 seal-pair + ${rampAssertions} ink-ramp shape + ${hoverAssertions} hover direction ` +
    `+ ${elevationAssertions} elevation model + ${separationAssertions} recorded link/error separation)`,
);
