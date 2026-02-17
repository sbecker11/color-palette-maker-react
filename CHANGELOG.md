# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-17

### Added

- Extract color palettes from images using K-means clustering with luminance filtering and CIEDE2000 perceptual distance
- Detect image regions with OpenCV (Python subprocess)
- Manual color sampling: double-click on image to add swatch
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
