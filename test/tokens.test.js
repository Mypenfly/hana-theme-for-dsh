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
/* Overridable for the same reason lib/client.js is (test/selftest.js): a gate
   that has never been shown to fail against a known-bad input is decoration.
   The decline-recording check in particular can only be exercised by mutating
   the generated file it reads. */
const ALLOWLIST_PATH = process.env.HANA_ALLOWLIST || path.join(__dirname, 'token-allowlist.json');
const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

const { exports: client } = loadClient();
const host = require(path.join(ROOT, 'lib', 'index.js'));

const allowed = new Set(allowlist.tokens);
/* Names a shipped UI READS but the registered contract does not declare. These
   are not no-ops — most of the reads have no `var()` fallback, so declining the
   name makes the declaration invalid at computed-value time and the property
   disappears. Generated from the installed UI by the same tool, from the
   REFERENCE side rather than the declaration side. */
const unregisteredButRead = new Set(Object.keys(allowlist.consumedNotRegistered || {}));
const PALETTES = client.PALETTES;

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

/* 1 — every name has a reader in the harness */
for (const { id: themeName, tokens } of PALETTES) {
  const unknown = Object.keys(tokens).filter((name) => !allowed.has(name) && !unregisteredButRead.has(name));
  check(
    unknown.length === 0,
    `${themeName} uses ${unknown.length} token name(s) absent from the harness allow-list ` +
      `(ui-theme ${allowlist.source.version}) — these would be silent no-ops: ${unknown.join(', ')}`,
  );
}

/* 1b — and every name a shipped UI READS must actually be supplied.
 *
 * The inverse of check 1, and the one that was missing. Check 1 only bounds the
 * names a palette MAY use; on its own it is satisfied by supplying none of the
 * unregistered ones, which is the state this project shipped in — with
 * `--dsw-alias-link` read bare by `dsh-client-ui-primitives` and declared by
 * nobody.
 *
 * `fallback` decides which obligation applies, and the tool measures it from
 * the call site rather than assuming:
 *   none/mixed  some read has NO fallback, so declining drops the declaration
 *               outright — supplying it is mandatory
 *   always      every read has a fallback, so declining degrades gracefully —
 *               either supply it or record a reason in the tool's DECLINED_READS
 */
check(
  unregisteredButRead.size > 0 || !allowlist.consumerScan,
  'token-allowlist.json has no consumedNotRegistered — re-run `npm run refresh:allowlist`',
);
const UNREGISTERED = allowlist.consumedNotRegistered || {};
for (const name of Object.keys(UNREGISTERED).sort()) {
  const info = UNREGISTERED[name];
  const readers = (info.readBy || []).join(', ');
  const supplied = PALETTES.every((p) => typeof p.tokens[name] === 'string');
  const missing = PALETTES.filter((p) => typeof p.tokens[name] !== 'string').map((p) => p.id);
  if (info.fallback === 'always') {
    check(
      supplied || info.declined,
      `${name} is read by ${readers} with a fallback on every read, so the theme may decline it — ` +
        'but it must say so in DECLINED_READS (tools/refresh-allowlist.mjs) rather than say nothing',
    );
    check(
      !supplied || !info.declined,
      `${name} is BOTH supplied and recorded as declined — one of the two is stale`,
    );
  } else {
    check(
      supplied,
      `${name} is read by ${readers} with no fallback (${info.fallback}) and is not supplied by ` +
        `${missing.join(', ')} — the declaration is dropped, not defaulted`,
    );
  }
}

/* 1c — a bound alias must equal the role it names.
 *
 * lib/client.js derives each unregistered name from a role the palette already
 * defines, so there is no second value to keep in step. Restating that map here
 * would recreate the drift it exists to avoid, so the shipped map is read back
 * and each binding is resolved against the shipped tables. */
const BOUND = client.BOUND_ALIASES || {};
for (const [name, source] of Object.entries(BOUND)) {
  check(
    unregisteredButRead.has(name),
    `lib/client.js binds ${name}, but no installed UI reads it — the allow-list is stale ` +
      'or the binding is obsolete, and an unread binding is a colour nobody asked for',
  );
  for (const { id: themeName, tokens } of PALETTES) {
    check(
      tokens[name] === tokens[source],
      `${themeName}: ${name} is ${tokens[name]} but the role it is bound to, ${source}, is ` +
        `${tokens[source]} — the binding and the palette have drifted apart`,
    );
  }
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

/* Coverage is reported, not required: defining fewer REGISTERED tokens than the
   harness offers is a legitimate way to let the harness default show through.
   Silence about a *gap* is what would be dangerous, so print the number — and
   split it, because `98/89` reads as an overrun until it is spelled out: the
   registered set is what ui-theme declares, and the extra names are the ones a
   shipped UI reads without a fallback (check 1b). */
const registeredUsed = reference.filter((n) => allowed.has(n)).length;
const coverage =
  `${registeredUsed}/${allowed.size} registered` +
  (reference.length > registeredUsed
    ? ` + ${reference.length - registeredUsed} read-but-undeclared`
    : '');

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
  `tokens: ${reference.length} tokens x ${PALETTES.length} palettes (${coverage}), ` +
    `every one read by the shipped UI — against ui-theme ${allowlist.source.version}`,
);
