"""AIP 演示 runtime：开源 Agno AgentOS。

环境变量：
- RUNTIME_DB_URL   Postgres 连接串（默认对应 docker-compose 的 postgres 服务）
- OS_SECURITY_KEY  设置后 AgentOS 启用 Bearer 认证（控制台 BFF 持有此密钥）
- OPENAI_API_KEY   演示 Agent 的模型凭证
- DEMO_MODEL_ID    演示 Agent 使用的模型（默认 gpt-4.1-mini）
"""

import os

from agno.agent import Agent
from agno.db.postgres import PostgresDb
from agno.models.openai import OpenAIChat
from agno.os import AgentOS
from agno.team import Team
from agno.tools.calculator import CalculatorTools
from agno.workflow.step import Step
from agno.workflow.workflow import Workflow

db = PostgresDb(
    db_url=os.getenv(
        "RUNTIME_DB_URL",
        "postgresql+psycopg://ai:ai@localhost:5532/ai",
    )
)

demo_agent = Agent(
    id="demo-assistant",
    name="Demo Assistant",
    model=OpenAIChat(id=os.getenv("DEMO_MODEL_ID", "gpt-4.1-mini")),
    db=db,
    tools=[CalculatorTools()],
    add_history_to_context=True,
    markdown=True,
    instructions="你是 AIP 平台的演示助手。涉及计算时使用计算器工具。",
)

writer_agent = Agent(
    id="writer",
    name="Writer Agent",
    model=OpenAIChat(id=os.getenv("DEMO_MODEL_ID", "gpt-4.1-mini")),
    db=db,
    role="把要点整理成简洁的中文说明",
    markdown=True,
)

demo_team = Team(
    id="demo-team",
    name="Demo Team",
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
