/**
 * Shared swatch label utilities (A, B, C, ..., AA, ...).
 * ESM for client (Vite). Server uses shared/swatchLabels.cjs.
 */

/**
 * Converts palette index to capital letter label (0->A, 1->B, ..., 25->Z, 26->AA, ...).
 * @param {number} i - Zero-based index
 * @returns {string}
 */
export function indexToLabel(i) {
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

/**
 * Computes swatch labels for a palette (A, B, C, ...).
 * @param {string[]} palette - Array of hex colors
 * @returns {string[]}
 */
export function computeSwatchLabels(palette) {
  if (!Array.isArray(palette)) return [];
  return palette.map((_, i) => indexToLabel(i));
}
