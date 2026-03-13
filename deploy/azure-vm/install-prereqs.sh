#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-20}"

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_base_packages() {
  run_sudo apt-get update
  run_sudo apt-get install -y \
    apt-transport-https \
    build-essential \
    ca-certificates \
    certbot \
    curl \
    gfortran \
    git \
    libffi-dev \
    liblapack-dev \
    libopenblas-dev \
    libssl-dev \
    nginx \
    pkg-config \
    python3 \
    python3-certbot-nginx \
    python3-dev \
    python3-pip \
    python3-venv \
    unzip
}

ensure_node() {
  local install_node=1

  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -p "process.versions.node.split('.')[0]")"
    if [ "$current_major" -ge "$NODE_MAJOR" ]; then
      install_node=0
    fi
  fi

  if [ "$install_node" -eq 1 ]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | run_sudo bash -
    run_sudo apt-get install -y nodejs
  fi
}

main() {
  install_base_packages
  ensure_node

  echo "Installed runtime prerequisites:"
  python3 --version
  node --version
  npm --version
  nginx -v
}

main "$@"
