#!/usr/bin/env node
/**
 * Does the 焦点墨环 actually win, in a real engine, against the real rules?
 *
 * WHY THIS EXISTS
 * ---------------
 * The ring rule must win on SPECIFICITY, because judgement 1 of test/check.js
 * forbids `!important`. The arithmetic is: DSH paints an outline in 31 rules
 * across five colour families, every one of them keyed on a build hash, and the
 * measured ceiling among them is (0,3,0). The theme's own selector carries two
 * attributes plus a pseudo-class on top of `body`, which is (0,3,1) -- and at
 * (0,2,1) it would lose to exactly one of those rules while every other ring
 * changed colour, which looks like "mostly working".
 *
 * That is a claim about CSS, and claims about CSS are the kind that read as
 * obviously true and are quietly false. So this takes the REAL rules out of the
 * installed bundles, puts the real classes on real elements in a real engine
 * with the real theme stylesheet, and reports what the engine computed.
 *
 * THE ONE SUBSTITUTION, STATED PLAINLY
 * ------------------------------------
 * `:focus-visible` is rewritten to a class (`.hana-fv`) in BOTH the extracted DSH
 * rules and the theme sheet, because a headless browser cannot be made to match
 * it: `document.hasFocus()` is false in headless Firefox, so `:focus`,
 * `:focus-visible` and `:focus-within` never match no matter how the element is
 * focused -- measured, after three attempts (plain focus(), focus({focusVisible:
 * true}), and the `focusmanager.testmode` pref). The alternative, Xvfb, cannot
 * start in this sandbox (it needs to create /tmp/.X11-unix).
 *
 * The substitution is exact where it matters: a class and a pseudo-class both
 * count (0,1,0), and `X:focus-visible Y` and `X.hana-fv Y` match the same SHAPE
 * of tree. Every replacement is counted and asserted, so a module whose text
 * changed shape cannot silently produce untested CSS.
 *
 * What this therefore proves is the CASCADE -- that the theme's ring out-specifies
 * DSH's, per palette and including the descendant rule -- not that the browser
 * matches `:focus-visible`. That second half is the engine's job, and it is DSH's
 * own pseudo-class, unchanged by this theme.
 *
 * Usage:
 *   node test/verify/focus-check.mjs            assert
 *   node test/verify/focus-check.mjs --keep     keep the screenshots
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadClient } from '../load-client.js';
import { resolveRings, ACCENT } from '../../tools/derive-focus.mjs';

/* The REPO root -- see the note in test/verify/seal-check.mjs, where the same
   computation was one level short and left screenshots in test/test/verify/. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { exports: HANA } = loadClient();
const FOCUS_VALUE = (HANA.DEFAULTS || {}).focus;

/* ── the real rules, read out of the installed bundles ───────────────────── */

const DSH_AI = process.env.HANA_AI_ROOT || (() => {
  const store = '/nix/store';
  for (const e of fs.readdirSync(store, { withFileTypes: true })) {
    if (!e.isDirectory() || !e.name.includes('dsh-desktop')) continue;
    const p = path.join(store, e.name, 'lib', 'dsh-desktop', 'resources', 'app', 'node_modules',
      'dsh-plugin-desktop', 'node_modules', '@deepseek-ai');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('cannot find the installed @deepseek-ai packages');
})();

/** Pull one CSS-module string and its class map out of a bundle. */
function moduleCss(pkg, moduleFile) {
  const src = fs.readFileSync(path.join(DSH_AI, pkg, 'lib', 'client.js'), 'utf8');
  const map = new Map();
  for (const m of src.matchAll(/var \w+_module_css_default = \{([^}]*)\}/g)) {
    for (const pair of m[1].matchAll(/"([A-Za-z0-9_-]+)":\s*"([A-Za-z0-9_-]+)"/g)) {
      map.set(pair[1], pair[2]);
    }
  }
  /* Pair by SUFFIX, not by proximity: each module declares `const css$N` and then
     `const tagId$N` with the same N. Taking the nearest preceding css$N instead
     looked right and picked up a neighbouring module in seal-check. */
  const tag = new RegExp(`const tagId(\\$\\d+)? = "[^"]*\\/${moduleFile.replace(/\./g, '\\.')}"`).exec(src);
  if (!tag) throw new Error(`${moduleFile} not found in ${pkg}`);
  const suffix = (tag[1] || '').replace('$', '\\$');
  const decl = new RegExp(`const css${suffix} = "((?:[^"\\\\]|\\\\.)*)";`).exec(src);
  if (!decl) throw new Error(`no css declaration paired with tagId in ${moduleFile}`);
  const css = decl[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return { css, map };
}

/* One real rule per measured specificity level. Each names the colour DSH paints
   it with, so a pass cannot be a coincidence and the `native` run has something
   distinct to compute. */
const CASES = [
  { id: 'toolbar-toggle', level: '(0,2,0)', pkg: 'dsh-client-ui-trajectory', module: 'TrajectoryToolbar.module.css', local: 'toggle', native: '--dsw-alias-state-business-primary' },
  { id: 'plan-chip', level: '(0,2,0)', pkg: 'dsh-client-ui-plan', module: 'PlanModeControl.module.css', local: 'chip', native: '--dsw-alias-state-warn-label' },
  { id: 'member-label', level: '(0,3,0)', pkg: 'dsh-client-ui-workflow-run', module: 'WorkflowRunPanel.module.css', local: 'memberButton', child: 'memberLabelWrap', native: '--dsw-alias-state-business-primary' },
];

let replacements = 0;
const sheets = [];
const classes = new Map();
for (const c of CASES) {
  const { css, map } = moduleCss(c.pkg, c.module);
  /* The substitution, counted. `X:focus-visible` and `X.hana-fv` are both
     (0,1,0) and match the same shape, so the cascade arithmetic is untouched. */
  const hits = (css.match(/:focus-visible/g) || []).length;
  if (hits === 0) throw new Error(`${c.module} contains no :focus-visible -- the rule moved, update this probe`);
  replacements += hits;
  sheets.push(css.replace(/:focus-visible/g, '.hana-fv'));
  c.cls = map.get(c.local);
  if (!c.cls) throw new Error(`no class map entry for ${c.local} in ${c.module}`);
  if (c.child) {
    c.childCls = map.get(c.child);
    if (!c.childCls) throw new Error(`no class map entry for ${c.child} in ${c.module}`);
  }
}

const themeCss = HANA.CSS.replace(/:focus-visible/g, '.hana-fv');
if (!themeCss.includes('.hana-fv *')) {
  throw new Error('the theme sheet has no `:focus-visible *` descendant rule; the substitution lost it');
}

/* ── the page ────────────────────────────────────────────────────────────── */

const page = (themeAttr, focusAttr, tokens, label) => `<!doctype html><html><head><meta charset="utf-8"><style>
${sheets.join('\n')}
</style><style>${themeCss}</style><style>
  body { margin: 0; padding: 12px; background: #fff; }
  .probe { display: block; width: 140px; height: 34px; margin: 8px 0; background: #eee; }
</style></head>
<body data-hana-theme="${themeAttr}" data-hana-focus="${focusAttr}" style="${tokens}">
${CASES.map((c) => (c.child
    ? `<button class="probe hana-fv ${c.cls}" id="${c.id}"><span class="${c.childCls}" id="${c.id}-child">x</span></button>`
    : `<button class="probe hana-fv ${c.cls}" id="${c.id}">x</button>`)).join('\n')}
<script>
function measure() {
  const cases = ${JSON.stringify(CASES.map((c) => ({ id: c.id, child: !!c.child })))};
  const out = [];
  for (const c of cases) {
    /* The measured box is the one whose rule paints the outline: for the
       descendant case that is the CHILD, and the class that stands in for
       :focus-visible belongs on the PARENT. Getting this backwards is how an
       earlier probe in this repo asserted successfully against an element the
       rule never targeted. */
    const el = document.getElementById(c.child ? c.id + '-child' : c.id);
    if (!el) { out.push({ id: c.id, error: 'element not found' }); continue; }
    const cs = getComputedStyle(el);
    const b = getComputedStyle(document.body);
    out.push({
      id: c.id,
      outlineColor: cs.outlineColor,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      /* Reported so the PAGE ITSELF is checked, not just the value that came
         back. An earlier version read the palette attribute off the wrong
         object (it lives on the resolution, not on the palette), so the body
         was rendered as data-hana-theme="undefined" and 珊瑚 fell back to the
         generic rule -- which the probe then reported as "the theme's ring lost
         the specificity fight". A plausible diagnosis of a page that was simply
         mislabelled. */
      theme: document.body.getAttribute('data-hana-theme'),
      focus: document.body.getAttribute('data-hana-focus'),
      ring: b.getPropertyValue('--hana-ring').trim(),
    });
  }
  const body = JSON.stringify(out);
  document.title = ${JSON.stringify(label)};
  fetch('/report', { method: 'POST', body });
}
if (document.readyState === 'complete') measure();
else window.addEventListener('load', measure);
</script>
</body></html>`;

/* ── run it ──────────────────────────────────────────────────────────────── */

const failures = [];
/* A DEDICATED PROFILE IS MANDATORY: a bare `firefox --headless <url>` hands the
   URL to an already-running Firefox and exits immediately, so the page never
   loads and no report ever arrives. */
function findBrowser() {
  const names = process.env.HANA_FIREFOX ? [process.env.HANA_FIREFOX]
    : ['firefox', 'firefox-esr', 'chromium', 'google-chrome'];
  for (const name of names) {
    if (fs.existsSync(name)) return name;
    const which = spawnSync('which', [name], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  throw new Error('no browser found for the focus probe');
}
const BROWSER = findBrowser();
const scratches = [];

function serve(html) {
  return new Promise((resolve) => {
    let settle;
    const reported = new Promise((r) => { settle = r; });
    const server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => { res.end('ok'); try { settle(JSON.parse(body)); } catch (e) { settle(null); } });
        return;
      }
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, reported }));
  });
}

async function run(html, label) {
  const { server, port, reported } = await serve(html);
  const shot = path.join(ROOT, 'test', 'verify', `focus-probe-${label}.png`);
  scratches.push(shot);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-focus-'));
  /* ALWAYS pass --screenshot: headless Firefox exits at `load` without it, so a
     probe that only wants the DOM still has to ask for a picture or it never
     reaches the report. */
  const child = spawn(BROWSER, ['--headless', '--profile', profile, '--screenshot', shot,
    '--window-size=420,300', `http://127.0.0.1:${port}/`], { stdio: ['ignore', 'ignore', 'pipe'] });
  const measured = await Promise.race([reported, new Promise((r) => setTimeout(() => r(null), 15000))]);
  await new Promise((r) => setTimeout(r, 500));
  child.kill('SIGKILL');
  server.close();
  return { measured, shot: fs.existsSync(shot) };
}

const css = HANA.CSS;
const { resolutions, problems } = resolveRings(css, HANA.PALETTES, FOCUS_VALUE);
failures.push(...problems);

const asRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const keep = process.argv.includes('--keep');
let checked = 0;

for (const { palette, attr, chosen } of resolutions) {
  const accent = ACCENT[palette.id];
  if (!chosen || !accent) { failures.push(`${palette.id}: no ring rule resolves`); continue; }
  if (typeof attr !== 'string' || !attr) { failures.push(`${palette.id}: no palette attribute value resolved`); continue; }
  const tokens = Object.entries(palette.tokens).map(([k, v]) => `${k}:${v}`).join(';');
  const ringValue = palette.tokens[chosen.token];

  const accentRun = await run(page(attr, FOCUS_VALUE, tokens, `${attr}-accent`), `${attr}-accent`);
  if (!accentRun.measured) { failures.push(`${palette.id}: the accent page never reported back`); continue; }
  for (const row of accentRun.measured) {
    checked += 1;
    if (row.error) { failures.push(`${palette.id} ${row.id}: ${row.error}`); continue; }
    if (row.theme !== attr || row.focus !== FOCUS_VALUE) {
      failures.push(
        `${palette.id} ${row.id}: the page rendered as data-hana-theme="${row.theme}" ` +
          `data-hana-focus="${row.focus}", not "${attr}"/"${FOCUS_VALUE}" — the measurement below would be ` +
          "of a page this palette's rules never match",
      );
      continue;
    }
    if (row.outlineStyle === 'none') {
      failures.push(`${palette.id} ${row.id}: computed outline-style is none, so there was no ring to recolour`);
      continue;
    }
    if (row.ring !== ringValue) {
      failures.push(
        `${palette.id} ${row.id}: the page resolved --hana-ring to ${row.ring || '(nothing)'}, but ` +
          `${chosen.token} is ${ringValue} — the ring rule did not reach the document`,
      );
      continue;
    }
    const want = asRgb(accent.value);
    if (row.outlineColor !== want) {
      failures.push(
        `${palette.id} ${row.id}: the engine computed outline-color ${row.outlineColor}, not the reference's ` +
          `--accent ${want} — the theme's ring lost the specificity fight against this rule`,
      );
    }
  }

  /* The switch has to switch: with data-hana-focus="native" every ring must be
     DSH's own colour again. Without this the probe would pass even if the theme
     rule were unconditional, which is the whole reason the axis exists. */
  const nativeRun = await run(
    page(palette.attr, 'native', tokens, `${palette.attr}-native`),
    `${palette.attr}-native`,
  );
  if (!nativeRun.measured) { failures.push(`${palette.id}: the native page never reported back`); continue; }
  for (const [i, row] of nativeRun.measured.entries()) {
    if (row.error) continue;
    const want = asRgb(palette.tokens[CASES[i].native]);
    if (row.outlineColor !== want) {
      failures.push(
        `${palette.id} ${row.id}: with data-hana-focus="native" the engine computed ${row.outlineColor}, ` +
          `but DSH paints this rule with ${CASES[i].native} = ${want}. The ring rule is leaking into the ` +
          'mode that is supposed to leave the harness alone.',
      );
    }
  }
}

/* Text assertions, kept because a render can only show the values that happen to
   be on screen: a missing selector or an !important would be invisible here if
   the computed value coincided. */
/* Comments stripped first: the block's own prose explains that judgement 1
   forbids !important, and the first version of this check read that sentence as
   a violation. */
const bareCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
if (/outline[^;]*!important/.test(bareCss)) {
  failures.push('the theme sheet uses !important on an outline, which judgement 1 forbids');
}
if (/!important/.test(bareCss)) failures.push('the theme sheet uses !important somewhere, which judgement 1 forbids');
if (!css.includes("[" + "data-hana-focus" + "='accent'] :focus-visible *")) {
  failures.push('the theme sheet has no descendant selector for the focus block');
}

for (const f of failures) console.error('  ✗ ' + f);
if (failures.length) {
  console.error(`\nfocus-check: ${failures.length} FAILED`);
  process.exit(1);
}
console.log(
  `focus-check: in a real engine ${checked} ring(s) -- ${CASES.map((c) => c.id + ' ' + c.level).join(', ')} -- ` +
    `compute the reference's --accent under data-hana-focus='${FOCUS_VALUE}', and DSH's own colour under ` +
    `'native'; ${replacements} :focus-visible occurrence(s) substituted for a class of equal specificity ` +
    '(headless Firefox cannot match :focus-visible: document.hasFocus() is false)',
);
if (keep) console.log(`screenshots kept: ${scratches.join(', ')}`);
else for (const s of scratches) fs.rmSync(s, { force: true });
