'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Price from '@/components/Price';
import ProductCard from '@/components/ProductCard';
import ProductImage from '@/components/ProductImage';
import { useApp } from '@/context/AppContext';
import {
  CATEGORIES,
  cheapestIds,
  colorLabel,
  formatUpdatedAt,
  productDetailToOutfitItem,
  similarProducts,
} from '@/domain/product';
import { api } from '@/services/api';
import type { ProductDetail, ProductSummary } from '@/types';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { add, cmp, toggleCmp, favs, toggleFav, toast } = useApp();
  const [product, setProduct] = useState<ProductDetail | null | undefined>(
    undefined,
  );
  const [imgIndex, setImgIndex] = useState(0);
  const [similar, setSimilar] = useState<ProductSummary[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    setProduct(undefined);
    setImgIndex(0);
    setSimilar([]);
    setReportText('');
    setReportOpen(false);

    api
      .getProduct(params.id)
      .then((detail) => {
        if (cancelled) return;
        setProduct(detail);
        const primaryIdx = detail.images.findIndex((img) => img.isPrimary);
        setImgIndex(primaryIdx >= 0 ? primaryIdx : 0);

        api
          .searchProducts({ category: detail.category, pageSize: 50 })
          .then((page) => {
            if (!cancelled) {
              setSimilar(similarProducts(page.items, detail, 4));
            }
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      });

    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  const cheapestSimilar = useMemo(() => cheapestIds(similar), [similar]);

  function sendReport() {
    if (!product) return;
    if (!reportText.trim()) {
      toast('Cuéntanos qué está mal antes de enviar.');
      return;
    }
    try {
      const key = 'ob_reports';
      const list = JSON.parse(localStorage.getItem(key) || '[]') as Array<{
        productId: string;
        name: string;
        text: string;
        date: string;
      }>;
      list.push({
        productId: product.id,
        name: product.name,
        text: reportText.trim(),
        date: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(list));
      setReportText('');
      setReportOpen(false);
      toast('Reporte enviado. ¡Gracias por avisarnos!');
    } catch {
      toast('No pudimos guardar el reporte. Intenta de nuevo.');
    }
  }

  if (product === undefined) {
    return (
      <section className="ed-section">
        <p className="mut">Cargando detalle…</p>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="ed-section">
        <div className="empty">
          Prenda no encontrada. <Link href="/">Volver al catálogo</Link>
        </div>
      </section>
    );
  }

  const isFav = favs.includes(product.id);
  const isCmp = cmp.includes(product.id);
  const currentImg = product.images[imgIndex]?.url ?? null;

  return (
    <section className="ed-section">
      <p style={{ marginTop: 0 }}>
        <Link href="/">← Catálogo</Link>
      </p>

      <div className="detail">
        <div>
          <div className="gal">
            <ProductImage
              src={currentImg}
              name={product.name}
              category={product.category}
              color={product.color}
              alt={`${product.name}, foto ${imgIndex + 1}`}
            />
          </div>
          {product.images.length > 1 && (
            <div className="thumbs">
              {product.images.map((img, i) => (
                <button
                  type="button"
                  key={`${img.url}-${i}`}
                  className="th"
                  aria-pressed={i === imgIndex}
                  aria-label={`Ver foto ${i + 1}`}
                  onClick={() => setImgIndex(i)}
                >
                  <ProductImage
                    src={img.url}
                    name={product.name}
                    category={product.category}
                    color={product.color}
                    alt={`${product.name}, miniatura ${i + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="ed-h1">{product.name}</h1>
          <p className="mut">
            {product.brand || 'Sin marca'} · {colorLabel(product.color)} ·{' '}
            {CATEGORIES[product.category]}
            {product.material ? ` · ${product.material}` : ''}
          </p>
          <p className="price">
            <Price priceCop={product.priceCop} />
          </p>
          <p>
            {product.store?.name || 'Tienda'}
            {product.isSecondHand && ' · Segunda mano (stock limitado)'}
            {product.rating !== null && ` · ★ ${product.rating.toFixed(1)}`}
          </p>

          <div className="sz" aria-label="Tallas disponibles">
            {product.sizes.length > 0 ? (
              product.sizes.map((z) => (
                <span
                  key={z.size}
                  className={z.isAvailable ? '' : 'no'}
                  title={z.isAvailable ? 'Disponible' : 'No disponible'}
                >
                  {z.size}
                </span>
              ))
            ) : (
              <span className="no">Sin tallas registradas</span>
            )}
          </div>

          <p className="mut small">
            Actualizado el {formatUpdatedAt(product.lastPriceUpdate)}. Verifica
            precio y stock en la tienda.
          </p>

          <div className="row2" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn pri"
              onClick={() => add(productDetailToOutfitItem(product))}
            >
              Agregar al outfit
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={isCmp}
              onClick={() => toggleCmp(product.id)}
            >
              {isCmp ? 'En comparador' : 'Comparar'}
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={isFav}
              onClick={() => toggleFav(product.id)}
            >
              {isFav ? '♥ Favorito' : '♡ Favorito'}
            </button>
            <a
              className="btn"
              href={product.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver en {product.store?.name || 'tienda'} ↗
            </a>
            <button
              type="button"
              className="btn"
              aria-expanded={reportOpen}
              onClick={() => setReportOpen((open) => !open)}
            >
              Reportar error
            </button>
          </div>

          {reportOpen && (
            <div className="report">
              <label htmlFor="rep">
                ¿Qué está mal? (precio, foto, enlace…)
              </label>
              <textarea
                id="rep"
                className="ed-textarea"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="El precio que veo en la tienda es otro…"
              />
              <div>
                <button type="button" className="btn pri" onClick={sendReport}>
                  Enviar reporte
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <div className="alsolike">
          <h2 className="ed-h2">También te puede gustar</h2>
          <div className="cards">
            {similar.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                cheapest={cheapestSimilar.has(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
