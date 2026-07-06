import type { TestServer } from "./next-server";

/** 模拟浏览器 cookie jar：去掉属性、同名 cookie 保留最后一个 */
function toJar(setCookies: string[]): Map<string, string> {
  const jar = new Map<string, string>();
  for (const c of setCookies) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return jar;
}

function jarToHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** 走真实 Auth.js HTTP 流程登录（CSRF → credentials callback），返回可复用的 Cookie 头 */
export async function login(
  server: TestServer,
  email: string,
  password: string,
): Promise<{ cookie: string; sessionEstablished: boolean }> {
  const csrfRes = await fetch(`${server.baseUrl}/api/auth/csrf`);
  const jar = toJar(csrfRes.headers.getSetCookie());
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const res = await fetch(`${server.baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jarToHeader(jar),
    },
    body: new URLSearchParams({ csrfToken, email, password }),
    redirect: "manual",
  });

  const authJar = toJar(res.headers.getSetCookie());
  const sessionEstablished = [...authJar.entries()].some(
    ([name, value]) => name.includes("session-token") && value.length > 0,
  );
  for (const [k, v] of authJar) jar.set(k, v);
  return { cookie: jarToHeader(jar), sessionEstablished };
}

export async function registerUser(
  server: TestServer,
  email: string,
  password: string,
): Promise<Response> {
  return fetch(`${server.baseUrl}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}
