import { WaitForTaskSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";
import { getTaskStatusTool } from "./get_task_status.js";

/**
 * Resolve the rendezvous result base (e.g. https://host/kie/result) from, in
 * order: the explicit arg, KIE_AI_RESULT_URL, or by deriving it from the
 * configured callback URL when it ends in /kie/callback. Returns null when no
 * rendezvous is configured (the normal case), in which case wait_for_task polls
 * the Kie API directly instead.
 */
function resolveResultBase(
  explicit: string | undefined,
  ctx: ToolContext,
): string | null {
  const strip = (u: string) => u.replace(/\/+$/, "");
  if (explicit) return strip(explicit);
  if (process.env.KIE_AI_RESULT_URL)
    return strip(process.env.KIE_AI_RESULT_URL);

  const callback = ctx.getCallbackUrl();
  if (callback.endsWith("/kie/callback")) {
    return callback.slice(0, -"/kie/callback".length) + "/kie/result";
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run get_task_status once and return its parsed JSON envelope. We reuse that
 * tool so all the per-API status parsing and the DB normalisation (status ->
 * pending|processing|completed|failed, result_url) lives in exactly one place.
 */
async function pollOnce(
  ctx: ToolContext,
  task_id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await getTaskStatusTool.run({ task_id }, ctx);
    return JSON.parse(res.content[0].text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Wait for a generation task to finish inside a single tool call, so the agent
 * does not have to poll. By default it polls the Kie API directly (no callback
 * infrastructure needed); if a callback rendezvous is configured it waits on
 * that instead. While waiting it emits progress notifications (when the MCP
 * client opted in), which keep the open request alive past the client's default
 * timeout.
 */
export const waitForTaskTool: ToolDef<typeof WaitForTaskSchema> = {
  name: "wait_for_task",
  description:
    "Wait for a generation task to complete in a single call, so you don't have to poll get_task_status repeatedly. Pass the task_id returned by any generation tool: it blocks until the result is ready (or the timeout) and returns the final URLs, streaming progress meanwhile. By default it polls the Kie API directly (no setup); if a callback rendezvous is configured (KIE_AI_RESULT_URL, rendezvous_url, or a KIE_AI_CALLBACK_URL ending in /kie/callback) it waits on that instead. Tip for long jobs: clients should enable resetTimeoutOnProgress with a generous maxTotalTimeout.",
  category: "utility",
  schema: WaitForTaskSchema,
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const {
        task_id,
        timeout_seconds = 180,
        interval_seconds = 5,
        rendezvous_url,
      } = WaitForTaskSchema.parse(args);

      const base = resolveResultBase(rendezvous_url, ctx);
      const start = Date.now();
      const deadline = start + timeout_seconds * 1000;
      const totalTicks = Math.max(
        1,
        Math.ceil(timeout_seconds / interval_seconds),
      );
      let tick = 0;
      const elapsed = () => Math.round((Date.now() - start) / 1000);

      // --- Path A: callback rendezvous (distributed/serverless setups) ---------
      if (base) {
        const url = `${base}/${encodeURIComponent(task_id)}`;
        while (Date.now() < deadline) {
          tick++;
          try {
            const res = await fetch(url);
            if (res.status === 200) {
              const data = (await res.json()) as {
                status?: string;
                urls?: string[];
                model?: string | null;
              };
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        success: true,
                        task_id,
                        status: data.status ?? "completed",
                        elapsed_seconds: elapsed(),
                        result_urls: data.urls ?? [],
                        model: data.model ?? null,
                        message: "Result received from rendezvous",
                      },
                      null,
                      2,
                    ),
                  },
                ],
              };
            }
            // 202 (pending) or any transient response: keep waiting.
          } catch {
            // Network blip against the rendezvous: ignore and retry.
          }
          await ctx.onProgress?.({
            progress: tick,
            total: totalTicks,
            message: `Waiting on rendezvous… ${elapsed()}s elapsed`,
          });
          await sleep(interval_seconds * 1000);
        }

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  task_id,
                  status: "timed_out",
                  error: "timeout",
                  elapsed_seconds: elapsed(),
                  message: `No result after ${timeout_seconds}s. The task may still be running; retry wait_for_task or check get_task_status.`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // --- Path B: poll the Kie API directly (default, no setup needed) --------
      while (Date.now() < deadline) {
        tick++;
        const details = await pollOnce(ctx, task_id);
        const task = await ctx.db.getTask(task_id);

        if (task?.status === "completed") {
          // Prefer get_task_status's full URL list (it carries every output, e.g.
          // both Suno songs); fall back to the DB column only when that list is
          // empty, since the DB stores just the first URL.
          const fromDetails = details?.result_urls as string[] | undefined;
          const result_urls =
            fromDetails && fromDetails.length > 0
              ? fromDetails
              : task.result_url
                ? [task.result_url]
                : [];
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    task_id,
                    status: "completed",
                    elapsed_seconds: elapsed(),
                    result_urls,
                    details,
                    message: "Generation completed",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (task?.status === "failed") {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    task_id,
                    status: "failed",
                    elapsed_seconds: elapsed(),
                    error: task.error_message ?? "Generation failed",
                    details,
                    message: "Generation failed",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        await ctx.onProgress?.({
          progress: tick,
          total: totalTicks,
          message: `Generating… ${elapsed()}s elapsed (status: ${
            task?.status ?? "pending"
          })`,
        });
        await sleep(interval_seconds * 1000);
      }

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                task_id,
                status: "timed_out",
                error: "timeout",
                elapsed_seconds: elapsed(),
                message: `Still running after ${timeout_seconds}s. Call wait_for_task again with the same task_id, or check get_task_status.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return ctx.formatError("wait_for_task", error, {
        task_id: "Required: task ID returned by a generation tool",
        timeout_seconds: "Optional: max seconds to wait (5-600, default: 180)",
        interval_seconds:
          "Optional: seconds between status checks (1-60, default: 5)",
        rendezvous_url:
          "Optional: rendezvous result base URL (e.g. https://host/kie/result); omit to poll the Kie API directly",
      });
    }
  },
};
