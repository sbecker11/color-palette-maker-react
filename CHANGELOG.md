# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Template match (draw box)**: For region detection method "Template match", click **Detect** → draw a box on the image (click center, drag to size, release); detection runs on release. Button label cycles **Click** → **Drag** → **Detect**. Click **Detect** again to clear regions and repeat with a new box. Correlation uses gradient magnitude (brightness-invariant).
- When a palette already has regions and Region Detection shows a method (e.g. Template), app syncs that method so clicking **Detect** immediately continues with it (no need to re-select the method).
- Auto-select moved palette after reordering (top/bottom/up/down buttons)
- Unit tests for ErrorBoundary component
- Additional unit tests for App, ImageViewer, and api modules to improve coverage

### Changed
- Match Region Swatches: renamed from "Match Palette Swatches"
- Match Region Swatches: re-pairing only occurs when feature is enabled
- Deleting regions mode: one region per session, exits after clicking a region
- Adding swatches mode: cursor shows crosshair (+) over palette image
- Deleting regions mode: cursor shows small X icon over regions
- Checkbox labels: "Adding swatches (click)" and "Deleting regions (click)"
- Mutual exclusivity: entering one mode (Adding/Deleting) exits the other
- Click outside palette image exits active mode and clears checkbox
- MetadataDisplay: added "# Swatches" and "# Regions" fields

### Fixed
- Checkbox toggle now properly exits mode (fixed race condition with click-outside handler)
- Deleting regions checkbox: off and disabled when zero regions
- Match Region Swatches checkbox: disabled when no swatches or no regions

## [1.0.0] - 2026-02-17

### Added

- Extract color palettes from images using K-means clustering with luminance filtering and CIEDE2000 perceptual distance
- Detect image regions with OpenCV (Python subprocess)
- Manual color sampling: click on image to add swatch
- Export palettes as JSON
- Light/dark theme support with CSS custom properties
- Error boundary for graceful handling of React rendering errors
- GitHub Actions CI workflow (lint, test, build)
- Scripts: `mov-to-gif.sh` (convert MOV to GIF with optional scale reduction), `gif-first-frame.sh` (extract first frame from animated GIF)
- New uploads appear at top of palette listing (sorted by `createdDateTime`)

### Changed

- README restructured; split into docs (USER_GUIDE, API, ARCHITECTURE, DEVELOPMENT, FUTURE-WORK)
- ImageLibrary Dup/Del buttons use CSS class instead of inline styles
- Metadata display: removed max-height constraint (no scrolling)
- API client: `handleResponse()` checks `response.ok` for graceful error handling
- Port configurable via `process.env.PORT`

### Fixed

- Lint: removed unused `applyRegionsToImages` import
- Lint: replaced `process.env.NODE_ENV` with `import.meta.env.DEV` in ErrorBoundary (Vite-compatible)
- `getFilenameFromMeta` supports Windows backslash paths
- `metadata_handler` uses `'\n'` instead of `os.EOL` for cross-platform JSONL

### Documentation

- Added polygonCentroid duplication comments (server + client implementations)
- USER_GUIDE: documented that new uploads appear at top of palette listing

[1.0.0]: https://github.com/sbecker11/color-palette-maker-react/releases/tag/v1.0.0
