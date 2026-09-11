/**
 * The render gate: does a real browser produce the colours this repo claims?
 *
 * WHY THIS IS NOT A PIXEL DIFF
 * -----------------------------
 * Screenshot comparison is the obvious thing and the wrong one here. Fonts,
 * hinting and the browser build all vary by machine, so a pixel baseline either
 * goes red for reasons that are not bugs, or gets a tolerance so loose it stops
 * catching any. What actually matters is narrower and completely deterministic:
 * **the engine resolved these custom properties to these colours**. That is what
 * this compares — read out of `getComputedStyle` in a real engine, against the
 * values in lib/client.js, with an exact match required.
 *
 * It is the last link in the chain the other gates leave open. `contrast.test.js`
 * proves the TABLE is readable; `runtime.test.js` proves the plugin WRITES the
 * right values; this proves the browser RESOLVES them to what was written. A
 * cascade mistake — a losing specificity, a var() that computes to nothing, a
 * declaration dropped for being on `:root` — passes the first two and dies here.
 *
 * It also re-checks, in the engine, the property the syntax fix exists for: the
 * "UNPINNED" variants (a dark palette painted while the active colorScheme is
 * still light) must resolve to the SAME syntax colours as the pinned ones.
 *
 * WHY IT IS NOT IN `npm test`
 * ---------------------------
 * It needs a browser. `npm test` must stay dependency-free and runnable in the
 * Nix build sandbox, so this is a separate gate to run after touching CSS, the
 * palettes, or the syntax layer — and after a DSH or browser upgrade.
 *
 *   node test/verify/render-check.mjs            # compare against the baseline
 *   node test/verify/render-check.mjs --update   # rewrite the baseline
 *   node test/verify/render-check.mjs --keep     # also keep the screenshot
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildProbeHtml, expectedMeasurements } from './build-shiki-probe.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASELINE = path.join(HERE, 'render-baseline.json');
const SHOT = path.join(HERE, 'probe.png');

const update = process.argv.includes('--update');
const keep = process.argv.includes('--keep');
/* A browser is required, so degrade explicitly rather than silently passing. */
const ALLOW_MISSING = process.argv.includes('--allow-missing-browser');

/* ── finding a browser ──────────────────────────────────────────────────── */
function findBrowser() {
  const candidates = [
    ['firefox', ['--headless', '--no-remote']],
    ['chromium', ['--headless=new', '--disable-gpu', '--no-sandbox']],
    ['chromium-browser', ['--headless=new', '--disable-gpu', '--no-sandbox']],
    ['google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox']],
  ];
  const dirs = (process.env.PATH || '').split(':').filter(Boolean);
  for (const [name, flags] of candidates) {
    for (const dir of dirs) {
      const p = path.join(dir, name);
      if (existsSync(p)) return { name, path: p, flags };
    }
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  const message =
    'render-check: no headless browser found on PATH (looked for firefox, chromium, google-chrome).\n' +
    'This gate needs a real engine; it is not part of `npm test` for exactly that reason.';
  if (ALLOW_MISSING) {
    console.log(message + '\n--allow-missing-browser given, so this is not a failure.');
    process.exit(0);
  }
  console.error(message);
  process.exit(2);
}

/* ── normalising colours so hex and rgb() compare equal ─────────────────── */
function normalise(value) {
  const text = String(value).trim().toLowerCase();
  const fn = /^rgba?\(([^)]+)\)$/.exec(text);
  if (fn) {
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return (
      '#' +
      parts
        .slice(0, 3)
        .map((n) => Math.round(n).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return '#' + text[1] + text[1] + text[2] + text[2] + text[3] + text[3];
  }
  return text;
}

/* ── serve the probe, collect the report ────────────────────────────────── */
const html = buildProbeHtml();
let resolveReport;
const reportArrived = new Promise((resolve) => {
  resolveReport = resolve;
});

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/report') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      /* Bounded: a runaway page must not be able to exhaust memory here. */
      if (body.length > 4_000_000) req.destroy();
    });
    req.on('end', () => {
      res.writeHead(204).end();
      try {
        resolveReport(JSON.parse(body));
      } catch (e) {
        resolveReport({ error: `unparseable report: ${e.message}` });
      }
    });
    return;
  }
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
    return;
  }
  res.writeHead(404).end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const profile = mkdtempSync(path.join(tmpdir(), 'hana-render-'));
const shotPath = keep ? SHOT : path.join(profile, 'probe.png');

const args = [...browser.flags, '--profile', profile, '--window-size=860,2900', '--screenshot', shotPath, url];
/* Chromium does not take --profile; it takes --user-data-dir. */
const launched =
  browser.name === 'firefox'
    ? args
    : [...browser.flags, `--user-data-dir=${profile}`, '--window-size=860,2900', `--screenshot=${shotPath}`, url];

console.log(`render-check: ${browser.name} → ${url}`);

const child = spawn(browser.path, launched, { stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

const finished = new Promise((resolve) => {
  child.on('exit', (code) => resolve(code));
  child.on('error', () => resolve(null));
});

/* Wait for whichever comes first — the report or the browser exiting. The page
   posts on `load`, before the screenshot, so the report normally wins; if it
   does not, that is a real failure and must not hang the gate. */
const collected = await Promise.race([
  reportArrived,
  finished.then(() => 'BROWSER EXITED FIRST'),
  new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 45000)),
]);

try {
  child.kill();
} catch {
  /* already gone */
}
await finished.catch(() => {});
server.close();
if (!keep) rmSync(profile, { recursive: true, force: true });

if (typeof collected === 'string') {
  console.error(`render-check: got no report from the page (${collected}).`);
  if (stderr.trim()) console.error(stderr.trim().split('\n').slice(-6).join('\n'));
  process.exit(1);
}
if (collected.error) {
  console.error(`render-check: ${collected.error}`);
  process.exit(1);
}

/* ── compare against the shipped tables ─────────────────────────────────── */
const expected = expectedMeasurements();
const actual = new Map(
  (collected.results || []).filter((r) => r.rendered).map((r) => [r.variant, r]),
);

const failures = [];
const pins = []; // [variant, paletteId]

for (const paletteId of Object.keys(expected)) {
  pins.push([`${paletteId} · pinned`, paletteId]);
  /* Dark palettes are also rendered in the state where the override layer has
     painted them but body[data-ds-dark-theme] is still absent. */
  if (expected[paletteId].codeBg && paletteId.includes('midnight')) {
    pins.push([`${paletteId} · UNPINNED`, paletteId]);
  }
}

for (const [variant, paletteId] of pins) {
  const got = actual.get(variant);
  if (!got) {
    failures.push(`${variant}: the page did not render it`);
    continue;
  }
  const want = expected[paletteId];

  if (normalise(got.codeBg) !== normalise(want.codeBg)) {
    failures.push(`${variant}: code surface resolved to ${got.codeBg}, expected ${want.codeBg}`);
  }
  if (normalise(got.pageBg) !== normalise(want.pageBg)) {
    failures.push(`${variant}: page ground resolved to ${got.pageBg}, expected ${want.pageBg}`);
  }
  for (const [name, wantHex] of Object.entries(want.tokens)) {
    const gotHex = got.tokens[name];
    if (gotHex === undefined) {
      failures.push(`${variant}: syntax token "${name}" did not resolve at all`);
    } else if (normalise(gotHex) !== normalise(wantHex)) {
      failures.push(`${variant}: syntax ${name} resolved to ${gotHex}, expected ${wantHex}`);
    }
  }
  if (got.belowAA > 0) {
    failures.push(`${variant}: the engine measures ${got.belowAA} syntax colour(s) below AA`);
  }
}

/* The fix's whole point, asserted in the engine: pinning the syntax palette to
   the PALETTE (not the colorScheme) makes the unpinned state render identically.
   Before the fix this differed by every token, worst 1.13:1. */
for (const paletteId of Object.keys(expected).filter((id) => id.includes('midnight'))) {
  const a = actual.get(`${paletteId} · pinned`);
  const b = actual.get(`${paletteId} · UNPINNED`);
  if (a && b && JSON.stringify(a.tokens) !== JSON.stringify(b.tokens)) {
    failures.push(
      `${paletteId}: syntax colours depend on the active colorScheme again — the pinned and ` +
        'unpinned states differ, which is the bug L1b exists to prevent',
    );
  }
}

/* ── baseline ───────────────────────────────────────────────────────────── */
const measured = {
  $comment:
    'GENERATED by test/verify/render-check.mjs --update. The colours a real engine resolved, ' +
    'for every palette. Committed so drift shows up in git; regenerate after changing a ' +
    'palette, the syntax layer, or the browser.',
  browser: browser.name,
  variants: collected.results,
};

if (update) {
  writeFileSync(BASELINE, JSON.stringify(measured, null, 2) + '\n');
  console.log(`render-check: wrote ${path.relative(ROOT, BASELINE)}`);
}

if (existsSync(BASELINE) && !update) {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const before = new Map((baseline.variants || []).map((v) => [v.variant, v]));
  for (const [variant, got] of actual) {
    const old = before.get(variant);
    if (!old) {
      failures.push(`${variant}: rendered now but absent from the baseline (re-run with --update)`);
      continue;
    }
    if (JSON.stringify(old.tokens) !== JSON.stringify(got.tokens)) {
      failures.push(`${variant}: syntax colours drifted from the committed baseline`);
    }
    if (normalise(old.codeBg) !== normalise(got.codeBg)) {
      failures.push(
        `${variant}: code surface drifted from ${old.codeBg} to ${got.codeBg} (baseline recorded with ${baseline.browser})`,
      );
    }
  }
}

if (failures.length) {
  console.error(`\nrender-check: ${failures.length} FAILED\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  console.error(
    '\nIf the change was intended, re-run with --update and read the diff — that diff IS the review.',
  );
  process.exit(1);
}

console.log(
  `render-check: ${pins.length} variant(s) across ${Object.keys(expected).length} palettes resolved exactly ` +
    `as lib/client.js declares, and the unpinned states match their pinned partners`,
);
if (keep) console.log(`             screenshot: ${path.relative(ROOT, shotPath)}`);
