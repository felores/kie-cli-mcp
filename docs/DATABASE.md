# Database & Task Management

The Kie.ai MCP Server includes a built-in SQLite database for persistent task tracking and management.

## Features

- **🔄 Persistent Storage**: Tasks survive server restarts
- **📊 Complete History**: Track all generation tasks and their results  
- **⚡ Smart Caching**: Local database reduces API calls for status checks
- **🔍 Full Audit Trail**: Complete lifecycle tracking for every task
- **🎯 Intelligent Routing**: Database provides api_type for correct endpoint selection
- **Approval Plans**: Prepared media plans survive disconnects, expire, and submit once

## Database Schema

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT UNIQUE NOT NULL,
  api_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  result_url TEXT,
  error_message TEXT,
  credits_consumed REAL
);

CREATE TABLE generation_plans (
  plan_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  approval_context TEXT NOT NULL,
  submitted_at TEXT,
  task_results_json TEXT
);

-- Performance indexes
CREATE INDEX idx_task_id ON tasks(task_id);
CREATE INDEX idx_status ON tasks(status);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `task_id` | TEXT | Unique task identifier from Kie.ai API |
| `api_type` | TEXT | Model/endpoint identifier for intelligent routing |
| `status` | TEXT | Current task status (pending/processing/completed/failed) |
| `created_at` | TIMESTAMP | When the task was created |
| `updated_at` | TIMESTAMP | When the task was last updated |
| `result_url` | TEXT | URL to the generated result (when completed) |
| `error_message` | TEXT | Error details (when failed) |
| `credits_consumed` | REAL | Provider-reported actual usage, when supplied |

Prepared plans store the reviewed request payload, its SHA-256 hash, and an opaque adapter-owned approval context. Approval and submission atomically require the matching context, hash, state, and unexpired plan. This prevents one MCP HTTP session from approving or submitting another session's plan. Existing databases receive the nullable `approval_context` column by migration; legacy plans without it cannot pass the new transition predicates.

## Task Lifecycle

```
1. Task Created → INSERT (status: 'pending')
2. API Processing → UPDATE (status: 'processing') 
3. API Complete → UPDATE (status: 'completed', result_url: '...')
4. API Failed → UPDATE (status: 'failed', error_message: '...')
```

## Task Management Tools

### 1. `list_tasks`

List all tasks in the database with optional filtering.

**Parameters:**
- `limit` (integer, optional): Max tasks to return (default: 100, max: 100)
- `status` (string, optional): Filter by status ("pending", "processing", "completed", "failed")

**Example Request:**
```json
{
  "limit": 50,
  "status": "completed"
}
```

**Example Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "task_id": "281e5b0*********************f39b9",
      "api_type": "veo3",
      "status": "completed",
      "created_at": "2025-01-14T10:30:00.000Z",
      "updated_at": "2025-01-14T10:35:00.000Z",
      "result_url": "https://file.aiquickdraw.com/custom-page/akr/video.mp4",
      "error_message": null
    }
  ]
}
```

### 2. `get_task_status`

Get detailed status of a specific task, combining local database with live API data.

**Parameters:**
- `task_id` (string, required): The task ID to check

**Example Request:**
```json
{
  "task_id": "281e5b0*********************f39b9"
}
```

**Example Response:**
```json
{
  "task_id": "281e5b0*********************f39b9",
  "api_type": "veo3",
  "status": "completed",
  "local_status": "completed",
  "api_status": "success",
  "created_at": "2025-01-14T10:30:00.000Z",
  "updated_at": "2025-01-14T10:35:00.000Z",
  "result_url": "https://file.aiquickdraw.com/custom-page/akr/video.mp4",
  "api_data": {
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://file.aiquickdraw.com/custom-page/akr/video.mp4\"]}",
    "costTime": 180000,
    "completeTime": 1757584164490
  }
}
```

## Database Configuration

### Environment Variables

```bash
# Custom database file location (optional)
KIE_AI_DB_PATH=./custom_tasks.db

# Default: ./tasks.db in current working directory
```

### Database Behavior

- **Auto-initialization**: Creates tables and indexes on first run
- **Indexing**: Optimized queries on `task_id` and `status` fields
- **Thread-safe**: Uses SQLite serialization for concurrent access
- **Persistent**: Data survives server restarts
- **Inspectable**: Can be opened with any SQLite client tool

## Smart Status Checking

The `get_task_status` tool uses intelligent routing:

1. **Query Local Database**: Fast lookup of task metadata
2. **API Status Check**: Calls appropriate endpoint based on `api_type`
3. **Database Update**: Stores latest status from API response
4. **Combined Response**: Merges local and API data for complete picture

## API Type Routing

The database `api_type` field determines which Kie.ai endpoint to query:

| api_type | Endpoint | Purpose |
|----------|----------|---------|
| `veo3` | `/veo/record-info` | Veo3 video generation |
| `sora` | `/jobs/recordInfo` | Sora 2 video generation |
| `nano-banana` | `/jobs/recordInfo` | Image generation |
| `nano-banana-edit` | `/jobs/recordInfo` | Image editing |
| `nano-banana-upscale` | `/jobs/recordInfo` | Image upscaling |
| `suno` | `/generate/record-info` | Music generation |
| `elevenlabs-tts` | `/jobs/recordInfo` | Text-to-speech |
| `elevenlabs-sound-effects` | `/jobs/recordInfo` | Sound effects |
| `bytedance-seedance-video` | `/jobs/recordInfo` | Video generation |
| `bytedance-seedream-image` | `/jobs/recordInfo` | Image generation/editing |
| `qwen-image` | `/jobs/recordInfo` | Image generation/editing |
| `runway-aleph-video` | `/jobs/recordInfo` | Video-to-video transformation |
| `midjourney-generate` | `/jobs/recordInfo` | Image/video generation |
| `wan-video` | `/jobs/recordInfo` | Video generation |
| `hailuo-video` | `/jobs/recordInfo` | Video generation |
| `kling-v2-1-pro` | `/jobs/recordInfo` | Video generation (start+end frames) |
| `kling-v2-5-turbo-text-to-video` | `/jobs/recordInfo` | Video generation (text-to-video) |
| `kling-v2-5-turbo-image-to-video` | `/jobs/recordInfo` | Video generation (image-to-video) |
| `openai-4o-image` | `/jobs/recordInfo` | Image generation/editing/variants |
| `flux-kontext-image` | `/jobs/recordInfo` | Image generation/editing |
| `recraft-remove-background` | `/jobs/recordInfo` | Background removal |
| `ideogram-reframe` | `/jobs/recordInfo` | Image reframing |

## Task Status Values

- **`pending`**: Task created, waiting for API processing
- **`processing`**: API is actively processing the task
- **`completed`**: Task finished successfully, result available
- **`failed`**: Task failed, error message available

## Best Practices

- **Use `list_tasks`** to get overview of all generation activity
- **Use `get_task_status`** for detailed progress tracking
- **Monitor `updated_at`** to see when status last changed
- **Check `error_message`** for failed tasks to debug issues
- **Use `result_url`** to access completed generation results
- **Filter by status** when listing tasks to focus on specific states
- **Set appropriate limits** to avoid overwhelming responses with large task histories

## Inspecting the Database

You can inspect the SQLite database directly with any SQLite client:

```bash
# Using sqlite3 command-line tool
sqlite3 tasks.db

# Query examples
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) FROM tasks WHERE status = 'completed';
SELECT api_type, COUNT(*) FROM tasks GROUP BY api_type;
```

## Future Enhancements

Potential improvements to the database system:

- **Task Expiration**: Automatic cleanup of old completed tasks
- **User Association**: Multi-user support with user_id field
- **Task Metadata**: Additional fields for parameters, model versions, etc.
- **Statistics**: Analytics and usage tracking tables
- **Batch Operations**: Bulk status updates and cleanup operations
- **Search**: Full-text search across task parameters and results
