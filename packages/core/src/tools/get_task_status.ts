import { GetTaskStatusSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

export const getTaskStatusTool: ToolDef<typeof GetTaskStatusSchema> = {
  name: "get_task_status",
  description:
    "Get the status of a generation task with intelligent polling guidance. Returns task status, results, and recommended polling strategy (interval, timing, next steps) based on task type (image/video/audio).",
  category: "utility",
  schema: GetTaskStatusSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const { task_id } = GetTaskStatusSchema.parse(args);

      const localTask = await ctx.db.getTask(task_id);

      // Always try to get updated status from API, passing api_type if available
      let apiResponse = null;
      let parsedResult = null;

      try {
        apiResponse = await ctx.client.getTaskStatus(
          task_id,
          localTask?.api_type,
        );

        // Update local database with API response
        if (apiResponse?.data) {
          const apiData = apiResponse.data;

          // Handle different response formats for different API types
          let status: "pending" | "processing" | "completed" | "failed" =
            "pending";
          let resultUrl = undefined;
          let errorMessage = undefined;

          if (localTask?.api_type === "suno") {
            // Suno-specific status mapping
            const sunoStatus = apiData.status;
            if (sunoStatus === "SUCCESS") status = "completed";
            else if (
              sunoStatus === "CREATE_TASK_FAILED" ||
              sunoStatus === "GENERATE_AUDIO_FAILED" ||
              sunoStatus === "CALLBACK_EXCEPTION" ||
              sunoStatus === "SENSITIVE_WORD_ERROR"
            )
              status = "failed";
            else if (
              sunoStatus === "PENDING" ||
              sunoStatus === "TEXT_SUCCESS" ||
              sunoStatus === "FIRST_SUCCESS"
            )
              status = "processing";

            // Extract audio URLs from Suno response
            if (
              apiData.response?.sunoData &&
              apiData.response.sunoData.length > 0
            ) {
              // Use the first audio URL as the primary result
              resultUrl = apiData.response.sunoData[0].audioUrl;
            }

            // Extract error message for Suno
            if (apiData.errorMessage) {
              errorMessage = apiData.errorMessage;
            }
          } else if (
            localTask?.api_type === "elevenlabs-tts" ||
            localTask?.api_type === "elevenlabs-sound-effects"
          ) {
            // ElevenLabs TTS/Sound Effects-specific status mapping
            const elevenlabsState = apiData.state;
            if (elevenlabsState === "success") status = "completed";
            else if (elevenlabsState === "fail") status = "failed";
            else if (elevenlabsState === "waiting") status = "processing";

            // Parse resultJson for ElevenLabs TTS/Sound Effects
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                // ElevenLabs TTS/Sound Effects returns resultUrls array with audio file URLs
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0]; // Use first audio URL
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for ElevenLabs TTS/Sound Effects
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else if (localTask?.api_type === "flux-kontext-image") {
            // Flux Kontext Image-specific status mapping
            const successFlag = apiData.successFlag;
            if (successFlag === 1) status = "completed";
            else if (successFlag === 2 || successFlag === 3) status = "failed";
            else if (successFlag === 0) status = "processing";

            // Extract result URL from Flux Kontext response
            if (apiData.response?.resultImageUrl) {
              resultUrl = apiData.response.resultImageUrl;
            }

            // Extract error message for Flux Kontext
            if (apiData.errorMessage) {
              errorMessage = apiData.errorMessage;
            }
          } else if (localTask?.api_type === "topaz-upscale") {
            // Topaz Image Upscale-specific status mapping
            const state = apiData.state;
            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson for Topaz Image Upscale
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0];
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for Topaz Image Upscale
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else if (localTask?.api_type === "recraft-remove-background") {
            // Recraft Remove Background-specific status mapping
            const state = apiData.state;
            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson for Recraft Remove Background
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                // Recraft Remove Background returns resultUrls array with image URLs
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0]; // Use first image URL
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for Recraft Remove Background
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else if (localTask?.api_type === "ideogram-reframe") {
            // Ideogram V3 Reframe-specific status mapping
            const state = apiData.state;
            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson for Ideogram V3 Reframe
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                // Ideogram V3 Reframe returns resultUrls array with image URLs
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0]; // Use first image URL
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for Ideogram V3 Reframe
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else {
            // Original logic for other APIs (Nano Banana Pro, Veo3)
            const { state, resultJson, failCode, failMsg } = apiData;

            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson if available
            if (resultJson) {
              try {
                parsedResult = JSON.parse(resultJson);
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            resultUrl = parsedResult?.resultUrls?.[0] || undefined;
            errorMessage = failMsg || undefined;
          }

          // Update database
          await ctx.db.updateTask(task_id, {
            status,
            result_url: resultUrl,
            error_message: errorMessage,
          });
        }
      } catch (error) {
        // API call failed, use local data if available
      }

      // Fetch updated local task
      const updatedTask = await ctx.db.getTask(task_id);

      // Determine polling strategy based on task type
      const getPollingStrategy = (apiType?: string) => {
        // Image generation models
        const imageModels = [
          "nano-banana",
          "nano-banana-edit",
          "nano-banana-image",
          "bytedance-seedream-image",
          "qwen-image",
          "gpt-image-2",
          "flux-kontext-image",
          "topaz-upscale",
          "recraft-remove-background",
          "ideogram-reframe",
          "midjourney",
        ];

        // Video generation models
        const videoModels = [
          "veo3",
          "veo3-fast",
          "veo3-1080p",
          "kling-3.0-video",
          "bytedance-seedance-video",
          "wan-video",
          "happyhorse-video",
          "hailuo",
          "runway-aleph-video",
        ];

        // Audio generation models
        const audioModels = [
          "suno",
          "elevenlabs-tts",
          "elevenlabs-sound-effects",
        ];

        let taskType: "image" | "video" | "audio" = "image";
        let recommendedInterval = 15; // Default for images
        let maxWaitTime = 300; // 5 minutes default

        if (apiType) {
          if (imageModels.some((model) => apiType.includes(model))) {
            taskType = "image";
            recommendedInterval = 15;
            maxWaitTime = 180; // 3 minutes for images
          } else if (videoModels.some((model) => apiType.includes(model))) {
            taskType = "video";
            recommendedInterval = 45;
            maxWaitTime = 600; // 10 minutes for videos
          } else if (audioModels.some((model) => apiType.includes(model))) {
            taskType = "audio";
            recommendedInterval = 20;
            maxWaitTime = 240; // 4 minutes for audio
          }
        }

        const status = updatedTask?.status;
        let nextAction: "continue_polling" | "task_complete" | "task_failed" =
          "continue_polling";

        if (status === "completed") {
          nextAction = "task_complete";
        } else if (status === "failed") {
          nextAction = "task_failed";
        }

        return {
          task_type: taskType,
          recommended_interval_seconds: recommendedInterval,
          max_wait_time_seconds: maxWaitTime,
          backoff_strategy: "fixed" as const,
          next_action: nextAction,
          current_status: status,
          polling_instructions: {
            continue_polling: `Continue polling every ${recommendedInterval} seconds until status changes to 'completed' or 'failed'`,
            task_complete:
              "Task completed successfully - no further polling needed",
            task_failed:
              "Task failed - check error message and consider retrying",
          },
        };
      };

      // Prepare response based on API type
      let responseData: any = {
        success: true,
        task_id: task_id,
        status: updatedTask?.status,
        result_urls: updatedTask?.result_url ? [updatedTask.result_url] : [],
        error: updatedTask?.error_message,
        api_response: apiResponse,
        message: updatedTask
          ? "Task found"
          : "Task not found in local database",
        // Add self-documenting polling strategy
        polling_strategy: getPollingStrategy(localTask?.api_type),
      };

      // Add Suno-specific information if applicable
      if (localTask?.api_type === "suno" && apiResponse?.data) {
        const sunoData = apiResponse.data;
        responseData.status = sunoData.status; // Use Suno's status directly

        // Add detailed Suno information
        if (sunoData.response?.sunoData) {
          responseData.audio_files = sunoData.response.sunoData.map(
            (audio: any) => ({
              id: audio.id,
              audio_url: audio.audioUrl,
              stream_url: audio.streamAudioUrl,
              image_url: audio.imageUrl,
              title: audio.title,
              duration: audio.duration,
              model_name: audio.modelName,
              tags: audio.tags,
              create_time: audio.createTime,
            }),
          );

          // Update result_urls with all audio URLs
          responseData.result_urls = sunoData.response.sunoData.map(
            (audio: any) => audio.audioUrl,
          );
        }

        // Add Suno-specific metadata
        responseData.suno_metadata = {
          task_type: sunoData.type,
          operation_type: sunoData.operationType,
          parent_music_id: sunoData.parentMusicId,
          parameters: sunoData.param ? JSON.parse(sunoData.param) : null,
          error_code: sunoData.errorCode,
          error_message: sunoData.errorMessage,
        };
      } else if (
        (localTask?.api_type === "elevenlabs-tts" ||
          localTask?.api_type === "elevenlabs-sound-effects") &&
        apiResponse?.data
      ) {
        const elevenlabsData = apiResponse.data;
        responseData.status = elevenlabsData.state; // Use ElevenLabs state directly

        // Add detailed ElevenLabs TTS/Sound Effects information
        if (elevenlabsData.resultJson) {
          try {
            const resultData = JSON.parse(elevenlabsData.resultJson);
            if (resultData.resultUrls) {
              responseData.result_urls = resultData.resultUrls;
              responseData.audio_url = resultData.resultUrls[0]; // Primary audio URL
            }
          } catch (e) {
            // Invalid JSON in resultJson
          }
        }

        // Add ElevenLabs-specific metadata
        responseData.elevenlabs_metadata = {
          model: elevenlabsData.model,
          state: elevenlabsData.state,
          cost_time: elevenlabsData.costTime,
          complete_time: elevenlabsData.completeTime,
          create_time: elevenlabsData.createTime,
          parameters: elevenlabsData.param
            ? JSON.parse(elevenlabsData.param)
            : null,
          fail_code: elevenlabsData.failCode,
          fail_message: elevenlabsData.failMsg,
        };
      } else {
        // Use original logic for other APIs
        responseData.status = apiResponse?.data?.state || updatedTask?.status;
        responseData.result_urls =
          parsedResult?.resultUrls ||
          (updatedTask?.result_url ? [updatedTask.result_url] : []);
        responseData.error =
          apiResponse?.data?.failMsg || updatedTask?.error_message;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("get_task_status", error, {
        task_id: "Required: task ID to check status for",
      });
    }
  },
};
