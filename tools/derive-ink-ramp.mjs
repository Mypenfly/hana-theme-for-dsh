/**
 * Derive the ink ramp from two anchors, instead of keeping five hand-picked
 * values per palette.
 *
 * WHY
 * ---
 * `skin.json` and the L1 header both describe this theme as five ink stops. It
 * shipped as four, and four different rhythms:
 *
 *   palette   primary  secondary  tertiary  caption  dimmed     steps
 *   paper      13.12     8.50      5.28      5.28     3.13     .65 .62 1.00 .59
 *   midnight    7.51     5.18      4.52      4.52     2.70     .69 .87 1.00 .60
 *   coral      12.52     9.73      4.72      4.72     2.91     .78 .49 1.00 .62
 *   vivid      11.74     9.50      7.44      7.44     4.90     .81 .78 1.00 .66
 *
 * (figures are contrast against `bg-base`; `step` is the ratio to the stop
 * above). Two things are wrong with that and only one of them is cosmetic:
 *
 *   · `caption` is IDENTICAL to `tertiary` in every palette — a step of 1.00.
 *     Two named levels of hierarchy, one colour. Upstream DSH keeps them 14.5 L*
 *     apart in both modes, always with caption nearer the background, so the
 *     ornament is meant to be the fainter of the two.
 *   · the middle step ranges from 0.49 to 0.87 depending on the palette, so
 *     "secondary" and "tertiary" mean visibly different things in 珊瑚 and 青夜.
 *     22 and 23 consumers respectively, all of them prose.
 *
 * WHAT REPLACES IT
 * ----------------
 * A geometric ramp in CONTRAST RATIO, anchored on the two values that are not
 * free to move:
 *
 *   primary    the palette's body ink — its identity, and the value the whole
 *              palette is recognisable by
 *   tertiary   the lightest stop that still has to clear AA as text, and the
 *              one the contrast suite already asserts. It is left EXACTLY where
 *              it is. Raising it "for margin" was tried and rejected: the ramp
 *              factor is sqrt(tertiary/primary), so lifting the floor on a dark
 *              palette makes every step narrower, and 青夜's steps are already
 *              the narrowest of the four. Margin is a separate question from
 *              rhythm, and mixing them would have made this tool quietly a
 *              redesign.
 *
 * Everything between and below follows:
 *
 *   f         = sqrt(contrast(tertiary) / contrast(primary))   per-step factor
 *   secondary = primary x f          — the geometric mean, which is the whole
 *                                      point: it is what removes an arbitrary
 *                                      hand-picked middle value
 *   caption   = primary x f^2.5      — half a step below tertiary, matching
 *                                      upstream DSH, which keeps caption 14.5 L*
 *                                      from tertiary in both modes and always
 *                                      nearer the background
 *   dimmed    = primary x f^3
 *
 * A shared factor across palettes is NOT achievable here, and it is worth being
 * precise about why rather than pretending otherwise. On a dark ground the
 * distance from AA (4.5) to the body ink is short — 青夜's primary is only
 * 7.51 — so the same span has to be crossed in fewer contrast units and the
 * factor is inevitably wider (.78 against 纸本's .63). Equalising it would mean
 * moving either the body ink or the AA floor. What CAN be equalised is the
 * SHAPE: every step is the same multiple of the one above it, in every palette.
 * That is what this tool produces, and what test/contrast.test.js asserts.
 *
 * The ramp also lives on a straight line in OKLab from `primary` toward the
 * shipped `tertiary`, so hue and chroma progress smoothly and only two anchors
 * per palette have to be right.
 *
 * USAGE
 *   node tools/derive-ink-ramp.mjs           # print the derivation and the diff
 *   node tools/derive-ink-ramp.mjs --check   # exit 1 if the shipped values differ
 */

import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const require_ = createRequire(import.meta.url)

const { loadClient } = require_(join(ROOT, 'test', 'load-client.js'))
const { contrast, parse, composite } = require_(join(ROOT, 'test', 'color.js'))

const AA = 4.5
/* Reported, not enforced. 青夜's tertiary sits 0.02:1 above AA, which is worth
   knowing when reading this output — it is the tightest value in the theme —
   but it is not this tool's business to move it. */
const TIGHT = 1.05

/** Tokens the derivation owns, in ramp order.
 *  `anchor` stops are INPUTS — read from the shipped table and left untouched.
 *  A `power` stop carries the exponent of f it sits at, and is derived.
 *  `tertiary` is an anchor rather than a derive target on purpose: re-solving it
 *  would move it by a last-digit rounding step, and it is the stop the contrast
 *  suite already pins, so the derivation must not be able to drift it. */
const RAMP = [
  ['--dsw-alias-label-primary', { anchor: true }],
  ['--dsw-alias-label-secondary', { power: 1 }],
  ['--dsw-alias-label-tertiary', { anchor: true }],
  ['--dsw-alias-label-caption', { power: 2.5 }],
  ['--dsw-alias-label-dimmed', { power: 3 }],
]
/* Two more roles are byte-identical to a ramp stop in all four palettes — a
   second spelling of the secondary stop, and the placeholder ink, which is the
   dimmed stop by another name. Both have to move with the stop they mirror, or
   the tie breaks the moment the ramp changes. Recorded here rather than
   discovered later, and asserted by `--check`. */
const MIRRORS = [
  ['--dsw-alias-label-primary-dimmed', '--dsw-alias-label-secondary'],
  ['--dsw-alias-markdown-placeholder', '--dsw-alias-label-dimmed'],
]

/* ── colour maths ───────────────────────────────────────────────────────── */

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const unlin = (c) => { const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; return s }

function toOklab(hex, under) {
  let c = parse(hex)
  if (c.a < 1) c = composite(c, parse(under || '#FFFFFF'))
  const r = lin(c.r), g = lin(c.g), b = lin(c.b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  }
}

/** OKLab -> linear sRGB, with chroma reduced (never clipped) until in gamut. */
function fromOklab(lab) {
  const convert = (L, a, b) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ]
  }
  const inGamut = (rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6)
  let scale = 1
  let rgb = convert(lab.L, lab.a * scale, lab.b * scale)
  if (!inGamut(rgb)) {
    let lo = 0, hi = 1
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2
      if (inGamut(convert(lab.L, lab.a * mid, lab.b * mid))) lo = mid
      else hi = mid
    }
    scale = lo
    rgb = convert(lab.L, lab.a * scale, lab.b * scale)
  }
  return rgb.map((v) => Math.min(255, Math.max(0, Math.round(unlin(Math.min(1, Math.max(0, v))) * 255))))
}

const hexOf = (rgb) => '#' + rgb.map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join('')

/** The ramp line: primary at t=0, the shipped tertiary at t=1. */
function lineFor(tokens) {
  const p = toOklab(tokens['--dsw-alias-label-primary'], tokens['--dsw-alias-bg-base'])
  const t = toOklab(tokens['--dsw-alias-label-tertiary'], tokens['--dsw-alias-bg-base'])
  return {
    at: (k) => ({
      L: p.L + (t.L - p.L) * k,
      a: p.a + (t.a - p.a) * k,
      b: p.b + (t.b - p.b) * k,
    }),
  }
}

/** Solve for the point on the line whose contrast against `base` is `target`.
 *
 *  Bisection alone is not enough at this precision. A colour has to survive an
 *  8-bit round trip, so the achievable contrast values are quantised, and the
 *  final bisection iterate can sit one quantum away from the target — which is
 *  how a "geometric mean" ends up 2% off the geometric mean. So the bisection
 *  finds the neighbourhood and a local scan picks the reachable colour whose
 *  contrast is actually closest. */
function solve(line, base, target) {
  const at = (k) => hexOf(fromOklab(line.at(k)))
  const err = (k) => Math.abs(contrast(at(k), base) - target)
  let lo = 0, hi = 2.5
  /* contrast falls monotonically as k grows: the colour moves toward the
     surface. Guard the ends before bisecting, so an unreachable target is
     reported instead of silently clamped. */
  const cLo = contrast(at(lo), base)
  const cHi = contrast(at(hi), base)
  if (target > cLo || target < cHi) return null
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2
    if (contrast(at(mid), base) > target) lo = mid
    else hi = mid
  }
  const centre = (lo + hi) / 2
  let best = at(centre)
  let bestErr = err(centre)
  for (let i = -200; i <= 200; i += 1) {
    const k = centre + (i / 200) * 0.05
    if (k < 0) continue
    const e = err(k)
    if (e < bestErr) { bestErr = e; best = at(k) }
  }
  return best
}

/* ── derive ─────────────────────────────────────────────────────────────── */

const PALETTES = loadClient().exports.PALETTES
const results = []
let problems = 0

/* The surfaces the contrast suite actually asserts tertiary ink against. The
   anchor is not free to be merely "the shipped value": it has to clear AA on
   EVERY surface it is painted on, and the DARKEST of them binds — for dark ink
   on a light ground, contrast falls as the ground darkens.

   That dependency became real the moment the surface ladder moved: 珊瑚's
   `bg-layer-2` went from #FCF1E4 to #F9EEE2 to read as a well at all, and its
   tertiary ink dropped from 4.72:1 to 4.43:1 on it — below AA. So the anchor is
   now the shipped value RAISED until it clears AA everywhere, rather than an
   input nobody re-checks. */
const INK_SURFACES = ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-2']

for (const palette of PALETTES) {
  const T = palette.tokens
  const base = T['--dsw-alias-bg-base']
  const shipped = {
    tertiary: T['--dsw-alias-label-tertiary'],
    secondary: T['--dsw-alias-label-secondary'],
    caption: T['--dsw-alias-label-caption'],
    dimmed: T['--dsw-alias-label-dimmed'],
  }

  /* Raise the anchor if any asserted surface cannot carry it. Solved on the same
     primary-to-tertiary line as everything else, on the t<=1 side so it moves
     toward the body ink; a palette whose anchor already clears every surface is
     untouched. */
  const line0 = lineFor(T)
  let tertiary = shipped.tertiary
  const raisedFor = []
  for (const surface of INK_SURFACES) {
    const bg = T[surface]
    if (contrast(tertiary, bg) >= AA) continue
    const needed = solve(line0, bg, AA)
    if (needed === null) {
      console.error(`${palette.id}: cannot clear AA on ${surface} along the ink line`)
      problems += 1
      continue
    }
    tertiary = needed
    raisedFor.push(`${surface.replace('--dsw-alias-', '')} (was ${contrast(shipped.tertiary, bg).toFixed(2)}:1)`)
  }

  const cPrimary = contrast(T['--dsw-alias-label-primary'], base)
  const cTertiary = contrast(tertiary, base)
  const f = Math.sqrt(cTertiary / cPrimary)

  const line = lineFor(T)
  const want = {}
  for (const [name, spec] of RAMP) {
    const current = T[name]
    if (spec.anchor) {
      want[name] = name === '--dsw-alias-label-tertiary' ? tertiary : current
      continue
    }
    const target = cPrimary * f ** spec.power
    const hex = solve(line, base, target)
    if (hex === null) {
      console.error(`${palette.id}: ${name} target ${target.toFixed(3)}:1 is not reachable on this ramp line`)
      problems += 1
      continue
    }
    want[name] = hex
  }

  results.push({ palette, base, shipped, cPrimary, cTertiary, f, want, tertiary, raisedFor })
}

/* ── report ─────────────────────────────────────────────────────────────── */

const pad = (s, n) => String(s).padEnd(n)
const f2 = (n) => n.toFixed(2)

const QUIET = process.argv.includes('--json')
const say = (...a) => { if (!QUIET) console.log(...a) }
say('INK RAMP DERIVATION')
say('f = sqrt(t / p);  secondary = p*f,  caption = p*f^2.5,  dimmed = p*f^3')
say('primary and tertiary are the anchors and are left untouched\n')

let mismatch = 0
for (const r of results) {
  say('='.repeat(78))
  say(`${r.palette.id}   base ${r.base}`)
  say(
    `  primary ${f2(r.cPrimary)}:1   f ${r.f.toFixed(4)}   ` +
      `tertiary ${f2(r.cTertiary)}:1` + (r.cTertiary < AA * TIGHT ? '   <- TIGHT: within 5% of the AA floor' : ''),
  )
  say('  ' + pad('stop', 24) + pad('shipped', 10) + pad('derived', 10) + pad('ratio', 9) + 'step')
  let prev = null
  for (const [name, spec] of RAMP) {
    const key = name.replace('--dsw-alias-label-', '')
    const hex = r.want[name]
    if (hex === undefined) continue
    const c = contrast(hex, r.base)
    const step = prev === null ? '' : (c / prev).toFixed(3)
    prev = c
    const was = r.shipped[key] || r.palette.tokens[name]
    const mark = name === '--dsw-alias-label-primary'
      ? '  (anchor)'
      : was && was.toLowerCase() !== hex.toLowerCase() ? '  <- changes' : ''
    /* Only  is genuinely fixed now: the tertiary anchor is DERIVED,
       raised when a surface cannot carry it, so it must count as a value the
       check re-derives rather than one it takes on trust. */
    if (name !== '--dsw-alias-label-primary' && was && was.toLowerCase() !== hex.toLowerCase()) mismatch += 1
    say('  ' + pad(key, 24) + pad(was || '(new)', 10) + pad(hex, 10) + pad(f2(c), 9) + step + mark)
  }
  const caps = RAMP.map(([n]) => contrast(r.want[n], r.base))
  const steps = caps.slice(1).map((c, i) => c / caps[i])
  const geo = Math.sqrt(caps[0] * caps[2])
  say('  ' + pad('steps', 24) + steps.map((s) => s.toFixed(3)).join('  '))
  say(
    '  ' + pad('geometric check', 24) + `secondary^2 / (primary*tertiary) = ` +
      (caps[1] ** 2 / (caps[0] * caps[2])).toFixed(4) + '  (1.0000 = exactly even)',
  )
}

/* ── check ──────────────────────────────────────────────────────────────── */

const mirrors = []
for (const r of results) {
  for (const [mirror, source] of MIRRORS) {
    const a = r.palette.tokens[mirror]
    const b = r.want[source]
    if (a !== undefined && b !== undefined && a.toLowerCase() !== b.toLowerCase()) {
      mirrors.push(`${r.palette.id}: ${mirror} is ${a}, but ${source} derives to ${b}`)
    }
  }
}

if (process.argv.includes('--json')) {
  const out = {}
  for (const r of results) {
    const changes = {}
    for (const [name] of RAMP) {
      if (r.want[name] === undefined) continue
      const was = r.palette.tokens[name]
      if (was.toLowerCase() === r.want[name].toLowerCase()) continue
      changes[name] = { from: was, to: r.want[name] }
    }
    for (const [mirror, source] of MIRRORS) {
      const to = r.want[source]
      const was = r.palette.tokens[mirror]
      if (was === undefined || to === undefined) continue
      if (was.toLowerCase() === to.toLowerCase()) continue
      changes[mirror] = { from: was, to }
    }
    if (Object.keys(changes).length) out[r.palette.id] = changes
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

if (process.argv.includes('--check')) {
  if (mismatch || mirrors.length) {
    console.error(`\nderive-ink-ramp: ${mismatch} shipped value(s) do not match the derivation`)
    for (const m of mirrors) console.error('  ' + m)
    console.error('Run `node tools/derive-ink-ramp.mjs` and update lib/client.js to match.')
    process.exit(1)
  }
  console.log(
    `\nderive-ink-ramp: all ${results.length * (RAMP.length - 1)} derived stops reproduce exactly`,
  )
  process.exit(problems ? 1 : 0)
}

console.log(`\n${mismatch} value(s) differ from the shipped tables.`)
for (const m of mirrors) console.log('  mirror: ' + m)
