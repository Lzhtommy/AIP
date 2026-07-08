import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "memories-tester1";

describe("Memories BFF（Member 隔离）", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let adminCookie: string;
  let memberCookie: string;
  let memberId: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub().on("/health", { body: { status: "ok" } });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "admin@example.com", PASSWORD);
    const m = await registerUser(server, "member@example.com", PASSWORD);
    memberId = (await m.json()).id;
    adminCookie = (await login(server, "admin@example.com", PASSWORD)).cookie;
    memberCookie = (await login(server, "member@example.com", PASSWORD)).cookie;

    stub.on(`/memories?user_id=${memberId}`, {
      body: {
        data: [
          {
            memory_id: "mem-mine",
            memory: "用户偏好 Python",
            topics: ["preferences"],
            agent_id: "demo-assistant",
            team_id: null,
            user_id: memberId,
            updated_at: "2026-07-08T10:00:00Z",
          },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
      },
    });
    stub.on(`/memories?user_id=${memberId}&search_content=Python&topics=preferences`, {
      body: {
        data: [
          {
            memory_id: "mem-mine",
            memory: "用户偏好 Python",
            topics: ["preferences"],
            user_id: memberId,
            updated_at: "2026-07-08T10:00:00Z",
          },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
      },
    });
    stub.on("/memories", {
      body: {
        data: [
          { memory_id: "mem-mine", memory: "用户偏好 Python", user_id: memberId },
          { memory_id: "mem-other", memory: "别人的记忆", user_id: "someone-else" },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 2 },
      },
    });
    stub.on("/memories/mem-mine", {
      body: {
        memory_id: "mem-mine",
        memory: "用户偏好 Python",
        topics: ["preferences"],
        user_id: memberId,
      },
    });
    stub.on(`/memories/mem-mine?user_id=${memberId}`, { status: 204, body: null });
    stub.on("/memories/mem-other", {
      body: { memory_id: "mem-other", memory: "别人的记忆", user_id: "someone-else" },
    });
    stub.on("/memory_topics", { body: ["preferences", "facts"] });
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("Member 列表强制按自己 user_id 过滤（伪造 user 参数无效）", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/memories?user=someone-else`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      memoryId: "mem-mine",
      memory: "用户偏好 Python",
      topics: ["preferences"],
      targetId: "demo-assistant",
    });
    const upstream = stub.requests.filter((r) => r.path.startsWith("/memories?"));
    expect(upstream.at(-1)?.path).toContain(`user_id=${memberId}`);
  });

  it("搜索与 topic 筛选参数透传", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/memories?search=Python&topic=preferences`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  it("Admin 列表可见全部用户记忆", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/memories`, {
      headers: { cookie: adminCookie },
    });
    expect((await res.json()).data).toHaveLength(2);
  });

  it("topics 列表透传", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/memories/topics`, {
      headers: { cookie: memberCookie },
    });
    expect(await res.json()).toEqual(["preferences", "facts"]);
  });

  it("Member 删除自己的记忆生效，删除他人的 404", async () => {
    const own = await fetch(`${server.baseUrl}/api/os/memories/mem-mine`, {
      method: "DELETE",
      headers: { cookie: memberCookie },
    });
    expect(own.status).toBe(200);
    const upstreamDelete = stub.requests.find(
      (r) => r.method === "DELETE" && r.path.startsWith("/memories/mem-mine"),
    );
    expect(upstreamDelete?.path).toContain(`user_id=${memberId}`);

    const other = await fetch(`${server.baseUrl}/api/os/memories/mem-other`, {
      method: "DELETE",
      headers: { cookie: memberCookie },
    });
    expect(other.status).toBe(404);
  });
});
