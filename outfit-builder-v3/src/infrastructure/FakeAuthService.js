// Sesión simulada. Sustituir por un adaptador real (JWT / Google OAuth) sin tocar dominio ni UI.
export class FakeAuthService {
  #user = null;
  currentUser() { return this.#user; }
  async login() { this.#user = {id: 'u-demo', name: 'Usuario demo', role: 'user'}; return this.#user; }
  async logout() { this.#user = null; }
}
