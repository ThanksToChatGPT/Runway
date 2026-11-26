# Scraper Service (FastAPI)

Microservicio que lee el catálogo de una tienda en línea y lo devuelve normalizado al backend
(`HttpScraperAdapter` → `POST /scrape`). Es el motor de `outfit-scraper-v5` (rama `main`) adaptado al MVP:
sin SQLite, CLI, visor ni programador, porque la persistencia y la administración viven en `backend/` y
`frontend/`.

```
PoliteClient → detección de plataforma → extractor (shopify | vtex | vtex_is | html | mock)
             → normalizador (precio COP, color, tallas, categoría, material, packs) → filtros → image_picker
```

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health` | Estado del servicio. |
| `POST` | `/scrape` | Productos de una tienda. Lo llama el backend. |
| `POST` | `/detect` | Informe de detección de plataforma (huellas, APIs probadas, muestra de productos). |

### `POST /scrape`

El backend envía `{ "store_id", "slug", "base_url" }`; la plataforma se **detecta sola** desde `base_url` y
se guarda en caché (6 h) para no repetir la detección. Campos opcionales:

* `platform`: `shopify`, `vtex`, `vtex_is`, `html` o `mock` (salta la detección).
* `config`: configuración del extractor (p. ej. `list_urls` y `selectors` para `html`, `single_garment: false`).
* `max_products`: tope de productos devueltos.

`slug` `mock` (o `mock-*`) usa el catálogo fijo de pruebas sin hacer peticiones.

Respuesta (los campos de `products` son los que traduce `toRawScrapedProduct`):

```json
{
  "store_id": "7", "slug": "mattelsa", "platform": "vtex", "status": "success", "count": 1,
  "products": [{
    "external_id": "95964", "title": "Camiseta Oversize Negra", "brand": "Mattelsa",
    "category": "top", "subcategory": "t-shirt", "color": "black", "material": "cotton",
    "price_cop": 59900, "product_url": "https://…/p", "description": "…",
    "images": ["https://…/95964-1.jpg"], "sizes": [{ "size": "M", "in_stock": true }]
  }],
  "stats": { "found": 1, "returned": 1, "skipped_packs": 0, "skipped_non_garment": 0, "skipped_invalid": 0,
             "requests": 3, "stop_reason": "complete", "platform_source": "detected", "elapsed_ms": 2140 },
  "errors": []
}
```

* Solo se devuelven prendas del MVP: `category` es `top`, `bottom` o `shoes`. Accesorios, medias, ropa
  interior y artículos que no son ropa se cuentan en `skipped_non_garment`.
* Con `single_garment` (por defecto) se descartan packs/kits de varias prendas (`skipped_packs`).
* `stop_reason`: `complete`, `max_products`, `time_budget` (respuesta parcial, `status: "partial"`) o `error`.
* Si no se pudo leer ningún producto responde con error y el backend deja el catálogo intacto: `422`
  (`unsupported_platform`, `invalid_config` o petición inválida), `502` (`robots_disallowed`,
  `store_unavailable`, `no_products`) o `504` (`timeout`). El cuerpo es `{ "detail": { "code", "message" } }`.
  Si se leyeron productos pero ninguno es prenda del MVP, responde `200` con `count: 0`.

### `POST /detect`

`{ "base_url", "html"?, "grep"?: [], "probe_all"?: false, "sample"?: 20 }`. Si la página de inicio está
bloqueada se puede enviar el HTML guardado desde el navegador en `html`.

## Buenas prácticas

`PoliteClient` respeta `robots.txt` (nunca intenta saltarse un bloqueo ni una protección anti-bots), espera
entre peticiones al mismo host, reintenta `429`/`5xx`/errores de red con backoff (y `Retry-After`), acepta
`206 Partial Content` (VTEX) y abre un circuit breaker tras varios fallos seguidos. Las imágenes nunca se
guardan: solo sus URLs.

## Tiempo de respuesta

El scraper trabaja con un **presupuesto de tiempo** menor que `SCRAPER_TIMEOUT_MS` del backend (por defecto
15 000 ms → 12 s): ninguna espera, reintento o petición se pasa de ese límite y, si se acaba, devuelve lo que
alcanzó a leer. La detección de plataforma se hace una vez por tienda y queda en caché.

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `SCRAPER_TIMEOUT_MS` | `15000` | Timeout del backend; el presupuesto es este valor menos 20 % (mínimo 2 s de margen). |
| `SCRAPER_TIME_BUDGET_MS` | — | Fija el presupuesto directamente (tiene prioridad). |
| `SCRAPER_MAX_PRODUCTS` | `150` | Productos devueltos por scraping. |
| `SCRAPER_DELAY_SECONDS` | `1.0` | Espera mínima entre peticiones al mismo host (más `SCRAPER_JITTER_SECONDS`, `0.3`). |
| `SCRAPER_RETRIES` | `3` | Reintentos ante `429`/`5xx`/errores de red. |
| `SCRAPER_MAX_FAILURES` | `5` | Fallos seguidos antes de abrir el circuit breaker. |
| `SCRAPER_REQUEST_TIMEOUT_SECONDS` | `8` | Timeout de cada petición (nunca supera el presupuesto restante). |
| `SCRAPER_RESPECT_ROBOTS` | `true` | Respetar `robots.txt`. |
| `SCRAPER_SINGLE_GARMENT` | `true` | Descartar packs/kits. |
| `SCRAPER_IMAGE_ANALYSIS` | `false` | Descargar las primeras imágenes y mirarlas con Pillow para poner primero la foto de la prenda sola. Usa como máximo el 60 % del presupuesto. |
| `SCRAPER_IMAGE_CANDIDATES` | `3` | Imágenes analizadas por producto. |
| `SCRAPER_USER_AGENT` | `OutfitFinderBot/1.0 (university project)` | User-Agent de las peticiones. |
| `SCRAPER_DETECT_CACHE_SECONDS` | `21600` | Vigencia de la plataforma detectada (`0` desactiva la caché). |

## Desarrollo y pruebas

```bash
cd scraper
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
python -m unittest discover -s tests -t .
```

Las pruebas son 100 % offline: las tiendas falsas (`tests/fake_store.py`) se sirven con
`httpx.MockTransport` y el tiempo se simula con un reloj falso, así que no abren sockets ni esperan de verdad.
Las pruebas de análisis de píxeles necesitan Pillow (incluido en `requirements.txt`).

## Créditos

El motor del scraper (`PoliteClient`, los extractores Shopify/VTEX/VTEX IS/HTML, la detección de plataforma,
el normalizador, el selector de imágenes y sus pruebas) es obra de **jordonezbo** en `outfit-scraper-v5`
(rama `main`, commits `718bb0a` y `45afa8f`). Este servicio integra ese trabajo en FastAPI y lo adapta al
MVP; el historial de git muestra primero sus archivos originales y después los cambios de la integración.
