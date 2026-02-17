# Action Items

Improvement backlog from code review. Use this as a prioritized list for future work.

---

## CI/CD

- Add `docker-compose.yml` for local dev with Python/OpenCV. (`.github/workflows/ci.yml`, `.env.example`, and `Dockerfile` are in place.)

---

## Testing (Higher-Effort)

- **Express route tests** (supertest): Mock handlers and test GET /api/images, POST /upload, palette/regions endpoints. Validates status codes, error handling, and filename validation (path traversal).
- **API integration tests**: Start the real server with a temp `uploads` dir; hit routes and assert persisted metadata. Catches integration bugs without full E2E.
- **E2E tests** (Playwright/Cypress): Upload image → generate palette → export JSON. Ensures critical user flows work end-to-end.
- **Coverage thresholds**: Add Vitest coverage thresholds (e.g. 80% statements); fail CI when coverage drops.
- **Docker build in CI**: Add `docker build` step to ensure the image builds on every commit.

---

## Architecture

- Refactor App.jsx (useReducer or context) to reduce useState and prop-drilling; reduce PaletteDisplay props.

---

## Server / Code Quality

- Remove dead code in `image_processor.js`
- DRY filename validation (middleware or `validateFilename()`)
- Review `metadata_handler` race condition on concurrent read/rewrite

---

## Documentation

- Document `metadata_handler` concurrency in code

---

## Media / Repo Size

- The `media/` directory includes a ~20MB `.mov` file tracked in git, which bloats clones. Consider moving to GitHub Releases, a CDN, or Git LFS.

---

*Quick wins: dead code cleanup. Larger investments: useReducer refactor, Express route tests, E2E tests.*
