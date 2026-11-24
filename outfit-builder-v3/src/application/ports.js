// PUERTOS SECUNDARIOS (salida): contratos que la aplicación necesita del exterior.
// JavaScript no tiene interfaces, así que se declaran los métodos y se verifican al arrancar.
export const ProductRepositoryPort = ['findAll', 'findById', 'listStores'];
export const OutfitRepositoryPort  = ['listSaved', 'save', 'listFavoriteIds', 'toggleFavorite'];
export const AuthPort              = ['currentUser', 'login', 'logout'];
export function assertPort(name, impl, methods) {
  const missing = methods.filter(m => typeof impl[m] !== 'function');
  if (missing.length) throw new Error(`Adaptador inválido para ${name}: faltan ${missing.join(', ')}`);
  return impl;
}
