# Azure VM Deployment

This directory contains the Linux deployment bundle for running the project on an Azure Ubuntu VM with:

- Django served by Gunicorn
- React/Vite frontend served by Nginx
- optional TLS via Certbot

The scripts are designed for a repository checkout located at `/opt/stockanalysis` by default. Override paths with environment variables if you deploy elsewhere.

## Files

- `install-prereqs.sh`: installs Python, build tools, Node.js, Nginx, and Certbot
- `deploy.sh`: creates the backend virtualenv, installs dependencies, runs migrations, collects static files, and builds the frontend
- `install-configs.sh`: installs templated `systemd` and Nginx config files
- `enable-ssl.sh`: requests a Let's Encrypt certificate and enables HTTPS redirects
- `templates/stockanalysis.service.tpl`: `systemd` unit template
- `templates/nginx.stockanalysis.conf.tpl`: Nginx site template

## Recommended VM Layout

```text
/opt/stockanalysis
  backend/stock_analysis
  frontend
  deploy/azure-vm
```

## 1) Copy the repository to the VM

```bash
sudo mkdir -p /opt/stockanalysis
sudo chown "$USER:$USER" /opt/stockanalysis
git clone <your-repo-url> /opt/stockanalysis
cd /opt/stockanalysis
chmod +x deploy/azure-vm/*.sh
```

## 2) Install OS packages

```bash
sudo ./deploy/azure-vm/install-prereqs.sh
```

## 3) Create production environment files

```bash
cp backend/stock_analysis/.env.example backend/stock_analysis/.env
cp frontend/.env.example frontend/.env.production
```

Recommended backend values for a same-domain deployment behind Nginx:

- `DJANGO_ALLOWED_HOSTS=example.com,www.example.com,<vm-public-ip>`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com`
- `DJANGO_CORS_ALLOWED_ORIGINS=` (leave empty when frontend and API share one domain)
- `DJANGO_SECURE_SSL_REDIRECT=0` until TLS is enabled, then set it to `1`
- `DJANGO_SESSION_COOKIE_SECURE=0` and `DJANGO_CSRF_COOKIE_SECURE=0` until TLS is enabled
- `DB_ENGINE=django.db.backends.sqlite3` to keep SQLite, or switch to PostgreSQL values

Recommended frontend value:

- `VITE_API_BASE_URL=/api`

## 4) Build and provision the app

```bash
APP_DIR=/opt/stockanalysis ./deploy/azure-vm/deploy.sh
```

If you want the service to run as a specific Linux user, pass it explicitly:

```bash
APP_DIR=/opt/stockanalysis APP_USER=www-data APP_GROUP=www-data ./deploy/azure-vm/deploy.sh
```

## 5) Install `systemd` and Nginx configs

```bash
DOMAIN=example.com \
ADDITIONAL_SERVER_NAMES="www.example.com" \
APP_DIR=/opt/stockanalysis \
./deploy/azure-vm/install-configs.sh
```

This creates:

- `/etc/systemd/system/stockanalysis.service`
- `/etc/nginx/sites-available/stockanalysis`

## 6) Enable HTTPS

```bash
DOMAIN=example.com \
ADDITIONAL_SERVER_NAMES="www.example.com" \
EMAIL=admin@example.com \
./deploy/azure-vm/enable-ssl.sh
```

After TLS is enabled, set these in `backend/stock_analysis/.env` and rerun `deploy.sh`:

- `DJANGO_SECURE_SSL_REDIRECT=1`
- `DJANGO_SESSION_COOKIE_SECURE=1`
- `DJANGO_CSRF_COOKIE_SECURE=1`
- `DJANGO_SECURE_HSTS_SECONDS=31536000`
- `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=1`
- `DJANGO_SECURE_HSTS_PRELOAD=1`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com`

## 7) Verify

```bash
sudo systemctl status stockanalysis
sudo systemctl status nginx
curl -I http://example.com
curl -I http://example.com/api/swagger/
```

## Variables

These scripts support overrides through environment variables:

- `APP_DIR`
- `BACKEND_DIR`
- `FRONTEND_DIR`
- `FRONTEND_DIST`
- `SERVICE_NAME`
- `APP_USER`
- `APP_GROUP`
- `BACKEND_PORT`
- `DOMAIN`
- `ADDITIONAL_SERVER_NAMES`
- `EMAIL`
