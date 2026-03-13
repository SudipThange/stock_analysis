# Azure Linux VM Deployment Checklist (Django + React/Vite)

## 1) VM and network
- [ ] Ubuntu VM is provisioned on Azure
- [ ] inbound ports `80` and `443` are open in the Azure NSG and the VM firewall
- [ ] domain DNS points to the VM public IP
- [ ] repository is checked out on the VM, preferably at `/opt/stockanalysis`

## 2) Repository hygiene
- [ ] `.env` files are not committed
- [ ] local artifacts are ignored (`node_modules`, `dist`, `__pycache__`, `.venv`, logs, temp files)
- [ ] no development secrets are stored in tracked files

## 3) Server prerequisites
- [ ] make deployment scripts executable:
  - `chmod +x deploy/azure-vm/*.sh`
- [ ] install required OS packages:
  - `sudo ./deploy/azure-vm/install-prereqs.sh`

## 4) Production environment files
- [ ] create backend env:
  - `cp backend/stock_analysis/.env.example backend/stock_analysis/.env`
- [ ] create frontend env:
  - `cp frontend/.env.example frontend/.env.production`
- [ ] set backend values:
  - `DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com,server-ip`
  - `DJANGO_CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com`
  - `DJANGO_CORS_ALLOWED_ORIGINS=` for same-domain Nginx deployments
  - `DJANGO_SECURE_SSL_REDIRECT=0` until TLS is installed, then switch to `1`
  - `DJANGO_SESSION_COOKIE_SECURE=0` and `DJANGO_CSRF_COOKIE_SECURE=0` until TLS is installed
- [ ] set frontend value:
  - `VITE_API_BASE_URL=/api`

## 5) Build and provision the application
- [ ] run the deployment script:
  - `APP_DIR=/opt/stockanalysis ./deploy/azure-vm/deploy.sh`
- [ ] confirm backend checks pass:
  - `backend/stock_analysis/.venv/bin/python backend/stock_analysis/manage.py check --deploy --settings=stock_analysis.settings_prod`

## 6) Install service and reverse proxy config
- [ ] install the templated `systemd` and Nginx configs:
  - `DOMAIN=your-domain.com ADDITIONAL_SERVER_NAMES="www.your-domain.com" APP_DIR=/opt/stockanalysis ./deploy/azure-vm/install-configs.sh`
- [ ] confirm services are running:
  - `sudo systemctl status stockanalysis`
  - `sudo systemctl status nginx`

## 7) TLS
- [ ] request and install the certificate:
  - `DOMAIN=your-domain.com ADDITIONAL_SERVER_NAMES="www.your-domain.com" EMAIL=admin@your-domain.com ./deploy/azure-vm/enable-ssl.sh`
- [ ] update backend env after TLS:
  - `DJANGO_SECURE_SSL_REDIRECT=1`
  - `DJANGO_SESSION_COOKIE_SECURE=1`
  - `DJANGO_CSRF_COOKIE_SECURE=1`
  - `DJANGO_SECURE_HSTS_SECONDS=31536000`
- [ ] rerun the deploy script after env changes:
  - `APP_DIR=/opt/stockanalysis ./deploy/azure-vm/deploy.sh`

## 8) Verify externally
- [ ] load the frontend over HTTP/HTTPS
- [ ] verify API proxying through Nginx:
  - `curl -I https://your-domain.com/api/swagger/`
- [ ] verify static assets are served from `/static/`

## 9) Files added for deployment
```text
deploy/azure-vm/
  README.md
  install-prereqs.sh
  deploy.sh
  install-configs.sh
  enable-ssl.sh
  templates/
    stockanalysis.service.tpl
    nginx.stockanalysis.conf.tpl
```
