/**
 * Pure helper functions extracted from App.jsx for better testability and branch coverage.
 */
import { getFilenameFromMeta, getFilenameWithoutExt } from './utils';
import { indexToLabel, computeSwatchLabels } from '../../shared/swatchLabels.js';

// Re-export for tests and consumers
export { indexToLabel, computeSwatchLabels };

/** Returns true if meta needs palette generation (no or empty colorPalette) */
export function needsPaletteGeneration(meta) {
  return (
    !meta?.colorPalette ||
    !Array.isArray(meta.colorPalette) ||
    meta.colorPalette.length === 0
  );
}

/**
 * Returns next selection { meta, imageUrl } after deleting a file, or null.
 * @param {Object[]} remaining - Images left after deletion
 * @returns {{ meta: Object, imageUrl: string } | null}
 */
export function getNextSelectionAfterDeletion(remaining) {
  if (!remaining || remaining.length === 0) return null;
  const first = remaining[0];
  const fn = getFilenameFromMeta(first);
  if (!fn) return null;
  return {
    meta: first,
    imageUrl: `/uploads/${encodeURIComponent(fn)}`,
  };
}

/**
 * Computes reordered images and filenames for reorder API.
 * @param {Object[]} images - Array of image metadata
 * @param {number} index - Index of item to move
 * @param {'up'|'down'|'top'|'bottom'} direction - Move direction
 * @returns {{ reordered: Object[], filenames: string[] } | null} null if invalid
 */
export function computeReorderedState(images, index, direction) {
  if (!images || index < 0 || index >= images.length) return null;
  let newIndex;
  if (direction === 'top') {
    newIndex = 0;
  } else if (direction === 'bottom') {
    newIndex = images.length - 1;
  } else if (direction === 'up') {
    newIndex = index - 1;
  } else if (direction === 'down') {
    newIndex = index + 1;
  } else {
    return null;
  }
  if (newIndex < 0 || newIndex >= images.length || newIndex === index) return null;

  const reordered = [...images];
  const [item] = reordered.splice(index, 1);
  reordered.splice(newIndex, 0, item);
  const filenames = reordered.map((m) => getFilenameFromMeta(m)).filter(Boolean);
  return { reordered, filenames };
}

/**
 * Returns true if palette name should be saved (has changed and is valid).
 */
export function shouldSavePaletteName(selectedMeta, paletteName) {
  if (!selectedMeta || !paletteName?.trim()) return false;
  const filename = getFilenameFromMeta(selectedMeta);
  if (!filename) return false;
  if (selectedMeta.paletteName === paletteName.trim()) return false;
  return true;
}

/**
 * Builds export payload. Returns { name, colors } or null if nothing to export.
 */
export function buildExportData(selectedMeta, paletteName) {
  if (!selectedMeta) return null;
  const palette = selectedMeta.colorPalette || [];
  if (!Array.isArray(palette) || palette.length === 0) return null;

  const name =
    paletteName?.trim() ||
    getFilenameWithoutExt(getFilenameFromMeta(selectedMeta) || '') ||
    'palette';
  return { name, colors: palette };
}

/**
 * Returns meta with colorPalette and swatchLabels updated.
 */
export function applyPaletteToMeta(meta, palette) {
  if (!meta) return meta;
  const swatchLabels = computeSwatchLabels(palette);
  return { ...meta, colorPalette: palette, swatchLabels };
}

/**
 * Returns images array with palette and swatchLabels updated for the file matching filename.
 */
export function applyPaletteToImages(images, filename, palette) {
  if (!images) return [];
  const swatchLabels = computeSwatchLabels(palette);
  return images.map((m) =>
    getFilenameFromMeta(m) === filename ? { ...m, colorPalette: palette, swatchLabels } : m
  );
}

/**
 * Returns images array with paletteName updated for the file matching filename.
 */
export function applyPaletteNameToImages(images, filename, paletteName) {
  if (!images) return [];
  const name = paletteName.trim();
  return images.map((m) =>
    getFilenameFromMeta(m) === filename ? { ...m, paletteName: name } : m
  );
}

/**
 * Normalizes meta for paletteRegion: uses paletteRegion if present, else falls back to legacy key.
 * Call when loading metadata to support existing records.
 */
export function normalizeMetaPaletteRegion(meta) {
  if (!meta) return meta;
  if (meta.paletteRegion != null) return meta;
  const legacy = meta.clusterMarkers; // legacy JSONL key
  const paletteRegion = Array.isArray(legacy) ? legacy : [];
  return { ...meta, paletteRegion };
}

/**
 * Computes region labels (00, 01, 02, ...).
 * @param {Array[]} regions - Array of region polygons
 * @returns {string[]}
 */
export function computeRegionLabels(regions) {
  if (!Array.isArray(regions)) return [];
  return regions.map((_, i) => String(i).padStart(2, '0'));
}

/**
 * Returns meta with regions and regionLabels updated.
 */
export function applyRegionsToMeta(meta, regions) {
  if (!meta) return meta;
  const regionLabels = computeRegionLabels(regions);
  return { ...meta, regions, regionLabels };
}

/**
 * Returns images array with regions and regionLabels updated for the file matching filename.
 */
export function applyRegionsToImages(images, filename, regions) {
  if (!images) return [];
  const regionLabels = computeRegionLabels(regions);
  return images.map((m) =>
    getFilenameFromMeta(m) === filename ? { ...m, regions, regionLabels } : m
  );
}
