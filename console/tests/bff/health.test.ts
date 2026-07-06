import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { startConsole, type TestServer } from "../helpers/next-server";

const SECURITY_KEY = "test-security-key-do-not-leak";

describe("GET /api/os/health（BFF 健康代理）", () => {
  let stub: AgentOSStub;
  let server: TestServer;

  beforeAll(async () => {
    stub = new AgentOSStub().on("/health", {
      body: { status: "ok", version: "2.1.0" },
    });
    await stub.start();
    server = await startConsole({
      OS_ENDPOINT_URL: stub.url,
      OS_SECURITY_KEY: SECURITY_KEY,
    });
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("runtime 健康时返回 200 与状态", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    // 上游 /health 的完整 payload 透传给前端（状态页显示版本等信息）
    expect(body.runtime).toEqual({ status: "ok", version: "2.1.0" });
  });

  it("以 Bearer Security Key 调用上游，且密钥与 runtime 地址绝不进入响应", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/health`);

    const upstream = stub.requestsFor("/health");
    expect(upstream.length).toBeGreaterThan(0);
    for (const req of upstream) {
      expect(req.headers.authorization).toBe(`Bearer ${SECURITY_KEY}`);
    }

    const rawBody = await res.text();
    expect(rawBody).not.toContain(SECURITY_KEY);
    expect(rawBody).not.toContain(stub.url);
    for (const [name, value] of res.headers.entries()) {
      expect(value, `响应头 ${name} 泄漏敏感信息`).not.toContain(SECURITY_KEY);
      expect(value, `响应头 ${name} 泄漏敏感信息`).not.toContain(stub.url);
    }
  });
});

describe("GET /api/os/health（runtime 不可达）", () => {
  let server: TestServer;
  const deadEndpoint = "http://127.0.0.1:1"; // 无监听端口，连接必然失败

  beforeAll(async () => {
    server = await startConsole({
      OS_ENDPOINT_URL: deadEndpoint,
      OS_SECURITY_KEY: SECURITY_KEY,
    });
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("返回 502 结构化错误，且错误信息不泄漏内网地址", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/health`);
    expect(res.status).toBe(502);
    const rawBody = await res.text();
    const body = JSON.parse(rawBody);
    expect(body.status).toBe("unreachable");
    expect(body.error.code).toBe("ENDPOINT_UNREACHABLE");
    expect(rawBody).not.toContain("127.0.0.1:1");
  });
});
