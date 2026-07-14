import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import {
  createServer,
  request,
  type IncomingMessage,
  type Server,
} from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { createKieOpenAiRouter } from "../src/http-server.js";
import {
  createKieOpenAiStandaloneApp,
  startKieOpenAiStandaloneServer,
} from "../src/standalone.js";

const servers: Server[] = [];

async function serve(app: express.Express): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  const close = (app as express.Express & { close?: () => void }).close;
  if (close) server.once("close", close);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function rawRequest(
  url: string,
  headers: Record<string, string>,
  method = "GET",
  body?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const pending = request(url, { headers, method });
  if (body) pending.write(body);
  pending.end();
  const [response] = (await once(pending, "response")) as [IncomingMessage];
  response.setEncoding("utf8");
  let rawBody = "";
  for await (const chunk of response) rawBody += chunk;
  return {
    status: response.statusCode ?? 0,
    body: JSON.parse(rawBody) as Record<string, unknown>,
  };
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.close();
    await once(server, "close");
  }
});

describe("standalone security boundary", () => {
  test("requires a configured standalone token", () => {
    expect(() =>
      createKieOpenAiStandaloneApp({ token: "", apiKey: "provider-secret" }),
    ).toThrow("KIE_OPENAI_TOKEN is required");
  });

  test("refuses non-loopback listener hosts", () => {
    expect(() =>
      createKieOpenAiStandaloneApp({
        token: "local-token",
        apiKey: "provider-secret",
        host: "0.0.0.0",
      }),
    ).toThrow("Standalone host must be loopback");
  });

  test("protects health and exposes only readiness and versions", async () => {
    const baseUrl = await serve(
      createKieOpenAiStandaloneApp({
        token: "local-token",
        apiKey: "provider-secret",
        baseUrl: "https://provider-secret.example/v1",
        dataDir: "/private/provider-secret",
        packageVersion: "9.8.7",
        contractVersion: "test-contract",
      }),
    );

    const missing = await fetch(`${baseUrl}/health`);
    expect(missing.status).toBe(401);
    expect(await responseJson(missing)).toEqual({
      error: {
        message: "A valid local bearer token is required.",
        type: "authentication_error",
        param: null,
        code: "invalid_local_token",
      },
    });

    const wrong = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(wrong.status).toBe(401);

    const ready = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: "Bearer local-token" },
    });
    expect(ready.status).toBe(200);
    const body = await responseJson(ready);
    expect(body).toEqual({
      ready: false,
      contract_version: "test-contract",
      package_version: "9.8.7",
    });
    expect(JSON.stringify(body)).not.toContain("provider-secret");
    expect(JSON.stringify(body)).not.toContain("local-token");
  });

  test("rejects disallowed Host and Origin headers", async () => {
    const baseUrl = await serve(
      createKieOpenAiStandaloneApp({
        token: "local-token",
        apiKey: "provider-secret",
      }),
    );

    const disallowedHost = await rawRequest(`${baseUrl}/health`, {
      Authorization: "Bearer local-token",
      Host: "attacker.example",
    });
    expect(disallowedHost.status).toBe(421);
    expect(disallowedHost.body.error).toMatchObject({
      code: "host_not_allowed",
    });

    const disallowedOrigin = await fetch(`${baseUrl}/health`, {
      headers: {
        Authorization: "Bearer local-token",
        Origin: "https://attacker.example",
      },
    });
    expect(disallowedOrigin.status).toBe(403);
    expect((await responseJson(disallowedOrigin)).error).toMatchObject({
      code: "origin_not_allowed",
    });
  });

  test("rejects oversized JSON and multipart bodies before routing", async () => {
    const baseUrl = await serve(
      createKieOpenAiStandaloneApp({
        token: "local-token",
        apiKey: "provider-secret",
        jsonLimitBytes: 32,
        multipartLimitBytes: 32,
      }),
    );
    const headers = { Authorization: "Bearer local-token" };

    const jsonResponse = await fetch(`${baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "x".repeat(64) }),
    });
    expect(jsonResponse.status).toBe(413);
    expect((await responseJson(jsonResponse)).error).toMatchObject({
      code: "request_too_large",
    });

    const multipartResponse = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "multipart/form-data; boundary=test-boundary",
      },
      body: `--test-boundary\r\n${"x".repeat(64)}\r\n--test-boundary--`,
    });
    expect(multipartResponse.status).toBe(413);
    expect((await responseJson(multipartResponse)).error).toMatchObject({
      code: "request_too_large",
    });

    const chunkedMultipart = await rawRequest(
      `${baseUrl}/v1/images/edits`,
      {
        ...headers,
        "Content-Type": "multipart/form-data; boundary=test-boundary",
        "Transfer-Encoding": "chunked",
      },
      "POST",
      "--test-boundary\r\nsmall\r\n--test-boundary--",
    );
    expect(chunkedMultipart.status).toBe(411);
    expect(chunkedMultipart.body.error).toMatchObject({
      code: "content_length_required",
    });
  });
});

describe("embedded router contract", () => {
  test("delegates authorization and never reads a standalone token", async () => {
    const originalToken = process.env.KIE_OPENAI_TOKEN;
    process.env.KIE_OPENAI_TOKEN = "must-not-be-read";
    const router = createKieOpenAiRouter({ apiKey: "provider-secret" });
    const app = express().use(
      "/kie",
      router,
    );

    try {
      const baseUrl = await serve(app);
      const response = await fetch(`${baseUrl}/kie/health`);
      expect(response.status).toBe(200);
      expect(await responseJson(response)).toMatchObject({ ready: true });
    } finally {
      router.close();
      if (originalToken === undefined) delete process.env.KIE_OPENAI_TOKEN;
      else process.env.KIE_OPENAI_TOKEN = originalToken;
    }
  });

  test("rejects client credentials and remote output URLs", async () => {
    const router = createKieOpenAiRouter({ apiKey: "provider-secret" });
    const app = express().use(
      "/kie",
      router,
    );
    const baseUrl = await serve(app);

    try {
      const credentials = await fetch(`${baseUrl}/kie/v1/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hello", api_key: "client-secret" }),
      });
      expect(credentials.status).toBe(422);
      expect((await responseJson(credentials)).error).toMatchObject({
        code: "client_credentials_forbidden",
        param: "api_key",
      });

      const callback = await fetch(`${baseUrl}/kie/v1/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "hello",
          callbackUrl: "https://attacker.example/result",
        }),
      });
      expect(callback.status).toBe(422);
      expect((await responseJson(callback)).error).toMatchObject({
        code: "remote_output_url_forbidden",
        param: "callbackUrl",
      });
    } finally {
      router.close();
    }
  });

  test("normalizes body-parser client failures without returning 500", async () => {
    const app = express().use("/kie", createKieOpenAiRouter({}));
    const baseUrl = await serve(app);
    const response = await fetch(`${baseUrl}/kie/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "unsupported",
      },
      body: JSON.stringify({ prompt: "hello" }),
    });

    expect(response.status).toBe(415);
    expect((await responseJson(response)).error).toMatchObject({
      code: "unsupported_content_encoding",
    });
  });

  test("closes the router journal when the standalone listener closes", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kie-openai-standalone-"));
    const probe = createServer().listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = (probe.address() as AddressInfo).port;
    probe.close();
    await once(probe, "close");

    const server = startKieOpenAiStandaloneServer({
      token: "local-token",
      apiKey: "provider-secret",
      dataDir,
      port,
    });
    await once(server, "listening");
    expect(await readdir(dataDir)).toContain(".writer.lock");

    server.close();
    await once(server, "close");
    expect(await readdir(dataDir)).not.toContain(".writer.lock");
    await rm(dataDir, { recursive: true, force: true });
  });

  test("normalizes unknown routes as OpenAI errors", async () => {
    const app = express().use("/kie", createKieOpenAiRouter({}));
    const baseUrl = await serve(app);
    const response = await fetch(`${baseUrl}/kie/v1/unknown`);

    expect(response.status).toBe(404);
    expect(await responseJson(response)).toEqual({
      error: {
        message: "The requested KIE OpenAI transport route does not exist.",
        type: "invalid_request_error",
        param: null,
        code: "route_not_found",
      },
    });
  });
});
