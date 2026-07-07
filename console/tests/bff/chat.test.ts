import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const KEY = "chat-endpoint-key";
const PASSWORD = "chat-tester-pw12";

const RUN_EVENTS = [
  { event: "RunStarted", run_id: "run-1", session_id: "sess-abc" },
  { event: "RunContent", content: "你好" },
  { event: "RunContent", content: "，世界" },
  { event: "RunCompleted", content: "你好，世界" },
];

describe("Chat BFF 代理", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let cookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/agents", {
        body: [
          {
            id: "demo-assistant",
            name: "Demo Assistant",
            model: { provider: "OpenAI", model: "gpt-4.1-mini" },
            secret_config: "should-not-leak",
          },
        ],
      })
      .on("/agents/demo-assistant/runs", { sse: RUN_EVENTS });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: KEY }),
    );
    await registerUser(server, "chatter@example.com", PASSWORD);
    cookie = (await login(server, "chatter@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("GET /api/os/agents 返回精简的 Agent 列表", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/agents`, {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toEqual([
      {
        id: "demo-assistant",
        name: "Demo Assistant",
        model: { provider: "OpenAI", model: "gpt-4.1-mini" },
      },
    ]);
    expect(stub.requestsFor("/agents").at(-1)?.headers.authorization).toBe(
      `Bearer ${KEY}`,
    );
  });

  it("流式 run：SSE 事件原样透传给浏览器", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/agents/demo-assistant/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ message: "打个招呼" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    const events = text
      .split("\n\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => JSON.parse(l.slice(6)));
    expect(events.map((e) => e.event)).toEqual([
      "RunStarted",
      "RunContent",
      "RunContent",
      "RunCompleted",
    ]);
  });

  it("user_id 由服务端强制注入，客户端伪造无效", async () => {
    await fetch(`${server.baseUrl}/api/os/agents/demo-assistant/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        message: "hi",
        user_id: "forged-user",
        sessionId: "sess-abc",
      }),
    });
    const upstream = stub.requestsFor("/agents/demo-assistant/runs").at(-1)!;
    expect(upstream.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(upstream.body).not.toContain("forged-user");
    // 注入的是控制台用户 id（uuid），并携带会话与流式标记
    expect(upstream.body).toMatch(/name="user_id"[\s\S]{0,10}[0-9a-f-]{36}/);
    expect(upstream.body).toContain("sess-abc");
    expect(upstream.body).toMatch(/name="stream"[\s\S]{0,10}true/);
  });
});
