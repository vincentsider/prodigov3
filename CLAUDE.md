# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProdigoV3 is a file ingestion API service designed to:
- Run as a Dockerized service deployed on Railway
- Use Railway Volume for persistent file storage
- Expose secure HTTP endpoints for file upload/retrieval/deletion
- Store files at `/data/uploads` on Railway Volume

**Key endpoints:**
- `POST /api/v1/files` - Upload file (multipart/form-data)
- `GET /api/v1/files/{id}` - Retrieve file metadata
- `DELETE /api/v1/files/{id}` - Delete file (admin only)
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

## Architecture

The codebase follows a layered architecture with strict separation of concerns:
- `routes/` - HTTP route definitions only
- `controllers/` - Request handling, validation, response formatting
- `services/` - Core business logic
- `storage/` - File system operations (abstracted behind `FileStorage` interface)
- `middleware/` - Auth, logging, error handling
- `models/` or `types/` - Data structures and type definitions
- `config/` - Environment and configuration management

**Key constraints:**
- Dependencies flow inward: routes → controllers → services → storage
- No circular dependencies
- No file exceeds 300 lines (excluding types/tests)
- Storage abstraction required for future S3 migration

## Speckit Workflow

This project uses Speckit commands for specification-driven development:

1. `/speckit.specify <description>` - Create feature specification (creates branch + spec.md)
2. `/speckit.clarify` - Clarify spec requirements interactively
3. `/speckit.plan` - Generate technical plan (plan.md, research.md, data-model.md, contracts/)
4. `/speckit.tasks` - Generate dependency-ordered tasks.md
5. `/speckit.analyze` - Cross-artifact consistency analysis (read-only)
6. `/speckit.checklist <domain>` - Create verification checklists
7. `/speckit.implement` - Execute tasks from tasks.md

Scripts are in `.specify/scripts/bash/` and templates in `.specify/templates/`.

## Constitution (Non-Negotiable Rules)

Key rules from CONSTITUTION.md:

**Code Quality:**
- TypeScript with `strict: true`, `any` is forbidden
- Streaming uploads required (no buffering entire file in memory)
- Domain-specific error types (FileNotFoundError, FileTooLargeError, etc.)
- Unhandled promise rejections must crash the process

**Testing:**
- 80% minimum coverage for services/, storage/, utils/
- Integration tests must use real filesystem (tmpdir) or Docker volume
- Contract tests required for all HTTP endpoints

**Security:**
- All endpoints (except health) require Bearer token auth
- File contents never logged
- API keys masked in logs (show only last 4 chars)
- Sanitize file paths to prevent directory traversal

**API:**
- Versioned endpoints: `/api/v1/...`
- Structured JSON errors with machine-readable codes
- Streaming writes directly to disk

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes* | Railway-set | HTTP server port |
| `API_AUTH_KEY` | Yes | - | API key for auth |
| `MAX_UPLOAD_MB` | No | 50 | Max upload size |
| `RAILWAY_VOLUME_MOUNT_PATH` | Yes* | Railway-set | Volume mount path |
| `UPLOAD_SUBDIR` | No | uploads | Subdirectory for files |
| `LOG_LEVEL` | No | info | Logging level |
| `ALLOWED_MIME_TYPES` | No | json,csv,txt,pdf,zip | Comma-separated list |

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_FILE` | 400 | No file in request |
| `INVALID_MIME_TYPE` | 400 | File type not allowed |
| `FILE_TOO_LARGE` | 413 | Exceeds size limit |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `NOT_FOUND` | 404 | Resource not found |
| `STORAGE_ERROR` | 500 | Volume write failed |
