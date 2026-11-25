import test from 'node:test';
import assert from 'node:assert/strict';
import { Outfit } from '../../core/domain/entities/Outfit.js';
import { Product } from '../../core/domain/entities/Product.js';
import { ValidationError } from '../../core/domain/errors.js';

const product = (category, priceCop, extra = {}) =>
  new Product({
    storeId: 's1',
    name: `Prenda ${category}`,
    category,
    priceCop,
    externalUrl: `https://tienda.example/${category}`,
    ...extra,
  });

test('createEmpty crea un outfit con las tres secciones vacías y total 0', () => {
  const outfit = Outfit.createEmpty('u1');
  assert.deepEqual(outfit.slots.map((s) => s.slotType), ['top', 'bottom', 'shoes']);
  assert.equal(outfit.isEmpty(), true);
  assert.equal(outfit.totalCostCop, 0);
});

test('el total es la suma en COP de las prendas asignadas', () => {
  const outfit = Outfit.createEmpty('u1')
    .addOrReplacePiece('top', product('top', 89900))
    .addOrReplacePiece('bottom', product('bottom', 149900))
    .addOrReplacePiece('shoes', product('shoes', 220000));
  assert.equal(outfit.calculateTotalPrice(), 459800);
});

test('reemplazar una prenda actualiza el total', () => {
  const outfit = Outfit.createEmpty('u1').addOrReplacePiece('top', product('top', 100000));
  outfit.addOrReplacePiece('top', product('top', 60000));
  assert.equal(outfit.totalCostCop, 60000);
});

test('superar el presupuesto es una advertencia no bloqueante', () => {
  const outfit = Outfit.createEmpty('u1')
    .addOrReplacePiece('top', product('top', 300000))
    .addOrReplacePiece('shoes', product('shoes', 160000));

  const result = outfit.evaluateBudget(400000);
  assert.deepEqual(result, { totalCostCop: 460000, maxBudget: 400000, isOverBudget: true, differenceCop: 60000 });
  assert.equal(outfit.isOverBudget, true);

  // Se puede seguir agregando prendas y la advertencia se recalcula sola.
  assert.doesNotThrow(() => outfit.addOrReplacePiece('bottom', product('bottom', 50000)));
  assert.equal(outfit.totalCostCop, 510000);
  outfit.removePiece('top');
  assert.equal(outfit.isOverBudget, false);
});

test('sin presupuesto definido nunca hay advertencia', () => {
  const outfit = Outfit.createEmpty('u1').addOrReplacePiece('top', product('top', 9_000_000));
  assert.equal(outfit.evaluateBudget(null).isOverBudget, false);
});

test('rechaza prendas en una sección que no les corresponde u ocultas', () => {
  const outfit = Outfit.createEmpty('u1');
  assert.throws(() => outfit.addOrReplacePiece('shoes', product('top', 1000)), ValidationError);
  assert.throws(() => outfit.addOrReplacePiece('top', product('top', 1000, { isHidden: true })), ValidationError);
  assert.throws(() => outfit.addOrReplacePiece('accesorios', product('top', 1000)), ValidationError);
});

test('no se puede guardar un outfit vacío', () => {
  assert.throws(() => Outfit.createEmpty('u1').ensureCanBeSaved(), {
    message: 'Agrega al menos una prenda antes de guardar tu outfit.',
  });
});

test('Product rechaza precio negativo y exige enlace externo', () => {
  assert.throws(() => product('top', -1), ValidationError);
  assert.throws(() => product('top', 1000, { externalUrl: '' }), ValidationError);
  assert.equal(product('top', 1000, { isSecondHand: true }).isSecondHand, true);
});
