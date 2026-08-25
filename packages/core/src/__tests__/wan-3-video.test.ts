import { Wan30VideoSchema } from "../types.js";

describe("Wan30VideoSchema", () => {
  test("accepts smart duration and all documented reference families", () => {
    expect(
      Wan30VideoSchema.parse({
        prompt: "Use Image1, Video1, and Audio1 as references",
        reference_image_urls: ["https://example.com/image.png"],
        reference_video_urls: ["https://example.com/video.mp4"],
        reference_audio_urls: ["https://example.com/audio.mp3"],
        duration: -1,
      }),
    ).toMatchObject({ duration: -1, resolution: "1080P", audio: true });
  });

  test("rejects keyframes mixed with all-purpose references", () => {
    expect(() =>
      Wan30VideoSchema.parse({
        first_frame_url: "https://example.com/first.png",
        reference_image_urls: ["https://example.com/reference.png"],
      }),
    ).toThrow(/cannot be combined/);
  });

  test("requires a first frame when a last frame is provided", () => {
    expect(() =>
      Wan30VideoSchema.parse({
        last_frame_url: "https://example.com/last.png",
      }),
    ).toThrow(/requires first_frame_url/);
  });

  test("requires at least a prompt or media reference", () => {
    expect(() => Wan30VideoSchema.parse({})).toThrow(/Provide prompt/);
  });

  test("rejects removed Wan 2.7 parameters instead of silently changing intent", () => {
    expect(() =>
      Wan30VideoSchema.parse({
        prompt: "Edit this video",
        video_url_edit: "https://example.com/source.mp4",
      }),
    ).toThrow(/Unrecognized key/);
  });
});
