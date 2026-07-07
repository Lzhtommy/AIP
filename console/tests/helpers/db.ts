import postgres from "postgres";
import { TEST_DATABASE_URL } from "./env";

/** 清空用户与端点表，保证用例间隔离（测试库专用，绝不指向生产） */
export async function resetUsers(): Promise<void> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`TRUNCATE TABLE users`;
  await sql`TRUNCATE TABLE endpoints`;
  await sql.end();
}

export async function endpointCiphertexts(): Promise<string[]> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  const rows = await sql`SELECT security_key_ciphertext FROM endpoints`;
  await sql.end();
  return rows.map((r) => r.security_key_ciphertext as string);
}

export async function findUserByEmail(
  email: string,
): Promise<{ email: string; password_hash: string; role: string } | undefined> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  const rows =
    await sql`SELECT email, password_hash, role FROM users WHERE email = ${email}`;
  await sql.end();
  return rows[0] as never;
}
