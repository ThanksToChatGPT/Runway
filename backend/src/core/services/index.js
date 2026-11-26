// Servicios de aplicación (Fase 3 - MVP): implementan los puertos entrantes.
// Los archivos en minúscula (authService.js, catalogService.js, outfitService.js,
// adminService.js) son el prototipo legado que aún usa src/index.js; se retiran
// cuando la Fase 4 conecte los adaptadores a estos servicios.

export { AuthAndUserService, PASSWORD_POLICY } from './AuthAndUserService.js';
export { AdminStoreService } from './AdminStoreService.js';
export { CatalogSearchService } from './CatalogSearchService.js';
export { OutfitBuilderService } from './OutfitBuilderService.js';
