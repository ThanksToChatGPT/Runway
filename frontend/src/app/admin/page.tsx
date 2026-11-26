'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatUpdatedAt } from '@/domain/product';
import { api, ApiError } from '@/services/api';
import type { ScrapingResult, Store } from '@/types';

export default function AdminPage() {
  const { user, hydrated, toast, handleError } = useApp();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState('');

  // Crear tienda
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Editar tienda inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');

  // Scraping en curso / último resultado por tienda
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapeResults, setScrapeResults] = useState<
    Record<string, ScrapingResult>
  >({});

  const loadStores = useCallback(async () => {
    setLoading(true);
    setAccessError('');
    try {
      const res = await api.adminListStores();
      setStores(res.items);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setAccessError(err.message);
      } else {
        handleError(err, 'No se pudieron cargar las tiendas.');
      }
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (!hydrated || !user) return;
    loadStores();
  }, [hydrated, loadStores, user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.adminCreateStore({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        isActive,
      });
      setName('');
      setBaseUrl('');
      setIsActive(true);
      await loadStores();
      toast('Tienda registrada');
    } catch (err) {
      handleError(err, 'No se pudo registrar la tienda.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(store: Store) {
    setEditingId(store.id);
    setEditName(store.name);
    setEditBaseUrl(store.baseUrl);
  }

  async function handleUpdate(id: string) {
    try {
      const updated = await api.adminUpdateStore(id, {
        name: editName.trim(),
        baseUrl: editBaseUrl.trim(),
      });
      setStores((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
      toast('Tienda actualizada');
    } catch (err) {
      handleError(err, 'No se pudo actualizar la tienda.');
    }
  }

  async function handleToggleStatus(store: Store) {
    try {
      const updated = await api.adminSetStoreStatus(store.id, !store.isActive);
      setStores((prev) => prev.map((s) => (s.id === store.id ? updated : s)));
      toast(updated.isActive ? 'Tienda activada' : 'Tienda desactivada');
    } catch (err) {
      handleError(err, 'No se pudo cambiar el estado de la tienda.');
    }
  }

  async function handleScrape(store: Store) {
    setScrapingId(store.id);
    try {
      const result = await api.adminTriggerScrape(store.id);
      setScrapeResults((prev) => ({ ...prev, [store.id]: result }));
      if (result.status === 'success') {
        toast(result.message || 'Catálogo actualizado');
        await loadStores();
      } else {
        toast(result.message || 'El scraping falló');
      }
    } catch (err) {
      handleError(err, 'No se pudo ejecutar el scraping.');
    } finally {
      setScrapingId(null);
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
      <section className="ed-section">
        <h1 className="ed-h1">Panel Admin — Tiendas y Scraping</h1>
        <div className="empty">
          <b>Inicia sesión con una cuenta administradora.</b>
          <div className="row2 center" style={{ marginTop: 12 }}>
            <Link href="/auth" className="btn pri">
              Ingresar
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (accessError) {
    return (
      <section className="ed-section">
        <h1 className="ed-h1">Panel Admin — Tiendas y Scraping</h1>
        <div className="warn" role="alert">
          {accessError}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="ed-section">
        <h1 className="ed-h1">Panel Admin — Tiendas y Scraping</h1>

        <form onSubmit={handleCreate} className="row2" style={{ marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Nombre de tienda (ej. Tienda Bogotá)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: '1 1 200px' }}
          />
          <input
            type="url"
            placeholder="https://tienda-ejemplo.co"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
            style={{ flex: '2 1 260px' }}
          />
          <label className="row2" style={{ margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Activa</span>
          </label>
          <button type="submit" disabled={creating} className="btn pri">
            {creating ? 'Registrando…' : 'Registrar tienda'}
          </button>
        </form>

        {loading ? (
          <p className="mut">Cargando tiendas…</p>
        ) : stores.length === 0 ? (
          <div className="empty">No hay tiendas registradas todavía.</div>
        ) : (
          <ul className="list">
            {stores.map((store) => {
              const res = scrapeResults[store.id];
              const isEditing = editingId === store.id;
              return (
                <li
                  key={store.id}
                  style={{ display: 'grid', gap: 10, alignItems: 'stretch' }}
                >
                  {isEditing ? (
                    <div className="row2" style={{ margin: 0 }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Editar nombre"
                        style={{ flex: '1 1 180px' }}
                      />
                      <input
                        type="url"
                        value={editBaseUrl}
                        onChange={(e) => setEditBaseUrl(e.target.value)}
                        aria-label="Editar URL"
                        style={{ flex: '2 1 240px' }}
                      />
                      <button
                        type="button"
                        className="btn pri"
                        onClick={() => handleUpdate(store.id)}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div
                      className="row2"
                      style={{ justifyContent: 'space-between', margin: 0 }}
                    >
                      <div>
                        <b>{store.name}</b>{' '}
                        <span
                          className="small"
                          style={{
                            color: store.isActive ? 'var(--ok)' : 'var(--warn)',
                            fontWeight: 700,
                          }}
                        >
                          · {store.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                        <div className="small mut">
                          {store.baseUrl} · Último scraping:{' '}
                          {formatUpdatedAt(store.lastScrapedAt)}
                        </div>
                      </div>

                      <div className="row2" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className="mini"
                          onClick={() => startEdit(store)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="mini"
                          onClick={() => handleToggleStatus(store)}
                        >
                          {store.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="mini pri"
                          disabled={!store.isActive || scrapingId === store.id}
                          onClick={() => handleScrape(store)}
                        >
                          {scrapingId === store.id
                            ? 'Extrayendo…'
                            : 'Ejecutar scraping'}
                        </button>
                      </div>
                    </div>
                  )}

                  {res && (
                    <div
                      className={
                        res.status === 'success' ? 'matchnote ok' : 'warn'
                      }
                      style={{ margin: 0 }}
                    >
                      <div>
                        <b>
                          {res.status === 'success'
                            ? 'Scraping completado:'
                            : 'Scraping fallido:'}
                        </b>{' '}
                        {res.message || '—'}
                      </div>
                      <div className="small">
                        Recibidos: {res.receivedCount} · Nuevos:{' '}
                        {res.insertedCount} · Actualizados: {res.updatedCount} ·
                        Descartados: {res.discardedCount}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
