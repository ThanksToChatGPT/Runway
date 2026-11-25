'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import FilterBar, { type CatalogFilters } from '@/components/FilterBar';
import ProductCard from '@/components/ProductCard';
import { api } from '@/services/api';
import type { Product, Store } from '@/types';

const INITIAL_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  brand: '',
  color: '',
  size: '',
  storeId: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
};

export default function CatalogPage() {
  const [filters, setFilters] = useState<CatalogFilters>(INITIAL_FILTERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const limit = 12;

  async function loadCatalog(targetPage: number, currentFilters: CatalogFilters) {
    setLoading(true);
    try {
      const data = await api.searchProducts({
        ...currentFilters,
        page: targetPage,
        limit,
      });
      setProducts(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.getStores().then(setStores).catch(() => {});
    loadCatalog(1, INITIAL_FILTERS);
  }, []);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev;
      localStorage.setItem('ob_compare_ids', JSON.stringify(next));
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          <p className="text-sm text-gray-600">
            Explora prendas, filtra por precio en COP y compara opciones.
          </p>
        </div>

        {compareIds.length > 0 && (
          <Link
            href={`/compare?ids=${compareIds.join(',')}`}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Comparar ({compareIds.length})
          </Link>
        )}
      </div>

      <FilterBar
        filters={filters}
        stores={stores}
        onChange={setFilters}
        onSubmit={() => {
          setPage(1);
          loadCatalog(1, filters);
        }}
      />

      {loading ? (
        <p className="text-sm text-gray-500">Cargando productos...</p>
      ) : products.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
          No se encontraron productos con los filtros actuales.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isCompared={compareIds.includes(product.id)}
              onToggleCompare={toggleCompare}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4 text-sm">
        <span className="text-gray-600">
          Página {page} de {totalPages} ({total} productos)
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => {
              const prev = page - 1;
              setPage(prev);
              loadCatalog(prev, filters);
            }}
            className="rounded border bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              loadCatalog(next, filters);
            }}
            className="rounded border bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
