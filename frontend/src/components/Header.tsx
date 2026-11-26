'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, cmp, logout } = useApp();

  function navClass(href: string) {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return active ? 'active' : undefined;
  }

  async function handleLogout() {
    await logout();
    router.push('/auth');
  }

  return (
    <header className="ed-header">
      <Link href="/" className="ed-logo">
        <b>OB</b>
        <span>Outfit Builder</span>
      </Link>

      <nav className="ed-nav" aria-label="Principal">
        <Link href="/" className={navClass('/')}>
          Catálogo
        </Link>
        <Link href="/builder" className={navClass('/builder')}>
          Constructor
        </Link>
        <Link href="/compare" className={navClass('/compare')}>
          Comparar ({cmp.length})
        </Link>
        <Link href="/outfits" className={navClass('/outfits')}>
          Mis outfits
        </Link>
        <Link href="/preferences" className={navClass('/preferences')}>
          Preferencias
        </Link>
        {user?.role === 'admin' && (
          <Link href="/admin" className={navClass('/admin')}>
            Admin
          </Link>
        )}
      </nav>

      <span className="sp" />

      <span className="chip chip-static">Precios en COP</span>
      {user ? (
        <button type="button" className="chip" onClick={handleLogout}>
          {user.name} · Salir
        </button>
      ) : (
        <Link href="/auth" className="chip">
          Ingresar
        </Link>
      )}
    </header>
  );
}
