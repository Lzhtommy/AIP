// Playwright webServer 用的 AgentOS stub：固定端口，供 next dev 的 BFF 代理访问
import { createServer } from "node:http";

const port = Number(process.env.STUB_PORT ?? 45678);

const AGENTS = [
  {
    id: "demo-assistant",
    name: "Demo Assistant",
    model: { provider: "OpenAI", model: "gpt-4.1-mini" },
  },
];

const RUN_EVENTS = [
  { event: "RunStarted", run_id: "run-e2e", session_id: "sess-e2e" },
  { event: "RunContent", content: "你好，" },
  { event: "RunContent", content: "这是 **e2e** 的流式回复。" },
  { event: "RunCompleted", content: "你好，这是 **e2e** 的流式回复。" },
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
  if (url === "/agents/demo-assistant/runs" && req.method === "POST") {
    req.resume(); // 丢弃请求体
    req.on("end", () => {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      let i = 0;
      const timer = setInterval(() => {
        if (i >= RUN_EVENTS.length) {
          clearInterval(timer);
          res.end();
          return;
        }
        res.write(`data: ${JSON.stringify(RUN_EVENTS[i++])}\n\n`);
      }, 120); // 模拟真实流式节奏
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ detail: "Not Found" }));
}).listen(port, "127.0.0.1", () => {
  console.log(`AgentOS stub listening on http://127.0.0.1:${port}`);
});
