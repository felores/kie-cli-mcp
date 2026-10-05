import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@jest/globals";

test("CLI parses nested Wan editing boxes before submitting the provider task", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kie-cli-boxes-"));
  let body: Record<string, unknown> | undefined;
  const provider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    body = JSON.parse(Buffer.concat(chunks).toString());
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ code: 200, data: { taskId: "boxes-task" } }));
  });
  await new Promise<void>((resolve) =>
    provider.listen(0, "127.0.0.1", resolve),
  );
  const port = (provider.address() as AddressInfo).port;
  const boxes = [[[10, 20, 100, 120]]];
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        fileURLToPath(new URL("../../dist/index.js", import.meta.url)),
        "wan_image",
        "--prompt",
        "Replace the marked object",
        "--input_urls",
        "https://example.com/product.png",
        "--bbox_list",
        JSON.stringify(boxes),
        "--n",
        "1",
        "--json",
      ],
      {
        env: {
          ...process.env,
          KIE_AI_API_KEY: "test-key",
          KIE_AI_BASE_URL: `http://127.0.0.1:${port}/api/v1`,
          KIE_AI_DB_PATH: join(directory, "tasks.db"),
          KIE_AI_CALLBACK_URL: "",
        },
        timeout: 10000,
      },
    );
    expect(JSON.parse(stdout)).toMatchObject({
      success: true,
      task_id: "boxes-task",
    });
    expect(body).toMatchObject({
      model: "wan/2-7-image",
      input: {
        input_urls: ["https://example.com/product.png"],
        bbox_list: boxes,
        n: 1,
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      provider.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
