// Playwright webServer 用的 AgentOS stub：固定端口，供 next dev 的 BFF 代理访问
import { createServer } from "node:http";

const port = Number(process.env.STUB_PORT ?? 45678);
let lastSeenUserId = null;

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

createServer((req, res) => {
  const url = req.url ?? "";
  // sessions：列表按请求的 user_id 回显归属，详情同理（stub 无状态）
  if (url.startsWith("/sessions/sess-e2e/runs")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(SESSION_RUNS));
    return;
  }
  if (url.startsWith("/sessions/sess-e2e")) {
    const userId = new URL(url, "http://x").searchParams.get("user_id");
    // 详情不带 user_id 参数——回显列表请求最近一次见到的 user_id
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(sessionDetail(lastSeenUserId ?? userId ?? "any")));
    return;
  }
  if (url.startsWith("/sessions")) {
    const userId = new URL(url, "http://x").searchParams.get("user_id");
    if (userId) lastSeenUserId = userId;
    const data = SESSION_LIST.data.map((s) => ({ ...s, user_id: userId ?? s.user_id }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...SESSION_LIST, data }));
    return;
  }
  if (url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "e2e-stub" }));
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
