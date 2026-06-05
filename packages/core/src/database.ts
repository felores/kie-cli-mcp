import sqlite3 from "sqlite3";
import { TaskRecord } from "./types.js";
import { dirname, resolve } from "path";
import { mkdirSync, existsSync } from "fs";
import { homedir } from "os";

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
          error_message TEXT
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_id ON tasks(task_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON tasks(status)`);
    });
  }

  async createTask(
    taskData: Omit<TaskRecord, "id" | "created_at" | "updated_at">,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO tasks (task_id, api_type, status, result_url, error_message) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          taskData.task_id,
          taskData.api_type,
          taskData.status,
          taskData.result_url || null,
          taskData.error_message || null,
        ],
        function (err) {
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

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(taskId);

    if (updateFields.length > 1) {
      return new Promise((resolve, reject) => {
        this.db.run(
          `UPDATE tasks SET ${updateFields.join(", ")} WHERE task_id = ?`,
          values,
          function (err) {
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

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
