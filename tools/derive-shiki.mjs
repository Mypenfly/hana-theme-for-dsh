'use strict';
/**
 * Derive hana's `--shiki-*` syntax palette for every theme palette.
 *
 * WHY THIS EXISTS
 * ---------------
 * `--shiki-background` / `--shiki-foreground` / `--shiki-token-*` are NOT part
 * of the 89 registered colour tokens, so `theme.register` / `overrideTokens`
 * can never reach them. The harness declares all eleven on `:root` (light) and
 * overrides nine of them on `body[data-ds-dark-theme]` — i.e. the syntax colours
 * follow the active *colorScheme*, while hana chooses the code-block *surface*
 * it sits on (`--dsw-alias-markdown-code-block`) per *palette*. Those two facts
 * are independent, so nothing in the shipped theme ever checked the two against
 * each other; measured in-engine, 4 of 5 exercised token colours landed below
 * AA in three of the four palettes.
 *
 * METHOD (the same one the palettes themselves were derived with)
 * ---------------------------------------------------------------
 * Keep the harness's hue and saturation — token roles must stay recognisable,
 * and a theme has no business inventing a foreign code palette — and move
 * LIGHTNESS only, in 0.0005 HSL steps, until the colour clears 4.5:1 against
 * that palette's own code-block background. Reproducible, not hand-tuned.
 *
 * Output is a table to paste into lib/client.js. This script is NOT part of
 * `npm test`: it is kept so the numbers can be re-derived and audited, exactly
 * like tools/refresh-allowlist.mjs.
 *
 *   node tools/derive-shiki.mjs            # print the table
 *   node tools/derive-shiki.mjs --verbose  # show every step of every move
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const require = createRequire(path.join(REPO, 'noop.cjs'));

const { contrast } = require(path.join(REPO, 'test', 'color.js'));
const { loadClient } = require(path.join(REPO, 'test', 'load-client.js'));

const PALETTES = loadClient().exports.PALETTES;

/** The harness's own shiki sheet, as declared in ui-theme's client bundle. */
const HARNESS = {
  light: {
    '--shiki-token-constant': '#1c7ed6',
    '--shiki-token-string': '#2f9e44',
    '--shiki-token-comment': '#868e96',
    '--shiki-token-keyword': '#d6336c',
    '--shiki-token-parameter': '#e8590c',
    '--shiki-token-function': '#6741d9',
    '--shiki-token-string-expression': '#2b8a3e',
    '--shiki-token-punctuation': '#495057',
    '--shiki-token-link': '#1971c2',
  },
  dark: {
    '--shiki-token-constant': '#4dabf7',
    '--shiki-token-string': '#69db7c',
    '--shiki-token-comment': '#adb5bd',
    '--shiki-token-keyword': '#faa2c1',
    '--shiki-token-parameter': '#ffa94d',
    '--shiki-token-function': '#b197fc',
    '--shiki-token-string-expression': '#8ce99a',
    '--shiki-token-punctuation': '#ced4da',
    '--shiki-token-link': '#74c0fc',
  },
};

/** The order the tokens are written in, so the emitted table is stable. */
const NAMES = [
  '--shiki-foreground',
  '--shiki-background',
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

/* ── HSL round-trip, so lightness can be moved without touching hue/sat ── */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v * 255)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}
function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

const STEP = 0.0005; // the step size the palette derivation documents
const TARGET = 4.5;

/**
 * Apply ONE factor to the whole palette, moving every token the same
 * proportional distance toward the extreme its surface calls for:
 *
 *   light surface: l' = l * (1 - f)          (asymptotic to black)
 *   dark  surface: l' = l + f * (1 - l)      (asymptotic to white)
 *
 * A shared factor is what keeps the palette a palette: hue and saturation are
 * untouched, token ordering is untouched, and the ratios between tokens are
 * untouched. Per-token lifting was tried first and rejected — stopping each
 * colour at the first step that clears 4.5:1 collapses every token onto one
 * luminance and destroys the harness's designed prominence ordering, so
 * comments end up as loud as keywords.
 *
 * The transform is asymptotic, so it can never clip to pure black or white and
 * silently drop a hue. `f` is the smallest value for which the WORST token in
 * the palette clears the floor.
 */
function fit(palette, background, verbose) {
  const entries = Object.entries(palette).map(([name, hex]) => [name, hex, rgbToHsl(hexToRgb(hex))]);
  const darkGround = contrast('#000000', background) < contrast('#ffffff', background);

  for (let i = 0; i <= 4000; i += 1) {
    const f = i * STEP;
    const moved = entries.map(([name, , [h, s, l]]) => [
      name,
      rgbToHex(hslToRgb([h, s, darkGround ? l + f * (1 - l) : l * (1 - f)])),
    ]);
    const ratios = moved.map(([, hex]) => contrast(hex, background));
    if (Math.min(...ratios) >= TARGET) {
      if (verbose) {
        console.log(`      f = ${f.toFixed(4)}  ${darkGround ? 'toward white' : 'toward black'}`);
      }
      return { f, moved: Object.fromEntries(moved) };
    }
  }
  throw new Error(`no shared factor clears ${TARGET}:1 against ${background}`);
}

/* ── derive every palette ─────────────────────────────────────────────── */

const verbose = process.argv.includes('--verbose');
const result = {};

for (const palette of PALETTES) {
  const background = palette.tokens['--dsw-alias-markdown-code-block'];
  const source = HARNESS[palette.scheme];
  const entry = {
    /* The <pre> carries shiki's inline background/colour; pinning both here
       means the code surface no longer depends on which colorScheme happens to
       be active, which is what made the unpinned state illegible. */
    '--shiki-foreground': palette.tokens['--dsw-alias-label-primary'],
    '--shiki-background': background,
  };

  if (verbose) {
    console.log(`\n${palette.id}  (${palette.scheme})  code bg ${background}`);
  }

  const source9 = Object.fromEntries(
    NAMES.filter((n) => n !== '--shiki-foreground' && n !== '--shiki-background').map((n) => [
      n,
      source[n],
    ]),
  );
  const { moved } = fit(source9, background, verbose);
  Object.assign(entry, moved);
  result[palette.id] = entry;
}

/* ── report ───────────────────────────────────────────────────────────── */

/* --check closes the loop the other way round from the other gates: instead of
   asking "is this artifact fresh?", it asks "are the numbers in lib/client.js
   still the ones this derivation produces?". Without it, "derived, not
   hand-picked" is a claim in a comment; with it, editing a value by hand fails
   the build. It needs no installed harness — the harness's source palette is
   part of the reproduction, so this runs offline inside `npm test`. */
if (process.argv.includes('--check')) {
  const shipped = loadClient().exports.SHIKI || {};
  let drift = 0;
  for (const palette of PALETTES) {
    const want = result[palette.id];
    const have = shipped[palette.id];
    if (!have) {
      console.error(`  ✗ ${palette.id} has no shipped syntax palette`);
      drift += 1;
      continue;
    }
    for (const name of NAMES) {
      if (want[name] !== have[name]) {
        console.error(`  ✗ ${palette.id} ${name}: shipped ${have[name]}, derived ${want[name]}`);
        drift += 1;
      }
    }
  }
  if (drift) {
    console.error(
      `\nderive-shiki: ${drift} value(s) in lib/client.js do not match the derivation.`,
    );
    console.error('Either re-paste the table above, or change the derivation and say why.');
    process.exit(1);
  }
  console.log(
    `derive-shiki: all ${PALETTES.length * NAMES.length} shipped syntax values reproduce exactly`,
  );
  process.exit(0);
}

console.log('\n/* ── emitted table ───────────────────────────────────────────── */\n');
for (const palette of PALETTES) {
  const tokens = result[palette.id];
  console.log(`    var SHIKI_${palette.id.replace('hana-', '').toUpperCase().replace(/-/g, '_')} = {`);
  for (const name of NAMES) {
    console.log(`      "${name}": "${tokens[name]}",`);
  }
  console.log('    };\n');
}

console.log('/* ── contrast summary (9 syntax tokens per palette) ─────────── */\n');
const min = { value: Infinity, where: '' };
for (const palette of PALETTES) {
  const background = palette.tokens['--dsw-alias-markdown-code-block'];
  const rows = [];
  for (const name of Object.keys(result[palette.id])) {
    if (name === '--shiki-background' || name === '--shiki-foreground') continue;
    const value = contrast(result[palette.id][name], background);
    rows.push([name.replace('--shiki-token-', ''), value]);
    if (value < min.value) {
      min.value = value;
      min.where = `${palette.id} ${name}`;
    }
  }
  rows.sort((a, b) => a[1] - b[1]);
  console.log(
    `${palette.id.padEnd(20)} ${background}  worst ${rows[0][0]}=${rows[0][1].toFixed(2)}:1` +
      `  best ${rows[rows.length - 1][0]}=${rows[rows.length - 1][1].toFixed(2)}:1`,
  );
}
console.log(`\nminimum across all 36 pairs: ${min.value.toFixed(2)}:1  (${min.where})`);
process.exit(0);
