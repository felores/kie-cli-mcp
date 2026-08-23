export interface ModelCatalogEntry {
  toolName: string;
  model: string;
  capabilities: string[];
  description: string;
  status: "active" | "paused";
  evidenceUrl: string;
  defaultProfile?: string;
}

const marketDocs = "https://docs.kie.ai/market-api/quickstart";

/**
 * This is intentionally metadata only. Request schemas and endpoint routing stay
 * with the registered tools that own them.
 */
export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    toolName: "nano_banana_image",
    model: "nano-banana-2",
    capabilities: ["image generation", "image editing"],
    description: "Nano Banana 2 image generation and editing.",
    status: "active",
    evidenceUrl: "https://docs.kie.ai/market/google/nano-banana-2-lite",
    defaultProfile: "image-fast",
  },
  {
    toolName: "bytedance_seedream_image",
    model: "seedream-5-lite",
    capabilities: ["image generation", "image editing"],
    description: "ByteDance Seedream image generation and editing.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "qwen_image",
    model: "qwen-image",
    capabilities: ["image generation", "image editing"],
    description: "Qwen image generation and editing.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "gpt_image_2",
    model: "gpt-image-2",
    capabilities: ["image generation", "image editing"],
    description: "GPT Image 2 generation and image-to-image.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "flux_kontext_image",
    model: "flux-kontext-pro",
    capabilities: ["image generation", "image editing"],
    description: "Flux Kontext generation and editing.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "flux2_image",
    model: "flux-2-pro",
    capabilities: ["image generation", "image editing"],
    description: "Flux 2 generation and image-to-image.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "z_image",
    model: "z-image",
    capabilities: ["image generation"],
    description: "Tongyi-MAI Z-Image generation.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "topaz_upscale_image",
    model: "topaz-image-upscale",
    capabilities: ["image upscale"],
    description: "Topaz image enhancement and upscaling.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "ideogram_reframe",
    model: "ideogram-v3-reframe",
    capabilities: ["image reframe"],
    description: "Ideogram aspect-ratio reframing.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "recraft_remove_background",
    model: "recraft-remove-background",
    capabilities: ["background removal"],
    description: "Recraft background removal.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "midjourney_generate",
    model: "midjourney",
    capabilities: ["image generation", "image to image", "image to video"],
    description: "Midjourney image and video generation modes.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "veo3_generate_video",
    model: "veo3",
    capabilities: ["text to video", "image to video", "audio"],
    description: "Google Veo 3 video generation.",
    status: "active",
    evidenceUrl: "https://docs.kie.ai/veo3-api/quickstart",
    defaultProfile: "veo-fast",
  },
  {
    toolName: "bytedance_seedance_video",
    model: "bytedance/seedance-2-5",
    capabilities: [
      "text to video",
      "image to video",
      "reference to video",
      "audio",
    ],
    description: "ByteDance Seedance 2.5 video generation.",
    status: "active",
    evidenceUrl: "https://docs.kie.ai/market/bytedance/seedance-2-5",
    defaultProfile: "seedance-safe",
  },
  {
    toolName: "kling_video",
    model: "kling-3.0",
    capabilities: ["text to video", "image to video", "audio", "multi shot"],
    description: "Kling 3.0 video generation.",
    status: "active",
    evidenceUrl: marketDocs,
    defaultProfile: "kling-safe",
  },
  {
    toolName: "hailuo_video",
    model: "minimax-h3",
    capabilities: ["text to video", "image to video", "reference to video"],
    description: "MiniMax H3 video generation.",
    status: "active",
    evidenceUrl: "https://docs.kie.ai/market/minimax-h3/reference-to-video",
    defaultProfile: "hailuo-safe",
  },
  {
    toolName: "wan_video",
    model: "wan-2.7",
    capabilities: [
      "text to video",
      "image to video",
      "reference to video",
      "video editing",
    ],
    description: "Wan video generation and editing.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "wan_animate",
    model: "wan-animate",
    capabilities: ["character animation", "character replacement"],
    description: "Wan character animation and replacement.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "happyhorse_video",
    model: "happyhorse-1.0",
    capabilities: [
      "text to video",
      "image to video",
      "reference to video",
      "video editing",
    ],
    description: "HappyHorse video generation and editing.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "runway_aleph_video",
    model: "runway-aleph",
    capabilities: ["video editing"],
    description: "Runway Aleph video transformation.",
    status: "active",
    evidenceUrl: "https://docs.kie.ai/runway-api/quickstart",
  },
  {
    toolName: "grok_imagine",
    model: "grok-imagine-image-2-0",
    capabilities: [
      "text to image",
      "image to image",
      "text to video",
      "image to video",
      "image upscale",
    ],
    description:
      "Grok Imagine Image 2.0 image generation and Grok Imagine video generation.",
    status: "active",
    evidenceUrl:
      "https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image",
  },
  {
    toolName: "infinitalk_lip_sync",
    model: "infinitalk",
    capabilities: ["lip sync", "talking avatar"],
    description: "InfiniTalk lip-sync video generation.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "kling_avatar",
    model: "kling-avatar",
    capabilities: ["lip sync", "talking avatar"],
    description: "Kling talking-avatar generation.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "omnihuman_video",
    model: "omnihuman-1.5",
    capabilities: ["talking avatar", "lip sync"],
    description: "OmniHuman avatar video generation.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "gemini_omni",
    model: "gemini-omni",
    capabilities: ["text to video", "character", "voice"],
    description: "Gemini Omni video, character, and voice generation.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "suno_generate_music",
    model: "suno-v5",
    capabilities: ["music generation"],
    description: "Suno music generation.",
    status: "active",
    evidenceUrl: "https://docs.kie.ai/suno-api/quickstart",
  },
  {
    toolName: "elevenlabs_tts",
    model: "elevenlabs-tts",
    capabilities: ["text to speech"],
    description: "ElevenLabs text-to-speech.",
    status: "active",
    evidenceUrl: marketDocs,
  },
  {
    toolName: "elevenlabs_ttsfx",
    model: "elevenlabs-sound-effects",
    capabilities: ["sound effects"],
    description: "ElevenLabs sound-effect generation.",
    status: "active",
    evidenceUrl: marketDocs,
  },
];

export function getCatalogEntry(
  toolName: string,
): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((entry) => entry.toolName === toolName);
}

export function filterCatalog(filter?: string): ModelCatalogEntry[] {
  if (!filter?.trim()) return MODEL_CATALOG;
  const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
  return MODEL_CATALOG.filter((entry) => {
    const searchable = [
      entry.toolName,
      entry.model,
      entry.description,
      ...entry.capabilities,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
