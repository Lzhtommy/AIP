import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * 测试全局准备：保证测试专用数据库 console_test 存在并已迁移。
 * 测试绝不使用 compose 运行库（console）——避免测试数据污染真实环境
 * （曾发生：e2e 密钥加密的种子端点写进运行库，导致控制台解密失败）。
 */
const MAINTENANCE_URL =
  process.env.TEST_PG_MAINTENANCE_URL ?? "postgresql://ai:ai@localhost:5532/ai";
const TEST_DB = "console_test";

export default async function globalSetup(): Promise<void> {
  const admin = postgres(MAINTENANCE_URL, { max: 1 });
  const exists =
    await admin`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}`;
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE ${TEST_DB}`);
  }
  await admin.end();

  const testUrl =
    process.env.TEST_DATABASE_URL ??
    `postgresql://ai:ai@localhost:5532/${TEST_DB}`;
  const client = postgres(testUrl, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
