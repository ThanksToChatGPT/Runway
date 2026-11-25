'use client';

import { useEffect, useState } from 'react';
import { api, formatCop } from '@/services/api';
import type { Product } from '@/types';

export default function ComparePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idsParam = params.get('ids');
    const saved = localStorage.getItem('ob_compare_ids');
    const ids = idsParam
      ? idsParam.split(',').filter(Boolean)
      : saved
      ? (JSON.parse(saved) as string[])
      : [];

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    api
      .compareProducts(ids)
      .then((res) => setProducts(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Cargando comparación...</p>;

  if (products.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
        Selecciona prendas desde el catálogo con el botón &quot;Comparar&quot; para verlas lado a lado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Comparador lado a lado</h1>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-4 font-semibold text-gray-600">Atributo</th>
              {products.map((p) => (
                <th key={p.id} className="p-4 font-semibold text-gray-900">
                  {p.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="p-4 font-medium text-gray-600">Precio (COP)</td>
              {products.map((p) => (
                <td key={p.id} className="p-4 font-bold text-gray-900">
                  {formatCop(p.price_cop)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-gray-600">Marca</td>
              {products.map((p) => (
                <td key={p.id} className="p-4">
                  {p.brand}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-gray-600">Tienda</td>
              {products.map((p) => (
                <td key={p.id} className="p-4">
                  {p.store_name}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-gray-600">Color</td>
              {products.map((p) => (
                <td key={p.id} className="p-4">
                  {p.color}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-gray-600">Tallas</td>
              {products.map((p) => (
                <td key={p.id} className="p-4">
                  {p.sizes?.map((s) => s.size).join(', ') || 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-gray-600">Enlace</td>
              {products.map((p) => (
                <td key={p.id} className="p-4">
                  <a
                    href={p.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    Ver en tienda ↗
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
