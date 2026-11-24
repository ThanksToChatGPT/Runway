# Outfit Builder (front, React) — conectado al scraper real

Front del comparador y constructor de outfits. Arquitectura hexagonal; ver `docs/PATRONES_DE_DISENO.md`.

## Datos reales sin depender del scraper

El front ya no necesita que el scraper esté corriendo. Al arrancar elige la fuente en cascada:

1. **API viva** del scraper (`serve`) → precios al día, banner oculto.
2. **Snapshot** `public/catalog-snapshot.json` (exportado del SQLite con `python -m outfit_scraper export`)
   → datos REALES de la última recolección, sin ningún proceso extra. Banner suave con la fecha de export.
3. **Demo** de ejemplo → solo si no hay ni API ni snapshot.

El indicador de fuente vive en `container.js` (`dataSource.kind`), y el banner en `App.jsx`.

```bash
# Front (siempre funciona, con o sin scraper)
npm install
npm run dev        # http://localhost:5173

# Generar/actualizar el snapshot (recomendado tras cada recolección)
cd ../outfit-scraper
python -m outfit_scraper --db outfit.db export --out ../outfit-builder/public/catalog-snapshot.json
```

## Scraper en vivo con recolección periódica

Cuando quieras dejar el scraper corriendo en producción:

```bash
# API + recolección automática cada 24 h + snapshot refrescado tras cada pasada
python -m outfit_scraper serve --port 8060 --every 24

# Con límite de productos por pasada (útil para pruebas):
python -m outfit_scraper serve --port 8060 --every 24 --max 50

# El snapshot se refresca solo si existe ../outfit-builder/public/catalog-snapshot.json,
# o pásalo explícito: --snapshot ../outfit-builder/public/catalog-snapshot.json
```

La URL de la API se cambia con `VITE_API_URL` (por defecto `http://localhost:8060`).

## Mapeo de datos

`HttpProductRepository.js` mapea la API/snaphot al dominio: categorías del scraper → categorías del
outfit (tanks→top, vestidos→prenda larga, faldas→bottom, gorras/bolsos→accesorio), colores → hex +
nombre en español, tallas con disponibilidad, fotos reales del CDN, material y fecha de actualización.

## Funciones (según Analysis/Design)

- Catálogo: búsqueda de texto, filtros por categoría/tienda/precio/color/material, orden por precio,
  "cargar más", mensaje sin resultados, badge "Más barato" entre equivalentes (FR-13–16, US-41).
- Detalle: galería, tallas disponibles/agotadas, material, enlace a la tienda, fecha de actualización,
  **"También te puede gustar"** (US-37) y **reporte de errores** guardado localmente (US-40, pendiente
  del backend admin US-75).
- Favoritos con corazón ♡ persistentes (US-63) en cards y detalle; visibles en "Mis outfits".
- Constructor: pasarela lookbook con fotos reales, presupuesto, bloqueos, deshacer/rehacer (FR-24–30).
- Comparador: tabla lado a lado con material, nota de parecido y agregar al outfit directo (FR-22/23).

## Constructor con fotos reales

La pasarela no usa siluetas SVG con fotos recortadas (con fotos reales de plano de producto se veía
roto): es un **lookbook** con la foto completa por ranura, candado y marcos punteados para vacías.

## Diseño

Paleta editorial (crema + tinta + acento terracota), tipografía serif, tarjetas con hover elevado y
zoom de foto, header oscuro sticky con píldoras, dark mode automático, responsive.

## Build

```bash
npm run build     # /dist (relativo; incluye el snapshot en el bundle)
npm run preview
```
