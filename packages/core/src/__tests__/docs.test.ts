import { TOOL_REGISTRY, getTool } from "../tools/index.js";
import { toolToMarkdown, categoryPromptText } from "../docs.js";

describe("registry-generated docs (resources + prompts)", () => {
  it("renders Markdown for every tool with name and parameters section", () => {
    for (const t of TOOL_REGISTRY) {
      const md = toolToMarkdown(t);
      expect(md).toContain(`# ${t.name}`);
      expect(md).toContain("## Parameters");
      expect(md).toContain(t.description);
    }
  });

  it("includes enum choices and defaults in a tool's table", () => {
    const md = toolToMarkdown(getTool("nano_banana_image")!);
    expect(md).toContain("`resolution`");
    expect(md).toContain("`1K`");
    expect(md).toContain('default: `"png"`');
  });

  it("builds category prompts listing only that category's tools", () => {
    const video = categoryPromptText("video", TOOL_REGISTRY);
    expect(video).toContain("veo3_generate_video");
    expect(video).not.toContain("# nano_banana_image");
    expect(video).toContain("get_task_status");
  });
});
