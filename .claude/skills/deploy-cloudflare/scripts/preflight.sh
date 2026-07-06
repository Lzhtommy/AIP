#!/usr/bin/env bash
# 部署前检查：在 console/ 目录下运行。全部通过才建议执行 pnpm run deploy。
set -u

FAIL=0
ok()   { printf '  ✅ %s\n' "$1"; }
bad()  { printf '  ❌ %s\n' "$1"; FAIL=1; }
warn() { printf '  ⚠️  %s\n' "$1"; }

echo "== Cloudflare Workers 部署预检 =="

[ -f package.json ] && grep -q '"aip-console"' package.json \
  && ok "当前在 console/ 目录" \
  || bad "请在 console/ 目录下运行（未找到 aip-console 的 package.json）"

if [ -f wrangler.jsonc ] || [ -f wrangler.toml ]; then
  ok "wrangler 配置存在"
else
  bad "缺 wrangler.jsonc —— 先完成 SKILL.md 的首次初始化"
fi

[ -f open-next.config.ts ] \
  && ok "open-next.config.ts 存在" \
  || bad "缺 open-next.config.ts —— 先完成首次初始化"

if node -e 'const p=require("./package.json"); process.exit(p.dependencies?.["@opennextjs/cloudflare"]?0:1)' 2>/dev/null; then
  ok "@opennextjs/cloudflare 已安装"
else
  bad "未安装 @opennextjs/cloudflare"
fi

if grep -q 'BUILD_TARGET' next.config.ts 2>/dev/null; then
  ok "next.config.ts 已按 BUILD_TARGET 关闭 standalone"
elif grep -q 'standalone' next.config.ts 2>/dev/null; then
  bad "next.config.ts 仍无条件使用 output: standalone，与 OpenNext 冲突（见 SKILL.md 第 4 步）"
else
  ok "next.config.ts 无 standalone 冲突"
fi

# 注意：wrangler whoami 未登录时也可能退出码 0，必须看输出内容
WHOAMI_OUT=$(npx wrangler whoami 2>&1)
if echo "$WHOAMI_OUT" | grep -qi 'not authenticated'; then
  bad "wrangler 未登录 —— 运行 npx wrangler login"
else
  ok "wrangler 已登录：$(echo "$WHOAMI_OUT" | grep -o '[^ ]*@[^ ]*' | head -1)"
fi

if npx wrangler secret list 2>/dev/null | grep -q 'OS_SECURITY_KEY'; then
  ok "生产 secret OS_SECURITY_KEY 已配置"
else
  warn "未检测到 OS_SECURITY_KEY secret（首次部署前需 npx wrangler secret put OS_SECURITY_KEY）"
fi

grep -rq 'OS_ENDPOINT_URL' wrangler.jsonc 2>/dev/null \
  && ok "OS_ENDPOINT_URL 已在 wrangler.jsonc 配置" \
  || warn "wrangler.jsonc 未配置 OS_ENDPOINT_URL（Worker 将无法访问 runtime）"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "预检通过。可执行：pnpm run preview（本地验证）→ pnpm run deploy"
  echo "提醒：部署后确认 Cloudflare Access 策略已覆盖 Worker 域名（安全红线）。"
else
  echo "预检未通过，先解决上面的 ❌ 项。"
  exit 1
fi
