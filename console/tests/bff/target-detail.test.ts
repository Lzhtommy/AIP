import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentOSStub } from "../helpers/agentos-stub";
import { login, registerUser } from "../helpers/auth";
import { resetUsers } from "../helpers/db";
import { consoleEnv } from "../helpers/env";
import { startConsole, type TestServer } from "../helpers/next-server";

const PASSWORD = "detail-tester-1";

describe("运行目标配置详情 BFF", () => {
  let server: TestServer;
  let stub: AgentOSStub;
  let cookie: string;

  beforeAll(async () => {
    await resetUsers();
    stub = new AgentOSStub()
      .on("/health", { body: { status: "ok" } })
      .on("/agents/demo-assistant", {
        body: {
          id: "demo-assistant",
          name: "Demo Assistant",
          model: { provider: "Anthropic", model: "claude-opus-4-8" },
          system_message: { instructions: "你是演示助手", markdown: true },
          knowledge: { knowledge_table: "agno_knowledge" },
          memory: { enable_user_memories: true },
          tools: {
            tools: [
              { name: "multiply", requires_confirmation: false },
              {
                name: "send_notification",
                description: "发通知",
                requires_confirmation: true,
              },
            ],
          },
        },
      })
      .on("/teams/demo-team", {
        body: {
          id: "demo-team",
          name: "Demo Team",
          model: { provider: "Anthropic", model: "claude-opus-4-8" },
          members: [
            { id: "demo-assistant", name: "Demo Assistant", model: { model: "claude-opus-4-8" } },
            { id: "writer", name: "Writer Agent", role: "整理", model: { model: "claude-opus-4-8" } },
          ],
        },
      })
      .on("/workflows/demo-workflow", {
        body: {
          id: "demo-workflow",
          name: "Demo Workflow",
          description: "两步流程",
          steps: [{ name: "计算" }, { name: "撰写" }],
        },
      });
    await stub.start();
    server = await startConsole(
      consoleEnv({ OS_ENDPOINT_URL: stub.url, OS_SECURITY_KEY: "k" }),
    );
    await registerUser(server, "d@example.com", PASSWORD);
    cookie = (await login(server, "d@example.com", PASSWORD)).cookie;
  });

  afterAll(async () => {
    await server?.stop();
    await stub?.stop();
  });

  it("agent 详情：模型/指令/工具/知识记忆开关", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/agents/demo-assistant`, {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "demo-assistant",
      name: "Demo Assistant",
      kind: "agents",
      model: { provider: "Anthropic", model: "claude-opus-4-8" },
      instructions: "你是演示助手",
      knowledgeEnabled: true,
      memoryEnabled: true,
    });
    expect(body.tools).toEqual([
      { name: "multiply", description: null, requiresConfirmation: false },
      { name: "send_notification", description: "发通知", requiresConfirmation: true },
    ]);
    // 内部实现细节不外泄
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("agno_knowledge");
  });

  it("team 详情：成员列表", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/teams/demo-team`, {
      headers: { cookie },
    });
    const body = await res.json();
    expect(body.kind).toBe("teams");
    expect(body.members).toEqual([
      { id: "demo-assistant", name: "Demo Assistant", role: null },
      { id: "writer", name: "Writer Agent", role: "整理" },
    ]);
  });

  it("workflow 详情：步骤列表", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/workflows/demo-workflow`, {
      headers: { cookie },
    });
    const body = await res.json();
    expect(body.kind).toBe("workflows");
    expect(body.description).toBe("两步流程");
    expect(body.steps).toEqual(["计算", "撰写"]);
  });

  it("未知类型 404", async () => {
    const res = await fetch(`${server.baseUrl}/api/os/hackers/x`, {
      headers: { cookie },
    });
    expect(res.status).toBe(404);
  });
});
