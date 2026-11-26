import {useEffect, useState} from 'react';
import {useApp} from '../AppContext.jsx';
import FilterBar from '../components/FilterBar.jsx';
import ProductCard from '../components/ProductCard.jsx';
export default function CatalogPage() {
  const {useCases, filters} = useApp();
  const [stores, setStores] = useState([]);
  const [res, setRes] = useState({items: [], cheapest: new Set()});
  const [limit, setLimit] = useState(12);
  useEffect(() => { useCases.listStores().then(setStores).catch(() => setStores([])); }, [useCases]);
  useEffect(() => { setLimit(12); useCases.searchProducts(filters).then(setRes).catch(() => setRes({items: [], cheapest: new Set()})); }, [useCases, filters]);
  return <section>
    <h1>Catálogo <span className="mut">· {res.items.length} prendas</span></h1>
    <FilterBar stores={stores}/>
    {res.items.length === 0
      ? <div className="empty"><b>Sin resultados.</b><br/>Prueba quitar filtros, subir el precio máximo o buscar otras palabras.</div>
      : <div className="cards">{res.items.slice(0, limit).map(p => <ProductCard key={p.id} p={p} cheapest={res.cheapest.has(p.id)}/>)}</div>}
    {res.items.length > limit && <p className="center"><button className="btn" onClick={() => setLimit(l => l + 24)}>Cargar más</button></p>}
  </section>;
}
