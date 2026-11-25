export const ALLOWED_CATEGORIES = ['top', 'bottom', 'shoes'];

/**
 * Calcula el total en COP de los slots seleccionados de un outfit.
 * @param {{ top?: { price_cop: number } | null, bottom?: { price_cop: number } | null, shoes?: { price_cop: number } | null }} slots
 * @returns {number}
 */
export function calculateOutfitTotalCop(slots) {
  let total = 0;
  for (const key of ALLOWED_CATEGORIES) {
    const item = slots?.[key];
    if (item && typeof item.price_cop === 'number') {
      if (item.price_cop < 0) {
        throw new Error(`El precio de ${key} no puede ser negativo`);
      }
      total += Math.round(item.price_cop);
    }
  }
  return total;
}

/**
 * Evalúa si el total del outfit excede el presupuesto límite en COP.
 * @param {number} totalCop
 * @param {number | null | undefined} budgetLimitCop
 * @returns {{ totalCop: number, budgetLimitCop: number | null, overBudget: boolean, differenceCop: number }}
 */
export function evaluateBudget(totalCop, budgetLimitCop) {
  if (budgetLimitCop === null || budgetLimitCop === undefined) {
    return {
      totalCop,
      budgetLimitCop: null,
      overBudget: false,
      differenceCop: 0,
    };
  }

  const limit = Math.max(0, Math.round(budgetLimitCop));
  const overBudget = totalCop > limit;
  return {
    totalCop,
    budgetLimitCop: limit,
    overBudget,
    differenceCop: overBudget ? totalCop - limit : limit - totalCop,
  };
}

/**
 * Valida que los slots a guardar tengan IDs válidos y categorías consistentes.
 * @param {{ topId?: string, bottomId?: string, shoesId?: string }} slotIds
 */
export function validateOutfitSlotIds(slotIds) {
  const entries = [
    { slot_type: 'top', product_id: slotIds?.topId },
    { slot_type: 'bottom', product_id: slotIds?.bottomId },
    { slot_type: 'shoes', product_id: slotIds?.shoesId },
  ].filter((entry) => Boolean(entry.product_id));

  if (entries.length === 0) {
    throw new Error('Debes seleccionar al menos una prenda para guardar el outfit');
  }
  return entries;
}
