export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** 尚未实现的模块渲染为「规划中」占位页 */
  planned: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "chat", label: "Chat 对话", href: "/chat", planned: false },
  { id: "sessions", label: "Sessions 会话", href: "/sessions", planned: true },
  { id: "memory", label: "Memory 记忆", href: "/memory", planned: true },
  { id: "knowledge", label: "Knowledge 知识库", href: "/knowledge", planned: true },
  { id: "traces", label: "Traces 追踪", href: "/traces", planned: true },
  { id: "metrics", label: "Metrics 指标", href: "/metrics", planned: true },
  { id: "evals", label: "Evals 评测", href: "/evals", planned: true },
];
