import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "traces-tester-pw";

const TREE = {
  id: "node-root",
  name: "Demo Assistant.run",
  type: "agent_run",
  duration: 1200,
  status: "error",
  input: "算 137*73",
  output: null,
  error: null,
  spans: [
    {
      id: "node-llm",
      name: "OpenAIChat.invoke",
      type: "model_call",
      duration: 800,
      status: "ok",
      spans: [],
      metadata: { input_tokens: 120, output_tokens: 45 },
    },
    {
      id: "node-tool",
      name: "multiply",
      type: "tool_call",
      duration: 30,
      status: "error",
      error: "除零错误",
      spans: [],
    },
  ],
};

describe("Traces BFF", () => {
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

    stub.on(`/traces?user_id=${memberId}`, {
      body: {
        data: [
          {
            trace_id: "tr-mine",
            name: "Demo Assistant.run",
            status: "error",
            duration: 1200,
            total_spans: 3,
            error_count: 1,
            session_id: "sess-1",
            user_id: memberId,
            agent_id: "demo-assistant",
            created_at: "2026-07-07T10:00:00Z",
          },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
      },
    });
    stub.on("/traces", {
      body: {
        data: [
          { trace_id: "tr-mine", user_id: memberId },
          { trace_id: "tr-other", user_id: "someone-else" },
        ],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 2 },
      },
    });
    stub.on("/traces/tr-mine", {
      body: {
        trace_id: "tr-mine",
        name: "Demo Assistant.run",
        status: "error",
        duration: 1200,
        total_spans: 3,
        error_count: 1,
        user_id: memberId,
        session_id: "sess-1",
        agent_id: "demo-assistant",
        tree: [TREE],
      },
    });
    stub.on("/traces/tr-other", {
      body: { trace_id: "tr-other", user_id: "someone-else", tree: [TREE] },
    });
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("Member 列表强制按自己 user_id 过滤", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/traces?user=someone-else`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      traceId: "tr-mine",
      status: "error",
      errorCount: 1,
      targetId: "demo-assistant",
    });
    const upstream = stub.requests.filter((r) => r.path.startsWith("/traces?"));
    expect(upstream.at(-1)?.path).toContain(`user_id=${memberId}`);
  });

  it("Admin 列表可见全部", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/traces`, {
      headers: { cookie: adminCookie },
    });
    expect((await res.json()).data).toHaveLength(2);
  });

  it("Trace 详情返回递归树（children 结构），含错误节点", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/traces/tr-mine`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traceId).toBe("tr-mine");
    // roots 是根节点数组（runtime 的 tree 是列表）
    const root = body.roots[0];
    expect(root.name).toBe("Demo Assistant.run");
    expect(root.children).toHaveLength(2);
    const toolNode = root.children[1];
    expect(toolNode).toMatchObject({ status: "error", error: "除零错误" });
    // token 元数据透传
    expect(root.children[0].metadata).toMatchObject({ input_tokens: 120 });
  });

  it("Member 访问他人 trace 返回 404，Admin 可以", async () => {
    const forbidden = await fetch(`${server.baseUrl}/api/os/traces/tr-other`, {
      headers: { cookie: memberCookie },
    });
    expect(forbidden.status).toBe(404);

    const ok = await fetch(`${server.baseUrl}/api/os/traces/tr-other`, {
      headers: { cookie: adminCookie },
    });
    expect(ok.status).toBe(200);
  });
});
