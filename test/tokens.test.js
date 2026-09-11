'use strict';
/**
 * Token-shape gate.
 *
 * Three properties of the palettes are load-bearing, and none of them is
 * visible from reading the tables:
 *
 * 1. Every name must be one the harness actually reads. A token name is not
 *    validated by `theme.register`/`overrideTokens` — only its *value* shape is
 *    — so a typo produces no error, no warning and no effect. The allow-list is
 *    generated from the harness's own stylesheet by
 *    `tools/refresh-allowlist.mjs`; this test is what makes the generation
 *    worth running.
 *
 * 2. Both tables must cover the SAME names. A name present in one mode and
 *    absent from the other renders correctly in one colour scheme and falls
 *    back to the harness default in the other, which reads as a subtle colour
 *    bug rather than a missing entry.
 *
 * 3. Both halves of the plugin must agree on the settings defaults. The host
 *    half puts the default in the persisted schema; the browser half falls back
 *    to its own copy before the scope is ready. If they drift, the switch the
 *    user sees is not the switch that is stored.
 */

const fs = require('fs');
const path = require('path');

const { loadClient } = require('./load-client');

const ROOT = path.join(__dirname, '..');
const allowlist = JSON.parse(fs.readFileSync(path.join(__dirname, 'token-allowlist.json'), 'utf8'));

const { exports: client } = loadClient();
const host = require(path.join(ROOT, 'lib', 'index.js'));

const allowed = new Set(allowlist.tokens);
const PALETTES = client.PALETTES;

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

/* 1 — every name has a reader in the harness */
for (const { id: themeName, tokens } of PALETTES) {
  const unknown = Object.keys(tokens).filter((name) => !allowed.has(name));
  check(
    unknown.length === 0,
    `${themeName} uses ${unknown.length} token name(s) absent from the harness allow-list ` +
      `(ui-theme ${allowlist.source.version}) — these would be silent no-ops: ${unknown.join(', ')}`,
  );
}

/* 2 — every palette covers the SAME names.
   A name present in some palettes and missing from others renders correctly in
   one colour scheme and silently falls back to the harness default in another,
   which reads as a subtle colour bug rather than a missing entry. Compared
   against the first palette also catches a whole palette being short. */
const reference = Object.keys(PALETTES[0].tokens).sort();
for (const { id: themeName, tokens } of PALETTES) {
  const names = Object.keys(tokens).sort();
  const missing = reference.filter((n) => !names.includes(n));
  const extra = names.filter((n) => !reference.includes(n));
  check(
    missing.length === 0 && extra.length === 0,
    `${themeName} does not cover the same token names as ${PALETTES[0].id} — ` +
      `missing: [${missing.join(', ')}] extra: [${extra.join(', ')}]`,
  );
}

/* Coverage is reported, not required: defining fewer tokens than the harness
   offers is a legitimate way to let the harness default show through. Silence
   about a *gap* is what would be dangerous, so print the number. */
const coverage = `${reference.length}/${allowed.size}`;

/* 3 — the two halves agree on the settings defaults */
const hostDefaults = host.FIELD_DEFAULTS;
const clientDefaults = client.DEFAULTS;
check(
  JSON.stringify(hostDefaults) === JSON.stringify(clientDefaults),
  'lib/index.js FIELD_DEFAULTS and lib/client.js FIELD_DEFAULTS have drifted: ' +
    `host=${JSON.stringify(hostDefaults)} client=${JSON.stringify(clientDefaults)}`,
);

/* The settings namespace is the contract between the halves; a mismatch means
   the browser writes into a namespace the host never registered. */
const clientNamespace = /var NS = "([^"]+)"/.exec(
  fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8'),
);
check(
  clientNamespace && clientNamespace[1] === host.NAMESPACE,
  `settings namespace mismatch: host="${host.NAMESPACE}" client="${clientNamespace ? clientNamespace[1] : '(not found)'}"`,
);

/* 4 — the registered theme ids must be exactly the ones skin.json advertises,
   or the advertised palette is unreachable from Settings > Appearance. */
const skin = JSON.parse(fs.readFileSync(path.join(ROOT, 'skin.json'), 'utf8'));
const declared = (skin.themes || []).map((t) => t.id).sort();
const registered = PALETTES.map((p) => p.id).sort();
check(
  JSON.stringify(declared) === JSON.stringify(registered),
  `skin.json themes ${JSON.stringify(declared)} do not match the registered ids ${JSON.stringify(registered)}`,
);

/* 5 — skin.json advertises a token count to the skin browser. Stating it twice
   is a drift risk, so the advertised number is checked against the table. */
if (skin.tokens && typeof skin.tokens.count === 'number') {
  check(
    skin.tokens.count === reference.length,
    `skin.json advertises ${skin.tokens.count} tokens but the palette has ${reference.length}`,
  );
}

/* 6 — the syntax palette must use exactly the names the harness declares.
 *
 * `--shiki-*` is a SECOND channel: not part of the 89 registered colour tokens,
 * so `theme.register`/`overrideTokens` can never reach it and a misspelling is
 * a silent no-op in exactly the same way. The list is generated from the
 * installed bundle's `shiki_css_default` by tools/refresh-allowlist.mjs, so an
 * upgrade that renames or adds a syntax token shows up as a failing build
 * rather than as code that quietly keeps the harness's colours.
 */
const syntaxAllowed = new Set(allowlist.syntaxTokens || []);
check(
  syntaxAllowed.size > 0,
  'token-allowlist.json has no syntaxTokens — re-run `npm run refresh:allowlist`',
);

const SHIKI = client.SHIKI || {};
const shikiIds = Object.keys(SHIKI).sort();
check(
  JSON.stringify(shikiIds) === JSON.stringify(PALETTES.map((p) => p.id).sort()),
  `the syntax palettes cover ${JSON.stringify(shikiIds)} but the plugin registers ` +
    `${JSON.stringify(PALETTES.map((p) => p.id).sort())} — every palette needs one, or its code ` +
    'blocks silently fall back to the harness colours',
);

for (const [id, table] of Object.entries(SHIKI)) {
  const names = Object.keys(table).sort();
  const unknown = names.filter((n) => !syntaxAllowed.has(n));
  check(
    unknown.length === 0,
    `${id} uses ${unknown.length} syntax name(s) the harness does not declare — silent no-ops: ${unknown.join(', ')}`,
  );
  const missing = [...syntaxAllowed].filter((n) => !names.includes(n)).sort();
  check(
    missing.length === 0,
    `${id} does not cover ${missing.length} syntax name(s) the harness declares: ${missing.join(', ')}`,
  );
  /* Every palette must name the SAME set, or one palette would keep the
     harness's colour for a token the others override — invisible in one mode
     and wrong in the other. */
  check(
    JSON.stringify(names) === JSON.stringify(Object.keys(SHIKI[PALETTES[0].id]).sort()),
    `${id} does not cover the same syntax names as ${PALETTES[0].id}`,
  );
}

/* 7 — the syntax background must equal the code surface it is painted on.
   CodeBlock.module.css paints `pre.shiki` with --dsw-alias-markdown-code-block
   and marks it !important, so that token — not --shiki-background — is the real
   backdrop. The two must agree, or shiki's inline background and the !important
   rule would disagree and the "surface" would depend on which won. */
for (const { id, tokens } of PALETTES) {
  const table = SHIKI[id];
  if (!table) continue;
  check(
    table['--shiki-background'] === tokens['--dsw-alias-markdown-code-block'],
    `${id}: --shiki-background is ${table['--shiki-background']} but the code surface ` +
      `--dsw-alias-markdown-code-block is ${tokens['--dsw-alias-markdown-code-block']} — they must agree`,
  );
  check(
    table['--shiki-foreground'] === tokens['--dsw-alias-label-primary'],
    `${id}: --shiki-foreground is ${table['--shiki-foreground']} but the palette's primary ink is ` +
      `${tokens['--dsw-alias-label-primary']} — code text must use the palette's ink`,
  );
}

if (failures.length) {
  console.error(`tokens: ${failures.length} FAILED\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}

console.log(
  `tokens: ${reference.length} tokens x ${PALETTES.length} palettes, all present in the ` +
    `ui-theme ${allowlist.source.version} allow-list (coverage ${coverage})`,
);
