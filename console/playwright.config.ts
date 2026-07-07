import { defineConfig } from "@playwright/test";

const STUB_PORT = 45678;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
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
      command: `node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start --port ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        OS_ENDPOINT_URL: `http://127.0.0.1:${STUB_PORT}`,
        OS_SECURITY_KEY: "e2e-security-key",
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ??
          "postgresql://ai:ai@localhost:5532/console",
        AUTH_SECRET: "e2e-auth-secret",
        AUTH_TRUST_HOST: "true",
        ENCRYPTION_KEY: "e2e-encryption-key",
      },
    },
  ],
});
