'use client';

import { useEffect, useState } from 'react';
import OutfitCanvas from '@/components/OutfitCanvas';
import { api, formatCop } from '@/services/api';
import type { Category, Product } from '@/types';

export default function BuilderPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('top');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [budgetLimit, setBudgetLimit] = useState<number>(500000);
  const [slots, setSlots] = useState<Record<Category, Product | null>>({
    top: null,
    bottom: null,
    shoes: null,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .getPreferences()
      .then((prefs) => setBudgetLimit(prefs.budget_limit_cop))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .searchProducts({ category: activeCategory, limit: 24 })
      .then((res) => setCatalog(res.items))
      .catch(console.error);
  }, [activeCategory]);

  async function handleSaveOutfit(name: string) {
    setMessage('');
    try {
      await api.saveOutfit({
        name,
        topId: slots.top?.id,
        bottomId: slots.bottom?.id,
        shoesId: slots.shoes?.id,
      });
      setMessage('Outfit guardado correctamente.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error guardando outfit');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Outfit Builder</h1>
          <div className="flex gap-2">
            {(['top', 'bottom', 'shoes'] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                  activeCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'border bg-white text-gray-700'
                }`}
              >
                {cat === 'shoes' ? 'Calzado' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {catalog.map((item) => {
            const img = item.images?.[0]?.image_url || 'https://via.placeholder.com/300';
            const selected = slots[activeCategory]?.id === item.id;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm ${
                  selected ? 'ring-2 ring-gray-900' : ''
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={item.title}
                  className="h-20 w-20 rounded object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.brand} · {item.store_name}
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {formatCop(item.price_cop)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSlots((prev) => ({ ...prev, [activeCategory]: item }))
                  }
                  className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                >
                  {selected ? 'En uso' : 'Elegir'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <OutfitCanvas
          slots={slots}
          budgetLimitCop={budgetLimit}
          onClearSlot={(slot) => setSlots((prev) => ({ ...prev, [slot]: null }))}
          onSaveOutfit={handleSaveOutfit}
        />
        {message && (
          <p className="rounded border bg-white p-3 text-sm text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
}
