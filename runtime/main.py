"""AIP 演示 runtime：开源 Agno AgentOS。

环境变量：
- RUNTIME_DB_URL      Postgres 连接串（默认对应 docker-compose 的 postgres 服务）
- OS_SECURITY_KEY     设置后 AgentOS 启用 Bearer 认证（控制台 BFF 持有此密钥）
- MODEL_PROVIDER      openai（默认）| anthropic
- OPENAI_API_KEY      MODEL_PROVIDER=openai 时的模型凭证
- ANTHROPIC_API_KEY   MODEL_PROVIDER=anthropic 时的模型凭证
- DEMO_MODEL_ID       模型 ID；留空按 provider 取默认（gpt-4.1-mini / claude-opus-4-8）
"""

import os

from agno.agent import Agent
from agno.db.postgres import PostgresDb
from agno.knowledge.knowledge import Knowledge
from agno.models.anthropic import Claude
from agno.models.base import Model
from agno.models.openai import OpenAIChat
from agno.os import AgentOS
from agno.team import Team
from agno.tools.calculator import CalculatorTools
from agno.vectordb.pgvector import PgVector
from agno.workflow.step import Step
from agno.workflow.workflow import Workflow

DEFAULT_MODEL_IDS = {"openai": "gpt-4.1-mini", "anthropic": "claude-opus-4-8"}


def make_model() -> Model:
    """按 MODEL_PROVIDER 构造模型；DEMO_MODEL_ID 留空时取该 provider 的默认。"""
    provider = os.getenv("MODEL_PROVIDER", "openai").strip().lower()
    if provider not in DEFAULT_MODEL_IDS:
        raise ValueError(f"不支持的 MODEL_PROVIDER：{provider}（可选 openai / anthropic）")
    model_id = os.getenv("DEMO_MODEL_ID") or DEFAULT_MODEL_IDS[provider]
    if provider == "anthropic":
        return Claude(id=model_id)
    return OpenAIChat(id=model_id)

db = PostgresDb(
    db_url=os.getenv(
        "RUNTIME_DB_URL",
        "postgresql+psycopg://ai:ai@localhost:5532/ai",
    )
)

_db_url = os.getenv("RUNTIME_DB_URL", "postgresql+psycopg://ai:ai@localhost:5532/ai")

# 知识库：内容经 OpenAIEmbedder 向量化写入 PgVector。
# 注意：embedding 依赖 OPENAI_API_KEY，即使 MODEL_PROVIDER=anthropic 也需要配置。
knowledge = Knowledge(
    name="AIP Knowledge",
    contents_db=db,
    vector_db=PgVector(db_url=_db_url, table_name="knowledge_vectors"),
)

demo_agent = Agent(
    id="demo-assistant",
    name="Demo Assistant",
    model=make_model(),
    db=db,
    tools=[CalculatorTools()],
    knowledge=knowledge,
    search_knowledge=True,
    add_history_to_context=True,
    enable_user_memories=True,
    markdown=True,
    instructions="你是 AIP 平台的演示助手。涉及计算时使用计算器工具。",
)

writer_agent = Agent(
    id="writer",
    name="Writer Agent",
    model=make_model(),
    db=db,
    role="把要点整理成简洁的中文说明",
    markdown=True,
)

demo_team = Team(
    id="demo-team",
    name="Demo Team",
    model=make_model(),
    members=[demo_agent, writer_agent],
    db=db,
    instructions="先用计算/推理得到要点，再由 Writer 整理成中文结论。",
)

demo_workflow = Workflow(
    id="demo-workflow",
    name="Demo Workflow",
    description="两步演示流程：计算 → 撰写",
    db=db,
    steps=[
        Step(name="计算", agent=demo_agent),
        Step(name="撰写", agent=writer_agent),
    ],
)

agent_os = AgentOS(
    id="aip-demo-os",
    description="AIP 内部平台演示 AgentOS",
    agents=[demo_agent, writer_agent],
    teams=[demo_team],
    workflows=[demo_workflow],
    db=db,
)

app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(app="main:app", port=int(os.getenv("PORT", "7777")), host="0.0.0.0")
