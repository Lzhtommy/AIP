import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { endpointCiphertexts, resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const KEY_A = "endpoint-a-secret-key";
const KEY_B = "endpoint-b-secret-key";
const PASSWORD = "endpoint-tester-pw1";

describe("多端点管理", () => {
  let server: TestServer;
  let stubA: AgentOSStub;
  let stubB: AgentOSStub;
  let adminCookie: string;
  let memberCookie: string;
  let endpointAId: string;
  let endpointBId: string;

  beforeAll(async () => {
    await resetUsers();
    stubA = new AgentOSStub().on("/health", { body: { status: "ok", version: "A" } });
    stubB = new AgentOSStub().on("/health", { body: { status: "ok", version: "B" } });
    await Promise.all([stubA.start(), stubB.start()]);
    // 不带 OS_ENDPOINT_URL：本套用例全部走数据库端点
    server = await startConsole(consoleEnv());
    await registerUser(server, "admin@example.com", PASSWORD); // 首个 = admin
    await registerUser(server, "member@example.com", PASSWORD);
    adminCookie = (await login(server, "admin@example.com", PASSWORD)).cookie;
    memberCookie = (await login(server, "member@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stubA?.stop();
    await stubB?.stop();
  });

  it("Member 调创建端点接口返回 403", async () => {
    const res = await fetch(`${server.baseUrl}/api/endpoints`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: memberCookie },
      body: JSON.stringify({ name: "X", baseUrl: stubA.url, securityKey: "k" }),
    });
    expect(res.status).toBe(403);
  });

  it("Admin 创建端点：201 + 连通性检测 + 密钥不回显", async () => {
    const res = await fetch(`${server.baseUrl}/api/endpoints`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ name: "Runtime A", baseUrl: stubA.url, securityKey: KEY_A }),
    });
    expect(res.status).toBe(201);
    const raw = await res.text();
    expect(raw).not.toContain(KEY_A);
    const body = JSON.parse(raw);
    endpointAId = body.id;
    expect(body.health.reachable).toBe(true);
    // 连通性检测应以 Bearer 密钥调用上游
    expect(stubA.requestsFor("/health").at(-1)?.headers.authorization).toBe(
      `Bearer ${KEY_A}`,
    );
  });

  it("密钥加密落库，密文中不含明文", async () => {
    const ciphertexts = await endpointCiphertexts();
    expect(ciphertexts.length).toBe(1);
    expect(ciphertexts[0]).not.toContain(KEY_A);
  });

  it("端点列表：所有人可见名称，密钥对任何角色都不返回", async () => {
    const res = await fetch(`${server.baseUrl}/api/endpoints`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain(KEY_A);
    const list = JSON.parse(raw);
    expect(list.map((e: { name: string }) => e.name)).toContain("Runtime A");
  });

  it("BFF 按当前端点路由：默认第一个启用端点", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).runtime.version).toBe("A");
  });

  it("切换端点后 BFF 打到新目标", async () => {
    const create = await fetch(`${server.baseUrl}/api/endpoints`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ name: "Runtime B", baseUrl: stubB.url, securityKey: KEY_B }),
    });
    endpointBId = (await create.json()).id;

    const sel = await fetch(`${server.baseUrl}/api/endpoints/current`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: memberCookie },
      body: JSON.stringify({ endpointId: endpointBId }),
    });
    expect(sel.status).toBe(200);

    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie: memberCookie },
    });
    expect((await res.json()).runtime.version).toBe("B");
    expect(stubB.requestsFor("/health").at(-1)?.headers.authorization).toBe(
      `Bearer ${KEY_B}`,
    );
  });

  it("端点偏好跨会话保持：重新登录后仍指向所选端点", async () => {
    const fresh = (await login(server, "member@example.com", PASSWORD)).cookie;
    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie: fresh },
    });
    expect((await res.json()).runtime.version).toBe("B");
  });

  it("Admin 删除端点后，指向它的用户回落到首个启用端点", async () => {
    const del = await fetch(`${server.baseUrl}/api/endpoints/${endpointBId}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    expect(del.status).toBe(200);
    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie: memberCookie },
    });
    expect((await res.json()).runtime.version).toBe("A");
  });

  it("没有任何端点时返回 503 结构化错误", async () => {
    const del = await fetch(`${server.baseUrl}/api/endpoints/${endpointAId}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    expect(del.status).toBe(200);
    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie: memberCookie },
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("NO_ENDPOINT");
  });
});

describe("ENCRYPTION_KEY 更换后：结构化报错而非 500", () => {
  let server: TestServer;
  let stub: AgentOSStub;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub().on("/health", { body: { status: "ok" } });
    await stub.start();
    // 用 key-A 启动并种子端点
    const serverA = await startConsole(
      consoleEnv({
        OS_ENDPOINT_URL: stub.url,
        OS_SECURITY_KEY: "seed-key",
        ENCRYPTION_KEY: "encryption-key-A",
      }),
    );
    await registerUser(serverA, "keyrot@example.com", PASSWORD);
    const { cookie } = await login(serverA, "keyrot@example.com", PASSWORD);
    const ok = await fetch(`${serverA.baseUrl}/api/os/health`, {
      headers: { cookie },
    });
    expect(ok.status).toBe(200);
    await serverA.stop();

    // 换成 key-B 重启：已存密文无法解密
    server = await startConsole(
      consoleEnv({ ENCRYPTION_KEY: "encryption-key-B" }),
    );
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("返回 503 ENDPOINT_KEY_INVALID 与可操作的提示", async () => {
    const { cookie } = await login(server, "keyrot@example.com", PASSWORD);
    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie },
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("ENDPOINT_KEY_INVALID");
    expect(body.error.message).toContain("重新录入");
  });
});

describe("env 种子：OS_ENDPOINT_URL 在表空时自动录入", () => {
  let server: TestServer;
  let stub: AgentOSStub;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub().on("/health", { body: { status: "ok", version: "seed" } });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "seed-key" }),
    );
    await registerUser(server, "seed@example.com", PASSWORD);
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("种子端点生效，BFF 可用", async () => {
    const { cookie } = await login(server, "seed@example.com", PASSWORD);
    const res = await fetch(`${server.baseUrl}/api/os/health`, {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).runtime.version).toBe("seed");
  });
});
