'use client';

import { useState } from 'react';
import { formatCop } from '@/services/api';
import type { Category, Product } from '@/types';

interface OutfitCanvasProps {
  slots: Record<Category, Product | null>;
  budgetLimitCop: number;
  onClearSlot: (slot: Category) => void;
  onSaveOutfit: (name: string) => Promise<void>;
}

const SLOT_LABELS: Record<Category, string> = {
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Calzado',
};

export default function OutfitCanvas({
  slots,
  budgetLimitCop,
  onClearSlot,
  onSaveOutfit,
}: OutfitCanvasProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const totalCop =
    (slots.top?.price_cop || 0) +
    (slots.bottom?.price_cop || 0) +
    (slots.shoes?.price_cop || 0);

  const overBudget = budgetLimitCop > 0 && totalCop > budgetLimitCop;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSaveOutfit(name.trim());
      setName('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Tu Outfit</h2>

      <div className="mt-4 space-y-3">
        {(['top', 'bottom', 'shoes'] as Category[]).map((slot) => {
          const item = slots[slot];
          return (
            <div
              key={slot}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  {SLOT_LABELS[slot]}
                </p>
                {item ? (
                  <>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">
                      {item.brand} · {formatCop(item.price_cop)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Sin seleccionar</p>
                )}
              </div>
              {item && (
                <button
                  type="button"
                  onClick={() => onClearSlot(slot)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Total estimado:</span>
          <span className="text-xl font-bold text-gray-900">
            {formatCop(totalCop)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>Presupuesto máximo:</span>
          <span>{formatCop(budgetLimitCop)}</span>
        </div>

        {overBudget && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Alerta de sobrepresupuesto: superas tu límite por{' '}
            <strong>{formatCop(totalCop - budgetLimitCop)}</strong>.
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Nombre del outfit..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={saving || totalCop === 0}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
