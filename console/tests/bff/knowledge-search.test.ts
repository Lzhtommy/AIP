import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "knsearch-tester1";

describe("Knowledge 检索 BFF", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let cookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/knowledge/search", {
        body: {
          data: [
            {
              id: "chunk-1",
              content: "AIP 是内部私有化的 AgentOS 控制台。",
              name: "产品手册",
              content_id: "kc-1",
              reranking_score: 0.87,
            },
          ],
          meta: { page: 1, limit: 10, total_pages: 1, total_count: 1 },
        },
      });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "searcher@example.com", PASSWORD);
    cookie = (await login(server, "searcher@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("检索转发 query 并映射结果字段", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/knowledge/search`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ query: "AIP 是什么" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0]).toMatchObject({
      content: "AIP 是内部私有化的 AgentOS 控制台。",
      name: "产品手册",
      contentId: "kc-1",
      score: 0.87,
    });
    const upstream = stub.requests.find((r) => r.path === "/knowledge/search")!;
    expect(upstream.body).toContain("AIP 是什么");
  });

  it("空查询返回 400", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/knowledge/search`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ query: "  " }),
    });
    expect(res.status).toBe(400);
  });
});
