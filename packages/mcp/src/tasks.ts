import { randomUUID } from "node:crypto";
import type { ToolResult } from "@felores/kie-ai-core";
import type { TaskDatabase } from "@felores/kie-ai-core/database";

/**
 * In-process durable task engine for official MCP Tasks. A task created via
 * `tools/call` with a `task` parameter runs asynchronously; clients poll
 * `tasks/result` for the original tool result once it completes, and can list
 * or cancel tasks. Task rows are mirrored into the local SQLite database for
 * visibility and recovery of status. Execution itself is in-process: a
 * process restart leaves running rows recoverable as failed.
 */

export type MCPTaskStatus = "working" | "completed" | "failed" | "cancelled";

export interface MCPTask {
  taskId: string;
  status: MCPTaskStatus;
  ttl: number;
  pollInterval: number;
  createdAt: Date;
  lastUpdatedAt: Date;
  expiresAt: number;
  toolName: string;
  statusMessage?: string;
  result?: ToolResult;
  error?: string;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

export interface StartTaskOptions {
  ttl?: number;
  pollInterval?: number;
  now?: () => number;
}

export class TaskEngine {
  private readonly byId = new Map<string, MCPTask>();
  private readonly db: TaskDatabase;
  private readonly now: () => number;

  constructor(db: TaskDatabase, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  start(
    toolName: string,
    run: () => Promise<ToolResult>,
    options: StartTaskOptions = {},
  ): MCPTask {
    const now = this.now();
    const ttl = Math.max(1, options.ttl ?? DEFAULT_TTL_MS);
    const task: MCPTask = {
      taskId: randomUUID(),
      status: "working",
      ttl,
      pollInterval: Math.max(
        100,
        options.pollInterval ?? DEFAULT_POLL_INTERVAL_MS,
      ),
      createdAt: new Date(now),
      lastUpdatedAt: new Date(now),
      expiresAt: now + ttl,
      toolName,
    };
    this.byId.set(task.taskId, task);
    void this.db
      .createTask({
        task_id: task.taskId,
        api_type: "mcp-task",
        status: "processing",
      })
      .catch(() => undefined);

    task.status = "working";
    task.lastUpdatedAt = new Date(now);
    void run()
      .then((result) => {
        task.status = "completed";
        task.result = result;
        task.lastUpdatedAt = new Date(this.now());
        void this.db
          .updateTask(task.taskId, { status: "completed" })
          .catch(() => undefined);
      })
      .catch((error: unknown) => {
        task.status = "failed";
        task.error = error instanceof Error ? error.message : String(error);
        task.lastUpdatedAt = new Date(this.now());
        void this.db
          .updateTask(task.taskId, {
            status: "failed",
            error_message: task.error,
          })
          .catch(() => undefined);
      });
    return task;
  }

  get(taskId: string): MCPTask | undefined {
    const task = this.byId.get(taskId);
    if (!task) return undefined;
    if (task.expiresAt <= this.now()) return undefined;
    return task;
  }

  cancel(taskId: string): MCPTask | undefined {
    const task = this.byId.get(taskId);
    if (!task) return undefined;
    if (task.status === "completed" || task.status === "failed") return task;
    task.status = "cancelled";
    task.error = "Task cancelled by the client.";
    task.lastUpdatedAt = new Date(this.now());
    void this.db
      .updateTask(task.taskId, {
        status: "failed",
        error_message: task.error,
      })
      .catch(() => undefined);
    return task;
  }

  list(): MCPTask[] {
    const now = this.now();
    const tasks: MCPTask[] = [];
    for (const task of this.byId.values()) {
      if (task.expiresAt > now) tasks.push(task);
    }
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

/** Wire presentation of a task (Task metadata shape). */
export function taskToWire(task: MCPTask): Record<string, unknown> {
  return {
    taskId: task.taskId,
    status: task.status,
    ttl: task.ttl,
    createdAt: task.createdAt.toISOString(),
    lastUpdatedAt: task.lastUpdatedAt.toISOString(),
    pollInterval: task.pollInterval,
    ...(task.statusMessage ? { statusMessage: task.statusMessage } : {}),
  };
}
