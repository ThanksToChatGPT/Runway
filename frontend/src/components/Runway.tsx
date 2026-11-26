/* eslint-disable @next/next/no-img-element */
'use client';

import {
  CATEGORIES,
  SLOT_ICONS,
  SLOT_ORDER,
  colorHex,
  colorLabel,
} from '@/domain/product';
import type { OutfitDraft } from '@/domain/outfit';
import type { Category } from '@/types';

interface RunwayProps {
  outfit: OutfitDraft;
  active: Category | null;
  onSlot: (slot: Category) => void;
  zoom?: number;
}

// Pasarela tipo lookbook: cada pieza se muestra como una foto completa. Ranura vacía = marco punteado.
export default function Runway({
  outfit,
  active,
  onSlot,
  zoom = 1,
}: RunwayProps) {
  return (
    <div className="runway">
      <div className="rail" style={{ fontSize: `${zoom}em` }}>
        {SLOT_ORDER.map((slot) => {
          const piece = outfit.items[slot];
          const isLocked = outfit.locked.includes(slot);
          return (
            <button
              type="button"
              key={slot}
              className={
                'piece' +
                (active === slot ? ' act' : '') +
                (piece ? '' : ' empty')
              }
              aria-pressed={active === slot}
              aria-label={`${CATEGORIES[slot]}: ${piece ? piece.name : 'vacío'}. Toca para ver opciones.`}
              onClick={() => onSlot(slot)}
            >
              {piece ? (
                <>
                  {piece.primaryImageUrl ? (
                    <img
                      src={piece.primaryImageUrl}
                      alt={piece.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span
                      className="ph"
                      style={{ background: colorHex(piece.color) }}
                    >
                      {SLOT_ICONS[slot]}
                    </span>
                  )}
                  {isLocked && (
                    <span className="lck" title="Pieza bloqueada">
                      🔒
                    </span>
                  )}
                  <span className="cap">
                    <b>{piece.name}</b>
                    <small>
                      {piece.color
                        ? colorLabel(piece.color)
                        : piece.store.name || CATEGORIES[slot]}
                    </small>
                  </span>
                </>
              ) : (
                <span className="ph">
                  {SLOT_ICONS[slot]}
                  <b>{CATEGORIES[slot]}</b>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="railhint mut small">
        Lookbook de 3 piezas · toca una pieza para ver opciones
      </p>
    </div>
  );
}
