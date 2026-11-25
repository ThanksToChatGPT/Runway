# Outfit Builder — Documentación de la aplicación

> Documento vivo: se actualiza a medida que avanzamos en el MVP (Release 1).

## ¿Qué es Outfit Builder?

Outfit Builder es una plataforma para armar outfits con ropa real de tiendas colombianas.
La persona elige una prenda para cada parte del outfit (parte superior, parte inferior y calzado),
ve cuánto cuesta todo en pesos colombianos (COP) y recibe un aviso si se pasa de su presupuesto.

El catálogo se llena automáticamente con productos de distintas tiendas. Como cada tienda
escribe los datos a su manera, la aplicación los ordena para que todo se vea igual
(mismos nombres de colores, tallas y categorías).

## Estado actual

| Fase | Qué incluye | Estado |
|------|-------------|--------|
| 1. Núcleo del negocio (dominio) | Las reglas principales: usuarios, preferencias, tiendas, productos, outfits y limpieza del catálogo | ✅ Terminada |
| 2. Puertos | Los "contratos": qué ofrece el núcleo (entrantes) y qué necesita del mundo exterior (salientes) | ✅ Terminada |
| 3. Casos de uso | Las acciones completas (registrarse, guardar un outfit, buscar prendas…) | ⏳ Pendiente |
| 4. Adaptadores | Base de datos, API web y conexión con el scraper | ⏳ Pendiente |

## Cómo está organizado el código

```
backend/src/
├── core/
│   ├── domain/              ← Fase 1: el corazón de la aplicación
│   │   ├── constants.js     ← listas fijas (roles, secciones del outfit, categorías)
│   │   ├── errors.js        ← los tipos de error y sus mensajes
│   │   ├── guards.js        ← validaciones pequeñas que se reutilizan
│   │   ├── entities/        ← las "piezas" del negocio
│   │   └── rules/           ← reglas que no pertenecen a una sola pieza
│   └── ports/               ← Fase 2: contratos (ver sección "Fase 2")
│       ├── inbound/         ← lo que el núcleo ofrece a la API
│       └── outbound/        ← lo que el núcleo necesita de afuera
└── tests/
    ├── domain/              ← pruebas del núcleo
    └── ports/               ← pruebas de los contratos y DTOs
```

### Las piezas del negocio (entidades)

| Pieza | Para qué sirve |
|-------|----------------|
| **User** | La persona que usa la app. Puede ser usuario normal o administrador. |
| **UserPreference** | Rango de precios que le interesa y presupuesto máximo por outfit. |
| **Store** | Una tienda de la que traemos productos. Se puede activar o desactivar. |
| **Product** | Una prenda del catálogo, con precio, enlace a la tienda y si es de segunda mano. |
| **ProductImage** | Una foto de la prenda (una puede ser la principal). |
| **ProductSizeStock** | Una talla de la prenda y si está disponible. |
| **Outfit** | La combinación de prendas, con su precio total y el aviso de presupuesto. |
| **OutfitSlot** | Cada sección del outfit: parte superior, parte inferior o calzado. |

### Reglas importantes que ya funcionan

- Los precios y presupuestos nunca pueden ser negativos.
- El precio mínimo no puede ser mayor que el máximo.
- El total del outfit es la suma de los precios de sus prendas.
- Pasarse del presupuesto **solo muestra un aviso**: no impide armar ni guardar el outfit.
- Una prenda solo puede ir en su sección (unos zapatos no pueden ir en "parte superior").
- No se puede guardar un outfit vacío.
- Los colores, tallas y categorías de todas las tiendas se unifican ("Negro", "BLK" → `black`; "Mediana" → `M`).
- Se excluyen productos de contenido sexual explícito, sin afectar ropa normal como ropa interior o vestidos de baño.

### Cómo correr las pruebas

```bash
cd backend
npm install
npm test
```

---

## Patrones de diseño

Aquí están solo los patrones agrupados según su origen.
Cada fila dice qué problema resuelve y dónde verlo. Rutas relativas a `backend/src/core/domain/`.

### Patrón de arquitectura

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Hexagonal (Puertos y Adaptadores)** | Que las reglas del negocio no dependan de la base de datos, del servidor web ni del scraper. Se pueden cambiar esas piezas sin tocar el centro. | Toda la carpeta `domain/`: no importa nada externo. Los puertos están en `core/ports/` (fase 2); los adaptadores llegan en la fase 4. |

### Patrones creacionales (GoF)

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Factory Method** (versión estática) | Crear un objeto listo y válido con una sola llamada, sin tener que armarlo a mano. | `Outfit.createEmpty(userId)` → outfit con sus 3 secciones vacías.<br>`UserPreference.createDefault(userId)` → preferencias sin límites. |

### Patrones de diseño guiado por el dominio (DDD)

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Entity** (Entidad) | Representar algo del negocio que tiene identidad propia (`id`) y cambia con el tiempo. | Las 8 clases de `entities/`. |
| **Aggregate** (Agregado) | Un objeto "jefe" controla a sus partes internas, para que nunca queden en un estado incoherente. | `Outfit` controla sus `OutfitSlot` (siempre hay 3, una por sección). `Product` controla sus `ProductImage` (máximo una principal) y sus `ProductSizeStock`. |
| **Rich Domain Model** (Modelo rico) | Evitar objetos que solo guardan datos: cada uno valida sus datos y hace sus propios cálculos. | `Outfit.calculateTotalPrice()`, `Outfit.evaluateBudget()`, `UserPreference.update()`, `Store.activate()`. |
| **Domain Service** (Servicio de dominio) | Ubicar reglas que aplican a muchos objetos y no pertenecen a uno solo. | `rules/catalogStandardizer.js`: unifica colores, tallas y categorías, y filtra contenido restringido. |

### Patrones de asignación de responsabilidades (GRASP)

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Information Expert** (Experto) | Darle cada tarea a quien ya tiene los datos para hacerla. | `Outfit` calcula su total porque conoce sus prendas. `Product.getAvailableSizes()`. `UserPreference.isPriceInRange()`. |
| **Creator** (Creador) | Decidir quién crea cada objeto: quien lo contiene. | `Outfit` crea sus `OutfitSlot`. `Product` crea sus `ProductImage` y `ProductSizeStock` a partir de datos simples. |
| **Pure Fabrication** (Fabricación pura) | Crear un módulo que no es un concepto del negocio, para no ensuciar las entidades con tareas ajenas. | `rules/catalogStandardizer.js` y `guards.js`. |
| **Protected Variations** (Variaciones protegidas) | Proteger el núcleo de cosas que pueden cambiar (base de datos, tiendas, framework). | Es el objetivo de la arquitectura hexagonal: `domain/` no conoce Express, PostgreSQL ni el scraper. |


---

## Fase 2 — Puertos (`backend/src/core/ports/`)

Un **puerto** es un contrato: una clase cuyos métodos dicen *qué* se hace, pero no *cómo*.
Cada método base lanza "no implementado"; la implementación real la ponen los servicios
(fase 3) o los adaptadores (fase 4). Los puertos solo importan cosas de `core/`:
nada de Express, PostgreSQL, bcrypt ni `fetch` (hay un test que lo verifica).

```
core/ports/
├── index.js               ← exporta todo
├── contract.js            ← notImplemented() y assertImplements()
├── catalogQuery.js        ← PRICE_SORT, PAGINATION, MIN/MAX_COMPARE_ITEMS, tipo Page
├── inbound/               ← lo que el núcleo OFRECE (los usa el adaptador HTTP)
│   ├── AuthAndUserPort.js
│   ├── CatalogSearchPort.js
│   ├── OutfitBuilderPort.js
│   ├── AdminStorePort.js
│   └── dtos/              ← tipos de entrada/salida + funciones toXxxDto()
│       ├── authDtos.js   catalogDtos.js   outfitDtos.js   adminDtos.js
└── outbound/              ← lo que el núcleo NECESITA (lo implementan los adaptadores)
    ├── repositories/      ← UserRepository, PreferenceRepository, StoreRepository,
    │                        ProductRepository, OutfitRepository
    ├── security/          ← PasswordHasher, TokenService
    └── extraction/        ← ScraperPort
```

> Los archivos sueltos `ports/inbound.js` y `ports/outbound.js` del prototipo anterior se
> eliminaron: los reemplazan estas carpetas. Los servicios viejos de `core/services/` siguen
> ahí sin cambios y se reescribirán en la fase 3 sobre estos contratos.

### Cómo se implementa un puerto

```js
import { PasswordHasher, assertImplements } from '../core/ports/index.js';

// Opción A: extender la clase
class BcryptPasswordHasher extends PasswordHasher {
  async hash(plain) { /* bcrypt.hash(plain, 12) */ }
  async compare(plain, hash) { /* bcrypt.compare(plain, hash) */ }
}

// Opción B: objeto plano con los mismos métodos (útil para mocks en tests)
const fakeHasher = { hash: async (p) => `h:${p}`, compare: async (p, h) => h === `h:${p}` };

// En index.js: falla al arrancar si falta un método
assertImplements(new BcryptPasswordHasher(), PasswordHasher);
```

### Patrones aplicados en esta fase

| Patrón | Qué resuelve | Dónde verlo |
|--------|--------------|-------------|
| **Repository** | El núcleo guarda y busca entidades sin saber que existe SQL. Los repositorios reciben y devuelven entidades del dominio (`User`, `Outfit`…), nunca filas. | `outbound/repositories/*`. Ej.: `outfitRepository.findByIdForUser(outfitId, userId)` → `Outfit \| null`. |
| **Strategy / Inversión de dependencias** | Cambiar bcrypt por Argon2id, o JWT por un mock, sin tocar el núcleo: el servicio recibe "algo que cumple `PasswordHasher`". | `outbound/security/*` y `outbound/extraction/ScraperPort.js`. |
| **DTO** | La API recibe y devuelve objetos planos y estables, distintos de las entidades. Así nunca sale un `passwordHash` y la forma del JSON no cambia si cambia una entidad. | `inbound/dtos/*`: tipos `XxxInput` / `XxxDto` y funciones `toUserDto`, `toProductDetailDto`, `toOutfitDto`, `toStoreDto`… |
| **Facade / Interfaz de casos de uso** | La capa HTTP ve solo 4 puertas de entrada, cada una con las operaciones de un tema. | `inbound/*Port.js`. |

Ejemplo de DTO (el servicio calcula, el mapper da forma):

```js
const budget = outfit.evaluateBudget(preference?.maxOutfitBudget ?? null);
return toOutfitDto(outfit, { budget, storesById });
// → { id, isSaved, name, slots: [{ slotType, label, piece }], totalCostCop, currency: 'COP',
//     budget: { maxBudget, isOverBudget, differenceCop }, createdAt }
```

### Mapa de contratos

**Puertos entrantes.** Todos los métodos son `async` y reciben **un solo objeto** de entrada.

| Puerto | Método | Entrada | Salida |
|--------|--------|---------|--------|
| `AuthAndUserPort` | `register` | `{ email, password, name, country? }` | `AuthSessionDto` |
| | `login` | `{ email, password }` | `AuthSessionDto` |
| | `logout` | `{ accessToken }` | `void` |
| | `verifySession` | `{ accessToken }` | `{ userId, role }` |
| | `getPreferencesSummary` | `{ userId }` | `PreferencesSummaryDto` |
| | `updatePreferences` | `{ userId, minPrice?, maxPrice?, maxOutfitBudget? }` | `PreferencesSummaryDto` |
| `CatalogSearchPort` | `searchProducts` | `SearchProductsInput` (texto, precio, marcas, colores, tallas, categorías, tiendas incluidas/excluidas, `sort`, `page`, `pageSize`, `usePreferredPriceRange`) | `ProductPageDto` |
| | `getProductDetail` | `{ productId }` | `ProductDetailDto` |
| | `compareProducts` | `{ productIds }` (2 a 4) | `{ products: ProductDetailDto[] }` |
| `OutfitBuilderPort` | `startEmptyOutfit` | `{ userId, name? }` | `OutfitDto` (borrador) |
| | `assignOrReplacePiece` | `{ userId, draft: { name?, pieces }, slotType, productId }` | `OutfitDto` (borrador) |
| | `saveOutfit` | `{ userId, name, pieces: { top?, bottom?, shoes? } }` | `OutfitDto` |
| | `getUserOutfits` | `{ userId }` | `OutfitDto[]` |
| | `getOutfitById` | `{ userId, outfitId }` | `OutfitDto` |
| `AdminStorePort` | `createStore` | `{ actor, name, baseUrl, isActive? }` | `StoreDto` |
| | `updateStore` | `{ actor, storeId, name?, baseUrl? }` | `StoreDto` |
| | `toggleStoreStatus` | `{ actor, storeId, isActive }` | `StoreDto` |
| | `listStores` | `{ actor }` | `StoreDto[]` |
| | `runStoreScraping` | `{ actor, storeId }` | `ScrapingResultDto` |

**Puertos salientes.**

| Puerto | Métodos |
|--------|---------|
| `UserRepository` | `findByEmail(email)`, `findById(id)`, `create(user)` |
| `PreferenceRepository` | `findByUserId(userId)`, `upsert(preference)` |
| `StoreRepository` | `findAll({ onlyActive? })`, `findById(id)`, `create(store)`, `update(store)`, `setActive(id, isActive)` |
| `ProductRepository` | `search(criteria)` → `Page<Product>`, `findById(id)`, `findByIds(ids)`, `upsertMany(storeId, products)` → `{ inserted, updated }` |
| `OutfitRepository` | `create(outfit)`, `findByUserId(userId)`, `findByIdForUser(outfitId, userId)` |
| `PasswordHasher` | `hash(plain)` → `string`, `compare(plain, hash)` → `boolean` |
| `TokenService` | `sign({ sub, role })` → `{ token, expiresInSeconds }`, `verify(token)` → `{ sub, role }`, `revoke(token)` |
| `ScraperPort` | `extractProductsByStore(store)` → `RawScrapedProduct[]` (sin estandarizar) |

