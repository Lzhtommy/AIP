// Playwright webServer 用的 AgentOS stub：固定端口，供 next dev 的 BFF 代理访问
import { createServer } from "node:http";

const port = Number(process.env.STUB_PORT ?? 45678);
let lastSessionUserId = null;
let lastTraceUserId = null;
let lastMemoryUserId = null;

let evalRows = [
  {
    id: "ev-e2e",
    agent_id: "demo-assistant",
    name: "演示准确率评测",
    evaluated_component_name: "Demo Assistant",
    eval_type: "accuracy",
    eval_data: { score: 8.5, max_score: 10 },
    eval_input: { input: "137*73 等于多少" },
    created_at: "2026-07-08T10:00:00Z",
  },
];

const knowledgeRows = [
  {
    id: "kc-e2e",
    name: "产品手册",
    description: "内部产品说明",
    type: "text",
    size: 2048,
    status: "completed",
    status_message: "",
    created_at: "2026-07-08T09:00:00Z",
    updated_at: "2026-07-08T09:01:00Z",
  },
];
let knowledgeSeq = 0;

const AGENTS = [
  {
    id: "demo-assistant",
    name: "Demo Assistant",
    model: { provider: "OpenAI", model: "gpt-4.1-mini" },
  },
  {
    id: "slow-agent",
    name: "Slow Agent",
    model: { provider: "OpenAI", model: "gpt-4.1-mini" },
  },
  {
    id: "notify-agent",
    name: "Notify Agent",
    model: { provider: "OpenAI", model: "gpt-4.1-mini" },
  },
];

const PAUSE_EVENTS = [
  { event: "RunStarted", run_id: "run-hitl", session_id: "sess-hitl" },
  {
    event: "RunPaused",
    run_id: "run-hitl",
    session_id: "sess-hitl",
    tools: [
      {
        tool_call_id: "tc-hitl",
        tool_name: "send_notification",
        tool_args: { recipient: "alice", message: "hi" },
        requires_confirmation: true,
      },
    ],
  },
];

const CONTINUE_EVENTS = [
  { event: "RunContent", content: "已发送通知给 alice。" },
  { event: "RunCompleted" },
];

const RUN_EVENTS = [
  { event: "RunStarted", run_id: "run-e2e", session_id: "sess-e2e" },
  {
    event: "ToolCallStarted",
    tool: { tool_call_id: "tc-e2e", tool_name: "multiply", tool_args: { a: 137, b: 73 } },
  },
  {
    event: "ToolCallCompleted",
    tool: { tool_call_id: "tc-e2e", tool_name: "multiply", result: "10001" },
  },
  { event: "RunContent", content: "你好，" },
  { event: "RunContent", content: "这是 **e2e** 的流式回复。" },
  { event: "RunCompleted", content: "你好，这是 **e2e** 的流式回复。" },
];

// 慢速流：供「停止」按钮测试（20 段 × 250ms）
const SLOW_EVENTS = [
  { event: "RunStarted", run_id: "run-slow", session_id: "sess-slow" },
  ...Array.from({ length: 20 }, (_, i) => ({
    event: "RunContent",
    content: `第${i + 1}段。`,
  })),
  { event: "RunCompleted" },
];

const TEAMS = [{ id: "demo-team", name: "Demo Team" }];
const WORKFLOWS = [
  { id: "demo-workflow", name: "Demo Workflow", description: "两步演示流程" },
];

const TEAM_EVENTS = [
  { event: "TeamRunStarted", run_id: "team-run", session_id: "team-sess" },
  { event: "RunContent", content: "算得 10001。", agent_id: "demo-assistant", agent_name: "Demo Assistant" },
  { event: "RunContent", content: "结论已整理。", agent_id: "writer", agent_name: "Writer Agent" },
  { event: "TeamRunContent", content: "**团队汇总**：完成。" },
  { event: "TeamRunCompleted" },
];

const WORKFLOW_EVENTS = [
  { event: "WorkflowStarted", run_id: "wf-run", session_id: "wf-sess" },
  { event: "StepStarted", step_name: "计算" },
  { event: "StepCompleted", step_name: "计算" },
  { event: "StepStarted", step_name: "撰写" },
  { event: "RunContent", content: "流程产出文本。" },
  { event: "StepCompleted", step_name: "撰写" },
  { event: "WorkflowCompleted" },
];

const SESSION_LIST = {
  data: [
    {
      session_id: "sess-e2e",
      session_name: "E2E 会话",
      created_at: "2026-07-07T10:00:00Z",
      updated_at: "2026-07-07T10:05:00Z",
      session_type: "agent",
      user_id: "any",
      agent_id: "demo-assistant",
    },
  ],
  meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
};

function sessionDetail(userId) {
  return {
    session_id: "sess-e2e",
    session_name: "E2E 会话",
    user_id: userId,
    agent_id: "demo-assistant",
    chat_history: [],
  };
}

const SESSION_RUNS = [
  {
    run_id: "run-e2e",
    input: { input_content: "打个招呼" },
    content: "你好，这是 **e2e** 的流式回复。",
    tools: [
      {
        tool_call_id: "tc-e2e",
        tool_name: "multiply",
        tool_args: { a: 137, b: 73 },
        result: "10001",
      },
    ],
  },
];

const TRACE_SUMMARY = {
  trace_id: "tr-e2e",
  name: "Demo Assistant.run",
  status: "error",
  duration: 1234,
  total_spans: 3,
  error_count: 1,
  session_id: "sess-e2e",
  agent_id: "demo-assistant",
  created_at: "2026-07-07T10:00:00Z",
};

const TRACE_TREE = {
  id: "n-root",
  name: "Demo Assistant.run",
  type: "agent_run",
  duration: 1234,
  status: "error",
  spans: [
    {
      id: "n-llm",
      name: "OpenAIChat.invoke",
      type: "model_call",
      duration: 900,
      status: "ok",
      metadata: { input_tokens: 120, output_tokens: 45 },
      spans: [],
    },
    {
      id: "n-tool",
      name: "multiply",
      type: "tool_call",
      duration: 30,
      status: "error",
      error: "boom: 演示错误",
      spans: [],
    },
  ],
};

let memoryDeleted = false;

function memoryRow(userId) {
  return {
    memory_id: "mem-e2e",
    memory: "用户喜欢简洁的中文回复",
    topics: ["preferences"],
    agent_id: "demo-assistant",
    team_id: null,
    user_id: userId,
    updated_at: "2026-07-08T10:00:00Z",
  };
}

createServer((req, res) => {
  const url = req.url ?? "";
  if (url.startsWith("/eval-runs")) {
    const m = url.match(/^\/eval-runs\/([^/?]+)/);
    if (m) {
      const row = evalRows.find((r) => r.id === m[1]);
      res.writeHead(row ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(row ?? {}));
      return;
    }
    if (req.method === "DELETE") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const ids = JSON.parse(body).eval_run_ids ?? [];
          evalRows = evalRows.filter((r) => !ids.includes(r.id));
        } catch {}
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: evalRows,
        meta: { page: 1, limit: 20, total_pages: 1, total_count: evalRows.length },
      }),
    );
    return;
  }
  if (url.startsWith("/metrics/refresh") && req.method === "POST") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (url.startsWith("/metrics")) {
    const day = (date, runs, tokens, users) => ({
      date,
      agent_runs_count: runs,
      team_runs_count: 0,
      workflow_runs_count: 0,
      users_count: users,
      token_metrics: { total_tokens: tokens },
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        metrics: [day("2026-07-06", 3, 1000, 2), day("2026-07-07", 5, 2000, 3)],
        updated_at: "2026-07-08T00:00:00Z",
      }),
    );
    return;
  }
  if (url === "/knowledge/search" && req.method === "POST") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: [
            {
              id: "chunk-e2e",
              content: "AIP 是内部私有化的 AgentOS 控制台。",
              name: "产品手册",
              content_id: "kc-e2e",
              reranking_score: 0.91,
            },
          ],
          meta: { page: 1, limit: 10, total_pages: 1, total_count: 1 },
        }),
      );
    });
    return;
  }
  // knowledge：有状态 stub（添加/删除/状态）
  if (url.startsWith("/knowledge/content")) {
    const m = url.match(/^\/knowledge\/content\/([^/?]+)(\/status)?/);
    if (m && m[2]) {
      const row = knowledgeRows.find((r) => r.id === m[1]);
      res.writeHead(row ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(row ? { id: row.id, status: row.status, status_message: "" } : {}));
      return;
    }
    if (m && req.method === "DELETE") {
      const idx = knowledgeRows.findIndex((r) => r.id === m[1]);
      if (idx !== -1) knowledgeRows.splice(idx, 1);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const nameMatch = body.match(/name="name"\r\n\r\n([^\r]+)/);
        knowledgeRows.push({
          id: `kc-new-${knowledgeSeq++}`,
          name: nameMatch ? nameMatch[1] : "未命名",
          description: null,
          type: "text",
          size: 128,
          status: "completed",
          status_message: "",
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: knowledgeRows,
        meta: { page: 1, limit: 20, total_pages: 1, total_count: knowledgeRows.length },
      }),
    );
    return;
  }
  if (url === "/memory_topics") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(["preferences"]));
    return;
  }
  if (url.startsWith("/memories/mem-e2e")) {
    if (req.method === "DELETE") {
      memoryDeleted = true;
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(memoryRow(lastMemoryUserId ?? "any")));
    return;
  }
  if (url.startsWith("/memories")) {
    const userId = new URL(url, "http://x").searchParams.get("user_id");
    if (userId) lastMemoryUserId = userId;
    const data = memoryDeleted ? [] : [memoryRow(userId ?? "any")];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data,
        meta: { page: 1, limit: 20, total_pages: 1, total_count: data.length },
      }),
    );
    return;
  }
  if (url.startsWith("/traces/tr-e2e")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ ...TRACE_SUMMARY, user_id: lastTraceUserId ?? "any", tree: TRACE_TREE }),
    );
    return;
  }
  if (url.startsWith("/traces")) {
    const userId = new URL(url, "http://x").searchParams.get("user_id");
    if (userId) lastTraceUserId = userId;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: [{ ...TRACE_SUMMARY, user_id: userId ?? "any" }],
        meta: { page: 1, limit: 20, total_pages: 1, total_count: 1 },
      }),
    );
    return;
  }
  // sessions：列表按请求的 user_id 回显归属，详情同理（stub 无状态）
  if (url.startsWith("/sessions/sess-e2e/runs")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(SESSION_RUNS));
    return;
  }
  if (url.startsWith("/sessions/sess-e2e")) {
    // BFF 对 Member 会下推 user_id，直接回显即可（无共享状态、并发安全）
    const userId = new URL(url, "http://x").searchParams.get("user_id");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(sessionDetail(userId ?? lastSessionUserId ?? "any")));
    return;
  }
  if (url.startsWith("/sessions")) {
    const userId = new URL(url, "http://x").searchParams.get("user_id");
    if (userId) lastSessionUserId = userId;
    const data = SESSION_LIST.data.map((s) => ({ ...s, user_id: userId ?? s.user_id }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...SESSION_LIST, data }));
    return;
  }
  if (url === "/config") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        chat: {
          quick_prompts: {
            "demo-assistant": ["帮我算 137×73", "介绍一下 AIP"],
          },
        },
      }),
    );
    return;
  }
  if (url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "e2e-stub" }));
    return;
  }
  if (url === "/agents/demo-assistant") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "demo-assistant",
        name: "Demo Assistant",
        model: { provider: "OpenAI", model: "gpt-4.1-mini" },
        system_message: { instructions: "你是 AIP 演示助手" },
        knowledge: { knowledge_table: "agno_knowledge" },
        memory: { enable_user_memories: true },
        tools: {
          tools: [
            { name: "multiply", requires_confirmation: false },
            { name: "send_notification", description: "发通知", requires_confirmation: true },
          ],
        },
      }),
    );
    return;
  }
  if (url === "/agents") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(AGENTS));
    return;
  }
  if (url === "/teams") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(TEAMS));
    return;
  }
  if (url === "/workflows") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(WORKFLOWS));
    return;
  }
  if (url === "/agents/notify-agent/runs/run-hitl/continue" && req.method === "POST") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      let i = 0;
      const timer = setInterval(() => {
        if (i >= CONTINUE_EVENTS.length) { clearInterval(timer); res.end(); return; }
        res.write(`data: ${JSON.stringify(CONTINUE_EVENTS[i++])}\n\n`);
      }, 60);
      res.on("close", () => clearInterval(timer));
    });
    return;
  }
  if (url === "/agents/notify-agent/runs" && req.method === "POST") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      let i = 0;
      const timer = setInterval(() => {
        if (i >= PAUSE_EVENTS.length) { clearInterval(timer); res.end(); return; }
        res.write(`data: ${JSON.stringify(PAUSE_EVENTS[i++])}\n\n`);
      }, 60);
      res.on("close", () => clearInterval(timer));
    });
    return;
  }
  const runMatch = url.match(
    /^\/(?:agents\/(demo-assistant|slow-agent)|teams\/demo-team|workflows\/demo-workflow)\/runs$/,
  );
  if (runMatch && req.method === "POST") {
    const events = url.startsWith("/teams/")
      ? TEAM_EVENTS
      : url.startsWith("/workflows/")
        ? WORKFLOW_EVENTS
        : runMatch[1] === "slow-agent"
          ? SLOW_EVENTS
          : RUN_EVENTS;
    const interval = runMatch[1] === "slow-agent" ? 250 : 120;
    req.resume(); // 丢弃请求体
    req.on("end", () => {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      let i = 0;
      const timer = setInterval(() => {
        if (i >= events.length) {
          clearInterval(timer);
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify(events[i++])}\n\n`);
      }, interval);
      res.on("close", () => clearInterval(timer));
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ detail: "Not Found" }));
}).listen(port, "127.0.0.1", () => {
  console.log(`AgentOS stub listening on http://127.0.0.1:${port}`);
});
