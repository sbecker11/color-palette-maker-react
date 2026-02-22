#!/usr/bin/env python3
"""
Detect large regions in an image using OpenCV contour analysis.
Outputs JSON with region polygons for overlay and K-means masking.

Usage: python detect_regions.py <image_path>

Output (stdout): JSON object with { "regions": [ [[x,y], [x,y], ...], ... ], "width": N, "height": N }
"""

import sys
import json
import argparse

try:
    import cv2
    import numpy as np
except ImportError as e:
    print(json.dumps({"error": "Missing dependencies. Run: pip install opencv-python numpy"}), file=sys.stderr)
    sys.exit(1)


def _contours_to_regions(contours, min_area, max_regions):
    """Convert contours to region polygons, filtered by area."""
    regions = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) < 3:
            continue
        poly = [[int(p[0][0]), int(p[0][1])] for p in approx]
        regions.append(poly)

    def poly_area(p):
        return abs(
            sum(
                (p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1])
                for i in range(len(p))
            )
            / 2
        )

    regions.sort(key=poly_area, reverse=True)
    return regions[:max_regions]


def _fallback_center_regions(w, h, max_regions=5):
    """Fallback: return center-weighted regions (e.g. subject often in center)."""
    regions = []
    # Single large center region (60% of image, centered)
    cx, cy = w // 2, h // 2
    pad_w, pad_h = int(w * 0.2), int(h * 0.2)
    x1, y1 = pad_w, pad_h
    x2, y2 = w - pad_w, h - pad_h
    regions.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])
    return regions[:max_regions]


def _color_segmentation_regions(img, min_area, max_regions, n_clusters=12):
    """
    Segment by color using K-means in LAB space.
    Good for color wheels, palettes, and images with distinct color blocks.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(
        pixels, n_clusters, None, criteria, 3, cv2.KMEANS_PP_CENTERS
    )
    labels = labels.reshape(img.shape[:2])
    regions = []
    for i in range(n_clusters):
        mask = np.uint8(labels == i)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area:
                continue
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) < 3:
                continue
            poly = [[int(p[0][0]), int(p[0][1])] for p in approx]
            regions.append(poly)
    # Sort by area, take largest
    def poly_area(p):
        return abs(
            sum(
                (p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1])
                for i in range(len(p))
            )
            / 2
        )
    regions.sort(key=poly_area, reverse=True)
    return regions[:max_regions]


def _strategy_adaptive(gray, blurred, min_area, max_regions, block_size=11, c=2):
    """Strategy: Adaptive threshold on grayscale."""
    block = max(3, min(31, block_size if block_size % 2 else block_size + 1))
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, c
    )
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return _contours_to_regions(contours, min_area, max_regions)


def _strategy_otsu(gray, blurred, min_area, max_regions):
    """Strategy: Otsu global threshold."""
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return _contours_to_regions(contours, min_area, max_regions)


def _strategy_canny(gray, blurred, min_area, max_regions, low=50, high=150):
    """Strategy: Canny edges + dilation + contours."""
    edges = cv2.Canny(blurred, int(low), int(high))
    kernel = np.ones((5, 5), np.uint8)
    edges = cv2.dilate(edges, kernel)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return _contours_to_regions(contours, min_area, max_regions)


def _strategy_color(img, min_area, max_regions, n_clusters=12):
    """Strategy: Color K-means in LAB space."""
    return _color_segmentation_regions(img, min_area, max_regions, n_clusters=int(n_clusters))


def _strategy_watershed(img, min_area, max_regions, dist_ratio=0.5):
    """Strategy: Watershed on distance transform markers."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    dist = cv2.distanceTransform(thresh, cv2.DIST_L2, 5)
    ratio = max(0.1, min(0.9, dist_ratio))
    _, sure_fg = cv2.threshold(dist, ratio * dist.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(thresh, sure_fg)
    ret, markers = cv2.connectedComponents(sure_fg)
    markers += 1
    markers[unknown == 255] = 0
    img3 = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    markers = cv2.watershed(img3, markers)
    regions = []
    for label in range(2, ret + 1):
        mask = np.uint8(markers == label)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area:
                continue
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) < 3:
                continue
            poly = [[int(p[0][0]), int(p[0][1])] for p in approx]
            regions.append(poly)
    def poly_area(p):
        return abs(
            sum(
                (p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1])
                for i in range(len(p))
            )
            / 2
        )
    regions.sort(key=poly_area, reverse=True)
    return regions[:max_regions]


def detect_regions(
    image_path,
    min_area_ratio=0.005,
    max_regions=20,
    strategy="default",
    adaptive_block_size=11,
    adaptive_c=2,
    canny_low=50,
    canny_high=150,
    color_clusters=12,
    watershed_dist_ratio=0.5,
):
    """
    Detect large contiguous regions using OpenCV.
    strategy: "default" (cascade), "adaptive", "otsu", "canny", "color", "watershed"
    Returns list of polygons (each polygon is list of [x,y] points).
    """
    img = cv2.imread(image_path)
    if img is None:
        return None, None, None, "Could not read image"

    h, w = img.shape[:2]
    total_area = h * w
    min_area = int(total_area * min_area_ratio)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    regions = []

    if strategy == "adaptive":
        regions = _strategy_adaptive(
            gray, blurred, min_area, max_regions,
            block_size=adaptive_block_size, c=adaptive_c
        )
    elif strategy == "otsu":
        regions = _strategy_otsu(gray, blurred, min_area, max_regions)
    elif strategy == "canny":
        regions = _strategy_canny(
            gray, blurred, min_area, max_regions,
            low=canny_low, high=canny_high
        )
    elif strategy == "color":
        regions = _strategy_color(img, min_area, max_regions, n_clusters=color_clusters)
    elif strategy == "watershed":
        regions = _strategy_watershed(
            img, min_area, max_regions,
            dist_ratio=watershed_dist_ratio
        )
    else:
        # default: cascade through strategies
        regions = _strategy_adaptive(gray, blurred, min_area, max_regions)
        if not regions:
            regions = _strategy_otsu(gray, blurred, min_area, max_regions)
        if not regions:
            regions = _strategy_canny(gray, blurred, min_area, max_regions)
        if len(regions) <= 2:
            color_regions = _strategy_color(img, min_area, max_regions)
            if len(color_regions) > len(regions):
                regions = color_regions
        if not regions:
            regions = _fallback_center_regions(w, h, max_regions)

    return regions, w, h, None


def main():
    parser = argparse.ArgumentParser(description="Detect large regions in an image")
    parser.add_argument("image_path", help="Path to input image")
    parser.add_argument(
        "--min-area",
        type=float,
        default=0.005,
        help="Min region area as fraction of image (default 0.005)",
    )
    parser.add_argument(
        "--max-regions",
        type=int,
        default=20,
        help="Max number of regions to return (default 20)",
    )
    parser.add_argument(
        "--strategy",
        type=str,
        default="default",
        choices=["default", "adaptive", "otsu", "canny", "color", "watershed"],
        help="Region detection strategy (default: default)",
    )
    parser.add_argument("--adaptive-block-size", type=int, default=11, help="Adaptive: block size (odd 3-31)")
    parser.add_argument("--adaptive-c", type=int, default=2, help="Adaptive: C constant")
    parser.add_argument("--canny-low", type=int, default=50, help="Canny: low threshold")
    parser.add_argument("--canny-high", type=int, default=150, help="Canny: high threshold")
    parser.add_argument("--color-clusters", type=int, default=12, help="Color: K-means clusters (2-20)")
    parser.add_argument("--watershed-dist-ratio", type=float, default=0.5, help="Watershed: dist threshold ratio (0.1-0.9)")
    args = parser.parse_args()

    regions, width, height, err = detect_regions(
        args.image_path,
        min_area_ratio=args.min_area,
        max_regions=args.max_regions,
        strategy=args.strategy,
        adaptive_block_size=args.adaptive_block_size,
        adaptive_c=args.adaptive_c,
        canny_low=args.canny_low,
        canny_high=args.canny_high,
        color_clusters=args.color_clusters,
        watershed_dist_ratio=args.watershed_dist_ratio,
    )
    if err:
        print(json.dumps({"error": err}), file=sys.stderr)
        sys.exit(1)

    out = {"regions": regions, "width": width, "height": height}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
