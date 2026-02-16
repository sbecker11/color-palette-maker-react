# Multi-User SaaS Kubernetes Migration

This document outlines the steps and considerations for migrating the Color Palette Maker to a multi-user SaaS running on Kubernetes.

---

## Context: From Single-User SPA to Multi-User SaaS

The current app is a single-user SPA with local file storage. A SaaS version would add:

- **Authentication**: Sign-up, login, sessions (JWT or session cookies).
- **Database**: PostgreSQL (or similar) for users, palettes, metadata — replacing `image_metadata.jsonl`.
- **Object storage**: S3 or GCS for images — replacing local `uploads/` directory.
- **Multi-tenancy**: Per-user data isolation; rate limits; quotas.
- **Stateless backend**: Backend and image-processor read/write to DB and object storage, not local disk. Pods can scale horizontally.

With these changes, Kubernetes becomes a strong fit: scaling, high availability, and rolling updates matter for multi-user traffic.

---

## Target Architecture (SaaS)

```
   Ingress (TLS)
        │
        ▼
   ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
   │  frontend   │────▶│   backend   │────▶│ image-processor  │
   │  (React)    │     │  (Express)  │     │ (Python/Flask)   │
   │  nginx      │     │  + Auth     │     │ OpenCV           │
   └─────────────┘     └──────┬──────┘     └────────┬─────────┘
        │                     │                     │
        │                     ▼                     │
        │              ┌─────────────┐              │
        │              │  PostgreSQL │              │
        │              │  (users,    │              │
        │              │   palettes) │              │
        │              └─────────────┘              │
        │                     │                     │
        │                     ▼                     ▼
        │              ┌─────────────────────────────────┐
        │              │  Object Storage (S3/GCS)        │
        │              │  user uploads, images           │
        │              └─────────────────────────────────┘
```

- **frontend**: React SPA served by nginx.
- **backend**: Express API with auth; calls DB and object storage; calls image-processor over HTTP.
- **image-processor**: Receives image from backend (or path in object storage); returns regions.
- **PostgreSQL**: Users, palettes, metadata. Run as StatefulSet or use managed DB (RDS, Cloud SQL).
- **Object storage**: Images. Access via signed URLs or direct backend upload.

---

## Pros and Cons

### Pros

- **Scaling**: HorizontalPodAutoscaler scales backend and image-processor with user load.
- **High availability**: Replicas across nodes; automatic restart; rolling updates with zero downtime.
- **Resource isolation**: CPU/memory limits prevent noisy neighbors.
- **Stateless pods**: DB and object storage replace local disk; no shared PVC for user data.
- **Multi-tenant ready**: Per-user isolation in DB; object storage paths keyed by user/tenant.
- **Production patterns**: Ingress, TLS, RBAC, network policies, observability.

### Cons

- **Operational complexity**: Cluster, DB, object storage, auth, migrations.
- **Cost**: Managed K8s + managed DB + object storage.
- **Migration effort**: Auth, schema, API changes, frontend updates.
- **Learning curve**: K8s, Terraform/Helm, CI/CD for multi-service deploys.

### When Kubernetes SaaS Migration Makes Sense

- Building a commercial or multi-user product.
- Need HA, scaling, or multi-region.
- Team has or can acquire K8s and backend expertise.

### When to Defer

- Validating product-market fit with a single-user or small-beta deployment.
- Limited DevOps capacity; prefer PaaS (Heroku, Render, Fly.io) first.

---

## Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or local).
- PostgreSQL (managed or in-cluster).
- Object storage bucket (S3, GCS).
- Docker images for frontend, backend, image-processor.
- Auth strategy (e.g. JWT, OAuth, Auth0).

---

## Implementation Steps

### 1. Data Layer Migration

- Define schema: `users`, `palettes`, `images`, `metadata`.
- Migrate `image_metadata.jsonl` logic to DB queries.
- Replace `uploads/` with S3/GCS; backend generates upload URLs and stores keys in DB.

### 2. Authentication

- Add sign-up, login, password reset.
- Protect API routes; attach user/tenant to requests.
- Frontend: login page, token/session handling, auth state.

### 3. Backend Changes

- User-scoped API: list/create/update palettes per user.
- Replace file reads with object storage; pass image URL or bytes to image-processor.
- Add rate limiting, quotas.

### 4. Image Processor

- Accept image URL or bytes; fetch from object storage if needed.
- Return regions JSON. No local `uploads/` dependency; stateless.

### 5. Kubernetes Manifests

| Resource | Purpose |
|----------|---------|
| `namespace.yaml` | Isolate SaaS resources |
| `configmap.yaml` | DB URL, object storage config, image-processor URL |
| `secret.yaml` | DB password, API keys, JWT secret |
| `deployment-frontend.yaml` | nginx + React build |
| `deployment-backend.yaml` | Express API (replicas ≥ 2) |
| `deployment-image-processor.yaml` | Flask/OpenCV |
| `service-*.yaml` | ClusterIP for each |
| `ingress.yaml` | TLS, host, path routing |
| `hpa-backend.yaml` | Auto-scale backend on CPU/requests |
| `hpa-image-processor.yaml` | Auto-scale image-processor |

### 6. Database

- Use managed PostgreSQL (RDS, Cloud SQL) or in-cluster (StatefulSet + PVC).
- Run migrations via init job or CI/CD.

### 7. Object Storage

- Create bucket; configure CORS if frontend uploads directly.
- Backend uses SDK to generate presigned URLs or proxy uploads.

---

## File Change Summary

| Layer | Changes |
|-------|---------|
| Backend | Auth middleware, DB client, object storage client, user-scoped routes |
| Frontend | Login/sign-up UI, auth state, API client with tokens |
| Image-processor | Accept URL/bytes; no local uploads dir |
| Infrastructure | `k8s/*.yaml`, CI/CD for build and deploy |
| Config | DB URL, bucket name, secrets |

---

## Migration Order

1. Add auth and DB; migrate metadata to PostgreSQL.
2. Add object storage; migrate uploads.
3. Update backend and image-processor for stateless operation.
4. Add K8s manifests (see [Single-User-SPA-DockerCompose-migration.md](Single-User-SPA-DockerCompose-migration.md) for service split).
5. Deploy; run migrations; test multi-user flows.
6. Add HPA, monitoring, alerting.
