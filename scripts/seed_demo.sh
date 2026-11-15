#!/usr/bin/env bash
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Applying Alembic migrations..."
cd backend && ../.venv/bin/alembic upgrade head
cd ..

echo "Seeding demonstration farm and fields..."
PYTHONPATH=backend .venv/bin/python backend/app/seed.py

echo "Done! Database is initialized."
