# Patrones de diseño y arquitectura: Outfit Builder (front)

Documento de referencia del front en React. Describe la arquitectura, cada patrón usado (dónde está, qué problema resuelve y por qué), la trazabilidad con los requisitos y cómo extender el proyecto.

## 1. Arquitectura hexagonal (Puertos y Adaptadores)

**Idea.** El núcleo (reglas de negocio) no depende de React, del navegador, de una API ni de una base de datos. Todo lo externo entra o sale por *puertos* y se conecta mediante *adaptadores*.

```
            ┌──────────────────────── ui/ (ADAPTADOR PRIMARIO) ───────────────────────┐
            │  páginas, componentes React, AppContext                                  │
            └───────────────────────────────┬──────────────────────────────────────────┘
                                            │ llama a
                      ┌─────────────────────▼──────────────────────┐
                      │  application/  CASOS DE USO (puerto primario)│
                      │  useCases.js · ports.js (puertos secundarios)│
                      └─────────────────────┬──────────────────────┘
                                            │ usa
                      ┌─────────────────────▼──────────────────────┐
                      │  domain/  reglas puras (sin I/O, sin React)  │
                      └─────────────────────▲──────────────────────┘
                                            │ implementan los puertos
            ┌───────────────────────────────┴──────────────────────────────────────────┐
            │  infrastructure/ (ADAPTADORES SECUNDARIOS)                               │
            │  InMemoryProductRepository · LocalStorageOutfitRepository · FakeAuthService│
            └──────────────────────────────────────────────────────────────────────────┘
```

**Regla de dependencia.** Las flechas apuntan siempre hacia el dominio:
`ui → application → domain` y `infrastructure → application/domain`. El dominio no importa nada de las otras capas.

| Capa | Carpeta | Contiene | Puede importar |
|---|---|---|---|
| Dominio | `src/domain` | `product.js`, `outfit.js`, `history.js`, `money.js` | nada externo |
| Aplicación | `src/application` | `useCases.js` (puerto primario), `ports.js` (puertos secundarios) | dominio |
| Infraestructura | `src/infrastructure` | repositorios, auth, datos, `container.js` | aplicación, dominio |
| Interfaz | `src/ui` | páginas, componentes, `AppContext.jsx`, estilos | casos de uso y dominio |

**Beneficio práctico.** Para conectar el backend real (scraping, API REST) se crea `HttpProductRepository` con los mismos métodos del puerto y se cambia una línea en `container.js`. Ni las páginas ni el dominio se modifican (RNF-15).

## 2. Patrones aplicados

| # | Patrón | Dónde | Problema que resuelve | Por qué aquí |
|---|---|---|---|---|
| 1 | **Ports & Adapters** | `application/ports.js` + `infrastructure/*` | Acoplamiento a fuentes de datos y servicios | Los datos vendrán de scraping/API aún no definidos |
| 2 | **Repository** | `InMemoryProductRepository`, `LocalStorageOutfitRepository` | Que la lógica no sepa cómo se guardan los datos | Misma interfaz para memoria, localStorage o HTTP |
| 3 | **Adapter** | cada clase de `infrastructure/` | Traducir un servicio concreto al contrato del puerto | `FakeAuthService` se reemplaza por JWT/Google sin tocar casos de uso |
| 4 | **Dependency Injection** | `createUseCases({products, outfits, auth})` | Dependencias creadas dentro del código que las usa | Facilita pruebas con dobles y cambio de adaptadores |
| 5 | **Composition Root** | `infrastructure/container.js` | Dispersión de `new` por todo el código | Un único lugar decide los adaptadores concretos |
| 6 | **Factory** | `createUseCases` | Construcción de un objeto con dependencias | Devuelve el conjunto de casos de uso ya configurado |
| 7 | **Use Case / Application Service** | `application/useCases.js` | Lógica de aplicación mezclada con la UI | Cada operación del usuario (buscar, guardar outfit, exportar) es una función con nombre |
| 8 | **Facade** | objeto `useCases` | La UI conociendo muchos módulos | La UI ve una sola superficie simple |
| 9 | **Domain Model con funciones puras e inmutables** | `domain/outfit.js`, `domain/product.js` | Efectos secundarios y estados inconsistentes | Cada operación devuelve un outfit nuevo; fácil de probar |
| 10 | **Memento (historial de estados)** | `domain/history.js` | Deshacer / rehacer (FR-28) | Se guardan estados inmutables en `past/present/future` |
| 11 | **Command (acciones como funciones)** | `run(fn)` en `AppContext.jsx` (`add`, `remove`, `lock`, `mode`, `load`) | Cambios de estado dispersos | Cada acción pasa por un solo punto que registra el historial y maneja errores |
| 12 | **Strategy (ligero)** | `MODES` en `domain/outfit.js` | Condicionales por tipo de maniquí | Cada modo define sus ranuras; añadir un maniquí es añadir una entrada |
| 13 | **Guard Clause + errores de dominio** | `LockedSlotError`, `AUTH_REQUIRED`, `NAME_REQUIRED` | Validaciones anidadas y mensajes técnicos | La UI traduce el error a un mensaje en español (RNF-11) |
| 14 | **Provider / Context (Observer de React)** | `AppContext.jsx` | Pasar estado por muchos niveles | Outfit, comparador y filtros se conservan al cambiar de página |
| 15 | **Container / Presentational** | `pages/*` (con datos) vs `components/*` (presentan) | Componentes que mezclan datos y pintura | Las páginas consultan casos de uso; los componentes reciben props |
| 16 | **Composición de componentes** | `ProductCard`, `Runway`, `OutfitPanel`, `FilterBar` | Duplicación de UI | `ProductCard` se reutiliza en catálogo, constructor y favoritos |
| 17 | **Routing por páginas** | `App.jsx` (`HashRouter`) | Una sola pantalla gigante | Una ruta por responsabilidad: catálogo, detalle, constructor, comparar, guardados |
| 18 | **Null Object / degradación elegante** | `ProductImage.jsx`, `Runway.jsx` | Imágenes ausentes o que fallan al cargar | Se muestra el color y la categoría de la prenda; la interfaz nunca queda rota |
| 19 | **Lazy loading** | `ProductImage.jsx` (`loading="lazy"`) | Carga lenta con muchas fotos (RNF-03) | Solo se descargan las fotos que entran en pantalla |

## 3. Trazabilidad con reglas de negocio y requisitos

| Regla / requisito | Dónde se cumple |
|---|---|
| BR-03, FR-23 (precios en COP, estimados marcados) | `domain/money.js`, `Price.jsx`, campo `priceEstimated` |
| BR-04, FR-22 (resaltar el más barato) | `cheapestIds` en `domain/product.js`, `ComparePage` |
| BR-05, FR-27 (aviso de presupuesto que no bloquea) | `isOverBudget`, `OutfitPanel` |
| BR-07, FR-13 a FR-16 (búsqueda, filtros, orden, limpiar) | `filterProducts`, `sortByPrice`, `FilterBar` |
| BR-08, BR-09 (outfit por ranuras, total recalculado) | `domain/outfit.js` (`MODES`, `total`) |
| BR-10 (la compra se hace en la tienda) | enlace “Comprar”; aviso en el pie de página |
| BR-11 (información que puede estar desactualizada) | `updatedAt` en el detalle y aviso en el pie |
| BR-14 (segunda mano identificable) | etiqueta “2.ª mano” en `ProductCard` y detalle |
| BR-16, FR-07 (guardar requiere sesión) | `needUser` en `useCases.js` |
| BR-19, FR-31/32 (guardar y reabrir outfits) | `saveOutfit`, `SavedPage` |
| FR-28 (deshacer, rehacer, bloquear pieza) | `history.js`, `toggleLock` |
| FR-33 (exportar lista de compras) | `shoppingList`, `OutfitPanel` |

## 4. Pendientes y decisiones abiertas

- **Datos:** el catálogo son 20 prendas de ejemplo en `infrastructure/data/catalog.js`. Falta un adaptador HTTP.
- **Imágenes:** las fotos actuales son ilustraciones de prueba generadas por script (ver sección 6). Faltan fotos reales y, si se quiere, recortes sin fondo propios para la pasarela.
- **Autenticación:** `FakeAuthService` simula la sesión. Falta registro, recuperación de contraseña y Google.
- **No incluido:** preferencias de usuario, filtro por talla y marca, personalización de resultados, recomendaciones, reportes reales y panel de administración.
- **Reportar error:** hoy solo muestra un aviso; falta un puerto `ReportRepository`.
- **Lenguaje:** se usa JavaScript; los puertos se verifican en ejecución con `assertPort`. Migrar a TypeScript permitiría declararlos como `interface`.
- **Pruebas:** el dominio y los casos de uso son puros y se pueden probar con Vitest sin montar React ni red.

## 5. Cómo extender

1. **Nuevo origen de datos:** crear una clase con los métodos de `ProductRepositoryPort` en `infrastructure/` y cambiarla en `container.js`.
2. **Nuevo maniquí:** agregar una entrada en `MODES` y, si hace falta, una forma en `Runway.jsx`.
3. **Nueva funcionalidad:** primero la regla en `domain/`, luego el caso de uso en `application/`, después la página o el componente.

## 6. Fotos de las prendas

- **Modelo.** Cada producto tiene `images` (galería; la primera es la principal, como `ProductImage` 1..* del UML) y `cutout` (opcional): un recorte sin fondo con la forma exacta de su ranura en la pasarela.
- **Dónde se usan.** Tarjetas del catálogo: `images[0]`. Detalle: galería con miniaturas. Panel de outfit y comparador: miniatura. Pasarela: `cutout`; si no existe, `images[0]` recortada a la forma de la ranura.
- **Imágenes de prueba.** `scripts/generate-test-images.py` (`npm run images`, requiere Python 3) crea 3 SVG por prenda en `public/images/products/`: foto frontal, detalle y recorte. Son ilustraciones, no fotografías reales.
- **Fotos reales.** Cambia las URLs en `InMemoryProductRepository` (o devuélvelas desde tu API). Recomendado: WebP o AVIF de menos de 200 KB, proporción 4:5. Si no hay `cutout`, la pasarela recorta la foto a un rectángulo; para un mejor resultado, usa recortes sin fondo en las proporciones de cada ranura.
- **Derechos.** Mantén el aviso del pie de página: las imágenes de terceros pertenecen a sus dueños (RNF-22).
