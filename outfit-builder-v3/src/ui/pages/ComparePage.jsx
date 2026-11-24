import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {formatCOP} from '../../domain/money.js';
import {useApp} from '../AppContext.jsx';
import ProductImage from '../components/ProductImage.jsx';
export default function ComparePage() {
  const {useCases, cmp, toggleCmp, add} = useApp();
  const [items, setItems] = useState([]);
  useEffect(() => { useCases.getProducts(cmp).then(setItems); }, [useCases, cmp]);
  if (items.length < 2) return <div className="empty">Marca al menos dos prendas con “Comparar” en el <Link to="/">catálogo</Link>.</div>;
  const min = Math.min(...items.map(p => p.price));
  // Score de coincidencia (FR-22): cuánto comparten las prendas (tipo, color, marca, material).
  const shared = (a, b) => (a.group === b.group) + (a.colorName === b.colorName) + (a.brand === b.brand) + (!!a.material && a.material === b.material);
  const maxShared = Math.max(...items.flatMap(a => items.filter(b => b.id !== a.id).map(b => shared(a, b))));
  const row = (label, fn, hi) => <tr><th scope="row">{label}</th>{items.map(p => <td key={p.id} className={hi && p.price === min ? 'min' : ''}>{fn(p)}</td>)}</tr>;
  return <section>
    <h1>Comparador</h1>
    {maxShared >= 2 && <p className="matchnote ok"><b>Parecidas entre sí:</b> comparten tipo, color o marca. La opción más barata queda marcada en verde.</p>}
    <div className="tw"><table>
      <thead><tr><th/>{items.map(p => <th key={p.id}>{p.name}<br/><button className="mini" onClick={() => toggleCmp(p.id)}>Quitar</button></th>)}</tr></thead>
      <tbody>
        {row('Foto', p => <span className="cmpimg"><ProductImage p={p}/></span>)}
        {row('Precio', p => (p.priceEstimated ? '≈ ' : '') + formatCOP(p.price) + (p.price === min ? ' (más bajo)' : ''), true)}
        {row('Tienda', p => p.store)}{row('Marca', p => p.brand)}{row('Color', p => p.colorName)}
        {row('Material', p => p.material || '—')}
        {row('Estado', p => p.secondHand ? 'Segunda mano' : 'Nuevo')}
        {row('Tallas disponibles', p => p.sizes.filter(z => z.available).map(z => z.size).join(', ') || '—')}
        {row('Actualizado', p => p.updatedAt)}
        {row('', p => <button className="mini" onClick={() => add(p)}>Agregar al outfit</button>)}
      </tbody>
    </table></div>
    <p className="mut small">Material y calificación se muestran cuando las tiendas entregan esos datos.</p>
  </section>;
}
