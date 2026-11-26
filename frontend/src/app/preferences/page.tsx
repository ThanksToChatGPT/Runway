'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatCOP } from '@/domain/money';
import { api, ApiError } from '@/services/api';

export default function PreferencesPage() {
  const { user, hydrated, refreshPreferences, toast, handleError } = useApp();
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxOutfitBudget, setMaxOutfitBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hydrated || !user) return;
    let cancelled = false;
    setLoading(true);
    api
      .getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setMinPrice(
          prefs.priceRange.min !== null ? String(prefs.priceRange.min) : '',
        );
        setMaxPrice(
          prefs.priceRange.max !== null ? String(prefs.priceRange.max) : '',
        );
        setMaxOutfitBudget(
          prefs.maxOutfitBudget !== null ? String(prefs.maxOutfitBudget) : '',
        );
      })
      .catch((err) => {
        if (!cancelled) handleError(err, 'No pudimos cargar tus preferencias.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handleError, hydrated, user]);

  function toNullableCop(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    return Math.round(Number(trimmed));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const min = toNullableCop(minPrice);
    const max = toNullableCop(maxPrice);
    const budget = toNullableCop(maxOutfitBudget);

    if (min !== null && max !== null && min > max) {
      setError('El precio mínimo no puede ser mayor que el precio máximo.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updatePreferences({
        minPrice: min,
        maxPrice: max,
        maxOutfitBudget: budget,
      });
      setMinPrice(
        updated.priceRange.min !== null ? String(updated.priceRange.min) : '',
      );
      setMaxPrice(
        updated.priceRange.max !== null ? String(updated.priceRange.max) : '',
      );
      setMaxOutfitBudget(
        updated.maxOutfitBudget !== null ? String(updated.maxOutfitBudget) : '',
      );
      await refreshPreferences();
      toast('Preferencias actualizadas');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        handleError(err, 'Error guardando preferencias.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <section className="ed-section">
        <p className="mut">Cargando…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="ed-section" style={{ maxWidth: 560, margin: '12px auto', width: '100%' }}>
        <h1 className="ed-h1">Preferencias de presupuesto</h1>
        <div className="empty">
          <b>Inicia sesión para configurar tu rango de precios y presupuesto.</b>
          <div className="row2 center" style={{ marginTop: 12 }}>
            <Link href="/auth" className="btn pri">
              Ingresar
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const parsedBudget = toNullableCop(maxOutfitBudget);

  return (
    <section
      className="ed-section"
      style={{ maxWidth: 560, margin: '12px auto', width: '100%' }}
    >
      <h1 className="ed-h1">Preferencias de presupuesto</h1>
      <p className="mut">
        Define tu rango de precios por prenda y presupuesto máximo de outfit en
        COP. Deja un campo vacío para quitar ese límite.
      </p>

      {loading ? (
        <p className="mut">Cargando preferencias…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="small mut">Precio mínimo por prenda (COP)</span>
            <input
              type="number"
              min={0}
              step={5000}
              placeholder="Sin mínimo"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span className="small mut">Precio máximo por prenda (COP)</span>
            <input
              type="number"
              min={0}
              step={5000}
              placeholder="Sin máximo"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span className="small mut">
              Presupuesto máximo de outfit (
              {parsedBudget !== null ? formatCOP(parsedBudget) : 'sin límite'})
            </span>
            <input
              type="number"
              min={0}
              step={10000}
              placeholder="Sin límite"
              value={maxOutfitBudget}
              onChange={(e) => setMaxOutfitBudget(e.target.value)}
            />
          </label>

          {error && (
            <div className="warn" role="alert">
              {error}
            </div>
          )}

          <div className="row2" style={{ marginTop: 4 }}>
            <button type="submit" disabled={saving} className="btn pri">
              {saving ? 'Guardando…' : 'Guardar preferencias'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
