// Punto de entrada público del dominio (Fase 1 - MVP).
export * from './constants.js';
export * from './errors.js';
export { User } from './entities/User.js';
export { UserPreference } from './entities/UserPreference.js';
export { Store } from './entities/Store.js';
export { Product } from './entities/Product.js';
export { ProductImage } from './entities/ProductImage.js';
export { ProductSizeStock } from './entities/ProductSizeStock.js';
export { Outfit } from './entities/Outfit.js';
export { OutfitSlot } from './entities/OutfitSlot.js';
export * as catalogStandardizer from './rules/catalogStandardizer.js';
