# GenZ Investors

Full-stack stock analytics app with a Django REST backend and React + Vite frontend.

## Highlights
- Brand updated to **GenZ Investors** with custom logo in navbar.
- Portfolio and Stock management (create, edit, delete).
- Real-time stock autosuggestions from Yahoo Finance for ticker selection.
- Dashboard metrics cards:
  - P/E Ratio
  - Opportunity Score
  - Discount Score
- Explore Gold & Silver page:
  - 5-year growth comparison
  - Correlation scatter plots
  - Linear regression for Gold→Silver and Silver→Gold with best-fit lines

## Project Structure
- Backend: `backend/stock_analysis`
- Frontend: `frontend`

## API Documentation (Swagger)
After running backend server, open:

- Swagger UI: `http://localhost:8000/swagger/`
- ReDoc: `http://localhost:8000/redoc/`
- OpenAPI JSON: `http://localhost:8000/swagger.json`

Generated schema file is also saved at:
- `backend/stock_analysis/openapi.json`

## Run Locally

### 1) Backend
From `backend/stock_analysis`:

```bash
python manage.py runserver 0.0.0.0:8000
```

### 2) Frontend
From `frontend`:

```bash
npm install
npm run dev
```

Frontend uses Vite proxy and calls backend via `/api/*`.

## Main Endpoints
- `POST /user/register/`
- `POST /user/login/`
- `GET/POST /portfolio/`
- `GET/PUT/PATCH/DELETE /portfolio/{id}/`
- `GET/POST /stock/`
- `GET/PUT/PATCH/DELETE /stock/{id}/`
- `GET /stock/search/?q=<query>`
- `GET /stock/metals/`
- `GET /dashboard/{ticker}/`

## Notes
- Protected endpoints require JWT access token.
- Media files are served from `backend/stock_analysis/media` in debug mode.
