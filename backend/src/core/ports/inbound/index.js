// Puertos entrantes: lo que el core ofrece a la capa de presentación (Facade).
// Los servicios de `core/services/` los implementan; el adaptador HTTP los usa.

export { AuthAndUserPort } from './AuthAndUserPort.js';
export { CatalogSearchPort } from './CatalogSearchPort.js';
export { OutfitBuilderPort } from './OutfitBuilderPort.js';
export { AdminStorePort } from './AdminStorePort.js';

// DTO Pattern: mappers entidad → DTO de salida (los tipos están en cada archivo).
export { toUserDto, toAuthSessionDto, toPreferencesSummaryDto } from './dtos/authDtos.js';
export {
  toStoreRefDto,
  toProductSummaryDto,
  toProductDetailDto,
  toProductPageDto,
} from './dtos/catalogDtos.js';
export { toOutfitDto } from './dtos/outfitDtos.js';
export { toStoreDto, SCRAPING_STATUS } from './dtos/adminDtos.js';
