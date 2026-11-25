const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput({ email, password, name }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();
  const rawPassword = String(password || '');

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('El correo electrónico no es válido');
  }
  if (normalizedName.length < 2) {
    throw new Error('El nombre debe tener al menos 2 caracteres');
  }
  if (rawPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }

  return {
    email: normalizedEmail,
    name: normalizedName,
    password: rawPassword,
  };
}

export function validateLoginInput({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!EMAIL_REGEX.test(normalizedEmail) || !rawPassword) {
    throw new Error('Credenciales inválidas');
  }

  return {
    email: normalizedEmail,
    password: rawPassword,
  };
}
