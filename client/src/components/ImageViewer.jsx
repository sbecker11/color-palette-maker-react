import { forwardRef, useEffect, useRef, useState } from 'react';
import { rgbToHex, formatHexDisplay } from '../utils';
import { shrinkPolygon, polygonToPath } from '../imageViewerGeometry';
import { useClickOutsideToExit } from '../hooks/useClickOutsideToExit';

// Region interior highlight on rollover (controlled by VITE_HIGHLIGHT_REGION_ON_ROLLOVER)
const HIGHLIGHT_REGION_ON_ROLLOVER = (() => {
  const v = import.meta.env.VITE_HIGHLIGHT_REGION_ON_ROLLOVER;
  if (v === undefined || v === '') return true;
  return v !== 'false' && v !== '0';
})();

// Small "x" cursor for Deleting regions mode when hovering over a region
const CURSOR_DELETE_X = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path stroke="#000" stroke-width="2" d="M4 4l12 12M16 4L4 16" fill="none"/></svg>'
)}") 10 10, auto`;

// Target radius in screen pixels to match #palette-display swatch circles (16px)
// Correction factor: observed 18px without it, so scale down by 16/18
const SWATCH_RADIUS_PX = 16 * (16 / 18);
// Target font sizes in screen pixels for overlay text (scale with overlay like circles)
const REGION_LABEL_FONT_PX = 12;
const REGION_LABEL_FONT_HOVER_PX = 15;
const REGION_HEX_FONT_PX = 13;
const REGION_HEX_FONT_HOVER_PX = 16;
const SWATCH_LABEL_FONT_PX = 13;
const SWATCH_LABEL_FONT_HOVER_PX = 16;
const SWATCH_HEX_FONT_PX = 14;
const SWATCH_HEX_FONT_HOVER_PX = 17;

const ImageViewer = forwardRef(function ImageViewer({
  imageUrl,
  imageAlt,
  isSamplingMode,
  onSampledColorChange,
  onAddColorClick,
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
  isTemplateDrawMode = false,
  onTemplateBoxDrawn,
  onTemplateDrawPhaseChange,
}, ref) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasCtxRef = useRef(null);
  const viewerRef = useRef(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [overlayScale, setOverlayScale] = useState(0);
  const [useFillMode, setUseFillMode] = useState(false);
  const regionOverlayRef = useRef(null);
  const contentRef = useRef(null);
  const [hoveredRegionIndex, setHoveredRegionIndex] = useState(null);
  const lastMouseEventRef = useRef(null);
  const onSampledColorChangeRef = useRef(onSampledColorChange);
  const isSamplingModeRef = useRef(isSamplingMode);
  const [templateDrawStart, setTemplateDrawStart] = useState(null);
  const [templateDrawCurrent, setTemplateDrawCurrent] = useState(null);
  const templateDrawPointerIdRef = useRef(null);

  useEffect(() => {
    onSampledColorChangeRef.current = onSampledColorChange;
    isSamplingModeRef.current = isSamplingMode;
  }, [onSampledColorChange, isSamplingMode]);

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

  useClickOutsideToExit(isDeleteRegionMode, onExitDeleteRegionMode, viewerRef, palettePanelRef);
  useClickOutsideToExit(isSamplingMode, onExitAddingSwatchesMode, viewerRef, palettePanelRef);

  // Clear template draw when exiting mode or changing image
  useEffect(() => {
    if (!isTemplateDrawMode) {
      setTemplateDrawStart(null);
      setTemplateDrawCurrent(null);
      templateDrawPointerIdRef.current = null;
    }
  }, [isTemplateDrawMode]);
  useEffect(() => {
    setTemplateDrawStart(null);
    setTemplateDrawCurrent(null);
    templateDrawPointerIdRef.current = null;
  }, [imageUrl]);

  useEffect(() => {
    if (!isTemplateDrawMode) {
      onTemplateDrawPhaseChange?.(null);
      return;
    }
    onTemplateDrawPhaseChange?.(templateDrawStart ? 'drag' : 'click');
  }, [isTemplateDrawMode, templateDrawStart, onTemplateDrawPhaseChange]);

  // Document-level pointer/mouse DOWN when waiting for first click (so we always capture)
  useEffect(() => {
    if (!isTemplateDrawMode || templateDrawStart) return;
    const startDraw = (e) => {
      if (!viewerRef.current?.contains(e.target)) return;
      const coords = getCanvasCoords(e);
      if (!coords) return;
      e.preventDefault();
      e.stopPropagation();
      setTemplateDrawStart(coords);
      setTemplateDrawCurrent(null);
      if (e.pointerId != null) templateDrawPointerIdRef.current = e.pointerId;
    };
    document.addEventListener('pointerdown', startDraw, true);
    document.addEventListener('mousedown', startDraw, true);
    return () => {
      document.removeEventListener('pointerdown', startDraw, true);
      document.removeEventListener('mousedown', startDraw, true);
    };
  }, [isTemplateDrawMode, templateDrawStart]);

  // Document-level pointer/mouse move so drag is always captured (even when pointer leaves overlay)
  useEffect(() => {
    if (!isTemplateDrawMode || !templateDrawStart) return;
    const onDocPointerMove = (e) => {
      if (e.pointerId !== templateDrawPointerIdRef.current) return;
      const coords = getCanvasCoords(e);
      if (coords) setTemplateDrawCurrent(coords);
    };
    const onDocMouseMove = (e) => {
      const coords = getCanvasCoords(e);
      if (coords) setTemplateDrawCurrent(coords);
    };
    document.addEventListener('pointermove', onDocPointerMove);
    document.addEventListener('mousemove', onDocMouseMove);
    return () => {
      document.removeEventListener('pointermove', onDocPointerMove);
      document.removeEventListener('mousemove', onDocMouseMove);
    };
  }, [isTemplateDrawMode, templateDrawStart]);

  // Track mouse/pointer position globally and sample color on every move when in sampling mode.
  // Use refs so the listener always sees latest props (avoids stale closure after setState re-renders).
  // Use elementFromPoint for reliable hit-testing; listen to both mousemove and pointermove for device support.
  useEffect(() => {
    const handleMove = (e) => {
      lastMouseEventRef.current = e;
      if (!isSamplingModeRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !viewerRef.current?.contains(el)) {
        onSampledColorChangeRef.current?.(null);
        return;
      }
      const coords = getCanvasCoords(e);
      if (!coords) {
        onSampledColorChangeRef.current?.(null);
        return;
      }
      const ctx = canvasCtxRef.current;
      if (!ctx) {
        onSampledColorChangeRef.current?.(null);
        return;
      }
      try {
        const pixelData = ctx.getImageData(coords.x, coords.y, 1, 1).data;
        const hex = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
        onSampledColorChangeRef.current?.(hex);
      } catch {
        onSampledColorChangeRef.current?.(null);
      }
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('pointermove', handleMove);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('pointermove', handleMove);
    };
  }, []);

  // Sample color immediately when entering sampling mode
  useEffect(() => {
    if (!isSamplingMode) {
      onSampledColorChange?.(null);
      return;
    }
    const e = lastMouseEventRef.current;
    if (!e || !viewerRef.current?.contains(e.target)) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const ctx = canvasCtxRef.current;
    if (!ctx) return;
    try {
      const pixelData = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      onSampledColorChangeRef.current?.(rgbToHex(pixelData[0], pixelData[1], pixelData[2]));
    } catch {
      onSampledColorChangeRef.current?.(null);
    }
  }, [isSamplingMode, onSampledColorChange]);

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

  // Measure overlay SVG to compute scale (viewBox units per screen px) for circle sizing.
  // Include useFillMode so we re-observe when layout switches (different SVG DOM node).
  const hasOverlay = (regions?.length > 0) || (paletteRegion?.length > 0);
  useEffect(() => {
    if (!hasOverlay || imageSize.w <= 0 || imageSize.h <= 0) {
      queueMicrotask(() => setOverlayScale(0));
      return;
    }
    const svg = regionOverlayRef.current;
    if (!svg) return;
    const updateScale = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scale = Math.min(rect.width / imageSize.w, rect.height / imageSize.h);
      setOverlayScale(scale);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(svg);
    return () => {
      ro.disconnect();
      queueMicrotask(() => setOverlayScale(0));
    };
  }, [hasOverlay, imageSize.w, imageSize.h, useFillMode]);

  // When container width > image width, use fill (cover) instead of contain
  useEffect(() => {
    const el = contentRef.current;
    if (!el || imageSize.w <= 0) {
      queueMicrotask(() => setUseFillMode(false));
      return;
    }
    const update = () => {
      const rect = el.getBoundingClientRect();
      setUseFillMode(rect.width > imageSize.w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      queueMicrotask(() => setUseFillMode(false));
    };
  }, [imageUrl, imageSize.w]);

  const handleMouseMove = (event) => {
    lastMouseEventRef.current = event;
    if (isTemplateDrawMode && templateDrawStart) {
      event.preventDefault();
      event.stopPropagation();
      const coords = getCanvasCoords(event);
      if (coords) setTemplateDrawCurrent(coords);
      return;
    }
    if (isTemplateDrawMode || isSamplingModeRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!isSamplingModeRef.current) return;
    const coords = getCanvasCoords(event);
    if (!coords) {
      onSampledColorChangeRef.current?.(null);
      return;
    }
    const ctx = canvasCtxRef.current;
    if (!ctx) {
      onSampledColorChangeRef.current?.(null);
      return;
    }
    try {
      const pixelData = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      onSampledColorChangeRef.current?.(rgbToHex(pixelData[0], pixelData[1], pixelData[2]));
    } catch {
      onSampledColorChangeRef.current?.(null);
    }
  };

  const handleMouseLeave = () => {
    if (isSamplingMode) {
      onSampledColorChange?.(null);
    }
    if (isTemplateDrawMode && templateDrawStart) {
      setTemplateDrawStart(null);
      setTemplateDrawCurrent(null);
      templateDrawPointerIdRef.current = null;
    }
  };

  const handleTemplateDrawMouseDown = (event) => {
    if (!isTemplateDrawMode) return;
    event.preventDefault();
    event.stopPropagation();
    const coords = getCanvasCoords(event);
    if (coords) setTemplateDrawStart(coords);
    setTemplateDrawCurrent(null);
  };

  const handleTemplateDrawPointerDown = (event) => {
    if (!isTemplateDrawMode) return;
    event.preventDefault();
    event.stopPropagation();
    const coords = getCanvasCoords(event);
    if (coords) {
      setTemplateDrawStart(coords);
      setTemplateDrawCurrent(null);
      templateDrawPointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handleTemplateDrawMouseUp = (event) => {
    if (!isTemplateDrawMode || !templateDrawStart) return;
    event.preventDefault();
    event.stopPropagation();
    const center = templateDrawStart;
    const current = getCanvasCoords(event);
    if (current && imageSize.w > 0 && imageSize.h > 0) {
      const dx = current.x - center.x;
      const dy = current.y - center.y;
      const r = Math.max(2, Math.max(Math.abs(dx), Math.abs(dy)));
      let x = center.x - r;
      let y = center.y - r;
      let w = 2 * r;
      let h = 2 * r;
      x = Math.max(0, Math.min(x, imageSize.w - 1));
      y = Math.max(0, Math.min(y, imageSize.h - 1));
      w = Math.min(w, imageSize.w - x);
      h = Math.min(h, imageSize.h - y);
      if (w >= 5 && h >= 5) {
        onTemplateBoxDrawn?.({ x, y, width: w, height: h });
      }
    }
    setTemplateDrawStart(null);
    setTemplateDrawCurrent(null);
    templateDrawPointerIdRef.current = null;
  };

  const handleAddColorClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isTemplateDrawMode) return;
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
      onAddColorClick?.(hex);
    } catch {
      // ignore (e.g. CORS-tainted canvas)
    }
  };

  const hasImage = !!imageUrl;

  return (
    <div id="imageViewerContainer" ref={ref}>
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
          <div
            ref={contentRef}
            className={`image-viewer-content ${useFillMode ? 'image-viewer-content-fill' : ''}`}
          >
            <div
              className="image-viewer-inner"
              onPointerDownCapture={isTemplateDrawMode ? handleTemplateDrawPointerDown : undefined}
              onMouseDownCapture={isTemplateDrawMode ? handleTemplateDrawMouseDown : undefined}
            >
              <img
                ref={imgRef}
                id="displayedImage"
                src={imageUrl}
                alt={imageAlt || 'Palette image'}
                title={imageAlt || 'Palette image'}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
              {isTemplateDrawMode && (
                <p className="image-viewer-template-draw-hint" aria-live="polite">
                  Click at the template center, drag to set the box size, then release. Template match will run automatically.
                </p>
              )}
              <div
                className="image-viewer-overlay"
                style={{
                  cursor: isTemplateDrawMode ? 'crosshair' : isSamplingMode ? 'crosshair' : isDeleteRegionMode ? 'crosshair' : 'default',
                  pointerEvents: isTemplateDrawMode || isSamplingMode || isDeleteRegionMode || (regions?.length > 0) ? 'auto' : 'none',
                }}
                onPointerDown={handleTemplateDrawPointerDown}
                onPointerMove={handleMouseMove}
                onPointerUp={handleTemplateDrawMouseUp}
                onMouseDown={handleTemplateDrawMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleTemplateDrawMouseUp}
                onMouseLeave={handleMouseLeave}
                onClick={handleAddColorClick}
              />
              {isTemplateDrawMode && templateDrawStart && imageSize.w > 0 && imageSize.h > 0 && (
                <svg
                  className="region-overlay template-draw-overlay"
                  viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
                  preserveAspectRatio="xMidYMin meet"
                  style={{ pointerEvents: 'none' }}
                  aria-hidden="true"
                >
                  {(() => {
                    const center = templateDrawStart;
                    const current = templateDrawCurrent ?? center;
                    const dx = current.x - center.x;
                    const dy = current.y - center.y;
                    const r = Math.max(2, Math.max(Math.abs(dx), Math.abs(dy)));
                    const x = Math.max(0, center.x - r);
                    const y = Math.max(0, center.y - r);
                    const w = Math.min(2 * r, imageSize.w - x);
                    const h = Math.min(2 * r, imageSize.h - y);
                    if (w < 2 || h < 2) return null;
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill="rgba(100, 180, 255, 0.2)"
                        stroke="rgba(80, 160, 255, 1)"
                        strokeWidth={2}
                      />
                    );
                  })()}
                </svg>
              )}
              {((regions?.length > 0) || (paletteRegion?.length > 0)) && imageSize.w > 0 && (
                <svg
                  ref={regionOverlayRef}
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
                    const el = e.target.closest?.('[data-region-index]');
                    if (el) {
                      e.stopPropagation();
                      onRegionClick?.(parseInt(el.dataset.regionIndex, 10));
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
                    const isBoundaryHighlighted = HIGHLIGHT_REGION_ON_ROLLOVER && (isRegionHovered || isSwatchMatchHighlighted);
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
                    const r = overlayScale > 0 ? SWATCH_RADIUS_PX / overlayScale : SWATCH_RADIUS_PX;
                    const scaledFont = (px) => (overlayScale > 0 ? px / overlayScale : px);
                    const swatchOffset = r * (28 / 15);
                    const swatchCx = regionData.x + swatchOffset;
                    const swatchCy = regionData.y - swatchOffset;
                    const labelOffset = r + (overlayScale > 0 ? 8 / overlayScale : 8);
                    const regionColor = regionData.regionColor ?? regionData.hex;
                    const paletteColor = regionData.hex;
                    const paletteIdx = palette.findIndex(
                      (c) => String(c).toLowerCase() === String(paletteColor).toLowerCase()
                    );
                    const regionLabel = regionLabels[i] ?? String(i).padStart(2, '0');
                    const isRegionHovered = hoveredRegionIndex === i;
                    const isSwatchMatchHighlighted = showMatchPaletteSwatches && hoveredSwatchIndex === paletteIdx;
                    const isRegionHighlighted = isRegionHovered || isSwatchMatchHighlighted;
                    const isOverlayHighlighted = (hoveredSwatchIndex === paletteIdx) || (showMatchPaletteSwatches && isRegionHovered);
                    const regionHexFontSize = scaledFont(isRegionHighlighted ? REGION_HEX_FONT_HOVER_PX : REGION_HEX_FONT_PX);
                    const swatchHexFontSize = scaledFont((isRegionHighlighted || isOverlayHighlighted) ? SWATCH_HEX_FONT_HOVER_PX : SWATCH_HEX_FONT_PX);
                    const shadowOffset = overlayScale > 0 ? 1 / overlayScale : 1;
                    const regionCircleStrokeWidth = overlayScale > 0 ? 1 / overlayScale : 1;
                    const baseStyle = (fontSize) => ({ textAnchor: 'middle', dominantBaseline: 'central', fontSize, fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Monaco, "Courier New", monospace' });
                    const dualText = (h, v, t, hovered, fontSize) => (
                      <>
                        <text x={h + shadowOffset} y={v + shadowOffset} {...baseStyle(fontSize)} fill="black">{t}</text>
                        <text x={h} y={v} {...baseStyle(fontSize)} fill={hovered ? 'rgba(255, 255, 200, 1)' : 'white'}>{t}</text>
                      </>
                    );
                    const regionLabelFontSize = scaledFont(isRegionHighlighted ? REGION_LABEL_FONT_HOVER_PX : REGION_LABEL_FONT_PX);
                    const swatchLabelFontSize = scaledFont((isRegionHighlighted || isOverlayHighlighted) ? SWATCH_LABEL_FONT_HOVER_PX : SWATCH_LABEL_FONT_PX);
                    const regionLabelStyle = { textAnchor: 'middle', dominantBaseline: 'central', fontSize: regionLabelFontSize, fontWeight: 600 };
                    const swatchLabel =
                      paletteIdx >= 0 && swatchLabels[paletteIdx]
                        ? swatchLabels[paletteIdx]
                        : String.fromCharCode(65 + (paletteIdx >= 0 ? paletteIdx : i) % 26);
                    const swatchLabelStyle = { textAnchor: 'middle', dominantBaseline: 'central', fontSize: swatchLabelFontSize, fontWeight: 600 };
                    return (
                      <g
                        key={`region-display-${i}`}
                        className="region-display"
                        data-region-index={i}
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
                          cx={regionData.x + shadowOffset}
                          cy={regionData.y + shadowOffset}
                          r={r}
                          fill="none"
                          stroke="black"
                          strokeWidth={regionCircleStrokeWidth}
                          className="region-circle-shadow"
                          aria-hidden="true"
                        />
                        <circle
                          cx={regionData.x}
                          cy={regionData.y}
                          r={r}
                          fill="none"
                          stroke={isRegionHighlighted ? 'rgba(255, 220, 100, 1)' : 'white'}
                          strokeWidth={regionCircleStrokeWidth}
                          className="region-circle"
                          aria-hidden="true"
                        />
                        {showMatchPaletteSwatches && regionData.hex != null && (
                          <>
                            <circle
                              cx={swatchCx + shadowOffset}
                              cy={swatchCy + shadowOffset}
                              r={r}
                              fill="black"
                              className="palette-swatch-overlay-shadow"
                              aria-hidden="true"
                            />
                            <circle
                              cx={swatchCx}
                              cy={swatchCy}
                              r={r}
                              fill={paletteColor}
                              className={`palette-swatch-overlay ${isOverlayHighlighted ? 'highlighted' : ''}`}
                              stroke={isOverlayHighlighted ? 'rgba(255, 255, 100, 1)' : 'var(--border-color)'}
                              strokeWidth={1}
                            />
                            <text x={swatchCx + shadowOffset} y={swatchCy + shadowOffset} {...swatchLabelStyle} fill="black" className="swatch-label-shadow">
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
                            {dualText(swatchCx, swatchCy + labelOffset, formatHexDisplay(paletteColor), isRegionHighlighted || isOverlayHighlighted, swatchHexFontSize)}
                          </>
                        )}
                        <text x={regionData.x + shadowOffset} y={regionData.y + shadowOffset} {...regionLabelStyle} fill="black" className="region-label-shadow">
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
                        {dualText(regionData.x, regionData.y + labelOffset, formatHexDisplay(regionColor), isRegionHighlighted, regionHexFontSize)}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ImageViewer;
