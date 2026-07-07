# 部署指南

内网服务器从零部署 AIP（控制台 + 演示 runtime + Postgres）。

## 前置条件

- Docker 与 Docker Compose v2
- 服务器只在内网/VPN 可达（见下方安全红线）
- OpenAI API Key（演示 Agent 使用；国内网络需配代理）

## 步骤

```bash
git clone https://github.com/Lzhtommy/AIP.git && cd AIP

cp .env.example .env
# 必填三项用强随机值：
#   OS_SECURITY_KEY=$(openssl rand -base64 32)
#   AUTH_SECRET=$(openssl rand -base64 32)
#   ENCRYPTION_KEY=$(openssl rand -base64 32)
# 再填 OPENAI_API_KEY；国内网络填 HTTPS_PROXY（runtime 容器内生效）

docker compose up -d
open http://<服务器地址>:3000
```

首次启动自动完成：Postgres 建 `console` 库（pg-init）、控制台迁移（instrumentation）、
runtime 端点种子录入（`OS_ENDPOINT_URL` 表空时生效）。

**第一个注册的账号自动成为 Admin**——部署完成后请立即注册，抢占管理员。

## 可选：OAuth 登录

在 `.env` 配置 `AUTH_GITHUB_ID/SECRET`（或 Google 对应项）后 `docker compose up -d console`
重启，登录页自动出现对应按钮。回调地址：`http://<控制台地址>/api/auth/callback/<provider>`。

## 安全红线（上线前逐项检查）

- [ ] **本服务开放注册，严禁公网可达**——只允许部署在内网/VPN 内，防火墙确认 3000/7777/5532 不对公网开放
- [ ] `.env` 不提交版本库（已在 .gitignore），密钥用 `openssl rand -base64 32` 生成
- [ ] **备份 `ENCRYPTION_KEY`**——丢失后已存端点密钥不可恢复，只能重新录入
- [ ] runtime 的 7777 端口只需对控制台容器可达，不必暴露给办公网（compose 内网络已隔离，移除 ports 映射即可收紧）
- [ ] Google OAuth 在国内网络可能不可达（登录跳转需访问 google.com），GitHub 通常正常

## 升级

```bash
git pull && docker compose build && docker compose up -d
```

数据库迁移在控制台启动时自动应用。

## 验证部署

```bash
curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"     # 307（重定向登录页）
curl -s -X POST http://localhost:3000/api/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"at-least-8-chars"}'    # 201
```

浏览器注册登录后：系统状态页应显示 runtime「运行正常」。

## 测试体系（开发机）

| 层 | 命令 | 说明 |
|---|---|---|
| BFF 集成 + 归约层 + 契约 | `cd console && pnpm test` | 真实 Next server + AgentOS stub；契约用例在 compose runtime 运行时自动启用 |
| E2E（含黄金路径） | `cd console && pnpm test:e2e` | 生产构建 + stub runtime |
| runtime 冒烟 | `cd runtime && uv run pytest` | 需 `docker compose up -d postgres`；配置 OPENAI_API_KEY 后会真实跑一轮 Agent |
