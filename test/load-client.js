'use strict';
/**
 * Load lib/client.js exactly as the browser module loader would, and hand the
 * tests the real exports.
 *
 * The client half is not an ordinary CommonJS module: it is a
 * `window.__ModuleLoader__.load({ id, factory })` registration whose factory
 * returns `module.exports`. Reading the token tables by parsing the file as
 * text, or by keeping a second copy of the palette inside the tests, would
 * reintroduce precisely the drift this project exists to avoid. So the bundle
 * is executed in a `vm` context with a fake loader, and the assertions run
 * against the shipped object.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE = path.join(__dirname, '..', 'lib', 'client.js');

function loadClient() {
  const source = fs.readFileSync(BUNDLE, 'utf8');

  let captured = null;
  const sandbox = {
    console,
    // apply() uses timers for the settings-scope bind retry and document/window
    // for the stylesheet; none of that runs at load time, but providing them
    // keeps the sandbox honest if a test ever drives apply().
    setTimeout,
    clearTimeout,
    window: {
      __ModuleLoader__: {
        load(entry) {
          if (captured) throw new Error('client.js registered the module twice');
          captured = entry;
        },
      },
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  // vm.Script, not `node --check`: a sandboxed spawn can fail with EPERM, and
  // compiling in-process also proves the bundle is loadable, not merely parseable.
  new vm.Script(source, { filename: BUNDLE }).runInContext(context);

  if (!captured) throw new Error('client.js did not call window.__ModuleLoader__.load({...})');

  const module = captured.factory(function forbidden(name) {
    throw new Error(`client.js must not require("${name}") at load time`);
  });

  return { entry: captured, exports: module, source, sandbox };
}

/** The CSS string the bundle injects, with comments intact. */
function readCss(exports) {
  if (typeof exports.CSS !== 'string' || !exports.CSS.length) {
    throw new Error('lib/client.js must export its CSS string as `CSS` for tests');
  }
  return exports.CSS;
}

/** Strip /* ... *\/ comments so structural checks ignore commented-out text. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

module.exports = { loadClient, readCss, stripComments, BUNDLE };
