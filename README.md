# AIP — 内部私有化 AgentOS 控制台

复刻 Agno Control Plane（os.agno.com）的内部私有化控制台。后端使用开源 Agno runtime，前端为 Next.js BFF 架构：浏览器不直连 runtime，Security Key 只存在于服务端。

- PRD：见 [Issue #1](https://github.com/Lzhtommy/AIP/issues/1)，实现切片见 Issues #2–#12
- 结构：`console/`（Next.js 控制台）· `runtime/`（Agno 演示 AgentOS）· `docker-compose.yml`

## 快速开始

```bash
cp .env.example .env   # 必填：OS_SECURITY_KEY / AUTH_SECRET / ENCRYPTION_KEY（强随机）+ OPENAI_API_KEY
docker compose up -d   # postgres + runtime + console
open http://localhost:3000   # 第一个注册的账号自动成为 Admin
```

完整部署步骤与**安全红线清单**见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 本地开发

```bash
# 依赖：Node 24 + pnpm、Python 3.11+ + uv、Docker
docker compose up -d postgres

# runtime（http://localhost:7777，OpenAPI 文档在 /docs）
cd runtime && uv sync && OS_SECURITY_KEY=dev-local-security-key uv run python main.py

# console（另开终端）
cd console && pnpm install
OS_ENDPOINT_URL=http://localhost:7777 OS_SECURITY_KEY=dev-local-security-key pnpm dev
```

## 测试

```bash
cd console && pnpm test        # BFF 集成测试（真实 Next server + AgentOS stub）
cd console && pnpm test:e2e    # Playwright 冒烟（打生产构建）
cd runtime && uv run pytest    # runtime 冒烟（需先启动 postgres）
```

## 安全红线

- 本服务面向开放注册（切片 3 起），**只允许部署在内网/VPN 内**，严禁公网可达。
- `.env` 含密钥，绝不提交版本库；`OS_SECURITY_KEY` 生产环境使用强随机值。
- 国内网络访问 OpenAI/Anthropic 官方 API 需在 `.env` 配置 `HTTPS_PROXY`（runtime 容器内生效）。
