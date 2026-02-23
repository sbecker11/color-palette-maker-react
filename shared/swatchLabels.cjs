/**
 * Shared swatch label utilities (A, B, C, ..., AA, ...).
 * CJS for server (Node). Client uses shared/swatchLabels.js (ESM).
 */

function indexToLabel(i) {
  if (typeof i !== 'number' || i < 0) return '';
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function computeSwatchLabels(palette) {
  if (!Array.isArray(palette)) return [];
  return palette.map((_, i) => indexToLabel(i));
}

module.exports = { indexToLabel, computeSwatchLabels };
