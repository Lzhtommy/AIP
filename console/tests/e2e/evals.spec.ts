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

test("列表 → 详情 → 类型筛选", async ({ page }) => {
  await loginAs(page, "e2e-evals@example.com");
  await page.goto("/evals");
  const row = page.getByTestId("eval-row").first();
  await expect(row).toBeVisible();
  await expect(row.getByText("演示准确率评测")).toBeVisible();

  await row.click();
  const detail = page.getByTestId("eval-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByText(/8\.5/)).toBeVisible();

  // 类型筛选按钮存在
  await page.getByRole("button", { name: "Accuracy", exact: true }).click();
  await expect(page.getByTestId("eval-row")).toHaveCount(1);
});

test("Admin 删除评测记录", async ({ page }) => {
  const admin = "e2e-evals-admin@example.com";
  await loginAs(page, admin);
  await promoteToAdmin(admin);
  await page.goto("/evals");
  await expect(page.getByTestId("eval-row").first()).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByText("删除").first().click();
  await expect(page.getByText("还没有评测记录")).toBeVisible();
});
