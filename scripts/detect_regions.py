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


def _parse_template_box(s):
    """Parse 'x,y,w,h' string into (x, y, w, h) or None if missing/invalid."""
    if not s or not s.strip():
        return None
    parts = [p.strip() for p in s.split(",")]
    if len(parts) != 4:
        return None
    try:
        x, y, w, h = (int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]))
        if w <= 0 or h <= 0:
            return None
        return (x, y, w, h)
    except (ValueError, TypeError):
        return None


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


def _strategy_grabcut(img, min_area, max_regions, rect_pad=0.1, iter_count=5):
    """
    Strategy: GrabCut with auto rect (center 80% as foreground guess).
    Good for product shots, portraits, subject on plain background.
    """
    h, w = img.shape[:2]
    pad_x = int(w * rect_pad)
    pad_y = int(h * rect_pad)
    rect = (pad_x, pad_y, w - 2 * pad_x, h - 2 * pad_y)
    mask = np.zeros(img.shape[:2], np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(img, mask, rect, bgd_model, fgd_model, iter_count, cv2.GC_INIT_WITH_RECT)
    except Exception:
        return []
    fg_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    kernel = np.ones((3, 3), np.uint8)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return _contours_to_regions(contours, min_area, max_regions)


def _strategy_slic(img, min_area, max_regions, region_size=25, ruler=10.0):
    """
    Strategy: SLIC superpixels, merge by labels, take largest regions.
    Good for natural photos, gradients, textures. Requires opencv-contrib-python.
    """
    try:
        from cv2.ximgproc import createSuperpixelSLIC
    except ImportError:
        raise RuntimeError(
            "SLIC requires opencv-contrib-python. "
            "Run: pip install opencv-contrib-python (replaces opencv-python)"
        )
    h, w = img.shape[:2]
    region_size = max(10, min(100, int(region_size)))
    slic = createSuperpixelSLIC(img, region_size=int(region_size), ruler=float(ruler))
    slic.iterate(10)
    labels = slic.getLabels()
    regions = []
    unique_labels = np.unique(labels)
    for lab in unique_labels:
        mask = np.uint8(labels == lab)
        area = cv2.countNonZero(mask)
        if area < min_area:
            continue
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            a = cv2.contourArea(c)
            if a < min_area:
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


def _strategy_saliency(img, min_area, max_regions):
    """
    Strategy: Saliency detection (attention regions).
    Good for finding main subject in photos.
    """
    saliency = None
    try:
        saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
    except AttributeError:
        try:
            saliency = cv2.saliency.StaticSaliencyFineGrained_create()
        except AttributeError:
            return []
    success, saliency_map = saliency.computeSaliency(img)
    if not success or saliency_map is None:
        return []
    saliency_map = (saliency_map * 255).astype(np.uint8)
    _, thresh = cv2.threshold(saliency_map, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = np.ones((5, 5), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return _contours_to_regions(contours, min_area, max_regions)


def _strategy_meanshift(img, min_area, max_regions, spatial_radius=15, color_radius=40):
    """
    Strategy: Mean shift filtering then color segmentation.
    Good for gradients, skies, fabrics, soft boundaries.
    """
    spatial_radius = max(1, min(50, int(spatial_radius)))
    color_radius = max(1, min(100, int(color_radius)))
    shifted = cv2.pyrMeanShiftFiltering(img, spatial_radius, color_radius)
    lab = cv2.cvtColor(shifted, cv2.COLOR_BGR2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)
    n_clusters = min(12, max(4, (img.size // (300 * 300)) + 4))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, _ = cv2.kmeans(pixels, n_clusters, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
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


def _strategy_quadtree(img, min_area, max_regions, variance_threshold=500, min_quad_size=32):
    """
    Strategy: Recursive quadtree split by color variance.
    Good for flat designs, UI mockups, geometric layouts.
    """
    h, w = img.shape[:2]

    def _variance_rect(img_slice):
        if img_slice.size == 0:
            return 0
        gray = cv2.cvtColor(img_slice, cv2.COLOR_BGR2GRAY) if len(img_slice.shape) == 3 else img_slice
        return float(np.var(gray))

    def _split_quad(x, y, rw, rh, depth=0, max_depth=8):
        rect = (x, y, rw, rh)
        if rw < min_quad_size or rh < min_quad_size or depth >= max_depth:
            return [rect] if rw >= 2 and rh >= 2 else []
        crop = img[y : y + rh, x : x + rw]
        var = _variance_rect(crop)
        if var < variance_threshold:
            return [rect]
        hw, hh = rw // 2, rh // 2
        if hw < 2 or hh < 2:
            return [rect]
        quads = []
        for (qx, qy, qw, qh) in [
            (x, y, hw, hh),
            (x + hw, y, rw - hw, hh),
            (x, y + hh, hw, rh - hh),
            (x + hw, y + hh, rw - hw, rh - hh),
        ]:
            quads.extend(_split_quad(qx, qy, qw, qh, depth + 1, max_depth))
        return quads

    rects = _split_quad(0, 0, w, h)
    regions = []
    for (qx, qy, qw, qh) in rects:
        area = qw * qh
        if area < min_area:
            continue
        poly = [[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]]
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


def _circle_to_polygon(cx, cy, radius, num_points=24):
    """Convert circle (cx, cy, radius) to polygon vertices."""
    pts = []
    for i in range(num_points):
        angle = 2 * np.pi * i / num_points
        x = cx + radius * np.cos(angle)
        y = cy + radius * np.sin(angle)
        pts.append([int(round(x)), int(round(y))])
    return pts


def _strategy_circles(img, min_area, max_regions, min_radius_ratio=0.02, max_radius_ratio=0.45,
                      param1=80, param2=35, min_dist_ratio=0.07):
    """
    Strategy: Detect circles via Hough transform.
    Good for round shapes, buttons, coins, eyes, etc.
    param1: Canny edge high threshold (higher = stronger edges only). Try 50-200.
    param2: Accumulator threshold (lower = more circles, more false positives). Try 20-80.
    min_dist_ratio: Min distance between circle centers as fraction of min image dimension (e.g. 0.07 = 7%). Set to 0 for auto (2*max_r).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 1.5)
    h, w = img.shape[:2]
    min_dim = min(w, h)
    min_r = max(5, int(min_dim * min_radius_ratio))
    max_r = min(min_dim // 2, int(min_dim * max_radius_ratio))
    if max_r <= min_r:
        max_r = min_r + 10
    if min_dist_ratio and min_dist_ratio > 0:
        min_dist = max(min_r * 2, int(min_dim * min_dist_ratio))
    else:
        min_dist = max(min_r * 2, int(2 * max_r))
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=min_dist,
        param1=int(param1),
        param2=int(param2),
        minRadius=min_r,
        maxRadius=max_r,
    )
    regions = []
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for c in circles[0, :]:
            cx, cy, r = int(c[0]), int(c[1]), int(c[2])
            area = np.pi * r * r
            if area < min_area:
                continue
            poly = _circle_to_polygon(cx, cy, r)
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


def _strategy_contour_circles(img, min_area, max_regions, min_radius_ratio=0.02, max_radius_ratio=0.45,
                              circularity_min=0.75):
    """
    Strategy: Find circle-like regions by contour circularity (no Hough).
    Threshold to get blobs, then keep contours with high circularity (4*pi*area/perim^2).
    Often more reliable than Hough for clear circles on flat background (e.g. color swatches).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 1.5)
    h, w = img.shape[:2]
    min_dim = min(w, h)
    min_r = max(5, int(min_dim * min_radius_ratio))
    max_r = min(min_dim // 2, int(min_dim * max_radius_ratio))
    if max_r <= min_r:
        max_r = min_r + 10
    # Otsu: usually separates dark background from lighter circles
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Also try inverted in case circles are darker than background
    _, thresh_inv = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    regions = []
    seen_centers = []  # avoid duplicate from both thresh and thresh_inv
    for binary in (thresh, thresh_inv):
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area:
                continue
            peri = cv2.arcLength(c, True)
            if peri < 1e-6:
                continue
            circularity = 4 * np.pi * area / (peri * peri)
            if circularity < circularity_min:
                continue
            equiv_r = np.sqrt(area / np.pi)
            if equiv_r < min_r or equiv_r > max_r:
                continue
            (cx, cy), r = cv2.minEnclosingCircle(c)
            cx, cy, r = int(cx), int(cy), int(round(r))
            # skip if we already have a circle with center very close (from other binary)
            if any(abs(cx - scx) < min_r and abs(cy - scy) < min_r for scx, scy in seen_centers):
                continue
            seen_centers.append((cx, cy))
            poly = _circle_to_polygon(cx, cy, r)
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


def _local_maxima_2d(result_map, threshold, min_dist_px):
    """Return list of (x, y) top-left positions of local maxima above threshold, at least min_dist_px apart."""
    h, w = result_map.shape[:2]
    peaks = []
    while True:
        _, max_val, _, max_loc = cv2.minMaxLoc(result_map)
        if max_val < threshold:
            break
        x, y = max_loc[0], max_loc[1]
        peaks.append((x, y))
        # suppress neighborhood
        y1 = max(0, y - min_dist_px)
        y2 = min(h, y + min_dist_px + 1)
        x1 = max(0, x - min_dist_px)
        x2 = min(w, x + min_dist_px + 1)
        result_map[y1:y2, x1:x2] = -1
    return peaks


def _polygon_centroid(poly):
    """Return (cx, cy) centroid of polygon."""
    n = len(poly)
    if n == 0:
        return 0, 0
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    return cx, cy


def _translate_polygon(poly, dx, dy):
    """Return new polygon with all points shifted by (dx, dy)."""
    return [[int(p[0] + dx), int(p[1] + dy)] for p in poly]


def _gradient_magnitude(img):
    """Single-channel gradient magnitude (invariant to brightness). Input BGR or gray."""
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy)
    return np.uint8(np.clip(mag, 0, 255))


def _strategy_template_match(img, min_area, max_regions, min_radius_ratio=0.02, max_radius_ratio=0.45,
                             contour_circles_circularity=0.75, match_threshold=0.7, min_dist_ratio=0.8,
                             template_box=None):
    """
    Strategy: Use one detected region as a template, find similar regions via normalized cross-correlation.
    If template_box (x, y, w, h) is provided, use that crop as the template; otherwise run contour_circles probe.
    """
    h, w = img.shape[:2]
    if template_box is not None:
        x, y, tw, th = template_box
        x = max(0, min(int(x), w - 1))
        y = max(0, min(int(y), h - 1))
        tw = max(5, min(int(tw), w - x))
        th = max(5, min(int(th), h - y))
        template_crop = img[y : y + th, x : x + tw]
        tc_h, tc_w = template_crop.shape[:2]
        # Gradient magnitude: matches structure/edges, invariant to brightness (treats dark and bright equally)
        img_grad = _gradient_magnitude(img)
        template_grad = _gradient_magnitude(template_crop)
        result = cv2.matchTemplate(img_grad, template_grad, cv2.TM_CCOEFF_NORMED)
        min_dist_px = int(max(tc_w, tc_h) * min_dist_ratio)
        min_dist_px = max(2, min_dist_px)
        peaks = _local_maxima_2d(result.copy(), match_threshold, min_dist_px)
        template_poly = [[x, y], [x + tc_w, y], [x + tc_w, y + tc_h], [x, y + tc_h]]
        poly_cx, poly_cy = _polygon_centroid(template_poly)
        regions = []
        for (px, py) in peaks:
            match_center_x = px + tc_w / 2
            match_center_y = py + tc_h / 2
            dx = match_center_x - poly_cx
            dy = match_center_y - poly_cy
            translated = _translate_polygon(template_poly, dx, dy)
            regions.append(translated)
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

    min_dim = min(w, h)
    min_area_probe = int(min_dim * min_dim * 0.002)  # loose area for probe
    # Get one sample region using contour_circles
    probe_regions = _strategy_contour_circles(
        img, min_area_probe, max_regions=1,
        min_radius_ratio=min_radius_ratio,
        max_radius_ratio=max_radius_ratio,
        circularity_min=contour_circles_circularity,
    )
    if not probe_regions:
        # fallback: try Hough to get one circle
        probe_regions = _strategy_circles(
            img, min_area_probe, max_regions=1,
            min_radius_ratio=min_radius_ratio,
            max_radius_ratio=max_radius_ratio,
            param1=80, param2=35, min_dist_ratio=0.07,
        )
    if not probe_regions:
        return []
    template_poly = probe_regions[0]
    # Bounding rect of template region
    xs = [p[0] for p in template_poly]
    ys = [p[1] for p in template_poly]
    x1, x2 = max(0, min(xs) - 2), min(w, max(xs) + 3)
    y1, y2 = max(0, min(ys) - 2), min(h, max(ys) + 3)
    tw, th = x2 - x1, y2 - y1
    if tw < 5 or th < 5:
        return [template_poly][:max_regions]
    template_crop = img[y1:y2, x1:x2]
    tc_h, tc_w = template_crop.shape[:2]
    # Gradient magnitude: matches structure/edges, invariant to brightness
    img_grad = _gradient_magnitude(img)
    template_grad = _gradient_magnitude(template_crop)
    result = cv2.matchTemplate(img_grad, template_grad, cv2.TM_CCOEFF_NORMED)
    min_dist_px = int(max(tc_w, tc_h) * min_dist_ratio)
    min_dist_px = max(2, min_dist_px)
    peaks = _local_maxima_2d(result.copy(), match_threshold, min_dist_px)
    # Template centroid in template coords (relative to crop top-left)
    poly_cx, poly_cy = _polygon_centroid(template_poly)
    # Match result is top-left of template; center of match is (px + tc_w/2, py + tc_h/2)
    regions = []
    for (px, py) in peaks:
        # Place template polygon so its centroid is at match center
        match_center_x = px + tc_w / 2
        match_center_y = py + tc_h / 2
        dx = match_center_x - poly_cx
        dy = match_center_y - poly_cy
        translated = _translate_polygon(template_poly, dx, dy)
        regions.append(translated)
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


def _strategy_rectangles(img, min_area, max_regions, epsilon_ratio=0.05):
    """
    Strategy: Detect rectangular contours (4-vertex approx).
    Good for panels, windows, screens, documents, UI elements.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    regions = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        peri = cv2.arcLength(c, True)
        eps = max(2, peri * epsilon_ratio)
        approx = cv2.approxPolyDP(c, eps, True)
        if len(approx) != 4:
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
    grabcut_rect_pad=0.1,
    grabcut_iter_count=5,
    slic_region_size=25,
    slic_ruler=10.0,
    meanshift_spatial=15,
    meanshift_color=40,
    quadtree_variance=500,
    quadtree_min_size=32,
    circles_min_radius_ratio=0.02,
    circles_max_radius_ratio=0.45,
    circles_param1=80,
    circles_param2=35,
    circles_min_dist_ratio=0.07,
    contour_circles_circularity=0.75,
    template_match_threshold=0.7,
    template_match_min_dist_ratio=0.8,
    rectangles_epsilon_ratio=0.05,
    template_box=None,
):
    """
    Detect large contiguous regions using OpenCV.
    strategy: "default", "adaptive", "otsu", "canny", "color", "watershed",
              "grabcut", "slic", "saliency", "meanshift", "quadtree", "circles", "rectangles"
    Returns (regions, w, h, err).
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
    elif strategy == "grabcut":
        regions = _strategy_grabcut(
            img, min_area, max_regions,
            rect_pad=grabcut_rect_pad, iter_count=grabcut_iter_count
        )
    elif strategy == "slic":
        try:
            regions = _strategy_slic(
                img, min_area, max_regions,
                region_size=slic_region_size, ruler=slic_ruler
            )
        except RuntimeError as e:
            return None, w, h, str(e)
    elif strategy == "saliency":
        regions = _strategy_saliency(img, min_area, max_regions)
    elif strategy == "meanshift":
        regions = _strategy_meanshift(
            img, min_area, max_regions,
            spatial_radius=meanshift_spatial, color_radius=meanshift_color
        )
    elif strategy == "quadtree":
        regions = _strategy_quadtree(
            img, min_area, max_regions,
            variance_threshold=quadtree_variance, min_quad_size=quadtree_min_size
        )
    elif strategy == "circles":
        regions = _strategy_circles(
            img, min_area, max_regions,
            min_radius_ratio=circles_min_radius_ratio,
            max_radius_ratio=circles_max_radius_ratio,
            param1=circles_param1,
            param2=circles_param2,
            min_dist_ratio=circles_min_dist_ratio,
        )
    elif strategy == "rectangles":
        regions = _strategy_rectangles(
            img, min_area, max_regions,
            epsilon_ratio=rectangles_epsilon_ratio,
        )
    elif strategy == "contour_circles":
        regions = _strategy_contour_circles(
            img, min_area, max_regions,
            min_radius_ratio=circles_min_radius_ratio,
            max_radius_ratio=circles_max_radius_ratio,
            circularity_min=contour_circles_circularity,
        )
    elif strategy == "template_match":
        regions = _strategy_template_match(
            img, min_area, max_regions,
            min_radius_ratio=circles_min_radius_ratio,
            max_radius_ratio=circles_max_radius_ratio,
            contour_circles_circularity=contour_circles_circularity,
            match_threshold=template_match_threshold,
            min_dist_ratio=template_match_min_dist_ratio,
            template_box=template_box,
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
        choices=[
            "default", "adaptive", "otsu", "canny", "color", "watershed",
            "grabcut", "slic", "saliency", "meanshift", "quadtree", "circles", "rectangles", "contour_circles", "template_match",
        ],
        help="Region detection strategy (default: default)",
    )
    parser.add_argument("--adaptive-block-size", type=int, default=11, help="Adaptive: block size (odd 3-31)")
    parser.add_argument("--adaptive-c", type=int, default=2, help="Adaptive: C constant")
    parser.add_argument("--canny-low", type=int, default=50, help="Canny: low threshold")
    parser.add_argument("--canny-high", type=int, default=150, help="Canny: high threshold")
    parser.add_argument("--color-clusters", type=int, default=12, help="Color: K-means clusters (2-20)")
    parser.add_argument("--watershed-dist-ratio", type=float, default=0.5, help="Watershed: dist threshold ratio (0.1-0.9)")
    parser.add_argument("--grabcut-rect-pad", type=float, default=0.1, help="GrabCut: rect padding (0.05-0.3)")
    parser.add_argument("--grabcut-iter-count", type=int, default=5, help="GrabCut: iterations (3-10)")
    parser.add_argument("--slic-region-size", type=int, default=25, help="SLIC: region size (10-100)")
    parser.add_argument("--slic-ruler", type=float, default=10.0, help="SLIC: ruler/compactness (5-40)")
    parser.add_argument("--meanshift-spatial", type=int, default=15, help="Mean shift: spatial radius (1-50)")
    parser.add_argument("--meanshift-color", type=int, default=40, help="Mean shift: color radius (1-100)")
    parser.add_argument("--quadtree-variance", type=float, default=500, help="Quadtree: variance threshold (100-2000)")
    parser.add_argument("--quadtree-min-size", type=int, default=32, help="Quadtree: min quad size (16-64)")
    parser.add_argument("--circles-min-radius-ratio", type=float, default=0.02, help="Circles: min radius as fraction of min dimension (0.01-0.2)")
    parser.add_argument("--circles-max-radius-ratio", type=float, default=0.45, help="Circles: max radius as fraction of min dimension (0.1-0.5)")
    parser.add_argument("--circles-param1", type=int, default=80, help="Circles: Canny high threshold (50-200)")
    parser.add_argument("--circles-param2", type=int, default=35, help="Circles: accumulator threshold (20-100, lower=more circles)")
    parser.add_argument("--circles-min-dist-ratio", type=float, default=0.07, help="Circles: min center distance as fraction of min dimension (0.05-0.15)")
    parser.add_argument("--contour-circles-circularity", type=float, default=0.75, help="Contour circles: min circularity 4*pi*area/perim^2 (0.6-0.95)")
    parser.add_argument("--template-match-threshold", type=float, default=0.7, help="Template match: min correlation (0.5-0.95)")
    parser.add_argument("--template-match-min-dist-ratio", type=float, default=0.8, help="Template match: min distance between matches as fraction of template size (0.5-1.0)")
    parser.add_argument("--template-box", type=str, default=None, help="Template match: x,y,w,h for user-drawn template region (e.g. 10,20,40,40)")
    parser.add_argument("--rectangles-epsilon-ratio", type=float, default=0.05, help="Rectangles: contour approx epsilon as fraction of perimeter (0.02-0.15)")
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
        grabcut_rect_pad=args.grabcut_rect_pad,
        grabcut_iter_count=args.grabcut_iter_count,
        slic_region_size=args.slic_region_size,
        slic_ruler=args.slic_ruler,
        meanshift_spatial=args.meanshift_spatial,
        meanshift_color=args.meanshift_color,
        quadtree_variance=args.quadtree_variance,
        quadtree_min_size=args.quadtree_min_size,
        circles_min_radius_ratio=args.circles_min_radius_ratio,
        circles_max_radius_ratio=args.circles_max_radius_ratio,
        circles_param1=args.circles_param1,
        circles_param2=args.circles_param2,
        circles_min_dist_ratio=args.circles_min_dist_ratio,
        contour_circles_circularity=args.contour_circles_circularity,
        template_match_threshold=args.template_match_threshold,
        template_match_min_dist_ratio=args.template_match_min_dist_ratio,
        rectangles_epsilon_ratio=args.rectangles_epsilon_ratio,
        template_box=_parse_template_box(args.template_box),
    )
    if err:
        print(json.dumps({"error": err}), file=sys.stderr)
        sys.exit(1)

    out = {"regions": regions, "width": width, "height": height}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
