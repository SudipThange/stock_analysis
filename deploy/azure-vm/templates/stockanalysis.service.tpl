[Unit]
Description=StockAnalysis Gunicorn service
After=network.target

[Service]
User=__APP_USER__
Group=__APP_GROUP__
WorkingDirectory=__BACKEND_DIR__
Environment=DJANGO_SETTINGS_MODULE=stock_analysis.settings_prod
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=__BACKEND_DIR__/.env
ExecStart=__BACKEND_DIR__/.venv/bin/gunicorn stock_analysis.wsgi:application -c __BACKEND_DIR__/gunicorn.conf.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
