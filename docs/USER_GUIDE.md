# User Guide

## Features Overview

### Image Sources

- Upload images from URL or local file
- Supported formats: JPEG, PNG, WebP, GIF, TIFF, AVIF

### Palette Swatches

K-means automatically computes palette swatches. Each is a color-filled **swatch circle** with its hex beneath and a capital-letter **swatch label** (A, B, C, …) at center. Delete via the close × at top right; add new swatches by turning on **Adding swatches** or clicking the **empty swatch circle** (bottom of list).

### Palette Regions

**Detect Regions** computes and displays regions. Each region has:

- **Region boundary**: Polygon overlay
- **Region circle**: Empty circle at geometric center with average **region hex value** beneath
- **Region label**: Numeric (00, 01, 02, …) at center

Use **Remove Region (click)** to delete one, **Clear all Regions** to remove all.

### Region Overlay

SVG overlay with region boundaries, region circles, region hex values, and region labels. Features:

- Dual-layer text for visibility on light/dark backgrounds
- 1px black shadow on circles
- Golden glow on highlighted swatches
- **Match palette swatches**: Toggle to show palette swatch circles over each region. When on, hovering a panel swatch highlights all matching overlays (and vice versa); hovering a region highlights the matching panel swatch and all regions sharing that swatch

### Image Viewer

- Uses full available space
- Entire image visible (fit-to-container, no cropping)
- Top-aligned; region overlays scale with the image

### Palette Management

- Rename palettes (edit and blur or press Enter to save)
- Delete individual swatches
- Duplicate palettes (auto-increment names)
- Export as JSON

### Theme Toggle

Light and dark mode support.

### Color Palettes List

Browse, select, delete, reorder (move to top/bottom or step up/down), and duplicate stored palettes. **Newly uploaded palette images automatically appear at the top of the list**, sorted by upload time (newest first). You can reorder palettes manually using the reorder buttons, but new uploads will always appear at the top.

---

## Key Actions

| Action | Description |
|--------|-------------|
| **Reorder (⏫ ⏬ ⬆️ ⬇️)** | Left column: ⏫ move to top, ⏬ move to bottom. Inner column: ⬆️ move up one, ⬇️ move down one. Order persisted to server. Note: New uploads always appear at the top regardless of manual reordering. |
| **Palette Name** | Edit in the input and blur or press Enter to save. Persisted automatically. |
| **Regenerate (K-means)** | Replace palette with freshly computed colors from the image. Choose K=5, 7, or 9. |
| **Detect Regions** | Python/OpenCV subprocess detects large regions. Use K-means to extract colors only from masked regions. |
| **Remove Region (click)** | Enter delete mode; click region boundaries to remove. Click outside to exit. |
| **Clear all Regions** | Remove all detected regions at once. |
| **Adding swatches** | Toggle to enter/exit manual swatch creation mode. Cursor shows +; click palette image to add color. |
| **Match palette swatches** | When regions exist, toggle to show/hide palette swatch circles on the image. Highlights sync between panel and overlays. |
| **Export** | Download palette as `{ name, colors: [...] }`. Palette changes are saved to server automatically; Export creates downloadable files. |

---

## Manual Swatch Creation (Color Sampling)

1. Turn on **Adding swatches** or click the empty swatch circle
2. Cursor changes to + (crosshair)
3. Hover over the palette image to preview the color under the cursor
4. Click to add that color to the palette
5. Turn off **Adding swatches** or click the empty swatch to exit

### Dark Reader

If you use the [Dark Reader](https://darkreader.org/) browser extension, it may override the sampled color preview in the empty swatch circle. To fix this, exclude this site from Dark Reader:

1. Click the Dark Reader icon in your browser toolbar
2. Click the gear icon (Settings)
3. Open the **Site list** tab
4. Add this site to the **Not inverted** (or **Disabled for**) list — e.g. `localhost`, `localhost:5173`, or your deployed domain
5. Apply and refresh the page

---

## Metadata

Data is persisted to `image_metadata.jsonl`. Each image record includes:

- **Image info**: `createdDateTime`, `uploadedURL`, `uploadedFilePath`, `cachedFilePath`, `width`, `height`, `format`, `fileSizeBytes`
- **Palette**: `colorPalette` (hex array), `paletteName`
- **Regions**: `regions` (polygon arrays `[[x,y], ...]`), `paletteRegion` (region display data `{ hex, regionColor, x, y }` per region)
