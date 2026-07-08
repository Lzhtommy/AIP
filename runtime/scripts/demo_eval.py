"""演示评测脚本：对 demo-assistant 跑一条 AccuracyEval 并写入数据库。

需要真实模型凭证（按 MODEL_PROVIDER 配 OPENAI_API_KEY 或 ANTHROPIC_API_KEY）。
用法（在 runtime 目录）：
    uv run python scripts/demo_eval.py
运行后刷新控制台 Evals 页即可看到该条评测。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agno.eval.accuracy import AccuracyEval  # noqa: E402

from main import db, demo_agent, make_model  # noqa: E402


def main() -> None:
    evaluation = AccuracyEval(
        db=db,
        name="演示准确率评测",
        model=make_model(),
        agent=demo_agent,
        input="用计算器算 137*73，只回答数字",
        expected_output="10001",
        num_iterations=1,
    )
    result = evaluation.run(print_results=True)
    print("\n评测完成，已写入数据库。刷新控制台 Evals 页查看。")
    if result is not None:
        print(f"平均分：{result.avg_score}")


if __name__ == "__main__":
    main()
