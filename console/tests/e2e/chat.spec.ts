import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "e2e-chat@example.com");
});

test("发送消息后看到流式回复（Markdown 渲染）", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByText("Demo Assistant").first()).toBeVisible();

  await page.getByLabel("消息输入").fill("打个招呼");
  await page.getByRole("button", { name: "发送" }).click();

  const list = page.getByTestId("message-list");
  await expect(list.getByText("打个招呼")).toBeVisible();
  // Markdown **e2e** 渲染为 strong
  await expect(list.locator("strong", { hasText: "e2e" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
  // 进入会话状态（RunStarted 带回 session_id）
  await expect(page.getByText("会话中")).toBeVisible();
});

test("新会话清空消息", async ({ page }) => {
  await page.goto("/chat");
  await page.getByLabel("消息输入").fill("第一条");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByTestId("message-list").getByText("第一条")).toBeVisible();

  await page.getByRole("button", { name: "新会话" }).click();
  await expect(
    page.getByTestId("message-list").getByText("第一条"),
  ).toHaveCount(0);
});
