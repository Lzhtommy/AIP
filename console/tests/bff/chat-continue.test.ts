import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "continue-tester1";

describe("Chat continue（工具审批恢复）", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let cookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/agents/demo-assistant/runs/run-42/continue", {
        sse: [
          { event: "RunContent", content: "已发送通知" },
          { event: "RunCompleted" },
        ],
      });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "cont@example.com", PASSWORD);
    cookie = (await login(server, "cont@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("批准后 continue：透传 tools(confirmed) 并强制注入 user_id，SSE 恢复", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/agents/demo-assistant/runs/run-42/continue`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          sessionId: "sess-1",
          tools: [
            { tool_call_id: "tc-9", tool_name: "send_notification", confirmed: true },
          ],
        }),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("已发送通知");

    const upstream = stub.requests.find((r) =>
      r.path.endsWith("/runs/run-42/continue"),
    )!;
    // form 编码，tools 为 JSON 字符串
    expect(upstream.body).toContain("tc-9");
    expect(decodeURIComponent(upstream.body)).toContain('"confirmed":true');
    expect(upstream.body).toMatch(/user_id/);
    expect(upstream.body).not.toContain("forged");
  });

  it("空 tools 返回 400", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/agents/demo-assistant/runs/run-42/continue`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ sessionId: "sess-1", tools: [] }),
      },
    );
    expect(res.status).toBe(400);
  });
});
