// Playwright webServer 用的 AgentOS stub：固定端口，供 next dev 的 BFF 代理访问
import { createServer } from "node:http";

const port = Number(process.env.STUB_PORT ?? 45678);

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

createServer((req, res) => {
  const url = req.url ?? "";
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
  const runMatch = url.match(/^\/agents\/(demo-assistant|slow-agent)\/runs$/);
  if (runMatch && req.method === "POST") {
    const events = runMatch[1] === "slow-agent" ? SLOW_EVENTS : RUN_EVENTS;
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
