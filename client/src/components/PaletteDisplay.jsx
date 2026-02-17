import { useState } from 'react';
import MetadataDisplay from './MetadataDisplay';

function PaletteDisplay({
  palette,
  swatchLabels = [],
  isGenerating,
  isSamplingMode,
  currentSampledColor,
  onToggleSamplingMode,
  onDeleteSwatch,
  paletteName,
  onPaletteNameChange,
  onExport,
  onRegenerateWithK,
  onDelete,
  onDuplicate,
  onPaletteNameBlur,
  selectedMeta,
  onDetectRegions,
  onDeleteRegions,
  onEnterDeleteRegionMode,
  regionsDetecting,
  hasRegions,
  showMatchPaletteSwatches = false,
  onShowMatchPaletteSwatchesChange,
  hoveredSwatchIndex = null,
  onSwatchHover,
}) {
  const [actionSelect, setActionSelect] = useState('');
  const hasPalette = palette && Array.isArray(palette) && palette.length > 0;
  const showPlaceholder = !isGenerating && !hasPalette;

  return (
    <div id="middlePanel">
      <h2>Color Palette</h2>
      <div id="paletteNameRow">
        <label htmlFor="paletteNameInput">Name:</label>
        <input
          type="text"
          id="paletteNameInput"
          name="paletteNameInput"
          value={paletteName}
          onChange={(e) => onPaletteNameChange?.(e.target.value)}
          onBlur={() => onPaletteNameBlur?.()}
          disabled={!selectedMeta}
        />
      </div>
      <div id="palette-display">
        <h3 className="palette-display-subtitle">Palette swatches</h3>
        {isGenerating && (
          <span className="placeholder">Generating palette...</span>
        )}
        {!isGenerating && hasPalette && palette.map((hexColor, idx) => (
          <div key={hexColor} className="palette-item">
            <div className="palette-swatch-wrapper">
              <div
                className={`palette-swatch ${hoveredSwatchIndex === idx ? 'highlighted' : ''}`}
                style={{ backgroundColor: hexColor }}
                title={hexColor}
                onMouseEnter={() => onSwatchHover?.(idx)}
                onMouseLeave={() => onSwatchHover?.(null)}
              />
              <span
                className="swatch-label"
                aria-hidden="true"
              >
                {swatchLabels[idx] ?? String.fromCharCode(65 + (idx % 26))}
              </span>
            </div>
            <span className="palette-label">{hexColor}</span>
            <button
              type="button"
              className="swatch-delete-btn"
              title="Delete palette swatch"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSwatch?.(hexColor);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {!isGenerating && showPlaceholder && (
          <span className="placeholder">
            No color palette extracted for this image.
          </span>
        )}
        {/* Empty swatch circle - click to enter manual swatch creation mode */}
        <div
          className="palette-item empty-swatch-circle"
          title={
            isSamplingMode && currentSampledColor
              ? `Double-click palette image to add ${currentSampledColor}. Turn off "Adding swatches" to exit.`
              : isSamplingMode
                ? 'Double-click palette image to add color. Turn off "Adding swatches" to exit.'
                : 'Click to enter add swatch mode (same as "Adding swatches" toggle)'
          }
          onClick={onToggleSamplingMode}
          role="button"
          tabIndex={0}
          aria-label="Empty swatch circle. Click to toggle add swatch mode (same as Adding swatches)."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleSamplingMode?.();
            }
          }}
        >
          <div className="palette-swatch-wrapper">
            <div
              className={`palette-swatch test-placeholder-swatch ${isSamplingMode ? 'sampling' : ''}`}
              style={{
                backgroundColor: isSamplingMode && currentSampledColor ? currentSampledColor : 'transparent',
              }}
            />
          </div>
          <span className="palette-label test-placeholder-label">#888888</span>
        </div>
      </div>
      <div id="paletteMatchSwatchesRow" className="palette-toggle-row">
        <label>
          <input
            type="checkbox"
            checked={showMatchPaletteSwatches}
            onChange={(e) => onShowMatchPaletteSwatchesChange?.(e.target.checked)}
            disabled={!hasRegions}
            aria-label="Show matching palette swatches over image"
          />
          Match palette swatches
        </label>
        <label>
          <input
            type="checkbox"
            checked={isSamplingMode}
            onChange={() => onToggleSamplingMode?.()}
            disabled={!selectedMeta}
            aria-label="Adding swatches"
          />
          Adding swatches
        </label>
      </div>
      <div id="paletteActionsRow">
        <select
          id="paletteActionsSelect"
          aria-label="Choose action"
          value={actionSelect}
          onChange={(e) => {
            const v = e.target.value;
            setActionSelect('');
            if (v === 'delete') onDelete?.();
            else if (v === 'duplicate') onDuplicate?.();
            else if (v === 'detectRegions') onDetectRegions?.();
            else if (v === 'deleteRegions') onDeleteRegions?.();
            else if (v === 'enterDeleteRegionMode') onEnterDeleteRegionMode?.();
            else if (v === 'kmeans5') onRegenerateWithK?.(5);
            else if (v === 'kmeans7') onRegenerateWithK?.(7);
            else if (v === 'kmeans9') onRegenerateWithK?.(9);
            else if (v === 'export') onExport?.();
          }}
          disabled={!selectedMeta || isGenerating || regionsDetecting}
        >
          <option value="" disabled>Choose action…</option>
          <option value="delete">(Del)ete</option>
          <option value="duplicate">(Dup)licate</option>
          <option value="detectRegions">{regionsDetecting ? 'Detecting…' : 'Detect Regions'}</option>
          <option value="enterDeleteRegionMode" disabled={!hasRegions}>Remove Region (click)</option>
          <option value="deleteRegions" disabled={!hasRegions}>Clear all Regions</option>
          <option value="kmeans5">K-means (5){hasRegions ? ' (by regions)' : ''}</option>
          <option value="kmeans7">K-means (7){hasRegions ? ' (by regions)' : ''}</option>
          <option value="kmeans9">K-means (9){hasRegions ? ' (by regions)' : ''}</option>
          <option value="export">Export</option>
        </select>
      </div>
      <MetadataDisplay meta={selectedMeta} />
    </div>
  );
}

export default PaletteDisplay;
