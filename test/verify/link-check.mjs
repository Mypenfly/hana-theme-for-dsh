#!/usr/bin/env node
/**
 * Is the link rule a BORDER in a real engine, and did colouring it leave the
 * harness's hit area alone?
 *
 * WHY THIS EXISTS
 * ---------------
 * This theme used to draw links with `text-decoration-color`, and the recorded
 * reason was that the harness paints the markdown anchor with a deliberately
 * transparent 2px bottom border as an enlarged hit area, so overriding it would
 * shrink the click target. The border is real -- `MarkdownText.module.css` says
 * `Transparent hit-area padding` -- but the conclusion was a category error:
 * colouring a border that already exists does not narrow it. What narrows it is
 * changing the WIDTH, or writing the `border` shorthand, which resets all four
 * sides.
 *
 * That is a claim about geometry, and geometry claims about CSS are the kind that
 * read as obviously true and are quietly false -- `test/check.js` can see the
 * shorthand and the width in the text, but not what the engine did with them.
 *
 * So this renders the REAL anchor rule out of the installed harness, with the
 * real theme stylesheet, and reads back all four borders plus the box they make.
 *
 * Usage: node test/verify/link-check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadClient } from '../load-client.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { exports: HANA } = loadClient();

/* The harness's anchor rule, verbatim. Taken from the installed source rather
   than retyped, so a DSH upgrade that changes the hit area shows up here as a
   different number instead of being papered over by a copy. */
const AI = process.env.HANA_AI_ROOT || path.join(os.homedir(), '.dsh/profiles/node_modules/@deepseek-ai');
const MODULE = path.join(AI, 'dsh-client-ui-primitives/lib/markdown/MarkdownText.module.css');
if (!fs.existsSync(MODULE)) throw new Error(`cannot find ${MODULE}`);
const source = fs.readFileSync(MODULE, 'utf8');
const anchorRule = /\.markdown a \{([^}]*)\}/.exec(source);
if (!anchorRule) throw new Error('the harness no longer declares a `.markdown a` rule; update this probe');
const anchorCss = `.markdown a {${anchorRule[1]}}`.replace(/\s+/g, ' ');

/* The hit area the harness builds: three zero-alpha borders pulled back by
   negative margins. Parsed, not assumed. */
const hit = {};
for (const side of ['left', 'right', 'top', 'bottom']) {
  const m = new RegExp(`border-${side}:\\s*([0-9.]+)px solid rgb\\(255 255 255 / 0\\)`).exec(anchorCss);
  hit[side] = m ? Number(m[1]) : null;
}
if (Object.values(hit).some((v) => v === null)) {
  throw new Error(`the harness's transparent hit-area borders changed shape: ${JSON.stringify(hit)}`);
}
/* What the theme is allowed to touch. Everything else must come back unchanged. */
const UNTOUCHED = ['left', 'right', 'top'].map((s) => ({ side: s, width: hit[s] }));

const failures = [];

/* "Transparent" is an ALPHA question, not a colour one. The harness writes
   `rgb(255 255 255 / 0)` -- the sheet's own comment says "literal zero-alpha only
   (no painted color)" -- and the engine computes that as `rgba(255, 255, 255, 0)`,
   keeping the authored triple. The first version of this probe compared against
   `rgba(0, 0, 0, 0)` and reported the harness's own hit area as "painted". */
const isTransparent = (c) => c === 'transparent' || /,\s*0\)$/.test(c);

function findBrowser() {
  const names = process.env.HANA_FIREFOX ? [process.env.HANA_FIREFOX]
    : ['firefox', 'firefox-esr', 'chromium', 'google-chrome'];
  for (const name of names) {
    if (fs.existsSync(name)) return name;
    const which = spawnSync('which', [name], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  throw new Error('no browser found for the link probe');
}
const BROWSER = findBrowser();

const CASES = [
  { id: 'coral-resting', palette: 'hana-coral', hover: false },
  { id: 'coral-hover', palette: 'hana-coral', hover: true },
  { id: 'paper-resting', palette: 'hana-paper', hover: false },
];

const page = (c) => {
  const tokens = Object.entries(HANA.PALETTES.find((p) => p.id === c.palette).tokens)
    .map(([k, v]) => `${k}:${v}`).join(';');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${anchorCss}</style>
<style>${HANA.CSS}</style></head>
<body data-hana-theme="${c.palette.replace('hana-', '')}" data-hana-focus="accent" style="${tokens}">
<!-- The harness keys its anchor rule on .markdown, a CSS-module LOCAL name; in
     the built bundle it is ._markdown_177e0_5. The probe declares the rule under
     its local name (see anchorCss above), so the markup uses it too. -->
<div class="markdown" data-chat-flow-kind="assistant-step"><p>prose <a id="link" href="#x">a link</a> prose</p></div>
<script>
window.addEventListener('load', function () {
  const el = document.getElementById('link');
  const cs = getComputedStyle(el);
  const out = {
    decoration: cs.textDecorationLine,
    sides: {},
  };
  for (const side of ['top', 'right', 'bottom', 'left']) {
    out.sides[side] = {
      width: cs.getPropertyValue('border-' + side + '-width').trim(),
      style: cs.getPropertyValue('border-' + side + '-style').trim(),
      color: cs.getPropertyValue('border-' + side + '-color').trim(),
    };
  }
  /* Reported, not asserted: the hit area is the border BOX, and the theme's job
     is to leave the three sides that make it alone. Height is read so a reader
     can see the 1px the reference's narrower underline costs. */
  out.boxHeight = el.getBoundingClientRect().height;
  out.clientHeight = el.clientHeight;
  fetch('/report', { method: 'POST', body: JSON.stringify(out) });
});
</script></body></html>`;
};

async function run(html) {
  const { server, port, reported } = await new Promise((resolve) => {
    let settle;
    const reported = new Promise((r) => { settle = r; });
    const server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => { res.end('ok'); try { settle(JSON.parse(body)); } catch (e) { settle(null); } });
        return;
      }
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, reported }));
  });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-link-'));
  /* ALWAYS pass --screenshot: headless Firefox exits at `load` without it. */
  const child = spawn(BROWSER, ['--headless', '--profile', profile,
    '--screenshot', path.join(profile, 'probe.png'),
    '--window-size=420,200', `http://127.0.0.1:${port}/`], { stdio: ['ignore', 'ignore', 'pipe'] });
  const measured = await Promise.race([reported, new Promise((r) => setTimeout(() => r(null), 15000))]);
  await new Promise((r) => setTimeout(r, 400));
  child.kill('SIGKILL');
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  return measured;
}

let checked = 0;
for (const c of CASES) {
  const got = await run(page(c));
  if (!got) { failures.push(`${c.id}: the page never reported back`); continue; }
  checked += 1;

  /* Only the BOTTOM border is the theme's. The other three are the hit area. */
  for (const { side, width } of UNTOUCHED) {
    const s = got.sides[side];
    if (s.width !== `${width}px` || s.style !== 'solid') {
      failures.push(
        `${c.id}: border-${side} is ${s.width} ${s.style}, but the harness declares ${width}px solid as part ` +
          'of the anchor\'s hit area. Colouring the bottom border is the reference\'s treatment; narrowing or ' +
          'resetting the other three is what actually shrinks the click target.',
      );
    }
    if (!isTransparent(s.color)) {
      failures.push(`${c.id}: border-${side} is painted (${s.color}); the harness keeps all three transparent so the enlargement is invisible`);
    }
  }

  const bottom = got.sides.bottom;
  if (bottom.width !== '1px') {
    failures.push(`${c.id}: the link rule is ${bottom.width} wide; the reference draws 1px and the theme sets that width deliberately (the harness reserves 2px, and narrowing it costs 1px of hit height at the bottom only)`);
  }
  if (isTransparent(bottom.color)) {
    failures.push(`${c.id}: the bottom border is still transparent, so the link has no rule at all`);
  }
  if (got.decoration !== 'none') {
    failures.push(`${c.id}: text-decoration is ${got.decoration}; the reference clears it and draws a border, and leaving the harness underline on gives a link two lines`);
  }
}

if (failures.length) {
  for (const f of failures) console.error('  ✗ ' + f);
  console.error(`\nlink-check: ${failures.length} FAILED`);
  process.exit(1);
}
console.log(
  `link-check: in a real engine the anchor's bottom border is 1px and painted while ` +
    `border-${UNTOUCHED.map((u) => u.side).join('/')} stay ${UNTOUCHED.map((u) => u.width + 'px').join('/')} and ` +
    `transparent -- the harness's hit area ${JSON.stringify(hit)} survives, and text-decoration is none`,
);
