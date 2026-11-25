'use client';

import { useEffect, useState } from 'react';
import { api, formatCop } from '@/services/api';

export default function PreferencesPage() {
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(500000);
  const [budgetLimit, setBudgetLimit] = useState(500000);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api
      .getPreferences()
      .then((prefs) => {
        setMinPrice(prefs.min_price_cop);
        setMaxPrice(prefs.max_price_cop);
        setBudgetLimit(prefs.budget_limit_cop);
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : 'Inicia sesión primero'));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    try {
      await api.updatePreferences({
        min_price_cop: Number(minPrice),
        max_price_cop: Number(maxPrice),
        budget_limit_cop: Number(budgetLimit),
      });
      setStatus('Preferencias actualizadas.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Error guardando preferencias');
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">Preferencias de presupuesto</h1>
      <p className="mt-1 text-sm text-gray-600">
        Define tu rango de precios por prenda y presupuesto máximo de outfit en COP.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Precio mínimo por prenda (COP)
          </label>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Precio máximo por prenda (COP)
          </label>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Presupuesto máximo de outfit ({formatCop(budgetLimit)})
          </label>
          <input
            type="number"
            min={0}
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {status && <p className="text-sm text-gray-700">{status}</p>}

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Guardar preferencias
        </button>
      </form>
    </div>
  );
}
