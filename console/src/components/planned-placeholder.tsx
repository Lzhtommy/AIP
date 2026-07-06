import { Badge } from "@/components/ui/badge";

export function PlannedPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Badge variant="secondary">规划中</Badge>
      <p className="max-w-md text-sm text-muted-foreground">
        该模块在后续切片中交付，当前为占位入口。完整蓝图见项目 PRD。
      </p>
    </div>
  );
}
