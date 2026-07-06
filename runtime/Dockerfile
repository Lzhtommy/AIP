FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY main.py ./
EXPOSE 7777
CMD ["uv", "run", "--no-sync", "python", "main.py"]
