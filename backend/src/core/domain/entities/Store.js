import { optionalDate, requireHttpUrl, requireText } from '../guards.js';

export class Store {
  constructor({ id = null, name, baseUrl, isActive = true, lastScrapedAt = null }) {
    this.id = id;
    this.name = Store.#validateName(name);
    this.baseUrl = Store.#validateBaseUrl(baseUrl);
    this.isActive = Boolean(isActive);
    this.lastScrapedAt = optionalDate(lastScrapedAt, 'La fecha de actualización de la tienda no es válida.', 'lastScrapedAt');
  }

  static #validateName(name) {
    return requireText(name, 'El nombre de la tienda es obligatorio.', 'name', { maxLength: 120 });
  }

  static #validateBaseUrl(baseUrl) {
    return requireHttpUrl(baseUrl, 'La dirección web de la tienda no es válida.', 'baseUrl');
  }

  activate() {
    this.isActive = true;
    return this;
  }

  deactivate() {
    this.isActive = false;
    return this;
  }

  updateDetails({ name, baseUrl } = {}) {
    // Se valida todo antes de asignar para no dejar la tienda a medio actualizar.
    const nextName = name !== undefined ? Store.#validateName(name) : this.name;
    const nextBaseUrl = baseUrl !== undefined ? Store.#validateBaseUrl(baseUrl) : this.baseUrl;
    this.name = nextName;
    this.baseUrl = nextBaseUrl;
    return this;
  }

  markScraped(at = new Date()) {
    this.lastScrapedAt = optionalDate(at, 'La fecha de actualización de la tienda no es válida.', 'lastScrapedAt');
    return this;
  }
}
