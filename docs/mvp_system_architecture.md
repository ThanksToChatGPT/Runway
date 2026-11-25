# System Architecture Description — Outfit Builder (MVP / Release 1)

## 1. Overview: Architectural Pattern and Style

The MVP follows a pragmatic, lightweight version of two architectural approaches:

* **Architectural Pattern — Ports & Adapters (Hexagonal Architecture):** Keeps the core business logic (`backend/src/core/`) completely decoupled from Express, PostgreSQL, and the Python scraper service.
* **Architectural Style — Client-Server:**
  1. The **Frontend** (`Next.js`) consumes the Backend REST API over HTTP/HTTPS.
  2. The **Backend Core** (`Node.js`) communicates with **PostgreSQL** and the **Python Scraper Service** via outbound adapters.

---

## 2. Actors & Presentation Layer (Frontend)

### MVP Actors
* **Registered User:** Authenticates locally, configures price range and max outfit budget, searches/filters/compares products, builds and saves outfits, and opens external store links to buy.
* **Administrator:** Manages external stores (CRUD + active/inactive) and triggers automated product collection.

### Frontend Boundary
* **Stack:** Next.js (App Router), React, Tailwind CSS.
* **MVP UI Modules:**
  * *Auth UI:* Local registration and login (`/auth`).
  * *Catalog, Filters & Comparison UI:* Unified search, filters, sorting, pagination (`/`), product detail (`/products/[id]`), and side-by-side comparison (`/compare`).
  * *Outfit Builder & Saved Outfits UI:* Interactive 3-slot builder (`top`, `bottom`, `shoes`) with live COP total and over-budget warning (`/builder`), plus saved outfits list with external buy links (`/outfits`).
  * *Preferences UI:* Price range and maximum outfit budget management (`/preferences`).
  * *Admin Store Management UI:* Store CRUD and manual scraping trigger (`/admin`).
* **Outbound Connections:**
  * HTTP JSON calls to the Backend `REST API Controller Adapter`.
  * Direct browser redirect (`target="_blank"`) to external store URLs when purchasing garments.

---

## 3. Primary / Driving Adapter (Inbound)

* **Component:** `REST API Controller Adapter` (`backend/src/adapters/inbound/http/`)
* **Stack:** Node.js, Express, OpenAPI 3.0 (`openapi.yaml`), JWT auth middleware.
* **Responsibility:** Validates incoming HTTP requests, extracts authenticated user context (JWT), invokes the appropriate inbound port of the Application Core, and maps `DomainError` subclasses to clean HTTP responses with Spanish user-facing messages.

---

## 4. Application Core (`backend/src/core/`)

Pure Node.js business logic with **zero dependencies** on Express, SQL drivers, HTTP clients, or environment variables.

### 4.1. Inbound Ports (`core/ports/inbound/`)
1. **`AuthAndUserPort`:** Register, login, logout, get/update user preferences (price range & max budget).
2. **`CatalogSearchPort`:** Free-text search with combined filters, price sorting, pagination, product details, and side-by-side comparison.
3. **`OutfitBuilderPort`:** Create empty outfit, add/replace pieces (`top`, `bottom`, `shoes`), recalculate COP total and budget warning, save outfit with name, list user's saved outfits.
4. **`AdminStorePort`:** Create, edit, list, activate, and deactivate stores; trigger product collection and standardization.

### 4.2. Domain Layer (`core/domain/`)
* **8 MVP Entities:** `User`, `UserPreference`, `Store`, `Product`, `ProductImage`, `ProductSizeStock`, `Outfit`, `OutfitSlot`.
* **Domain Rules:**
  * *Budget & Price Validator:* Enforces non-negative COP amounts, `minPrice <= maxPrice`, live outfit total calculation, and non-blocking over-budget warning.
  * *Data Standardization Logic:* Normalizes store-specific colors, sizes, and categories into canonical values and filters out sexually explicit / restricted adult content.

### 4.3. Outbound Ports (`core/ports/outbound/`)
* **`Repository Ports`:** `UserRepository`, `PreferenceRepository`, `StoreRepository`, `ProductRepository`, `OutfitRepository`.
* **`Security Ports`:** `PasswordHasher` (bcrypt/Argon2id) and `TokenService` (JWT 15 min).
* **`DataExtractionPort`:** Contract to request product extraction for a given active store from the Python scraper service.

---

## 5. Secondary / Driven Adapters (Outbound)

| Outbound Port | Connection | Secondary Adapter | Protocol | External System |
| --- | --- | --- | --- | --- |
| **Repository Ports** | `function call` | **PostgreSQL Repository Adapter** *(Parameterized SQL Queries)* | `TCP` | **PostgreSQL Database** |
| **Security Ports** | `function call` | **Bcrypt/Argon2 & JWT Adapter** | `in-process` | Local crypto libraries |
| **DataExtractionPort** | `HTTP` | **Scraper HTTP Client Adapter** | `HTTP` | **Python Scraper Service** *(FastAPI + BeautifulSoup/Playwright/Scrapy)* |

### Polyglot Boundary (Node.js ↔ Python)
The **Python Scraper Service** (`scraper/`) runs as an independent containerized service exposing a simple HTTP endpoint (e.g., `POST /scrape`). When triggered by the Node.js backend:
1. It extracts raw product data from the target store (or mock store for local MVP testing).
2. It returns standardized/cleaned product payloads (or raw payloads standardized in the Core) over HTTP JSON.
3. Any scraping failure is isolated and never interrupts catalog browsing or outfit building.

---

## 6. MVP Technology Stack Summary

* **Frontend:** Next.js, React, Tailwind CSS.
* **Backend & API:** Node.js, Express, OpenAPI 3.0, JWT, bcrypt/Argon2id.
* **Scraper Worker:** Python (FastAPI, BeautifulSoup/Playwright/Scrapy).
* **Database:** PostgreSQL (8 MVP tables, parameterized queries).
* **Deployment:** Docker & `docker-compose.yml`.

### Out of Scope Infrastructure (Reserved for Future Releases)
* Google OAuth 2.0 Identity Adapter
* SMTP / Email Notification Adapter
* Amazon S3 Cloud Storage Adapter (MVP uses external image URLs directly)
* Cron/Scheduler & Scraping Logs Dashboard