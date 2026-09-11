/**
 * VERIFICATION (not a gate) — reproduce the code-block colour cascade exactly,
 * measure it in a real engine, and print the measurements into the page so a
 * single headless screenshot carries them back out.
 *
 * Every input is a shipped artifact, not a retyped copy:
 *
 *   hana CSS ......... lib/client.js  -> exports.CSS
 *   hana palettes .... lib/client.js  -> exports.PALETTES (89 tokens each)
 *   harness shiki .... @deepseek-ai/dsh-client-ui-theme/lib/client.js
 *                      -> `var shiki_css_default = "..."` (:root + dark block)
 *   code block CSS ... @deepseek-ai/dsh-client-ui-primitives/lib/markdown/CodeBlock.module.css
 *   markup ........... shiki 4.4.3 + createCssVariablesTheme, as the harness runs it
 *
 * Two states are rendered per palette, because they differ and only one of them
 * is the steady state:
 *
 *   PINNED   the presenter set body[data-ds-dark-theme] from the palette's
 *            colorScheme, so the harness's dark shiki block applies.
 *   UNPINNED the window in which the override layer already paints a dark
 *            palette but the preference is not yet pinned, so the active theme
 *            is still the built-in `light` and body[data-ds-dark-theme] is
 *            ABSENT — the light shiki palette lands on a dark code surface.
 *            (Dark palettes only; for a light palette both states coincide.)
 *
 * Usage: node test/verify/build-shiki-probe.mjs
 *        firefox --headless --screenshot out.png file://.../shiki-probe.html
 */

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'shiki-probe.html');

/* ── locate the installed harness ─────────────────────────────────────── */
function findThemeClient() {
  const candidate =
    process.env.DSH_UI_THEME ||
    path.join(
      os.homedir(),
      '.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
    );
  if (!fs.existsSync(candidate)) {
    throw new Error(`installed ui-theme not found at ${candidate}; set DSH_UI_THEME`);
  }
  return candidate;
}
const THEME_CLIENT = findThemeClient();
/* <modules>/@deepseek-ai/dsh-client-ui-theme/lib/client.js -> <modules>/@deepseek-ai */
const SCOPE_DIR = path.dirname(path.dirname(path.dirname(THEME_CLIENT)));
const PRIMITIVES = path.join(
  SCOPE_DIR,
  'dsh-client-ui-primitives/lib/markdown/CodeBlock.module.css',
);

/* ── the real hana half ───────────────────────────────────────────────── */
const require = createRequire(path.join(REPO, 'noop.cjs'));
const hana = require(path.join(REPO, 'test', 'load-client.js')).loadClient().exports;

/* ── the real harness shiki sheet ─────────────────────────────────────── */
const SHIKI_CSS = (() => {
  const m = /var shiki_css_default = "([^"]*)"/.exec(fs.readFileSync(THEME_CLIENT, 'utf8'));
  if (!m) throw new Error('shiki_css_default not found in the installed ui-theme');
  return m[1];
})();
const CODE_BLOCK_CSS = fs.readFileSync(PRIMITIVES, 'utf8');

/* ── real shiki output ────────────────────────────────────────────────── */
const profileRequire = createRequire(
  path.join(os.homedir(), '.dsh', 'profiles', 'node_modules', 'noop.cjs'),
);
const load = (spec) => import(pathToFileURL(profileRequire.resolve(spec)).href);

const { createCssVariablesTheme, createHighlighterCoreSync } = await load('shiki/core');
const { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } = await load(
  'shiki/engine/javascript',
);
const langTs = (await load('@shikijs/langs/typescript')).default;
const langPy = (await load('@shikijs/langs/python')).default;
const langMd = (await load('@shikijs/langs/markdown')).default;

const highlighter = createHighlighterCoreSync({
  themes: [
    createCssVariablesTheme({ name: 'css-variables', variablePrefix: '--shiki-', fontStyle: true }),
  ],
  langs: [langTs, langPy, langMd],
  engine: createJavaScriptRegexEngine({ regexConstructor: defaultJavaScriptRegexConstructor }),
});

/**
 * THREE samples, because no single grammar emits all nine token roles — found by
 * running each and reading what came out, not by guessing:
 *
 *   python      constant, function, keyword, parameter, punctuation
 *   markdown    keyword, link, string
 *   typescript  comment, constant, keyword, string-expression
 *
 * Together they cover all nine, which is what lets render-check.mjs demand a
 * resolved colour for every one of them. A sample that misses a role would make
 * the gate silently narrower: the missing colour could stop resolving and
 * nothing would say so.
 */
const SAMPLES = [
  {
    lang: 'python',
    code: `# hana, in python
def greet(name: str, count: int) -> str:
    return name * count`,
  },
  {
    lang: 'markdown',
    /* The inline code span is not decoration: it is the only construct in the
       markdown grammar that emits the `string` role, verified by running the
       grammar rather than assumed. Drop it and a colour silently leaves the
       gate — which is what the build-time check below is for. */
    code: `# Notes

See the [design language](https://example.com/hana) and run \`hana build\`.`,
  },
  {
    lang: 'typescript',
    code: `// hana, in typescript
const greeting: string = "hello";
export default greeting;`,
  },
];

const MARKUP = SAMPLES.map((s) =>
  highlighter.codeToHtml(s.code, { lang: s.lang, theme: 'css-variables' }),
).join('\n');

/** Every syntax role the samples are expected to exercise. */
const EXPECTED_ROLES = [
  'comment',
  'constant',
  'function',
  'keyword',
  'link',
  'parameter',
  'punctuation',
  'string',
  'string-expression',
];

/* Fail here, at BUILD time, if a shiki or grammar upgrade stops emitting one of
   the roles — rather than upstream, where it would look like the theme's bug. */
const emitted = new Set(
  [...MARKUP.matchAll(/var\(--shiki-token-([a-z-]+)\)/g)].map((m) => m[1]),
);
const missingRoles = EXPECTED_ROLES.filter((r) => !emitted.has(r));
if (missingRoles.length) {
  throw new Error(
    `the probe samples no longer exercise: ${missingRoles.join(', ')} — the shiki theme or a ` +
      'grammar changed; widen the samples so render-check still covers every syntax role',
  );
}

/* ── what the plugin actually writes ──────────────────────────────────────
 *
 * The inline properties on <body> are taken from a DRIVEN plugin, not restated
 * from the tables. That matters: an earlier version of this file built the
 * style string itself out of `{...palette.tokens, ...SHIKI[id]}`, which meant
 * the probe could not tell whether the plugin ever applied them. Deleting
 * applyShiki() from reconcile() left this gate GREEN — the page was still
 * painted correctly because the probe had painted it.
 *
 * Now the values come from test/harness.js: apply the real bundle, claim the
 * palette through the real settings panel, and read the resulting inline map.
 * The chain the gate covers is therefore complete — plugin writes → engine
 * resolves — and a plugin that stops writing fails HERE as well as in
 * runtime.test.js.
 */
const { createEnvironment } = require(path.join(REPO, 'test', 'harness.js'));

function inlineFromPlugin(paletteId) {
  const env = createEnvironment();
  env.assertLive();
  env.apply();
  env.claimPalette(paletteId);
  const inline = env.document.body.style._dump();
  if (Object.keys(inline).length === 0) {
    throw new Error(
      `the plugin wrote nothing inline for ${paletteId} — the probe would render a page the ` +
        'plugin never produced, and every colour assertion below would be vacuous',
    );
  }
  const syntax = Object.keys(inline).filter((k) => k.startsWith('--shiki-'));
  if (syntax.length !== 11) {
    throw new Error(
      `the plugin wrote ${syntax.length} of 11 syntax properties for ${paletteId}; ` +
        'render-check would then be measuring a page this plugin did not produce',
    );
  }
  return inline;
}

/* ── variant documents ────────────────────────────────────────────────── */
const inlineTokens = (tokens) =>
  Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

function variantDoc(palette, { dark }) {
  const attrs = [
    `data-hana-theme="${palette.id.replace('hana-', '')}"`,
    'class="hana-serif"',
    'data-hana-texture="off"',
    'data-hana-shape="soft"',
    dark ? 'data-ds-dark-theme' : '',
  ]
    .filter(Boolean)
    .join(' ');

  /* The real inline map, straight out of the plugin. The syntax layer is the fix
     under test — with it present the syntax colours follow the chosen palette,
     so the UNPINNED variant (no body[data-ds-dark-theme]) renders the same
     syntax colours as the pinned one instead of the built-in light set. */
  const inline = inlineFromPlugin(palette.id);

  // The wrapper carries BOTH `block` and `md-code-block`: the app renders the
  // CSS-Module local name hashed (`Q7WfXG_block`) while hana's own rule targets
  // the global `md-code-block`, so reproducing both is what makes
  // `.block :where(pre.shiki)` match as it does in the app.
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${SHIKI_CSS}</style>
<style>${CODE_BLOCK_CSS}</style>
<style>${hana.CSS}</style>
<style>
  html,body{margin:0}
  body{background:var(--dsw-alias-bg-base);padding:10px}
</style>
</head><body ${attrs} style="${inlineTokens(inline)}">
<div class="block md-code-block">${MARKUP}</div>
</body></html>`;
}

const VARIANTS = [];
for (const p of hana.PALETTES) {
  VARIANTS.push({ id: `${p.id} · pinned`, doc: variantDoc(p, { dark: p.scheme === 'dark' }) });
  if (p.scheme === 'dark') {
    VARIANTS.push({ id: `${p.id} · UNPINNED`, doc: variantDoc(p, { dark: false }) });
  }
}

/**
 * Runs in the OUTER page. srcdoc frames are same-origin, so the parent reads
 * each frame's computed styles directly and prints one consolidated table.
 * Colours are read from the engine, never restated from the palette tables.
 */
const REPORT_SCRIPT = `
const parse = (css) => {
  const m = /rgba?\\(([^)]+)\\)/.exec(css);
  if (!m) return null;
  const p = m[1].split(/[,\\/]/).map(parseFloat);
  return { r: p[0], g: p[1], b: p[2] };
};
const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function measure(frame) {
  const d = frame.contentDocument;
  const pre = d && d.querySelector('pre.shiki');
  if (!pre) return null;
  const codeBg = parse(getComputedStyle(pre).backgroundColor);
  const pageBg = parse(getComputedStyle(d.body).backgroundColor);
  const seen = new Map();
  d.querySelectorAll('span[style*="--shiki-token"]').forEach((el) => {
    const m = /var\\((--shiki-token-[a-z-]+)\\)/.exec(el.getAttribute('style') || '');
    if (m && !seen.has(m[1])) seen.set(m[1], parse(getComputedStyle(el).color));
  });
  const rows = [];
  seen.forEach((col, name) => {
    if (col && codeBg) rows.push({ name: name.replace('--shiki-token-', ''), col, r: ratio(col, codeBg) });
  });
  rows.sort((a, b) => a.r - b.r);
  return { codeBg, pageBg, rows };
}

window.addEventListener('load', () => {
  const frames = [...document.querySelectorAll('iframe')];
  const out = document.getElementById('report');
  let lines = [];
  frames.forEach((f) => {
    const m = measure(f);
    const title = f.dataset.variant;
    if (!m) { lines.push({ t: title + '  — NOT RENDERED', bad: true, head: true }); return; }
    const fails = m.rows.filter((r) => r.r < 4.5).length;
    lines.push({
      t: title + '   code bg ' + hex(m.codeBg) + '  page bg ' + hex(m.pageBg) +
         '   ' + fails + '/' + m.rows.length + ' below AA',
      bad: fails > 0, head: true,
    });
    m.rows.forEach((r) => lines.push({
      t: '    ' + (r.r >= 4.5 ? 'PASS' : 'FAIL') + '  ' +
         r.name.padEnd(19, ' ') + hex(r.col) + '   ' + r.r.toFixed(2) + ':1',
      bad: r.r < 4.5,
    }));
  });
  out.textContent = lines.map((l) => l.t).join('\\n');
  out.dataset.fail = String(lines.filter((l) => !l.head && l.bad).length);

  /* The same numbers as DATA, so a gate can compare them instead of a human
     reading pixels. The screenshot is for the human; this is for the build. */
  window.__HANA_REPORT__ = {
    results: frames.map((f) => {
      const m = measure(f);
      if (!m) return { variant: f.dataset.variant, rendered: false };
      return {
        variant: f.dataset.variant,
        rendered: true,
        codeBg: hex(m.codeBg),
        pageBg: hex(m.pageBg),
        belowAA: m.rows.filter((r) => r.r < 4.5).length,
        tokens: Object.fromEntries(m.rows.map((r) => [r.name, hex(r.col)])),
      };
    }),
  };

  /* Posted when served over http (test/verify/render-check.mjs); absent for a
     plain file:// screenshot, which is fine — the report is then only visual. */
  if (location.protocol.indexOf('http') === 0) {
    fetch('/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(window.__HANA_REPORT__),
    }).catch(function () {});
  }
});
`;

/**
 * The probe page, as a string, plus what it is built from — exported so
 * test/verify/render-check.mjs can serve it and read the measurements back
 * without duplicating any of the assembly.
 */
export function buildProbeHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>hana shiki probe</title>
<style>
  body{margin:0;font:13px system-ui;background:#1b1b1b;color:#eee}
  section{padding:8px}
  h2{font:12px ui-monospace,monospace;margin:2px 0;color:#7cc}
  iframe{width:700px;height:430px;border:1px solid #555;background:#fff}
  #report{white-space:pre;font:15px/1.45 ui-monospace,monospace;color:#dfe;
          background:#111;padding:14px;margin:0}
</style></head><body>
${VARIANTS.map(
  (v, i) =>
    `<section><h2>${v.id}</h2><iframe data-variant="${v.id}" id="f${i}"></iframe></section>`,
).join('\n')}
<pre id="report">measuring…</pre>
<script>
const DOCS = ${JSON.stringify(VARIANTS.map((v) => v.doc)).replace(/</g, '\\u003c')};
document.querySelectorAll('iframe').forEach((f, i) => { f.srcdoc = DOCS[i]; });
${REPORT_SCRIPT}
</script>
</body></html>`;
}

/** What the engine is expected to resolve, derived from the SHIPPED tables. */
export function expectedMeasurements() {
  const out = {};
  for (const p of hana.PALETTES) {
    out[p.id] = {
      codeBg: p.tokens['--dsw-alias-markdown-code-block'],
      pageBg: p.tokens['--dsw-alias-bg-base'],
      tokens: Object.fromEntries(
        Object.entries(hana.SHIKI[p.id])
          .filter(([name]) => name.startsWith('--shiki-token-'))
          .map(([name, value]) => [name.replace('--shiki-token-', ''), value]),
      ),
    };
  }
  return out;
}

export const PROBE_VARIANTS = VARIANTS;
export const PROBE_PALETTES = hana.PALETTES;

/* ── CLI: write the standalone page for a manual screenshot ─────────────── */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  fs.writeFileSync(OUT, buildProbeHtml());
  console.log('wrote', path.relative(REPO, OUT));
  console.log('variants:', VARIANTS.map((v) => v.id).join(' | '));
}
