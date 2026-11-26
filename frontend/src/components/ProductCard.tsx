'use client';

import Link from 'next/link';
import { CATEGORIES, colorLabel } from '@/domain/product';
import { useApp } from '@/context/AppContext';
import type { ProductSummary } from '@/types';
import Price from './Price';
import ProductImage from './ProductImage';

interface ProductCardProps {
  product: ProductSummary;
  cheapest?: boolean;
}

export default function ProductCard({
  product,
  cheapest = false,
}: ProductCardProps) {
  const { add, cmp, toggleCmp, favs, toggleFav } = useApp();
  const isFav = favs.includes(product.id);
  const isCmp = cmp.includes(product.id);
  const to = `/products/${product.id}`;

  return (
    <article className="card">
      <Link href={to} className="sw" aria-label={`Ver ${product.name}`}>
        <ProductImage
          src={product.primaryImageUrl}
          name={product.name}
          category={product.category}
          color={product.color}
          alt={`${product.name}, foto principal`}
        />
        <b className="st">{product.store?.name || 'Tienda'}</b>
        <span className="bd">
          {product.isSecondHand && <u>2.ª mano</u>}
          {cheapest && <s>Más barato</s>}
        </span>
        <span className="ic">{CATEGORIES[product.category]}</span>
      </Link>

      <button
        type="button"
        className={'fav' + (isFav ? ' on' : '')}
        aria-pressed={isFav}
        aria-label={
          isFav
            ? `Quitar ${product.name} de favoritos`
            : `Guardar ${product.name} en favoritos`
        }
        onClick={() => toggleFav(product.id)}
      >
        {isFav ? '♥' : '♡'}
      </button>

      <div className="cb">
        <Link href={to} className="nm">
          {product.name}
        </Link>
        <small>
          {product.brand || 'Sin marca'} · {colorLabel(product.color)}
        </small>
        <strong>
          <Price priceCop={product.priceCop} />
        </strong>
        <div className="ca">
          <button type="button" className="mini" onClick={() => add(product)}>
            Agregar
          </button>
          <button
            type="button"
            className="mini"
            aria-pressed={isCmp}
            onClick={() => toggleCmp(product.id)}
          >
            {isCmp ? 'En comparador' : 'Comparar'}
          </button>
        </div>
      </div>
    </article>
  );
}
