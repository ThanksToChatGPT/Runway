'use client';

import type { Store } from '@/types';

export interface CatalogFilters {
  q: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  storeId: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
}

interface FilterBarProps {
  filters: CatalogFilters;
  stores: Store[];
  onChange: (next: CatalogFilters) => void;
  onSubmit: () => void;
}

export default function FilterBar({
  filters,
  stores,
  onChange,
  onSubmit,
}: FilterBarProps) {
  function update(field: keyof CatalogFilters, value: string) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-4"
    >
      <input
        type="text"
        placeholder="Buscar prenda o marca..."
        value={filters.q}
        onChange={(e) => update('q', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      />

      <select
        value={filters.category}
        onChange={(e) => update('category', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Todas las categorías</option>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
        <option value="shoes">Calzado</option>
      </select>

      <select
        value={filters.storeId}
        onChange={(e) => update('storeId', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">Todas las tiendas</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={filters.sort}
        onChange={(e) => update('sort', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="newest">Más recientes</option>
        <option value="price_asc">Precio: menor a mayor</option>
        <option value="price_desc">Precio: mayor a menor</option>
      </select>

      <input
        type="text"
        placeholder="Marca"
        value={filters.brand}
        onChange={(e) => update('brand', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      />

      <input
        type="text"
        placeholder="Color"
        value={filters.color}
        onChange={(e) => update('color', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      />

      <input
        type="text"
        placeholder="Talla (ej. M, 32, 40)"
        value={filters.size}
        onChange={(e) => update('size', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      />

      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Min COP"
          value={filters.minPrice}
          onChange={(e) => update('minPrice', e.target.value)}
          className="w-1/2 rounded-md border px-2 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Max COP"
          value={filters.maxPrice}
          onChange={(e) => update('maxPrice', e.target.value)}
          className="w-1/2 rounded-md border px-2 py-2 text-sm"
        />
      </div>

      <div className="md:col-span-4 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}
