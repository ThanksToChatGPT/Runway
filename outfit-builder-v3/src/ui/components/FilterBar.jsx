import {useEffect, useState} from 'react';
import {CATEGORIES} from '../../domain/product.js';
import {formatCOP} from '../../domain/money.js';
import {useApp, DEFAULT_FILTERS} from '../AppContext.jsx';
// FR-14/15/16: filtros combinables de texto, categoría, orden, tienda, precio, color y material + limpiar todo.
export default function FilterBar({stores}) {
  const {filters: f, setFilters, useCases} = useApp();
  const [opts, setOpts] = useState({colors: [], materials: []});
  useEffect(() => { useCases.filterOptions?.().then(o => setOpts({colors: o.colors, materials: o.materials})).catch(() => {}); }, [useCases]);
  const set = patch => setFilters(x => ({...x, ...patch}));
  const active = f.stores ?? stores;
  const toggle = s => set({stores: active.includes(s) ? active.filter(x => x !== s) : [...active, s]});
  const colors = f.colors ?? [];
  const toggleColor = c => set({colors: colors.includes(c) ? colors.filter(x => x !== c) : [...colors, c]});
  const toggleMat = m => set({materials: f.materials?.includes(m) ? f.materials.filter(x => x !== m) : [...(f.materials ?? []), m]});
  return <div className="filters">
    <input type="search" placeholder="Buscar: “cargo negro”, “vestido floral”…" aria-label="Buscar prendas" value={f.query} onChange={e => set({query: e.target.value})}/>
    <select aria-label="Categoría" value={f.category} onChange={e => set({category: e.target.value})}>
      <option value="all">Todas las categorías</option>
      {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
    <select aria-label="Ordenar" value={f.sort} onChange={e => set({sort: e.target.value})}>
      <option value="">Orden: relevancia</option><option value="asc">Precio: menor a mayor</option><option value="desc">Precio: mayor a menor</option>
    </select>
    <div className="row2">{stores.map(s => <button key={s} className="chip2" aria-pressed={active.includes(s)} onClick={() => toggle(s)}>{s}</button>)}</div>
    {opts.colors.length > 1 && <div className="row2" aria-label="Filtrar por color">
      {opts.colors.map(c => <button key={c} className="chip2" aria-pressed={colors.includes(c)} onClick={() => toggleColor(c)}>{c}</button>)}
    </div>}
    {opts.materials.length > 1 && <div className="row2" aria-label="Filtrar por material">
      {opts.materials.map(m => <button key={m} className="chip2" aria-pressed={f.materials?.includes(m)} onClick={() => toggleMat(m)}>{m}</button>)}
    </div>}
    <label>Precio máx. <input type="range" min="10000" max="300000" step="5000" value={f.maxPrice} onChange={e => set({maxPrice: +e.target.value})}/> <b>{f.maxPrice >= 300000 ? 'sin límite' : formatCOP(f.maxPrice)}</b></label>
    <button className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>Limpiar filtros</button>
  </div>;
}
