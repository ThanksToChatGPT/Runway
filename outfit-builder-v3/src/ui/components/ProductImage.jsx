import {useEffect, useState} from 'react';
import {CATEGORIES} from '../../domain/product.js';
// Foto con carga diferida (RNF-03). Si no hay imagen o falla, muestra el color y la categoría (degradación elegante).
export default function ProductImage({p, index = 0}) {
  const src = p.images?.[index];
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  return <span className="pimg" style={{background: p.color}}>
    {src && !bad ? <img src={src} alt={`${p.name}, foto ${index + 1}`} loading="lazy" decoding="async" onError={() => setBad(true)}/> : <span className="ph">{CATEGORIES[p.category]}</span>}
  </span>;
}
