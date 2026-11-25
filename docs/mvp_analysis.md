# Analysis — Outfit Builder (MVP / Release 1)

> **Scope Notice:** This document contains **exclusively the Release 1 (MVP — MUST)** requirements and user stories. All SHOULD, COULD, and WOULD features (Google OAuth, password recovery, favorites, outfit collections, product reports, virtual mannequin, undo/redo, piece locking, and admin statistics/logs) are explicitly out of scope for this version.

---

## Requirements

### Functional Requirements (MVP)

| ID | Description |
| --- | --- |
| FR-01 | The system shall allow new users to register using a valid email address and a secure password. It shall validate that the email address has not been previously registered and that the password meets the security policy requirements. |
| FR-02 | The system shall authenticate user credentials (email and password) to log in securely and allow logout at any time, invalidating active tokens/sessions. In the event of incorrect credentials, it shall emit a descriptive error message in Spanish without compromising system security. |
| FR-10 | The system shall allow authenticated users to define and save a preferred minimum and maximum product price range, as well as a maximum budget for a complete outfit (in COP). The configured price range shall be usable to restrict product results, and the maximum outfit budget shall be used to determine when an outfit exceeds the amount established by the user. |
| FR-12 | The system shall allow authenticated users to edit their saved preferences (price range and maximum outfit budget) at any time and view a consolidated summary of their currently stored preferences. |
| FR-13 | The system shall allow users to search the clothing catalog using free-text queries and present matching products from supported stores in a unified results view. Each result shall clearly identify its source store. |
| FR-14 | The system shall allow users to filter search results by price, brand, color, and available size, combining these criteria in the same search. |
| FR-15 | The system shall allow users to filter catalog results by clothing category/subcategory and source store (including or excluding specific stores). |
| FR-16 | The system shall allow users to sort product results by price (ascending/descending). |
| FR-18 | When a search returns many products, the system shall present results through pagination or incremental loading in manageable groups. |
| FR-19 | The system shall provide a product detail view containing the available information for a selected product: name, image gallery (at least one image when available), price in COP, brand, material (when available), color, sizes (visually distinguishing available from unavailable), and source store. |
| FR-21 | The system shall provide a direct external link from the product detail view so users can open the corresponding product page in the original store in a new tab. |
| FR-22 | The system shall support product comparison by allowing users to select two or more products and view their attributes side by side (price, brand, material, color, sizes, and rating when available). |
| FR-23 | The system shall display all monetary values consistently in Colombian pesos (COP) throughout the entire user interface. |
| FR-24 | The system shall provide an Outfit Builder in which users can start a new outfit from an empty composition and add the three mandatory garment slots: `top`, `bottom`, and `shoes`. |
| FR-25 | The system shall allow users to replace an existing piece in an outfit with an alternative product without recreating the entire outfit. |
| FR-26 | The system shall update the outfit visualization immediately whenever a piece is added or replaced, without requiring a full page reload. |
| FR-27 | The system shall allow users to add a product to the active outfit directly from search results, continuously recalculate the accumulated total price in COP, display the source store and price for every piece, and show a non-blocking over-budget warning when the total exceeds the user's configured maximum budget. |
| FR-29 | The system shall provide a visual composition view displaying the selected pieces of an outfit together in a single view. |
| FR-31 | The system shall allow authenticated users to save an outfit with a user-defined name so it can later be retrieved from "My Outfits". |
| FR-33 | The system shall allow users to open the original external store page for each individual piece in a saved or active outfit to purchase it. |
| FR-34 | The system shall provide administrators with tools to create, edit, activate, and deactivate external stores, and trigger automated product collection from active stores to persist products in the catalog database. |
| FR-36 | The system shall standardize product attributes collected from different stores (names, colors, sizes, and categories) into common canonical values so filters work consistently. |

### Non-Functional Requirements (MVP)

| ID | Category | Description |
| --- | --- | --- |
| RNF-01 | Performance | Text queries and combined filters shall return search results in under 2 seconds under normal load. |
| RNF-02 | Performance | Adding or replacing a garment in the Outfit Builder and recalculating the total price shall reflect in the UI in under 200 ms. |
| RNF-03 | Performance | Catalog images shall use lazy loading and web-optimized rendering. |
| RNF-06 | Security | User passwords shall never be stored in plain text; they must be hashed using `bcrypt` (cost >= 12) or `Argon2id`. |
| RNF-07 | Security | API authentication shall use signed JWT tokens (HMAC-SHA256 or RS256) with a short expiration period (15 minutes). |
| RNF-08 | Security | All database queries shall use parameterized queries against SQL injection (SQLi), strict input validation, and basic rate limiting on public endpoints. |
| RNF-09 | Usability | The UI shall be responsive from mobile devices (360px) to desktop monitors. |
| RNF-11 | Usability | Every error displayed to the user shall be in clear, natural Spanish without exposing stack traces or technical jargon. |
| RNF-13 | Reliability | Scraping failures on an external store shall not interrupt platform operations or degrade catalog search over previously collected data. |
| RNF-15 | Maintainability | The system shall follow a modular, decoupled Hexagonal Architecture (Next.js Frontend, Node.js/Express Backend, independent Python Scraper service, PostgreSQL Database). |
| RNF-16 | Maintainability | Backend REST endpoints shall be documented under OpenAPI 3.0. |
| RNF-17 | Maintainability | Core business logic (authentication, data standardization, and outfit price/budget calculation) shall maintain at least 70% unit test coverage. |
| RNF-19 | Compatibility | Client-server communication shall exclusively use JSON (UTF-8) following RESTful conventions. |
| RNF-20 | Scalability | All components (frontend, backend, scraper, database) shall be containerized with Docker and orchestrated via `docker-compose.yml`. |

---

## MVP User Stories (Release 1 — MUST Only)

### 1. Authentication
- **US-1 (Create an account):** New user registers with email and password; validates format, uniqueness, and password policy.
- **US-2 (Log in and log out):** User authenticates with email/password, receives session/JWT, and can log out; wrong credentials show a clear Spanish error.

### 2. User Preferences
- **US-11 (Set price range):** User sets and saves a minimum and maximum product price range in COP.
- **US-14 (Set maximum budget):** User sets and saves a maximum outfit budget in COP to trigger over-budget warnings.
- **US-15 (Edit preferences anytime):** User can update their saved price range and budget at any time.
- **US-17 (View preferences summary):** User views all saved preferences consolidated in one place.

### 3. Product Search & Filtering
- **US-18 (Search clothing by text):** Free-text search returning matching garments.
- **US-19 (See results from many stores):** Unified results showing products from multiple stores with the store name visible on each card.
- **US-20 (Filter by price):** Filter results using minimum/maximum price inputs.
- **US-21 (Filter by brand):** Filter results by one or more brands.
- **US-22 (Filter by color):** Filter results by standardized color.
- **US-23 (Filter by size):** Filter results to show only items with stock available in the selected size.
- **US-24 (Filter by clothing type):** Filter by category/subcategory (e.g., top, bottom, shoes, hoodie, jeans).
- **US-26 (Filter by store):** Include or exclude specific stores in the results.
- **US-27 (Sort results by price):** Sort results ascending or descending by price in COP.
- **US-32 (Pagination):** Load search results in paginated groups so the UI stays fast.

### 4. Product Details & Price Comparison
- **US-33 (Open product page):** Detail view displaying name, images, price (COP), brand, material, color, sizes, and source store.
- **US-34 (See product photos):** Image gallery showing at least one image when available.
- **US-35 (See available sizes):** Visually distinguish in-stock sizes from unavailable sizes.
- **US-38 (Link to store page):** Direct link opening the original store product page in a new tab.
- **US-42 (Compare products side by side):** Select 2+ products and view a side-by-side table (price, brand, material, color, sizes, rating).
- **US-43 (Show prices in COP):** Consistent COP currency formatting across the entire application.

### 5. Outfit Builder & Visualization
- **US-44 (Start a new outfit):** Open an empty Outfit Builder from scratch.
- **US-45 (Add a top):** Assign a top garment (t-shirt, shirt, hoodie, jacket) to the `top` slot.
- **US-46 (Add a bottom):** Assign a bottom garment (jeans, cargo, pants, shorts) to the `bottom` slot.
- **US-47 (Add shoes):** Assign footwear (sneakers, boots, shoes) to the `shoes` slot.
- **US-49 (Replace a piece):** Replace any assigned piece with an alternative product.
- **US-50 (Live outfit update):** Visual display updates immediately without page reload.
- **US-52 (Add products from search results):** "Add to outfit" action directly from product cards in search results.
- **US-53 (See outfit total price):** Real-time calculation of total outfit price in COP.
- **US-54 (Over-budget warning):** Display a non-blocking warning when the total exceeds the user's maximum budget.
- **US-55 (See the store of each piece):** Display store name and price for each piece in the outfit.
- **US-59 (Visual outfit composition):** Display the outfit pieces together in a single visual composition view.

### 6. Saved Outfits & External Purchase
- **US-64 (Save outfits with a name):** Save an outfit with a custom name to "My Outfits".
- **US-68 (Buy each piece in its store):** Open the external store page for each piece in the outfit.

### 7. Admin & Data Management
- **US-70 (Manage stores):** Admin creates, edits, activates, and deactivates external stores.
- **US-71 (Collect products automatically):** Trigger automated product extraction for active stores and save products to the database.
- **US-74 (Standardize product data):** Clean and normalize names, colors, sizes, and categories across stores.

---

## Explicitly Out of Scope for MVP (Do NOT Implement Yet)
- Google OAuth 2.0 (US-3), password recovery via email/SMTP (US-4), edit profile/delete account (US-5, US-6), visitor browsing without account (US-7).
- Onboarding guide (US-8), liked brands/colors/sizes/fit preferences (US-9, US-10, US-12, US-13), reset preferences (US-16).
- Filter by material (US-25), clear all filters (US-28), personalized search ranking (US-29), recent searches (US-30), no-results tips (US-31).
- Similar products / recommendations (US-36, US-37), last price update UI (US-39), report product (US-40), cheapest badge (US-41).
- Accessories slot (US-48), remove piece (US-51), undo/redo (US-56), lock piece (US-57), style mismatch tips (US-58), virtual mannequin/zoom/modes (US-60, US-61, US-62).
- Favorite products (US-63), edit/delete/duplicate outfits (US-65, US-67), outfit collections (US-66), export shopping list (US-69).
- Scheduled scraping cron (US-72), scraping logs UI (US-73), user reports review (US-75), edit/hide product UI (US-76), admin stats dashboard (US-77).