import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "metrics-tester1";

const DAY = (date: string, runs: number, tokens: number, users: number) => ({
  date,
  agent_runs_count: runs,
  team_runs_count: 0,
  workflow_runs_count: 0,
  users_count: users,
  token_metrics: { input_tokens: tokens / 2, output_tokens: tokens / 2, total_tokens: tokens },
});

describe("Metrics BFF", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/metrics?starting_date=2026-07-06&ending_date=2026-07-07", {
        body: {
          metrics: [
            DAY("2026-07-06", 3, 1000, 2),
            DAY("2026-07-07", 5, 2000, 3),
          ],
          updated_at: "2026-07-08T00:00:00Z",
        },
      })
      .on("/metrics/refresh", { body: { ok: true } });
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

  it("列表返回按日序列与汇总，日期参数透传", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/metrics?from=2026-07-06&to=2026-07-07`,
      { headers: { cookie: memberCookie } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.daily).toHaveLength(2);
    expect(body.daily[0]).toMatchObject({ date: "2026-07-06", runs: 3, tokens: 1000 });
    expect(body.totals).toMatchObject({ runs: 8, tokens: 3000 });
    // 活跃用户取区间内峰值
    expect(body.totals.users).toBe(3);
    const upstream = stub.requests.find((r) => r.path.startsWith("/metrics?"))!;
    expect(upstream.path).toContain("starting_date=2026-07-06");
    expect(upstream.path).toContain("ending_date=2026-07-07");
  });

  it("刷新：Member 403，Admin 转发 /metrics/refresh", async () => {
    const forbidden = await fetch(`${server.baseUrl}/api/os/metrics/refresh`, {
      method: "POST",
      headers: { cookie: memberCookie },
    });
    expect(forbidden.status).toBe(403);

    const ok = await fetch(`${server.baseUrl}/api/os/metrics/refresh`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    expect(ok.status).toBe(200);
    expect(
      stub.requests.some((r) => r.method === "POST" && r.path === "/metrics/refresh"),
    ).toBe(true);
  });
});
