import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "knowledge-tester";

describe("Knowledge BFF（查看公开，增删仅 Admin）", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/knowledge/content", {
        body: {
          data: [
            {
              id: "kc-1",
              name: "产品手册",
              description: "内部产品说明",
              type: "text",
              size: 2048,
              status: "completed",
              status_message: "",
              created_at: "2026-07-08T09:00:00Z",
              updated_at: "2026-07-08T09:01:00Z",
            },
          ],
          meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
        },
      })
      .on("/knowledge/content/kc-1/status", {
        body: { id: "kc-1", status: "completed", status_message: "" },
      })
      .on("/knowledge/content/kc-1", { status: 204, body: null });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "admin@example.com", PASSWORD);
    await registerUser(server, "member@example.com", PASSWORD);
    adminCookie = (await login(server, "admin@example.com", PASSWORD)).cookie;
    memberCookie = (await login(server, "member@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("列表所有登录用户可见，字段精简映射", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/knowledge`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0]).toMatchObject({
      id: "kc-1",
      name: "产品手册",
      type: "text",
      status: "completed",
    });
  });

  it("Member 添加内容返回 403", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/knowledge`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: memberCookie },
      body: JSON.stringify({ name: "X", text: "hello" }),
    });
    expect(res.status).toBe(403);
  });

  it("Admin 添加文本内容：以 multipart 转发 name 与 text_content", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/knowledge`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ name: "新文档", description: "备注", text: "知识正文内容" }),
    });
    expect(res.status).toBe(200);
    const upstream = stub.requests.find(
      (r) => r.method === "POST" && r.path === "/knowledge/content",
    )!;
    expect(upstream.headers["content-type"]).toContain("multipart/form-data");
    expect(upstream.body).toContain('name="name"');
    expect(upstream.body).toContain("新文档");
    expect(upstream.body).toContain('name="text_content"');
    expect(upstream.body).toContain("知识正文内容");
  });

  it("Admin 添加 URL 内容：转发 url 字段", async () => {
    await fetch(`${server.baseUrl}/api/os/knowledge`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ name: "官网文档", url: "https://docs.example.com" }),
    });
    const upstream = stub.requests
      .filter((r) => r.method === "POST" && r.path === "/knowledge/content")
      .at(-1)!;
    expect(upstream.body).toContain('name="url"');
    expect(upstream.body).toContain("https://docs.example.com");
  });

  it("状态查询透传", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/knowledge/kc-1/status`, {
      headers: { cookie: memberCookie },
    });
    expect((await res.json()).status).toBe("completed");
  });

  it("删除：Member 403，Admin 生效", async () => {
    const forbidden = await fetch(`${server.baseUrl}/api/os/knowledge/kc-1`, {
      method: "DELETE",
      headers: { cookie: memberCookie },
    });
    expect(forbidden.status).toBe(403);

    const ok = await fetch(`${server.baseUrl}/api/os/knowledge/kc-1`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    expect(ok.status).toBe(200);
    const upstreamDelete = stub.requests.find(
      (r) => r.method === "DELETE" && r.path === "/knowledge/content/kc-1",
    );
    expect(upstreamDelete).toBeDefined();
  });
});
