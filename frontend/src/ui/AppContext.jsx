// Estado de la sesión de uso (outfit activo, comparador, filtros, favoritos). La UI SOLO habla con los casos de uso y el dominio.
import {createContext, useContext, useState, useRef, useCallback} from 'react';
import {emptyOutfit, addPiece, removePiece, toggleLock, setMode, LockedSlotError} from '../domain/outfit.js';
import {createHistory, commit, undo, redo} from '../domain/history.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const DEFAULT_FILTERS = {query: '', stores: null, category: 'all', sort: '', maxPrice: 300000, colors: null, materials: null};

// Favoritos (US-63) persistentes en localStorage; el usuario demo basta para leerlos.
const FAV_KEY = 'ob_favs';
const readFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } };

export function AppProvider({useCases, source = {kind: 'demo'}, apiBase = '', children}) {
  const [hist, setHist] = useState(() => createHistory(emptyOutfit()));
  const [user, setUser] = useState(useCases.currentUser());
  const [cmp, setCmp] = useState([]);
  const [budget, setBudget] = useState(250000);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [favs, setFavs] = useState(readFavs);
  const [msg, setMsg] = useState('');
  const timer = useRef();
  const toast = useCallback(m => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 2800); }, []);

  // Cada acción es un "comando": calcula el nuevo outfit con el dominio y lo registra en el historial.
  const run = (fn, ok) => {
    try { setHist(commit(hist, fn(hist.present))); if (ok) toast(ok); }
    catch (e) { if (e instanceof LockedSlotError) toast('Esa pieza está bloqueada. Desbloquéala para cambiarla.'); else throw e; }
  };
  const toggleFav = id => setFavs(f => {
    const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    toast(next.includes(id) ? 'Agregado a favoritos' : 'Quitado de favoritos');
    return next;
  });
  const value = {
    useCases, toast, user, source, apiBase, filters, setFilters, budget, setBudget, cmp, favs, toggleFav,
    outfit: hist.present, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0,
    add: p => run(o => addPiece(o, p), `${p.name} agregada al outfit`),
    remove: slot => run(o => removePiece(o, slot)),
    lock: slot => run(o => toggleLock(o, slot)),
    mode: m => run(o => setMode(o, m)),
    load: saved => run(() => ({mode: saved.mode, items: saved.items, locked: []}), `Outfit “${saved.name}” cargado`),
    undo: () => setHist(undo(hist)), redo: () => setHist(redo(hist)),
    toggleCmp: id => setCmp(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]),
    login: async () => { setUser(await useCases.login()); toast('Sesión iniciada (demo)'); },
    logout: async () => { await useCases.logout(); setUser(null); toast('Sesión cerrada'); },
    // Traduce errores de aplicación a mensajes en español (RNF-11).
    handle: e => toast({AUTH_REQUIRED: 'Inicia sesión o regístrate para guardar.', NAME_REQUIRED: 'Ponle un nombre al outfit.'}[e.message] || 'Ocurrió un error. Intenta de nuevo.')
  };
  return <Ctx.Provider value={value}>{children}<div className={'toast' + (msg ? ' on' : '')} role="status" aria-live="polite">{msg}</div></Ctx.Provider>;
}
