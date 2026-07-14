import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { link, open, readFile, rename, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

export type JournalState = "reserved" | "submitted" | "succeeded" | "failed";

export interface JournalError {
  status: number;
  code: string;
  message: string;
  param: string | null;
}

export interface RequestJournalRecord {
  version: 1;
  requestIdHash: string;
  model: string;
  count: number;
  state: JournalState;
  revision: number;
  taskIds: Array<string | null>;
  outputs?: string[];
  error?: JournalError;
  created: number;
  createdAt: string;
  updatedAt: string;
  fingerprint?: string;
  resultUrl?: string;
  resultContentType?: string;
  callbackToken?: string;
}

export type RequestJournalPatch = Partial<
  Pick<
    RequestJournalRecord,
    | "state"
    | "taskIds"
    | "outputs"
    | "error"
    | "fingerprint"
    | "resultUrl"
    | "resultContentType"
    | "callbackToken"
  >
>;

export class RequestJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestJournalError";
  }
}

export class RequestJournalConflictError extends RequestJournalError {
  constructor(message = "The request journal revision is stale.") {
    super(message);
    this.name = "RequestJournalConflictError";
  }
}

export class RequestJournalTransitionError extends RequestJournalError {
  constructor(message = "The request journal state transition is invalid.") {
    super(message);
    this.name = "RequestJournalTransitionError";
  }
}

type WriterLock = { fd: number; references: number };
const processLocks = new Map<string, WriterLock>();
const processQueues = new Map<string, Promise<void>>();

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function readLockPid(lockPath: string): number | null {
  try {
    const match = readFileSync(lockPath, "utf8").match(/^(\d+)\s*$/m);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function acquireWriterLock(dataDir: string): WriterLock {
  const existing = processLocks.get(dataDir);
  if (existing) {
    existing.references += 1;
    return existing;
  }

  mkdirSync(dataDir, { recursive: true });
  const lockPath = join(dataDir, ".writer.lock");
  let fd: number;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const pid = readLockPid(lockPath);
    if (pid !== null && isProcessAlive(pid)) {
      throw new RequestJournalError(
        "The KIE OpenAI data directory is already in use.",
      );
    }
    unlinkSync(lockPath);
    fd = openSync(lockPath, "wx", 0o600);
  }

  writeSync(fd, `${process.pid}\n`);
  fsyncSync(fd);
  const lock = { fd, references: 1 };
  processLocks.set(dataDir, lock);
  return lock;
}

function releaseWriterLock(dataDir: string, lock: WriterLock): void {
  lock.references -= 1;
  if (lock.references > 0) return;
  processLocks.delete(dataDir);
  closeSync(lock.fd);
  try {
    unlinkSync(join(dataDir, ".writer.lock"));
  } catch {
    // The lock may have been removed by a shutdown hook or stale-lock repair.
  }
}

export function hashRequestId(requestId: string): string {
  return createHash("sha256").update(requestId).digest("hex");
}

export function defaultOpenAiDataDir(): string {
  return resolve(process.env.KIE_OPENAI_DATA_DIR ?? ".kie-openai");
}

function isJournalState(value: unknown): value is JournalState {
  return (
    value === "reserved" ||
    value === "submitted" ||
    value === "succeeded" ||
    value === "failed"
  );
}

function validateRecord(value: unknown, expectedHash: string): RequestJournalRecord {
  if (typeof value !== "object" || value === null) {
    throw new RequestJournalError("The request journal record is invalid.");
  }
  const record = value as Partial<RequestJournalRecord>;
  if (
    record.version !== 1 ||
    record.requestIdHash !== expectedHash ||
    typeof record.model !== "string" ||
    typeof record.count !== "number" ||
    !Number.isInteger(record.count) ||
    record.count < 1 ||
    record.count > 15 ||
    !isJournalState(record.state) ||
    typeof record.revision !== "number" ||
    !Number.isInteger(record.revision) ||
    record.revision < 0 ||
    !Array.isArray(record.taskIds) ||
    record.taskIds.length !== record.count ||
    !record.taskIds.every((taskId) => taskId === null || typeof taskId === "string") ||
    typeof record.created !== "number" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new RequestJournalError("The request journal record is invalid.");
  }
  if (record.outputs && (!Array.isArray(record.outputs) || !record.outputs.every((output) => typeof output === "string"))) {
    throw new RequestJournalError("The request journal record is invalid.");
  }
  return record as RequestJournalRecord;
}

function transitionAllowed(from: JournalState, to: JournalState): boolean {
  if (from === to) return true;
  return (
    (from === "reserved" && (to === "submitted" || to === "failed")) ||
    (from === "submitted" && (to === "succeeded" || to === "failed"))
  );
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "EEXIST";
}

async function syncDirectory(dataDir: string): Promise<void> {
  const handle = await open(dataDir, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export class RequestJournal {
  readonly dataDir: string;
  private readonly lock: WriterLock;
  private closed = false;

  constructor(dataDir = defaultOpenAiDataDir()) {
    this.dataDir = resolve(dataDir);
    this.lock = acquireWriterLock(this.dataDir);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    releaseWriterLock(this.dataDir, this.lock);
  }

  recordPath(requestIdHash: string): string {
    return join(this.dataDir, `${requestIdHash}.json`);
  }

  async read(requestIdHash: string): Promise<RequestJournalRecord | null> {
    try {
      const raw = await readFile(this.recordPath(requestIdHash), "utf8");
      return validateRecord(JSON.parse(raw) as unknown, requestIdHash);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError) {
        throw new RequestJournalError("The request journal record is invalid.");
      }
      throw error;
    }
  }

  async reserve(input: {
    requestId: string;
    model: string;
    count: number;
    fingerprint?: string;
    callbackToken?: string;
  }): Promise<{ created: boolean; record: RequestJournalRecord }> {
    const requestIdHash = hashRequestId(input.requestId);
    return this.serialize(requestIdHash, async () => {
      const existing = await this.read(requestIdHash);
      if (existing) {
        if (
          input.fingerprint !== undefined &&
          (existing.fingerprint !== input.fingerprint ||
            existing.model !== input.model ||
            existing.count !== input.count)
        ) {
          throw new RequestJournalConflictError(
            "The idempotency key was already used for a different request.",
          );
        }
        return { created: false, record: existing };
      }

      const now = new Date().toISOString();
      const record: RequestJournalRecord = {
        version: 1,
        requestIdHash,
        model: input.model,
        count: input.count,
        state: "reserved",
        revision: 0,
        taskIds: Array.from({ length: input.count }, () => null),
        created: Math.floor(Date.now() / 1000),
        createdAt: now,
        updatedAt: now,
        ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
        ...(input.callbackToken ? { callbackToken: input.callbackToken } : {}),
      };

      try {
        await this.writeExclusive(record);
        return { created: true, record };
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        const claimed = await this.read(requestIdHash);
        if (!claimed) throw new RequestJournalError("The request journal claim is unavailable.");
        return { created: false, record: claimed };
      }
    });
  }

  async update(
    requestIdHash: string,
    expectedRevision: number,
    patch: RequestJournalPatch,
  ): Promise<RequestJournalRecord> {
    return this.serialize(requestIdHash, async () => {
      const current = await this.require(requestIdHash);
      return this.updateRecord(current, expectedRevision, patch);
    });
  }

  async updateCurrent(
    requestIdHash: string,
    patchOrFactory:
      | RequestJournalPatch
      | ((record: RequestJournalRecord) =>
          | RequestJournalPatch
          | Promise<RequestJournalPatch>),
  ): Promise<RequestJournalRecord> {
    return this.serialize(requestIdHash, async () => {
      const current = await this.require(requestIdHash);
      const patch =
        typeof patchOrFactory === "function"
          ? await patchOrFactory(current)
          : patchOrFactory;
      return this.updateRecord(current, current.revision, patch);
    });
  }

  private async require(requestIdHash: string): Promise<RequestJournalRecord> {
    const record = await this.read(requestIdHash);
    if (!record) throw new RequestJournalError("The request journal record does not exist.");
    return record;
  }

  private async updateRecord(
    current: RequestJournalRecord,
    expectedRevision: number,
    patch: RequestJournalPatch,
  ): Promise<RequestJournalRecord> {
    if (current.revision !== expectedRevision) {
      throw new RequestJournalConflictError();
    }
    const nextState = patch.state ?? current.state;
    if (!transitionAllowed(current.state, nextState)) {
      throw new RequestJournalTransitionError(
        `Cannot transition request journal from ${current.state} to ${nextState}.`,
      );
    }
    const next: RequestJournalRecord = {
      ...current,
      ...patch,
      state: nextState,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      taskIds: [...(patch.taskIds ?? current.taskIds)],
      ...(patch.outputs !== undefined
        ? { outputs: [...patch.outputs] }
        : current.outputs
          ? { outputs: [...current.outputs] }
          : {}),
    };
    await this.writeAtomic(next);
    return next;
  }

  private async writeExclusive(record: RequestJournalRecord): Promise<void> {
    const temporary = join(
      this.dataDir,
      `.${record.requestIdHash}.${randomUUID()}.claim.tmp`,
    );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
      await link(temporary, this.recordPath(record.requestIdHash));
      await syncDirectory(this.dataDir);
    } finally {
      await handle.close();
      await unlink(temporary).catch(() => undefined);
    }
  }

  private async writeAtomic(record: RequestJournalRecord): Promise<void> {
    const destination = this.recordPath(record.requestIdHash);
    const temporary = join(
      this.dataDir,
      `.${record.requestIdHash}.${randomUUID()}.tmp`,
    );
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, destination);
      await syncDirectory(this.dataDir);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  private async serialize<T>(
    requestIdHash: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const queueKey = `${this.dataDir}:${requestIdHash}`;
    const previous = processQueues.get(queueKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    const chain = previous.then(() => current);
    processQueues.set(queueKey, chain);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (processQueues.get(queueKey) === chain) {
        processQueues.delete(queueKey);
      }
    }
  }
}
