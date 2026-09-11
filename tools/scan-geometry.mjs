#!/usr/bin/env node
/**
 * Enumerate every `border-radius` the installed UI actually paints.
 *
 * WHY THIS EXISTS
 * ---------------
 * HanaAgent treats geometry as a THEME DIMENSION. `themes/new-warm-paper.css`
 * overrides the global radius scale (`styles.css:33-44`) so that
 *
 *     --radius-sm 5px -> 2px   --radius-lg 12px -> 4px
 *     --border-width 1px -> 0.5px
 *
 * and comments the rule as *"极方圆角 + 0.5px hairline"* / *"controls are seals,
 * 方"*. Its header states the intent is the WHOLE app, not one page.
 *
 * DSH has no equivalent. Measured: **all 247 `border-radius` declarations in
 * the installed `dsh-client-ui-*` bundles are literals — not one reads a custom
 * property.** So the reference's single-token override has no counterpart here,
 * and "方" can only be reached by SELECTING the elements.
 *
 * That makes one question load-bearing, and this tool exists to answer it
 * rather than guess: **which radius sites can a theme address without naming a
 * build hash?** Judgements 5 and 16 in test/check.js forbid hash-shaped
 * selectors, so a site whose only handle is `.IfZI0W_root` is UNREACHABLE by
 * construction — and a design document that plans around reaching it would be
 * fiction.
 *
 * WHAT IT EMITS
 * -------------
 * test/geometry-sites.json — one entry per declaration:
 *   value    the literal radius, exactly as shipped
 *   pkg      the plugin package that paints it
 *   module   the CSS module id, e.g. `TurnProcessNodeView.module.css`
 *   locals   the SEMANTIC local class names in that rule (module map locals,
 *            not hashes) — this is the only human-meaningful handle the site
 *            has, and the artifact records it without making any test depend
 *            on the hash
 *   className the hash, recorded for reference only; nothing may select on it
 *
 * Usage:
 *   node tools/scan-geometry.mjs            regenerate test/geometry-sites.json
 *   node tools/scan-geometry.mjs --check    fail if the artifact is stale
 *   node tools/scan-geometry.mjs --list     human-readable inventory
 *   node tools/scan-geometry.mjs --summary  counts by value, the planning view
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'test', 'geometry-sites.json');

/* The installed client plugins.
 *
 * This mirrors `uiRoots()` in tools/refresh-allowlist.mjs deliberately, and the
 * reason is worth writing down: the installed packages are SYMLINKS into the
 * nix store, so neither `readdir({withFileTypes})` nor a plain recursive read
 * follows them — a walk that "looks right" silently finds two packages out of
 * twenty and reports a confident, wrong inventory. It did exactly that on the
 * first run. */
function uiRoots() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const profiles = path.join(home, 'profiles');
  const safe = (p) => { try { return fs.readdirSync(p); } catch { return []; } };
  const candidates = [
    path.join(profiles, 'node_modules', '@deepseek-ai'),
    ...safe(profiles).map((n) => path.join(profiles, n, 'node_modules', '@deepseek-ai')),
    ...desktopAppRoots(),
  ];
  const out = [];
  const seen = new Set();
  const walk = (dir, depth) => {
    if (depth > 6 || !fs.existsSync(dir)) return;
    let real;
    try { real = fs.realpathSync(dir); } catch { return; }
    if (seen.has(real)) return;
    seen.add(real);
    let entries;
    try { entries = fs.readdirSync(real, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(real, entry.name);
      /* statSync, NOT entry.isDirectory(): readdir reports lstat semantics, so
         every symlinked package reads as "not a directory". That is the second
         half of the same trap — the first attempt found 2 packages, this one
         found 0, and both numbers looked plausible enough to report. */
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (!st.isDirectory()) continue;
      if (entry.name.startsWith('dsh-client-ui-') && fs.existsSync(path.join(full, 'lib', 'client.js'))) {
        out.push(full);
        continue;
      }
      if (entry.name === 'node_modules' || entry.name === '@deepseek-ai') walk(full, depth + 1);
    }
  };
  for (const c of candidates) walk(c, 0);
  return [...new Set(out)];
}

/** The packaged desktop app's node_modules, where the vendor copies live. */
function desktopAppRoots() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const roots = [];
  const store = '/nix/store';
  const safe = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; } };
  for (const entry of safe(store)) {
    /* Files in the store can have names that look like checkouts
       (`<hash>-dsh-workspace-…-kernel.lock`), so `isDirectory()` is load-bearing:
       scandir'ing one is an ENOTDIR crash, not a miss. */
    if (!entry.isDirectory()) continue;
    if (!entry.name.includes('dsh-desktop')) continue;
    const app = path.join(store, entry.name, 'lib', 'dsh-desktop', 'resources', 'app', 'node_modules');
    if (fs.existsSync(app)) roots.push(app);
  }
  return roots;
}

/* Pair each inlined CSS-module string with its module id and its class map.
   The bundles publish both, so nothing here is guessed: `tagId` is the module
   path the plugin itself declares, and the map is the local->hash table React
   actually uses. */
function readSites(pkgDir) {
  const source = fs.readFileSync(path.join(pkgDir, 'lib', 'client.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).name;
  const sites = [];

  /* `const css$N = "....";` then later `tagId$N = "<module id>"` and a
     `var X_module_css_default = { "local": "hash", ... }` map. */
  const cssByVar = new Map();
  for (const m of source.matchAll(/const (css(?:\$\d+)?) = "((?:[^"\\]|\\.)*)";/g)) {
    cssByVar.set(m[1], m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }

  const tagByVar = new Map();
  for (const m of source.matchAll(/const tagId(\$\d+)? = "(@deepseek-ai\/[^"]+\/([^"/]+\.module\.css))"/g)) {
    tagByVar.set('css' + (m[1] || ''), { module: m[3] });
  }

  /* Class maps: collect every local->hash pair in the package, then index by
     hash so a rule body can be resolved back to semantic names. */
  const localByHash = new Map();
  for (const m of source.matchAll(/var \w+_module_css_default = \{([^}]*)\}/g)) {
    for (const pair of m[1].matchAll(/"([A-Za-z0-9_-]+)":\s*"([A-Za-z0-9_-]+)"/g)) {
      localByHash.set(pair[2], pair[1]);
    }
  }

  for (const [cssVar, css] of cssByVar) {
    const tag = tagByVar.get(cssVar);
    if (!tag) continue;
    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = rule[1].trim();
      const body = rule[2];
      for (const decl of body.matchAll(/border-radius:([^;}]+)/g)) {
        /* Every token in the selector that the bundle's own class map knows is a
           build hash. A rule keyed on one is unreachable BY CONSTRUCTION:
           judgements 5/16 forbid naming it, and it changes on every upgrade.
           The first version looked for a leading underscore (245 of 256 sites
           "reachable"); the second parsed selector tokens as `[A-Za-z]…` and
           missed the hashes that START WITH A DIGIT (`_4YQqxW_arrow`), leaving
           28 confident false positives. Both numbers looked plausible. Ask the
           map directly instead of pattern-matching a hash's shape. */
        const hashes = [...localByHash.keys()].filter((h) => selector.includes(h));
        const locals = [...new Set(hashes.map((h) => localByHash.get(h)))];
        sites.push({
          pkg,
          module: tag.module,
          selector,
          locals,
          reachable: hashes.length === 0,
          value: decl[1].trim(),
        });
      }
    }
  }
  return sites;
}

const all = [];
for (const root of uiRoots()) all.push(...readSites(root));
all.sort((a, b) => (a.pkg + a.module + a.selector).localeCompare(b.pkg + b.module + b.selector));

const payload = {
  $comment:
    'GENERATED by tools/scan-geometry.mjs — every border-radius the installed harness paints, with the ' +
    'semantic local class names recovered from each bundle\'s own module map. DSH tokenizes corner SHAPE ' +
    '(--dsw-corner-shape) but not radius: all of these are literals. Regenerate after a DSH upgrade.',
  source: { packages: [...new Set(all.map((s) => s.pkg))].length, sites: all.length },
  entries: all.map((s) => ({
    pkg: s.pkg.replace('@deepseek-ai/', ''),
    module: s.module,
    value: s.value,
    locals: s.locals,
    reachable: s.reachable,
    /* Recorded so a human can find the rule in devtools. Nothing may select on
       it: the hash changes with every build. */
    selector: s.selector,
  })),
};
const serialized = JSON.stringify(payload, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current === serialized) {
    console.log(`geometry ledger up to date — ${all.length} radius site(s)`);
    process.exit(0);
  }
  console.error('geometry ledger is STALE — run `node tools/scan-geometry.mjs`');
  process.exit(1);
}

if (process.argv.includes('--list')) {
  for (const s of payload.entries) {
    console.log(`${s.reachable ? 'reachable  ' : 'HASH-KEYED '}${s.value.padEnd(20)} ${s.pkg}/${s.module}  ${s.locals.join(',') || s.selector}`);
  }
  process.exit(0);
}

if (process.argv.includes('--summary')) {
  const byValue = new Map();
  for (const s of payload.entries) byValue.set(s.value, (byValue.get(s.value) || 0) + 1);
  console.log(`${all.length} radius site(s) across ${payload.source.packages} package(s)\n`);
  console.log('by value:');
  for (const [v, n] of [...byValue].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${v}`);
  const roundish = payload.entries.filter((s) => /999px|50%|100px/.test(s.value)).length;
  const hairline = payload.entries.filter((s) => /^1px$/.test(s.value)).length;
  console.log(`\n  true circles/pills (999px|50%|100px): ${roundish}`);
  console.log(`  hairlines (1px):                      ${hairline}`);
  console.log(`  the rectangular scale:                ${all.length - roundish - hairline}`);
  console.log(`  hash-keyed (unreachable by rule 5/16): ${payload.entries.filter((s) => !s.reachable).length}`);
  process.exit(0);
}

fs.writeFileSync(OUT, serialized);
console.log(`scanned ${all.length} radius site(s) across ${payload.source.packages} package(s)`);
console.log(`wrote ${path.relative(os.homedir(), OUT)}`);
