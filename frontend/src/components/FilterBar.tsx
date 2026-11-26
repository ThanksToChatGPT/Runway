'use client';

import { useState, type SetStateAction } from 'react';
import { formatCOP } from '@/domain/money';
import { CATEGORIES, colorHex, colorLabel } from '@/domain/product';
import type { CatalogFacets, Category, PriceSort, StoreRef } from '@/types';

export interface CatalogFilters {
  q: string;
  category: Category | '';
  sort: PriceSort | '';
  includeStores: string[];
  excludeStores: string[];
  colors: string[];
  sizes: string[];
  brands: string[];
  minPrice: string;
  maxPrice: number | null;
  usePreferences: boolean;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  sort: '',
  includeStores: [],
  excludeStores: [],
  colors: [],
  sizes: [],
  brands: [],
  minPrice: '',
  maxPrice: null,
  usePreferences: false,
};

interface FilterBarProps {
  filters: CatalogFilters;
  onChange: (next: SetStateAction<CatalogFilters>) => void;
  stores: StoreRef[];
  facets: CatalogFacets;
  canUsePreferences: boolean;
}

export default function FilterBar({
  filters: f,
  onChange,
  stores,
  facets,
  canUsePreferences,
}: FilterBarProps) {
  const [storeMode, setStoreMode] = useState<'include' | 'exclude'>('include');

  const sliderMax = Math.max(
    500000,
    Math.ceil((facets.priceRange.max ?? 500000) / 50000) * 50000,
  );
  const currentMax = f.maxPrice ?? sliderMax;

  function patch(next: Partial<CatalogFilters>) {
    onChange((prev) => ({ ...prev, ...next }));
  }

  function toggleListValue(key: 'colors' | 'sizes' | 'brands', value: string) {
    onChange((prev) => {
      const list = prev[key];
      const next = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
      return { ...prev, [key]: next };
    });
  }

  function toggleStore(storeId: string) {
    onChange((prev) => {
      if (storeMode === 'include') {
        const exists = prev.includeStores.includes(storeId);
        return {
          ...prev,
          includeStores: exists
            ? prev.includeStores.filter((id) => id !== storeId)
            : [...prev.includeStores, storeId],
          excludeStores: prev.excludeStores.filter((id) => id !== storeId),
        };
      }
      const exists = prev.excludeStores.includes(storeId);
      return {
        ...prev,
        excludeStores: exists
          ? prev.excludeStores.filter((id) => id !== storeId)
          : [...prev.excludeStores, storeId],
        includeStores: prev.includeStores.filter((id) => id !== storeId),
      };
    });
  }

  function togglePreferences(checked: boolean) {
    onChange((prev) => ({
      ...prev,
      usePreferences: checked,
      minPrice: checked ? '' : prev.minPrice,
      maxPrice: checked ? null : prev.maxPrice,
    }));
  }

  return (
    <div className="filters">
      <div className="filters-top">
        <input
          type="search"
          placeholder="Buscar: “jean negro”, “camiseta”, “tenis”…"
          aria-label="Buscar prendas"
          value={f.q}
          onChange={(e) => patch({ q: e.target.value })}
        />

        <select
          aria-label="Categoría"
          value={f.category}
          onChange={(e) => patch({ category: e.target.value as Category | '' })}
        >
          <option value="">Todas las categorías</option>
          {(Object.entries(CATEGORIES) as [Category, string][]).map(
            ([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ),
          )}
        </select>

        <select
          aria-label="Ordenar"
          value={f.sort}
          onChange={(e) => patch({ sort: e.target.value as PriceSort | '' })}
        >
          <option value="">Orden: relevancia</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </select>

        {facets.brands.length > 0 && (
          <select
            aria-label="Marca"
            value={f.brands[0] ?? ''}
            onChange={(e) =>
              patch({ brands: e.target.value ? [e.target.value] : [] })
            }
          >
            <option value="">Todas las marcas</option>
            {facets.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        )}
      </div>

      {stores.length > 0 && (
        <div className="row2" aria-label="Filtrar por tiendas">
          <span className="small mut">Tiendas:</span>
          <button
            type="button"
            className="mini"
            aria-pressed={storeMode === 'include'}
            onClick={() => setStoreMode('include')}
          >
            Incluir
          </button>
          <button
            type="button"
            className="mini"
            aria-pressed={storeMode === 'exclude'}
            onClick={() => setStoreMode('exclude')}
          >
            Excluir
          </button>
          {stores.map((s) => {
            const included = f.includeStores.includes(s.id);
            const excluded = f.excludeStores.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={'chip2' + (excluded ? ' excl' : '')}
                aria-pressed={included}
                title={
                  excluded
                    ? 'Tienda excluida (clic para quitar en modo Excluir)'
                    : included
                      ? 'Tienda incluida'
                      : `Clic para ${storeMode === 'include' ? 'incluir' : 'excluir'}`
                }
                onClick={() => toggleStore(s.id)}
              >
                {excluded ? `✕ ${s.name || 'Tienda'}` : s.name || 'Tienda'}
              </button>
            );
          })}
        </div>
      )}

      {facets.colors.length > 0 && (
        <div className="row2" aria-label="Filtrar por color">
          <span className="small mut">Color:</span>
          {facets.colors.map((c) => (
            <button
              key={c}
              type="button"
              className="chip2"
              aria-pressed={f.colors.includes(c)}
              onClick={() => toggleListValue('colors', c)}
            >
              <span
                className="swatch-dot"
                style={{ background: colorHex(c) }}
                aria-hidden="true"
              />
              {colorLabel(c)}
            </button>
          ))}
        </div>
      )}

      {facets.sizes.length > 0 && (
        <div className="row2" aria-label="Filtrar por talla">
          <span className="small mut">Talla:</span>
          {facets.sizes.map((size) => (
            <button
              key={size}
              type="button"
              className="chip2"
              aria-pressed={f.sizes.includes(size)}
              onClick={() => toggleListValue('sizes', size)}
            >
              {size}
            </button>
          ))}
        </div>
      )}

      <div className="row2">
        <label className="row2" style={{ margin: 0 }}>
          <span>Precio mín.</span>
          <input
            type="number"
            min={0}
            step={5000}
            placeholder="0"
            value={f.minPrice}
            onChange={(e) =>
              patch({ minPrice: e.target.value, usePreferences: false })
            }
            style={{ width: 110 }}
          />
        </label>

        <label className="row2" style={{ margin: 0 }}>
          <span>Precio máx.</span>
          <input
            type="range"
            min={10000}
            max={sliderMax}
            step={10000}
            value={Math.min(currentMax, sliderMax)}
            onChange={(e) => {
              const val = Number(e.target.value);
              patch({
                maxPrice: val >= sliderMax ? null : val,
                usePreferences: false,
              });
            }}
          />
          <b>
            {f.maxPrice === null || f.maxPrice >= sliderMax
              ? 'sin límite'
              : formatCOP(f.maxPrice)}
          </b>
        </label>

        {canUsePreferences && (
          <label className="row2" style={{ margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={f.usePreferences}
              onChange={(e) => togglePreferences(e.target.checked)}
            />
            <span>Usar mi rango guardado</span>
          </label>
        )}

        <span className="sp" />

        <button
          type="button"
          className="btn"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
