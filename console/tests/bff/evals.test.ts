import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "evals-tester-1";

const EVAL = {
  id: "ev-1",
  agent_id: "demo-assistant",
  name: "准确率评测",
  evaluated_component_name: "Demo Assistant",
  eval_type: "accuracy",
  eval_data: { score: 8.5, max_score: 10 },
  eval_input: { input: "137*73 等于多少" },
  created_at: "2026-07-08T10:00:00Z",
};

describe("Evals BFF", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/eval-runs", {
        body: {
          data: [EVAL],
          meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
        },
      })
      .on("/eval-runs?agent_id=demo-assistant&eval_types=accuracy", {
        body: {
          data: [EVAL],
          meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
        },
      })
      .on("/eval-runs/ev-1", { body: EVAL })
      .on("/eval-runs/ev-1", { body: EVAL });
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
    const res = await fetch(`${server.baseUrl}/api/os/evals`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0]).toMatchObject({
      id: "ev-1",
      name: "准确率评测",
      evalType: "accuracy",
      targetId: "demo-assistant",
    });
  });

  it("按 agent 与 eval 类型筛选透传", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/evals?agent=demo-assistant&type=accuracy`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(200);
    const upstream = stub.requests.filter((r) => r.path.startsWith("/eval-runs?")).at(-1)!;
    expect(upstream.path).toContain("agent_id=demo-assistant");
    expect(upstream.path).toContain("eval_types=accuracy");
  });

  it("详情返回原始 eval_data/eval_input", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/evals/ev-1`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evalData).toMatchObject({ score: 8.5 });
    expect(body.evalInput).toMatchObject({ input: "137*73 等于多少" });
  });

  it("删除：Member 403，Admin 生效", async () => {
    const forbidden = await fetch(`${server.baseUrl}/api/os/evals/ev-1`, {
      method: "DELETE",
      headers: { cookie: memberCookie },
    });
    expect(forbidden.status).toBe(403);

    const ok = await fetch(`${server.baseUrl}/api/os/evals/ev-1`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    expect(ok.status).toBe(200);
    expect(
      stub.requests.some((r) => r.method === "DELETE" && r.path.startsWith("/eval-runs")),
    ).toBe(true);
  });
});
