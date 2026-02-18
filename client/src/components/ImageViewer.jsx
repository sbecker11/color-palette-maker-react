import { useEffect, useRef, useState } from 'react';
import { rgbToHex } from '../utils';
import { shrinkPolygon, polygonToPath } from '../imageViewerGeometry';

// Small "x" cursor for Deleting regions mode when hovering over a region
const CURSOR_DELETE_X = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path stroke="#000" stroke-width="2" d="M4 4l12 12M16 4L4 16" fill="none"/></svg>'
)}") 10 10, auto`;

function ImageViewer({
  imageUrl,
  imageAlt,
  isSamplingMode,
  onSampledColorChange,
  onDoubleClickAddColor,
  onExitAddingSwatchesMode,
  palettePanelRef,
  regions = [],
  paletteRegion = [],
  regionLabels = [],
  isDeleteRegionMode,
  onRegionClick,
  onExitDeleteRegionMode,
  showMatchPaletteSwatches = false,
  palette = [],
  swatchLabels = [],
  hoveredSwatchIndex = null,
  onSwatchHover,
}) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasCtxRef = useRef(null);
  const viewerRef = useRef(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [hoveredRegionIndex, setHoveredRegionIndex] = useState(null);

  // Exit Deleting regions mode when clicking outside the palette image div; clears checkbox and resets cursor.
  // Exclude palette panel so checkbox toggle handles exit via onChange.
  useEffect(() => {
    if (!isDeleteRegionMode) return;
    const handleDocClick = (e) => {
      if (!viewerRef.current) return;
      if (viewerRef.current.contains(e.target)) return;
      if (palettePanelRef?.current?.contains(e.target)) return;
      onExitDeleteRegionMode?.();
    };
    document.addEventListener('mousedown', handleDocClick, true);
    return () => document.removeEventListener('mousedown', handleDocClick, true);
  }, [isDeleteRegionMode, onExitDeleteRegionMode, palettePanelRef]);

  // Exit Adding swatches mode when clicking outside the palette image div; clears checkbox and resets cursor.
  // Exclude palette panel so checkbox toggle handles exit via onChange.
  useEffect(() => {
    if (!isSamplingMode) return;
    const handleDocClick = (e) => {
      if (!viewerRef.current) return;
      if (viewerRef.current.contains(e.target)) return;
      if (palettePanelRef?.current?.contains(e.target)) return;
      onExitAddingSwatchesMode?.();
    };
    document.addEventListener('mousedown', handleDocClick, true);
    return () => document.removeEventListener('mousedown', handleDocClick, true);
  }, [isSamplingMode, onExitAddingSwatchesMode, palettePanelRef]);

  // Draw image to hidden canvas when imageUrl changes
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) {
      // Reset dimensions when no image; defer to avoid set-state-in-effect warning
      queueMicrotask(() => setImageSize({ w: 0, h: 0 }));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvasCtxRef.current = ctx;
        ctx.drawImage(img, 0, 0);
      }
    };
    img.onerror = () => {
      if (canvasCtxRef.current && canvasRef.current) {
        canvasCtxRef.current.clearRect(
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const getCanvasCoords = (event) => {
    const imgElement = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvasCtxRef.current;
    if (!imgElement || !canvas || !ctx || !imgElement.complete || imgElement.naturalWidth === 0) {
      return null;
    }

    const rect = imgElement.getBoundingClientRect();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const elemWidth = rect.width;
    const elemHeight = rect.height;

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const scale = Math.min(elemWidth / canvasWidth, elemHeight / canvasHeight);
    const displayedWidth = canvasWidth * scale;
    const displayedHeight = canvasHeight * scale;
    const offsetX = (elemWidth - displayedWidth) / 2;
    const offsetY = 0;

    const imgX = mouseX - offsetX;
    const imgY = mouseY - offsetY;

    if (imgX < -1 || imgX > displayedWidth + 1 || imgY < -1 || imgY > displayedHeight + 1) {
      return null;
    }

    const canvasX = Math.floor(imgX / scale);
    const canvasY = Math.floor(imgY / scale);

    const x = Math.max(0, Math.min(canvasX, canvasWidth - 1));
    const y = Math.max(0, Math.min(canvasY, canvasHeight - 1));

    return { x, y };
  };

  const handleMouseMove = (event) => {
    if (!isSamplingMode) return;

    const coords = getCanvasCoords(event);
    if (!coords) return;

    const ctx = canvasCtxRef.current;
    if (!ctx) return;

    try {
      const pixelData = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      const r = pixelData[0];
      const g = pixelData[1];
      const b = pixelData[2];
      const hex = rgbToHex(r, g, b);
      onSampledColorChange?.(hex);
    } catch {
      onSampledColorChange?.(null);
    }
  };

  const handleMouseLeave = () => {
    if (isSamplingMode) {
      onSampledColorChange?.(null);
    }
  };

  const handleDoubleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isSamplingMode) return;

    const coords = getCanvasCoords(event);
    if (!coords) return;

    const ctx = canvasCtxRef.current;
    if (!ctx) return;

    try {
      const pixelData = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      const r = pixelData[0];
      const g = pixelData[1];
      const b = pixelData[2];
      const hex = rgbToHex(r, g, b).toLowerCase();
      onDoubleClickAddColor?.(hex);
    } catch {
      // ignore (e.g. CORS-tainted canvas)
    }
  };

  const hasImage = !!imageUrl;

  return (
    <div id="imageViewerContainer">
      <div id="imageViewer" ref={viewerRef}>
        {!hasImage && (
          <span className="placeholder">Select an image from the list</span>
        )}
        <canvas
          ref={canvasRef}
          id="imageCanvas"
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        {hasImage && (
          <div className="image-viewer-content">
            <img
              ref={imgRef}
              id="displayedImage"
              src={imageUrl}
              alt={imageAlt || 'Palette image'}
              title={imageAlt || 'Palette image'}
            />
            <div
              className="image-viewer-overlay"
              style={{
                cursor: isSamplingMode ? 'crosshair' : isDeleteRegionMode ? 'crosshair' : 'default',
                pointerEvents: isSamplingMode || isDeleteRegionMode || (regions?.length > 0) ? 'auto' : 'none',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={handleDoubleClick}
            />
            {((regions?.length > 0) || (paletteRegion?.length > 0)) && imageSize.w > 0 && (
              <svg
                className="region-overlay"
                viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
                preserveAspectRatio="xMidYMin meet"
                style={{
                  pointerEvents: isSamplingMode
                    ? 'none'
                    : regions?.length > 0 || paletteRegion?.length > 0
                      ? 'auto'
                      : 'none',
                  cursor: isDeleteRegionMode ? 'crosshair' : 'default',
                }}
                onClick={(e) => {
                  if (!isDeleteRegionMode) return;
                  const target = e.target;
                  if (target.dataset.regionIndex != null) {
                    e.stopPropagation();
                    onRegionClick?.(parseInt(target.dataset.regionIndex, 10));
                  }
                }}
                onMouseLeave={() => {
                  setHoveredRegionIndex(null);
                  if (showMatchPaletteSwatches) onSwatchHover?.(null);
                }}
              >
                {regions.map((poly, i) => {
                  const shrunk = shrinkPolygon(poly, 3);
                  const d = polygonToPath(shrunk);
                  const regionData = paletteRegion?.[i];
                  const paletteColorForRegion = regionData?.hex;
                  const paletteIdxForRegion = paletteColorForRegion != null
                    ? palette.findIndex((c) => String(c).toLowerCase() === String(paletteColorForRegion).toLowerCase())
                    : -1;
                  const isRegionHovered = hoveredRegionIndex === i;
                  const isSwatchMatchHighlighted = showMatchPaletteSwatches && hoveredSwatchIndex === paletteIdxForRegion;
                  const isBoundaryHighlighted = isRegionHovered || isSwatchMatchHighlighted;
                  return (
                    <path
                      key={`region-${i}`}
                      className="region-boundary"
                      data-region-index={i}
                      d={d}
                      fill={isBoundaryHighlighted ? 'rgba(150, 220, 255, 0.45)' : 'rgba(100, 180, 255, 0.2)'}
                      stroke={isBoundaryHighlighted ? 'rgba(80, 160, 255, 1)' : 'rgba(50, 120, 200, 0.9)'}
                      strokeWidth={isBoundaryHighlighted ? 4 : 3}
                      style={{ cursor: isDeleteRegionMode ? CURSOR_DELETE_X : 'default' }}
                      onMouseEnter={() => {
                        setHoveredRegionIndex(i);
                        if (showMatchPaletteSwatches && paletteIdxForRegion >= 0) onSwatchHover?.(paletteIdxForRegion);
                      }}
                      onMouseLeave={() => {
                        setHoveredRegionIndex(null);
                        if (showMatchPaletteSwatches) onSwatchHover?.(null);
                      }}
                    />
                  );
                })}
                {paletteRegion.map((regionData, i) => {
                  const r = 15;
                  const swatchOffset = 28;
                  const swatchCx = regionData.x + swatchOffset;
                  const swatchCy = regionData.y - swatchOffset;
                  const labelOffset = r + 8;
                  const regionColor = regionData.regionColor ?? regionData.hex;
                  const paletteColor = regionData.hex;
                  // One palette swatch may map to zero or more overlays (multiple regions can share the same nearest color)
                  const paletteIdx = palette.findIndex(
                    (c) => String(c).toLowerCase() === String(paletteColor).toLowerCase()
                  );
                  const regionLabel = regionLabels[i] ?? String(i).padStart(2, '0');
                  const isRegionHovered = hoveredRegionIndex === i;
                  const isSwatchMatchHighlighted = showMatchPaletteSwatches && hoveredSwatchIndex === paletteIdx;
                  const isRegionHighlighted = isRegionHovered || isSwatchMatchHighlighted;
                  const isOverlayHighlighted = (hoveredSwatchIndex === paletteIdx) || (showMatchPaletteSwatches && isRegionHovered);
                  const regionHexFontSize = isRegionHighlighted ? 16 : 13;
                  const swatchHexFontSize = (isRegionHighlighted || isOverlayHighlighted) ? 17 : 14;
                  const baseStyle = (fontSize) => ({ textAnchor: 'middle', dominantBaseline: 'central', fontSize });
                  const dualText = (h, v, t, hovered, fontSize) => (
                    <>
                      <text x={h} y={v} {...baseStyle(fontSize)} fill="black">{t}</text>
                      <text x={h - 1} y={v - 1} {...baseStyle(fontSize)} fill={hovered ? 'rgba(255, 255, 200, 1)' : 'white'}>{t}</text>
                    </>
                  );
                  const regionLabelFontSize = isRegionHighlighted ? 15 : 12;
                  const swatchLabelFontSize = (isRegionHighlighted || isOverlayHighlighted) ? 16 : 13;
                  const regionLabelStyle = { textAnchor: 'middle', dominantBaseline: 'central', fontSize: regionLabelFontSize, fontWeight: 600 };
                  return (
                    <g
                      key={`region-display-${i}`}
                      className="region-display"
                      aria-label={`Region ${regionLabel}`}
                      onMouseEnter={() => {
                        setHoveredRegionIndex(i);
                        if (showMatchPaletteSwatches) onSwatchHover?.(paletteIdx >= 0 ? paletteIdx : null);
                      }}
                      onMouseLeave={() => {
                        setHoveredRegionIndex(null);
                        if (showMatchPaletteSwatches) onSwatchHover?.(null);
                      }}
                      style={{ cursor: isDeleteRegionMode ? CURSOR_DELETE_X : 'default' }}
                    >
                      <circle
                        cx={regionData.x}
                        cy={regionData.y}
                        r={r}
                        fill="none"
                        stroke={isRegionHighlighted ? 'rgba(255, 220, 100, 1)' : 'white'}
                        strokeWidth={isRegionHighlighted ? 3 : 1}
                        className="region-circle"
                        aria-hidden="true"
                      />
                      {showMatchPaletteSwatches && (
                        <>
                          <circle
                            cx={swatchCx}
                            cy={swatchCy}
                            r={r}
                            fill={paletteColor}
                            className={`palette-swatch-overlay ${isOverlayHighlighted ? 'highlighted' : ''}`}
                            stroke={isOverlayHighlighted ? 'rgba(255, 255, 100, 1)' : 'var(--border-color)'}
                            strokeWidth={1}
                          />
                          {(() => {
                            const swatchLabel =
                              paletteIdx >= 0 && swatchLabels[paletteIdx]
                                ? swatchLabels[paletteIdx]
                                : String.fromCharCode(65 + (paletteIdx >= 0 ? paletteIdx : i) % 26);
                            const swatchLabelStyle = {
                              textAnchor: 'middle',
                              dominantBaseline: 'central',
                              fontSize: swatchLabelFontSize,
                              fontWeight: 600,
                            };
                            return (
                              <>
                                <text
                                  x={swatchCx + 1}
                                  y={swatchCy + 1}
                                  {...swatchLabelStyle}
                                  fill="black"
                                  className="swatch-label-shadow"
                                >
                                  {swatchLabel}
                                </text>
                                <text
                                  x={swatchCx}
                                  y={swatchCy}
                                  {...swatchLabelStyle}
                                  fill={(isRegionHighlighted || isOverlayHighlighted) ? 'rgba(255, 255, 200, 1)' : 'white'}
                                  className="swatch-label-overlay"
                                >
                                  {swatchLabel}
                                </text>
                              </>
                            );
                          })()}
                          {dualText(swatchCx, swatchCy + labelOffset, paletteColor, isRegionHighlighted || isOverlayHighlighted, swatchHexFontSize)}
                        </>
                      )}
                      <text x={regionData.x + 1} y={regionData.y + 1} {...regionLabelStyle} fill="black" className="region-label-shadow">
                        {regionLabel}
                      </text>
                      <text
                        x={regionData.x}
                        y={regionData.y}
                        {...regionLabelStyle}
                        fill={isRegionHighlighted ? 'rgba(255, 255, 200, 1)' : 'white'}
                        className="region-label"
                      >
                        {regionLabel}
                      </text>
                      {dualText(regionData.x, regionData.y + labelOffset, regionColor, isRegionHighlighted, regionHexFontSize)}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageViewer;
