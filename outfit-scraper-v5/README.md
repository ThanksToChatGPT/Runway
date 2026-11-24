# Outfit scraper — v4

Collects clothing products from online stores into a local SQLite database and shows them in a small web viewer.
Python 3.10+.

```
pip install -r requirements.txt
python -m outfit_scraper            # opens the menu (everything below is in the menu)
python -m outfit_scraper demo       # fake stores + viewer, to see it working in a minute
python -m unittest discover -s tests
```

## Quick start with a real store (Mattelsa, VTEX)

```
python -m outfit_scraper add https://www.mattelsa.net --name Mattelsa
python -m outfit_scraper run              # scrapes every page, keeps single garments
python -m outfit_scraper serve            # viewer with the image carousel
```

Verified on 2026-11-16: the whole catalog is read (569 products, 12 requests) and 568 single
garments are saved (1 utility item of the store, "Calcula tu envío", is skipped; 0 packs —
Mattelsa sells every garment individually).

## The menu

| Option | What it does |
|---|---|
| 1 Add a store | type only the URL: the platform (Shopify, VTEX, VTEX IO) is detected automatically, the packs of the sample are reported and the store is saved in `stores.json` |
| 2 List stores | platform, active, products, last status |
| 3 Detect | reads `robots.txt` and the home page, searches the HTML and headers for platform fingerprints (grep), tests the public APIs and prints the verdict |
| 4 Test a store | reads a few products and prints them; nothing is saved |
| 5 Collect now | all active stores, one store, or only the first N products |
| 6 Schedule | collect again every N hours |
| 7 Viewer | opens the viewer in the browser (image carousel) |
| 8 Grep | search your own keywords in a page or in a saved HTML file |
| 9 Activate / deactivate / remove | a store |
| 10 Settings | single-garment filter, images, delay, user agent… |
| 11 Logs | latest scraping logs |
| 12 Demo | fake stores |
| 13 Search | search the collected products with filters (no scraping) |
| 14 Database info | detects the engine from the file signature + keyword grep and tests its API |

Every option is also a command: `add URL`, `detect URL [--grep words] [--html file]`, `check ID`, `run`, `schedule --every 24`, `serve`.

## What was fixed in v4 (the meaning of "1 unit")

* **"1 unit" means ONE garment, not one unit left in stock.** A product is kept when it is a single piece:
  "Pack 3 medias", "Combo jean + buzo", "Kit deportivo", "medias x3", "juego de 2" are packs and are skipped.
  The product name is read first ("Pack 3" is more precise than a bare kit flag), then the structured data of
  the store (VTEX `isKit`, `unitMultiplier`, "Unidades"). A knitted fabric like "rib 2X2" is NOT a pack (it is
  how the fabric is made), and utility items ("Calcula tu envío") without sizes are not garments either.
  Every product stores `pack_size` (1 = single) and `pack_evidence` (why we think it is a pack), so the viewer
  can show a "pack of N" badge. The filter is `single_garment` (on by default) and can be changed per store
  from the menu or `stores.json`.
* **There is no stock-unit filter anymore**: the earlier "exactly 1 unit in stock" filter (and its
  `unknown_units` companion) was removed — collecting by units was not the intention. The units each store
  reports are still stored (`product.units_total`, per size in `product_size_stock.units`) as plain data.
* **Menu 14 detects the database engine the same way `detect` finds a store platform**: it reads the first bytes
  of the file (`SQLite format 3\0`), greps keywords for text dumps (`postgresql`, `mysql`, `sqlite`), and then
  tests the matching database API (for SQLite: the `sqlite3` module of the standard library).
* Faster collection: when the image URL already says which photo is the front of the garment alone
  (VTEX `ref-1.jpg`), no image is downloaded to look at its pixels.

## What was fixed in v3 (why v2 did not scrape)

* **`detect` rejected HTTP 206 and did not retry 429.** VTEX answers `206 Partial Content` when asked for a range of
  products (`_from`/`_to`), and answers `429` when several probes arrive together. v2 marked both as "unexpected
  status", so no API was ever "usable" and Mattelsa (a VTEX store) could not be added. Now 206 is accepted as a
  success and 429 is retried with backoff.
* **Colors of Colombian stores**: marfil, crudo, borgoña, mostaza, terracota, turquesa, celeste, fucsia… are now
  normalized (v2 only knew a short list, so "Marfil" products were saved with no color).
* **Categories**: `body` and `crop top` are now `top/t-shirt`.
* **Images**: VTEX repeats each photo with different URL suffixes (`?v=`, width marks); v2 saved 20–32 near-duplicates
  per product. Now the URL is canonicalized, at most 8 photos are kept, and the VTEX `ref-1.jpg` (front of the
  garment alone) goes first. `ref-2` (detail) and `ref-4` are demoted.
* **Material**: VTEX field `Composición tela 1` is read too.

## Falabella (why it is not in the store list)

`www.falabella.com.co` sits behind Cloudflare bot protection: every anonymous request (curl, Python requests, and a
headless browser) receives HTTP 403, including `robots.txt`. The scraper is deliberately "polite": it never tries to
get around a bot protection, so Falabella cannot be collected this way. Options if you need its catalog:
use an official feed/integration, or ask the retailer for API access. (`falabella.com.co` uses an in-house/Oracle
stack, not VTEX.)

## What gets collected

* **Only single garments** (`single_garment: true`, default): one piece per product, no packs or kits of
  several garments. The units in stock that each store reports are stored as plain data (shown per size),
  but they are never used to decide what to collect.
* **The image of the garment alone when possible.** The image hints (file name, alt text, label) are read first; then, with Pillow, the first
  candidates are looked at in memory (plain background and no skin tones = garment alone, skin tones = a model). If no image looks like the
  garment alone, the best remaining one is used. It is a heuristic and can be wrong. Each image is saved with a `kind`
  (`product-only`, `model`, `other`). **Images are never stored: only their URLs.**
* **As many pages as the store allows.** No product limit by default. Shopify reads up to 400 pages of 250. VTEX serves a window of 2,500 results per query, so it
  then reads category by category (Mattelsa has 69 leaf categories). VTEX IO's search also serves a limited window, so it is read again with several
  sort orders and the results are joined (no repeated products). HTML stores read up to 50 pages and stop when a page brings nothing new.

## The viewer

Stores, logs and products with filters. Every product has a swipeable image slider (swipe, arrows, dots, keyboard
arrows) and a click opens it full size (lightbox). Badges show "garment alone" / "on a model" and "pack of N"
(when packs are kept). The "single garment (no packs)" checkbox hides packs. Everything coming from a store is
shown as plain text.

## Good manners

`robots.txt` is respected (the scraper never tries to get around a block or a bot protection), 2 seconds between requests, retries with backoff and a circuit breaker.
Put your email in `user_agent`. Read each store's terms of use before collecting.

## How it works

`PoliteClient` → adapter (`shopify`, `vtex`, `vtex_is`, `html`) → `normalizer` (price in COP, colors, sizes, category,
material, single-garment vs pack) → single-garment filter →
`image_picker` → `db` (SQLite; tables `store`, `product`, `product_image`, `product_size_stock`, `scraping_log`,
same fields as the UML plus units, image kind, pack size). A failure in one store is logged and never stops the
others. The database engine of this project is **SQLite** (detected by menu option 14 from the file signature;
the academic design document uses PostgreSQL as the reference engine for the full app — the scraper component
ships with SQLite and the migration is done by the backend team).
