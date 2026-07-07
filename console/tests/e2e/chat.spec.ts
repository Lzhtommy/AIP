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

test("工具调用卡片实时出现，可展开查看入参与结果", async ({ page }) => {
  await page.goto("/chat");
  await page.getByLabel("消息输入").fill("算一下 137*73");
  await page.getByRole("button", { name: "发送" }).click();

  const card = page.getByTestId("tool-call-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("multiply")).toBeVisible();
  await expect(card.getByText("完成")).toBeVisible();

  await card.locator("summary").click();
  await expect(card.getByText('"a": 137')).toBeVisible();
  await expect(card.getByText("10001")).toBeVisible();
});

test("停止按钮立即中断流式输出", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "Slow Agent" }).click();
  await page.getByLabel("消息输入").fill("开始长任务");
  await page.getByRole("button", { name: "发送" }).click();

  const list = page.getByTestId("message-list");
  await expect(list.getByText("第1段。")).toBeVisible();
  await page.getByRole("button", { name: "停止" }).click();

  await expect(list.getByText("（已中断）")).toBeVisible();
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
  // 中断后不再继续输出
  await page.waitForTimeout(600);
  await expect(list.getByText("第10段。")).toHaveCount(0);
});

test("Team 对话可见成员分工与团队汇总", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "Demo Team" }).click();
  await page.getByLabel("消息输入").fill("分头研究");
  await page.getByRole("button", { name: "发送" }).click();

  const list = page.getByTestId("message-list");
  await expect(list.getByTestId("member-marker")).toHaveCount(2);
  await expect(list.getByText("Demo Assistant")).toBeVisible();
  await expect(list.getByText("Writer Agent")).toBeVisible();
  await expect(list.locator("strong", { hasText: "团队汇总" })).toBeVisible();
});

test("Workflow 触发后流式显示步骤进展", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "Demo Workflow" }).click();
  await page.getByLabel("消息输入").fill("跑流程");
  await page.getByRole("button", { name: "发送" }).click();

  const list = page.getByTestId("message-list");
  await expect(list.getByTestId("step-marker")).toHaveCount(2);
  await expect(list.getByText("计算")).toBeVisible();
  await expect(list.getByText("撰写")).toBeVisible();
  await expect(list.getByText("流程产出文本。")).toBeVisible();
  // 两个步骤最终都为完成态
  await expect(list.getByTestId("step-marker").getByText("完成")).toHaveCount(2);
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
