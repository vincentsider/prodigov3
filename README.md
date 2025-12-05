# AI File Ingestion API

This service provides a secure HTTP endpoint for AI systems to upload files for ingestion. Files are stored on a persistent volume (Railway Volume) and metadata is tracked.

## 1. Authentication

The API uses **Bearer Token Authentication**.

### Server Setup
You must set the `API_AUTH_KEY` environment variable on your Railway service to a secret string of your choice.
- **Example**: `API_AUTH_KEY=prod_secret_key_12345`

### Client Usage
All requests must include the `Authorization` header with the secret key you defined.

```http
Authorization: Bearer <YOUR_API_AUTH_KEY>
```

---

## 2. API Endpoints

### Upload a File
**POST** `/api/v1/files`

Uploads a file to the storage volume.

- **Headers**:
  - `Authorization: Bearer <YOUR_KEY>`
  - `Content-Type: multipart/form-data`
- **Body**:
  - `file`: (Required) The binary file to upload.
  - `customer_id`: (Optional) String ID of the customer.
  - `source`: (Optional) Source of the file (e.g., "ai_pipeline").
  - `metadata`: (Optional) JSON string with custom key-value pairs.

**Example (cURL):**
```bash
curl -X POST https://prodigov3-production.up.railway.app/api/v1/files \
  -H "Authorization: Bearer prod_secret_key_12345" \
  -F "file=@./result.json" \
  -F "customer_id=cus_123" \
  -F "source=ai_pipeline"
```

**Success Response (201 Created):**
```json
{
  "id": "file_abc123...",
  "filename": "result.json",
  "status": "stored",
  "storage_relative_path": "2025/12/05/..."
}
```

---

### Get File Metadata
**GET** `/api/v1/files/{file_id}`

Retrieves the metadata for a stored file.

**Example (cURL):**
```bash
curl https://prodigov3-production.up.railway.app/api/v1/files/file_abc123... \
  -H "Authorization: Bearer prod_secret_key_12345"
```

---

### Delete a File
**DELETE** `/api/v1/files/{file_id}`

Permanently deletes the file and its metadata.

**Example (cURL):**
```bash
curl -X DELETE https://prodigov3-production.up.railway.app/api/v1/files/file_abc123... \
  -H "Authorization: Bearer prod_secret_key_12345"
```

