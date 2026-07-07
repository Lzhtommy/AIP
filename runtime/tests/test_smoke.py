"""runtime 冒烟测试。

前置：本地 Postgres 已启动（仓库根目录 `docker compose up -d postgres`）。
Agent 真实运行的用例需要 OPENAI_API_KEY，未配置时自动跳过。
"""

import os

import pytest
from fastapi.testclient import TestClient

from main import app, demo_agent


def test_health_endpoint_returns_status():
    with TestClient(app) as client:
        res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    # 控制台 BFF 依赖该字段（tests/bff/health.test.ts 的契约假设）
    assert "status" in body


def test_teams_and_workflows_registered():
    with TestClient(app) as client:
        teams = client.get("/teams").json()
        workflows = client.get("/workflows").json()
    assert [t["id"] for t in teams] == ["demo-team"]
    assert [w["id"] for w in workflows] == ["demo-workflow"]


@pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="需要 OPENAI_API_KEY 才能真实调用模型",
)
def test_demo_agent_completes_one_run():
    run = demo_agent.run("用计算器算 137*73，只回答数字")
    assert run.content
    assert "10001" in run.content
