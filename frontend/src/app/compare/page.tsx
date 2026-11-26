'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ProductImage from '@/components/ProductImage';
import { useApp } from '@/context/AppContext';
import { formatCOP } from '@/domain/money';
import {
  colorLabel,
  formatUpdatedAt,
  productDetailToOutfitItem,
  productGroup,
} from '@/domain/product';
import { api } from '@/services/api';
import type { ProductDetail } from '@/types';

export default function ComparePage() {
  const { cmp, toggleCmp, add, hydrated, handleError } = useApp();
  const [urlIds, setUrlIds] = useState<string[] | null>(null);
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ids');
    if (raw) {
      setUrlIds(raw.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }, []);

  const activeIds = useMemo(
    () => (urlIds ?? cmp).slice(0, 4),
    [urlIds, cmp],
  );

  useEffect(() => {
    if (!hydrated && urlIds === null) return;
    if (activeIds.length < 2) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .compareProducts(activeIds)
      .then((res) => {
        if (!cancelled) setProducts(res.products);
      })
      .catch((err) => {
        if (!cancelled) {
          setProducts([]);
          handleError(err, 'No pudimos cargar la comparación.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeIds, handleError, hydrated, urlIds]);

  function handleRemove(id: string) {
    if (urlIds) {
      const next = urlIds.filter((item) => item !== id);
      setUrlIds(next.length > 0 ? next : null);
    }
    if (cmp.includes(id)) {
      toggleCmp(id);
    }
  }

  if (loading) {
    return (
      <section className="ed-section">
        <p className="mut">Cargando comparación…</p>
      </section>
    );
  }

  if (products.length < 2) {
    return (
      <section className="ed-section">
        <h1 className="ed-h1">Comparador</h1>
        <div className="empty">
          Marca al menos dos prendas (hasta 4) con “Comparar” en el{' '}
          <Link href="/">catálogo</Link>.
        </div>
      </section>
    );
  }

  const minPrice = Math.min(...products.map((p) => p.priceCop));
  const sharedScore = (a: ProductDetail, b: ProductDetail) =>
    Number(productGroup(a) === productGroup(b)) +
    Number(Boolean(a.color) && a.color === b.color) +
    Number(Boolean(a.brand) && a.brand === b.brand) +
    Number(Boolean(a.material) && a.material === b.material);

  const maxShared = Math.max(
    0,
    ...products.flatMap((a) =>
      products.filter((b) => b.id !== a.id).map((b) => sharedScore(a, b)),
    ),
  );

  const row = (
    label: string,
    render: (p: ProductDetail) => React.ReactNode,
    highlightCheapest = false,
  ) => (
    <tr>
      <th scope="row">{label}</th>
      {products.map((p) => (
        <td
          key={p.id}
          className={highlightCheapest && p.priceCop === minPrice ? 'min' : ''}
        >
          {render(p)}
        </td>
      ))}
    </tr>
  );

  return (
    <section className="ed-section">
      <h1 className="ed-h1">Comparador</h1>
      {maxShared >= 2 && (
        <p className="matchnote ok">
          <b>Parecidas entre sí:</b> comparten tipo, color o marca. La opción más
          barata queda marcada en verde.
        </p>
      )}

      <div className="tw">
        <table className="ed-table">
          <thead>
            <tr>
              <th />
              {products.map((p) => (
                <th key={p.id}>
                  <Link href={`/products/${p.id}`} className="nm">
                    {p.name}
                  </Link>
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="mini"
                      onClick={() => handleRemove(p.id)}
                    >
                      Quitar
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row('Foto', (p) => {
              const primary =
                p.images.find((i) => i.isPrimary)?.url ??
                p.images[0]?.url ??
                null;
              return (
                <span className="cmpimg">
                  <ProductImage
                    src={primary}
                    name={p.name}
                    category={p.category}
                    color={p.color}
                  />
                </span>
              );
            })}
            {row(
              'Precio',
              (p) =>
                formatCOP(p.priceCop) +
                (p.priceCop === minPrice ? ' (más bajo)' : ''),
              true,
            )}
            {row('Tienda', (p) => p.store?.name || '—')}
            {row('Marca', (p) => p.brand || '—')}
            {row('Color', (p) => colorLabel(p.color))}
            {row('Material', (p) => p.material || '—')}
            {row('Estado', (p) => (p.isSecondHand ? 'Segunda mano' : 'Nuevo'))}
            {row(
              'Tallas disponibles',
              (p) =>
                p.sizes
                  .filter((z) => z.isAvailable)
                  .map((z) => z.size)
                  .join(', ') || '—',
            )}
            {row('Actualizado', (p) => formatUpdatedAt(p.lastPriceUpdate))}
            {row('Tienda en línea', (p) => (
              <a
                href={p.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mini"
              >
                Ver en tienda ↗
              </a>
            ))}
            {row('', (p) => (
              <button
                type="button"
                className="mini pri"
                onClick={() => add(productDetailToOutfitItem(p))}
              >
                Agregar al outfit
              </button>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mut small" style={{ marginTop: 10 }}>
        Material y calificación se muestran cuando las tiendas entregan esos datos.
      </p>
    </section>
  );
}
