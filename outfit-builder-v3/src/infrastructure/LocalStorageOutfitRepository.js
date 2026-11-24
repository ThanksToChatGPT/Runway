const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* almacenamiento no disponible */ } };
export class LocalStorageOutfitRepository {
  async listSaved(uid) { return read('ob:outfits:' + uid, []); }
  async save(uid, outfit) {
    const rec = {...outfit, id: crypto.randomUUID(), createdAt: new Date().toISOString()};
    write('ob:outfits:' + uid, [rec, ...await this.listSaved(uid)]); return rec;
  }
  async listFavoriteIds(uid) { return read('ob:fav:' + uid, []); }
  async toggleFavorite(uid, pid) {
    const ids = await this.listFavoriteIds(uid), on = !ids.includes(pid);
    write('ob:fav:' + uid, on ? [...ids, pid] : ids.filter(i => i !== pid)); return on;
  }
}
