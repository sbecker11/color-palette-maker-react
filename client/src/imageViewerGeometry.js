/**
 * Pure geometry helpers for ImageViewer (polygon shrink, SVG path).
 * polygonCentroid from shared/polygonCentroid.js.
 */
import { polygonCentroid } from '../../shared/polygonCentroid.js';

export { polygonCentroid };
export function shrinkPolygon(poly, px) {
  if (!poly || poly.length < 2) return poly;
  const [cx, cy] = polygonCentroid(poly);
  return poly.map(([x, y]) => {
    const dx = cx - x, dy = cy - y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(1, px / len);
    return [x + dx * t, y + dy * t];
  });
}

export function polygonToPath(poly) {
  if (!poly || poly.length < 2) return '';
  const [fx, fy] = poly[0];
  let d = `M ${fx} ${fy}`;
  for (let i = 1; i < poly.length; i++) {
    d += ` L ${poly[i][0]} ${poly[i][1]}`;
  }
  return d + ' Z';
}
