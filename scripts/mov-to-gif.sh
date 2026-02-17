#!/bin/bash
# Convert a .mov file to a .gif file using ffmpeg
# Usage: ./scripts/mov-to-gif.sh [-s PERCENT] input.mov [output.gif]
#   -s, --scale PERCENT: Reduce dimensions by PERCENT (0-100, e.g., 33 for 33% reduction)
# If output filename is not provided, uses input filename with .gif extension
# Run from project root, or use relative paths (e.g., ../media/input.mov)

set -e

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed."
    echo "Install with: brew install ffmpeg (macOS) or sudo apt install ffmpeg (Linux)"
    exit 1
fi

# Default values
SCALE_PERCENT=0
INPUT_FILE=""
OUTPUT_FILE=""

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--scale)
            if [ -z "$2" ]; then
                echo "Error: -s/--scale requires a percentage value (0-100)."
                exit 1
            fi
            SCALE_PERCENT="$2"
            shift 2
            ;;
        *)
            if [ -z "$INPUT_FILE" ]; then
                INPUT_FILE="$1"
            elif [ -z "$OUTPUT_FILE" ]; then
                OUTPUT_FILE="$1"
            else
                echo "Error: Too many arguments."
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if input file is provided
if [ -z "$INPUT_FILE" ]; then
    echo "Usage: $0 [-s PERCENT] input.mov [output.gif]"
    echo "  -s, --scale PERCENT: Reduce dimensions by PERCENT (0-100)"
    echo "Example (from project root): $0 -s 33 media/gold-blue.mov media/gold-blue.gif"
    echo "Example (from scripts folder): $0 -s 33 ../media/gold-blue.mov ../media/gold-blue.gif"
    exit 1
fi

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found."
    exit 1
fi

# Determine output filename
if [ -z "$OUTPUT_FILE" ]; then
    # Replace .mov extension with .gif
    OUTPUT_FILE="${INPUT_FILE%.mov}.gif"
fi

# Validate and calculate scale factor (if SCALE_PERCENT is 33, scale factor is 0.67)
if [ "$SCALE_PERCENT" -gt 0 ] && [ "$SCALE_PERCENT" -lt 100 ] 2>/dev/null; then
    SCALE_FACTOR=$(awk "BEGIN {printf \"%.2f\", (100 - $SCALE_PERCENT) / 100}")
    SCALE_FILTER="scale=iw*$SCALE_FACTOR:-1"
elif [ "$SCALE_PERCENT" -ne 0 ] 2>/dev/null; then
    echo "Error: Scale percentage must be between 0 and 100."
    exit 1
else
    # Use original unscaled dimensions
    SCALE_FILTER="scale=iw:-1"
fi

# Create temporary palette file
PALETTE_FILE="${OUTPUT_FILE%.gif}-palette.png"

if [ "$SCALE_PERCENT" -gt 0 ]; then
    echo "Converting '$INPUT_FILE' to '$OUTPUT_FILE' (reducing dimensions by ${SCALE_PERCENT}%)..."
else
    echo "Converting '$INPUT_FILE' to '$OUTPUT_FILE' (using original dimensions)..."
fi
echo "Step 1/2: Generating palette..."

# Generate palette (first pass)
ffmpeg -i "$INPUT_FILE" \
    -vf "fps=15,$SCALE_FILTER:flags=lanczos,palettegen" \
    -y "$PALETTE_FILE" \
    -loglevel error

echo "Step 2/2: Creating GIF with palette..."

# Create GIF with palette (second pass)
ffmpeg -i "$INPUT_FILE" \
    -i "$PALETTE_FILE" \
    -lavfi "fps=15,$SCALE_FILTER:flags=lanczos[x];[x][1:v]paletteuse" \
    -y "$OUTPUT_FILE" \
    -loglevel error

# Clean up palette file
rm -f "$PALETTE_FILE"

echo "✓ Successfully created '$OUTPUT_FILE'"
