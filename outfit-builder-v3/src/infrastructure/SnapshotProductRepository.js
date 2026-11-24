// Adaptador de respaldo: lee public/catalog-snapshot.json (generado con `python -m outfit_scraper export`).
// Mismo contrato que los otros repositorios de productos. Se usa cuando el scraper no está corriendo,
// así el front muestra datos REALES recolectados sin depender de ningún proceso (RNF-13).
import {toProduct} from './HttpProductRepository.js';

export class SnapshotProductRepository {
  #cache = null;

  async #load() {
    if (this.#cache) return this.#cache;
    let res;
    try { res = await fetch('./catalog-snapshot.json'); }
    catch { throw new Error('No puedo leer el snapshot del catálogo.'); }
    if (!res.ok) throw new Error(`El snapshot respondió ${res.status}.`);
    const data = await res.json();
    this.#cache = {
      products: data.products.map(toProduct),
      stores: data.stores.map(s => s.name),
      exportedAt: data.exported_at
    };
    return this.#cache;
  }

  async findAll() { return (await this.#load()).products; }

  async findById(id) { return (await this.findAll()).find(p => p.id === id) ?? null; }

  async listStores() { return (await this.#load()).stores; }

  async exportedAt() { try { return (await this.#load()).exportedAt; } catch { return null; } }
}
