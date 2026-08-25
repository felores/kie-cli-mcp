# Wan 3.0 Video API

Verified: 2026-08-25

Source: <https://docs.kie.ai/market/wan/3-0-video>

## Endpoint

- Method: `POST`
- Path: `/api/v1/jobs/createTask`
- Model: `wan/3-0-video`
- Authentication: Bearer token
- Status endpoint: unified job task detail endpoint

## Request envelope

```json
{
  "model": "wan/3-0-video",
  "callBackUrl": "https://example.com/callback",
  "input": {
    "prompt": "A cinematic scene",
    "resolution": "1080P",
    "aspect_ratio": "adaptive",
    "duration": 5,
    "audio": true
  }
}
```

`callBackUrl` is optional. Kie.ai recommends callbacks for production use.

## Input contract

| Parameter | Type | Constraints |
| --- | --- | --- |
| `prompt` | string | Up to 20,000 characters. Required for text-only generation. |
| `first_frame_url` | URL | One image. Cannot be combined with `reference_*_urls`. |
| `last_frame_url` | URL | One image used with `first_frame_url`. Cannot be combined with `reference_*_urls`. |
| `reference_image_urls` | URL[] | Up to 10 images, addressed as Image1, Image2, and so on. |
| `reference_video_urls` | URL[] | Up to 5 clips. Each 1-15 seconds, combined input duration up to 15 seconds. |
| `reference_audio_urls` | URL[] | Up to 5 clips. Each 1-15 seconds, combined input duration up to 15 seconds. |
| `reference_file_urls` | URL[] | Up to 1 document, maximum 100 MB and 50 pages for paged formats. Mutually exclusive with link and keyframe inputs. |
| `reference_link_urls` | URL[] | Up to 1 public webpage without login. Mutually exclusive with file and keyframe inputs. |
| `resolution` | string | `480P`, `720P`, or `1080P`. Default `1080P`. |
| `aspect_ratio` | string | `adaptive`, `16:9`, `4:3`, `1:1`, `3:4`, or `9:16`. Default `adaptive`. |
| `duration` | integer | `2` through `30`, or `-1` for smart duration. With video input, input plus output duration must not exceed 30 seconds. |
| `audio` | boolean | Include an audio track. Default `true`. |
| `seed` | integer | `0` through `2147483647`. |
| `nsfw_checker` | boolean | Optional provider content filter control. |

Image inputs support JPEG/JPG, PNG without transparency, BMP, and WEBP up to 20 MB. Video inputs support MP4 and MOV up to 100 MB each. Audio inputs support WAV and MP3 up to 15 MB each.

## Response

Successful task creation returns code `200` and `data.taskId`. Completion callbacks expose `resultJson` as a JSON string containing `resultUrls`.
