import { validatePublicHttpUrl } from "./media-validation.js";
import type {
  ByteDanceSeedanceVideoRequest,
  ByteDanceSeedreamImageRequest,
  ElevenLabsSoundEffectsRequest,
  ElevenLabsTTSRequest,
  Flux2ImageRequest,
  FluxKontextImageRequest,
  GeminiOmniRequest,
  GptImage2Request,
  GrokImagineRequest,
  HailuoVideoRequest,
  HappyHorseVideoRequest,
  IdeogramReframeRequest,
  ImageResponse,
  InfiniTalkRequest,
  KieAiConfig,
  KieAiResponse,
  KlingAvatarRequest,
  KlingVideoRequest,
  MidjourneyGenerateRequest,
  NanoBananaImageRequest,
  OmniHumanVideoRequest,
  QwenImageRequest,
  RecraftRemoveBackgroundRequest,
  RunwayAlephVideoRequest,
  SunoGenerateRequest,
  TaskResponse,
  TopazUpscaleImageRequest,
  Veo3GenerateRequest,
  WanAnimateRequest,
  WanVideoRequest,
  ZImageRequest,
} from "./types.js";

export class KieAiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly providerCode?: number,
  ) {
    super(message);
    this.name = "KieAiRequestError";
  }
}

export interface KieAiUploadFile {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

export interface KieAiUploadResult {
  fileName?: string;
  filePath?: string;
  downloadUrl?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  [key: string]: unknown;
}

export interface KieAiDownloadedFile {
  bytes: Uint8Array;
  contentType: string | null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ((error as { name?: unknown }).name === "AbortError" ||
      (error as { name?: unknown }).name === "TimeoutError")
  );
}

function providerMessage(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null) {
    for (const key of ["msg", "message"]) {
      const message = (value as Record<string, unknown>)[key];
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return fallback;
}

async function readResponseBytes(
  response: Response,
  maxBytes?: number,
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (
    maxBytes !== undefined &&
    Number.isFinite(contentLength) &&
    contentLength > maxBytes
  ) {
    throw new KieAiRequestError(
      "The provider result exceeded the download size limit.",
      502,
    );
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (maxBytes !== undefined && bytes.length > maxBytes) {
      throw new KieAiRequestError(
        "The provider result exceeded the download size limit.",
        502,
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (maxBytes !== undefined && total > maxBytes) {
        await reader.cancel();
        throw new KieAiRequestError(
          "The provider result exceeded the download size limit.",
          502,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export class KieAiClient {
  private config: KieAiConfig;

  constructor(config: KieAiConfig) {
    this.config = config;
  }

  private callbackUrl(value?: string): string | undefined {
    return value || this.config.callbackUrlFallback || undefined;
  }

  private fileUploadEndpoint(path: string): string {
    const rawBase =
      this.config.fileUploadBaseUrl ?? "https://kieai.redpandaai.co";
    const parsed = new URL(rawBase);
    const isLoopback =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1";
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && isLoopback))
    ) {
      throw new Error(
        "KIE_AI_FILE_UPLOAD_BASE_URL must be HTTPS without credentials, query, or fragment.",
      );
    }
    let pathname = parsed.pathname.replace(/\/+$/, "");
    if (pathname.endsWith("/api/v1"))
      pathname = pathname.slice(0, -"/api/v1".length);
    if (pathname && pathname !== "/") {
      throw new Error(
        "KIE_AI_FILE_UPLOAD_BASE_URL must not contain an application path.",
      );
    }
    parsed.pathname = path;
    return parsed.toString();
  }

  private async uploadRequest(
    endpoint: string,
    body: BodyInit,
    contentType?: string,
  ): Promise<KieAiResponse<KieAiUploadResult>> {
    const response = await fetch(this.fileUploadEndpoint(endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(this.config.timeout),
    });
    let data: KieAiResponse<KieAiUploadResult>;
    try {
      data = (await response.json()) as KieAiResponse<KieAiUploadResult>;
    } catch {
      throw new KieAiRequestError(
        `HTTP ${response.status}: The provider returned an invalid upload response.`,
        response.status,
      );
    }
    if (!response.ok) {
      throw new KieAiRequestError(
        `HTTP ${response.status}: ${providerMessage(data, "The provider rejected the file upload.")}`,
        response.status,
        data.code,
      );
    }
    if (data.data?.downloadUrl && !data.data.fileUrl) {
      data.data.fileUrl = data.data.downloadUrl;
    }
    const resultUrl = data.data?.downloadUrl ?? data.data?.fileUrl;
    if (resultUrl) {
      const parsed = validatePublicHttpUrl(resultUrl, "Kie upload result URL");
      if (parsed.protocol !== "https:") {
        throw new Error("Kie upload result URL must use HTTPS.");
      }
    }
    return data;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    body?: any,
  ): Promise<KieAiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };

    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (body && method === "POST") {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);
      let data: KieAiResponse<T>;
      try {
        data = (await response.json()) as KieAiResponse<T>;
      } catch {
        throw new KieAiRequestError(
          `HTTP ${response.status}: The provider returned an invalid response.`,
          response.status,
        );
      }

      if (!response.ok) {
        throw new KieAiRequestError(
          `HTTP ${response.status}: ${providerMessage(data, "The provider rejected the request.")}`,
          response.status,
          data.code,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof KieAiRequestError || isAbortError(error)) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async uploadFile(
    file: KieAiUploadFile,
    uploadPath = "images/user-uploads",
  ): Promise<KieAiResponse<KieAiUploadResult>> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([file.bytes as unknown as BlobPart], { type: file.contentType }),
      file.filename,
    );
    form.append("uploadPath", uploadPath);
    form.append("fileName", file.filename);

    try {
      return await this.uploadRequest("/api/file-stream-upload", form);
    } catch (error) {
      if (error instanceof KieAiRequestError || isAbortError(error)) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async uploadBase64(request: {
    base64Data: string;
    uploadPath: string;
    fileName?: string;
  }): Promise<KieAiResponse<KieAiUploadResult>> {
    return this.uploadRequest(
      "/api/file-base64-upload",
      JSON.stringify(request),
      "application/json",
    );
  }

  async uploadFromUrl(request: {
    fileUrl: string;
    uploadPath: string;
    fileName?: string;
  }): Promise<KieAiResponse<KieAiUploadResult>> {
    return this.uploadRequest(
      "/api/file-url-upload",
      JSON.stringify(request),
      "application/json",
    );
  }

  async downloadFile(
    url: string,
    options: {
      validateUrl?: (url: string, previousUrl?: string) => void;
      maxRedirects?: number;
      maxBytes?: number;
    } = {},
  ): Promise<KieAiDownloadedFile> {
    let currentUrl = url;
    let previousUrl: string | undefined;
    const maxRedirects = options.maxRedirects ?? 3;

    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      options.validateUrl?.(currentUrl, previousUrl);
      try {
        const response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(this.config.timeout),
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location || redirect === maxRedirects) {
            throw new KieAiRequestError(
              "The provider result could not be downloaded.",
              response.status,
            );
          }
          previousUrl = currentUrl;
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        if (!response.ok) {
          throw new KieAiRequestError(
            `HTTP ${response.status}: The provider result could not be downloaded.`,
            response.status,
          );
        }
        return {
          bytes: await readResponseBytes(response, options.maxBytes),
          contentType: response.headers.get("content-type"),
        };
      } catch (error) {
        if (error instanceof KieAiRequestError || isAbortError(error)) {
          throw error;
        }
        if (error instanceof Error) {
          throw new Error(`Request failed: ${error.message}`);
        }
        throw error;
      }
    }

    throw new KieAiRequestError(
      "HTTP 502: The provider result could not be downloaded.",
      502,
    );
  }

  async generateNanoBananaImage(
    request: NanoBananaImageRequest,
  ): Promise<KieAiResponse<ImageResponse>> {
    // Smart mode detection based on parameters
    const hasImageInput =
      !!request.image_input && request.image_input.length > 0;

    const isLite = request.model === "nano-banana-2-lite";
    const input: any = {
      prompt: request.prompt,
      ...(request.aspect_ratio && { aspect_ratio: request.aspect_ratio }),
    };

    if (isLite) {
      if (request.image_input && request.image_input.length > 10) {
        throw new Error(
          "Nano Banana 2 Lite supports at most 10 reference images",
        );
      }
      input.image_urls = request.image_input || [];
    } else {
      if (hasImageInput) {
        input.image_input = request.image_input;
      } else {
        input.image_input = [];
      }
      if (request.output_format) input.output_format = request.output_format;
      if (request.resolution) input.resolution = request.resolution;
      if (request.google_search) input.google_search = true;
    }

    const jobRequest = {
      model: request.model || "nano-banana-2",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<ImageResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateVeo3Video(
    request: Veo3GenerateRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    return this.makeRequest<TaskResponse>("/veo/generate", "POST", request);
  }

  async getTaskStatus(
    taskId: string,
    apiType?: string,
  ): Promise<KieAiResponse<any>> {
    // Use api_type to determine correct endpoint, with fallback strategy
    if (apiType === "veo3") {
      return this.makeRequest<any>(`/veo/record-info?taskId=${taskId}`, "GET");
    } else if (
      apiType === "nano-banana" ||
      apiType === "nano-banana-edit" ||
      apiType === "nano-banana-image"
    ) {
      return this.makeRequest<any>(`/jobs/recordInfo?taskId=${taskId}`, "GET");
    } else if (apiType === "suno") {
      return this.makeRequest<any>(
        `/generate/record-info?taskId=${taskId}`,
        "GET",
      );
    } else if (
      apiType === "elevenlabs-tts" ||
      apiType === "elevenlabs-sound-effects" ||
      apiType === "bytedance-seedance-video" ||
      apiType === "bytedance-seedream-image" ||
      apiType === "qwen-image" ||
      apiType === "wan-video" ||
      apiType === "recraft-remove-background" ||
      apiType === "ideogram-reframe" ||
      apiType === "kling-3.0-video" ||
      apiType === "hailuo" ||
      apiType === "flux2-image" ||
      apiType === "wan-animate" ||
      apiType === "topaz-upscale" ||
      apiType === "happyhorse-video" ||
      apiType === "omnihuman-video" ||
      apiType === "gemini-omni-video" ||
      apiType === "gpt-image-2" ||
      apiType === "z-image" ||
      apiType === "grok-imagine"
    ) {
      return this.makeRequest<any>(`/jobs/recordInfo?taskId=${taskId}`, "GET");
    } else if (apiType === "runway-aleph-video") {
      return this.makeRequest<any>(
        `/api/v1/aleph/record-info?taskId=${taskId}`,
        "GET",
      );
    } else if (apiType === "midjourney") {
      return this.makeRequest<any>(`/mj/record-info?taskId=${taskId}`, "GET");
    } else if (apiType === "flux-kontext-image") {
      return this.makeRequest<any>(
        `/flux/kontext/record-info?taskId=${taskId}`,
        "GET",
      );
    }

    // Fallback: try jobs first, then veo, then generate, then mj, then gpt4o-image (for tasks not in database)
    try {
      return await this.makeRequest<any>(
        `/jobs/recordInfo?taskId=${taskId}`,
        "GET",
      );
    } catch (error) {
      try {
        return await this.makeRequest<any>(
          `/veo/record-info?taskId=${taskId}`,
          "GET",
        );
      } catch (veoError) {
        try {
          return await this.makeRequest<any>(
            `/generate/record-info?taskId=${taskId}`,
            "GET",
          );
        } catch (sunoError) {
          try {
            return await this.makeRequest<any>(
              `/mj/record-info?taskId=${taskId}`,
              "GET",
            );
          } catch (mjError) {
            try {
              return this.makeRequest<any>(
                `/flux/kontext/record-info?taskId=${taskId}`,
                "GET",
              );
            } catch (fluxError) {
              throw error;
            }
          }
        }
      }
    }
  }

  async generateSunoMusic(
    request: SunoGenerateRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const jobRequest = {
      ...request,
      model: request.model || "V5",
    };
    return this.makeRequest<TaskResponse>("/generate", "POST", jobRequest);
  }

  async generateElevenLabsTTS(
    request: ElevenLabsTTSRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Determine model based on request parameter (default: turbo)
    const model =
      request.model === "multilingual"
        ? "elevenlabs/text-to-speech-multilingual-v2"
        : "elevenlabs/text-to-speech-turbo-2-5";

    const input: any = {
      text: request.text,
      voice: request.voice || "Rachel",
      stability: request.stability || 0.5,
      similarity_boost: request.similarity_boost || 0.75,
      style: request.style || 0,
      speed: request.speed || 1,
      timestamps: request.timestamps || false,
    };

    // Add model-specific parameters
    if (request.model === "multilingual") {
      input.previous_text = request.previous_text || "";
      input.next_text = request.next_text || "";
    } else {
      // Turbo model uses language_code
      input.language_code = request.language_code || "";
    }

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateElevenLabsSoundEffects(
    request: ElevenLabsSoundEffectsRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const jobRequest = {
      model: "elevenlabs/sound-effect-v2",
      input: {
        text: request.text,
        loop: request.loop || false,
        ...(request.duration_seconds !== undefined && {
          duration_seconds: request.duration_seconds,
        }),
        prompt_influence: request.prompt_influence || 0.3,
        output_format: request.output_format || "mp3_44100_192",
      },
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateByteDanceSeedanceVideo(
    request: ByteDanceSeedanceVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const input: Record<string, unknown> = {
      prompt: request.prompt,
    };

    for (const key of [
      "extension_task_id",
      "first_frame_url",
      "last_frame_url",
      "reference_image_urls",
      "reference_video_urls",
      "reference_audio_urls",
      "generate_audio",
      "resolution",
      "aspect_ratio",
      "duration",
      "return_last_frame",
    ] as const) {
      if (request[key] !== undefined) input[key] = request[key];
    }

    const jobRequest = {
      model: "bytedance/seedance-2-5",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateRunwayAlephVideo(
    request: RunwayAlephVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const jobRequest = {
      prompt: request.prompt,
      videoUrl: request.videoUrl,
      waterMark: request.waterMark || "",
      uploadCn: request.uploadCn || false,
      aspectRatio: request.aspectRatio || "16:9",
      ...(request.seed !== undefined && { seed: request.seed }),
      ...(request.referenceImage && { referenceImage: request.referenceImage }),
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/api/v1/aleph/generate",
      "POST",
      jobRequest,
    );
  }

  async generateWanVideo(
    request: WanVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const mode =
      request.mode ||
      (request.video_url_edit
        ? "video-edit"
        : request.reference_image?.length || request.reference_video?.length
          ? "reference-to-video"
          : request.first_frame_url ||
              request.last_frame_url ||
              request.first_clip_url
            ? "image-to-video"
            : "text-to-video");

    const modelMap: Record<string, string> = {
      "text-to-video": "wan/2-7-text-to-video",
      "image-to-video": "wan/2-7-image-to-video",
      "reference-to-video": "wan/2-7-r2v",
      "video-edit": "wan/2-7-videoedit",
    };
    const model = modelMap[mode];

    const input: any = {
      prompt: request.prompt,
    };

    // Add optional fields only when provided
    if (request.negative_prompt)
      input.negative_prompt = request.negative_prompt;
    if (request.audio_url) input.audio_url = request.audio_url;
    if (request.first_frame_url)
      input.first_frame_url = request.first_frame_url;
    if (request.last_frame_url) input.last_frame_url = request.last_frame_url;
    if (request.first_clip_url) input.first_clip_url = request.first_clip_url;
    if (request.driving_audio_url)
      input.driving_audio_url = request.driving_audio_url;
    if (request.reference_image?.length)
      input.reference_image = request.reference_image;
    if (request.reference_video?.length)
      input.reference_video = request.reference_video;
    if (request.reference_voice)
      input.reference_voice = request.reference_voice;
    if (request.first_frame) input.first_frame = request.first_frame;
    if (request.video_url_edit) input.video_url = request.video_url_edit;
    if (request.reference_image_edit)
      input.reference_image = request.reference_image_edit;
    if (request.audio_setting) input.audio_setting = request.audio_setting;
    if (request.seed !== undefined) input.seed = request.seed;

    input.resolution = request.resolution || "1080p";
    input.ratio = request.ratio || "16:9";
    input.duration = request.duration || 5;
    input.prompt_extend = request.prompt_extend !== false;
    input.watermark = request.watermark || false;
    input.nsfw_checker = request.nsfw_checker || false;

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateByteDanceSeedreamImage(
    request: ByteDanceSeedreamImageRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Determine mode based on presence of image_urls
    const isEdit = !!request.image_urls && request.image_urls.length > 0;
    const isV5Lite = request.version === "5-lite" || !request.version;
    const isV5Pro = request.version === "5-pro";

    let model: string;
    let input: any;

    if (isV5Pro) {
      if (request.image_urls && request.image_urls.length > 10) {
        throw new Error("Seedream 5 Pro supports at most 10 reference images");
      }
      model = isEdit
        ? "seedream/5-pro-image-to-image"
        : "seedream/5-pro-text-to-image";
      input = {
        prompt: request.prompt,
        aspect_ratio: request.aspect_ratio || "1:1",
        quality: request.quality || "basic",
        output_format: request.output_format || "png",
        nsfw_checker: request.nsfw_checker === true,
      };
      if (isEdit) input.image_urls = request.image_urls;
    } else if (isV5Lite) {
      // Seedream 5.0 Lite
      model = isEdit
        ? "seedream/5-lite-image-to-image"
        : "seedream/5-lite-text-to-image";
      input = {
        prompt: request.prompt,
        aspect_ratio: request.aspect_ratio || "1:1",
        quality: request.quality || "basic",
      };
      if (isEdit) {
        input.image_urls = request.image_urls;
      }
    } else {
      // Seedream V4 (default)
      model = isEdit
        ? "bytedance/seedream-v4-edit"
        : "bytedance/seedream-v4-text-to-image";
      input = {
        prompt: request.prompt,
        image_size: request.image_size || "1:1",
        image_resolution: request.image_resolution || "1K",
        max_images: request.max_images || 1,
        seed: request.seed !== undefined ? request.seed : -1,
      };
      if (isEdit) {
        input.image_urls = request.image_urls;
      }
    }

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateOmniHumanVideo(
    request: OmniHumanVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const input: Record<string, unknown> = {
      image_url: request.image_url,
      audio_url: request.audio_url,
      output_resolution: request.output_resolution || "1080",
      pe_fast_mode: request.pe_fast_mode === true,
      seed: request.seed ?? -1,
    };
    if (request.mask_url?.length) input.mask_url = request.mask_url;
    if (request.prompt) input.prompt = request.prompt;

    return this.makeRequest<TaskResponse>("/jobs/createTask", "POST", {
      model: "omnihuman-1-5",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    });
  }

  async generateGeminiOmni(
    request: GeminiOmniRequest,
  ): Promise<KieAiResponse<any>> {
    if (request.operation === "audio") {
      return this.makeRequest("/omni/audio/create", "POST", {
        audio_id: request.audio_id,
        name: request.name,
        ...(request.voice_description && {
          voice_description: request.voice_description,
        }),
        ...(request.example_dialogue && {
          example_dialogue: request.example_dialogue,
        }),
      });
    }
    if (request.operation === "character") {
      return this.makeRequest("/omni/character/create", "POST", {
        descriptions: request.descriptions,
        image_urls: request.image_urls,
        ...(request.audio_ids?.length && { audio_ids: request.audio_ids }),
        ...(request.character_name && {
          character_name: request.character_name,
        }),
      });
    }
    const input: Record<string, unknown> = { prompt: request.prompt };
    for (const key of [
      "image_urls",
      "audio_ids",
      "video_list",
      "character_ids",
      "duration",
      "aspect_ratio",
      "resolution",
      "seed",
    ] as const) {
      if (request[key] !== undefined) input[key] = request[key];
    }
    return this.makeRequest("/jobs/createTask", "POST", {
      model: "gemini-omni-video",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    });
  }

  async generateQwenImage(
    request: QwenImageRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Determine mode based on presence of image_url
    const isEdit = !!request.image_url;
    const model = isEdit ? "qwen/image-edit" : "qwen/text-to-image";

    const input: any = {
      prompt: request.prompt,
      image_size: request.image_size || "square_hd",
      num_inference_steps: request.num_inference_steps || (isEdit ? 25 : 30),
      seed: request.seed,
      guidance_scale: request.guidance_scale || (isEdit ? 4 : 2.5),
      enable_safety_checker: request.enable_safety_checker === true,
      output_format: request.output_format || "png",
      negative_prompt:
        request.negative_prompt || (isEdit ? "blurry, ugly" : " "),
      acceleration: request.acceleration || "none",
    };

    // Add edit-specific parameters
    if (isEdit) {
      input.image_url = request.image_url;
      if (request.num_images) {
        input.num_images = request.num_images;
      }
      if (request.sync_mode !== undefined) {
        input.sync_mode = request.sync_mode;
      }
    }

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateMidjourney(
    request: MidjourneyGenerateRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Smart task type detection
    let taskType = request.taskType;
    const hasImage =
      request.fileUrl || (request.fileUrls && request.fileUrls.length > 0);
    const isVideoMode =
      request.motion || request.videoBatchSize || request.high_definition_video;
    const isOmniMode = request.ow || request.taskType === "mj_omni_reference";
    const isStyleMode = request.taskType === "mj_style_reference";

    // Auto-detect task type if not provided
    if (!taskType) {
      if (isOmniMode) {
        taskType = "mj_omni_reference";
      } else if (isStyleMode) {
        taskType = "mj_style_reference";
      } else if (isVideoMode) {
        taskType = request.high_definition_video ? "mj_video_hd" : "mj_video";
      } else if (hasImage) {
        taskType = "mj_img2img";
      } else {
        taskType = "mj_txt2img";
      }
    }

    // Build request payload
    const payload: any = {
      taskType,
      prompt: request.prompt,
      aspectRatio: request.aspectRatio || "16:9",
      version: request.version || "7",
      enableTranslation: request.enableTranslation || false,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    // Add image URLs (prefer fileUrls array over fileUrl)
    if (request.fileUrls && request.fileUrls.length > 0) {
      payload.fileUrls = request.fileUrls;
    } else if (request.fileUrl) {
      payload.fileUrls = [request.fileUrl];
    }

    // Add optional parameters based on task type
    if (
      request.speed &&
      !["mj_video", "mj_video_hd", "mj_omni_reference"].includes(taskType)
    ) {
      payload.speed = request.speed;
    }

    if (request.variety !== undefined) {
      payload.variety = request.variety;
    }

    if (request.stylization !== undefined) {
      payload.stylization = request.stylization;
    }

    if (request.weirdness !== undefined) {
      payload.weirdness = request.weirdness;
    }

    if (request.waterMark !== undefined) {
      payload.waterMark = request.waterMark;
    }

    // Task-specific parameters
    if (taskType === "mj_omni_reference" && request.ow) {
      payload.ow = request.ow;
    }

    if (taskType === "mj_video" || taskType === "mj_video_hd") {
      payload.motion =
        request.motion === undefined
          ? "high"
          : request.motion >= 50
            ? "high"
            : "low";
      if (request.videoBatchSize) {
        payload.videoBatchSize = parseInt(request.videoBatchSize.toString());
      }
    }

    return this.makeRequest<TaskResponse>("/mj/generate", "POST", payload);
  }

  async generateGptImage2(
    request: GptImage2Request,
  ): Promise<KieAiResponse<TaskResponse>> {
    const hasInputUrls = request.input_urls && request.input_urls.length > 0;
    const model = hasInputUrls
      ? "gpt-image-2-image-to-image"
      : "gpt-image-2-text-to-image";

    const input: any = {
      prompt: request.prompt,
    };
    if (hasInputUrls) input.input_urls = request.input_urls;
    if (request.aspect_ratio) input.aspect_ratio = request.aspect_ratio;
    if (request.resolution) input.resolution = request.resolution;

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateHappyHorseVideo(
    request: HappyHorseVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const mode =
      request.mode ||
      (request.video_url
        ? "video-edit"
        : request.reference_image?.length
          ? "reference-to-video"
          : request.image_urls?.length
            ? "image-to-video"
            : "text-to-video");

    const modelMap: Record<string, string> = {
      "text-to-video": "happyhorse/text-to-video",
      "image-to-video": "happyhorse/image-to-video",
      "reference-to-video": "happyhorse/reference-to-video",
      "video-edit": "happyhorse/video-edit",
    };
    const model = modelMap[mode];

    const input: any = { prompt: request.prompt };

    if (request.image_urls?.length) input.image_urls = request.image_urls;
    if (request.reference_image?.length)
      input.reference_image = request.reference_image;
    if (request.video_url) input.video_url = request.video_url;
    if (request.reference_image_edit?.length)
      input.reference_image_edit = request.reference_image_edit;
    if (request.audio_setting) input.audio_setting = request.audio_setting;
    if (request.seed !== undefined) input.seed = request.seed;

    input.resolution = request.resolution || "1080p";
    input.aspect_ratio = request.aspect_ratio || "16:9";
    input.duration = request.duration || 5;

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateFluxKontextImage(
    request: FluxKontextImageRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Build request payload
    const payload: any = {
      prompt: request.prompt,
      enableTranslation: request.enableTranslation !== false, // Default to true
      uploadCn: request.uploadCn || false,
      aspectRatio: request.aspectRatio || "16:9",
      outputFormat: request.outputFormat || "jpeg",
      promptUpsampling: request.promptUpsampling || false,
      model: request.model || "flux-kontext-pro",
      callBackUrl: this.callbackUrl(request.callBackUrl),
      safetyTolerance: request.safetyTolerance || 6,
    };

    // Add input image if provided (editing mode)
    if (request.inputImage) {
      payload.inputImage = request.inputImage;
    }

    // Add watermark if provided
    if (request.watermark) {
      payload.watermark = request.watermark;
    }

    return this.makeRequest<TaskResponse>(
      "/flux/kontext/generate",
      "POST",
      payload,
    );
  }

  async generateRecraftRemoveBackground(
    request: RecraftRemoveBackgroundRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const jobRequest = {
      model: "recraft/remove-background",
      input: {
        image: request.image,
      },
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateIdeogramReframe(
    request: IdeogramReframeRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const jobRequest = {
      model: "ideogram/v3-reframe",
      input: {
        image_url: request.image_url,
        image_size: request.image_size,
        rendering_speed: request.rendering_speed,
        style: request.style,
        num_images: request.num_images,
        seed: request.seed,
      },
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async getVeo1080pVideo(
    taskId: string,
    index?: number,
  ): Promise<KieAiResponse<any>> {
    const params = new URLSearchParams({ taskId });
    if (index !== undefined) {
      params.append("index", index.toString());
    }
    return this.makeRequest<any>(`/veo/get-1080p-video?${params}`, "GET");
  }

  async generateKlingVideo(
    request: KlingVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Kling 3.0 - single model endpoint
    const input: any = {
      prompt: request.prompt,
      duration: request.duration || "5",
      aspect_ratio: request.aspect_ratio || "16:9",
      mode: request.mode || "std",
      sound: request.sound ?? false,
    };

    // Image-to-video: up to 2 images (start frame, optional end frame)
    if (request.image_urls && request.image_urls.length > 0) {
      input.image_urls = request.image_urls;
    }

    // Multi-shot mode
    if (request.multi_shots) {
      input.multi_shots = true;
      if (request.multi_prompt) {
        input.multi_prompt = request.multi_prompt;
      }
    }

    // Kling Elements (characters, objects)
    if (request.kling_elements && request.kling_elements.length > 0) {
      input.kling_elements = request.kling_elements;
    }

    const jobRequest = {
      model: "kling-3.0/video",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateHailuoVideo(
    request: HailuoVideoRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const hasReferenceInputs = Boolean(
      request.referenceImageUrls?.length ||
        request.referenceVideoUrls?.length ||
        request.referenceAudioUrls?.length,
    );
    let model: string;
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      duration: request.duration,
    };

    if (request.imageUrl) {
      model = "minimax-h3/image-to-video";
      input.first_frame_url = request.imageUrl;
      if (request.endImageUrl) input.last_frame_url = request.endImageUrl;
    } else if (hasReferenceInputs) {
      model = "minimax-h3/reference-to-video";
      if (request.referenceImageUrls) {
        input.reference_image_urls = request.referenceImageUrls;
      }
      if (request.referenceVideoUrls) {
        input.reference_video_urls = request.referenceVideoUrls;
      }
      if (request.referenceAudioUrls) {
        input.reference_audio_urls = request.referenceAudioUrls;
      }
      if (request.aspectRatio) input.aspect_ratio = request.aspectRatio;
      if (request.resolution) input.resolution = request.resolution;
    } else {
      model = "minimax-h3/text-to-video";
      input.aspect_ratio = request.aspectRatio;
    }

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateFlux2Image(
    request: Flux2ImageRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Smart mode detection based on parameters
    const hasInputUrls = !!request.input_urls && request.input_urls.length > 0;
    const modelType = request.model_type || "pro";

    let model: string;
    if (hasInputUrls) {
      // Image-to-image mode
      model =
        modelType === "flex"
          ? "flux-2/flex-image-to-image"
          : "flux-2/pro-image-to-image";
    } else {
      // Text-to-image mode
      model =
        modelType === "flex"
          ? "flux-2/flex-text-to-image"
          : "flux-2/pro-text-to-image";
    }

    const input: any = {
      prompt: request.prompt,
      aspect_ratio: request.aspect_ratio || "1:1",
      resolution: request.resolution || "1K",
    };

    // Add input_urls for image-to-image mode
    if (hasInputUrls) {
      input.input_urls = request.input_urls;
    }

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateWanAnimate(
    request: WanAnimateRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Mode determines the model
    const model =
      request.mode === "replace"
        ? "wan/2-2-animate-replace"
        : "wan/2-2-animate-move";

    const input: any = {
      video_url: request.video_url,
      image_url: request.image_url,
      resolution: request.resolution || "480p",
    };

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateZImage(
    request: ZImageRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const input = {
      prompt: request.prompt,
      aspect_ratio: request.aspect_ratio || "1:1",
    };

    const jobRequest = {
      model: "z-image",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateGrokImagine(
    request: GrokImagineRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    // Detect generation mode
    const hasImageUrls = request.image_urls && request.image_urls.length > 0;
    const hasTaskId = !!request.task_id;
    const hasPrompt = !!request.prompt;

    let mode =
      request.generation_mode ||
      (hasTaskId && !hasPrompt && !hasImageUrls
        ? "upscale"
        : hasImageUrls || hasTaskId
          ? "image-to-video"
          : "text-to-video"); // Default to text-to-video if prompt provided

    // If user explicitly wants text-to-image
    if (request.generation_mode === "text-to-image") {
      mode = "text-to-image";
    }

    let model: string;
    let input: any = {};

    switch (mode) {
      case "upscale":
        model = "grok-imagine/upscale";
        input = { task_id: request.task_id };
        break;

      case "image-to-video":
        model = "grok-imagine/image-to-video";
        if (hasImageUrls) {
          input.image_urls = request.image_urls;
        }
        if (hasTaskId) {
          input.task_id = request.task_id;
          if (request.index !== undefined) {
            input.index = request.index;
          }
        }
        if (hasPrompt) {
          input.prompt = request.prompt;
        }
        if (request.aspect_ratio) {
          input.aspect_ratio = request.aspect_ratio;
        }
        input.mode = request.mode || "normal";
        break;

      case "text-to-video":
        model = "grok-imagine/text-to-video";
        input = {
          prompt: request.prompt,
          aspect_ratio: request.aspect_ratio || "1:1",
          mode: request.mode || "normal",
        };
        break;

      case "image-to-image":
        model = "grok-imagine-image-2-0/image-edit";
        input = {
          prompt: request.prompt,
          aspect_ratio: request.aspect_ratio || "1:1",
          image_urls: request.image_urls,
        };
        break;

      case "text-to-image":
        model = "grok-imagine-image-2-0/text-to-image";
        input = {
          prompt: request.prompt,
          aspect_ratio: request.aspect_ratio || "1:1",
        };
        break;

      default:
        throw new Error(`Unsupported Grok Imagine generation mode: ${mode}`);
    }

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateInfiniTalk(
    request: InfiniTalkRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const input: any = {
      image_url: request.image_url,
      audio_url: request.audio_url,
      prompt: request.prompt,
      resolution: request.resolution || "480p",
    };

    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    const jobRequest = {
      model: "infinitalk/from-audio",
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateTopazUpscaleImage(
    request: TopazUpscaleImageRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const jobRequest = {
      model: "topaz/image-upscale",
      input: {
        image_url: request.image_url,
        upscale_factor: request.upscale_factor || "2",
      },
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }

  async generateKlingAvatar(
    request: KlingAvatarRequest,
  ): Promise<KieAiResponse<TaskResponse>> {
    const quality = request.quality || "standard";
    const model =
      quality === "pro" ? "kling/ai-avatar-v1-pro" : "kling/v1-avatar-standard";

    const input = {
      image_url: request.image_url,
      audio_url: request.audio_url,
      prompt: request.prompt,
    };

    const jobRequest = {
      model,
      input,
      callBackUrl: this.callbackUrl(request.callBackUrl),
    };

    return this.makeRequest<TaskResponse>(
      "/jobs/createTask",
      "POST",
      jobRequest,
    );
  }
}
