// 在 next start 之前确保 DATABASE_URL 指向的库存在并已迁移。
// Playwright 的 webServer 在 globalSetup 之前启动，故建库必须在此完成。
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ensure-db: 缺少 DATABASE_URL");
  process.exit(1);
}
const dbName = url.split("/").pop();
const maintenance = url.replace(/\/[^/]+$/, "/ai");

const admin = postgres(maintenance, { max: 1 });
const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
if (exists.length === 0) {
  await admin.unsafe(`CREATE DATABASE ${dbName}`);
}
await admin.end();

const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log(`ensure-db: ${dbName} ready`);
