/**
 * Express 4 no captura promesas rechazadas: este envoltorio manda cualquier
 * error de un controlador `async` al `errorHandler` centralizado.
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
