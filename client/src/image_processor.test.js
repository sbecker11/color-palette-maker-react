import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  centroidsToPalette,
  calculateLuminance,
  minPairwiseColorDistance,
  pointInPolygon,
  pointInAnyRegion,
} = require(path.resolve(__dirname, '../../image_processor.js'));

// Centroids with luminance between 25 and 185 (passes filter)
const VALID_CENTROIDS = [
  [40, 45, 50],
  [60, 65, 70],
  [80, 85, 90],
  [100, 105, 110],
  [120, 125, 130],
  [50, 90, 80],
  [90, 60, 100],
  [70, 110, 85],
  [110, 75, 95],
];

describe('image_processor.centroidsToPalette', () => {
  it('returns up to k colors when options.k is 9 (K-means 9)', () => {
    const palette = centroidsToPalette(VALID_CENTROIDS, { k: 9 });
    expect(palette).toHaveLength(9);
    expect(palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });

  it('returns up to k colors when options.k is 5 (K-means 5)', () => {
    const palette = centroidsToPalette(VALID_CENTROIDS, { k: 5 });
    expect(palette).toHaveLength(5);
  });

  it('returns up to k colors when options.k is 7 (K-means 7)', () => {
    const palette = centroidsToPalette(VALID_CENTROIDS, { k: 7 });
    expect(palette).toHaveLength(7);
  });

  it('returns up to FINAL_PALETTE_SIZE (5) when options.k is not specified', () => {
    const palette = centroidsToPalette(VALID_CENTROIDS, {});
    expect(palette).toHaveLength(5);
  });

  it('merge centroids when perceptually similar (fewer distinct colors than k)', () => {
    // 9 centroids that are really 3 distinct colors (3 near-duplicates of each); all pass luminance filter (25-185)
    const threeColors = [
      [50, 55, 60],
      [51, 56, 61],
      [49, 54, 59],
      [120, 125, 130],
      [121, 126, 131],
      [119, 124, 129],
      [150, 155, 160],
      [151, 156, 161],
      [149, 154, 159],
    ];
    const palette = centroidsToPalette(threeColors, { k: 9 });
    expect(palette.length).toBeLessThanOrEqual(9);
    expect(palette.length).toBe(3);
    expect(palette.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });

  it('returns empty array for empty centroids', () => {
    const palette = centroidsToPalette([], { k: 9 });
    expect(palette).toEqual([]);
  });

  it('returns single color when one centroid passes luminance filter', () => {
    const single = [[100, 105, 110]];
    const palette = centroidsToPalette(single, { k: 9 });
    expect(palette).toHaveLength(1);
    expect(palette[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('filters out near-black and near-white centroids', () => {
    const mixed = [
      [10, 10, 10],
      [100, 100, 100],
      [250, 250, 250],
    ];
    const palette = centroidsToPalette(mixed, { k: 9 });
    expect(palette).toHaveLength(1);
    expect(palette[0]).toBe('#646464');
  });

  it('returns empty when all centroids fail luminance filter', () => {
    const darkOnly = [[5, 5, 5], [10, 10, 10]];
    const palette = centroidsToPalette(darkOnly, { k: 9 });
    expect(palette).toEqual([]);
  });

  it('clamps k to valid range (2-20)', () => {
    const two = [[50, 60, 70], [120, 130, 140]];
    expect(centroidsToPalette(two, { k: 1 })).toHaveLength(2);
    expect(centroidsToPalette(two, { k: 25 })).toHaveLength(2);
  });
});

describe('image_processor.calculateLuminance', () => {
  it('returns 0 for pure black', () => {
    expect(calculateLuminance([0, 0, 0])).toBe(0);
  });

  it('returns 255 for pure white', () => {
    expect(calculateLuminance([255, 255, 255])).toBe(255);
  });

  it('returns mid value for mid-gray', () => {
    const lum = calculateLuminance([128, 128, 128]);
    expect(lum).toBeGreaterThan(120);
    expect(lum).toBeLessThan(135);
  });
});

describe('image_processor.minPairwiseColorDistance', () => {
  it('returns null for fewer than 2 centroids', () => {
    expect(minPairwiseColorDistance([])).toBeNull();
    expect(minPairwiseColorDistance([[100, 100, 100]])).toBeNull();
  });

  it('returns min distance for two centroids', () => {
    const d = minPairwiseColorDistance([[0, 0, 0], [255, 255, 255]]);
    expect(d).toBeGreaterThan(0);
  });

  it('returns smallest pairwise distance among multiple centroids', () => {
    const centroids = [[40, 45, 50], [60, 65, 70], [200, 200, 200]];
    const d = minPairwiseColorDistance(centroids);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(100);
  });
});

describe('image_processor.pointInPolygon', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];

  it('returns true for point inside polygon', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(1, 1, square)).toBe(true);
    expect(pointInPolygon(9, 9, square)).toBe(true);
  });

  it('returns false for point outside polygon', () => {
    expect(pointInPolygon(-1, -1, square)).toBe(false);
    expect(pointInPolygon(15, 15, square)).toBe(false);
    expect(pointInPolygon(5, -5, square)).toBe(false);
  });

  it('handles triangle', () => {
    const tri = [[0, 0], [10, 0], [5, 10]];
    expect(pointInPolygon(5, 3, tri)).toBe(true);
    expect(pointInPolygon(5, 11, tri)).toBe(false);
    expect(pointInPolygon(-1, 5, tri)).toBe(false);
  });
});

describe('image_processor.pointInAnyRegion', () => {
  it('returns true when no regions (all points allowed)', () => {
    expect(pointInAnyRegion(5, 5, null)).toBe(true);
    expect(pointInAnyRegion(5, 5, [])).toBe(true);
  });

  it('returns true when point inside any region', () => {
    const regions = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
    expect(pointInAnyRegion(5, 5, regions)).toBe(true);
  });

  it('returns false when point outside all regions', () => {
    const regions = [[[0, 0], [10, 0], [10, 10], [0, 10]]];
    expect(pointInAnyRegion(50, 50, regions)).toBe(false);
  });

  it('returns true when point inside second region', () => {
    const regions = [
      [[0, 0], [5, 0], [5, 5], [0, 5]],
      [[20, 20], [30, 20], [30, 30], [20, 30]],
    ];
    expect(pointInAnyRegion(25, 25, regions)).toBe(true);
  });
});
