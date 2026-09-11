/**
 * Scan the installed harness for every colour token it paints as a BACKGROUND,
 * and keep a ledger of what that surface is supposed to be.
 *
 * WHY THIS EXISTS
 * ---------------
 * The colour-surface ledger (tools/scan-color-surfaces.mjs) answers "does this
 * theme supply this property at all". It cannot answer "does this property read
 * as a separate PLANE", and that is a different question with a different
 * failure mode. Measured on the shipped tables:
 *
 *   surface                 paper   midnight  coral   vivid
 *   markdown-inline-code    1.003    1.359    1.064   1.172
 *   bubble                  1.012    1.283    1.018   1.341
 *   markdown-code-block     1.015    1.283    1.061   1.172
 *   tip                     1.015    1.283    1.000   1.341
 *   bg-layer-2              1.065    1.132    1.039   1.115
 *
 * (contrast against bg-base; 1.000 is literally the same colour.) The two LIGHT
 * palettes have no surface ladder at all — an inline-code chip at 1.003 is not
 * "restrained", it is absent — while the two dark ones separate by 1.11-1.36.
 * The cause is the same one the ink ramp had: each surface token was chosen on
 * its own, so nothing ever asked whether the set of them formed a ladder.
 *
 * So this tool enumerates the surfaces from the ARTIFACT — every token the
 * installed UI actually paints with `background` — and requires a recorded role
 * for each. A DSH upgrade that starts painting a new token as a surface arrives
 * as UNCLASSIFIED and fails the build.
 *
 *   node tools/scan-surface-roles.mjs           # refresh, preserving decisions
 *   node tools/scan-surface-roles.mjs --check   # fail if the ledger is stale
 *   node tools/scan-surface-roles.mjs --list    # show every surface found
 *
 * Like the other scanners this needs an INSTALLED harness, so it is not part of
 * `npm test`; test/contrast.test.js validates the ledger offline.
 */

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT = join(ROOT, 'test', 'surface-roles.json')
const HOME = homedir()
const redact = (p) => (HOME && p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p)

/* ── roles ────────────────────────────────────────────────────────────────
 * Every surface the installed UI paints, classified ONCE, by hand.
 *
 *   ground    the page itself: the reference every other figure is measured to
 *   plane     must read as a separate plane from the ground. Asserted at
 *             PLANE_FLOOR contrast or better, in every palette. THIS IS THE
 *             CATEGORY THE REVIEW TURNED ON.
 *   mirror    deliberately the same value as another token, because it IS that
 *             token under a second name. Recorded as an equality so the two
 *             cannot drift apart silently.
 *   edge      a hairline drawn with `background` rather than `border`. An edge
 *             is measured from both sides, so a plane floor is the wrong test;
 *             test/contrast.test.js already asserts border-l1 perceptibility.
 *   fill      a solid control. Its legibility is the TEXT ON IT, which is an
 *             asserted pair in test/contrast.test.js — not a figure against the
 *             ground, which would be measuring the wrong relationship.
 *   wash      translucent by design: a hover tint, a state haze. Alpha is the
 *             point, so a contrast figure against the ground measures the
 *             composite rather than the intent.
 *   ink       an ink used as a graphic mark: a status dot, an indicator bar, the
 *             seal. Its contrast against the ground is already asserted.
 *   inverted  a plate that must stay dark in BOTH modes, because the text on it
 *             is a hardcoded near-white no token can reach.
 *   overlay   a dimming scrim.
 */
const PLANE_FLOOR = 1.06

const ROLES = {
  '--dsw-alias-bg-base': ['ground', 'the page: everything below is measured against it'],

  /* ── the ladder ─────────────────────────────────────────────────────── */
  '--dsw-alias-bg-layer-1': ['plane', 'raised card: the sheet laid on the paper'],
  '--dsw-alias-bg-layer-2': ['plane', 'the well: sidebar column and insets'],
  '--dsw-alias-bg-layer-3': ['plane', 'a deeper well; its ORDER against layer-2 is asserted separately'],
  '--dsw-alias-bg-module-platform': ['plane', 'the platform module panel'],
  '--dsw-alias-interactive-bg-hover-solid': ['plane', 'the OPAQUE hover fill — it has to be visible without being hovered to be a rest state anywhere'],

  /* ── reading and message surfaces ───────────────────────────────────── */
  '--dsw-specific-bubble': ['plane', 'the message bubble: the surface the "cards on paper" principle is actually about'],
  '--dsw-alias-markdown-code-block': ['plane', 'code block surface'],
  '--dsw-alias-markdown-inline-code': ['plane', 'inline code chip: measured 1.003 against the ground before this ledger existed'],
  '--dsw-alias-markdown-code-block-banner': ['plane', 'the code block header strip, which must read against the block itself'],
  '--dsw-specific-tip': ['plane', 'callout / tip panel'],

  /* ── control surfaces ───────────────────────────────────────────────── */
  '--dsw-specific-input-major': ['plane', 'the composer input'],
  '--dsw-specific-menu': ['plane', 'popup menu'],
  '--dsw-specific-selector': ['plane', 'selector chip and dropdown'],
  '--dsw-specific-sidebar-fill': ['plane', 'the sidebar column'],

  /* ── mirrors ────────────────────────────────────────────────────────── */
  '--dsw-alias-bg-overlay': ['mirror', 'bg-layer-1', 'an overlay IS the raised surface, under the name the modal slot uses'],
  '--dsw-alias-bg-skeleton': ['mirror', 'bg-layer-3', 'the same surface before content arrives'],
  '--dsw-alias-bg-multi-select': ['mirror', 'bg-layer-2', ''],
  '--dsw-alias-button-elevated-fill': ['mirror', 'bg-layer-1', 'a floating button sits on the raised sheet'],
  '--dsw-alias-button-floating-fill': ['mirror', 'bg-layer-1', ''],
  '--dsw-alias-button-tool-bar-fill': ['mirror', 'bg-layer-1', ''],
  '--dsw-specific-login-input': ['mirror', 'bg-layer-1', ''],
  /* Measured, not assumed: this one is equal to bg-layer-3 on 纸本 and 珊瑚 but to
     interactive-bg-hover-solid on 青夜 and 斑斓, so it is a surface in its own
     right rather than a second name for either. It gets its own rung. */
  '--dsw-specific-bubble-highlight': ['plane', 'the selected bubble'],
  '--dsw-alias-bg-layer-4': ['mirror', 'interactive-bg-hover-solid', 'a hover surface one level above layer-3'],
  '--dsw-alias-fill-l2': ['mirror', 'bg-layer-3', 'a muted chip fill: bound to the recessed surface by L1c'],
  '--dsw-alias-fill-tsp-secondary': ['mirror', 'bg-layer-3', ''],
  '--dsw-alias-markdown-code-segment-unselected': ['mirror', 'markdown-code-block', 'an unselected segment IS the block'],
  '--dsw-alias-markdown-code-segment-selected': ['mirror', 'markdown-code-block-banner', ''],
  /* NOT a mirror of label-primary, which is what the first version of this ledger
     claimed: it is equal to label-primary only in the two palettes where
     label-primary happens to be dark. It is a plate that must stay dark in BOTH
     modes, because Tooltip.module.css paints its text with a hardcoded near-white
     that no token can reach — so it must not follow the ground at all. */
  '--dsw-alias-tooltip-bg': ['inverted', 'an inverted plate, dark in both modes by necessity'],
  '--dsw-alias-toast-bg': ['mirror', 'button-contrast-fill', 'the toast plate is button-contrast-fill: Toast.module.css pairs exactly that fill with label-primary-inverted, and --dsw-alias-toast-bg is read by nothing'],

  /* ── edges drawn as background ──────────────────────────────────────── */
  '--dsw-alias-border-l1': ['edge', 'hairline drawn as a background stripe'],
  '--dsw-alias-border-l2': ['edge', ''],
  '--dsw-alias-border-l3': ['edge', ''],
  '--dsw-alias-border-l4': ['edge', ''],

  /* ── solid controls ─────────────────────────────────────────────────── */
  '--dsw-alias-brand-primary': ['fill', 'brand mark plate'],
  '--dsw-alias-brand-primary-new-colorprimary-new-color': ['fill', 'the same plate under its long name'],
  '--dsw-alias-button-primary-fill': ['fill', 'asserted pair 7: label-primary-foreground on this fill'],
  '--dsw-alias-button-primary-hover': ['fill', 'hover direction asserted by #30'],
  '--dsw-alias-button-contrast-fill': ['fill', 'asserted pair 17: label-primary-inverted on this fill'],
  '--dsw-alias-button-info-fill': ['fill', ''],
  '--dsw-alias-button-info-hover': ['fill', ''],
  '--dsw-alias-button-floating-hover': ['fill', ''],
  '--dsw-alias-button-tool-bar-hover': ['fill', ''],
  '--dsw-alias-button-ghost-active-fill': ['wash', 'translucent by construction'],

  /* ── washes ─────────────────────────────────────────────────────────── */
  '--dsw-alias-interactive-bg-hover': ['wash', 'the 4% ink tint; #A4 uses it and points at what that costs'],
  '--dsw-alias-interactive-bg-active': ['wash', ''],
  '--dsw-alias-interactive-bg-hover-danger': ['wash', ''],
  '--dsw-specific-sidebar-nav-item-hover': ['wash', 'settings nav hover'],
  '--dsw-specific-sidebar-nav-item-active': ['wash', 'settings nav active'],
  '--dsw-alias-state-business-tertiary': ['wash', ''],
  '--dsw-alias-state-success-tertiary': ['wash', ''],
  '--dsw-alias-state-warn-tertiary': ['wash', ''],

  /* ── ink used as a mark ─────────────────────────────────────────────── */
  '--dsw-alias-label-primary': ['ink', 'also the tooltip plate (see the mirror above)'],
  '--dsw-alias-label-secondary': ['ink', ''],
  '--dsw-alias-label-tertiary': ['ink', ''],
  '--dsw-alias-label-caption': ['ink', ''],
  '--dsw-alias-label-primary-foreground': ['ink', 'label on a filled control'],
  '--dsw-alias-state-business-primary': ['ink', 'accent mark and the link ink'],
  '--dsw-alias-state-error-primary': ['ink', 'status dot'],
  '--dsw-alias-state-success-primary': ['ink', 'status dot'],
  '--dsw-alias-state-warn-primary': ['ink', 'status dot'],
  '--dsw-alias-state-warn-label': ['ink', ''],
  '--dsw-specific-sidebar-nav-item-active-accent': ['ink', 'the selected settings row mark'],

  /* ── scrims ─────────────────────────────────────────────────────────── */
  '--dsw-alias-bg-mask-1': ['overlay', 'dimming scrim'],
  '--dsw-alias-bg-mask-drop': ['overlay', ''],
}

/* ── discovery ──────────────────────────────────────────────────────────── */

const ROOTS = [
  process.env.DSH_MODULES,
  join(HOME, '.dsh', 'profiles', 'node_modules', '@deepseek-ai'),
  join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules', '@deepseek-ai'),
].filter(Boolean)

const seen = new Set()
/** token -> { count, packages:Set, properties:Set } */
const painted = new Map()

function note(token, prop, file) {
  if (!painted.has(token)) painted.set(token, { count: 0, packages: new Set(), properties: new Set() })
  const e = painted.get(token)
  e.count += 1
  e.properties.add(prop)
  const i = file.indexOf('@deepseek-ai/')
  if (i >= 0) e.packages.add(file.slice(i + '@deepseek-ai/'.length).split('/')[0])
}

/** Property name for a var() reference at `idx`. */
function propAt(text, idx) {
  let depth = 0
  for (let i = idx - 1; i >= 0 && i > idx - 800; i -= 1) {
    const ch = text[i]
    if (ch === ')') depth += 1
    else if (ch === '(') depth -= 1
    else if (depth === 0 && ch === ':') {
      let s = i
      while (s > 0 && /[a-zA-Z-]/.test(text[s - 1])) s -= 1
      return text.slice(s, i)
    } else if (depth === 0 && (ch === ';' || ch === '{' || ch === '}')) break
  }
  return '?'
}

function walk(dir, depth) {
  if (depth > 12) return
  let real
  try { real = realpathSync(dir) } catch { return }
  if (seen.has(real)) return
  seen.add(real)
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = join(dir, e.name)
    let isDir = e.isDirectory()
    if (e.isSymbolicLink()) { try { isDir = statSync(p).isDirectory() } catch { continue } }
    if (isDir) { walk(p, depth + 1); continue }
    if (!e.name.endsWith('.css') && e.name !== 'client.js') continue
    let text
    try { text = readFileSync(p, 'utf8') } catch { continue }
    for (const m of text.matchAll(/var\(\s*(--dsw-(?:alias|specific)-[a-zA-Z0-9-]+)/g)) {
      const prop = propAt(text, m.index)
      /* Only surfaces. `background` is the property that makes a token a plane;
         `color`/`border` are the ink and edge channels and are covered by
         test/contrast.test.js instead. */
      if (!/^background/.test(prop)) continue
      note(m[1], prop, p)
    }
  }
}
for (const r of ROOTS) if (existsSync(r)) walk(r, 0)

/* ── build the ledger ───────────────────────────────────────────────────── */

const entries = []
const unclassified = []
for (const name of [...painted.keys()].sort()) {
  const info = painted.get(name)
  const role = ROLES[name]
  if (!role) {
    entries.push({
      name,
      role: 'UNCLASSIFIED',
      why:
        'NEW surface — decide whether it must read as a separate plane, then add it to ROLES in ' +
        'tools/scan-surface-roles.mjs',
    })
    unclassified.push(name)
    continue
  }
  const [kind, a, b] = role
  entries.push({
    name,
    role: kind,
    ...(kind === 'mirror' ? { mirrorOf: a, why: b || '' } : { why: a }),
    paintedAs: [...info.properties].sort().join(', '),
    by: [...info.packages].sort(),
  })
}

const payload = {
  $comment:
    'GENERATED by tools/scan-surface-roles.mjs — every colour token the installed harness paints ' +
    'as a background, with a recorded role. UNCLASSIFIED entries fail test/contrast.test.js. ' +
    'Regenerate after a DSH upgrade and classify whatever is new.',
  source: {
    roots: ROOTS.map(redact),
    surfaces: entries.length,
  },
  planeFloor: PLANE_FLOOR,
  entries,
}
const serialized = JSON.stringify(payload, null, 2) + '\n'

if (process.argv.includes('--list')) {
  for (const e of entries) {
    console.log(`${e.role.padEnd(13)} ${e.name}${e.mirrorOf ? '  -> ' + e.mirrorOf : ''}`)
    console.log(`              ${e.why || ''}`)
  }
  process.exit(0)
}

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current === serialized) {
    console.log(`surface-role ledger up to date — ${entries.length} surface(s)`)
    process.exit(0)
  }
  console.error('surface-role ledger is STALE — run `node tools/scan-surface-roles.mjs`')
  process.exit(1)
}

writeFileSync(OUT, serialized)
const counts = entries.reduce((acc, e) => { acc[e.role] = (acc[e.role] || 0) + 1; return acc }, {})
console.log(`scanned ${entries.length} surface(s) painted by the installed UI — floor ${PLANE_FLOOR}`)
console.log(`wrote ${redact(OUT)}`)
for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(13)} ${n}`)
if (unclassified.length) {
  console.error(`\n${unclassified.length} UNCLASSIFIED surface(s) need a decision:`)
  for (const n of unclassified) console.error('  ' + n)
  process.exit(1)
}
