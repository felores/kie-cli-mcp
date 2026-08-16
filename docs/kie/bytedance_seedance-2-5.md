# ByteDance Seedance 2.5 - Video Generation

> **Official API Docs**: https://docs.kie.ai/market/bytedance/seedance-2-5
> **Endpoint**: `POST /api/v1/jobs/createTask`
> **Model ID**: `bytedance/seedance-2-5`
> **MCP Tool**: `bytedance_seedance_video`

## Overview

Seedance 2.5 generates video from a text prompt, first/last frame images, or
multimodal image, video, and audio references. It supports optional audio
generation and returning the generated last frame.

## Input Scenarios

1. **Text-to-video**: `prompt`
2. **Image-to-video, first frame**: `prompt` + `first_frame_url`
3. **Image-to-video, first and last frames**: `prompt` + `first_frame_url` + `last_frame_url`
4. **Multimodal reference-to-video**: `prompt` with one or more of `reference_image_urls`, `reference_video_urls`, or `reference_audio_urls`

Frame inputs and multimodal reference inputs are mutually exclusive.
`last_frame_url` requires `first_frame_url`.

## Inputs

| Parameter | Type | Description |
| --- | --- | --- |
| `prompt` | string | Text description of the requested video. |
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

The official documentation does not specify alternate model modes, input count
limits, or defaults for these fields. This integration does not impose them.

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
