# Missing Kie.ai Endpoints

> **Last Updated**: 2025-12-08
> **Purpose**: Track Kie.ai API endpoints not yet implemented in the MCP server
> **Current Implementation**: 23 tools

---

## Priority 1: High Value / New Features

### Grok Imagine (xAI Multimodal)
**Kie.ai URL**: https://kie.ai/grok-imagine
**Provider**: xAI
**Type**: Image & Video Generation

**Key Features**:
- Text-to-video generation
- Image-to-video generation
- Audio synchronized output
- Short visual content creation

**Suggested Tool**: `grok_imagine`

---

### Hailuo 2.3 (High-Fidelity Video)
**Kie.ai URL**: https://kie.ai/hailuo-2-3
**Provider**: MiniMax
**Type**: Video Generation

**Key Features**:
- Higher fidelity than Hailuo 2.0
- Realistic motion and expressions
- Complex movement handling
- Text-to-video and image-to-video

**Suggested Tool**: Update existing `hailuo_video` to support 2.3

---

### Z-Image (Fast Turbo Image)
**Kie.ai URL**: https://kie.ai/z-image
**Provider**: Qwen/Tongyi-MAI
**Type**: Image Generation

**Key Features**:
- Photorealistic output
- Fast Turbo performance mode
- Bilingual text rendering (Chinese/English)
- Strong semantic understanding
- Text-to-image, image-to-image, editing

**Suggested Tool**: `z_image`

---

## Priority 2: Lip Sync / Avatar

### InfiniTalk (AI Lip Sync)
**Kie.ai URL**: https://kie.ai/infinitalk
**Provider**: MeiGen-AI
**Type**: Lip Sync Video

**Models**:
- `infinitalk/from-audio` - Image + audio to talking video

**Parameters**:
- `image_url` (string, required): Portrait image URL
- `audio_url` (string, required): Audio file URL
- `prompt` (string, required): Text prompt for guidance
- `resolution` (enum): "480p" | "720p"
- `seed` (number, optional): 10000-1000000

**Pricing**:
| Resolution | Credits/sec | USD/sec |
|------------|-------------|---------|
| 480p | 3 | ~$0.015 |
| 720p | 12 | ~$0.06 |

**Key Features**:
- Image-to-talking-video
- Precise lip synchronization
- Natural facial expressions
- Infinite-length video support
- Built on Wan 2.1 backbone

**Suggested Tool**: `infinitalk_lipsync`

---

### Kling AI Avatar (Talking Avatar)
**Kie.ai URL**: https://kie.ai/kling-ai-avatar
**Provider**: Kling/Kuaishou
**Type**: Avatar Video

**Models**:
- `kling/v1-avatar-standard` - 720p output
- `kling/ai-avatar-v1-pro` - 1080p output

**Parameters**:
- `image_url` (string, required): Avatar image URL
- `audio_url` (string, required): Audio file URL
- `prompt` (string, required): Generation guidance

**Pricing**:
| Quality | Resolution | Credits/sec | USD/sec |
|---------|------------|-------------|---------|
| Standard | 720p | 8 | ~$0.04 |
| Pro | 1080p | 16 | ~$0.08 |

**Key Features**:
- Lifelike talking avatars
- Prompt-based emotion/expression control
- Accurate lip sync
- Identity consistency
- Up to 15 seconds per generation

**Suggested Tool**: `kling_avatar`

---

## Priority 3: Audio / Utility

### ElevenLabs Speech-to-Text (Scribe v1)
**Kie.ai URL**: https://kie.ai/elevenlabs-speech-to-text
**Provider**: ElevenLabs
**Type**: Speech Recognition

**Model**: `elevenlabs/speech-to-text`

**Parameters**:
- `audio_url` (string, required): Audio file URL (max 200MB)
- `language_code` (string, optional): Language code
- `tag_audio_events` (boolean, optional): Tag laughter, applause, etc.
- `diarize` (boolean, optional): Speaker identification (up to 32 speakers)

**Pricing**: 3.5 credits/minute (~$0.0175)

**Key Features**:
- 99 language support
- Industry-leading accuracy (3.3% WER English)
- Speaker diarization (up to 32 speakers)
- Audio event tagging
- Character-level timestamps

**Suggested Tool**: `elevenlabs_stt`

---

### Suno Vocal Separation
**Kie.ai URL**: https://docs.kie.ai/suno-api/separate-vocals
**Provider**: Suno
**Type**: Audio Processing

**Key Features**:
- Split tracks into vocal/instrument stems
- State-of-the-art source separation
- Clean isolated outputs

**Suggested Tool**: `suno_separate_vocals`

---

### Suno Audio Cover
**Kie.ai URL**: https://docs.kie.ai/suno-api/upload-and-cover-audio
**Provider**: Suno
**Type**: Audio Processing

**Key Features**:
- Transform audio to new style
- Preserve core melody
- Upload and process custom audio

**Suggested Tool**: `suno_cover_audio`

---

## Priority 4: Video Variants / Updates

### Seedance 1.0 Pro Fast
**Kie.ai URL**: https://kie.ai/seedance-1-0-pro-fast
**Provider**: ByteDance
**Type**: Video Generation

**Key Features**:
- 3x faster than Seedance 1.0 Pro
- Maintains Pro quality
- 1080p output
- Efficient compute performance

**Suggested Tool**: Superseded by `bytedance_seedance_video` on Seedance 2.5; it has no documented fast mode.

---

### Sora 2 Watermark Remove
**Kie.ai URL**: https://kie.ai/sora-2-watermark-remover
**Provider**: OpenAI
**Type**: Video Editing

**Key Features**:
- AI watermark detection
- Motion tracking removal
- Smooth frame preservation
- 1-3 seconds processing

**Suggested Tool**: `sora_remove_watermark`

---

### Ideogram V3 Full Suite
**Kie.ai URL**: https://kie.ai/ideogram/v3
**Provider**: Ideogram
**Type**: Image Generation

**Currently Implemented**: `ideogram_reframe` (reframe only)

**Missing Modes**:
- Text-to-image generation
- Image editing
- Remix
- Image-to-image

**Suggested Tool**: `ideogram_v3_image` (unified tool with mode detection)

---

## Implementation Priority Order

1. **ElevenLabs STT** - Complements existing TTS tools
2. **InfiniTalk** - New capability (lip sync)
3. **Kling Avatar** - New capability (talking avatars)
4. **Grok Imagine** - New provider (xAI)
5. **Z-Image** - New Qwen image model
6. **Hailuo 2.3** - Upgrade existing tool
7. **Suno Vocal Separation** - Extends Suno capabilities
8. **Suno Audio Cover** - Extends Suno capabilities
9. **Seedance 1.0 Pro Fast** - Add fast mode
10. **Ideogram V3 Full** - Expand existing reframe tool
11. **Sora Watermark Remove** - Utility tool

### Recently Implemented
- ✅ **Seedream 4.5** - 4K output support added 2025-12-08
- ✅ **Kling 2.6** - Native audio support added 2025-12-08

---

## Notes

- Some endpoints may be updates to existing tools rather than new tools
- Pricing information is from 2025-12-06 and may change
- Check https://kie.ai/market for the latest available models
- Follow `docs/ADD_TOOL_GUIDE.md` workflow for implementation
