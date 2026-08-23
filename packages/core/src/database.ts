import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, resolve } from "path";
import sqlite3 from "sqlite3";
import type { PreparedGenerationPlan } from "./generation-plan.js";
import type { TaskRecord } from "./types.js";

export class TaskDatabase {
  private db: sqlite3.Database;

  constructor(dbPath?: string) {
    // Determine the actual database path
    const actualDbPath = this.resolveDbPath(dbPath);

    // Create directory if it doesn't exist
    const dir = dirname(actualDbPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(`Failed to create database directory ${dir}:`, err);
      throw new Error(`Cannot create database directory: ${dir}`);
    }

    this.db = new sqlite3.Database(actualDbPath);
    this.initializeDatabase();
  }

  private resolveDbPath(dbPath?: string): string {
    // If custom path provided via KIE_AI_DB_PATH, use it
    if (dbPath) {
      return resolve(dbPath);
    }

    // Default: use home directory for reliability with npx
    const homeDir = homedir();
    return resolve(homeDir, ".kie-ai", "tasks.db");
  }

  private initializeDatabase(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT UNIQUE NOT NULL,
          api_type TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          result_url TEXT,
          error_message TEXT,
          credits_consumed REAL
        )
      `);

      this.db.run(
        `ALTER TABLE tasks ADD COLUMN credits_consumed REAL`,
        (err) => {
          // Existing databases already have this column after the first migration.
          if (err && !err.message.includes("duplicate column name")) {
            console.error("Failed to add tasks.credits_consumed:", err);
          }
        },
      );

      this.db.run(`
        CREATE TABLE IF NOT EXISTS generation_plans (
          plan_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          plan_json TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          approval_context TEXT NOT NULL,
          submitted_at TEXT,
          task_results_json TEXT
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_id ON tasks(task_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON tasks(status)`);
      this.db.run(
        `CREATE INDEX IF NOT EXISTS idx_generation_plans_status ON generation_plans(status)`,
      );

      this.db.run(
        `ALTER TABLE generation_plans ADD COLUMN approval_context TEXT`,
        (err) => {
          // Existing databases already have this column after the first migration.
          if (err && !err.message.includes("duplicate column name")) {
            console.error(
              "Failed to add generation_plans.approval_context:",
              err,
            );
          }
        },
      );
    });
  }

  async createTask(
    taskData: Omit<TaskRecord, "id" | "created_at" | "updated_at">,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO tasks (task_id, api_type, status, result_url, error_message, credits_consumed)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          taskData.task_id,
          taskData.api_type,
          taskData.status,
          taskData.result_url || null,
          taskData.error_message || null,
          taskData.credits_consumed ?? null,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  async getTask(taskId: string): Promise<TaskRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM tasks WHERE task_id = ?`,
        [taskId],
        (err, row) => {
          if (err) reject(err);
          else resolve((row as TaskRecord) || null);
        },
      );
    });
  }

  async updateTask(
    taskId: string,
    updates: Partial<TaskRecord>,
  ): Promise<void> {
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      updateFields.push("status = ?");
      values.push(updates.status);
    }

    if (updates.result_url) {
      updateFields.push("result_url = ?");
      values.push(updates.result_url);
    }

    if (updates.error_message) {
      updateFields.push("error_message = ?");
      values.push(updates.error_message);
    }

    if (updates.credits_consumed !== undefined) {
      updateFields.push("credits_consumed = ?");
      values.push(updates.credits_consumed);
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(taskId);

    if (updateFields.length > 1) {
      return new Promise((resolve, reject) => {
        this.db.run(
          `UPDATE tasks SET ${updateFields.join(", ")} WHERE task_id = ?`,
          values,
          (err) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });
    }
  }

  async getAllTasks(limit: number = 100): Promise<TaskRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as TaskRecord[]);
        },
      );
    });
  }

  async getTasksByStatus(
    status: string,
    limit: number = 50,
  ): Promise<TaskRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
        [status, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as TaskRecord[]);
        },
      );
    });
  }

  async createGenerationPlan(
    plan: PreparedGenerationPlan,
    approvalContext: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO generation_plans (plan_id, status, created_at, expires_at, plan_json, request_hash, approval_context)
         VALUES (?, 'prepared', ?, ?, ?, ?, ?)`,
        [
          plan.id,
          plan.createdAt,
          plan.expiresAt,
          JSON.stringify(plan),
          plan.requestHash,
          approvalContext,
        ],
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  async getGenerationPlan(planId: string): Promise<{
    plan: PreparedGenerationPlan;
    status: string;
    requestHash: string;
    results?: unknown;
  } | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT status, plan_json, request_hash, task_results_json FROM generation_plans WHERE plan_id = ?`,
        [planId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          const stored = row as {
            status: string;
            plan_json: string;
            request_hash: string;
            task_results_json: string | null;
          };
          try {
            resolve({
              plan: JSON.parse(stored.plan_json) as PreparedGenerationPlan,
              status: stored.status,
              requestHash: stored.request_hash,
              ...(stored.task_results_json
                ? { results: JSON.parse(stored.task_results_json) as unknown }
                : {}),
            });
          } catch (parseError) {
            reject(parseError);
          }
        },
      );
    });
  }

  /** Atomically records approval for an unchanged, unexpired prepared plan. */
  async approveGenerationPlan(
    planId: string,
    requestHash: string,
    approvalContext: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE generation_plans
         SET status = 'approved'
          WHERE plan_id = ? AND request_hash = ? AND approval_context = ? AND status = 'prepared' AND expires_at > ?`,
        [planId, requestHash, approvalContext, new Date().toISOString()],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes === 1);
        },
      );
    });
  }

  /** Atomically consumes an approved plan before any provider call can start. */
  async claimGenerationPlan(
    planId: string,
    requestHash: string,
    approvalContext: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE generation_plans
         SET status = 'submitting', submitted_at = CURRENT_TIMESTAMP
          WHERE plan_id = ? AND request_hash = ? AND approval_context = ? AND status = 'approved' AND expires_at > ?`,
        [planId, requestHash, approvalContext, new Date().toISOString()],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes === 1);
        },
      );
    });
  }

  async finishGenerationPlan(planId: string, results: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE generation_plans SET status = 'submitted', task_results_json = ? WHERE plan_id = ? AND status = 'submitting'`,
        [JSON.stringify(results), planId],
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  /** A claimed plan is terminal after any provider result to prevent duplicate paid creates. */
  async failGenerationPlan(planId: string, results: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE generation_plans SET status = 'failed', task_results_json = ? WHERE plan_id = ? AND status = 'submitting'`,
        [JSON.stringify(results), planId],
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
