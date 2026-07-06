import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findUserByEmail, resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

async function register(server: TestServer, email: string, password = "test-password-123") {
  return fetch(`${server.baseUrl}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name: email.split("@")[0] }),
  });
}

describe("POST /api/register（开放注册）", () => {
  let server: TestServer;

  beforeAll(async () => {
    await resetUsers();
    server = await startConsole(consoleEnv());
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("第一个注册账号自动成为 Admin", async () => {
    const res = await register(server, "first@example.com");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("admin");
    expect(body.email).toBe("first@example.com");
  });

  it("后续注册账号默认为 Member", async () => {
    const res = await register(server, "second@example.com");
    expect(res.status).toBe(201);
    expect((await res.json()).role).toBe("member");
  });

  it("重复邮箱返回 409", async () => {
    const res = await register(server, "first@example.com");
    expect(res.status).toBe(409);
  });

  it("密码以 bcrypt 哈希落库，不存明文", async () => {
    const row = await findUserByEmail("first@example.com");
    expect(row).toBeDefined();
    expect(row!.password_hash).toMatch(/^\$2[aby]\$/);
    expect(row!.password_hash).not.toContain("test-password-123");
  });

  it("过短密码被拒绝", async () => {
    const res = await register(server, "weak@example.com", "123");
    expect(res.status).toBe(400);
  });
});
