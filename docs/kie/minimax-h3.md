# MiniMax H3 (Hailuo 03) Video Generation

> **MCP/CLI Tool**: `hailuo_video`
> **Endpoint**: `POST /api/v1/jobs/createTask`
> **Models**: `minimax-h3/text-to-video`, `minimax-h3/image-to-video`, `minimax-h3/reference-to-video`

`hailuo_video` retains its public name for compatibility while using MiniMax H3,
also called Hailuo 03. The tool selects one of three mutually exclusive modes
from its inputs.

## Modes

1. **Text-to-video**: `prompt`, `duration`, and `aspectRatio`.
2. **Image-to-video**: `prompt`, `imageUrl` (first frame), optional
   `endImageUrl` (last frame), and `duration`.
3. **Reference-to-video**: `prompt`, `duration`, and one or more of
   `referenceImageUrls`, `referenceVideoUrls`, or `referenceAudioUrls`.
   `aspectRatio` is optional in this mode and also accepts `adaptive`.

Image-to-video cannot be combined with any reference inputs. `endImageUrl`
requires `imageUrl`. Text-to-video does not accept `adaptive`.

## Public Parameters

| Parameter | Type | Modes | Notes |
|---|---|---|---|
| `prompt` | string | all | Required video instruction. |
| `duration` | integer | all | Required, 4-15 seconds. |
| `aspectRatio` | enum | text, reference | Text: `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`. Reference also permits `adaptive`. |
| `imageUrl` | URL | image | First-frame image. Sent as `first_frame_url`. |
| `endImageUrl` | URL | image | Optional last-frame image. Sent as `last_frame_url`. |
| `referenceImageUrls` | URL[] | reference | 1-9 image references. |
| `referenceVideoUrls` | URL[] | reference | 1-3 video references. |
| `referenceAudioUrls` | URL[] | reference | 1-3 audio references. |
| `callBackUrl` | URL | all | Optional completion callback. |

## Payload Mapping

```json
{
  "model": "minimax-h3/image-to-video",
  "input": {
    "prompt": "The subject turns toward the camera as it slowly pushes in.",
    "first_frame_url": "https://example.com/first-frame.jpg",
    "last_frame_url": "https://example.com/last-frame.jpg",
    "duration": 6
  }
}
```

The client converts camelCase public arguments to the snake_case fields required
by Kie.ai. Legacy Hailuo 02/2.3 `version`, `quality`, `resolution`, and
`promptOptimizer` parameters are not supported by MiniMax H3.

## Sources

- [MiniMax H3 Text-to-Video](https://docs.kie.ai/market/minimax-h3/text-to-video)
- [MiniMax H3 Image-to-Video](https://docs.kie.ai/market/minimax-h3/image-to-video)
- [MiniMax H3 Reference-to-Video](https://docs.kie.ai/market/minimax-h3/reference-to-video)
- [MiniMax H3 overview](https://kie.ai/minimax-h3)
