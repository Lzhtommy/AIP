# PRD：Agno Control Plane 复刻（内部私有化 AgentOS 控制台）

## Problem Statement

公司内部计划用开源 Agno 框架构建 multi-agent 系统。Agno 的 Runtime 是开源的、可以跑在内网，但它的管理控制台（os.agno.com）是闭源 SaaS：

- 控制台 UI 托管在 Agno 手里，账号体系、可用性、改版节奏都不受控；
- 官方控制台要求浏览器直连 runtime，意味着 runtime 必须对全办公网开 CORS 并可达，且 runtime 的 Security Key 要下发到每个使用者的浏览器 localStorage——任何能打开控制台的人都拿得到裸密钥；
- 无法接入公司自己的登录方式，无法区分操作人，无法对"谁能改配置、谁能删数据"做任何限制；
- 内网/私有云环境下未必允许访问外部 SaaS。

团队需要一个**可私有化部署**的控制台：功能上对齐 os.agno.com 的核心能力（对话、会话管理、执行追踪），安全上密钥不出服务端、用户有身份有角色，部署上内网一键拉起。

## Solution

从零构建一个 Next.js 控制台，复刻 Agno Control Plane 的信息架构与核心交互：

- **BFF 代理架构**：浏览器只和控制台通信，控制台服务端持有各 runtime 的 Security Key 并代理所有请求（含 SSE 流式透传）；runtime 网络上可以只对控制台服务器开放。
- **登录与角色**：Auth.js 提供账号密码 + Google/GitHub OAuth 登录（开放注册），两级角色 Admin / Member，首个注册账号自动成为 Admin。
- **多端点**：Admin 管理多个 AgentOS runtime 端点（名称/URL/密钥，密钥加密存库），所有用户通过全局切换器选择当前端点。
- **第一版功能**：Chat（SSE 流式、Markdown、工具调用步骤实时可视化、Agent/Team/Workflow 三类目标）、Sessions（Member 只见自己，Admin 全局视角）、Traces（执行追踪详情，可见性跟随会话）；Memory / Knowledge / Metrics / Evals 留占位入口。
- **配套演示 runtime**：Python + 开源 Agno 搭建，含带工具的 Agent、Team、Workflow 各若干，接 Postgres、开 tracing，作为开发/验收环境。
- **交付形态**：Monorepo（console + runtime + docker-compose），内网服务器 `docker compose up -d` 完成部署。

UI 为中文文案 + 英文领域术语（Agent、Team、Workflow、Session、Trace），暗色主题，信息架构对齐 os.agno.com，视觉基于 shadcn/ui 自由发挥，不追求像素级复刻。

## User Stories

### 认证与准入

1. As a 内部同事, I want 用邮箱账号密码登录控制台, so that 在不依赖第三方 OAuth 的情况下也能使用平台。
2. As a 内部同事, I want 用 Google 或 GitHub 账号一键登录, so that 不用记新密码就能开始使用。
3. As a 新用户, I want 注册后立即可用（开放注册）, so that 不需要等管理员开通就能体验平台。
4. As a 平台的第一个注册者, I want 自动获得 Admin 角色, so that 系统冷启动时不需要手工进数据库设置管理员。
5. As a Member, I want 在未登录访问任何页面时被重定向到登录页, so that 平台数据不会暴露给未认证的人。
6. As an Admin, I want 在用户管理页查看所有注册用户并调整其角色（Admin/Member）, so that 可以控制谁拥有管理权限。

### 端点管理

7. As an Admin, I want 添加一个 runtime 端点（名称、Base URL、Security Key）, so that 控制台可以连接到内网的 AgentOS 实例。
8. As an Admin, I want 编辑和删除已有端点, so that 环境变更（迁移、下线）时配置能跟上。
9. As an Admin, I want 端点的 Security Key 在数据库中加密存储、在界面上永不回显明文, so that 即使数据库泄露或截屏外传，密钥也不暴露。
10. As an Admin, I want 添加端点时自动做连通性检测并显示 runtime 版本/健康状态, so that 配置错误能立刻发现而不是等用户报障。
11. As a Member, I want 在顶部全局切换器中选择当前工作的端点, so that 可以在 dev/staging/prod 多套 runtime 之间切换。
12. As a Member, I want 当前端点不可达时看到明确的错误横幅而不是静默失败, so that 我知道该找管理员而不是怀疑自己操作错了。
13. As a Member, I want 我选择的端点被记住（下次登录仍然生效）, so that 不用每次进来重新选。

### Chat

14. As a Member, I want 在 Chat 页看到当前端点下所有可用的 Agent、Team、Workflow 列表, so that 我知道有哪些能力可以使用。
15. As a Member, I want 选择一个 Agent 并发送消息、以 SSE 流式逐字看到回复, so that 长回答不需要干等。
16. As a Member, I want 回复以 Markdown 渲染（代码块、表格、列表、链接）, so that 结构化内容可读。
17. As a Member, I want 实时看到 Agent 的工具调用步骤（工具名、入参、返回结果）以可展开卡片呈现, so that 我能理解 Agent 是怎么得出答案的、便于调试提示词和工具。
18. As a Member, I want 与 Team 对话并看到各成员 Agent 的分工过程, so that 多 agent 协作的行为对我透明。
19. As a Member, I want 触发 Workflow 并流式看到各步骤的执行进展, so that 长流程的中间状态可见。
20. As a Member, I want 在同一会话中连续多轮对话（上下文保持）, so that 可以追问和迭代。
21. As a Member, I want 一键新建会话, so that 换话题时不被旧上下文污染。
22. As a Member, I want 消息发送失败或流中断时看到明确错误并可重试, so that 偶发故障不会丢掉我正在做的事。
23. As a Member, I want 流式回复过程中可以中断（stop）, so that 发现方向不对时不用等它说完。

### Sessions

24. As a Member, I want 查看我自己的历史会话列表（按时间倒序、显示标题/目标 Agent/时间）, so that 能找回之前的对话。
25. As a Member, I want 点开任一会话完整回放消息记录（含当时的工具调用细节）, so that 可以复盘 Agent 当时的行为。
26. As a Member, I want 从会话详情直接继续对话, so that 历史会话不是死档案。
27. As a Member, I want 确保我看不到其他同事的会话, so that 我的对话内容对他人保密（隔离由服务端强制，而非前端隐藏）。
28. As an Admin, I want 查看全部用户的会话并按用户、按 Agent 筛选, so that 排障和运维时能定位到出问题的具体对话。
29. As an Admin, I want 删除会话, so that 误操作产生的脏数据或敏感内容可以清理。

### Traces

30. As a Member, I want 查看我的会话对应的执行 Trace 列表, so that 出现慢响应或错误时有据可查。
31. As a Member, I want 以树形/瀑布视图展开单条 Trace（模型调用、工具调用的层级、每步耗时与 token 消耗）, so that 能定位性能瓶颈和失败环节。
32. As a Member, I want Trace 中的错误节点被醒目标出并可查看错误详情, so that 不用逐层展开找问题。
33. As an Admin, I want 查看所有用户的 Trace（可见性与会话一致）, so that 全局排障不受隔离限制。

### 导航与占位

34. As a Member, I want 左侧导航呈现 Chat / Sessions / Memory / Knowledge / Traces / Metrics / Evals 完整结构，其中未实现模块显示"规划中"占位页, so that 我了解平台的完整蓝图而不是以为功能只有这些。

### 部署与运维

35. As a 运维/开发者, I want 在内网服务器上用一条 `docker compose up -d` 拉起控制台 + 演示 runtime + Postgres, so that 部署不需要 k8s 或手工步骤。
36. As a 运维/开发者, I want 所有敏感配置（数据库口令、OAuth 凭证、ENCRYPTION_KEY、模型 API Key、代理地址）通过环境变量注入并有 `.env.example` 模板, so that 配置项一目了然且不进版本库。
37. As a 开发者, I want 一个自带演示数据的 runtime（带工具的 Agent、Team、Workflow，开 tracing）, so that 控制台每个功能开发和验收时都有真实数据可看。

## Implementation Decisions

- **总体架构**：Monorepo，两个可运行单元——`console`（Next.js App Router + TypeScript + Tailwind + shadcn/ui）与 `runtime`（Python + 开源 Agno 的演示 AgentOS），加 Postgres，由 Docker Compose 编排。控制台从零搭建，不 fork 官方 agent-ui（其架构为单 agent 聊天设计），仅参考其 API 对接方式。
- **BFF 代理**：浏览器永不直连 runtime。控制台的 Route Handler 层承担：认证校验 → 角色门禁 → 解析当前端点并解密 Security Key → 向 runtime 转发（普通 JSON 与 SSE 流均透传）。Security Key 只存在于服务端。
- **会话隔离契约**：BFF 在调用 runtime 的 run/会话接口时**强制注入**当前登录用户的 user_id（覆盖客户端传入的任何值）；Member 的 Sessions/Traces 查询按此 user_id 过滤，Admin 查询不加过滤并支持按 user 筛选。隔离是服务端强制，前端只做展示。
- **认证**：Auth.js（NextAuth），Credentials（邮箱密码，bcrypt 哈希）+ Google + GitHub 三个 provider，开放注册。会话用数据库 session 策略以支持角色即时生效。首个注册账号自动 Admin，其余默认 Member。
- **角色模型**：两级。Admin：端点 CRUD、用户角色管理、删除会话、全局 Sessions/Traces 视角；Member：Chat、自己的 Sessions/Traces。中间件层统一做路由级门禁，API 层再做一次服务端校验（纵深防御）。
- **多端点**：端点配置（名称、Base URL、加密后的 Security Key、启用状态）存控制台数据库；密钥用 AES-256-GCM 以环境变量 `ENCRYPTION_KEY` 加密。用户的"当前端点"选择持久化到用户偏好。
- **控制台数据库**：Postgres + Drizzle ORM，与 runtime 共用同一 PG 实例、使用独立 database；两侧 schema 互不引用，控制台读 runtime 数据一律走 runtime 的 HTTP API 而非直查其库。
- **Chat 流式渲染**：SSE 事件流在前端经过一个**纯函数归约层**（事件序列 → 消息状态树）再渲染；工具调用（tool_call 开始/参数/结果）、Team 成员切换、Workflow 步骤都是该状态树的节点类型。这一决策保证工具调用可视化与流式渲染同层实现，避免后补重写。
- **演示 runtime**：开源 Agno 搭建，含 2-3 个带工具的 Agent、1 个 Team、1 个 Workflow；模型用 OpenAI / Anthropic 官方 API（容器内配置 API Key 与 HTTPS_PROXY）；存储接 Postgres，tracing 开启。
- **UI 语言与视觉**：中文文案 + 英文领域术语（Agent/Team/Workflow/Session/Trace/Token），文案硬编码不上 i18n 框架；暗色主题；信息架构（左侧导航、Chat 三栏、Session 列表+详情、Trace 树形展开）对齐 os.agno.com，视觉细节用 shadcn 组件体系。
- **第一版模块**：端点接入、Chat、Sessions、Traces 为完整功能；Memory / Knowledge / Metrics / Evals 仅导航占位页。

## Testing Decisions

好的测试只断言外部行为（HTTP 请求进出、页面上可见的结果），不断言组件内部实现或私有函数。绿地项目无现有接缝，按以下四层新建（自高向低）：

- **BFF HTTP 集成测试（主力）**：把 Route Handler 当 HTTP API 测。runtime 用假的 AgentOS stub（回放录制的 JSON/SSE fixture），不依赖真模型。覆盖：未登录 401、Member 访问 Admin 接口 403、user_id 强制注入（客户端伪造 user_id 被覆盖）、Member 查会话只返回自己的、SSE 流正确透传且密钥不出现在任何响应中、端点密钥加密落库。
- **AgentOS 客户端契约测试（少量）**：控制台内部的 typed runtime client 对着 docker 里的真实 Agno runtime 跑，只断言关键接口的响应形状（agents 列表、run、sessions、traces），用于捕获 Agno 升级带来的契约漂移。
- **流式归约层单元测试**：SSE 事件序列 → 消息状态树的纯函数，用录制的真实事件流 fixture 断言状态结果（含工具调用节点、中断、错误事件）。
- **Playwright E2E 黄金路径（3-5 条）**：对 docker-compose 全家桶执行——注册/登录 → 切换端点 → 发消息看到流式输出与工具调用卡片 → Sessions 中找到该会话并回放 → 打开对应 Trace。
- **演示 runtime 冒烟测试**：runtime 可启动、健康检查通过、单个 Agent 能同步完成一轮运行。

无既有 prior art（绿地）；BFF 集成测试的组织方式即为本仓库后续测试的范式。

## Out of Scope

- Memory / Knowledge / Metrics / Evals 四个模块的实际功能（第一版仅占位入口）。
- 多模态输入（图片/音频上传）、human-in-the-loop 审批、quick prompts。
- 细粒度 RBAC（仅两级角色）、SSO/OIDC/企业微信/飞书登录、OAuth 域名白名单或审批准入（当前决策为开放注册）。
- i18n 框架与多语言切换。
- 像素级还原 os.agno.com 的视觉细节。
- 多租户/组织体系、计费、对外商业化能力。
- runtime 本身的功能开发（沿用开源 Agno；演示 agents 仅为控制台提供数据）。
- k8s 部署、横向扩展、高可用。

## Further Notes

- **安全红线**：开放注册意味着任何 OAuth 账号都能登录，因此本服务**只允许部署在内网/VPN 内**，严禁公网可达。上线检查清单须包含此项。
- **已知风险**：Google OAuth 登录跳转在国内网络环境可能不可达（GitHub 通常正常）；若成为实际障碍，后续补邮箱验证码登录作为替代通道。OpenAI/Anthropic 官方 API 需要容器内配置网络代理。
- `ENCRYPTION_KEY` 一旦丢失，已存端点密钥不可恢复，只能重新录入；部署文档需明确该变量的备份责任。
- 参考资料：Agno 官方文档（docs.agno.com/agent-os）、runtime 本地 OpenAPI 文档（`/docs` 路径）、官方开源 agent-ui 仓库（仅作 SSE 对接参考）。
- 本 PRD 由设计盘问会话（2026-07-06）的 16 项决议综合而成，决议全文见会话记录。
