import { AppError } from '../domain/errors.js';
import {
  calculateOutfitTotalCop,
  evaluateBudget,
  validateOutfitSlotIds,
} from '../domain/outfit.js';

export function createOutfitService({ outfitRepo, productRepo, userRepo }) {
  return {
    async listUserOutfits(userId) {
      return outfitRepo.findByUserId(userId);
    },

    async saveOutfit(userId, payload) {
      const name = String(payload?.name || '').trim();
      if (name.length < 2) {
        throw new AppError('El nombre del outfit debe tener al menos 2 caracteres', 400);
      }

      let slots;
      try {
        slots = validateOutfitSlotIds(payload);
      } catch (err) {
        throw new AppError(err.message, 400);
      }

      const productIds = slots.map((s) => s.product_id);
      const products = await productRepo.findByIds(productIds);
      const productMap = new Map(products.map((p) => [p.id, p]));

      const slotProducts = {};
      for (const slot of slots) {
        const product = productMap.get(slot.product_id);
        if (!product) {
          throw new AppError(`Producto no encontrado para el slot ${slot.slot_type}`, 404);
        }
        if (product.category !== slot.slot_type) {
          throw new AppError(
            `El producto "${product.title}" pertenece a "${product.category}" y no a "${slot.slot_type}"`,
            400
          );
        }
        slotProducts[slot.slot_type] = product;
      }

      const totalCop = calculateOutfitTotalCop(slotProducts);
      const prefs = await userRepo.getPreferences(userId);
      const budgetStatus = evaluateBudget(totalCop, prefs?.budget_limit_cop);

      const saved = await outfitRepo.createOutfit({
        userId,
        name,
        totalCop,
        slots,
      });

      return {
        ...saved,
        budgetStatus,
      };
    },

    async deleteOutfit(userId, outfitId) {
      const deleted = await outfitRepo.deleteOutfit(userId, outfitId);
      if (!deleted) {
        throw new AppError('Outfit no encontrado', 404);
      }
    },
  };
}
