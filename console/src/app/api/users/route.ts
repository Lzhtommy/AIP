import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/** 用户列表（仅 Admin） */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可管理用户" } },
      { status: 403 },
    );
  }
  const list = await db.query.users.findMany({
    orderBy: asc(users.createdAt),
    columns: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(list);
}
