import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("工具审批：暂停 → 批准 → 恢复", async ({ page }) => {
  await loginAs(page, "e2e-hitl@example.com");
  await page.goto("/chat");
  await page.getByRole("button", { name: "Notify Agent" }).click();
  await page.getByLabel("消息输入").fill("给 alice 发通知");
  await page.getByRole("button", { name: "发送" }).click();

  const list = page.getByTestId("message-list");
  const card = list.getByTestId("confirmation-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("send_notification")).toBeVisible();
  await expect(card.getByText(/alice/)).toBeVisible();

  await card.getByRole("button", { name: "批准" }).click();
  await expect(card.getByText("已批准")).toBeVisible();
  await expect(list.getByText("已发送通知给 alice。")).toBeVisible();
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
});
