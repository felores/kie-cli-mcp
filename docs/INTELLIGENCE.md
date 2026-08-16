# Intelligent Features & Intention Detection

The Kie.ai MCP Server features advanced **intention detection algorithms** that automatically understand user requirements and optimize both cost and quality without manual configuration.

## 🎯 Quality & Cost Optimization

### Automatic Quality Detection

The system analyzes user language to determine quality requirements:

```typescript
// Source: src/kie-ai-client.ts:224-232
const quality = request.quality || 'lite';
let model: string;
if (isImageToVideo) {
  model = quality === 'pro' ? 'bytedance/v1-pro-image-to-video' : 'bytedance/v1-lite-image-to-video';
} else {
  model = quality === 'pro' ? 'bytedance/v1-pro-text-to-video' : 'bytedance/v1-lite-text-to-video';
}
```

**User Language → System Action**:
- `"high quality"`, `"professional"`, `"premium"` → Pro models + 1080p
- `"fast"`, `"quick"`, `"social media"` → Lite models + 720p  
- No quality mentioned → Lite models + 720p (cost-effective default)

### Dynamic Endpoint Routing

Quality parameters automatically map to optimal endpoints:

| Quality Parameter | Text-to-Video Endpoint | Image-to-Video Endpoint |
|------------------|----------------------|-----------------------|
| `"lite"` | `bytedance/v1-lite-text-to-video` | `bytedance/v1-lite-image-to-video` |
| `"pro"` | `bytedance/v1-pro-text-to-video` | `bytedance/v1-pro-image-to-video` |

## 🔧 Unified Tool Architecture

### Smart Mode Detection

Single tools automatically detect operation mode based on parameter combinations:

```typescript
// Source: src/types.ts:146-166 (Nano Banana example)
.refine((data) => {
  const hasPrompt = !!data.prompt;
  const hasImage = !!data.image_urls;
  const hasMask = !!data.mask_url;
  
  if (hasImage && hasMask) return hasPrompt; // Edit mode
  else if (hasImage) return true;             // Variants mode  
  else return hasPrompt;                     // Generate mode
});
```

**Unified Tools with Auto-Detection**:
- **`nano_banana_image`**: Generate/Edit/Upscale based on parameters
- **`bytedance_seedance_video`**: Text-to-video, frame-to-video, or multimodal reference-to-video based on snake_case inputs
- **`openai_4o_image`**: Generate/Edit/Variants based on `filesUrl` and `maskUrl` combination
- **`qwen_image`**: Text-to-image vs Image editing based on `image_url` presence
- **`sora_video`**: Text-to-video/Image-to-video/Storyboard based on `filesUrl` presence
- **`hailuo_video`**: Text-to-video vs Image-to-video based on `image_url` presence
- **`kling_video`**: Text-to-video vs Image-to-video based on `image_url` presence
- **`bytedance_seedream_image`**: Text-to-image vs Image editing based on `image_url` presence
- **`flux_kontext_image`**: Generate/Edit based on `imageUrls` presence

### Mode Detection Examples

#### Image Tools

**Nano Banana - Three Modes:**
```typescript
// Generate mode
{ "prompt": "A cat" }

// Edit mode  
{ "prompt": "Add glasses", "image_urls": ["url"], "mask_url": "mask" }

// Variants mode
{ "image_urls": ["url"] }
```

**OpenAI 4o - Three Modes:**
```typescript
// Generate mode
{ "prompt": "A sunset" }

// Edit mode
{ "prompt": "Remove clouds", "filesUrl": ["url"], "maskUrl": "mask" }

// Variants mode
{ "filesUrl": ["url"], "n": 4 }
```

#### Video Tools

**ByteDance Seedance 2.5 - Three Input Scenarios:**
```typescript
// Text-to-video mode
{ "prompt": "A dancing robot" }

// Image-to-video mode
{ "prompt": "Animate this", "first_frame_url": "url" }

// Multimodal reference-to-video mode
{ "prompt": "Use these references", "reference_image_urls": ["url"] }
```

**Sora 2 - Three Modes:**
```typescript
// Text-to-video mode
{ "prompt": "A peaceful garden" }

// Image-to-video mode
{ "prompt": "Animate", "filesUrl": ["url"] }

// Storyboard mode
{ "prompt": "Create sequence", "filesUrl": ["url1", "url2", "url3"] }
```

## 📊 Intelligent Task Management

### Smart Status Routing

The system automatically routes status checks to correct API endpoints based on task type:

```typescript
// Source: src/index.ts:1155-1175
switch (task.api_type) {
  case 'veo3': 
    return this.makeRequest(`/veo/record-info?taskId=${taskId}`, 'GET');
  case 'suno': 
    return this.makeRequest(`/generate/record-info?taskId=${taskId}`, 'GET');
  case 'bytedance-seedance-video':
  case 'midjourney-generate':
    return this.makeRequest(`/jobs/recordInfo?taskId=${taskId}`, 'GET');
}
```

### Database-Driven Intelligence

Local SQLite database provides intelligent caching and routing:

```sql
-- Source: README.md database schema
CREATE TABLE tasks (
  task_id TEXT UNIQUE NOT NULL,
  api_type TEXT NOT NULL,  -- Enables intelligent endpoint routing
  status TEXT DEFAULT 'pending',
  result_url TEXT,
  -- ... other fields
);
```

**Benefits:**
- **Fast Lookups**: Local database cache reduces API calls
- **Smart Routing**: `api_type` determines correct endpoint automatically
- **Audit Trail**: Complete history of all generation tasks
- **Persistence**: Task data survives server restarts

## 💡 Cost Control by Design

### Default to Savings

- **Resolution**: Defaults to `"720p"` (API defaults to 1080p - explicit setting prevents cost overruns)
- **Quality**: Defaults to `"lite"` (2-3x cheaper than pro versions)
- **Models**: Defaults to faster variants unless premium quality requested

### Explicit Upgrade Required

Users must explicitly request higher quality:
- `"high quality"` → Automatic upgrade to pro models + 1080p
- `"high quality in 720p"` → Pro models + cost-effective resolution
- `"professional"` → Pro models + balanced resolution

### Cost Optimization Examples

| User Request | Quality | Resolution | Cost Level |
|--------------|---------|-----------|-----------|
| "Quick video" | lite | 720p | Lowest (1x) |
| "Social media video" | lite | 720p | Lowest (1x) |
| "Professional video" | pro | 1080p | Highest (4-6x) |
| "High quality 720p" | pro | 720p | Medium (2-3x) |
| Default (no quality) | lite | 720p | Lowest (1x) |

## 🔍 Verifiable Intelligence

All intelligent behaviors are implemented in the codebase:

| Feature | Source File | Line Numbers |
|---------|------------|--------------|
| Quality Detection | `src/kie-ai-client.ts` | 224-232 |
| Mode Detection (Nano Banana) | `src/types.ts` | 146-166 |
| Mode Detection (OpenAI 4o) | `src/types.ts` | 490-520 |
| Endpoint Routing | `src/index.ts` | 1155-1175 |
| Schema Validation | `src/types.ts` | All tool schemas |
| Database Integration | `src/database.ts` | Full file |

This system ensures **optimal user experience** while maintaining **cost control** and **technical accuracy** - users get what they want without needing to understand the underlying complexity.

## 🚀 Real-World Intelligence Examples

### Example 1: Video Generation Request

**User Input:**
```
"Make a quick social media video of a sunset"
```

**System Automatically Chooses:**
- **Tool**: `bytedance_seedance_video` (default video model)
- **Input scenario**: Text-to-video
- **Endpoint**: `bytedance/seedance-2-5` through `/jobs/createTask`
- **Parameters**: Supply only requested options; Seedance 2.5 has no server-imposed defaults

**Cost**: Check current provider pricing before submission

---

### Example 2: Professional Quality Request

**User Input:**
```
"I need a high quality video for a client presentation"
```

**System Automatically Chooses:**
- **Tool**: `bytedance_seedance_video` (default video model)
- **Input scenario**: Text-to-video or a documented frame/reference scenario
- **Endpoint**: `bytedance/seedance-2-5` through `/jobs/createTask`
- **Parameters**: Use the requested resolution and duration; do not infer unsupported quality tiers

**Cost**: Check current provider pricing before submission

---

### Example 3: Specific Quality Requirements

**User Input:**
```
"Generate a professional video but keep it 720p to save costs"
```

**System Automatically Chooses:**
- **Tool**: `bytedance_seedance_video`
- **Resolution**: `"720p"` (explicitly requested)
- **Endpoint**: `bytedance/seedance-2-5` through `/jobs/createTask`

**Cost**: Check current provider pricing before submission

---

### Example 4: Unified Tool Intelligence

**User Input:**
```json
{
  "tool": "nano_banana_image",
  "arguments": {
    "prompt": "Add sunglasses to the person",
    "image_urls": ["https://example.com/portrait.jpg"]
  }
}
```

**System Automatically Detects**: 
- **Mode**: Edit Mode (prompt + image_urls present)
- **Endpoint**: `/jobs/createTask` with edit-specific parameters
- **API Type**: `nano-banana-edit` (stored in database)

---

### Example 5: Smart Status Monitoring

**User Input:**
```json
{
  "tool": "get_task_status",
  "arguments": {
    "task_id": "abc123"
  }
}
```

**System Automatically:**
1. **Queries database**: Gets `api_type: "bytedance-seedance-video"`
2. **Routes to correct endpoint**: `/jobs/recordInfo?taskId=abc123`
3. **Updates local record**: Syncs API response with database
4. **Returns combined data**: Merges local + API information

**Result**: Single tool call provides complete status without user needing to know API internals

---

### Example 6: Multi-Mode Tool Selection

**User Input:**
```json
{
  "tool": "openai_4o_image",
  "arguments": {
    "filesUrl": ["https://example.com/photo.jpg"],
    "n": 4
  }
}
```

**System Automatically Detects**:
- **Mode**: Variants Mode (filesUrl present, no maskUrl)
- **Behavior**: Generate 4 variations of the input image
- **Parameters**: Automatically omits generation-only fields
- **API Type**: `openai-4o-image` (stored in database)

---

## Benefits of Intelligent Design

### For Users
- **No Technical Knowledge Required**: Just describe what you want
- **Automatic Cost Optimization**: Defaults to cheapest options
- **Explicit Quality Upgrades**: Only pay more when you ask for it
- **Single Tools**: No need to remember separate tools for generate/edit/upscale

### For Developers
- **Unified Schemas**: Single Zod schema per tool handles all modes
- **Smart Validation**: Business logic in refine() ensures valid combinations
- **Type Safety**: TypeScript catches errors at compile time
- **Maintainability**: One tool to update instead of three

### For Administrators
- **Cost Predictability**: Default behaviors prevent surprise charges
- **Audit Trail**: Database tracks all API usage and costs
- **Intelligent Routing**: System handles endpoint selection automatically
- **Error Prevention**: Schema validation catches invalid requests before API calls
