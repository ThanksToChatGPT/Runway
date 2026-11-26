'use client';

import { useEffect, useMemo, useState } from 'react';
import OutfitPanel from '@/components/OutfitPanel';
import ProductCard from '@/components/ProductCard';
import Runway from '@/components/Runway';
import { useApp } from '@/context/AppContext';
import { CATEGORIES, SLOT_ORDER, cheapestIds } from '@/domain/product';
import { api } from '@/services/api';
import type { Category, ProductSummary } from '@/types';

export default function BuilderPage() {
  const { outfit, undo, redo, canUndo, canRedo, handleError } = useApp();
  const [slot, setSlot] = useState<Category | null>(null);
  const [zoom, setZoom] = useState(1);
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slot) return;
    let cancelled = false;
    setLoading(true);
    api
      .searchProducts({
        category: slot,
        sort: 'price_asc',
        page,
        pageSize: 24,
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotalPages(Math.max(1, res.totalPages));
      })
      .catch((err) => {
        if (!cancelled) handleError(err, 'No pudimos cargar opciones para esta sección.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handleError, page, slot]);

  function selectSlot(next: Category) {
    setPage(1);
    setSlot(next);
  }

  const cheapest = useMemo(() => cheapestIds(items), [items]);

  return (
    <>
      <div className="builder">
        <section className="ed-section">
          <div
            className="row2"
            style={{ justifyContent: 'space-between', marginTop: 0 }}
          >
            <h1 className="ed-h1" style={{ marginBottom: 0 }}>
              Pasarela
            </h1>
            <div className="row2" style={{ margin: 0 }}>
              {SLOT_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="mini"
                  aria-pressed={slot === cat}
                  onClick={() => selectSlot(cat)}
                >
                  {CATEGORIES[cat]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Runway
              outfit={outfit}
              active={slot}
              onSlot={selectSlot}
              zoom={zoom}
            />
          </div>

          <div className="row2 center" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              aria-label="Alejar"
              onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
            >
              −
            </button>
            <button
              type="button"
              className="btn"
              aria-label="Acercar"
              onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
            >
              +
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canUndo}
              onClick={undo}
            >
              Deshacer
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canRedo}
              onClick={redo}
            >
              Rehacer
            </button>
          </div>
          <p className="mut small center">
            Toca una pieza de la pasarela para explorar prendas de esa categoría.
          </p>
        </section>

        <section className="ed-section">
          <h1 className="ed-h1">Tu outfit</h1>
          <OutfitPanel onSlot={selectSlot} />
        </section>
      </div>

      <section className="ed-section">
        <h2 className="ed-h2">
          {slot ? `Opciones: ${CATEGORIES[slot]}` : 'Opciones'}
        </h2>
        {!slot ? (
          <p className="mut">
            Elige una pieza de la pasarela para ver prendas disponibles,
            ordenadas de menor a mayor precio.
          </p>
        ) : loading ? (
          <p className="mut">Cargando opciones…</p>
        ) : items.length === 0 ? (
          <div className="empty">
            No hay prendas disponibles en {CATEGORIES[slot].toLowerCase()}.
          </div>
        ) : (
          <>
            <div className="cards">
              {items.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  cheapest={cheapest.has(p.id)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="row2 center" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span className="small mut">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
