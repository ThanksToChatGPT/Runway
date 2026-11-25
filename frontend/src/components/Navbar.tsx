'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearAuthSession, getStoredUser } from '@/services/api';
import type { User } from '@/types';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function handleLogout() {
    clearAuthSession();
    setUser(null);
    window.location.href = '/auth';
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
          Outfit Builder
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-gray-900">
            Catálogo
          </Link>
          <Link href="/builder" className="hover:text-gray-900">
            Outfit Builder
          </Link>
          <Link href="/compare" className="hover:text-gray-900">
            Comparar
          </Link>
          <Link href="/outfits" className="hover:text-gray-900">
            Mis Outfits
          </Link>
          <Link href="/preferences" className="hover:text-gray-900">
            Preferencias
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin" className="text-indigo-600 hover:text-indigo-800">
              Admin
            </Link>
          )}
          {user ? (
            <button
              onClick={handleLogout}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-800 hover:bg-gray-200"
            >
              Salir ({user.name})
            </button>
          ) : (
            <Link
              href="/auth"
              className="rounded-md bg-gray-900 px-3 py-1.5 text-white hover:bg-gray-800"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
