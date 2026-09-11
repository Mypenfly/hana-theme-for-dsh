/**
 * Scan the installed harness for every custom property that carries a COLOUR,
 * and keep a ledger of what hana does about each one.
 *
 * WHY THIS EXISTS
 * ---------------
 * The contrast suite asserted 19 hand-picked pairs. A hand-picked list can only
 * cover surfaces somebody thought of, so whatever nobody thought of is
 * unmeasured no matter how green the build is. That is not a hypothetical: the
 * code block's syntax colours were never on the list, even though this theme is
 * the thing that chooses the code block's surface — and 4 of the 5 token
 * colours a sample exercises turned out to be below AA in three of four
 * palettes, invisible to a suite reporting 91 passing assertions.
 *
 * So the fix is not "add the pairs we missed". It is to enumerate the colour
 * surfaces from the ARTIFACT, and require a recorded decision for every one of
 * them. A DSH upgrade that introduces a new colour-carrying property lands in
 * the ledger as UNCLASSIFIED and fails the build, which is the point: the
 * decision gets made on purpose instead of by omission.
 *
 *   node tools/scan-color-surfaces.mjs           # refresh, preserving decisions
 *   node tools/scan-color-surfaces.mjs --check   # fail if the ledger is stale
 *   node tools/scan-color-surfaces.mjs --list    # show every surface found
 *
 * Like refresh-allowlist.mjs this needs an INSTALLED harness, so it is not part
 * of `npm test` — `test/surfaces.test.js` validates the ledger offline.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT = join(ROOT, 'test', 'color-surfaces.json')

/* ── decisions ──────────────────────────────────────────────────────────
 * Every surface the current harness ships is classified here BY HAND, once.
 * The three classes are deliberately narrow:
 *
 *   theme    hana must supply it, and the plugin actually does.
 *   derived  the harness declares it as a reference to a token hana owns, so it
 *            follows the palette automatically with nothing to write. Recorded
 *            so the ledger states the whole contract instead of implying these
 *            were overlooked.
 *   harness  the harness owns it and a theme must NOT write it: either it
 *            adapts per mode by itself, or it is unreachable without pinning a
 *            build-hash class name, which this theme forbids.
 *   boot     rendered before this plugin can be mounted, so a theme cannot
 *            reach it even in principle.
 *
 * Any name not in this map is a NEW surface and lands as UNCLASSIFIED.
 */
const DECISIONS = {
  '--dsh-boot-bg': ['boot', 'boot splash, painted before any client plugin mounts'],
  '--dsh-boot-border': ['boot', 'boot splash'],
  '--dsh-boot-brand': ['boot', 'boot splash'],
  '--dsh-boot-label-primary': ['boot', 'boot splash'],
  '--dsh-boot-label-secondary': ['boot', 'boot splash'],
  '--dsh-boot-label-tertiary': ['boot', 'boot splash'],

  /* References to tokens this theme owns — they follow the palette with
     nothing to write. Verified by reading the declaring rule, not assumed from
     the value shape. */
  '--dsh-scrollbar-thumb': ['derived', 'Menu.module.css declares it as var(--dsw-alias-scrollbar-bg-l2), which this theme sets'],
  '--dsh-scrollbar-thumb-hover': ['derived', 'Menu.module.css declares it as var(--dsw-alias-scrollbar-hover-l2), which this theme sets'],
  '--dsl-code-block-banner-background-color': ['derived', 'CodeBlock.module.css declares it as var(--dsw-alias-markdown-code-block-banner), which this theme sets'],
  '--dsw-elevation-stroke-color': ['derived', 'Menu.module.css declares it as var(--dsw-alias-border-l1), which this theme sets'],

  '--dsh-state-ongoing': [
    'harness',
    'the ongoing-state dot, pinned to the raw static ramp (var(--dsw-static-deepseek-450)) — ' +
      'StateDot.module.css says so itself: "Ongoing blue has no alias token". It is declared on ' +
      'the component class (.dot, .matrix), so a body-level rule cannot out-inherit it and the ' +
      'declaring class is a CSS-Module name that hashes per build. Reaching it would mean pinning ' +
      'a build hash, which judgements 5 and 16 forbid. Recorded as a known, deliberate leak: a ' +
      'brand-blue dot on the ongoing state, in every palette.',
  ],

  '--dsw-hovercard-bg': [
    'harness',
    'HoverCard.module.css hardcodes a dark overlay surface in BOTH modes; it is a deliberate ' +
      'inverted surface, not a palette slot, and re-tinting it per palette would break the ' +
      'contrast it was chosen for',
  ],

  /* JsonTree.module.css declares each of these twice — a light value and a
     dark override — so it already follows the mode on its own. */
  '--json-tree-hover': ['harness', 'JsonTree.module.css declares light + dark variants'],
  '--json-tree-icon': ['harness', 'JsonTree.module.css declares light + dark variants'],
  '--json-tree-keyword': ['harness', 'JsonTree.module.css declares light + dark variants'],
  '--json-tree-number': ['harness', 'JsonTree.module.css declares light + dark variants'],
  '--json-tree-property': ['harness', 'JsonTree.module.css declares light + dark variants'],
  '--json-tree-punctuation': ['harness', 'JsonTree.module.css declares light + dark variants'],
  '--json-tree-string': ['harness', 'JsonTree.module.css declares light + dark variants'],
}

/* Family rules, for surfaces that arrive in large sets. Checked after the
   exact-name map, so an individual member can still be called out. */
const FAMILIES = [
  [
    /^--dsw-static-/,
    'harness',
    'the raw colour ramp the harness\'s own alias tokens resolve from (~73 members). This theme ' +
      're-tints the ALIAS layer instead of the ramp, deliberately: repainting the ramp changes ' +
      'every consumer at once, including ones this theme has never measured. Re-tinting it to ' +
      'scrub brand residue is a real technique, but it is a different, larger change.',
  ],
]

/* ── discovery ──────────────────────────────────────────────────────────── */

const HOME = homedir()
const redact = (p) => (HOME && p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p)

/** Every .css file under the installed @deepseek-ai client packages. */
function cssFiles() {
  const roots = [
    process.env.DSH_MODULES,
    join(HOME, '.dsh', 'profiles', 'node_modules', '@deepseek-ai'),
  ].filter(Boolean)
  const out = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const walk = (dir, depth) => {
      if (depth > 8) return
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const p = join(dir, e.name)
        if (e.isSymbolicLink() || e.isDirectory()) walk(p, depth + 1)
        else if (e.name.endsWith('.css')) out.push(p)
      }
    }
    walk(root, 0)
  }
  return out
}

/** Inlined stylesheets inside a client bundle (shiki's sheet lives in one). */
function inlinedSheets() {
  const out = []
  const themeClient = join(
    HOME,
    '.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
  )
  if (!existsSync(themeClient)) return out
  const src = readFileSync(themeClient, 'utf8')
  for (const marker of ['design_platform_css_default', 'shiki_css_default']) {
    const at = src.indexOf(marker)
    if (at < 0) continue
    let q = src.indexOf('=', at) + 1
    while (q < src.length && src[q] !== '"' && src[q] !== "'") q += 1
    const quote = src[q]
    let end = q + 1
    while (end < src.length && src[end] !== quote) {
      if (src[end] === '\\') end += 1
      end += 1
    }
    out.push({ file: themeClient, marker, css: src.slice(q + 1, end) })
  }
  return out
}

const COLOURISH =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black|transparent|currentColor)\b/

/**
 * A custom property "carries a colour" if its value is a colour literal OR a
 * reference to another colour-carrying property.
 *
 * The reference case is not pedantry: `--shiki-foreground` is declared as
 * `var(--dsw-alias-label-primary)`, so a literal-only scan misses the two
 * properties that carry the code block's ink — the exact pair whose broken
 * `:root` resolution is part of why the syntax channel misbehaved.
 */
const REFERENCES_COLOUR = /var\(\s*--(?:dsw-(?:alias|specific|static)-|shiki-)/

const carriesColour = (value) => COLOURISH.test(value) || REFERENCES_COLOUR.test(value)

/** Custom properties DECLARED with a colour value. */
function colourDeclarations(css) {
  const found = new Map()
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g)) {
    const value = m[2].trim()
    if (!carriesColour(value)) continue
    if (!found.has(m[1])) found.set(m[1], value.slice(0, 60))
  }
  return found
}

/* ── scan ───────────────────────────────────────────────────────────────── */

const surfaces = new Map()
for (const file of cssFiles()) {
  let css
  try {
    css = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const [name, value] of colourDeclarations(css)) {
    if (!surfaces.has(name)) surfaces.set(name, { name, where: redact(relative(ROOT, file)), sample: value })
  }
}
for (const { marker } of inlinedSheets()) {
  const src = readFileSync(
    join(HOME, '.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'),
    'utf8',
  )
  const at = src.indexOf(marker)
  let q = src.indexOf('=', at) + 1
  while (q < src.length && src[q] !== '"' && src[q] !== "'") q += 1
  const quote = src[q]
  let end = q + 1
  while (end < src.length && src[end] !== quote) {
    if (src[end] === '\\') end += 1
    end += 1
  }
  for (const [name, value] of colourDeclarations(src.slice(q + 1, end))) {
    surfaces.set(name, {
      name,
      where: `@deepseek-ai/dsh-client-ui-theme/lib/client.js (${marker})`,
      sample: value,
    })
  }
}

/* The two channels hana supplies itself. They are registered/overridden at
   runtime rather than declared in a stylesheet, so a CSS scan cannot see them —
   they are added here so the ledger accounts for them too. */
const PROVIDED = {
  '--dsw-alias-*': 'theme',
  '--dsw-specific-*': 'theme',
  '--shiki-*': 'theme',
}

const registeredTokens = (() => {
  const file = join(ROOT, 'test', 'token-allowlist.json')
  if (!existsSync(file)) return []
  return JSON.parse(readFileSync(file, 'utf8')).tokens || []
})()
const syntaxTokens = (() => {
  const file = join(ROOT, 'test', 'token-allowlist.json')
  if (!existsSync(file)) return []
  return JSON.parse(readFileSync(file, 'utf8')).syntaxTokens || []
})()

const isProvided = (name) =>
  registeredTokens.includes(name) || syntaxTokens.includes(name)

/* ── build the ledger ───────────────────────────────────────────────────── */

const entries = []
const unclassified = []

/* Names the plugin supplies that NO stylesheet declares.
 *
 * The registered colour tokens are written by the theme service as INLINE
 * styles on <body> at runtime and appear in no stylesheet, so a CSS scan sees
 * only the handful the harness also happens to declare. They are added
 * explicitly so the ledger is a complete statement of the contract rather than
 * a report of what happened to be in CSS — otherwise "the ledger covers
 * everything" would be false for seventy-odd tokens, which is the same quiet
 * under-reporting this file exists to prevent. */
for (const [name, kind] of [
  ...registeredTokens.map((n) => [n, 'registered colour token']),
  ...syntaxTokens.map((n) => [n, 'syntax-palette name']),
]) {
  if (surfaces.has(name)) continue
  entries.push({
    name,
    class: 'theme',
    why: `supplied by this plugin: ${kind}, written inline on <body> at runtime`,
    seenAt: 'written by lib/client.js at runtime, not declared in a stylesheet',
  })
}

for (const [name, info] of [...surfaces].sort((a, b) => a[0].localeCompare(b[0]))) {
  /* A name hana supplies is `theme` by construction, whatever the CSS scan says
     about where the harness also declares it. */
  if (isProvided(name)) {
    entries.push({
      name,
      class: 'theme',
      why: 'supplied by this plugin: registered colour token or inline syntax palette',
      seenAt: info.where,
    })
    continue
  }
  const family = FAMILIES.find(([re]) => re.test(name));
  const decision = DECISIONS[name] || (family ? [family[1], family[2]] : undefined);
  if (decision) {
    entries.push({
      name,
      class: decision[0],
      why: decision[1],
      seenAt: info.where,
    });
  } else {
    entries.push({
      name,
      class: 'UNCLASSIFIED',
      why: 'NEW colour surface — decide whether this theme must supply it, then add it to DECISIONS in tools/scan-color-surfaces.mjs',
      seenAt: info.where,
    })
    unclassified.push(name)
  }
}

entries.sort((a, b) => a.name.localeCompare(b.name))

/* Family entries state the contract for sets too large to list one by one.
   Recorded last, and with a trailing `*`, so test/surfaces.test.js can tell a
   family from a name. */
for (const [family, cls] of Object.entries(PROVIDED)) {
  entries.push({
    name: family,
    class: cls,
    why: `family supplied at runtime (${registeredTokens.length} registered tokens, ${syntaxTokens.length} syntax names)`,
    seenAt: 'written by lib/client.js at runtime, not declared in a stylesheet',
  })
}

const payload = {
  $comment:
    'GENERATED by tools/scan-color-surfaces.mjs — every custom property in the installed harness ' +
    'that carries a colour, with a recorded decision. UNCLASSIFIED entries fail test/surfaces.test.js. ' +
    'Regenerate after a DSH upgrade and classify whatever is new.',
  source: {
    packages: '@deepseek-ai/dsh-client-ui-* (installed), plus the inlined sheets in ui-theme',
    scannedCssFiles: cssFiles().length,
    surfaces: entries.length,
  },
  counts: entries.reduce((acc, e) => {
    acc[e.class] = (acc[e.class] || 0) + 1
    return acc
  }, {}),
  entries,
}

const serialized = JSON.stringify(payload, null, 2) + '\n'

if (process.argv.includes('--list')) {
  for (const e of entries) console.log(`${e.class.padEnd(13)} ${e.name}\n              ${e.why}`)
  process.exit(0)
}

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current === serialized) {
    console.log(`colour-surface ledger up to date — ${entries.length} surfaces`)
    process.exit(0)
  }
  console.error('colour-surface ledger is STALE — run `node tools/scan-color-surfaces.mjs`')
  process.exit(1)
}

writeFileSync(OUT, serialized)
console.log(`scanned ${payload.source.scannedCssFiles} stylesheet(s) — ${entries.length} colour surfaces`)
console.log(`wrote ${relative(ROOT, OUT)}`)
for (const [cls, n] of Object.entries(payload.counts)) console.log(`  ${cls.padEnd(13)} ${n}`)
if (unclassified.length) {
  console.error(`\n${unclassified.length} UNCLASSIFIED surface(s) need a decision:`)
  for (const n of unclassified) console.error('  ' + n)
  process.exit(1)
}
