import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { loginAs } from "./helpers";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://ai:ai@localhost:5532/console_e2e";

async function promoteToAdmin(email: string): Promise<void> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`UPDATE users SET role = 'admin' WHERE email = ${email}`;
  await sql.end();
}

test("汇总卡片与按日趋势渲染", async ({ page }) => {
  await loginAs(page, "e2e-metrics@example.com");
  await page.goto("/metrics");
  const totals = page.getByTestId("metrics-totals");
  await expect(totals).toBeVisible();
  await expect(totals.getByText("8")).toBeVisible(); // 3+5 运行
  await expect(totals.getByText("3,000")).toBeVisible(); // 1000+2000 token
  // 两日两组柱（runs + tokens 图各 2 条 = 4）
  await expect(page.getByTestId("chart-bar")).toHaveCount(4);
});

test("Member 无刷新按钮，Admin 有", async ({ page }) => {
  await loginAs(page, "e2e-metrics-member@example.com");
  await page.goto("/metrics");
  await expect(page.getByRole("button", { name: "刷新统计" })).toHaveCount(0);

  const admin = "e2e-metrics-admin@example.com";
  await loginAs(page, admin);
  await promoteToAdmin(admin);
  await page.goto("/metrics");
  await expect(page.getByRole("button", { name: "刷新统计" })).toBeVisible();
});
