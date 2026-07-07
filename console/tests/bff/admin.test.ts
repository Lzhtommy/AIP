import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "admin-tester-pw1";

describe("Admin 运维能力", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let adminCookie: string;
  let memberCookie: string;
  let adminId: string;
  let memberId: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/sessions/sess-x?type=agent", {
        body: { session_id: "sess-x", user_id: "whoever", agent_id: "a1", chat_history: [] },
      });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    const a = await registerUser(server, "admin@example.com", PASSWORD);
    adminId = (await a.json()).id;
    const m = await registerUser(server, "member@example.com", PASSWORD);
    memberId = (await m.json()).id;
    adminCookie = (await login(server, "admin@example.com", PASSWORD)).cookie;
    memberCookie = (await login(server, "member@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("删除会话：Member 403，Admin 转发上游 DELETE", async () => {
    const forbidden = await fetch(`${server.baseUrl}/api/os/sessions/sess-x?kind=agents`, {
      method: "DELETE",
      headers: { cookie: memberCookie },
    });
    expect(forbidden.status).toBe(403);

    const ok = await fetch(`${server.baseUrl}/api/os/sessions/sess-x?kind=agents`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    expect(ok.status).toBe(200);
    const upstreamDelete = stub.requests.find(
      (r) => r.method === "DELETE" && r.path.startsWith("/sessions/sess-x"),
    );
    expect(upstreamDelete?.path).toContain("type=agent");
  });

  it("用户列表：Member 403，Admin 可见全部用户与角色", async () => {
    const forbidden = await fetch(`${server.baseUrl}/api/users`, {
      headers: { cookie: memberCookie },
    });
    expect(forbidden.status).toBe(403);

    const res = await fetch(`${server.baseUrl}/api/users`, {
      headers: { cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(2);
    const roles = Object.fromEntries(
      list.map((u: { email: string; role: string }) => [u.email, u.role]),
    );
    expect(roles).toEqual({
      "admin@example.com": "admin",
      "member@example.com": "member",
    });
  });

  it("角色变更即时生效：Member 升级后无需重新登录即可用 Admin 能力", async () => {
    const patch = await fetch(`${server.baseUrl}/api/users/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(patch.status).toBe(200);

    // 老 cookie、不重新登录，直接访问 Admin 接口
    const res = await fetch(`${server.baseUrl}/api/users`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);

    // 降回 member 后同一 cookie 立即失去权限
    await fetch(`${server.baseUrl}/api/users/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ role: "member" }),
    });
    const again = await fetch(`${server.baseUrl}/api/users`, {
      headers: { cookie: memberCookie },
    });
    expect(again.status).toBe(403);
  });

  it("Admin 不能修改自己的角色（防止锁死）", async () => {
    const res = await fetch(`${server.baseUrl}/api/users/${adminId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ role: "member" }),
    });
    expect(res.status).toBe(400);
  });
});
