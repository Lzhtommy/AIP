import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("附图发送 → 缩略图可见 → 流式回复", async ({ page }) => {
  await loginAs(page, "e2e-mm@example.com");
  await page.goto("/chat");
  await expect(page.getByText("Demo Assistant").first()).toBeVisible();

  await page.getByLabel("选择图片").setInputFiles({
    name: "pic.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  // 附件预览出现
  await expect(page.getByTestId("attachment-previews")).toBeVisible();

  await page.getByLabel("消息输入").fill("这是什么图片");
  await page.getByRole("button", { name: "发送" }).click();

  const list = page.getByTestId("message-list");
  // 用户消息中显示图片缩略图
  await expect(list.getByTestId("chat-image")).toBeVisible();
  await expect(list.getByText("这是什么图片")).toBeVisible();
  // 流式回复到达
  await expect(list.getByText("e2e")).toBeVisible();
});
