---
description: Video generation and editing guidance
---

# Video Generation and Editing Tools

This guide provides information about available video generation and editing models and their capabilities.

## Available Video Models (users can disable each tool individually)

### Primary Generation Models
- **bytedance_seedance_video**: Seedance 2.5 text-to-video, first/last frame, and multimodal reference-to-video
- **kling_v2_1_pro**: Controlled motion with CFG adjustment
- **kling_v2_5_turbo**: Fast generation for quick iterations

### Premium Models
- **veo3**: Cinematic quality video generation
- **sora_2**: OpenAI's advanced video model with multiple modes
- **sora_2_pro**: Premium quality with extended duration

### Specialized Models
- **midjourney**: Image-to-video with motion control
- **runway_aleph**: Video editing and enhancement
- **wan**: Fast generation with prompt optimization
- **hailuo**: Quick generation with built-in prompt optimizer

## Model Capabilities Overview

| Model | Text-to-Video | Image-to-Video | Start→End | Video Editing | Duration | Resolution | Quality |
|-------|---------------|----------------|-----------|---------------|----------|------------|---------|
| bytedance_seedance_2_5 | ✅ | ✅ | ✅ | ❌ | Provider-defined | Example: 720p | Single model |
| kling_v2_1 | ✅ | ✅ | ✅ | ❌ | 5/10s | Fixed | Very Good |
| kling_v2_5 | ✅ | ✅ | ❌ | ❌ | 5/10s | Fixed | Good |
| veo3_fast | ✅ | ✅ | ✅ | ❌ | ~8s | Fixed | Premium |
| sora_2 | ✅ | ✅ | ✅ | ❌ | 10/15s | 480p/1080p | Premium |
| sora_2_pro | ✅ | ✅ | ✅ | ✅ | 10/15/25s | 480p/1080p | Premium |
| midjourney | ❌ | ✅ | ❌ | ❌ | Auto | Fixed | Very Good |
| runway_aleph | ❌ | ❌ | ❌ | ✅ | Auto | Fixed | High |
| wan | ✅ | ✅ | ❌ | ❌ | 5s | 480-1080p | Good |
| hailuo | ✅ | ✅ | ❌ | ❌ | 5-6s | Fixed | Good/High |

## Input Types and Modes

### Text-to-Video
- Requires only text description
- Available on most models
- Default generation mode

### Image-to-Video
- Requires 1 image + text description
- Available on most models
- For animating existing images

### Start→End Transition
- Requires 2 images + text description
- Creates transition between start and end frames
- Available on select models (bytedance, veo3, sora)

### Video Editing
- Requires video file + text instructions
- Available only on runway_aleph
- For editing existing video content

### Storyboard Mode
- Multiple images only (no text)
- Available on sora_2_pro
- Creates video from image sequence

## Technical Features

### Camera Control
- Fixed camera angles available on some models
- Motion control for dynamic scenes

### Prompt Optimization
- Built-in optimization on select models
- Automatic prompt enhancement available

### Duration Options
- Short clips (5-6s) for quick content
- Medium clips (10-15s) for standard content
- Extended clips (25s) for premium content

## Resolution Support
- Standard definition (720p) for quick generation
- High definition (1080p) for professional quality
- Some models support resolution selection
