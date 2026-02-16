# Single-User SPA Docker Compose Migration

This document outlines the concrete steps and file changes to migrate the Color Palette Maker SPA to a multi-service Docker Compose deployment: a React frontend, Express backend, and Python image-processor on a shared network.

---

## Context: SPA Architecture

The app is a React single-page application (SPA) with:
- **Frontend**: React + Vite; built static assets served in production.
- **Backend**: Express API; serves the built SPA and handles uploads, metadata, palette generation.
- **Image processing**: Python/OpenCV subprocess for region detection; invoked by the backend.

This migration splits the Python image processor into a separate service so the SPA can run as distinct frontend, backend, and image-processor containers.

---

## Target Architecture

```
┌─────────────────────┐     ┌─────────────┐     ┌──────────────────┐
│  SPA frontend       │────▶│   backend   │────▶│ image-processor  │
│  (React via nginx)  │     │  (Express)  │     │ (Python/Flask)   │
│  port 80            │     │  port 3000  │     │  port 5000       │
└─────────────────────┘     └──────┬──────┘     └────────┬─────────┘
          │                        │                     │
          └────────────────────────┴─────────────────────┘
                    shared volumes:
                    - uploads (for SPA-uploaded images)
```

- **Frontend**: Serves the built React SPA; proxies `/api`, `/upload`, `/uploads` to backend.
- **Backend**: Express API; calls image-processor over HTTP instead of spawning Python.
- **Image-processor**: Flask HTTP service wrapping `detect_regions.py`; reads images from shared `uploads/` volume.

---

## Pros and Cons

### Pros

- **SPA-friendly**: Clear separation of static SPA assets (frontend) from API (backend) and CV (image-processor).
- **Separation of concerns**: Python/OpenCV isolated; backend stays Node-only.
- **Independent scaling**: Image-processor can be scaled separately if region detection becomes a bottleneck.
- **Proof of concept**: Demonstrates multi-service orchestration for an SPA—useful for portfolios.
- **Technology isolation**: Node and Python dependencies in separate images.

### Cons

- **Added complexity**: More containers and networking; harder to debug.
- **Overkill for current scale**: Single-user SPA with interactive, one-at-a-time processing.
- **Dual code paths**: Backend must support HTTP (compose) and subprocess (local dev) for image processing.
- **Shared storage**: Volume design must ensure backend and image-processor see the same uploads.

### When This Approach Makes Sense for an SPA

- Learning or demonstrating multi-service deployment for a React SPA.
- Preparing for future scaling or SaaS migration.
- Running in an environment that already uses Docker Compose.

### When to Stick with the Monolith

- Simple deployment; single developer; low traffic.
- SPA served by Express in one container is sufficient.

---

## Step 1: Create Python HTTP Service

### 1.1 New directory and files

```
image-processor/
├── Dockerfile
├── requirements.txt
└── app.py
```

### 1.2 `image-processor/requirements.txt`

```
flask>=3.0.0
opencv-python>=4.8.0
numpy>=1.24.0
```

### 1.3 `image-processor/app.py`

- HTTP wrapper that imports/calls `detect_regions` with an image path.
- Endpoint: `POST /detect-regions` — body `{ "imagePath": "/app/uploads/img-123.jpeg" }` or `{ "filename": "img-123.jpeg" }`.
- Response: `{ "regions": [...], "width": N, "height": N }`.
- `UPLOADS_DIR` env var for path construction.

### 1.4 `image-processor/Dockerfile`

- Base: `python:3.11-slim`
- Install requirements; copy `app.py` and `detect_regions` module.
- `EXPOSE 5000`

---

## Step 2: Modify Backend to Call Image Processor via HTTP

### 2.1 `server.js` changes

- Add: `const IMAGE_PROCESSOR_URL = process.env.IMAGE_PROCESSOR_URL || 'http://localhost:5000';`
- Replace the `spawn()` block in `POST /api/regions/:filename` with an HTTP POST to `${IMAGE_PROCESSOR_URL}/detect-regions`.

### 2.2 Backend Dockerfile

- Remove Python/OpenCV when used as backend-only in compose.
- Backend becomes Node-only for the API.

### 2.3 Environment

- Docker Compose: `IMAGE_PROCESSOR_URL=http://image-processor:5000`.
- Local dev: `IMAGE_PROCESSOR_URL=http://localhost:5000` or keep subprocess fallback.

---

## Step 3: Frontend Service (SPA)

### 3.1 `client/Dockerfile`

- Multi-stage: Node build → nginx serving `client/dist`.
- nginx proxies `/api`, `/upload`, `/uploads` to `http://backend:3000`.
- SPA routing: `try_files $uri $uri/ /index.html` for client-side routes.

### 3.2 nginx config

- Serve static files from `/usr/share/nginx/html`.
- Proxy API paths to backend.
- `EXPOSE 80`

---

## Step 4: Docker Compose

### 4.1 `docker-compose.yml`

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: client/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      IMAGE_PROCESSOR_URL: http://image-processor:5000
      PORT: 3000
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      - image-processor
    networks:
      - app-network

  image-processor:
    build:
      context: .
      dockerfile: image-processor/Dockerfile
    environment:
      UPLOADS_DIR: /app/uploads
    volumes:
      - uploads_data:/app/uploads
    networks:
      - app-network

volumes:
  uploads_data:

networks:
  app-network:
    driver: bridge
```

**Simpler option**: Start with 2 services (backend + image-processor). Backend serves the built SPA. Add frontend nginx as a 3rd service later.

---

## Step 5: Shared Volume and Paths

- Backend writes SPA uploads to `uploadsDir` (e.g. `/app/uploads`).
- Image-processor reads from the same path via shared volume `uploads_data`.
- Metadata: backend writes to project root; persist via volume or accept ephemeral for PoC.

---

## Step 6: Backward Compatibility

- When `IMAGE_PROCESSOR_URL` is not set, fall back to spawning the Python subprocess.
- `npm run dev` and standalone Docker continue to work.

---

## File Change Summary

| Action | File |
|--------|------|
| CREATE | `image-processor/Dockerfile` |
| CREATE | `image-processor/requirements.txt` |
| CREATE | `image-processor/app.py` |
| MODIFY | `server.js` — HTTP client when `IMAGE_PROCESSOR_URL` set |
| MODIFY | `Dockerfile` (root) — backend-only in compose mode |
| CREATE | `docker-compose.yml` |
| CREATE | `client/Dockerfile` + `client/nginx.conf` (optional) |
| UPDATE | `.env.example` — `IMAGE_PROCESSOR_URL` |
| UPDATE | `README.md` — Docker Compose section |

---

## Implementation Order

1. Create `image-processor/` service and Dockerfile.
2. Add Flask `app.py` wrapping `detect_regions`; expose `POST /detect-regions`.
3. Update `server.js` to use HTTP when `IMAGE_PROCESSOR_URL` is set.
4. Add `docker-compose.yml` with backend + image-processor.
5. Test: `docker-compose up --build`; access SPA at localhost:3000 (or 80 if frontend service added).
6. (Optional) Add frontend nginx service for 3-service SPA deployment.
