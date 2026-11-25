import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRestrictedProducts,
  isRestrictedContent,
  normalizeCategory,
  normalizeColor,
  normalizeSize,
  standardizeCatalogItem,
} from '../../core/domain/rules/catalogStandardizer.js';

test('normalizeColor unifica sinónimos en español, inglés y abreviaturas', () => {
  for (const raw of ['negro', 'Black', 'BLK', ' NEGRA ']) assert.equal(normalizeColor(raw), 'black');
  assert.equal(normalizeColor('Azul oscuro'), 'navy');
  assert.equal(normalizeColor('Café'), 'brown');
  assert.equal(normalizeColor('Verde menta'), 'green');
  assert.equal(normalizeColor('Tornasol'), 'tornasol');
  assert.equal(normalizeColor(''), null);
});

test('normalizeSize unifica tallas de letra y numéricas', () => {
  for (const raw of ['m', 'Mediana', 'Talla M', 'medium']) assert.equal(normalizeSize(raw), 'M');
  assert.equal(normalizeSize('Extra Grande'), 'XL');
  assert.equal(normalizeSize('2XL'), 'XXL');
  assert.equal(normalizeSize('Talla única'), 'UNICA');
  assert.equal(normalizeSize('EU 40'), '40');
  assert.equal(normalizeSize('38,5'), '38.5');
  assert.equal(normalizeSize(null), null);
});

test('normalizeCategory mapea a top/bottom/shoes o null', () => {
  assert.equal(normalizeCategory('Camisetas'), 'top');
  assert.equal(normalizeCategory('T-Shirt oversize'), 'top');
  assert.equal(normalizeCategory('Pantalón'), 'bottom');
  assert.equal(normalizeCategory('Jeans'), 'bottom');
  assert.equal(normalizeCategory('Tenis'), 'shoes');
  assert.equal(normalizeCategory('Hombre', 'Botas de cuero'), 'shoes');
  assert.equal(normalizeCategory('Accesorios', 'Gorras'), null);
});

test('isRestrictedContent excluye contenido sexual explícito', () => {
  assert.equal(isRestrictedContent({ name: 'Vibrador recargable' }), true);
  assert.equal(isRestrictedContent({ name: 'Body', subcategory: 'Lencería erótica' }), true);
  assert.equal(isRestrictedContent({ name: 'Disfraz', brand: 'Sex Shop Rosa' }), true);
});

test('isRestrictedContent no excluye ropa normal para adultos', () => {
  for (const name of [
    'Brasier de encaje',
    'Lencería básica algodón',
    'Bikini tiro alto',
    'Bóxer pack x3',
    'Blusa sexy de satín',
    'Camiseta talla XXXL',
    'Sandalia color nude',
  ]) {
    assert.equal(isRestrictedContent({ name }), false, name);
  }
});

test('filterRestrictedProducts conserva solo productos permitidos', () => {
  const items = [{ name: 'Jean slim' }, { name: 'Consolador' }, { name: 'Tenis blancos' }];
  assert.deepEqual(filterRestrictedProducts(items).map((p) => p.name), ['Jean slim', 'Tenis blancos']);
});

test('standardizeCatalogItem normaliza un ítem crudo sin mutarlo', () => {
  const raw = { name: 'Camiseta básica', category: 'Ropa', color: 'BLK', sizes: ['m', 'Mediana', 'L'] };
  const result = standardizeCatalogItem(raw);
  assert.deepEqual(result, { ...raw, category: 'top', color: 'black', sizes: ['M', 'L'] });
  assert.equal(raw.color, 'BLK');
  assert.equal(standardizeCatalogItem({ name: 'Gorra', category: 'Accesorios' }), null);
  assert.equal(standardizeCatalogItem({ name: 'Dildo', category: 'Camiseta' }), null);
});
