/**
 * Region detection strategy constants.
 * Shared by client (PaletteDisplay) and server (regions API).
 * @module shared/regionStrategies
 */

export const VALID_STRATEGIES = [
  'default', 'adaptive', 'otsu', 'canny', 'color', 'watershed',
  'grabcut', 'slic', 'saliency', 'meanshift', 'quadtree', 'circles', 'rectangles', 'contour_circles', 'template_match',
];

export const STRATEGIES_WITH_PARAMS = [
  'adaptive', 'canny', 'color', 'watershed',
  'grabcut', 'slic', 'meanshift', 'quadtree', 'circles', 'rectangles', 'contour_circles', 'template_match',
];

export const REGION_STRATEGIES = [
  { value: 'default', label: 'Default (cascade)' },
  { value: 'grabcut', label: 'GrabCut (subject/background)' },
  { value: 'slic', label: 'SLIC superpixels' },
  { value: 'saliency', label: 'Saliency (attention)' },
  { value: 'meanshift', label: 'Mean shift' },
  { value: 'quadtree', label: 'Quadtree split' },
  { value: 'circles', label: 'Circles (Hough)' },
  { value: 'contour_circles', label: 'Circles (contour)' },
  { value: 'template_match', label: 'Template match (sample + convolution)' },
  { value: 'rectangles', label: 'Rectangles' },
  { value: 'adaptive', label: 'Adaptive threshold' },
  { value: 'otsu', label: 'Otsu' },
  { value: 'canny', label: 'Canny edges' },
  { value: 'color', label: 'Color K-means' },
  { value: 'watershed', label: 'Watershed' },
];
