/**
 * Region detection strategy constants.
 * Shared by client (PaletteDisplay) and server (regions API).
 * @module shared/regionStrategies
 */

export const VALID_STRATEGIES = ['default', 'adaptive', 'otsu', 'canny', 'color', 'watershed'];

export const STRATEGIES_WITH_PARAMS = ['adaptive', 'canny', 'color', 'watershed'];

export const REGION_STRATEGIES = [
  { value: 'default', label: 'Default (cascade)' },
  { value: 'adaptive', label: 'Adaptive' },
  { value: 'otsu', label: 'Otsu' },
  { value: 'canny', label: 'Canny' },
  { value: 'color', label: 'Color K-means' },
  { value: 'watershed', label: 'Watershed' },
];
