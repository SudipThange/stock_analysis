#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-}"
ADDITIONAL_SERVER_NAMES="${ADDITIONAL_SERVER_NAMES:-}"
EMAIL="${EMAIL:-}"
STAGING="${STAGING:-0}"

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

main() {
  if [ -z "$DOMAIN" ]; then
    echo "Set DOMAIN before running this script, for example DOMAIN=example.com." >&2
    exit 1
  fi

  local args=("--nginx" "--redirect" "--agree-tos" "--no-eff-email" "-d" "$DOMAIN")
  local name

  if [ -n "$EMAIL" ]; then
    args+=("--email" "$EMAIL")
  else
    args+=("--register-unsafely-without-email")
  fi

  for name in $ADDITIONAL_SERVER_NAMES; do
    args+=("-d" "$name")
  done

  if [ "$STAGING" = "1" ]; then
    args+=("--staging")
  fi

  run_sudo certbot "${args[@]}"

  echo "SSL enabled. Update backend/stock_analysis/.env so DJANGO_CSRF_TRUSTED_ORIGINS uses https://$DOMAIN"
  if [ -n "$ADDITIONAL_SERVER_NAMES" ]; then
    echo "Include these origins as well: $ADDITIONAL_SERVER_NAMES"
  fi
}

main "$@"
