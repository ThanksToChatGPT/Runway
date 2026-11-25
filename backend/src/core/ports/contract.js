/**
 * Utilidades mínimas para definir puertos como clases base en JavaScript.
 *
 * Un puerto es una clase cuyos métodos lanzan "no implementado". Un adaptador
 * puede extender la clase o ser un objeto plano con los mismos métodos
 * (duck typing); `assertImplements` verifica ambos casos al arrancar la app.
 */

/**
 * Lanza el error estándar de método no implementado.
 * Es un error de programación (no un `DomainError`): nunca debe llegar al usuario.
 * @param {string} portName
 * @param {string} methodName
 * @returns {never}
 */
export function notImplemented(portName, methodName) {
  throw new Error(`${portName}.${methodName}() no está implementado por el adaptador.`);
}

/**
 * Nombres de los métodos que define un puerto (los de su prototipo).
 * @param {Function} PortClass
 * @returns {string[]}
 */
export function getPortMethods(PortClass) {
  return Object.getOwnPropertyNames(PortClass.prototype).filter(
    (name) => name !== 'constructor' && typeof PortClass.prototype[name] === 'function',
  );
}

/**
 * Verifica que `implementation` tenga todos los métodos del puerto y que no
 * sean los métodos base sin implementar. Pensado para la raíz de composición
 * (`index.js`) y para los tests: falla rápido si falta algo.
 *
 * @template T
 * @param {T} implementation
 * @param {Function} PortClass
 * @returns {T} la misma implementación, para poder encadenar.
 */
export function assertImplements(implementation, PortClass) {
  const missing = getPortMethods(PortClass).filter((name) => {
    const method = implementation?.[name];
    return typeof method !== 'function' || method === PortClass.prototype[name];
  });
  if (missing.length > 0) {
    throw new Error(`La implementación de ${PortClass.name} no define: ${missing.join(', ')}.`);
  }
  return implementation;
}
