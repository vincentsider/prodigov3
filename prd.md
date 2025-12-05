Product Requirements Document

Feature: AI File Ingestion Endpoint (Railway + Docker + Railway Volume Storage)
Owner: <your name>
Date: 2025-12-05
Version: v1.0

1. Overview

We will build a file ingestion API that:

Runs as a Dockerized service deployed on Railway.

Uses a Railway Volume as persistent storage for uploaded files (no external S3/Supabase in v1).

Exposes a secure HTTP endpoint that an AI system (or other clients) can call to upload files for later processing.

Platform assumptions

The service is deployed to Railway as:

Either a GitHub repo with a Dockerfile at the root (Railway auto-detects and builds it). 
Railway Docs
+2
Railway Docs
+2

Or a public Docker image from a registry (Docker Hub / GHCR / etc.), configured as the service source. 
Railway Docs

Storage uses a Railway Volume attached to that service, mounted at a known path (e.g. /data/uploads). Volumes provide persistent data for services and are available at the configured mount path. 
Railway Docs
+1

2. Goals & Non-Goals
2.1 Goals

A single, stable API endpoint for uploading a file from the customer’s AI pipeline.

Guaranteed durable file storage on Railway Volume for future processing.

Capture enough metadata (customer, source, type) to route files internally.

Provide secure access via API keys or tokens.

Make it deployable/repeatable on Railway as a Docker-based service.

2.2 Non-Goals

No real-time processing of the uploaded file in v1 (this is ingestion only).

No public download/serving of files to end-users in v1.

No multi-region storage or cross-project file sharing in v1.

No resumable uploads / chunking (TUS, etc.) in v1.

3. Users & Use Cases
3.1 Users

External AI client / integration
Sends files (JSON, CSV, PDF, etc.) to the ingestion API.

Internal processing jobs
Read files from the volume (via the stored path) to run downstream pipelines.

Support / Ops
Check logs, metadata and status to confirm uploads and debug issues.

3.2 Key Use Cases

AI output upload

AI pipeline generates result.json.

Calls POST /api/v1/files with the file + customer_id.

File is written to /data/uploads/... on Railway Volume.

Returns a file_id and path for downstream processing.

Batch partner upload

Partner system pushes a daily .csv via the API.

Internal cron/worker on the same project reads files saved under the volume path and processes them.

4. Functional Requirements
4.1 File Upload Endpoint

FR1 – Endpoint definition

Method: POST

Path: /api/v1/files

FR2 – Request format
The endpoint MUST accept multipart/form-data with:

file (required): binary file payload.

customer_id (optional, string).

source (optional, string: e.g. ai-service-1, partner-x).

metadata (optional, JSON string with arbitrary key/values).

FR3 – Supported file types (initial list)

application/json

text/csv

text/plain

application/pdf

application/zip

The service should validate MIME type and extension against an allowlist (configurable via env variable if needed).

FR4 – File size

Configurable maximum (env var, e.g. MAX_UPLOAD_MB).

Default: 50 MB.

Uploads exceeding this return 413 Payload Too Large.

FR5 – Behaviour on success

On successful upload:

The service streams the file to the attached Railway Volume (e.g. under /data/uploads).

The service generates:

file_id (e.g. file_yyyyMMdd_random).

A relative storage path root at the volume mount, e.g.:
2025/12/05/customer_cus_123/file_abc123-result.json

A metadata record is persisted (e.g. in DB or log/event) with:

file_id

customer_id

source

filename

content_type

size_bytes

storage_path (relative path)

created_at

status (initially stored)

FR6 – Success response

Return 201 Created JSON:

{
  "id": "file_abc123",
  "customer_id": "cus_123",
  "source": "ai-service-1",
  "filename": "result.json",
  "content_type": "application/json",
  "size_bytes": 10240,
  "storage_backend": "railway_volume",
  "storage_volume_mount_path": "/data/uploads",
  "storage_relative_path": "2025/12/05/customer_cus_123/file_abc123-result.json",
  "status": "stored",
  "created_at": "2025-12-05T12:34:56Z"
}


FR7 – Error handling

400 Bad Request
Missing file, invalid metadata JSON, unsupported content type.

401 Unauthorized
Missing or invalid auth (API key/Bearer token).

413 Payload Too Large
Exceeds configured size.

500 Internal Server Error
Storage or unexpected server issues.

4.2 Retrieve File Metadata

FR8 – Endpoint

Method: GET

Path: /api/v1/files/{id}

FR9 – Behaviour

Looks up metadata by file_id.

Returns 404 Not Found if no such file record exists or has been hard-deleted.

FR10 – Response (200)

{
  "id": "file_abc123",
  "customer_id": "cus_123",
  "source": "ai-service-1",
  "filename": "result.json",
  "content_type": "application/json",
  "size_bytes": 10240,
  "storage_backend": "railway_volume",
  "storage_volume_mount_path": "/data/uploads",
  "storage_relative_path": "2025/12/05/customer_cus_123/file_abc123-result.json",
  "status": "stored",
  "created_at": "2025-12-05T12:34:56Z",
  "updated_at": "2025-12-05T12:34:56Z",
  "processing": {
    "state": "stored",          // stored | processing | processed | error
    "processed_at": null,
    "error_message": null
  }
}

4.3 Delete File (Nice-to-have v1)

FR11 – Endpoint

Method: DELETE

Path: /api/v1/files/{id}

FR12 – Behaviour

Auth only for internal/admin keys.

Deletes the file from the Railway Volume (filesystem unlink) and:

Either soft-deletes metadata (status = deleted),

Or hard-deletes based on data retention policy.

Returns 204 No Content on success, 404 if not found.

5. Storage & Infrastructure
5.1 Storage: Railway Volume

Chosen storage: Railway Volume attached to the service.

Volumes provide persistent data for services and are available at a configured mount path. 
Railway Docs
+1

By plan, the default volume size limits are:

Free/Trial: 0.5 GB

Hobby: 5 GB

Pro/Team: 50 GB

Volumes can be grown (Pro and above can self-serve up to 250 GB). 
Railway Docs

NFR-Storage-1 – Volume setup

A single Railway Volume is attached to the ingestion service.

Mount path: /data/uploads (or similar).

The service uses the Railway-provided env var RAILWAY_VOLUME_MOUNT_PATH to determine the mount point at runtime (e.g. /data). 
Railway Docs

The upload path is UPLOAD_ROOT = $RAILWAY_VOLUME_MOUNT_PATH + "/uploads" or similar.

NFR-Storage-2 – Layout convention

Files are organized in folders to avoid huge flat directories, e.g.:

/data/uploads/{yyyy}/{mm}/{dd}/{customer_or_source}/{file_id}-{sanitized_filename}

storage_relative_path stores the part after the volume mount path (uploads/...).

NFR-Storage-3 – Volume limitations (must be accounted for)

From Railway’s volume caveats: 
Railway Docs

Each service can only have one volume.

Replicas cannot be used with volumes.

Multiple active deployments cannot mount the same volume; redeploying will cause a short downtime while the new deployment takes over.

Volume downsize is not supported (only growing).

Volumes are accessed via the filesystem; there is no built-in S/FTP or file browser.

Docker images that run as non-root users may hit permission issues; in that case we must consider RAILWAY_RUN_UID=0.

The PRD assumes single-replica deployment for this service.

5.2 Railway Service & Docker

NFR-Infra-1 – Service source

The ingestion service is defined on Railway as either:

GitHub repo + Dockerfile at repo root. Railway will detect the Dockerfile and build the image. 
Railway Docs
+2
Railway Docs
+2

Or a public Docker image hosted in Docker Hub / GHCR / other supported registry, configured in “Service Source”. 
Railway Docs

NFR-Infra-2 – Dockerfile expectations

Dockerfile exposes the HTTP port (e.g. EXPOSE 8080).

The container listens on PORT env var (Railway sets this when running services). 
Railway Docs

The working directory in the image must align with where code expects the volume:

If RAILWAY_VOLUME_MOUNT_PATH=/data, and app expects uploads at /data/uploads, ensure the Docker image can write to /data/uploads.

NFR-Infra-3 – Environment variables

Use Railway Variables for configuration/secrets, made available to the build and running service as env vars. 
Railway Docs
+1

Minimum variables:

API_AUTH_KEY (or JWT secret/config)

MAX_UPLOAD_MB

NODE_ENV / APP_ENV

RAILWAY_RUN_UID (if we need root to access the volume)

6. Security & Compliance

NFR-Sec-1 – Authentication

All endpoints require auth via API key or token, e.g.:

Authorization: Bearer <api-key>

API keys are stored as sealed/service variables in Railway (never checked into repo). 
Railway Docs
+1

NFR-Sec-2 – Authorization

Keys are mapped to client identity (e.g. ai-service-1).

Optionally, separate “admin” key class for DELETE/internal endpoints.

NFR-Sec-3 – Transport security

Only served via HTTPS (Railway’s managed HTTPS on the public domain). 
Railway Docs
+1

NFR-Sec-4 – Data retention

Retention policy is configurable (e.g. 90 days) and enforced by a background job or manual cleanup script that deletes old files and metadata.

NFR-Sec-5 – PII and sensitive data

Assume files can contain customer data.

No file contents are logged.

Volume backups (Railway supports manual/automated backups for services with volumes) must be configured according to internal compliance needs. 
Railway Docs

7. Performance & Scalability

NFR-Perf-1 – Throughput

Target: support at least N uploads/minute (to be defined with customer).

Single replica (required by Railway Volumes) must handle expected load. 
Railway Docs

NFR-Perf-2 – Latency

Typical upload (<10 MB) should complete within 2–5 seconds under normal conditions.

NFR-Perf-3 – Resource usage

Implement streaming writes (do not buffer entire file in memory).

Enforce server timeouts and request body limits.

NFR-Perf-4 – Volume capacity

Monitoring and alerting for used volume space vs capacity.

Plan upgrade path when approaching volume size limits (grow volume or archive old files). 
Railway Docs

8. Observability & Operations

NFR-Obs-1 – Logging

For each upload attempt:

Timestamp

Client identity / API key ID

customer_id (if provided)

File name, content type, size

Result: success / error type

Internal error message (for 5xx) – but never file content.

NFR-Obs-2 – Metrics

At minimum:

file_upload_requests_total{client,status_code}

file_upload_bytes_total

file_upload_failures_total{reason}

p95 / p99 upload latency

NFR-Obs-3 – Alerts

High error rate (>5% for 5 minutes, threshold TBD).

Upload failures to volume (e.g. I/O errors, disk full).

Volume usage crossing thresholds (e.g. 80% full).

9. API Summary
9.1 POST /api/v1/files

Auth: required (Bearer token).

Content-Type: multipart/form-data.

Body fields:

file (required)

customer_id (optional)

source (optional)

metadata (optional JSON string)

Responses:

201 – JSON metadata (see FR6).

400, 401, 413, 500 – error JSON with code and message.

9.2 GET /api/v1/files/{id}

Auth: required.

Responses:

200 – metadata JSON (see FR10).

404 – not found.

9.3 DELETE /api/v1/files/{id}

Auth: admin/privileged key only.

Responses:

204 – deleted.

404 – not found.

10. Implementation Notes (Non-binding)

These are implementation hints, not strict requirements, but they align with Railway + Docker + Volume:

Use Node.js + Express (or similar) as HTTP server.

Use an upload middleware (e.g. busboy, multer in disk/streaming mode) configured to write directly under process.env.RAILWAY_VOLUME_MOUNT_PATH.

When running on Railway:

Volume is attached at /data (for example) and Railway injects RAILWAY_VOLUME_MOUNT_PATH=/data. 
Railway Docs
+1

UPLOAD_ROOT = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads").

Dockerfile:

FROM node:XX-alpine

WORKDIR /app

Copy code, install deps, CMD ["node", "dist/server.js"]

Listen on process.env.PORT. 
Railway Docs

Deployment:

Connect GitHub repo or Docker image as service source.

Attach volume in the Railway UI and set mount path /data. 
Railway Docs
+1

11. Risks & Open Questions

Volume capacity / growth

Need realistic estimate of upload volume and retention to ensure plan + volume size are sufficient. 
Railway Docs

Single replica constraint

Railway Volumes disallow multiple replicas; future scale might require:

Separate ingestion vs processing services, or

Moving to an external object store.

Data retention policy

Exact retention and deletion requirements (GDPR/right-to-erasure, etc.) must be finalized.

Backup strategy

Decide if we rely solely on Railway’s volume backup features or also implement an export/archival job. 
Railway Docs