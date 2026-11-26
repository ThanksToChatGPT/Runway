import {MODES} from '../../domain/outfit.js';
import {CATEGORIES} from '../../domain/product.js';
// Pasarela tipo lookbook: cada pieza se muestra como una foto completa (las fotos del scraper son
// planos de producto reales; recortarlas a una silueta las destruiría). Ranura vacía = marco punteado.
const ICONS = {top:'👕',bottom:'👖',full:'👗',outer:'🧥',shoes:'👟',acc:'🧢'};
export default function Runway({outfit, active, onSlot, zoom = 1}) {
  const slots = MODES[outfit.mode].slots;
  return <div className="runway">
    <div className="rail" style={{fontSize: zoom + 'em'}}>
      {slots.map(k => {
        const p = outfit.items[k];
        return <button type="button" key={k}
          className={'piece' + (active === k ? ' act' : '') + (p ? '' : ' empty')}
          aria-pressed={active === k}
          aria-label={`${CATEGORIES[k]}: ${p ? p.name : 'vacío'}. Toca para ver opciones.`}
          onClick={() => onSlot(k)}>
          {p
            ? <>
                {p.images[0]
                  ? <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async"/>
                  : <span className="ph box" style={{background: p.color}}>{ICONS[k]}</span>}
                {outfit.locked.includes(k) && <span className="lck" title="Pieza bloqueada">🔒</span>}
                <span className="cap"><b>{p.name}</b><small>{p.colorName}</small></span>
              </>
            : <span className="ph">{ICONS[k]}<b>{CATEGORIES[k]}</b></span>}
        </button>;
      })}
    </div>
    <p className="railhint mut small">{MODES[outfit.mode].label} · toca una pieza para cambiarla</p>
  </div>;
}
