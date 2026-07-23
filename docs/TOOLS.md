# Kie.ai Tool Reference

> Generated from the tool registry. Do not edit by hand, run `npm run docs` to regenerate.

Every tool below is available in both the MCP server and the `kie-cli` CLI. Parameters are derived from each tool's schema, so this list always matches the code.

## Contents

- **Image:** [bytedance_seedream_image](#bytedance_seedream_image), [flux_kontext_image](#flux_kontext_image), [flux2_image](#flux2_image), [gpt_image_2](#gpt_image_2), [ideogram_reframe](#ideogram_reframe), [midjourney_generate](#midjourney_generate), [nano_banana_image](#nano_banana_image), [qwen_image](#qwen_image), [recraft_remove_background](#recraft_remove_background), [topaz_upscale_image](#topaz_upscale_image), [z_image](#z_image)
- **Video:** [bytedance_seedance_video](#bytedance_seedance_video), [gemini_omni](#gemini_omni), [grok_imagine](#grok_imagine), [hailuo_video](#hailuo_video), [happyhorse_video](#happyhorse_video), [infinitalk_lip_sync](#infinitalk_lip_sync), [kling_avatar](#kling_avatar), [kling_video](#kling_video), [omnihuman_video](#omnihuman_video), [runway_aleph_video](#runway_aleph_video), [veo3_generate_video](#veo3_generate_video), [veo3_get_1080p_video](#veo3_get_1080p_video), [wan_animate](#wan_animate), [wan_video](#wan_video)
- **Audio:** [elevenlabs_tts](#elevenlabs_tts), [elevenlabs_ttsfx](#elevenlabs_ttsfx), [suno_generate_music](#suno_generate_music)
- **Utility:** [get_task_status](#get_task_status), [list_tasks](#list_tasks), [wait_for_task](#wait_for_task)

---

## Image tools

### bytedance_seedream_image

Generate and edit images using ByteDance Seedream V4, V5 Lite, or V5 Pro. V5 Pro provides controlled 1K/2K output, PNG/JPEG export, and up to 10 references.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt for image generation or editing. V4: max 5000 chars, V5 Lite: max 3000 chars (API returns 500 error if exceeded) |
| `image_urls` | array | no | Array of image URLs for editing mode (optional - if not provided, uses text-to-image). V4: max 10, V4.5: max 14 |
| `version` | `4` / `5-lite` / `5-pro` | no | Seedream version: '4' for V4, '5-lite' for V5 Lite (default), or '5-pro' for controlled 1K/2K generation and editing (default: `"5-lite"`) |
| `image_size` | `square` / `square_hd` / `portrait_4_3` / `portrait_3_2` / `portrait_16_9` / `landscape_4_3` / `landscape_3_2` / `landscape_16_9` / `landscape_21_9` | no | Image aspect ratio (V4 only) (default: `"square_hd"`) |
| `image_resolution` | `1K` / `2K` / `4K` | no | Image resolution (V4 only) (default: `"1K"`) |
| `max_images` | integer | no | Number of images to generate (V4 only) (default: `1`) |
| `seed` | number | no | Random seed for reproducible results (V4 only, use -1 for random) |
| `aspect_ratio` | `1:1` / `4:3` / `3:4` / `16:9` / `9:16` / `2:3` / `3:2` / `21:9` | no | Aspect ratio for V5 Lite output (V5 Lite only) (default: `"1:1"`) |
| `quality` | `basic` / `high` | no | Output quality for V5 Lite (V5 Lite only): 'basic' = 2K, 'high' = 3K resolution (default: `"basic"`) |
| `output_format` | `png` / `jpeg` | no | Output format for Seedream 5 Pro: png or jpeg |
| `nsfw_checker` | boolean | no | Enable NSFW filtering for Seedream 5 Pro |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### flux_kontext_image

Generate or edit images using Flux Kontext AI models (unified tool for text-to-image generation and image editing)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired image or edit (max 5000 characters, English recommended) |
| `enableTranslation` | boolean | no | Automatically translate non-English prompts to English (default: `true`) |
| `uploadCn` | boolean | no | Route uploads via China servers for better performance in Asia (default: `false`) |
| `inputImage` | string | no | Input image URL for editing mode (required for image editing, omit for text-to-image generation) |
| `aspectRatio` | `21:9` / `16:9` / `4:3` / `1:1` / `3:4` / `9:16` | no | Output image aspect ratio (default: 16:9) (default: `"16:9"`) |
| `outputFormat` | `jpeg` / `png` | no | Output image format (default: `"jpeg"`) |
| `promptUpsampling` | boolean | no | Enable prompt enhancement for better results (may increase processing time) (default: `false`) |
| `model` | `flux-kontext-pro` / `flux-kontext-max` | no | Model version to use for generation (default: `"flux-kontext-pro"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |
| `safetyTolerance` | integer | no | Content moderation level (0-6 for generation, 0-2 for editing) (default: `6`) |
| `watermark` | string | no | Watermark identifier to add to the generated image |

### flux2_image

Generate and edit images using Black Forest Labs' Flux 2 models (Pro/Flex) with multi-reference consistency, photoreal detail, and accurate text rendering

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired image (3-5000 characters) |
| `input_urls` | array | no | Reference images for image-to-image mode (1-8 URLs). Omit for text-to-image mode. |
| `aspect_ratio` | `1:1` / `4:3` / `3:4` / `16:9` / `9:16` / `3:2` / `2:3` / `auto` | no | Aspect ratio for the generated image. 'auto' only valid with input_urls. (default: `"1:1"`) |
| `resolution` | `1K` / `2K` | no | Output resolution. Pro: 1K (~$0.025), 2K (~$0.035). Flex: 1K (~$0.07), 2K (~$0.12). (default: `"1K"`) |
| `model_type` | `pro` / `flex` | no | Model variant: 'pro' for fast reliable results, 'flex' for more control and fine-tuning. (default: `"pro"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### gpt_image_2

Generate images using GPT Image 2 (text-to-image and image-to-image with up to 16 reference images)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired image (max 20000 characters) |
| `input_urls` | array | no | Array of up to 16 image URLs for image-to-image mode. Omit for text-to-image. |
| `aspect_ratio` | `auto` / `1:1` / `9:16` / `16:9` / `4:3` / `3:4` | no | Image aspect ratio (default: `"auto"`) |
| `resolution` | `1K` / `2K` / `4K` | no | Output resolution (default: `"1K"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### ideogram_reframe

Reframe images to different aspect ratios and sizes using Ideogram V3 Reframe model

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | yes | URL of image to reframe (JPEG, PNG, WEBP, max 10MB) |
| `image_size` | `square` / `square_hd` / `portrait_4_3` / `portrait_16_9` / `landscape_4_3` / `landscape_16_9` | no | Output size for the reframed image (default: `"square_hd"`) |
| `rendering_speed` | `TURBO` / `BALANCED` / `QUALITY` | no | Rendering speed for generation (default: `"BALANCED"`) |
| `style` | `AUTO` / `GENERAL` / `REALISTIC` / `DESIGN` | no | Style type for generation (default: `"AUTO"`) |
| `num_images` | `1` / `2` / `3` / `4` | no | Number of images to generate (default: `"1"`) |
| `seed` | integer | no | Seed for reproducible results (default: `0`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### midjourney_generate

Generate images and videos using Midjourney AI models (unified tool for text-to-image, image-to-image, style reference, omni reference, and video generation)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired image or video (max 2000 characters) |
| `fileUrl` | string | no | Single image URL for image-to-image or video generation (legacy - use fileUrls instead) |
| `fileUrls` | array | no | Array of image URLs for image-to-image or video generation (recommended) |
| `taskType` | `mj_txt2img` / `mj_img2img` / `mj_style_reference` / `mj_omni_reference` / `mj_video` / `mj_video_hd` | no | Task type for generation mode (auto-detected if not provided) |
| `aspectRatio` | `1:1` / `9:16` / `16:9` / `4:3` / `3:4` / `21:9` / `2:3` / `3:2` | no | Output aspect ratio (default: `"1:1"`) |
| `processMode` | `relax` / `fast` | no |  (default: `"relax"`) |
| `weird` | integer | no |  |
| `raw` | boolean | no |  (default: `false`) |
| `seed` | integer | no |  |
| `stylize` | integer | no |  |
| `quality` | number | no |  |
| `chaos` | integer | no |  |
| `repeat` | integer | no |  |
| `stop` | integer | no |  |
| `motion` | number | no | Motion level for video generation (required for video mode) |
| `videoBatchSize` | integer | no | Number of videos to generate (video mode only) |
| `high_definition_video` | boolean | no | Use high definition video generation instead of standard definition (default: `false`) |
| `ow` | string | no | Omni intensity parameter for omni reference tasks (1-1000) |
| `sref` | string | no |  |
| `version` | string | no | Midjourney model version |
| `speed` | `relax` / `fast` / `turbo` | no | Generation speed (not required for video/omni tasks) |
| `variety` | integer | no | Controls diversity of generated results (0-100, increment by 5) |
| `stylization` | integer | no | Artistic style intensity (0-1000, suggested multiple of 50) |
| `weirdness` | integer | no | Creativity and uniqueness level (0-3000, suggested multiple of 100) |
| `enableTranslation` | boolean | no | Auto-translate non-English prompts to English |
| `waterMark` | string | no | Watermark identifier |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### nano_banana_image

Generate and edit images using Nano Banana 2 or the faster 1K Nano Banana 2 Lite. Nano Banana 2 supports 4K, 14 references, and Google Search grounding; Lite supports up to 10 references.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | `nano-banana-2` / `nano-banana-2-lite` | no | Nano Banana model: nano-banana-2 supports up to 4K and 14 references; nano-banana-2-lite is the faster 1K model with up to 10 references (default: `"nano-banana-2"`) |
| `prompt` | string | no | Text prompt for image generation or editing (max 20000 chars). Nano Banana models support up to 20K characters. |
| `image_input` | array | no | Array of reference image URLs for editing mode (up to 14 images for multi-reference) |
| `output_format` | `png` / `jpg` | no | Output format for generate/edit modes (default: `"png"`) |
| `aspect_ratio` | `1:1` / `1:4` / `1:8` / `2:3` / `3:2` / `3:4` / `4:1` / `4:3` / `4:5` / `5:4` / `8:1` / `9:16` / `16:9` / `21:9` / `auto` | no | Aspect ratio for generate/edit modes (default: `"1:1"`) |
| `resolution` | `1K` / `2K` / `4K` | no | Output resolution: 1K (8 credits), 2K (12 credits), 4K (18 credits) (default: `"1K"`) |
| `google_search` | boolean | no | Enable Google Search grounding for factual image generation (default: `false`) |
| `callBackUrl` | string | no | Optional URL for task completion notifications (uses KIE_AI_CALLBACK_URL if not provided) |

### qwen_image

Generate and edit images using Qwen models (unified tool for both text-to-image and image editing)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt for image generation or editing |
| `image_url` | string | no | URL of image to edit (optional - if not provided, uses text-to-image) |
| `image_size` | `square` / `square_hd` / `portrait_4_3` / `portrait_16_9` / `landscape_4_3` / `landscape_16_9` | no | Image size (default: `"square_hd"`) |
| `num_inference_steps` | integer | no | Number of inference steps (2-250 for text-to-image, 2-49 for edit) |
| `seed` | number | no | Random seed for reproducible results |
| `guidance_scale` | number | no | CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit) |
| `enable_safety_checker` | boolean | no | Enable safety checker (default: `false`) |
| `output_format` | `png` / `jpeg` | no | Output format (default: `"png"`) |
| `negative_prompt` | string | no | Negative prompt (max 500 characters) (default: `" "`) |
| `acceleration` | `none` / `regular` / `high` | no | Acceleration level (default: `"none"`) |
| `num_images` | `1` / `2` / `3` / `4` | no | Number of images (1-4, edit mode only) |
| `sync_mode` | boolean | no | Sync mode (edit mode only) (default: `false`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### recraft_remove_background

Remove backgrounds from images using Recraft AI background removal model

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `image` | string | yes | URL of image to remove background from (PNG, JPG, WEBP, max 5MB, 16MP, 4096px max, 256px min) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### topaz_upscale_image

Upscale and enhance images using Topaz Labs AI upscaler. Increases resolution with high-fidelity detail restoration, natural texture reconstruction, and improved clarity. Supports 1x-8x upscaling (max output 20,000px per side). Pricing: 10 credits (≤2K), 20 credits (4K), 40 credits (8K).

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | yes | URL of image to upscale (JPEG, PNG, WEBP, max 10MB) |
| `upscale_factor` | `1` / `2` / `4` / `8` | no | Upscale factor: 1x (enhance only), 2x (default), 4x, or 8x. Max output dimension is 20,000px. (default: `"2"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### z_image

Generate photorealistic images using Tongyi-MAI Z-Image model. Ultra-fast Turbo performance, accurate bilingual text rendering (Chinese/English), strong semantic understanding. Pricing: ~$0.004/image

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired image (max 5000 characters). Supports bilingual prompts. |
| `aspect_ratio` | `1:1` / `4:3` / `3:4` / `16:9` / `9:16` | no | Aspect ratio for the generated image (default: `"1:1"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

## Video tools

### bytedance_seedance_video

Generate videos with ByteDance Seedance 2.0: standard, fast, or lower-cost Mini modes with multimodal references and native audio.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt for video generation (3-20000 characters) |
| `mode` | `standard` / `fast` / `mini` | no | Generation mode: standard (higher quality), fast (iterative workflows), or mini (lowest-cost, fastest workflow) (default: `"standard"`) |
| `first_frame_url` | string | no | URL of image to use as the first frame (optional) |
| `last_frame_url` | string | no | URL of image to use as the last frame (optional) |
| `reference_image_urls` | array | no | Reference images for style/subject guidance (up to 9) |
| `reference_video_urls` | array | no | Reference videos for motion/style guidance (up to 3) |
| `reference_audio_urls` | array | no | Reference audio for sound-guided generation (up to 3) |
| `aspect_ratio` | `1:1` / `9:16` / `16:9` / `4:3` / `3:4` / `21:9` / `9:21` / `adaptive` | no | Aspect ratio of the generated video (default: `"16:9"`) |
| `resolution` | `480p` / `720p` | no | Video resolution: 480p for faster, 720p for balance (default: `"720p"`) |
| `duration` | integer | no | Duration of video in seconds (4-15) (default: `5`) |
| `generate_audio` | boolean | no | Generate native audio for the video (default: `true`) |
| `web_search` | boolean | no | Enable web search to enhance prompt understanding (default: `false`) |
| `nsfw_checker` | boolean | no | Enable NSFW content filtering (default: `false`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### gemini_omni

Create Gemini Omni videos or reusable Omni characters and voices from multimodal inputs.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `operation` | `video` / `character` / `audio` | no |  (default: `"video"`) |
| `prompt` | string | no |  |
| `image_urls` | array | no |  |
| `audio_ids` | array | no |  |
| `video_list` | array | no |  |
| `character_ids` | array | no |  |
| `duration` | `4` / `6` / `8` / `10` | no |  |
| `aspect_ratio` | `16:9` / `9:16` | no |  |
| `resolution` | `720p` / `1080p` / `4k` | no |  |
| `seed` | integer | no |  |
| `character_name` | string | no |  |
| `descriptions` | string | no |  |
| `audio_id` | string | no |  |
| `name` | string | no |  |
| `voice_description` | string | no |  |
| `example_dialogue` | string | no |  |
| `callBackUrl` | string | no |  |

### grok_imagine

Generate images and videos using xAI's Grok Imagine (4 modes: text-to-image, text-to-video, image-to-video, upscale). Supports synchronized audio with video. Pricing: ~$0.10 per 6-second video

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | no | Text prompt describing the desired content (required for text modes, optional for image-to-video) |
| `image_urls` | array | no | Single image URL for image-to-video mode (alternative to task_id) |
| `task_id` | string | no | Task ID from a previous Grok generation (for upscale or image-to-video from generated image) |
| `index` | integer | no | Image index from task_id (0-5, Grok generates 6 images per task) |
| `aspect_ratio` | `2:3` / `3:2` / `1:1` | no | Aspect ratio for generated content (default: `"1:1"`) |
| `mode` | `fun` / `normal` / `spicy` | no | Generation style: 'normal' (default), 'fun' (playful), 'spicy' (expressive, not available with external images) (default: `"normal"`) |
| `generation_mode` | `text-to-image` / `text-to-video` / `image-to-video` / `upscale` | no | Explicit mode selection (auto-detected if not provided): text-to-image, text-to-video, image-to-video, or upscale |
| `callBackUrl` | string | no | Optional: URL for task completion notifications |

### hailuo_video

Generate videos using Hailuo AI models (unified tool for text-to-video and image-to-video with standard/pro quality). Supports v02 (original) and v2.3 (enhanced motion/expressions, 1080P)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired video content (max 1500 characters) |
| `imageUrl` | string | no | URL of input image for image-to-video mode (optional - if not provided, uses text-to-video) |
| `endImageUrl` | string | no | URL of end frame image for image-to-video (optional - requires imageUrl) |
| `version` | `02` / `2.3` | no | Hailuo model version: '02' (original) or '2.3' (better motion, expressions, 1080P support) (default: `"02"`) |
| `quality` | `standard` / `pro` | no | Quality level of video generation (standard for faster, pro for higher quality) (default: `"standard"`) |
| `duration` | `6` / `10` | no | Duration of video in seconds (standard quality only). Note: 10s not supported with 1080P in v2.3 (default: `"6"`) |
| `resolution` | `512P` / `768P` / `1080P` | no | Resolution of video (standard quality only). v02: 512P/768P, v2.3: 768P/1080P (default: `"768P"`) |
| `promptOptimizer` | boolean | no | Whether to use the model's prompt optimizer for better results (default: `true`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### happyhorse_video

Generate videos using Alibaba HappyHorse 1.0 (text-to-video, image-to-video, reference-to-video with up to 9 images, video-edit with native audio)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `text-to-video` / `image-to-video` / `reference-to-video` / `video-edit` | no | Generation mode: text-to-video (default), image-to-video, reference-to-video, or video-edit. Auto-detected from parameters if omitted. |
| `prompt` | string | yes | Text prompt for video generation (max 5000 characters) |
| `image_urls` | array | no | Input image URL for image-to-video mode (max 1) |
| `reference_image` | array | no | Reference images for reference-to-video mode (up to 9) |
| `video_url` | string | no | Video URL to edit (video-edit mode) |
| `reference_image_edit` | array | no | Reference images for video-edit mode (up to 5) |
| `audio_setting` | `auto` / `origin` | no | Audio handling for video-edit: auto or origin |
| `resolution` | `720p` / `1080p` | no | Video resolution (default: `"1080p"`) |
| `aspect_ratio` | `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | no | Aspect ratio of the generated video (default: `"16:9"`) |
| `duration` | integer | no | Duration in seconds (3-15) (default: `5`) |
| `seed` | integer | no | Random seed for reproducible results (0-2147483647) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications |

### infinitalk_lip_sync

Generate AI lip-sync talking videos using MeiGen-AI InfiniTalk. Transforms portrait image + audio into natural talking avatar with synchronized lips, facial expressions, and head movements. Pricing: ~$0.015/s (480p), ~$0.06/s (720p), max 15s

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | yes | URL of the portrait image to animate (JPEG, PNG, WEBP, max 10MB) |
| `audio_url` | string | yes | URL of the audio file for lip sync (MPEG, WAV, AAC, MP4, OGG, max 10MB) |
| `prompt` | string | yes | Text prompt to guide video generation (e.g., 'A young woman talking on a podcast') |
| `resolution` | `480p` / `720p` | no | Video resolution: 480p (faster, cheaper) or 720p (higher quality) (default: `"480p"`) |
| `seed` | integer | no | Random seed for reproducibility (10000-1000000) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications |

### kling_avatar

Generate lifelike talking avatar videos using Kuaishou Kling AI. Transforms portrait photo + audio into realistic avatar with accurate lip-sync, emotions, and identity preservation. Pricing: ~$0.04/s (720P standard), ~$0.08/s (1080P pro), max 15s

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | yes | URL of the portrait image for avatar (JPEG, PNG, WEBP, max 10MB) |
| `audio_url` | string | yes | URL of the audio file for the avatar to speak (MPEG, WAV, AAC, MP4, OGG, max 10MB) |
| `prompt` | string | yes | Text prompt to guide video generation (emotions, expressions, scene settings) |
| `quality` | `standard` / `pro` | no | Video quality: standard (720P, faster) or pro (1080P, higher quality) (default: `"standard"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications |

### kling_video

Generate videos using Kling 3.0 AI - supports 3-15s flexible duration, native multilingual audio, multi-shot storytelling, character elements, and std/pro quality modes

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired video content (max 5000 characters). For audio: use [Character name, voice style] format for dialogue |
| `image_urls` | array | no | Up to 2 image URLs: first = start frame, second = end frame (optional - if not provided, uses text-to-video) |
| `duration` | string | no | Duration of video in seconds (3-15) (default: `"5"`) |
| `aspect_ratio` | `16:9` / `9:16` / `1:1` | no | Aspect ratio of video (text-to-video mode only) (default: `"16:9"`) |
| `mode` | `std` / `pro` | no | Quality mode: 'std' for standard (faster, cheaper), 'pro' for professional quality (default: `"std"`) |
| `sound` | boolean | no | Enable native audio generation including multilingual speech, sound effects, and ambient sound. Pricing: with audio is 2x credits (default: `false`) |
| `multi_shots` | boolean | no | Enable multi-shot mode for cinematic storytelling with multiple scenes (requires multi_prompt) (default: `false`) |
| `multi_prompt` | array | no | Array of shot definitions for multi-shot mode. Each shot has a prompt and duration (1-12s) |
| `kling_elements` | array | no | Character/object elements for consistent identity across shots. Provide name, description, and reference images/videos |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### omnihuman_video

Animate a portrait, pet, or character from an image and audio using ByteDance OmniHuman 1.5.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | yes | Portrait image URL to animate |
| `audio_url` | string | yes | Audio URL that drives the animation |
| `mask_url` | array | no |  |
| `prompt` | string | no |  |
| `output_resolution` | `720` / `1080` | no |  (default: `"1080"`) |
| `pe_fast_mode` | boolean | no |  (default: `false`) |
| `seed` | integer | no |  (default: `-1`) |
| `callBackUrl` | string | no |  |

### runway_aleph_video

Transform videos using Runway Aleph video-to-video generation with AI-powered editing

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing the desired video transformation (max 1000 characters) |
| `videoUrl` | string | yes | URL of the input video to transform |
| `waterMark` | string | no | Watermark text to add to the video (default: `""`) |
| `uploadCn` | boolean | no | Whether to upload to China servers (default: `false`) |
| `aspectRatio` | `16:9` / `9:16` / `4:3` / `3:4` / `1:1` / `21:9` | no | Aspect ratio of the output video (default: `"16:9"`) |
| `seed` | integer | no | Random seed for reproducible results (1-999999) |
| `referenceImage` | string | no | URL of reference image for style guidance |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### veo3_generate_video

Generate professional-quality videos using Google's Veo3 API

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Text prompt describing desired video content |
| `imageUrls` | array | no | Image URLs for image-to-video generation: 1 image (video unfolds around it) or 2 images (first=start frame, second=end frame) |
| `model` | `veo3` / `veo3_fast` | no | Model type: veo3 (quality) or veo3_fast (cost-efficient) (default: `"veo3"`) |
| `watermark` | string | no | Watermark text to add to video |
| `aspectRatio` | `16:9` / `9:16` / `Auto` | no | Video aspect ratio (16:9 supports 1080P) (default: `"16:9"`) |
| `seeds` | integer | no | Random seed for consistent results |
| `callBackUrl` | string | no | Callback URL for task completion notifications |
| `enableFallback` | boolean | no | Enable fallback mechanism for content policy failures (Note: fallback videos cannot use 1080P endpoint) (default: `false`) |
| `enableTranslation` | boolean | no | Auto-translate prompts to English for better results (default: `true`) |

### veo3_get_1080p_video

Get 1080P high-definition version of a Veo3 video (not available for fallback mode videos)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `task_id` | string | yes | Veo3 task ID to get 1080p video for |
| `index` | integer | no | Video index (optional, for multiple video results) |

### wan_animate

Animate static images or replace characters in videos using Alibaba's Wan 2.2 Animate models with motion transfer and seamless environmental integration

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `video_url` | string | yes | URL of the reference video (MP4, QUICKTIME, X-MATROSKA, max 10MB, max 30 seconds) |
| `image_url` | string | yes | URL of the character image (JPEG, PNG, WEBP, max 10MB). Will be resized and center-cropped to match video aspect ratio. |
| `mode` | `animate` / `replace` | no | Animation mode: 'animate' transfers motion/expressions from video to image, 'replace' swaps the character in video with the image (default: `"animate"`) |
| `resolution` | `480p` / `580p` / `720p` | no | Output resolution: 480p (~$0.03/sec), 580p (~$0.0475/sec), 720p (~$0.0625/sec) (default: `"480p"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### wan_video

Generate videos using Alibaba Wan 2.7 (text-to-video, image-to-video, reference-to-video, video-edit with native audio support)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `text-to-video` / `image-to-video` / `reference-to-video` / `video-edit` | no | Generation mode: text-to-video (default), image-to-video, reference-to-video, or video-edit. Auto-detected from parameters if omitted. |
| `prompt` | string | yes | Text prompt for video generation (max 5000 characters) |
| `negative_prompt` | string | no | Negative prompt to describe content to avoid (max 500 characters) |
| `audio_url` | string | no | Audio URL for text-to-video with audio (T2V mode only) |
| `first_frame_url` | string | no | URL of first frame image for image-to-video mode |
| `last_frame_url` | string | no | URL of last frame image for image-to-video mode |
| `first_clip_url` | string | no | URL of first video clip for image-to-video mode |
| `driving_audio_url` | string | no | Audio URL to drive facial expressions (I2V mode) |
| `reference_image` | array | no | Reference images for reference-to-video mode (up to 5) |
| `reference_video` | array | no | Reference videos for reference-to-video mode (up to 5) |
| `reference_voice` | string | no | Voice reference URL for R2V mode |
| `first_frame` | string | no | First frame image URL for R2V mode |
| `video_url_edit` | string | no | Video URL to edit (video-edit mode) |
| `reference_image_edit` | string | no | Reference image URL for video-edit mode |
| `audio_setting` | `auto` / `origin` | no | Audio handling for video-edit: auto or origin |
| `resolution` | `720p` / `1080p` | no | Video resolution (default: `"1080p"`) |
| `ratio` | `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | no | Aspect ratio of the generated video (default: `"16:9"`) |
| `duration` | integer | no | Duration in seconds (2-15) (default: `5`) |
| `prompt_extend` | boolean | no | Enable prompt rewriting using LLM for better results (default: `true`) |
| `watermark` | boolean | no | Add watermark to generated video (default: `false`) |
| `seed` | integer | no | Random seed for reproducible results (0-2147483647) |
| `nsfw_checker` | boolean | no | Enable NSFW content filter (default: `false`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications |

## Audio tools

### elevenlabs_tts

Generate speech from text using ElevenLabs TTS models (Turbo 2.5 by default, with optional Multilingual v2 support)

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `text` | string | yes | The text to convert to speech (max 5000 characters) |
| `model` | `turbo` / `multilingual` | no | TTS model to use - turbo (faster, default) or multilingual (supports context) (default: `"turbo"`) |
| `voice` | `Rachel` / `Aria` / `Roger` / `Sarah` / `Laura` / `Charlie` / `George` / `Callum` / `River` / `Liam` / `Charlotte` / `Alice` / `Matilda` / `Will` / `Jessica` / `Eric` / `Chris` / `Brian` / `Daniel` / `Lily` / `Bill` | no | Voice to use for speech generation (default: `"Rachel"`) |
| `stability` | number | no | Voice stability (0-1, step 0.01) (default: `0.5`) |
| `similarity_boost` | number | no | Similarity boost (0-1, step 0.01) (default: `0.75`) |
| `style` | number | no | Style exaggeration (0-1, step 0.01) (default: `0`) |
| `speed` | number | no | Speech speed (0.7-1.2, step 0.01) (default: `1`) |
| `timestamps` | boolean | no | Whether to return timestamps for each word (default: `false`) |
| `previous_text` | string | no | Text that came before current request (multilingual model only, max 5000 characters) (default: `""`) |
| `next_text` | string | no | Text that comes after current request (multilingual model only, max 5000 characters) (default: `""`) |
| `language_code` | string | no | Language code (ISO 639-1) for language enforcement (turbo model only) (default: `""`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### elevenlabs_ttsfx

Generate sound effects from text descriptions using ElevenLabs Sound Effects v2 model

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `text` | string | yes | The text describing the sound effect to generate (max 5000 characters) |
| `loop` | boolean | no | Whether to create a sound effect that loops smoothly (default: `false`) |
| `duration_seconds` | number | no | Duration in seconds (0.5-22). If not specified, optimal duration will be determined from prompt |
| `prompt_influence` | number | no | How closely to follow the prompt (0-1). Higher values mean less variation (default: `0.3`) |
| `output_format` | `mp3_22050_32` / `mp3_44100_32` / `mp3_44100_64` / `mp3_44100_96` / `mp3_44100_128` / `mp3_44100_192` / `pcm_8000` / `pcm_16000` / `pcm_22050` / `pcm_24000` / `pcm_44100` / `pcm_48000` / `ulaw_8000` / `alaw_8000` / `opus_48000_32` / `opus_48000_64` / `opus_48000_96` / `opus_48000_128` / `opus_48000_192` | no | Output format of the generated audio (default: `"mp3_44100_192"`) |
| `callBackUrl` | string | no | Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided) |

### suno_generate_music

Generate music with AI using Suno models (V3_5, V4, V4_5, V4_5PLUS, V5, V5_5). V5_5 supports requested duration.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | yes | Description of the desired audio content. In custom mode: used as exact lyrics (max 5000 chars for V4_5+, V5; 3000 for V3_5, V4). In non-custom mode: core idea for auto-generated lyrics (max 500 chars) |
| `customMode` | boolean | yes | Enable advanced parameter customization. If true: requires style and title. If false: simplified mode with only prompt required |
| `instrumental` | boolean | yes | Generate instrumental music (no lyrics). In custom mode: if true, only style and title required; if false, prompt used as exact lyrics |
| `model` | `V3_5` / `V4` / `V4_5` / `V4_5PLUS` / `V5` / `V5_5` | no | AI model version for generation (default: `"V5"`) |
| `callBackUrl` | string | no | URL to receive task completion updates (optional, will use KIE_AI_CALLBACK_URL env var if not provided) |
| `style` | string | no | Music style/genre (required in custom mode, max 1000 chars for V4_5+, V5; 200 for V3_5, V4) |
| `title` | string | no | Track title (required in custom mode, max 80 chars) |
| `duration` | integer | no | Requested track duration in seconds (available only with V5_5) |
| `negativeTags` | string | no | Music styles to exclude (optional, max 200 chars) |
| `vocalGender` | `m` / `f` | no | Vocal gender preference (optional, only effective in custom mode) |
| `styleWeight` | number | no | Strength of style adherence (optional, range 0-1, up to 2 decimal places) |
| `weirdnessConstraint` | number | no | Controls experimental/creative deviation (optional, range 0-1, up to 2 decimal places) |
| `audioWeight` | number | no | Balance weight for audio features (optional, range 0-1, up to 2 decimal places) |

## Utility tools

### get_task_status

Get the status of a generation task with intelligent polling guidance. Returns task status, results, and recommended polling strategy (interval, timing, next steps) based on task type (image/video/audio).

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `task_id` | string | yes | Task ID to check status for |

### list_tasks

List recent tasks with their status

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | no | Maximum number of tasks to return (default: `20`) |
| `status` | `pending` / `processing` / `completed` / `failed` | no | Filter by status |

### wait_for_task

Wait for a generation task to complete in a single call, so you don't have to poll get_task_status repeatedly. Pass the task_id returned by any generation tool: it blocks until the result is ready (or the timeout) and returns the final URLs, streaming progress meanwhile. By default it polls the Kie API directly (no setup); if a callback rendezvous is configured (KIE_AI_RESULT_URL, rendezvous_url, or a KIE_AI_CALLBACK_URL ending in /kie/callback) it waits on that instead. Tip for long jobs: clients should enable resetTimeoutOnProgress with a generous maxTotalTimeout.

#### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `task_id` | string | yes | Task ID returned by a generation tool to wait for |
| `timeout_seconds` | integer | no | Max seconds to wait before giving up (default: `180`) |
| `interval_seconds` | integer | no | Seconds between status checks while waiting (default: `5`) |
| `rendezvous_url` | string | no | Optional callback rendezvous result base URL (e.g. https://felo-workers.felo.workers.dev/kie/result). Omit to poll the Kie API directly (the default). When set, or when KIE_AI_RESULT_URL / a KIE_AI_CALLBACK_URL ending in /kie/callback is configured, it waits on the rendezvous instead |

