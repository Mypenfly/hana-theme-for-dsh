'use strict';
/**
 * Does the runtime suite actually catch anything?
 *
 * This is the guard against the failure mode that makes a test suite worse than
 * no suite at all. A test that passes for the wrong reason looks exactly like a
 * test that passes for the right one, and nothing in a green run tells them
 * apart. This repo has already been on the wrong side of that: 91 contrast
 * assertions were passing while an entire colour channel was unreadable.
 *
 * So each mutation below takes the REAL bundle, injects a bug that either
 * actually happened in this project's history or is a plausible next one, runs
 * test/runtime.test.js in a fresh process against the mutated copy, and requires
 * it to fail.
 *
 * Two things make this honest rather than decorative:
 *
 *   1. The injection itself is verified. If the anchor text is not found — say
 *      because someone refactored the line — the mutation is reported as
 *      INAPPROPRIATE and counted as a failure. A mutation that silently did not
 *      apply would "pass" while proving nothing, which is the exact trap this
 *      file exists to close.
 *   2. The expected SECTION is checked in the output, not merely a non-zero
 *      exit. "Something failed" would also be satisfied by an unrelated crash.
 *
 * Usage: node test/selftest.js [--verbose]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUNDLE = path.join(ROOT, 'lib', 'client.js');

/**
 * Each mutation names the behaviour it breaks and the text that is supposed to
 * appear in the failure. `find` must appear EXACTLY once.
 *
 * `marker` defaults to the section header, so most mutations assert "the right
 * section noticed". A mutation may instead name an exact message when the
 * failure legitimately happens earlier — the syntax-palette one is caught by
 * assertLive() before any section runs, which is a stronger outcome, not a
 * weaker one.
 */
const MUTATIONS = [
  {
    id: 'override-layer-rebuilt-every-pass',
    why: 'loses the identity guard that stops overrideTokens() re-emitting theme/change into its own listener — the recursion §5.7 was made of',
    section: '4 —',
    find: '        if (wanted === overrideFor) return;\n',
    replace: '',
  },
  {
    id: 'reapply-not-deferred',
    why: 'runs the palette re-apply synchronously inside the emit, so the stale outer snapshot lands last and wipes it (judgement 20, §5.7④)',
    section: '6 —',
    find: '        ensureTimer = setTimeout(function () {\n          ensureTimer = null;\n          ensurePaletteApplied();\n        }, 0);',
    replace: '        ensureTimer = 0;\n        ensurePaletteApplied();',
  },
  {
    id: 'bind-with-bare-string',
    why: 'the exact §5.7① bug: scope.bind("name") leaves spec.namespace undefined, so the scope matches no describe row and every write goes nowhere — silently, in both directions',
    section: '7 —',
    find: 'scope = binder.bind({ namespace: NS });',
    replace: 'scope = binder.bind(NS);',
  },
  {
    id: 'write-gate-checks-writable-only',
    why: 'the classic form of the durability bug: a host-mode describe view answers writable=true while this namespace is still unserved, so the write lands nowhere and the dirty mark is cleared anyway',
    section: '7 —',
    find: 'return !!snap && snap.mode === "host" && snap.status === "ready" && !!snap.writable;',
    replace: 'return !!snap && !!snap.writable;',
  },
  {
    id: 'durability-warning-removed',
    why: 'silently drops the visible "did not persist" state — item ② of the lesson §5.7 produced, and the half that stops a user setting a switch that keeps forgetting',
    section: '7 —',
    find: 'prefs.durable() ? "（设置已保存）" : "（⚠️ 设置未能写入配置，重启后会丢失）"',
    replace: '"（设置已保存）"',
  },
  {
    id: 'palette-preference-not-pinned',
    why: 'stops re-asserting the preference, so a dark palette renders its LIGHT partner whenever the preference sits on `system` (composeActive picks the half from the active colorScheme)',
    section: '10 —',
    find: '          theme.setTheme(stored);\n        } catch (e) {\n          /* not registered yet; the next theme/change will retry */',
    replace: '          /* mutated: do not pin */\n        } catch (e) {\n          /* not registered yet; the next theme/change will retry */',
  },
  {
    id: 'syntax-palette-never-applied',
    why: 'drops the L1b apply, so code blocks keep colours chosen for a surface this palette does not have',
    section: '3 —',
    /* Caught EARLIER than section 3, by assertLive(): the harness notices the
       plugin stopped doing its core job before any behavioural section runs. */
    marker: 'expected 11 inline syntax properties',
    find: '        applyShiki(claimant);\n',
    replace: '',
  },
  {
    id: 'syntax-palette-never-cleared',
    why: 'leaves eleven inline custom properties on <body> after unload, so the next theme inherits this one’s code colours',
    section: '2 —',
    find: '        body.style.removeProperty(GRAIN_VAR);\n        clearShiki();',
    replace: '        body.style.removeProperty(GRAIN_VAR);',
  },
  {
    id: 'detach-leaves-body-attribute',
    why: 'leaves data-hana-theme set, so the whole typography stylesheet keeps matching after the theme is gone',
    section: '2 —',
    find: '        body.removeAttribute(BODY_ATTR);\n',
    replace: '',
  },
  {
    id: 'scale-out-of-range-not-rejected',
    why: 'writes an invalid factor into the markdown font SHORTHANDS, which makes every one of them invalid — the text then falls back to the inherited size instead of merely not being scaled, and that reads as a layout choice rather than a bug',
    section: '11 —',
    find: 'if (!Number.isFinite(n) || n < SCALE_MIN || n > SCALE_MAX) {',
    replace: 'if (false) {',
  },
  {
    id: 'seal-registered-unconditionally',
    why: 'drops both conditions on the seal — the opt-in switch and the claimed palette — so a brand mark replaces the shipped logo even under the built-in themes, which is the "I installed a theme and it repainted my UI" failure the whole architecture exists to prevent',
    section: '12 —',
    find: '        var want = claimed !== null && prefs.isOn("sealMark");',
    replace: '        var want = true;',
  },
  {
    id: 'seal-not-cleared-on-detach',
    why: 'leaves the sidebar brand-mark registration behind after unload, so the shipped logo never comes back',
    section: '12 —',
    find: '        clearShiki();\n        clearBrandMark();',
    replace: '        clearShiki();',
  },
  {
    id: 'grain-off-by-default-again',
    why: 'flips the paper texture back to off, which is what the theme shipped before the second aesthetic review asked for the paper to read as paper — the grain is the layer that carries it, and it was off',
    section: '11 —',
    marker: 'not on by default',
    find: '      paperTexture: "1",',
    replace: '      paperTexture: "0",',
  },
  {
    id: 'contributes-without-a-claimed-palette',
    why: 'breaks the negative promise the architecture exists for: something is styled even though no hana palette was ever selected — "I installed a theme and it repainted my UI"',
    section: '1 —',
    find: 'return paletteById(stored) === null ? null : stored;',
    replace: 'return paletteById(stored) === null ? "hana-paper" : stored;',
  },

  /* ── the token gates (test/tokens.test.js) ────────────────────────────────
   * These mutate DIFFERENT files, which is why a mutation may name its target
   * and its suite. The P0 finding was that a name a shipped UI reads can be
   * declared by nobody, and the failure is silent: `var()` with no fallback
   * makes the declaration invalid at computed-value time, so the property
   * disappears instead of defaulting. A gate for that has to be shown to fail
   * when the supply is removed, or it is just decoration. */
  {
    id: 'read-name-not-supplied',
    why: 'drops the binding that supplies --dsw-alias-link, the name dsh-client-ui-primitives reads with no fallback — links silently lose their colour',
    suite: 'tokens',
    marker: 'with no fallback',
    find: '      "--dsw-alias-link": "--dsw-alias-brand-text",\n',
    replace: '',
  },
  {
    id: 'binding-points-at-a-role-that-does-not-exist',
    why: 'typos the binding target, so the palette would gain a declaration whose value is `undefined` — a CSS custom property with no value, which is exactly the silent hole the binding exists to close',
    suite: 'tokens',
    marker: 'which that palette does not define',
    find: '"--dsw-alias-separator-primary": "--dsw-alias-border-l1",',
    replace: '"--dsw-alias-separator-primary": "--dsw-alias-border-l1-typo",',
  },
  {
    id: 'declined-read-not-recorded',
    why: 'strips the recorded decline for --dsw-alias-font-mono from the generated allow-list, so the theme neither supplies it nor says why — the exact "nobody noticed" state the ledger exists to prevent',
    suite: 'tokens',
    marker: 'must say so in DECLINED_READS',
    file: 'test/token-allowlist.json',
    /* The anchor starts at the comma so the removal leaves VALID JSON. Without
       it the mutation fails as a parse error, which the suite does report — but
       for the wrong reason, and a mutation caught by a syntax error proves
       nothing about the gate it is supposed to exercise. */
    find: ',\n      "declined": "a FONT channel, not a colour: this theme restyles the reading typography (--dsw-font-markdown-*) and deliberately leaves the UI chrome face alone. Its fallback, `ui-monospace, monospace`, is already the right stack."\n',
    replace: '\n',
  },

  /* ── the ink ramp (test/contrast.test.js #29) ─────────────────────────────
   * Both mutations restore a value this project actually shipped. A gate for
   * "the hierarchy has a shape" is worth nothing unless it fails on the shape
   * that was there before. */
  {
    id: 'caption-tied-to-tertiary',
    why: 'restores 纸本\'s shipped caption, which was byte-identical to its tertiary — two named levels of hierarchy rendered as one colour, and the reason the theme documented five ink stops while shipping four',
    suite: 'ramp',
    marker: 'the SAME COLOUR',
    find: '      "--dsw-alias-label-caption": "#7C7066",\n',
    replace: '      "--dsw-alias-label-caption": "#6B6158",\n',
  },
  {
    id: 'ramp-middle-made-arbitrary',
    why: 'restores 珊瑚\'s shipped secondary, which sat 60% off the even step between its two anchors — the palette read with a visibly different hierarchy from its siblings',
    suite: 'ramp',
    marker: 'is not geometric',
    find: '      "--dsw-alias-label-secondary": "#3C4F60",\n',
    replace: '      "--dsw-alias-label-secondary": "#314153",\n',
  },
  {
    id: 'hover-toward-the-surface',
    why: 'restores 珊瑚\'s shipped hover fill, the only state in the theme that made a primary button WEAKER (12.52:1 -> 10.80:1) exactly when the pointer said it was the target',
    suite: 'ramp',
    marker: 'moves TOWARD the surface',
    find: '      "--dsw-alias-button-primary-hover": "#091E36",\n',
    replace: '      "--dsw-alias-button-primary-hover": "#243A55",\n',
  },
  {
    id: 'layer-3-paints-nothing',
    why: 'restores 青夜\'s shipped bg-layer-3, whose lightness was EXACTLY the ground\'s — a surface read by 21 stylesheets that painted nothing, and the value that broke the nesting model',
    suite: 'ramp',
    marker: 'nesting must go deeper',
    find: '      "--dsw-alias-bg-layer-3": "#303E47",\n',
    replace: '      "--dsw-alias-bg-layer-3": "#3C4A52",\n',
  },
  {
    id: 'presenter-contract-broken',
    why: 'records the one change that would silently undo the whole supply strategy: if dsh-client-ui-layout filtered its write loop by the registered set, all nine names outside the 89 would stop reaching <body>, and every read of them would go back to resolving to nothing',
    suite: 'tokens',
    marker: 'NO LONGER writes every composed token',
    file: 'test/token-allowlist.json',
    find: '    "writesEveryComposedToken": true,',
    replace: '    "writesEveryComposedToken": false,',
  },
  /* ── the surface ladder (test/contrast.test.js #33) ───────────────────────
   * Both restore states this project actually shipped, and each targets a
   * different half of the gate: the distance rule, and the deliberate ties that
   * the distance rule alone would happily break. */
  {
    id: 'surface-ladder-flattened',
    why: 'restores 纸本\'s shipped inline-code chip, which sat 1.003:1 against the ground — not "subtle", absent. A whole class of surface was invisible and nothing measured it',
    suite: 'ramp',
    marker: 'below the 1.02 floor',
    find: '      "--dsw-alias-markdown-inline-code": "#E9E7DE",\n',
    replace: '      "--dsw-alias-markdown-inline-code": "#F3EFE6",\n',
  },
  {
    id: 'mirror-drifted',
    why: 'moves the modal overlay off the raised card it is a second name for, so an overlay and a card stop being the same surface — the drift the mirror assertions exist to catch, and which the surface derivation produced once before they did',
    suite: 'ramp',
    marker: 'has drifted apart',
    find: '      "--dsw-alias-bg-overlay": "#FDF8EF",\n',
    replace: '      "--dsw-alias-bg-overlay": "#F7F2E8",\n',
  },
  /* The next two are not hypotheticals: both restore a state this theme actually
     shipped, and both were invisible until the palette was read against
     HanaAgent's own theme files. */
  {
    id: 'plane-tint-drained',
    why: 'restores 珊瑚\'s shipped card, #EFEEEB — a surface that cleared every contrast floor it was held to (1.081 from the ground) while being a NEUTRAL GREY on a warm cream page. Contrast says nothing about colour, so nothing caught it; it is what made the composer, the menu and 新会话 read as panels from a different theme',
    suite: 'ramp',
    marker: 'grey panel on a',
    find: '      "--dsw-alias-bg-layer-1": "#FFFBF3",\n',
    replace: '      "--dsw-alias-bg-layer-1": "#EFEEEB",\n',
  },
  {
    id: 'inverted-label-not-inverted',
    why: 'restores 珊瑚\'s label-primary-inverted, which shipped EQUAL to label-primary. The official wordmark draws its HARNESS badge as a currentColor plate with these glyphs on it, so the word rendered as a solid ink-blue block — the exact defect the theme\'s user reported',
    suite: 'ramp',
    marker: 'is only 1.00:1',
    find: '      "--dsw-alias-label-primary-inverted": "#FDF6EC",\n',
    replace: '      "--dsw-alias-label-primary-inverted": "#1A3049",\n',
  },
  {
    id: 'process-members-boxed-again',
    why: 'puts the process flow items back into their own cards — fill, border, radius — which is the exact shape the theme shipped and the theme\'s user reported. HanaAgent paints one wash behind the whole region; boxing each item makes every tool call a card and every one-line summary the loudest object on the page',
    suite: 'check',
    marker: 'does not paint var(--hana-wash)',
    find:
      '      "  --hana-wash-pad: 10px;",\n' +
      '      "  margin-inline: calc(-1 * var(--hana-wash-pad));",\n' +
      '      "  padding-inline: var(--hana-wash-pad);",\n' +
      '      "  background: var(--hana-wash);",\n',
    replace:
      '      "  --hana-wash-pad: 10px;",\n' +
      '      "  margin-inline: calc(-1 * var(--hana-wash-pad));",\n' +
      '      "  padding-inline: var(--hana-wash-pad);",\n' +
      '      "  background: var(--dsw-alias-bg-layer-1);",\n' +
      '      "  border: 1px solid var(--dsw-alias-border-l1);",\n' +
      '      "  border-radius: 6px;",\n',
  },
  {
    id: 'geometry-ledger-truncated',
    why: 'makes the committed geometry ledger claim more sites than it carries. Every reader of that ledger gets easier when it shrinks — the seal clamp\'s cost argument ("the loss is one image site, not a family") rests entirely on the counts in this file, and a ledger that lost rows would keep every radius assertion green',
    suite: 'check',
    file: 'test/geometry-sites.json',
    marker: 'against a recorded',
    find: '"sites": 256',
    replace: '"sites": 9999',
  },
  {
    id: 'wash-off-the-ladder',
    why: "puts 斑斓's hover back to .04, which is the shipped state that made the CONTRAST palette the WEAKEST of the four — lighter than 青夜 at every step. Nothing else in the suite compares a palette's wash to its own reference theme, so the drift was invisible until the ladder was derived",
    suite: 'wash',
    marker: 'off the ladder',
    find: '      "--dsw-alias-interactive-bg-hover": "rgba(255,255,255,0.07)",\n',
    replace: '      "--dsw-alias-interactive-bg-hover": "rgba(255,255,255,0.04)",\n',
  },
  {
    id: 'tip-no-longer-a-card',
    why: 'restores the composer\'s old WELL (#E9E7DE in paper). HanaAgent fills its composer with --bg-card, and the three DSH consumers of this token are all cards, so a well here is a hole in the page — the exact defect the user reported as "输入框背景割裂"',
    suite: 'ramp',
    marker: 'has drifted apart',
    find: '      "--dsw-specific-tip": "#FDF8EF",\n',
    replace: '      "--dsw-specific-tip": "#E9E7DE",\n',
  },
  {
    id: 'seal-clamp-loses-specificity',
    why: 'drops the (0,3,1) selector from the 方角 clamp, leaving it at (0,2,1). DSH has three radius rules at (3,0) and the clamp then loses to exactly those three while every other surface squares — a failure that looks like nothing at all, because 266 of 269 sites still work',
    suite: 'check',
    marker: 'does not carry the (0,3,1)',
    /* A template literal, because the text being matched is itself a JS
       concatenation expression in lib/client.js and carries both quote kinds.
       The first attempt built it by string addition and produced a syntax error
       in this file rather than a mutation. */
    find: `      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] *[class],",
`,
    replace: '',
  },
  {
    id: 'seal-corner-shape-dropped',
    why: 'removes lever L1, the only app-wide geometry control DSH exposes. The radius clamp then squares corners that DSH renders with a superellipse SOFTER than a circle, which is the opposite of 方 — and nothing else in the suite would notice, because every radius assertion still passes',
    suite: 'check',
    marker: 'does not set --dsw-corner-shape',
    find: '      "  --dsw-corner-shape: round;",\n',
    replace: '      "",\n',
  },
  {
    id: 'seal-tier-out-of-band',
    why: "moves the medium tier to 8px, past HanaAgent's own scale (sm 2 / md 3 / lg 4 / chat-surface 6). Theming by taste rather than by the reference is the exact drift this project keeps having to undo",
    suite: 'check',
    marker: 'exceed HanaAgent',
    find: '      "  --hana-seal-radius: 3px;",\n',
    replace: '      "  --hana-seal-radius: 8px;",\n',
  },
  {
    id: 'hairline-back-to-1px',
    why: "returns the artifact chip's edge to 1px. HanaAgent legislates --border-width: 0.5px as part of the same rule as the radius scale, so a 1px edge here is the theme's own line being the heaviest on screen. It is also the mutation that exposed a hole in the judgement: the edge is applied through var(), so a literal-px check never saw it and the mutation was NOT CAUGHT until the judgement learned to read the variable too",
    suite: 'check',
    marker: 'are not 0.5px',
    find: '      "  --hana-chip-edge: 0.5px;",\n',
    replace: '      "  --hana-chip-edge: 1px;",\n',
  },
  {
    id: 'wash-transcribed-as-a-literal',
    why: 'replaces the derived color-mix with the coral hex it happens to resolve to. The wash would still look right in 珊瑚 and be wrong in the other three palettes, and the value would have become a second, unmanaged copy of a colour — the drift this project refuses',
    suite: 'check',
    marker: 'does not define --hana-wash',
    find: 'color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent)',
    replace: 'rgba(26,48,73,0.03)',
  },
  {
    id: 'glass-flattened-into-a-plate',
    why: "puts 纸本's floating chip back to the opaque card it shipped as. DSH declares its toolbar surface at 50% alpha and HanaAgent's --bg-glass is the same idea, so an opaque value here is this theme overriding a translucent surface with a sticker — and nothing at rest shows it, because a plate only differs from the page when there is something behind it",
    suite: 'check',
    marker: 'an opaque colour',
    find: '      "--dsw-alias-button-floating-fill": "rgba(253,248,239,0.92)",\n',
    replace: '      "--dsw-alias-button-floating-fill": "#FDF8EF",\n',
  },
  {
    id: 'glass-hue-from-nowhere',
    why: "gives 纸本's chip DSH's own toolbar grey (#545557 at 92%) instead of the palette's paper. Every alpha assertion still passes — it IS translucent — and the chip becomes a cold grey sticker on a warm cream page, which is the failure a threshold on alpha alone cannot see",
    suite: 'ramp',
    marker: 'not a colour of its own',
    find: '      "--dsw-alias-button-floating-fill": "rgba(253,248,239,0.92)",\n',
    replace: '      "--dsw-alias-button-floating-fill": "rgba(84,85,87,0.92)",\n',
  },
  {
    id: 'glass-hover-as-an-alpha-step',
    why: "carries DSH's own .50 -> .60 step to .92, which clamps to 1.00. The hover then moves the chip by about 1/255 over paper: a hover that is written, plausible, and invisible. The reference lays an ink wash over the chip instead, and HOVER_FLOOR is what tells the two apart",
    suite: 'glass',
    marker: 'against a floor of',
    find: '      "--dsw-alias-button-floating-hover": "rgba(245,240,231,0.92)",\n',
    replace: '      "--dsw-alias-button-floating-hover": "#FDF8EF",\n',
  },
  {
    id: 'glass-off-the-reference-alpha',
    why: "drops 斑斓's glass from .94 to .92, i.e. to the value every NON-contrast theme uses. Only the two contrast variants reach .94 in HanaAgent, and that is the whole point of them — less bleed-through — so this silently makes 斑斓 the same glass as 青夜",
    suite: 'glass',
    marker: 'off the reference',
    find: '      "--dsw-alias-button-floating-fill": "rgba(38,52,61,0.94)",\n',
    replace: '      "--dsw-alias-button-floating-fill": "rgba(38,52,61,0.92)",\n',
  },
  {
    id: 'focus-ring-back-to-the-harness-colour',
    why: "re-points 珊瑚's ring at its brand plate, which IS the coral vermilion #F37E63 — and that measures 2.45:1 on its ground, below the 3:1 WCAG 1.4.11 asks of a non-text indicator. It is also the exact 橙框 the theme's user reported, and the reason the reference's own coral theme rings in ink blue instead",
    suite: 'focus',
    marker: 'draws its focus ring in --accent',
    find:
      '      "body[" + BODY_ATTR + "=\'coral\'][" + FOCUS_ATTR + "=\'accent\'] {",\n' +
      '      "  --hana-ring: var(--dsw-alias-button-primary-fill);",\n',
    replace:
      '      "body[" + BODY_ATTR + "=\'coral\'][" + FOCUS_ATTR + "=\'accent\'] {",\n' +
      '      "  --hana-ring: var(--dsw-alias-brand-primary);",\n',
  },
  {
    id: 'focus-loses-the-descendant-selector',
    why: "drops `:focus-visible *`. Exactly one DSH rule rings a DESCENDANT of the focused element (._6nu5Ca_memberButton:focus-visible ._6nu5Ca_memberLabelWrap) and `:focus-visible` alone never matches it, so that ring keeps the harness's colour and the app is left with two focus colours — one of which is the orange box. The replacement is the PLAIN selector rather than nothing: deleting the line outright leaves the rule with a trailing comma and no opening brace, so the mutation would 'fail' as unbalanced braces and prove nothing",
    suite: 'check',
    marker: 'does not carry the descendant selector',
    find: '      "body[" + BODY_ATTR + "][" + FOCUS_ATTR + "=\'accent\'] :focus-visible * {",\n',
    replace: '      "body[" + BODY_ATTR + "][" + FOCUS_ATTR + "=\'accent\'] :focus-visible {",\n',
  },
  {
    id: 'focus-writes-the-outline-shorthand',
    why: "swaps outline-color for the outline shorthand. outline-color is inert while outline-style is none, which is exactly what keeps this block from inventing an indicator on the 32 DSH rules that deliberately have none; the shorthand gives every one of them a ring, and the app gains focus boxes it never had",
    suite: 'check',
    marker: 'writes the outline SHORTHAND',
    find: '      "  outline-color: var(--hana-ring);",\n',
    replace: '      "  outline: 1px solid var(--hana-ring);",\n',
  },
  {
    id: 'paper-texture-not-vetoed-in-dark',
    why: "drops the scheme veto from the texture attribute, so 青夜 and 斑斓 carry the paper grain. HanaAgent does not restyle its grain for dark themes, it does not apply it at all (paperTextureBlockedThemeIds), and the user-visible half is that the settings switch is disabled rather than silently off",
    suite: 'runtime',
    marker: 'still carried the paper grain',
    find: 'prefs.isOn("paperTexture") && textureAllowed(claimant)',
    replace: 'prefs.isOn("paperTexture")',
  },
  {
    id: 'texture-veto-writes-the-preference',
    why: "does what a careless implementation does instead of withholding the attribute: writes 0 into the stored preference (guarded on the current value, so it converges rather than re-entering reconcile forever -- the unguarded version is a runaway, which the harness reports as INCONCLUSIVE and which is its own lesson). The grain DOES stop, which is why this looks like it works -- and the user's choice is destroyed, so it never comes back when they return to a light palette, which is the exact promise the panel's hint makes",
    suite: 'runtime',
    marker: 'did not come back when a light palette was reclaimed',
    find: 'body.setAttribute(TEXTURE_ATTR, prefs.isOn("paperTexture") && textureAllowed(claimant) ? "on" : "off");',
    replace:
      'body.setAttribute(TEXTURE_ATTR, prefs.isOn("paperTexture") && textureAllowed(claimant) ? "on" : "off");\n' +
      '        if (!textureAllowed(claimant) && prefs.isOn("paperTexture")) prefs.set("paperTexture", "0");',
  },
  {
    id: 'grain-svg-shape-changed-silently',
    why: 'changes the grain\'s frequency without touching the record of it. The comment above the SVG explains that the layer is luminance-neutral BECAUSE fractalNoise is symmetric about 0.5, and a grain that changed shape under a comment that did not is the silent kind',
    suite: 'grain',
    marker: 'but this tool records',
    find: "baseFrequency='0.64'",
    replace: "baseFrequency='0.38'",
  },
  {
    id: 'grain-blend-made-normal',
    why: 'swaps soft-light for a normal composite. That is the reference\'s own mechanism, and porting it WITHOUT the compensation plate that goes with it is exactly the mistake the three-layer analysis exists to prevent: the grain starts darkening the page, at which point layer ③ stops being unnecessary',
    suite: 'grain',
    marker: 'does not use mix-blend-mode: soft-light',
    find: 'mix-blend-mode: soft-light',
    replace: 'mix-blend-mode: normal',
  },
  {
    id: 'grain-noise-no-longer-symmetric',
    why: 'swaps fractalNoise for turbulence. Both are valid feTurbulence types and both look like noise, but only fractalNoise is distributed symmetrically about 0.5 -- turbulence is |noise|, which sits below mid-grey, so under soft-light the layer would DARKEN the page. The comment above the SVG names this as one of the two facts neutrality rests on; this mutation proves the other one is checked too',
    suite: 'grain',
    marker: 'not fractalNoise',
    find: "type='fractalNoise'",
    replace: "type='turbulence'",
  },
  {
    id: 'grain-rule-no-longer-palette-keyed',
    why: 'unkeys the grain rule from the palettes. The client writes data-hana-theme and data-hana-texture in the same pass one after the other, so an unkeyed rule renders a dark palette with grain if the pass throws between them -- which is the whole reason the veto is expressed twice',
    suite: 'grain',
    marker: 'is not keyed on a palette',
    find:
      '      "body[" + BODY_ATTR + "=\'paper\'][" + TEXTURE_ATTR + "=\'on\']::after,",\n' +
      '      "body[" + BODY_ATTR + "=\'coral\'][" + TEXTURE_ATTR + "=\'on\']::after {",\n',
    replace: '      "body[" + BODY_ATTR + "][" + TEXTURE_ATTR + "=\'on\']::after {",\n',
  },
  {
    id: 'tracking-register-data-tracks-too',
    why: "gives the DATA cells the label tracking, collapsing the register's pair into one value. It changes almost nothing on screen today -- which is the point: the pair exists so that 'data is not tracked' is an invariant rather than a sentence, and a mutation has to be able to break it",
    suite: 'check',
    marker: 'do not take the explicit zero',
    find: "      \"body[\" + BODY_ATTR + \"] [data-chat-flow-kind='assistant-step'] td {\",\n      \"  letter-spacing: var(--hana-track-data);\",\n",
    replace: "      \"body[\" + BODY_ATTR + \"] [data-chat-flow-kind='assistant-step'] td {\",\n      \"  letter-spacing: var(--hana-track-label);\",\n",
  },
  {
    id: 'link-rule-back-to-text-decoration',
    why: "returns to the treatment this theme shipped, which the recorded reason defended on grounds that turned out to be a category error: colouring a border that already exists does not narrow the hit area. The mutation is worth keeping because that wrong reason is still in the design document's history, and this is what makes the correction stick",
    suite: 'check',
    marker: 'does not clear text-decoration',
    find: '      "  text-decoration: none;",\n      "  border-bottom: 1px solid var(--hana-link-rule);",\n',
    replace:
      '      "  text-decoration: underline;",\n' +
      '      "  text-decoration-color: var(--hana-link-rule);",\n',
  },
  {
    id: 'link-hover-keeps-the-harness-underline',
    why: "drops the hover's text-decoration: none. The harness's own hover is `text-decoration: underline`, so a link would then draw the resting border AND the hover underline -- two lines under one word, which reads as a bug and is invisible until somebody hovers",
    suite: 'check',
    marker: 'hover does not clear text-decoration',
    find: '      "  text-decoration: none;",\n      "  border-bottom-color: var(--hana-link-rule-hover);",\n',
    replace: '      "  border-bottom-color: var(--hana-link-rule-hover);",\n',
  },
  {
    id: 'link-rule-writes-the-border-shorthand',
    why: "swaps border-bottom for the `border` shorthand -- the one-character tidier edit. It resets all four sides, including the three zero-alpha borders the harness uses as the anchor's hit area, so the click target really does shrink. This is the mistake the previous comment claimed it was avoiding while doing something else entirely",
    suite: 'check',
    marker: 'writes the `border` SHORTHAND',
    find: '      "  border-bottom: 1px solid var(--hana-link-rule);",\n',
    replace: '      "  border: 1px solid var(--hana-link-rule);",\n',
  },
  {
    id: 'link-rule-faded-to-nothing',
    why: "drops the rule's alpha from 35% to 4%. Every text assertion in the suite stays green -- the link ink is unchanged -- and the second channel that #32 leans on is gone: the underline stops being perceptible, leaving two indistinguishable inks and nothing else",
    suite: 'ramp',
    marker: 'below the 1.4 floor',
    find: 'in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);\",\n      \"  --hana-link-rule-hover',
    replace: 'in srgb, var(--dsw-alias-state-business-primary) 4%, transparent);\",\n      \"  --hana-link-rule-hover',
  },
  {
    id: 'palette-keyed-rule-names-a-ghost-palette',
    why: "misspells the palette attribute value ('corral'). The first version of judgement 8 tested the literal prefix `body[data-hana-theme]`, which would have waved this through while rejecting a correct palette-keyed rule — the rule never matches, and 珊瑚 silently falls back to the generic ring, i.e. to the coral it was keyed there to avoid",
    suite: 'check',
    marker: 'not scoped to body[data-hana-theme]',
    find: '      "body[" + BODY_ATTR + "=\'coral\'][" + FOCUS_ATTR + "=\'accent\'] {",\n',
    replace: '      "body[" + BODY_ATTR + "=\'corral\'][" + FOCUS_ATTR + "=\'accent\'] {",\n',
  },
];

const verbose = process.argv.includes('--verbose');
const SUITES = {
  runtime: path.join(__dirname, 'runtime.test.js'),
  tokens: path.join(__dirname, 'tokens.test.js'),
  ramp: path.join(__dirname, 'contrast.test.js'),
  check: path.join(__dirname, 'check.js'),
  /* A suite may carry its own arguments, because a derivation tool proves itself
     with --check rather than by being pointed at a file. */
  wash: [path.join(ROOT, 'tools', 'derive-wash.mjs'), '--check'],
  glass: [path.join(ROOT, 'tools', 'derive-glass.mjs'), '--check'],
  focus: [path.join(ROOT, 'tools', 'derive-focus.mjs'), '--check'],
  grain: [path.join(ROOT, 'tools', 'derive-grain.mjs'), '--check'],
};
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hana-selftest-'));

/** Original text of every file a mutation targets, read once. */
const sources = new Map();
const sourceOf = (rel) => {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!sources.has(abs)) sources.set(abs, fs.readFileSync(abs, 'utf8'));
  return sources.get(abs);
};

const suiteNames = [...new Set(MUTATIONS.map((m) => m.suite || 'runtime'))];
console.log(
  `selftest: ${MUTATIONS.length} mutations against ` +
    suiteNames.map((s) => {
      const entry = SUITES[s];
      return 'test/' + path.basename(Array.isArray(entry) ? entry[0] : entry);
    }).join(' + ') + '\n',
);

let missed = 0;
let inapplicable = 0;

for (const m of MUTATIONS) {
  const target = m.file || BUNDLE;
  const original = sourceOf(target);
  const occurrences = original.split(m.find).length - 1;

  /* Guard one: a mutation that did not apply proves nothing. */
  if (occurrences !== 1) {
    inapplicable += 1;
    console.error(`INAPPLICABLE  ${m.id}`);
    console.error(`              anchor found ${occurrences} time(s), expected exactly 1 — the code moved; update this mutation`);
    if (verbose) console.error(`              anchor: ${JSON.stringify(m.find.slice(0, 90))}`);
    continue;
  }

  /* The mutated copy is written to the scratch dir, never over the real file,
     and HANA_BUNDLE points the suite at it. A mutation whose target is not the
     bundle is written to a sibling copy so its path can be handed over too. */
  const mutated = original.replace(m.find, m.replace);
  const file = path.join(scratch, `${m.id}${path.extname(target) || '.js'}`);
  fs.writeFileSync(file, mutated);

  const suite = SUITES[m.suite || 'runtime'];
  const started = Date.now();
  const argv = Array.isArray(suite) ? suite : [suite];
  const run = spawnSync(process.execPath, argv, {
    encoding: 'utf8',
    env: {
      ...process.env,
      /* The bundle travels through HANA_BUNDLE (both loaders honour it) and a
         generated data file through HANA_ALLOWLIST (test/tokens.test.js honours
         it). Either way the real file is never written. */
      /* Route by what the file IS, not by "not the bundle". A generated data
         file used to be assumed to be the allow-list, so a mutation aimed at the
         geometry ledger was handed to a variable test/check.js never read and
         the gate silently proved nothing. */
      ...(target === BUNDLE
        ? { HANA_BUNDLE: file }
        : path.basename(target) === 'geometry-sites.json'
          ? { HANA_GEOMETRY: file }
          : { HANA_ALLOWLIST: file }),
    },
    /* A mutated bundle can run away rather than fail politely — removing the
       override-identity guard produces unbounded re-layering, which churns for
       thirteen seconds before the stack finally gives. A HANG IS A FAILURE, so
       the timeout is short and a timeout counts as caught. */
    timeout: 6000,
  });
  const elapsed = Date.now() - started;

  /* A subprocess that could not start is an environment problem, not a caught
     bug, and counting it as "caught" would be the very vacuity this file exists
     to prevent. Say so plainly and stop. */
  if (run.error && run.error.code !== 'ETIMEDOUT') {
    console.error(`\nCANNOT SPAWN ${process.execPath}: ${run.error.message}`);
    console.error('This self-test runs the runtime suite in a child process. Verify by hand with:');
    console.error('  HANA_BUNDLE=<mutated-copy> node test/runtime.test.js');
    fs.rmSync(scratch, { recursive: true, force: true });
    process.exit(2);
  }

  const timedOut = !!(run.error && run.error.code === 'ETIMEDOUT');
  const output = `${run.stdout || ''}${run.stderr || ''}`;

  /* Guard two: it must fail, and it must fail in the RIGHT place. A non-zero
     exit alone would also be satisfied by an unrelated crash — and a timeout
     alone would be satisfied by a slow machine, so a timeout must ALSO show the
     expected marker before it counts. */
  const failed = run.status !== 0 || timedOut;
  const expected = m.marker || m.section;
  const rightSection = output.includes(expected);

  if (failed && rightSection) {
    console.log(`ok            ${m.id}${timedOut ? '  (runaway, killed at 6s)' : ''}`);
    if (verbose) {
      console.log(`              caught by ${JSON.stringify(expected)}  in ${elapsed}ms`);
    }
  } else if (timedOut) {
    console.log(`INCONCLUSIVE  ${m.id} — timed out without reaching "${expected}"`);
    missed += 1;
  } else if (failed) {
    console.log(`WRONG PLACE   ${m.id} (suite failed, but without "${expected}")`);
    if (verbose) console.log(output.split('\n').filter((l) => l.includes('✗')).slice(0, 4).join('\n'));
    missed += 1;
  } else {
    console.log(`NOT CAUGHT    ${m.id} — the suite passed against a known-broken bundle`);
    missed += 1;
  }

  fs.unlinkSync(file);
}

/* The baseline: the unmutated sources must pass every suite involved, or "it
   failed" means nothing. */
let baselineBad = 0;
for (const name of suiteNames) {
  const entry = SUITES[name];
  const run = spawnSync(process.execPath, Array.isArray(entry) ? entry : [entry], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (run.status !== 0) {
    console.error(`\nBASELINE FAILED — the unmutated sources do not pass the "${name}" suite:`);
    console.error(`${run.stdout || ''}${run.stderr || ''}`);
    baselineBad += 1;
  }
}
if (baselineBad) missed += 1;
else console.log(`\nbaseline      unmutated sources pass ${suiteNames.length} suite(s)`);

fs.rmSync(scratch, { recursive: true, force: true });

console.log(
  `\nselftest: ${MUTATIONS.length - missed - inapplicable}/${MUTATIONS.length} mutations caught` +
    (inapplicable ? `, ${inapplicable} inapplicable` : ''),
);

if (missed || inapplicable) {
  console.error(
    '\nThe runtime suite is not trustworthy until every mutation is caught. A mutation that is\n' +
      'not caught is a behaviour nothing is guarding; one that is INAPPLICABLE is a guard that\n' +
      'was silently disconnected by a refactor.',
  );
  process.exit(1);
}
