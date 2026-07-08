import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { loginAs } from "./helpers";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://ai:ai@localhost:5532/console_e2e";
const ADMIN_EMAIL = "e2e-knowledge-admin@example.com";

/** 直接提权为 Admin（角色每请求从库读取，即时生效） */
async function promoteToAdmin(email: string): Promise<void> {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`UPDATE users SET role = 'admin' WHERE email = ${email}`;
  await sql.end();
}

test("Admin 添加知识内容 → 状态显示 → 删除", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL);
  await promoteToAdmin(ADMIN_EMAIL);

  await page.goto("/knowledge");
  // 既有内容可见
  await expect(page.getByTestId("knowledge-row").first()).toBeVisible();
  await expect(page.getByText("产品手册")).toBeVisible();

  // 添加文本内容
  await page.getByLabel("名称").fill("E2E 新文档");
  await page.getByLabel("文本内容").fill("这是 e2e 添加的知识正文");
  await page.getByRole("button", { name: "添加内容" }).click();
  const newRow = page
    .getByTestId("knowledge-row")
    .filter({ hasText: "E2E 新文档" });
  await expect(newRow).toBeVisible();
  await expect(newRow.getByText("完成")).toBeVisible();

  // 删除
  page.on("dialog", (d) => d.accept());
  await newRow.getByRole("button", { name: "删除" }).click();
  await expect(newRow).toHaveCount(0);
});

test("Member 只读：无添加表单与删除按钮", async ({ page }) => {
  await loginAs(page, "e2e-knowledge-member@example.com");
  await page.goto("/knowledge");
  await expect(page.getByTestId("knowledge-row").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "添加内容" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
});

test("检索测试面板返回命中片段与相似度", async ({ page }) => {
  await loginAs(page, "e2e-knowledge-search@example.com");
  await page.goto("/knowledge");
  await page.getByLabel("检索查询").fill("AIP 是什么");
  await page.getByRole("button", { name: "检索" }).click();
  const results = page.getByTestId("search-results");
  await expect(results.getByTestId("search-hit")).toHaveCount(1);
  await expect(results.getByText("AIP 是内部私有化的 AgentOS 控制台。")).toBeVisible();
  await expect(results.getByText(/相似度 0\.9/)).toBeVisible();
});
