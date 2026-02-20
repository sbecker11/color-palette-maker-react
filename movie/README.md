# movie/

Post-production pipeline for the Color Palette Maker demo video.

## Overview

This folder contains two tools:

1. **Teleprompter** — a React/Vite app (`src/App.jsx`) for scripting and directing the screen recording beat by beat
2. **camera_apply.py** — a Python script that applies zoom, pan, easing, and subtitles to a full-resolution recording using a camera script JSON

## Requirements

### Node (Teleprompter app)
- Node.js 18+

### Python (Post-processing)
Python 3.8+ is required. Create a virtual environment inside `movie/` and install dependencies:

```bash
cd movie
python3 -m venv venv
source venv/bin/activate
pip install opencv-python numpy
```

Verify the install:
```bash
python3 -c "import cv2, numpy; print('cv2', cv2.__version__, '/ numpy', numpy.__version__)"
```

To reactivate the venv in a new terminal session before running `doit.sh`:
```bash
source venv/bin/activate
```

## Setup

### Teleprompter app
```bash
cd movie
npm install
npm run dev
```
Opens at http://localhost:5173

### Post-processing
Create and activate the virtual environment as described in Requirements above. The venv is activated automatically by `doit.sh`.

## Workflow

1. **Direct** — run the teleprompter app, review each beat's zoom/focus/transition settings
2. **Export** — click "export JSON" in the teleprompter, save as `camera-script.json` in `movie/`
3. **Record** — use QuickTime to capture the palette-maker app at full resolution (static, no zoom)
4. **Process** — run `doit.sh` to apply the camera script and generate the final video:

```bash
./doit.sh
```

This will:
- Timestamp and archive the camera script used
- Apply zoom, pan, easing, and burned-in subtitles to the recording
- Write `final.mp4` and `final.srt` to the `archive/` folder
- Open the result in QuickTime for review

## Files

| File | Description |
|------|-------------|
| `camera_apply.py` | Post-processing script |
| `camera-script.json` | Current camera script (edit between runs) |
| `doit.sh` | One-command render + archive + review |
| `recording.mov` | Full-resolution QuickTime capture |
| `venv/` | Python virtual environment (not committed to git) |
| `src/App.jsx` | Teleprompter React app |
| `archive/` | Timestamped outputs from each render run |

## camera_apply.py options

```
python3 camera_apply.py input.mov script.json output.mp4 [options]

--duration 30       Total video duration in seconds (default: 30)
--fps 30            Output frame rate (default: match input)
--no-subs           Skip burned-in subtitles
--srt               Also write .srt subtitle file
--sub-size 36       Subtitle font size (default: 36)
--sub-opacity 0.75  Subtitle bar opacity 0-1 (default: 0.75)
```
