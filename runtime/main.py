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
from agno.tools.calculator import CalculatorTools

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

agent_os = AgentOS(
    id="aip-demo-os",
    description="AIP 内部平台演示 AgentOS",
    agents=[demo_agent],
    db=db,
)

app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(app="main:app", port=int(os.getenv("PORT", "7777")), host="0.0.0.0")
