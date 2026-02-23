/**
 * Polygon centroid (geometric center).
 * Shared by client (ImageViewer geometry) and server (image_processor).
 * @param {number[][]} poly - Polygon as [[x,y], ...]
 * @returns {[number, number]} [cx, cy]
 */
export function polygonCentroid(poly) {
  if (!poly || poly.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const pt of poly) {
    sx += pt[0];
    sy += pt[1];
  }
  return [sx / poly.length, sy / poly.length];
}
