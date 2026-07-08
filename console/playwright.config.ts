import { defineConfig } from "@playwright/test";

// Playwright 用独立库 console_e2e（与 vitest 的 console_test 分离）。
// 在 globalSetup 运行前设好，让它创建并迁移正确的库。
process.env.TEST_DB_NAME ??= "console_e2e";

const STUB_PORT = 45678;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/global-setup.ts",
  // 单 worker 串行：所有用例共用一个控制台 + 一个有状态 stub（memory/knowledge
  // 的增删会改 stub 状态），并行会互相踩踏。
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    // 测试全部打本机服务；禁用系统代理，避免本地回环流量被代理劫持
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: [
    {
      command: `node tests/e2e/stub-server.mjs`,
      url: `http://127.0.0.1:${STUB_PORT}/health`,
      reuseExistingServer: false,
      env: { STUB_PORT: String(STUB_PORT) },
    },
    {
      // E2E 打生产构建：dev 模式（turbopack HMR）在 headless shell 中无法 hydrate，
      // 且生产模式更接近真实部署形态
      command: `node node_modules/next/dist/bin/next build && node tests/ensure-db.mjs && node node_modules/next/dist/bin/next start --port ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        OS_ENDPOINT_URL: `http://127.0.0.1:${STUB_PORT}`,
        OS_SECURITY_KEY: "e2e-security-key",
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ??
          "postgresql://ai:ai@localhost:5532/console_e2e",
        AUTH_SECRET: "e2e-auth-secret",
        AUTH_TRUST_HOST: "true",
        ENCRYPTION_KEY: "e2e-encryption-key",
      },
    },
  ],
});
