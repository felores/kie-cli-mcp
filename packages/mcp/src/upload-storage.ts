import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { open, rename, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  normalizeUploadMimeType,
  type SupportedUploadMimeType,
  type UploadCapability,
  type UploadCapabilityRequest,
  validateUploadBytes,
} from "@felores/kie-ai-core";
import type { Request, Response } from "express";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface TemporaryUploadStoreOptions {
  publicBaseUrl: string;
  storageRoot?: string;
  maxFileBytes?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
  maxOwnerFiles?: number;
  maxOwnerBytes?: number;
  uploadTtlMs?: number;
  downloadTtlMs?: number;
  maxDownloadRequests?: number;
  uploadIdleTimeoutMs?: number;
  uploadMaxDurationMs?: number;
  now?: () => number;
}

interface UploadRecord {
  id: string;
  owner: string;
  filename: string;
  contentType: SupportedUploadMimeType;
  size: number;
  uploadHash: string;
  downloadHash?: string;
  uploadExpiresAt: number;
  storageExpiresAt: number;
  downloadExpiresAt?: number;
  partPath: string;
  finalPath: string;
  state: "pending" | "uploading" | "complete";
  downloadRequests: number;
  egressBytes: number;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

function validatePublicBaseUrl(value: string): URL {
  const url = new URL(value);
  const loopback =
    url.hostname === "127.0.0.1" ||
    url.hostname === "localhost" ||
    url.hostname === "::1";
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  ) {
    throw new Error(
      "KIE_MCP_PUBLIC_BASE_URL must be HTTPS without credentials, query, or fragment.",
    );
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error(
      "KIE_MCP_PUBLIC_BASE_URL must be an origin without a path.",
    );
  }
  url.pathname = "/";
  return url;
}

export class TemporaryUploadStore {
  private readonly baseUrl: URL;
  private readonly rootDirectory: string;
  private readonly directory: string;
  private readonly byUpload = new Map<string, UploadRecord>();
  private readonly byDownload = new Map<string, UploadRecord>();
  private readonly records = new Set<UploadRecord>();
  private readonly maxFileBytes: number;
  private readonly maxFiles: number;
  private readonly maxTotalBytes: number;
  private readonly maxOwnerFiles: number;
  private readonly maxOwnerBytes: number;
  private readonly uploadTtlMs: number;
  private readonly downloadTtlMs: number;
  private readonly maxDownloadRequests: number;
  private readonly uploadIdleTimeoutMs: number;
  private readonly uploadMaxDurationMs: number;
  private readonly now: () => number;
  private readonly cleanupTimer: NodeJS.Timeout;
  private reservedBytes = 0;

  constructor(options: TemporaryUploadStoreOptions) {
    this.baseUrl = validatePublicBaseUrl(options.publicBaseUrl);
    this.maxFileBytes = options.maxFileBytes ?? 25 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 64;
    this.maxTotalBytes = options.maxTotalBytes ?? 500 * 1024 * 1024;
    this.maxOwnerFiles = options.maxOwnerFiles ?? 4;
    this.maxOwnerBytes = options.maxOwnerBytes ?? 100 * 1024 * 1024;
    this.uploadTtlMs = options.uploadTtlMs ?? 10 * 60 * 1000;
    this.downloadTtlMs = options.downloadTtlMs ?? 60 * 60 * 1000;
    this.maxDownloadRequests = options.maxDownloadRequests ?? 32;
    this.uploadIdleTimeoutMs = options.uploadIdleTimeoutMs ?? 30_000;
    this.uploadMaxDurationMs = options.uploadMaxDurationMs ?? 2 * 60_000;
    this.now = options.now ?? Date.now;
    this.rootDirectory = join(
      options.storageRoot ?? tmpdir(),
      "kie-mcp-uploads",
    );
    mkdirSync(this.rootDirectory, { recursive: true, mode: 0o700 });
    this.directory = join(this.rootDirectory, `instance-${randomUUID()}`);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.sweepStaleInstances();
    this.cleanupTimer = setInterval(() => void this.cleanup(), 60_000);
    this.cleanupTimer.unref();
  }

  get publicOrigin(): string {
    return this.baseUrl.origin;
  }

  async createCapability(
    request: UploadCapabilityRequest,
  ): Promise<UploadCapability> {
    await this.cleanup();
    const contentType = normalizeUploadMimeType(request.contentType);
    if (!contentType) throw new Error("Unsupported upload content type.");
    if (!Number.isSafeInteger(request.size) || request.size <= 0) {
      throw new Error("Upload size must be a positive integer.");
    }
    if (request.size > this.maxFileBytes) {
      throw new Error("Upload exceeds the per-file limit.");
    }
    const ownerRecords = [...this.records].filter(
      (record) => record.owner === request.owner,
    );
    const ownerBytes = ownerRecords.reduce(
      (sum, record) => sum + record.size,
      0,
    );
    if (
      ownerRecords.length >= this.maxOwnerFiles ||
      ownerBytes + request.size > this.maxOwnerBytes
    ) {
      throw new Error("Upload owner quota exceeded.");
    }
    if (
      this.records.size >= this.maxFiles ||
      this.reservedBytes + request.size > this.maxTotalBytes
    ) {
      throw new Error("Temporary upload storage capacity exceeded.");
    }

    const id = randomUUID();
    const uploadToken = createToken();
    const now = this.now();
    const record: UploadRecord = {
      id,
      owner: request.owner,
      filename: request.filename,
      contentType,
      size: request.size,
      uploadHash: tokenHash(uploadToken),
      uploadExpiresAt: now + this.uploadTtlMs,
      storageExpiresAt: now + this.downloadTtlMs,
      partPath: join(this.directory, `${id}.part`),
      finalPath: join(this.directory, `${id}.media`),
      state: "pending",
      downloadRequests: 0,
      egressBytes: 0,
    };
    this.records.add(record);
    this.byUpload.set(record.uploadHash, record);
    this.reservedBytes += record.size;

    return {
      uploadUrl: new URL(`upload/${uploadToken}`, this.baseUrl).toString(),
      mediaId: record.id,
      uploadExpiresAt: new Date(record.uploadExpiresAt).toISOString(),
    };
  }

  async createProviderDownload(request: {
    mediaId: string;
    owner: string;
  }): Promise<{
    url: string;
    filename: string;
    contentType: SupportedUploadMimeType;
    size: number;
  }> {
    await this.cleanup();
    const record = [...this.records].find(
      (candidate) =>
        candidate.id === request.mediaId && candidate.owner === request.owner,
    );
    if (
      !record ||
      record.state !== "complete" ||
      record.storageExpiresAt <= this.now()
    ) {
      throw new Error("Media not found or not ready.");
    }
    if (record.downloadHash) this.byDownload.delete(record.downloadHash);
    const token = createToken();
    record.downloadHash = tokenHash(token);
    record.downloadExpiresAt = Math.min(
      this.now() + this.downloadTtlMs,
      record.storageExpiresAt,
    );
    record.downloadRequests = 0;
    record.egressBytes = 0;
    this.byDownload.set(record.downloadHash, record);
    return {
      url: new URL(`media/${token}`, this.baseUrl).toString(),
      filename: record.filename,
      contentType: record.contentType,
      size: record.size,
    };
  }

  async removeMedia(mediaId: string, owner: string): Promise<void> {
    const record = [...this.records].find(
      (candidate) => candidate.id === mediaId && candidate.owner === owner,
    );
    if (record) await this.removeRecord(record);
  }

  async handleUpload(
    req: Request,
    res: Response,
    token: string,
  ): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) {
      res.status(404).end();
      return;
    }
    const hash = tokenHash(token);
    const record = this.byUpload.get(hash);
    if (
      !record ||
      record.state !== "pending" ||
      record.uploadExpiresAt <= this.now()
    ) {
      res.status(404).end();
      return;
    }
    const declaredLength = Number(req.headers["content-length"]);
    if (Number.isFinite(declaredLength) && declaredLength !== record.size) {
      res
        .status(413)
        .json({ error: "Upload byte count does not match the capability." });
      return;
    }
    const requestType = normalizeUploadMimeType(
      String(req.headers["content-type"] ?? ""),
    );
    if (!requestType || requestType !== record.contentType) {
      res
        .status(415)
        .json({ error: "Content-Type does not match the capability." });
      return;
    }

    this.byUpload.delete(hash);
    record.state = "uploading";
    let timedOut = false;
    req.setTimeout(this.uploadIdleTimeoutMs, () => {
      timedOut = true;
      req.destroy(new Error("Upload inactivity timeout."));
    });
    const absoluteTimeout = setTimeout(() => {
      timedOut = true;
      req.destroy(new Error("Upload duration timeout."));
    }, this.uploadMaxDurationMs);
    absoluteTimeout.unref();
    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > record.size) {
          callback(new Error("Upload exceeded the declared byte count."));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        req,
        limiter,
        createWriteStream(record.partPath, { flags: "wx", mode: 0o600 }),
      );
      if (received !== record.size) {
        throw new Error("Upload ended before the declared byte count.");
      }
      const handle = await open(record.partPath, "r");
      try {
        const head = Buffer.alloc(Math.min(64, record.size));
        const { bytesRead } = await handle.read(head, 0, head.length, 0);
        validateUploadBytes(head.subarray(0, bytesRead), record.contentType);
      } finally {
        await handle.close();
      }
      await rename(record.partPath, record.finalPath);
      record.state = "complete";
      res.status(201).json({
        success: true,
        media_id: record.id,
        expires_at: new Date(record.storageExpiresAt).toISOString(),
      });
    } catch {
      await this.removeRecord(record);
      if (!res.headersSent) {
        res.status(timedOut ? 408 : received > record.size ? 413 : 400).json({
          error: "Upload failed validation or did not complete.",
        });
      }
    } finally {
      clearTimeout(absoluteTimeout);
      req.setTimeout(0);
    }
  }

  async handleDownload(
    req: Request,
    res: Response,
    token: string,
  ): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) {
      res.status(404).end();
      return;
    }
    const record = this.byDownload.get(tokenHash(token));
    const isHead = req.method === "HEAD";
    if (
      !record ||
      record.state !== "complete" ||
      !record.downloadExpiresAt ||
      record.downloadExpiresAt <= this.now() ||
      record.downloadRequests >= this.maxDownloadRequests ||
      (!isHead && record.egressBytes + record.size > record.size * 4)
    ) {
      res.status(404).end();
      return;
    }

    record.downloadRequests += 1;
    if (!isHead) record.egressBytes += record.size;
    res.setHeader("Content-Type", record.contentType);
    res.setHeader("Content-Length", String(record.size));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(record.filename)}`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (isHead) {
      res.status(200).end();
      return;
    }
    createReadStream(record.finalPath)
      .on("error", () => {
        if (!res.headersSent) res.status(404).end();
        else res.destroy();
      })
      .pipe(res);
  }

  async cleanup(): Promise<void> {
    this.sweepStaleInstances();
    const now = this.now();
    await Promise.all(
      [...this.records]
        .filter(
          (record) =>
            record.storageExpiresAt <= now ||
            (record.state !== "complete" && record.uploadExpiresAt <= now),
        )
        .map((record) => this.removeRecord(record)),
    );
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupTimer);
    await rm(this.directory, { recursive: true, force: true });
    this.byUpload.clear();
    this.byDownload.clear();
    this.records.clear();
    this.reservedBytes = 0;
  }

  private async removeRecord(record: UploadRecord): Promise<void> {
    if (!this.records.delete(record)) return;
    this.byUpload.delete(record.uploadHash);
    if (record.downloadHash) this.byDownload.delete(record.downloadHash);
    this.reservedBytes -= record.size;
    await Promise.all([
      unlink(record.partPath).catch(() => undefined),
      unlink(record.finalPath).catch(() => undefined),
    ]);
  }

  private sweepStaleInstances(): void {
    for (const entry of readdirSync(this.rootDirectory)) {
      const candidate = join(this.rootDirectory, entry);
      if (candidate === this.directory) continue;
      try {
        if (
          entry.startsWith("instance-") &&
          statSync(candidate).mtimeMs < this.now() - this.downloadTtlMs
        ) {
          rmSync(candidate, { recursive: true, force: true });
        }
      } catch {
        // Another process may be cleaning the same stale instance.
      }
    }
  }
}
