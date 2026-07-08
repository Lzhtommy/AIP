import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "e2e-memory@example.com");
});

test("记忆列表 → topic 筛选 → 删除", async ({ page }) => {
  await page.goto("/memory");
  const row = page.getByTestId("memory-row").first();
  await expect(row).toBeVisible();
  await expect(row.getByText("用户喜欢简洁的中文回复")).toBeVisible();
  await expect(row.getByText("preferences")).toBeVisible();

  // topic 筛选按钮存在且可点击
  await page.getByRole("button", { name: "preferences" }).click();
  await expect(page.getByTestId("memory-row")).toHaveCount(1);

  // 删除后列表为空态
  page.on("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("还没有记忆")).toBeVisible();
});
