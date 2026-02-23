# Development Guide

## Prerequisites

- **Node.js 18+** (20.19+ or 22.12+ recommended for Vite 5)
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

**Optional:** Copy `.env.example` to `.env` to override port or other settings. See [Environment Variables](#environment-variables) for details.

---

## When to Run Full Build vs Vite-Only Dev

| Change type | Full build required? | Notes |
|-------------|----------------------|-------|
| React components, CSS, JS (client code) | No | Vite HMR updates the browser automatically. Run `npm run dev` (or `npm run dev:client` if server is already running). |
| Server code (`server.js`, `metadata_handler.js`, `image_processor.js`) | No for `npm run dev` | `nodemon` restarts the server on change. Use `npm run dev` or `npm run dev:server`. |
| Python scripts (`scripts/detect_regions.py`) | No | Server invokes the script at runtime; edits take effect on next region detection. |
| Root `package.json` (scripts, deps) | Yes | Run `npm install` and restart. |
| Client `package.json` (deps) | Yes | Run `cd client && npm install` and restart `npm run dev:client`. |
| `vite.config.js` | Yes | Restart `npm run dev:client`. |
| `.env` | No | Restart the server to pick up env changes. |
| Production deploy | Yes | Run `npm run build` then `npm start`. |

**Summary:** For typical frontend-only changes (components, styles, client logic), run `npm run dev` and edit; Vite handles updates without a full build. For server changes, nodemon restarts the server. Only dependency changes or production builds require `npm run build`.

### Automated check

Run `npm run check` to see what to do based on changed files since last commit:

```bash
npm run check        # dev suggestions (HMR, restart server, etc.)
npm run check:prod   # include "run npm run build" when client changed
```

Run `npm run ready` to lint, test, and then run the check (useful before commit or push).

---

## Development Mode

### One-command dev (recommended)

```bash
npm run x
# or: npm run dev:x
```

Runs `npm install` if `package.json` or `client/package.json` changed, then starts both servers. Opens the browser at http://localhost:5173 once Vite is ready. No need to think about Vite vs full rebuild—Vite HMR and nodemon handle live updates automatically.

### Standard dev

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

`npm test` and `npm run test:coverage` run ESLint first; if lint fails, tests are not executed.

```bash
# Run lint and tests once
npm test

# Run tests in watch mode (from client directory)
cd client && npm run test:watch
```

**Coverage:**

```bash
# Run lint, then generate coverage report (saved to client/coverage-reports/)
npm run test:coverage

# Build, then run lint and coverage (no server start)
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
├── .github/workflows/ci.yml
├── client/                 # React frontend (Vite 5)
│   ├── src/
│   │   ├── components/     # Header, ImageLibrary, PaletteDisplay, ImageViewer, UploadForm, MetadataDisplay (+ .test.jsx)
│   │   ├── test/setup.js
│   │   ├── api.js, api.test.js
│   │   ├── utils.js, utils.test.js
│   │   ├── imageViewerGeometry.js, imageViewerGeometry.test.js
│   │   ├── App.jsx, App.css, App.test.jsx
│   │   ├── AppHelpers.js, AppHelpers.test.js
│   │   ├── main.jsx, index.css
│   │   ├── metadata_handler.test.js, image_processor.test.js  # Server module tests (Vitest)
│   │   └── assets/
│   ├── scripts/            # Coverage reporters, save-coverage-report.js
│   ├── vite.config.js, eslint.config.js
│   ├── index.html, package.json
│   └── public/
├── docs/                   # USER_GUIDE, API, ARCHITECTURE, DEVELOPMENT, FUTURE-WORK, migration outlines
├── media/                  # Local media (optional); README hero assets in GitHub Releases v1.0.0
├── scripts/
│   ├── detect_regions.py   # Python/OpenCV region detection
│   ├── run-with-venv.js    # Activates venv before starting server
│   └── kill-port-3000-listeners
├── server.js               # Express server
├── metadata_handler.js     # Image metadata (JSONL)
├── image_processor.js      # K-means palette generation
├── requirements.txt        # Python deps (opencv-python, numpy)
├── Dockerfile, .dockerignore, .env.example
├── uploads/                # Uploaded images (runtime)
└── package.json
```

To regenerate a file tree from the repo: from the project root run `find . -not -path './node_modules*' -not -path './.git*' -not -path './venv*' -not -path './client/dist*' -not -path './client/coverage*' | sort`, or use a tool like `tree` (if installed: `tree -I 'node_modules|.git|venv|dist|coverage'`).

---

## Environment Variables

The server loads variables from `.env` in the project root (via `dotenv`). Create `.env` before starting the app.

### Setup

```bash
cp .env.example .env
# Edit .env if needed; defaults work for local dev
```

### Dev vs prod

Same variables apply to both. For local dev, defaults are usually fine. For production you may want to override `PORT` or `DETECT_REGIONS_PYTHON` if Python lives elsewhere.

### Variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port. Defaults to 3000. |
| `DETECT_REGIONS_PYTHON` | No | Path to Python executable for region detection. Defaults to `./venv/bin/python` if venv exists, else `python3`. |
| `VIRTUAL_ENV` | No | Set automatically when venv is activated. |
| `MIN_LUMINANCE_THRESHOLD` | No | Palette luminance floor (0–255). Default 25. Pixels below this are excluded from K-means. |
| `MAX_LUMINANCE_THRESHOLD` | No | Palette luminance ceiling (0–255). Default 185. Pixels above this are excluded. Use 0 and 255 to include black/white. |

> **Note:** `.env` is gitignored. Never commit secrets. For production, set variables in your deploy environment or use the same `.env` approach on the host.

### Client (Vite)

The React app reads `VITE_*` variables at build time. Create `client/.env` from `client/.env.example` to override.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_HIGHLIGHT_REGION_ON_ROLLOVER` | No | Whether to highlight region interiors (fill/stroke) on hover. Set to `false` or `0` to disable. Default `true`. |

---

## Vite Proxy Configuration

In development, the Vite dev server proxies the following to the backend (port 3000):

- `/api`
- `/upload`
- `/uploads`

The frontend runs on port 5173 and the API on 3000.
