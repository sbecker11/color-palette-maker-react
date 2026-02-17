import { getFilenameFromMeta, getFilenameWithoutExt } from '../utils';

function ImageLibrary({
  images,
  selectedMeta,
  onSelectImage,
  onDeleteImage,
  onDuplicateImage,
  onReorder,
  isLoading,
}) {
  if (isLoading) {
    return (
      <div id="storedImagesSection">
        <h2>Color Palettes</h2>
        <ul id="fileList">
          <li>Loading...</li>
        </ul>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div id="storedImagesSection">
        <h2>Color Palettes</h2>
        <ul id="fileList">
          <li>No images stored.</li>
        </ul>
      </div>
    );
  }

  return (
    <div id="storedImagesSection">
      <h2>Color Palettes</h2>
      <ul id="fileList">
        {images.map((meta, index) => {
          const filename = getFilenameFromMeta(meta) || 'unknown';
          const imageUrl = '/uploads/' + encodeURIComponent(filename);
          const filenameWithoutExt = getFilenameWithoutExt(filename);
          const displayName =
            meta.paletteName && meta.paletteName !== filenameWithoutExt
              ? meta.paletteName
              : filename;
          const dimensions =
            meta.width && meta.height ? ` (${meta.width}x${meta.height}) ` : ' ';
          const tooltip = `Filename: ${filename} | Format: ${meta.format || '?'}, Size: ${meta.fileSizeBytes ? Math.round(meta.fileSizeBytes / 1024) + ' KB' : '?'}, Added: ${meta.createdDateTime ? new Date(meta.createdDateTime).toLocaleString() : '?'}`;
          const isSelected = selectedMeta && getFilenameFromMeta(selectedMeta) === filename;
          const canMoveUp = index > 0;
          const canMoveDown = index < images.length - 1;
          const canMoveToTop = index > 0;
          const canMoveToBottom = index < images.length - 1;

          return (
            <li
              key={filename}
              className={isSelected ? 'selected-image' : ''}
            >
              <span className="library-item-top-bottom">
                <button
                  type="button"
                  className="order-btn order-top"
                  title="Move to top"
                  disabled={!canMoveToTop}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder?.(index, 'top');
                  }}
                  aria-label="Move to top"
                >
                  ⏫
                </button>
                <button
                  type="button"
                  className="order-btn order-bottom"
                  title="Move to bottom"
                  disabled={!canMoveToBottom}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder?.(index, 'bottom');
                  }}
                  aria-label="Move to bottom"
                >
                  ⏬
                </button>
              </span>
              <span className="library-item-order">
                <button
                  type="button"
                  className="order-btn order-up"
                  title="Move up"
                  disabled={!canMoveUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder?.(index, 'up');
                  }}
                  aria-label="Move up"
                >
                  ⬆️
                </button>
                <button
                  type="button"
                  className="order-btn order-down"
                  title="Move down"
                  disabled={!canMoveDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorder?.(index, 'down');
                  }}
                  aria-label="Move down"
                >
                  ⬇️
                </button>
              </span>
              <a
                href={imageUrl}
                title={tooltip}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectImage?.(meta, imageUrl);
                }}
              >
                {displayName}
                {dimensions}
              </a>
              <button
                type="button"
                style={{ marginLeft: '5px', fontSize: '0.8em', padding: '2px 5px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateImage?.(filename, meta);
                }}
              >
                Dup
              </button>
              <button
                type="button"
                style={{ marginLeft: '2px', fontSize: '0.8em', padding: '2px 5px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteImage?.(filename, meta);
                }}
              >
                Del
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ImageLibrary;
