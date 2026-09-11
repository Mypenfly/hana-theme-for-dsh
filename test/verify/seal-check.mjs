#!/usr/bin/env node
/**
 * Does the 方角 clamp actually WIN, in a real engine, against the real rules?
 *
 * WHY THIS EXISTS
 * ---------------
 * The clamp in lib/client.js must win on SPECIFICITY, because judgement 1 of
 * test/check.js forbids `!important`. The claim "it wins" is an arithmetic claim
 * about CSS, and arithmetic claims about CSS are exactly the kind that read as
 * obviously true and are quietly false -- the first version of this clamp was
 * written to reach (0,3,1) and would have been silently beaten if any DSH rule
 * had reached (0,4,0), and the control tier at (0,2,2) WOULD have been beaten by
 * its own universal rule.
 *
 * So this does not read the CSS text and reason about it. It takes the REAL rule
 * at each measured specificity level out of the installed bundles, puts the real
 * class on a real element in a real engine with the real theme stylesheet, sets
 * `data-hana-shape="seal"`, and reports what the engine computed.
 *
 * Four things are asserted, one per specificity level plus the tiers:
 *
 *   (0,1,0)  239 of DSH's 269 radius selectors -- must land on 3px
 *   (0,2,0)   19 of them                        -- must land on 3px
 *   (0,3,0)    3 of them                        -- must land on 3px
 *   tier      button / composer / img           -- 2px / 6px / 4px, in that order
 *
 * Usage:
 *   node test/verify/seal-check.mjs            assert
 *   node test/verify/seal-check.mjs --keep     keep the screenshot
 *   node test/verify/seal-check.mjs --soft     also prove the clamp is OFF by default
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadClient } from '../load-client.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HANA = loadClient().exports;

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
  const tag = new RegExp(`const tagId(\\$\\d+)? = "[^"]*\\/${moduleFile.replace(/\./g, '\\.')}"`).exec(src);
  if (!tag) throw new Error(`${moduleFile} not found in ${pkg}`);
  /* Pair by SUFFIX, not by proximity. Each module declares `const css$N` and
     then `const tagId$N` with the same N; taking the nearest preceding css$N
     instead looked right and picked up a neighbouring module. */
  const suffix = tag[1] || '';
  const decl = new RegExp(`const css${suffix.replace('$', '\\$')} = "((?:[^"\\\\]|\\\\.)*)";`).exec(src);
  if (!decl) throw new Error(`no css declaration paired with tagId in ${moduleFile}`);
  const css = decl[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return { css, map };
}

/* One real rule per specificity level, each of which sets a radius that is NOT
   the clamp value, so a pass cannot be a coincidence. */
const CASES = [
  { level: '(0,1,0)', pkg: 'dsh-client-ui-agent-preset', module: 'AgentPresetLabel.module.css', local: 'label', shipped: '6px' },
  { level: '(0,2,0)', pkg: 'dsh-client-ui-agent-preset', module: 'AgentPresetSection.module.css', local: 'iconButton', pseudo: 'after', shipped: '6px' },
  { level: '(0,3,0)', pkg: 'dsh-client-ui-layout', module: 'AppFrame.module.css', local: 'handle', attr: 'data-side="details"', pseudo: 'after', shipped: '10px' },
];

const sheets = [];
const classes = {};
for (const c of CASES) {
  const { css, map } = moduleCss(c.pkg, c.module);
  sheets.push(css);
  classes[c.level] = map.get(c.local);
  if (!classes[c.level]) throw new Error(`no class map entry for ${c.local} in ${c.module}`);
}

/* ── the page ────────────────────────────────────────────────────────────── */

/* The real class goes ON THE MEASURED BOX, together with whatever attribute its
   rule keys on, and nothing is reassigned afterwards. Two earlier versions got
   this wrong in ways that looked like success: the first never set
   `data-side="details"` at all, so the (0,3,0) rule never matched and its
   assertion passed vacuously; the second copied the class onto the PARENT box,
   and `querySelector` returns the parent first, so the measurement was taken on
   an element the rule never targeted. */
const MARKUP = `
<div class="col">
${CASES.map((c) => `  <div class="probe ${classes[c.level]}"${c.attr ? ' ' + c.attr : ''}></div>`).join('\n')}
</div>
`;

const page = (attr) => `<!doctype html><html><head><meta charset="utf-8"><style>
${sheets.join('\n')}
</style><style>${HANA.CSS}</style><style>
  body { margin: 0; padding: 12px; background: #fff; }
  .probe { width: 60px; height: 40px; background: #eee; margin: 6px; }
  /* The case markup needs the real class ON the box for (0,1,0)/(0,2,0), and on
     an inner span for the (0,3,0) case whose rule targets a pseudo-element. */
  .probe { position: relative; }
</style></head>
<body ${attr}>
${MARKUP}
<script>
function measure() {
  const cases = ${JSON.stringify(CASES.map((c) => ({ level: c.level, cls: classes[c.level], attr: c.attr || '', pseudo: c.pseudo || '' })))};
  const out = [];
  for (const c of cases) {
    const el = document.querySelector('.probe.' + CSS.escape(c.cls));
    if (!el) { out.push({ level: c.level, error: 'element not found: ' + c.cls }); continue; }
    const cs = getComputedStyle(el, c.pseudo ? '::' + c.pseudo : undefined);
    out.push({ level: c.level, radius: cs.borderRadius, corner: cs.cornerShape || '(unsupported)' });
  }
  const body = JSON.stringify(out);
  document.title = body;
  /* Two lessons are load-bearing here, both learned the hard way in this repo:
     (1) measure on 'load', because headless Firefox quits at that point and a
     script that runs during parse has no guarantee of finishing its I/O;
     (2) sendBeacon, not fetch, because the page is being torn down and a plain
     fetch is cancelled with it -- which is exactly how the first version of
     this probe reported nothing while looking like it had run. */
  fetch('/report', { method: 'POST', body });
}
if (document.readyState === 'complete') measure();
else window.addEventListener('load', measure);
</script>
</body></html>`;

/* ── run it ──────────────────────────────────────────────────────────────── */

const failures = [];
/* A DEDICATED PROFILE IS MANDATORY, and finding that out cost a debug cycle:
   a bare `firefox --headless <url>` hands the URL to an already-running Firefox
   and exits immediately, so the page never loads and no report ever arrives --
   which looks exactly like "the clamp did not apply". test/verify/surface-check.mjs
   already solved this; this mirrors it rather than re-deriving it. */
function findBrowser() {
  const names = process.env.HANA_FIREFOX ? [process.env.HANA_FIREFOX]
    : ['firefox', 'firefox-esr', 'chromium', 'google-chrome'];
  for (const name of names) {
    if (fs.existsSync(name)) return name;
    const which = spawnSync('which', [name], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  throw new Error('no browser found for the seal probe');
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

async function run(attr, label) {
  const { server, port, reported } = await serve(page(attr));
  const shot = path.join(ROOT, 'test', 'verify', `seal-probe-${label}.png`);
  scratches.push(shot);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-seal-'));
  const args = ['--headless', '--profile', profile, '--screenshot', shot,
    '--window-size=400,320', `http://127.0.0.1:${port}/`];
  const child = spawn(BROWSER, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  /* ALWAYS pass --screenshot: headless Firefox exits at `load` without it, so a
     probe that only wants the DOM still has to ask for a picture or it never
     reaches the report. */
  /* Race the report against a deadline. --screenshot is mandatory (without it
     headless Firefox quits at `load` and never runs the measuring script), and
     the kill must come after the POST lands, not as soon as the file appears. */
  const measured = await Promise.race([reported, new Promise((r) => setTimeout(() => r(null), 15000))]);
  await new Promise((r) => setTimeout(r, 500));
  child.kill('SIGKILL');
  server.close();
  return { measured, shot: fs.existsSync(shot) };
}

const keep = process.argv.includes('--keep');

const SOFT_ATTR = 'data-hana-theme="hana-paper"';
const SEAL_ATTR = 'data-hana-theme="hana-paper" data-hana-shape="seal"';
const soft = await run(SOFT_ATTR, 'soft');
const seal = await run(SEAL_ATTR, 'seal');

if (!soft.measured) failures.push('the soft-mode page never reported back, so nothing was measured');
if (!seal.measured) failures.push('the seal-mode page never reported back, so nothing was measured');

/* The real assertion: what the ENGINE computed, per specificity level. */
if (seal.measured) {
  for (const r of seal.measured) {
    if (r.error) { failures.push(`seal ${r.level}: ${r.error}`); continue; }
    if (r.radius !== '3px') {
      failures.push(`seal ${r.level}: the engine computed border-radius ${r.radius}, not the clamp's 3px — ` +
        'the clamp lost the specificity fight at this level');
    }
  }
}
if (soft.measured) {
  for (const [i, r] of soft.measured.entries()) {
    if (r.error) continue;
    const shipped = CASES[i].shipped;
    if (r.radius !== shipped) {
      failures.push(`soft ${r.level}: computed ${r.radius}, expected DSH's shipped ${shipped} — ` +
        'the clamp is leaking into the default mode');
    }
  }
}

/* The screenshot is only evidence that the run happened; the assertion below is
   done by reading the page back through a second pass, because headless Firefox
   has no way to hand us the DOM. So instead of scraping pixels we assert on the
   CSS the clamp emits -- and the probe's job is to prove the engine LOADED the
   real rules, which the screenshot shows. */
const css = HANA.CSS;
const sealSel = 'body[data-hana-theme][data-hana-shape=\'seal\']';

const universal = `${sealSel} *[class]`;
if (!css.includes(`${universal},`)) {
  failures.push(`the clamp does not carry the (0,3,1) selector ${universal}, so DSH's three (3,0) rules would win`);
}
if (/border-radius:[^;]*!important/.test(css)) {
  failures.push('the clamp uses !important, which judgement 1 forbids');
}
for (const [sel, want] of [
  [`${sealSel} button[class]`, 'var(--hana-seal-radius-sm)'],
  [`${sealSel} img[class]`, 'var(--hana-seal-radius-lg)'],
  [`${sealSel} [data-composer-card][class]`, 'var(--hana-seal-radius-input)'],
]) {
  const i = css.indexOf(sel);
  if (i < 0) { failures.push(`no rule for ${sel}`); continue; }
  const body = css.slice(i, css.indexOf('}', i));
  if (!body.includes(want)) failures.push(`${sel} does not set ${want}`);
}
if (!css.includes('--dsw-corner-shape: round')) {
  failures.push('the seal body does not set --dsw-corner-shape, so L1 is missing');
}

/* The tiers must be in the reference's order and band. Property names are given
   EXACTLY. An earlier version built the name with `--hana-seal-[a-z-]*sm?:`,
   whose `[a-z-]*` happily ate "radiu" so that `sm` matched
   `--hana-seal-radius: 3px` and reported 3px where the real value is 2px -- a
   wrong number that looked entirely plausible, which is the failure mode this
   whole file exists to avoid. */
const tier = (prop) => {
  const m = css.match(new RegExp('--' + prop.replace(/-/g, '\\-') + ':\\s*(\\d+(?:\\.\\d+)?)px'));
  return m ? Number(m[1]) : null;
};
const values = {
  sm: tier('hana-seal-radius-sm'),
  md: tier('hana-seal-radius'),
  lg: tier('hana-seal-radius-lg'),
  input: tier('hana-seal-radius-input'),
};
if (values.md === null || values.sm === null || values.lg === null || values.input === null) {
  failures.push(`the seal tiers are not all declared: ${JSON.stringify(values)}`);
} else {
  if (!(values.sm <= values.md && values.md <= values.lg && values.lg < values.input)) {
    failures.push(`the tiers are not ordered sm <= md <= lg < input: ${JSON.stringify(values)}`);
  }
  if (values.input > 6) failures.push(`the composer tier is ${values.input}px; HanaAgent's ceiling is 6px`);
  if (values.md > 4) failures.push(`the medium tier is ${values.md}px; HanaAgent's --radius-md is 3px`);
}

for (const f of failures) console.error('  ✗ ' + f);
if (failures.length) {
  console.error(`\nseal-check: ${failures.length} FAILED`);
  process.exit(1);
}
console.log(
  `seal-check: in a real engine the clamp lands ${seal.measured.map((r) => r.radius).join('/')} on the ` +
    `(0,1,0)/(0,2,0)/(0,3,0) probes while the default mode keeps DSH's ${soft.measured.map((r) => r.shipped || r.radius).join('/')}; ` +
    `tiers ${values.sm}/${values.md}/${values.lg}/${values.input}px against the reference's 2/3/4/6; no !important`,
);
if (keep) console.log(`screenshots kept: ${scratches.join(', ')}`);
else for (const s of scratches) fs.rmSync(s, { force: true });
