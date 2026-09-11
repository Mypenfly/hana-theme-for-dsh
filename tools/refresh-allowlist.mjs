#!/usr/bin/env node
/**
 * refresh-allowlist.mjs — regenerate `test/token-allowlist.json` from an
 * installed DeepSeek Harness, offline.
 *
 * WHY THIS TOOL EXISTS
 * --------------------
 * Two independent traps make hand-written token names unsafe in a DSH theme:
 *
 * 1. `theme.overrideTokens(source, tokens)` validates only the *values* — every
 *    name must map to a `{ light, dark }` pair of strings — and never the
 *    *names*. A misspelled or obsolete token therefore does not throw. It is
 *    accepted, written, and read by nobody: a silent no-op.
 * 2. `Theme.listTokens` (the Cordis Inspect provider) LOOKS like an allow-list
 *    but is not one. Its implementation is
 *        tokens = new Map(BUILTIN_INSPECT_TOKENS)          // 13 curated entries
 *        for (theme of this.themes)      … dynamicToken(name)
 *        for (layer of this.overrides)   … dynamicToken(name)
 *    i.e. it reports *what happens to be registered right now*, including every
 *    token contributed by other installed plugins. Validating against it would
 *    make the allow-list depend on which unrelated plugins the user has.
 *
 * What actually defines "a token that does something" is the harness stylesheet
 * itself: the custom properties declared on `body` (light) and
 * `body[data-ds-dark-theme]` (dark). Those are the names the application's own
 * CSS consumes via `var(--dsw-alias-…)`; a name absent from that set has no
 * reader. This tool extracts exactly that set from the artifact that ships it,
 * so the check is mechanical rather than remembered.
 *
 * The extracted set is committed to `test/token-allowlist.json` and enforced by
 * `test/tokens.test.js`. Re-run after a DSH upgrade and read the printed diff:
 * a token that disappears is an override that silently stopped working.
 *
 * VERSION SKEW IS REAL
 * --------------------
 * A machine can hold several DSH installs at once with different palettes. This
 * one, for example, has DSH Desktop 2.0.5 (ui-theme 0.1.2-rc.1, 89 tokens) and
 * a standalone `dsh-web-app` 0.1.5-alpha.1 (90 tokens); they differ by exactly
 * `--dsw-alias-link`. Rather than hide that, the tool records the chosen source
 * and lists every token seen only in other installs under `versionDependent`.
 * Run with `--all` to print every copy it found.
 *
 * USAGE
 *   node tools/refresh-allowlist.mjs                # auto-discover, write
 *   node tools/refresh-allowlist.mjs --from <path>  # explicit lib/client.js
 *   node tools/refresh-allowlist.mjs --all          # list every install found
 *   node tools/refresh-allowlist.mjs --check        # exit 1 if stale, no write
 *   node tools/refresh-allowlist.mjs --list-blocks  # debug: dump CSS selectors
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OUT = join(ROOT, 'test', 'token-allowlist.json')
const PACKAGE = '@deepseek-ai/dsh-client-ui-theme'

const COLOR_FAMILY = /^--dsw-(?:alias|specific)-/

/* The committed JSON is published, so the recorded source path is redacted: the
   home directory becomes `~`. Redaction is deterministic, which keeps --check
   meaningful, and the redacted form is identical on every machine -- unlike the
   absolute path, which would leak a username and churn the file per developer. */
const HOME = homedir()
const redact = (p) => (HOME && p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p)
const CLIENT_TAIL = join('lib', 'client.js')

/* ── discovery ──────────────────────────────────────────────────────────── */

const safeReaddir = (p) => { try { return readdirSync(p) } catch { return [] } }
const mtimeOf = (p) => { try { return statSync(p).mtimeMs } catch { return 0 } }

const profileCopies = () => {
  const home = process.env.DSH_HOME
  if (!home) return []
  const profiles = join(home, 'profiles')
  return [
    join(home, 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme', CLIENT_TAIL),
    join(profiles, 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme', CLIENT_TAIL),
    ...safeReaddir(profiles).map((n) =>
      join(profiles, n, 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme', CLIENT_TAIL)),
  ]
}

/**
 * Nix store copies, most recently built first. The desktop shell is preferred
 * over the standalone web app because the desktop app is what serves the GUI
 * this theme targets; preferring "newest mtime" alone silently picks the web
 * app, whose palette is a different version.
 */
const storeCopies = () => {
  const store = '/nix/store'
  if (!existsSync(store)) return { desktop: [], other: [] }
  const desktop = []
  const other = []
  for (const name of safeReaddir(store)) {
    if (!/^[a-z0-9]{32}-dsh-/.test(name)) continue
    const base = join(store, name)
    if (/dsh-desktop/.test(name)) {
      desktop.push(join(base, 'lib/dsh-desktop/resources/app/node_modules/dsh-plugin-desktop/node_modules/@deepseek-ai/dsh-client-ui-theme', CLIENT_TAIL))
      desktop.push(join(base, 'resources/app/node_modules/dsh-plugin-desktop/node_modules/@deepseek-ai/dsh-client-ui-theme', CLIENT_TAIL))
    } else if (/dsh-(web-app|node-modules)/.test(name)) {
      other.push(join(base, 'lib/node_modules/@deepseek-ai/dsh-web-app/node_modules/@deepseek-ai/dsh-client-ui-theme', CLIENT_TAIL))
      other.push(join(base, '@deepseek-ai/dsh-web-app/node_modules/@deepseek-ai/dsh-client-ui-theme', CLIENT_TAIL))
    }
  }
  const byNewest = (a, b) => mtimeOf(b) - mtimeOf(a)
  return { desktop: desktop.sort(byNewest), other: other.sort(byNewest) }
}

function discover() {
  const { desktop, other } = storeCopies()
  return [
    process.env.DSH_CLIENT_UI_THEME,
    ...profileCopies(),
    ...desktop,
    ...other,
  ].filter(Boolean)
}

/* ── parsing ────────────────────────────────────────────────────────────── */

/** Read a JS string literal starting at `start` (index of its opening quote). */
function readStringLiteral(src, start) {
  const quote = src[start]
  let out = ''
  for (let i = start + 1; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '\\') {
      const next = src[i + 1]
      if (next === 'n') { out += '\n'; i += 1; continue }
      if (next === 't') { out += '\t'; i += 1; continue }
      if (next === 'r') { out += '\r'; i += 1; continue }
      if (next === 'u') { out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)); i += 5; continue }
      out += next; i += 1; continue
    }
    if (ch === quote) return out
    out += ch
  }
  return out
}

function extractStylesheet(src) {
  const marker = 'design_platform_css_default'
  const at = src.indexOf(marker)
  if (at < 0) throw new Error('design_platform_css_default not found — not a dsh-client-ui-theme bundle?')
  let q = src.indexOf('=', at) + 1
  while (q < src.length && src[q] !== '"' && src[q] !== "'") q += 1
  return readStringLiteral(src, q)
}

/**
 * The shiki syntax sheet, which lives in its own bundle constant.
 *
 * These names matter as much as the colour tokens and for the same reason: a
 * misspelled `--shiki-token-*` is accepted by nothing and read by nothing, so it
 * fails silently. They cannot be folded into the colour list — that list is
 * filtered to the alias and specific families, and these are a different
 * channel entirely (see L1b in lib/client.js). Recorded separately so
 * test/tokens.test.js can pin the plugin's syntax palette to the names the
 * installed harness actually declares.
 */
function extractShikiSheet(src) {
  const marker = 'shiki_css_default'
  const at = src.indexOf(marker)
  if (at < 0) return null
  let q = src.indexOf('=', at) + 1
  while (q < src.length && src[q] !== '"' && src[q] !== "'") q += 1
  const css = readStringLiteral(src, q)
  return [...new Set(cssBlocks(css).flatMap((b) => declaredVars(b.body)))].sort()
}

const cssBlocks = (css) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }))

/** Custom properties *declared* (not merely referenced) in a declaration body. */
const declaredVars = (body) =>
  [...new Set([...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]))].sort()

/**
 * The harness splits its palette over several rules with the same selector —
 * structural/font tokens in one `body{…}`, colour tokens in another — so each
 * mode is the UNION over every matching block. Taking only the first match
 * harvests the font block and reports zero colours.
 */
function readPalette(clientPath) {
  const source = readFileSync(clientPath, 'utf8')
  const css = extractStylesheet(source)
  const all = cssBlocks(css)
  const union = (blocks) => [...new Set(blocks.flatMap((b) => declaredVars(b.body)))]
    .filter((n) => COLOR_FAMILY.test(n)).sort()

  const lightBlocks = all.filter((b) => b.selector === 'body')
  const darkBlocks = all.filter((b) => b.selector === 'body[data-ds-dark-theme]')
  if (!lightBlocks.length) throw new Error(`${clientPath}: no \`body{…}\` block`)
  if (!darkBlocks.length) throw new Error(`${clientPath}: no \`body[data-ds-dark-theme]{…}\` block`)

  const light = union(lightBlocks)
  if (!light.length) throw new Error(`${clientPath}: found \`body{…}\` but no --dsw-alias-*/--dsw-specific-* tokens`)

  let version = null
  let dir = dirname(clientPath)
  for (let i = 0; i < 5; i += 1) {
    const pj = join(dir, 'package.json')
    if (existsSync(pj)) {
      try {
        const j = JSON.parse(readFileSync(pj, 'utf8'))
        if (j.name === PACKAGE) { version = j.version; break }
      } catch { /* ignore */ }
    }
    dir = dirname(dir)
  }
  return {
    clientPath,
    version,
    light,
    dark: union(darkBlocks),
    syntax: extractShikiSheet(source) || [],
    blocks: all,
  }
}

/* ── main ───────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2)
const has = (name) => argv.includes(name)
const valueOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }

const explicit = valueOf('--from')
const found = []
const seen = new Set()
for (const c of explicit ? [explicit] : discover()) {
  const real = resolve(c)
  if (seen.has(real) || !existsSync(real)) continue
  seen.add(real)
  try { found.push(readPalette(real)) } catch (e) { if (explicit) throw e }
}

if (!found.length) {
  console.error('refresh-allowlist: no installed dsh-client-ui-theme found.')
  console.error('Pass --from <path>/dsh-client-ui-theme/lib/client.js, or set DSH_CLIENT_UI_THEME.')
  process.exit(2)
}

if (has('--all')) {
  console.log(`${found.length} install(s) discovered, in preference order:\n`)
  for (const f of found) {
    console.log(`  ui-theme ${String(f.version).padEnd(16)} ${String(f.light.length).padStart(3)} tokens  sym=${f.light.length === f.dark.length}`)
    console.log(`      ${f.clientPath}\n`)
  }
  console.log(`chosen: ${found[0].version}`)
  process.exit(0)
}

const chosen = found[0]

if (has('--list-blocks')) {
  for (const b of chosen.blocks) {
    console.log(`${String(declaredVars(b.body).length).padStart(4)}  ${b.selector.replace(/\s+/g, ' ').slice(0, 140)}`)
  }
  process.exit(0)
}

if (chosen.light.length !== chosen.dark.length) {
  const onlyLight = chosen.light.filter((n) => !chosen.dark.includes(n))
  const onlyDark = chosen.dark.filter((n) => !chosen.light.includes(n))
  console.warn('WARNING: light/dark asymmetry — a token declared in only one mode can never be themed')
  if (onlyLight.length) console.warn('  light-only: ' + onlyLight.join(', '))
  if (onlyDark.length) console.warn('  dark-only:  ' + onlyDark.join(', '))
}

/* Tokens this install lacks but another install has. Surfaced rather than
   silently dropped, because they are exactly the names that would become a
   no-op for a user on the older build. */
const elsewhere = new Map()
for (const f of found.slice(1)) {
  for (const n of f.light) {
    if (chosen.light.includes(n)) continue
    if (!elsewhere.has(n)) elsewhere.set(n, [])
    elsewhere.get(n).push(f.version)
  }
}
const versionDependent = [...elsewhere.keys()].sort()

/* ── consumers ────────────────────────────────────────────────────────────
 * WHY THIS IS NOT REDUNDANT WITH THE ALLOW-LIST
 *
 * The allow-list records what a ui-theme install DECLARES. The gate built on it
 * says a name outside that list is a silent no-op, which is true and is why the
 * gate exists. It has exactly one exception, and it is not hypothetical:
 *
 *   `--dsw-alias-link` — declared by ui-theme 0.1.5-alpha.1, absent from the
 *   0.1.2-rc.1 this allow-list is pinned to, and READ by the copy of
 *   dsh-client-ui-primitives that ships inside the community market
 *   (WebBlock `.sourceLink` / `.fetchUrl`, MarkdownText `.markdown a`).
 *
 * Supplying it therefore has an effect, and declining it is worse than a no-op:
 * `var(--dsw-alias-link)` with no fallback makes the declaration invalid at
 * computed-value time, so the affected links lose their colour entirely instead
 * of falling back to something sensible. A theme that only reads declarations
 * cannot see this, which is why the reference side is scanned too.
 *
 * SCOPE, STATED SO IT CANNOT BE MISREAD AS "EVERYTHING": the packages that ship
 * the DSH UI itself -- `@deepseek-ai/dsh-client-ui-*`, `dsh-web-frontend`, and
 * `dsh-plugin-desktop` (which vendors the market). Separately installed
 * community plugins are counted under `outsideScope` and deliberately not
 * required: they invent their own token names, and a theme cannot be
 * responsible for a contract nobody publishes.
 */
const SCOPE_PACKAGE = /^(dsh-client-ui-[a-z0-9-]+|dsh-web-frontend|dsh-plugin-desktop)$/
const REFERENCE = /var\(\s*(--dsw-(?:alias|specific)-[a-zA-Z0-9-]+)/g

/**
 * Names a shipped UI reads but that this theme deliberately does NOT supply.
 *
 * Recorded rather than merely omitted, so "we chose not to" is distinguishable
 * from "nobody noticed". A name may only be declined when EVERY read of it has
 * a `var()` fallback — otherwise the declaration is dropped outright and the
 * decline is a bug, not a decision. test/tokens.test.js enforces both halves.
 */
const DECLINED_READS = {
  '--dsw-alias-font-mono':
    'a FONT channel, not a colour: this theme restyles the reading typography ' +
    '(--dsw-font-markdown-*) and deliberately leaves the UI chrome face alone. ' +
    'Its fallback, `ui-monospace, monospace`, is already the right stack.',
}

const desktopAppRoots = () => {
  const out = []
  for (const p of storeCopies().desktop) {
    const i = p.indexOf(join('node_modules', 'dsh-plugin-desktop'))
    if (i > 0) out.push(p.slice(0, i))
  }
  return [...new Set(out)]
}

const uiRoots = () => {
  const home = process.env.DSH_HOME
  if (!home) return []
  const profiles = join(home, 'profiles')
  return [
    join(profiles, 'node_modules', '@deepseek-ai'),
    ...safeReaddir(profiles).map((n) => join(profiles, n, 'node_modules', '@deepseek-ai')),
    ...desktopAppRoots().map((app) => join(app, 'node_modules')),
  ]
}

/** Walk `dir`, following symlinks (the installed packages are links into the
    store, and neither readdir-withFileTypes nor a plain recursive read follows
    them), collecting `var(--dsw-{alias,specific}-*)` references. */
function scanConsumers(dir, opts = {}) {
  const found = new Map()
  const seen = new Set()
  const walk = (d, depth) => {
    if (depth > 12) return
    let real
    try { real = realpathSync(d) } catch { return }
    if (seen.has(real)) return
    seen.add(real)
    for (const e of safeReaddir(d)) {
      const p = join(d, e)
      let isDir, isFile
      try { const st = statSync(p); isDir = st.isDirectory(); isFile = st.isFile() } catch { continue }
      if (isDir) {
        /* `select` names the package directories to scan; it applies to the
           root's children only. Applying it at every level would reject `lib`
           and every other ordinary subdirectory, which reads as "the scan found
           nothing" rather than as an error. */
        if (opts.select && depth === 0 && !opts.select(e)) continue
        walk(p, depth + 1)
        continue
      }
      if (!isFile) continue
      if (!e.endsWith('.css') && e !== 'client.js') continue
      let text
      try { text = readFileSync(p, 'utf8') } catch { continue }
      for (const m of text.matchAll(REFERENCE)) {
        const name = m[1]
        if (!found.has(name)) found.set(name, { packages: new Set(), bare: 0, padded: 0 })
        const entry = found.get(name)
        if (opts.label) entry.packages.add(opts.label(p))
        /* Read the whole `var(...)` call: whether a fallback follows the comma
           decides whether declining the name degrades or breaks.
           `m.index + 3` is the call's own `(`, so the depth counter must start
           at 0 and see it — starting past it leaves depth at -1 at the closing
           paren, the scan runs on into the next declaration, and every read
           looks as though it had a fallback. */
        let depth = 0
        let end = m.index + 3
        for (; end < text.length; end += 1) {
          if (text[end] === '(') depth += 1
          else if (text[end] === ')') { depth -= 1; if (depth === 0) break }
        }
        const call = text.slice(m.index, end + 1)
        if (/,\s*\S/.test(call.slice(m[0].length))) entry.padded += 1
        else entry.bare += 1
      }
    }
  }
  walk(dir, 0)
  return found
}

const inScope = new Map()
for (const root of uiRoots()) {
  if (!existsSync(root)) continue
  const label = (p) => {
    const i = p.indexOf(join('node_modules', '@deepseek-ai'))
    const j = p.indexOf(join('node_modules', 'dsh-plugin-desktop'))
    if (i >= 0) return p.slice(i + 'node_modules/@deepseek-ai/'.length).split('/')[0]
    if (j >= 0) return p.slice(j + 'node_modules/'.length).split('/')[0]
    return 'dsh-plugin-desktop'
  }
  /* Two shapes: an `@deepseek-ai` directory (select the UI packages by name) and
     a plain node_modules that only contains dsh-plugin-desktop. */
  const select = (name) => SCOPE_PACKAGE.test(name)
  for (const [name, found] of scanConsumers(root, { select, label })) {
    if (!inScope.has(name)) inScope.set(name, { packages: new Set(), bare: 0, padded: 0 })
    const acc = inScope.get(name)
    for (const p of found.packages) acc.packages.add(p)
    acc.bare += found.bare
    acc.padded += found.padded
  }
}

const registered = new Set(chosen.light)
const consumedNotRegistered = [...inScope.keys()]
  .filter((n) => !registered.has(n))
  .sort()

/* Counted, not required. Read from the same shared root, one level of plugin
   package deep, so the boundary is a number in the ledger rather than a
   sentence in a document. */
const outsideScope = new Map()
{
  const home = process.env.DSH_HOME
  const root = home ? join(home, 'profiles', 'node_modules') : null
  if (root && existsSync(root)) {
    for (const name of safeReaddir(root)) {
      if (name.startsWith('@') || name === 'dsh-plugin-desktop') continue
      const dir = join(root, name)
      try { if (!statSync(dir).isDirectory()) continue } catch { continue }
      for (const [n] of scanConsumers(dir)) {
        if (registered.has(n) || inScope.has(n)) continue
        outsideScope.set(n, (outsideScope.get(n) || 0) + 1)
      }
    }
  }
}

const payload = {
  $comment: 'GENERATED by tools/refresh-allowlist.mjs — do not edit by hand. Regenerate after a DSH upgrade.',
  source: {
    package: PACKAGE,
    version: chosen.version,
    path: redact(chosen.clientPath),
    derivedFrom: 'design_platform_css_default: body{…} ∪ body[data-ds-dark-theme]{…}, --dsw-alias-* and --dsw-specific-* only',
    lightCount: chosen.light.length,
    darkCount: chosen.dark.length,
    syntaxCount: chosen.syntax.length,
  },
  ...(versionDependent.length
    ? {
        versionDependent: Object.fromEntries(
          versionDependent.map((n) => [n, { seenIn: elsewhere.get(n) }]),
        ),
      }
    : {}),
  tokens: chosen.light,
  ...(chosen.syntax.length ? { syntaxTokens: chosen.syntax } : {}),
  /* Names a shipped UI reads but no registered contract declares. Supplying
     these is NOT a no-op, so test/tokens.test.js requires every palette to
     supply each one unless it is explicitly declined. `fallback` records
     whether any read would survive being declined: `none` or `mixed` means a
     read without a fallback exists, so the declaration would be DROPPED rather
     than defaulted, and declining it is a bug. `readBy` keeps the reason
     attached, so it survives a DSH upgrade that moves the consumer. */
  ...(consumedNotRegistered.length
    ? {
        consumedNotRegistered: Object.fromEntries(
          consumedNotRegistered.map((n) => {
            const e = inScope.get(n)
            const fallback = e.bare ? (e.padded ? 'mixed' : 'none') : 'always'
            return [n, {
              readBy: [...e.packages].sort(),
              fallback,
              ...(DECLINED_READS[n] ? { declined: DECLINED_READS[n] } : {}),
            }]
          }),
        ),
      }
    : {}),
  consumerScan: {
    scope:
      'packages that ship the DSH UI itself: @deepseek-ai/dsh-client-ui-*, dsh-web-frontend, ' +
      'dsh-plugin-desktop (which vendors the community market)',
    namesRead: inScope.size,
    outsideScope: {
      note:
        'separately installed community plugins also read --dsw-alias-* names, several of which no ' +
        'published contract declares. They are counted here and deliberately NOT required: a theme ' +
        'cannot be responsible for a contract nobody publishes.',
      names: outsideScope.size,
    },
  },
}

const serialized = JSON.stringify(payload, null, 2) + '\n'

if (has('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current === serialized) {
    console.log(`allow-list up to date — ${chosen.light.length} tokens, ui-theme ${chosen.version}`)
    process.exit(0)
  }
  console.error('allow-list is STALE — run `npm run refresh:allowlist`')
  process.exit(1)
}

const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { tokens: [] }
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, serialized)

const added = chosen.light.filter((n) => !before.tokens.includes(n))
const removed = before.tokens.filter((n) => !chosen.light.includes(n))
console.log(`chosen: ui-theme ${chosen.version} — ${chosen.light.length} colour tokens (light=${chosen.light.length} dark=${chosen.dark.length})`)
console.log(`        ${chosen.clientPath}`)
if (found.length > 1) console.log(`        (${found.length - 1} other install(s) ignored — see --all)`)
console.log(`wrote ${OUT}`)
if (added.length) console.log(`  +${added.length}: ${added.slice(0, 10).join(', ')}${added.length > 10 ? ' …' : ''}`)
if (removed.length) console.log(`  -${removed.length}: ${removed.slice(0, 10).join(', ')}${removed.length > 10 ? ' …' : ''}`)
if (!added.length && !removed.length) console.log('  (no change)')
if (versionDependent.length) console.log(`  version-dependent (not used): ${versionDependent.join(', ')}`)
console.log(`  consumer scan: ${inScope.size} name(s) read by the shipped UI, ${outsideScope.size} by out-of-scope plugins`)
if (consumedNotRegistered.length) {
  console.log('  read but NOT declared by this install — the theme must supply these:')
  for (const n of consumedNotRegistered) {
    const e = inScope.get(n)
    const mark = e.bare ? (e.padded ? 'mixed' : 'NONE  ') : 'always'
    const declined = DECLINED_READS[n] ? '  (declined, see DECLINED_READS)' : ''
    console.log(`    ${n.padEnd(38)} fallback=${mark}  <- ${[...e.packages].sort().join(', ')}${declined}`)
  }
} else {
  console.log('  every name the shipped UI reads is declared by this install')
}
{
  /* Whether the theme actually supplies each name is a property of the theme,
     not of the install, so it is reported here and deliberately NOT stored:
     putting it in the payload would make `--check` compare the file against
     itself. test/tokens.test.js is the gate. */
  const { createRequire } = await import('node:module')
  try {
    const require_ = createRequire(import.meta.url)
    const client = require_(join(ROOT, 'lib', 'client.js'))
    const supplied = new Set(Object.keys(client.PALETTES[0].tokens))
    for (const n of consumedNotRegistered) {
      if (supplied.has(n)) continue
      if (DECLINED_READS[n]) continue
      const e = inScope.get(n)
      if (e.bare) console.error(`  UNRESOLVED: ${n} is read with NO fallback and is neither supplied nor declined`)
    }
  } catch {
    /* the theme half is not loadable from here (no vm shim) — the offline test
       is the authority, so this is a report, not a check */
  }
}
