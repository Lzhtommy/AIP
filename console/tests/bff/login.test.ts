import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const EMAIL = "alice@example.com";
const PASSWORD = "correct-horse-battery";

describe("登录全流程（注册 → 登录 → 带会话访问）", () => {
  let server: TestServer;
  let stub: AgentOSStub;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub().on("/health", { body: { status: "ok" } });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, EMAIL, PASSWORD);
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("正确密码登录后可访问页面与受保护 API", async () => {
    const { cookie, sessionEstablished } = await login(server, EMAIL, PASSWORD);
    expect(sessionEstablished).toBe(true);

    const page = await fetch(server.baseUrl, {
      headers: { cookie },
      redirect: "manual",
    });
    expect(page.status).toBe(200);

    const api = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie },
    });
    expect(api.status).toBe(200);
    expect((await api.json()).status).toBe("ok");
  });

  it("错误密码登录不建立会话", async () => {
    const { cookie, sessionEstablished } = await login(
      server,
      EMAIL,
      "wrong-password-123",
    );
    expect(sessionEstablished).toBe(false);

    const api = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie },
    });
    expect(api.status).toBe(401);
  });
});
