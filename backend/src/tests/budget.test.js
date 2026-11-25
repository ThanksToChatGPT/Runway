import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOutfitTotalCop,
  evaluateBudget,
  validateOutfitSlotIds,
} from '../core/domain/outfit.js';
import { validatePricePreferences } from '../core/domain/preferences.js';

test('calculateOutfitTotalCop suma correctamente los precios en COP', () => {
  const total = calculateOutfitTotalCop({
    top: { price_cop: 89900 },
    bottom: { price_cop: 149900 },
    shoes: { price_cop: 220000 },
  });
  assert.equal(total, 459800);
});

test('evaluateBudget detecta sobrepresupuesto', () => {
  const res = evaluateBudget(460000, 400000);
  assert.equal(res.overBudget, true);
  assert.equal(res.differenceCop, 60000);
});

test('evaluateBudget permite outfits dentro del presupuesto', () => {
  const res = evaluateBudget(350000, 400000);
  assert.equal(res.overBudget, false);
  assert.equal(res.differenceCop, 50000);
});

test('validateOutfitSlotIds exige al menos una prenda', () => {
  assert.throws(() => validateOutfitSlotIds({}), /al menos una prenda/);
});

test('validatePricePreferences rechaza min > max', () => {
  assert.throws(
    () =>
      validatePricePreferences({
        min_price_cop: 200000,
        max_price_cop: 100000,
        budget_limit_cop: 300000,
      }),
    /no puede ser mayor/
  );
});
