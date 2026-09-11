#!/usr/bin/env node
/**
 * Does the paper grain paint where it may, and nowhere else, in a real engine?
 *
 * WHY THIS EXISTS
 * ---------------
 * The veto is expressed TWICE -- the client writes `data-hana-texture='off'` for
 * a dark palette, and the CSS rule is keyed on the two palettes that may carry
 * grain at all -- and each half is checked somewhere already: the client's half
 * by test/runtime.test.js, the CSS half textually by tools/derive-grain.mjs. What
 * neither can see is whether the two MEET: whether `body[data-hana-theme='coral']`
 * is a selector that actually matches the attribute value the client writes.
 *
 * That is exactly the class of claim that reads as obviously true and is quietly
 * false -- a selector keyed on `coral` against an attribute written as `hana-coral`
 * would pass every textual check in the repo and leave the grain off in every
 * palette but one.
 *
 * So this renders four pages -- the two light palettes and the two dark ones,
 * all with `data-hana-texture='on'` forced on, i.e. the WORST case where the
 * client's half has already failed -- and reads back what the engine resolved
 * for the `::after` pseudo-element that carries the grain.
 *
 * Usage: node test/verify/texture-check.mjs
 *
 * There is no --keep: the screenshot exists only because headless Firefox quits
 * at `load` without one, and it is deleted before the assertion is even read.
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

const failures = [];

/* Every palette, with the texture attribute forced ON. The dark two are the
   point: the client would never write 'on' for them, so this asks the CSS alone
   whether it would paint. */
const CASES = HANA.PALETTES.map((p) => ({
  id: p.id,
  attr: p.id.replace('hana-', ''),
  expectGrain: p.scheme === 'light',
}));

const page = (c) => {
  const tokens = Object.entries(HANA.PALETTES.find((p) => p.id === c.id).tokens)
    .map(([k, v]) => `${k}:${v}`).join(';');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${HANA.CSS}</style></head>
<body data-hana-theme="${c.attr}" data-hana-texture="on" style="${tokens}">
<script>
window.addEventListener('load', function () {
  const cs = getComputedStyle(document.body, '::after');
  const out = {
    theme: document.body.getAttribute('data-hana-theme'),
    texture: document.body.getAttribute('data-hana-texture'),
    content: cs.content,
    image: cs.backgroundImage,
    blend: cs.mixBlendMode,
    position: cs.position,
  };
  fetch('/report', { method: 'POST', body: JSON.stringify(out) });
});
</script></body></html>`;
};

function findBrowser() {
  const names = process.env.HANA_FIREFOX ? [process.env.HANA_FIREFOX]
    : ['firefox', 'firefox-esr', 'chromium', 'google-chrome'];
  for (const name of names) {
    if (fs.existsSync(name)) return name;
    const which = spawnSync('which', [name], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  throw new Error('no browser found for the texture probe');
}
const BROWSER = findBrowser();

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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-texture-'));
  /* The screenshot is mandatory (see above) and useless to us, so it goes in the
     throwaway profile and leaves with it. */
  const shot = path.join(profile, 'probe.png');
  /* ALWAYS pass --screenshot: headless Firefox exits at `load` without it, so a
     probe that only wants the DOM still has to ask for a picture. */
  const child = spawn(BROWSER, ['--headless', '--profile', profile, '--screenshot', shot,
    '--window-size=320,200', `http://127.0.0.1:${port}/`], { stdio: ['ignore', 'ignore', 'pipe'] });
  const measured = await Promise.race([reported, new Promise((r) => setTimeout(() => r(null), 15000))]);
  await new Promise((r) => setTimeout(r, 400));
  child.kill('SIGKILL');
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  return measured;
}

const results = [];
for (const c of CASES) {
  const got = await run(page(c));
  if (!got) { failures.push(`${c.id}: the page never reported back`); continue; }
  results.push({ ...c, got });
}

for (const r of results) {
  if (r.got.theme !== r.attr) {
    failures.push(`${r.id}: the page rendered data-hana-theme="${r.got.theme}", not "${r.attr}" -- nothing below is a measurement of this palette`);
    continue;
  }
  /* A pseudo-element with no content is not generated at all, so `content` is
     the honest witness for "the layer exists". */
  const painted = r.got.content !== 'none' && !/^none$/.test(r.got.image) && r.got.image !== '';
  if (r.expectGrain && !painted) {
    failures.push(
      `${r.id}: the light palette painted NO grain. The rule is keyed on ` +
        `body[data-hana-theme='paper'|'coral'], so this means the selector does not match the attribute ` +
        `value the client writes (content=${r.got.content}, image=${r.got.image})`,
    );
  }
  if (!r.expectGrain && painted) {
    failures.push(
      `${r.id}: a DARK palette painted the grain even with data-hana-texture forced to "on". The CSS half ` +
        'of the veto is what is supposed to hold here -- the client would never write "on" for this ' +
        `palette, which is exactly why the second expression exists. (content=${r.got.content})`,
    );
  }
  if (painted && r.got.blend !== 'soft-light') {
    failures.push(`${r.id}: the grain painted with mix-blend-mode ${r.got.blend}, not soft-light; neutrality rests on that blend`);
  }
}

for (const f of failures) console.error('  ✗ ' + f);
if (failures.length) {
  console.error(`\ntexture-check: ${failures.length} FAILED`);
  process.exit(1);
}
const lit = results.filter((r) => r.expectGrain).map((r) => r.attr);
const dark = results.filter((r) => !r.expectGrain).map((r) => r.attr);
console.log(
  `texture-check: in a real engine the grain paints in ${lit.join('/')} and NOT in ${dark.join('/')} ` +
    'even with data-hana-texture forced on, so the client\'s veto and the stylesheet\'s palette key agree',
);
