import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

describe("路由守卫（未登录）", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startConsole(consoleEnv());
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("未登录访问页面重定向到 /login", async () => {
    const res = await fetch(server.baseUrl, { redirect: "manual" });
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("未登录访问受保护 API 返回 401 JSON", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/health`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("登录页本身无需认证", async () => {
    const res = await fetch(`${server.baseUrl}/login`, { redirect: "manual" });
    expect(res.status).toBe(200);
  });
});
