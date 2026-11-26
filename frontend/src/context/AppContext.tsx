'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createHistory,
  commit,
  redo as historyRedo,
  undo as historyUndo,
  type HistoryState,
} from '@/domain/history';
import {
  addPiece,
  emptyOutfit,
  fromSavedOutfit,
  LockedSlotError,
  removePiece,
  setDraftName,
  toggleLock,
  toPiecesPayload,
  type OutfitDraft,
} from '@/domain/outfit';
import {
  api,
  ApiError,
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  setAuthSession,
} from '@/services/api';
import type {
  AuthSession,
  Category,
  Outfit,
  OutfitBudget,
  OutfitItem,
  PriceSort,
  User,
} from '@/types';

export interface CatalogFilters {
  q: string;
  category: Category | '';
  sort: PriceSort | '';
  includeStores: string[];
  excludeStores: string[];
  colors: string[];
  sizes: string[];
  brands: string[];
  minPrice: string;
  maxPrice: number | null;
  usePreferences: boolean;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  sort: '',
  includeStores: [],
  excludeStores: [],
  colors: [],
  sizes: [],
  brands: [],
  minPrice: '',
  maxPrice: null,
  usePreferences: false,
};

const FAV_KEY = 'ob_favs';
const CMP_KEY = 'ob_compare_ids';
const DRAFT_KEY = 'ob_draft';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface AppContextValue {
  user: User | null;
  hydrated: boolean;
  filters: CatalogFilters;
  setFilters: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  budget: number | null;
  setBudget: (value: number | null) => void;
  serverBudget: OutfitBudget | null;
  refreshPreferences: () => Promise<void>;
  cmp: string[];
  toggleCmp: (id: string) => void;
  clearCmp: () => void;
  favs: string[];
  toggleFav: (id: string) => void;
  outfit: OutfitDraft;
  canUndo: boolean;
  canRedo: boolean;
  add: (item: OutfitItem) => void;
  remove: (slot: Category) => void;
  lock: (slot: Category) => void;
  renameDraft: (name: string) => void;
  loadSavedOutfit: (saved: Outfit) => void;
  clearDraft: () => void;
  undo: () => void;
  redo: () => void;
  toast: (message: string) => void;
  applySession: (session: AuthSession) => void;
  logout: () => Promise<void>;
  handleError: (error: unknown, fallback?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp debe usarse dentro de AppProvider');
  }
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hist, setHist] = useState<HistoryState<OutfitDraft>>(() =>
    createHistory(emptyOutfit()),
  );
  const [cmp, setCmp] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [budget, setBudgetState] = useState<number | null>(null);
  const [serverBudget, setServerBudget] = useState<OutfitBudget | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);
  const [msg, setMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const histRef = useRef(hist);
  histRef.current = hist;

  const toast = useCallback((message: string) => {
    setMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMsg(''), 3200);
  }, []);

  const clearExpiredSession = useCallback(
    (notify = false) => {
      clearAuthSession();
      setUser(null);
      setBudgetState(null);
      setServerBudget(null);
      if (notify) {
        toast('Tu sesión expiró. Inicia sesión de nuevo.');
      }
    },
    [toast],
  );

  const refreshPreferences = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const prefs = await api.getPreferences();
      setBudgetState(prefs.maxOutfitBudget);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearExpiredSession(false);
      }
    }
  }, [clearExpiredSession]);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    setCmp(readJson<string[]>(CMP_KEY, []).slice(0, 4));
    setFavs(readJson<string[]>(FAV_KEY, []));
    const savedDraft = readJson<OutfitDraft | null>(DRAFT_KEY, null);
    if (savedDraft && savedDraft.items) {
      setHist(createHistory(savedDraft));
    }
    if (storedUser && storedToken) {
      setUser(storedUser);
      api
        .getPreferences()
        .then((prefs) => setBudgetState(prefs.maxOutfitBudget))
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            clearExpiredSession(false);
          }
        });
    }
    setHydrated(true);
  }, [clearExpiredSession]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(hist.present));
    } catch {
      // Ignora cuotas de almacenamiento llenas.
    }
  }, [hydrated, hist.present]);

  const runDraftAction = useCallback(
    (fn: (current: OutfitDraft) => OutfitDraft, okMessage?: string): OutfitDraft | null => {
      try {
        const next = fn(histRef.current.present);
        setHist((prev) => commit(prev, fn(prev.present)));
        if (okMessage) toast(okMessage);
        return next;
      } catch (err) {
        if (err instanceof LockedSlotError) {
          toast('Esa pieza está bloqueada. Desbloquéala para cambiarla.');
          return null;
        }
        throw err;
      }
    },
    [toast],
  );

  const add = useCallback(
    (item: OutfitItem) => {
      const prevDraft = histRef.current.present;
      const next = runDraftAction(
        (current) => addPiece(current, item),
        `${item.name} agregada al outfit`,
      );
      if (!next) return;

      if (getStoredToken()) {
        api
          .assignDraftPiece({
            draft: {
              name: prevDraft.name || undefined,
              pieces: toPiecesPayload(prevDraft),
            },
            slotType: item.category,
            productId: item.id,
          })
          .then((res) => setServerBudget(res.budget))
          .catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              clearExpiredSession(true);
            }
          });
      }
    },
    [clearExpiredSession, runDraftAction],
  );

  const remove = useCallback(
    (slot: Category) => {
      setServerBudget(null);
      runDraftAction((current) => removePiece(current, slot));
    },
    [runDraftAction],
  );

  const lock = useCallback(
    (slot: Category) => {
      runDraftAction((current) => toggleLock(current, slot));
    },
    [runDraftAction],
  );

  const renameDraft = useCallback((name: string) => {
    setHist((prev) => ({
      ...prev,
      present: setDraftName(prev.present, name),
    }));
  }, []);

  const loadSavedOutfit = useCallback(
    (saved: Outfit) => {
      setServerBudget(saved.budget);
      runDraftAction(
        () => fromSavedOutfit(saved),
        `Outfit “${saved.name}” cargado`,
      );
    },
    [runDraftAction],
  );

  const clearDraft = useCallback(() => {
    setServerBudget(null);
    runDraftAction(() => emptyOutfit(), 'Borrador reiniciado');
  }, [runDraftAction]);

  const undo = useCallback(() => {
    setServerBudget(null);
    setHist((prev) => historyUndo(prev));
  }, []);

  const redo = useCallback(() => {
    setServerBudget(null);
    setHist((prev) => historyRedo(prev));
  }, []);

  const toggleCmp = useCallback(
    (id: string) => {
      setCmp((prev) => {
        if (prev.includes(id)) {
          const next = prev.filter((item) => item !== id);
          localStorage.setItem(CMP_KEY, JSON.stringify(next));
          return next;
        }
        if (prev.length >= 4) {
          toast('Puedes comparar hasta 4 prendas al tiempo.');
          return prev;
        }
        const next = [...prev, id];
        localStorage.setItem(CMP_KEY, JSON.stringify(next));
        toast(`Agregado al comparador (${next.length}/4)`);
        return next;
      });
    },
    [toast],
  );

  const clearCmp = useCallback(() => {
    localStorage.setItem(CMP_KEY, '[]');
    setCmp([]);
  }, []);

  const toggleFav = useCallback(
    (id: string) => {
      setFavs((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
        toast(exists ? 'Quitado de favoritos' : 'Agregado a favoritos');
        return next;
      });
    },
    [toast],
  );

  const setBudget = useCallback((value: number | null) => {
    setServerBudget(null);
    setBudgetState(value);
  }, []);

  const applySession = useCallback(
    (session: AuthSession) => {
      setAuthSession(session.accessToken, session.user);
      setUser(session.user);
      refreshPreferences();
    },
    [refreshPreferences],
  );

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await api.logout();
      }
    } catch {
      // Si el token ya expiró, igual cerramos la sesión local.
    } finally {
      clearAuthSession();
      setUser(null);
      setBudgetState(null);
      setServerBudget(null);
      setFilters((prev) => ({ ...prev, usePreferences: false }));
      toast('Sesión cerrada');
    }
  }, [toast]);

  const handleError = useCallback(
    (error: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.') => {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          clearExpiredSession(true);
          return;
        }
        toast(error.message);
        return;
      }
      if (error instanceof Error && error.message) {
        toast(error.message);
        return;
      }
      toast(fallback);
    },
    [clearExpiredSession, toast],
  );

  return (
    <AppContext.Provider
      value={{
        user,
        hydrated,
        filters,
        setFilters,
        budget,
        setBudget,
        serverBudget,
        refreshPreferences,
        cmp,
        toggleCmp,
        clearCmp,
        favs,
        toggleFav,
        outfit: hist.present,
        canUndo: hist.past.length > 0,
        canRedo: hist.future.length > 0,
        add,
        remove,
        lock,
        renameDraft,
        loadSavedOutfit,
        clearDraft,
        undo,
        redo,
        toast,
        applySession,
        logout,
        handleError,
      }}
    >
      {children}
      <div
        className={'toast' + (msg ? ' on' : '')}
        role="status"
        aria-live="polite"
      >
        {msg}
      </div>
    </AppContext.Provider>
  );
}
