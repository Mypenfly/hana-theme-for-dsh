/**
 * Verify the L3 surface rules in a real engine — the colours AND the geometry.
 *
 * WHY THIS EXISTS AND WHY IT MEASURES GEOMETRY
 * --------------------------------------------
 * The rules in that section are the theme's first attempt to style parts of the
 * app it does not own: tool calls, artifact rows, the end of a turn, and the
 * selected state of a sidebar row. Three things can go wrong, and none of them
 * is visible from reading the CSS:
 *
 *   1. THE RULE LOSES THE SPECIFICITY FIGHT. The harness draws those elements
 *      with CSS-Module classes, and this theme has no live view of the running
 *      GUI to check against. A rule that never applies is a silent no-op — the
 *      exact failure this project keeps finding in other people's code.
 *   2. THE SURFACE RESOLVES TO THE GROUND. The card is supposed to be a card.
 *   3. THE CARD JOGS THE COLUMN. A card bleeds outward by exactly the padding it
 *      adds so that its CONTENT stays on the reading column; if that arithmetic
 *      is wrong, prose and card text no longer share a left edge and the page
 *      looks broken in a way no colour assertion would notice.
 *
 * So the probe assembles the REAL harness stylesheets, the REAL DOM shape (with
 * the real hashed class names, read out of those sheets rather than guessed),
 * hana's own sheet, and the inline token map the plugin actually writes — then
 * measures computed colours and client rects in Firefox.
 *
 *   node test/verify/surface-check.mjs
 *   node test/verify/surface-check.mjs --keep   # keep the screenshot
 */

import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const require_ = createRequire(join(REPO, 'noop.cjs'));
const hana = require_(join(REPO, 'test', 'load-client.js')).loadClient().exports;
const { createEnvironment } = require_(join(REPO, 'test', 'harness.js'));

const PROFILE_MODULES = join(homedir(), '.dsh', 'profiles', 'node_modules', '@deepseek-ai');
/**
 * Every stylesheet literal in a client bundle, concatenated.
 *
 * NOT a regex over JS strings: the bundles write long sheets as double-quoted
 * literals continued with a backslash-newline, and `(?:[^"\\]|\\.)` cannot span
 * that — `.` does not match a newline, so the regex silently stops and returns a
 * SHORTER literal instead of failing. The first version of this file reported
 * "class _sessionRow not found in the sheet" for a sheet that plainly contained
 * it, which is exactly the kind of quiet under-match this project keeps finding.
 * So the literals are scanned by hand, escapes and all.
 */
const readBundleCss = (pkg) => {
  const file = join(PROFILE_MODULES, pkg, 'lib', 'client.js');
  if (!existsSync(file)) throw new Error(`not installed: ${pkg}`);
  const src = readFileSync(file, 'utf8');
  const sheets = [];
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] !== '"') continue;
    let out = '';
    let j = i + 1;
    let closed = false;
    for (; j < src.length; j += 1) {
      const ch = src[j];
      if (ch === '\\') {
        const next = src[j + 1];
        /* A line continuation contributes nothing; any other escape is
           preserved verbatim so the CSS text is unchanged. */
        if (next === '\n') { j += 1; continue; }
        out += ch + next;
        j += 1;
        continue;
      }
      if (ch === '"') { closed = true; break; }
      out += ch;
    }
    if (!closed) continue;
    i = j;
    /* A stylesheet, not a class-name map or a message: it has rules and at
       least one hashed local in it. */
    if (out.length > 120 && out.includes('{') && /\.[A-Za-z0-9_-]+_[A-Za-z0-9_-]+\s*[,{:.]/.test(out)) {
      sheets.push(out);
    }
  }
  if (!sheets.length) throw new Error(`no stylesheet literal in ${pkg}`);
  return sheets.join('\n');
};

/** The real hashed class name for a CSS-Module local, read out of the sheet. */
const clsOf = (css, local) => {
  const m = new RegExp(`\\.([A-Za-z0-9_-]+)_${local}\\b`).exec(css);
  if (!m) throw new Error(`class _${local} not found in the sheet`);
  return `${m[1]}_${local}`;
};

const SHEETS = {};
for (const pkg of [
  'dsh-client-ui-workspace',
  'dsh-client-ui-chat',
  'dsh-client-ui-settings-general',
  'dsh-client-ui-tool',
  'dsh-client-ui-deliverables',
]) {
  SHEETS[pkg] = readBundleCss(pkg);
}

const W = SHEETS['dsh-client-ui-workspace'];
const C = SHEETS['dsh-client-ui-chat'];
const S = SHEETS['dsh-client-ui-settings-general'];
const T = SHEETS['dsh-client-ui-tool'];
const D = SHEETS['dsh-client-ui-deliverables'];

/* Every class this probe needs, resolved from the sheets. A rename in a harness
   upgrade fails here loudly rather than producing a page that quietly measures
   nothing. */
const NAMES = {
  sessionRow: clsOf(W, 'sessionRow'),
  selected: clsOf(W, 'selected'),
  flowItem: clsOf(C, 'flowItem'),
  column: clsOf(C, 'column'),
  toolRoot: clsOf(T, 'root'),
  toolIoCard: clsOf(T, 'ioCard'),
  filesRow: clsOf(D, 'row'),
  navCell: clsOf(S, 'navCell'),
  navActive: clsOf(S, 'active'),
};

/** The inline map the plugin really writes, or the probe measures its own page. */
function inlineFromPlugin(paletteId) {
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette(paletteId);
  const inline = env.document.body.style._dump();
  if (Object.keys(inline).length < 90) {
    throw new Error(
      `the plugin wrote only ${Object.keys(inline).length} inline properties for ${paletteId} — ` +
        'the probe would be measuring a page the plugin never produced',
    );
  }
  return inline;
}

const inlineTokens = (tokens) => Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(';');

function doc(palette) {
  const inline = inlineFromPlugin(palette.id);
  const attrs = [
    `data-hana-theme="${palette.id.replace('hana-', '')}"`,
    'class="hana-serif"',
    'data-hana-texture="on"',
    'data-hana-shape="soft"',
    palette.scheme === 'dark' ? 'data-ds-dark-theme' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<!doctype html><html><head><meta charset="utf-8">
<style>${W}</style><style>${C}</style><style>${S}</style><style>${T}</style><style>${D}</style>
<style>${hana.CSS}</style>
<style>html,body{margin:0} body{background:var(--dsw-alias-bg-base);padding:0}</style>
</head><body ${attrs} style="${inlineTokens(inline)}">
<div class="${NAMES.column}">
  <div class="${NAMES.flowItem}" data-turn-process-answer><span data-edge="prose">Prose output.</span></div>
  <div class="${NAMES.flowItem}" data-turn-process-member><span data-edge="card">Tool call.</span>
    <div class="${NAMES.toolRoot}" data-tool="bash" data-state="ok">
      <div class="${NAMES.toolIoCard}">io</div>
    </div>
  </div>
  <div class="${NAMES.flowItem}" data-produced-files-row><span data-edge="artifact">out.txt</span></div>
  <div data-turn-tail="1" data-actions-reveal="always">
    <button type="button"><span data-edge="tail">12.4s</span></button>
  </div>
</div>
<div>
  <div class="${NAMES.sessionRow} ${NAMES.selected}" role="treeitem" aria-selected="true"><span data-edge="sel">Selected session</span></div>
  <div class="${NAMES.sessionRow}" role="treeitem" aria-selected="false"><span data-edge="unsel">Other session</span></div>
  <button type="button" class="${NAMES.navCell} ${NAMES.navActive}" aria-current="true"><span data-edge="navcur">Appearance</span></button>
  <button type="button" class="${NAMES.navCell}"><span data-edge="navplain">Models</span></button>
</div>
</body></html>`;
}

const VARIANTS = hana.PALETTES.map((p) => ({ id: p.id, doc: doc(p) }));

/* ── what the engine should resolve, from the shipped tables ────────────── */
export function expectedSurfaces() {
  const out = {};
  for (const p of hana.PALETTES) {
    const t = p.tokens;
    out[p.id] = {
      ground: t['--dsw-alias-bg-base'],
      card: t['--dsw-alias-bg-layer-1'],
      artifact: t['--dsw-alias-bg-layer-3'],
      accent: t['--dsw-alias-state-business-primary'],
    };
  }
  return out;
}

const REPORT = `
const norm = (c) => {
  if (/^rgba?\\(0, 0, 0, 0\\)$/.test(c)) return 'transparent';
  return c;
};
const pick = (win, doc, sel) => {
  const el = doc.querySelector(sel);
  if (!el) return null;
  /* getComputedStyle is a WINDOW method. Calling it on the document throws, and
     a throwing report script posts nothing — which the harness then reports as
     a timeout rather than as the bug it is. */
  const cs = win.getComputedStyle(el);
  return {
    bg: norm(cs.backgroundColor),
    borderTopWidth: cs.borderTopWidth,
    borderLeftWidth: cs.borderLeftWidth,
    boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow,
    fontWeight: cs.fontWeight,
    color: cs.color,
    rect: (() => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width }; })(),
  };
};
const out = {};
document.querySelectorAll('iframe').forEach((f) => {
  const doc = f.contentDocument;
  if (!doc) return;
  const id = f.dataset.variant;
  const edge = (name) => {
    const el = doc.querySelector('[data-edge="' + name + '"]');
    if (!el) return null;
    return el.getBoundingClientRect().left;
  };
  out[id] = {
    card: pick(f.contentWindow, doc, '[data-turn-process-member]'),
    prose: pick(f.contentWindow, doc, '[data-turn-process-answer]'),
    artifact: pick(f.contentWindow, doc, '[data-produced-files-row]'),
    tail: pick(f.contentWindow, doc, '[data-turn-tail]'),
    selected: pick(f.contentWindow, doc, '[role="treeitem"][aria-selected="true"]'),
    unselected: pick(f.contentWindow, doc, '[role="treeitem"][aria-selected="false"]'),
    navCurrent: pick(f.contentWindow, doc, '[aria-current="true"]'),
    navPlain: pick(f.contentWindow, doc, 'button:not([aria-current])'),
    nestedTool: pick(f.contentWindow, doc, '[data-turn-process-member] [data-tool]'),
    edges: { prose: edge('prose'), card: edge('card'), artifact: edge('artifact') },
  };
});
fetch('/report', { method: 'POST', body: JSON.stringify(out) });
`;

function buildHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>hana surface probe</title>
<style>
  body{margin:0;font:13px system-ui;background:#1b1b1b;color:#eee}
  section{padding:8px} h2{font:12px ui-monospace,monospace;margin:2px 0;color:#7cc}
  iframe{width:760px;height:520px;border:1px solid #555;background:#fff}
</style></head><body>
${VARIANTS.map((v, i) => `<section><h2>${v.id}</h2><iframe data-variant="${v.id}" id="f${i}"></iframe></section>`).join('\n')}
<script>
const DOCS = ${JSON.stringify(VARIANTS.map((v) => v.doc)).replace(/</g, '\\u003c')};
document.querySelectorAll('iframe').forEach((f, i) => { f.srcdoc = DOCS[i]; });
window.addEventListener('load', () => { try { ${REPORT} } catch (e) { fetch('/report', { method: 'POST', body: JSON.stringify({ error: 'report script threw: ' + (e && e.message) }) }); } });
</script></body></html>`;
}

/* ── drive a browser ────────────────────────────────────────────────────── */

function findBrowser() {
  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/Firefox.app/Contents/MacOS/firefox']
      : ['firefox', 'firefox-esr', 'chromium', 'google-chrome'];
  for (const name of candidates) {
    if (name.startsWith('/')) {
      if (existsSync(name)) return { name: 'firefox', path: name, flags: ['--headless'] };
      continue;
    }
    const which = spawnSync('which', [name], { encoding: 'utf8' });
    if (which.status === 0 && which.stdout.trim()) {
      return {
        name: name.startsWith('chrom') || name.includes('chrome') ? 'chromium' : 'firefox',
        path: which.stdout.trim(),
        flags: ['--headless', '--no-sandbox', '--disable-gpu'],
      };
    }
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.error('surface-check: no browser found — this gate needs one, and it is not part of `npm test`');
  process.exit(2);
}

const html = buildHtml();
let resolveReport;
const reportArrived = new Promise((r) => { resolveReport = r; });

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/report') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4_000_000) req.destroy(); });
    req.on('end', () => {
      res.writeHead(204).end();
      try { resolveReport(JSON.parse(body)); } catch (e) { resolveReport({ error: e.message }); }
    });
    return;
  }
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const keep = process.argv.includes('--keep');
const profile = mkdtempSync(join(tmpdir(), 'hana-surface-'));
const shot = join(REPO, 'test', 'verify', 'surface-probe.png');
/* ALWAYS screenshot, even when the image is thrown away. Without it headless
   Firefox exits the moment  fires — before the page can post its report —
   and the gate fails as a TIMEOUT, which looks like a broken page rather than a
   broken harness. Found the hard way. */
const shotPath = keep ? shot : join(profile, 'probe.png');
const launched =
  browser.name === 'firefox'
    ? [...browser.flags, '--profile', profile, '--window-size=820,2400', '--screenshot', shotPath, url]
    : [...browser.flags, `--user-data-dir=${profile}`, '--window-size=820,2400', `--screenshot=${shotPath}`, url];

console.log(`surface-check: ${browser.name} → ${url}`);
const child = spawn(browser.path, launched, { stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
child.stderr.on('data', (c) => { stderr += c; });
const finished = new Promise((r) => { child.on('exit', r); child.on('error', () => r(null)); });
const collected = await Promise.race([
  reportArrived,
  finished.then(() => 'BROWSER EXITED FIRST'),
  new Promise((r) => setTimeout(() => r('TIMEOUT'), 45000)),
]);
/* Give the browser a moment to WRITE THE SCREENSHOT before killing it. The report
   is posted on load, and headless Firefox only writes the image on exit — so
   killing it the instant the report lands produces a run that says it kept a
   screenshot and did not. */
await new Promise((r) => setTimeout(r, keep ? 2500 : 0));
try { child.kill(); } catch { /* already gone */ }
server.close();

if (typeof collected === 'string' || collected.error) {
  console.error(`surface-check: no usable report (${typeof collected === 'string' ? collected : collected.error})`);
  if (stderr.trim()) console.error('browser stderr:\n' + stderr.trim().slice(0, 1500));
  const dump = join(REPO, 'test', 'verify', 'surface-probe.html');
  writeFileSync(dump, html);
  console.error('page dumped to ' + dump);
  process.exit(1);
}

/* ── assert ─────────────────────────────────────────────────────────────── */

const expected = expectedSurfaces();
const rgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const failures = [];
const near = (a, b) => Math.abs(a - b) <= 0.75;

for (const [id, got] of Object.entries(collected)) {
  const want = expected[id];
  if (!want) { failures.push(`${id}: unexpected variant`); continue; }

  /* 1 — the rules applied at all. */
  if (!got.card || got.card.bg !== rgb(want.card)) {
    failures.push(
      `${id}: the tool-call card resolved to ${got.card ? got.card.bg : 'nothing'}, expected ` +
        `${rgb(want.card)} — the rule lost the specificity fight, or never matched`,
    );
  }
  if (!got.card || got.card.borderLeftWidth === '0px') {
    failures.push(`${id}: the tool-call card has no border — it is not a card`);
  }
  if (!got.card || got.card.boxShadow === 'none') {
    failures.push(`${id}: the tool-call card has no shadow`);
  }
  if (!got.artifact || got.artifact.bg !== rgb(want.artifact)) {
    failures.push(
      `${id}: the artifact row resolved to ${got.artifact ? got.artifact.bg : 'nothing'}, expected ${rgb(want.artifact)}`,
    );
  }
  if (!got.tail || got.tail.borderTopWidth === '0px') {
    failures.push(`${id}: the end-of-turn block has no rule above it`);
  }
  if (!got.prose || got.prose.bg !== 'transparent') {
    failures.push(
      `${id}: the prose item gained a background (${got.prose ? got.prose.bg : 'nothing'}) — ` +
        'prose is the content, not a card',
    );
  }

  /* 2 — a nested tool call does NOT get a second card. */
  if (got.nestedTool && got.nestedTool.bg === rgb(want.card)) {
    failures.push(`${id}: the tool card inside a card is painted as another card — two stacked cards`);
  }

  /* 3 — selected is not unselected, and carries the accent. */
  if (!got.selected || !got.unselected) {
    failures.push(`${id}: could not measure the sidebar rows`);
  } else {
    if (got.selected.bg === got.unselected.bg) {
      failures.push(`${id}: the selected row and an unselected row resolve to the same background`);
    }
    if (got.selected.bg !== rgb(want.artifact)) {
      failures.push(`${id}: the selected row resolved to ${got.selected.bg}, expected ${rgb(want.artifact)}`);
    }
    if (!got.selected.boxShadow.includes('inset') || !got.selected.boxShadow.includes('3px')) {
      failures.push(`${id}: the selected row has no accent bar (box-shadow: ${got.selected.boxShadow})`);
    }
  }
  if (got.navCurrent && got.navPlain && got.navCurrent.bg === got.navPlain.bg) {
    failures.push(`${id}: the settings nav's active row and a plain row resolve to the same background`);
  }

  /* 4 — the geometry claim: the card must not jog the column. */
  if (got.edges.prose === null || got.edges.card === null) {
    failures.push(`${id}: could not measure the content edges`);
  } else if (!near(got.edges.prose, got.edges.card)) {
    failures.push(
      `${id}: the card's content starts at ${got.edges.card.toFixed(1)}px but prose starts at ` +
        `${got.edges.prose.toFixed(1)}px — the bleed and the padding do not cancel, so the reading ` +
        'column jogs wherever a card appears',
    );
  }
  if (got.edges.artifact !== null && got.edges.prose !== null && !near(got.edges.artifact, got.edges.prose)) {
    failures.push(
      `${id}: the artifact row's content starts at ${got.edges.artifact.toFixed(1)}px against prose at ` +
        `${got.edges.prose.toFixed(1)}px — it bleeds by its padding and border, so the two must cancel`,
    );
  }
}

if (failures.length) {
  console.error(`\nsurface-check: ${failures.length} FAILED\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(
  `surface-check: ${Object.keys(collected).length} palette(s) — card, artifact, tail, nested card, ` +
    'selected row, active nav row all resolve as the shipped tables declare, and the card keeps ' +
    'the reading column aligned',
);
if (keep) console.log('screenshot:', shot);
