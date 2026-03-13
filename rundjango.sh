#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/azureuser/stock_analysis"
BACKEND_DIR="$PROJECT_ROOT/backend/stock_analysis"
VENV_DIR="$BACKEND_DIR/.venv"
DJANGO_PROJECT_NAME="stock_analysis"

cd "$BACKEND_DIR"

source "$VENV_DIR/bin/activate"

if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
fi

exec gunicorn "${DJANGO_PROJECT_NAME}.wsgi:application" \
  --bind 127.0.0.1:8000 \
  --workers 3 \
  --threads 2 \
  --timeout 60
