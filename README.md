# StockAnalysis — Project Flow & Usage

## Overview
- Full‑stack project combining a Django REST backend and a modern React (Vite + TypeScript) frontend.
- Core features:
  - Admin authentication and CRUD for Portfolios and Stocks
  - Explore dashboard: select a portfolio and open per‑ticker dashboard
  - Server‑side analytics pipeline that fetches market data, computes signals, and returns both static figure URLs and interactive series

## Architecture
- Backend (Django, DRF) — folder: [backend/stock_analysis](file:///D:/StockAnalysis/backend/stock_analysis)
  - Media storage: stock CSVs and figures under MEDIA_ROOT
  - REST endpoints for portfolios, stocks, search, and dashboard
- Frontend (React, Vite, TypeScript) — folder: [frontend](file:///D:/StockAnalysis/frontend)
  - Auth context and protected routes
  - Pages: Login, Portfolios, Stocks, Explore, Dashboard
  - Charts rendered with Recharts

## Data Pipeline (Backend)
- Modules:
  - fetch_data.py — fetches 1‑year daily data into CSV in media/stock_data
    - [fetch_data.py](file:///D:/StockAnalysis/backend/stock_analysis/fetch_data.py)
  - calculations.py — computes P/E proxy, MA20/MA50 crossover, Mean30/Undervalued flags
    - [calculations.py](file:///D:/StockAnalysis/backend/stock_analysis/calculations.py)
  - save_fig.py — creates Matplotlib figures (no disk I/O)
    - [save_fig.py](file:///D:/StockAnalysis/backend/stock_analysis/save_fig.py)
  - save_figs.py — saves figures into media/stock_figures/{ticker}
    - [save_figs.py](file:///D:/StockAnalysis/backend/stock_analysis/save_figs.py)
- Orchestration:
  - DashboardAPIView aggregates data, computes signals, generates figures, and returns:
    - Top 10 rows, pe_ratio, fig_urls, and interactive series (price, ma60, ma20/ma50, mean30, markers)
  - [views.py](file:///D:/StockAnalysis/backend/stock_analysis/stock/views.py)

## API Reference
- OpenAPI (Swagger) JSON:
  - [openapi.json](file:///D:/StockAnalysis/backend/stock_analysis/openapi.json)
- Postman collection:
  - [postman_collection.json](file:///D:/StockAnalysis/backend/stock_analysis/postman_collection.json)
- Endpoints (base: http://localhost:8000):
  - Portfolios
    - GET /portfolio/
    - POST /portfolio/
    - GET /portfolio/{id}/
    - PUT/PATCH /portfolio/{id}/
    - DELETE /portfolio/{id}/
  - Stocks
    - GET /stock/
    - POST /stock/
    - GET /stock/{id}/
    - PUT/PATCH /stock/{id}/
    - DELETE /stock/{id}/
    - GET /stock/search/?q={query}
  - Dashboard (public)
    - GET /dashboard/{ticker}/

## Frontend Flow
- Navbar -> Login -> Protected pages (Portfolios, Stocks, Explore)
- Portfolios page:
  - Create portfolio; inline edit/delete
  - Success popup appears after creation
  - [Portfolios.tsx](file:///D:/StockAnalysis/frontend/src/routes/Portfolios.tsx)
- Stocks page:
  - Create stock assigned to a portfolio
  - Title typeahead & ticker autofill via search API
  - Inline edit/delete; success popup after creation
  - [Stocks.tsx](file:///D:/StockAnalysis/frontend/src/routes/Stocks.tsx)
- Explore page:
  - Select portfolio -> stock cards appear -> click card to open dashboard
  - [Explore.tsx](file:///D:/StockAnalysis/frontend/src/routes/Explore.tsx)
- Dashboard page:
  - Calls /dashboard/{ticker}/ and renders:
    - P/E ratio, top table
    - Charts: Price vs MA60, Opportunity (MA20/MA50 + markers), Discount vs Mean30 (full‑width)
  - [Dashboard.tsx](file:///D:/StockAnalysis/frontend/src/routes/Dashboard.tsx)
  - Chart component:
    - [ChartTV.tsx](file:///D:/StockAnalysis/frontend/src/components/ChartTV.tsx)

## Running Locally
1) Backend
- In backend/stock_analysis:
  - Install dependencies (pandas, matplotlib, yfinance, DRF)
  - Start dev server:
    - python manage.py runserver 0.0.0.0:8000
- Ensure settings:
  - MEDIA_ROOT and MEDIA_URL configured
  - ALLOWED_HOSTS allows local access

2) Frontend
- In frontend:
  - npm install
  - npm run dev (Vite)
- Dev proxy rewrites /api to backend:
  - Use apiGet/apiJson clients which call /api/{path}

## Auth Notes
- Protected endpoints (portfolios/stocks) require JWT in Authorization: Bearer {token}
- Dashboard endpoint is public and does not require auth
- Access token managed by AuthContext on the frontend

## Media & Figures
- CSVs: media/stock_data/{TICKER}.csv
- Figures: media/stock_figures/{TICKER}/{fig_type}.png
- Served via Django static when running in dev

## Git Ignore Policy
- Root ignore file: [.gitignore](file:///D:/StockAnalysis/.gitignore)
- Intentionally ignored generated/local artifacts include:
  - Python/Django runtime files (virtual envs, __pycache__, logs, db.sqlite3)
  - Frontend build/runtime caches (node_modules, frontend/dist, frontend/.vite)
  - Generated media output (backend/stock_analysis/media)
  - Local environment files (.env, .env.* except .env.example)
- This keeps commits focused on source code and reproducible configuration.

## Troubleshooting
- 401 on dashboard: remove Authorization header (endpoint is public)
- Chart errors: frontend uses Recharts; backend filters NaNs before sending series
- Indian tickers: backend tries suffixes .NS / .BO if not provided

## Testing APIs
- Import Postman collection and set variables (token, ids, ticker)
- Load openapi.json in Swagger UI for interactive docs
