# hana-theme-for-dsh

**English** · [简体中文](./README.zh.md)

A paper-and-ink theme for [DeepSeek Harness](https://github.com/deepseek-ai) — warm paper ground, layered ink, a single accent, and serif reading typography. The design language is ported from [liliMozi/openhanako](https://github.com/liliMozi/openhanako) (HanaAgent, Apache-2.0).

No HanaAgent source is copied or vendored. The palettes were re-derived, and every colour is re-verified for contrast by this repo's own test suite — because HanaAgent's originals fail WCAG AA in twelve measured places across the four palettes used here.

## Four palettes

| id | scheme | ground | character | HanaAgent source |
|---|---|---|---|---|
| `hana-paper` | light | `#F5EFE4` warm paper | restrained — one seal-blue accent | `new-warm-paper` |
| `hana-midnight` | dark | `#3B4A54` blue-teal night | restrained — one warm rose accent | `midnight` |
| `hana-coral` | light | `#FDF6EC` washi white | **rich** — washi white, ink blue, coral, antique gold, grey-cyan | `coral` |
| `hana-midnight-vivid` | dark | `#26343D` deeper blue-teal | **rich** — rose accent, a separate light-blue link, mint, peach, soft red | `midnight-contrast` |

What makes the rich pair rich without becoming noisy is a structural rule worth naming: **the saturation lives in borders, tints and surfaces, never in body text.** In HanaAgent's `coral` the vivid `#F37E63` appears only inside `rgba()` borders, note edges and mood backgrounds — as text it measures 2.45:1. This theme keeps that split, with two adaptations: links take the coral *hue* carried down in lightness to clear AA (5.59:1), and the vivid coral becomes a solid in exactly one place — `button-contrast-fill`, where near-black ink sits on it at 5.10:1. That is the faithful reading of "a surface colour": it is allowed to be a surface.

## Appearance

| | |
|---|---|
| **纸本** · `hana-paper`<br>warm paper, ink, one seal-blue accent | **青夜** · `hana-midnight`<br>blue-teal night, one warm rose accent |
| ![hana-paper — warm paper ground, ink text, a single seal-blue accent](./assets/paper.webp) | ![hana-midnight — blue-teal night with a warm rose accent](./assets/midnight.webp) |
| **珊瑚** · `hana-coral`<br>washi white, ink blue, coral lines, antique-gold note surfaces | **斑斓** · `hana-midnight-vivid`<br>rose accent, a separate light-blue link, mint and peach |
| ![hana-coral — washi white ground, ink-blue text, coral lines and antique-gold note surfaces](./assets/coral.webp) | ![hana-midnight-vivid — rose accent, a separate light-blue link, mint and peach on a deeper blue-teal](./assets/vivid.webp) |


## Install

### The constraint, first

Two things stop the obvious command:

- **`dsh plugin --profile desktop …` is refused**, for the literal *name* `desktop` — that profile is managed exclusively by the Electron application.
- **The in-app market is catalogue-only.** Its security section says it installs only sources from the [awesome-dsh-plugin](https://awesome-dsh-plugin.com) curated list, and its UI has no free-text install field. Its `link:`/`file:` support is for *restoring* an install that already exists, not for creating one.

So pick one of these.

### A profile you control (recommended)

The Desktop app boots whichever profile you select in its profile menu, and `dsh plugin` only refuses the name `desktop`. So make the profile you control match the one the app ships with:

```bash
dsh plugin --profile web add "link:/path/to/hana-theme-for-dsh"
# then select `web` in the app's profile menu
```

A dedicated profile works too, but it **must come from a template**:

```bash
dsh --profile hana --from-default-profile web --port 43210
dsh plugin --profile hana add "link:/path/to/hana-theme-for-dsh"
```

`dsh plugin --profile <name> add` looks the template up **by the profile's own name** and falls back to `DEFAULT_PROFILE_BUNDLES = ["@deepseek-ai/dsh-base"]`. A made-up name therefore produces a profile with no web app — and no UI. Use `--from-default-profile web`, and give it a spare `--port` so it does not fight the running desktop instance.

Preferences follow you either way: `settings.yaml` lives at `<DSH_HOME>/settings.yaml` and is shared across profiles.

### Publishing, for the shipped profile

To install into the app-managed `desktop` profile through the market, the plugin has to be **listed in the curated catalogue** — that is the only supported route. Publish to npm or GitHub, then submit it there.

`dsh plugin --profile desktop add` will never work, and hand-editing that profile with `pnpm add -w` plus a `dsh.profile.bundles` entry is unsupported: the app owns the file.

### Managing it

```bash
dsh plugin --profile <profile> remove hana-theme-for-dsh
```

Installed but inert:

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: ui-skin-hana
  disabled: true
```

## What it changes, and what it refuses to change

**Changes.** The 89 alias/specific colour tokens for whichever palette is active, and — while a hana palette is claimed and 衬线阅读体 is on — the font *family* of markdown reading text, plus the opt-in ornament layer.

**Refuses.** Everything else, and the most important behaviour here is a negative one: **while no hana palette is claimed, the plugin contributes nothing at all** — no stylesheet, no body attribute, no token layer. Installing it cannot repaint the built-in themes and cannot leak typography into another skin.

Two further choices worth knowing:

- **UI chrome stays sans-serif.** It would be trivial to set `--dsw-font-family` to a serif stack, but that restyles buttons, the sidebar and every label. Only reading text becomes a book; the interface keeps its own voice.
- **Your font-size preference keeps working.** The theme overrides DSH's markdown *font shorthands* with the harness's own size and line-height expressions, so `--dsh-content-font-size` flows through instead of being frozen.

## Settings

**Settings › 花笺主题**

| Row | Default | Notes |
|---|---|---|
| 启用花笺主题 | on | off unregisters everything and drops the palette layer |
| 配色 | 跟随 DSH | four palettes plus **跟随 DSH**; see the contract below |
| 衬线阅读体 | on | serif for reading text only |
| 衬线字号补偿 | 115% (100–140%) | see *Reading size* |
| 纸质纹理 | off | a full-viewport procedural grain |
| 纹理强度 | 32% (0–60%) | |
| 极方圆角 | off | squares named control categories only |

The panel also reports whether settings are durably stored. If it ever says they are not, they will not survive a restart — that message exists because a silently non-persisting switch is worse than a broken one.

**The palette contract.** DeepSeek Harness persists only `light`/`dark`/`system` as a theme preference, so a third-party theme id is never written to disk. This plugin therefore remembers your choice in its own settings namespace *and* applies the colours as an override layer, which rides on top of whatever theme is active. The consequence is honest and deliberate: **while a palette is chosen, DSH's own Appearance row is superseded by this plugin.** Choose **跟随 DSH** to release it — that forgets the palette and hands the preference back to the system setting.

## Reading size

A serif reads smaller than the sans it replaces at the same pixel size. In CJK it is not subtle: the sans stack resolves to Source Han Sans while the serif stack resolves to Source Han Serif, whose strokes are far lighter, and at a 14px base the thin horizontals alias away. DSH caps its own content size at 17px, which leaves no headroom to compensate from the Appearance row.

So every markdown size **and its matching line-height** is multiplied by a factor you control. Scaling both preserves the harness's leading ratio exactly, so raising the size never tightens the line spacing.

## Making the interface bigger

DSH's font-size row is content-only; there is no setting for chrome text. Measured across the 25 non-vendor component stylesheets, DSH expresses UI text as **64 hardcoded `font-size: Npx` values** against essentially one live token (`--dsw-font-xs-13`, 40 uses) — the other `--dsw-font-*` UI sizes are declared but never consumed, and there is **no `rem` anywhere**. So there is no token channel for chrome size, and overriding the one live token would leave 64 sizes untouched: uneven, and worse than doing nothing.

Use the app's own zoom instead — real Electron zoom, scaling text and layout together:

| key | effect |
|---|---|
| `Ctrl/Cmd` + `=` | zoom in (×1.2 per step) |
| `Ctrl/Cmd` + `-` | zoom out |
| `Ctrl/Cmd` + `0` | reset |

Clamped to ±4 levels (≈0.48×–2.07×). Because DSH Desktop serves the UI on a **fixed** loopback port (43120, moving only on a bind collision), the origin is stable and Chromium's per-origin zoom persists across restarts. This theme deliberately ships **no** CSS `zoom` clone: it would risk misplacing the `position: fixed` tooltip and modal layers, and duplicating a working native mechanism with a more fragile one is a bad trade.

## Traps this theme is built around

Established by reading the installed harness rather than its documentation. Most are enforced by a check in `test/check.js`.

- **Registered tokens are applied as inline styles on `<body>`.** A theme that writes `--dsw-alias-*` in its own stylesheet is silently overridden the moment anything else writes tokens. Colour therefore travels only through the theme service.
- **The converse is what makes typography possible.** A custom property outside the registered set can never be written inline, so for `--dsw-font-markdown-*` a stylesheet is the *only* channel.
- **The built-in themes carry no tokens at all** (`{ id: 'light', tokens: {} }`). `ThemePresenter.apply()` removes every token it previously applied before applying the next theme's — so switching to a built-in wipes a third-party theme's colours while leaving its stylesheet, and therefore its typography, perfectly intact. "Fonts stayed, colours reverted" is that exact signature.
- **DSH persists only `light`/`dark`/`system` as a theme preference.** An override layer is the only thing that survives `adopt()` re-reading the settings document, which it does on every write and at every boot.
- **`settingsScope.bind()` takes a spec object** — `bind({ namespace, decode? })` — not a namespace string. A bare string leaves `spec.namespace` undefined, so the scope matches no describe row (`status` stays `unavailable` for every namespace) and every write is issued against `undefined`. Both directions fail silently.
- **`theme.overrideTokens()` emits `theme/change`**, so calling it from a `theme/change` listener recurses.
- **A `theme/change` listener must not call `setTheme()` synchronously.** `publish()` emits synchronously, so a re-entrant call runs the presenter with your snapshot first and then, when the outer emit resumes, the presenter runs again with the stale snapshot and wipes what you just restored.
- **`Theme.listTokens` is not an allow-list** — it reports what happens to be registered, including other plugins' tokens.
- **`overrideTokens` validates values, never names.** A misspelled token is accepted and read by nobody, which is why `test/token-allowlist.json` is generated from the installed stylesheet.
- **`--dsw-alias-tooltip-bg` must stay dark in both modes.** `Tooltip.module.css` paints its text with a hardcoded near-white that no theme token reaches.
- **`--dsw-alias-toast-bg` is dead.** The toast surface is `--dsw-alias-button-contrast-fill` paired with `--dsw-alias-label-primary-inverted`.
- **Raw HTML never enters the DOM.** DSH replaced react-markdown with a direct mdast→React renderer whose policy is "raw HTML renders as literal text". GitHub-style `[!NOTE]` callouts can therefore never be styled — see *Not done* below.
- **The markdown root class is a build hash** (`_markdown_177e0_5`). Markdown rules anchor on `[data-chat-flow-kind='assistant-step']` instead, confirmed against a live page rather than assumed.

## Development

The only toolchain needed is Node and pnpm, and there is **no build step** — `lib/client.js` is the shipped artifact, hand-written so the file a reviewer reads is the file the browser runs.

```bash
nix develop                  # Node 24 + pnpm + jq, pinned to the host's nixpkgs
npm test                     # allow-list + contrast + static checks
npm run refresh:allowlist    # re-derive the token allow-list from the installed DSH
npm run allowlist:all        # every DSH install found, and its token count
npm run probe                # print the Phase 0 DOM probe for the DevTools console
```

`nix flake check` runs the same suites in a sandbox with no network. On NixOS the flake is the intended entry point; `flake.lock` pins the same nixpkgs revision the host system is built from, so the shell downloads nothing.

```
lib/index.js     Host half — the durable settings namespace
lib/client.js    Client half — palettes, stylesheet, settings panel (the shipped artifact)
test/            the gates
tools/           refresh-allowlist.mjs, which generates test/token-allowlist.json
docs/            the research and design documents this implementation follows
```

## The tests are the point

A theme fails *silently*. A misspelled token is accepted without complaint and read by nobody; a stray character makes the browser drop one rule and carry on; a stylesheet colour looks correct right up until another token-writing plugin is installed. So the checks here are not ceremony.

**`test/contrast.test.js` — 91 assertions.** 19 pairs × 4 palettes, per-scheme foreground polarity, a link-readability band, and a compositing model for the paper grain. Values are read out of the shipped tables, never a second copy. Run with `--verbose` to print every measured pair.

**`test/check.js` — 78 static judgements.** No hash-shaped selectors, nothing declared on `:root`, no registered colour token declared in the stylesheet, no `--hana-*` token that nothing reads, no `settingsScope.bind()` with a bare string, no synchronous `setTheme()` in a `theme/change` listener, an idempotent override layer, every runtime path present in `files`, and a `ctx.effect` disposer chain that releases every side effect.

**`test/tokens.test.js`** — every colour token name must appear in an allow-list generated from the installed harness, and all four palettes must cover the same names.

The suite has earned its keep. It has caught a load-time crash, three dead tokens in this theme's own palette, a dead `--hana-*` token, a packaging gap that only a registry install would have hit, and — after the settings-persistence bug — it now refuses to build if the settings scope is bound with a bare string.

## Compatibility

Verified against **DeepSeek Harness Desktop 2.0.5 / 2.0.6** with **`@deepseek-ai/dsh-client-ui-theme` 0.1.2-rc.1** (89 colour tokens). `package.json` declares the tested range `0.1.2-rc.1 – 0.1.5-alpha.1`; the later version adds exactly one token (`--dsw-alias-link`), which this theme does not use and which the allow-list records as version-dependent.

Stable anchors relied on: the 89 registered token names, `--dsw-font-markdown-*`, `--dsh-content-font-size`, `body[data-ds-dark-theme]`, `md-code-block`, `md-table-wide`, `data-chat-flow-kind`, `data-composer-card`, `settings.section`.

After a harness upgrade run `npm run refresh:allowlist` and read the diff. **A token that disappears is an override that silently stopped working.**

## Not done, and why

- **Callouts.** DSH's renderer guarantees raw HTML renders as literal text and never enters the DOM, so `.hana-callout` can never be emitted. Route A would be dead CSS; a MutationObserver would leave the literal `[!NOTE]` visible in the prose. Recorded rather than half-built.
- **Motion.** Deliberately out of scope. The eight keyframes are trivial; the risk is re-triggering entrance animations during streaming, which is exactly where motion bugs live and exactly where they cannot be seen without watching a long generation.
- **Weather mode** (HanaAgent's 2.38 MB video layer). Technically feasible, but it would break this plugin's zero-binary-resource property for an optional effect.
- **Bundled fonts.** HanaAgent ships 6.5 MB, 6.0 MB of it CJK. The system serif stack gets most of the way for nothing.

## License

MIT — see [LICENSE](./LICENSE).

This is a design-language port, not a code port. No HanaAgent source file is copied or vendored; the palettes were re-derived and are re-verified for contrast here. HanaAgent is Apache-2.0.
