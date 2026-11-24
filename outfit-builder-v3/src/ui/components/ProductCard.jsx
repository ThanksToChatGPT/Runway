import {Link} from 'react-router-dom';
import {CATEGORIES} from '../../domain/product.js';
import {useApp} from '../AppContext.jsx';
import Price from './Price.jsx';
import ProductImage from './ProductImage.jsx';
// Presentacional: muestra la foto principal de la prenda (`p.images[0]`).
export default function ProductCard({p, cheapest}) {
  const {add, cmp, toggleCmp, favs, toggleFav} = useApp();
  const to = `/producto/${p.id}`;
  return <article className="card">
    <Link to={to} className="sw" aria-label={`Ver ${p.name}`}>
      <ProductImage p={p}/>
      <b className="st">{p.store}</b>
      <span className="bd">{p.secondHand && <u>2.ª mano</u>}{cheapest && <s>Más barato</s>}</span>
      <span className="ic">{CATEGORIES[p.category]}</span>
    </Link>
    <button className={'fav' + (favs.includes(p.id) ? ' on' : '')}
      aria-pressed={favs.includes(p.id)} aria-label={favs.includes(p.id) ? `Quitar ${p.name} de favoritos` : `Guardar ${p.name} en favoritos`}
      onClick={() => toggleFav(p.id)}>{favs.includes(p.id) ? '♥' : '♡'}</button>
    <div className="cb">
      <Link to={to} className="nm">{p.name}</Link>
      <small>{p.brand} · {p.colorName}</small>
      <strong><Price p={p}/></strong>
      <div className="ca">
        <button className="mini" onClick={() => add(p)}>Agregar</button>
        <button className="mini" aria-pressed={cmp.includes(p.id)} onClick={() => toggleCmp(p.id)}>Comparar</button>
      </div>
    </div>
  </article>;
}
