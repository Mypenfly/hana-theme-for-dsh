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

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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
