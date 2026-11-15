#!/usr/bin/env bash
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
  .venv/bin/pip install -e backend
fi

export PYTHONPATH="$ROOT_DIR/backend"
echo "Starting FieldShift: Earth OS Backend on http://127.0.0.1:8000 ..."
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
