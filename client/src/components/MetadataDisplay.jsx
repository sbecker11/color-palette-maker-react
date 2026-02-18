import { getFilenameFromMeta, formatFileSize } from '../utils';

function MetadataDisplay({ meta }) {
  if (!meta) {
    return (
      <div id="metadataDisplay">
        <h3>Palette image info</h3>
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
  const dimensions =
    meta.width && meta.height ? `${meta.width} x ${meta.height}` : 'N/A';
  const format = meta.format || 'N/A';
  const sizeStr = formatFileSize(meta.fileSizeBytes);
  const added = meta.createdDateTime
    ? new Date(meta.createdDateTime).toLocaleString()
    : 'N/A';

  return (
    <div id="metadataDisplay">
      <h3>Palette image info</h3>
      <ul>
        <li>
          <strong>Filename:</strong> {filename}
        </li>
        <li>
          <strong># Swatches:</strong> {numSwatches}
        </li>
        <li>
          <strong># Regions:</strong> {numRegions}
        </li>
        <li>
          <strong>Dimensions:</strong> {dimensions}
        </li>
        <li>
          <strong>Format:</strong> {format}
        </li>
        <li>
          <strong>Size:</strong> {sizeStr}
        </li>
        <li>
          <strong>Source:</strong> {source}
        </li>
        <li>
          <strong>Added:</strong> {added}
        </li>
      </ul>
    </div>
  );
}

export default MetadataDisplay;
