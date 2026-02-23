import { getFilenameFromMeta, formatFileSize } from '../utils';

function formatRegionParams(obj) {
  if (!obj || typeof obj !== 'object') return 'N/A';
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

function MetadataDisplay({ meta }) {
  if (!meta) {
    return (
      <div id="metadataDisplay">
        <h3>Palette Info</h3>
        <span className="placeholder">Select an image from the list below.</span>
      </div>
    );
  }

  let source = 'N/A';
  if (meta.uploadedURL) {
    source = (
      <>
        URL:{' '}
        <a
          href={meta.uploadedURL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {meta.uploadedURL}
        </a>
      </>
    );
  } else if (meta.uploadedFilePath) {
    source = `Local: ${meta.uploadedFilePath}`;
  }

  const filename = getFilenameFromMeta(meta) || 'unknown';
  const numSwatches = Array.isArray(meta.colorPalette) ? meta.colorPalette.length : 0;
  const numRegions = Array.isArray(meta.regions) ? meta.regions.length : 0;
  const swatchLabelsStr = Array.isArray(meta.swatchLabels) && meta.swatchLabels.length > 0
    ? meta.swatchLabels.join(', ')
    : 'N/A';
  const regionLabelsStr = Array.isArray(meta.regionLabels) && meta.regionLabels.length > 0
    ? meta.regionLabels.join(', ')
    : 'N/A';
  const dimensions =
    meta.width && meta.height ? `${meta.width} x ${meta.height}` : 'N/A';
  const format = meta.format || 'N/A';
  const sizeStr = meta.fileSizeBytes != null ? formatFileSize(meta.fileSizeBytes) : 'N/A';
  const added = meta.createdDateTime
    ? new Date(meta.createdDateTime).toLocaleString()
    : 'N/A';
  const regionStrategy = meta.regionStrategy ?? 'N/A';
  const regionParamsStr = formatRegionParams(meta.regionParams);

  return (
    <div id="metadataDisplay">
      <h3>Palette Info</h3>
      <ul>
        <li><strong>Palette name:</strong> {meta.paletteName ?? 'N/A'}</li>
        <li><strong>Filename:</strong> {filename}</li>
        <li><strong>Cached path:</strong> {meta.cachedFilePath ?? 'N/A'}</li>
        <li><strong># Swatches:</strong> {numSwatches}</li>
        <li><strong>Swatch labels:</strong> {swatchLabelsStr}</li>
        <li><strong>Dimensions:</strong> {dimensions}</li>
        <li><strong>Format:</strong> {format}</li>
        <li><strong>Size:</strong> {sizeStr}</li>
        <li><strong>Source:</strong> {source}</li>
        <li><strong>Added:</strong> {added}</li>
        <li><strong># Regions:</strong> {numRegions}</li>
        <li><strong>Region labels:</strong> {regionLabelsStr}</li>
        <li><strong>Region strategy:</strong> {regionStrategy}</li>
        <li><strong>Region params:</strong> {regionParamsStr}</li>
      </ul>
    </div>
  );
}

export default MetadataDisplay;
