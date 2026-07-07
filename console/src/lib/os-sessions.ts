import type { OsKind } from "@/lib/os-kinds";

/** BFF 的 kind（复数） ↔ runtime sessions API 的 type（单数） */
export const KIND_TO_TYPE: Record<OsKind, string> = {
  agents: "agent",
  teams: "team",
  workflows: "workflow",
};

interface UpstreamSessionSummary {
  session_id: string;
  session_name?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: string | null;
  agent_id?: string | null;
  team_id?: string | null;
  workflow_id?: string | null;
}

export function mapSessionSummary(s: UpstreamSessionSummary) {
  return {
    sessionId: s.session_id,
    name: s.session_name ?? null,
    createdAt: s.created_at ?? null,
    updatedAt: s.updated_at ?? null,
    userId: s.user_id ?? null,
    targetId: s.agent_id ?? s.team_id ?? s.workflow_id ?? null,
  };
}

interface UpstreamTool {
  tool_call_id?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  result?: unknown;
}

interface UpstreamRun {
  run_id?: string;
  input?: { input_content?: unknown } | string | null;
  content?: unknown;
  tools?: UpstreamTool[] | null;
}

interface ReplayPart {
  type: "text" | "tool";
  text?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: string;
  status?: "done";
}

export interface ReplayMessage {
  role: "user" | "assistant";
  parts: ReplayPart[];
}

function runInputText(input: UpstreamRun["input"]): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "input_content" in input) {
    return String(input.input_content ?? "");
  }
  return "";
}

/** 把 runtime 的历史 runs / chat_history 映射为与实时渲染同构的消息结构 */
export function buildReplayMessages(
  runs: UpstreamRun[],
  chatHistory: Array<{ role?: string; content?: unknown }>,
): ReplayMessage[] {
  if (runs.length > 0) {
    const messages: ReplayMessage[] = [];
    for (const run of runs) {
      const input = runInputText(run.input);
      if (input) {
        messages.push({ role: "user", parts: [{ type: "text", text: input }] });
      }
      const parts: ReplayPart[] = (run.tools ?? []).map((t, i) => ({
        type: "tool",
        id: t.tool_call_id ?? `tool-${i}`,
        name: t.tool_name ?? "unknown",
        args: t.tool_args,
        result: t.result === undefined ? undefined : String(t.result),
        status: "done",
      }));
      if (typeof run.content === "string" && run.content) {
        parts.push({ type: "text", text: run.content });
      }
      messages.push({ role: "assistant", parts });
    }
    return messages;
  }
  return chatHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: String(m.content ?? "") }],
    }));
}
