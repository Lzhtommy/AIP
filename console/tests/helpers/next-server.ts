import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

const CONSOLE_ROOT = path.resolve(__dirname, "../..");

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export interface TestServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

/**
 * 以真实 `next dev` 进程启动控制台（随机端口），测试用 fetch 打真 HTTP。
 * env 会透传给服务进程（如 OS_ENDPOINT_URL / OS_SECURITY_KEY）。
 */
export async function startConsole(
  env: Record<string, string> = {},
): Promise<TestServer> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "dev", "--port", String(port)],
    {
      cwd: CONSOLE_ROOT,
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  let output = "";
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`next dev exited early:\n${output}`);
    }
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      break; // 任何 HTTP 响应都说明服务已就绪
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`next dev not ready within 60s:\n${output}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return {
    baseUrl,
    stop: async () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          /* 已退出 */
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    },
  };
}
