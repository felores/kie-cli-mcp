import type { ToolDef } from "./types.js";
import { bytedanceSeedanceVideoTool } from "./bytedance_seedance_video.js";
import { bytedanceSeedreamImageTool } from "./bytedance_seedream_image.js";
import { elevenlabsTtsTool } from "./elevenlabs_tts.js";
import { elevenlabsTtsfxTool } from "./elevenlabs_ttsfx.js";
import { flux2ImageTool } from "./flux2_image.js";
import { fluxKontextImageTool } from "./flux_kontext_image.js";
import { getTaskStatusTool } from "./get_task_status.js";
import { gptImage2Tool } from "./gpt_image_2.js";
import { geminiOmniTool } from "./gemini_omni.js";
import { grokImagineTool } from "./grok_imagine.js";
import { hailuoVideoTool } from "./hailuo_video.js";
import { happyhorseVideoTool } from "./happyhorse_video.js";
import { ideogramReframeTool } from "./ideogram_reframe.js";
import { infinitalkLipSyncTool } from "./infinitalk_lip_sync.js";
import { klingAvatarTool } from "./kling_avatar.js";
import { klingVideoTool } from "./kling_video.js";
import { listTasksTool } from "./list_tasks.js";
import { midjourneyGenerateTool } from "./midjourney_generate.js";
import { nanoBananaImageTool } from "./nano_banana_image.js";
import { omniHumanVideoTool } from "./omnihuman_video.js";
import { qwenImageTool } from "./qwen_image.js";
import { recraftRemoveBackgroundTool } from "./recraft_remove_background.js";
import { runwayAlephVideoTool } from "./runway_aleph_video.js";
import { sunoGenerateMusicTool } from "./suno_generate_music.js";
import { topazUpscaleImageTool } from "./topaz_upscale_image.js";
import { veo3GenerateVideoTool } from "./veo3_generate_video.js";
import { veo3Get1080pVideoTool } from "./veo3_get_1080p_video.js";
import { waitForTaskTool } from "./wait_for_task.js";
import { wanAnimateTool } from "./wan_animate.js";
import { wanVideoTool } from "./wan_video.js";
import { zImageTool } from "./z_image.js";

export * from "./types.js";

/**
 * The registry: the single source of truth for every Kie.ai tool.
 * Both the MCP server and the CLI iterate this array, so a tool added here
 * automatically appears in both surfaces.
 */
export const TOOL_REGISTRY: ToolDef[] = [
  bytedanceSeedanceVideoTool,
  bytedanceSeedreamImageTool,
  elevenlabsTtsTool,
  elevenlabsTtsfxTool,
  flux2ImageTool,
  fluxKontextImageTool,
  getTaskStatusTool,
  geminiOmniTool,
  gptImage2Tool,
  grokImagineTool,
  hailuoVideoTool,
  happyhorseVideoTool,
  ideogramReframeTool,
  infinitalkLipSyncTool,
  klingAvatarTool,
  klingVideoTool,
  listTasksTool,
  midjourneyGenerateTool,
  nanoBananaImageTool,
  omniHumanVideoTool,
  qwenImageTool,
  recraftRemoveBackgroundTool,
  runwayAlephVideoTool,
  sunoGenerateMusicTool,
  topazUpscaleImageTool,
  veo3GenerateVideoTool,
  veo3Get1080pVideoTool,
  waitForTaskTool,
  wanAnimateTool,
  wanVideoTool,
  zImageTool,
];

export function getTool(name: string): ToolDef | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}
