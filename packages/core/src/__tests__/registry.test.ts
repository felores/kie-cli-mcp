import { TOOL_REGISTRY, getTool } from "../tools/index.js";
import { toInputJsonSchema } from "../json-schema.js";

// Parity is structural: both the MCP server (listTools/callTool) and the CLI
// iterate this same TOOL_REGISTRY, so a tool added here appears in both surfaces
// automatically. These tests guard the registry's integrity and make any change
// to the exposed tool set an intentional, reviewed edit (snapshot below).

const EXPECTED_TOOL_NAMES = [
  "bytedance_seedance_video",
  "bytedance_seedream_image",
  "elevenlabs_tts",
  "elevenlabs_ttsfx",
  "flux2_image",
  "flux_kontext_image",
  "get_task_status",
  "gpt_image_2",
  "grok_imagine",
  "hailuo_video",
  "happyhorse_video",
  "ideogram_reframe",
  "infinitalk_lip_sync",
  "kling_avatar",
  "kling_video",
  "omnihuman_video",
  "list_tasks",
  "midjourney_generate",
  "nano_banana_image",
  "qwen_image",
  "recraft_remove_background",
  "runway_aleph_video",
  "suno_generate_music",
  "topaz_upscale_image",
  "veo3_generate_video",
  "veo3_get_1080p_video",
  "wait_for_task",
  "wan_animate",
  "wan_video",
  "z_image",
].sort();

describe("tool registry", () => {
  it("exposes the expected set of tools (snapshot)", () => {
    const names = TOOL_REGISTRY.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
  });

  it("has unique tool names", () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool is well-formed", () => {
    for (const t of TOOL_REGISTRY) {
      expect(typeof t.name).toBe("string");
      expect(t.description.length).toBeGreaterThan(0);
      expect(["image", "video", "audio", "utility"]).toContain(t.category);
      expect(t.schema).toBeDefined();
      expect(typeof t.run).toBe("function");
    }
  });

  it("every schema derives to an object JSON Schema (MCP inputSchema + CLI flags)", () => {
    for (const t of TOOL_REGISTRY) {
      const js = toInputJsonSchema(t.schema) as Record<string, unknown>;
      expect(js.type).toBe("object");
      expect(js).toHaveProperty("properties");
    }
  });

  it("getTool resolves by name and returns undefined for unknown", () => {
    expect(getTool("nano_banana_image")?.name).toBe("nano_banana_image");
    expect(getTool("does_not_exist")).toBeUndefined();
  });
});
