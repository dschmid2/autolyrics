// Keystone (trapezoid) correction for a projector that is not centred on the
// screen. Stored per player (players[id].keystone) and applied to /live only.
// Plain ES5-compatible math so public/legacy.js can mirror it.
//
// keystone = { enabled, showGrid, corners: { tl: [x, y], tr, br, bl } }
// Corners are fractions of the display size (0..1). When `enabled` is false,
// the display renders exactly as without this feature (no transform at all).

const DEFAULT_CORNERS = Object.freeze({ tl: [0, 0], tr: [1, 0], br: [1, 1], bl: [0, 1] });
const CORNER_KEYS = ['tl', 'tr', 'br', 'bl'];
const CORNER_MIN = -0.5;
const CORNER_MAX = 1.5;

function defaultKeystone() {
  return { enabled: false, showGrid: false, corners: { tl: [0, 0], tr: [1, 0], br: [1, 1], bl: [0, 1] } };
}

// Keeps only known fields with finite numbers; null if nothing usable
function sanitizeKeystone(input) {
  if (!input || typeof input !== 'object') return null;
  const corners = {};
  const src = input.corners && typeof input.corners === 'object' ? input.corners : {};
  for (const key of CORNER_KEYS) {
    const p = Array.isArray(src[key]) ? src[key] : DEFAULT_CORNERS[key];
    const x = Number(p[0]);
    const y = Number(p[1]);
    corners[key] = [
      Number.isFinite(x) ? Math.min(CORNER_MAX, Math.max(CORNER_MIN, Math.round(x * 10000) / 10000)) : DEFAULT_CORNERS[key][0],
      Number.isFinite(y) ? Math.min(CORNER_MAX, Math.max(CORNER_MIN, Math.round(y * 10000) / 10000)) : DEFAULT_CORNERS[key][1],
    ];
  }
  return { enabled: input.enabled === true, showGrid: input.showGrid === true, corners };
}

// CSS matrix3d() that maps a width x height element (transform-origin 0 0)
// onto the quadrilateral given by `corners` (fractions of width/height).
// Projective square-to-quad mapping (Heckbert).
function keystoneMatrix3d(corners, width, height) {
  const p = CORNER_KEYS.map((k) => [corners[k][0] * width, corners[k][1] * height]);
  const x0 = p[0][0], y0 = p[0][1];
  const x1 = p[1][0], y1 = p[1][1];
  const x2 = p[2][0], y2 = p[2][1];
  const x3 = p[3][0], y3 = p[3][1];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  const det = dx1 * dy2 - dx2 * dy1;
  if ((dx3 === 0 && dy3 === 0) || Math.abs(det) < 1e-9) {
    // parallelogram: affine
    a = x1 - x0; b = x3 - x0; c = x0;
    d = y1 - y0; e = y3 - y0; f = y0;
    g = 0; h = 0;
  } else {
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  // unit square (u = x / width, v = y / height) -> quad; matrix3d is column-major
  const m = [
    a / width, d / width, 0, g / width,
    b / height, e / height, 0, h / height,
    0, 0, 1, 0,
    c, f, 0, 1,
  ];
  return 'matrix3d(' + m.map((n) => +n.toFixed(10)).join(',') + ')';
}

// true if the corners differ from the full screen (otherwise no transform needed)
function isIdentityCorners(corners) {
  return CORNER_KEYS.every((k) => corners[k][0] === DEFAULT_CORNERS[k][0] && corners[k][1] === DEFAULT_CORNERS[k][1]);
}

module.exports = { CORNER_KEYS, CORNER_MIN, CORNER_MAX, defaultKeystone, sanitizeKeystone, keystoneMatrix3d, isIdentityCorners };
