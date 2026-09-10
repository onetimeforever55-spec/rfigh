# syntax=docker/dockerfile:1

# Build stage: resolve dependencies into a self-contained virtualenv.
# The live extras pull in solders, which ships manylinux wheels — build-essential
# is only a fallback for platforms (arm64, musl) where a wheel is missing.
FROM python:3.11-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copied on their own so a config or source edit does not invalidate the
# dependency layer.
COPY requirements.txt requirements-live.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-live.txt


# Runtime stage: no compilers, no pip cache, no root.
FROM python:3.11-slim

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY --from=builder /opt/venv /opt/venv

# UID 1000 matches the first user on most Linux hosts, so bind-mounted
# ./data and ./logs stay writable without a chown. Override at run time with
# `user:` in compose if your UID differs.
RUN useradd --create-home --uid 1000 memebot

WORKDIR /app
COPY --chown=memebot:memebot memebot/ ./memebot/
COPY --chown=memebot:memebot pyproject.toml ./

# Created here so the container still works when no volume is mounted.
RUN mkdir -p /app/data /app/logs && chown -R memebot:memebot /app/data /app/logs

USER memebot

# `run` alone starts in whatever mode config.yaml declares; live mode
# additionally requires --yes-really-trade-live, by design.
ENTRYPOINT ["python", "-m", "memebot"]
CMD ["--help"]
