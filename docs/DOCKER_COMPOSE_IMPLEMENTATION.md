# Docker Compose Multi-Service Implementation Outline

This document outlines the concrete steps and file changes to split the app into three services (frontend, backend, image-processor) on a shared Docker Compose network.

---

## Target Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  frontend   │────▶│   backend   │────▶│ image-processor  │
│  (nginx)    │     │  (Express)  │     │ (Python/Flask)   │
│  port 80    │     │  port 3000  │     │  port 5000       │
└─────────────┘     └──────┬──────┘     └────────┬─────────┘
       │                   │                     │
       └───────────────────┴─────────────────────┘
                    shared volumes:
                    - uploads
                    - metadata (or backend-only)
```

- **frontend**: Serves built React app; proxies `/api`, `/upload`, `/uploads` to backend.
- **backend**: Express API; calls image-processor over HTTP instead of spawning Python.
- **image-processor**: Flask HTTP service wrapping `detect_regions.py`; reads images from shared `uploads/` volume.

---

## Pros and Cons

### Pros

- **Separation of concerns**: Python/OpenCV runs in its own container; backend stays Node-only. Easier to reason about dependencies and security.
- **Independent scaling**: Can scale the image-processor service separately if region detection becomes a bottleneck.
- **Proof of concept**: Demonstrates multi-service orchestration, shared networks, and volumes—useful for portfolios or architectural discussions.
- **Reusability**: The image-processor HTTP API could be called by other services or tools.
- **Technology isolation**: Python and Node dependencies stay in separate images; no single image with both runtimes.
- **Clearer failure boundaries**: If the image-processor fails, the backend can handle errors and return a structured response.

### Cons

- **Increased complexity**: More containers, networking, and configuration. Harder to debug (logs across services).
- **Network latency**: HTTP calls between backend and image-processor add a few milliseconds vs. in-process subprocess. Usually negligible for this workload.
- **Operational overhead**: More services to build, deploy, monitor, and keep in sync.
- **Shared storage**: Requires careful volume design so both backend and image-processor see the same files. Path mismatches can cause subtle bugs.
- **Overkill for current scale**: The app processes one image at a time interactively. A single container with subprocess is simpler and sufficient for many use cases.
- **Dual code paths**: Backend must support both HTTP (compose) and subprocess (local dev), or you accept different behavior in different environments.

### When This Approach Makes Sense

- Learning or demonstrating multi-service architecture.
- Anticipating batch or higher-throughput region detection.
- Running in an environment that already uses Docker Compose or orchestration.
- Need to scale or version the image processor independently.

### When to Stick with the Monolith

- Low traffic and simple deployment needs.
- Prioritizing simplicity and fast iteration.
- Single developer or small team with limited DevOps experience.

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

- Import `detect_regions` from the existing script (or copy the logic). The current `detect_regions.py` is CLI-only; either:
  - **Option A**: Add an HTTP wrapper that imports `detect_regions` and calls it with a path.
  - **Option B**: Move `scripts/detect_regions.py` into `image-processor/` and import it.
- Endpoint: `POST /detect-regions`
  - Body: `{ "imagePath": "/app/uploads/img-123.jpeg" }` or `{ "filename": "img-123.jpeg" }`
  - Response: `{ "regions": [...], "width": N, "height": N }`
- `UPLOADS_DIR` env var (e.g. `/app/uploads`) for path construction.
- Run with `flask run` or `gunicorn` on port 5000.

### 1.4 `image-processor/Dockerfile`

- Base: `python:3.11-slim`
- Install `requirements.txt` (opencv-python, numpy, flask)
- Copy `app.py` and `detect_regions` module (from project root or copied in)
- `EXPOSE 5000`
- `CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]`

---

## Step 2: Modify Backend to Call Image Processor via HTTP

### 2.1 `server.js` changes

- Add config: `const IMAGE_PROCESSOR_URL = process.env.IMAGE_PROCESSOR_URL || 'http://localhost:5000';`
- Replace the `spawn()` block in `POST /api/regions/:filename` with an HTTP call:

```javascript
const imagePath = path.join(uploadsDir, filename);
const response = await axios.post(`${IMAGE_PROCESSOR_URL}/detect-regions`, 
  { imagePath }  // or { filename }, depending on API design
);
const result = response.data;
```

- Keep validation (filename, file exists) before the call.
- Remove `getRegionDetectionPython()` and Python-related logic when `IMAGE_PROCESSOR_URL` is set (or always use HTTP in compose mode).

### 2.2 Backend Dockerfile changes

- Remove Python, pip, requirements.txt, and `detect_regions.py` from the backend image.
- Backend becomes Node-only.
- Add `axios` if not already present (already in package.json).

### 2.3 Environment

- Add `IMAGE_PROCESSOR_URL=http://image-processor:5000` for Docker Compose.
- In local dev without compose, `IMAGE_PROCESSOR_URL=http://localhost:5000` (or run image-processor locally).

---

## Step 3: Frontend Service (nginx)

### 3.1 New directory and files

```
client/Dockerfile  # or frontend/Dockerfile at root
```

### 3.2 `client/Dockerfile` (or `docker/frontend.Dockerfile`)

- Multi-stage:
  - Stage 1: `node:20` — `npm run build` to produce `client/dist`
  - Stage 2: `nginx:alpine` — copy `client/dist` to `/usr/share/nginx/html`
- Add nginx config to proxy:
  - `/api` → `http://backend:3000`
  - `/upload` → `http://backend:3000`
  - `/uploads` → `http://backend:3000`
- `EXPOSE 80`

### 3.3 nginx config

Create `client/nginx.conf` (or `docker/nginx.conf`):

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api { proxy_pass http://backend:3000; proxy_http_version 1.1; proxy_set_header Host $host; }
    location /upload { proxy_pass http://backend:3000; proxy_http_version 1.1; proxy_set_header Host $host; }
    location /uploads { proxy_pass http://backend:3000; proxy_http_version 1.1; proxy_set_header Host $host; }
}
```

---

## Step 4: Docker Compose

### 4.1 `docker-compose.yml` (project root)

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
    # Metadata: backend writes to /app/image_metadata.jsonl - persist if desired
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

### 4.2 Backend Dockerfile (revised)

- Remove Python/OpenCV installation.
- Keep Node, npm, client build.
- After build, backend serves `client/dist` for backwards compatibility when run standalone, but in compose the frontend serves it. **Alternative**: In compose, backend does not serve static files; only frontend does. Then backend Dockerfile can skip the React build and only build/runs the API. For that, you'd need a separate `Dockerfile.backend` or build args.

**Simpler approach**: Keep backend as the only server that builds and serves the React app (current behavior). Then we have 2 services in compose: backend + image-processor. Frontend is served by backend. Add a 3rd “frontend” service later if you want nginx in front.

**Recommended for PoC**: Start with 2 services (backend + image-processor). Add frontend nginx as a 3rd service as an optional enhancement.

---

## Step 5: Shared Volume and Paths

- Backend writes uploads to `uploadsDir` (e.g. `/app/uploads`).
- Image-processor must read from the same path. Use a named volume `uploads_data` mounted at `/app/uploads` in both.
- Metadata (`image_metadata.jsonl`): backend writes to project root. Either:
  - Mount a volume for the backend app root, or
  - Accept that metadata is ephemeral in containers (fine for PoC).

---

## Step 6: Backward Compatibility

- When `IMAGE_PROCESSOR_URL` is not set, fall back to spawning the Python subprocess (current behavior) so `npm run dev` and standalone Docker still work.
- When `IMAGE_PROCESSOR_URL` is set (compose), use HTTP only.

---

## File Change Summary

| Action | File |
|--------|------|
| CREATE | `image-processor/Dockerfile` |
| CREATE | `image-processor/requirements.txt` |
| CREATE | `image-processor/app.py` (Flask app calling detect_regions) |
| MODIFY | `server.js` — add HTTP client path when `IMAGE_PROCESSOR_URL` set |
| MODIFY | `Dockerfile` (root) — remove Python when used as backend-only in compose |
| CREATE | `docker-compose.yml` |
| CREATE | `client/Dockerfile` + `client/nginx.conf` (optional, for 3-service setup) |
| UPDATE | `.env.example` — add `IMAGE_PROCESSOR_URL` |
| UPDATE | `README.md` — add Docker Compose section |

---

## Implementation Order

1. Create `image-processor/` service and Dockerfile.
2. Add Flask `app.py` that wraps `detect_regions` and exposes `POST /detect-regions`.
3. Update `server.js` to use HTTP when `IMAGE_PROCESSOR_URL` is set.
4. Add `docker-compose.yml` with backend + image-processor.
5. Test: `docker-compose up --build`, then hit backend at localhost:3000.
6. (Optional) Add frontend nginx service and client Dockerfile for a 3-service setup.
