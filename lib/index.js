'use strict';
/**
 * hana-theme-for-dsh — HOST half.
 *
 * This module is the cordis plugin the loader mounts when the package is
 * installed through the official CLI:
 *
 *   dsh plugin --profile desktop add /path/to/hana-theme-for-dsh
 *
 * `cordis.patch.yml` inserts this package's row; the loader requires this main
 * entry and uses its `name` + `apply` exports. The theme itself is browser-side
 * (registered through the `theme` service in `lib/client.js`); this half owns
 * exactly one thing: the durable settings namespace.
 *
 * WHY THE SETTINGS LIVE ON THE HOST
 * ---------------------------------
 * The obvious home for two switches is `localStorage`. It is the wrong one.
 *
 * DSH Desktop serves the UI on a fixed loopback port (`DESKTOP_DEFAULT_WEB_PORT = 43120`)
 * and walks to the next port only on a real bind collision (up to 32 attempts), so the
 * page origin is normally stable. An earlier note in this project claimed a fresh random
 * port per launch; that is not what 2.0.5 does, and it has been corrected here. The
 * conclusion is unchanged: an origin-scoped store is lost the moment the port does move
 * (a second DSH instance already holding 43120), it is invisible to the Host half, and it
 * does not follow the user across profiles.
 *
 * `ctx.settings.register(namespace, schema, { applies: 'live' })` persists to
 * the profile's own `settings.yaml` through DSH's settings service, which is
 * keyed by nothing browser-related, so it survives port changes, restarts and
 * profile switches. The browser half reads and writes the same namespace
 * through `ctx.settingsScope`; see the durability gate documented in
 * `lib/client.js`.
 *
 * Field polarity follows the convention the other DSH themes use, so stored
 * values stay byte-comparable across plugins: a default-ON switch is stored as
 * the string '1' and read as `!== '0'`; a default-OFF switch is stored as '0'
 * and read as `=== '1'`. Fields are strings, never booleans, because the wire
 * section is a flat string map.
 */

const NAME = 'hana-theme-for-dsh';

/** Settings namespace owned by this plugin. */
const NAMESPACE = 'hana-theme-for-dsh';

/**
 * Schema defaults, one entry per field.
 *
 * `enabled` defaults to ON, not OFF. Registering a theme is inert: it adds a
 * row to Settings › Appearance and changes nothing until the user selects it,
 * because every visual layer in the client half is gated on a hana theme being
 * the *active* preference rather than on a manual switch. That gating already
 * delivers the "install it quietly, it does not touch my UI" property, so
 * defaulting the master switch off would only add a second, redundant opt-in
 * between the user and a theme they explicitly chose. `enabled: '0'` remains
 * available as a UI-reachable kill switch for anyone who wants the themes gone
 * from the picker without uninstalling the package.
 *
 * `serif` defaults to ON: it is the theme's defining trait, and it only ever
 * applies while a hana theme is active.
 */
const FIELD_DEFAULTS = {
  enabled: '1',
  serif: '1',
  serifScale: '115',
  paperTexture: '0',
  grainOpacity: '32',
  shape: 'soft',
  // The seal is the one place this theme REPLACES shipped UI — it shadows the
  // sidebar's brand mark — so it stays off until asked for. Default-OFF fields
  // are stored as '0' and read as `=== '1'`, the convention the other DSH themes
  // share, so stored values stay byte-comparable across plugins.
  sealMark: '0',
  // Which palette the user last chose, so the plugin can re-apply it after a
  // restart. DSH persists only `light`/`dark`/`system` as a theme preference
  // (see THEME_PREFERENCES in dsh-client-ui-theme), so a third-party theme id is
  // NEVER written to the settings document -- the UI changes, then silently
  // reverts on the next boot. Empty means "do not take over".
  palette: '',
};

/**
 * Resolve a Schemastery namespace builder lazily, and defensively.
 *
 * `ctx.settings.register` needs a Schemastery schema. A published profile
 * install puts `schemastery` on this package's own require path. A DEV-LINK
 * install (this repo symlinked into the profile's node_modules, or added by
 * absolute path) does not: its files resolve from the repo path, where no
 * `schemastery` exists, so the bare require misses and registration would
 * silently never happen — presenting as "the switches do not stick". The
 * fallback therefore also discovers the builder from the DSH module roots that
 * physically exist on disk.
 *
 * Everything stays guarded: a profile with no schema builder anywhere degrades
 * to an unregistered namespace (page-local switches) instead of crashing the
 * host half.
 */
function loadSchemastery() {
  let found = null;
  for (const spec of ['@deepseek-ai/schemastery', 'schemastery']) {
    try {
      found = require(spec);
      break;
    } catch (e) {
      found = null;
    }
  }

  if (!found) {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const dshHome =
        (typeof process !== 'undefined' && process.env && process.env.DSH_HOME) ||
        path.join(typeof os.homedir === 'function' ? os.homedir() : '', '.dsh');
      const profiles = path.join(dshHome, 'profiles');
      const roots = [
        path.join(profiles, 'node_modules', '@deepseek-ai', 'schemastery'),
        path.join(profiles, 'node_modules', 'schemastery'),
      ];
      let names = [];
      try {
        names = fs.readdirSync(profiles);
      } catch (e) {
        names = [];
      }
      for (const name of names) {
        roots.push(path.join(profiles, name, 'node_modules', '@deepseek-ai', 'schemastery'));
        roots.push(path.join(profiles, name, 'node_modules', 'schemastery'));
      }
      for (const root of roots) {
        try {
          if (fs.existsSync(path.join(root, 'package.json'))) {
            found = require(root);
            if (found) break;
          }
        } catch (e) {
          found = null;
        }
      }
    } catch (e) {
      /* ignore discovery errors */
    }
  }

  // Normalize a CJS default-export wrapper down to the { string, object } API.
  if (found && found.default && !found.object && found.default.object && found.default.string) {
    const d = found.default;
    found = { string: (v) => d.string(v), object: (o) => d.object(o) };
  }
  return found && typeof found.object === 'function' && typeof found.string === 'function'
    ? found
    : undefined;
}

function apply(ctx) {
  // No early `ctx.get('settings')` bail here: mounting plugins run concurrently
  // and the settings service can legitimately settle AFTER this apply(), so a
  // synchronous probe at this instant would see it absent, return, and leave
  // the namespace unregistered forever — the browser then writes into a scope
  // that reports `status: 'unavailable'` and nothing persists.
  //
  // Cordis `ctx.inject(['settings'], ...)` instead WAITS for the service, which
  // is the convention the harness's own client plugins use, so registration is
  // reliable no matter how the two interleave. The registration is scoped to
  // this plugin's fiber and disposed with it.
  ctx.inject(['settings'], (settingsCtx) => {
    if (!settingsCtx || !settingsCtx.settings) return;
    const z = loadSchemastery();
    if (z === undefined) return;
    const fields = {};
    for (const field of Object.keys(FIELD_DEFAULTS)) {
      fields[field] = z.string().default(FIELD_DEFAULTS[field]);
    }
    try {
      settingsCtx.settings.register(NAMESPACE, z.object(fields), { applies: 'live' });
    } catch (e) {
      // A throw here must not take the whole theme down; without the namespace
      // the browser switches simply stay page-local instead of durable.
    }
  });
}

module.exports = {
  name: NAME,
  apply,
  // Exposed for tests and documentation.
  NAMESPACE,
  FIELD_DEFAULTS,
  loadSchemastery,
};
