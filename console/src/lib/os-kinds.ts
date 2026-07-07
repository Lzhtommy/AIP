/** BFF 可代理的运行目标类型（与 runtime 的资源路径一一对应） */
export const OS_KINDS = ["agents", "teams", "workflows"] as const;
export type OsKind = (typeof OS_KINDS)[number];

export function isOsKind(value: string): value is OsKind {
  return (OS_KINDS as readonly string[]).includes(value);
}
