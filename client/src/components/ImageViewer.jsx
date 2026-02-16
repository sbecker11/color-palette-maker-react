import { useEffect, useRef, useState } from 'react';
import { rgbToHex } from '../utils';

function polygonCentroid(poly) {
  if (!poly || poly.length === 0) return [0, 0];
  let sx = 0, sy = 0;
  for (const [x, y] of poly) {
    sx += x;
    sy += y;
  }
  return [sx / poly.length, sy / poly.length];
}

function shrinkPolygon(poly, px) {
  if (!poly || poly.length < 2) return poly;
  const [cx, cy] = polygonCentroid(poly);
  return poly.map(([x, y]) => {
    const dx = cx - x, dy = cy - y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(1, px / len);
    return [x + dx * t, y + dy * t];
  });
}

function polygonToPath(poly) {
  if (!poly || poly.length < 2) return '';
  const [fx, fy] = poly[0];
  let d = `M ${fx} ${fy}`;
  for (let i = 1; i < poly.length; i++) {
    d += ` L ${poly[i][0]} ${poly[i][1]}`;
  }
  return d + ' Z';
}

function ImageViewer({
  imageUrl,
  isSamplingMode,
  onSampledColorChange,
  onDoubleClickAddColor,
  regions = [],
  clusterMarkers = [],
  isDeleteRegionMode,
  onRegionClick,
  onExitDeleteRegionMode,
}) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasCtxRef = useRef(null);
  const viewerRef = useRef(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [hoveredRegionIndex, setHoveredRegionIndex] = useState(null);

  useEffect(() => {
    if (!isDeleteRegionMode) return;
    const handleDocClick = (e) => {
      if (viewerRef.current && !viewerRef.current.contains(e.target)) {
        onExitDeleteRegionMode?.();
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [isDeleteRegionMode, onExitDeleteRegionMode]);

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

    const imgRect = imgElement.getBoundingClientRect();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgDispWidth = imgElement.clientWidth;
    const imgDispHeight = imgElement.clientHeight;

    const mouseX = event.clientX - imgRect.left;
    const mouseY = event.clientY - imgRect.top;

    const canvasRatio = canvasWidth / canvasHeight;
    const imgDispRatio = imgDispWidth / imgDispHeight;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > imgDispRatio) {
      scale = canvasHeight / imgDispHeight;
      const scaledWidth = canvasWidth / scale;
      offsetX = (scaledWidth - imgDispWidth) / 2;
    } else {
      scale = canvasWidth / imgDispWidth;
      const scaledHeight = canvasHeight / scale;
      offsetY = (scaledHeight - imgDispHeight) / 2;
    }

    const canvasX = Math.floor((mouseX + offsetX) * scale);
    const canvasY = Math.floor((mouseY + offsetY) * scale);

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
    onDoubleClickAddColor?.();
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
              alt="Selected Image"
            />
            <div
              className="image-viewer-overlay"
              style={{
                cursor: isSamplingMode || isDeleteRegionMode ? 'crosshair' : 'default',
                pointerEvents: isSamplingMode || isDeleteRegionMode || (regions?.length > 0) ? 'auto' : 'none',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={handleDoubleClick}
            />
            {((regions?.length > 0) || (clusterMarkers?.length > 0)) && imageSize.w > 0 && (
              <svg
                className="region-overlay"
                viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
                preserveAspectRatio="xMidYMid slice"
                style={{
                  pointerEvents: isDeleteRegionMode ? 'auto' : 'none',
                  cursor: isDeleteRegionMode ? 'crosshair' : 'default',
                }}
                onClick={(e) => {
                  if (!isDeleteRegionMode) return;
                  const target = e.target;
                  if (target.dataset.regionIndex != null) {
                    e.stopPropagation();
                    onRegionClick?.(parseInt(target.dataset.regionIndex, 10));
                  } else {
                    onExitDeleteRegionMode?.();
                  }
                }}
                onMouseLeave={() => setHoveredRegionIndex(null)}
              >
                {regions.map((poly, i) => {
                  const shrunk = shrinkPolygon(poly, 3);
                  const d = polygonToPath(shrunk);
                  const isHovered = hoveredRegionIndex === i && isDeleteRegionMode;
                  return (
                    <path
                      key={`region-${i}`}
                      data-region-index={i}
                      d={d}
                      fill={isHovered ? 'rgba(150, 220, 255, 0.45)' : 'rgba(100, 180, 255, 0.2)'}
                      stroke={isHovered ? 'rgba(80, 160, 255, 1)' : 'rgba(50, 120, 200, 0.9)'}
                      strokeWidth={isHovered ? 4 : 3}
                      onMouseEnter={() => setHoveredRegionIndex(i)}
                      onMouseLeave={() => setHoveredRegionIndex(null)}
                    />
                  );
                })}
                {clusterMarkers.map((m, i) => {
                  const r = 15;
                  const swatchOffset = 28;
                  const swatchCx = m.x + swatchOffset;
                  const swatchCy = m.y - swatchOffset;
                  const labelOffset = r + 8;
                  const regionColor = m.regionColor ?? m.hex;
                  const paletteColor = m.hex;
                  const baseStyle = { textAnchor: 'middle', dominantBaseline: 'central', fontSize: 12 };
                  const dualText = (h, v, t) => (
                    <>
                      <text x={h} y={v} {...baseStyle} fill="black">{t}</text>
                      <text x={h - 1} y={v - 1} {...baseStyle} fill="white">{t}</text>
                    </>
                  );
                  return (
                    <g key={`marker-${i}`} className="cluster-marker">
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={r}
                        fill="none"
                        stroke="white"
                        strokeWidth={1}
                      />
                      <circle
                        cx={swatchCx}
                        cy={swatchCy}
                        r={r}
                        fill={paletteColor}
                        className="cluster-swatch"
                        stroke="var(--border-color)"
                        strokeWidth={1}
                      />
                      {dualText(m.x, m.y + labelOffset, regionColor)}
                      {dualText(swatchCx, swatchCy + labelOffset, paletteColor)}
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
