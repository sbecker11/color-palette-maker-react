# Development Guide

## Prerequisites

- **Node.js 18+** (20.19+ or 22.12+ recommended for Vite 7)
- **npm**
- **Python 3** with `opencv-python` and `numpy` — required for region detection. Use a virtual environment (recommended) or system Python. Override with `DETECT_REGIONS_PYTHON=/path/to/python` if needed.

---

## Installation

Complete all steps before running the app. All three steps are required for full functionality, including region detection.

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

The development and production build scripts activate the Python venv before starting the backend server, so region detection works in both environments. If you run the server manually, activate the venv first or the server will auto-detect `./venv` when present.

---

## Development Mode

Run both the backend server and React dev server:

```bash
npm run dev
```

This starts:

- **Backend**: http://localhost:3000 (Express API)
- **Frontend**: http://localhost:5173 (Vite dev server with hot reload)

The Vite dev server proxies `/api`, `/upload`, and `/uploads` to the backend.

To run them separately:

```bash
# Terminal 1: Backend only
npm run dev:server

# Terminal 2: Frontend only
npm run dev:client
```

### Chrome launch commands

**App mode (frameless):**

```bash
chrome --app=http://localhost:5173
open -a "Google Chrome" --args --app=http://localhost:5173   # macOS
```

**Normal dev mode:**

```bash
chrome http://localhost:5173
open -a "Google Chrome" http://localhost:5173   # macOS
```

---

## Production Build

Ensure you have completed [Installation](#installation) (including venv and Python packages) before building. The `npm start` script activates the venv before starting the server. The commands below do **not** create the venv or install Python dependencies.

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

**Chrome (production):**

```bash
chrome --app=http://localhost:3000
open -a "Google Chrome" --args --app=http://localhost:3000   # macOS
```

The server serves the React app from `client/dist` and the API at the same origin. Both are available on port 3000.

---

## Docker

The Dockerfile includes Node.js, Python, and OpenCV so region detection works out of the box.

### Local development

```bash
docker build -t color-palette-maker .
docker run -p 3000:3000 color-palette-maker
```

Open http://localhost:3000. For hot-reload development, use `npm run dev` instead.

### Production deployment

```bash
# Build
docker build -t your-registry/color-palette-maker:latest .

# Push (example)
docker push your-registry/color-palette-maker:latest

# Run on host
docker run -d -p 3000:3000 --name color-palette-maker your-registry/color-palette-maker:latest
```

Persist `uploads/` across restarts:

```bash
docker run -d -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  --name color-palette-maker your-registry/color-palette-maker:latest
```

Metadata is stored in `image_metadata.jsonl` inside the container; back it up or use a volume if you need persistence across image updates.

---

## Testing

```bash
# Run tests once
npm test

# Run tests in watch mode (from client directory)
cd client && npm run test:watch
```

**Coverage:**

```bash
# Generate coverage report (saved to client directory)
npm run test:coverage

# Build and generate coverage (no server start)
npm run build:with-coverage
```

Tests cover:

- **Client**: Utility functions (filename parsing, file size formatting, RGB to hex), API client, React components (Header, PaletteDisplay, ImageLibrary, MetadataDisplay, UploadForm, ImageViewer)
- **Server modules** (run via Vitest in client): `metadata_handler` (read, append, rewrite with temp files), `image_processor` (centroidsToPalette, calculateLuminance, minPairwiseColorDistance, pointInPolygon, pointInAnyRegion)
- **ImageViewer geometry**: Extracted pure functions `polygonCentroid`, `shrinkPolygon`, `polygonToPath` in `imageViewerGeometry.js`

---

## Continuous Integration

The repository includes a [GitHub Actions workflow](.github/workflows/ci.yml) that runs on every push and pull request to `master` or `main`. The workflow:

1. **Install dependencies** — Root and client `npm install`
2. **Lint** — `cd client && npm run lint` (ESLint)
3. **Test** — `npm test`
4. **Build** — `npm run build`

CI must pass before merging pull requests.

### Recent CI/CD improvements

| Change | Benefit |
|--------|---------|
| **metadata_handler tests** | Unit tests for `readMetadata`, `appendMetadata`, `rewriteMetadata` using temp files. Ensures JSONL parsing, ENOENT handling, and overwrite behavior work correctly. |
| **image_processor tests** | Tests for `pointInPolygon` and `pointInAnyRegion` (ray-casting, region masking). Prevents regressions in K-means region masking. |
| **imageViewerGeometry module** | Extracted `polygonCentroid`, `shrinkPolygon`, `polygonToPath` from ImageViewer into `imageViewerGeometry.js`. Pure functions are unit-tested; SVG region overlays stay correct across refactors. |

---

## Project Structure

```
color-palette-maker-react/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api.js         # API client
│   │   ├── utils.js       # Helper functions
│   │   ├── imageViewerGeometry.js  # Polygon helpers (centroid, shrink, path)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── server.js              # Express server
├── metadata_handler.js    # Image metadata (JSONL)
├── image_processor.js     # K-means palette generation
├── docs/                  # Documentation
├── scripts/detect_regions.py  # Python/OpenCV region detection
├── requirements.txt       # Python deps (opencv-python, numpy)
├── uploads/               # Uploaded images
└── package.json
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DETECT_REGIONS_PYTHON` | Path to Python executable for region detection. Defaults to `./venv/bin/python` if venv exists, else `python3`. |
| `VIRTUAL_ENV` | Set automatically when venv is activated. |
| `PORT` | Server port. Defaults to 3000. |

---

## Vite Proxy Configuration

In development, the Vite dev server proxies the following to the backend (port 3000):

- `/api`
- `/upload`
- `/uploads`

The frontend runs on port 5173 and the API on 3000.
