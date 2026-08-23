import { describe, expect, test } from "@jest/globals";
import { validateHttpTransportSecurity } from "../http-transport.js";

describe("HTTP transport security", () => {
  test("requires both host allowlisting and bearer authentication off loopback", () => {
    expect(() =>
      validateHttpTransportSecurity({
        host: "0.0.0.0",
        token: "",
        allowedHosts: [],
      }),
    ).toThrow(/MCP_ALLOWED_HOSTS and KIE_MCP_HTTP_TOKEN are required/);
    expect(() =>
      validateHttpTransportSecurity({
        host: "0.0.0.0",
        token: "secret",
        allowedHosts: [],
      }),
    ).toThrow(/MCP_ALLOWED_HOSTS is required/);
    expect(() =>
      validateHttpTransportSecurity({
        host: "0.0.0.0",
        token: "",
        allowedHosts: ["mcp.example.com"],
      }),
    ).toThrow(/KIE_MCP_HTTP_TOKEN is required/);
    expect(() =>
      validateHttpTransportSecurity({
        host: "0.0.0.0",
        token: "secret",
        allowedHosts: ["mcp.example.com"],
      }),
    ).not.toThrow();
  });

  test("permits loopback hosts without remote deployment credentials", () => {
    expect(() =>
      validateHttpTransportSecurity({
        host: "127.0.0.1",
        token: "",
        allowedHosts: [],
      }),
    ).not.toThrow();
  });

  test("requires full browser and MCP boundaries when uploads are enabled", () => {
    expect(() =>
      validateHttpTransportSecurity({
        host: "127.0.0.1",
        token: "",
        allowedHosts: [],
        uploadEnabled: true,
      }),
    ).toThrow(
      /MCP_ALLOWED_HOSTS and KIE_MCP_HTTP_TOKEN and MCP_ALLOWED_ORIGINS and MCP_UPLOAD_ALLOWED_ORIGINS are required/,
    );
    expect(() =>
      validateHttpTransportSecurity({
        host: "127.0.0.1",
        token: "secret",
        allowedHosts: ["127.0.0.1"],
        allowedOrigins: ["https://host.example"],
        uploadAllowedOrigins: ["https://sandbox.example"],
        uploadEnabled: true,
      }),
    ).not.toThrow();
  });
});
