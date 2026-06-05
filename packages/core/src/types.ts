import { z } from "zod";

// Zod schemas for request validation
// Nano Banana 2 - powered by Gemini 3.1 Flash Image
export const NanoBananaImageSchema = z
  .object({
    // Text-to-image parameters
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .optional()
      .describe(
        "Text prompt for image generation or editing (max 20000 chars). Nano Banana models support up to 20K characters.",
      ),

    // Edit mode parameters - up to 14 reference images for multi-reference
    image_input: z
      .array(z.string().url())
      .min(1)
      .max(14)
      .optional()
      .describe(
        "Array of reference image URLs for editing mode (up to 14 images for multi-reference)",
      ),

    // Common parameters for generate/edit modes
    output_format: z
      .enum(["png", "jpg"])
      .default("png")
      .optional()
      .describe("Output format for generate/edit modes"),
    aspect_ratio: z
      .enum([
        "1:1",
        "1:4",
        "1:8",
        "2:3",
        "3:2",
        "3:4",
        "4:1",
        "4:3",
        "4:5",
        "5:4",
        "8:1",
        "9:16",
        "16:9",
        "21:9",
        "auto",
      ])
      .default("1:1")
      .optional()
      .describe("Aspect ratio for generate/edit modes"),
    resolution: z
      .enum(["1K", "2K", "4K"])
      .default("1K")
      .optional()
      .describe(
        "Output resolution: 1K (8 credits), 2K (12 credits), 4K (18 credits)",
      ),
    google_search: z
      .boolean()
      .default(false)
      .optional()
      .describe("Enable Google Search grounding for factual image generation"),
  })
  .refine(
    (data) => {
      // Smart mode detection and validation
      const hasPrompt = !!data.prompt;
      const hasImageInput = !!data.image_input && data.image_input.length > 0;

      // Edit mode: requires prompt and image_input
      if (hasImageInput) {
        return hasPrompt;
      }

      // Generate mode: requires prompt only
      if (hasPrompt) {
        return true;
      }

      // No valid mode detected
      return false;
    },
    {
      message:
        "Invalid parameter combination. Provide either: 1) prompt only (generate mode), or 2) prompt + image_input (edit mode)",
      path: [],
    },
  );

export const Veo3GenerateSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(2000)
    .describe("Text prompt describing desired video content"),
  imageUrls: z
    .array(z.string().url())
    .min(1)
    .max(2)
    .optional()
    .describe(
      "Image URLs for image-to-video generation: 1 image (video unfolds around it) or 2 images (first=start frame, second=end frame)",
    ),
  model: z
    .enum(["veo3", "veo3_fast"])
    .default("veo3")
    .describe("Model type: veo3 (quality) or veo3_fast (cost-efficient)"),
  watermark: z
    .string()
    .max(100)
    .optional()
    .describe("Watermark text to add to video"),
  aspectRatio: z
    .enum(["16:9", "9:16", "Auto"])
    .default("16:9")
    .describe("Video aspect ratio (16:9 supports 1080P)"),
  seeds: z
    .number()
    .int()
    .min(10000)
    .max(99999)
    .optional()
    .describe("Random seed for consistent results"),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe("Callback URL for task completion notifications"),
  enableFallback: z
    .boolean()
    .default(false)
    .describe(
      "Enable fallback mechanism for content policy failures (Note: fallback videos cannot use 1080P endpoint)",
    ),
  enableTranslation: z
    .boolean()
    .default(true)
    .optional()
    .describe("Auto-translate prompts to English for better results"),
});

export const SunoGenerateSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe(
        "Description of the desired audio content. In custom mode: used as exact lyrics (max 5000 chars for V4_5+, V5; 3000 for V3_5, V4). In non-custom mode: core idea for auto-generated lyrics (max 500 chars)",
      ),
    customMode: z
      .boolean()
      .describe(
        "Enable advanced parameter customization. If true: requires style and title. If false: simplified mode with only prompt required",
      ),
    instrumental: z
      .boolean()
      .describe(
        "Generate instrumental music (no lyrics). In custom mode: if true, only style and title required; if false, prompt used as exact lyrics",
      ),
    model: z
      .enum(["V3_5", "V4", "V4_5", "V4_5PLUS", "V5"])
      .default("V5")
      .optional()
      .describe("AI model version for generation"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "URL to receive task completion updates (optional, will use KIE_AI_CALLBACK_URL env var if not provided)",
      ),
    style: z
      .string()
      .max(1000)
      .optional()
      .describe(
        "Music style/genre (required in custom mode, max 1000 chars for V4_5+, V5; 200 for V3_5, V4)",
      ),
    title: z
      .string()
      .max(80)
      .optional()
      .describe("Track title (required in custom mode, max 80 chars)"),
    negativeTags: z
      .string()
      .max(200)
      .optional()
      .describe("Music styles to exclude (optional, max 200 chars)"),
    vocalGender: z
      .enum(["m", "f"])
      .optional()
      .describe(
        "Vocal gender preference (optional, only effective in custom mode)",
      ),
    styleWeight: z
      .number()
      .min(0)
      .max(1)
      .multipleOf(0.01)
      .optional()
      .describe(
        "Strength of style adherence (optional, range 0-1, up to 2 decimal places)",
      ),
    weirdnessConstraint: z
      .number()
      .min(0)
      .max(1)
      .multipleOf(0.01)
      .optional()
      .describe(
        "Controls experimental/creative deviation (optional, range 0-1, up to 2 decimal places)",
      ),
    audioWeight: z
      .number()
      .min(0)
      .max(1)
      .multipleOf(0.01)
      .optional()
      .describe(
        "Balance weight for audio features (optional, range 0-1, up to 2 decimal places)",
      ),
  })
  .refine(
    (data) => {
      // Callback URL is now optional - validation removed
      if (data.customMode) {
        if (data.instrumental) {
          return data.style && data.title;
        } else {
          return data.style && data.title && data.prompt;
        }
      }
      return true;
    },
    {
      message:
        "In customMode: style and title are always required, prompt is required when instrumental is false",
      path: [],
    },
  );

export const ElevenLabsTTSSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(5000)
    .describe("The text to convert to speech (max 5000 characters)"),
  model: z
    .enum(["turbo", "multilingual"])
    .default("turbo")
    .optional()
    .describe(
      "TTS model to use - turbo (faster, default) or multilingual (supports context)",
    ),
  voice: z
    .enum([
      "Rachel",
      "Aria",
      "Roger",
      "Sarah",
      "Laura",
      "Charlie",
      "George",
      "Callum",
      "River",
      "Liam",
      "Charlotte",
      "Alice",
      "Matilda",
      "Will",
      "Jessica",
      "Eric",
      "Chris",
      "Brian",
      "Daniel",
      "Lily",
      "Bill",
    ])
    .default("Rachel")
    .optional()
    .describe("Voice to use for speech generation"),
  stability: z
    .number()
    .min(0)
    .max(1)
    .multipleOf(0.01)
    .default(0.5)
    .optional()
    .describe("Voice stability (0-1, step 0.01)"),
  similarity_boost: z
    .number()
    .min(0)
    .max(1)
    .multipleOf(0.01)
    .default(0.75)
    .optional()
    .describe("Similarity boost (0-1, step 0.01)"),
  style: z
    .number()
    .min(0)
    .max(1)
    .multipleOf(0.01)
    .default(0)
    .optional()
    .describe("Style exaggeration (0-1, step 0.01)"),
  speed: z
    .number()
    .min(0.7)
    .max(1.2)
    .multipleOf(0.01)
    .default(1)
    .optional()
    .describe("Speech speed (0.7-1.2, step 0.01)"),
  timestamps: z
    .boolean()
    .default(false)
    .optional()
    .describe("Whether to return timestamps for each word"),
  previous_text: z
    .string()
    .max(5000)
    .default("")
    .optional()
    .describe(
      "Text that came before current request (multilingual model only, max 5000 characters)",
    ),
  next_text: z
    .string()
    .max(5000)
    .default("")
    .optional()
    .describe(
      "Text that comes after current request (multilingual model only, max 5000 characters)",
    ),
  language_code: z
    .string()
    .max(500)
    .default("")
    .optional()
    .describe(
      "Language code (ISO 639-1) for language enforcement (turbo model only)",
    ),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

export const ElevenLabsSoundEffectsSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      "The text describing the sound effect to generate (max 5000 characters)",
    ),
  loop: z
    .boolean()
    .default(false)
    .optional()
    .describe("Whether to create a sound effect that loops smoothly"),
  duration_seconds: z
    .number()
    .min(0.5)
    .max(22)
    .multipleOf(0.1)
    .optional()
    .describe(
      "Duration in seconds (0.5-22). If not specified, optimal duration will be determined from prompt",
    ),
  prompt_influence: z
    .number()
    .min(0)
    .max(1)
    .multipleOf(0.01)
    .default(0.3)
    .optional()
    .describe(
      "How closely to follow the prompt (0-1). Higher values mean less variation",
    ),
  output_format: z
    .enum([
      "mp3_22050_32",
      "mp3_44100_32",
      "mp3_44100_64",
      "mp3_44100_96",
      "mp3_44100_128",
      "mp3_44100_192",
      "pcm_8000",
      "pcm_16000",
      "pcm_22050",
      "pcm_24000",
      "pcm_44100",
      "pcm_48000",
      "ulaw_8000",
      "alaw_8000",
      "opus_48000_32",
      "opus_48000_64",
      "opus_48000_96",
      "opus_48000_128",
      "opus_48000_192",
    ])
    .default("mp3_44100_192")
    .optional()
    .describe("Output format of the generated audio"),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

// ByteDance Seedance 2.0 - Multimodal video generation with native audio
export const ByteDanceSeedanceVideoSchema = z
  .object({
    prompt: z
      .string()
      .min(3)
      .max(20000)
      .describe("Text prompt for video generation (3-20000 characters)"),
    // Mode: standard (seedance-2) or fast (seedance-2-fast)
    mode: z
      .enum(["standard", "fast"])
      .default("standard")
      .optional()
      .describe(
        "Generation mode: standard (seedance-2, higher quality) or fast (seedance-2-fast, iterative workflows)",
      ),
    // Frame control
    first_frame_url: z
      .string()
      .url()
      .optional()
      .describe("URL of image to use as the first frame (optional)"),
    last_frame_url: z
      .string()
      .url()
      .optional()
      .describe("URL of image to use as the last frame (optional)"),
    // Multimodal references
    reference_image_urls: z
      .array(z.string().url())
      .max(9)
      .optional()
      .describe("Reference images for style/subject guidance (up to 9)"),
    reference_video_urls: z
      .array(z.string().url())
      .max(3)
      .optional()
      .describe("Reference videos for motion/style guidance (up to 3)"),
    reference_audio_urls: z
      .array(z.string().url())
      .max(3)
      .optional()
      .describe("Reference audio for sound-guided generation (up to 3)"),
    // Output settings
    aspect_ratio: z
      .enum(["1:1", "9:16", "16:9", "4:3", "3:4", "21:9", "9:21", "adaptive"])
      .default("16:9")
      .optional()
      .describe("Aspect ratio of the generated video"),
    resolution: z
      .enum(["480p", "720p"])
      .default("720p")
      .optional()
      .describe("Video resolution: 480p for faster, 720p for balance"),
    duration: z
      .number()
      .int()
      .min(4)
      .max(15)
      .default(5)
      .optional()
      .describe("Duration of video in seconds (4-15)"),
    // Audio & safety
    generate_audio: z
      .boolean()
      .default(true)
      .optional()
      .describe("Generate native audio for the video"),
    web_search: z
      .boolean()
      .default(false)
      .optional()
      .describe("Enable web search to enhance prompt understanding"),
    nsfw_checker: z
      .boolean()
      .default(false)
      .optional()
      .describe("Enable NSFW content filtering"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine(
    (data) => {
      // "adaptive" aspect_ratio only valid with first_frame_url
      if (data.aspect_ratio === "adaptive" && !data.first_frame_url) {
        return false;
      }
      return true;
    },
    {
      message: "aspect_ratio 'adaptive' requires first_frame_url",
      path: ["aspect_ratio"],
    },
  );

export const RunwayAlephVideoSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(1000)
    .describe(
      "Text prompt describing the desired video transformation (max 1000 characters)",
    ),
  videoUrl: z.string().url().describe("URL of the input video to transform"),
  waterMark: z
    .string()
    .max(100)
    .default("")
    .optional()
    .describe("Watermark text to add to the video"),
  uploadCn: z
    .boolean()
    .default(false)
    .optional()
    .describe("Whether to upload to China servers"),
  aspectRatio: z
    .enum(["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"])
    .default("16:9")
    .optional()
    .describe("Aspect ratio of the output video"),
  seed: z
    .number()
    .int()
    .min(1)
    .max(999999)
    .optional()
    .describe("Random seed for reproducible results (1-999999)"),
  referenceImage: z
    .string()
    .url()
    .optional()
    .describe("URL of reference image for style guidance"),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

export const Wan27VideoSchema = z
  .object({
    mode: z
      .enum([
        "text-to-video",
        "image-to-video",
        "reference-to-video",
        "video-edit",
      ])
      .optional()
      .describe(
        "Generation mode: text-to-video (default), image-to-video, reference-to-video, or video-edit. Auto-detected from parameters if omitted.",
      ),
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe("Text prompt for video generation (max 5000 characters)"),
    negative_prompt: z
      .string()
      .max(500)
      .optional()
      .describe(
        "Negative prompt to describe content to avoid (max 500 characters)",
      ),
    // T2V
    audio_url: z
      .string()
      .url()
      .optional()
      .describe("Audio URL for text-to-video with audio (T2V mode only)"),
    // I2V
    first_frame_url: z
      .string()
      .url()
      .optional()
      .describe("URL of first frame image for image-to-video mode"),
    last_frame_url: z
      .string()
      .url()
      .optional()
      .describe("URL of last frame image for image-to-video mode"),
    first_clip_url: z
      .string()
      .url()
      .optional()
      .describe("URL of first video clip for image-to-video mode"),
    driving_audio_url: z
      .string()
      .url()
      .optional()
      .describe("Audio URL to drive facial expressions (I2V mode)"),
    // R2V
    reference_image: z
      .array(z.string().url())
      .max(5)
      .optional()
      .describe("Reference images for reference-to-video mode (up to 5)"),
    reference_video: z
      .array(z.string().url())
      .max(5)
      .optional()
      .describe("Reference videos for reference-to-video mode (up to 5)"),
    reference_voice: z
      .string()
      .url()
      .optional()
      .describe("Voice reference URL for R2V mode"),
    first_frame: z
      .string()
      .url()
      .optional()
      .describe("First frame image URL for R2V mode"),
    // Video Edit
    video_url_edit: z
      .string()
      .url()
      .optional()
      .describe("Video URL to edit (video-edit mode)"),
    reference_image_edit: z
      .string()
      .url()
      .optional()
      .describe("Reference image URL for video-edit mode"),
    audio_setting: z
      .enum(["auto", "origin"])
      .optional()
      .describe("Audio handling for video-edit: auto or origin"),
    // Common
    resolution: z
      .enum(["720p", "1080p"])
      .default("1080p")
      .optional()
      .describe("Video resolution"),
    ratio: z
      .enum(["16:9", "9:16", "1:1", "4:3", "3:4"])
      .default("16:9")
      .optional()
      .describe("Aspect ratio of the generated video"),
    duration: z
      .number()
      .int()
      .min(2)
      .max(15)
      .default(5)
      .optional()
      .describe("Duration in seconds (2-15)"),
    prompt_extend: z
      .boolean()
      .default(true)
      .optional()
      .describe("Enable prompt rewriting using LLM for better results"),
    watermark: z
      .boolean()
      .default(false)
      .optional()
      .describe("Add watermark to generated video"),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2147483647)
      .optional()
      .describe("Random seed for reproducible results (0-2147483647)"),
    nsfw_checker: z
      .boolean()
      .default(false)
      .optional()
      .describe("Enable NSFW content filter"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional: URL for task completion notifications"),
  })
  .refine(
    (data) => {
      const mode =
        data.mode ||
        (data.video_url_edit
          ? "video-edit"
          : data.reference_image || data.reference_video
            ? "reference-to-video"
            : data.first_frame_url || data.last_frame_url || data.first_clip_url
              ? "image-to-video"
              : "text-to-video");
      if (
        mode === "image-to-video" &&
        !data.first_frame_url &&
        !data.last_frame_url &&
        !data.first_clip_url
      ) {
        return false;
      }
      if (
        mode === "reference-to-video" &&
        !data.reference_image?.length &&
        !data.reference_video?.length
      ) {
        return false;
      }
      if (mode === "video-edit" && !data.video_url_edit) {
        return false;
      }
      return true;
    },
    {
      message:
        "Invalid parameter combination for the detected mode. Ensure required inputs are provided.",
      path: [],
    },
  );

export const ByteDanceSeedreamImageSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      "Text prompt for image generation or editing. V4: max 5000 chars, V5 Lite: max 3000 chars (API returns 500 error if exceeded)",
    ),
  image_urls: z
    .array(z.string().url())
    .min(1)
    .max(14)
    .optional()
    .describe(
      "Array of image URLs for editing mode (optional - if not provided, uses text-to-image). V4: max 10, V4.5: max 14",
    ),
  // Version selection: "4" for Seedream V4, "5-lite" for Seedream 5.0 Lite
  version: z
    .enum(["4", "5-lite"])
    .default("5-lite")
    .optional()
    .describe(
      "Seedream version: '4' for V4, '5-lite' for V5 Lite (default) with enhanced features",
    ),
  // V4 parameters
  image_size: z
    .enum([
      "square",
      "square_hd",
      "portrait_4_3",
      "portrait_3_2",
      "portrait_16_9",
      "landscape_4_3",
      "landscape_3_2",
      "landscape_16_9",
      "landscape_21_9",
    ])
    .default("square_hd")
    .optional()
    .describe("Image aspect ratio (V4 only)"),
  image_resolution: z
    .enum(["1K", "2K", "4K"])
    .default("1K")
    .optional()
    .describe("Image resolution (V4 only)"),
  max_images: z
    .number()
    .int()
    .min(1)
    .max(6)
    .default(1)
    .optional()
    .describe("Number of images to generate (V4 only)"),
  seed: z
    .number()
    .optional()
    .describe(
      "Random seed for reproducible results (V4 only, use -1 for random)",
    ),
  // V5 Lite parameters (same as V4.5: aspect_ratio, quality)
  aspect_ratio: z
    .enum(["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"])
    .default("1:1")
    .optional()
    .describe("Aspect ratio for V5 Lite output (V5 Lite only)"),
  quality: z
    .enum(["basic", "high"])
    .default("basic")
    .optional()
    .describe(
      "Output quality for V5 Lite (V5 Lite only): 'basic' = 2K, 'high' = 3K resolution",
    ),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

// Z-Image - Tongyi-MAI fast text-to-image with bilingual text rendering
export const ZImageSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      "Text prompt describing the desired image (max 5000 characters). Supports bilingual prompts.",
    ),
  aspect_ratio: z
    .enum(["1:1", "4:3", "3:4", "16:9", "9:16"])
    .default("1:1")
    .describe("Aspect ratio for the generated image"),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

export type ZImageRequest = z.infer<typeof ZImageSchema>;

// Grok Imagine - xAI multimodal image/video generation (text-to-image, text-to-video, image-to-video, upscale)
export const GrokImagineSchema = z
  .object({
    prompt: z
      .string()
      .max(5000)
      .optional()
      .describe(
        "Text prompt describing the desired content (required for text modes, optional for image-to-video)",
      ),
    // Image-to-video mode: use image_urls OR task_id+index
    image_urls: z
      .array(z.string().url())
      .max(1)
      .optional()
      .describe(
        "Single image URL for image-to-video mode (alternative to task_id)",
      ),
    task_id: z
      .string()
      .optional()
      .describe(
        "Task ID from a previous Grok generation (for upscale or image-to-video from generated image)",
      ),
    index: z
      .number()
      .int()
      .min(0)
      .max(5)
      .optional()
      .describe(
        "Image index from task_id (0-5, Grok generates 6 images per task)",
      ),
    // Common parameters
    aspect_ratio: z
      .enum(["2:3", "3:2", "1:1"])
      .default("1:1")
      .optional()
      .describe("Aspect ratio for generated content"),
    mode: z
      .enum(["fun", "normal", "spicy"])
      .default("normal")
      .optional()
      .describe(
        "Generation style: 'normal' (default), 'fun' (playful), 'spicy' (expressive, not available with external images)",
      ),
    // Mode selection (auto-detected if not provided)
    generation_mode: z
      .enum(["text-to-image", "text-to-video", "image-to-video", "upscale"])
      .optional()
      .describe(
        "Explicit mode selection (auto-detected if not provided): text-to-image, text-to-video, image-to-video, or upscale",
      ),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional: URL for task completion notifications"),
  })
  .refine(
    (data) => {
      // Upscale mode requires task_id only
      if (data.generation_mode === "upscale") {
        return !!data.task_id;
      }
      // Image-to-video needs image_urls OR task_id
      if (data.generation_mode === "image-to-video") {
        return (
          (data.image_urls && data.image_urls.length > 0) || !!data.task_id
        );
      }
      // Text modes require prompt
      if (
        data.generation_mode === "text-to-image" ||
        data.generation_mode === "text-to-video"
      ) {
        return !!data.prompt;
      }
      // Auto-detect: if task_id without prompt = upscale, if image_urls = i2v, else text mode
      if (data.task_id && !data.prompt && !data.image_urls) {
        return true; // upscale
      }
      if (data.image_urls && data.image_urls.length > 0) {
        return true; // image-to-video
      }
      if (data.prompt) {
        return true; // text-to-image or text-to-video
      }
      return false;
    },
    {
      message:
        "Invalid parameters. Provide: 1) prompt for text-to-image/video, 2) image_urls or task_id+index for image-to-video, 3) task_id only for upscale",
      path: [],
    },
  );

export type GrokImagineRequest = z.infer<typeof GrokImagineSchema>;

// InfiniTalk - MeiGen-AI lip sync video generator (image + audio to talking video)
export const InfiniTalkSchema = z.object({
  image_url: z
    .string()
    .url()
    .describe(
      "URL of the portrait image to animate (JPEG, PNG, WEBP, max 10MB)",
    ),
  audio_url: z
    .string()
    .url()
    .describe(
      "URL of the audio file for lip sync (MPEG, WAV, AAC, MP4, OGG, max 10MB)",
    ),
  prompt: z
    .string()
    .min(1)
    .max(1500)
    .describe(
      "Text prompt to guide video generation (e.g., 'A young woman talking on a podcast')",
    ),
  resolution: z
    .enum(["480p", "720p"])
    .default("480p")
    .optional()
    .describe(
      "Video resolution: 480p (faster, cheaper) or 720p (higher quality)",
    ),
  seed: z
    .number()
    .int()
    .min(10000)
    .max(1000000)
    .optional()
    .describe("Random seed for reproducibility (10000-1000000)"),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe("Optional: URL for task completion notifications"),
});

export type InfiniTalkRequest = z.infer<typeof InfiniTalkSchema>;

// Kling Avatar - Kuaishou talking avatar video generator (image + audio to avatar video)
export const KlingAvatarSchema = z.object({
  image_url: z
    .string()
    .url()
    .describe(
      "URL of the portrait image for avatar (JPEG, PNG, WEBP, max 10MB)",
    ),
  audio_url: z
    .string()
    .url()
    .describe(
      "URL of the audio file for the avatar to speak (MPEG, WAV, AAC, MP4, OGG, max 10MB)",
    ),
  prompt: z
    .string()
    .min(1)
    .max(1500)
    .describe(
      "Text prompt to guide video generation (emotions, expressions, scene settings)",
    ),
  // Quality: standard (720P) or pro (1080P)
  quality: z
    .enum(["standard", "pro"])
    .default("standard")
    .optional()
    .describe(
      "Video quality: standard (720P, faster) or pro (1080P, higher quality)",
    ),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe("Optional: URL for task completion notifications"),
});

export type KlingAvatarRequest = z.infer<typeof KlingAvatarSchema>;

// HappyHorse 1.0 Video - Alibaba ATH multi-mode video generation
export const HappyHorseVideoSchema = z
  .object({
    mode: z
      .enum([
        "text-to-video",
        "image-to-video",
        "reference-to-video",
        "video-edit",
      ])
      .optional()
      .describe(
        "Generation mode: text-to-video (default), image-to-video, reference-to-video, or video-edit. Auto-detected from parameters if omitted.",
      ),
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe("Text prompt for video generation (max 5000 characters)"),
    // I2V
    image_urls: z
      .array(z.string().url())
      .max(1)
      .optional()
      .describe("Input image URL for image-to-video mode (max 1)"),
    // R2V
    reference_image: z
      .array(z.string().url())
      .max(9)
      .optional()
      .describe("Reference images for reference-to-video mode (up to 9)"),
    // Video Edit
    video_url: z
      .string()
      .url()
      .optional()
      .describe("Video URL to edit (video-edit mode)"),
    reference_image_edit: z
      .array(z.string().url())
      .max(5)
      .optional()
      .describe("Reference images for video-edit mode (up to 5)"),
    audio_setting: z
      .enum(["auto", "origin"])
      .optional()
      .describe("Audio handling for video-edit: auto or origin"),
    // Common
    resolution: z
      .enum(["720p", "1080p"])
      .default("1080p")
      .optional()
      .describe("Video resolution"),
    aspect_ratio: z
      .enum(["16:9", "9:16", "1:1", "4:3", "3:4"])
      .default("16:9")
      .optional()
      .describe("Aspect ratio of the generated video"),
    duration: z
      .number()
      .int()
      .min(3)
      .max(15)
      .default(5)
      .optional()
      .describe("Duration in seconds (3-15)"),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2147483647)
      .optional()
      .describe("Random seed for reproducible results (0-2147483647)"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional: URL for task completion notifications"),
  })
  .refine(
    (data) => {
      const mode =
        data.mode ||
        (data.video_url
          ? "video-edit"
          : data.reference_image?.length
            ? "reference-to-video"
            : data.image_urls?.length
              ? "image-to-video"
              : "text-to-video");
      if (mode === "image-to-video" && !data.image_urls?.length) return false;
      if (mode === "reference-to-video" && !data.reference_image?.length)
        return false;
      if (mode === "video-edit" && !data.video_url) return false;
      return true;
    },
    {
      message:
        "Invalid parameter combination for the detected mode. Ensure required inputs are provided.",
      path: [],
    },
  );

export type HappyHorseVideoRequest = z.infer<typeof HappyHorseVideoSchema>;

export const QwenImageSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .describe("Text prompt for image generation or editing"),
    image_url: z
      .string()
      .url()
      .optional()
      .describe(
        "URL of image to edit (optional - if not provided, uses text-to-image)",
      ), // Required for edit mode, optional for text-to-image
    image_size: z
      .enum([
        "square",
        "square_hd",
        "portrait_4_3",
        "portrait_16_9",
        "landscape_4_3",
        "landscape_16_9",
      ])
      .default("square_hd")
      .optional()
      .describe("Image size"),
    num_inference_steps: z
      .number()
      .int()
      .min(2)
      .max(250)
      .optional()
      .describe(
        "Number of inference steps (2-250 for text-to-image, 2-49 for edit)",
      ),
    seed: z
      .number()
      .optional()
      .describe("Random seed for reproducible results"),
    guidance_scale: z
      .number()
      .min(0)
      .max(20)
      .optional()
      .describe("CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit)"),
    enable_safety_checker: z
      .boolean()
      .default(false)
      .optional()
      .describe("Enable safety checker"),
    output_format: z
      .enum(["png", "jpeg"])
      .default("png")
      .optional()
      .describe("Output format"),
    negative_prompt: z
      .string()
      .max(500)
      .default(" ")
      .optional()
      .describe("Negative prompt (max 500 characters)"),
    acceleration: z
      .enum(["none", "regular", "high"])
      .default("none")
      .optional()
      .describe("Acceleration level"),
    // Edit-specific parameters
    num_images: z
      .enum(["1", "2", "3", "4"])
      .optional()
      .describe("Number of images (1-4, edit mode only)"),
    sync_mode: z
      .boolean()
      .default(false)
      .optional()
      .describe("Sync mode (edit mode only)"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine(
    (data) => {
      // Validate edit mode requirements
      const isEditMode = !!data.image_url;

      if (isEditMode) {
        // Edit mode specific validations
        if (
          data.num_inference_steps &&
          (data.num_inference_steps < 2 || data.num_inference_steps > 49)
        ) {
          return false;
        }
        if (data.prompt && data.prompt.length > 2000) {
          return false;
        }
      } else {
        // Text-to-image mode specific validations
        if (data.prompt && data.prompt.length > 5000) {
          return false;
        }
      }

      return true;
    },
    {
      message: "Invalid parameters for detected mode",
      path: [],
    },
  );

export const MidjourneyGenerateSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(4000)
      .describe(
        "Text prompt describing the desired image or video (max 2000 characters)",
      ),
    fileUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Single image URL for image-to-image or video generation (legacy - use fileUrls instead)",
      ),
    fileUrls: z
      .array(z.string().url())
      .max(5)
      .optional()
      .describe(
        "Array of image URLs for image-to-image or video generation (recommended)",
      ),
    taskType: z
      .enum([
        "mj_txt2img",
        "mj_img2img",
        "mj_style_reference",
        "mj_omni_reference",
        "mj_video",
        "mj_video_hd",
      ])
      .optional()
      .describe(
        "Task type for generation mode (auto-detected if not provided)",
      ),
    aspectRatio: z
      .enum(["1:1", "9:16", "16:9", "4:3", "3:4", "21:9", "2:3", "3:2"])
      .default("1:1")
      .optional()
      .describe("Output aspect ratio"),
    processMode: z.enum(["relax", "fast"]).default("relax").optional(),
    weird: z.number().int().min(0).max(1000).optional(),
    raw: z.boolean().default(false).optional(),
    seed: z.number().int().min(0).max(4294967295).optional(),
    stylize: z.number().int().min(0).max(1000).optional(),
    quality: z.number().min(0.1).max(1).multipleOf(0.1).optional(),
    chaos: z.number().int().min(0).max(100).optional(),
    repeat: z.number().int().min(1).max(40).optional(),
    stop: z.number().int().min(10).max(100).optional(),
    // Video-specific parameters
    motion: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Motion level for video generation (required for video mode)"),
    videoBatchSize: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .describe("Number of videos to generate (video mode only)"),
    high_definition_video: z
      .boolean()
      .default(false)
      .optional()
      .describe(
        "Use high definition video generation instead of standard definition",
      ),
    // Omni reference specific
    ow: z
      .string()
      .min(1)
      .max(4000)
      .optional()
      .describe("Omni intensity parameter for omni reference tasks (1-1000)"),
    // Style reference specific
    sref: z.string().min(1).max(4000).optional(),
    // Additional parameters used by client code
    version: z.string().optional().describe("Midjourney model version"),
    speed: z
      .enum(["relax", "fast", "turbo"])
      .optional()
      .describe("Generation speed (not required for video/omni tasks)"),
    variety: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe(
        "Controls diversity of generated results (0-100, increment by 5)",
      ),
    stylization: z
      .number()
      .int()
      .min(0)
      .max(1000)
      .optional()
      .describe("Artistic style intensity (0-1000, suggested multiple of 50)"),
    weirdness: z
      .number()
      .int()
      .min(0)
      .max(3000)
      .optional()
      .describe(
        "Creativity and uniqueness level (0-3000, suggested multiple of 100)",
      ),
    enableTranslation: z
      .boolean()
      .optional()
      .describe("Auto-translate non-English prompts to English"),
    waterMark: z.string().max(100).optional().describe("Watermark identifier"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine(
    (data) => {
      // Auto-detect and validate task type based on parameters
      const hasImage =
        data.fileUrl || (data.fileUrls && data.fileUrls.length > 0);
      const isVideoMode =
        data.motion || data.videoBatchSize || data.high_definition_video;
      const isOmniMode = data.taskType === "mj_omni_reference" || data.ow;
      const isStyleMode = data.taskType === "mj_style_reference";

      // If taskType is explicitly provided, validate it
      if (data.taskType) {
        // Video tasks require motion parameter
        if (
          (data.taskType === "mj_video" || data.taskType === "mj_video_hd") &&
          !data.motion
        ) {
          return false;
        }
        // Omni tasks require ow parameter
        if (data.taskType === "mj_omni_reference" && !data.ow) {
          return false;
        }
        // Image tasks require image URL
        if (
          (data.taskType === "mj_img2img" ||
            data.taskType === "mj_style_reference" ||
            data.taskType === "mj_omni_reference") &&
          !hasImage
        ) {
          return false;
        }
        // Video tasks require image URL
        if (
          (data.taskType === "mj_video" || data.taskType === "mj_video_hd") &&
          !hasImage
        ) {
          return false;
        }
        // Text-to-image should not have image URL
        if (data.taskType === "mj_txt2img" && hasImage) {
          return false;
        }
      }

      return true;
    },
    {
      message: "Invalid combination of parameters for the detected task type",
      path: [],
    },
  );

export const GptImage2Schema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(20000)
    .describe(
      "Text prompt describing the desired image (max 20000 characters)",
    ),
  input_urls: z
    .array(z.string().url())
    .max(16)
    .optional()
    .describe(
      "Array of up to 16 image URLs for image-to-image mode. Omit for text-to-image.",
    ),
  aspect_ratio: z
    .enum(["auto", "1:1", "9:16", "16:9", "4:3", "3:4"])
    .default("auto")
    .optional()
    .describe("Image aspect ratio"),
  resolution: z
    .enum(["1K", "2K", "4K"])
    .default("1K")
    .optional()
    .describe("Output resolution"),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

// TypeScript types
export type NanoBananaImageRequest = z.infer<typeof NanoBananaImageSchema>;
export type Veo3GenerateRequest = z.infer<typeof Veo3GenerateSchema>;
export type SunoGenerateRequest = z.infer<typeof SunoGenerateSchema>;
export type ElevenLabsTTSRequest = z.infer<typeof ElevenLabsTTSSchema>;
export type ElevenLabsSoundEffectsRequest = z.infer<
  typeof ElevenLabsSoundEffectsSchema
>;
export type ByteDanceSeedanceVideoRequest = z.infer<
  typeof ByteDanceSeedanceVideoSchema
>;
export type RunwayAlephVideoRequest = z.infer<typeof RunwayAlephVideoSchema>;
export type WanVideoRequest = z.infer<typeof Wan27VideoSchema>;
export type ByteDanceSeedreamImageRequest = z.infer<
  typeof ByteDanceSeedreamImageSchema
>;
export type QwenImageRequest = z.infer<typeof QwenImageSchema>;
export type MidjourneyGenerateRequest = z.infer<
  typeof MidjourneyGenerateSchema
>;
export type GptImage2Request = z.infer<typeof GptImage2Schema>;

// Flux Kontext Image - Unified text-to-image and image editing
export const FluxKontextImageSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe(
        "Text prompt describing the desired image or edit (max 5000 characters, English recommended)",
      ),
    enableTranslation: z
      .boolean()
      .default(true)
      .describe("Automatically translate non-English prompts to English"),
    uploadCn: z
      .boolean()
      .default(false)
      .describe(
        "Route uploads via China servers for better performance in Asia",
      ),
    inputImage: z
      .string()
      .url()
      .optional()
      .describe(
        "Input image URL for editing mode (required for image editing, omit for text-to-image generation)",
      ),
    aspectRatio: z
      .enum(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])
      .default("16:9")
      .describe("Output image aspect ratio (default: 16:9)"),
    outputFormat: z
      .enum(["jpeg", "png"])
      .default("jpeg")
      .describe("Output image format"),
    promptUpsampling: z
      .boolean()
      .default(false)
      .describe(
        "Enable prompt enhancement for better results (may increase processing time)",
      ),
    model: z
      .enum(["flux-kontext-pro", "flux-kontext-max"])
      .default("flux-kontext-pro")
      .describe("Model version to use for generation"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
    safetyTolerance: z
      .number()
      .int()
      .min(0)
      .max(6)
      .default(6)
      .describe(
        "Content moderation level (0-6 for generation, 0-2 for editing)",
      ),
    watermark: z
      .string()
      .optional()
      .describe("Watermark identifier to add to the generated image"),
  })
  .refine(
    (data) => {
      // Validate safetyTolerance range based on mode
      const hasInputImage = !!data.inputImage;
      if (hasInputImage && data.safetyTolerance > 2) {
        return false;
      }
      return true;
    },
    {
      message:
        "For image editing mode, safetyTolerance must be between 0 and 2",
      path: ["safetyTolerance"],
    },
  );

export type FluxKontextImageRequest = z.infer<typeof FluxKontextImageSchema>;

// Topaz Image Upscale - AI-powered image enhancement and upscaling
export const TopazUpscaleImageSchema = z.object({
  image_url: z
    .string()
    .url()
    .describe("URL of image to upscale (JPEG, PNG, WEBP, max 10MB)"),
  upscale_factor: z
    .enum(["1", "2", "4", "8"])
    .default("2")
    .describe(
      "Upscale factor: 1x (enhance only), 2x (default), 4x, or 8x. Max output dimension is 20,000px.",
    ),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

export type TopazUpscaleImageRequest = z.infer<typeof TopazUpscaleImageSchema>;

// Recraft Remove Background
export const RecraftRemoveBackgroundSchema = z
  .object({
    image: z
      .string()
      .url()
      .describe(
        "URL of image to remove background from (PNG, JPG, WEBP, max 5MB, 16MP, 4096px max, 256px min)",
      ),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine((data) => {
    // Check if callBackUrl is provided directly or via environment variable
    const hasCallBackUrl = data.callBackUrl || process.env.KIE_AI_CALLBACK_URL;
    return true; // callBackUrl is optional for this tool
  });

export type RecraftRemoveBackgroundRequest = z.infer<
  typeof RecraftRemoveBackgroundSchema
>;

// Ideogram V3 Reframe
export const IdeogramReframeSchema = z
  .object({
    image_url: z
      .string()
      .url()
      .describe("URL of image to reframe (JPEG, PNG, WEBP, max 10MB)"),
    image_size: z
      .enum([
        "square",
        "square_hd",
        "portrait_4_3",
        "portrait_16_9",
        "landscape_4_3",
        "landscape_16_9",
      ])
      .default("square_hd")
      .describe("Output size for the reframed image"),
    rendering_speed: z
      .enum(["TURBO", "BALANCED", "QUALITY"])
      .default("BALANCED")
      .optional()
      .describe("Rendering speed for generation"),
    style: z
      .enum(["AUTO", "GENERAL", "REALISTIC", "DESIGN"])
      .default("AUTO")
      .optional()
      .describe("Style type for generation"),
    num_images: z
      .enum(["1", "2", "3", "4"])
      .default("1")
      .optional()
      .describe("Number of images to generate"),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2147483647)
      .default(0)
      .optional()
      .describe("Seed for reproducible results"),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine((data) => {
    // Check if callBackUrl is provided directly or via environment variable
    const hasCallBackUrl = data.callBackUrl || process.env.KIE_AI_CALLBACK_URL;
    return true; // callBackUrl is optional for this tool
  });

export type IdeogramReframeRequest = z.infer<typeof IdeogramReframeSchema>;

// Kling 3.0 Video - text-to-video, image-to-video with native audio, multi-shots, and elements
export const KlingVideoSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(5000)
      .describe(
        "Text prompt describing the desired video content (max 5000 characters). For audio: use [Character name, voice style] format for dialogue",
      ),
    // Up to 2 images: first = start frame, second = end frame
    image_urls: z
      .array(z.string().url())
      .max(2)
      .optional()
      .describe(
        "Up to 2 image URLs: first = start frame, second = end frame (optional - if not provided, uses text-to-video)",
      ),
    duration: z
      .string()
      .refine(
        (val) => {
          const num = parseInt(val);
          return !isNaN(num) && num >= 3 && num <= 15;
        },
        {
          message: "Duration must be a string number between 3 and 15",
        },
      )
      .default("5")
      .optional()
      .describe("Duration of video in seconds (3-15)"),
    aspect_ratio: z
      .enum(["16:9", "9:16", "1:1"])
      .default("16:9")
      .optional()
      .describe("Aspect ratio of video (text-to-video mode only)"),
    mode: z
      .enum(["std", "pro"])
      .default("std")
      .optional()
      .describe(
        "Quality mode: 'std' for standard (faster, cheaper), 'pro' for professional quality",
      ),
    sound: z
      .boolean()
      .default(false)
      .optional()
      .describe(
        "Enable native audio generation including multilingual speech, sound effects, and ambient sound. Pricing: with audio is 2x credits",
      ),
    multi_shots: z
      .boolean()
      .default(false)
      .optional()
      .describe(
        "Enable multi-shot mode for cinematic storytelling with multiple scenes (requires multi_prompt)",
      ),
    multi_prompt: z
      .array(
        z.object({
          prompt: z.string(),
          duration: z.number().int().min(1).max(12),
        }),
      )
      .optional()
      .describe(
        "Array of shot definitions for multi-shot mode. Each shot has a prompt and duration (1-12s)",
      ),
    kling_elements: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          element_input_urls: z.array(z.string().url()).optional(),
          element_input_video_urls: z.array(z.string().url()).optional(),
        }),
      )
      .optional()
      .describe(
        "Character/object elements for consistent identity across shots. Provide name, description, and reference images/videos",
      ),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine(
    (data) => {
      // multi_shots requires multi_prompt
      if (
        data.multi_shots &&
        (!data.multi_prompt || data.multi_prompt.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "multi_shots requires multi_prompt array with at least one shot definition",
      path: [],
    },
  );

export type KlingVideoRequest = z.infer<typeof KlingVideoSchema>;

// Hailuo Video - Unified tool for text-to-video and image-to-video (standard/pro quality)
// Supports Hailuo 02 and Hailuo 2.3 versions
export const HailuoVideoSchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(1500)
      .describe(
        "Text prompt describing the desired video content (max 1500 characters)",
      ),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "URL of input image for image-to-video mode (optional - if not provided, uses text-to-video)",
      ),
    endImageUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "URL of end frame image for image-to-video (optional - requires imageUrl)",
      ),
    // Version selection: "02" (original) or "2.3" (new, better motion/expressions)
    version: z
      .enum(["02", "2.3"])
      .default("02")
      .optional()
      .describe(
        "Hailuo model version: '02' (original) or '2.3' (better motion, expressions, 1080P support)",
      ),
    quality: z
      .enum(["standard", "pro"])
      .default("standard")
      .optional()
      .describe(
        "Quality level of video generation (standard for faster, pro for higher quality)",
      ),
    // Standard quality only parameters
    duration: z
      .enum(["6", "10"])
      .default("6")
      .optional()
      .describe(
        "Duration of video in seconds (standard quality only). Note: 10s not supported with 1080P in v2.3",
      ),
    // Resolution: 512P/768P for 02, 768P/1080P for 2.3
    resolution: z
      .enum(["512P", "768P", "1080P"])
      .default("768P")
      .optional()
      .describe(
        "Resolution of video (standard quality only). v02: 512P/768P, v2.3: 768P/1080P",
      ),
    // Common parameters
    promptOptimizer: z
      .boolean()
      .default(true)
      .optional()
      .describe(
        "Whether to use the model's prompt optimizer for better results",
      ),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine(
    (data) => {
      const hasImageUrl = !!data.imageUrl;

      // At least prompt is always required
      if (!data.prompt) {
        return false;
      }

      // Image-to-video mode requires imageUrl
      if (hasImageUrl && !data.prompt) {
        return false;
      }

      // Text-to-video mode requires only prompt
      if (!hasImageUrl && data.endImageUrl) {
        return false; // endImageUrl only valid with imageUrl
      }

      // Hailuo 2.3 specific: 10s duration not supported with 1080P
      if (
        data.version === "2.3" &&
        data.duration === "10" &&
        data.resolution === "1080P"
      ) {
        return false;
      }

      // Hailuo 2.3 doesn't support 512P
      if (data.version === "2.3" && data.resolution === "512P") {
        return false;
      }

      // Hailuo 02 doesn't support 1080P
      if (data.version === "02" && data.resolution === "1080P") {
        return false;
      }

      return true;
    },
    {
      message:
        "Invalid parameter combination. Choose mode: 1) prompt only (text-to-video), or 2) prompt + imageUrl (image-to-video). endImageUrl is only valid with imageUrl. For 2.3: 10s+1080P not supported, 512P not available. For 02: 1080P not available.",
      path: [],
    },
  );

export type HailuoVideoRequest = z.infer<typeof HailuoVideoSchema>;

// Flux-2 Image - Unified text-to-image and image-to-image (Pro/Flex)
export const Flux2ImageSchema = z
  .object({
    prompt: z
      .string()
      .min(3)
      .max(5000)
      .describe("Text prompt describing the desired image (3-5000 characters)"),
    input_urls: z
      .array(z.string().url())
      .min(1)
      .max(8)
      .optional()
      .describe(
        "Reference images for image-to-image mode (1-8 URLs). Omit for text-to-image mode.",
      ),
    aspect_ratio: z
      .enum(["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "auto"])
      .default("1:1")
      .describe(
        "Aspect ratio for the generated image. 'auto' only valid with input_urls.",
      ),
    resolution: z
      .enum(["1K", "2K"])
      .default("1K")
      .describe(
        "Output resolution. Pro: 1K (~$0.025), 2K (~$0.035). Flex: 1K (~$0.07), 2K (~$0.12).",
      ),
    model_type: z
      .enum(["pro", "flex"])
      .default("pro")
      .optional()
      .describe(
        "Model variant: 'pro' for fast reliable results, 'flex' for more control and fine-tuning.",
      ),
    callBackUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      ),
  })
  .refine(
    (data) => {
      // "auto" aspect_ratio only valid with input_urls (image-to-image mode)
      if (data.aspect_ratio === "auto") {
        return data.input_urls && data.input_urls.length > 0;
      }
      return true;
    },
    {
      message:
        "aspect_ratio 'auto' is only valid in image-to-image mode (requires input_urls)",
      path: ["aspect_ratio"],
    },
  );

export type Flux2ImageRequest = z.infer<typeof Flux2ImageSchema>;

// Wan 2.2 Animate - Animation and character replacement
export const WanAnimateSchema = z.object({
  video_url: z
    .string()
    .url()
    .describe(
      "URL of the reference video (MP4, QUICKTIME, X-MATROSKA, max 10MB, max 30 seconds)",
    ),
  image_url: z
    .string()
    .url()
    .describe(
      "URL of the character image (JPEG, PNG, WEBP, max 10MB). Will be resized and center-cropped to match video aspect ratio.",
    ),
  mode: z
    .enum(["animate", "replace"])
    .default("animate")
    .describe(
      "Animation mode: 'animate' transfers motion/expressions from video to image, 'replace' swaps the character in video with the image",
    ),
  resolution: z
    .enum(["480p", "580p", "720p"])
    .default("480p")
    .optional()
    .describe(
      "Output resolution: 480p (~$0.03/sec), 580p (~$0.0475/sec), 720p (~$0.0625/sec)",
    ),
  callBackUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
    ),
});

export type WanAnimateRequest = z.infer<typeof WanAnimateSchema>;

export interface KieAiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}

export interface ImageResponse {
  imageUrl?: string;
  taskId?: string;
}

export interface TaskResponse {
  taskId: string;
}

export interface TaskRecord {
  id?: number;
  task_id: string;
  api_type:
    | "nano-banana"
    | "nano-banana-edit"
    | "nano-banana-image"
    | "veo3"
    | "suno"
    | "elevenlabs-tts"
    | "elevenlabs-sound-effects"
    | "bytedance-seedance-video"
    | "runway-aleph-video"
    | "wan-video"
    | "bytedance-seedream-image"
    | "qwen-image"
    | "midjourney"
    | "gpt-image-2"
    | "flux-kontext-image"
    | "recraft-remove-background"
    | "ideogram-reframe"
    | "kling-3.0-video"
    | "hailuo"
    | "flux2-image"
    | "wan-animate"
    | "z-image"
    | "grok-imagine"
    | "infinitalk"
    | "kling-avatar"
    | "topaz-upscale"
    | "happyhorse-video";
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  result_url?: string;
  error_message?: string;
}

// Utility tools (task management). Schemas live here so the MCP inputSchema and
// the CLI flags derive from the same definition as every model tool.
export const GetTaskStatusSchema = z.object({
  task_id: z.string().min(1).describe("Task ID to check status for"),
});
export type GetTaskStatusRequest = z.infer<typeof GetTaskStatusSchema>;

export const ListTasksSchema = z.object({
  limit: z
    .number()
    .int()
    .max(100)
    .default(20)
    .describe("Maximum number of tasks to return"),
  status: z
    .enum(["pending", "processing", "completed", "failed"])
    .optional()
    .describe("Filter by status"),
});
export type ListTasksRequest = z.infer<typeof ListTasksSchema>;

export const Veo3Get1080pVideoSchema = z.object({
  task_id: z.string().min(1).describe("Veo3 task ID to get 1080p video for"),
  index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Video index (optional, for multiple video results)"),
});
export type Veo3Get1080pVideoRequest = z.infer<typeof Veo3Get1080pVideoSchema>;

export interface KieAiConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  callbackUrlFallback: string;
}
