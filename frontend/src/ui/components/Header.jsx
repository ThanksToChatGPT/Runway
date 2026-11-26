import {NavLink} from 'react-router-dom';
import {useApp} from '../AppContext.jsx';
export default function Header() {
  const {user, login, logout, cmp} = useApp();
  return <header>
    <div className="logo"><b>OB</b>Outfit Builder</div>
    <nav aria-label="Principal">
      <NavLink to="/" end>Catálogo</NavLink>
      <NavLink to="/constructor">Constructor</NavLink>
      <NavLink to="/comparar">Comparar ({cmp.length})</NavLink>
      <NavLink to="/guardados">Mis outfits</NavLink>
    </nav>
    <span className="sp"/>
    <span className="chip">Precios en COP</span>
    <button className="chip" onClick={user ? logout : login}>{user ? `${user.name} · Salir` : 'Ingresar'}</button>
  </header>;
}
