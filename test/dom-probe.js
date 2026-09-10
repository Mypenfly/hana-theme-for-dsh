#!/usr/bin/env node
'use strict';
/**
 * Phase 0 — DOM probe.
 *
 * Phase 1 is deliberately token-only: it changes colours and the reading font,
 * both of which flow through documented custom properties and need no knowledge
 * of the DOM. Phase 2 adds element-level markdown rules (prose line-height, a
 * centred h1, a bordered link, task-list and blockquote treatment), and those DO
 * need two facts that cannot be read out of a stylesheet without a browser:
 *
 *   1. Is markdown rendered as a descendant of
 *      [data-chat-flow-kind='assistant-step']? The spec's element rules are
 *      anchored there so they cannot reach the user's own message text or a
 *      tool-call card. If markdown lives somewhere else, those rules silently
 *      never match — the theme looks "almost right", which is the worst kind of
 *      wrong.
 *   2. Does anything between body and the chat column create a stacking context
 *      (isolation / z-index / transform)? That decides whether a decorative
 *      texture layer can be painted on body::before and still be visible, or
 *      must be re-anchored.
 *
 * This script answers both. It is read-only: it queries and prints, and changes
 * nothing.
 *
 * USAGE
 *   node test/dom-probe.js --print     # print the snippet to paste (default)
 *   node test/dom-probe.js             # same, plus nothing else
 *
 * Then: open the DSH Web GUI, open DevTools, paste, and copy the JSON to
 * test/probe-result.json.
 */

const PROBE = `(function probeHanaDom() {
  var out = { dshVersion: null, probedAt: new Date().toISOString() };

  // 1) Which flow kinds exist, and does the assistant step carry markdown?
  out.flowKinds = Array.prototype.map.call(
    document.querySelectorAll("[data-chat-flow-kind]"),
    function (el) { return el.getAttribute("data-chat-flow-kind"); }
  ).filter(function (v, i, a) { return a.indexOf(v) === i; });

  var step = document.querySelector("[data-chat-flow-kind='assistant-step']");
  out.assistantStepFound = !!step;
  out.markdownInsideAssistantStep = null;
  if (step) {
    out.assistantStepHasH1 = !!step.querySelector("h1");
    out.assistantStepHasPre = !!step.querySelector("pre");
    out.assistantStepHasCodeBlock = !!step.querySelector(".md-code-block");
    out.assistantStepHasWideTable = !!step.querySelector(".md-table-wide");
    out.markdownInsideAssistantStep =
      !!step.querySelector(".md-code-block") || !!step.querySelector("p");
  }

  // 2) The markdown ROOT's real class name. Recorded only to confirm it is a
  //    build hash and therefore unusable as a selector hook.
  var code = document.querySelector(".md-code-block");
  if (code) {
    var root = code.closest("[class*='_markdown']");
    out.markdownRootClass = root ? root.className : null;
    out.markdownRootTag = root ? root.tagName : null;
    out.markdownRootIsDescendantOfAssistantStep =
      !!(root && step && step.contains(root));
  } else {
    out.markdownRootClass = null;
  }

  // 3) Stacking: can a body-level ::before layer be seen?
  var root0 = document.getElementById("root");
  function stack(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    return {
      position: cs.position,
      zIndex: cs.zIndex,
      isolation: cs.isolation,
      transform: cs.transform === "none" ? "none" : "set",
      filter: cs.filter === "none" ? "none" : "set",
      opacity: cs.opacity,
      background: cs.backgroundColor
    };
  }
  out.rootStack = stack(root0);
  out.bodyStack = stack(document.body);

  // 4) Contrast-relevant baseline: the custom properties this theme overrides.
  var keys = [
    "--dsw-alias-bg-base",
    "--dsw-alias-label-primary",
    "--dsw-alias-state-business-primary",
    "--dsw-alias-tooltip-bg",
    "--dsw-alias-toast-bg",
    "--dsh-content-font-size",
    "--dsh-content-font-delta",
    "--dsh-content-font-size-secondary",
    "--ds-font-family-code",
    "--dsw-font-family",
    "--dsw-font-markdown-base",
    "--dsw-font-markdown-h1",
    "--dsh-scrollbar-width"
  ];
  out.tokens = keys.reduce(function (acc, k) {
    acc[k] = getComputedStyle(document.body).getPropertyValue(k).trim();
    return acc;
  }, {});

  // 5) Does the serif override mechanism work at all? Reads the markdown root's
  //    resolved font-family, which is what the theme is trying to change.
  if (code) {
    var mdRoot = code.closest("[class*='_markdown']");
    if (mdRoot) out.markdownResolvedFontFamily = getComputedStyle(mdRoot).fontFamily;
  }

  console.log("%c[hana-probe] copy the JSON below into test/probe-result.json",
    "font-weight:bold;color:#537D96");
  console.log(JSON.stringify(out, null, 2));
  window.__hanaProbe = out;
  return out;
})();`;

const argv = process.argv.slice(2);
if (argv.includes('--print') || argv.length === 0) {
  process.stdout.write(PROBE + '\n');
  if (!argv.includes('--quiet')) {
    process.stderr.write(
      '\nPaste the snippet above into the DSH Web GUI DevTools console, then save\n' +
        'the printed JSON as test/probe-result.json.\n',
    );
  }
} else {
  process.stderr.write('usage: node test/dom-probe.js [--print]\n');
  process.exit(2);
}
