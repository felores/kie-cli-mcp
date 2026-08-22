# Kie.ai File Upload API contract

Verified: 2026-08-22

Official sources:

- [File Upload API quickstart](https://docs.kie.ai/file-upload-api/quickstart)
- [Base64 File Upload](https://docs.kie.ai/file-upload-api/upload-file-base-64)
- [URL File Upload](https://docs.kie.ai/file-upload-api/upload-file-url)
- [File Stream Upload](https://docs.kie.ai/file-upload-api/upload-file-stream)

## Authentication and origin

All upload requests use the Kie file service origin and the normal Kie API key:

```http
Authorization: Bearer <KIE_AI_API_KEY>
```

Default origin:

```text
https://kieai.redpandaai.co
```

`KIE_AI_FILE_UPLOAD_BASE_URL` is an operator and test override only. The client
requires HTTPS, rejects credentials, query strings, fragments and application
paths, and refuses redirects so the bearer cannot move to another origin.

## Endpoints

### Base64

```http
POST /api/file-base64-upload
Content-Type: application/json
```

```json
{
  "base64Data": "data:image/png;base64,...",
  "uploadPath": "images/user-uploads",
  "fileName": "reference.png"
}
```

`base64Data` may be raw Base64 or a data URL. `uploadPath` is required and
`fileName` is optional. This project validates the decoded byte signature and
limits public tool input to 10 MiB before contacting Kie.

### Public URL import

```http
POST /api/file-url-upload
Content-Type: application/json
```

```json
{
  "fileUrl": "https://public.example/reference.png",
  "uploadPath": "files/user-uploads",
  "fileName": "reference.png"
}
```

Kie downloads the public HTTP or HTTPS URL. The MCP and CLI server does not
expose this endpoint to arbitrary tool input because provider-side DNS and SSRF
behavior is undocumented. It is used only during widget finalization with a
server-generated capability URL owned by this process.

### Binary stream

```http
POST /api/file-stream-upload
Content-Type: multipart/form-data
```

Required parts are `file` and `uploadPath`; `fileName` is optional. The shared
client uses this endpoint for already validated in-memory media in the OpenAI
adapter. Browser uploads to the MCP transport use local capability storage
first. `finalize_upload` gives Kie a server-generated read capability and only
the resulting Kie URL is added to model context.

## Response

Endpoint examples use this envelope:

```json
{
  "success": true,
  "code": 200,
  "msg": "File uploaded successfully",
  "data": {
    "fileName": "reference.png",
    "filePath": "images/user-uploads/reference.png",
    "downloadUrl": "https://tempfile.redpandaai.co/.../reference.png",
    "fileSize": 154832,
    "mimeType": "image/png",
    "uploadedAt": "2026-08-22T12:00:00.000Z"
  }
}
```

The client treats `data.downloadUrl` as authoritative and normalizes it to the
legacy internal `fileUrl` field for existing callers.

## Retention uncertainty

The official pages contradict each other. They mention both 24 hours and three
days, and their response examples disagree about optional fields such as
`expiresAt` and `fileId`. The public tool therefore promises no duration and
instructs callers to consume the temporary URL promptly.
