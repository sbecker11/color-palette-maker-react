require('dotenv').config();
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const net = require('net');
const multer = require('multer');
const sharp = require('sharp');

// Import modularized handlers
const metadataHandler = require('./metadata_handler');
const imageProcessor = require('./image_processor');

const app = express();
const port = parseInt(process.env.PORT, 10) || 3000;

// Always show about page on first load (dev and prod)
const showAboutPage = true;

/** Returns palette region data from meta (paletteRegion or legacy clusterMarkers). */
function getPaletteRegion(meta) {
    if (Array.isArray(meta?.paletteRegion)) return meta.paletteRegion;
    if (Array.isArray(meta?.clusterMarkers)) return meta.clusterMarkers;
    return [];
}

/** Computes swatch labels (A, B, C, ..., Z, AA, ...) for a palette. */
function computeSwatchLabels(palette) {
    if (!Array.isArray(palette)) return [];
    return palette.map((_, i) => {
        let s = '';
        let n = i + 1;
        while (n > 0) {
            const r = (n - 1) % 26;
            s = String.fromCharCode(65 + r) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    });
}

// --- Configuration ---
const uploadsDir = path.join(__dirname, 'uploads');

// Resolve Python for region detection (required): DETECT_REGIONS_PYTHON > VIRTUAL_ENV > ./venv > python3
function getRegionDetectionPython() {
    if (process.env.DETECT_REGIONS_PYTHON) {
        return process.env.DETECT_REGIONS_PYTHON;
    }
    const isWin = process.platform === 'win32';
    const venvDir = process.env.VIRTUAL_ENV || path.join(__dirname, 'venv');
    const venvPython = path.join(venvDir, isWin ? 'Scripts\\python.exe' : 'bin/python');
    if (fs.existsSync(venvPython)) return venvPython;
    return 'python3';
}

/** Returns true if filename is safe (no path traversal or path separators). */
function validateFilename(filename) {
    return typeof filename === 'string' && filename.length > 0
        && !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
}

// Ensure uploads directory exists (using async fs)
async function ensureUploadsDir() {
    try {
        await fsp.mkdir(uploadsDir, { recursive: true });
        console.log(`Uploads directory ensured at: ${uploadsDir}`);
    } catch (error) {
        console.error("Error ensuring uploads directory exists:", error);
        process.exit(1); // Exit if we can't create the uploads dir
    }
}

// --- Multer Setup (Memory Storage) ---
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- Middleware ---
// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(uploadsDir));
// Serve static files from the React build (client/dist)
const frontendDir = path.join(__dirname, 'client', 'dist');
app.use(express.static(frontendDir));

// --- API Routes ---

// GET /api/config - runtime config (e.g. show about page on first load)
app.get('/api/config', (req, res) => {
    res.json({ about: showAboutPage });
});

// GET /api/images - List images from metadata
app.get('/api/images', async (req, res) => {
    console.log('[API GET /images] Request received.');
    try {
        const metadata = await metadataHandler.readMetadata();
        // File stores [bottom...top]; reverse for display order [top...bottom]
        res.json({ success: true, images: metadata.slice().reverse() });
    } catch (error) {
        console.error('[API GET /images] Error:', error);
        res.status(500).json({ success: false, message: "Error reading image metadata." });
    }
});

// POST /upload - Handle image upload/download
app.post('/upload', upload.single('imageFile'), async (req, res) => {
    console.log('[API POST /upload] Request received.');
    const uploadType = req.body.uploadType;
    const imageUrl = req.body.imageUrl;
    let inputBuffer = null;
    let sourceInfo = {}; 

    try {
        // 1. Get Input Buffer (File or URL)
        if (req.file) {
            console.log(`[Upload] Processing uploaded file: ${req.file.originalname}`);
            inputBuffer = req.file.buffer;
            sourceInfo.uploadedFilePath = req.file.originalname;
        } else if (uploadType === 'url' && imageUrl) {
            console.log(`[Upload] Attempting to download from URL: ${imageUrl}`);
            const response = await axios({
                method: 'get', url: imageUrl, responseType: 'arraybuffer',
                timeout: 15000
            });
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                 throw new Error(`Invalid content type (${contentType || 'unknown'}) at URL.`);
            }
            inputBuffer = Buffer.from(response.data);
            sourceInfo.uploadedURL = imageUrl;
            console.log(`[Upload] Downloaded ${inputBuffer.length} bytes from URL.`);
        } else {
            let message = 'Invalid input: No file or URL provided.';
            if (uploadType === 'url' && !imageUrl) message = 'Image URL is required.';
            else if (uploadType === 'file' && !req.file) message = 'Please select a file.';
            return res.status(400).json({ success: false, message: message });
        }

        if (!inputBuffer || inputBuffer.length === 0) {
            throw new Error("Input buffer is empty.");
        }

        // 2. Process with Sharp (get metadata, save file)
        const image = sharp(inputBuffer);
        const metadata = await image.metadata();
        const supportedFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'];
        const outputFormat = supportedFormats.includes(metadata.format) ? metadata.format : 'jpeg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const outputFilename = `img-${uniqueSuffix}.${outputFormat}`;
        const outputFilePath = path.join(uploadsDir, outputFilename);
        const outputInfo = await image.toFile(outputFilePath);
        console.log(`[Upload] Saved processed image to: ${outputFilePath}`);

        // 3. Create Metadata Record
        const defaultPaletteName = path.parse(outputFilename).name; // Filename without extension
        const record = {
            createdDateTime: new Date().toISOString(),
            uploadedURL: sourceInfo.uploadedURL || null,
            uploadedFilePath: sourceInfo.uploadedFilePath || null,
            cachedFilePath: outputFilePath,
            width: metadata.width,
            height: metadata.height,
            format: outputFormat,
            fileSizeBytes: outputInfo.size,
            colorPalette: [], // Initialize empty
            paletteName: defaultPaletteName // Add default palette name
        };

        // 4. Append Metadata
        await metadataHandler.appendMetadata(record);

        // 5. Return Success
        res.json({ success: true, filename: outputFilename, metadata: record });

    } catch (error) {
        console.error('[API POST /upload] Error:', error);
        let userMessage = 'Failed to process image.';
        // ... (keep existing specific error message handling)
        if (error.response) { userMessage = `Download failed. Status: ${error.response.status}`; }
        else if (error.request) { userMessage = 'Download failed. No response from URL.'; }
        else if (error.code === 'ERR_INVALID_URL') { userMessage = 'Invalid URL.'; }
        else if (error.message.includes('Input buffer contains unsupported image format')) { userMessage = 'Unsupported image format.'; }
        else if (error.message.includes('timeout')) { userMessage = 'Download/processing timed out.'; }
        else if (error.message.includes('File size limit exceeded')) { userMessage = 'Uploaded file is too large.'; }
        else { userMessage = error.message || 'An unknown error occurred.'; }
        res.status(500).json({ success: false, message: userMessage });
    }
});

// POST /api/regions/:filename - Detect regions using Python subprocess
// Body: { strategy?, adaptiveBlockSize?, adaptiveC?, cannyLow?, cannyHigh?, colorClusters?, watershedDistRatio? }
app.post('/api/regions/:filename', express.json(), async (req, res) => {
    const filename = req.params.filename;
    if (!validateFilename(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }
    const imagePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ success: false, message: 'Image not found.' });
    }
    const scriptPath = path.join(__dirname, 'scripts', 'detect_regions.py');
    if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({ success: false, message: 'Region detection script not found.' });
    }
    const strategy = ['default', 'adaptive', 'otsu', 'canny', 'color', 'watershed'].includes(req.body?.strategy)
        ? req.body.strategy
        : 'default';
    const procArgs = [scriptPath, imagePath, '--strategy', strategy];
    const addArg = (name, val) => { if (val != null && val !== '') procArgs.push(name, String(val)); };
    addArg('--adaptive-block-size', req.body?.adaptiveBlockSize);
    addArg('--adaptive-c', req.body?.adaptiveC);
    addArg('--canny-low', req.body?.cannyLow);
    addArg('--canny-high', req.body?.cannyHigh);
    addArg('--color-clusters', req.body?.colorClusters);
    addArg('--watershed-dist-ratio', req.body?.watershedDistRatio);
    try {
        const pythonCmd = getRegionDetectionPython();
        const result = await new Promise((resolve, reject) => {
            const proc = spawn(pythonCmd, procArgs, {
                cwd: __dirname,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
                if (code !== 0) {
                    try {
                        const errObj = JSON.parse(stdout || stderr);
                        return reject(new Error(errObj.error || 'Region detection failed'));
                    } catch {
                        return reject(new Error(stderr || stdout || `Process exited ${code}`));
                    }
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    reject(new Error('Invalid JSON from region detection'));
                }
            });
            proc.on('error', reject);
        });
        // Persist regions to metadata and compute region markers (centroid + average color) for each region
        const allMetadata = await metadataHandler.readMetadata();
        const idx = allMetadata.findIndex((e) => path.basename(e.cachedFilePath || '') === filename);
        let paletteRegion = [];
        if (idx >= 0) {
            const regions = result.regions || [];
            allMetadata[idx].regions = regions;
            allMetadata[idx].regionLabels = regions.map((_, i) => String(i).padStart(2, '0'));
            if (regions.length > 0) {
                try {
                    const palette = allMetadata[idx].colorPalette;
                    paletteRegion = await imageProcessor.computeRegionColorMarkers(
                        imagePath, regions,
                        Array.isArray(palette) && palette.length > 0 ? palette : []
                    );
                    allMetadata[idx].paletteRegion = paletteRegion;
                } catch (mrErr) {
                    console.warn('[API POST /regions] Could not compute region markers:', mrErr);
                    allMetadata[idx].paletteRegion = [];
                }
            } else {
                allMetadata[idx].paletteRegion = [];
            }
            await metadataHandler.rewriteMetadata(allMetadata);
        }
        res.json({ success: true, ...result, paletteRegion });
    } catch (err) {
        console.error('[API POST /regions] Error:', err);
        res.status(500).json({ success: false, message: err.message || 'Region detection failed.' });
    }
});

// POST /api/palette/:filename - Generate Palette On-Demand
app.post('/api/palette/:filename', express.json(), async (req, res) => {
    const filename = req.params.filename;
    console.log(`[API POST /palette] Request received for filename: ${filename}`);

    if (!validateFilename(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }

    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        console.error("[API POST /palette] Error reading metadata:", readError);
        return res.status(500).json({ success: false, message: 'Failed to read image metadata.' });
    }

    const imageIndex = allMetadata.findIndex(entry => path.basename(entry.cachedFilePath || '') === filename);

    if (imageIndex === -1) {
        return res.status(404).json({ success: false, message: 'Image metadata not found.' });
    }

    const imageMeta = allMetadata[imageIndex];
    const forceRegenerate = req.query.regenerate === 'true' || req.body?.regenerate === true;
    const kParam = req.query.k ?? req.body?.k;
    const k = kParam != null && /^\d+$/.test(String(kParam)) ? Math.min(20, Math.max(2, parseInt(String(kParam), 10))) : undefined;
    const regions = Array.isArray(req.body?.regions) ? req.body.regions : undefined;

    // Check if palette already exists and is valid - skip cache if ?regenerate=true
    if (!forceRegenerate && !regions && imageMeta.colorPalette && Array.isArray(imageMeta.colorPalette) && imageMeta.colorPalette.length > 0) {
        console.log(`[API POST /palette] Returning cached palette for ${filename}.`);
        const cachedPaletteRegion = getPaletteRegion(imageMeta);
        return res.json({ success: true, palette: imageMeta.colorPalette, paletteRegion: cachedPaletteRegion });
    }

    console.log(`[API POST /palette] Generating palette for ${filename}${forceRegenerate ? ' (regenerate)' : ''}${k != null ? ` k=${k}` : ''}`);
    const imagePath = path.join(uploadsDir, filename); // Use constructed path

    try {
        const opts = {};
        if (k != null) opts.k = k;
        if (regions && regions.length > 0) opts.regions = regions;
        const extractedPalette = await imageProcessor.generateDistinctPalette(imagePath, Object.keys(opts).length ? opts : undefined);

        // Compute palette region data when we have regions + palette
        let paletteRegion = [];
        if (regions?.length > 0 && extractedPalette?.length > 0) {
            try {
                paletteRegion = await imageProcessor.computeRegionColorMarkers(imagePath, regions, extractedPalette);
            } catch (mrErr) {
                console.warn('[API POST /palette] Could not compute palette region data:', mrErr);
            }
        }

        // Update metadata array (swatchLabels: A, B, C, ...)
        allMetadata[imageIndex].colorPalette = extractedPalette;
        allMetadata[imageIndex].swatchLabels = computeSwatchLabels(extractedPalette);
        allMetadata[imageIndex].paletteRegion = paletteRegion;

        // Rewrite metadata file
        await metadataHandler.rewriteMetadata(allMetadata);
        console.log(`[API POST /palette] Rewritten metadata for ${filename} with new palette.`);

        // Return new palette and region data
        res.json({ success: true, palette: extractedPalette, paletteRegion });

    } catch (error) {
        // Catch errors specifically from palette generation or rewrite
        console.error(`[API POST /palette] Error generating palette or rewriting metadata for ${filename}:`, error);
        res.status(500).json({ success: false, message: 'Error processing image for palette generation.' });
    }
});

// PUT /api/palette/:filename - Update/Save a specific palette
app.put('/api/palette/:filename', express.json(), async (req, res) => { // Use express.json() middleware for this route
    const filename = req.params.filename;
    const updatedPalette = req.body.colorPalette;
    const swatchLabels = req.body.swatchLabels;
    console.log(`[API PUT /palette] Request received for ${filename}`);

    if (!validateFilename(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }
    // Basic validation for the received palette
    if (!updatedPalette || !Array.isArray(updatedPalette) || !updatedPalette.every(c => /^#[0-9A-F]{6}$/i.test(c))) {
         return res.status(400).json({ success: false, message: 'Invalid palette data format.'});
    }
    // Validate swatchLabels if provided
    const validLabels = Array.isArray(swatchLabels) && swatchLabels.length === updatedPalette.length &&
        swatchLabels.every(l => typeof l === 'string' && l.length > 0);

    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        console.error("[API PUT /palette] Error reading metadata:", readError);
        return res.status(500).json({ success: false, message: 'Failed to read image metadata.' });
    }

    const imageIndex = allMetadata.findIndex(entry => path.basename(entry.cachedFilePath || '') === filename);

    if (imageIndex === -1) {
        return res.status(404).json({ success: false, message: 'Image metadata not found.' });
    }

    console.log(`[API PUT /palette] Updating palette for ${filename} with ${updatedPalette.length} colors.`);
    // Update the palette and swatchLabels in the metadata array
    allMetadata[imageIndex].colorPalette = updatedPalette;
    allMetadata[imageIndex].swatchLabels = validLabels ? swatchLabels : computeSwatchLabels(updatedPalette);

    // Rewrite the metadata file
    try {
        await metadataHandler.rewriteMetadata(allMetadata);
        console.log(`[API PUT /palette] Successfully saved updated palette for ${filename}.`);
        res.json({ success: true, message: 'Palette updated successfully.' });
    } catch (writeError) {
        console.error(`[API PUT /palette] Error rewriting metadata for ${filename}:`, writeError);
        res.status(500).json({ success: false, message: 'Failed to save updated palette.' });
    }
});

// POST /api/pairings/:filename - Recompute region-to-swatch pairings (paletteRegion)
app.post('/api/pairings/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!validateFilename(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }
    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        return res.status(500).json({ success: false, message: 'Could not read metadata.' });
    }
    const imageIndex = allMetadata.findIndex(entry => path.basename(entry.cachedFilePath || '') === filename);
    if (imageIndex === -1) {
        return res.status(404).json({ success: false, message: 'Image not found.' });
    }
    const meta = allMetadata[imageIndex];
    const palette = Array.isArray(meta.colorPalette) ? meta.colorPalette : [];
    const regions = Array.isArray(meta.regions) ? meta.regions : [];
    if (palette.length === 0 || regions.length === 0) {
        allMetadata[imageIndex].paletteRegion = [];
        await metadataHandler.rewriteMetadata(allMetadata);
        return res.json({ success: true, paletteRegion: [] });
    }
    const imagePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(imagePath)) {
        allMetadata[imageIndex].paletteRegion = [];
        await metadataHandler.rewriteMetadata(allMetadata);
        return res.json({ success: true, paletteRegion: [] });
    }
    try {
        const paletteRegion = await imageProcessor.computeRegionColorMarkers(imagePath, regions, palette);
        allMetadata[imageIndex].paletteRegion = paletteRegion;
        await metadataHandler.rewriteMetadata(allMetadata);
        res.json({ success: true, paletteRegion });
    } catch (err) {
        console.warn('[API POST /pairings] Could not compute pairings:', err);
        allMetadata[imageIndex].paletteRegion = [];
        await metadataHandler.rewriteMetadata(allMetadata);
        res.json({ success: true, paletteRegion: [] });
    }
});

// PUT /api/metadata/:filename - Update specific metadata fields (paletteName, regions, regionLabels)
app.put('/api/metadata/:filename', express.json(), async (req, res) => {
    const filename = req.params.filename;
    const { paletteName, regions, regionLabels } = req.body;
    console.log(`[API PUT /metadata] Request received for ${filename}`);

    if (!validateFilename(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }
    if (paletteName !== undefined) {
        if (typeof paletteName !== 'string' || paletteName.trim().length === 0 || paletteName.length > 100) {
            return res.status(400).json({ success: false, message: 'Invalid palette name provided.' });
        }
    }
    if (regions !== undefined && !Array.isArray(regions)) {
        return res.status(400).json({ success: false, message: 'Regions must be an array.' });
    }
    if (paletteName === undefined && regions === undefined) {
        return res.status(400).json({ success: false, message: 'Provide paletteName and/or regions.' });
    }

    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        console.error("[API PUT /metadata] Error reading metadata:", readError);
        return res.status(500).json({ success: false, message: 'Failed to read image metadata.' });
    }

    const imageIndex = allMetadata.findIndex(entry => path.basename(entry.cachedFilePath || '') === filename);

    if (imageIndex === -1) {
        return res.status(404).json({ success: false, message: 'Image metadata not found.' });
    }

    if (paletteName !== undefined) {
        allMetadata[imageIndex].paletteName = paletteName.trim();
    }
    if (regions !== undefined) {
        allMetadata[imageIndex].regions = regions;
        const validLabels = Array.isArray(regionLabels) && regionLabels.length === regions.length &&
            regionLabels.every(l => typeof l === 'string' && l.length > 0);
        allMetadata[imageIndex].regionLabels = validLabels
            ? regionLabels
            : regions.map((_, i) => String(i).padStart(2, '0'));
        // Recompute region markers (centroid + average color) when regions change
        if (regions.length > 0) {
            try {
                const imagePath = path.join(uploadsDir, filename);
                if (fs.existsSync(imagePath)) {
                    const palette = allMetadata[imageIndex].colorPalette;
                    allMetadata[imageIndex].paletteRegion = await imageProcessor.computeRegionColorMarkers(
                        imagePath, regions,
                        Array.isArray(palette) && palette.length > 0 ? palette : []
                    );
                } else {
                    allMetadata[imageIndex].paletteRegion = [];
                }
            } catch (mrErr) {
                console.warn('[API PUT /metadata] Could not recompute region markers:', mrErr);
                allMetadata[imageIndex].paletteRegion = [];
            }
        } else {
            allMetadata[imageIndex].paletteRegion = [];
        }
    }

    try {
        await metadataHandler.rewriteMetadata(allMetadata);
        console.log(`[API PUT /metadata] Successfully saved updated metadata for ${filename}.`);
        res.json({ success: true, message: 'Metadata updated successfully.' });
    } catch (writeError) {
        console.error(`[API PUT /metadata] Error rewriting metadata for ${filename}:`, writeError);
        res.status(500).json({ success: false, message: 'Failed to save updated metadata.' });
    }
});

// PUT /api/images/order - Reorder images in the Color Palettes list
app.put('/api/images/order', express.json(), async (req, res) => {
    const { filenames } = req.body;
    console.log('[API PUT /images/order] Request received.');

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid filenames array.' });
    }

    // Validate each filename
    for (const fn of filenames) {
        if (!validateFilename(fn)) {
            return res.status(400).json({ success: false, message: 'Invalid filename in order list.' });
        }
    }

    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        return res.status(500).json({ success: false, message: 'Failed to read metadata.' });
    }

    const metaByFilename = new Map();
    for (const entry of allMetadata) {
        const fn = path.basename(entry.cachedFilePath || '');
        if (fn) metaByFilename.set(fn, entry);
    }

    // Build new order: display order is [top...bottom], file stores [bottom...top] for reverse() compatibility
    const displayOrder = filenames.filter(fn => metaByFilename.has(fn));
    const fileOrder = displayOrder.slice().reverse();
    const reorderedMetadata = fileOrder.map(fn => metaByFilename.get(fn)).filter(Boolean);

    // Include any metadata not in the request (e.g. race condition) at the end
    const orderedFilenames = new Set(displayOrder);
    for (const entry of allMetadata) {
        const fn = path.basename(entry.cachedFilePath || '');
        if (fn && !orderedFilenames.has(fn)) {
            reorderedMetadata.push(entry);
        }
    }

    try {
        await metadataHandler.rewriteMetadata(reorderedMetadata);
        console.log(`[API PUT /images/order] Successfully reordered ${reorderedMetadata.length} images.`);
        res.json({ success: true, message: 'Order updated successfully.' });
    } catch (writeError) {
        console.error('[API PUT /images/order] Error rewriting metadata:', writeError);
        res.status(500).json({ success: false, message: 'Failed to save new order.' });
    }
});

// POST /api/images/:filename/duplicate - Duplicate the selected palette/image
app.post('/api/images/:filename/duplicate', async (req, res) => {
    const filename = req.params.filename;
    console.log(`[API POST /images/duplicate] Request received for filename: ${filename}`);

    if (!validateFilename(filename)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }

    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        return res.status(500).json({ success: false, message: 'Failed to read metadata.' });
    }

    const imageIndex = allMetadata.findIndex(entry => path.basename(entry.cachedFilePath || '') === filename);
    if (imageIndex === -1) {
        return res.status(404).json({ success: false, message: 'Image metadata not found.' });
    }

    const sourceMeta = allMetadata[imageIndex];
    const sourcePath = path.join(uploadsDir, filename);

    try {
        // 1. Copy the image file
        const ext = path.extname(filename);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newFilename = `img-${uniqueSuffix}${ext}`;
        const newFilePath = path.join(uploadsDir, newFilename);
        await fsp.copyFile(sourcePath, newFilePath);
        const newFileStat = await fsp.stat(newFilePath);

        // 2. Determine original name and next copy number
        const baseName = path.parse(filename).name;
        const originalName = sourceMeta.paletteName || baseName;
        const copyPattern = new RegExp('^' + originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-copy-(\\d+)$');
        let maxCopyNum = 0;
        for (const entry of allMetadata) {
            const pn = entry.paletteName || '';
            const m = pn.match(copyPattern);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxCopyNum) maxCopyNum = n;
            }
        }
        const newPaletteName = originalName + '-copy-' + (maxCopyNum + 1);

        // 3. Create new metadata record (copy palette, swatchLabels, regions, and image info)
        const palette = Array.isArray(sourceMeta.colorPalette) ? [...sourceMeta.colorPalette] : [];
        const labels = Array.isArray(sourceMeta.swatchLabels) && sourceMeta.swatchLabels.length === palette.length
            ? [...sourceMeta.swatchLabels]
            : computeSwatchLabels(palette);
        const newRecord = {
            createdDateTime: new Date().toISOString(),
            uploadedURL: null,
            uploadedFilePath: null,
            cachedFilePath: newFilePath,
            width: sourceMeta.width,
            height: sourceMeta.height,
            format: sourceMeta.format,
            fileSizeBytes: newFileStat.size,
            colorPalette: palette,
            swatchLabels: labels,
            paletteName: newPaletteName,
            regions: Array.isArray(sourceMeta.regions) ? JSON.parse(JSON.stringify(sourceMeta.regions)) : [],
            regionLabels: Array.isArray(sourceMeta.regionLabels) && sourceMeta.regionLabels.length === (sourceMeta.regions?.length ?? 0)
                ? [...sourceMeta.regionLabels]
                : (Array.isArray(sourceMeta.regions) ? sourceMeta.regions.map((_, i) => String(i).padStart(2, '0')) : []),
            paletteRegion: JSON.parse(JSON.stringify(getPaletteRegion(sourceMeta)))
        };

        // 4. Append (puts at end of file; GET reverses so new item appears at top)
        await metadataHandler.appendMetadata(newRecord);

        console.log(`[API POST /images/duplicate] Created duplicate: ${newFilename} as "${newPaletteName}"`);
        res.json({ success: true, filename: newFilename, metadata: newRecord });

    } catch (error) {
        console.error(`[API POST /images/duplicate] Error:`, error);
        res.status(500).json({ success: false, message: 'Failed to duplicate image.' });
    }
});

// DELETE /api/images/:filename - Delete image and metadata
app.delete('/api/images/:filename', async (req, res) => {
    const filenameToDelete = req.params.filename;
    console.log(`[API DELETE /images] Request received for filename: ${filenameToDelete}`);

    if (!validateFilename(filenameToDelete)) {
        return res.status(400).json({ success: false, message: 'Invalid filename.' });
    }

    let allMetadata;
    try {
        allMetadata = await metadataHandler.readMetadata();
    } catch (readError) {
        return res.status(500).json({ success: false, message: 'Failed to read metadata.' });
    }

    let foundEntry = null;
    let foundIndex = -1;
    const filteredMetadata = allMetadata.filter((entry, index) => {
        const entryFilename = path.basename(entry.cachedFilePath || '');
        if (entryFilename === filenameToDelete) {
            foundEntry = entry;
            foundIndex = index;
            return false; // Exclude from filtered list
        }
        return true;
    });

    if (foundIndex === -1) {
        return res.status(404).json({ success: false, message: 'Image metadata not found.' });
    }

    try {
        // 1. Delete the actual image file
        const filePathToDelete = path.join(uploadsDir, filenameToDelete); // Construct path
        console.log(`[API DELETE /images] Deleting image file: ${filePathToDelete}`);
        try {
             await fsp.unlink(filePathToDelete);
             console.log(`[API DELETE /images] Successfully deleted file: ${filePathToDelete}`);
        } catch (unlinkError) {
             if (unlinkError.code === 'ENOENT') {
                 console.warn(`[API DELETE /images] File not found during delete, proceeding to remove metadata: ${filePathToDelete}`);
             } else {
                 throw unlinkError; // Re-throw other unlink errors
             }
        }
       
        // 2. Rewrite the metadata file without the deleted entry
        await metadataHandler.rewriteMetadata(filteredMetadata);

        res.json({ success: true, message: 'Image deleted successfully.' });

    } catch (error) {
        console.error(`[API DELETE /images] Error during deletion process for ${filenameToDelete}:`, error);
        res.status(500).json({ success: false, message: 'Failed to delete image file or update metadata.' });
    }
});

// --- Root Route to serve frontend ---
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

// --- Server Start Logic with Port Check ---
const startApp = () => {
    ensureUploadsDir().then(() => {
        const expressServer = app.listen(port, () => {
            console.log(`Server is running on port ${port}. Access it at http://localhost:${port}`);
            console.log('\nChrome (copy/paste):');
            console.log(`  App mode:   chrome --app=http://localhost:${port}`);
            console.log(`  App mode:   open -a "Google Chrome" --args --app=http://localhost:${port}   # macOS`);
            console.log(`  Normal:     chrome http://localhost:${port}`);
            console.log(`  Normal:     open -a "Google Chrome" http://localhost:${port}   # macOS\n`);
        });

        expressServer.on('error', (err) => {
             if (err.code === 'EADDRINUSE') {
                console.error(`\n*** ERROR: Port ${port} is already in use. ***\n`);
                console.error('Please stop the other process or use a different port.');
                process.exit(1);
            } else {
                console.error('An unexpected error occurred with the Express server:', err);
                process.exit(1);
            }
        });

    }).catch(err => {
        console.error("Failed to initialize application directory:", err);
        process.exit(1);
    });
};

// Initial Port Check
const portCheckServer = net.createServer();
portCheckServer.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n*** ERROR: Port ${port} is already in use. ***\n`);
        console.error('Another process is likely listening on this port.');
        console.error('To find and stop the process, you can try running:');
        if (process.platform === 'win32') {
             console.error(`  tasklist | findstr "LISTENING" | findstr ":${port}"  (then use taskkill /PID <pid> /F)`);
        } else {
             console.error(`  sudo lsof -i :${port} -t | xargs kill -9`);
             console.error('(Or use: sudo lsof -i :${port} and kill -9 <PID>)');
        }
        process.exit(1);
    } else {
        console.error(`An unexpected error occurred while checking port ${port}:`, err);
        process.exit(1);
    }
});
portCheckServer.once('listening', () => {
    portCheckServer.close(() => {
        console.log(`Port ${port} is free. Starting the application...`);
        startApp();
    });
});
portCheckServer.listen(port, '127.0.0.1');
