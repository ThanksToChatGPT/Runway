# Outfit Builder — MVP (Release 1)

Plataforma para descubrir prendas, comparar productos, armar outfits completos (top, bottom, calzado) con cálculo en COP y alerta de sobrepresupuesto, y gestionar tiendas/scraping desde un panel administrativo básico.

## Arquitectura

- **Frontend:** Next.js (App Router), React, Tailwind CSS (`frontend/`)
- **Backend:** Node.js, Express, OpenAPI 3.0, JWT, PostgreSQL con consultas SQL parametrizadas siguiendo arquitectura hexagonal pragmática (`backend/`)
- **Scraper Service:** Python + FastAPI + BeautifulSoup4 (`scraper/`)
- **Base de datos:** PostgreSQL 16 (`backend/db/init.sql`)

## Inicio rápido con Docker Compose

1. Copia las variables de entorno:
   ```bash
   cp .env.example .env
   ```
2. Levanta los servicios:
   ```bash
   docker compose up --build
   ```
3. Servicios disponibles:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000/api/health
   - Scraper Service: http://localhost:8000/health

## Tests unitarios (Backend)

```bash
cd backend
npm install
npm test
```
