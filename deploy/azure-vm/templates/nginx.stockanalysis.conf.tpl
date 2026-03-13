upstream __SERVICE_NAME___backend {
    server 127.0.0.1:__BACKEND_PORT__;
    keepalive 32;
}

server {
    listen 80;
    server_name __SERVER_NAMES__;

    client_max_body_size 20M;
    root __FRONTEND_DIST__;
    index index.html;

    location /api/ {
        proxy_pass http://__SERVICE_NAME___backend/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias __STATIC_ROOT__/;
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    location /media/ {
        alias __MEDIA_ROOT__/;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
