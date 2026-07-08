import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 90_000,
    // BFF 集成测试串行跑：每个文件各起一个 next dev，实例并发会互相抢资源
    fileParallelism: false,
  },
});
