// Handles image processing, specifically palette generation using K-means and luminance threshold filtering.

const getPixels = require('get-pixels');
const { clusterize } = require('node-kmeans'); // Import K-means
const colorDiff = require('color-diff');

// --- Palette Generation Configuration ---

// Number of clusters (colors) to find using K-means.
// We find 7, then filter based on luminance thresholds.
const K_CLUSTERS = 7; 
const FINAL_PALETTE_SIZE = 5;

// Luminance thresholds to filter out near-black and near-white clusters.
const MIN_LUMINANCE_THRESHOLD = 25;
const MAX_LUMINANCE_THRESHOLD = 185;

// CIEDE2000 delta-E threshold for merging centroids (e.g., when image has fewer distinct colors than k).
const COLOR_SIMILARITY_THRESHOLD = 5;

function minPairwiseColorDistance(centroidsRgb) {
    if (centroidsRgb.length < 2) return null;
    let minD = Infinity;
    for (let i = 0; i < centroidsRgb.length; i++) {
        const a = { R: centroidsRgb[i][0], G: centroidsRgb[i][1], B: centroidsRgb[i][2] };
        for (let j = i + 1; j < centroidsRgb.length; j++) {
            const b = { R: centroidsRgb[j][0], G: centroidsRgb[j][1], B: centroidsRgb[j][2] };
            const d = colorDiff.diff(a, b);
            if (d < minD) minD = d;
        }
    }
    return minD === Infinity ? null : minD;
}

/**
 * Calculates the perceived luminance of an RGB color.
 * Uses the standard formula for relative luminance.
 * @param {number[]} rgb - Array of RGB values [r, g, b] (0-255).
 * @returns {number} Luminance value (0-255).
 */
function calculateLuminance(rgb) {
    // Normalize RGB to 0-1 range for standard calculation
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    // Standard relative luminance calculation
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Scale back to 0-255 range (optional, but keeps it consistent with input)
    return luminance * 255;
}

/**
 * Point-in-polygon test (ray casting).
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @param {number[][]} poly - Polygon as [[x,y], ...]
 * @returns {boolean}
 */
function pointInPolygon(px, py, poly) {
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Returns true if (x,y) is inside any of the regions (polygons).
 */
function pointInAnyRegion(x, y, regions) {
    if (!regions || !Array.isArray(regions) || regions.length === 0) return true;
    return regions.some((poly) => pointInPolygon(x, y, poly));
}

/**
 * Generates a palette of up to 5 dominant colors from an image using K-means,
 * filtering clusters based on luminance thresholds (removing near-blacks/whites),
 * and returning the remaining colors sorted by luminance (darkest to lightest).
 * @param {string} imagePath - The path to the image file.
 * @param {{ k?: number, regions?: number[][][] }} [options] - Optional. k: number of clusters (2–20, default 7). regions: polygons to mask (only sample pixels inside).
 * @returns {Promise<string[]>} A promise that resolves to an array of hex color strings (e.g., ['#RRGGBB']).
 */
async function generateDistinctPalette(imagePath, options = {}) {
    const k = options.k != null ? Math.min(20, Math.max(2, Math.floor(options.k))) : K_CLUSTERS;
    const regions = options.regions;
    const useMask = regions && Array.isArray(regions) && regions.length > 0;
    console.log(`[Image Processor] Starting K-means palette generation (k=${k}, luminance threshold filtered${useMask ? ', masked by regions' : ''}) for: ${imagePath}`);
    let extractedPalette = [];

    try {
        // 1. Read pixel data from the image file.
        const pixelsData = await new Promise((resolve, reject) => {
            console.log(`[Image Processor] Calling getPixels with imagePath: ${imagePath}`);
            getPixels(imagePath, (err, pixels) => {
                if (err) {
                    console.error('[Image Processor] *** getPixels callback error:', err);
                    return reject(err);
                }
                console.log('[Image Processor] getPixels callback success.');
                resolve(pixels);
            });
        });
        console.log('[Image Processor] getPixels promise resolved.');

        const shape = pixelsData.shape || [];
        // get-pixels returns shape [rows, columns, channels] = [height, width, 4]
        const height = shape[0] != null ? shape[0] : 1;
        const width = shape[1] != null ? shape[1] : 1;

        // 2. Prepare the pixel array for K-means (exclude transparent, near-black, near-white; optionally mask by regions).
        const pixelArray = []; // Array of [R, G, B] vectors
        const pixelDataArray = pixelsData.data;
        for (let i = 0; i < pixelDataArray.length; i += 4) {
            const pixelIndex = Math.floor(i / 4);
            // row-major: pixelIndex = row * width + col => x = col, y = row
            const px = pixelIndex % width;
            const py = Math.floor(pixelIndex / width);
            if (useMask && !pointInAnyRegion(px, py, regions)) continue;
            if (pixelDataArray[i + 3] <= 128) continue; // Skip mostly transparent
            const rgb = [pixelDataArray[i], pixelDataArray[i + 1], pixelDataArray[i + 2]];
            const lum = calculateLuminance(rgb);
            if (lum < MIN_LUMINANCE_THRESHOLD || lum > MAX_LUMINANCE_THRESHOLD) continue; // Exclude near-black/white
            pixelArray.push(rgb);
        }
        console.log(`[Image Processor] Prepared pixel array with ${pixelArray.length} pixels (excluding near-black/white).`);

        if (pixelArray.length > 0) {

            // 3. Perform K-means clustering (unseeded).
            const result = await new Promise((resolve, reject) => {
                console.log(`[Image Processor] Calling K-means clusterize with k=${k}...`);
                clusterize(pixelArray, { k }, (err, res) => {
                    if (err) {
                        console.error('[Image Processor] *** K-means callback error:', err);
                        return reject(err);
                    }
                    console.log('[Image Processor] K-means callback success.');
                    resolve(res);
                });
            });
            console.log('[Image Processor] K-means promise resolved.');

            if (result && Array.isArray(result) && result.length > 0) {
                const allCentroidsRgb = result.map(cluster => cluster.centroid.map(Math.round));
                console.log(`[Image Processor] Extracted ${allCentroidsRgb.length} centroids (colors).`);
                const minDistKmeans = minPairwiseColorDistance(allCentroidsRgb);
                if (minDistKmeans != null) {
                    console.log(`[Image Processor] After K-means: minimal color distance = ${minDistKmeans.toFixed(4)}`);
                }
                extractedPalette = centroidsToPalette(allCentroidsRgb, options);
                console.log(`[Image Processor] Selected final ${extractedPalette.length} centroids.`);
            } else {
                console.warn('[Image Processor] K-means did not return valid results.');
            }
        } else {
             console.warn("[Image Processor] No opaque pixels found or pixel array is empty.");
        }
    } catch (error) {
        console.error("*** Error during K-means palette processing:", error);
        extractedPalette = []; // Return empty palette on error
    }
    
    console.log(`[Image Processor] Finished K-means palette generation. Returning ${extractedPalette.length} colors.`);
    return extractedPalette;
}

// Helper function for formatting (optional, used in fallback)
function rgbToHex(rgb) {
    const r = rgb[0].toString(16).padStart(2, '0');
    const g = rgb[1].toString(16).padStart(2, '0');
    const b = rgb[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

/**
 * Converts raw K-means centroids (RGB arrays) to a palette of hex strings.
 * Filters by luminance, sorts by luminance, and takes up to maxColors.
 * @param {number[][]} centroidsRgb - Array of [r,g,b] arrays (0-255).
 * @param {{ k?: number }} [options] - Optional. k: max palette size when specified.
 * @returns {string[]} Array of hex color strings.
 */
function centroidsToPalette(centroidsRgb, options = {}) {
    const k = options.k != null ? Math.min(20, Math.max(2, Math.floor(options.k))) : K_CLUSTERS;
    const maxColors = options.k != null ? k : FINAL_PALETTE_SIZE;

    const centroidsWithLuminance = centroidsRgb.map(rgb => ({
        rgb: rgb,
        luminance: calculateLuminance(rgb)
    }));

    const filtered = centroidsWithLuminance.filter(item =>
        item.luminance >= MIN_LUMINANCE_THRESHOLD && item.luminance <= MAX_LUMINANCE_THRESHOLD
    );
    filtered.sort((a, b) => a.luminance - b.luminance);

    const filteredRgb = filtered.map((item) => item.rgb);
    const minDistBeforeMerge = minPairwiseColorDistance(filteredRgb);
    if (minDistBeforeMerge != null) {
        console.log(`[Image Processor] Before merge centroids: minimal color distance = ${minDistBeforeMerge.toFixed(4)} (${filtered.length} centroids)`);
    }

    // Merge centroids within COLOR_SIMILARITY_THRESHOLD (handles images with fewer distinct colors than k)
    const merged = [];
    for (const item of filtered) {
        const c = { R: item.rgb[0], G: item.rgb[1], B: item.rgb[2] };
        const shouldMerge = merged.some((existing) =>
            colorDiff.diff(c, { R: existing.rgb[0], G: existing.rgb[1], B: existing.rgb[2] }) < COLOR_SIMILARITY_THRESHOLD
        );
        if (!shouldMerge) merged.push(item);
        if (merged.length >= maxColors) break;
    }

    const mergedRgb = merged.map((item) => item.rgb);
    const minDistMerged = minPairwiseColorDistance(mergedRgb);
    if (minDistMerged != null) {
        console.log(`[Image Processor] After merge centroids: minimal color distance = ${minDistMerged.toFixed(4)} (${merged.length} centroids)`);
    }

    const finalCentroids = merged.slice(0, maxColors);
    return finalCentroids.map(item => rgbToHex(item.rgb));
}

/**
 * Polygon centroid.
 * NOTE: This function is duplicated in client/src/imageViewerGeometry.js.
 * Keep both implementations in sync if making changes.
 */
function polygonCentroid(poly) {
    if (!poly || poly.length === 0) return [0, 0];
    let sx = 0, sy = 0;
    for (const pt of poly) {
        sx += pt[0];
        sy += pt[1];
    }
    return [sx / poly.length, sy / poly.length];
}

/**
 * Parse hex #RRGGBB to { R, G, B }.
 */
function hexToRgb(hex) {
    const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { R: (n >> 16) & 255, G: (n >> 8) & 255, B: n & 255 };
}

/**
 * For each region, compute centroid and average color of pixels inside.
 * Find nearest palette color (deltaE). Return [{ hex, x, y }, ...].
 * @param {string} imagePath - Path to image
 * @param {number[][][]} regions - Polygons
 * @param {string[]} palette - Hex strings
 * @returns {Promise<{ hex: string, x: number, y: number }[]>}
 */
async function computeRegionColorMarkers(imagePath, regions, palette) {
    if (!regions?.length || !palette?.length) return [];
    const paletteRgb = palette.map(hexToRgb).filter(Boolean);
    if (paletteRgb.length === 0) return [];

    const pixelsData = await new Promise((resolve, reject) => {
        getPixels(imagePath, (err, pixels) => {
            if (err) return reject(err);
            resolve(pixels);
        });
    });
    const shape = pixelsData.shape || [];
    // get-pixels returns shape [rows, columns, channels] = [height, width, 4]
    const height = shape[0] != null ? shape[0] : 1;
    const width = shape[1] != null ? shape[1] : 1;
    const pixelDataArray = pixelsData.data;

    const markers = [];
    for (let r = 0; r < regions.length; r++) {
        const poly = regions[r];
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let i = 0; i < pixelDataArray.length; i += 4) {
            const pixelIndex = Math.floor(i / 4);
            // row-major: pixelIndex = row * width + col => x = col, y = row
            const px = pixelIndex % width;
            const py = Math.floor(pixelIndex / width);
            if (!pointInPolygon(px, py, poly)) continue;
            if (pixelDataArray[i + 3] <= 128) continue;
            sumR += pixelDataArray[i];
            sumG += pixelDataArray[i + 1];
            sumB += pixelDataArray[i + 2];
            count++;
        }
        const [cx, cy] = polygonCentroid(poly);
        let nearestHex = palette[0];
        let regionColorHex = '#888888';
        if (count > 0) {
            const avg = { R: sumR / count, G: sumG / count, B: sumB / count };
            regionColorHex = rgbToHex([Math.round(avg.R), Math.round(avg.G), Math.round(avg.B)]);
            let minD = Infinity;
            for (let p = 0; p < paletteRgb.length; p++) {
                const d = colorDiff.diff(avg, paletteRgb[p]);
                if (d < minD) {
                    minD = d;
                    nearestHex = palette[p];
                }
            }
        }
        markers.push({
            hex: nearestHex,
            regionColor: regionColorHex,
            x: Math.round(cx),
            y: Math.round(cy)
        });
    }
    return markers;
}

module.exports = {
    generateDistinctPalette,
    centroidsToPalette,
    calculateLuminance,
    minPairwiseColorDistance,
    pointInPolygon,
    pointInAnyRegion,
    computeRegionColorMarkers
};
