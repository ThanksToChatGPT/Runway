'use client';

import { useEffect, useState } from 'react';
import { api, formatCop } from '@/services/api';
import type { Outfit } from '@/types';

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadOutfits() {
    setLoading(true);
    try {
      const res = await api.getOutfits();
      setOutfits(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inicia sesión para ver tus outfits');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOutfits();
  }, []);

  async function handleDelete(id: string) {
    await api.deleteOutfit(id);
    setOutfits((prev) => prev.filter((o) => o.id !== id));
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando outfits...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mis Outfits guardados</h1>

      {outfits.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
          Aún no tienes outfits guardados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {outfits.map((outfit) => (
            <div key={outfit.id} className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{outfit.name}</h2>
                  <p className="text-sm font-semibold text-gray-700">
                    Total: {formatCop(outfit.total_cop)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(outfit.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {outfit.slots.map((slot) => (
                  <div
                    key={slot.slot_type}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-600">
                        {slot.slot_type}
                      </span>
                      <span className="font-medium text-gray-900">{slot.title}</span>
                      <span className="ml-2 text-gray-500">
                        ({formatCop(slot.price_cop)})
                      </span>
                    </div>
                    <a
                      href={slot.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Comprar ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
