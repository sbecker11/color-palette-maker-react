import { useState, useRef } from 'react';
import { formatHexDisplay, getFilenameFromMeta } from '../utils';
import MetadataDisplay from './MetadataDisplay';
import { VALID_STRATEGIES, REGION_STRATEGIES, STRATEGIES_WITH_PARAMS } from '../../../shared/regionStrategies.js';

const DEFAULT_REGION_PARAMS = {
  adaptiveBlockSize: 11,
  adaptiveC: 2,
  cannyLow: 50,
  cannyHigh: 150,
  colorClusters: 12,
  watershedDistRatio: 0.5,
  grabcutRectPad: 0.1,
  grabcutIterCount: 5,
  slicRegionSize: 25,
  slicRuler: 10,
  meanshiftSpatial: 15,
  meanshiftColor: 40,
  quadtreeVariance: 500,
  quadtreeMinSize: 32,
  circlesMinRadiusRatio: 0.02,
  circlesMaxRadiusRatio: 0.45,
  circlesParam1: 80,
  circlesParam2: 35,
  circlesMinDistRatio: 0.07,
  contourCirclesCircularity: 0.75,
  rectanglesEpsilonRatio: 0.05,
};

function RegionDetectionForm({ selectedMeta, onDetectRegions, regionsDetecting, onRegionStrategyChange, templateDrawPhase }) {
  const s = selectedMeta?.regionStrategy;
  const p = selectedMeta?.regionParams;
  const initialStrategy = s && VALID_STRATEGIES.includes(s) ? s : 'default';
  const initialParams = p && typeof p === 'object' ? { ...DEFAULT_REGION_PARAMS, ...p } : DEFAULT_REGION_PARAMS;
  const [regionStrategy, setRegionStrategy] = useState(initialStrategy);
  const [regionParams, setRegionParams] = useState(initialParams);
  const hasStrategyParams = STRATEGIES_WITH_PARAMS.includes(regionStrategy);
  const handleStrategyChange = (e) => {
    const v = e.target.value;
    setRegionStrategy(v);
    onRegionStrategyChange?.(v);
  };
  const buildDetectParams = () => {
    const opts = {};
    if (regionStrategy === 'adaptive') {
      opts.adaptiveBlockSize = regionParams.adaptiveBlockSize;
      opts.adaptiveC = regionParams.adaptiveC;
    } else if (regionStrategy === 'canny') {
      opts.cannyLow = regionParams.cannyLow;
      opts.cannyHigh = regionParams.cannyHigh;
    } else if (regionStrategy === 'color') {
      opts.colorClusters = regionParams.colorClusters;
    } else if (regionStrategy === 'watershed') {
      opts.watershedDistRatio = regionParams.watershedDistRatio;
    } else if (regionStrategy === 'grabcut') {
      opts.grabcutRectPad = regionParams.grabcutRectPad;
      opts.grabcutIterCount = regionParams.grabcutIterCount;
    } else if (regionStrategy === 'slic') {
      opts.slicRegionSize = regionParams.slicRegionSize;
      opts.slicRuler = regionParams.slicRuler;
    } else if (regionStrategy === 'meanshift') {
      opts.meanshiftSpatial = regionParams.meanshiftSpatial;
      opts.meanshiftColor = regionParams.meanshiftColor;
    } else if (regionStrategy === 'quadtree') {
      opts.quadtreeVariance = regionParams.quadtreeVariance;
      opts.quadtreeMinSize = regionParams.quadtreeMinSize;
    } else if (regionStrategy === 'circles') {
      opts.circlesMinRadiusRatio = regionParams.circlesMinRadiusRatio;
      opts.circlesMaxRadiusRatio = regionParams.circlesMaxRadiusRatio;
      opts.circlesParam1 = regionParams.circlesParam1;
      opts.circlesParam2 = regionParams.circlesParam2;
      opts.circlesMinDistRatio = regionParams.circlesMinDistRatio;
    } else if (regionStrategy === 'contour_circles') {
      opts.circlesMinRadiusRatio = regionParams.circlesMinRadiusRatio;
      opts.circlesMaxRadiusRatio = regionParams.circlesMaxRadiusRatio;
      opts.contourCirclesCircularity = regionParams.contourCirclesCircularity;
    } else if (regionStrategy === 'template_match') {
      // No extra params; template box is drawn on image
    } else if (regionStrategy === 'rectangles') {
      opts.rectanglesEpsilonRatio = regionParams.rectanglesEpsilonRatio;
    }
    return opts;
  };
  return (
    <div id="regionDetectionSection">
      <div id="regionDetectionRow">
        <label htmlFor="regionStrategySelect">Region detection:</label>
        <select
          id="regionStrategySelect"
          aria-label="Region detection approach"
          value={regionStrategy}
          onChange={handleStrategyChange}
          disabled={!selectedMeta || regionsDetecting}
        >
          {REGION_STRATEGIES.map((strat) => (
            <option key={strat.value} value={strat.value}>
              {strat.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onDetectRegions?.(regionStrategy, buildDetectParams())}
          disabled={!selectedMeta || regionsDetecting}
          aria-label={regionStrategy === 'template_match' && templateDrawPhase ? (templateDrawPhase === 'drag' ? 'Drag' : 'Click') : 'Detect regions'}
        >
          {regionsDetecting ? 'Detecting…' : regionStrategy === 'template_match' && templateDrawPhase === 'drag' ? 'Drag' : regionStrategy === 'template_match' && templateDrawPhase === 'click' ? 'Click' : 'Detect'}
        </button>
      </div>
      {hasStrategyParams && (
        <div id="regionParamsRow">
          {regionStrategy === 'adaptive' && (
            <>
              <label htmlFor="regionParamBlockSize">Block size:</label>
              <input
                id="regionParamBlockSize"
                type="number"
                min={3}
                max={31}
                step={2}
                value={regionParams.adaptiveBlockSize}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, adaptiveBlockSize: parseInt(e.target.value, 10) || 11 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamC">C:</label>
              <input
                id="regionParamC"
                type="number"
                min={0}
                max={20}
                value={regionParams.adaptiveC}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, adaptiveC: parseInt(e.target.value, 10) || 2 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'canny' && (
            <>
              <label htmlFor="regionParamCannyLow">Low:</label>
              <input
                id="regionParamCannyLow"
                type="number"
                min={1}
                max={255}
                value={regionParams.cannyLow}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, cannyLow: parseInt(e.target.value, 10) || 50 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamCannyHigh">High:</label>
              <input
                id="regionParamCannyHigh"
                type="number"
                min={1}
                max={255}
                value={regionParams.cannyHigh}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, cannyHigh: parseInt(e.target.value, 10) || 150 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'color' && (
            <>
              <label htmlFor="regionParamClusters">Clusters:</label>
              <input
                id="regionParamClusters"
                type="number"
                min={2}
                max={20}
                value={regionParams.colorClusters}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, colorClusters: parseInt(e.target.value, 10) || 12 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'watershed' && (
            <>
              <label htmlFor="regionParamDistRatio">Dist ratio:</label>
              <input
                id="regionParamDistRatio"
                type="number"
                min={0.1}
                max={0.9}
                step={0.1}
                value={regionParams.watershedDistRatio}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, watershedDistRatio: parseFloat(e.target.value) || 0.5 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'grabcut' && (
            <>
              <label htmlFor="regionParamGrabcutRectPad">Rect pad:</label>
              <input
                id="regionParamGrabcutRectPad"
                type="number"
                min={0.05}
                max={0.3}
                step={0.05}
                value={regionParams.grabcutRectPad}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, grabcutRectPad: parseFloat(e.target.value) || 0.1 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamGrabcutIter">Iters:</label>
              <input
                id="regionParamGrabcutIter"
                type="number"
                min={3}
                max={10}
                value={regionParams.grabcutIterCount}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, grabcutIterCount: parseInt(e.target.value, 10) || 5 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'slic' && (
            <>
              <label htmlFor="regionParamSlicSize">Region size:</label>
              <input
                id="regionParamSlicSize"
                type="number"
                min={10}
                max={100}
                value={regionParams.slicRegionSize}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, slicRegionSize: parseInt(e.target.value, 10) || 25 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamSlicRuler">Ruler:</label>
              <input
                id="regionParamSlicRuler"
                type="number"
                min={5}
                max={40}
                value={regionParams.slicRuler}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, slicRuler: parseFloat(e.target.value) || 10 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'meanshift' && (
            <>
              <label htmlFor="regionParamMeanshiftSpatial">Spatial:</label>
              <input
                id="regionParamMeanshiftSpatial"
                type="number"
                min={1}
                max={50}
                value={regionParams.meanshiftSpatial}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, meanshiftSpatial: parseInt(e.target.value, 10) || 15 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamMeanshiftColor">Color:</label>
              <input
                id="regionParamMeanshiftColor"
                type="number"
                min={1}
                max={100}
                value={regionParams.meanshiftColor}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, meanshiftColor: parseInt(e.target.value, 10) || 40 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'quadtree' && (
            <>
              <label htmlFor="regionParamQuadtreeVariance">Variance:</label>
              <input
                id="regionParamQuadtreeVariance"
                type="number"
                min={100}
                max={2000}
                value={regionParams.quadtreeVariance}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, quadtreeVariance: parseInt(e.target.value, 10) || 500 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamQuadtreeMinSize">Min size:</label>
              <input
                id="regionParamQuadtreeMinSize"
                type="number"
                min={16}
                max={64}
                value={regionParams.quadtreeMinSize}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, quadtreeMinSize: parseInt(e.target.value, 10) || 32 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'circles' && (
            <>
              <label htmlFor="regionParamCirclesMinRatio">Min radius %:</label>
              <input
                id="regionParamCirclesMinRatio"
                type="number"
                min={1}
                max={20}
                step={0.5}
                value={regionParams.circlesMinRadiusRatio * 100}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesMinRadiusRatio: (parseFloat(e.target.value) || 2) / 100 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamCirclesMaxRatio">Max radius %:</label>
              <input
                id="regionParamCirclesMaxRatio"
                type="number"
                min={4}
                max={50}
                step={1}
                value={regionParams.circlesMaxRadiusRatio * 100}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesMaxRadiusRatio: (parseFloat(e.target.value) || 45) / 100 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamCirclesParam1">Param1 (Canny):</label>
              <input
                id="regionParamCirclesParam1"
                type="number"
                min={50}
                max={200}
                value={regionParams.circlesParam1}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesParam1: parseInt(e.target.value, 10) || 80 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamCirclesParam2">Param2 (votes):</label>
              <input
                id="regionParamCirclesParam2"
                type="number"
                min={20}
                max={100}
                value={regionParams.circlesParam2}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesParam2: parseInt(e.target.value, 10) || 35 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamCirclesMinDist">Min dist %:</label>
              <input
                id="regionParamCirclesMinDist"
                type="number"
                min={4}
                max={15}
                step={0.5}
                value={regionParams.circlesMinDistRatio * 100}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesMinDistRatio: (parseFloat(e.target.value) || 7) / 100 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'contour_circles' && (
            <>
              <label htmlFor="regionParamContourCirclesMinRatio">Min radius %:</label>
              <input
                id="regionParamContourCirclesMinRatio"
                type="number"
                min={1}
                max={20}
                step={0.5}
                value={regionParams.circlesMinRadiusRatio * 100}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesMinRadiusRatio: (parseFloat(e.target.value) || 2) / 100 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamContourCirclesMaxRatio">Max radius %:</label>
              <input
                id="regionParamContourCirclesMaxRatio"
                type="number"
                min={4}
                max={50}
                step={1}
                value={regionParams.circlesMaxRadiusRatio * 100}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, circlesMaxRadiusRatio: (parseFloat(e.target.value) || 45) / 100 }))}
                disabled={regionsDetecting}
              />
              <label htmlFor="regionParamContourCirclesCircularity">Circularity:</label>
              <input
                id="regionParamContourCirclesCircularity"
                type="number"
                min={0.5}
                max={0.98}
                step={0.05}
                value={regionParams.contourCirclesCircularity}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, contourCirclesCircularity: parseFloat(e.target.value) || 0.75 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
          {regionStrategy === 'rectangles' && (
            <>
              <label htmlFor="regionParamRectEpsilon">Epsilon %:</label>
              <input
                id="regionParamRectEpsilon"
                type="number"
                min={2}
                max={15}
                step={0.5}
                value={regionParams.rectanglesEpsilonRatio * 100}
                onChange={(e) => setRegionParams((prev) => ({ ...prev, rectanglesEpsilonRatio: (parseFloat(e.target.value) || 5) / 100 }))}
                disabled={regionsDetecting}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RegionDetectionAndActions({
  selectedMeta,
  hasRegions,
  hasPalette,
  isGenerating,
  regionsDetecting,
  actionSelect,
  setActionSelect,
  paletteNameInputRef,
  onDetectRegions,
  onRegionStrategyChange,
  templateDrawPhase,
  onDelete,
  onDuplicate,
  onExport,
  onRegenerateWithK,
  onToggleSamplingMode,
  onClearAllSwatches,
  onEnterDeleteRegionMode,
  onDeleteRegions,
}) {
  const hasStoredRegions = selectedMeta?.regions && Array.isArray(selectedMeta.regions) && selectedMeta.regions.length > 0;
  const [showRegionDetection, setShowRegionDetection] = useState(hasStoredRegions);

  return (
    <>
      {showRegionDetection && (
        <RegionDetectionForm
          selectedMeta={selectedMeta}
          onDetectRegions={onDetectRegions}
          onRegionStrategyChange={onRegionStrategyChange}
          regionsDetecting={regionsDetecting}
          templateDrawPhase={templateDrawPhase}
        />
      )}
      <div id="paletteActionsRow">
        <select
          id="paletteActionsSelect"
          aria-label="Choose action"
          value={actionSelect}
          onChange={(e) => {
            const v = e.target.value;
            setActionSelect('');
            if (v === 'rename') {
              paletteNameInputRef?.current?.focus();
              paletteNameInputRef?.current?.select();
            } else if (v === 'delete') {
              setTimeout(() => onDelete?.(), 0);
            } else if (v === 'duplicate') onDuplicate?.();
            else if (v === 'export') onExport?.();
            else if (v === 'kmeans5') onRegenerateWithK?.(5);
            else if (v === 'kmeans7') onRegenerateWithK?.(7);
            else if (v === 'kmeans9') onRegenerateWithK?.(9);
            else if (v === 'enterAddingSwatches') onToggleSamplingMode?.();
            else if (v === 'clearSwatches') onClearAllSwatches?.();
            else if (v === 'detectRegions') setShowRegionDetection(true);
            else if (v === 'enterDeleteRegionMode') onEnterDeleteRegionMode?.();
            else if (v === 'deleteRegions') onDeleteRegions?.();
          }}
          disabled={!selectedMeta || isGenerating || regionsDetecting}
        >
          <option value="" disabled>Choose action…</option>
          <option value="rename">Rename Palette</option>
          <option value="duplicate">(Dup)licate Palette</option>
          <option value="delete">(Del)ete Palette</option>
          <option value="export">Export Palette</option>
          <option value="" disabled>-------</option>
          <option value="kmeans5">Find K-Means Swatches (5){hasRegions ? ' (by regions)' : ''}</option>
          <option value="kmeans7">Find K-Means Swatches (7){hasRegions ? ' (by regions)' : ''}</option>
          <option value="kmeans9">Find K-Means Swatches (9){hasRegions ? ' (by regions)' : ''}</option>
          <option value="enterAddingSwatches">Adding Swatches (click)</option>
          <option value="clearSwatches" disabled={!hasPalette}>Clear all Swatches</option>
          <option value="" disabled>--------</option>
          <option value="detectRegions">Detect All Regions</option>
          <option value="enterDeleteRegionMode" disabled={!hasRegions}>Deleting Regions (click)</option>
          <option value="deleteRegions" disabled={!hasRegions}>Clear all Regions</option>
        </select>
      </div>
    </>
  );
}

function PaletteDisplay({
  palette,
  swatchLabels = [],
  isGenerating,
  isSamplingMode,
  currentSampledColor,
  onToggleSamplingMode,
  onAddingSwatchesModeChange,
  onDeleteSwatch,
  onClearAllSwatches,
  paletteName,
  onPaletteNameChange,
  onExport,
  onRegenerateWithK,
  onDelete,
  onDuplicate,
  onPaletteNameBlur,
  selectedMeta,
  onDetectRegions,
  onRegionStrategyChange,
  templateDrawPhase = null,
  onDeleteRegions,
  onEnterDeleteRegionMode,
  isDeleteRegionMode = false,
  onDeleteRegionModeChange,
  regionsDetecting,
  hasRegions,
  showMatchPaletteSwatches = false,
  onShowMatchPaletteSwatchesChange,
  hoveredSwatchIndex = null,
  onSwatchHover,
  palettePanelRef,
}) {
  const [actionSelect, setActionSelect] = useState('');
  const paletteNameInputRef = useRef(null);
  const hasPalette = palette && Array.isArray(palette) && palette.length > 0;
  const showPlaceholder = !isGenerating && !hasPalette;

  return (
    <div id="middlePanel" ref={palettePanelRef}>
      <h2>Color Palette</h2>
      <div id="paletteNameRow">
        <label htmlFor="paletteNameInput">Name:</label>
        <input
          ref={paletteNameInputRef}
          type="text"
          id="paletteNameInput"
          name="paletteNameInput"
          value={paletteName}
          onChange={(e) => onPaletteNameChange?.(e.target.value)}
          onBlur={() => onPaletteNameBlur?.()}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPaletteNameBlur?.(); } }}
          disabled={!selectedMeta}
        />
      </div>
      <div id="palette-display">
        <h3 className="palette-display-subtitle">Palette swatches</h3>
        {isGenerating && (
          <span className="placeholder">Generating palette...</span>
        )}
        {!isGenerating && hasPalette && palette.map((hexColor, idx) => (
          <div key={`${idx}-${String(hexColor)}`} className="palette-item">
            <div
              className="palette-swatch-wrapper"
              style={{ '--swatch-color': hexColor, colorScheme: 'light' }}
            >
              <div
                className={`palette-swatch palette-swatch-filled ${hoveredSwatchIndex === idx ? 'highlighted' : ''}`}
                style={{
                  backgroundColor: hexColor,
                  boxShadow: `inset 0 0 0 50px ${hexColor}`,
                }}
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
            <span className="palette-label">{formatHexDisplay(hexColor)}</span>
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
        {/* Sample swatch - same as filled swatches but no × delete button */}
        <div
          className="palette-item empty-swatch-circle"
          title={
            isSamplingMode && currentSampledColor
              ? `Click palette image to add ${currentSampledColor}. Turn off "Adding swatches (click)" to exit.`
              : isSamplingMode
                ? 'Click palette image to add color. Turn off "Adding swatches (click)" to exit.'
                : 'Click to enter add swatch mode (same as "Adding swatches (click)" toggle)'
          }
          onClick={onToggleSamplingMode}
          role="button"
          tabIndex={0}
          aria-label="Sample swatch. Click to toggle add swatch mode (same as Adding swatches (click))."
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleSamplingMode?.();
            }
          }}
        >
          <div className="palette-swatch-wrapper">
            <div
              className={`palette-swatch palette-swatch-sample ${!(isSamplingMode && currentSampledColor) ? 'palette-swatch-sample-empty' : ''}`}
              style={{
                '--sample-swatch-color': isSamplingMode && currentSampledColor ? currentSampledColor : 'transparent',
                boxShadow: isSamplingMode && currentSampledColor ? `inset 0 0 0 50px ${currentSampledColor}` : 'none',
              }}
              title={isSamplingMode && currentSampledColor ? currentSampledColor : undefined}
            />
            <span className={`swatch-label ${isSamplingMode && currentSampledColor ? 'swatch-label-hidden' : ''}`} aria-hidden="true">+</span>
          </div>
          <span className="palette-label">
            {isSamplingMode && currentSampledColor ? formatHexDisplay(currentSampledColor) : '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
          </span>
        </div>
      </div>
      <div id="paletteMatchSwatchesRow" className="palette-toggle-row">
        <label>
          <input
            type="checkbox"
            checked={showMatchPaletteSwatches}
            onChange={(e) => onShowMatchPaletteSwatchesChange?.(e.target.checked)}
            disabled={!hasRegions || !hasPalette}
            aria-label="Match Region Swatches"
          />
          Match Region Swatches
        </label>
        <label>
          <input
            type="checkbox"
            checked={isSamplingMode}
            onChange={(e) => onAddingSwatchesModeChange?.(e.target.checked)}
            disabled={!selectedMeta}
            aria-label="Adding swatches (click)"
          />
          Adding swatches (click)
        </label>
        <label>
          <input
            type="checkbox"
            checked={hasRegions && isDeleteRegionMode}
            onChange={(e) => onDeleteRegionModeChange?.(e.target.checked)}
            disabled={!hasRegions}
            aria-label="Deleting regions (click)"
          />
          Deleting regions (click)
        </label>
      </div>
      <RegionDetectionAndActions
        key={getFilenameFromMeta(selectedMeta) ?? 'none'}
        selectedMeta={selectedMeta}
        hasRegions={hasRegions}
        hasPalette={hasPalette}
        isGenerating={isGenerating}
        regionsDetecting={regionsDetecting}
        actionSelect={actionSelect}
        setActionSelect={setActionSelect}
        paletteNameInputRef={paletteNameInputRef}
        onDetectRegions={onDetectRegions}
        onRegionStrategyChange={onRegionStrategyChange}
        templateDrawPhase={templateDrawPhase}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onExport={onExport}
        onRegenerateWithK={onRegenerateWithK}
        onToggleSamplingMode={onToggleSamplingMode}
        onClearAllSwatches={onClearAllSwatches}
        onEnterDeleteRegionMode={onEnterDeleteRegionMode}
        onDeleteRegions={onDeleteRegions}
      />
      <MetadataDisplay meta={selectedMeta} />
    </div>
  );
}

export default PaletteDisplay;
