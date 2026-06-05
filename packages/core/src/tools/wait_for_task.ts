import { WaitForTaskSchema } from "../types.js";
import type { ToolDef, ToolContext, ToolResult } from "./types.js";

/**
 * Resolve the rendezvous result base (e.g. https://host/kie/result) from, in
 * order: the explicit arg, KIE_AI_RESULT_URL, or by deriving it from the
 * configured callback URL when it ends in /kie/callback. Returns null when no
 * rendezvous is configured (e.g. still pointing at the proxy.kie.ai default).
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
 * Wait for a generation task to finish via the callback rendezvous instead of
 * polling the Kie API. Pairs with any generation tool: call the generator (with
 * KIE_AI_CALLBACK_URL pointing at your rendezvous worker), then pass its
 * task_id here to block in a single tool call until the result is ready.
 */
export const waitForTaskTool: ToolDef<typeof WaitForTaskSchema> = {
  name: "wait_for_task",
  description:
    "Wait for a generation task to complete via the callback rendezvous (no Kie polling). Use after any generation tool when KIE_AI_CALLBACK_URL points at your rendezvous worker: it returns the final result URLs in a single call once the worker receives the callback. Requires a rendezvous (KIE_AI_RESULT_URL, the rendezvous_url arg, or a KIE_AI_CALLBACK_URL ending in /kie/callback).",
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
      if (!base) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: "no_rendezvous_configured",
                  message:
                    "wait_for_task needs a callback rendezvous. Set KIE_AI_CALLBACK_URL to your worker (ending in /kie/callback), set KIE_AI_RESULT_URL, or pass rendezvous_url. Without it, fall back to get_task_status.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const url = `${base}/${encodeURIComponent(task_id)}`;
      const deadline = Date.now() + timeout_seconds * 1000;

      while (Date.now() < deadline) {
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
                message: `No result after ${timeout_seconds}s. The task may still be running; retry wait_for_task or check get_task_status.`,
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
          "Optional: seconds between rendezvous checks (1-60, default: 5)",
        rendezvous_url:
          "Optional: rendezvous result base URL (e.g. https://host/kie/result)",
      });
    }
  },
};
