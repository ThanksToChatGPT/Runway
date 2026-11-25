import test from 'node:test';
import assert from 'node:assert/strict';
import { UserPreference } from '../../core/domain/entities/UserPreference.js';
import { DomainError, ValidationError } from '../../core/domain/errors.js';

test('crea preferencias válidas y redondea montos en COP', () => {
  const pref = new UserPreference({ userId: 'u1', minPrice: 50000, maxPrice: 200000.4, maxOutfitBudget: 400000 });
  assert.equal(pref.maxPrice, 200000);
  assert.equal(pref.isPriceInRange(120000), true);
  assert.equal(pref.isPriceInRange(250000), false);
});

test('rechaza montos negativos con un ValidationError en español', () => {
  for (const field of ['minPrice', 'maxPrice', 'maxOutfitBudget']) {
    assert.throws(
      () => new UserPreference({ userId: 'u1', [field]: -1 }),
      (err) => err instanceof ValidationError && err instanceof DomainError && err.field === field && /mayor a 0/.test(err.message),
    );
  }
});

test('rechaza minPrice mayor que maxPrice', () => {
  assert.throws(
    () => new UserPreference({ userId: 'u1', minPrice: 300000, maxPrice: 100000 }),
    { name: 'ValidationError', message: 'El precio mínimo no puede ser mayor que el precio máximo.' },
  );
});

test('permite rango abierto cuando solo existe uno de los límites', () => {
  const pref = new UserPreference({ userId: 'u1', minPrice: 300000 });
  assert.equal(pref.maxPrice, null);
  assert.equal(pref.isPriceInRange(999999), true);
});

test('update inválido no deja las preferencias a medio cambiar', () => {
  const pref = new UserPreference({ userId: 'u1', minPrice: 10000, maxPrice: 50000 });
  assert.throws(() => pref.update({ minPrice: 20000, maxPrice: 15000 }), ValidationError);
  assert.equal(pref.minPrice, 10000);
  assert.equal(pref.maxPrice, 50000);
});

test('getSummary devuelve un resumen estructurado', () => {
  const pref = new UserPreference({ userId: 'u1', minPrice: 0, maxPrice: 200000, maxOutfitBudget: 350000 });
  assert.deepEqual(pref.getSummary(), {
    userId: 'u1',
    priceRange: { min: 0, max: 200000 },
    maxOutfitBudget: 350000,
    hasPriceRange: true,
    hasBudget: true,
    currency: 'COP',
  });
  assert.equal(UserPreference.createDefault('u2').getSummary().hasBudget, false);
});
