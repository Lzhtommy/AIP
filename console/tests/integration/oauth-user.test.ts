import { beforeAll, describe, expect, it } from "vitest";
import { resetUsers } from "../helpers/db";
import { TEST_DATABASE_URL } from "../helpers/env";

// 直接调用 OAuth 用户关联逻辑（依赖本地 compose postgres）
process.env.DATABASE_URL = TEST_DATABASE_URL;

describe("ensureOAuthUser：OAuth 用户关联", () => {
  beforeAll(async () => {
    await resetUsers();
  });

  it("首个 OAuth 用户自动成为 Admin，新邮箱开放注册", async () => {
    const { ensureOAuthUser } = await import("@/lib/oauth-user");
    const first = await ensureOAuthUser("Boss@Example.com", "老板");
    expect(first.role).toBe("admin");
    expect(first.email).toBe("boss@example.com"); // 归一化小写

    const second = await ensureOAuthUser("dev@example.com");
    expect(second.role).toBe("member");
  });

  it("同邮箱重复登录复用同一账号（自动关联）", async () => {
    const { ensureOAuthUser } = await import("@/lib/oauth-user");
    const again = await ensureOAuthUser("boss@example.com");
    const list = await ensureOAuthUser("BOSS@example.com");
    expect(again.id).toBe(list.id);
    expect(again.role).toBe("admin");
  });
});
