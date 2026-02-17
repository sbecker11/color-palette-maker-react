# Future Work

Prioritized improvement backlog from code review. Use this as a guide for future work.

---

## Outstanding Tasks (summary)

- **Architecture:** Reduce PaletteDisplay props (18 → context or fewer objects); optional useReducer for palette/sampling state; add code comment for polygonCentroid duplication (server + client).
- **Testing:** Express route tests (supertest); API integration tests; E2E tests (Playwright/Cypress); Vitest coverage thresholds; Docker build in CI.
- **Server / Code Quality:** Review and document metadata_handler concurrency/race condition.
- **CI/CD:** Add `docker-compose.yml` for local dev.
- **Migrations:** Single-User SPA → Docker Compose; Multi-User SaaS → Kubernetes (see sections below).

---

## Architecture

- **Reduce PaletteDisplay props** — currently 18; group into context or fewer objects to reduce prop-drilling.
- **Optional: useReducer for palette/sampling** — `isSamplingMode`, `currentSampledColor`, `paletteGenerating` could be grouped in a second reducer (regions reducer is already in place).
- **polygonCentroid duplication**: Exists in both `image_processor.js` (server) and `imageViewerGeometry.js` (client); add a short code comment in each file noting the duplication so future changes keep both in sync.

---

## Testing

- **Express route tests** (supertest): Mock handlers and test GET /api/images, POST /upload, palette/regions endpoints. Validate status codes, error handling, filename validation (path traversal).
- **API integration tests**: Start real server with temp `uploads` dir; hit routes and assert persisted metadata.
- **E2E tests** (Playwright/Cypress): Upload image → generate palette → export JSON.
- **Coverage thresholds**: Add Vitest coverage thresholds (e.g. 80% statements); fail CI when coverage drops.
- **Docker build in CI**: Add `docker build` step to `.github/workflows/ci.yml`.

---

## Server / Code Quality

- **metadata_handler race condition**: Review and address concurrent read/rewrite; document concurrency behavior in code (and in DEVELOPMENT.md if relevant).

---

## CI/CD

- Add `docker-compose.yml` for local dev with Python/OpenCV. (`.github/workflows/ci.yml`, `.env.example`, and `Dockerfile` are in place.)

---

## Single-User SPA → Docker Compose

Migrate the SPA to a multi-service Docker Compose deployment: React frontend (nginx), Express backend, and Python image-processor as separate containers on a shared network. Backend calls image-processor over HTTP instead of spawning a subprocess.

**Highlights:**
- Frontend: nginx serves built SPA; proxies `/api`, `/upload`, `/uploads` to backend.
- Backend: Node-only; uses `IMAGE_PROCESSOR_URL` to call image-processor HTTP service.
- Image-processor: Flask wrapper around `detect_regions.py`; reads from shared `uploads/` volume.
- Shared volume for uploads; backward compatibility with subprocess when `IMAGE_PROCESSOR_URL` not set.

See [Single-User-SPA-DockerCompose-migration.md](Single-User-SPA-DockerCompose-migration.md) for implementation steps and file changes.

---

## Multi-User SaaS → Kubernetes

Migrate to a multi-user SaaS on Kubernetes: add auth, PostgreSQL, object storage (S3/GCS), and multi-tenancy. Stateless backend and image-processor; horizontal scaling via HPA.

**Highlights:**
- Auth (JWT/sessions), sign-up/login, protected routes.
- Replace `image_metadata.jsonl` with PostgreSQL; replace `uploads/` with S3/GCS.
- Per-user data isolation; rate limits; quotas.
- K8s manifests: deployments, services, ingress (TLS), ConfigMaps, Secrets, HPA for backend and image-processor.

See [Multi-User-SaaS-Kubernetes-migration.md](Multi-User-SaaS-Kubernetes-migration.md) for prerequisites, implementation order, and manifest summary.
