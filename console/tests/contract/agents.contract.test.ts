import { beforeAll, describe, expect, it } from "vitest";

/**
 * 契约测试：对真实 Agno runtime（docker compose up -d runtime）验证响应形状，
 * 捕获 Agno 升级带来的契约漂移。runtime 不可达时整组跳过。
 */
const RUNTIME_URL = process.env.CONTRACT_RUNTIME_URL ?? "http://localhost:7777";
const RUNTIME_KEY = process.env.CONTRACT_RUNTIME_KEY ?? "dev-local-security-key";

let reachable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${RUNTIME_URL}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    reachable = res.ok;
  } catch {
    reachable = false;
  }
});

describe("Agno runtime 契约", () => {
  it("/health 返回 status 字段", async ({ skip }) => {
    if (!reachable) return skip();
    const res = await fetch(`${RUNTIME_URL}/health`);
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });

  it("/agents 返回 id/name/model 形状（BFF 精简映射的依赖）", async ({ skip }) => {
    if (!reachable) return skip();
    const res = await fetch(`${RUNTIME_URL}/agents`, {
      headers: { authorization: `Bearer ${RUNTIME_KEY}` },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    for (const agent of list) {
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.name).toBe("string");
      expect(agent.model).toHaveProperty("provider");
      expect(agent.model).toHaveProperty("model");
    }
  });

  it("/teams 与 /workflows 返回 id/name 形状", async ({ skip }) => {
    if (!reachable) return skip();
    for (const kind of ["teams", "workflows"]) {
      const res = await fetch(`${RUNTIME_URL}/${kind}`, {
        headers: { authorization: `Bearer ${RUNTIME_KEY}` },
      });
      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      for (const item of list) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.name).toBe("string");
      }
    }
  });

  it("/traces 返回 {data, meta} 分页形状", async ({ skip }) => {
    if (!reachable) return skip();
    const res = await fetch(`${RUNTIME_URL}/traces?limit=1`, {
      headers: { authorization: `Bearer ${RUNTIME_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty("total_count");
  });

  it("/memories 返回 {data, meta} 分页形状，/memory_topics 返回字符串数组", async ({ skip }) => {
    if (!reachable) return skip();
    const res = await fetch(`${RUNTIME_URL}/memories?limit=1`, {
      headers: { authorization: `Bearer ${RUNTIME_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty("total_count");

    const topics = await fetch(`${RUNTIME_URL}/memory_topics`, {
      headers: { authorization: `Bearer ${RUNTIME_KEY}` },
    });
    expect(Array.isArray(await topics.json())).toBe(true);
  });

  it("/knowledge/content 返回 {data, meta} 分页形状", async ({ skip }) => {
    if (!reachable) return skip();
    const res = await fetch(`${RUNTIME_URL}/knowledge/content?limit=1`, {
      headers: { authorization: `Bearer ${RUNTIME_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty("total_count");
  });

  it("未带密钥访问 /agents 被拒绝（401/403）", async ({ skip }) => {
    if (!reachable) return skip();
    const res = await fetch(`${RUNTIME_URL}/agents`);
    expect([401, 403]).toContain(res.status);
  });
});
