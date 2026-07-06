import type { Page } from "@playwright/test";

export const E2E_PASSWORD = "e2e-password-123";

/** 注册（已存在则忽略 409）并通过登录页 UI 登录，结束时位于控制台首页 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.request.post("/api/register", {
    data: { email, password: E2E_PASSWORD, name: email.split("@")[0] },
  });
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("/");
}
