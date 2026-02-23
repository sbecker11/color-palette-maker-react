# Architecture

This document describes how regions, region colors, K-means clustering, and overlays work together in the Color Palette Maker.

---

## System Overview

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   React     │────▶│  Express (Node) │────▶│ Python subprocess │
│   Client    │     │  server.js      │     │ detect_regions.py │
│  (Vite)     │     │                 │     │  (OpenCV)         │
└─────────────┘     └─────────────────┘     └──────────────────┘
       │                      │
       │                      ▼
       │             ┌─────────────────┐
       │             │ metadata_handler │
       │             │ image_processor  │
       │             │ (Sharp, K-means) │
       │             └────────┬────────┘
       │                      │
       │                      ▼
       │             image_metadata.jsonl
       │             uploads/
       └──────────────────────┘
```

- **Client**: React SPA; uploads images, requests palette/regions, displays overlays.
- **Express**: Serves API, uploads, and built frontend; invokes Python for region detection; uses `metadata_handler` and `image_processor` for persistence and palette logic.

---

## 1. How region boundaries are computed

Region detection runs a Python subprocess (`scripts/detect_regions.py`) using OpenCV. Available strategies:

| Strategy | Best for | Approach |
|----------|----------|----------|
| **GrabCut** | Product shots, portraits, subject on plain background | Foreground/background segmentation with center rect |
| **SLIC** | Natural photos, gradients, textures | Superpixels (requires opencv-contrib-python) |
| **Saliency** | Main subject in photos | Attention-based saliency map |
| **Mean shift** | Gradients, skies, fabrics, soft boundaries | Color+spatial clustering |
| **Quadtree** | Flat designs, UI mockups, geometric layouts | Recursive split by variance |
| **Circles** | Round shapes, buttons, coins, eyes | Hough circle transform |
| **Rectangles** | Panels, windows, screens, documents, UI | 4-vertex contour approx |
| **Template match** | Many identical shapes (e.g. swatch grid) | Sample one region → normalized cross-correlation → find all similar |
| **Adaptive** | Varying illumination | Adaptive threshold on grayscale |
| **Otsu** | Bimodal (light/dark) images | Global threshold |
| **Canny** | Edge-based regions | Canny edges + dilation |
| **Color** | Distinct color blocks | LAB K-means segmentation |
| **Watershed** | Touching objects | Distance transform + watershed |
| **Default** | Auto fallback | Cascade through strategies until regions found |

Detected regions are returned as polygons (arrays of `[x, y]` vertices). The server invokes this script via `POST /api/regions/:filename` when you click "Detect Regions."

---

## 2. How regions can be manually deleted

Choose **Remove region (click)** from the action menu to enter delete mode (detecting regions also enters this mode). Each region polygon is drawn as an overlay on the image. Click a region to remove it; the polygon is deleted and the overlay updates immediately. Click outside the image to exit delete mode. Regions are saved to the server when you remove one. Use **Clear all regions** to remove all regions at once.

---

## 3. How region average colors are computed

For each region polygon, the app sums the RGB values of all opaque pixels whose coordinates fall inside the polygon (using point-in-polygon tests). The average is computed as `(sumR/count, sumG/count, sumB/count)` and converted to a hex string (`#RRGGBB`). Pixels with alpha ≤ 128 are skipped.

Pixel coordinates are derived from the image buffer using row-major layout: for `get-pixels` shape `[rows, columns, 4]`, column `x = pixelIndex % width` and row `y = Math.floor(pixelIndex / width)`.

---

## 4. How region boundaries and average hex color are displayed on the overlay

When regions exist, an SVG overlay is drawn on top of the palette image. Each region polygon is rendered with a semi-transparent fill and stroke. For each region, an empty circle (white 1px stroke) is drawn at the polygon centroid, and the region's average hex color is displayed underneath it. Text uses a dual-layer (black at base, white offset) for visibility on both light and dark backgrounds.

---

## 5. How K-means cluster swatches are computed

K-means clustering uses the `node-kmeans` library. Two modes apply:

- **a) Regions defined:** If regions exist, only pixels inside at least one region polygon are included in the K-means input. Opaque pixels are filtered by luminance (excluding near-black and near-white). The result is a palette of dominant colors from the masked image.
- **b) No regions:** If no regions are defined, K-means is applied to all pixels in the image. Opaque pixels are filtered by luminance, then clustered. The palette size (K) is chosen via the Regenerate action (5, 7, or 9 colors).

---

## 6. How the most similar (nearest in color space) palette swatch is computed for each region

For each region, the region average color (RGB) is compared to every color in the K-means palette using the CIEDE2000 (ΔE) perceptual distance via the `color-diff` library. The palette color with the smallest ΔE is the "nearest" palette swatch for that region. All comparisons use sRGB; the library converts to LAB internally for perceptual distance only.

---

## 7. How the nearest palette swatch and its hex color are displayed for a given region

Each region gets a filled circle (the "swatch circle") drawn near the region centroid (top-right of the empty region circle). The swatch is filled with the nearest palette color, and its hex string is shown underneath. The region circle shows the region average hex; the swatch circle shows the nearest palette hex. Both use the same dual-layer text styling for readability.

---

## 8. How region boundaries and their average hex colors are stored

Regions and their associated data are persisted in `image_metadata.jsonl`. Each image entry can include:

- **regions**: Array of polygon arrays (`[[x,y], ...]`).
- **paletteRegion**: Array of `{ hex, regionColor, x, y }` per region, where `regionColor` is the region average hex, `hex` is the nearest palette color, and `(x, y)` is the region centroid. Palette region data is recomputed when regions change or when the palette is regenerated.

---

## 9. Nearest palette swatch mapping is computed on demand

The nearest palette swatch (`hex` in each region's display data) is computed whenever you run Regenerate (K-means) or Detect Regions. It is stored in metadata at that moment. To refresh nearest swatch mappings after changing the palette or regions, run Regenerate (K-means 5, 7, or 9) again.
