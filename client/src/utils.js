/**
 * Utility functions for Color Palette Maker
 */

export function getFilenameFromMeta(meta) {
  if (!meta?.cachedFilePath) return null;
  return meta.cachedFilePath.split(/[/\\]/).pop();
}

export function getFilenameWithoutExt(filename) {
  if (!filename || typeof filename !== 'string') return '';
  return filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
}

export function formatFileSize(bytes) {
  if (typeof bytes !== 'number') return 'N/A';
  if (bytes > 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  if (bytes > 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }
  return bytes + ' Bytes';
}

export function rgbToHex(r, g, b) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
