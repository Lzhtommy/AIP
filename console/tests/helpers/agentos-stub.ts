import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  body: string;
}

export interface StubRoute {
  status?: number;
  body?: unknown;
  /** 配置后按 SSE 流式返回这些事件（依次写出 data: 行） */
  sse?: Array<Record<string, unknown>>;
}

/**
 * 假 AgentOS runtime：按路径回放配置的响应，并记录收到的每个请求
 * （方法/路径/请求头/请求体），供测试断言 BFF 的上游行为。
 */
export class AgentOSStub {
  private server: Server | null = null;
  private routes = new Map<string, StubRoute>();
  readonly requests: RecordedRequest[] = [];

  on(path: string, route: StubRoute): this {
    this.routes.set(path, route);
    return this;
  }

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        this.requests.push({
          method: req.method ?? "",
          path: req.url ?? "",
          headers: req.headers,
          body,
        });
        const route = this.routes.get(req.url ?? "");
        if (!route) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ detail: "Not Found" }));
          return;
        }
        if (route.sse) {
          res.writeHead(route.status ?? 200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          });
          for (const event of route.sse) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
          res.end();
          return;
        }
        res.writeHead(route.status ?? 200, { "content-type": "application/json" });
        res.end(JSON.stringify(route.body));
      });
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(0, "127.0.0.1", resolve),
    );
    return this.url;
  }

  get url(): string {
    const addr = this.server?.address() as AddressInfo;
    return `http://127.0.0.1:${addr.port}`;
  }

  requestsFor(path: string): RecordedRequest[] {
    return this.requests.filter((r) => r.path === path);
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) =>
      this.server!.close((err) => (err ? reject(err) : resolve())),
    );
    this.server = null;
  }
}
