import {Routes, Route, Navigate} from 'react-router-dom';
import Header from './components/Header.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import BuilderPage from './pages/BuilderPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import SavedPage from './pages/SavedPage.jsx';
import {useApp} from './AppContext.jsx';
export default function App() {
  const {source, apiBase} = useApp();
  return <>
    <Header/>
    {source.kind !== 'live' && <div className={'offline' + (source.kind === 'snapshot' ? ' soft' : '')} role="status">
      {source.kind === 'snapshot'
        ? <><b>Catálogo real sin conexión.</b> Datos recolectados por el scraper
          {source.exportedAt ? ` (exportados: ${new Date(source.exportedAt).toLocaleDateString('es-CO')})` : ''}.
          Para precios al día y recolección automática corre <code>python -m outfit_scraper serve --every 24</code> y recarga.</>
        : <><b>Modo demo.</b> No hay scraper en <code>{apiBase}</code> ni snapshot disponible.
          Corre <code>python -m outfit_scraper run</code> y <code>python -m outfit_scraper export</code> para generar el catálogo real.</>}
    </div>}
    <main className="page">
      <Routes>
        <Route path="/" element={<CatalogPage/>}/>
        <Route path="/producto/:id" element={<ProductPage/>}/>
        <Route path="/constructor" element={<BuilderPage/>}/>
        <Route path="/comparar" element={<ComparePage/>}/>
        <Route path="/guardados" element={<SavedPage/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </main>
    <footer>Esta plataforma compara y organiza; compras, pagos y envíos se hacen en cada tienda. Precios y tallas pueden cambiar tras su recolección; “≈” marca precios convertidos a COP de forma estimada. Las marcas e imágenes pertenecen a sus dueños.</footer>
  </>;
}
