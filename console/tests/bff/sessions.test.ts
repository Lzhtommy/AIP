import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "sessions-tester1";

describe("Sessions BFF（Member 隔离）", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let memberCookie: string;
  let adminCookie: string;
  let memberId: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub().on("/health", { body: { status: "ok" } });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "admin@example.com", PASSWORD);
    const reg = await registerUser(server, "member@example.com", PASSWORD);
    memberId = (await reg.json()).id;
    adminCookie = (await login(server, "admin@example.com", PASSWORD)).cookie;
    memberCookie = (await login(server, "member@example.com", PASSWORD)).cookie;

    stub.on(`/sessions?type=agent&user_id=${memberId}`, {
      body: {
        data: [
          {
            session_id: "sess-mine",
            session_name: "我的会话",
            created_at: "2026-07-07T10:00:00Z",
            updated_at: "2026-07-07T10:05:00Z",
            session_type: "agent",
            user_id: memberId,
            agent_id: "demo-assistant",
          },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
      },
    });
    stub.on(`/sessions?type=agent`, {
      body: {
        data: [
          { session_id: "sess-mine", user_id: memberId, agent_id: "demo-assistant" },
          { session_id: "sess-other", user_id: "someone-else", agent_id: "demo-assistant" },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 2 },
      },
    });
    stub.on(`/sessions/sess-mine?type=agent&user_id=${memberId}`, {
      body: {
        session_id: "sess-mine",
        session_name: "我的会话",
        user_id: memberId,
        agent_id: "demo-assistant",
        chat_history: [
          { role: "user", content: "算 137*73" },
          { role: "assistant", content: "结果是 10001" },
        ],
      },
    });
    stub.on(`/sessions/sess-mine/runs?type=agent&user_id=${memberId}`, {
      body: [
        {
          run_id: "run-1",
          input: { input_content: "算 137*73" },
          content: "结果是 10001",
          tools: [
            { tool_call_id: "tc1", tool_name: "multiply", tool_args: { a: 137, b: 73 }, result: "10001" },
          ],
        },
      ],
    });
    const otherDetail = {
      session_id: "sess-other",
      session_name: "别人的会话",
      user_id: "someone-else",
      agent_id: "demo-assistant",
      chat_history: [],
    };
    // Member 带 user_id 下推的请求与 Admin 不带的请求分别注册
    stub.on(`/sessions/sess-other?type=agent&user_id=${memberId}`, { body: otherDetail });
    stub.on("/sessions/sess-other?type=agent", { body: otherDetail });
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("Member 列表强制按自己 user_id 过滤（伪造 user 参数无效）", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/sessions?kind=agents&user=someone-else`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      sessionId: "sess-mine",
      name: "我的会话",
      targetId: "demo-assistant",
    });
    // 上游收到的请求必须带 member 自己的 user_id
    const upstream = stub.requests.filter((r) => r.path.startsWith("/sessions?"));
    expect(upstream.at(-1)?.path).toContain(`user_id=${memberId}`);
  });

  it("Admin 列表可看全部用户会话", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/sessions?kind=agents`, {
      headers: { cookie: adminCookie },
    });
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it("会话详情回放：runs 映射为消息（含工具细节）", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/sessions/sess-mine?kind=agents`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("我的会话");
    expect(body.target).toEqual({ kind: "agents", id: "demo-assistant" });
    expect(body.messages).toHaveLength(2);
    const assistant = body.messages[1];
    const tool = assistant.parts.find((p: { type: string }) => p.type === "tool");
    expect(tool).toMatchObject({ name: "multiply", result: "10001", status: "done" });
  });

  it("Member 访问他人会话详情返回 404", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/sessions/sess-other?kind=agents`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(404);
  });

  it("Admin 可访问任意会话详情", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/sessions/sess-other?kind=agents`,
      { headers: { cookie: adminCookie } },
    );
    expect(res.status).toBe(200);
  });
});
