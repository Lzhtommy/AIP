import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "e2e-traces@example.com");
});

test("Trace 列表 → 树形展开，错误节点醒目并可看详情", async ({ page }) => {
  await page.goto("/traces");
  const row = page.getByTestId("trace-row").first();
  await expect(row).toBeVisible();
  await expect(row.getByText("Demo Assistant.run")).toBeVisible();
  await expect(row.getByText(/错误 ×1/)).toBeVisible();
  await expect(row.getByText("1.23s")).toBeVisible();

  await row.click();
  const tree = page.getByTestId("trace-tree");
  await expect(tree.getByText("OpenAIChat.invoke")).toBeVisible();
  await expect(tree.getByText("multiply")).toBeVisible();
  // token 元数据与耗时
  await expect(tree.getByText(/tokens 120/)).toBeVisible();
  // 错误节点默认展开且详情可见
  await expect(tree.getByText("boom: 演示错误")).toBeVisible();
});
