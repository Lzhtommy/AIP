import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "e2e-sessions@example.com");
});

test("会话列表 → 回放（含工具卡片）→ 继续对话", async ({ page }) => {
  // 先触发一次列表请求，让 stub 记住当前用户的 user_id
  await page.goto("/sessions");
  const row = page.getByTestId("session-row").first();
  await expect(row).toBeVisible();
  await expect(row.getByText("E2E 会话")).toBeVisible();

  await row.click();
  const replay = page.getByTestId("replay-list");
  await expect(replay.getByText("打个招呼")).toBeVisible();
  await expect(replay.locator("strong", { hasText: "e2e" })).toBeVisible();
  const toolCard = replay.getByTestId("tool-call-card");
  await expect(toolCard).toBeVisible();
  await toolCard.locator("summary").click();
  await expect(toolCard.getByText("10001")).toBeVisible();

  await page.getByRole("link", { name: "继续对话" }).click();
  await expect(page).toHaveURL(/\/chat\?/);
  await expect(page.getByText("会话中")).toBeVisible();
  // 历史消息被预载
  await expect(page.getByTestId("message-list").getByText("打个招呼")).toBeVisible();
});
