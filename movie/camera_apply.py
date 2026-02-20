#!/usr/bin/env python3
"""
camera_apply.py
Apply a teleprompter camera-script.json to a full-resolution recorded video.
Produces a new video with zoom, pan, easing, and subtitles applied per beat.

Usage:
    python3 camera_apply.py input.mp4 camera-script.json output.mp4

Optional flags:
    --fps 30            Output frame rate (default: match input)
    --duration 30       Total video duration in seconds (default: 30)
    --no-subs           Skip burned-in subtitles
    --srt               Also write output.srt alongside output video
    --sub-size 36       Subtitle font size (default: 36)
    --sub-opacity 0.75  Subtitle bar background opacity (default: 0.75)
"""

import cv2
import numpy as np
import json
import sys
import argparse
import subprocess
from pathlib import Path


# ---------------------------------------------------------------------------
# Section colors matching the teleprompter UI — stored as BGR for OpenCV
# ---------------------------------------------------------------------------

SECTION_COLORS_BGR = {
    "1": (248, 140, 129),   # #818cf8 indigo
    "2": (153, 211,  52),   # #34d399 green
    "3": ( 35, 146, 251),   # #fb923c orange
    "4": (182, 114, 244),   # #f472b6 pink
    "5": (250, 165,  96),   # #60a5fa blue
}

def sec_color(beat_id):
    return SECTION_COLORS_BGR.get(beat_id[0], (191, 139, 167))


# ---------------------------------------------------------------------------
# Easing functions (CSS cubic-bezier approximations)
# ---------------------------------------------------------------------------

BEZIERS = {
    "linear":      (0.0,  0.0,  1.0,  1.0),
    "ease":        (0.25, 0.1,  0.25, 1.0),
    "ease-in":     (0.42, 0.0,  1.0,  1.0),
    "ease-out":    (0.0,  0.0,  0.58, 1.0),
    "ease-in-out": (0.42, 0.0,  0.58, 1.0),
}

def _bezier_x(s, p1x, p2x):
    return 3*p1x*s*(1-s)**2 + 3*p2x*s**2*(1-s) + s**3

def _bezier_y(s, p1y, p2y):
    return 3*p1y*s*(1-s)**2 + 3*p2y*s**2*(1-s) + s**3

def cubic_bezier(t, p1x, p1y, p2x, p2y, iterations=16):
    lo, hi = 0.0, 1.0
    for _ in range(iterations):
        mid = (lo + hi) / 2.0
        if _bezier_x(mid, p1x, p2x) < t:
            lo = mid
        else:
            hi = mid
    return _bezier_y((lo + hi) / 2.0, p1y, p2y)

def ease(t, mode):
    t = max(0.0, min(1.0, t))
    if mode in ("CUT", "HOLD") or mode not in BEZIERS:
        return 1.0
    return cubic_bezier(t, *BEZIERS[mode])


# ---------------------------------------------------------------------------
# Build per-frame camera path
# ---------------------------------------------------------------------------

def build_frame_params(beats, total_frames, fps, total_duration):
    n_beats = len(beats)
    beat_frames = total_frames / n_beats

    zooms = np.zeros(total_frames)
    fxs   = np.zeros(total_frames)
    fys   = np.zeros(total_frames)

    for bi, beat in enumerate(beats):
        cam    = beat["camera"]
        z_to   = cam["zoom"]
        fx_to  = cam["focusX"]
        fy_to  = cam["focusY"]
        tr     = cam["transition"]
        tr_dur = cam["duration"]

        if bi == 0:
            z_from, fx_from, fy_from = z_to, fx_to, fy_to
        else:
            prev    = beats[bi - 1]["camera"]
            z_from  = prev["zoom"]
            fx_from = prev["focusX"]
            fy_from = prev["focusY"]

        f_start = int(round(bi * beat_frames))
        f_end   = min(int(round((bi + 1) * beat_frames)), total_frames)

        tr_frames = int(round(tr_dur * fps))
        if tr in ("CUT", "HOLD") or tr_dur == 0:
            tr_frames = 0

        for f in range(f_start, f_end):
            local = f - f_start
            if local < tr_frames and tr_frames > 0:
                t  = local / tr_frames
                et = ease(t, tr)
                zooms[f] = z_from  + (z_to  - z_from)  * et
                fxs[f]   = fx_from + (fx_to - fx_from) * et
                fys[f]   = fy_from + (fy_to - fy_from) * et
            else:
                zooms[f] = z_to
                fxs[f]   = fx_to
                fys[f]   = fy_to

    return zooms, fxs, fys


# ---------------------------------------------------------------------------
# Build frame->beat index lookup
# ---------------------------------------------------------------------------

def build_beat_index(beats, total_frames):
    n = len(beats)
    idx = np.zeros(total_frames, dtype=np.int32)
    for bi in range(n):
        f_start = int(round(bi * total_frames / n))
        f_end   = min(int(round((bi + 1) * total_frames / n)), total_frames)
        idx[f_start:f_end] = bi
    return idx


# ---------------------------------------------------------------------------
# Apply camera transform to a single frame
# ---------------------------------------------------------------------------

def apply_transform(frame, zoom, fx_pct, fy_pct):
    h, w = frame.shape[:2]
    crop_w = int(round(w / zoom))
    crop_h = int(round(h / zoom))
    cx = int(round(fx_pct / 100.0 * w))
    cy = int(round(fy_pct / 100.0 * h))
    x1 = max(0, min(w - crop_w, cx - crop_w // 2))
    y1 = max(0, min(h - crop_h, cy - crop_h // 2))
    cropped = frame[y1:y1+crop_h, x1:x1+crop_w]
    return cv2.resize(cropped, (w, h), interpolation=cv2.INTER_LANCZOS4)


# ---------------------------------------------------------------------------
# Draw subtitle overlay onto frame
# ---------------------------------------------------------------------------

def draw_subtitle(frame, beat, font_size, opacity):
    """
    Burns a bottom-third subtitle bar onto the frame.
    Silent beats (script starting with '[') are skipped.
    Styled to match the teleprompter: section color accent + monospace id label.
    """
    script = beat.get("script", "")
    if script.startswith("["):
        return frame

    h, w = frame.shape[:2]
    color  = sec_color(beat["id"])
    font   = cv2.FONT_HERSHEY_DUPLEX
    fscale = font_size / 28.0
    thick  = max(1, int(fscale * 1.8))

    (tw, th), baseline = cv2.getTextSize(script, font, fscale, thick)

    pad_x, pad_y = 28, 16
    bar_h = th + baseline + pad_y * 2
    bar_y = int(h * 0.80) - bar_h // 2
    bar_y = max(0, min(h - bar_h, bar_y))

    # Semi-transparent dark background bar
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, bar_y), (w, bar_y + bar_h), (12, 10, 15), -1)
    cv2.addWeighted(overlay, opacity, frame, 1.0 - opacity, 0, frame)

    # Left accent stripe in section color
    cv2.rectangle(frame, (0, bar_y), (5, bar_y + bar_h), color, -1)

    # Beat id (small, colored)
    id_scale = fscale * 0.52
    id_thick = max(1, thick - 1)
    id_text  = beat["id"].upper()
    cv2.putText(frame, id_text,
                (pad_x + 4, bar_y + pad_y + int(th * 0.62)),
                font, id_scale, color, id_thick, cv2.LINE_AA)
    id_w = cv2.getTextSize(id_text, font, id_scale, id_thick)[0][0]

    # Main script text (near-white)
    text_x = pad_x + 4 + id_w + 14
    text_y = bar_y + pad_y + th
    cv2.putText(frame, script, (text_x, text_y),
                font, fscale, (240, 245, 242), thick, cv2.LINE_AA)

    return frame


# ---------------------------------------------------------------------------
# Write SRT subtitle file
# ---------------------------------------------------------------------------

def fmt_srt_time(seconds):
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def write_srt(beats, total_duration, output_path):
    n        = len(beats)
    beat_dur = total_duration / n
    lines    = []
    idx      = 1
    for bi, beat in enumerate(beats):
        script = beat.get("script", "")
        if script.startswith("["):
            continue
        t_start = bi * beat_dur
        t_end   = (bi + 1) * beat_dur
        lines.append(str(idx))
        lines.append(f"{fmt_srt_time(t_start)} --> {fmt_srt_time(t_end)}")
        lines.append(script)
        lines.append("")
        idx += 1
    with open(output_path, "w") as f:
        f.write("\n".join(lines))
    print(f"SRT written: {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Apply camera script + subtitles to a video.")
    parser.add_argument("input",             help="Input video file (full-res recording)")
    parser.add_argument("script",            help="camera-script.json from teleprompter")
    parser.add_argument("output",            help="Output video file")
    parser.add_argument("--fps",         type=float, default=None,  help="Output FPS (default: match input)")
    parser.add_argument("--duration",    type=float, default=30.0,  help="Total duration in seconds (default: 30)")
    parser.add_argument("--no-subs",     action="store_true",       help="Skip burned-in subtitles")
    parser.add_argument("--srt",         action="store_true",       help="Also write .srt file alongside output")
    parser.add_argument("--sub-size",    type=int,   default=36,    help="Subtitle font size (default: 36)")
    parser.add_argument("--sub-opacity", type=float, default=0.75,  help="Subtitle bar opacity 0-1 (default: 0.75)")
    args = parser.parse_args()

    # Load camera script
    with open(args.script) as f:
        beats = json.load(f)
    print(f"Loaded {len(beats)} beats from {args.script}")

    # Open input video
    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        print(f"Error: cannot open {args.input}")
        sys.exit(1)

    src_fps      = cap.get(cv2.CAP_PROP_FPS)
    src_w        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h        = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    src_total    = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # Auto-detect duration from input if not explicitly set
    duration     = args.duration if args.duration != 30.0 else src_total / src_fps
    # H.264 requires even dimensions — crop by 1px if odd
    src_w        = src_w if src_w % 2 == 0 else src_w - 1
    src_h        = src_h if src_h % 2 == 0 else src_h - 1
    fps          = args.fps or src_fps
    total_frames = int(round(duration * fps))

    # Write SRT now that duration is known
    if args.srt:
        srt_path = str(Path(args.output).with_suffix(".srt"))
        write_srt(beats, duration, srt_path)

    print(f"Input:  {src_w}x{src_h} @ {src_fps:.2f}fps  ({src_total} frames, {src_total/src_fps:.1f}s)")
    print(f"Output: {src_w}x{src_h} @ {fps:.2f}fps  ({total_frames} frames, {duration:.1f}s)")
    if not args.no_subs:
        print(f"Subtitles: burned-in  size={args.sub_size}  opacity={args.sub_opacity}")

    # Build per-frame data
    zooms, fxs, fys = build_frame_params(beats, total_frames, fps, duration)
    beat_idx        = build_beat_index(beats, total_frames)

    # Step 1: Write frames to AVI (OpenCV writes AVI reliably on all platforms)
    import os
    tmp_avi = f"_tmp_{os.getpid()}.avi"
    fourcc  = cv2.VideoWriter_fourcc(*"MJPG")
    writer  = cv2.VideoWriter(tmp_avi, fourcc, fps, (src_w, src_h))

    print("Processing frames...")
    for fi in range(total_frames):
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
        if not ret:
            break

        frame = apply_transform(frame, zooms[fi], fxs[fi], fys[fi])
        frame = frame[:src_h, :src_w]  # enforce even dimensions

        if not args.no_subs:
            frame = draw_subtitle(frame, beats[beat_idx[fi]], args.sub_size, args.sub_opacity)

        writer.write(frame)

        if fi % max(1, int(fps)) == 0:
            elapsed = fi / fps
            bi      = beat_idx[fi]
            print(f"  {elapsed:5.1f}s / {args.duration}s  "
                  f"beat={beats[bi]['id']:3s}  "
                  f"zoom={zooms[fi]:.2f}x  "
                  f"fx={fxs[fi]:.0f}%  fy={fys[fi]:.0f}%",
                  end="\r")

    cap.release()
    writer.release()

    avi_size = os.path.getsize(tmp_avi)
    print(f"\nFrames done -> {tmp_avi}  ({avi_size / 1e6:.1f} MB)")
    if avi_size < 1000:
        print("ERROR: AVI file is empty — OpenCV VideoWriter failed")
        os.remove(tmp_avi)
        sys.exit(1)

    # Check if input has audio
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1", args.input
    ], capture_output=True, text=True)
    has_audio = "audio" in probe.stdout
    if not has_audio:
        print("Note: no audio track found in input")

    # Step 2: FFmpeg converts AVI -> MP4 and muxes audio
    print("Encoding to MP4 with FFmpeg...")
    ffmpeg_cmd = ["ffmpeg", "-y", "-i", tmp_avi]
    if has_audio:
        ffmpeg_cmd += ["-i", args.input, "-map", "0:v:0", "-map", "1:a:0"]
    else:
        ffmpeg_cmd += ["-map", "0:v:0"]
    ffmpeg_cmd += [
        "-c:v", "libx264",
        "-profile:v", "baseline",
        "-level", "3.0",
        "-crf", "18",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
    ]
    if has_audio:
        ffmpeg_cmd += ["-c:a", "aac", "-shortest"]
    ffmpeg_cmd += [args.output]

    result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
    os.remove(tmp_avi)

    if result.returncode != 0:
        print("FFmpeg error:\n", result.stderr[-2000:])
        sys.exit(1)

    if not os.path.exists(args.output) or os.path.getsize(args.output) == 0:
        print(f"ERROR: {args.output} is missing or empty after FFmpeg")
        print(result.stderr[-2000:])
        sys.exit(1)

    size_mb = os.path.getsize(args.output) / 1e6
    print(f"\nDone.  {args.output}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
