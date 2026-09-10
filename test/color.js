'use strict';
/**
 * Minimal colour maths for the contrast assertions.
 *
 * Deliberately dependency-free and hand-written rather than pulled from a
 * package: `nix flake check` runs these tests in a sandbox with no network, so
 * the suite must have nothing to install. WCAG 2.x relative luminance and
 * contrast ratio are short enough to implement exactly.
 */

/** Parse "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)", "rgba(...)", "transparent". */
function parse(value) {
  const text = String(value).trim().toLowerCase();
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  if (text.startsWith('#')) {
    let hex = text.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    if (hex.length !== 6 && hex.length !== 8) throw new Error(`unparseable colour: ${value}`);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn = text.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    // Accepts both the comma form and the "r g b / a" form.
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) {
      throw new Error(`unparseable colour: ${value}`);
    }
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  throw new Error(`unparseable colour: ${value}`);
}

/** Alpha-composite `front` over `back`, returning an opaque colour. */
function composite(front, back) {
  const f = typeof front === 'string' ? parse(front) : front;
  const b = typeof back === 'string' ? parse(back) : back;
  if (f.a >= 1) return { r: f.r, g: f.g, b: f.b, a: 1 };
  return {
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  };
}

const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of an opaque colour. */
function luminance(colour) {
  const c = typeof colour === 'string' ? parse(colour) : colour;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/**
 * Contrast ratio between a foreground and a background.
 *
 * A translucent foreground is composited onto the background first, because
 * that is what the user actually sees. With no background supplied a
 * translucent foreground is rejected instead of silently reported against
 * whatever happened to be underneath.
 */
function contrast(foreground, background) {
  const bg = typeof background === 'string' ? parse(background) : background;
  let fg = typeof foreground === 'string' ? parse(foreground) : foreground;
  if (fg.a < 1) {
    if (!bg) throw new Error('cannot measure a translucent colour without a background');
    fg = composite(fg, bg);
  }
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

module.exports = { parse, composite, luminance, contrast };
