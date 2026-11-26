'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { useApp } from '@/context/AppContext';
import { formatCOP } from '@/domain/money';
import { CATEGORIES, formatUpdatedAt } from '@/domain/product';
import { api } from '@/services/api';
import type { Outfit, ProductDetail, ProductSummary } from '@/types';

function detailToSummary(detail: ProductDetail): ProductSummary {
  const primary =
    detail.images.find((i) => i.isPrimary)?.url ?? detail.images[0]?.url ?? null;
  return {
    id: detail.id,
    name: detail.name,
    brand: detail.brand,
    category: detail.category,
    subcategory: detail.subcategory,
    color: detail.color,
    priceCop: detail.priceCop,
    currency: detail.currency,
    isSecondHand: detail.isSecondHand,
    primaryImageUrl: primary,
    availableSizes: detail.sizes
      .filter((s) => s.isAvailable)
      .map((s) => s.size),
    externalUrl: detail.externalUrl,
    store: detail.store,
  };
}

export default function OutfitsPage() {
  const router = useRouter();
  const { user, hydrated, favs, loadSavedOutfit, handleError } = useApp();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [favProducts, setFavProducts] = useState<ProductSummary[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);

  useEffect(() => {
    if (!hydrated || !user) {
      setOutfits([]);
      return;
    }
    let cancelled = false;
    setLoadingOutfits(true);
    api
      .getOutfits()
      .then((res) => {
        if (!cancelled) setOutfits(res.items);
      })
      .catch((err) => {
        if (!cancelled) handleError(err, 'No pudimos cargar tus outfits.');
      })
      .finally(() => {
        if (!cancelled) setLoadingOutfits(false);
      });

    return () => {
      cancelled = true;
    };
  }, [handleError, hydrated, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (favs.length === 0) {
      setFavProducts([]);
      return;
    }
    let cancelled = false;
    setLoadingFavs(true);
    Promise.allSettled(favs.map((id) => api.getProduct(id)))
      .then((results) => {
        if (cancelled) return;
        const resolved = results
          .filter(
            (r): r is PromiseFulfilledResult<ProductDetail> =>
              r.status === 'fulfilled',
          )
          .map((r) => detailToSummary(r.value));
        setFavProducts(resolved);
      })
      .finally(() => {
        if (!cancelled) setLoadingFavs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [favs, hydrated]);

  function openInBuilder(outfit: Outfit) {
    loadSavedOutfit(outfit);
    router.push('/builder');
  }

  return (
    <>
      <section className="ed-section">
        <h1 className="ed-h1">Mis outfits</h1>

        {!hydrated ? (
          <p className="mut">Cargando…</p>
        ) : !user ? (
          <div className="empty">
            <b>Inicia sesión para ver y guardar tus outfits.</b>
            <div className="row2 center" style={{ marginTop: 12 }}>
              <Link href="/auth" className="btn pri">
                Ingresar
              </Link>
            </div>
          </div>
        ) : loadingOutfits ? (
          <p className="mut">Cargando outfits guardados…</p>
        ) : outfits.length === 0 ? (
          <p className="mut">
            Aún no guardas outfits. Arma uno en el{' '}
            <Link href="/builder">constructor</Link>.
          </p>
        ) : (
          <ul className="list">
            {outfits.map((outfit) => (
              <li key={outfit.id ?? outfit.name} style={{ display: 'grid', gap: 8 }}>
                <div
                  className="row2"
                  style={{ justifyContent: 'space-between', margin: 0 }}
                >
                  <div>
                    <b>{outfit.name}</b>{' '}
                    <span className="mut">
                      · {formatCOP(outfit.totalCostCop)}
                    </span>
                    {outfit.createdAt && (
                      <span className="mut small">
                        {' '}
                        · Guardado el {formatUpdatedAt(outfit.createdAt)}
                      </span>
                    )}
                    {outfit.budget?.isOverBudget && (
                      <span
                        className="small"
                        style={{ color: 'var(--warn)', marginLeft: 8 }}
                      >
                        (Sobre presupuesto)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn pri"
                    onClick={() => openInBuilder(outfit)}
                  >
                    Abrir en el constructor
                  </button>
                </div>

                <div className="row2" style={{ margin: 0 }}>
                  {outfit.slots.map((slot) =>
                    slot.piece ? (
                      <span
                        key={slot.slotType}
                        className="chip2"
                        style={{ borderRadius: 9, cursor: 'default' }}
                      >
                        <small className="mut">{CATEGORIES[slot.slotType]}:</small>{' '}
                        <b>{slot.piece.name}</b>
                        <span className="mut">
                          ({slot.piece.store?.name || 'Tienda'} ·{' '}
                          {formatCOP(slot.piece.priceCop)})
                        </span>
                        <a
                          href={slot.piece.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mini"
                        >
                          Comprar ↗
                        </a>
                      </span>
                    ) : (
                      <span key={slot.slotType} className="small mut">
                        {CATEGORIES[slot.slotType]}: vacío
                      </span>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ed-section">
        <h1 className="ed-h1">
          Favoritos <span className="mut">· {favProducts.length}</span>
        </h1>
        {loadingFavs ? (
          <p className="mut">Cargando favoritos…</p>
        ) : favProducts.length === 0 ? (
          <p className="mut">
            Sin favoritos todavía. Toca el corazón ♡ en cualquier prenda del{' '}
            <Link href="/">catálogo</Link>.
          </p>
        ) : (
          <div className="cards">
            {favProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
