import { describe, it, expect } from 'vitest';
import {
  getFilenameFromMeta,
  getFilenameWithoutExt,
  formatFileSize,
  rgbToHex,
  formatHexDisplay,
} from './utils';

describe('utils', () => {
  describe('getFilenameFromMeta', () => {
    it('extracts filename from cachedFilePath', () => {
      expect(
        getFilenameFromMeta({ cachedFilePath: '/path/to/img-123.jpeg' })
      ).toBe('img-123.jpeg');
    });

    it('returns null when meta is null', () => {
      expect(getFilenameFromMeta(null)).toBe(null);
    });

    it('returns null when cachedFilePath is missing', () => {
      expect(getFilenameFromMeta({})).toBe(null);
    });

    it('handles Windows-style path with backslash', () => {
      expect(getFilenameFromMeta({ cachedFilePath: 'C:\\uploads\\img-123.jpeg' })).toBe('img-123.jpeg');
    });
  });

  describe('getFilenameWithoutExt', () => {
    it('removes extension from filename', () => {
      expect(getFilenameWithoutExt('img-123.jpeg')).toBe('img-123');
    });

    it('returns empty string for empty input', () => {
      expect(getFilenameWithoutExt('')).toBe('');
    });

    it('returns filename as-is when no extension', () => {
      expect(getFilenameWithoutExt('noext')).toBe('noext');
    });

    it('returns empty string for null or non-string', () => {
      expect(getFilenameWithoutExt(null)).toBe('');
      expect(getFilenameWithoutExt(123)).toBe('');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(2 * 1024 * 1024)).toBe('2.00 MB');
    });

    it('returns N/A for non-number', () => {
      expect(formatFileSize('invalid')).toBe('N/A');
    });

    it('formats 1025 bytes as KB', () => {
      expect(formatFileSize(1025)).toBe('1.0 KB');
    });

    it('formats 1048577 bytes as MB', () => {
      expect(formatFileSize(1024 * 1024 + 1)).toBe('1.00 MB');
    });
  });

  describe('rgbToHex', () => {
    it('converts RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    });

    it('pads single hex digits', () => {
      expect(rgbToHex(0, 15, 0)).toBe('#000f00');
    });
  });

  describe('formatHexDisplay', () => {
    it('returns 7-char lowercase hex for #rrggbb', () => {
      expect(formatHexDisplay('#ff0000')).toBe('#ff0000');
      expect(formatHexDisplay('#FF0000')).toBe('#ff0000');
      expect(formatHexDisplay('#aAbBcC')).toBe('#aabbcc');
    });

    it('expands #rgb to #rrggbb', () => {
      expect(formatHexDisplay('#f00')).toBe('#ff0000');
      expect(formatHexDisplay('#abc')).toBe('#aabbcc');
    });

    it('returns empty string for invalid input', () => {
      expect(formatHexDisplay('')).toBe('');
      expect(formatHexDisplay(null)).toBe('');
    });

    it('adds # prefix when hex has no leading #', () => {
      expect(formatHexDisplay('ff0000')).toBe('#ff0000');
    });

    it('returns as-is for partial hex that does not match #rrggbb or #rgb', () => {
      expect(formatHexDisplay('#a')).toBe('#a');
      expect(formatHexDisplay('#12')).toBe('#12');
    });
  });
});
