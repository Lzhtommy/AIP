import { NextResponse } from "next/server";

export async function GET() {
  const endpoint = process.env.OS_ENDPOINT_URL;
  if (!endpoint) {
    return NextResponse.json(
      { status: "unconfigured" },
      { status: 500 },
    );
  }
  const key = process.env.OS_SECURITY_KEY;
  try {
    const res = await fetch(`${endpoint}/health`, {
      cache: "no-store",
      headers: key ? { authorization: `Bearer ${key}` } : undefined,
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json();
    return NextResponse.json({ status: data.status, runtime: data });
  } catch {
    return NextResponse.json(
      {
        status: "unreachable",
        error: {
          code: "ENDPOINT_UNREACHABLE",
          message: "无法连接当前 runtime 端点，请联系管理员检查端点配置",
        },
      },
      { status: 502 },
    );
  }
}
