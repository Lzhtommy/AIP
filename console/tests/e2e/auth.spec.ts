import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, loginAs } from "./helpers";

test("未登录访问首页被重定向到登录页", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("登录 AIP Console")).toBeVisible();
});

test("注册后自动登录进入控制台", async ({ page }) => {
  const email = `reg-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码（至少 8 位）").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "注册" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("登录后可见控制台壳，登出后回到登录页", async ({ page }) => {
  await loginAs(page, "e2e-user@example.com");
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await page.getByRole("button", { name: "登出" }).click();
  await page.waitForURL(/\/login/);
});
