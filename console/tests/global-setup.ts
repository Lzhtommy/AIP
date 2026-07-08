import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * 测试全局准备：保证测试专用数据库存在并已迁移。
 * 测试绝不使用 compose 运行库（console）。vitest 与 Playwright 各用独立库
 * （console_test / console_e2e），互不污染——避免 vitest 的随机端口 seed
 * 遮蔽 Playwright 的固定端口 seed。
 *
 * 不在此清空数据：Playwright 的 globalSetup 在 webServer 之后运行，清空会
 * 抹掉控制台启动时 seed 的端点（seed 仅启动时执行一次），导致端点表为空。
 */
const MAINTENANCE_URL =
  process.env.TEST_PG_MAINTENANCE_URL ?? "postgresql://ai:ai@localhost:5532/ai";

function testDbName(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (url) return url.split("/").pop()!;
  return process.env.TEST_DB_NAME ?? "console_test";
}

export default async function globalSetup(): Promise<void> {
  const dbName = testDbName();
  const admin = postgres(MAINTENANCE_URL, { max: 1 });
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
  }
  await admin.end();

  const testUrl =
    process.env.TEST_DATABASE_URL ?? `postgresql://ai:ai@localhost:5532/${dbName}`;
  const client = postgres(testUrl, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
