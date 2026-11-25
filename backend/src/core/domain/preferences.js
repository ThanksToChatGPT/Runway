/**
 * Valida las preferencias de rango de precio y presupuesto máximo en COP.
 * @param {{ min_price_cop: number, max_price_cop: number, budget_limit_cop: number }} input
 */
export function validatePricePreferences(input) {
  const min = Number(input?.min_price_cop ?? 0);
  const max = Number(input?.max_price_cop ?? 0);
  const budget = Number(input?.budget_limit_cop ?? 0);

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(budget)) {
    throw new Error('Los valores de precio y presupuesto deben ser numéricos');
  }
  if (min < 0 || max < 0 || budget < 0) {
    throw new Error('Los precios y el presupuesto no pueden ser negativos');
  }
  if (min > max) {
    throw new Error('El precio mínimo no puede ser mayor que el precio máximo');
  }

  return {
    min_price_cop: Math.round(min),
    max_price_cop: Math.round(max),
    budget_limit_cop: Math.round(budget),
  };
}
