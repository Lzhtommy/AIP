import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// 惰性初始化：构建期收集页面数据时不读 env、不建连接；
// dev 热重载时复用连接，避免连接数耗尽
const globalForDb = globalThis as unknown as { db?: Db };

function makeDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("缺少环境变量 DATABASE_URL");
  return drizzle(postgres(url, { max: 10 }), { schema });
}

export const db: Db = new Proxy({} as Db, {
  get(_, prop) {
    globalForDb.db ??= makeDb();
    return Reflect.get(globalForDb.db, prop);
  },
});
