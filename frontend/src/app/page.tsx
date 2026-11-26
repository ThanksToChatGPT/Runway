'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import FilterBar from '@/components/FilterBar';
import ProductCard from '@/components/ProductCard';
import { DEFAULT_FILTERS, useApp } from '@/context/AppContext';
import { cheapestIds } from '@/domain/product';
import { api } from '@/services/api';
import type { CatalogFacets, ProductSummary, StoreRef } from '@/types';

const EMPTY_FACETS: CatalogFacets = {
  colors: [],
  sizes: [],
  brands: [],
  subcategories: [],
  priceRange: { min: null, max: null },
};

const PAGE_SIZE = 20;

export default function CatalogPage() {
  const { filters, setFilters, cmp, user, hydrated, handleError } = useApp();
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [facets, setFacets] = useState<CatalogFacets>(EMPTY_FACETS);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filters);
  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    api
      .getStores()
      .then((res) => setStores(res.items))
      .catch(() => setStores([]));
    api
      .getFacets()
      .then(setFacets)
      .catch(() => setFacets(EMPTY_FACETS));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let targetPage = page;
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
      targetPage = 1;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const minNum =
        filters.minPrice.trim() !== '' ? Number(filters.minPrice) : undefined;
      const usePrefs = Boolean(user && filters.usePreferences);

      api
        .searchProducts({
          q: filters.q || undefined,
          category: filters.category || undefined,
          sort: filters.sort || undefined,
          brand: filters.brands.length ? filters.brands : undefined,
          color: filters.colors.length ? filters.colors : undefined,
          size: filters.sizes.length ? filters.sizes : undefined,
          store: filters.includeStores.length
            ? filters.includeStores
            : undefined,
          excludeStore: filters.excludeStores.length
            ? filters.excludeStores
            : undefined,
          minPrice:
            !usePrefs && minNum !== undefined && Number.isFinite(minNum)
              ? minNum
              : undefined,
          maxPrice:
            !usePrefs && filters.maxPrice !== null
              ? filters.maxPrice
              : undefined,
          usePreferences: usePrefs || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        })
        .then((res) => {
          if (cancelled) return;
          setProducts(res.items);
          setTotalItems(res.totalItems);
          setTotalPages(Math.max(1, res.totalPages));
        })
        .catch((err) => {
          if (!cancelled) handleError(err, 'No pudimos cargar el catálogo.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filterKey, filters, handleError, hydrated, page, user]);

  const cheapest = useMemo(() => cheapestIds(products), [products]);

  return (
    <section className="ed-section">
      <div className="row2" style={{ justifyContent: 'space-between', marginTop: 0 }}>
        <h1 className="ed-h1" style={{ marginBottom: 0 }}>
          Catálogo <span className="mut">· {totalItems} prendas</span>
        </h1>
        {cmp.length >= 2 && (
          <Link href="/compare" className="btn pri">
            Comparar ({cmp.length})
          </Link>
        )}
      </div>

      <FilterBar stores={stores} facets={facets} />

      {loading ? (
        <p className="mut">Cargando catálogo…</p>
      ) : products.length === 0 ? (
        <div className="empty">
          <b>Sin resultados.</b>
          <br />
          Prueba quitar filtros, subir el precio máximo o buscar otras palabras.
          <div className="row2 center" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      ) : (
        <div className="cards">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              cheapest={cheapest.has(product.id)}
            />
          ))}
        </div>
      )}

      <div
        className="row2"
        style={{
          justifyContent: 'space-between',
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid var(--line)',
        }}
      >
        <span className="small mut">
          Página {page} de {totalPages} ({totalItems} prendas)
        </span>
        <div className="row2" style={{ margin: 0 }}>
          <button
            type="button"
            className="btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
