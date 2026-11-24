import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import App from './ui/App.jsx';
import {AppProvider} from './ui/AppContext.jsx';
import {useCases, whenReady, apiBase, dataSource} from './infrastructure/container.js'; // única vía por la que la UI conoce los adaptadores
import './ui/styles.css';

// Se espera a saber qué fuente de datos hay (API viva / snapshot / demo) antes de pintar:
// así el catálogo carga ya con datos reales y el indicador muestra la fuente correcta.
whenReady.then(u => createRoot(document.getElementById('root')).render(
  <HashRouter><AppProvider useCases={u} source={dataSource} apiBase={apiBase}><App/></AppProvider></HashRouter>));
