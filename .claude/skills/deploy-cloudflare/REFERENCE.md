# Cloudflare Workers 部署参考

## 网络架构

```
浏览器 ──HTTPS──▶ Cloudflare Access（Zero Trust 鉴权）
                      │
                      ▼
              Worker: aip-console（Next.js BFF，持有 OS_SECURITY_KEY secret）
                      │  OS_ENDPOINT_URL
                      ▼
              Cloudflare Tunnel（cloudflared，跑在内网）
                      │
                      ▼
              内网 runtime :7777 ──▶ 内网 Postgres
```

- BFF 架构不变：浏览器仍不直连 runtime，Security Key 只存在于 Worker 服务端。
- runtime 通过 Cloudflare Tunnel 暴露：内网机器上 `cloudflared tunnel` 绑定一个仅供 Worker 访问的域名，建议再加 Access Service Token（Worker fetch 时带 `CF-Access-Client-Id/Secret` 头）双保险。
- Worker 域名本身必须加 Access 策略（限制公司邮箱域），否则违反"严禁公网可达"红线。

## 配置文件模板

### console/open-next.config.ts

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 最小配置。如需 ISR/revalidate 缓存，再按 opennext.js.org/cloudflare 加 R2 incrementalCache
export default defineCloudflareConfig();
```

### console/wrangler.jsonc

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "aip-console",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-04-14",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    { "binding": "WORKER_SELF_REFERENCE", "service": "aip-console" }
  ],
  "vars": {
    // 指向 Tunnel 域名；密钥不放这里
    "OS_ENDPOINT_URL": "https://aip-runtime.<你的域名>"
  }
}
```

### console/.dev.vars（本地 preview 用，不提交）

```
OS_ENDPOINT_URL=http://localhost:7777
OS_SECURITY_KEY=dev-local-security-key
```

### console/package.json scripts 追加

```json
{
  "preview": "BUILD_TARGET=cloudflare opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "BUILD_TARGET=cloudflare opennextjs-cloudflare build && opennextjs-cloudflare deploy",
  "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
}
```

## 密钥管理

| 变量 | 存放位置 | 说明 |
|---|---|---|
| `OS_SECURITY_KEY` | `wrangler secret put`（生产）/ `.dev.vars`（本地） | 与内网 runtime 的 `OS_SECURITY_KEY` 相同 |
| `OS_ENDPOINT_URL` | `wrangler.jsonc` vars | Tunnel 域名，非密钥 |
| `CF_ACCESS_CLIENT_ID/SECRET` | `wrangler secret put`（若 Tunnel 加了 Service Token） | BFF fetch runtime 时附带 |

`wrangler secret put` 后立即生效于下次部署，无需改代码。查看现有 secret：`npx wrangler secret list`。

## 故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| 构建报错提到 `standalone` / 找不到 `.open-next/worker.js` | `next.config.ts` 的 `output: "standalone"` 未按 `BUILD_TARGET` 关闭 | 检查 SKILL.md 初始化第 4 步 |
| `/api/health` 返回 runtime 不可达 | Tunnel 未运行 / `OS_ENDPOINT_URL` 配错 / Access Service Token 缺失 | 内网机器 `cloudflared tunnel list`；`curl -H "CF-Access-Client-Id: ..." https://aip-runtime.../health` 直接验证 |
| 部署后 401/403 | Access 策略把自己也挡了 | Zero Trust 控制台检查 Application 策略的 Include 规则 |
| `pnpm deploy` 报 workspace 错误 | 撞了 pnpm 内置 deploy 命令 | 用 `pnpm run deploy` |
| Node API 报 `not implemented` | 缺 `nodejs_compat` 或 `compatibility_date` 过旧（需 ≥2024-09-23） | 检查 wrangler.jsonc |
| 环境变量在代码里读不到 | Workers 里 env 不在 `process.env` 全局注入 | OpenNext 已桥接常见用法；若仍缺，运行 `pnpm run cf-typegen` 并用 `getCloudflareContext().env` 读取 |

## 升级与回滚

- 升级适配器：`pnpm add @opennextjs/cloudflare@latest wrangler@latest`，重新 `pnpm run preview` 验证。
- 回滚：Cloudflare Dashboard → Workers → aip-console → Deployments → Rollback，或 `npx wrangler rollback`。
- 灰度：用 `opennextjs-cloudflare upload` 生成新版本但不切流量，再在 Dashboard 按百分比灰度。
