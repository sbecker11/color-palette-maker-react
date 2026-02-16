// Handles metadata reading and writing for image_metadata.jsonl

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const metadataFile = path.join(__dirname, 'image_metadata.jsonl');

// --- Metadata Reading ---
async function readMetadata(overridePath) {
    const targetFile = overridePath ?? metadataFile;
    console.log('[Metadata] Reading metadata file...'); // Added log
    try {
        const data = await fs.readFile(targetFile, 'utf8');
        // Split by newline, filter empty lines, parse each JSON line
        const metadataArray = data.trim().split(os.EOL)
                               .filter(line => line.length > 0)
                               .map(line => JSON.parse(line));
        console.log(`[Metadata] Read ${metadataArray.length} records.`); // Added log
        return metadataArray;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Metadata] Metadata file not found, returning empty array.'); // Added log
            // File doesn't exist, return empty array
            return [];
        }
        console.error("[Metadata] Error reading metadata file:", error);
        throw error; // Re-throw other errors
    }
}

// --- Metadata Appending ---
async function appendMetadata(metadataObject, overridePath) {
    const targetFile = overridePath ?? metadataFile;
    console.log('[Metadata] Appending metadata record...', metadataObject); // Added log
    try {
        const jsonLine = JSON.stringify(metadataObject) + os.EOL;
        await fs.appendFile(targetFile, jsonLine, 'utf8');
        console.log('[Metadata] Appended record successfully.'); // Added log
    } catch (error) {
        console.error("[Metadata] Error appending to metadata file:", error);
        throw error;
    }
}

// --- Metadata Rewriting ---
async function rewriteMetadata(metadataArray, overridePath) {
    const targetFile = overridePath ?? metadataFile;
    console.log(`[Metadata] Rewriting metadata file with ${metadataArray.length} records...`); // Added log
    try {
        const dataToWrite = metadataArray.map(obj => JSON.stringify(obj)).join(os.EOL) + (metadataArray.length > 0 ? os.EOL : '');
        await fs.writeFile(targetFile, dataToWrite, 'utf8');
        console.log('[Metadata] Rewrote file successfully.'); // Added log
    } catch (error) {
        console.error("[Metadata] Error rewriting metadata file:", error);
        throw error;
    }
}

module.exports = {
    readMetadata,
    appendMetadata,
    rewriteMetadata,
    metadataFile // Export file path if needed elsewhere
};
