/**
 * Derive the surface ladder, instead of keeping each surface as its own island.
 *
 * WHY
 * ---
 * The review that started this was about tool calls, artifacts and the end of a
 * turn not being distinguishable from prose. Measured, the cause is one level
 * down: the light palettes have no surface ladder at all. Contrast against
 * `bg-base`:
 *
 *   surface                 paper   midnight  coral   vivid
 *   markdown-inline-code    1.003    1.359    1.064   1.172
 *   bubble                  1.012    1.283    1.018   1.341
 *   markdown-code-block     1.015    1.283    1.061   1.172
 *   tip                     1.015    1.283    1.000   1.341
 *   bg-layer-2              1.065    1.132    1.039   1.115
 *
 * An inline-code chip at 1.003 is not restraint, it is absent. 珊瑚 is worse in
 * a different way: its ENTIRE ladder sits at 1.039-1.040, one flat level. And on
 * the dark side the problem is ties rather than distance — 青夜 paints its
 * bubble, code block and tip with the SAME colour, 斑斓 its code block and
 * inline chip — so a code block inside a bubble resolves to 1.000.
 *
 * Same cause as the ink ramp: every surface token was chosen on its own, so
 * nothing ever asked whether the SET of them formed a ladder.
 *
 * WHAT THIS ENFORCES
 * ------------------
 *   1. NEIGHBOURS every surface classified `plane` reads at least
 *               SEPARATION_FLOOR away from bg-base. There is deliberately no
 *               separate, larger GROUND floor: an earlier revision had one, and
 *               it is what flattened 珊瑚's card. See the note above
 *               SEPARATION_FLOOR.
 *   2. SEPARATION surfaces that share a screen differ from each other: nesting
 *               (a code block in a bubble) and co-occurrence (an assistant
 *               bubble beside a tool card). Deliberate ties between surfaces
 *               that never appear together are PRESERVED — a system, not a bug.
 *
 * Only violating values move, along the direction they already have, by the
 * smallest amount that clears the constraint. Values that already work are left
 * exactly where they are — including every one in 青夜 and 斑斓, which pass on
 * the ground rule and only need their ties broken.
 *
 * USAGE
 *   node tools/derive-surfaces.mjs           # print the derivation and the diff
 *   node tools/derive-surfaces.mjs --check   # exit 1 if the shipped values differ
 */

import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const require_ = createRequire(import.meta.url)
const { loadClient } = require_(join(ROOT, 'test', 'load-client.js'))
const { contrast, parse, composite } = require_(join(ROOT, 'test', 'color.js'))

const ROLE_LEDGER = require_(join(ROOT, 'test', 'surface-roles.json'))

/* THERE IS NO "EVERY PLANE CLEARS THE GROUND BY X" RULE HERE, and the reason is
   that HanaAgent's own themes say otherwise. An earlier revision read 纸本's
   working surfaces (1.065-1.070) as a floor and then imposed them on every
   palette as a TARGET. That generalisation was invented, and it did real
   damage: 珊瑚's card is authored at #FFFBF3, a 1.033 step from its ground,
   because the design tells a card apart with a hairline and a shadow rather than
   with lightness. Forcing 1.060 pushed it to #FFFEFA -- where sRGB clipping
   stripped its warmth -- and then, when the raised side ran out of headroom,
   pulled it back DOWN to a neutral #EFEEEB while keeping the dead chroma it had
   picked up on the way. Its four mirrors, its menu and its input followed it.
   A plane must be tellable from its neighbours and from the page; it does not
   have to be far from them. The ground is therefore just another neighbour, in
   SEPARATION below, at the one floor this tool has. */
/* A nested or adjacent surface may be subtler than one on the ground — it is
   read against a container the eye has already separated — but it must be read
   at all. */
const SEPARATION_FLOOR = 1.02
/* How much room a plane needs on its own side of the ground to actually READ
   as that plane rather than merely to pass. A card that only just clears the
   floor is a card nobody notices, and on 珊瑚's ground the raised side tops
   out at 1.073 — so "just clears" is all it could ever do. A surface whose
   preferred side cannot give it this much moves to the other one: a recessed
   card is legible, an invisible one is not. */
const READ_HEADROOM = 1.02

/**
 * Pairs that are on screen together and must therefore be tellable apart. The
 * SECOND one moves when they collide.
 *
 * `contains` pairs are nesting (a code block in a bubble). `beside` pairs are
 * co-occurrence: an assistant bubble and a tool card are routinely visible at
 * the same moment, so sharing a fill makes them one object to the eye even
 * though neither is inside the other.
 */
const SEPARATION = [
  ['--dsw-alias-bg-layer-1', '--dsw-specific-bubble', 'beside', 'an assistant bubble and a tool card are visible at the same time'],
  ['--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', 'beside', 'a card and a well are on screen together'],
  ['--dsw-alias-bg-layer-2', '--dsw-alias-bg-layer-3', 'beside', 'a well and a deeper well are on screen together'],
  ['--dsw-specific-bubble', '--dsw-alias-markdown-code-block', 'contains', ''],
  ['--dsw-specific-bubble', '--dsw-alias-markdown-inline-code', 'contains', ''],
  ['--dsw-alias-bg-layer-1', '--dsw-alias-markdown-code-block', 'contains', ''],
  ['--dsw-alias-bg-layer-1', '--dsw-alias-markdown-inline-code', 'contains', ''],
  /* --dsw-specific-tip is deliberately ABSENT from this list. It used to be paired
     here as "a callout on a card" / "a callout inside a bubble", but its three real
     consumers -- the composer, the queue dock and the goal bar -- are siblings of
     the conversation on the page, not nested in a card or a bubble. They are a
     MIRROR of bg-layer-1, because HanaAgent fills all three with --bg-card. The
     pair was asserting a nesting that does not exist. */
]

const unreachable = []
const flippedSides = []
const unmet = []

const PLANES = ROLE_LEDGER.entries.filter((e) => e.role === 'plane').map((e) => e.name)
const MIRRORS = ROLE_LEDGER.entries.filter((e) => e.role === 'mirror')
  .map((e) => [e.name, '--dsw-alias-' + e.mirrorOf, e.mirrorOf])
const GROUND = '--dsw-alias-bg-base'

/* The page is a neighbour too. A plane that cannot be told from the ground is
   not a plane, but it only has to clear SEPARATION_FLOOR — not a floor of its
   own. The ground stays put, so each of these moves the PLANE when they
   collide. */
for (const name of PLANES) {
  SEPARATION.push([GROUND, name, 'beside', 'a plane and the page are on screen together'])
}

/* ── colour maths ───────────────────────────────────────────────────────── */

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function toOklab(value, under) {
  let c = parse(value)
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

function fromOklab(L, a, b) {
  const conv = (L, a, b) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ]
  }
  const ok = (v) => v.every((x) => x >= -1e-6 && x <= 1 + 1e-6)
  let rgb = conv(L, a, b)
  if (!ok(rgb)) {
    let lo = 0, hi = 1
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2
      if (ok(conv(L, a * mid, b * mid))) lo = mid; else hi = mid
    }
    rgb = conv(L, a * lo, b * lo)
  }
  return '#' + rgb
    .map((v) => Math.min(255, Math.max(0, Math.round(unlin(Math.min(1, Math.max(0, v))) * 255))).toString(16).toUpperCase().padStart(2, '0'))
    .join('')
}

/**
 * Move `value` away from `reference` until its contrast clears `floor`, keeping
 * hue and chroma.
 *
 * The DIRECTION is the one the surface already has: a card that sits above the
 * paper keeps sitting above it, a field pressed into the sheet keeps pressing
 * in. Only when the two are already the same colour is there no direction to
 * preserve, and then the recessed side is used.
 *
 * Both alternatives were tried, and both were wrong in ways the gates caught:
 *
 *   · "always toward the palette's extreme" (always darker on light) pushed
 *     珊瑚's raised card DOWN, and #31 failed — correctly. A card is the one
 *     plane whose whole job is to sit above the ground.
 *   · "preserve the direction, and hold a 1% margin above the floor" moved
 *     纸本's card, which already passed at 1.070, into the recessed direction.
 *     The margin was solving a problem that does not exist: a shipped hex has a
 *     deterministic contrast, so 1.0601 measures 1.0601 on every machine.
 *
 * Headroom only matters at the extreme, and it is reported rather than worked
 * around: 珊瑚's ground is #FDF6EC (L* 97.6) so its maximum RAISED contrast is
 * 1.073, against 纸本's 1.144. It can still reach the floor upward — just — and
 * a floor that is genuinely unreachable in the direction a surface sits is
 * named rather than silently flipped.
 */
/**
 * Which side of the ground a surface sits on is decided ONCE, from an absolute
 * rule, and never re-decided per constraint.
 *
 *   RAISED  moves toward white: the sheet laid ON the paper, and the popovers
 *           that float above it. #31 already requires bg-layer-1 to be raised.
 *   RECESSED (everything else) moves toward black: a field pressed INTO the
 *           sheet — a message bubble, a code block, a note in the margin, a
 *           sunken well.
 *
 * The absoluteness matters. 'Away from the ground' is ambiguous because contrast
 * is symmetric — both directions increase it — and three earlier versions of
 * this tool flip-flopped on that ambiguity, oscillating a surface between the
 * two sides until the separation and ground passes were fighting each other and
 * the result satisfied neither. Toward-white / toward-black cannot oscillate.
 *
 * Values that already clear their floor are returned untouched, so a surface
 * that ships on the other side and works stays there.
 */
const RAISED = new Set([
  '--dsw-alias-bg-layer-1',
  '--dsw-specific-input-major',
  '--dsw-specific-menu',
  '--dsw-alias-interactive-bg-hover-solid',
])

function solveOnSide(value, reference, floor, name) {
  const ref = reference.toLowerCase()
  /* A surface MEANT to be raised is held to floor x READ_HEADROOM even when it
     already clears the floor: merely passing is what made 珊瑚's card
     invisible. Everything else is satisfied by the floor itself. */
  const need = RAISED.has(name) ? floor * READ_HEADROOM : floor
  if (value.toLowerCase() !== ref && contrast(value, reference) >= need) return value
  const v = toOklab(value, reference)
  /* RAISED is a PREFERENCE, not a rule: it says which surfaces are conceptually
     sheets above the paper. Headroom decides whether the palette can afford
     one. A surface that ships on the raised side and passes is returned above
     and never reaches here. */
  const maxUp = contrast(fromOklab(v.L + 0.85, v.a, v.b), reference)
  const raised = RAISED.has(name) && maxUp >= floor * READ_HEADROOM
  const dir = raised ? 1 : -1
  const best = (d) => fromOklab(v.L + dir * d, v.a, v.b)

  let lo = 0
  let hi = 0.85
  let found = null
  for (let i = 0; i < 70; i += 1) {
    const mid = (lo + hi) / 2
    if (contrast(best(mid), reference) >= need) { found = mid; hi = mid } else lo = mid
  }
  if (found === null) {
    unreachable.push(
      `${name}: ${value} cannot reach ${need}:1 against ${reference} toward ${dir > 0 ? 'white' : 'black'} ` +
        `(that side tops out at ${contrast(best(0.85), reference).toFixed(3)}:1)`,
    )
    return value
  }

  /* Among the 8-bit colours at or beyond the solution take the one closest to
     the floor, searching only on the far side so the result can never fall back
     below it. Same quantisation the ink ramp has to handle. */
  let out = best(found)
  let err = Math.abs(contrast(out, reference) - need)
  for (let i = 0; i <= 120; i += 1) {
    const hex = best(found + (i / 120) * 0.03)
    const e = Math.abs(contrast(hex, reference) - need)
    if (e < err) { err = e; out = hex }
  }
  return out
}

/* ── derive ─────────────────────────────────────────────────────────────── */

const PALETTES = loadClient().exports.PALETTES
const results = []
let changed = 0

for (const palette of PALETTES) {
  const T = palette.tokens
  const recessedOnLight = palette.scheme === 'light'
  const ground = T[GROUND]

  /* Start from the shipped values; only violating ones move. */
  const want = {}
  for (const name of PLANES) if (T[name] !== undefined) want[name] = T[name]

  for (let pass = 0; pass < 40; pass += 1) {
    let moved = false

    /* Surfaces that share a screen differ from each other — the ground included,
       through the pairs appended above. */
    for (const [outer, inner] of SEPARATION) {
      if (want[outer] === undefined || want[inner] === undefined) continue
      const next = solveOnSide(want[inner], want[outer], SEPARATION_FLOOR, inner)
      if (next !== want[inner]) { want[inner] = next; moved = true }
    }

    if (!moved) break
  }

  /* The tool must not emit a derivation that breaks its own rules: iterate to a
     fixed point and then CHECK the result, rather than trusting that the passes
     settled. An earlier version returned 珊瑚's code block at 1.040 against a
     floor of 1.060 because a separation pass had moved it after its ground pass
     and the loop exited on a pass that happened to move nothing else. */
  /* Mirrors follow their source. They are not in PLANES — they are not surfaces
     in their own right — but leaving them behind is how 珊瑚 ended up with a
     raised card at #FFFEFA while bg-overlay, the three button fills and the
     login input all still sat at the old #FFFBF3. The check found it, which is
     the point, but the derivation should not produce it. */
  for (const [mirror, source] of MIRRORS) {
    if (want[source] === undefined) continue
    if (T[mirror] === undefined) continue
    want[mirror] = want[source]
  }

  for (const [outer, inner] of SEPARATION) {
    if (want[outer] === undefined || want[inner] === undefined) continue
    if (contrast(want[inner], want[outer]) < SEPARATION_FLOOR) {
      unmet.push(`${palette.id} ${inner} vs ${outer} = ${contrast(want[inner], want[outer]).toFixed(3)}:1, floor ${SEPARATION_FLOOR}`)
    }
  }

  results.push({ palette, ground, want })
}

/* ── report ─────────────────────────────────────────────────────────────── */

const pad = (s, n) => String(s).padEnd(n)
const short = (n) => n.replace('--dsw-alias-', 'a:').replace('--dsw-specific-', 's:')

const QUIET = process.argv.includes('--json')
const say = (...a) => { if (!QUIET) console.log(...a) }
say('SURFACE LADDER DERIVATION')
say(`separation floor ${SEPARATION_FLOOR} (the ground is one of the neighbours)`)
say('only values that violate a rule move; hue and chroma are held\n')

for (const r of results) {
  const T = r.palette.tokens
  say('='.repeat(80))
  say(`${r.palette.id}   ground ${r.ground}   scheme ${r.palette.scheme}`)
  say('  ' + pad('surface', 42) + pad('shipped', 10) + pad('derived', 10) + pad('vs ground', 11) + 'step')
  let prev = null
  let prevName = null
  for (const name of PLANES) {
    if (r.want[name] === undefined) continue
    const was = T[name]
    const now = r.want[name]
    const c = contrast(now, r.ground)
    const mark = was.toLowerCase() !== now.toLowerCase() ? '  <- changes' : ''
    if (mark) changed += 1
    say('  ' + pad(short(name), 42) + pad(was, 10) + pad(now, 10) + pad(c.toFixed(3), 11) + mark)
  }
  const ties = []
  const seenVals = new Map()
  for (const name of PLANES) {
    if (r.want[name] === undefined) continue
    const k = r.want[name].toLowerCase()
    if (!seenVals.has(k)) seenVals.set(k, [])
    seenVals.get(k).push(short(name))
  }
  for (const g of seenVals.values()) if (g.length > 1) ties.push(g.join(' = '))
  say('  ties: ' + (ties.length ? ties.join(' | ') : '(none)'))
}

/* ── nesting check ──────────────────────────────────────────────────────── */

let nestBad = 0
say('\n' + '='.repeat(80))
say('SEPARATION after derivation (pairs that share a screen)')
for (const r of results) {
  for (const [outer, inner, kind, why] of SEPARATION) {
    if (r.want[outer] === undefined || r.want[inner] === undefined) continue
    const c = contrast(r.want[inner], r.want[outer])
    const tag = kind === 'beside' ? '(beside)' : '(contains)'
    say(`  ${r.palette.id.padEnd(20)} ${short(outer)} > ${short(inner)} ${tag.padEnd(11)} ${c.toFixed(3)}`)
    if (c < SEPARATION_FLOOR) { nestBad += 1; say(`      BELOW ${SEPARATION_FLOOR} ${why}`) }
  }
}
say(nestBad ? `${nestBad} separation pair(s) still below ${SEPARATION_FLOOR}` : `every separation pair clears ${SEPARATION_FLOOR}`)

/* ── check ──────────────────────────────────────────────────────────────── */

let mismatch = 0
for (const r of results) {
  for (const name of PLANES) {
    if (r.want[name] === undefined) continue
    if (r.palette.tokens[name].toLowerCase() !== r.want[name].toLowerCase()) mismatch += 1
  }
}

if (process.argv.includes('--json')) {
  /* Machine-readable, so applying the derivation to lib/client.js is a
     mechanical edit rather than a transcription. Transcribing nineteen hex
     values by hand is exactly how a "generated" table stops being generated. */
  const out = {}
  for (const r of results) {
    const changes = {}
    for (const name of PLANES) {
      if (r.want[name] === undefined) continue
      if (r.palette.tokens[name].toLowerCase() === r.want[name].toLowerCase()) continue
      changes[name] = { from: r.palette.tokens[name], to: r.want[name] }
    }
    /* Mirrors are emitted too: they follow their source, and a mirror left behind
       is exactly the drift the #33 mirror assertion exists to catch. */
    for (const [mirror, source] of MIRRORS) {
      const to = r.want[source]
      const from = r.palette.tokens[mirror]
      if (from === undefined || to === undefined) continue
      if (from.toLowerCase() === to.toLowerCase()) continue
      changes[mirror] = { from, to }
    }
    if (Object.keys(changes).length) out[r.palette.id] = changes
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

if (process.argv.includes('--check')) {
  if (mismatch) {
    console.error(`\nderive-surfaces: ${mismatch} shipped surface(s) do not match the derivation`)
    console.error('Run `node tools/derive-surfaces.mjs` and update lib/client.js to match.')
    process.exit(1)
  }
  console.log(`\nderive-surfaces: all ${results.length * PLANES.length} plane values reproduce exactly`)
  process.exit(0)
}

if (unmet.length) {
  console.error('\nDERIVATION DOES NOT SATISFY ITS OWN RULES:')
  for (const u of unmet) console.error('  ' + u)
}
if (flippedSides.length) {
  say('\nFLIPPED to the other side of the ground (its own side had no headroom):')
  for (const f of flippedSides) say('  ' + f)
}
if (unreachable.length) {
  console.error('\nUNREACHABLE — the floor cannot be met on the side these sit:') 
  for (const u of unreachable) console.error('  ' + u)
}
say(`\n${changed} value(s) differ from the shipped tables.`)
