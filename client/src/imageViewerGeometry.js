/**
 * Pure geometry helpers for ImageViewer (polygon centroid, shrink, SVG path).
 * Extracted for testability.
 * 
 * NOTE: polygonCentroid is duplicated in image_processor.js (server-side).
 * Keep both implementations in sync if making changes.
 */

export function polygonCentroid(poly) {
  if (!poly || poly.length === 0) return [0, 0];
  let sx = 0, sy = 0;
  for (const [x, y] of poly) {
    sx += x;
    sy += y;
  }
  return [sx / poly.length, sy / poly.length];
}

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
