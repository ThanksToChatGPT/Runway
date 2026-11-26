import {useState} from 'react';
import {MODES, total, isOverBudget} from '../../domain/outfit.js';
import {CATEGORIES} from '../../domain/product.js';
import {formatCOP} from '../../domain/money.js';
import {useApp} from '../AppContext.jsx';
import Price from './Price.jsx';
import ProductImage from './ProductImage.jsx';
export default function OutfitPanel({onSlot}) {
  const {outfit, remove, lock, budget, setBudget, useCases, toast, handle} = useApp();
  const [name, setName] = useState('');
  const [list, setList] = useState('');
  const tot = total(outfit), over = isOverBudget(outfit, budget);
  const save = async () => { try { await useCases.saveOutfit(name, outfit); setName(''); toast(`Outfit “${name.trim()}” guardado`); } catch (e) { handle(e); } };
  const exportList = () => Object.keys(outfit.items).length ? setList(useCases.exportShoppingList(outfit, name || 'Mi outfit')) : toast('Agrega prendas para exportar la lista.');
  const copy = async () => { try { await navigator.clipboard.writeText(list); toast('Lista copiada'); } catch { toast('Selecciona el texto y cópialo.'); } };
  return <>
    {MODES[outfit.mode].slots.map(k => { const p = outfit.items[k]; return <div className="slot" key={k}>
      <span className="ib">{CATEGORIES[k]}</span>
      {p ? <span className="thumb"><ProductImage p={p}/></span> : <span/>}
      <div>{p ? <><b>{p.name}</b><small>{p.store} · <Price p={p}/></small></> : <span className="mut">{k === 'acc' ? 'Opcional: vacío' : 'Vacío'}</span>}</div>
      <div>{p ? <>
        <button className="mini" aria-pressed={outfit.locked.includes(k)} onClick={() => lock(k)}>Bloquear</button>{' '}
        <a className="mini" href={p.url} target="_blank" rel="noopener noreferrer">Comprar</a>{' '}
        <button className="mini" onClick={() => remove(k)}>Quitar</button></> : <button className="mini" onClick={() => onSlot(k)}>Elegir</button>}</div>
    </div>; })}
    <div className="total"><span>Total</span><span>{formatCOP(tot)}</span></div>
    <label className="mut">Presupuesto máximo <input type="number" min="0" step="10000" value={budget} onChange={e => setBudget(+e.target.value || 0)}/> COP</label>
    {over ? <div className="warn" role="alert">Tu outfit supera el presupuesto por {formatCOP(tot - budget)}. Puedes seguir editando y guardar igual.</div> : <p className="ok">Dentro del presupuesto.</p>}
    <p className="mut small">El total suma precios de lista; no incluye envío ni impuestos.</p>
    <div className="row2"><input type="text" placeholder="Nombre del outfit" aria-label="Nombre del outfit" value={name} onChange={e => setName(e.target.value)}/>
      <button className="btn pri" onClick={save}>Guardar</button><button className="btn" onClick={exportList}>Exportar lista</button></div>
    {list && <><textarea readOnly value={list}/><button className="btn pri" onClick={copy}>Copiar</button></>}
  </>;
}
