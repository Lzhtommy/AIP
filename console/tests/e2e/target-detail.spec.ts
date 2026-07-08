import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("查看 Agent 配置详情：模型/system prompt/工具/知识记忆", async ({ page }) => {
  await loginAs(page, "e2e-detail@example.com");
  await page.goto("/chat");
  await expect(page.getByText("Demo Assistant").first()).toBeVisible();

  await page.getByRole("button", { name: "查看配置" }).click();
  const panel = page.getByTestId("target-detail");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("gpt-4.1-mini")).toBeVisible();
  await expect(panel.getByText("你是 AIP 演示助手")).toBeVisible();
  await expect(panel.getByText("Knowledge")).toBeVisible();
  await expect(panel.getByText("Memory")).toBeVisible();
  await expect(panel.getByText("multiply")).toBeVisible();
  await expect(panel.getByText(/send_notification/)).toBeVisible();

  // 可收起
  await page.getByRole("button", { name: "隐藏配置" }).click();
  await expect(panel).toHaveCount(0);
});
