/**
 * VERIFICATION (not a gate) — does DSH's syntax highlighting really travel
 * through the `--shiki-*` custom properties, and does hana leave them alone?
 *
 * This replicates the harness's highlighter exactly:
 *
 *   dsh-client-ui-primitives/lib/index.js
 *     import { createCssVariablesTheme, createHighlighterCoreSync } from "shiki/core";
 *     const cssVariablesTheme = createCssVariablesTheme({
 *       name: "css-variables", variablePrefix: "--shiki-", fontStyle: true });
 *     createHighlighterCoreSync({ themes: [cssVariablesTheme], langs: LANGS, engine: regexEngine })
 *
 * and prints the markup it produces, so the claim "every token colour is a
 * --shiki-* reference" is read off real output instead of inferred from a
 * comment. Run it with the shiki that ships inside an installed DSH profile:
 *
 *   node --experimental-vm-modules test/verify/shiki-mechanism.mjs
 */

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

/* Resolve shiki out of an installed DSH profile rather than vendoring it. */
function resolveShikiRoot() {
  const candidates = [
    process.env.DSH_PROFILE_MODULES,
    path.join(os.homedir(), '.dsh', 'profiles', 'node_modules'),
  ].filter(Boolean);
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'shiki', 'package.json'))) return root;
  }
  throw new Error('shiki not found; set DSH_PROFILE_MODULES to a node_modules holding shiki');
}

const ROOT = resolveShikiRoot();
const require = createRequire(path.join(ROOT, 'noop.cjs'));
const load = (spec) => import(pathToFileURL(require.resolve(spec)).href);

const { createCssVariablesTheme, createHighlighterCoreSync } = await load('shiki/core');
const { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } = await load(
  'shiki/engine/javascript',
);
const langTs = (await load('@shikijs/langs/typescript')).default;

/* Byte-for-byte the harness's theme: same name, same prefix, same fontStyle. */
const cssVariablesTheme = createCssVariablesTheme({
  name: 'css-variables',
  variablePrefix: '--shiki-',
  fontStyle: true,
});

const highlighter = createHighlighterCoreSync({
  themes: [cssVariablesTheme],
  langs: [langTs],
  engine: createJavaScriptRegexEngine({ regexConstructor: defaultJavaScriptRegexConstructor }),
});

const SAMPLE = `// a comment
const greeting: string = "hello";
function shout(text: string): string {
  return text.toUpperCase() + "!";
}
interface Point { x: number; y: number }
export default shout(greeting);`;

const html = highlighter.codeToHtml(SAMPLE, {
  lang: 'typescript',
  theme: 'css-variables',
});

console.log('── exact markup emitted by the harness highlighter ──\n');
console.log(html);
console.log('\n── every colour-ish property carried by the markup ──\n');

const vars = [...html.matchAll(/var\((--shiki-[a-z-]+)\)/g)].map((m) => m[1]);
const uniq = [...new Set(vars)].sort();
console.log('distinct --shiki-* variables referenced:', uniq.length);
for (const v of uniq) console.log('  ' + v);

/* Any literal colour in the markup would escape the custom-property channel
   entirely — that is the thing this script exists to rule out. */
const literals = [
  ...html.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g),
].map((m) => m[0]);
console.log('\nliteral colours in the markup:', literals.length ? literals.join(', ') : '(none)');

const styleAttrs = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
console.log('inline style attributes:', styleAttrs.length);
for (const s of [...new Set(styleAttrs)].slice(0, 12)) console.log('  ' + s);

console.log(
  '\nVERDICT: ' +
    (literals.length === 0 && uniq.length > 0
      ? 'every token colour is a var(--shiki-*) reference — the custom-property ' +
        'channel is the only colour channel in code blocks.'
      : 'UNEXPECTED — literals or no variables found; the model needs revising.'),
);
