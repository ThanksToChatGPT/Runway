// RAÍZ DE COMPOSICIÓN: el único lugar donde se eligen los adaptadores concretos.
// Estrategia de datos en cascada (RNF-13: la búsqueda funciona aunque la recolección caiga):
//   1. API viva del scraper (serve) → fuente "live"
//   2. snapshot JSON exportado del scraper → fuente "snapshot" (datos reales, sin scraper)
//   3. catálogo demo de ejemplo → fuente "demo"
import {createUseCases} from '../application/useCases.js';
import {assertPort, ProductRepositoryPort, OutfitRepositoryPort, AuthPort} from '../application/ports.js';
import {HttpProductRepository, API_BASE} from './HttpProductRepository.js';
import {SnapshotProductRepository} from './SnapshotProductRepository.js';
import {InMemoryProductRepository} from './InMemoryProductRepository.js';
import {LocalStorageOutfitRepository} from './LocalStorageOutfitRepository.js';
import {FakeAuthService} from './FakeAuthService.js';

export const liveProducts = new HttpProductRepository();
export const snapshotProducts = new SnapshotProductRepository();

// El repo de productos es un delegado: el arranque decide a cuál adaptador apunta.
// createUseCases captura este objeto por closure, así que cambiar `target` cambia el comportamiento.
const switching = new class {
  target = new InMemoryProductRepository();
  findAll() { return this.target.findAll(); }
  findById(id) { return this.target.findById(id); }
  listStores() { return this.target.listStores(); }
};

export const useCases = createUseCases({
  products: assertPort('ProductRepository', switching, ProductRepositoryPort),
  outfits:  assertPort('OutfitRepository', new LocalStorageOutfitRepository(), OutfitRepositoryPort),
  auth:     assertPort('Auth', new FakeAuthService(), AuthPort)
});

// Información de la fuente activa para el indicador de la UI.
export const dataSource = {kind: 'demo', exportedAt: null};   // 'live' | 'snapshot' | 'demo'

async function pickSource() {
  try { await liveProducts.ping(); switching.target = liveProducts; dataSource.kind = 'live'; return; }
  catch { /* sin scraper: probar el snapshot */ }
  try { await snapshotProducts.exportedAt(); switching.target = snapshotProducts; dataSource.kind = 'snapshot'; }
  catch { dataSource.kind = 'demo'; }
  dataSource.exportedAt = dataSource.kind === 'snapshot' ? await snapshotProducts.exportedAt() : null;
}

// Promise.race garantiza que whenReady SIEMPRE resuelva (2,5 s máximo), con o sin scraper.
export const whenReady = Promise.race([
  pickSource(), new Promise(resolve => setTimeout(resolve, 2500))
]).then(() => useCases);

export const apiBase = API_BASE;
