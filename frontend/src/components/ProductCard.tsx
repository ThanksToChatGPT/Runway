'use client';

import Link from 'next/link';
import { formatCop } from '@/services/api';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  isCompared?: boolean;
  onToggleCompare?: (productId: string) => void;
}

export default function ProductCard({
  product,
  isCompared = false,
  onToggleCompare,
}: ProductCardProps) {
  const imageUrl =
    product.images?.find((img) => img.is_primary)?.image_url ||
    product.images?.[0]?.image_url ||
    'https://via.placeholder.com/400x400?text=Sin+Imagen';

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <Link href={`/products/${product.id}`} className="block aspect-square bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={product.title}
          className="h-full w-full object-cover transition hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="uppercase">{product.category}</span>
            <span>{product.store_name}</span>
          </div>
          <Link
            href={`/products/${product.id}`}
            className="mt-1 block font-semibold text-gray-900 hover:underline"
          >
            {product.title}
          </Link>
          <p className="text-sm text-gray-600">
            {product.brand} · {product.color}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">
            {formatCop(product.price_cop)}
          </span>
          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(product.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                isCompared
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isCompared ? 'En comparador' : 'Comparar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
