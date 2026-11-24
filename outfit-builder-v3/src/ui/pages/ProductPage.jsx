import {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {CATEGORIES} from '../../domain/product.js';
import {useApp} from '../AppContext.jsx';
import Price from '../components/Price.jsx';
import ProductImage from '../components/ProductImage.jsx';
import ProductCard from '../components/ProductCard.jsx';
export default function ProductPage() {
  const {id} = useParams();
  const {useCases, add, cmp, toggleCmp, toast, handle, favs, toggleFav} = useApp();
  const [p, setP] = useState(undefined);
  const [idx, setIdx] = useState(0);
  const [sim, setSim] = useState([]);
  const [report, setReport] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { useCases.getProduct(id).then(x => { setP(x); setIdx(0); }); setSim([]); setReport(''); }, [useCases, id]);
  // FR-20 / US-37: "También te puede gustar" basado en el producto visto.
  useEffect(() => { if (p) useCases.similarTo(p.id).then(setSim).catch(() => {}); }, [useCases, p]);
  if (p === undefined) return <p>Cargando…</p>;
  if (!p) return <div className="empty">Prenda no encontrada. <Link to="/">Volver al catálogo</Link></div>;
  // US-40: reporte de datos incorrectos; se guarda localmente pendiente del backend de administración (US-75).
  const sendReport = () => {
    if (!report.trim()) { toast('Cuéntanos qué está mal antes de enviar.'); return; }
    try {
      const key = 'ob_reports';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push({productId: p.id, name: p.name, text: report.trim(), date: new Date().toISOString()});
      localStorage.setItem(key, JSON.stringify(list));
      setReport(''); setSending(false); toast('Reporte enviado. ¡Gracias por avisarnos!');
    } catch { toast('No pudimos guardar el reporte. Intenta de nuevo.'); }
  };
  return <section>
    <p><Link to="/">← Catálogo</Link></p>
    <div className="detail">
      <div>
        <div className="gal"><ProductImage p={p} index={idx}/></div>
        <div className="thumbs">{p.images.map((_, i) => <button key={i} className="th" aria-pressed={i === idx} aria-label={`Ver foto ${i + 1}`} onClick={() => setIdx(i)}><ProductImage p={p} index={i}/></button>)}</div>
      </div>
      <div>
        <h1>{p.name}</h1>
        <p className="mut">{p.brand} · {p.colorName} · {CATEGORIES[p.category]}{p.material ? ` · ${p.material}` : ''}</p>
        <p className="price"><Price p={p}/></p>
        <p>{p.store}{p.secondHand && ' · Segunda mano (stock limitado)'}</p>
        <div className="sz" aria-label="Tallas">{p.sizes.map(z => <span key={z.size} className={z.available ? '' : 'no'} title={z.available ? 'Disponible' : 'No disponible'}>{z.size}</span>)}</div>
        <p className="mut small">Actualizado el {p.updatedAt}. Verifica precio y stock en la tienda.</p>
        <div className="row2">
          <button className="btn pri" onClick={() => add(p)}>Agregar al outfit</button>
          <button className="btn" aria-pressed={cmp.includes(p.id)} onClick={() => toggleCmp(p.id)}>Comparar</button>
          <button className="btn" aria-pressed={favs.includes(p.id)} onClick={() => toggleFav(p.id)}>{favs.includes(p.id) ? '♥ Favorito' : '♡ Favorito'}</button>
          <a className="btn" href={p.url} target="_blank" rel="noopener noreferrer">Ver en {p.store}</a>
          <button className="btn" aria-expanded={sending} onClick={() => setSending(s => !s)}>Reportar error</button>
        </div>
        {sending && <div className="report">
          <label htmlFor="rep">¿Qué está mal? (precio, foto, enlace…)</label>
          <textarea id="rep" value={report} onChange={e => setReport(e.target.value)} placeholder="El precio que veo en la tienda es otro…"/>
          <button className="btn pri" onClick={sendReport}>Enviar reporte</button>
        </div>}
      </div>
    </div>
    {sim.length > 0 && <div className="alsolike">
      <h2>También te puede gustar</h2>
      <div className="cards">{sim.map(x => <ProductCard key={x.id} p={x}/>)}</div>
    </div>}
  </section>;
}
