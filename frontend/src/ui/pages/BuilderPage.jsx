import {useEffect, useState} from 'react';
import {MODES} from '../../domain/outfit.js';
import {CATEGORIES} from '../../domain/product.js';
import {useApp} from '../AppContext.jsx';
import Runway from '../components/Runway.jsx';
import OutfitPanel from '../components/OutfitPanel.jsx';
import ProductCard from '../components/ProductCard.jsx';
export default function BuilderPage() {
  const {outfit, mode, undo, redo, canUndo, canRedo, useCases} = useApp();
  const [slot, setSlot] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [res, setRes] = useState({items: [], cheapest: new Set()});
  useEffect(() => { if (slot) useCases.searchProducts({category: slot, sort: 'asc'}).then(setRes); }, [useCases, slot]);
  return <>
    <div className="builder">
      <section>
        <h1>Pasarela</h1>
        <div className="row2">{Object.entries(MODES).map(([k, m]) => <button key={k} className="btn" aria-pressed={outfit.mode === k} onClick={() => mode(k)}>{m.label}</button>)}</div>
        <div className="runway"><Runway outfit={outfit} active={slot} onSlot={setSlot} zoom={zoom}/></div>
        <div className="row2 center">
          <button className="btn" aria-label="Alejar" onClick={() => setZoom(z => Math.max(.7, z - .15))}>−</button>
          <button className="btn" aria-label="Acercar" onClick={() => setZoom(z => Math.min(1.6, z + .15))}>+</button>
          <button className="btn" disabled={!canUndo} onClick={undo}>Deshacer</button>
          <button className="btn" disabled={!canRedo} onClick={redo}>Rehacer</button>
        </div>
        <p className="mut small">Toca una pieza para ver opciones de esa categoría. Cambiar de maniquí no borra tus prendas.</p>
      </section>
      <section><h1>Tu outfit</h1><OutfitPanel onSlot={setSlot}/></section>
    </div>
    <section>
      <h2>{slot ? `Opciones: ${CATEGORIES[slot]}` : 'Opciones'}</h2>
      {slot ? <div className="cards">{res.items.map(p => <ProductCard key={p.id} p={p} cheapest={res.cheapest.has(p.id)}/>)}</div> : <p className="mut">Elige una pieza de la pasarela para ver prendas disponibles, ordenadas de menor a mayor precio.</p>}
    </section>
  </>;
}
