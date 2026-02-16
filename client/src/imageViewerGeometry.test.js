import { describe, it, expect } from 'vitest';
import { polygonCentroid, shrinkPolygon, polygonToPath } from './imageViewerGeometry';

describe('imageViewerGeometry', () => {
  describe('polygonCentroid', () => {
    it('returns [0, 0] for empty or null input', () => {
      expect(polygonCentroid(null)).toEqual([0, 0]);
      expect(polygonCentroid([])).toEqual([0, 0]);
    });

    it('returns centroid of single point', () => {
      expect(polygonCentroid([[10, 20]])).toEqual([10, 20]);
    });

    it('returns centroid of line', () => {
      expect(polygonCentroid([[0, 0], [10, 0]])).toEqual([5, 0]);
    });

    it('returns centroid of square', () => {
      const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
      expect(polygonCentroid(square)).toEqual([5, 5]);
    });

    it('returns centroid of triangle', () => {
      const tri = [[0, 0], [10, 0], [5, 10]];
      expect(polygonCentroid(tri)).toEqual([5, 10 / 3]);
    });
  });

  describe('shrinkPolygon', () => {
    it('returns input for empty or single-point polygon', () => {
      expect(shrinkPolygon(null, 3)).toBe(null);
      expect(shrinkPolygon([], 3)).toEqual([]);
      expect(shrinkPolygon([[5, 5]], 3)).toEqual([[5, 5]]);
    });

    it('shrinks polygon toward centroid', () => {
      const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
      const shrunk = shrinkPolygon(square, 2);
      expect(shrunk).toHaveLength(4);
      // Each vertex should move toward centroid (5,5)
      shrunk.forEach(([x, y]) => {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(10);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(10);
      });
    });

    it('returns same shape with px=0 (no movement)', () => {
      const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
      const shrunk = shrinkPolygon(square, 0);
      expect(shrunk).toEqual(square);
    });
  });

  describe('polygonToPath', () => {
    it('returns empty string for empty or single-point polygon', () => {
      expect(polygonToPath(null)).toBe('');
      expect(polygonToPath([])).toBe('');
      expect(polygonToPath([[5, 5]])).toBe('');
    });

    it('returns SVG path for line', () => {
      const line = [[0, 0], [10, 0]];
      expect(polygonToPath(line)).toBe('M 0 0 L 10 0 Z');
    });

    it('returns closed SVG path for square', () => {
      const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
      expect(polygonToPath(square)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    });

    it('returns valid path for triangle', () => {
      const tri = [[0, 0], [10, 0], [5, 10]];
      const d = polygonToPath(tri);
      expect(d).toMatch(/^M \d+ \d+ L \d+ \d+ L \d+ \d+ Z$/);
    });
  });
});
