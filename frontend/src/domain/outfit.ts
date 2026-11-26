import type { Category, Outfit, OutfitItem, OutfitPieces } from '@/types';
import { formatCOP } from './money';
import { SLOT_ORDER } from './product';

export class LockedSlotError extends Error {
  constructor(slot: Category) {
    super(slot);
    this.name = 'LockedSlotError';
  }
}

export interface OutfitDraft {
  name: string;
  items: Partial<Record<Category, OutfitItem>>;
  locked: Category[];
}

export function emptyOutfit(): OutfitDraft {
  return { name: '', items: {}, locked: [] };
}

export function pieces(o: OutfitDraft): OutfitItem[] {
  return SLOT_ORDER.map((slot) => o.items[slot]).filter(
    (item): item is OutfitItem => Boolean(item),
  );
}

// BR-09: suma en COP de las prendas asignadas.
export function total(o: OutfitDraft): number {
  return pieces(o).reduce((sum, p) => sum + p.priceCop, 0);
}

// BR-05: aviso de sobrepresupuesto (nunca bloquea).
export function isOverBudget(
  o: OutfitDraft,
  budget: number | null | undefined,
): boolean {
  return Boolean(budget && budget > 0 && total(o) > budget);
}

// Operaciones puras e inmutables.
export function addPiece(o: OutfitDraft, item: OutfitItem): OutfitDraft {
  if (o.locked.includes(item.category)) {
    throw new LockedSlotError(item.category);
  }
  return {
    ...o,
    items: { ...o.items, [item.category]: item },
  };
}

export function removePiece(o: OutfitDraft, slot: Category): OutfitDraft {
  if (o.locked.includes(slot)) {
    throw new LockedSlotError(slot);
  }
  const items = { ...o.items };
  delete items[slot];
  return { ...o, items };
}

export function toggleLock(o: OutfitDraft, slot: Category): OutfitDraft {
  const locked = o.locked.includes(slot)
    ? o.locked.filter((s) => s !== slot)
    : [...o.locked, slot];
  return { ...o, locked };
}

export function setDraftName(o: OutfitDraft, name: string): OutfitDraft {
  return { ...o, name };
}

export function toPiecesPayload(o: OutfitDraft): OutfitPieces {
  return {
    top: o.items.top?.id ?? null,
    bottom: o.items.bottom?.id ?? null,
    shoes: o.items.shoes?.id ?? null,
  };
}

export function fromSavedOutfit(saved: Outfit): OutfitDraft {
  const items: Partial<Record<Category, OutfitItem>> = {};
  for (const slot of saved.slots) {
    if (slot.piece) {
      items[slot.slotType] = {
        id: slot.piece.productId,
        name: slot.piece.name,
        brand: slot.piece.brand,
        category: slot.slotType,
        priceCop: slot.piece.priceCop,
        primaryImageUrl: slot.piece.primaryImageUrl,
        externalUrl: slot.piece.externalUrl,
        store: slot.piece.store,
      };
    }
  }
  return { name: saved.name, items, locked: [] };
}

// FR-33 / US-69: lista de compras exportable. BR-10: se compra en la tienda.
export function shoppingList(o: OutfitDraft, name = 'Mi outfit'): string {
  const ps = pieces(o);
  const lines = ps.map(
    (p) =>
      `• ${p.name} — ${p.store.name || 'Tienda'} — ${formatCOP(p.priceCop)}\n  ${p.externalUrl}`,
  );
  return (
    `Lista de compras: ${name || 'Mi outfit'}\n\n` +
    lines.join('\n') +
    `\n\nTotal: ${formatCOP(total(o))}\nPrecios de referencia; verifica precio y stock en cada tienda.`
  );
}
