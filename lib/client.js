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
    var FOCUS_ATTR = "data-hana-focus";
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
      paperTexture: "1",
      grainOpacity: "32",
      shape: "soft",
      /* 'accent' | 'native'. See the L3 焦点墨环 block in the stylesheet: the
         reference has exactly ONE focus-ring colour for the whole app, and DSH
         has five. `native` restores the harness's own five. */
      focus: "accent",
      // The seal is the one place this theme REPLACES shipped UI (it shadows the
      // sidebar's brand mark), so it is off unless asked for. Default-OFF fields
      // store '0' and read as === '1', the convention the other themes share.
      sealMark: "0",
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
      "--dsw-alias-bg-layer-1": "#FDF8EF",
      "--dsw-alias-bg-layer-2": "#EFE8DB",
      "--dsw-alias-bg-layer-3": "#EBE5DA",
      "--dsw-alias-bg-overlay": "#FDF8EF",
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
      /* CORRECTED (see L1c). This note used to claim that
         `--dsw-alias-separator-primary` and `--dsw-alias-label-error` were
         deliberate absences because ui-theme 0.1.2-rc.1 "neither declares nor
         consumes" them. The declaration half holds — neither is in the 89 — but
         the consumption half was wrong, and the grep behind it was the reason:
         it searched the frontend bundle, where both names are indeed absent,
         and not the individual `dsh-client-ui-*` packages, where both are read
         (`chat` paints a middot with separator-primary, `settings-plugins`
         paints an invalid input with label-error) — with no `var()` fallback,
         so nothing fell back and the property simply vanished.
         `--dsw-alias-line-secondary` is genuinely unused and stays absent.
         Both names are now supplied through L1c, bound to `border-l1` and
         `state-error-primary`, which is exactly the mapping this note proposed
         while arguing they could not be set at all. */

      /* ink, five stops */
      "--dsw-alias-label-primary": "#2A2622",
      "--dsw-alias-label-secondary": "#4C443E",
      "--dsw-alias-label-tertiary": "#6B6158",
      "--dsw-alias-label-caption": "#7C7066",
      "--dsw-alias-label-dimmed": "#8D8075",
      "--dsw-alias-label-primary-dimmed": "#4C443E",
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
      "--dsw-alias-button-elevated-fill": "#FDF8EF",
      "--dsw-alias-button-floating-fill": "rgba(253,248,239,0.92)",
      "--dsw-alias-button-floating-hover": "rgba(245,240,231,0.92)",
      "--dsw-alias-button-ghost-active-fill": "rgba(42,38,34,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(42,38,34,0.12)",
      "--dsw-alias-button-ghost-active-border": "#D8CFBE",
      "--dsw-alias-button-tool-bar-fill": "rgba(253,248,239,0.92)",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(253,248,239,0)",
      "--dsw-alias-button-tool-bar-hover": "rgba(245,240,231,0.92)",

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
      "--dsw-specific-bubble": "#ECE9E0",
      "--dsw-specific-bubble-highlight": "#EBE5DA",
      "--dsw-specific-input-major": "#FDF8EF",
      "--dsw-specific-login-input": "#FBF7EE",
      "--dsw-specific-selector": "#EBE5DA",
      "--dsw-specific-menu": "#FDF8EF",
      "--dsw-specific-tip": "#FDF8EF",
      "--dsw-specific-sidebar-fill": "#EFE8DB",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(42,38,34,0.04)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(42,38,34,0.08)",
      /* In a paper style "selected" is denser ink, not more colour. */
      "--dsw-specific-sidebar-nav-item-active-accent": "#2A2622",

      /* markdown + code */
      "--dsw-alias-markdown-inline-code": "#E9E7DE",
      "--dsw-alias-markdown-code-block": "#E9E7DE",
      "--dsw-alias-markdown-code-block-banner": "#EBE5DA",
      "--dsw-alias-markdown-code-segment-selected": "#EBE5DA",
      "--dsw-alias-markdown-code-segment-unselected": "#F5F1E8",
      "--dsw-alias-markdown-citation": "rgba(83,125,150,0.10)",
      "--dsw-alias-markdown-tag": "rgba(83,125,150,0.12)",
      "--dsw-alias-markdown-placeholder": "#8D8075",

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
      "--dsw-alias-bg-layer-3": "#303E47",
      "--dsw-alias-bg-overlay": "#445560",
      "--dsw-alias-bg-skeleton": "#303E47",
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
      "--dsw-alias-label-secondary": "#C3D0D9",
      "--dsw-alias-label-tertiary": "#A7B9C3",
      "--dsw-alias-label-caption": "#9AAEB9",
      "--dsw-alias-label-dimmed": "#8EA4AF",
      "--dsw-alias-label-primary-dimmed": "#C3D0D9",
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
      "--dsw-alias-button-floating-fill": "rgba(59,74,84,0.92)",
      "--dsw-alias-button-floating-hover": "rgba(69,83,93,0.92)",
      "--dsw-alias-button-ghost-active-fill": "rgba(255,255,255,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(255,255,255,0.12)",
      "--dsw-alias-button-ghost-active-border": "#4F5C65",
      "--dsw-alias-button-tool-bar-fill": "rgba(59,74,84,0.92)",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(59,74,84,0)",
      "--dsw-alias-button-tool-bar-hover": "rgba(69,83,93,0.92)",

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
      "--dsw-specific-tip": "#445560",
      "--dsw-specific-sidebar-fill": "#34424B",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(255,255,255,0.05)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(255,255,255,0.08)",
      "--dsw-specific-sidebar-nav-item-active-accent": "#E1EAF0",

      "--dsw-alias-markdown-inline-code": "#4D5E68",
      "--dsw-alias-markdown-code-block": "#495863",
      "--dsw-alias-markdown-code-block-banner": "#4F5C65",
      "--dsw-alias-markdown-code-segment-selected": "#556069",
      "--dsw-alias-markdown-code-segment-unselected": "#4A5A65",
      "--dsw-alias-markdown-citation": "rgba(201,154,175,0.12)",
      "--dsw-alias-markdown-tag": "rgba(201,154,175,0.14)",
      "--dsw-alias-markdown-placeholder": "#8EA4AF",

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
         · Coral never becomes a text colour OR a button plate. An earlier
           revision made button-contrast-fill coral, on the theory that "a
           surface colour is allowed to be a surface". That was wrong twice
           over. HanaAgent's own coral theme keeps --accent (its primary button
           fill) at ink blue #1A3049 and reserves #F37E63 for --coral, the tint
           and line colour; and DSH's contrast button pairs its plate with
           label-primary-inverted, so a mid-light coral plate strands that glyph
           at 2.46:1. The plate is ink blue, exactly as --accent is.

       Values taken verbatim from HanaAgent's themes/coral.css and NOT
       re-derived, because they are the design rather than a measurement:
         --bg-card    #FFFBF3  -> bg-layer-1 (paper on paper: a 1.033 step,
                                  told apart by its hairline and shadow, not by
                                  a lightness ladder)
         --border     rgba(243,126,99,0.18) -> border-l1. The whole ramp is this
                                  one authored hairline scaled up, so no card
                                  edge in the app outshouts the design's.
         --sidebar-bg #FCF1E4  -> bg-multi-select
         --tool-bg    rgba(26,48,73,0.03) -> the process wash, supplied in CSS
                                  as color-mix of label-primary -- which is
                                  rgb(26,48,73) here, so the port is exact.

       Three of HanaAgent's own values did not clear AA on its own ground and
       were corrected by the same reproducible rule used elsewhere: hold hue and
       saturation, step lightness in 0.0005 until the pair passes.
         --text-muted  #727F89 (3.83:1) -> #657079
         --green       #6E8C7A (3.44:1) -> #5E7768
       ═══════════════════════════════════════════════════════════════════ */
    var CORAL = {
      "--dsw-alias-bg-base": "#FDF6EC",
      "--dsw-alias-bg-layer-1": "#FFFBF3",
      "--dsw-alias-bg-layer-2": "#F5EADF",
      "--dsw-alias-bg-layer-3": "#EEE8E1",
      "--dsw-alias-bg-overlay": "#FFFBF3",
      "--dsw-alias-bg-skeleton": "#EEE8E1",
      "--dsw-alias-bg-module-platform": "#F9EEE2",
      "--dsw-alias-bg-multi-select": "#FCF1E4",
      "--dsw-alias-bg-mask-1": "rgba(26,48,73,0.20)",
      "--dsw-alias-bg-mask-2": "rgba(26,48,73,0.12)",
      "--dsw-alias-bg-mask-3": "rgba(26,48,73,0.48)",
      "--dsw-alias-bg-mask-drop": "rgba(26,48,73,0.06)",
      "--dsw-alias-bg-mask-photo": "rgba(20,26,33,0.88)",
      "--dsw-alias-border-l1": "rgba(243,126,99,0.18)",
      "--dsw-alias-border-l2": "rgba(243,126,99,0.29)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(243,126,99,0.18)",
      "--dsw-alias-border-l3": "rgba(243,126,99,0.29)",
      "--dsw-alias-border-l4": "rgba(243,126,99,0.39)",
      "--dsw-alias-border-inverted": "rgba(255,255,255,0.10)",
      "--dsw-alias-border-inverted2": "rgba(255,255,255,0.16)",
      "--dsw-alias-label-primary": "#1A3049",
      "--dsw-alias-label-secondary": "#3C4F60",
      "--dsw-alias-label-tertiary": "#5F6D76",
      "--dsw-alias-label-caption": "#717D81",
      "--dsw-alias-label-dimmed": "#858E8D",
      "--dsw-alias-label-primary-dimmed": "#3C4F60",
      "--dsw-alias-label-primary-bluish": "#1A3049",
      "--dsw-alias-label-primary-foreground": "#FFFFFF",
      "--dsw-alias-label-primary-inverted": "#FDF6EC",
      "--dsw-alias-brand-primary": "#F37E63",
      "--dsw-alias-brand-primary-invert": "#1A3049",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#F37E63",
      "--dsw-alias-brand-text": "#A8432A",
      "--dsw-alias-state-business-primary": "#A8432A",
      "--dsw-alias-state-business-tertiary": "rgba(243,126,99,0.10)",
      "--dsw-alias-button-primary-fill": "#1A3049",
      "--dsw-alias-button-primary-hover": "#091E36",
      "--dsw-alias-button-primary-dimmed": "#C2A99C",
      "--dsw-alias-button-info-fill": "#A8432A",
      "--dsw-alias-button-info-hover": "#8E3620",
      "--dsw-alias-button-contrast-fill": "#1A3049",
      "--dsw-alias-button-elevated-fill": "#FFFBF3",
      "--dsw-alias-button-floating-fill": "rgba(255,251,243,0.92)",
      "--dsw-alias-button-floating-hover": "rgba(244,241,235,0.92)",
      "--dsw-alias-button-ghost-active-fill": "rgba(26,48,73,0.08)",
      "--dsw-alias-button-ghost-active-hover": "rgba(26,48,73,0.12)",
      "--dsw-alias-button-ghost-active-border": "rgba(243,126,99,0.30)",
      "--dsw-alias-button-tool-bar-fill": "rgba(255,251,243,0.92)",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(255,251,243,0)",
      "--dsw-alias-button-tool-bar-hover": "rgba(244,241,235,0.92)",
      "--dsw-alias-interactive-bg-hover": "rgba(26,48,73,0.05)",
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
      "--dsw-specific-bubble": "#F1EBE2",
      "--dsw-specific-bubble-highlight": "#F2ECE4",
      "--dsw-specific-input-major": "#FFFBF3",
      "--dsw-specific-login-input": "#FFFBF3",
      "--dsw-specific-selector": "#F9EEE2",
      "--dsw-specific-menu": "#FFFBF3",
      "--dsw-specific-tip": "#FFFBF3",
      "--dsw-specific-sidebar-fill": "#F9EEE2",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(26,48,73,0.05)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(26,48,73,0.08)",
      "--dsw-specific-sidebar-nav-item-active-accent": "#F37E63",
      "--dsw-alias-markdown-inline-code": "#EDE9E2",
      "--dsw-alias-markdown-code-block": "#F0E8E1",
      "--dsw-alias-markdown-code-block-banner": "#F2ECE4",
      "--dsw-alias-markdown-code-segment-selected": "#F2ECE4",
      "--dsw-alias-markdown-code-segment-unselected": "#F7EFE6",
      "--dsw-alias-markdown-citation": "rgba(243,126,99,0.10)",
      "--dsw-alias-markdown-tag": "rgba(243,126,99,0.14)",
      "--dsw-alias-markdown-placeholder": "#858E8D",
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
      "--dsw-alias-bg-layer-3": "#1C2830",
      "--dsw-alias-bg-overlay": "#30414B",
      "--dsw-alias-bg-skeleton": "#1C2830",
      "--dsw-alias-bg-module-platform": "#202C34",
      "--dsw-alias-bg-multi-select": "#202C34",
      "--dsw-alias-bg-mask-1": "rgba(0,0,0,0.34)",
      "--dsw-alias-bg-mask-2": "rgba(0,0,0,0.20)",
      "--dsw-alias-bg-mask-3": "rgba(0,0,0,0.55)",
      "--dsw-alias-bg-mask-drop": "rgba(12,18,22,0.55)",
      "--dsw-alias-bg-mask-photo": "rgba(0,0,0,0.88)",
      "--dsw-alias-border-l1": "rgba(230,177,196,0.18)",
      "--dsw-alias-border-l2": "rgba(230,177,196,0.25)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(230,177,196,0.22)",
      "--dsw-alias-border-l3": "rgba(230,177,196,0.30)",
      "--dsw-alias-border-l4": "rgba(230,177,196,0.39)",
      "--dsw-alias-border-inverted": "rgba(255,255,255,0.12)",
      "--dsw-alias-border-inverted2": "rgba(255,255,255,0.18)",
      "--dsw-alias-label-primary": "#F0F6FA",
      "--dsw-alias-label-secondary": "#D2DEE6",
      "--dsw-alias-label-tertiary": "#B7C8D3",
      "--dsw-alias-label-caption": "#AABECA",
      "--dsw-alias-label-dimmed": "#9EB4C1",
      "--dsw-alias-label-primary-dimmed": "#D2DEE6",
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
      "--dsw-alias-button-floating-fill": "rgba(38,52,61,0.94)",
      "--dsw-alias-button-floating-hover": "rgba(53,66,75,0.94)",
      "--dsw-alias-button-ghost-active-fill": "rgba(255,255,255,0.11)",
      "--dsw-alias-button-ghost-active-hover": "rgba(255,255,255,0.12)",
      "--dsw-alias-button-ghost-active-border": "rgba(230,177,196,0.36)",
      "--dsw-alias-button-tool-bar-fill": "rgba(38,52,61,0.94)",
      "--dsw-alias-button-tool-bar-fill-invisible": "rgba(38,52,61,0)",
      "--dsw-alias-button-tool-bar-hover": "rgba(53,66,75,0.94)",
      "--dsw-alias-interactive-bg-hover": "rgba(255,255,255,0.07)",
      "--dsw-alias-interactive-bg-active": "rgba(255,255,255,0.11)",
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
      "--dsw-specific-tip": "#30414B",
      "--dsw-specific-sidebar-fill": "#202C34",
      "--dsw-specific-sidebar-nav-item-hover": "rgba(255,255,255,0.07)",
      "--dsw-specific-sidebar-nav-item-active": "rgba(255,255,255,0.11)",
      "--dsw-specific-sidebar-nav-item-active-accent": "#E6B1C4",
      "--dsw-alias-markdown-inline-code": "#2E3F49",
      "--dsw-alias-markdown-code-block": "#2E3F49",
      "--dsw-alias-markdown-code-block-banner": "#3A4B56",
      "--dsw-alias-markdown-code-segment-selected": "#3A4B56",
      "--dsw-alias-markdown-code-segment-unselected": "#2E3F49",
      "--dsw-alias-markdown-citation": "rgba(185,226,255,0.12)",
      "--dsw-alias-markdown-tag": "rgba(230,177,196,0.16)",
      "--dsw-alias-markdown-placeholder": "#9EB4C1",
      "--dsw-alias-scrollbar-bg-l1": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-bg-l2": "rgba(0,0,0,0)",
      "--dsw-alias-scrollbar-hover-l1": "#3A4B56",
      "--dsw-alias-scrollbar-hover-l2": "rgba(230,177,196,0.36)",
      "--dsw-alias-tooltip-bg": "#1A242B",
      "--dsw-alias-toast-bg": "#F1BEAD",
    };

    /* ═══════════════════════════════════════════════════════════════════
       L1c · NAMES THE SHIPPED UI READS THAT THE CONTRACT DOES NOT DECLARE

       The 89 names above are what ui-theme 0.1.2-rc.1 DECLARES, and this theme
       used to treat anything outside them as a silent no-op. That reasoning has
       a measured exception. Shipped UI in `@deepseek-ai/dsh-client-ui-*` READS
       eight more names, and most of those reads have NO `var()` fallback:

         .sourceLink { color: var(--dsw-alias-link) }     WebBlock.module.css

       With no fallback the declaration is invalid at computed-value time, so
       declining the name does not "fall back to the harness default" -- the
       property disappears and the link renders as plain body text. That is
       strictly worse than a no-op, and a scan of declarations alone cannot see
       it. tools/refresh-allowlist.mjs now scans the REFERENCE side too and
       records these under `consumedNotRegistered`; test/tokens.test.js requires
       every palette to supply each one, so the fix cannot be quietly dropped.

       None of them introduces a colour. Each is BOUND to a role the palette
       already defines, so there is no second value to keep in step and the
       binding is asserted rather than remembered. This also settles a claim the
       L1 header used to make: it named `label-error` and `separator-primary` as
       deliberate absences because ui-theme "neither declares nor consumes"
       them. The declaration half is true; the consumption half is not. The grep
       behind it covered the frontend bundle but not the individual
       `dsh-client-ui-*` packages, which is where both names are read.
       ═══════════════════════════════════════════════════════════════════ */
    var BOUND_ALIASES = {
      /* Links: the palette's accent-as-text role. */
      "--dsw-alias-link": "--dsw-alias-brand-text",
      /* Form validation ink and border, on an invalid settings input. */
      "--dsw-alias-label-error": "--dsw-alias-state-error-primary",
      /* A disabled control's ink: the faintest text stop. */
      "--dsw-alias-label-quaternary": "--dsw-alias-label-dimmed",
      /* The middot between chat rows. Painted as `color`, so it wants a faint
         rule's ink rather than a surface. */
      "--dsw-alias-separator-primary": "--dsw-alias-border-l1",
      /* The same role as state-warn-primary, under a second spelling. */
      "--dsw-alias-state-warning-primary": "--dsw-alias-state-warn-primary",
      /* A default border, read by the market's own sheet with a Tailwind grey
         (`#e5e7eb`) as its fallback. Supplied anyway: falling back is only
         better than nothing, and a chroma-0 grey rule inside a warm paper
         palette is exactly the seam this theme exists to remove. */
      "--dsw-alias-border-default": "--dsw-alias-border-l1",
      /* A hover surface one level above layer-3. */
      "--dsw-alias-bg-layer-4": "--dsw-alias-interactive-bg-hover-solid",
      /* Two spellings of a muted chip fill. THIS PAIR IS A JUDGEMENT, not a
         derivation: each read has no fallback, so the chip currently paints no
         background at all, and the recessed surface is the nearest role the
         palette already carries. Revisit if a chip ever has to sit on
         layer-3 itself, where it would become invisible. */
      "--dsw-alias-fill-l2": "--dsw-alias-bg-layer-3",
      "--dsw-alias-fill-tsp-secondary": "--dsw-alias-bg-layer-3"
    };

    (function bindAliases() {
      var tables = [PAPER, MIDNIGHT, CORAL, VIVID];
      Object.keys(BOUND_ALIASES).forEach(function (name) {
        var source = BOUND_ALIASES[name];
        for (var i = 0; i < tables.length; i += 1) {
          var table = tables[i];
          /* A missing source means the binding is stale and the palette would
             silently gain a declaration with no value -- the exact failure this
             block exists to remove. Fail at load, where it is loud. */
          if (typeof table[source] !== "string") {
            throw new Error(NAME + ": " + name + " is bound to " + source +
              ", which that palette does not define");
          }
          table[name] = table[source];
        }
      });
    }());

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
      "--shiki-background": "#E9E7DE",
      "--shiki-token-constant": "#155D9E",
      "--shiki-token-string": "#237532",
      "--shiki-token-string-expression": "#20662E",
      "--shiki-token-comment": "#616970",
      "--shiki-token-keyword": "#A3214E",
      "--shiki-token-parameter": "#AB4209",
      "--shiki-token-function": "#4523AE",
      "--shiki-token-punctuation": "#363B40",
      "--shiki-token-link": "#12538F"
    };

    var SHIKI_MIDNIGHT = {
      "--shiki-foreground": "#E1EAF0",
      "--shiki-background": "#495863",
      "--shiki-token-constant": "#9CD1FB",
      "--shiki-token-string": "#ACEBB6",
      "--shiki-token-string-expression": "#BFF3C7",
      "--shiki-token-comment": "#D2D6DA",
      "--shiki-token-keyword": "#FCCCDD",
      "--shiki-token-parameter": "#FFCF9C",
      "--shiki-token-function": "#D4C5FD",
      "--shiki-token-punctuation": "#E4E7EB",
      "--shiki-token-link": "#B2DCFD"
    };

    var SHIKI_CORAL = {
      "--shiki-foreground": "#1A3049",
      "--shiki-background": "#F0E8E1",
      "--shiki-token-constant": "#155EA0",
      "--shiki-token-string": "#237633",
      "--shiki-token-string-expression": "#20672E",
      "--shiki-token-comment": "#636A72",
      "--shiki-token-keyword": "#A5214F",
      "--shiki-token-parameter": "#AE4309",
      "--shiki-token-function": "#4623B0",
      "--shiki-token-punctuation": "#373C41",
      "--shiki-token-link": "#135591"
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

    /* The seal's glyph and face. A single character, drawn as text: no font is
       bundled (the plugin ships zero binary assets) so this rides the same
       system serif stack the reading typography uses, and falls back to
       whatever serif the platform has. The glyph is 花 — the first character of
       the skin's own name — which reads as a maker's mark rather than a logo. */
    var SEAL_GLYPH = "花";
    /* The seal's two colours, named once. They are not a new pair: this is
       exactly assertion #7 in test/contrast.test.js (label on a filled primary
       button), already verified at or above 4.5:1 in every palette. A seal that
       invented its own colours would need its own contrast argument; naming the
       pair here is what lets the suite CHECK that it has one. */
    var SEAL_COLORS = {
      fill: "--dsw-alias-button-primary-fill",
      ink: "--dsw-alias-label-primary-foreground"
    };
    var SEAL_FONT = "Georgia, 'Times New Roman', 'Source Han Serif SC'," +
      " 'Noto Serif CJK SC', 'Songti SC', 'STSong', 'Noto Serif', 'SimSun', serif";

    /* React arrives either as a global or through the module loader's require,
       depending on which runner loaded this bundle. Resolved in one place,
       because two copies of this dance would eventually disagree — and the
       failure is a silently blank panel rather than an error. */
    function reactOf() {
      if (typeof React !== "undefined" && React) return React;
      try {
        if (typeof require === "function") return require("react");
      } catch (e) {
        /* no React available */
      }
      return null;
    }

/* ── the seal ──────────────────────────────────────────────────────
   The one place this theme replaces shipped UI, and it is OFF by default.

   HanaAgent's design language has a single sentence that no amount of
   re-colouring can express — 「人用的控件是纸上盖的印章」, the controls a
   person uses are the seals stamped on the paper — and until now that
   idea was only ever cashed in as `border-radius: 2px`. This is the seal.

   `sidebar.brand.mark` is the sanctioned seat for it: a `single` slot
   whose own contract reads "deployments may replace the shell's fish
   fallback without replacing the surrounding controls". It is also
   `shadows-shipped-ui`, which is exactly why it is opt-in — replacing
   someone's logo is an opinion, and this plugin's whole stance is that
   installing it must not impose one.

   The colours are not new: --dsw-alias-button-primary-fill against
   --dsw-alias-label-primary-foreground is assertion pair #7 in
   test/contrast.test.js, verified at or above 4.5:1 in every palette. A
   seal that reused no verified pair would need its own contrast argument;
   reusing the filled-button pair means it has one already.

   Drawn with a glyph and a border, not an image: the plugin's
   zero-binary-asset property is worth more than a slightly nicer mark. */
function renderSeal(props) {
  var R = reactOf();
  if (!R) return null;
  var size = props && typeof props.size === "number" ? props.size : 20;
  return R.createElement(
    "div",
    {
      "aria-hidden": "true",
      "translate": "no",
      className: "notranslate",
      style: {
        width: size + "px",
        height: size + "px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "2px",
        background: "var(" + SEAL_COLORS.fill + ")",
        color: "var(" + SEAL_COLORS.ink + ")",
        fontFamily: SEAL_FONT,
        fontSize: Math.round(size * 0.66) + "px",
        lineHeight: "1",
        userSelect: "none"
      }
    },
    SEAL_GLYPH
  );
}

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

    /* ── the paper-texture veto ───────────────────────────────────────────
     *
     * HanaAgent does not merely restyle the grain in its dark themes: it does
     * not apply it at all. `shared/theme-registry-data.json` carries
     *
     *     "paperTextureBlockedThemeIds": ["midnight", "midnight-contrast"]
     *
     * and `isPaperTextureEffectivelyEnabled()` is `enabled && !blocked`, so the
     * `body.paper-texture` class is never even added. The settings switch is
     * shown DISABLED with a different hint rather than silently off
     * (locales/zh.json): 「黑夜模式不支持纸质纹理，切回浅色主题后会按原设置恢复」 --
     * the stored preference is left untouched so it comes back unchanged.
     *
     * We key on `scheme` rather than on a list of ids. The reference needs a
     * literal list because its registry is a literal table; ours already
     * carries `scheme` per palette, so a fifth palette is vetoed BY
     * CONSTRUCTION instead of by somebody remembering to append it. */
    function textureAllowed(paletteId) {
      var def = paletteById(paletteId);
      return def === null ? true : def.scheme !== "dark";
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
      "  --hana-paper-grain: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.64' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\");",
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
      "  border: 0.5px solid var(--dsw-alias-border-l1);",
      "  overflow-wrap: anywhere;",
      "}",
      "",
      "/* ---- L3: 分面 — what is a card, and what is prose ----",
      "   A user review of the shipped theme put it plainly: the model's prose, its",
      "   tool calls, the artifacts it produces and the controls at the end of a turn",
      "   all read as one undifferentiated stream. Measured against the ground, that",
      "   was literal — 纸本 separated its surfaces by 1.003-1.015, which is not",
      "   \"restrained\", it is absent (see the L1 surface ladder and",
      "   tools/derive-surfaces.mjs).",
      "",
      "   THE HOOKS ARE SEMANTIC, NOT HASHED. Each one below was read out of the",
      "   installed client bundles and confirmed to be RENDERED, not merely present in",
      "   the source. None is a build-hash class (judgements 5/16 forbid those), and",
      "   none is a data attribute the harness uses for its own styling — the four",
      "   below carry 0-1 rules of the harness's own:",
      "",
      "     [data-turn-process-member]   one flow item INSIDE the process window: a",
      "                                  tool call, a reasoning step. Absent when the",
      "                                  turn is not foldable.",
      "     [data-turn-process-answer]   the answer flow item. Mutually exclusive",
      "                                  with the above, which is what makes the",
      "                                  prose/card split exact rather than heuristic.",
      "     [data-produced-files-row]    an artifact row.",
      "     [data-turn-tail]             the end of a turn: timing, usage and the",
      "                                  copy / vote controls.",
      "",
      "   GEOMETRY IS DELIBERATELY MINIMAL, and the reason is that this theme is",
      "   developed without a live view of the running GUI. A card needs to sit on",
      "   the reading column, and prose must NOT jog sideways because its neighbour",
      "   grew a border. So the card bleeds outward by exactly the padding it adds",
      "   (negative inline margin + equal inline padding), which keeps every content",
      "   edge on the column. That claim is not asserted in a comment:",
      "   test/verify/render-check.mjs lays out a prose item and a card item in a real",
      "   engine and compares their measured content edges. */",
      "/* THE PROCESS WINDOW IS ONE WASH, NOT A STACK OF CARDS. The first",
      "   revision boxed every flow item -- fill, hairline, radius, shadow -- which",
      "   turned each tool call into its own card and made a one-line summary the",
      "   loudest thing on the page. HanaAgent's own chat does the opposite:",
      "   --tool-bg rgba(26,48,73,0.03) is painted once behind the process",
      "   region and the items inside stay unboxed. That is the split this theme",
      "   was reaching for all along -- prose on bare paper, process on a tinted",
      "   one -- and the tint is what carries it, not a border.",
      "",
      "   The wash is DERIVED, not transcribed: color-mix of the palette's own ink",
      "   at 3% reproduces HanaAgent's --tool-bg for all four ports, because the",
      "   ink is rgb(26,48,73) in coral, near-black in paper and near-white in the",
      "   two midnight palettes -- exactly the light/dark split HanaAgent writes",
      "   out by hand. test/contrast.test.js pins the relationship (the mix source",
      "   and the percentage), so the wash cannot drift into a second, unmanaged",
      "   copy of a colour.",
      "",
      "   The negative inline margin with an equal padding is load-bearing: the wash",
      "   bleeds past the reading column while every content edge stays exactly",
      "   where prose puts it. */",
      "body[" + BODY_ATTR + "] {",
      "  --hana-wash: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent);",
      "}",
      "body[" + BODY_ATTR + "] [data-turn-process-member] {",
      "  --hana-wash-pad: 10px;",
      "  margin-inline: calc(-1 * var(--hana-wash-pad));",
      "  padding-inline: var(--hana-wash-pad);",
      "  background: var(--hana-wash);",
      "}",
      "/* A tool call keeps the wash's own surface: the harness would otherwise draw",
      "   a bg-base card here, and a ground-coloured card inside the wash reads as a",
      "   hole punched through it. The code and terminal panels the harness draws",
      "   INSIDE that card have their own surface and hairline, and keep both. */",
      "body[" + BODY_ATTR + "] [data-turn-process-member] [data-tool] {",
      "  background: none;",
      "  border: none;",
      "  box-shadow: none;",
      "  margin-inline: 0;",
      "  padding: 0;",
      "}",
      "",
      "/* THE COLLAPSED ONE-LINER IS ALSO THE WASH, and it was the gap. A tool call",
      "   has two presentations, and the first pass styled only one of them:",
      "",
      "     expanded    [data-turn-process-member] — the flow items inside the",
      "                 process, handled above.",
      "     collapsed   TurnProcessNodeView .root — a <button> carrying",
      "                 [data-turn-process-tool-calls], which the harness paints",
      "                 with background: 0 0 and a .5px BOTTOM border. A",
      "                 full-width transparent row with a rule under it reads as a",
      "                 horizontal separator, and that is exactly why the first",
      "                 pass was invisible to the eye: the presentation on screen",
      "                 most of the time was never touched.",
      "",
      "   HanaAgent's own fold summary is the answer to what it should be: it takes",
      "   the SAME 3% wash as the region it opens, with border: 0, and squares",
      "   its bottom corners when open so the summary and the panel read as one",
      "   surface. So the bar gets the wash and no outline of its own, and the",
      "   harness's .5px bottom hairline is left to do the separating. height:",
      "   33px and the 8px bottom padding are the harness's; only padding-INLINE",
      "   and the paint change, so the row's vertical geometry is untouched. */",
      "body[" + BODY_ATTR + "] [data-turn-process-tool-calls] {",
      "  --hana-bar-pad: 10px;",
      "  margin-inline: calc(-1 * var(--hana-bar-pad));",
      "  width: auto;",
      "  padding-inline: var(--hana-bar-pad);",
      "  background: var(--hana-wash);",
      "}",
      "",
      "/* The artifact row is its own thing: not prose, not a tool call. It bleeds",
      "   by its own padding and border for the same reason the card does — an",
      "   inset row would put the artifact list's left edge somewhere nothing else",
      "   on the page uses. */",
      "body[" + BODY_ATTR + "] [data-produced-files-row] {",
      "  --hana-chip-pad: 8px;",
      "  --hana-chip-edge: 0.5px;",
      "  margin-inline: calc(-1 * (var(--hana-chip-pad) + var(--hana-chip-edge)));",
      "  background: var(--dsw-alias-bg-layer-3);",
      "  border: var(--hana-chip-edge) solid var(--dsw-alias-border-l1);",
      "  border-radius: 4px;",
      "  padding: 4px var(--hana-chip-pad);",
      "}",
      "",
      "/* The end of a turn: a rule above it says \"the answer is over, this is",
      "   apparatus\". The controls themselves drop to tertiary ink, because they are",
      "   furniture and the prose is the content. */",
      "body[" + BODY_ATTR + "] [data-turn-tail] {",
      "  border-top: 0.5px solid var(--dsw-alias-border-l1);",
      "  padding-top: 8px;",
      "  color: var(--dsw-alias-label-tertiary);",
      "}",
      "body[" + BODY_ATTR + "] [data-turn-tail] button {",
      "  color: var(--dsw-alias-label-tertiary);",
      "}",
      "body[" + BODY_ATTR + "] [data-turn-tail] button:hover {",
      "  color: var(--dsw-alias-label-primary);",
      "}",
      "",
      "/* ---- L3: 选中 — a selected row is not a hovered one ----",
      "   The workspace list paints them with the SAME declaration:",
      "",
      "     .sessionRow:hover, .sessionRow.selected {",
      "       background: var(--dsw-alias-interactive-bg-hover) }",
      "",
      "   so \"selected\" and \"the pointer is over it\" are literally the same pixels,",
      "   and both are a 4% ink wash away from unselected. The second user review",
      "   named this directly: 左侧会话选择栏 needs 选中与非选中的差异. It is not a",
      "   colour that needed tuning; there was no second state to tune.",
      "",
      "   THE CLASS IS A BUILD HASH (ozLDBG_selected), so it cannot be named. The",
      "   row also renders role=\"treeitem\" and aria-selected, and the settings",
      "   nav renders aria-current — semantic attributes the harness exposes and",
      "   does not style on. body[data-hana-theme] [role=treeitem][aria-selected=true]",
      "   is (0,3,1) against the module's (0,2,0), so it wins without !important, and",
      "   it also beats the :hover rule, which means a selected row stays visibly",
      "   selected while the pointer crosses it.",
      "",
      "   Deliberately NOT scoped to the sidebar: any tree selection gets this, so",
      "   \"selected\" looks the same wherever the user meets it. An ancestor hook",
      "   would have to be guessed, and guessing is what the hash rule already",
      "   forbids. */",
      "body[" + BODY_ATTR + "] [role='treeitem'][aria-selected='true'],",
      "body[" + BODY_ATTR + "] [aria-current='true'] {",
      "  background: var(--dsw-alias-bg-layer-3);",
      "  box-shadow: inset 3px 0 0 0 var(--dsw-alias-state-business-primary);",
      "  color: var(--dsw-alias-label-primary);",
      "  font-weight: 500;",
      "}",
      "/* The wash the harness uses for hover is translucent ink over whatever is",
      "   behind it, so on the selected row it would muddy the accent bar rather",
      "   than sitting under it. The selected row keeps its own surface. */",
      "body[" + BODY_ATTR + "] [role='treeitem'][aria-selected='true']:hover {",
      "  background: var(--dsw-alias-bg-layer-3);",
      "}",
      "",
      "/* ---- L3: paper grain (opt-in, default off; vetoed in the dark palettes) ----",
      "   ONE full-viewport layer, not a background-image painted onto each panel.",
      "",
      "   The reference's model is THREE layers, and they all live in slots DSH has",
      "   closed. Its ① surface grain and ② card grain are each painted onto the",
      "   element's OWN background-image (behind its content); its ③ compensation",
      "   plate sits at z-index: -1, above the canvas and below the panels. DSH",
      "   paints the ground at the FRAME, not on body --",
      "   dsh-client-ui-layout AppFrame.module.css has",
      "       ._1qAH1q_frame { background: var(--dsw-alias-bg-base); height: 100%; }",
      "   and a negative-z-index layer paints BELOW an in-flow block-level",
      "   descendant's background, so any layer in that slot is covered by the frame",
      "   (as are .uPhUma_root, .eAf-nq_root and .isi5dq_panel, each repainting its",
      "   own column). The only slot left is ABOVE the content, which the reference",
      "   never uses. See docs/plan-paper-texture.md §3.",
      "",
      "   ② is doubly out of reach and would be redundant anyway:",
      "   background-blend-mode: lighten is max(card, grain), and the grain",
      "   (192,182,166) is darker than every one of the reference's seven usable",
      "   card colours -- so the blend returns the card UNCHANGED. Its real job is to",
      "   guarantee the grain can never darken a card, which soft-light gives us for",
      "   free.",
      "",
      "   soft-light around mid-grey is what makes this safe: for a blend colour of",
      "   exactly 0.5 the W3C soft-light function returns the backdrop unchanged, and",
      "   fractalNoise is distributed symmetrically about 0.5, so the layer perturbs",
      "   local luminance without shifting it. That is why ③ is not ported either: it",
      "   exists to cancel a darkening that does not happen here. The reference's own",
      "   grain composites normally and pulls its paper ground down by 13-15/255, and",
      "   its scrim lifts 62-79% of that back; ours would be a flat +4/+5/+7 lift, a",
      "   palette change rather than a compensation. tools/derive-grain.mjs recomputes",
      "   that chain every run and prints the compensation that WOULD be needed if",
      "   this neutrality ever broke.",
      "",
      "   THE VETO IS EXPRESSED TWICE, on purpose. The client writes",
      "   data-hana-texture='off' for a dark palette (textureAllowed), and the rule",
      "   below is keyed on the palettes that may carry grain at all. The second copy",
      "   is not redundant with the first: the two body attributes are written in the",
      "   same reconcile pass, one after the other, so a throw between them would",
      "   render a dark palette WITH grain. Keying the rule on the palette attribute",
      "   makes the screen depend on one attribute instead of two agreeing.",
      "   HanaAgent guards its ③ the same way (html:not([data-theme=midnight])...).",
      "",
      "   z-index is deliberately the maximum: the grain belongs to the paper, so it",
      "   stays above modals and toasts for a uniform surface. It is inert to input",
      "   (pointer-events: none) and creates no interactive surface. */",
      "body[" + BODY_ATTR + "='paper'][" + TEXTURE_ATTR + "='on']::after,",
      "body[" + BODY_ATTR + "='coral'][" + TEXTURE_ATTR + "='on']::after {",
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
      "   HanaAgent treats geometry as a THEME DIMENSION: new-warm-paper.css:62-69",
      "   overrides the global radius scale (styles.css:33-44) and its header names",
      "   the rule 「极方圆角 + 0.5px hairline」 / 「controls are seals, 方」, applied to",
      "   the WHOLE app rather than one page.",
      "",
      "   DSH has no radius token at all, and that is measured, not assumed: 256",
      "   border-radius declarations across 35 packages, ZERO of which read a custom",
      "   property, and 254 of 256 keyed on a build hash that judgements 5/16 forbid",
      "   naming (tools/scan-geometry.mjs, test/geometry-sites.json). The reference's",
      "   one-token override therefore has no counterpart here. This cannot be done by",
      "   SELECTING sites; it has to be done by CLAMPING globally.",
      "",
      "   TWO LEVERS, because neither alone equals the reference:",
      "     L1 changes the corner SHAPE. DSH drives corner-shape from ONE property",
      "        applied to every element and pseudo-element -- the same one-property-",
      "        drives-everything mechanism HanaAgent uses for RADIUS; DSH merely aimed",
      "        it at shape instead. superellipse(1.5) is SOFTER than a circle, so",
      "        raising the exponent moves toward 方: round is the conservative first",
      "        step and superellipse(3) the next experiment. DSH's own 52 component-",
      "        level corner-shape opt-outs keep its genuinely-round elements circular",
      "        for free -- no preservation list of ours is involved.",
      "     L2 changes the radius MAGNITUDE, and it must WIN ON SPECIFICITY because",
      "        judgement 1 of test/check.js forbids !important. The arithmetic is",
      "        therefore load-bearing, so it is measured rather than guessed: of the",
      "        269 DSH radius selectors, 239 are single-class (0,1,0), 19 are (0,2,0),",
      "        5 are (1,1) and exactly THREE reach (3,0). The clamp below is written to",
      "        reach (0,3,1) so it clears all of them, which is why the compound rules",
      "        carry a redundant [class]: it is not decoration, it is one specificity",
      "        point. The control and image tiers must then outrank the UNIVERSAL,",
      "        which is already (0,3,1) -- so they carry it too and land at (0,3,2).",
      "        Left at (0,2,2) the universal would have beaten them and every button",
      "        would have taken the medium radius.",
      "",
      "   The tiers ARE the reference's scale, named once so a gate can hold them to",
      "   it: --radius-sm 2px, --radius-md/--radius-card 3px, --radius-lg and",
      "   --radius-chat-card 4px, and --radius-chat-surface 6px for the composer --",
      "   the single softness HanaAgent keeps on purpose (new-warm-paper.css:67).",
      "",
      "   WHAT THIS COSTS, counted rather than assumed. Of the 45 circle/pill sites:",
      "   the 21 round controls and 13 badges SHOULD square, because the reference's",
      "   own chips are 2px and its rule is 「controls are seals, 方」; the 10 status",
      "   dots are small enough that a 3px clamp still reads as a dot; the one image",
      "   thumbnail is preserved below. An earlier revision rejected a blanket reset",
      "   here on the grounds that squaring badges, rails and credential dots and then",
      "   putting them back 'would mean guessing hashed class names'. That reasoning is",
      "   sound and still holds for anything round AND large -- but the decision was",
      "   made WITHOUT an inventory, and the inventory says the loss is one site, not",
      "   a family. */",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] {",
      "  --dsw-corner-shape: round;",
      "  --hana-seal-radius: 3px;",
      "  --hana-seal-radius-sm: 2px;",
      "  --hana-seal-radius-lg: 4px;",
      "  --hana-seal-radius-input: 6px;",
      "}",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] *,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] :before,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] :after,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] *[class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [class]:before,",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [class]:after {",
      "  border-radius: var(--hana-seal-radius);",
      "}",
      "/* Small controls take --radius-sm. Listed by element and role rather than by",
      "   class, so this stays a statement about what the control IS. */",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] button[class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] input[class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] select[class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] textarea[class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [role='button'][class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [role='tab'][class] {",
      "  border-radius: var(--hana-seal-radius-sm);",
      "}",
      "/* Imagery keeps the reference's larger stop -- the one family where squaring",
      "   costs something real, and the only one a structural selector can name. */",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] img[class],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [role='img'][class] {",
      "  border-radius: var(--hana-seal-radius-lg);",
      "}",
      "/* HanaAgent's one deliberate exception: the composer keeps a little softness. */",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [data-composer-card],",
      "body[" + BODY_ATTR + "][" + SHAPE_ATTR + "='seal'] [data-composer-card][class] {",
      "  border-radius: var(--hana-seal-radius-input);",
      "}",
      "",

      "/* ---- L3: 焦点墨环 (opt-in, default accent) ----",
      "   HanaAgent deletes the DEFAULT focus ring globally and then draws its own",
      "   per component. Both halves are in its source, and a port that takes only",
      "   the first is a port of a bug:",
      "",
      "     styles.css:288   :focus, :focus-visible { outline: none !important; }",
      "     ui/Button.module.css  .btn:focus-visible { outline: 2px solid var(--accent);",
      "                                                    outline-offset: 2px; }",
      "",
      "   and its own vitest (react/__tests__/styles/focus-ring.test.ts) asserts the",
      "   global kill EXISTS and that no outline: 2px solid var(--accent) global",
      "   rule was added back. So the reference is not an app without focus rings --",
      "   it is an app where the ring is the THEME'S ACCENT and nothing else. Every",
      "   :focus rule it owns uses one colour: found 29 border-color: var(--accent)",
      "   substitutions, and where a ring IS drawn it is 1px or 2px solid var(--accent)",
      "   with outline-offset +/-2px.",
      "",
      "   DSH's ring geometry is already that geometry -- it ships 1px and 2px rings",
      "   with offsets of +/-2px. The divergence is the COLOUR, and it is measured:",
      "   31 declarations, ALL of them keyed on a build hash (none reachable by the",
      "   hash-free selectors judgements 5/16 demand), in FIVE different colour",
      "   families -- state-business-primary x21, brand-primary x5, label-tertiary x2,",
      "   button-info-fill, state-warn-label. Under 珊瑚 those are #A8432A (deep",
      "   vermillion) and #F37E63 (coral, 2.45:1 -- below the 3:1 that WCAG 1.4.11",
      "   asks of a non-text indicator). That pair is the 橙框, and it is the whole",
      "   of what is wrong: the reference's own coral theme rings in INK BLUE",
      "   #1A3049, and keeps #F37E63 for --coral, its lines and tints.",
      "",
      "   WHAT IS CHANGED HERE IS THEREFORE ONE PROPERTY, outline-color:",
      "     · nothing that has no ring grows one -- outline-color is inert while",
      "       outline-style is none, so this cannot invent an indicator;",
      "     · the reference's own token is named, not its literal, wherever our",
      "       palette already carries it. Paper's brand-primary IS #537D96, midnight's",
      "       IS #C99AAF and vivid's IS #E6B1C4 -- the reference's --accent triples,",
      "       digit for digit. Only 珊瑚 has no such token: its brand plate is the",
      "       coral and its --accent landed in button-primary-fill, so that one",
      "       palette is named separately below. tools/derive-focus.mjs binds the",
      "       reference accent to whichever TOKEN each rule names, so re-pointing",
      "       brand-primary fails the gate instead of silently re-colouring focus.",
      "",
      "   THE SPECIFICITY IS LOAD-BEARING, because judgement 1 forbids !important.",
      "   Measured ceiling across all 31 rules is (0,3,0), and none of them carries",
      "   !important, so the two attributes + body below reach (0,3,1) and clear",
      "   it. The other 30 sit at (0,2,0) and would lose to a single attribute too",
      "   -- the second attribute is paid for by exactly one rule.",
      "",
      "   :focus-visible * is not decoration either. Exactly one DSH rule paints a",
      "   ring on a DESCENDANT of the focused element",
      "   (._6nu5Ca_memberButton:focus-visible ._6nu5Ca_memberLabelWrap), which",
      "   :focus-visible alone never matches; without the descendant selector that",
      "   one ring would keep the old colour.",
      "",
      "   NOT PORTED, deliberately: the reference's commonest move, a global",
      "   border-color: var(--accent). Its 29 instances are PER-COMPONENT -- each",
      "   sits on a control the author knew had a border. Written globally it would",
      "   also recolour the borders that carry STATE (a failed validation, a danger",
      "   row's left rail), and DSH already gives its inputs their own focus idiom",
      "   (32 outline: none rules, each paired with its own :focus border change).",
      "   The reference's move has no global form here, so it is left out rather",
      "   than half-applied. */",
      "body[" + BODY_ATTR + "][" + FOCUS_ATTR + "='accent'] {",
      "  --hana-ring: var(--dsw-alias-brand-primary);",
      "}",
      "body[" + BODY_ATTR + "='coral'][" + FOCUS_ATTR + "='accent'] {",
      "  --hana-ring: var(--dsw-alias-button-primary-fill);",
      "}",
      "body[" + BODY_ATTR + "][" + FOCUS_ATTR + "='accent'] :focus-visible,",
      "body[" + BODY_ATTR + "][" + FOCUS_ATTR + "='accent'] :focus-visible * {",
      "  outline-color: var(--hana-ring);",
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

      /* Resolved HERE, not next to the settings panel that also uses it.
         `var` hoisting makes a later assignment read as `undefined` at every
         earlier call site, and reconcile() runs before that point — so a slot
         lookup placed beside the panel would silently see nothing on the first
         pass and the seal would only appear after some unrelated re-render.
         Same trap as SCALE_DEFAULT, so it gets the same treatment: read first,
         use later, assert the ordering in check.js. */
      var slots = ctx.get("slots");

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
        body.removeAttribute(FOCUS_ATTR);
        body.classList.remove(SERIF_CLASS);
        body.style.removeProperty(SERIF_SCALE_VAR);
        body.style.removeProperty(GRAIN_VAR);
        clearShiki();
        clearBrandMark();
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

      /* Registered lazily and released eagerly, so the two states are one
         boolean rather than two code paths that can disagree. Idempotent by the
         same identity check the override layer uses. */
      var brandDispose = null;
      function applyBrandMark(claimed) {
        var want = claimed !== null && prefs.isOn("sealMark");
        if (want === (brandDispose !== null)) return;
        if (brandDispose !== null) {
          clearBrandMark();
          return;
        }
        if (slots === undefined || typeof slots.inject !== "function") return;
        if (typeof slots.register !== "function") return;
        try {
          brandDispose = slots.inject("sidebar.brand.mark", function () {
            return slots.register({ name: "sidebar.brand.mark" }, renderSeal);
          });
        } catch (e) {
          // A composition without that slot keeps the theme; it just has no seal.
          brandDispose = null;
        }
      }

      function clearBrandMark() {
        if (brandDispose === null) return;
        try {
          brandDispose();
        } catch (e) {
          /* ignore */
        }
        brandDispose = null;
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
        /* Which palette owns the colours: the ACTIVE one if a hana theme is
           selected, otherwise the remembered one. Named once because four
           decisions below depend on it, and because the veto needs the same
           answer the body attribute gets -- reading it twice from two
           expressions is how the two could ever disagree on screen. */
        var claimant = active === null ? stored : active;
        body.setAttribute(BODY_ATTR, claimant.replace("hana-", ""));
        applyShiki(claimant);
        applyBrandMark(claimant);
        if (prefs.isOn("serif")) body.classList.add(SERIF_CLASS);
        else body.classList.remove(SERIF_CLASS);
        // Inline, not in the sheet: the sheet carries only the default, and
        // inline wins over it, which is exactly what we want and avoids needing
        // !important to out-rank our own rule.
        body.style.setProperty(SERIF_SCALE_VAR, preferredScale());
        /* Vetoed in the dark palettes -- see textureAllowed(). The attribute is
           still written, as "off", rather than left stale: a missing attribute
           and an "off" one mean the same thing to the sheet today, but only one
           of them is honest about WHY there is no grain. */
        body.setAttribute(TEXTURE_ATTR, prefs.isOn("paperTexture") && textureAllowed(claimant) ? "on" : "off");
        body.setAttribute(SHAPE_ATTR, prefs.get("shape") === "seal" ? "seal" : "soft");
        body.setAttribute(FOCUS_ATTR, prefs.get("focus") === "native" ? "native" : "accent");
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
                var R = reactOf();
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
                /* The veto, as the settings panel sees it. Note what this does
                   NOT do: it does not touch the stored preference. HanaAgent's
                   hint promises 「切回浅色主题后会按原设置恢复」, and that promise
                   is kept by leaving the value alone -- writing '0' here would
                   silently destroy the user's choice the moment they switched to
                   a dark palette. The panel re-renders on every palette change,
                   so the switch re-enables itself. */
                var textureBlocked = active !== null && !textureAllowed(active);

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
                        textureBlocked
                          ? "黑夜模式不支持纸质纹理，切回浅色主题后会按原设置恢复。"
                          : "整屏叠一层极淡的纸纹（程序化 SVG，约 410 字节，无图片资源）。" +
                            "用 soft-light 混合，在中间灰附近不改动整体明度，所以正文对比度不会被拉低。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        /* Shown OFF and DISABLED while a dark palette is active,
                           not merely off: HanaAgent does the same (InterfaceTab
                           passes `on={blocked ? false : enabled} disabled={blocked}`),
                           and the difference is the user's whole understanding of
                           whether their switch is broken or inapplicable. */
                        checked: !textureBlocked && prefs.isOn("paperTexture"),
                        disabled: textureBlocked,
                        onChange: textureBlocked ? undefined : toggle("paperTexture"),
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
                          disabled: textureBlocked || !prefs.isOn("paperTexture"),
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
                        "按参考实现的几何刻度收拢整个界面：控件与输入 2px、面板与卡片 3px、" +
                          "图片 4px，输入区按参考保留 6px；角形同时从 DSH 默认的软超椭圆修回正圆。" +
                          "注意这是全局的：徽标、圆形图标按钮会一起变方（参考里它们的圆角本来也是 2px），" +
                          "状态点因为尺寸小仍看得出是圆点。"
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
                    { style: rowStyle },
                    R.createElement(
                      "div",
                      null,
                      R.createElement("div", { style: titleStyle }, "焦点墨环"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "键盘焦点框改用主题的强调色。参考实现全应用只有一个焦点色（它的 --accent），" +
                          "而 DSH 用了五个：珊瑚配色下分别是 #A8432A 与 #F37E63 —— 后者对底只有 2.45:1，" +
                          "低于非文本指示所需的 3:1，就是那个橙框。关闭则保留 DSH 自己的颜色。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        checked: prefs.get("focus") !== "native",
                        onChange: function () {
                          prefs.set("focus", prefs.get("focus") === "native" ? "accent" : "native");
                        },
                        "aria-label": "焦点墨环"
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
                      R.createElement("div", { style: titleStyle }, "侧栏印章"),
                      R.createElement(
                        "div",
                        { style: hintStyle },
                        "用一枚「" + SEAL_GLYPH + "」字方印替换侧栏左上角的官方标志 —— 纸上的印章。" +
                          "这是本主题唯一一处覆盖应用自带界面的地方，默认关闭：" +
                          "换掉别人的标志是一个主张，而装上主题不该强加主张。"
                      )
                    ),
                    R.createElement(
                      "input",
                      {
                        type: "checkbox",
                        checked: prefs.isOn("sealMark"),
                        onChange: toggle("sealMark"),
                        "aria-label": "侧栏印章"
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
    /* The name -> role bindings from L1c, so test/tokens.test.js can assert that
       each bound alias still equals the role it names instead of restating the
       map and letting the two drift apart. */
    exports.BOUND_ALIASES = BOUND_ALIASES;
    /* The seal's renderer and its colours, so the runtime suite can assert what
       it actually draws rather than only that something was registered. */
    exports.renderSeal = renderSeal;
    exports.SEAL_GLYPH = SEAL_GLYPH;
    exports.SEAL_COLORS = SEAL_COLORS;
    /* The paper-texture veto, so tools/derive-grain.mjs can assert that it
       covers exactly the dark palettes -- and only them -- instead of restating
       the rule and letting the two drift apart. */
    exports.textureAllowed = textureAllowed;

    return module.exports;
  }
});
