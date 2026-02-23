# API Reference

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/images` | List all images with metadata |
| PUT | `/api/images/order` | Reorder images (body: `{ filenames: [...] }`) |
| POST | `/api/images/:filename/duplicate` | Duplicate image and palette |
| POST | `/upload` | Upload image (file or URL) |
| POST | `/api/regions/:filename` | Detect regions using Python/OpenCV |
| POST | `/api/palette/:filename` | Generate color palette (add `?regenerate=true` to force recompute; body `{ regions, k }` for masked K-means) |
| PUT | `/api/palette/:filename` | Save updated palette |
| PUT | `/api/metadata/:filename` | Update palette name, regions, or region labels |
| DELETE | `/api/images/:filename` | Delete image and metadata |

---

## Endpoint Details

### GET /api/images

Returns all images with metadata, newest first.

**Response**

```json
{
  "success": true,
  "images": [
    {
      "createdDateTime": "2025-02-13T15:30:00.000Z",
      "uploadedURL": null,
      "uploadedFilePath": "photo.jpg",
      "cachedFilePath": "uploads/img-1739454600000-123456789.jpeg",
      "width": 1920,
      "height": 1080,
      "format": "jpeg",
      "fileSizeBytes": 245000,
      "colorPalette": ["#1a2b3c", "#4d5e6f"],
      "paletteName": "img-1739454600000-123456789",
      "regions": [[[10, 20], [30, 40], [50, 60]]],
      "paletteRegion": [{ "hex": "#1a2b3c", "regionColor": "#2c3d4e", "x": 100, "y": 80 }]
    }
  ]
}
```

**Error**

- `500` — `{ "success": false, "message": "Error reading image metadata." }`

---

### PUT /api/images/order

Reorder images in the display list. Order is persisted; display order is top to bottom as provided.

**Request body**

```json
{
  "filenames": ["img-3.jpeg", "img-2.jpeg", "img-1.jpeg"]
}
```

**Response**

```json
{
  "success": true,
  "message": "Order updated successfully."
}
```

**Errors**

- `400` — Invalid or empty filenames array
- `500` — Failed to read or write metadata

---

### POST /api/images/:filename/duplicate

Duplicates an image and its palette. Creates a new file and metadata entry with an auto-incremented name.

**Response**

```json
{
  "success": true,
  "filename": "img-1739454600001-987654321.jpeg",
  "metadata": { /* same shape as image record */ }
}
```

**Errors**

- `400` — Invalid filename
- `404` — Image not found
- `500` — Duplication failed

---

### POST /upload

Upload an image from a file or URL.

**Request (multipart/form-data)**

| Field | Type | Description |
|-------|------|-------------|
| `uploadType` | `"file"` \| `"url"` | Source type |
| `imageFile` | File | Required if `uploadType === "file"` |
| `imageUrl` | string | Required if `uploadType === "url"` |

**Response**

```json
{
  "success": true,
  "filename": "img-1739454600000-123456789.jpeg",
  "metadata": {
    "createdDateTime": "2025-02-13T15:30:00.000Z",
    "uploadedURL": null,
    "uploadedFilePath": "photo.jpg",
    "cachedFilePath": "uploads/img-1739454600000-123456789.jpeg",
    "width": 1920,
    "height": 1080,
    "format": "jpeg",
    "fileSizeBytes": 245000,
    "colorPalette": [],
    "paletteName": "img-1739454600000-123456789"
  }
}
```

**Errors**

- `400` — No file or URL provided; invalid input
- `500` — Download failed, unsupported format, timeout, file too large, or processing error

---

### POST /api/regions/:filename

Detect regions in an image using a Python/OpenCV subprocess. Persists regions to metadata and computes `paletteRegion` when a palette exists.

**Response**

```json
{
  "success": true,
  "regions": [[[x, y], [x, y], ...], ...],
  "paletteRegion": [{ "hex": "#1a2b3c", "regionColor": "#2c3d4e", "x": 100, "y": 80 }, ...]
}
```

**Errors**

- `400` — Invalid filename (contains `..`, `/`, or `\`)
- `404` — Image not found
- `500` — Region detection script missing or failed

---

### POST /api/palette/:filename

Generate a color palette from the image using K-means clustering.

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `regenerate` | `"true"` | Force recompute; ignore cached palette |
| `k` | number | K-means cluster count (2–20); defaults to 5 if unspecified |

**Request body (optional, JSON)**

```json
{
  "regions": [[[x, y], [x, y], ...], ...],
  "k": 7,
  "regenerate": true
}
```

- **regions**: When provided, K-means runs only on pixels inside these polygons (masked extraction).
- **k**: Same as query param; body takes precedence.
- **regenerate**: Same as query param; body takes precedence.

**Response**

```json
{
  "success": true,
  "palette": ["#1a2b3c", "#4d5e6f", "#7e8f9a"],
  "paletteRegion": [{ "hex": "#1a2b3c", "regionColor": "#2c3d4e", "x": 100, "y": 80 }, ...]
}
```

**Behavior**

- If a valid palette exists and `regenerate` is not `true` and no `regions` are passed, returns cached palette.
- When regions exist and palette is generated, `paletteRegion` maps each region to its nearest palette swatch (CIEDE2000).

**Errors**

- `400` — Invalid filename
- `404` — Image metadata not found
- `500` — Palette generation or metadata write failed

---

### PUT /api/palette/:filename

Save an updated palette (e.g., after manual swatch edits or reordering).

**Request body**

```json
{
  "colorPalette": ["#1a2b3c", "#4d5e6f"],
  "swatchLabels": ["A", "B"]
}
```

- **colorPalette**: Array of hex strings (`#RRGGBB`). Required.
- **swatchLabels**: Optional; must match `colorPalette` length. Defaults to `A`, `B`, `C`, … if invalid or omitted.

**Response**

```json
{
  "success": true,
  "message": "Palette updated successfully."
}
```

**Errors**

- `400` — Invalid filename or palette format (non-hex colors)
- `404` — Image metadata not found
- `500` — Failed to save palette

---

### PUT /api/metadata/:filename

Update metadata fields: palette name, regions, and region labels.

**Request body**

Provide at least one of:

```json
{
  "paletteName": "My Palette",
  "regions": [[[x, y], [x, y], ...], ...],
  "regionLabels": ["00", "01", "02"]
}
```

- **paletteName**: 1–100 characters, non-empty.
- **regions**: Array of polygon arrays. When regions change, `paletteRegion` is recomputed if a palette exists.
- **regionLabels**: Optional; must match `regions` length. Defaults to `"00"`, `"01"`, … if invalid or omitted.

**Response**

```json
{
  "success": true,
  "message": "Metadata updated successfully."
}
```

**Errors**

- `400` — Invalid filename, palette name, or regions; or neither `paletteName` nor `regions` provided
- `404` — Image metadata not found
- `500` — Failed to save metadata

---

### DELETE /api/images/:filename

Delete an image file and its metadata record.

**Response**

```json
{
  "success": true,
  "message": "Image deleted successfully."
}
```

**Errors**

- `400` — Invalid filename
- `404` — Image not found
- `500` — Delete or metadata rewrite failed

---

## JSONL Metadata Format

Metadata is stored in `image_metadata.jsonl`. Each line is a JSON object representing one image:

| Field | Type | Description |
|-------|------|-------------|
| `createdDateTime` | string | ISO 8601 timestamp |
| `uploadedURL` | string \| null | Source URL if uploaded from URL |
| `uploadedFilePath` | string \| null | Original filename if uploaded from file |
| `cachedFilePath` | string | Path to saved image (e.g. `uploads/img-xxx.jpeg`) |
| `width`, `height` | number | Image dimensions |
| `format` | string | `jpeg`, `png`, `webp`, etc. |
| `fileSizeBytes` | number | File size |
| `colorPalette` | string[] | Hex colors |
| `paletteName` | string | Display name |
| `swatchLabels` | string[] | Labels per swatch (A, B, C, …) |
| `regions` | number[][][] | Polygon arrays `[[x,y], ...]` per region |
| `regionLabels` | string[] | Labels per region (00, 01, …) |
| `paletteRegion` | object[] | `{ hex, regionColor, x, y }` per region (nearest palette swatch) |
| `regionStrategy` | string | Last detection strategy: `default`, `adaptive`, `otsu`, `canny`, `color`, `watershed`, `grabcut`, `slic`, `saliency`, `meanshift`, `quadtree`, `circles`, `rectangles` |
| `regionParams` | object | Strategy-specific params (e.g. `adaptiveBlockSize`, `grabcutRectPad`, `slicRegionSize`) saved when regions were detected |
