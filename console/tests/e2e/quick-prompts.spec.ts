import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "e2e-qp@example.com");
});

test("空会话显示快捷提示，点击即发送", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByText("Demo Assistant").first()).toBeVisible();
  const qp = page.getByTestId("quick-prompts");
  await expect(qp).toBeVisible();
  await qp.getByRole("button", { name: "帮我算 137×73" }).click();

  const list = page.getByTestId("message-list");
  await expect(list.getByText("帮我算 137×73")).toBeVisible();
  await expect(list.getByText("e2e")).toBeVisible();
  // 发送后快捷提示区消失（有消息了）
  await expect(page.getByTestId("quick-prompts")).toHaveCount(0);
});

test("未配置快捷提示的目标不显示按钮区", async ({ page }) => {
  await page.goto("/chat");
  // 切到 Writer（stub 未给 writer 配 quick_prompts）——通过 Team 验证无区块
  await page.getByRole("button", { name: "Demo Team" }).click();
  await expect(page.getByTestId("quick-prompts")).toHaveCount(0);
});
