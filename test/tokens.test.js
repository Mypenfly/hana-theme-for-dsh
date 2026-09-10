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

if (failures.length) {
  console.error(`tokens: ${failures.length} FAILED\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}

console.log(
  `tokens: ${reference.length} tokens x ${PALETTES.length} palettes, all present in the ` +
    `ui-theme ${allowlist.source.version} allow-list (coverage ${coverage})`,
);
