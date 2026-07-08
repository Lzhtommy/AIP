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


def test_make_model_provider_switch(monkeypatch):
    from main import make_model

    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.delenv("DEMO_MODEL_ID", raising=False)
    model = make_model()
    assert type(model).__name__ == "Claude"
    assert model.id == "claude-opus-4-8"

    monkeypatch.setenv("DEMO_MODEL_ID", "claude-sonnet-4-6")
    assert make_model().id == "claude-sonnet-4-6"

    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.delenv("DEMO_MODEL_ID", raising=False)
    model = make_model()
    assert type(model).__name__ == "OpenAIChat"
    assert model.id == "gpt-4.1-mini"

    monkeypatch.setenv("MODEL_PROVIDER", "bogus")
    with pytest.raises(ValueError):
        make_model()


_PROVIDER = os.getenv("MODEL_PROVIDER", "openai").strip().lower()
_KEY_ENV = "ANTHROPIC_API_KEY" if _PROVIDER == "anthropic" else "OPENAI_API_KEY"


@pytest.mark.skipif(
    not os.getenv(_KEY_ENV),
    reason=f"需要 {_KEY_ENV} 才能真实调用模型（当前 MODEL_PROVIDER={_PROVIDER}）",
)
def test_demo_agent_completes_one_run():
    run = demo_agent.run("用计算器算 137*73，只回答数字")
    assert run.content
    assert "10001" in run.content
