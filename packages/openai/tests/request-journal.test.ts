import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RequestJournal,
  RequestJournalConflictError,
  RequestJournalTransitionError,
  hashRequestId,
} from "../src/request-journal.js";

async function dataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "kie-openai-journal-"));
}

describe("request journal", () => {
  test("exclusively reserves one record for concurrent identical request IDs", async () => {
    const dir = await dataDir();
    const journal = new RequestJournal(dir);
    const claims = await Promise.all(
      Array.from({ length: 12 }, () =>
        journal.reserve({
          requestId: "same-request",
          model: "kie-gpt-image-2",
          count: 2,
        }),
      ),
    );

    expect(claims.filter((claim) => claim.created)).toHaveLength(1);
    expect(new Set(claims.map((claim) => claim.record.requestIdHash)).size).toBe(1);
    expect(claims[0].record.state).toBe("reserved");
    expect(claims[0].record.taskIds).toEqual([null, null]);

    journal.close();
    await rm(dir, { recursive: true, force: true });
  });

  test("serializes updates, rejects stale revisions, and preserves atomic state", async () => {
    const dir = await dataDir();
    const journal = new RequestJournal(dir);
    const reserved = await journal.reserve({
      requestId: "revision-request",
      model: "kie-nano-banana-image",
      count: 1,
    });
    const hash = reserved.record.requestIdHash;
    const submitted = await journal.update(hash, 0, {
      state: "submitted",
      taskIds: ["provider-task"],
    });
    expect(submitted.revision).toBe(1);

    await expect(
      journal.update(hash, 0, { state: "failed" }),
    ).rejects.toBeInstanceOf(RequestJournalConflictError);
    await expect(
      journal.update(hash, 1, { state: "reserved" }),
    ).rejects.toBeInstanceOf(RequestJournalTransitionError);

    const succeeded = await journal.update(hash, 1, {
      state: "succeeded",
      outputs: ["cG5n"],
    });
    expect(succeeded).toMatchObject({
      revision: 2,
      state: "succeeded",
      taskIds: ["provider-task"],
      outputs: ["cG5n"],
    });
    await expect(
      journal.update(hash, 2, { state: "failed" }),
    ).rejects.toBeInstanceOf(RequestJournalTransitionError);

    const files = await readdir(dir);
    expect(files.some((file) => file.endsWith(".tmp"))).toBe(false);
    expect(files).toContain(`${hashRequestId("revision-request")}.json`);

    journal.close();
    await rm(dir, { recursive: true, force: true });
  });

  test("keeps submitted task IDs while concurrent current updates serialize", async () => {
    const dir = await dataDir();
    const journal = new RequestJournal(dir);
    const reserved = await journal.reserve({
      requestId: "fanout-request",
      model: "kie-gpt-image-2",
      count: 2,
    });
    const hash = reserved.record.requestIdHash;
    await Promise.all([
      journal.updateCurrent(hash, (record) => ({
        state: "submitted",
        taskIds: record.taskIds.map((taskId, index) => taskId ?? (index === 0 ? "task-a" : null)),
      })),
      journal.updateCurrent(hash, (record) => ({
        state: "submitted",
        taskIds: record.taskIds.map((taskId, index) => taskId ?? (index === 1 ? "task-b" : null)),
      })),
    ]);
    const submitted = await journal.read(hash);
    expect(submitted?.state).toBe("submitted");
    expect(submitted?.taskIds).toEqual(["task-a", "task-b"]);

    journal.close();
    await rm(dir, { recursive: true, force: true });
  });

  test("rejects idempotency reuse when the request fingerprint changes", async () => {
    const dir = await dataDir();
    const journal = new RequestJournal(dir);
    await journal.reserve({
      requestId: "fingerprinted-request",
      model: "kie-gpt-image-2",
      count: 1,
      fingerprint: "first-request",
    });

    await expect(
      journal.reserve({
        requestId: "fingerprinted-request",
        model: "kie-gpt-image-2",
        count: 1,
        fingerprint: "different-request",
      }),
    ).rejects.toMatchObject({
      name: "RequestJournalConflictError",
      message: "The idempotency key was already used for a different request.",
    });

    journal.close();
    await rm(dir, { recursive: true, force: true });
  });
});
