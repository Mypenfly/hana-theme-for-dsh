window.__ModuleLoader__.load({
  id: "hana-theme-for-dsh",
  // `require` is passed through by the module loader; it is only consulted as a
  // fallback when a global `React` is absent, so a loader that omits it changes
  // nothing. Typed as a guard rather than assumed, because the standalone
  // bundle path and the dynamic-runner path disagree about its presence.
  factory: function (require) {
    "use strict";

    var module = { exports: {} };
    var exports = module.exports;

    var NAME = "hana-theme-for-dsh";
    var NS = "hana-theme-for-dsh";
    var BODY_ATTR = "data-hana-theme";
    var SERIF_CLASS = "hana-serif";
    var SERIF_SCALE_VAR = "--hana-serif-scale";
    var GRAIN_VAR = "--hana-grain-opacity";
    var TEXTURE_ATTR = "data-hana-texture";
    var SHAPE_ATTR = "data-hana-shape";
    /* Range of the reading-size compensation, in percent. The default matches
       the stylesheet's literal so the first paint and the setting agree. */
    var SCALE_MIN = 100;
    var SCALE_MAX = 140;

    /* Mirrors lib/index.js FIELD_DEFAULTS. test/check.js asserts the two
       halves agree, because a divergence here means the switch shown in the
       settings page is not the switch that is actually stored. */
    var FIELD_DEFAULTS = {
      enabled: "1",
      serif: "1",
      serifScale: "115",
      paperTexture: "0",
      grainOpacity: "32",
      shape: "soft",
      palette: ""
    };

    /* Derived from the default above, never restated: this value and the
       stylesheet's literal are the only two places the factor appears, and
       check.js asserts they agree. Reading it before FIELD_DEFAULTS is
       assigned (var hoisting makes that a silent `undefined`, then a crash on
       .serifScale) is exactly the mistake this ordering exists to prevent. */
    var SCALE_DEFAULT = Number(FIELD_DEFAULTS.serifScale);
    var GRAIN_MIN = 0;
    var GRAIN_MAX = 60;
    var GRAIN_DEFAULT = Number(FIELD_DEFAULTS.grainOpacity);

    /* ═══════════════════════════════════════════════════════════════════
       L1 · COLOUR LAYER — hana-paper (light)

       Source: HanaAgent `new-warm-paper`. Paper ground #F5EFE4, five ink
       stops, one seal-blue accent #537D96.

       The palette is NOT a copy of HanaAgent's. Its原 values fail WCAG AA in
       nine measured places (link 3.87:1, white-on-accent 4.43:1 on light;
       muted text 4.33:1, link 3.80:1, white-on-accent 2.41:1, danger 2.61:1 on
       dark). Every corrected value here keeps HanaAgent's hue and saturation
       and moves lightness only, by 0.0005 HSL steps, until it clears 4.5:1.
       test/contrast.test.js re-derives all of these from this table, so the
       numbers cannot drift away from the documentation.

       Token names are exactly the 89 custom properties the harness declares on
       `body` for its own palettes; refresh that list with
       `npm run refresh:allowlist` after a DSH upgrade. A name outside it is not
       a wrong colour, it is a silent no-op.
       ═══════════════════════════════════════════════════════════════════ */
    var PAPER = {
      /* surfaces */
      "--dsw-alias-bg-base": "#F5EFE4",
      "--dsw-alias-bg-layer-1": "#FBF7EE",
      "--dsw-alias-bg-layer-2": "#EFE8DB",
      "--dsw-alias-bg-layer-3": "#EBE5DA",
      "--dsw-alias-bg-overlay": "#FBF7EE",
      "--dsw-alias-bg-skeleton": "#EBE5DA",
      "--dsw-alias-bg-module-platform": "#EFE8DB",
      "--dsw-alias-bg-multi-select": "#EFE8DB",
      /* scrims: ink-based, so they darken rather than grey the paper */
      "--dsw-alias-bg-mask-1": "rgba(42,38,34,0.20)",
      "--dsw-alias-bg-mask-2": "rgba(42,38,34,0.12)",
      "--dsw-alias-bg-mask-3": "rgba(42,38,34,0.48)",
      "--dsw-alias-bg-mask-drop": "rgba(42,38,34,0.06)",
      "--dsw-alias-bg-mask-photo": "rgba(20,18,16,0.88)",

      /* structure */
      "--dsw-alias-border-l1": "#D8CFBE",
      "--dsw-alias-border-l2": "#C2BAAB",
      "--dsw-alias-border-l2-darkmode-thin": "#D8CFBE",
      "--dsw-alias-border-l3": "#C2BAAB",
      "--dsw-alias-border-l4": "#B0A794",
      "--dsw-alias-border-inverted": "rgba(255,255,255,0.10)",
      "--dsw-alias-border-inverted2": "rgba(255,255,255,0.16)",
      /* NOTE: --dsw-alias-separator-primary, --dsw-alias-line-secondary and
         --dsw-alias-label-error are deliberately ABSENT. They appear in some
         third-party themes and even in the live token report, but ui-theme
         0.1.2-rc.1 neither declares nor consumes them, so setting them would
         have been three silent no-ops. The separator role is served by
         border-l1 and the error role by state-error-primary, both of which the
         harness does read. Verified with:
           grep -c 'var(--dsw-alias-separator-primary)' <frontend css>  ->  0
         See test/tokens.test.js, which fails on any name outside the
         generated allow-list instead of leaving this to memory. */

      /* ink, five stops */
      "--dsw-alias-label-primary": "#2A2622",
      "--dsw-alias-label-secondary": "#4A433C",
      "--dsw-alias-label-tertiary": "#6B6158",
      "--dsw-alias-label-caption": "#6B6158",
      "--dsw-alias-label-dimmed": "#8F867B",
      "--dsw-alias-label-primary-dimmed": "#4A433C",
      "--dsw-alias-label-primary-bluish": "#4C7289",
      "--dsw-alias-label-primary-foreground": "#FFFFFF",
      "--dsw-alias-label-primary-inverted": "#FBF7EE",

      /* accent: one seal-blue, never a second colour */
      "--dsw-alias-brand-primary": "#537D96",
      "--dsw-alias-brand-primary-invert": "#2A2622",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#537D96",
      "--dsw-alias-brand-text": "#4C7289",
      "--dsw-alias-state-business-primary": "#4C7289",
      "--dsw-alias-state-business-tertiary": "rgba(83,125,150,0.08)",
      "--dsw-alias-button-primary-fill": "#527B94",
      "--dsw-alias-button-primary-hover": "#3F6179",
      "--dsw-alias-button-primary-dimmed": "#A9BCC6",
      "--dsw-alias-button-info-fill": "#537D96",
      "--dsw-alias-button-info-hover": "#3F6179",
      "--dsw-alias-button-contrast-fill": "#2A2622",
      "--dsw-alias-button-elevated-fill": "#FBF7EE",
      "--dsw-alias-button-floating-fill": "#FBF7EE",
      "--dsw-alias-button-floating-hover": "#EFE8DB",
      "--dsw-alias-button-ghost-active-fill": "rgba(42,38,34,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(42,38,34,0.12)",
      "--dsw-alias-button-ghost-active-border": "#D8CFBE",
      "--dsw-alias-button-tool-bar-fill": "#FBF7EE",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(251,247,238,0)",
      "--dsw-alias-button-tool-bar-hover": "#EFE8DB",

      /* interaction: ink-based alphas, never white on paper */
      "--dsw-alias-interactive-bg-hover": "rgba(42,38,34,0.04)",
      "--dsw-alias-interactive-bg-active": "rgba(42,38,34,0.08)",
      "--dsw-alias-interactive-bg-hover-solid": "#E5DFD4",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(83,125,150,0.10)",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(139,44,31,0.08)",

      /* restrained status ink */
      "--dsw-alias-state-success-primary": "#4A6B4A",
      "--dsw-alias-state-success-secondary": "#5C7F5C",
      "--dsw-alias-state-success-tertiary": "rgba(74,107,74,0.08)",
      "--dsw-alias-state-error-primary": "#8B2C1F",
      "--dsw-alias-state-error-secondary": "#A3483B",
      "--dsw-alias-state-warn-primary": "#A67139",
      "--dsw-alias-state-warn-label": "#8A5E2E",
      "--dsw-alias-state-warn-secondary": "#C08B52",
      "--dsw-alias-state-warn-tertiary": "rgba(166,113,57,0.10)",

      /* component slots */
      "--dsw-specific-bubble": "#F2EEE5",
      "--dsw-specific-bubble-highlight": "#EBE5DA",
      "--dsw-specific-input-major": "#FBF7EE",
      "--dsw-specific-login-input": "#FBF7EE",
      "--dsw-specific-selector": "#EBE5DA",
      "--dsw-specific-menu": "#FBF7EE",
      "--dsw-specific-tip": "#F5F1E8",
      "--dsw-specific-sidebar-fill": "#EFE8DB",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(42,38,34,0.05)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(42,38,34,0.08)",
      /* In a paper style "selected" is denser ink, not more colour. */
      "--dsw-specific-sidebar-nav-item-active-accent": "#2A2622",

      /* markdown + code */
      "--dsw-alias-markdown-inline-code": "#F3EFE6",
      "--dsw-alias-markdown-code-block": "#F5F1E8",
      "--dsw-alias-markdown-code-block-banner": "#EBE5DA",
      "--dsw-alias-markdown-code-segment-selected": "#EBE5DA",
      "--dsw-alias-markdown-code-segment-unselected": "#F5F1E8",
      "--dsw-alias-markdown-citation": "rgba(83,125,150,0.10)",
      "--dsw-alias-markdown-tag": "rgba(83,125,150,0.12)",
      "--dsw-alias-markdown-placeholder": "#8F867B",

      "--dsw-alias-scrollbar-bg-l1": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-bg-l2": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-hover-l1": "#E5DFD4",
      "--dsw-alias-scrollbar-hover-l2": "#D8CFBE",

      /* An inverted plate, dark in BOTH modes on purpose: Tooltip.module.css
         paints its text with a hardcoded near-white
         (--dsw-static-neutral-bluish-00) that no theme token can reach, so a
         light tooltip here would render white-on-white. */
      "--dsw-alias-tooltip-bg": "#2A2622",
      "--dsw-alias-toast-bg": "#2A2622"
    };

    /* ═══════════════════════════════════════════════════════════════════
       L1 · COLOUR LAYER — hana-midnight (dark)

       Source: HanaAgent `midnight`. Deep blue-teal ground #3B4A54, warm rose
       accent #C99AAF.

       Two polarities invert relative to hana-paper, and both are deliberate:
         · translucent overlays become WHITE-based, because on a dark ground
           "more emphasis" means lighter, not darker;
         · label-primary-foreground becomes a DARK ink rather than white,
           because this palette's accent is a light rose — white on #CB9FB3
           measures 2.41:1, which is exactly the HanaAgent value that fails.
       Never pair one mode's foreground with the other mode's fill.
       ═══════════════════════════════════════════════════════════════════ */
    var MIDNIGHT = {
      "--dsw-alias-bg-base": "#3B4A54",
      "--dsw-alias-bg-layer-1": "#445560",
      "--dsw-alias-bg-layer-2": "#34424B",
      "--dsw-alias-bg-layer-3": "#3C4A52",
      "--dsw-alias-bg-overlay": "#445560",
      "--dsw-alias-bg-skeleton": "#3C4A52",
      "--dsw-alias-bg-module-platform": "#34424B",
      "--dsw-alias-bg-multi-select": "#34424B",
      "--dsw-alias-bg-mask-1": "rgba(0,0,0,0.32)",
      "--dsw-alias-bg-mask-2": "rgba(0,0,0,0.20)",
      "--dsw-alias-bg-mask-3": "rgba(0,0,0,0.55)",
      "--dsw-alias-bg-mask-drop": "rgba(15,20,24,0.55)",
      "--dsw-alias-bg-mask-photo": "rgba(0,0,0,0.88)",

      "--dsw-alias-border-l1": "#4D525D",
      "--dsw-alias-border-l2": "#4F5C65",
      "--dsw-alias-border-l2-darkmode-thin": "#4A4F59",
      "--dsw-alias-border-l3": "#556069",
      "--dsw-alias-border-l4": "#5F6B74",
      "--dsw-alias-border-inverted": "rgba(255,255,255,0.12)",
      "--dsw-alias-border-inverted2": "rgba(255,255,255,0.18)",

      "--dsw-alias-label-primary": "#E1EAF0",
      "--dsw-alias-label-secondary": "#B7C5CE",
      "--dsw-alias-label-tertiary": "#A7B9C3",
      "--dsw-alias-label-caption": "#A7B9C3",
      "--dsw-alias-label-dimmed": "#7D8E99",
      "--dsw-alias-label-primary-dimmed": "#B7C5CE",
      "--dsw-alias-label-primary-bluish": "#D2ACBD",
      "--dsw-alias-label-primary-foreground": "#26343D",
      "--dsw-alias-label-primary-inverted": "#26343D",

      "--dsw-alias-brand-primary": "#C99AAF",
      "--dsw-alias-brand-primary-invert": "#26343D",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#C99AAF",
      "--dsw-alias-brand-text": "#D2ACBD",
      "--dsw-alias-state-business-primary": "#D2ACBD",
      "--dsw-alias-state-business-tertiary": "rgba(201,154,175,0.11)",
      "--dsw-alias-button-primary-fill": "#CB9FB3",
      "--dsw-alias-button-primary-hover": "#D8AFC0",
      "--dsw-alias-button-primary-dimmed": "#6E5A64",
      "--dsw-alias-button-info-fill": "#C99AAF",
      "--dsw-alias-button-info-hover": "#D8AFC0",
      "--dsw-alias-button-contrast-fill": "#DCE6EC",
      "--dsw-alias-button-elevated-fill": "#445560",
      "--dsw-alias-button-floating-fill": "#445560",
      "--dsw-alias-button-floating-hover": "#4F5C65",
      "--dsw-alias-button-ghost-active-fill": "rgba(255,255,255,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(255,255,255,0.12)",
      "--dsw-alias-button-ghost-active-border": "#4F5C65",
      "--dsw-alias-button-tool-bar-fill": "#445560",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(68,85,96,0)",
      "--dsw-alias-button-tool-bar-hover": "#4F5C65",

      "--dsw-alias-interactive-bg-hover": "rgba(255,255,255,0.05)",
      "--dsw-alias-interactive-bg-active": "rgba(255,255,255,0.08)",
      "--dsw-alias-interactive-bg-hover-solid": "#4F5C65",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(201,154,175,0.12)",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(221,169,169,0.12)",

      "--dsw-alias-state-success-primary": "#8CC790",
      "--dsw-alias-state-success-secondary": "#A3D6A6",
      "--dsw-alias-state-success-tertiary": "rgba(140,199,144,0.12)",
      "--dsw-alias-state-error-primary": "#DDA9A9",
      "--dsw-alias-state-error-secondary": "#EAB2A0",
      "--dsw-alias-state-warn-primary": "#E3C08A",
      "--dsw-alias-state-warn-label": "#E3C08A",
      "--dsw-alias-state-warn-secondary": "#EFD3A6",
      "--dsw-alias-state-warn-tertiary": "rgba(227,192,138,0.12)",

      "--dsw-specific-bubble": "#4A5A65",
      "--dsw-specific-bubble-highlight": "#4F5C65",
      "--dsw-specific-input-major": "#445560",
      "--dsw-specific-login-input": "#445560",
      "--dsw-specific-selector": "#4F5C65",
      "--dsw-specific-menu": "#445560",
      "--dsw-specific-tip": "#4A5A65",
      "--dsw-specific-sidebar-fill": "#34424B",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(255,255,255,0.05)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(255,255,255,0.08)",
      "--dsw-specific-sidebar-nav-item-active-accent": "#E1EAF0",

      "--dsw-alias-markdown-inline-code": "#4D5E68",
      "--dsw-alias-markdown-code-block": "#4A5A65",
      "--dsw-alias-markdown-code-block-banner": "#4F5C65",
      "--dsw-alias-markdown-code-segment-selected": "#556069",
      "--dsw-alias-markdown-code-segment-unselected": "#4A5A65",
      "--dsw-alias-markdown-citation": "rgba(201,154,175,0.12)",
      "--dsw-alias-markdown-tag": "rgba(201,154,175,0.14)",
      "--dsw-alias-markdown-placeholder": "#7D8E99",

      "--dsw-alias-scrollbar-bg-l1": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-bg-l2": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-hover-l1": "#556069",
      "--dsw-alias-scrollbar-hover-l2": "#5F6B74",

      /* Same inverted-plate rule as hana-paper: stays dark for the hardcoded
         near-white tooltip text. hana-midnight's NEAR-WHITE plate is
         button-contrast-fill, which pairs with the dark
         label-primary-inverted instead. */
      "--dsw-alias-tooltip-bg": "#25313A",
      "--dsw-alias-toast-bg": "#DCE6EC"
    };

    /* ═══════════════════════════════════════════════════════════════════
       L1 · hana-coral (light) — ported from HanaAgent's own `coral` theme

       HanaAgent's comment names the five colours it was extracted from:
       和纸白 (washi white), 墨蓝 (ink blue), 珊瑚朱 (coral vermilion),
       古金 (antique gold) and 灰青 (grey-cyan).

       The device that makes this palette work — and the reason it is worth
       porting rather than inventing — is WHERE the saturation lives. In
       HanaAgent's source the vivid coral #F37E63 appears only as
       rgba(...) over borders, note borders, mood backgrounds and tints; it is
       never a text colour. That is why a palette this warm can still be read:
       the eye gets its colour from lines and surfaces, while every glyph stays
       ink. The same split is kept here, with two deliberate adaptations:

         · Links need a text-safe warm stop, so state-business-primary is the
           coral hue carried down in lightness to clear AA (5.59:1) rather than
           the raw #F37E63, which measures 2.45:1 as text.
         · Coral finally becomes a SOLID in one place -- button-contrast-fill --
           where the near-black ink sits on it at 5.10:1. That is the faithful
           reading of "a surface colour": it is allowed to be a surface.

       Three of HanaAgent's own values did not clear AA on its own ground and
       were corrected by the same reproducible rule used elsewhere: hold hue and
       saturation, step lightness in 0.0005 until the pair passes.
         --text-muted  #727F89 (3.83:1) -> #657079
         --green       #6E8C7A (3.44:1) -> #5E7768
       ═══════════════════════════════════════════════════════════════════ */
    var CORAL = {
      "--dsw-alias-bg-base": "#FDF6EC",
      "--dsw-alias-bg-layer-1": "#FFFBF3",
      "--dsw-alias-bg-layer-2": "#FCF1E4",
      "--dsw-alias-bg-layer-3": "#F2ECE4",
      "--dsw-alias-bg-overlay": "#FFFBF3",
      "--dsw-alias-bg-skeleton": "#F2ECE4",
      "--dsw-alias-bg-module-platform": "#FCF1E4",
      "--dsw-alias-bg-multi-select": "#FCF1E4",
      "--dsw-alias-bg-mask-1": "rgba(26,48,73,0.20)",
      "--dsw-alias-bg-mask-2": "rgba(26,48,73,0.12)",
      "--dsw-alias-bg-mask-3": "rgba(26,48,73,0.48)",
      "--dsw-alias-bg-mask-drop": "rgba(26,48,73,0.06)",
      "--dsw-alias-bg-mask-photo": "rgba(20,26,33,0.88)",
      "--dsw-alias-border-l1": "rgba(243,126,99,0.30)",
      "--dsw-alias-border-l2": "rgba(243,126,99,0.48)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(243,126,99,0.30)",
      "--dsw-alias-border-l3": "rgba(243,126,99,0.48)",
      "--dsw-alias-border-l4": "rgba(243,126,99,0.65)",
      "--dsw-alias-border-inverted": "rgba(255,255,255,0.10)",
      "--dsw-alias-border-inverted2": "rgba(255,255,255,0.16)",
      "--dsw-alias-label-primary": "#1A3049",
      "--dsw-alias-label-secondary": "#314153",
      "--dsw-alias-label-tertiary": "#657079",
      "--dsw-alias-label-caption": "#657079",
      "--dsw-alias-label-dimmed": "#8A939B",
      "--dsw-alias-label-primary-dimmed": "#314153",
      "--dsw-alias-label-primary-bluish": "#1A3049",
      "--dsw-alias-label-primary-foreground": "#FFFFFF",
      "--dsw-alias-label-primary-inverted": "#1A3049",
      "--dsw-alias-brand-primary": "#F37E63",
      "--dsw-alias-brand-primary-invert": "#1A3049",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#F37E63",
      "--dsw-alias-brand-text": "#A8432A",
      "--dsw-alias-state-business-primary": "#A8432A",
      "--dsw-alias-state-business-tertiary": "rgba(243,126,99,0.10)",
      "--dsw-alias-button-primary-fill": "#1A3049",
      "--dsw-alias-button-primary-hover": "#243A55",
      "--dsw-alias-button-primary-dimmed": "#C2A99C",
      "--dsw-alias-button-info-fill": "#A8432A",
      "--dsw-alias-button-info-hover": "#8E3620",
      "--dsw-alias-button-contrast-fill": "#F37E63",
      "--dsw-alias-button-elevated-fill": "#FFFBF3",
      "--dsw-alias-button-floating-fill": "#FFFBF3",
      "--dsw-alias-button-floating-hover": "#FCF1E4",
      "--dsw-alias-button-ghost-active-fill": "rgba(26,48,73,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(26,48,73,0.12)",
      "--dsw-alias-button-ghost-active-border": "rgba(243,126,99,0.30)",
      "--dsw-alias-button-tool-bar-fill": "#FFFBF3",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(255,251,243,0)",
      "--dsw-alias-button-tool-bar-hover": "#FCF1E4",
      "--dsw-alias-interactive-bg-hover": "rgba(26,48,73,0.04)",
      "--dsw-alias-interactive-bg-active": "rgba(26,48,73,0.08)",
      "--dsw-alias-interactive-bg-hover-solid": "#F2ECE4",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(243,126,99,0.10)",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(163,72,59,0.08)",
      "--dsw-alias-state-success-primary": "#5E7768",
      "--dsw-alias-state-success-secondary": "#587A66",
      "--dsw-alias-state-success-tertiary": "rgba(110,140,122,0.10)",
      "--dsw-alias-state-error-primary": "#A3483B",
      "--dsw-alias-state-error-secondary": "#B85A4A",
      "--dsw-alias-state-warn-primary": "#8A6A33",
      "--dsw-alias-state-warn-label": "#7A5C28",
      "--dsw-alias-state-warn-secondary": "#A78550",
      "--dsw-alias-state-warn-tertiary": "rgba(166,128,60,0.10)",
      "--dsw-specific-bubble": "#FBF4EA",
      "--dsw-specific-bubble-highlight": "#F2ECE4",
      "--dsw-specific-input-major": "#FFFBF3",
      "--dsw-specific-login-input": "#FFFBF3",
      "--dsw-specific-selector": "#FCF1E4",
      "--dsw-specific-menu": "#FFFBF3",
      "--dsw-specific-tip": "#FFF6E6",
      "--dsw-specific-sidebar-fill": "#FCF1E4",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(26,48,73,0.05)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(26,48,73,0.08)",
      "--dsw-specific-sidebar-nav-item-active-accent": "#F37E63",
      "--dsw-alias-markdown-inline-code": "#F5EFE8",
      "--dsw-alias-markdown-code-block": "#F7EFE6",
      "--dsw-alias-markdown-code-block-banner": "#F2ECE4",
      "--dsw-alias-markdown-code-segment-selected": "#F2ECE4",
      "--dsw-alias-markdown-code-segment-unselected": "#F7EFE6",
      "--dsw-alias-markdown-citation": "rgba(243,126,99,0.10)",
      "--dsw-alias-markdown-tag": "rgba(243,126,99,0.14)",
      "--dsw-alias-markdown-placeholder": "#8A939B",
      "--dsw-alias-scrollbar-bg-l1": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-bg-l2": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-hover-l1": "#F2ECE4",
      "--dsw-alias-scrollbar-hover-l2": "rgba(243,126,99,0.30)",
      "--dsw-alias-tooltip-bg": "#1A3049",
      "--dsw-alias-toast-bg": "#F37E63",
    };

    /* ═══════════════════════════════════════════════════════════════════
       L1 · hana-midnight-vivid (dark) — ported from HanaAgent `midnight-contrast`

       The rich counterpart to hana-midnight: rose accent, mint, peach and a
       soft red on a deeper blue-teal ground. Its most useful feature is that
       HanaAgent gave it a SEPARATE link colour (--link: #B9E2FF, a light blue)
       distinct from the rose accent -- two hues doing two jobs, which is
       exactly the richness the paper palettes get from their coral.

       Every measured pair passes as shipped; the palette needed no correction.
       ═══════════════════════════════════════════════════════════════════ */
    var VIVID = {
      "--dsw-alias-bg-base": "#26343D",
      "--dsw-alias-bg-layer-1": "#30414B",
      "--dsw-alias-bg-layer-2": "#202C34",
      "--dsw-alias-bg-layer-3": "#2E3C46",
      "--dsw-alias-bg-overlay": "#30414B",
      "--dsw-alias-bg-skeleton": "#2E3C46",
      "--dsw-alias-bg-module-platform": "#202C34",
      "--dsw-alias-bg-multi-select": "#202C34",
      "--dsw-alias-bg-mask-1": "rgba(0,0,0,0.34)",
      "--dsw-alias-bg-mask-2": "rgba(0,0,0,0.20)",
      "--dsw-alias-bg-mask-3": "rgba(0,0,0,0.55)",
      "--dsw-alias-bg-mask-drop": "rgba(12,18,22,0.55)",
      "--dsw-alias-bg-mask-photo": "rgba(0,0,0,0.88)",
      "--dsw-alias-border-l1": "rgba(230,177,196,0.26)",
      "--dsw-alias-border-l2": "rgba(230,177,196,0.36)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(230,177,196,0.22)",
      "--dsw-alias-border-l3": "rgba(230,177,196,0.44)",
      "--dsw-alias-border-l4": "rgba(230,177,196,0.56)",
      "--dsw-alias-border-inverted": "rgba(255,255,255,0.12)",
      "--dsw-alias-border-inverted2": "rgba(255,255,255,0.18)",
      "--dsw-alias-label-primary": "#F0F6FA",
      "--dsw-alias-label-secondary": "#D3E0E8",
      "--dsw-alias-label-tertiary": "#B7C8D3",
      "--dsw-alias-label-caption": "#B7C8D3",
      "--dsw-alias-label-dimmed": "#8FA3B0",
      "--dsw-alias-label-primary-dimmed": "#D3E0E8",
      "--dsw-alias-label-primary-bluish": "#B9E2FF",
      "--dsw-alias-label-primary-foreground": "#26343D",
      "--dsw-alias-label-primary-inverted": "#26343D",
      "--dsw-alias-brand-primary": "#E6B1C4",
      "--dsw-alias-brand-primary-invert": "#26343D",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#E6B1C4",
      "--dsw-alias-brand-text": "#B9E2FF",
      "--dsw-alias-state-business-primary": "#B9E2FF",
      "--dsw-alias-state-business-tertiary": "rgba(185,226,255,0.12)",
      "--dsw-alias-button-primary-fill": "#E6B1C4",
      "--dsw-alias-button-primary-hover": "#F0C4D3",
      "--dsw-alias-button-primary-dimmed": "#6B5A62",
      "--dsw-alias-button-info-fill": "#B9E2FF",
      "--dsw-alias-button-info-hover": "#D7F0FF",
      "--dsw-alias-button-contrast-fill": "#F1BEAD",
      "--dsw-alias-button-elevated-fill": "#30414B",
      "--dsw-alias-button-floating-fill": "#30414B",
      "--dsw-alias-button-floating-hover": "#3A4B56",
      "--dsw-alias-button-ghost-active-fill": "rgba(255,255,255,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(255,255,255,0.12)",
      "--dsw-alias-button-ghost-active-border": "rgba(230,177,196,0.36)",
      "--dsw-alias-button-tool-bar-fill": "#30414B",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(48,65,75,0)",
      "--dsw-alias-button-tool-bar-hover": "#3A4B56",
      "--dsw-alias-interactive-bg-hover": "rgba(255,255,255,0.04)",
      "--dsw-alias-interactive-bg-active": "rgba(255,255,255,0.07)",
      "--dsw-alias-interactive-bg-hover-solid": "#3A4B56",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(230,177,196,0.14)",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(226,139,139,0.14)",
      "--dsw-alias-state-success-primary": "#A8DDAA",
      "--dsw-alias-state-success-secondary": "#C2E8C4",
      "--dsw-alias-state-success-tertiary": "rgba(168,221,170,0.12)",
      "--dsw-alias-state-error-primary": "#E28B8B",
      "--dsw-alias-state-error-secondary": "#EDA3A3",
      "--dsw-alias-state-warn-primary": "#F0D08A",
      "--dsw-alias-state-warn-label": "#F0D08A",
      "--dsw-alias-state-warn-secondary": "#F5E0B0",
      "--dsw-alias-state-warn-tertiary": "rgba(240,208,138,0.12)",
      "--dsw-specific-bubble": "#354852",
      "--dsw-specific-bubble-highlight": "#3A4B56",
      "--dsw-specific-input-major": "#30414B",
      "--dsw-specific-login-input": "#30414B",
      "--dsw-specific-selector": "#3A4B56",
      "--dsw-specific-menu": "#30414B",
      "--dsw-specific-tip": "#354852",
      "--dsw-specific-sidebar-fill": "#202C34",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(255,255,255,0.04)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(255,255,255,0.07)",
      "--dsw-specific-sidebar-nav-item-active-accent": "#E6B1C4",
      "--dsw-alias-markdown-inline-code": "#2E3F49",
      "--dsw-alias-markdown-code-block": "#2E3F49",
      "--dsw-alias-markdown-code-block-banner": "#3A4B56",
      "--dsw-alias-markdown-code-segment-selected": "#3A4B56",
      "--dsw-alias-markdown-code-segment-unselected": "#2E3F49",
      "--dsw-alias-markdown-citation": "rgba(185,226,255,0.12)",
      "--dsw-alias-markdown-tag": "rgba(230,177,196,0.16)",
      "--dsw-alias-markdown-placeholder": "#8FA3B0",
      "--dsw-alias-scrollbar-bg-l1": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-bg-l2": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-hover-l1": "#3A4B56",
      "--dsw-alias-scrollbar-hover-l2": "rgba(230,177,196,0.36)",
      "--dsw-alias-tooltip-bg": "#1A242B",
      "--dsw-alias-toast-bg": "#F1BEAD",
    };

    /* ═══════════════════════════════════════════════════════════════════
       L1b · SYNTAX HIGHLIGHTING — the surface nobody measured

       DSH highlights code with shiki's `css-variables` theme:

         createCssVariablesTheme({ name: 'css-variables',
                                   variablePrefix: '--shiki-', fontStyle: true })
         // "All token colors resolve through `--shiki-*` custom properties."

       so every coloured span in a code block carries
       `style="color:var(--shiki-token-X)"` — verified by running the
       harness's own highlighter (test/verify/shiki-mechanism.mjs): 39 inline
       style attributes, 7 distinct variables, zero literal colours.

       The harness declares all eleven on `:root`, and overrides the nine
       token-* on `body[data-ds-dark-theme]`. The theme, meanwhile, chooses
       the code block's SURFACE (`--dsw-alias-markdown-code-block`) per
       PALETTE. Those two choices are independent, so nothing ever checked
       them against each other — and measured in-engine
       (test/verify/build-shiki-probe.mjs) 4 of the 5 token colours a sample
       exercises landed below AA in three of the four palettes, worst 2.88:1.

       There is a second, sharper reason these must be pinned here rather than
       left to the harness's colorScheme switch. `body[data-ds-dark-theme]` is
       set from the ACTIVE theme's colorScheme, and the palette arrives on an
       override layer that can paint a dark surface while the preference is
       still the built-in `light` — the exact window ensurePaletteApplied()
       closes on the next tick. In that window the LIGHT syntax palette lands
       on a DARK code surface: measured, 5 of 5 below AA, worst 1.13:1.
       Writing these inline on body makes the syntax colours follow the
       palette the user actually chose, so the window cannot render wrong.

       Derived by tools/derive-shiki.mjs, not hand-picked: hue and saturation
       are the harness's own (token roles must stay recognisable), and one
       shared factor moves every token the same proportional distance toward
       the extreme its surface calls for. A shared factor is what keeps the
       palette a palette — lifting each colour to exactly 4.5:1 was tried and
       rejected, because it collapses every token onto one luminance and makes
       comments as loud as keywords. The transform is asymptotic, so it can
       never clip to pure black or white and silently drop a hue.
       All 36 pairs (9 tokens × 4 palettes) now clear AA; worst is 4.50:1.
       ═══════════════════════════════════════════════════════════════════ */
    var SHIKI_PAPER = {
      "--shiki-foreground": "#2A2622",
      "--shiki-background": "#F5F1E8",
      "--shiki-token-constant": "#1663A8",
      "--shiki-token-string": "#257C35",
      "--shiki-token-string-expression": "#226C31",
      "--shiki-token-comment": "#686F77",
      "--shiki-token-keyword": "#AD2353",
      "--shiki-token-parameter": "#B64609",
      "--shiki-token-function": "#4A25B8",
      "--shiki-token-punctuation": "#393F44",
      "--shiki-token-link": "#145998"
    };

    var SHIKI_MIDNIGHT = {
      "--shiki-foreground": "#E1EAF0",
      "--shiki-background": "#4A5A65",
      "--shiki-token-constant": "#A2D3FB",
      "--shiki-token-string": "#B0ECBA",
      "--shiki-token-string-expression": "#C3F3CA",
      "--shiki-token-comment": "#D4D8DC",
      "--shiki-token-keyword": "#FCCEDE",
      "--shiki-token-parameter": "#FFD2A2",
      "--shiki-token-function": "#D6C8FD",
      "--shiki-token-punctuation": "#E5E8EC",
      "--shiki-token-link": "#B6DEFD"
    };

    var SHIKI_CORAL = {
      "--shiki-foreground": "#1A3049",
      "--shiki-background": "#F7EFE6",
      "--shiki-token-constant": "#1662A6",
      "--shiki-token-string": "#257B35",
      "--shiki-token-string-expression": "#216B30",
      "--shiki-token-comment": "#676E76",
      "--shiki-token-keyword": "#AC2352",
      "--shiki-token-parameter": "#B44509",
      "--shiki-token-function": "#4925B7",
      "--shiki-token-punctuation": "#393E44",
      "--shiki-token-link": "#135897"
    };

    var SHIKI_MIDNIGHT_VIVID = {
      "--shiki-foreground": "#F0F6FA",
      "--shiki-background": "#2E3F49",
      "--shiki-token-constant": "#50ADF7",
      "--shiki-token-string": "#6CDC7E",
      "--shiki-token-string-expression": "#8EE99C",
      "--shiki-token-comment": "#AEB6BE",
      "--shiki-token-keyword": "#FAA4C2",
      "--shiki-token-parameter": "#FFAB50",
      "--shiki-token-function": "#B299FC",
      "--shiki-token-punctuation": "#CFD5DB",
      "--shiki-token-link": "#77C1FC"
    };

    /* Keyed by palette id so activation is one lookup, and the name list is
       taken from a real table rather than restated — a typo in a second copy
       would be a silent no-op, which is the whole failure class this file is
       built against. test/tokens.test.js asserts all four cover the same
       names and that the set matches the harness's declared set. */
    var SHIKI_BY_PALETTE = {
      "hana-paper": SHIKI_PAPER,
      "hana-midnight": SHIKI_MIDNIGHT,
      "hana-coral": SHIKI_CORAL,
      "hana-midnight-vivid": SHIKI_MIDNIGHT_VIVID
    };
    var SHIKI_NAMES = Object.keys(SHIKI_PAPER);

    /* ═══════════════════════════════════════════════════════════════════
       L2 + L3 · STRUCTURE AND TYPOGRAPHY

       Colours never appear here: they travel exclusively through
       theme.register(), because DSH's ThemePresenter writes registered tokens
       as INLINE styles on <body>, and inline beats any stylesheet rule. A
       theme that declares --dsw-alias-* in its own <style> is silently
       overridden the moment another token-writing plugin (StyleVault, another
       skin) is installed. Declaring none of them makes that class of conflict
       impossible rather than merely unlikely.

       The reverse is also true and is what this sheet exploits: a custom
       property that is NOT one of the 89 registered colour tokens can never be
       written inline, so for those a stylesheet is not just adequate, it is
       the only channel. The markdown font shorthands below are exactly that
       case.

       Everything that references a --dsw-* variable is declared on `body`.
       A custom property declared on :root whose value references a variable
       that is only defined on body computes to the guaranteed-invalid value
       and the whole declaration is dropped.
       ═══════════════════════════════════════════════════════════════════ */
    /* Every palette this plugin offers, in picker order. Activation,
       registration, the body attribute, the settings row and the status line all
       derive from this list, so adding a palette is a table plus one row here --
       there is no second place that enumerates ids and can drift out of step. */
    var PALETTE_DEFS = [
      { id: "hana-paper", scheme: "light", name: "纸本", tokens: PAPER },
      { id: "hana-midnight", scheme: "dark", name: "青夜", tokens: MIDNIGHT },
      { id: "hana-coral", scheme: "light", name: "珊瑚", tokens: CORAL },
      { id: "hana-midnight-vivid", scheme: "dark", name: "斑斓", tokens: VIVID }
    ];

    function paletteById(id) {
      for (var i = 0; i < PALETTE_DEFS.length; i += 1) {
        if (PALETTE_DEFS[i].id === id) return PALETTE_DEFS[i];
      }
      return null;
    }

    var CSS = [
      "/* ---- L2: structure tokens (literal values only) ---- */",
      "body[" + BODY_ATTR + "] {",
      "  --hana-font-serif: Georgia, 'Times New Roman', 'Source Han Serif SC',",
      "    'Noto Serif CJK SC', 'Songti SC', 'STSong', 'Noto Serif', 'SimSun', serif;",
      "  /* HanaAgent draws a 4px bar where DSH ships 8px. Safe to declare here:",
      "     --dsh-scrollbar-width is NOT one of the registered colour tokens, so",
      "     the presenter never writes it inline and specificity decides --",
      "     body[data-hana-theme] (0,1,1) beats the harness's body (0,0,1). */",
      "  --dsh-scrollbar-width: 4px;",
      "",
      "  /* Procedural paper grain: ~410 bytes of inline SVG instead of HanaAgent's",
      "     132 KB rice-paper.png, and resolution independent. fractalNoise is used",
      "     rather than turbulence because its values are distributed around mid-grey",
      "     (0.5) -- which is exactly what makes the soft-light overlay below",
      "     luminance-neutral. The rect deliberately has no opacity of its own: the",
      "     single intensity knob is the overlay's opacity, so there is one place to",
      "     adjust and one place to reason about. */",
      "  --hana-paper-grain: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\");",
      "}",
      "",
      "/* ---- L3: serif reading typography ----",
      "   DSH routes every markdown element through a font SHORTHAND token, so the",
      "   family can be swapped without disturbing anything else: each declaration",
      "   reproduces the harness's own size / line-height expression and changes",
      "   the trailing family. That is what keeps the user's Settings > Appearance",
      "   font-size preference working -- --dsh-content-font-size and",
      "   --dsh-content-font-delta keep flowing through untouched.",
      "",
      "   UI chrome is deliberately NOT restyled: body's --dsw-font-family stays the",
      "   sans stack, so buttons, sidebar and labels keep their own voice and only",
      "   reading text becomes a book.",
      "",
      "   WHY EVERY SIZE IS ALSO SCALED",
      "   A serif face reads smaller than the sans it replaces at the SAME px. For",
      "   CJK this is not subtle: the ground truth on a real Linux desktop is",
      "   sans-serif -> Source Han Sans, while the serif stack resolves to Source Han",
      "   Serif, whose strokes are far lighter. At a 14px base the thin horizontals",
      "   alias away and body text reads as both smaller and fainter -- 宋体 below",
      "   roughly 16px is simply hard to read. DSH caps its own content font-size at",
      "   17px (FONT_SIZE_MIN..FONT_SIZE_MAX in dsh-client-ui-theme), so there is no",
      "   headroom to compensate from the Appearance row. The compensation therefore",
      "   lives here, as a user-adjustable factor.",
      "",
      "   Size and its matching line-height are scaled by the SAME factor, so raising",
      "   the size never tightens the leading -- the ratio the harness chose is",
      "   preserved exactly.",
      "",
      "   The literal below is the value in force before the settings scope becomes",
      "   ready. The client writes the user's factor as an INLINE style on body, and",
      "   inline beats this rule, so no !important is needed or wanted.",
      "",
      "   Code is intentionally left alone: --dsw-font-markdown-code* stays at the",
      "   harness size. Code density is its own decision, not a reading-size one. */",
      "body[" + BODY_ATTR + "]." + SERIF_CLASS + " {",
      "  --hana-serif-scale: 1.15;",
      "",
      "  --dsw-font-markdown-base:",
      "    calc(var(--dsh-content-font-size, 14px) * var(--hana-serif-scale)) /",
      "    calc((24px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-base-italic:",
      "    italic calc(var(--dsh-content-font-size, 14px) * var(--hana-serif-scale)) /",
      "    calc((24px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-base-strong:",
      "    600 calc(var(--dsh-content-font-size, 14px) * var(--hana-serif-scale)) /",
      "    calc((24px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-base-strong-italic:",
      "    italic 600 calc(var(--dsh-content-font-size, 14px) * var(--hana-serif-scale)) /",
      "    calc((24px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "",
      "  --dsw-font-markdown-h1:",
      "    700 calc((21px + var(--dsh-content-font-delta)) * var(--hana-serif-scale)) /",
      "    calc((30px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-h2:",
      "    700 calc((19px + var(--dsh-content-font-delta)) * var(--hana-serif-scale)) /",
      "    calc((28px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-h3:",
      "    700 calc((18px + var(--dsh-content-font-delta)) * var(--hana-serif-scale)) /",
      "    calc((26px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-h4:",
      "    600 calc(var(--dsh-content-font-size, 14px) * var(--hana-serif-scale)) /",
      "    calc((24px + var(--dsh-content-font-delta)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "",
      "  --dsw-font-markdown-small:",
      "    calc(12px * var(--hana-serif-scale))/calc(20px * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-small-italic:",
      "    italic calc(12px * var(--hana-serif-scale))/calc(20px * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-small-strong:",
      "    600 calc(12px * var(--hana-serif-scale))/calc(20px * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-small-strong-italic:",
      "    italic 600 calc(12px * var(--hana-serif-scale))/calc(20px * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "",
      "  --dsw-font-markdown-table:",
      "    calc(var(--dsh-content-font-size-secondary, 13px) * var(--hana-serif-scale))/",
      "    calc((22px + var(--dsh-content-font-delta-secondary, 0px)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "  --dsw-font-markdown-table-head:",
      "    500 calc(var(--dsh-content-font-size-secondary, 13px) * var(--hana-serif-scale))/",
      "    calc((22px + var(--dsh-content-font-delta-secondary, 0px)) * var(--hana-serif-scale))",
      "    var(--hana-font-serif);",
      "}",
      "",
      "/* ---- L3: markdown element rules ----",
      "   Anchored on [data-chat-flow-kind='assistant-step'], which was CONFIRMED",
      "   against the live page rather than assumed: markdown's nearest flow-kind",
      "   ancestor is assistant-step, and 51 of 72 assistant-step elements contain a",
      "   markdown root. The other 21 are step labels with no prose, which is why",
      "   every rule below targets a DESCENDANT element (p, h1, a, li, blockquote,",
      "   img) and never the step container itself -- a rule on the container would",
      "   also style those 21 markers.",
      "",
      "   Note the markdown root's own class is a build hash (_markdown_177e0_5),",
      "   so it is never named here; the DATA ATTRIBUTE is the stable hook.",
      "",
      "   The body[data-hana-theme] prefix is required twice over: specificity, to",
      "   beat the CSS-Module hash rules, and scope, so unloading the theme simply",
      "   removes the attribute and every rule stops matching at once. */",

      "/* 1. Reading rhythm, HanaAgent's 1.75. Unitless, so it follows whatever",
      "      size the compensation factor produced instead of pinning a px value. */",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] p,",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] li {",
      "  line-height: 1.75;",
      "}",

      "/* 2. Centred h1 -- the single most recognisable HanaAgent trait. The size",
      "      is deliberately NOT overridden. The spec asked for 1.2em, but that was",
      "      written before the reading-size compensation existed: against a 20.4px",
      "      prose size, 1.2em is 24.5px while the harness's own scaled h1 is 28.8px,",
      "      so 'flattening' would have SHRUNK every heading at exactly the moment",
      "      the user reported text reading too small. */",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] h1 {",
      "  text-align: center;",
      "}",

      "/* 3. A persistent soft underline, tuned separately from the hover state.",
      "      Done with text-decoration-color rather than the border-bottom the spec",
      "      suggested: the harness paints the markdown anchor with a deliberately",
      "      TRANSPARENT 2px bottom border plus negative margins, as an enlarged hit",
      "      area. Overriding that border would shrink the click target. Colour is",
      "      the part that belongs to a theme; geometry is not. */",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] a {",
      "  text-decoration: underline;",
      "  text-decoration-thickness: 1px;",
      "  text-decoration-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);",
      "  text-underline-offset: 3px;",
      "}",

      "/* 4. Task lists: the marker is removed and the row pulled back so the",
      "      checkbox sits on the text column instead of indenting past it. */",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] li:has(> input[type='checkbox']) {",
      "  list-style: none;",
      "  margin-left: -1.2em;",
      "}",

      "/* 5. Blockquote as an aside: secondary ink, set in italic. */",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] blockquote {",
      "  border-left: 2px solid var(--dsw-alias-border-l1);",
      "  padding-left: 1rem;",
      "  color: var(--dsw-alias-label-secondary);",
      "  font-style: italic;",
      "}",

      "/* 6. Images contained by the reading column, square-cornered. */",
      "body[" + BODY_ATTR + "] [data-chat-flow-kind='assistant-step'] img {",
      "  display: block;",
      "  max-width: 100%;",
      "  max-height: min(520px, 70vh);",
      "  object-fit: contain;",
      "  border-radius: 2px;",
      "}",

      "/* 7. Code blocks: HanaAgent's 3px corner, down from the harness's 12px.",
      "      The module declares --dsl-code-block-border-radius on its own single",
      "      class, so an equal-specificity rule would be a source-order coin flip;",
      "      the body[data-hana-theme] prefix makes this win outright. */",
      "body[" + BODY_ATTR + "] .md-code-block {",
      "  --dsl-code-block-border-radius: 3px;",
      "}",

      "/* 8. Wide tables get a full grid, matching HanaAgent's ruled tables. Scoped",
      "      to .md-table-wide because that is the only table hook DSH exposes as a",
      "      stable global class; narrow tables keep the harness's rule-lines. */",
      "body[" + BODY_ATTR + "] .md-table-wide th,",
      "body[" + BODY_ATTR + "] .md-table-wide td {",
      "  border: 1px solid var(--dsw-alias-border-l1);",
      "  overflow-wrap: anywhere;",
      "}",
      "",
      "/* ---- L3: paper grain (opt-in, default off) ----",
      "   ONE full-viewport layer, not a background-image painted onto each panel.",
      "",
      "   The three-layer per-panel model is what HanaAgent does, but DSH gives it no",
      "   stable handles: the panels are named by build hash, so reproducing it needs",
      "   [class$='_bubble'] style guessing that also breaks the moment an element",
      "   carries a second class. A single fixed layer cannot go stale on upgrade, and",
      "   it textures surfaces this theme has never measured.",
      "",
      "   soft-light around mid-grey is what makes this safe: for a blend colour of",
      "   exactly 0.5 the W3C soft-light function returns the backdrop unchanged, and",
      "   fractalNoise is distributed symmetrically about 0.5, so the layer perturbs",
      "   local luminance without shifting it. That is why there is NO separate",
      "   luminance-compensation layer here, and test/contrast.test.js models the",
      "   compositing to prove the shift stays inside the threshold instead of",
      "   asserting it in a comment. A multiply/grey overlay would need the warm-white",
      "   correction layer, and would visibly grey the paper while doing it.",
      "",
      "   z-index is deliberately the maximum: the grain belongs to the paper, so it",
      "   stays above modals and toasts for a uniform surface. It is inert to input",
      "   (pointer-events: none) and creates no interactive surface. */",
      "body[" + BODY_ATTR + "][" + TEXTURE_ATTR + "='on']::after {",
      "  content: '';",
      "  position: fixed;",
      "  inset: 0;",
      "  z-index: 2147483647;",
      "  pointer-events: none;",
      "  background-image: var(--hana-paper-grain);",
      "  background-repeat: repeat;",
      "  background-size: 160px 160px;",
      "  mix-blend-mode: soft-light;",
      "  opacity: var(--hana-grain-opacity, 0.32);",
      "}",

      "/* ---- L3: 极方圆角 (opt-in, default soft) ----",
      "   Named control categories, NOT the 'zero everything then restore' pattern the",
      "   spec proposed. Reason is measured, not stylistic: the shipped bundles carry",
      "   element-level border-radius:50% on at least badges, rails and credential",
      "   dots, so a blanket [class] { border-radius } reset would square them, and",
      "   putting them back would mean guessing hashed class names. Touching only what",
      "   can be named means nothing needs restoring, and it also avoids !important --",
      "   body[data-hana-theme][data-hana-shape] control is (0,3,1), which already",
      "   outranks a CSS-Module single class (0,1,0) without fighting the cascade.",
      "",
      "   Trade-off accepted: this squares the controls and the composer, not every",
      "   rounded rectangle in the product. Partial but safe beats complete but",
      "   destructive for an opt-in switch. */",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] button,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] input,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] select,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] textarea,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [role='button'],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [role='tab'] {",
      "  border-radius: 2px;",
      "}",
      "/* HanaAgent's one deliberate exception: the composer keeps a little softness. */",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [data-composer-card] {",
      "  border-radius: 6px;",
      "}",
      ""
    ].join("\n");

    /* ── stylesheet installation ──────────────────────────────────────── */

    var STYLE_TOKEN = 'style[data-plugin="' + NAME + '"]';

    /* The dynamic-cordis runner exposes a `styles` global whose insert() is
       reclaimed with the package; a bundle installed into a profile has no
       such global, so fall back to a marked <style> element that is removed by
       the same disposer. */
    function insertCss(text) {
      if (typeof styles !== "undefined" && styles && typeof styles.insert === "function") {
        return styles.insert(text);
      }
      var head = document.head || document.documentElement;
      var existing = head.querySelectorAll(STYLE_TOKEN);
      for (var i = 0; i < existing.length; i += 1) {
        if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
      }
      var tag = document.createElement("style");
      tag.setAttribute("data-plugin", NAME);
      tag.textContent = text;
      head.appendChild(tag);
      return function () {
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      };
    }

    /* ── preferences: durable namespace over the browser settings scope ──

       The host half registers the namespace; this side reads and writes it.
       Three rules govern the writes, and each exists because its violation is
       a silent data-loss bug:

       1. Bind by service, not by property, and be patient. `settingsScope`
          arrives asynchronously and may settle after this apply().
       2. A write only lands when the snapshot says mode==='host' AND
          status==='ready' AND writable===true. Testing `writable` alone is the
          classic bug: a host-mode describe view answers writable=true while
          this namespace is still unserved (status 'unavailable'), so the write
          reaches no durable store, the dirty mark is cleared, and the setting
          vanishes on reload.
       3. An edit made before the scope is durably served is held dirty and
          replayed on the next ready transition. */
    function createPrefs(ctx, onChange) {
      var scope = null;
      var remote = null;
      var local = {};
      var dirty = {};
      var listeners = [onChange];
      var bindTimer = null;
      var attempts = 0;

      function snapshot() {
        if (!scope) return null;
        try {
          return scope.getSnapshot();
        } catch (e) {
          return null;
        }
      }

      function durablyServed(snap) {
        return !!snap && snap.mode === "host" && snap.status === "ready" && !!snap.writable;
      }

      function get(name) {
        if (Object.prototype.hasOwnProperty.call(local, name)) return local[name];
        if (remote && Object.prototype.hasOwnProperty.call(remote, name)) {
          return String(remote[name]);
        }
        return FIELD_DEFAULTS[name];
      }

      function isOn(name) {
        return get(name) !== "0";
      }

      function emit() {
        for (var i = 0; i < listeners.length; i += 1) {
          try {
            listeners[i]();
          } catch (e) {
            /* one bad listener must not stop the rest */
          }
        }
      }

      function replay() {
        var snap = snapshot();
        if (!durablyServed(snap)) return;
        var names = Object.keys(dirty);
        for (var i = 0; i < names.length; i += 1) {
          var name = names[i];
          var value = local[name];
          var hostValue =
            snap && snap.value && Object.prototype.hasOwnProperty.call(snap.value, name)
              ? String(snap.value[name])
              : undefined;
          if (value === hostValue || value === FIELD_DEFAULTS[name]) {
            delete dirty[name];
            continue;
          }
          try {
            // mutate() is asynchronous and resolves to a task promise; an
            // unhandled rejection here would surface as a console error while the
            // switch looked fine. A rejection keeps the field dirty for the next
            // replay rather than dropping the edit.
            var written = scope.set(name, value);
            if (written && typeof written.then === "function") {
              written.then(function () {
                // A landed write updates the settings document, which makes the
                // theme service re-adopt its persisted (built-in) preference and
                // wipe our tokens. Re-check after it settles.
                if (onWroteSettings !== null) onWroteSettings();
              }, function () { /* stays dirty */ });
            }
            delete dirty[name];
          } catch (e) {
            /* keep it dirty; a later ready transition retries */
          }
        }
      }

      function set(name, value) {
        local[name] = value;
        dirty[name] = true;
        replay();
        if (retryTimer === null) retryTimer = setTimeout(retry, 500);
        emit();
      }

      /* Whether the Host document currently accepts writes. Surfaced to the
         settings page so a namespace that is not served is VISIBLE instead of
         looking like a working switch that forgets. */
      function durable() {
        return durablyServed(snapshot());
      }

      function adopt(snap) {
        if (!snap) return;
        if (snap.status === "ready" && snap.value !== undefined) remote = snap.value;
        replay();
        emit();
      }

      function bind() {
        if (attempts > 60) return;
        attempts += 1;
        var binder = null;
        try {
          if (ctx.settingsScope && typeof ctx.settingsScope.bind === "function") {
            binder = ctx.settingsScope;
          }
        } catch (e) {
          binder = null;
        }
        if (!binder) {
          try {
            binder = ctx.get("settingsScope");
          } catch (e) {
            binder = null;
          }
        }
        if (!binder || typeof binder.bind !== "function") {
          bindTimer = setTimeout(bind, 250);
          return;
        }
        try {
          // bind() takes a SPEC OBJECT, not a namespace string. Passing the bare
          // string leaves spec.namespace and spec.decode undefined, so the scope
          // can never match a describe row (`status` stays 'unavailable' for every
          // namespace) and every write goes to remote.settings.mutate(undefined).
          // It fails silently in both directions, which is why test/check.js now
          // asserts the object form.
          scope = binder.bind({ namespace: NS });
        } catch (e) {
          scope = null;
          bindTimer = setTimeout(bind, 250);
          return;
        }
        adopt(snapshot());
        try {
          scope.subscribe(function () {
            adopt(snapshot());
          });
        } catch (e) {
          /* a scope without subscribe still works via explicit reads */
        }
      }

      bind();

      /* Bounded retry. The first edits can arrive before the describe mirror has
         been fetched, and nothing else will wake the dirty fields up, so replay
         them for ~20s and then stop rather than polling forever. */
      var onWroteSettings = null;
      var retryTimer = null;
      var retryLeft = 40;
      function retry() {
        if (retryLeft <= 0 || Object.keys(dirty).length === 0) {
          retryTimer = null;
          return;
        }
        retryLeft -= 1;
        replay();
        retryTimer = setTimeout(retry, 500);
      }

      return {
        get: get,
        isOn: isOn,
        set: set,
        durable: durable,
        onWrote: function (fn) {
          onWroteSettings = fn;
        },
        subscribe: function (fn) {
          listeners.push(fn);
          return function () {
            var i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
          };
        },
        dispose: function () {
          if (bindTimer) clearTimeout(bindTimer);
          if (retryTimer) clearTimeout(retryTimer);
          onWroteSettings = null;
          bindTimer = null;
          retryTimer = null;
          listeners.length = 0;
        }
      };
    }

    /* ── the plugin ───────────────────────────────────────────────────── */

    function apply(ctx) {
      var theme = ctx.get("theme");
      // The theme service is the one hard dependency. Without it there is
      // nothing this plugin can honestly do, so leave quietly rather than
      // throwing inside someone else's mount.
      if (theme === undefined) return;

      var body = typeof document !== "undefined" && document.body ? document.body : null;
      var themeDisposers = [];
      var styleTeardown = null;
      var mounted = false;

      function safeSnapshot() {
        try {
          return theme.getTheme();
        } catch (e) {
          return null;
        }
      }

      function activeIsOurs() {
        var snap = safeSnapshot();
        var id = snap && snap.active ? snap.active.id : null;
        var def = id === null || id === undefined ? null : paletteById(id);
        return def === null ? null : def.id;
      }

      function registerThemes() {
        if (themeDisposers.length) return;
        for (var i = 0; i < PALETTE_DEFS.length; i += 1) {
          var def = PALETTE_DEFS[i];
          // A duplicate id throws (single occupant per id). Swallow it and keep
          // whatever registration already exists rather than aborting the loop,
          // so a reload cannot end up with one theme missing.
          try {
            themeDisposers.push(theme.register({
              id: def.id,
              colorScheme: def.scheme,
              tokens: def.tokens
            }));
          } catch (e) {
            /* already registered */
          }
        }
      }

      function unregisterThemes() {
        for (var i = 0; i < themeDisposers.length; i += 1) {
          try {
            themeDisposers[i]();
          } catch (e) {
            /* ignore */
          }
        }
        themeDisposers = [];
      }

      function mount() {
        if (mounted) return;
        styleTeardown = insertCss(CSS);
        mounted = true;
      }

      function unmount() {
        if (styleTeardown) {
          try {
            styleTeardown();
          } catch (e) {
            /* ignore */
          }
        }
        styleTeardown = null;
        mounted = false;
      }

      /* Leave the document exactly as it was found. Every "not ours" path goes
         through here, so there is one definition of "detached" rather than
         three hand-written copies that can drift apart. */
      function detach() {
        unmount();
        if (overrideDispose !== null && storedPalette() === null) {
          try {
            overrideDispose();
          } catch (e) {
            /* ignore */
          }
          overrideDispose = null;
        }
        if (!body) return;
        body.removeAttribute(BODY_ATTR);
        body.removeAttribute(TEXTURE_ATTR);
        body.removeAttribute(SHAPE_ATTR);
        body.classList.remove(SERIF_CLASS);
        body.style.removeProperty(SERIF_SCALE_VAR);
        body.style.removeProperty(GRAIN_VAR);
        clearShiki();
      }

      /* Syntax colours are pinned to the CLAIMED PALETTE, not to the active
         colorScheme: the palette is what the user chose, and the override layer
         can paint a dark code surface while body[data-ds-dark-theme] is still
         absent (see the L1b note). Writing all eleven on every pass, rather
         than only the changed ones, is deliberate — it is idempotent, it costs
         eleven setProperty calls, and it means switching palettes cannot leave
         a stale value from the previous one behind. */
      function applyShiki(paletteId) {
        if (!body) return;
        var table = SHIKI_BY_PALETTE[paletteId];
        if (table === undefined) {
          clearShiki();
          return;
        }
        for (var i = 0; i < SHIKI_NAMES.length; i += 1) {
          body.style.setProperty(SHIKI_NAMES[i], table[SHIKI_NAMES[i]]);
        }
      }

      /* Removes exactly the names this plugin writes and nothing else, so a
         detach cannot disturb another plugin's --shiki-* layer. */
      function clearShiki() {
        if (!body) return;
        for (var i = 0; i < SHIKI_NAMES.length; i += 1) {
          body.style.removeProperty(SHIKI_NAMES[i]);
        }
      }

      /* The reading-size compensation as a plain number for calc().
         Anything unparseable or out of range falls back to the stylesheet
         default rather than writing a broken calc: an invalid factor would make
         every markdown `font` shorthand invalid, and the text would silently
         fall back to the inherited size instead of simply not being scaled. */
      function preferredScale() {
        var n = Number(prefs.get("serifScale"));
        if (!Number.isFinite(n) || n < SCALE_MIN || n > SCALE_MAX) {
          return String(SCALE_DEFAULT / 100);
        }
        return String(n / 100);
      }

      /* Grain intensity as a plain number for opacity. Same defensive shape as
         preferredScale: an unparseable value falls back to the stylesheet default
         rather than writing an invalid opacity that would drop the whole layer. */
      function preferredGrain() {
        var n = Number(prefs.get("grainOpacity"));
        if (!Number.isFinite(n) || n < GRAIN_MIN || n > GRAIN_MAX) {
          return String(GRAIN_DEFAULT / 100);
        }
        return String(n / 100);
      }

      /* One reconcile pass owns every visual decision. It is idempotent, so it
         can be the settings listener, the theme listener and the initial call
         without special-casing any of them. */
      function reconcile() {
        if (!body) return;

        if (!prefs.isOn("enabled")) {
          if (overrideDispose !== null) {
            try {
              overrideDispose();
            } catch (e) {
              /* ignore */
            }
            overrideDispose = null;
          }
          detach();
          unregisterThemes();
          return;
        }

        registerThemes();
        /* Resolved every pass, because a settings write re-adopts DSH's persisted
           preference and the palette must be re-layered whenever that happens. */
        applyOverride();

        var active = activeIsOurs();
        var stored = storedPalette();
        /* "Claimed" is broader than "active is ours" on purpose. With DSH's
           preference on `system` the active theme is ALWAYS a built-in, so
           requiring our own id would refuse to style anything -- yet a remembered
           palette still owns the colours through the override layer, and the
           typography must follow it. When neither holds, the plugin contributes
           nothing at all, which is what keeps installing it safe. */
        if (active === null && stored === null) {
          detach();
          return;
        }

        mount();
        body.setAttribute(BODY_ATTR, (active === null ? stored : active).replace("hana-", ""));
        applyShiki(active === null ? stored : active);
        if (prefs.isOn("serif")) body.classList.add(SERIF_CLASS);
        else body.classList.remove(SERIF_CLASS);
        // Inline, not in the sheet: the sheet carries only the default, and
        // inline wins over it, which is exactly what we want and avoids needing
        // !important to out-rank our own rule.
        body.style.setProperty(SERIF_SCALE_VAR, preferredScale());
        body.setAttribute(TEXTURE_ATTR, prefs.isOn("paperTexture") ? "on" : "off");
        body.setAttribute(SHAPE_ATTR, prefs.get("shape") === "seal" ? "seal" : "soft");
        body.style.setProperty(GRAIN_VAR, preferredGrain());
      }

      var prefs = createPrefs(ctx, reconcile);
      prefs.onWrote(scheduleEnsurePalette);

      /* Keeping a hana palette selected needs BOTH halves, and the second one is
         not obvious:

         1. DSH persists only light/dark/system as a theme preference, so a
            third-party id is never written. The chosen palette is therefore
            remembered in this plugin's own namespace, which does persist.
         2. dsh-client-ui-theme re-adopts `settings.theme.preference` from the
            settings document on EVERY update, unconditionally. So the moment any
            setting is written -- including this plugin's own -- the preference is
            pulled back to the persisted built-in and the theme reverts.

         Point 2 is why re-applying at mount alone is not enough, and why clearing
         the record on a revert was actively wrong: the first re-adopt wiped the
         only durable copy, leaving the palette unselectable for the rest of the
         session.

         A revert and a deliberate choice are indistinguishable from the event, so
         the contract is made explicit instead of guessed: while a palette is
         remembered the plugin restores it, and 「跟随 DSH」 forgets it and hands
         the preference back to the system setting. */
      function storedPalette() {
        var stored = prefs.get("palette");
        return paletteById(stored) === null ? null : stored;
      }

      /* Each palette has a natural other-scheme partner, so a remembered choice
         covers BOTH modes. That is what lets the colours ride on an override
         layer instead of depending on the theme preference. */
      function schemePartners(id) {
        var LIGHT_TO_DARK = {
          "hana-paper": "hana-midnight",
          "hana-midnight": "hana-paper",
          "hana-coral": "hana-midnight-vivid",
          "hana-midnight-vivid": "hana-coral"
        };
        var partnerOf = LIGHT_TO_DARK[id];
        if (partnerOf === undefined) return null;
        var a = paletteById(id);
        var b = paletteById(partnerOf);
        if (a === null || b === null) return null;
        return a.scheme === "light" ? { light: a, dark: b } : { light: b, dark: a };
      }

      /* The colours travel as an OVERRIDE LAYER, not only as a registered theme.
         dsh-client-ui-theme's composeActive() folds every override layer onto
         whatever theme is active, so the layer survives the one thing that kept
         beating us: `adopt()` re-reading settings.theme.preference -- which can
         only ever hold a built-in id -- on EVERY settings update and at boot.
         Registering alone cannot survive that, and neither could re-calling
         setTheme() from a listener, because the presenter then re-applies the
         stale snapshot. A layer is evaluated at apply() time, so it simply wins.
         This is also what dsh-theme-endfield does; the design originally rejected
         it for fear of repainting built-in themes, which is precisely the
         property that makes it durable. */
      var overrideDispose = null;
      /* Which palette the live layer was built from. overrideTokens() EMITS
         theme/change, and reconcile() is itself a theme/change listener, so
         re-layering unconditionally recurses for ever. Guarding on the palette
         identity makes the call a no-op unless the choice actually changed. */
      var overrideFor = null;
      function applyOverride() {
        var wanted = prefs.isOn("enabled") ? storedPalette() : null;
        if (wanted === overrideFor) return;
        overrideFor = wanted;
        if (overrideDispose !== null) {
          try {
            overrideDispose();
          } catch (e) {
            /* ignore */
          }
          overrideDispose = null;
        }
        if (wanted === null) return;
        var pair = schemePartners(wanted);
        if (pair === null) return;
        var keys = Object.keys(pair.light.tokens);
        var modes = {};
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];
          modes[key] = { light: pair.light.tokens[key], dark: pair.dark.tokens[key] };
        }
        try {
          overrideDispose = theme.overrideTokens(NS, modes);
        } catch (e) {
          overrideDispose = null;
          // Let the next pass retry rather than believing the layer exists.
          overrideFor = undefined;
        }
      }

      /* What the presenter actually wrote on body right now. Reading the applied
         value is the only reliable test: the failure we are defending against
         leaves the theme service reporting our palette as active while the
         tokens have already been wiped, so any check based on the preference
         says "fine" while the screen says otherwise. */
      function appliedBg() {
        if (!body) return null;
        return String(body.style.getPropertyValue("--dsw-alias-bg-base")).trim().toLowerCase();
      }

      function ensurePaletteApplied() {
        var stored = storedPalette();
        if (stored === null) return;
        var def = paletteById(stored);
        if (def === null || !body) return;
        /* Two independent things can be wrong, and the first version only tested
           the second: the paint (the override layer supplies it, so it is usually
           already right) and the PREFERENCE (DSH re-adopts its own built-in on
           every settings write and at every boot). Testing the paint alone made
           this a no-op exactly when the preference needed pinning -- which is
           why the panel's active marker vanished after a restart.
           The preference matters beyond the marker: composeActive() picks the
           override's light or dark half from the ACTIVE theme's colorScheme, so a
           preference left on `system` shows the partner palette whenever the OS
           scheme differs from the one the user chose. */
        var pinned = activeIsOurs() === stored;
        var painted = appliedBg() === String(def.tokens["--dsw-alias-bg-base"]).trim().toLowerCase();
        if (pinned && painted) return;
        try {
          theme.setTheme(stored);
        } catch (e) {
          /* not registered yet; the next theme/change will retry */
        }
      }

      /* DEFERRED ON PURPOSE. ThemePresenter.apply() removes every token it
         previously applied and then applies the NEW active theme's -- and the
         built-in pair carry no tokens at all, so any switch to a built-in theme
         wipes this theme's inline tokens while leaving its stylesheet (and so
         its typography) in place.
         Re-applying synchronously from inside the theme/change listener loses a
         race: publish() emits synchronously, so a re-entrant setTheme runs the
         presenter with OUR snapshot first and then, when the outer emit resumes,
         the presenter runs again with the STALE built-in snapshot and wipes the
         tokens we just restored. Deferring past the whole emit puts our tokens
         back last, which is the only ordering that survives. */
      var ensureTimer = null;
      function scheduleEnsurePalette() {
        if (ensureTimer !== null) return;
        ensureTimer = setTimeout(function () {
          ensureTimer = null;
          ensurePaletteApplied();
        }, 0);
      }

      var offTheme = null;
      try {
        offTheme = ctx.on("theme/change", function () {
          if (storedPalette() !== null && activeIsOurs() === null) {
            scheduleEnsurePalette();
            return;
          }
          reconcile();
        });
      } catch (e) {
        offTheme = null;
      }

      reconcile();
      scheduleEnsurePalette();

      /* Every side effect registered above is reversed here, in one place, so
         stop, update and undefine all leave the page exactly as it was found:
         the stylesheet, the body attribute, the serif class, the theme
         registrations, the theme subscription and the settings binding. */
      ctx.effect(
        function () {
          return function () {
            prefs.dispose();
            if (overrideDispose !== null) {
              try {
                overrideDispose();
              } catch (e) {
                /* ignore */
              }
              overrideDispose = null;
            }
            if (ensureTimer !== null) clearTimeout(ensureTimer);
            ensureTimer = null;
            if (typeof offTheme === "function") offTheme();
            detach();
            unregisterThemes();
          };
        },
        NAME + ": paper palette, serif reading typography"
      );

      /* ── settings page: Settings > hana theme ───────────────────────── */
      var slots = ctx.get("slots");
      if (slots !== undefined && typeof slots.inject === "function") {
        try {
          slots.inject("settings.section", function () {
            return slots.register(
              {
                name: "settings.section",
                id: NS,
                order: 40,
                // A thunk, not a string: the slot contract re-reads it, so the
                // nav row follows a language switch without re-registration.
                label: function () {
                  return "花笺主题";
                }
              },
              function () {
                var R =
                  typeof React !== "undefined"
                    ? React
                    : typeof require === "function"
                      ? require("react")
                      : null;
                if (!R) return null;

                var state = R.useState(0);
                var tick = state[0];
                var bump = state[1];
                void tick;

                R.useEffect(function () {
                  return prefs.subscribe(function () {
                    bump(function (n) {
                      return n + 1;
                    });
                  });
                }, []);

                var rowStyle = {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "12px 0",
                  borderBottom: "0.5px solid var(--dsw-alias-border-l1)"
                };
                var titleStyle = {
                  font: "var(--dsw-font-s-strong-14)",
                  color: "var(--dsw-alias-label-primary)"
                };
                var hintStyle = {
                  font: "var(--dsw-font-xs-13)",
                  color: "var(--dsw-alias-label-tertiary)",
                  marginTop: "4px",
                  maxWidth: "46ch"
                };
                var buttonStyle = function (on) {
                  return {
                    font: "var(--dsw-font-xs-13)",
                    padding: "4px 10px",
                    borderRadius: "var(--hana-radius-control, 6px)",
                    border: "0.5px solid var(--dsw-alias-border-l1)",
                    background: on
                      ? "var(--dsw-alias-button-primary-fill)"
                      : "var(--dsw-alias-button-elevated-fill)",
                    color: on
                      ? "var(--dsw-alias-label-primary-foreground)"
                      : "var(--dsw-alias-label-primary)",
                    cursor: "pointer"
                  };
                };

                function toggle(name) {
                  return function () {
                    prefs.set(name, prefs.isOn(name) ? "0" : "1");
                  };
                }

                var active = activeIsOurs();

                return R.createElement(
                  "div",
                  { style: { padding: "4px 0 8px" } },
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "启用花笺主题"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "关闭后本主题不再向「外观」提供配色，也不会改动任何排版。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        checked: prefs.isOn("enabled"),
                        onChange: toggle("enabled"),
                        "aria-label": "启用花笺主题"
                      },
                      null
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "配色"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "DSH 只持久化「亮/暗/跟随系统」，第三方主题 id 不会被保存，所以本主题自己记住你的选择，" +
                          "并在 DSH 每次复位后把它恢复回来。" +
                          "这也意味着选中一套花笺配色后，「设置 › 外观」那一行会被本主题覆盖；想交回给它就点「跟随 DSH」。"
                      )
                    ),
                    R.createElement(
                      "div",
                      { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
                      PALETTE_DEFS.map(function (def) {
                        return R.createElement(
                          "button",
                          {
                            key: def.id,
                            type: "button",
                            /* What this panel is in charge of. Comparing against
                               theme.preference looked right while we still pinned the
                               preference ourselves, but DSH re-adopts its own value on
                               every write, so the marker lit on click and died on the
                               next restart. The remembered palette is the durable
                               fact; the preference is downstream of it. */
                            style: buttonStyle(storedPalette() === def.id),
                            onClick: function () {
                              // Record the choice BEFORE applying it: this is the
                              // only durable copy, since DSH will not store a
                              // third-party theme id.
                              prefs.set("palette", def.id);
                              try {
                                theme.setTheme(def.id);
                              } catch (e) {
                                /* the theme may already be disposed */
                              }
                              bump(function (n) {
                                return n + 1;
                              });
                            }
                          },
                          def.name,
                          null
                        );
                      }),
                      /* The escape hatch. Without it, a remembered palette could
                         only be escaped by uninstalling -- and a deliberate move
                         to a built-in theme is otherwise indistinguishable from
                         DSH re-adopting the persisted preference. */
                      R.createElement(
                        "button",
                        {
                          key: "dsh",
                          type: "button",
                          style: buttonStyle(storedPalette() === null),
                          onClick: function () {
                            prefs.set("palette", "");
                            try {
                              theme.setTheme("system");
                            } catch (e) {
                              /* ignore */
                            }
                            bump(function (n) {
                              return n + 1;
                            });
                          }
                        },
                        "跟随 DSH",
                        null
                      )
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "衬线阅读体"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "让 AI 的回答、标题与表格改用衬线体，界面本身保持无衬线。字号仍跟随「外观」中的设置。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        checked: prefs.isOn("serif"),
                        onChange: toggle("serif"),
                        "aria-label": "衬线阅读体"
                      },
                      null
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "衬线字号补偿"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "衬线体在同样字号下比黑体显得更小更细，中文尤其明显：14px 的宋体横画会被像素网格吃掉，看着又小又淡。" +
                          "这里按比例放大正文，行高同步放大，所以在「外观」里调字号依然有效。100% 即原始大小。"
                      )
                    ),
                    R.createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "10px", flex: "none" } },
                      R.createElement(
                        "input",
                        {
                          type: "range",
                          min: String(SCALE_MIN),
                          max: String(SCALE_MAX),
                          step: "5",
                          value: prefs.get("serifScale"),
                          disabled: !prefs.isOn("serif"),
                          onChange: function (event) {
                            prefs.set("serifScale", String(event.target.value));
                          },
                          "aria-label": "衬线字号补偿"
                        },
                        null
                      ),
                      R.createElement(
                        "span",
                        { style: { ...hintStyle, marginTop: 0, minWidth: "5ch", textAlign: "right" } },
                        prefs.get("serifScale") + "%"
                      )
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "纸质纹理"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "整屏叠一层极淡的纸纹（程序化 SVG，约 410 字节，无图片资源）。" +
                          "用 soft-light 混合，在中间灰附近不改动整体明度，所以正文对比度不会被拉低。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        checked: prefs.isOn("paperTexture"),
                        onChange: toggle("paperTexture"),
                        "aria-label": "纸质纹理"
                      },
                      null
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "纹理强度"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "0–60%。太强会变成光学噪音，建议 25–40%。"
                      )
                    ),
                    R.createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "10px", flex: "none" } },
                      R.createElement(
                        "input",
                        {
                          type: "range",
                          min: String(GRAIN_MIN),
                          max: String(GRAIN_MAX),
                          step: "4",
                          value: prefs.get("grainOpacity"),
                          disabled: !prefs.isOn("paperTexture"),
                          onChange: function (event) {
                            prefs.set("grainOpacity", String(event.target.value));
                          },
                          "aria-label": "纹理强度"
                        },
                        null
                      ),
                      R.createElement(
                        "span",
                        { style: { ...hintStyle, marginTop: 0, minWidth: "5ch", textAlign: "right" } },
                        prefs.get("grainOpacity") + "%"
                      )
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "极方圆角"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "把按钮与输入框的圆角压到 2px（纸上的印章是方的），输入区保留 6px。" +
                          "只改这些能点名的控件；徽标、状态点等本来就该圆的元素不受影响。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        checked: prefs.get("shape") === "seal",
                        onChange: function () {
                          prefs.set("shape", prefs.get("shape") === "seal" ? "soft" : "seal");
                        },
                        "aria-label": "极方圆角"
                      },
                      null
                    )
                  ),
                  R.createElement(
                    "div",
                    { style: { paddingTop: "12px", ...hintStyle } },
                    active
                      ? "当前正在使用：" +
                        "花笺 · " + (paletteById(active) ? paletteById(active).name : active) +
                        (prefs.durable() ? "（设置已保存）" : "（⚠️ 设置未能写入配置，重启后会丢失）")
                      : "当前未启用花笺配色，以上排版设置不会生效。"
                  )
                );
              }
            );
          });
        } catch (e) {
          /* a composition without the settings.section slot keeps the theme */
        }
      }
    }

    exports.name = NAME;
    // Only `theme` is a hard dependency; slots and the settings scope are read
    // optionally through ctx.get so a composition without them still mounts.
    exports.inject = ["theme"];
    exports.apply = apply;

    /* Read by test/tokens.test.js and test/contrast.test.js, which take their
       values from this table rather than a second copy -- the whole point is
       that the shipped numbers and the asserted numbers cannot diverge. */
    exports.TOKENS = { paper: PAPER, midnight: MIDNIGHT, coral: CORAL, vivid: VIVID };
    /* The shipped palette list, so the tests iterate what the plugin actually
       registers instead of keeping their own roster of ids and schemes. */
    exports.PALETTES = PALETTE_DEFS.map(function (def) {
      return { id: def.id, scheme: def.scheme, name: def.name, tokens: def.tokens };
    });
    exports.CSS = CSS;
    exports.DEFAULTS = FIELD_DEFAULTS;
    /* The shipped syntax palettes, so contrast.test.js measures the values that
       actually reach the browser instead of a copy that can drift from them. */
    exports.SHIKI = SHIKI_BY_PALETTE;
    exports.SHIKI_NAMES = SHIKI_NAMES;

    return module.exports;
  }
});
