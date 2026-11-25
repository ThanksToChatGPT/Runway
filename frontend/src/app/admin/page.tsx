'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Store } from '@/types';

export default function AdminPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState('');

  async function loadStores() {
    try {
      const res = await api.adminListStores();
      setStores(res.items);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Acceso restringido a administradores');
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    try {
      await api.adminCreateStore({ name, slug, base_url: baseUrl });
      setName('');
      setSlug('');
      setBaseUrl('');
      await loadStores();
      setStatus('Tienda creada.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Error creando tienda');
    }
  }

  async function handleScrape(id: string) {
    setStatus('Ejecutando scraping...');
    try {
      const res = await api.adminTriggerScrape(id);
      setStatus(`Scraping completado: ${res.importedCount} productos importados.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Error ejecutando scraping');
    }
  }

  async function handleDelete(id: string) {
    await api.adminDeleteStore(id);
    await loadStores();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel Admin — Tiendas y Scraping</h1>

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-4"
      >
        <input
          type="text"
          placeholder="Nombre de tienda"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
          required
        />
        <input
          type="text"
          placeholder="Slug (ej. mock)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
          required
        />
        <input
          type="url"
          placeholder="https://tienda-ejemplo.co"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Agregar tienda
        </button>
      </form>

      {status && <p className="text-sm text-gray-700">{status}</p>}

      <div className="space-y-3">
        {stores.map((store) => (
          <div
            key={store.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-semibold text-gray-900">
                {store.name} <span className="text-xs text-gray-500">({store.slug})</span>
              </p>
              <p className="text-xs text-gray-500">{store.base_url}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleScrape(store.id)}
                className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Ejecutar scraping
              </button>
              <button
                onClick={() => handleDelete(store.id)}
                className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
