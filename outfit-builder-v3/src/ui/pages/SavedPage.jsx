import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {formatCOP} from '../../domain/money.js';
import {useApp} from '../AppContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
export default function SavedPage() {
  const {useCases, user, load, login, favs, source} = useApp();
  const [outfits, setOutfits] = useState([]);
  const [favProducts, setFavProducts] = useState([]);
  const nav = useNavigate();
  useEffect(() => { if (user) useCases.listSavedOutfits().then(setOutfits); }, [useCases, user]);
  // Favoritos locales (US-63): se resuelven contra la fuente activa (API viva o snapshot).
  useEffect(() => { if (favs.length) useCases.getProducts(favs).then(setFavProducts); else setFavProducts([]); }, [useCases, favs]);
  if (!user) return <div className="empty"><b>Inicia sesión para ver tus outfits y favoritos.</b><br/><button className="btn pri" onClick={login}>Ingresar</button></div>;
  return <>
    <section>
      <h1>Mis outfits</h1>
      {outfits.length === 0 ? <p className="mut">Aún no guardas outfits. Arma uno en el constructor.</p>
        : <ul className="list">{outfits.map(o => <li key={o.id}><span><b>{o.name}</b> <span className="mut">· {formatCOP(o.total)}</span></span>
          <button className="btn" onClick={() => { load(o); nav('/constructor'); }}>Abrir en el constructor</button></li>)}</ul>}
    </section>
    <section>
      <h1>Favoritos <span className="mut">· {favProducts.length}</span></h1>
      {favProducts.length === 0
        ? <p className="mut">Sin favoritos todavía. Toca el corazón ♡ en cualquier prenda{source.kind === 'live' ? '' : ' (funciona también sin el scraper corriendo)'}.</p>
        : <div className="cards">{favProducts.map(p => <ProductCard key={p.id} p={p}/>)}</div>}
    </section>
  </>;
}
