---
name: deploy-cloudflare
description: 将本项目的 console（Next.js 16 BFF）通过 @opennextjs/cloudflare 部署到 Cloudflare Workers，含首次初始化、密钥配置、本地预览与发布。Use when 用户要求部署到 Cloudflare / Workers / wrangler 发布 / 上线控制台，或提到 opennextjs、cf 部署。
---

# 部署到 Cloudflare Workers

## 范围与红线（先读）

- **只部署 `console/`**。`runtime/`（Python AgentOS）和 Postgres 无法跑在 Workers 上，仍留在内网 Docker；Worker 通过 `OS_ENDPOINT_URL` 访问 runtime。
- **安全红线**：README 规定本服务只允许内网/VPN 可达。部署到 Workers 默认是公网可达的——**必须**同时配置 Cloudflare Access（Zero Trust）限制访问，并用 Cloudflare Tunnel 暴露内网 runtime。方案见 [REFERENCE.md](REFERENCE.md#网络架构)。
- `OS_SECURITY_KEY` 只能走 `wrangler secret put`，绝不写进 `wrangler.jsonc` 的 `vars`。

## 快速部署（已初始化过）

```bash
cd console
bash ../.claude/skills/deploy-cloudflare/scripts/preflight.sh   # 检查登录态与配置
pnpm run deploy        # 注意：必须 pnpm run deploy，裸 pnpm deploy 是 pnpm 内置命令
```

本地先验证再发布：`pnpm run preview`（在 workerd 运行时里跑生产构建）。

## 首次初始化 checklist

按顺序执行，全部在 `console/` 目录下：

1. `pnpm add @opennextjs/cloudflare@latest && pnpm add -D wrangler@latest`
2. `npx wrangler login`（需要用户在浏览器完成授权，建议提示用户用 `! npx wrangler login` 自己跑）
3. 创建 `open-next.config.ts`、`wrangler.jsonc`、`.dev.vars` —— 模板见 [REFERENCE.md](REFERENCE.md#配置文件模板)
4. **改 `next.config.ts`**：`output: "standalone"` 与 OpenNext 冲突，改为按环境开关：
   ```ts
   output: process.env.BUILD_TARGET === "cloudflare" ? undefined : "standalone",
   ```
   并在 deploy/preview 脚本里注入 `BUILD_TARGET=cloudflare`（见 REFERENCE.md 的 package.json 片段）
5. `.gitignore` 追加 `.open-next/`、`.dev.vars`、`cloudflare-env.d.ts`
6. 配置密钥与变量：
   ```bash
   npx wrangler secret put OS_SECURITY_KEY     # 生产密钥，与内网 runtime 一致
   # OS_ENDPOINT_URL 写在 wrangler.jsonc 的 vars 里（非密钥），指向 Tunnel 域名
   ```
7. `pnpm run preview` 本地验证 → `pnpm run deploy` 发布
8. 在 Cloudflare Zero Trust 控制台给 Worker 域名加 Access 策略（不做这步 = 违反安全红线，部署完必须提醒用户）

## 验证

部署输出会给出 `https://<name>.<subdomain>.workers.dev`。验证：

```bash
curl -s https://<worker-url>/api/health   # BFF 健康代理，应返回 runtime 健康状态
```

若返回 runtime 连接错误，是 `OS_ENDPOINT_URL` 不可达或 Tunnel 未起，见 [REFERENCE.md](REFERENCE.md#故障排查)。

## 故障排查 / 配置详情

模板、网络架构、常见报错都在 [REFERENCE.md](REFERENCE.md)。
