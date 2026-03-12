# Azure Linux VM Deployment Checklist (Django + React/Vite)

## 1) Server prerequisites
- [ ] Ubuntu packages installed: `python3`, `python3-venv`, `python3-pip`, `nginx`, `nodejs`, `npm`
- [ ] Firewall open for `80` and `443`
- [ ] Domain DNS points to VM public IP

## 2) Repository hygiene
- [ ] `.env` files are not committed
- [ ] local artifacts are ignored (`node_modules`, `dist`, `__pycache__`, `.venv`, logs, temp files)
- [ ] no development secrets in tracked files

## 3) Backend setup
- [ ] `cd backend/stock_analysis`
- [ ] create and activate virtualenv
- [ ] install production dependencies:
  - `pip install -r requirements-prod.txt`
- [ ] create `.env` from `.env.example` and set real values
- [ ] run migrations:
  - `python manage.py migrate`
- [ ] collect static files:
  - `python manage.py collectstatic --noinput`
- [ ] run deployment checks:
  - `python manage.py check --deploy --settings=stock_analysis.settings_prod`

## 4) Frontend setup
- [ ] `cd frontend`
- [ ] create `.env` from `.env.example`
- [ ] set `VITE_API_BASE_URL=/api` (recommended with Nginx reverse proxy)
- [ ] install and build:
  - `npm ci`
  - `npm run build`

## 5) Gunicorn service
- [ ] create systemd unit `/etc/systemd/system/stockanalysis.service`:

```ini
[Unit]
Description=StockAnalysis Django Gunicorn
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/StockAnalysis/backend/stock_analysis
Environment=DJANGO_SETTINGS_MODULE=stock_analysis.settings_prod
EnvironmentFile=/opt/StockAnalysis/backend/stock_analysis/.env
ExecStart=/opt/StockAnalysis/backend/stock_analysis/.venv/bin/gunicorn stock_analysis.wsgi:application -c gunicorn.conf.py
Restart=always

[Install]
WantedBy=multi-user.target
```

- [ ] enable and start:
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable stockanalysis`
  - `sudo systemctl start stockanalysis`
  - `sudo systemctl status stockanalysis`

## 6) Nginx config
- [ ] create `/etc/nginx/sites-available/stockanalysis`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /opt/StockAnalysis/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /opt/StockAnalysis/backend/stock_analysis/staticfiles/;
    }

    location /media/ {
        alias /opt/StockAnalysis/backend/stock_analysis/media/;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

- [ ] enable site and validate:
  - `sudo ln -s /etc/nginx/sites-available/stockanalysis /etc/nginx/sites-enabled/`
  - `sudo nginx -t`
  - `sudo systemctl restart nginx`

## 7) TLS (recommended)
- [ ] install certbot and issue certificate
- [ ] enable HTTPS redirect
- [ ] confirm `DJANGO_CSRF_TRUSTED_ORIGINS` includes `https://your-domain.com`

## 8) Recommended repository structure
```text
StockAnalysis/
  backend/stock_analysis/
    stock_analysis/
      settings.py
      settings_prod.py
    .env.example
    requirements.txt
    requirements-prod.txt
    gunicorn.conf.py
  frontend/
    src/
    .env.example
    package.json
  DEPLOYMENT_CHECKLIST.md
```
