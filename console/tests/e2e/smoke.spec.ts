import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "e2e-smoke@example.com");
});

const NAV_LABELS = [
  "Chat 对话",
  "Sessions 会话",
  "Memory 记忆",
  "Knowledge 知识库",
  "Traces 追踪",
  "Metrics 指标",
  "Evals 评测",
];

test("首页渲染七个模块的导航项", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主导航" });
  for (const label of NAV_LABELS) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
});

test("未实现模块显示「规划中」占位页", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "Memory 记忆" })
    .click();
  await expect(page.getByRole("heading", { name: "Memory 记忆" })).toBeVisible();
  await expect(page.getByText("规划中")).toBeVisible();
});

test("状态页显示 runtime 运行正常与版本", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("运行正常")).toBeVisible();
  await expect(page.getByText("e2e-stub")).toBeVisible();
});
