/** BFF 集成测试的控制台环境变量（依赖本地 compose postgres 已启动） */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://ai:ai@localhost:5532/console";

export function consoleEnv(extra: Record<string, string> = {}) {
  return {
    DATABASE_URL: TEST_DATABASE_URL,
    AUTH_SECRET: "vitest-auth-secret",
    AUTH_TRUST_HOST: "true",
    ...extra,
  };
}
