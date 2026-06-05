# Kie.ai MCP Server - Complete Tool Reference

This document provides detailed documentation for all 21 AI tools available in the Kie.ai MCP Server.

## Table of Contents

- [Utility Tools](#utility-tools)
  - [list_tasks](#1-list_tasks)
  - [get_task_status](#2-get_task_status)
- [Image Tools](#image-tools)
  - [nano_banana_image](#3-nano_banana_image)
  - [bytedance_seedream_image](#11-bytedance_seedream_image)
  - [qwen_image](#12-qwen_image)
  - [openai_4o_image](#18-openai_4o_image)
  - [flux_kontext_image](#19-flux_kontext_image)
  - [flux2_image](#22-flux2_image)
  - [ideogram_reframe](#20-ideogram_reframe)
  - [recraft_remove_background](#21-recraft_remove_background)
- [Video Tools](#video-tools)
  - [sora_video](#4-sora_video)
  - [veo3_generate_video](#5-veo3_generate_video)
  - [veo3_get_1080p_video](#6-veo3_get_1080p_video)
  - [bytedance_seedance_video](#10-bytedance_seedance_video)
  - [runway_aleph_video](#13-runway_aleph_video)
  - [midjourney_generate](#14-midjourney_generate)
  - [wan_video](#15-wan_video)
  - [wan_animate](#23-wan_animate)
  - [hailuo_video](#16-hailuo_video)
  - [kling_video](#17-kling_video)
- [Audio Tools](#audio-tools)
  - [suno_generate_music](#7-suno_generate_music)
  - [elevenlabs_tts](#8-elevenlabs_tts)
  - [elevenlabs_ttsfx](#9-elevenlabs_ttsfx)

---

## Utility Tools

### 1. `list_tasks`
List recent tasks with their status.

**Parameters:**
- `limit` (integer, optional): Max tasks to return (default: 20, max: 100)
- `status` (string, optional): Filter by status ("pending", "processing", "completed", "failed")

**Example:**
```json
{
  "limit": 10,
  "status": "completed"
}
```

### 2. `get_task_status`
Check the status of a generation task.

**Parameters:**
- `task_id` (string, required): Task ID to check

**Example:**
```json
{
  "task_id": "281e5b0*********************f39b9"
}
```

---

## Image Tools

### 3. `nano_banana_image`
Generate, edit, and upscale images using Google's Gemini 3.0 Pro Image (Nano Banana Pro). Features 4K support, improved text rendering, and multi-reference consistency.

**Smart Mode Detection:**
- **Generate mode**: Provide `prompt` only
- **Edit mode**: Provide `prompt` + `image_urls`
- **Upscale mode**: Provide `image` (+ optional `scale`) - legacy

**Parameters:**
- `prompt` (string, optional): Text description for generate/edit modes (max 5000 chars)
- `image_urls` (array, optional): Reference images for edit mode (1-8 URLs)
- `image` (string, optional): URL of image for upscale mode (max 10MB, jpeg/png/webp)
- `scale` (integer, optional): Upscale factor for upscale mode, 1-4 (default: 2)
- `face_enhance` (boolean, optional): Enable face enhancement for upscale mode (default: false)
- `output_format` (string, optional): "png" or "jpg" (default: "png")
- `aspect_ratio` (string, optional): "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto" (default: "1:1")
- `resolution` (string, optional): "1K", "2K", "4K" (default: "1K")

**Pricing:** 1K/2K: ~$0.09, 4K: ~$0.12

**Examples:**

*Generate mode (4K):*
```json
{
  "prompt": "A surreal painting of a giant banana floating in space",
  "resolution": "4K",
  "aspect_ratio": "16:9"
}
```

*Edit mode with references:*
```json
{
  "prompt": "Add a rainbow arching over the mountains",
  "image_urls": ["https://example.com/ref1.jpg", "https://example.com/ref2.jpg"],
  "resolution": "2K"
}
```

*Upscale mode (legacy):*
```json
{
  "image": "https://example.com/image.jpg",
  "scale": 4,
  "face_enhance": true
}
```

### 1. `list_tasks`
List recent tasks with their status.

**Parameters:**
- `limit` (integer, optional): Max tasks to return (default: 20, max: 100)
- `status` (string, optional): Filter by status ("pending", "processing", "completed", "failed")

**Example:**
```json
{
  "limit": 10,
  "status": "completed"
}
```

### 2. `get_task_status`
Check the status of a generation task.

**Parameters:**
- `task_id` (string, required): Task ID to check

**Example:**
```json
{
  "task_id": "281e5b0*********************f39b9"
}
```

### 3. `nano_banana_image`
Generate, edit, and upscale images using Google's Gemini 3.0 Pro Image (Nano Banana Pro). Features 4K support, improved text rendering, and multi-reference consistency.

**Smart Mode Detection:**
- **Generate mode**: Provide `prompt` only
- **Edit mode**: Provide `prompt` + `image_urls`
- **Upscale mode**: Provide `image` (+ optional `scale`) - legacy

**Parameters:**
- `prompt` (string, optional): Text description for generate/edit modes (max 5000 chars)
- `image_urls` (array, optional): Reference images for edit mode (1-8 URLs)
- `image` (string, optional): URL of image for upscale mode (max 10MB, jpeg/png/webp)
- `scale` (integer, optional): Upscale factor for upscale mode, 1-4 (default: 2)
- `face_enhance` (boolean, optional): Enable face enhancement for upscale mode (default: false)
- `output_format` (string, optional): "png" or "jpg" (default: "png")
- `aspect_ratio` (string, optional): "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "auto" (default: "1:1")
- `resolution` (string, optional): "1K", "2K", "4K" (default: "1K")

**Pricing:** 1K/2K: ~$0.09, 4K: ~$0.12

**Examples:**

*Generate mode (4K):*
```json
{
  "prompt": "A surreal painting of a giant banana floating in space",
  "resolution": "4K",
  "aspect_ratio": "16:9"
}
```

*Edit mode with references:*
```json
{
  "prompt": "Add a rainbow arching over the mountains",
  "image_urls": ["https://example.com/ref1.jpg", "https://example.com/ref2.jpg"],
  "resolution": "2K"
}
```

*Upscale mode (legacy):*
```json
{
  "image": "https://example.com/image.jpg",
  "scale": 4,
  "face_enhance": true
}
```

### 4. `sora_video`
Generate videos using OpenAI's Sora 2 models (unified tool for text-to-video, image-to-video, and storyboard modes).

**Parameters:**
- `prompt` (string, optional): Text prompt for video generation (max 4000 chars, required for text-to-video and image-to-video modes)
- `image_url` (string, optional): URL of input image for image-to-video mode (if not provided, uses text-to-video)
- `storyboard_image_url` (string, optional): URL of storyboard image for storyboard mode (if not provided, uses text-to-video)
- `storyboard_prompt` (string, optional): Text prompt for storyboard mode (max 4000 chars, if not provided, uses text-to-video)
- `model` (string, optional): Model version (default: "sora-2")
  - Options: `sora-2` (standard), `sora-2-pro` (premium quality)
- `aspect_ratio` (string, optional): Video aspect ratio (default: "16:9")
  - Options: `16:9`, `9:16`, `1:1`
- `resolution` (string, optional): Video resolution (default: "720p")
  - `480p`: Faster generation
  - `720p`: Balanced quality and speed
  - `1080p`: Highest quality (pro model only)
- `duration` (string, optional): Video duration in seconds (default: "5")
  - Standard: 5-20 seconds
  - Pro: 5-20 seconds
- `seed` (integer, optional): Random seed for reproducible results (default: -1 for random)
- `watermark` (string, optional): Watermark text to add to the video (max 100 chars)
- `enable_translation` (boolean, optional): Auto-translate non-English prompts to English (default: true)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-video generation:
```json
{
  "prompt": "A serene Japanese garden with cherry blossoms falling gently around a tranquil koi pond. Soft morning light filters through the trees. No dialogue. Peaceful ambient audio with gentle water sounds and bird songs.",
  "model": "sora-2",
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "duration": "10",
  "seed": 42
}
```

Image-to-video generation:
```json
{
  "prompt": "The person in the portrait smiles warmly and looks around, then speaks with enthusiasm: 'Welcome to the future of AI video generation!'",
  "image_url": "https://example.com/portrait.jpg",
  "model": "sora-2-pro",
  "resolution": "1080p",
  "duration": "8"
}
```

Storyboard mode (no prompt required):
```json
{
  "storyboard_image_url": "https://example.com/storyboard-frame.jpg",
  "storyboard_prompt": "A cinematic tracking shot through a futuristic city with flying vehicles",
  "model": "sora-2-pro",
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "duration": "15"
}
```

**Key Features:**
- **Unified Interface**: Single tool for text-to-video, image-to-video, and storyboard modes
- **Smart Mode Detection**: Automatically detects mode based on provided parameters
  - Text-to-Video: `prompt` provided, no `image_url` or `storyboard_image_url`
  - Image-to-Video: `prompt` + `image_url` provided
  - Storyboard: `storyboard_image_url` provided (prompt optional)
- **Quality Tiers**: Standard for speed, Pro for premium quality
- **Flexible Resolutions**: 480p for speed, 720p for balance, 1080p for maximum quality
- **Aspect Ratio Control**: Support for horizontal, vertical, and square formats
- **Storyboard Mode**: Unique feature for creating videos from storyboard frames without prompts
- **Reproducible Results**: Seed control for consistent output
- **Translation Support**: Automatic translation for non-English prompts

**Model Selection Logic:**
- If `storyboard_image_url` provided → Storyboard mode
- If `image_url` provided → Image-to-video mode
- If `prompt` provided → Text-to-video mode
- Quality automatically determined by `model` parameter (`sora-2` vs `sora-2-pro`)

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Video generation typically takes 2-8 minutes depending on model quality, resolution, and duration.

### 5. `veo3_generate_video`
Generate videos using Veo3.

**Parameters:**
- `prompt` (string, required): Video description
- `imageUrls` (array, optional): Image for image-to-video (max 1)
- `model` (enum, optional): "veo3" or "veo3_fast" (default: "veo3")
- `aspectRatio` (enum, optional): "16:9", "9:16", or "Auto" (default: "16:9", only 16:9 supports 1080P)
- `seeds` (integer, optional): Random seed 10000-99999
- `watermark` (string, optional): Watermark text
- `callBackUrl` (string, optional): Callback URL for completion notifications
- `enableFallback` (boolean, optional): Enable fallback mechanism (default: false, fallback videos cannot use 1080P endpoint)
- `enableTranslation` (boolean, optional): Auto-translate prompts to English (default: true)

**Example:**
```json
{
  "prompt": "A dog playing in a park",
  "model": "veo3",
  "aspectRatio": "16:9",
  "seeds": 12345,
  "enableTranslation": true
}
```

### 6. `veo3_get_1080p_video`
Get 1080P high-definition version of a Veo3 video.

**Parameters:**
- `task_id` (string, required): Veo3 task ID to get 1080p video for
- `index` (integer, optional): Video index (for multiple video results)

**Note**: Not available for videos generated with fallback mode.

### 7. `suno_generate_music`
Generate music with AI using Suno models.

**Parameters:**
- `prompt` (string, required): Description of desired audio content (max 5000 chars for V4_5+, V5; 3000 for V3_5, V4; 500 chars for non-custom mode)
- `customMode` (boolean, required): Enable advanced parameter customization
- `instrumental` (boolean, required): Generate instrumental music (no lyrics)
- `model` (enum, optional): AI model version - "V3_5", "V4", "V4_5", "V4_5PLUS", or "V5" (default: "V5")
- `callBackUrl` (string, optional): URL to receive task completion updates (automatic fallback if not provided)
- `style` (string, optional): Music style/genre (required in custom mode, max 1000 chars for V4_5+, V5; 200 for V3_5, V4)
- `title` (string, optional): Track title (required in custom mode, max 80 chars)
- `negativeTags` (string, optional): Music styles to exclude (max 200 chars)
- `vocalGender` (enum, optional): Vocal gender preference - "m" or "f" (custom mode only)
- `styleWeight` (number, optional): Style adherence strength (0-1, up to 2 decimal places)
- `weirdnessConstraint` (number, optional): Creative deviation control (0-1, up to 2 decimal places)
- `audioWeight` (number, optional): Audio feature balance (0-1, up to 2 decimal places)

**Examples:**

With explicit callback URL:
```json
{
  "prompt": "A calm and relaxing piano track with soft melodies",
  "customMode": true,
  "instrumental": true,
  "model": "V5",
  "callBackUrl": "https://api.example.com/callback",
  "style": "Classical",
  "title": "Peaceful Piano Meditation"
}
```

Using automatic callback (no setup required):
```json
{
  "prompt": "A relaxing electronic music track",
  "customMode": false,
  "instrumental": false
}
```

Using explicit model (overrides default V5):
```json
{
  "prompt": "A relaxing electronic music track",
  "customMode": false,
  "instrumental": false,
  "model": "V4_5PLUS"
}
```

**Note**: In custom mode, `style` and `title` are required. If `instrumental` is false, `prompt` is used as exact lyrics. The `callBackUrl` is optional and uses automatic fallback if not provided. The `model` parameter defaults to "V5" but can be explicitly set to any available version.

### 8. `elevenlabs_tts`
Generate speech from text using ElevenLabs TTS models (Turbo 2.5 by default, with optional Multilingual v2 support).

**Parameters:**
- `text` (string, required): The text to convert to speech (max 5000 characters)
- `model` (enum, optional): TTS model to use - "turbo" (faster, default) or "multilingual" (supports context)
- `voice` (enum, optional): Voice to use - "Rachel", "Aria", "Roger", "Sarah", "Laura", "Charlie", "George", "Callum", "River", "Liam", "Charlotte", "Alice", "Matilda", "Will", "Jessica", "Eric", "Chris", "Brian", "Daniel", "Lily", "Bill" (default: "Rachel")
- `stability` (number, optional): Voice stability (0-1, step 0.01, default: 0.5)
- `similarity_boost` (number, optional): Similarity boost (0-1, step 0.01, default: 0.75)
- `style` (number, optional): Style exaggeration (0-1, step 0.01, default: 0)
- `speed` (number, optional): Speech speed (0.7-1.2, step 0.01, default: 1.0)
- `timestamps` (boolean, optional): Whether to return timestamps for each word (default: false)
- `previous_text` (string, optional): Text that came before current request (multilingual model only, max 5000 chars)
- `next_text` (string, optional): Text that comes after current request (multilingual model only, max 5000 chars)
- `language_code` (string, optional): ISO 639-1 language code for language enforcement (turbo model only, max 500 chars)
- `callBackUrl` (string, optional): URL to receive task completion updates (automatic fallback if not provided)

**Examples:**

Basic TTS generation (uses Turbo model by default):
```json
{
  "text": "Hello, this is a test of the ElevenLabs text-to-speech system.",
  "voice": "Rachel"
}
```

Fast generation with language enforcement (Turbo model):
```json
{
  "text": "Bonjour, comment allez-vous?",
  "voice": "Rachel",
  "model": "turbo",
  "language_code": "fr"
}
```

Advanced voice controls with context (Multilingual model):
```json
{
  "text": "This is the second part of our conversation.",
  "voice": "Roger",
  "model": "multilingual",
  "stability": 0.8,
  "similarity_boost": 0.9,
  "previous_text": "This is the first part of our conversation.",
  "next_text": "This is the third part of our conversation."
}
```

**Model Comparison:**
- **Turbo 2.5** (default): Faster generation (15-60 seconds), supports language enforcement with `language_code`
- **Multilingual v2**: Supports context with `previous_text`/`next_text`, generation takes 30-120 seconds

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Choose Turbo model for speed and language enforcement, or Multilingual model for context-aware speech generation.

### 9. `elevenlabs_ttsfx`
Generate sound effects from text descriptions using ElevenLabs Sound Effects v2 model.

**Parameters:**
- `text` (string, required): Description of the sound effect to generate (max 5000 chars)
- `loop` (boolean, optional): Whether to create a sound effect that loops smoothly (default: false)
- `duration_seconds` (number, optional): Duration in seconds (0.5-22, step 0.1). If not specified, optimal duration will be determined from prompt
- `prompt_influence` (number, optional): How closely to follow the prompt (0-1, step 0.01, default: 0.3). Higher values mean less variation
- `output_format` (string, optional): Audio output format (default: "mp3_44100_192")
  - MP3 options: `mp3_22050_32`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`
  - PCM options: `pcm_8000`, `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100`, `pcm_48000`
  - Telephony: `ulaw_8000`, `alaw_8000`
  - Opus: `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192`
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Basic sound effect:
```json
{
  "text": "Rain falling on a tin roof"
}
```

Advanced sound effect with custom duration:
```json
{
  "text": "Epic thunderstorm with heavy rain and distant thunder",
  "duration_seconds": 15.0,
  "prompt_influence": 0.8,
  "output_format": "mp3_44100_192"
}
```

Looping ambient sound:
```json
{
  "text": "Gentle ocean waves lapping at the shore",
  "loop": true,
  "duration_seconds": 10.0
}
```

**Key Features:**
- **High-Quality Audio**: Professional-grade sound effect generation
- **Flexible Duration**: Control exact length from 0.5 to 22 seconds
- **Loop Support**: Create seamless looping sound effects
- **Multiple Formats**: Support for MP3, PCM, Opus, and telephony formats
- **Prompt Control**: Adjust how closely to follow your description

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Sound effects generation typically takes 30-90 seconds depending on complexity.

### 10. `bytedance_seedance_video`
Generate videos with ByteDance Seedance 2.0, multimodal inputs (image/video/audio references), native audio generation, standard and fast modes.

**Parameters:**
- `prompt` (string, required): Text prompt for video generation (3-20000 chars)
- `mode` (string, optional): Generation mode (default: "standard")
  - `standard`: Higher quality (seedance-2 model)
  - `fast`: Faster for iterative workflows (seedance-2-fast model)
- `first_frame_url` (string, optional): URL of image to use as first frame
- `last_frame_url` (string, optional): URL of image to use as last frame
- `reference_image_urls` (array, optional): Reference images for style/subject guidance (up to 9)
- `reference_video_urls` (array, optional): Reference videos for motion/style guidance (up to 3)
- `reference_audio_urls` (array, optional): Reference audio for sound-guided generation (up to 3)
- `aspect_ratio` (string, optional): Video aspect ratio (default: "16:9")
  - Options: `1:1`, `9:16`, `16:9`, `4:3`, `3:4`, `21:9`, `9:21`, `adaptive`
  - `adaptive` requires `first_frame_url`
- `resolution` (string, optional): Video resolution (default: "720p")
  - `480p`: Faster generation
  - `720p`: Balanced quality and speed
- `duration` (integer, optional): Video duration in seconds 4-15 (default: 5)
- `generate_audio` (boolean, optional): Generate native audio for the video (default: true)
- `web_search` (boolean, optional): Enable web search to enhance prompt understanding (default: false)
- `nsfw_checker` (boolean, optional): Enable NSFW content filtering (default: false)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-video with audio:
```json
{
  "prompt": "A serene sailing boat gently sways in the harbor at dawn, surrounded by soft Impressionist hues of pink and orange",
  "mode": "standard",
  "aspect_ratio": "16:9",
  "duration": 5,
  "generate_audio": true
}
```

Image-to-video with reference images:
```json
{
  "prompt": "A golden retriever dashing through shallow surf at the beach, splashes frozen in time",
  "first_frame_url": "https://example.com/golden-retriever.jpg",
  "mode": "standard",
  "resolution": "720p",
  "duration": 6
}
```

Fast mode with multimodal references:
```json
{
  "prompt": "Create a video matching this dance style with cinematic lighting",
  "mode": "fast",
  "reference_video_urls": ["https://example.com/dance-ref.mp4"],
  "reference_audio_urls": ["https://example.com/music.mp3"],
  "duration": 10
}
```

Video with first and last frame:
```json
{
  "prompt": "A traveler crosses an endless desert toward a glowing archway",
  "first_frame_url": "https://example.com/desert-traveler.jpg",
  "last_frame_url": "https://example.com/archway.jpg",
  "duration": 8
}
```

**Key Features:**
- **Multimodal References**: Guide generation with images, videos, and audio clips
- **Native Audio**: Automatic audio generation synchronized with video content
- **Two Modes**: Standard for quality, Fast for iterative workflows
- **Adaptive Aspect**: Automatically match aspect ratio to input frame
- **Web Search**: Enhance prompts with real-world knowledge
- **Flexible Duration**: 4-15 second videos

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Video generation typically takes 2-5 minutes depending on duration and complexity.

### 11. `bytedance_seedream_image`
Generate and edit images using ByteDance Seedream V4 models (unified tool for both text-to-image and image editing).

**Parameters:**
- `prompt` (string, required): Text prompt for image generation or editing (max 10000 chars)
- `image_urls` (array, optional): Array of image URLs for editing mode (1-10 images, if not provided, uses text-to-image)
- `image_size` (string, optional): Image aspect ratio (default: "1:1")
  - Options: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `9:21`, `3:2`, `2:3`
- `image_resolution` (string, optional): Image resolution (default: "1K")
  - `1K`: Standard resolution (1024px on shortest side)
  - `2K`: High resolution (2048px on shortest side)
  - `4K`: Ultra high resolution (4096px on shortest side)
- `max_images` (integer, optional): Number of images to generate (1-6, default: 1)
- `seed` (integer, optional): Random seed for reproducible results (default: -1 for random)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-image generation:
```json
{
  "prompt": "A majestic dragon perched atop a crystal mountain at sunset, digital art style",
  "image_size": "16:9",
  "image_resolution": "2K",
  "max_images": 2,
  "seed": 42
}
```

Image editing:
```json
{
  "prompt": "Transform the day scene into a magical night with glowing stars and moonlight",
  "image_urls": ["https://example.com/day-landscape.jpg"],
  "image_size": "16:9",
  "image_resolution": "2K",
  "max_images": 1
}
```

Multiple image editing:
```json
{
  "prompt": "Apply a consistent cyberpunk aesthetic to all images with neon lights and futuristic elements",
  "image_urls": [
    "https://example.com/character1.jpg",
    "https://example.com/character2.jpg",
    "https://example.com/background.jpg"
  ],
  "image_resolution": "4K",
  "max_images": 3
}
```

**Key Features:**
- **Unified Interface**: Single tool for both text-to-image and image editing
- **Smart Mode Detection**: Automatically detects mode based on presence of `image_urls`
- **High Resolution**: Support for 1K, 2K, and 4K output
- **Multiple Images**: Generate up to 6 images in a single request
- **Batch Editing**: Edit up to 10 images simultaneously with consistent style
- **Reproducible Results**: Seed control for consistent output

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Image generation typically takes 30-120 seconds depending on resolution and complexity.

### 12. `qwen_image`
Generate and edit images using Qwen models (unified tool for both text-to-image and image editing).

**Parameters:**
- `prompt` (string, required): Text prompt for image generation or editing
- `image_url` (string, optional): URL of image to edit (if not provided, uses text-to-image)
- `image_size` (string, optional): Image size (default: "square_hd")
  - Options: `square`, `square_hd`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`
- `num_inference_steps` (integer, optional): Number of inference steps (default: 30 for text-to-image, 25 for edit)
  - Text-to-image: 2-250, Edit: 2-49
- `guidance_scale` (number, optional): CFG scale (default: 2.5 for text-to-image, 4 for edit)
  - Range: 0-20
- `enable_safety_checker` (boolean, optional): Enable safety checker (default: true)
- `output_format` (string, optional): Output format (default: "png")
  - Options: `png`, `jpeg`
- `negative_prompt` (string, optional): Negative prompt (max 500 chars, default: " ")
- `acceleration` (string, optional): Acceleration level (default: "none")
  - Options: `none`, `regular`, `high`
- `num_images` (string, optional): Number of images (edit mode only)
  - Options: `1`, `2`, `3`, `4`
- `sync_mode` (boolean, optional): Sync mode (edit mode only, default: false)
- `seed` (number, optional): Random seed for reproducible results
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-image generation:
```json
{
  "prompt": "A beautiful landscape with mountains and a lake at sunset",
  "image_size": "landscape_16_9",
  "num_inference_steps": 30,
  "guidance_scale": 2.5,
  "output_format": "png",
  "seed": 42
}
```

Image editing:
```json
{
  "prompt": "Change the day scene to night with stars and moonlight",
  "image_url": "https://example.com/day-landscape.jpg",
  "image_size": "landscape_16_9",
  "num_inference_steps": 25,
  "guidance_scale": 4,
  "num_images": "2",
  "output_format": "png"
}
```

High-acceleration generation:
```json
{
  "prompt": "A futuristic city with flying cars",
  "image_size": "square_hd",
  "acceleration": "high",
  "enable_safety_checker": true,
  "negative_prompt": "blurry, low quality"
}
```

**Key Features:**
- **Unified Interface**: Single tool for both text-to-image and image editing
- **Smart Mode Detection**: Automatically detects mode based on presence of `image_url`
- **Flexible Sizing**: Support for multiple aspect ratios and resolutions
- **Acceleration Options**: Speed up generation with acceleration levels
- **Batch Generation**: Generate multiple images in edit mode
- **Reproducible Results**: Seed control for consistent output

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Image generation typically takes 10-60 seconds depending on settings and acceleration level.

### 13. `runway_aleph_video`
Transform videos using Runway Aleph video-to-video generation with AI-powered editing.

**Parameters:**
- `prompt` (string, required): Text prompt describing desired video transformation (max 1000 chars)
- `videoUrl` (string, required): URL of the input video to transform
- `waterMark` (string, optional): Watermark text to add to the video (max 100 chars, default: "")
- `uploadCn` (boolean, optional): Whether to upload to China servers (default: false)
- `aspectRatio` (enum, optional): Output video aspect ratio (default: "16:9")
  - Options: `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9`
- `seed` (integer, optional): Random seed for reproducible results (1-999999)
- `referenceImage` (string, optional): URL of reference image for style guidance
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Basic video transformation:
```json
{
  "prompt": "Transform this video into a cinematic anime style with vibrant colors",
  "videoUrl": "https://example.com/input-video.mp4",
  "aspectRatio": "16:9"
}
```

Advanced transformation with reference image:
```json
{
  "prompt": "Apply the artistic style of the reference image to this video",
  "videoUrl": "https://example.com/cooking-video.mp4",
  "referenceImage": "https://example.com/van-gogh-painting.jpg",
  "seed": 123456,
  "waterMark": "My Channel"
}
```

Vertical video for social media:
```json
{
  "prompt": "Convert to a dreamy, ethereal style with soft lighting",
  "videoUrl": "https://example.com/landscape-video.mp4",
  "aspectRatio": "9:16",
  "uploadCn": false
}
```

**Key Features:**
- **Video-to-Video Transformation**: Transform existing videos with AI-powered editing
- **Style Transfer**: Apply artistic styles from text prompts or reference images
- **Aspect Ratio Control**: Convert between horizontal, vertical, and square formats
- **Reproducible Results**: Seed control for consistent transformations
- **Watermark Support**: Add custom watermarks to transformed videos
- **Reference Guidance**: Use reference images to guide the transformation style

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Video-to-video transformation typically takes 3-8 minutes depending on complexity and length.

### 14. `midjourney_generate`
Generate images and videos using Midjourney AI models (unified tool for text-to-image, image-to-image, style reference, omni reference, and video generation).

**Parameters:**
- `prompt` (string, required): Text prompt describing the desired image or video (max 2000 chars)
- `taskType` (string, optional): Task type for generation mode (auto-detected if not provided)
  - Options: `mj_txt2img`, `mj_img2img`, `mj_style_reference`, `mj_omni_reference`, `mj_video`, `mj_video_hd`
- `fileUrl` (string, optional): Single image URL for image-to-image or video generation (legacy - use fileUrls instead)
- `fileUrls` (array, optional): Array of image URLs for image-to-image or video generation (recommended, max 10)
- `speed` (string, optional): Generation speed (not required for video/omni tasks)
  - Options: `relaxed`, `fast`, `turbo`
- `aspectRatio` (string, optional): Output aspect ratio (default: "16:9")
  - Options: `1:2`, `9:16`, `2:3`, `3:4`, `5:6`, `6:5`, `4:3`, `3:2`, `1:1`, `16:9`, `2:1`
- `version` (string, optional): Midjourney model version (default: "7")
  - Options: `7`, `6.1`, `6`, `5.2`, `5.1`, `niji6`
- `variety` (integer, optional): Controls diversity of generated results (0-100, increment by 5)
- `stylization` (integer, optional): Artistic style intensity (0-1000, suggested multiple of 50)
- `weirdness` (integer, optional): Creativity and uniqueness level (0-3000, suggested multiple of 100)
- `ow` (integer, optional): Omni intensity parameter for omni reference tasks (1-1000)
- `waterMark` (string, optional): Watermark identifier (max 100 chars)
- `enableTranslation` (boolean, optional): Auto-translate non-English prompts to English (default: false)
- `videoBatchSize` (string, optional): Number of videos to generate (video mode only, default: "1")
  - Options: `1`, `2`, `4`
- `motion` (string, optional): Motion level for video generation (required for video mode, default: "high")
  - Options: `high`, `low`
- `high_definition_video` (boolean, optional): Use HD video generation instead of standard definition (default: false)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-image generation:
```json
{
  "prompt": "A majestic dragon perched atop a crystal mountain at sunset, digital art style",
  "aspectRatio": "16:9",
  "version": "7",
  "speed": "fast",
  "stylization": 500
}
```

Image-to-image generation:
```json
{
  "prompt": "Transform this portrait into a cyberpunk style with neon lights",
  "fileUrls": ["https://example.com/portrait.jpg"],
  "aspectRatio": "1:1",
  "version": "7",
  "variety": 10
}
```

Standard definition video generation (default):
```json
{
  "prompt": "Add gentle movement and atmospheric effects",
  "fileUrls": ["https://example.com/landscape.jpg"],
  "motion": "high",
  "videoBatchSize": "1",
  "aspectRatio": "16:9"
}
```

High definition video generation (explicit):
```json
{
  "prompt": "Create cinematic video with dramatic motion",
  "fileUrls": ["https://example.com/cityscape.jpg"],
  "motion": "high",
  "high_definition_video": true,
  "videoBatchSize": "2",
  "aspectRatio": "16:9"
}
```

Omni reference generation:
```json
{
  "prompt": "Place this character in a fantasy forest setting",
  "fileUrls": ["https://example.com/character.jpg"],
  "ow": 500,
  "aspectRatio": "16:9",
  "version": "7"
}
```

Style reference generation:
```json
{
  "prompt": "Apply this artistic style to a new landscape",
  "fileUrls": ["https://example.com/artistic-style.jpg"],
  "taskType": "mj_style_reference",
  "aspectRatio": "16:9",
  "stylization": 700
}
```

**Key Features:**
- **Unified Interface**: Single tool for all Midjourney generation modes
- **Smart Mode Detection**: Automatically detects task type based on parameters
- **Video Default**: Uses standard definition video by default, HD only when explicitly requested
- **Multiple Aspect Ratios**: Support for vertical, horizontal, square, and ultra-wide formats
- **Style Control**: Fine-tune artistic style with stylization, variety, and weirdness parameters
- **Speed Options**: Choose generation speed based on urgency (relaxed/fast/turbo)
- **Model Versions**: Access different Midjourney models including niji for anime/illustration
- **Reference Modes**: Advanced omni and style reference for character and style transfer
- **Batch Generation**: Generate multiple videos in a single request

**Smart Detection Logic:**
- If `high_definition_video` is true → `mj_video_hd`
- If `motion` or `videoBatchSize` present → `mj_video` (standard) or `mj_video_hd` (explicit)
- If `ow` present → `mj_omni_reference`
- If `taskType` is `mj_style_reference` → `mj_style_reference`
- If `fileUrl`/`fileUrls` present → `mj_img2img`
- Otherwise → `mj_txt2img`

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Generation times vary: text-to-image (1-3 minutes), image-to-image (2-4 minutes), video generation (3-8 minutes), reference modes (2-5 minutes).

### 15. `wan_video`
Generate videos using Alibaba Wan 2.5 models (unified tool for both text-to-video and image-to-video).

**Parameters:**
- `prompt` (string, required): Text prompt for video generation (max 800 chars)
- `image_url` (string, optional): URL of input image for image-to-video generation (if not provided, uses text-to-video)
- `aspect_ratio` (string, optional): Video aspect ratio for text-to-video (default: "16:9")
  - Options: `16:9`, `9:16`, `1:1`
- `resolution` (string, optional): Video resolution (default: "1080p")
  - `720p`: Faster generation
  - `1080p`: Higher quality
- `duration` (string, optional): Video duration for image-to-video (default: "5")
  - Options: `5`, `10` seconds
- `negative_prompt` (string, optional): Negative prompt to describe content to avoid (max 500 chars, default: "")
- `enable_prompt_expansion` (boolean, optional): Enable prompt rewriting using LLM (default: true)
- `seed` (integer, optional): Random seed for reproducible results
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-video generation:
```json
{
  "prompt": "A dimly lit jazz bar at night, wooden tables glowing under warm pendant lights. Patrons sip drinks and chat quietly while a three-piece band performs on stage. The saxophone player stands under a spotlight, gleaming instrument reflecting the light. No dialogue. Ambient audio: smooth live jazz music with saxophone and piano, clinking glasses, low murmur of audience conversations.",
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "enable_prompt_expansion": true,
  "seed": 42
}
```

Image-to-video generation:
```json
{
  "prompt": "The same woman from the reference image looks directly into the camera, takes a breath, then smiles brightly and speaks with enthusiasm: 'Have you heard? Alibaba Wan 2.5 API is now available on Kie.ai!'",
  "image_url": "https://example.com/portrait.jpg",
  "duration": "5",
  "resolution": "1080p",
  "negative_prompt": "blurry, low quality",
  "seed": 123
}
```

**Key Features:**
- **Unified Interface**: Single tool for both text-to-video and image-to-video
- **Smart Mode Detection**: Automatically detects mode based on presence of `image_url`
- **Prompt Expansion**: LLM-powered prompt rewriting for better results with short prompts
- **Flexible Resolutions**: 720p for speed, 1080p for quality
- **Aspect Ratio Control**: Support for horizontal, vertical, and square formats (text-to-video)
- **Duration Control**: 5 or 10 second options for image-to-video
- **Negative Prompts**: Fine-tune results by specifying what to avoid
- **Reproducible Results**: Seed control for consistent output

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Video generation typically takes 2-6 minutes depending on resolution and complexity.

### 23. `wan_animate`
Animate static images or replace characters in videos using Alibaba's Wan 2.2 Animate models with motion transfer and seamless environmental integration.

**Parameters:**
- `video_url` (string, required): URL of the reference video (MP4, QUICKTIME, X-MATROSKA, max 10MB, max 30 seconds)
- `image_url` (string, required): URL of the character image (JPEG, PNG, WEBP, max 10MB). Will be resized and center-cropped to match video aspect ratio.
- `mode` (string, optional): Animation mode (default: "animate")
  - `animate`: Transfer motion/expressions from video to static image
  - `replace`: Swap the character in video with the image (preserves lighting/tone)
- `resolution` (string, optional): Output video resolution (default: "480p")
  - `480p`: ~$0.03/second
  - `580p`: ~$0.0475/second
  - `720p`: ~$0.0625/second
- `callBackUrl` (string, optional): URL for task completion notifications

**Pricing (2025-12-06):**
| Resolution | Credits/second | USD/second |
|------------|----------------|------------|
| 720p | 12.5 | ~$0.0625 |
| 580p | 9.5 | ~$0.0475 |
| 480p | 6 | ~$0.0300 |

**Examples:**

Animation mode (transfer motion to static image):
```json
{
  "video_url": "https://example.com/dance-reference.mp4",
  "image_url": "https://example.com/portrait.png",
  "mode": "animate",
  "resolution": "720p"
}
```

Character replacement (swap character in video):
```json
{
  "video_url": "https://example.com/original-clip.mp4",
  "image_url": "https://example.com/new-character.png",
  "mode": "replace",
  "resolution": "580p"
}
```

**Key Features:**
- **Unified Interface**: Single tool for both animation and character replacement modes
- **Mode Selection**: Choose between transferring motion or replacing characters
- **Motion Transfer**: Realistic body movement and facial expressions from reference video
- **Character Replacement**: Seamless integration with automatic lighting/tone matching
- **Audio Preservation**: Original video audio is retained in output
- **Flexible Resolutions**: 480p for cost efficiency, 720p for higher quality
- **Wide Character Support**: Works with portraits, illustrations, anime, and stylized art

**Smart Mode Logic:**
- `animate` mode: Drives static image with video motion/expressions
- `replace` mode: Swaps video subject with new character image

**Performance:**
- Video generation time depends on input video length
- Pricing is per-second of output video
- Max input video length: 30 seconds

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided.

### 16. `hailuo_video`

Generate professional videos using Hailuo 02 models (unified tool for text-to-video and image-to-video with standard/pro quality).

**Parameters:**
- `prompt` (string, required): Text prompt describing the video content (max 1500 chars)
- `imageUrl` (string, optional): URL of input image for image-to-video mode (if not provided, uses text-to-video)
- `endImageUrl` (string, optional): URL of end frame image for image-to-video (optional, requires imageUrl)
- `quality` (string, optional): Quality level of generation (default: "standard")
  - Options: `standard`, `pro`
- `duration` (string, optional): Duration of video in seconds - standard quality only (default: "6")
  - Options: `6`, `10`
- `resolution` (string, optional): Video resolution - standard quality only (default: "768P")
  - Options: `512P`, `768P`
- `promptOptimizer` (boolean, optional): Enable prompt optimization (default: true)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-video generation:
```json
{
  "prompt": "A cinematic shot of a futuristic city at night with flying vehicles and holographic billboards. Camera pans across the skyline.",
  "quality": "pro",
  "promptOptimizer": true
}
```

Image-to-video generation (standard quality):
```json
{
  "prompt": "The person in the image stands up and walks towards the window, looking out at the scenic view",
  "imageUrl": "https://example.com/portrait.jpg",
  "quality": "standard",
  "duration": "10",
  "resolution": "768P"
}
```

Image-to-video with end frame:
```json
{
  "prompt": "A smooth transition from the morning scene to sunset over the mountains",
  "imageUrl": "https://example.com/start-frame.jpg",
  "endImageUrl": "https://example.com/end-frame.jpg",
  "quality": "standard"
}
```

**Key Features:**
- **Two Intelligent Modes**:
  - Text-to-video: Create videos from text descriptions
  - Image-to-video: Animate static images with optional end frame reference
- **Quality Selection**: Choose between standard (faster) and pro (higher quality) modes
- **Smart Mode Detection**: Automatically selects the best model based on parameters and quality setting
- **Standard Quality Options**: Flexible duration (6/10 seconds) and resolution (512P/768P)
- **Pro Quality**: Optimized for maximum visual fidelity (no resolution/duration constraints)
- **Prompt Optimization**: AI-powered prompt enhancement for better results

**Model Selection Logic:**
- If `imageUrl` provided:
  - `quality === 'pro'` → `hailuo/02-image-to-video-pro`
  - Otherwise → `hailuo/02-image-to-video-standard`
- Otherwise (text-to-video):
  - `quality === 'pro'` → `hailuo/02-text-to-video-pro`
  - Otherwise → `hailuo/02-text-to-video-standard`

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Video generation typically takes 1-5 minutes depending on quality setting and complexity.

### 17. `kling_video`

Generate high-quality videos using Kling AI models (unified tool for text-to-video, image-to-video, and v2.1-pro with start+end frames).

**Parameters:**
- `prompt` (string, required): Text prompt describing the video (max 5000 chars)
- `image_url` (string, optional): URL of input image for image-to-video or v2.1-pro start frame (if not provided, uses text-to-video)
- `tail_image_url` (string, optional): URL of end frame image for v2.1-pro (requires image_url). When provided, uses v2.1-pro model with start and end frame reference
- `duration` (string, optional): Duration of video in seconds (default: "5")
  - Options: `5`, `10`
- `aspect_ratio` (string, optional): Aspect ratio for text-to-video (default: "16:9")
  - Options: `16:9`, `9:16`, `1:1`
- `negative_prompt` (string, optional): Elements to avoid (max 2500 chars, default: "blur, distort, and low quality")
- `cfg_scale` (number, optional): CFG scale for prompt adherence (0-1, step 0.1, default: 0.5)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-video generation:
```json
{
  "prompt": "A serene forest scene with sunlight filtering through the canopy. Birds chirping, gentle breeze rustling leaves. Camera slowly pans through the trees revealing a hidden waterfall",
  "aspect_ratio": "16:9",
  "duration": "10",
  "cfg_scale": 0.7
}
```

Image-to-video generation:
```json
{
  "prompt": "The person in the image waves and smiles, then turns to look at the scenic mountain view",
  "image_url": "https://example.com/portrait.jpg",
  "duration": "5"
}
```

V2.1-pro with start and end frames:
```json
{
  "prompt": "A smooth transition showing the landscape changing from day to night, with the person from frame 1 walking towards the sunset",
  "image_url": "https://example.com/start-frame.jpg",
  "tail_image_url": "https://example.com/end-frame.jpg",
  "duration": "10",
  "cfg_scale": 0.6
}
```

**Key Features:**
- **Three Intelligent Modes**:
  - Text-to-video: Create videos from text descriptions
  - Image-to-video: Animate static images
  - V2.1-pro: Advanced mode with start and end frame references for controlled video transitions
- **Smart Mode Detection**: Automatically selects the best model based on parameters
- **Start/End Frame Control**: V2.1-pro uniquely supports specifying both start and end frames for precise video flows
- **Flexible Duration**: 5 or 10 second options
- **Aspect Ratio Control**: Multiple formats for text-to-video (16:9, 9:16, 1:1)
- **Quality Control**: CFG scale for controlling prompt adherence
- **Negative Prompts**: Fine-tune by specifying what to avoid

**Model Selection Logic:**
- If `tail_image_url` provided → `kling/v2-1-pro` (start + end frame reference)
- If `image_url` provided → `kling/v2-5-turbo-image-to-video-pro` (image animation)
- Otherwise → `kling/v2-5-turbo-text-to-video-pro` (text-to-video)

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Video generation typically takes 2-5 minutes depending on duration and complexity.

### 18. `openai_4o_image`
Generate, edit, and create image variants using OpenAI's GPT-4o image models (unified tool for text-to-image, image editing, and image variants).

**Parameters:**
- `prompt` (string, required): Text prompt for image generation or editing (max 4000 chars)
- `filesUrl` (string, optional): URL of input image for editing/variants mode (if not provided, uses text-to-image)
- `maskUrl` (string, optional): URL of mask image for editing mode (required for editing, must be same dimensions as filesUrl)
- `nVariants` (integer, optional): Number of image variants to generate (1-4, default: 4)
- `size` (string, optional): Output image size (default: "1024x1024")
  - Options: `256x256`, `512x512`, `1024x1024`, `1792x1024`, `1024x1792`
- `model` (string, optional): Model to use (default: "gpt-4o-image")
  - Options: `gpt-4o-image`, `gpt-4o-image-mini`
- `style` (string, optional): Image style (default: "vivid")
  - Options: `vivid`, `natural`
- `quality` (string, optional): Image quality (default: "standard")
  - Options: `standard`, `hd`
- `responseFormat` (string, optional): Response format (default: "url")
  - Options: `url`, `b64_json`
- `user` (string, optional): User identifier for tracking (max 100 chars)
- `enableFallback` (boolean, optional): Enable fallback mechanism (default: true)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-image generation:
```json
{
  "prompt": "A futuristic city skyline at sunset with flying cars and neon lights, cyberpunk style",
  "nVariants": 4,
  "size": "1024x1024",
  "quality": "hd",
  "style": "vivid"
}
```

Image editing with mask:
```json
{
  "prompt": "Replace the cloudy sky with a clear starry night and add a full moon",
  "filesUrl": "https://example.com/landscape.jpg",
  "maskUrl": "https://example.com/landscape-mask.png",
  "nVariants": 2,
  "size": "1024x1024",
  "quality": "hd"
}
```

Image variants:
```json
{
  "filesUrl": "https://example.com/portrait.jpg",
  "nVariants": 4,
  "style": "natural",
  "quality": "standard"
}
```

High-quality generation with fallback:
```json
{
  "prompt": "A detailed oil painting of a serene mountain lake at dawn",
  "nVariants": 2,
  "size": "1792x1024",
  "quality": "hd",
  "model": "gpt-4o-image",
  "enableFallback": true
}
```

**Key Features:**
- **Unified Interface**: Single tool for text-to-image, image editing, and image variants
- **Smart Mode Detection**: Automatically detects mode based on provided parameters
  - Text-to-Image: `prompt` provided, no `filesUrl`
  - Image Editing: `filesUrl` + `maskUrl` provided
  - Image Variants: `filesUrl` provided, no `maskUrl`
- **Multiple Variants**: Generate up to 4 image variations in a single request
- **Flexible Sizing**: Support for square, portrait, and landscape formats
- **Quality Options**: Standard or HD quality for different use cases
- **Style Control**: Choose between vivid (creative) or natural (realistic) styles
- **Fallback Support**: Automatic fallback to FLUX_MAX model if GPT-4o fails
- **Model Options**: Use full GPT-4o or mini model based on requirements

**Smart Detection Logic:**
- If `filesUrl` and `maskUrl` provided → Image Editing mode
- If `filesUrl` provided but no `maskUrl` → Image Variants mode
- If no `filesUrl` provided → Text-to-Image mode

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Image generation typically takes 30-120 seconds depending on complexity and quality settings. The fallback mechanism uses FLUX_MAX model when GPT-4o fails, ensuring reliable generation.

### 19. `flux_kontext_image`
Generate or edit images using Flux Kontext AI models (unified tool for text-to-image generation and image editing with advanced features).

**Parameters:**
- `prompt` (string, required): Text prompt describing the desired image or edit (max 5000 chars, English recommended)
- `inputImage` (string, optional): Input image URL for editing mode (omit for text-to-image generation)
- `aspectRatio` (string, optional): Output aspect ratio (default: "16:9")
  - Options: `21:9` (ultra-wide), `16:9` (widescreen), `4:3` (standard), `1:1` (square), `3:4` (portrait), `9:16` (mobile portrait)
- `outputFormat` (string, optional): Output image format (default: "jpeg")
  - Options: `jpeg`, `png`
- `model` (string, optional): Model version (default: "flux-kontext-pro")
  - Options: `flux-kontext-pro` (standard), `flux-kontext-max` (enhanced)
- `enableTranslation` (boolean, optional): Auto-translate non-English prompts (default: true)
- `promptUpsampling` (boolean, optional): Enable prompt enhancement (default: false)
- `safetyTolerance` (integer, optional): Content moderation level (default: 2)
  - Generation mode: 0-6 (0=strict, 6=permissive)
  - Editing mode: 0-2 (0=strict, 2=balanced)
- `uploadCn` (boolean, optional): Route uploads via China servers (default: false)
- `watermark` (string, optional): Watermark identifier to add to generated image
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Text-to-image generation:
```json
{
  "prompt": "A serene mountain landscape at sunset with a lake reflecting the orange sky, photorealistic style",
  "aspectRatio": "16:9",
  "model": "flux-kontext-max",
  "outputFormat": "png"
}
```

Image editing:
```json
{
  "prompt": "Replace the sky with a starry night and add glowing lanterns",
  "inputImage": "https://example.com/original-image.jpg",
  "aspectRatio": "16:9",
  "safetyTolerance": 2,
  "enableTranslation": false
}
```

Mobile portrait generation:
```json
{
  "prompt": "A futuristic cityscape with flying cars and neon lights, cyberpunk style",
  "aspectRatio": "9:16",
  "model": "flux-kontext-max",
  "promptUpsampling": true
}
```

**Key Features:**
- **Unified Interface**: Single tool for both text-to-image generation and image editing
- **Smart Mode Detection**: Automatically detects mode based on `inputImage` parameter
  - Text-to-Image: No `inputImage` provided
  - Image Editing: `inputImage` provided
- **Advanced Translation**: Automatic translation of non-English prompts to English
- **Multiple Aspect Ratios**: Support for ultra-wide, standard, square, and mobile formats
- **Model Selection**: Choose between standard (pro) and enhanced (max) quality models
- **Safety Controls**: Configurable content moderation with different levels for generation vs editing
- **Prompt Enhancement**: Optional upsampling for improved generation quality
- **Watermark Support**: Add custom watermarks to generated images
- **Regional Optimization**: Choose optimal server region for uploads

**Smart Detection Logic:**
- If `inputImage` provided → Image Editing mode
- If no `inputImage` provided → Text-to-Image mode

**Performance:**
- Text-to-image generation: 30-60 seconds
- Image editing: 1-3 minutes
- Enhanced model (flux-kontext-max): May take longer but provides higher quality

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Safety tolerance levels are automatically validated based on the generation mode (0-2 for editing, 0-6 for generation).

### 22. `flux2_image`
Generate and edit images using Black Forest Labs' Flux 2 models (Pro/Flex) with multi-reference consistency, photoreal detail, and accurate text rendering.

**Parameters:**
- `prompt` (string, required): Text prompt describing the desired image (3-5000 characters)
- `input_urls` (array, optional): Reference images for image-to-image mode (1-8 URLs). Omit for text-to-image mode.
- `aspect_ratio` (string, optional): Aspect ratio for the generated image (default: "1:1")
  - Options: `1:1` (square), `4:3` (landscape), `3:4` (portrait), `16:9` (widescreen), `9:16` (mobile), `3:2` (classic), `2:3` (classic portrait), `auto` (match first input)
  - Note: `auto` only valid with `input_urls`
- `resolution` (string, optional): Output resolution (default: "1K")
  - Options: `1K`, `2K`
- `model_type` (string, optional): Model variant (default: "pro")
  - Options: `pro` (fast, reliable results), `flex` (more control, fine-tuning)
- `callBackUrl` (string, optional): URL for task completion notifications

**Pricing (2025-12-06):**
| Model | 1K | 2K |
|-------|----|----|
| Flux 2 Pro | 5 credits (~$0.025) | 7 credits (~$0.035) |
| Flux 2 Flex | 14 credits (~$0.07) | 24 credits (~$0.12) |

**Examples:**

Text-to-image (Pro):
```json
{
  "prompt": "A hyperrealistic supermarket blister pack on clean olive green surface with pink 3D letters spelling FLUX.2",
  "aspect_ratio": "1:1",
  "resolution": "1K",
  "model_type": "pro"
}
```

Image-to-image with multi-reference (Pro):
```json
{
  "prompt": "The jar in image 1 is filled with capsules exactly same as image 2 with the exact logo",
  "input_urls": [
    "https://example.com/jar-image.png",
    "https://example.com/capsules-reference.png"
  ],
  "aspect_ratio": "1:1",
  "resolution": "2K"
}
```

Text-to-image with Flex (more control):
```json
{
  "prompt": "A humanoid figure with a vintage television set for a head displaying Hello FLUX.2 in ASCII font, wearing a yellow raincoat",
  "aspect_ratio": "16:9",
  "resolution": "2K",
  "model_type": "flex"
}
```

**Key Features:**
- **Unified Interface**: Single tool for both text-to-image and image-to-image modes
- **Smart Mode Detection**: Automatically detects mode based on `input_urls` parameter
  - Text-to-Image: No `input_urls` provided
  - Image-to-Image: `input_urls` provided (1-8 reference images)
- **Multi-Reference Consistency**: Up to 8 reference images for maintaining character/product/style consistency
- **Photoreal Detail**: Higher fidelity with sharper textures, cleaner materials, and stable lighting
- **Accurate Text Rendering**: Strong typography, infographics, UI layouts, and meme-style text
- **Stronger Prompt Following**: Complex prompts with multi-part instructions and composition rules
- **Real-World Knowledge**: Accurate spatial logic, materials, reflections, and object interactions
- **4MP Resolution**: High resolution output with flexible aspect ratios

**Smart Detection Logic:**
- If `input_urls` provided → Image-to-Image mode
- If no `input_urls` provided → Text-to-Image mode
- Pro variant: Fast, reliable, production-ready
- Flex variant: More control, adjustable steps and guidance

**Performance:**
- Image generation: 10-30 seconds
- Pro variant is faster, Flex may take longer for higher quality

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. The `auto` aspect ratio only works when `input_urls` is provided.

### 20. `ideogram_reframe`
Reframe images to different aspect ratios and sizes using Ideogram V3 Reframe model with intelligent content adaptation.

**Parameters:**
- `image_url` (string, required): URL of image to reframe (JPEG, PNG, WEBP, max 10MB)
- `image_size` (string, optional): Output size for the reframed image (default: "square_hd")
  - Options: `square`, `square_hd`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`
- `rendering_speed` (string, optional): Rendering speed for generation (default: "BALANCED")
  - Options: `TURBO` (fast), `BALANCED` (default), `QUALITY` (best)
- `style` (string, optional): Style type for generation (default: "AUTO")
  - Options: `AUTO`, `GENERAL`, `REALISTIC`, `DESIGN`
- `num_images` (string, optional): Number of images to generate (default: "1")
  - Options: `1`, `2`, `3`, `4`
- `seed` (number, optional): Seed for reproducible results (default: 0)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Basic reframing to square HD:
```json
{
  "image_url": "https://example.com/landscape-photo.jpg",
  "image_size": "square_hd"
}
```

High-quality portrait reframing:
```json
{
  "image_url": "https://example.com/group-photo.jpg",
  "image_size": "portrait_9_16",
  "rendering_speed": "QUALITY",
  "style": "REALISTIC",
  "num_images": "2"
}
```

Fast generation with custom style:
```json
{
  "image_url": "https://example.com/artwork.jpg",
  "image_size": "landscape_16_9",
  "rendering_speed": "TURBO",
  "style": "DESIGN",
  "seed": 42
}
```

Multiple variants for social media:
```json
{
  "image_url": "https://example.com/product-photo.jpg",
  "image_size": "square",
  "num_images": "4",
  "style": "AUTO"
}
```

**Key Features:**
- **Intelligent Content Adaptation**: Smart content-aware reframing that preserves important elements
- **Multiple Aspect Ratios**: Support for square, portrait, and landscape formats
- **Rendering Speed Control**: Choose between speed (TURBO), balance (BALANCED), or quality (QUALITY)
- **Style Options**: Auto-detection or specific style types (GENERAL, REALISTIC, DESIGN)
- **Batch Generation**: Create multiple variants in a single request
- **Reproducible Results**: Seed control for consistent output across sessions
- **Professional Quality**: High-quality reframing with minimal artifacts

**Output Sizes:**
- **Square**: 1:1 aspect ratio for social media and avatars
- **Square HD**: High-definition square format with better quality
- **Portrait 4:3**: Standard portrait orientation
- **Portrait 16:9**: Wide portrait for mobile and stories
- **Landscape 4:3**: Traditional landscape orientation
- **Landscape 16:9**: Widescreen format for displays and video

**Use Cases:**
- **Social Media**: Convert images to optimal formats for different platforms
- **Content Adaptation**: Repurpose content for multiple aspect ratios
- **Design Workflows**: Generate variations for different layout requirements
- **Mobile Optimization**: Create mobile-friendly versions of desktop content
- **Batch Processing**: Generate multiple format variants efficiently

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Image reframing typically takes 30-120 seconds depending on complexity, rendering speed, and output settings.

### 21. `recraft_remove_background`
Remove backgrounds from images using Recraft AI background removal model with professional-quality edge detection.

**Parameters:**
- `image` (string, required): URL of image to remove background from (PNG, JPG, WEBP, max 5MB, 16MP, 4096px max, 256px min)
- `callBackUrl` (string, optional): URL for task completion notifications

**Examples:**

Basic background removal:
```json
{
  "image": "https://example.com/portrait.jpg"
}
```

With callback URL:
```json
{
  "image": "https://example.com/product-photo.jpg",
  "callBackUrl": "https://api.example.com/callback"
}
```

**Key Features:**
- **Professional Quality**: Clean edge detection with precise background separation
- **Format Support**: Works with PNG, JPG, and WEBP images
- **Size Optimization**: Handles images up to 16MP with optimal processing
- **Fast Processing**: Quick background removal for most image types
- **Automatic Enhancement**: Smart edge refinement for natural results

**Use Cases:**
- **Product Photography**: Create clean product images with transparent backgrounds
- **Portrait Processing**: Remove backgrounds for professional headshots
- **Design Workflows**: Isolate subjects for composite images
- **E-commerce**: Prepare product images for catalogs
- **Content Creation**: Create assets for social media and marketing

**Technical Specifications:**
- **Supported Formats**: PNG, JPG, WEBP
- **Maximum File Size**: 5MB
- **Maximum Resolution**: 16MP (4096px max dimension)
- **Minimum Resolution**: 256px min dimension
- **Output Format**: PNG with transparent background

**Note**: The `callBackUrl` is optional and uses automatic fallback if not provided. Background removal typically takes 10-30 seconds depending on image complexity and size.

---

## API Endpoints Reference

The server interfaces with these Kie.ai API endpoints:

- **Veo3 Video Generation**: `POST /api/v1/veo/generate`
- **Veo3 Video Status**: `GET /api/v1/veo/record-info`  
- **Veo3 1080p Upgrade**: `GET /api/v1/veo/get-1080p-video`
- **Nano Banana Generation**: `POST /api/v1/jobs/createTask` 
- **Nano Banana Edit**: `POST /api/v1/jobs/createTask`
- **Nano Banana Upscale**: `POST /api/v1/jobs/createTask`
- **Nano Banana Status**: `GET /api/v1/jobs/recordInfo`
- **Suno Music Generation**: `POST /api/v1/generate`
- **Suno Music Status**: `GET /api/v1/generate?taskId=XXX`
- **ElevenLabs TTS Generation**: `POST /api/v1/jobs/createTask`
- **ElevenLabs TTS Status**: `GET /api/v1/jobs/recordInfo`
- **ElevenLabs Sound Effects**: `POST /api/v1/jobs/createTask`
- **ElevenLabs Sound Effects Status**: `GET /api/v1/jobs/recordInfo`
- **ByteDance Seedance Video**: `POST /api/v1/jobs/createTask`
- **ByteDance Seedance Status**: `GET /api/v1/jobs/recordInfo`
- **ByteDance Seedream Image**: `POST /api/v1/jobs/createTask`
- **ByteDance Seedream Status**: `GET /api/v1/jobs/recordInfo`
- **Qwen Image Generation**: `POST /api/v1/jobs/createTask`
- **Qwen Image Status**: `GET /api/v1/jobs/recordInfo`
- **Runway Aleph Video**: `POST /api/v1/jobs/createTask`
- **Runway Aleph Status**: `GET /api/v1/jobs/recordInfo`
- **Midjourney Generation**: `POST /api/v1/jobs/createTask`
- **Midjourney Status**: `GET /api/v1/jobs/recordInfo`
- **Wan Video Generation**: `POST /api/v1/jobs/createTask`
- **Wan Video Status**: `GET /api/v1/jobs/recordInfo`
- **OpenAI 4o Image Generation**: `POST /api/v1/jobs/createTask`
- **OpenAI 4o Image Status**: `GET /api/v1/jobs/recordInfo`
- **Flux Kontext Image**: `POST /api/v1/jobs/createTask`
- **Flux Kontext Status**: `GET /api/v1/jobs/recordInfo`
- **Recraft Remove Background**: `POST /api/v1/jobs/createTask`
- **Recraft Remove Background Status**: `GET /api/v1/jobs/recordInfo`
- **Ideogram V3 Reframe**: `POST /api/v1/jobs/createTask`
- **Ideogram V3 Reframe Status**: `GET /api/v1/jobs/recordInfo`

All endpoints follow official Kie.ai API documentation.
