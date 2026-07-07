import { expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "./helpers";

/**
 * 黄金路径：注册 → 登录态进入控制台 → 确认端点 → Chat（流式 + 工具卡片）
 * → Sessions 回放 → Trace 树。一条链路打穿第一版全部核心能力。
 */
test("黄金路径全链路", async ({ page }) => {
  // 1. 注册（自动登录）
  const email = `golden-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码（至少 8 位）").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "注册" }).click();
  await page.waitForURL("/");

  // 2. 控制台壳 + 端点就绪
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(page.getByLabel("当前端点")).toContainText("默认 Runtime");
  await expect(page.getByText("运行正常")).toBeVisible();

  // 3. Chat：流式回复 + 工具调用卡片
  await page.getByRole("link", { name: "Chat 对话" }).click();
  await page.getByLabel("消息输入").fill("算一下 137*73");
  await page.getByRole("button", { name: "发送" }).click();
  const list = page.getByTestId("message-list");
  await expect(list.locator("strong", { hasText: "e2e" })).toBeVisible();
  const toolCard = list.getByTestId("tool-call-card");
  await expect(toolCard.getByText("multiply")).toBeVisible();
  await expect(page.getByText("会话中")).toBeVisible();

  // 4. Sessions：找到会话并回放
  await page.getByRole("link", { name: "Sessions 会话" }).click();
  const row = page.getByTestId("session-row").first();
  await expect(row).toBeVisible();
  await row.click();
  const replay = page.getByTestId("replay-list");
  await expect(replay.getByText("打个招呼")).toBeVisible();
  await expect(replay.getByTestId("tool-call-card")).toBeVisible();

  // 5. Traces：打开调用树，错误节点可见
  await page.getByRole("link", { name: "Traces 追踪" }).click();
  await page.getByTestId("trace-row").first().click();
  const tree = page.getByTestId("trace-tree");
  await expect(tree.getByText("OpenAIChat.invoke")).toBeVisible();
  await expect(tree.getByText("boom: 演示错误")).toBeVisible();
});
