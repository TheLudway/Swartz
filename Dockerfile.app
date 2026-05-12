FROM python:3.11-slim

WORKDIR /app

COPY app/pyproject.toml ./

RUN pip install --no-cache-dir python-telegram-bot>=22.5 httpx>=0.24.0

COPY app/main.py ./
COPY Secrets/ ./Secrets/

CMD ["python", "main.py"]
