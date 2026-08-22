# ByteDance Seedance 2.5 - Video Generation

> **Official API Docs**: https://docs.kie.ai/market/bytedance/seedance-2-5
> **Endpoint**: `POST /api/v1/jobs/createTask`
> **Model ID**: `bytedance/seedance-2-5`
> **MCP Tool**: `bytedance_seedance_video`
> **Continuation evidence**: https://github.com/felores/kie-cli-mcp/pull/8#issuecomment-5381694367

## Overview

Seedance 2.5 generates video from a text prompt, first/last frame images, or
multimodal image, video, and audio references. It supports optional audio
generation and returning the generated last frame. Kie.ai also accepts an
undocumented `extension_task_id` input that can provide semantic context from a
previous Seedance task.

## Input Scenarios

1. **Text-to-video**: `prompt`
2. **Experimental semantic continuation**: `prompt` + `extension_task_id`
3. **Image-to-video, first frame**: `prompt` + `first_frame_url`
4. **Image-to-video, first and last frames**: `prompt` + `first_frame_url` + `last_frame_url`
5. **Multimodal reference-to-video**: `prompt` with one or more of `reference_image_urls`, `reference_video_urls`, or `reference_audio_urls`

Frame inputs and multimodal reference inputs are mutually exclusive.
`last_frame_url` requires `first_frame_url`.

## Inputs

| Parameter | Type | Description |
| --- | --- | --- |
| `prompt` | string | Text description of the requested video. |
| `extension_task_id` | string | Optional, experimental previous Seedance task ID used as semantic continuation context. |
| `first_frame_url` | string | Optional first-frame image URL. |
| `last_frame_url` | string | Optional last-frame image URL. Requires `first_frame_url`. |
| `reference_image_urls` | string[] | Optional multimodal reference image URLs. |
| `reference_video_urls` | string[] | Optional multimodal reference video URLs. |
| `reference_audio_urls` | string[] | Optional multimodal reference audio URLs. |
| `return_last_frame` | boolean | Optional request to return the generated last frame. |
| `generate_audio` | boolean | Optional audio generation setting. |
| `resolution` | string | Optional output resolution. The official example uses `720p`. |
| `aspect_ratio` | string | Optional output aspect ratio. |
| `duration` | integer | Optional duration in seconds. The official example uses `15`. |
| `callBackUrl` | string | Optional Kie task-completion callback URL. |

The public API schema does not specify alternate model modes or
`extension_task_id`. Provider limits and defaults can change, so this
integration does not inject values that callers omit.

## Experimental Task Continuation

`extension_task_id` is accepted by Kie.ai inside the request `input` object but
is not included in the public Seedance 2.5 API schema. Production reports show
that it can carry semantic context from a previous task, such as subject or
setting, but it does not guarantee that the new video's first frame matches the
previous video's last frame.

Use `first_frame_url` with an extracted final frame when visual continuity is
required. Because `extension_task_id` is undocumented, its behavior may change
without notice.

```json
{
  "model": "bytedance/seedance-2-5",
  "input": {
    "prompt": "Continue the scene with the same subject and setting",
    "extension_task_id": "previous-seedance-task-id",
    "duration": 5
  }
}
```

## Request Example

```json
{
  "model": "bytedance/seedance-2-5",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A serene beach at sunset with waves gently crashing on the shore",
    "reference_image_urls": ["https://example.com/reference.png"],
    "reference_video_urls": ["https://example.com/reference.mp4"],
    "reference_audio_urls": ["https://example.com/reference.mp3"],
    "return_last_frame": false,
    "generate_audio": false,
    "resolution": "720p",
    "aspect_ratio": "16:9",
    "duration": 15
  }
}
```
