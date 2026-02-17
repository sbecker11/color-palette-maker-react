import { describe, it, expect } from 'vitest';
import {
  needsPaletteGeneration,
  getNextSelectionAfterDeletion,
  computeReorderedState,
  shouldSavePaletteName,
  buildExportData,
  applyPaletteToMeta,
  applyPaletteToImages,
  applyPaletteNameToImages,
  indexToLabel,
  computeSwatchLabels,
} from './AppHelpers';

describe('AppHelpers', () => {
  describe('needsPaletteGeneration', () => {
    it('returns true when meta has no colorPalette', () => {
      expect(needsPaletteGeneration({ cachedFilePath: '/x.jpeg' })).toBe(true);
    });
    it('returns true when colorPalette is empty array', () => {
      expect(needsPaletteGeneration({ colorPalette: [] })).toBe(true);
    });
    it('returns true when colorPalette is not an array', () => {
      expect(needsPaletteGeneration({ colorPalette: 'invalid' })).toBe(true);
    });
    it('returns false when colorPalette has items', () => {
      expect(needsPaletteGeneration({ colorPalette: ['#ff0000'] })).toBe(false);
    });
    it('returns true when meta is null/undefined', () => {
      expect(needsPaletteGeneration(null)).toBe(true);
    });
  });

  describe('getNextSelectionAfterDeletion', () => {
    it('returns null for empty array', () => {
      expect(getNextSelectionAfterDeletion([])).toBe(null);
    });
    it('returns null for null/undefined', () => {
      expect(getNextSelectionAfterDeletion(null)).toBe(null);
    });
    it('returns selection when first item has cachedFilePath', () => {
      const remaining = [{ cachedFilePath: '/uploads/img.jpeg', paletteName: 'img' }];
      const result = getNextSelectionAfterDeletion(remaining);
      expect(result).toEqual({
        meta: remaining[0],
        imageUrl: '/uploads/img.jpeg',
      });
    });
    it('returns null when first item has no cachedFilePath', () => {
      const remaining = [{ paletteName: 'img' }];
      expect(getNextSelectionAfterDeletion(remaining)).toBe(null);
    });
  });

  describe('computeReorderedState', () => {
    const images = [
      { cachedFilePath: '/uploads/a.jpeg' },
      { cachedFilePath: '/uploads/b.jpeg' },
      { cachedFilePath: '/uploads/c.jpeg' },
    ];

    it('returns null when index is out of bounds', () => {
      expect(computeReorderedState(images, -1, 'down')).toBe(null);
      expect(computeReorderedState(images, 3, 'down')).toBe(null);
    });
    it('returns null when moving up at top', () => {
      expect(computeReorderedState(images, 0, 'up')).toBe(null);
    });
    it('returns null when moving down at bottom', () => {
      expect(computeReorderedState(images, 2, 'down')).toBe(null);
    });
    it('returns null when moving to top when already at top', () => {
      expect(computeReorderedState(images, 0, 'top')).toBe(null);
    });
    it('returns null when moving to bottom when already at bottom', () => {
      expect(computeReorderedState(images, 2, 'bottom')).toBe(null);
    });
    it('returns reordered state when moving to top', () => {
      const result = computeReorderedState(images, 2, 'top');
      expect(result).not.toBe(null);
      expect(result.reordered[0]).toBe(images[2]);
      expect(result.reordered[1]).toBe(images[0]);
      expect(result.reordered[2]).toBe(images[1]);
    });
    it('returns reordered state when moving to bottom', () => {
      const result = computeReorderedState(images, 0, 'bottom');
      expect(result).not.toBe(null);
      expect(result.reordered[0]).toBe(images[1]);
      expect(result.reordered[1]).toBe(images[2]);
      expect(result.reordered[2]).toBe(images[0]);
    });
    it('returns reordered state when moving down', () => {
      const result = computeReorderedState(images, 0, 'down');
      expect(result).not.toBe(null);
      expect(result.reordered[0]).toBe(images[1]);
      expect(result.reordered[1]).toBe(images[0]);
      expect(result.filenames).toEqual(['b.jpeg', 'a.jpeg', 'c.jpeg']);
    });
    it('returns reordered state when moving up', () => {
      const result = computeReorderedState(images, 1, 'up');
      expect(result).not.toBe(null);
      expect(result.reordered[0]).toBe(images[1]);
      expect(result.reordered[1]).toBe(images[0]);
    });
  });

  describe('shouldSavePaletteName', () => {
    it('returns false when selectedMeta is null', () => {
      expect(shouldSavePaletteName(null, 'name')).toBe(false);
    });
    it('returns false when paletteName is empty', () => {
      expect(shouldSavePaletteName({ cachedFilePath: '/x.jpeg' }, '')).toBe(false);
    });
    it('returns false when meta has no cachedFilePath', () => {
      expect(shouldSavePaletteName({}, 'newname')).toBe(false);
    });
    it('returns false when name unchanged', () => {
      expect(shouldSavePaletteName({ cachedFilePath: '/x.jpeg', paletteName: 'same' }, 'same')).toBe(false);
    });
    it('returns true when name changed and valid', () => {
      expect(shouldSavePaletteName({ cachedFilePath: '/x.jpeg', paletteName: 'old' }, 'new')).toBe(true);
    });
  });

  describe('buildExportData', () => {
    it('returns null when selectedMeta is null', () => {
      expect(buildExportData(null, 'name')).toBe(null);
    });
    it('returns null when palette is empty', () => {
      expect(buildExportData({ colorPalette: [] }, 'name')).toBe(null);
    });
    it('returns null when colorPalette is not array', () => {
      expect(buildExportData({ colorPalette: 'invalid' }, 'name')).toBe(null);
    });
    it('returns { name, colors } when valid', () => {
      const meta = { cachedFilePath: '/x.jpeg', colorPalette: ['#ff0000', '#00ff00'] };
      expect(buildExportData(meta, 'My Palette')).toEqual({
        name: 'My Palette',
        colors: ['#ff0000', '#00ff00'],
      });
    });
    it('uses getFilenameWithoutExt when paletteName empty', () => {
      const meta = { cachedFilePath: '/uploads/my-image.jpeg', colorPalette: ['#ff0000'] };
      expect(buildExportData(meta, '')).toEqual({
        name: 'my-image',
        colors: ['#ff0000'],
      });
    });
    it('uses palette fallback when meta has no filename', () => {
      const meta = { colorPalette: ['#ff0000'] };
      expect(buildExportData(meta, '')).toEqual({
        name: 'palette',
        colors: ['#ff0000'],
      });
    });
  });

  describe('indexToLabel', () => {
    it('returns A for 0', () => expect(indexToLabel(0)).toBe('A'));
    it('returns B for 1', () => expect(indexToLabel(1)).toBe('B'));
    it('returns Z for 25', () => expect(indexToLabel(25)).toBe('Z'));
    it('returns AA for 26', () => expect(indexToLabel(26)).toBe('AA'));
    it('returns empty for negative', () => expect(indexToLabel(-1)).toBe(''));
  });

  describe('computeSwatchLabels', () => {
    it('returns A,B for two colors', () => {
      expect(computeSwatchLabels(['#f00', '#0f0'])).toEqual(['A', 'B']);
    });
    it('returns empty for non-array', () => {
      expect(computeSwatchLabels(null)).toEqual([]);
    });
  });

  describe('applyPaletteToMeta', () => {
    it('returns meta with colorPalette and swatchLabels updated', () => {
      const meta = { cachedFilePath: '/x.jpeg' };
      expect(applyPaletteToMeta(meta, ['#aaa'])).toEqual({
        cachedFilePath: '/x.jpeg',
        colorPalette: ['#aaa'],
        swatchLabels: ['A'],
      });
    });
    it('returns meta unchanged when meta is null', () => {
      expect(applyPaletteToMeta(null, ['#aaa'])).toBe(null);
    });
  });

  describe('applyPaletteToImages', () => {
    it('returns empty array when images is null', () => {
      expect(applyPaletteToImages(null, 'x.jpeg', ['#aaa'])).toEqual([]);
    });
    it('updates only matching image with palette and swatchLabels', () => {
      const images = [
        { cachedFilePath: '/a.jpeg' },
        { cachedFilePath: '/b.jpeg' },
      ];
      const result = applyPaletteToImages(images, 'b.jpeg', ['#ff0000']);
      expect(result[0]).toBe(images[0]);
      expect(result[1]).toEqual({
        cachedFilePath: '/b.jpeg',
        colorPalette: ['#ff0000'],
        swatchLabels: ['A'],
      });
    });
  });

  describe('applyPaletteNameToImages', () => {
    it('returns empty array when images is null', () => {
      expect(applyPaletteNameToImages(null, 'x.jpeg', 'name')).toEqual([]);
    });
    it('updates only matching image paletteName', () => {
      const images = [
        { cachedFilePath: '/a.jpeg', paletteName: 'A' },
        { cachedFilePath: '/b.jpeg', paletteName: 'B' },
      ];
      const result = applyPaletteNameToImages(images, 'b.jpeg', '  NewB  ');
      expect(result[0]).toBe(images[0]);
      expect(result[1]).toEqual({ cachedFilePath: '/b.jpeg', paletteName: 'NewB' });
    });
  });
});
