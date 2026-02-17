#!/bin/bash
# Extract the first frame from an animated GIF and save as a single-frame GIF
# Usage: ./scripts/gif-first-frame.sh input.gif [output.gif]
# If output filename is not provided, uses input filename with -frame1.gif suffix
# Run from project root, or use relative paths (e.g., ../media/input.gif)

set -e

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed."
    echo "Install with: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Linux)"
    exit 1
fi

# Check if input file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 input.gif [output.gif]"
    echo "Example (from project root): $0 media/gold-blue.gif media/gold-blue-frame1.gif"
    echo "Example (from scripts folder): $0 ../media/gold-blue.gif ../media/gold-blue-frame1.gif"
    exit 1
fi

INPUT_FILE="$1"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found."
    exit 1
fi

# Determine output filename
if [ $# -ge 2 ]; then
    OUTPUT_FILE="$2"
else
    # Add -frame1 before .gif extension
    OUTPUT_FILE="${INPUT_FILE%.gif}-frame1.gif"
fi

echo "Extracting first frame from '$INPUT_FILE'..."

# Extract first frame (frame 0)
ffmpeg -i "$INPUT_FILE" \
    -vf "select=eq(n\,0)" \
    -frames:v 1 \
    -y "$OUTPUT_FILE" \
    -loglevel error

echo "✓ Successfully created single-frame GIF '$OUTPUT_FILE'"
