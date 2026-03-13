#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/stockanalysis}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend/stock_analysis}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR/frontend}"
SERVICE_NAME="${SERVICE_NAME:-stockanalysis}"
APP_USER="${APP_USER:-${SUDO_USER:-$USER}}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
NPM_BIN="${NPM_BIN:-npm}"
DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-stock_analysis.settings_prod}"

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

require_path() {
  local path="$1"
  if [ ! -e "$path" ]; then
    echo "Required path not found: $path" >&2
    exit 1
  fi
}

ensure_env_files() {
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "Created $BACKEND_DIR/.env from template. Update it with your production values."
  fi

  if [ ! -f "$FRONTEND_DIR/.env.production" ] && [ ! -f "$FRONTEND_DIR/.env" ]; then
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.production"
    echo "Created $FRONTEND_DIR/.env.production from template. Update it before rebuilding if needed."
  fi
}

setup_backend() {
  "$PYTHON_BIN" -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/pip" install --upgrade pip setuptools wheel
  "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements-prod.txt"

  (
    cd "$BACKEND_DIR"
    export DJANGO_SETTINGS_MODULE
    ./.venv/bin/python manage.py migrate --settings=stock_analysis.settings_prod
    ./.venv/bin/python manage.py collectstatic --noinput --settings=stock_analysis.settings_prod
    ./.venv/bin/python manage.py check --deploy --settings=stock_analysis.settings_prod
  )
}

setup_frontend() {
  (
    cd "$FRONTEND_DIR"
    if [ -f package-lock.json ]; then
      "$NPM_BIN" ci
    else
      "$NPM_BIN" install
    fi
    "$NPM_BIN" run build
  )
}

fix_permissions() {
  run_sudo install -d -m 0755 "$APP_DIR/logs"
  run_sudo chown -R "$APP_USER:$APP_GROUP" "$BACKEND_DIR" "$FRONTEND_DIR" "$APP_DIR/logs"
}

reload_services_if_present() {
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SERVICE_NAME.service" >/dev/null 2>&1; then
    run_sudo systemctl restart "$SERVICE_NAME"
  fi

  if [ -e "/etc/nginx/sites-enabled/$SERVICE_NAME" ]; then
    run_sudo nginx -t
    run_sudo systemctl reload nginx
  fi
}

main() {
  require_path "$BACKEND_DIR"
  require_path "$FRONTEND_DIR"
  require_path "$BACKEND_DIR/.env.example"
  require_path "$FRONTEND_DIR/.env.example"

  ensure_env_files
  setup_backend
  setup_frontend
  fix_permissions
  reload_services_if_present

  echo "Application deployment complete."
  echo "Backend: $BACKEND_DIR"
  echo "Frontend build: $FRONTEND_DIR/dist"
}

main "$@"
