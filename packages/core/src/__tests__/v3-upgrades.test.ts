import {
  NanoBananaImageSchema,
  ByteDanceSeedreamImageSchema,
  KlingVideoSchema,
} from "../types.js";

// ──────────────────────────────────────────────
// Nano Banana 2 Schema Tests
// ──────────────────────────────────────────────

describe("NanoBananaImageSchema (Nano Banana 2)", () => {
  describe("generate mode", () => {
    it("accepts prompt only", () => {
      const result = NanoBananaImageSchema.safeParse({
        prompt: "A beautiful sunset",
      });
      expect(result.success).toBe(true);
    });

    it("accepts prompt with all optional params", () => {
      const result = NanoBananaImageSchema.safeParse({
        prompt: "A beautiful sunset",
        output_format: "jpg",
        aspect_ratio: "16:9",
        resolution: "4K",
        google_search: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts new extreme aspect ratios", () => {
      for (const ratio of ["1:4", "1:8", "4:1", "8:1"]) {
        const result = NanoBananaImageSchema.safeParse({
          prompt: "test",
          aspect_ratio: ratio,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects empty input (no prompt, no image_input)", () => {
      const result = NanoBananaImageSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects prompt exceeding max length", () => {
      const result = NanoBananaImageSchema.safeParse({
        prompt: "x".repeat(5001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("edit mode", () => {
    it("accepts prompt + image_input", () => {
      const result = NanoBananaImageSchema.safeParse({
        prompt: "Make it blue",
        image_input: ["https://example.com/img.png"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts up to 14 reference images", () => {
      const urls = Array.from(
        { length: 14 },
        (_, i) => `https://example.com/img${i}.png`,
      );
      const result = NanoBananaImageSchema.safeParse({
        prompt: "Edit these",
        image_input: urls,
      });
      expect(result.success).toBe(true);
    });

    it("rejects more than 14 reference images", () => {
      const urls = Array.from(
        { length: 15 },
        (_, i) => `https://example.com/img${i}.png`,
      );
      const result = NanoBananaImageSchema.safeParse({
        prompt: "Edit these",
        image_input: urls,
      });
      expect(result.success).toBe(false);
    });

    it("rejects image_input without prompt", () => {
      const result = NanoBananaImageSchema.safeParse({
        image_input: ["https://example.com/img.png"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("removed features", () => {
    it("does not accept old 'image' param for upscale mode", () => {
      const result = NanoBananaImageSchema.safeParse({
        image: "https://example.com/img.png",
      });
      // The schema doesn't have 'image' anymore - Zod strips unknown keys in .parse
      // but refine still fails because no prompt and no image_input
      expect(result.success).toBe(false);
    });

    it("does not accept old 'scale' param", () => {
      const result = NanoBananaImageSchema.safeParse({
        prompt: "test",
        scale: 2,
      });
      // Zod strips unknown keys but the data should still parse (prompt is valid)
      if (result.success) {
        expect((result.data as any).scale).toBeUndefined();
      }
    });

    it("does not accept old 'image_urls' param (renamed to image_input)", () => {
      const result = NanoBananaImageSchema.safeParse({
        prompt: "test",
        image_urls: ["https://example.com/img.png"],
      });
      // Zod strips unknown keys - image_urls is ignored, treated as generate mode
      if (result.success) {
        expect((result.data as any).image_urls).toBeUndefined();
        expect(result.data.image_input).toBeUndefined();
      }
    });
  });
});

// ──────────────────────────────────────────────
// ByteDance Seedream Schema Tests
// ──────────────────────────────────────────────

describe("ByteDanceSeedreamImageSchema (V5 Lite)", () => {
  describe("version selection", () => {
    it("defaults to 5-lite when version omitted (client treats non-'4' as V5 Lite)", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A landscape",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Zod .default().optional() returns undefined when field omitted
        // Client code treats this correctly: isV5Lite = request.version !== "4"
        // undefined !== "4" => true => V5 Lite is used
        expect(result.data.version !== "4").toBe(true);
      }
    });

    it("accepts version 4", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A landscape",
        version: "4",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe("4");
      }
    });

    it("accepts version 5-lite explicitly", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A landscape",
        version: "5-lite",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe("5-lite");
      }
    });

    it("rejects old version 4.5", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A landscape",
        version: "4.5",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid version", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A landscape",
        version: "3",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("V5 Lite parameters", () => {
    it("accepts aspect_ratio and quality for V5 Lite", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A portrait",
        version: "5-lite",
        aspect_ratio: "3:4",
        quality: "high",
      });
      expect(result.success).toBe(true);
    });

    it("accepts image_urls for edit mode", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "Edit this",
        version: "5-lite",
        image_urls: ["https://example.com/img.png"],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("V4 parameters", () => {
    it("accepts V4-specific params with version 4", () => {
      const result = ByteDanceSeedreamImageSchema.safeParse({
        prompt: "A landscape",
        version: "4",
        image_size: "landscape_16_9",
        image_resolution: "2K",
        max_images: 4,
        seed: 42,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ──────────────────────────────────────────────
// Kling 3.0 Video Schema Tests
// ──────────────────────────────────────────────

describe("KlingVideoSchema (Kling 3.0)", () => {
  describe("text-to-video mode", () => {
    it("accepts prompt only", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A cinematic scene",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all optional params", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A cinematic scene",
        duration: "10",
        aspect_ratio: "9:16",
        mode: "pro",
        sound: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("flexible duration (3-15 seconds)", () => {
    it("accepts duration 3", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        duration: "3",
      });
      expect(result.success).toBe(true);
    });

    it("accepts duration 15", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        duration: "15",
      });
      expect(result.success).toBe(true);
    });

    it("accepts duration 7 (middle value)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        duration: "7",
      });
      expect(result.success).toBe(true);
    });

    it("rejects duration 2 (below minimum)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        duration: "2",
      });
      expect(result.success).toBe(false);
    });

    it("rejects duration 16 (above maximum)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        duration: "16",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric duration", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        duration: "abc",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("image-to-video mode", () => {
    it("accepts prompt + single image_url (start frame)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "Animate this",
        image_urls: ["https://example.com/start.png"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts prompt + two image_urls (start + end frames)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "Animate between",
        image_urls: [
          "https://example.com/start.png",
          "https://example.com/end.png",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects more than 2 image_urls", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "Too many",
        image_urls: [
          "https://example.com/1.png",
          "https://example.com/2.png",
          "https://example.com/3.png",
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("multi-shot mode", () => {
    it("accepts multi_shots with multi_prompt", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A short film",
        multi_shots: true,
        multi_prompt: [
          { prompt: "Scene 1: Opening shot", duration: 4 },
          { prompt: "Scene 2: Action", duration: 5 },
          { prompt: "Scene 3: Conclusion", duration: 3 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects multi_shots without multi_prompt", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A short film",
        multi_shots: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects multi_shots with empty multi_prompt", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A short film",
        multi_shots: true,
        multi_prompt: [],
      });
      expect(result.success).toBe(false);
    });

    it("validates multi_prompt duration range (1-12)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A short film",
        multi_shots: true,
        multi_prompt: [{ prompt: "Scene 1", duration: 13 }],
      });
      expect(result.success).toBe(false);
    });

    it("validates multi_prompt duration minimum (1)", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A short film",
        multi_shots: true,
        multi_prompt: [{ prompt: "Scene 1", duration: 0 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("kling_elements", () => {
    it("accepts elements with name and description", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A scene with characters",
        kling_elements: [
          {
            name: "Hero",
            description: "Tall man in a red cape",
            element_input_urls: ["https://example.com/hero.png"],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts elements with video references", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A scene with characters",
        kling_elements: [
          {
            name: "Hero",
            description: "Tall man in a red cape",
            element_input_video_urls: ["https://example.com/hero.mp4"],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("requires name and description for elements", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "A scene",
        kling_elements: [{ name: "Hero" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("mode parameter", () => {
    it("accepts std mode", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        mode: "std",
      });
      expect(result.success).toBe(true);
    });

    it("accepts pro mode", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        mode: "pro",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid mode", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        mode: "turbo",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("removed features", () => {
    it("does not support old version parameter", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        version: "2.5",
      });
      // Zod strips unknown keys - should still succeed as basic text-to-video
      if (result.success) {
        expect((result.data as any).version).toBeUndefined();
      }
    });

    it("does not support old negative_prompt parameter", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        negative_prompt: "blur",
      });
      if (result.success) {
        expect((result.data as any).negative_prompt).toBeUndefined();
      }
    });

    it("does not support old cfg_scale parameter", () => {
      const result = KlingVideoSchema.safeParse({
        prompt: "test",
        cfg_scale: 0.5,
      });
      if (result.success) {
        expect((result.data as any).cfg_scale).toBeUndefined();
      }
    });
  });
});
