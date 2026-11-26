import { SLOT_LABELS, SLOT_TYPE_VALUES } from '../domain/constants.js';
import { NotFoundError } from '../domain/errors.js';
import { requireId, requireText } from '../domain/guards.js';
import { Outfit } from '../domain/entities/Outfit.js';
import { OutfitSlot } from '../domain/entities/OutfitSlot.js';
import { OutfitBuilderPort } from '../ports/inbound/OutfitBuilderPort.js';
import { toOutfitDto } from '../ports/inbound/dtos/outfitDtos.js';
import { indexStoresById, requireAuthenticatedUser } from './applicationGuards.js';

const OUTFIT_NOT_FOUND = 'No encontramos este outfit entre tus outfits guardados.';

/**
 * Casos de uso del Outfit Builder y de "Mis outfits".
 * El borrador no se persiste: el cliente envía los ids de las piezas y el
 * servicio rearma el `Outfit` del dominio para recalcular total y presupuesto.
 * Implementa `OutfitBuilderPort`; recibe sus dependencias por constructor.
 */
export class OutfitBuilderService extends OutfitBuilderPort {
  #products;
  #outfits;
  #preferences;
  #stores;

  /**
   * @param {Object} deps
   * @param {import('../ports/outbound/repositories/ProductRepository.js').ProductRepository} deps.productRepository
   * @param {import('../ports/outbound/repositories/OutfitRepository.js').OutfitRepository} deps.outfitRepository
   * @param {import('../ports/outbound/repositories/PreferenceRepository.js').PreferenceRepository} deps.preferenceRepository
   * @param {import('../ports/outbound/repositories/StoreRepository.js').StoreRepository} deps.storeRepository
   */
  constructor({ productRepository, outfitRepository, preferenceRepository, storeRepository }) {
    super();
    this.#products = productRepository;
    this.#outfits = outfitRepository;
    this.#preferences = preferenceRepository;
    this.#stores = storeRepository;
  }

  async startEmptyOutfit({ userId, name } = {}) {
    requireAuthenticatedUser(userId);
    const [dto] = await this.#present([Outfit.createEmpty(userId, name ?? undefined)], userId);
    return dto;
  }

  async assignOrReplacePiece({ userId, draft = {}, slotType, productId } = {}) {
    requireAuthenticatedUser(userId);
    OutfitSlot.validateSlotType(slotType);
    requireId(productId, 'Selecciona la prenda que quieres agregar.', 'productId');

    // La pieza nueva reemplaza a la que hubiera en esa sección del borrador.
    const pieces = { ...draft.pieces, [slotType]: productId };
    const outfit = await this.#compose(userId, draft.name, pieces);
    const [dto] = await this.#present([outfit], userId);
    return dto;
  }

  async saveOutfit({ userId, name, pieces } = {}) {
    requireAuthenticatedUser(userId);
    requireText(name, 'Ponle un nombre a tu outfit.', 'name');

    const outfit = await this.#compose(userId, name, pieces);
    outfit.ensureCanBeSaved();
    // Se evalúa antes de guardar para persistir `isOverBudget`; nunca bloquea (BR-05).
    outfit.evaluateBudget(await this.#maxBudget(userId));

    const saved = await this.#outfits.create(outfit);
    const [dto] = await this.#present([saved], userId);
    return dto;
  }

  async getUserOutfits({ userId } = {}) {
    requireAuthenticatedUser(userId);
    const outfits = (await this.#outfits.findByUserId(userId)).filter((outfit) => outfit.userId === userId);
    return this.#present(outfits, userId);
  }

  async getOutfitById({ userId, outfitId } = {}) {
    requireAuthenticatedUser(userId);
    requireId(outfitId, 'Indica el outfit que quieres ver.', 'outfitId');

    const outfit = await this.#outfits.findByIdForUser(outfitId, userId);
    // Ajeno o inexistente responden igual, para no revelar que existe (BR-16).
    if (!outfit || outfit.userId !== userId) throw new NotFoundError(OUTFIT_NOT_FOUND);

    const [dto] = await this.#present([outfit], userId);
    return dto;
  }

  /** Arma un `Outfit` del dominio a partir de { top, bottom, shoes } → productId. */
  async #compose(userId, name, pieces = {}) {
    const outfit = Outfit.createEmpty(userId, name ?? undefined);
    const wanted = SLOT_TYPE_VALUES.filter((slotType) => pieces?.[slotType]).map((slotType) => ({
      slotType,
      productId: String(pieces[slotType]),
    }));
    if (wanted.length === 0) return outfit;

    const products = await this.#products.findByIds(wanted.map((piece) => piece.productId));
    const byId = new Map(products.map((product) => [String(product.id), product]));
    for (const { slotType, productId } of wanted) {
      const product = byId.get(productId);
      if (!product) {
        throw new NotFoundError(`No encontramos la prenda elegida para ${SLOT_LABELS[slotType]}.`, {
          field: slotType,
        });
      }
      outfit.addOrReplacePiece(slotType, product); // valida sección y disponibilidad
    }
    return outfit;
  }

  async #maxBudget(userId) {
    const preference = await this.#preferences.findByUserId(userId);
    return preference?.maxOutfitBudget ?? null;
  }

  /** Outfits → DTOs con total COP, aviso de presupuesto actual y tienda por pieza. */
  async #present(outfits, userId) {
    const maxBudget = await this.#maxBudget(userId);
    const storesById = indexStoresById(await this.#stores.findAll());
    return outfits.map((outfit) => toOutfitDto(outfit, { budget: outfit.evaluateBudget(maxBudget), storesById }));
  }
}
