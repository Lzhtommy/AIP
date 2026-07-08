import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "qp-tester-1";

describe("Quick prompts BFF", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let cookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/config", {
        body: {
          chat: {
            quick_prompts: {
              "demo-assistant": ["帮我算 1+1", "介绍平台"],
            },
          },
        },
      });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "qp@example.com", PASSWORD);
    cookie = (await login(server, "qp@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("按目标 id 返回快捷提示", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/quick-prompts?target=demo-assistant`,
      { headers: { cookie } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ prompts: ["帮我算 1+1", "介绍平台"] });
  });

  it("未配置的目标返回空数组", async () => {
    const res = await fetch(
      `${server.baseUrl}/api/os/quick-prompts?target=writer`,
      { headers: { cookie } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ prompts: [] });
  });
});
