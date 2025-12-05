# ProdigoV3 File Ingestion API — Constitution

> This document establishes the non-negotiable principles, standards, and governance rules for the backend-only AI file-ingestion API. All implementation choices, dependency selections, CI/CD configurations, and future changes MUST adhere to these principles.

**Service Context:** Docker-based backend service deployed on Railway with Railway Volume for persistent file storage.

---

## Table of Contents

1. [Code Quality Principles](#1-code-quality-principles)
2. [Testing Standards](#2-testing-standards)
3. [API and Developer Experience](#3-api-and-developer-experience)
4. [Security and Compliance](#4-security-and-compliance)
5. [Performance and Reliability](#5-performance-and-reliability)
6. [Observability and Operations](#6-observability-and-operations)
7. [Governance Rules](#7-governance-rules)

---

## 1. Code Quality Principles

### 1.1 Modular Architecture

**Non-negotiable:**

- The codebase MUST follow a clear separation of concerns with distinct layers:
  - `routes/` — HTTP route definitions only (no business logic)
  - `controllers/` — Request handling, validation orchestration, response formatting
  - `services/` — Core business logic (file processing, metadata management)
  - `storage/` — File system operations abstracted behind interfaces
  - `middleware/` — Cross-cutting concerns (auth, logging, error handling)
  - `models/` or `types/` — Data structures and type definitions
  - `config/` — Environment and configuration management

- Each module MUST have a single, clearly defined responsibility
- Circular dependencies are FORBIDDEN
- Dependencies MUST flow inward (routes → controllers → services → storage)

### 1.2 Small, Focused Modules

**Non-negotiable:**

- No single file SHALL exceed 300 lines of code (excluding type definitions and tests)
- Functions MUST do one thing; if a function requires more than 3 levels of nesting, refactor it
- Each module MUST be independently testable without mocking half the application
- Utility functions MUST be extracted to dedicated utility modules when used across 2+ services

### 1.3 Maintainable Abstractions

**Non-negotiable:**

- Storage operations MUST be abstracted behind an interface to allow future migration (e.g., to S3):
  ```typescript
  interface FileStorage {
    write(path: string, stream: Readable): Promise<StorageResult>;
    read(path: string): Promise<Readable>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  }
  ```

- Configuration MUST be centralized and validated at startup (fail fast on missing required config)
- Error types MUST be domain-specific, not generic (e.g., `FileNotFoundError`, `FileTooLargeError`, `InvalidMimeTypeError`)
- Avoid premature abstraction; extract only when there's proven duplication or a clear extensibility requirement

### 1.4 Strong Typing

**Non-negotiable:**

- TypeScript with `strict: true` in tsconfig.json
- `any` type is FORBIDDEN except in rare, documented cases with explicit justification
- All API request/response shapes MUST have corresponding TypeScript interfaces
- External data (request bodies, environment variables) MUST be validated and typed at system boundaries
- Use discriminated unions for state machines (e.g., processing states)

### 1.5 Consistent Error Handling

**Non-negotiable:**

- All errors MUST be caught and converted to typed domain errors before leaving service boundaries
- Controllers MUST NOT throw raw exceptions; use Result types or explicit error returns
- A centralized error handler middleware MUST map domain errors to HTTP responses
- Unhandled promise rejections MUST crash the process (fail loudly, not silently)
- Error messages MUST be actionable for the caller but MUST NOT leak internal implementation details

---

## 2. Testing Standards

### 2.1 Unit Tests

**Non-negotiable:**

- All services and utility functions MUST have unit tests
- Minimum coverage threshold: 80% line coverage for `services/`, `storage/`, and `utils/`
- Unit tests MUST NOT touch the filesystem, network, or database — use mocks/stubs
- Each unit test file MUST be co-located with its source file or in a parallel `__tests__/` directory
- Test naming convention: `describe('FunctionName', () => { it('should do X when Y', ...) })`

### 2.2 Integration Tests

**Non-negotiable:**

- Integration tests MUST cover:
  - File upload flow (multipart upload → volume write → metadata persistence)
  - File metadata retrieval (GET by ID)
  - File deletion (DELETE and verify removal from storage)
  - Error scenarios (invalid file types, oversized files, auth failures)

- Integration tests MUST use a real filesystem (tmpdir) or Docker volume in CI
- Integration tests MUST NOT share state; each test MUST set up and tear down its own fixtures
- Database (if used for metadata) MUST be reset or isolated per test run

### 2.3 Contract Tests for HTTP Endpoints

**Non-negotiable:**

- Every HTTP endpoint MUST have contract tests verifying:
  - Request validation (required fields, type coercion, constraints)
  - Response shape matches documented schema exactly
  - All documented status codes are exercised (201, 400, 401, 404, 413, 500)
  - Headers (Content-Type, Authorization requirements)

- Contract tests MUST be implemented using a testing framework that supports HTTP assertions (e.g., supertest, httpexpect)
- OpenAPI/JSON Schema definitions (if present) MUST be validated against actual responses
- Breaking changes to contracts MUST fail CI

### 2.4 CI Runnability

**Non-negotiable:**

- All tests MUST run in CI without manual intervention
- Tests MUST complete within 5 minutes for the full suite
- Flaky tests are bugs; a test that fails intermittently MUST be fixed or removed within 48 hours
- CI MUST run: lint → type-check → unit tests → integration tests → contract tests (in order, fail-fast)

---

## 3. API and Developer Experience

### 3.1 Versioned REST Endpoints

**Non-negotiable:**

- All endpoints MUST be prefixed with `/api/v{n}/` (e.g., `/api/v1/files`)
- Version bumps require:
  - Documented changelog entry
  - Migration guide if breaking
  - Minimum 30-day deprecation notice for old versions (once multiple versions exist)
- URL structure MUST be RESTful: nouns for resources, HTTP verbs for actions

### 3.2 Consistent JSON Response Shapes

**Non-negotiable:**

- Success responses MUST follow this envelope:
  ```json
  {
    "id": "...",
    "...fields": "..."
  }
  ```

- Error responses MUST follow this envelope:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable message",
      "details": [
        { "field": "customer_id", "issue": "must be a string" }
      ]
    }
  }
  ```

- `null` fields MUST be omitted or explicitly documented; no mixing of omission and null
- Timestamps MUST be ISO 8601 format with timezone (UTC): `2025-12-05T12:34:56Z`
- All responses MUST include `Content-Type: application/json`

### 3.3 Clear Validation Errors

**Non-negotiable:**

- Validation errors MUST return 400 with specific field-level feedback
- Error codes MUST be machine-readable constants (e.g., `INVALID_MIME_TYPE`, `FILE_TOO_LARGE`)
- Error messages MUST be human-readable and actionable
- Multiple validation errors SHOULD be returned together, not one at a time

### 3.4 Documented Request/Response Schemas

**Non-negotiable:**

- OpenAPI 3.x specification MUST be maintained and kept in sync with implementation
- The OpenAPI spec MUST be validated in CI (no orphaned endpoints, no undocumented fields)
- Example requests and responses MUST be provided for each endpoint
- The spec MUST be accessible at `/api/docs` or similar (served by the application or as static file)

### 3.5 Predictable HTTP Status Codes

**Non-negotiable:**

| Scenario                          | Status Code |
| --------------------------------- | ----------- |
| Successful creation               | 201         |
| Successful retrieval              | 200         |
| Successful deletion               | 204         |
| Validation error / bad request    | 400         |
| Missing or invalid authentication | 401         |
| Forbidden (valid auth, no access) | 403         |
| Resource not found                | 404         |
| Payload too large                 | 413         |
| Unsupported media type            | 415         |
| Rate limited                      | 429         |
| Server error                      | 500         |
| Service unavailable               | 503         |

---

## 4. Security and Compliance

### 4.1 Authentication

**Non-negotiable:**

- All endpoints (except health checks) MUST require authentication
- Authentication MUST use API key or Bearer token via `Authorization` header
- API keys MUST be validated against a secure store (environment variable for simple cases, secrets manager for production)
- Invalid or missing auth MUST return 401 with no information leakage about valid keys
- Rate limiting MUST be applied per API key to prevent abuse

### 4.2 Secrets Management

**Non-negotiable:**

- ALL secrets (API keys, database credentials, signing keys) MUST be provided via environment variables
- Secrets MUST NEVER be committed to the repository (use `.env.example` with placeholder values)
- Railway service variables MUST be used for production secrets
- Secrets MUST be rotatable without code deployment

### 4.3 Logging Security

**Non-negotiable:**

- File contents MUST NEVER be logged
- API keys MUST be masked in logs (show only last 4 characters)
- Request bodies (except file content) MAY be logged at debug level only
- PII fields (customer_id, filenames) MAY be logged but MUST be flagged for redaction in log aggregation
- Stack traces MUST NOT be returned in API responses (log internally, return generic message)

### 4.4 Least-Privilege Volume Access

**Non-negotiable:**

- The application process MUST only have read/write access to the designated upload directory
- The Dockerfile MUST NOT run as root unless explicitly required by Railway Volume permissions (document if needed)
- If `RAILWAY_RUN_UID=0` is required, document the security implications and mitigations
- File paths MUST be sanitized to prevent directory traversal attacks
- Uploaded files MUST NOT be executable; strip execute permissions on write

### 4.5 Input Validation

**Non-negotiable:**

- File MIME types MUST be validated against an allowlist
- Filenames MUST be sanitized (remove path separators, null bytes, special characters)
- Metadata JSON MUST be parsed safely with size limits to prevent JSON bombs
- Customer IDs and source identifiers MUST be validated for format and length

---

## 5. Performance and Reliability

### 5.1 Streaming Uploads

**Non-negotiable:**

- File uploads MUST be streamed directly to disk; buffering the entire file in memory is FORBIDDEN
- Use streaming multipart parsers (e.g., busboy) that write chunks as they arrive
- Memory usage MUST NOT scale linearly with file size
- Progress tracking (if implemented) MUST NOT require buffering

### 5.2 File Size Limits

**Non-negotiable:**

- A configurable maximum file size MUST be enforced (default: 50MB, via `MAX_UPLOAD_MB`)
- Size validation MUST happen early in the stream to abort oversized uploads without wasting resources
- The limit MUST be documented in the API specification
- 413 Payload Too Large MUST be returned with the configured limit in the error message

### 5.3 Timeouts

**Non-negotiable:**

- HTTP request timeout: configurable, default 60 seconds
- File write timeout: configurable, default 120 seconds for large files
- Database/metadata operations: maximum 5 seconds
- All timeouts MUST be documented and configurable via environment variables
- Timeout errors MUST be logged with context (operation, elapsed time)

### 5.4 Backpressure and Retry Strategies

**Non-negotiable:**

- If the volume write cannot keep up with incoming data, apply backpressure to the client (pause reading)
- For internal operations (metadata persistence), implement exponential backoff with jitter
- Maximum retry attempts: 3 for transient failures
- Circuit breaker pattern SHOULD be implemented for downstream dependencies
- Partial uploads MUST be cleaned up on failure (no orphaned files)

### 5.5 Graceful Degradation

**Non-negotiable:**

- Under heavy load, the service MUST continue serving existing requests rather than accepting new ones
- Implement request queuing or rejection with 503 when at capacity
- Health check endpoints MUST remain responsive even under load
- Graceful shutdown MUST complete in-flight requests before terminating (SIGTERM handling)
- Shutdown timeout: 30 seconds maximum

---

## 6. Observability and Operations

### 6.1 Structured Logging

**Non-negotiable:**

- All logs MUST be structured JSON (one JSON object per line)
- Required fields for every log entry:
  - `timestamp` (ISO 8601)
  - `level` (debug, info, warn, error)
  - `message` (human-readable)
  - `service` (service name)
  - `request_id` (correlation ID for request tracing)

- Additional context fields as appropriate: `customer_id`, `file_id`, `duration_ms`, `status_code`
- Log levels MUST be meaningful: info for business events, warn for recoverable issues, error for failures
- Debug logs MUST be disabled in production by default

### 6.2 Metrics

**Non-negotiable:**

- The following metrics MUST be exposed (Prometheus format recommended):
  - `file_upload_requests_total{status, client}` — Counter
  - `file_upload_bytes_total` — Counter
  - `file_upload_duration_seconds` — Histogram (buckets: 0.1, 0.5, 1, 2, 5, 10, 30, 60)
  - `file_upload_failures_total{reason}` — Counter (reasons: validation, auth, storage, timeout)
  - `file_metadata_requests_total{status}` — Counter
  - `active_uploads` — Gauge
  - `volume_usage_bytes` — Gauge (periodic sampling)

- Metrics endpoint: `/metrics` (may be restricted to internal access)
- Metrics MUST NOT include high-cardinality labels (no file IDs, no full paths)

### 6.3 Health Checks

**Non-negotiable:**

- Liveness probe: `GET /health/live`
  - Returns 200 if the process is running
  - MUST NOT check external dependencies
  - Response: `{ "status": "ok" }`

- Readiness probe: `GET /health/ready`
  - Returns 200 if the service can accept traffic
  - MUST verify volume is writable (touch a temp file)
  - MUST verify metadata store is accessible (if applicable)
  - Response: `{ "status": "ready", "checks": { "volume": "ok", "database": "ok" } }`

- Both endpoints MUST respond within 1 second
- Health endpoints MUST NOT require authentication

### 6.4 Volume Monitoring

**Non-negotiable:**

- Volume disk usage MUST be monitored and exposed as a metric
- Alerts MUST be configured for:
  - 70% capacity: warning
  - 85% capacity: critical
  - 95% capacity: emergency (consider rejecting new uploads)
- Volume usage SHOULD be checked periodically (every 60 seconds) and logged
- Documentation MUST include procedures for:
  - Growing the Railway Volume
  - Manual cleanup of old files
  - Emergency procedures when volume is full

---

## 7. Governance Rules

### 7.1 Implementation Decision Process

When making implementation choices, evaluate options against this constitution in order of priority:

1. **Security** — Never compromise on security principles
2. **Reliability** — System must be stable and predictable
3. **Correctness** — Behavior must match documented contracts
4. **Observability** — Issues must be diagnosable
5. **Performance** — Meet latency and throughput requirements
6. **Developer Experience** — Code should be maintainable and testable

Document significant decisions in ADR (Architecture Decision Records) format in `/docs/adr/`.

### 7.2 Dependency Selection Criteria

Before adding any dependency, it MUST be evaluated against:

| Criterion              | Requirement                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| Maintenance            | Active maintenance (commits within last 6 months)                   |
| Security               | No known critical vulnerabilities; responsive security process      |
| License                | Compatible with project license (MIT, Apache 2.0, BSD preferred)    |
| Bundle size            | Justified for the functionality provided                            |
| Type definitions       | Must have TypeScript types (native or @types/*)                     |
| Test coverage          | Library itself should be well-tested                                |
| Alternatives           | Must justify choice over alternatives                               |

Dependencies MUST be pinned to exact versions in production. `npm audit` or equivalent MUST pass in CI.

### 7.3 CI/CD Requirements

The CI/CD pipeline MUST enforce:

1. **On every PR:**
   - Linting (ESLint with strict config)
   - Type checking (tsc --noEmit)
   - Unit tests with coverage report
   - Integration tests
   - Contract tests
   - Security audit (npm audit / snyk)
   - Docker build verification

2. **On merge to main:**
   - All PR checks
   - Build and push Docker image (tagged with commit SHA and `latest`)
   - Deploy to staging (if configured)

3. **On release tag:**
   - All main checks
   - Docker image tagged with version
   - Deploy to production (manual approval gate)
   - Smoke tests against deployed service

CI MUST block merge if any check fails. No manual bypasses without documented justification.

### 7.4 Change Management

**Breaking Changes:**

- Any change to API contracts MUST be reviewed by at least 2 team members
- Breaking changes require version bump (v1 → v2)
- Minimum 30-day deprecation period for endpoints being removed
- Breaking changes MUST be documented in CHANGELOG.md

**Constitution Amendments:**

- Changes to this constitution require:
  - Written proposal with rationale
  - Review period of 5 business days
  - Approval from project lead or technical owner
  - Documentation of the change in version control

**Exception Process:**

- Temporary exceptions to these principles MUST be:
  - Documented with justification
  - Time-boxed (maximum 30 days)
  - Tracked in a visible location (issue tracker)
  - Reviewed for resolution before deadline

### 7.5 Code Review Standards

All code changes MUST be reviewed with attention to:

- [ ] Adherence to modular architecture (Section 1.1)
- [ ] Type safety (no `any`, proper interfaces)
- [ ] Error handling (domain errors, no silent failures)
- [ ] Test coverage (unit + integration for new code)
- [ ] Security implications (input validation, no secrets in code)
- [ ] Performance impact (streaming, no memory bloat)
- [ ] Logging (structured, no sensitive data)
- [ ] Documentation (API docs updated if endpoints changed)

### 7.6 On-Call and Incident Response

- Runbooks MUST be maintained for common operational tasks:
  - Restarting the service
  - Checking volume health
  - Rotating API keys
  - Investigating upload failures
  - Emergency volume cleanup

- Incidents MUST be documented with:
  - Timeline
  - Root cause
  - Impact
  - Remediation actions
  - Preventive measures

---

## Appendix A: Environment Variables Reference

| Variable                     | Required | Default        | Description                           |
| ---------------------------- | -------- | -------------- | ------------------------------------- |
| `PORT`                       | Yes*     | (Railway sets) | HTTP server port                      |
| `NODE_ENV`                   | Yes      | development    | Environment (development/production)  |
| `API_AUTH_KEY`               | Yes      | —              | API key for authentication            |
| `MAX_UPLOAD_MB`              | No       | 50             | Maximum upload size in megabytes      |
| `RAILWAY_VOLUME_MOUNT_PATH`  | Yes*     | (Railway sets) | Volume mount path                     |
| `UPLOAD_SUBDIR`              | No       | uploads        | Subdirectory within volume for files  |
| `LOG_LEVEL`                  | No       | info           | Logging level                         |
| `REQUEST_TIMEOUT_MS`         | No       | 60000          | HTTP request timeout                  |
| `ALLOWED_MIME_TYPES`         | No       | (see PRD)      | Comma-separated list of allowed types |

*Set automatically by Railway in deployed environments.

---

## Appendix B: Error Code Reference

| Code                   | HTTP Status | Description                        |
| ---------------------- | ----------- | ---------------------------------- |
| `MISSING_FILE`         | 400         | No file provided in request        |
| `INVALID_MIME_TYPE`    | 400         | File type not in allowlist         |
| `INVALID_METADATA`     | 400         | Metadata JSON is malformed         |
| `VALIDATION_ERROR`     | 400         | General validation failure         |
| `UNAUTHORIZED`         | 401         | Missing or invalid authentication  |
| `FORBIDDEN`            | 403         | Valid auth but insufficient access |
| `NOT_FOUND`            | 404         | Resource does not exist            |
| `FILE_TOO_LARGE`       | 413         | File exceeds size limit            |
| `UNSUPPORTED_MEDIA`    | 415         | Content-Type not acceptable        |
| `RATE_LIMITED`         | 429         | Too many requests                  |
| `STORAGE_ERROR`        | 500         | Failed to write to volume          |
| `INTERNAL_ERROR`       | 500         | Unexpected server error            |
| `SERVICE_UNAVAILABLE`  | 503         | Service temporarily unavailable    |

---

*This constitution is a living document. Last updated: 2025-12-05*
