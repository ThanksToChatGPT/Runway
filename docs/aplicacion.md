# Outfit Builder — Documentación de la aplicación

> Documento vivo: se actualiza a medida que avanzamos en el MVP (Release 1).

## ¿Qué es Outfit Builder?

Outfit Builder es una plataforma para armar outfits con ropa real de tiendas colombianas.
La persona elige una prenda para cada parte del outfit (parte superior, parte inferior y calzado),
ve cuánto cuesta todo en pesos colombianos (COP) y recibe un aviso si se pasa de su presupuesto.

El catálogo se llena automáticamente con productos de distintas tiendas. Como cada tienda
escribe los datos a su manera, la aplicación los ordena para que todo se vea igual
(mismos nombres de colores, tallas y categorías).

---

## Arquitectura

El backend sigue la **arquitectura hexagonal (puertos y adaptadores)**. En el centro está el
**núcleo** (`backend/src/core/`), que contiene las reglas del negocio y no conoce Express,
PostgreSQL, bcrypt, JWT ni el scraper. Todo lo externo se conecta al núcleo a través de contratos.

```
   API web (Express)                                  Base de datos, JWT, bcrypt, scraper
          │                                                          ▲
          ▼                                                          │
  Contratos de entrada ──► Casos de uso ──► Dominio      Contratos de salida
   (lo que el núcleo        (servicios)    (entidades     (lo que el núcleo
    ofrece)                                  y reglas)      necesita de afuera)
```

| Capa | Qué es | Carpeta |
|------|--------|---------|
| **Dominio** | Las piezas del negocio y sus reglas. | `core/domain/` |
| **Contratos (puertos)** | Qué ofrece el núcleo y qué necesita, sin decir cómo se hace. | `core/ports/` |
| **Casos de uso (servicios)** | Las acciones completas: registrarse, buscar prendas, guardar un outfit… | `core/services/` |
| **Adaptadores** | Las piezas concretas: Express, PostgreSQL, JWT, bcrypt, cliente del scraper. Todavía no están conectadas al núcleo. | `adapters/` |

### Cómo está organizado el código

```
backend/src/core/
├── domain/
│   ├── constants.js          ← listas fijas (roles, secciones del outfit, categorías)
│   ├── errors.js             ← los tipos de error y sus mensajes en español
│   ├── guards.js             ← validaciones pequeñas que se reutilizan
│   ├── entities/             ← las piezas del negocio
│   └── rules/                ← reglas que no pertenecen a una sola pieza
├── ports/
│   ├── contract.js           ← notImplemented() y assertImplements()
│   ├── catalogQuery.js       ← orden por precio, paginación y límites de comparación
│   ├── inbound/              ← contratos de entrada + DTOs
│   └── outbound/             ← contratos de salida (repositorios, seguridad, scraper)
└── services/
    ├── applicationGuards.js  ← validaciones comunes (sesión, rol admin, existe / no existe)
    ├── AuthAndUserService.js
    ├── AdminStoreService.js
    ├── CatalogSearchService.js
    └── OutfitBuilderService.js
```

> Los archivos en minúscula de `services/` (`authService.js`, `adminService.js`, `catalogService.js`,
> `outfitService.js`) son el prototipo anterior. La app actual todavía los usa y se eliminarán
> cuando los adaptadores se conecten a los servicios nuevos.

---

## Dominio

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

### Reglas del negocio

- Los precios y presupuestos nunca pueden ser negativos.
- El precio mínimo no puede ser mayor que el máximo.
- El total del outfit es la suma de los precios de sus prendas.
- Pasarse del presupuesto **solo muestra un aviso**: no impide armar ni guardar el outfit.
- Una prenda solo puede ir en su sección (unos zapatos no pueden ir en "parte superior").
- No se puede guardar un outfit vacío ni sin nombre.
- Los colores, tallas y categorías de todas las tiendas se unifican ("Negro", "BLK" → `black`; "Mediana" → `M`).
- Se excluyen productos de contenido sexual explícito, sin afectar ropa normal como ropa interior o vestidos de baño.
- Una persona solo puede ver sus propios outfits.
- Solo un administrador puede gestionar tiendas y actualizar el catálogo.

### Errores

Todos los errores tienen un mensaje en español listo para mostrar. El núcleo no conoce
códigos HTTP: la API traduce cada tipo a su código.

| Error | Cuándo ocurre |
|-------|---------------|
| `ValidationError` | Datos que no cumplen una regla (precio negativo, prenda en la sección equivocada…). |
| `UnauthorizedError` | No hay sesión, o el correo o la contraseña no son correctos. |
| `ForbiddenError` | Hay sesión, pero la persona no tiene permiso (p. ej. no es administradora). |
| `NotFoundError` | No existe, está oculto o pertenece a otra persona. |
| `ConflictError` | Choca con algo existente (p. ej. un correo ya registrado). |

---

## Contratos (puertos)

Un **contrato** es una clase cuyos métodos dicen *qué* se hace, pero no *cómo*. Cada método
base lanza "no implementado". Los casos de uso implementan los contratos de entrada y los
adaptadores implementan los de salida.

### Contratos de entrada (lo que el núcleo ofrece)

Todos los métodos son `async` y reciben **un solo objeto**.

| Contrato | Método | Entrada | Salida |
|----------|--------|---------|--------|
| `AuthAndUserPort` | `register` | `{ email, password, name, country? }` | `AuthSessionDto` |
| | `login` | `{ email, password }` | `AuthSessionDto` |
| | `logout` | `{ accessToken }` | nada |
| | `verifySession` | `{ accessToken }` | `{ userId, role }` |
| | `getPreferencesSummary` | `{ userId }` | `PreferencesSummaryDto` |
| | `updatePreferences` | `{ userId, minPrice?, maxPrice?, maxOutfitBudget? }` | `PreferencesSummaryDto` |
| `CatalogSearchPort` | `searchProducts` | texto, precio, marcas, colores, tallas, categorías, tiendas, `sort`, `page`, `pageSize`, `usePreferredPriceRange` | `ProductPageDto` |
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

### Contratos de salida (lo que el núcleo necesita de afuera)

Reciben y devuelven entidades del dominio, nunca filas de la base de datos.

| Contrato | Métodos |
|----------|---------|
| `UserRepository` | `findByEmail(email)`, `findById(id)`, `create(user)` |
| `PreferenceRepository` | `findByUserId(userId)`, `upsert(preference)` |
| `StoreRepository` | `findAll({ onlyActive? })`, `findById(id)`, `create(store)`, `update(store)`, `setActive(id, isActive)` |
| `ProductRepository` | `search(criteria)` → página de productos, `findById(id)`, `findByIds(ids)`, `upsertMany(storeId, products)` → `{ inserted, updated }` |
| `OutfitRepository` | `create(outfit)`, `findByUserId(userId)`, `findByIdForUser(outfitId, userId)` |
| `PasswordHasher` | `hash(plain)` → `string`, `compare(plain, hash)` → `boolean` |
| `TokenService` | `sign({ sub, role })` → `{ token, expiresInSeconds }`, `verify(token)` → `{ sub, role }`, `revoke(token)` |
| `ScraperPort` | `extractProductsByStore(store)` → productos crudos, sin estandarizar |

### DTOs (lo que entra y sale del núcleo)

La API recibe y devuelve objetos planos y estables, distintos de las entidades. Así nunca sale
un `passwordHash` y la forma del JSON no cambia si cambia una entidad. Están en
`ports/inbound/dtos/` junto con sus funciones de conversión (`toUserDto`, `toProductDetailDto`,
`toOutfitDto`, `toStoreDto`…).

Ejemplo de un outfit tal como sale del núcleo:

```js
{ id, isSaved, name,
  slots: [{ slotType, label, piece: { productId, name, priceCop, externalUrl, store } }],
  totalCostCop, currency: 'COP',
  budget: { maxBudget, isOverBudget, differenceCop },
  createdAt }
```

---

## Casos de uso (servicios)

Cada servicio implementa un contrato de entrada: valida quién hace la petición, usa las
entidades del dominio para aplicar las reglas y guarda o consulta datos mediante los contratos
de salida. No sabe nada de HTTP ni de SQL.

| Servicio | Usa | Qué hace |
|----------|-----|----------|
| **AuthAndUserService** | `UserRepository`, `PreferenceRepository`, `PasswordHasher`, `TokenService` | **Registro**: el correo no puede estar repetido y la contraseña debe tener de 8 a 72 caracteres, con al menos una letra y un número. Se guarda hasheada y el usuario siempre queda con rol `user`. **Login**: el mismo mensaje si falla el correo o la contraseña. **Logout**: invalida el token. **Preferencias**: solo cambia los campos enviados. |
| **AdminStoreService** | `StoreRepository`, `ProductRepository`, `ScraperPort` | Solo para administradores. Crea, edita, activa/desactiva y lista tiendas. **Actualizar catálogo**: pide los productos de una tienda activa al scraper, unifica colores, tallas y categorías, descarta el contenido restringido y los datos inválidos, y guarda todo en lote. Si el scraper falla, responde `status: 'failed'` sin tocar el catálogo. |
| **CatalogSearchService** | `ProductRepository`, `StoreRepository`, `PreferenceRepository` | **Búsqueda**: filtros combinados, orden por precio y páginas de máximo 50 productos; puede usar el rango de precios guardado. **Detalle**: galería, tallas disponibles y agotadas, tienda y enlace. **Comparar**: de 2 a 4 productos lado a lado. Los productos ocultos nunca se muestran. |
| **OutfitBuilderService** | `ProductRepository`, `OutfitRepository`, `PreferenceRepository`, `StoreRepository` | El outfit en construcción vive en el navegador: en cada cambio el servicio lo vuelve a armar, recalcula el total en COP y revisa el presupuesto. **Guardar** exige nombre y al menos una prenda. **Mis outfits** muestra tienda, precio y enlace de compra de cada prenda. |

Ejemplo del recorrido al guardar un outfit:

```
API → OutfitBuilderService.saveOutfit({ userId, name, pieces })
  ├─ ¿hay sesión? ¿tiene nombre?                         ← validaciones iniciales
  ├─ productRepository.findByIds(...)                    ← contrato de salida
  ├─ Outfit.createEmpty() → addOrReplacePiece() → evaluateBudget()   ← dominio
  ├─ outfitRepository.create(outfit)                     ← contrato de salida
  └─ toOutfitDto(...)                                    ← DTO de salida
```

Cada servicio recibe lo que necesita al crearse, así que se le puede pasar cualquier
implementación que cumpla los contratos:

```js
const auth = new AuthAndUserService({
  userRepository,        // p. ej. la versión con PostgreSQL
  preferenceRepository,
  passwordHasher,        // p. ej. bcrypt
  tokenService,          // p. ej. JWT
});
```

---

## Patrones de diseño

Cada fila dice qué problema resuelve y dónde verlo. Rutas relativas a `backend/src/core/`.

### Arquitectura

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Hexagonal (Puertos y Adaptadores)** | Que las reglas del negocio no dependan de la base de datos, del servidor web ni del scraper. Se pueden cambiar esas piezas sin tocar el centro. | Todo `core/`: no importa Express, PostgreSQL, clientes HTTP ni lee variables de entorno. |
| **Service Layer / Caso de uso** | Cada acción del usuario está en un solo método que coordina dominio y contratos. La API no tiene lógica de negocio. | `services/*Service.js`. Cada clase extiende su contrato: `class OutfitBuilderService extends OutfitBuilderPort`. |
| **Facade** | La API ve solo 4 puertas de entrada, cada una con las operaciones de un tema. | `ports/inbound/*Port.js`. |

### Creacionales (GoF)

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Factory Method** (versión estática) | Crear un objeto listo y válido con una sola llamada. | `Outfit.createEmpty(userId)` → outfit con sus 3 secciones vacías.<br>`UserPreference.createDefault(userId)` → preferencias sin límites. |

### Diseño guiado por el dominio (DDD)

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Entity** (Entidad) | Representar algo del negocio que tiene identidad propia (`id`) y cambia con el tiempo. | Las 8 clases de `domain/entities/`. |
| **Aggregate** (Agregado) | Un objeto "jefe" controla a sus partes internas para que nunca queden en un estado incoherente. | `Outfit` controla sus `OutfitSlot` (siempre 3). `Product` controla sus `ProductImage` (máximo una principal) y sus `ProductSizeStock`. |
| **Rich Domain Model** (Modelo rico) | Cada objeto valida sus datos y hace sus propios cálculos, en vez de solo guardar datos. | `Outfit.calculateTotalPrice()`, `Outfit.evaluateBudget()`, `UserPreference.update()`, `Store.activate()`. |
| **Domain Service** (Servicio de dominio) | Ubicar reglas que aplican a muchos objetos y no pertenecen a uno solo. | `domain/rules/catalogStandardizer.js`. |
| **Repository** | El núcleo guarda y busca entidades sin saber que existe SQL. | `ports/outbound/repositories/*`. Ej.: `findByIdForUser(outfitId, userId)` → `Outfit` o `null`. |
| **DTO** | Separar lo que entra y sale del núcleo de las entidades internas. | `ports/inbound/dtos/*`. |

### Comportamiento y dependencias

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Strategy / Inversión de dependencias** | Cambiar bcrypt por Argon2id, o JWT por otra cosa, sin tocar el núcleo: el servicio recibe "algo que cumple `PasswordHasher`". | `ports/outbound/security/*` y `ports/outbound/extraction/ScraperPort.js`. |
| **Inyección de dependencias por constructor** | Cada servicio recibe sus repositorios y servicios externos al crearse, así se pueden cambiar sin modificar su código. | El `constructor({ ... })` de cada clase en `services/`. |
| **Guard Clauses (Fail-Fast)** | Validar primero (sesión, rol, propiedad, existencia) y cortar con un error claro en español antes de tocar datos. | `services/applicationGuards.js` (`requireAuthenticatedUser`, `requireAdmin`, `requireFound`) y el inicio de cada método de los servicios. |

### Asignación de responsabilidades (GRASP)

| Patrón | Qué resuelve | Dónde |
|--------|--------------|-------|
| **Information Expert** (Experto) | Darle cada tarea a quien ya tiene los datos para hacerla. | `Outfit` calcula su total porque conoce sus prendas. `Product.getAvailableSizes()`. `UserPreference.isPriceInRange()`. |
| **Creator** (Creador) | Decidir quién crea cada objeto: quien lo contiene. | `Outfit` crea sus `OutfitSlot`. `Product` crea sus `ProductImage` y `ProductSizeStock`. |
| **Pure Fabrication** (Fabricación pura) | Crear un módulo que no es un concepto del negocio para no ensuciar las entidades. | `domain/rules/catalogStandardizer.js`, `domain/guards.js` y `services/applicationGuards.js`. |
| **Protected Variations** (Variaciones protegidas) | Proteger el núcleo de lo que puede cambiar (base de datos, tiendas, framework). | Los contratos de `ports/`: el núcleo depende de ellos, no de las herramientas concretas. |
