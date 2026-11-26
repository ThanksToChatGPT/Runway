import test from 'node:test';
import assert from 'node:assert/strict';

import { OutfitBuilderService } from '../../core/services/index.js';
import { OutfitBuilderPort, assertImplements } from '../../core/ports/index.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../core/domain/errors.js';
import {
  InMemoryOutfitRepository,
  InMemoryPreferenceRepository,
  InMemoryProductRepository,
  InMemoryStoreRepository,
  buildPreference,
  buildProduct,
  buildStore,
} from '../mocks/index.js';

async function setup({ maxOutfitBudget } = {}) {
  const storeRepository = new InMemoryStoreRepository();
  const productRepository = new InMemoryProductRepository();
  const outfitRepository = new InMemoryOutfitRepository();
  const preferenceRepository = new InMemoryPreferenceRepository();
  const store = await storeRepository.create(buildStore({ name: 'Tienda Bogotá' }));

  const [top, top2, bottom, shoes, hiddenTop] = productRepository.seed(
    buildProduct({ storeId: store.id, category: 'top', priceCop: 89900 }),
    buildProduct({ storeId: store.id, category: 'top', priceCop: 49900 }),
    buildProduct({ storeId: store.id, category: 'bottom', priceCop: 149900 }),
    buildProduct({ storeId: store.id, category: 'shoes', priceCop: 220000 }),
    buildProduct({ storeId: store.id, category: 'top', priceCop: 10000, isHidden: true }),
  );
  if (maxOutfitBudget !== undefined) {
    await preferenceRepository.upsert(buildPreference('user-1', { maxOutfitBudget }));
  }

  const service = new OutfitBuilderService({ productRepository, outfitRepository, preferenceRepository, storeRepository });
  return { service, outfitRepository, store, top, top2, bottom, shoes, hiddenTop };
}

const pieceIds = (dto) => dto.slots.map((slot) => slot.piece?.productId ?? null);

test('implementa todos los métodos de OutfitBuilderPort', async () => {
  const { service } = await setup();
  assert.doesNotThrow(() => assertImplements(service, OutfitBuilderPort));
});

test('startEmptyOutfit crea un borrador con los 3 slots vacíos y total 0', async () => {
  const { service } = await setup({ maxOutfitBudget: 300000 });
  const draft = await service.startEmptyOutfit({ userId: 'user-1' });

  assert.equal(draft.id, null);
  assert.equal(draft.isSaved, false);
  assert.equal(draft.name, 'Mi outfit');
  assert.deepEqual(draft.slots.map((s) => [s.slotType, s.label, s.piece]), [
    ['top', 'parte superior', null],
    ['bottom', 'parte inferior', null],
    ['shoes', 'calzado', null],
  ]);
  assert.equal(draft.totalCostCop, 0);
  assert.deepEqual(draft.budget, { maxBudget: 300000, isOverBudget: false, differenceCop: 300000 });
});

test('assignOrReplacePiece agrega piezas y recalcula el total en COP', async () => {
  const { service, top, bottom, shoes } = await setup();

  let draft = await service.assignOrReplacePiece({ userId: 'user-1', draft: {}, slotType: 'top', productId: top.id });
  draft = await service.assignOrReplacePiece({
    userId: 'user-1', draft: { pieces: { top: top.id } }, slotType: 'bottom', productId: bottom.id,
  });
  draft = await service.assignOrReplacePiece({
    userId: 'user-1', draft: { pieces: { top: top.id, bottom: bottom.id } }, slotType: 'shoes', productId: shoes.id,
  });

  assert.deepEqual(pieceIds(draft), [top.id, bottom.id, shoes.id]);
  assert.equal(draft.totalCostCop, 89900 + 149900 + 220000);
  assert.equal(draft.currency, 'COP');
  assert.deepEqual(draft.budget, { maxBudget: null, isOverBudget: false, differenceCop: null });
});

test('assignOrReplacePiece reemplaza la pieza de la misma sección', async () => {
  const { service, top, top2, bottom } = await setup();
  const draft = await service.assignOrReplacePiece({
    userId: 'user-1', draft: { name: 'Casual', pieces: { top: top.id, bottom: bottom.id } }, slotType: 'top', productId: top2.id,
  });
  assert.deepEqual(pieceIds(draft), [top2.id, bottom.id, null]);
  assert.equal(draft.totalCostCop, 49900 + 149900);
  assert.equal(draft.name, 'Casual');
});

test('pasarse del presupuesto solo marca la advertencia: no bloquea armar ni guardar', async () => {
  const { service, outfitRepository, top, bottom, shoes } = await setup({ maxOutfitBudget: 300000 });
  const pieces = { top: top.id, bottom: bottom.id };

  const draft = await service.assignOrReplacePiece({ userId: 'user-1', draft: { pieces }, slotType: 'shoes', productId: shoes.id });
  assert.equal(draft.totalCostCop, 459800);
  assert.deepEqual(draft.budget, { maxBudget: 300000, isOverBudget: true, differenceCop: 159800 });

  const saved = await service.saveOutfit({ userId: 'user-1', name: 'Fin de semana', pieces: { ...pieces, shoes: shoes.id } });
  assert.equal(saved.isSaved, true);
  assert.equal(saved.budget.isOverBudget, true);
  assert.deepEqual(outfitRepository.persistedValues(saved.id), { totalCostCop: 459800, isOverBudget: true });
});

test('assignOrReplacePiece valida sección, prenda y existencia', async () => {
  const { service, top, shoes, hiddenTop } = await setup();
  const base = { userId: 'user-1', draft: {} };

  await assert.rejects(service.assignOrReplacePiece({ ...base, slotType: 'bottom', productId: top.id }), (error) =>
    error instanceof ValidationError && /parte inferior/.test(error.message));
  await assert.rejects(service.assignOrReplacePiece({ ...base, slotType: 'hat', productId: top.id }), ValidationError);
  await assert.rejects(service.assignOrReplacePiece({ ...base, slotType: 'top' }), ValidationError);
  await assert.rejects(service.assignOrReplacePiece({ ...base, slotType: 'top', productId: 'product-999' }), NotFoundError);
  await assert.rejects(service.assignOrReplacePiece({ ...base, slotType: 'top', productId: hiddenTop.id }), ValidationError);
  await assert.rejects(
    service.assignOrReplacePiece({ userId: 'user-1', draft: { pieces: { top: 'product-999' } }, slotType: 'shoes', productId: shoes.id }),
    NotFoundError,
  );
});

test('saveOutfit exige nombre y al menos una prenda', async () => {
  const { service, top } = await setup();
  await assert.rejects(service.saveOutfit({ userId: 'user-1', pieces: { top: top.id } }), (error) =>
    error instanceof ValidationError && /nombre/.test(error.message));
  await assert.rejects(service.saveOutfit({ userId: 'user-1', name: '   ', pieces: { top: top.id } }), ValidationError);
  await assert.rejects(service.saveOutfit({ userId: 'user-1', name: 'Vacío', pieces: {} }), (error) =>
    error instanceof ValidationError && /al menos una prenda/.test(error.message));
});

test('getUserOutfits devuelve tienda, precio COP y enlace de compra de cada prenda', async () => {
  const { service, top, shoes } = await setup({ maxOutfitBudget: 500000 });
  await service.saveOutfit({ userId: 'user-1', name: 'Oficina', pieces: { top: top.id } });
  await service.saveOutfit({ userId: 'user-1', name: 'Gym', pieces: { shoes: shoes.id } });

  const outfits = await service.getUserOutfits({ userId: 'user-1' });
  assert.deepEqual(outfits.map((o) => o.name), ['Gym', 'Oficina']);

  const piece = outfits[0].slots.find((s) => s.slotType === 'shoes').piece;
  assert.equal(piece.priceCop, 220000);
  assert.equal(piece.externalUrl, shoes.externalUrl);
  assert.deepEqual(piece.store, { id: shoes.storeId, name: 'Tienda Bogotá' });
  assert.equal(outfits[0].budget.isOverBudget, false);
});

test('un usuario no puede ver los outfits de otro usuario', async () => {
  const { service, top } = await setup();
  const saved = await service.saveOutfit({ userId: 'user-1', name: 'Privado', pieces: { top: top.id } });

  assert.equal((await service.getOutfitById({ userId: 'user-1', outfitId: saved.id })).name, 'Privado');
  await assert.rejects(service.getOutfitById({ userId: 'user-2', outfitId: saved.id }), NotFoundError);
  await assert.rejects(service.getOutfitById({ userId: 'user-1', outfitId: 'outfit-999' }), NotFoundError);
  assert.deepEqual(await service.getUserOutfits({ userId: 'user-2' }), []);
});

test('el servicio descarta outfits ajenos aunque el repositorio falle en filtrarlos', async () => {
  const { service, outfitRepository, top } = await setup();
  const saved = await service.saveOutfit({ userId: 'user-1', name: 'Privado', pieces: { top: top.id } });
  const leaked = await outfitRepository.findByIdForUser(saved.id, 'user-1');
  outfitRepository.findByIdForUser = async () => leaked;
  outfitRepository.findByUserId = async () => [leaked];

  await assert.rejects(service.getOutfitById({ userId: 'user-2', outfitId: saved.id }), NotFoundError);
  assert.deepEqual(await service.getUserOutfits({ userId: 'user-2' }), []);
});

test('todas las operaciones de outfits exigen un usuario autenticado', async () => {
  const { service, top } = await setup();
  await assert.rejects(service.startEmptyOutfit({}), UnauthorizedError);
  await assert.rejects(service.assignOrReplacePiece({ slotType: 'top', productId: top.id }), UnauthorizedError);
  await assert.rejects(service.saveOutfit({ name: 'X', pieces: { top: top.id } }), UnauthorizedError);
  await assert.rejects(service.getUserOutfits({}), UnauthorizedError);
  await assert.rejects(service.getOutfitById({ outfitId: 'outfit-1' }), UnauthorizedError);
});
