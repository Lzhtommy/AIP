import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

describe("OAuth provider 配置开关", () => {
  describe("未配置任何 OAuth 凭证", () => {
    let server: TestServer;

    beforeAll(async () => {
      await resetUsers();
      server = await startConsole(consoleEnv());
    });
    afterAll(async () => {
      await server?.stop();
    });

    it("providers 端点只有 credentials，无 google/github", async () => {
      const res = await fetch(`${server.baseUrl}/api/auth/providers`);
      expect(res.status).toBe(200);
      const providers = await res.json();
      expect(providers).toHaveProperty("credentials");
      expect(providers).not.toHaveProperty("google");
      expect(providers).not.toHaveProperty("github");
    });
  });

  describe("配置了 GitHub 凭证", () => {
    let server: TestServer;

    beforeAll(async () => {
      server = await startConsole(
        consoleEnv({
          AUTH_GITHUB_ID: "dummy-client-id",
          AUTH_GITHUB_SECRET: "dummy-secret",
        }),
      );
    });
    afterAll(async () => {
      await server?.stop();
    });

    it("providers 端点包含 github，仍不含 google", async () => {
      const res = await fetch(`${server.baseUrl}/api/auth/providers`);
      const providers = await res.json();
      expect(providers).toHaveProperty("github");
      expect(providers).not.toHaveProperty("google");
      // OAuth 登录入口指向 provider 授权流程
      expect(providers.github.type).toBe("oauth");
    });
  });
});
