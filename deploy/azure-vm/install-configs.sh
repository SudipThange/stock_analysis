#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/templates"

APP_DIR="${APP_DIR:-/opt/stockanalysis}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend/stock_analysis}"
FRONTEND_DIST="${FRONTEND_DIST:-$APP_DIR/frontend/dist}"
STATIC_ROOT="${STATIC_ROOT:-$BACKEND_DIR/staticfiles}"
MEDIA_ROOT="${MEDIA_ROOT:-$BACKEND_DIR/media}"
SERVICE_NAME="${SERVICE_NAME:-stockanalysis}"
APP_USER="${APP_USER:-${SUDO_USER:-$USER}}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
DOMAIN="${DOMAIN:-_}"
ADDITIONAL_SERVER_NAMES="${ADDITIONAL_SERVER_NAMES:-}"
DISABLE_DEFAULT_NGINX_SITE="${DISABLE_DEFAULT_NGINX_SITE:-1}"

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

build_server_names() {
  if [ "$DOMAIN" = "_" ]; then
    printf '_'
    return
  fi

  if [ -n "$ADDITIONAL_SERVER_NAMES" ]; then
    printf '%s %s' "$DOMAIN" "$ADDITIONAL_SERVER_NAMES"
  else
    printf '%s' "$DOMAIN"
  fi
}

render_template() {
  local template="$1"
  local destination="$2"
  local server_names
  server_names="$(build_server_names)"

  sed \
    -e "s|__SERVICE_NAME__|$(escape_sed "$SERVICE_NAME")|g" \
    -e "s|__APP_USER__|$(escape_sed "$APP_USER")|g" \
    -e "s|__APP_GROUP__|$(escape_sed "$APP_GROUP")|g" \
    -e "s|__BACKEND_DIR__|$(escape_sed "$BACKEND_DIR")|g" \
    -e "s|__FRONTEND_DIST__|$(escape_sed "$FRONTEND_DIST")|g" \
    -e "s|__STATIC_ROOT__|$(escape_sed "$STATIC_ROOT")|g" \
    -e "s|__MEDIA_ROOT__|$(escape_sed "$MEDIA_ROOT")|g" \
    -e "s|__BACKEND_PORT__|$(escape_sed "$BACKEND_PORT")|g" \
    -e "s|__SERVER_NAMES__|$(escape_sed "$server_names")|g" \
    "$template" > "$destination"
}

main() {
  local service_tmp nginx_tmp
  service_tmp="$(mktemp)"
  nginx_tmp="$(mktemp)"
  trap 'rm -f "$service_tmp" "$nginx_tmp"' EXIT

  render_template "$TEMPLATE_DIR/stockanalysis.service.tpl" "$service_tmp"
  render_template "$TEMPLATE_DIR/nginx.stockanalysis.conf.tpl" "$nginx_tmp"

  run_sudo install -m 0644 "$service_tmp" "/etc/systemd/system/$SERVICE_NAME.service"
  run_sudo install -m 0644 "$nginx_tmp" "/etc/nginx/sites-available/$SERVICE_NAME"

  if [ ! -L "/etc/nginx/sites-enabled/$SERVICE_NAME" ]; then
    run_sudo ln -s "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/$SERVICE_NAME"
  fi

  if [ "$DISABLE_DEFAULT_NGINX_SITE" = "1" ] && [ -L "/etc/nginx/sites-enabled/default" ]; then
    run_sudo rm -f /etc/nginx/sites-enabled/default
  fi

  run_sudo systemctl daemon-reload
  run_sudo systemctl enable "$SERVICE_NAME"
  run_sudo systemctl restart "$SERVICE_NAME"
  run_sudo nginx -t
  run_sudo systemctl restart nginx

  echo "Installed systemd unit: /etc/systemd/system/$SERVICE_NAME.service"
  echo "Installed Nginx site: /etc/nginx/sites-available/$SERVICE_NAME"
}

main "$@"
