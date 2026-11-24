import {formatCOP} from './money.js';
// Cada modo es un "maniquí": define qué ranuras existen. Cambiar de modo NO borra prendas (FR-30).
export const MODES = {
  two:    {label:'Dos piezas',   slots:['top','bottom','shoes','acc']},
  full:   {label:'Prenda larga', slots:['full','shoes','acc']},
  layers: {label:'Capas',        slots:['outer','top','bottom','shoes','acc']}
};
export class LockedSlotError extends Error {}
export const emptyOutfit = () => ({mode:'two', items:{}, locked:[]});
export const modeFor = (mode, cat) => MODES[mode].slots.includes(cat) ? mode : cat === 'full' ? 'full' : cat === 'outer' ? 'layers' : 'two';
export const pieces = o => MODES[o.mode].slots.filter(k => o.items[k]).map(k => o.items[k]);
export const total = o => pieces(o).reduce((s, p) => s + p.price, 0);        // BR-09
export const isOverBudget = (o, budget) => budget > 0 && total(o) > budget;  // BR-05 (aviso, nunca bloquea)

// Todas las operaciones son puras e inmutables: devuelven un outfit nuevo.
export function addPiece(o, p) {
  if (o.locked.includes(p.category)) throw new LockedSlotError(p.category);
  return {...o, mode: modeFor(o.mode, p.category), items: {...o.items, [p.category]: p}};
}
export function removePiece(o, slot) {
  if (o.locked.includes(slot)) throw new LockedSlotError(slot);
  const items = {...o.items}; delete items[slot];
  return {...o, items};
}
export const toggleLock = (o, slot) => ({...o, locked: o.locked.includes(slot) ? o.locked.filter(s => s !== slot) : [...o.locked, slot]});
export const setMode = (o, mode) => ({...o, mode});

// FR-33 / US-69: lista de compras exportable. BR-10: se compra en la tienda, no aquí.
export function shoppingList(o, name = 'Mi outfit') {
  const ps = pieces(o);
  return `Lista de compras: ${name}\n\n` + ps.map(p => `• ${p.name} — ${p.store} — ${formatCOP(p.price)}\n  ${p.url}`).join('\n')
    + `\n\nTotal: ${formatCOP(total(o))}\nPrecios de referencia; verifica precio y stock en cada tienda.`;
}
