'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, formatCop } from '@/services/api';
import type { Product } from '@/types';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.id) return;
    api
      .getProduct(params.id)
      .then(setProduct)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error cargando producto'));
  }, [params?.id]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!product) {
    return <p className="text-sm text-gray-500">Cargando detalle...</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-gray-600 hover:underline">
        ← Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 gap-8 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-2">
        <div className="space-y-3">
          {product.images?.length > 0 ? (
            product.images.map((img, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={img.image_url}
                alt={product.title}
                className="w-full rounded-lg border object-cover"
              />
            ))
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
              Sin fotos disponibles
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase text-gray-500">
            {product.category} · {product.store_name}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
          <p className="text-gray-600">
            Marca: <strong>{product.brand}</strong> · Color: <strong>{product.color}</strong>
          </p>
          <p className="text-3xl font-bold text-gray-900">{formatCop(product.price_cop)}</p>

          <div>
            <h2 className="text-sm font-semibold text-gray-700">Tallas disponibles</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.sizes?.length > 0 ? (
                product.sizes.map((s) => (
                  <span
                    key={s.size}
                    className={`rounded border px-3 py-1 text-xs font-medium ${
                      s.in_stock
                        ? 'border-gray-300 bg-white text-gray-800'
                        : 'border-gray-200 bg-gray-100 text-gray-400 line-through'
                    }`}
                  >
                    {s.size}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">Sin tallas registradas</span>
              )}
            </div>
          </div>

          <div className="pt-4">
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Ir a comprar en {product.store_name} ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
