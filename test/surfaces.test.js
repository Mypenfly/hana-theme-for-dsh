'use strict';
/**
 * The colour-surface coverage gate.
 *
 * `test/contrast.test.js` measures a list of pairs. This test guards the
 * QUESTION BEHIND that list: is the list allowed to be hand-picked at all?
 *
 * It was not, and the cost was concrete. The suite asserted 19 pairs, reported
 * 91 passing assertions, and never once looked at the code block's syntax
 * colours — even though this theme is what chooses the code block's surface.
 * Measured in a real engine (test/verify/build-shiki-probe.mjs), 4 of the 5
 * token colours a sample exercises were below AA in three of four palettes,
 * worst 2.88:1. Nothing was broken about the assertions; the LIST was the bug.
 *
 * `test/color-surfaces.json` is generated from the installed harness by
 * tools/scan-color-surfaces.mjs and records, for every custom property that
 * carries a colour, what this theme does about it — supply it, leave it to the
 * harness, or declare it unreachable. This test is what makes that ledger
 * load-bearing:
 *
 *   - a surface nobody classified fails the build;
 *   - a surface claimed as `theme` must ACTUALLY be provided, so the ledger
 *     cannot drift into fiction;
 *   - the provided set must match the plugin's own tables exactly.
 *
 * It runs offline, so `nix flake check` can enforce it: refreshing the ledger
 * needs an installed harness (same constraint as the token allow-list), but
 * validating it does not.
 */

const fs = require('fs');
const path = require('path');

const { loadClient } = require('./load-client');

const ROOT = path.join(__dirname, '..');
const LEDGER = path.join(__dirname, 'color-surfaces.json');
const ALLOWLIST = path.join(__dirname, 'token-allowlist.json');

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

if (!fs.existsSync(LEDGER)) {
  console.error(
    'surfaces: test/color-surfaces.json is missing.\n' +
      '  Generate it on a machine with DSH installed:\n' +
      '    node tools/scan-color-surfaces.mjs\n',
  );
  process.exit(1);
}

const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
const client = loadClient().exports;

const entries = ledger.entries || [];
const byName = new Map(entries.map((e) => [e.name, e]));

/* 1 — every surface carries a decision. This is the assertion that turns a new
   harness release into a deliberate choice instead of a silent omission. */
const unclassified = entries.filter((e) => e.class === 'UNCLASSIFIED').map((e) => e.name);
check(
  unclassified.length === 0,
  `${unclassified.length} colour surface(s) have no decision recorded — a DSH upgrade introduced ` +
    `them and nothing measured them: ${unclassified.join(', ')}. ` +
    'Classify them in tools/scan-color-surfaces.mjs, then re-run the scan.',
);

/* 2 — every entry states a class and a reason. A bare class with no reason is
   how a "decision" degrades into a shrug. */
const CLASSES = new Set(['theme', 'derived', 'harness', 'boot']);
for (const e of entries) {
  check(CLASSES.has(e.class), `${e.name} has unknown class "${e.class}"`);
  check(
    typeof e.why === 'string' && e.why.length >= 10,
    `${e.name} is classified "${e.class}" with no real reason — the ledger must say WHY`,
  );
  check(
    typeof e.seenAt === 'string' && e.seenAt.length > 0,
    `${e.name} does not record where it was found`,
  );
}

/* 3 — a surface claimed as `theme` must actually be supplied. Without this the
   ledger could claim coverage the plugin does not have, which is worse than
   having no ledger: it would make the gap look closed. */
const registered = new Set(allowlist.tokens || []);
const syntax = new Set(allowlist.syntaxTokens || []);
const families = entries.filter((e) => e.name.endsWith('*')).map((e) => e.name.slice(0, -1));

const providedBy = (name) => {
  if (registered.has(name)) return 'a registered colour token';
  if (syntax.has(name)) return 'an inline syntax-palette name';
  for (const prefix of families) if (name.startsWith(prefix)) return `the ${prefix}* family`;
  return null;
};

const claimed = entries.filter((e) => e.class === 'theme');
const hollow = claimed.filter((e) => providedBy(e.name) === null).map((e) => e.name);
check(
  hollow.length === 0,
  `${hollow.length} surface(s) are claimed as supplied by this theme but the plugin provides ` +
    `none of them: ${hollow.join(', ')}`,
);

/* 4 — and the reverse: everything the plugin supplies must be in the ledger, or
   the ledger under-reports what the theme touches. */
const claimedNames = new Set(claimed.map((e) => e.name));
const undeclared = [...registered, ...syntax].filter((n) => !claimedNames.has(n));
check(
  undeclared.length === 0,
  `${undeclared.length} name(s) the plugin supplies are absent from the ledger: ` +
    `${undeclared.slice(0, 8).join(', ')}${undeclared.length > 8 ? ' …' : ''}`,
);

/* 5 — the syntax channel must be fully represented. It is the one that was
   missed, so it gets its own explicit count rather than relying on the
   set-level checks above. */
const syntaxInLedger = entries.filter((e) => syntax.has(e.name));
check(
  syntaxInLedger.length === syntax.size && syntax.size > 0,
  `the ledger covers ${syntaxInLedger.length} of ${syntax.size} syntax names — the channel that ` +
    'was previously unmeasured must be fully accounted for',
);
for (const name of syntax) {
  check(
    byName.has(name) && byName.get(name).class === 'theme',
    `${name} is supplied by this theme but the ledger does not say so`,
  );
}

/* 6 — the advertised counts must match the entries, so the header cannot go
   stale while the body is regenerated. */
const counted = entries.reduce((acc, e) => {
  acc[e.class] = (acc[e.class] || 0) + 1;
  return acc;
}, {});
check(
  JSON.stringify(counted) === JSON.stringify(ledger.counts || {}),
  `the ledger's counts ${JSON.stringify(ledger.counts)} do not match its entries ${JSON.stringify(counted)}`,
);
check(
  (ledger.source && ledger.source.surfaces) === entries.length,
  `the ledger advertises ${ledger.source && ledger.source.surfaces} surfaces but holds ${entries.length}`,
);

if (failures.length) {
  console.error(`surfaces: ${failures.length} FAILED\n`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}

console.log(
  `surfaces: ${entries.length} colour surfaces accounted for ` +
    `(${counted.theme} supplied, ${counted.harness} harness-owned, ${counted.boot} unreachable)`,
);
