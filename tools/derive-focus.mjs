#!/usr/bin/env node
/**
 * Derive the focus ring: bind the reference's `--accent` to the TOKEN the
 * stylesheet actually names, and hold the result to WCAG 1.4.11.
 *
 * WHY THIS EXISTS
 * ---------------
 * HanaAgent deletes the browser's DEFAULT focus ring globally and then draws its
 * own, and the ring it draws is ONE colour for the whole application:
 *
 *   styles.css:288          :focus, :focus-visible { outline: none !important; }
 *   ui/Button.module.css    .btn:focus-visible { outline: 2px solid var(--accent);
 *                                                outline-offset: 2px; }
 *
 * asserted by its own vitest (react/__tests__/styles/focus-ring.test.ts). DSH's
 * ring GEOMETRY is already the reference's -- 1px and 2px, offsets +/-2px -- so
 * the only divergence is the colour, and DSH spends five of them across 31 rules
 * (state-business-primary x21, brand-primary x5, label-tertiary x2,
 * button-info-fill, state-warn-label). Under 珊瑚 two of those are #A8432A and
 * #F37E63, and #F37E63 measures 2.45:1 on its ground -- below the 3:1 that
 * WCAG 1.4.11 asks of a non-text indicator. That pair is the 橙框.
 *
 * WHAT THIS BINDS, AND WHY IT IS NOT A SECOND COPY
 * ------------------------------------------------
 * The stylesheet does NOT restate the accent. It names a token, and for three of
 * the four palettes that token already carries the reference's exact triple:
 *
 *   paper    brand-primary        #537D96  == new-warm-paper.css:26  --accent
 *   midnight brand-primary        #C99AAF  == midnight.css:13        --accent
 *   vivid    brand-primary        #E6B1C4  == midnight-contrast.css:13 --accent
 *   coral    button-primary-fill  #1A3049  == coral.css:13           --accent
 *
 * 珊瑚 is the one palette with no brand token equal to its accent: its brand
 * plate is the coral vermilion, which the reference reserves for --coral (its
 * lines and tints), while its --accent -- the colour it rings focus with -- is
 * ink blue. The stylesheet therefore keys that one palette to the token that
 * does carry it.
 *
 * This tool exists so that mapping cannot rot. It reads the `--hana-ring`
 * declarations out of the SHIPPED stylesheet, resolves them per palette exactly
 * as the cascade would, and checks the resolved token against the reference --
 * so re-pointing brand-primary, or fixing 珊瑚's brand plate later, fails the
 * gate instead of silently re-colouring every focus ring in the app.
 *
 * `resolveRings` is exported because test/verify/focus-check.mjs measures the
 * same resolution in a real engine; a second copy of it there would be a second
 * thing to keep in step, which is the drift this project keeps finding.
 *
 * WHAT IT CHECKS
 * --------------
 *   --check   each palette's ring resolves to the reference's --accent for its
 *             source theme, and clears 3:1 against BOTH the ground and the card
 *   --list    the resolution, the provenance and the two ratios
 */

import { pathToFileURL } from 'node:url';
import { loadClient, readCss } from '../test/load-client.js';
import { parse, contrast } from '../test/color.js';

/* Transcribed from each palette's own source theme, with the line, exactly the
   way the wash ladder and the glass values are. The reference's `--accent`. */
export const ACCENT = {
  'hana-paper': { theme: 'themes/new-warm-paper.css:26', value: '#537D96' },
  'hana-midnight': { theme: 'themes/midnight.css:13', value: '#C99AAF' },
  'hana-coral': { theme: 'themes/coral.css:13', value: '#1A3049' },
  'hana-midnight-vivid': { theme: 'themes/midnight-contrast.css:13', value: '#E6B1C4' },
};

/* WCAG 1.4.11 Non-text Contrast: a focus indicator is a non-text indicator. */
export const RING_FLOOR = 3.0;

/**
 * Resolve, per palette, which token the shipped `--hana-ring` rules name.
 *
 * Read from the sheet rather than from a table here, so a rule that was never
 * written cannot be mistaken for one that was. A generic rule keyed on the theme
 * attribute supplies the default; a palette-keyed rule outranks it, exactly as
 * the cascade would (it carries one more attribute).
 */
export function resolveRings(css, palettes, focusValue) {
  const problems = [];
  const rules = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = rule[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!/--hana-ring\s*:/.test(rule[2])) continue;
    const decl = /--hana-ring\s*:\s*var\(\s*(--[A-Za-z0-9-]+)\s*\)/.exec(rule[2]);
    if (!decl) { problems.push(`the rule "${selector}" declares --hana-ring without a var(--token) value`); continue; }
    if (!selector.includes(`[data-hana-focus='${focusValue}']`)) continue;
    const keyed = /\[data-hana-theme='([^']+)'\]/.exec(selector);
    rules.push({ selector, token: decl[1], palette: keyed ? keyed[1] : null });
  }
  const generic = rules.filter((r) => r.palette === null);
  if (generic.length !== 1) {
    problems.push(
      `${generic.length} generic --hana-ring rule(s) keyed on data-hana-focus='${focusValue}'; ` +
        'expected exactly one, or the default ring for three of the four palettes is undefined',
    );
  }
  const resolutions = [];
  for (const palette of palettes) {
    const attr = palette.id.replace('hana-', '');
    const keyed = rules.filter((r) => r.palette === attr);
    if (keyed.length > 1) {
      problems.push(`${palette.id}: ${keyed.length} palette-keyed --hana-ring rules; only one can be the ring`);
    }
    const chosen = keyed[0] || generic[0];
    resolutions.push({ palette, attr, keyed: keyed.length > 0, chosen });
  }
  return { rules, generic, resolutions, problems };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { exports: client } = loadClient();
  const { PALETTES } = client;
  const css = readCss(client);

  /* The focus attribute VALUE the rules are keyed on has to be the one the client
     actually writes, or every rule below is dead CSS that still looks right. */
  const FOCUS_VALUE = (client.DEFAULTS || {}).focus;
  const failures = [];

  if (typeof FOCUS_VALUE !== 'string' || !FOCUS_VALUE) {
    failures.push('DEFAULTS.focus is not a non-empty string, so no ring rule can be keyed to it');
  }

  const { resolutions, problems } = resolveRings(css, PALETTES, FOCUS_VALUE);
  failures.push(...problems);

  for (const { palette, chosen } of resolutions) {
    const accent = ACCENT[palette.id];
    if (!accent) { failures.push(`no reference accent recorded for ${palette.id}; add its source theme`); continue; }
    if (!chosen) { failures.push(`${palette.id}: no --hana-ring rule resolves for it`); continue; }

    const shipped = palette.tokens[chosen.token];
    if (shipped === undefined) {
      failures.push(`${palette.id}: the ring names ${chosen.token}, which this palette does not supply`);
      continue;
    }
    if (shipped.toLowerCase() !== accent.value.toLowerCase()) {
      failures.push(
        `${palette.id}: the ring resolves to ${chosen.token} = ${shipped}, but ${accent.theme} draws its ` +
          `focus ring in --accent ${accent.value}`,
      );
    }

    const ring = parse(shipped);
    for (const surface of ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1']) {
      const bg = palette.tokens[surface];
      if (bg === undefined) { failures.push(`${palette.id}: ${surface} is not supplied, so the ring cannot be measured`); continue; }
      const ratio = contrast(ring, parse(bg));
      if (!(ratio >= RING_FLOOR)) {
        failures.push(
          `${palette.id}: the ring ${shipped} measures ${ratio.toFixed(2)}:1 on ${surface} (${bg}), below the ` +
            `${RING_FLOOR}:1 WCAG 1.4.11 asks of a non-text indicator`,
        );
      }
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      focusValue: FOCUS_VALUE,
      floor: RING_FLOOR,
      resolutions: resolutions.map(({ palette, keyed, chosen }) => ({
        palette: palette.id,
        rule: chosen ? chosen.selector : null,
        keyed,
        token: chosen ? chosen.token : null,
        value: chosen ? palette.tokens[chosen.token] : null,
        reference: ACCENT[palette.id] ? ACCENT[palette.id].value : null,
        theme: ACCENT[palette.id] ? ACCENT[palette.id].theme : null,
      })),
    }, null, 2));
    process.exit(0);
  }

  if (process.argv.includes('--list') || process.argv.length <= 2) {
    console.log(`focus ring: data-hana-focus='${FOCUS_VALUE}', floor ${RING_FLOOR}:1 (WCAG 1.4.11)\n`);
    for (const { palette, keyed, chosen } of resolutions) {
      const accent = ACCENT[palette.id] || {};
      if (!chosen) { console.log(`${palette.id}: no rule resolves`); continue; }
      const shipped = palette.tokens[chosen.token];
      console.log(`${palette.id}  (${keyed ? 'palette-keyed' : 'generic'})  --hana-ring: var(${chosen.token}) = ${shipped}`);
      console.log(`   reference ${accent.theme} --accent = ${accent.value}`);
      for (const surface of ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1']) {
        const bg = palette.tokens[surface];
        console.log(`   on ${surface.replace('--dsw-alias-', '').padEnd(10)} ${bg}  ${contrast(parse(shipped), parse(bg)).toFixed(2)}:1`);
      }
    }
    console.log('\nnot ported: the reference\'s commonest substitution, `border-color: var(--accent)`');
    console.log('(29 per-component rules). Written globally it would recolour borders that carry STATE,');
    console.log('and DSH already gives its inputs their own focus idiom (32 `outline: none` rules).');
    process.exit(0);
  }

  if (process.argv.includes('--check')) {
    if (failures.length) {
      console.error(`derive-focus: ${failures.length} focus-ring problem(s)\n`);
      for (const f of failures) console.error('  ✗ ' + f);
      process.exit(1);
    }
    console.log(
      `derive-focus: ${resolutions.length} ring(s) resolve to their palette's own --accent and clear ` +
        `${RING_FLOOR}:1 on both the ground and the card`,
    );
    process.exit(0);
  }

  console.error('usage: node tools/derive-focus.mjs --check | --json | --list');
  process.exit(2);
}
