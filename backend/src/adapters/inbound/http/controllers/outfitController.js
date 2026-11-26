/**
 * Adapter (driving): HTTP ↔ `OutfitBuilderPort`.
 * El `userId` siempre sale del token (`req.user`), nunca del body.
 *
 * @param {import('../../../../core/ports/inbound/OutfitBuilderPort.js').OutfitBuilderPort} outfitService
 */
export function createOutfitController(outfitService) {
  return {
    async startDraft(req, res) {
      const { name } = req.body ?? {};
      const draft = await outfitService.startEmptyOutfit({ userId: req.user.id, name });
      res.status(200).json(draft);
    },

    async assignPiece(req, res) {
      const { draft, slotType, productId } = req.body ?? {};
      const updated = await outfitService.assignOrReplacePiece({
        userId: req.user.id,
        draft: draft ?? {},
        slotType,
        productId,
      });
      res.status(200).json(updated);
    },

    async save(req, res) {
      const { name, pieces } = req.body ?? {};
      const outfit = await outfitService.saveOutfit({ userId: req.user.id, name, pieces });
      res.status(201).location(`/api/outfits/${outfit.id}`).json(outfit);
    },

    async list(req, res) {
      const items = await outfitService.getUserOutfits({ userId: req.user.id });
      res.status(200).json({ items });
    },

    async getById(req, res) {
      const outfit = await outfitService.getOutfitById({ userId: req.user.id, outfitId: req.params.id });
      res.status(200).json(outfit);
    },
  };
}
