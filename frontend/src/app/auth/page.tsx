'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/services/api';

export default function AuthPage() {
  const router = useRouter();
  const { applySession, toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('CO');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session =
        mode === 'login'
          ? await api.login({ email: email.trim(), password })
          : await api.register({
              name: name.trim(),
              email: email.trim(),
              password,
              country: country.trim() || null,
            });

      applySession(session);
      toast(
        mode === 'login'
          ? `¡Bienvenido de nuevo, ${session.user.name}!`
          : `Cuenta creada. ¡Hola, ${session.user.name}!`,
      );
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ed-section" style={{ maxWidth: 460, margin: '12px auto', width: '100%' }}>
      <h1 className="ed-h1">
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>

      <div className="row2" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          aria-pressed={mode === 'login'}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          className="btn"
          style={{ flex: 1 }}
          aria-pressed={mode === 'register'}
          onClick={() => {
            setMode('register');
            setError('');
          }}
        >
          Registrarse
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        {mode === 'register' && (
          <>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="small mut">Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Laura Gómez"
                required
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="small mut">País (opcional)</span>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="CO"
              />
            </label>
          </>
        )}

        <label style={{ display: 'grid', gap: 4 }}>
          <span className="small mut">Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="laura@example.com"
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span className="small mut">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={72}
            required
          />
          {mode === 'register' && (
            <span className="small mut">
              Mínimo 8 caracteres, incluyendo al menos una letra y un número.
            </span>
          )}
        </label>

        {error && (
          <div className="warn" role="alert">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn pri">
          {loading
            ? 'Procesando…'
            : mode === 'login'
              ? 'Entrar'
              : 'Crear cuenta'}
        </button>
      </form>
    </section>
  );
}
