/**
 * Region detection strategy constants. Shared by client and server.
 */

const VALID_STRATEGIES = [
  'default', 'adaptive', 'otsu', 'canny', 'color', 'watershed',
  'grabcut', 'slic', 'saliency', 'meanshift', 'quadtree', 'circles', 'rectangles', 'contour_circles', 'template_match',
];

const STRATEGIES_WITH_PARAMS = [
  'adaptive', 'canny', 'color', 'watershed',
  'grabcut', 'slic', 'meanshift', 'quadtree', 'circles', 'rectangles', 'contour_circles', 'template_match',
];

module.exports = { VALID_STRATEGIES, STRATEGIES_WITH_PARAMS };
