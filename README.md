# Color Palette Maker (React)

<a href="media/gold-blue.mov">
  <img src="media/gold.png" width="67%" alt="gold" />
</a>

A React-based single-page application for extracting and managing color palettes from images. Upload images via URL or file; use automated region detection and manual region editing to control which portions of the image are used to compute palette swatches by K-means; extract dominant colors and export palettes as JSON.

## Features

- **Image Sources**: Upload images from URL or local file
- **Automatic Palette Extraction**: K-means clustering with configurable K (5, 7, 9); luminance-based filtering; CIEDE2000 perceptual color distance (color-diff)
- **Region Detection**: Python/OpenCV subprocess for adaptive thresholding, Otsu, Canny edge detection, and color-based segmentation; polygon overlays; masked K-means when regions exist
- **Region Overlay**: SVG overlay with region polygons, centroid markers, region average hex and nearest cluster swatch hex; dual-layer text for visibility on light/dark backgrounds
- **Color Sampling**: Crosshair mode — rollover to preview in empty swatch, double-click to add; click swatch to cancel
- **Palette Management**: Rename palettes, delete individual swatches, duplicate palettes (auto-increment names), export as JSON
- **Theme Toggle**: Light and dark mode support
- **Color Palettes**: Browse, select, delete, reorder (move to top/bottom or step up/down), and duplicate stored palettes
- **Metadata**: JSONL persistence; region boundaries and cluster markers stored per image

### Key Actions

- **Reorder (⏫ ⏬ ⬆️ ⬇️)**: Use the left column (⏫ move to top, ⏬ move to bottom) or the inner column (⬆️ move up one, ⬇️ move down one) next to each item in the Color Palettes list. Order is persisted to the server.
- **Palette Name**: Edit the name in the "Palette Name" input and click away (blur) to save. The name is persisted automatically.
- **Regenerate (K-means)**: Replace the current palette colors with a freshly computed set from the image using K-means clustering (K=5, 7, or 9).
- **Detect Regions**: Uses a Python subprocess (OpenCV) to detect large regions in the image. Regions are displayed as overlays; use K-means to extract colors only from masked regions.
- **Remove region (click)**: Enter delete mode so you can click individual regions to remove them one at a time. Click outside the image to exit. Requires regions to exist.
- **Clear all regions**: Remove all detected regions at once.
- **Export**: Download the palette as a JSON file for use in external integrations (design tools, other apps, code). The exported format is `{ name, colors: [...] }`. Palette changes within the app are saved to the server automatically; Export is only for creating downloadable files.

## Tech Stack

- **Frontend**: React 19, Vite 7
- **Backend**: Node.js, Express
- **Image Processing**: Sharp, node-kmeans, get-pixels, color-diff (CIEDE2000)
- **Region Detection**: Python 3, OpenCV (opencv-python), NumPy
- **Testing**: Vitest, React Testing Library, happy-dom

## Prerequisites

- Node.js 18+ (20.19+ or 22.12+ recommended for Vite 7)
- npm
- Python 3 with opencv-python and numpy — required for the **Detect Regions** feature. The app runs without Python, but region detection will fail until the venv is created and dependencies are installed. Use a virtual environment (recommended) or system Python. Override with `DETECT_REGIONS_PYTHON=/path/to/python` if needed.

## Installation

Complete all steps below before running the app. The Python setup is a one-time prerequisite for region detection.

```bash
# 1. Install root dependencies (backend + dev tools)
npm install

# 2. Install client dependencies (React app)
cd client && npm install && cd ..

# 3. Create venv and install Python dependencies (opencv-python, numpy) for region detection
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

With a venv, start the server with it activated (`source venv/bin/activate` before `npm start` or `npm run dev`), or the server will auto-detect `./venv` in the project root.

## Development

Activate the venv first if you need region detection (`source venv/bin/activate`). Run both the backend server and React dev server:

```bash
npm run dev
```

This starts:
- **Backend**: http://localhost:3000 (Express API)
- **Frontend**: http://localhost:5173 (Vite dev server with hot reload)

The Vite dev server proxies `/api`, `/upload`, and `/uploads` to the backend. In development, the frontend runs on port 5173 and the API on 3000.

To run them separately:

```bash
# Terminal 1: Backend only
npm run dev:server

# Terminal 2: Frontend only
npm run dev:client
```

Open Chrome in app mode:

    chrome --app=http://localhost:5173
    open -a "Google Chrome" --args --app=http://localhost:5173   # macOS

Or open Chrome in normal dev mode:

    chrome http://localhost:5173
    open -a "Google Chrome" http://localhost:5173   # macOS

## Production Build

Ensure you have completed [Installation](#installation) (including venv and Python packages) before building and starting. The commands below do **not** create the venv or install Python dependencies.

```bash
# Build the React app
npm run build

# Start the server (serves built React app + API at localhost:3000)
npm start
```

To build with coverage and then start:

```bash
npm run build:with-coverage; npm start
```

Open Chrome in app mode:

    chrome --app=http://localhost:3000
    open -a "Google Chrome" --args --app=http://localhost:3000   # macOS

Or open Chrome in normal dev mode:

    chrome http://localhost:3000
    open -a "Google Chrome" http://localhost:3000   # macOS

The server will serve the React app from `client/dist` and the API at the same origin. In production, both the built app and the API are served from port 3000.

## Testing

```bash
# Run tests once
npm test

# Run tests in watch mode (from client directory)
cd client && npm run test:watch
```

Tests cover:
- Utility functions (filename parsing, file size formatting, RGB to hex)
- API client (request methods and payloads)
- React components (Header, PaletteDisplay, ImageLibrary, MetadataDisplay)

Run `npm run test:coverage` to generate a coverage report saved to a timestamped file (e.g. `coverage-report-2025-02-13T15-30-00.html`) in the client directory. Run `npm run build:with-coverage` to build and then generate the coverage report (does not start the server).

## Future Improvements

From code review; ordered by priority.

**CI/CD**: Add `.github/workflows/ci.yml` (lint, test, build); `.env.example`; `Dockerfile`; `docker-compose.yml` for Python region-detection dependency.

**Testing**: Extract and test ImageViewer pure functions (`polygonCentroid`, `shrinkPolygon`, `polygonToPath`); add server-side tests (Express routes, image_processor, metadata_handler); consider integration/E2E tests.

**Architecture**: Refactor App.jsx (useReducer or context) to reduce useState and prop-drilling; reduce PaletteDisplay props (17).

**Server / code quality**: Remove dead code in image_processor.js; DRY filename validation (middleware or `validateFilename()`); review metadata_handler race condition on concurrent read/rewrite.

**Documentation**: Add deployment section (Docker, env vars); document metadata_handler concurrency in code.

## Project Structure

```
color-palette-maker-react/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api.js         # API client
│   │   ├── utils.js       # Helper functions
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── server.js              # Express server
├── metadata_handler.js    # Image metadata (JSONL)
├── image_processor.js     # K-means palette generation
├── scripts/detect_regions.py  # Python/OpenCV region detection
├── requirements.txt       # Python deps (opencv-python, numpy)
├── uploads/               # Uploaded images
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/images` | List all images with metadata |
| PUT | `/api/images/order` | Reorder images (body: `{ filenames: [...] }`) |
| POST | `/api/images/:filename/duplicate` | Duplicate image and palette |
| POST | `/upload` | Upload image (file or URL) |
| POST | `/api/regions/:filename` | Detect regions using Python/OpenCV |
| POST | `/api/palette/:filename` | Generate color palette (add `?regenerate=true` to force recompute; body `{ regions, k }` for masked K-means) |
| PUT | `/api/palette/:filename` | Save updated palette |
| PUT | `/api/metadata/:filename` | Update palette name |
| DELETE | `/api/images/:filename` | Delete image and metadata |

## Region and Palette Pipeline

This section describes how regions, region colors, K-means clustering, and overlays work together.

### 1. How region boundaries are computed

Region detection runs a Python subprocess (`scripts/detect_regions.py`) that uses OpenCV. The script applies adaptive thresholding, Otsu binarization, Canny edge detection, and color-based segmentation (LAB K-means on the color wheel) to identify large, distinct regions in the image. Detected regions are returned as polygons (arrays of `[x, y]` vertices). The server invokes this script via `POST /api/regions/:filename` when you click "Detect Regions."

### 2. How regions can be manually deleted

Choose **Remove region (click)** from the action menu to enter delete mode (detecting regions also enters this mode). Each region polygon is drawn as an overlay on the image. Click a region to remove it; the polygon is deleted and the overlay updates immediately. Click outside the image to exit delete mode. Regions are saved to the server when you remove one. Use **Clear all regions** to remove all regions at once.

### 3. How region average colors are computed

For each region polygon, the app sums the RGB values of all opaque pixels whose coordinates fall inside the polygon (using point-in-polygon tests). The average is computed as `(sumR/count, sumG/count, sumB/count)` and converted to a hex string (`#RRGGBB`). Pixels with alpha ≤ 128 are skipped. Pixel coordinates are derived from the image buffer using row-major layout: for `get-pixels` shape `[rows, columns, 4]`, column `x = pixelIndex % width` and row `y = Math.floor(pixelIndex / width)`.

### 4. How region boundaries and average hex color are displayed on the overlay

When regions exist, an SVG overlay is drawn on top of the palette image. Each region polygon is rendered with a semi-transparent fill and stroke. For each region, an empty circle (white 1px stroke) is drawn at the polygon centroid, and the region’s average hex color is displayed underneath it. Text uses a dual-layer (black at base, white offset) for visibility on both light and dark backgrounds.

### 5. How K-means cluster swatches are computed

K-means clustering uses the `node-kmeans` library. Two modes apply:

- **a) Regions defined:** If regions exist, only pixels inside at least one region polygon are included in the K-means input. Opaque pixels are filtered by luminance (excluding near-black and near-white). The result is a palette of dominant colors from the masked image.
- **b) No regions:** If no regions are defined, then K-means is applied to all pixels in the image. Opaque pixels are filtered by luminance, then clustered. The palette size (K) is chosen via the Regenerate action (5, 7, or 9 colors).

### 6. How the most similar (nearest in color space) cluster swatch is computed for each region

For each region, the region average color (RGB) is compared to every color in the K-means palette using the CIEDE2000 (ΔE) perceptual distance via the `color-diff` library. The palette color with the smallest ΔE is the “nearest” cluster swatch for that region. All comparisons use sRGB; the library converts to LAB internally for perceptual distance only.

### 7. How the nearest cluster swatch and its hex color are displayed for a given region

Each region gets a filled circle (the “swatch circle”) drawn near the region centroid (top-right of the empty region circle). The swatch is filled with the nearest palette color, and its hex string is shown underneath. The region circle shows the region average hex; the swatch circle shows the nearest palette hex. Both use the same dual-layer text styling for readability.

### 8. How region boundaries and their average hex colors are stored

Regions and their associated data are persisted in `image_metadata.jsonl`. Each image entry can include:

- `regions`: Array of polygon arrays (`[[x,y], ...]`).
- `clusterMarkers`: Array of `{ hex, regionColor, x, y }` where `regionColor` is the region average hex, `hex` is the nearest palette color, and `(x, y)` is the centroid. Markers are recomputed when regions change or when the palette is regenerated.

### 9. Nearest swatch color is not persisted

The nearest cluster swatch (`hex` in `clusterMarkers`) is computed on demand whenever you run the Regenerate (K-means) action. It is stored in memory and in metadata only at that moment. It is not recalculated or saved when you load an image, change the palette manually, or edit metadata. To refresh nearest swatch mappings after changing the palette or regions, run Regenerate (K-means 5, 7, or 9) again.

## License

MIT
