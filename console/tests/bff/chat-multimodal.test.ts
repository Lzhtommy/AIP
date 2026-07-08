import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "multimodal-tester";
// 1x1 PNG
const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

describe("Chat 多模态（图片上传）", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let cookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/agents/demo-assistant/runs", {
        sse: [
          { event: "RunStarted", run_id: "r1", session_id: "s1" },
          { event: "RunContent", content: "看到图片了" },
          { event: "RunCompleted" },
        ],
      });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "mm@example.com", PASSWORD);
    cookie = (await login(server, "mm@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  function form(message: string, file?: { name: string; type: string; bytes: Uint8Array }) {
    const fd = new FormData();
    fd.set("message", message);
    if (file) {
      fd.set(
        "files",
        new Blob([file.bytes as BlobPart], { type: file.type }),
        file.name,
      );
    }
    return fd;
  }

  it("带图片的 multipart 请求：透传 files 并强制注入 user_id", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/agents/demo-assistant/runs`, {
      method: "POST",
      headers: { cookie },
      body: form("这是什么", { name: "pic.png", type: "image/png", bytes: PNG_BYTES }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const upstream = stub.requests
      .filter((r) => r.path === "/agents/demo-assistant/runs")
      .at(-1)!;
    expect(upstream.headers["content-type"]).toContain("multipart/form-data");
    expect(upstream.body).toContain('name="files"');
    expect(upstream.body).toContain("pic.png");
    // user_id 仍被强制注入为 uuid
    expect(upstream.body).toMatch(/name="user_id"[\s\S]{0,10}[0-9a-f-]{36}/);
    expect(upstream.body).not.toContain("forged");
  });

  it("非图片文件被拒 400", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/agents/demo-assistant/runs`, {
      method: "POST",
      headers: { cookie },
      body: form("附件", {
        name: "evil.exe",
        type: "application/octet-stream",
        bytes: PNG_BYTES,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("纯文本 JSON 请求仍正常（向后兼容）", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/agents/demo-assistant/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ message: "纯文本" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});
