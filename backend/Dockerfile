FROM python:3.12-slim-bookworm AS builder
WORKDIR /build
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip wheel --no-cache-dir --wheel-dir /wheels '.[earth]'
FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir /wheels/* && rm -rf /wheels && useradd --create-home --uid 10001 fieldshift
COPY backend/ ./
USER fieldshift
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
FROM runtime AS test
USER root
RUN pip install --no-cache-dir 'pytest>=8,<9' 'pytest-asyncio>=0.24,<1' 'respx>=0.22,<1'
USER fieldshift
CMD ["pytest", "-q"]
