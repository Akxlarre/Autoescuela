import { PASSWORD_MIN_LENGTH } from './password-policy.utils';

/**
 * Largo mínimo de contraseña. Vive en la regla única de `password-policy.utils.ts` (spec 0050-b);
 * se re-exporta acá porque este era su lugar desde hotfix-059-b.
 */
export { PASSWORD_MIN_LENGTH };

/** Motivos con los que Supabase Auth rechaza una clave débil (`AuthWeakPasswordError.reasons`). */
const WEAK_PASSWORD_REASONS: Record<string, string> = {
  length: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  characters: 'La contraseña debe tener letras y números.',
  pwned: 'Esa contraseña apareció en filtraciones de datos conocidas. Elige otra.',
};

/**
 * Mapea errores de Supabase (GoTrue) a mensajes amigables en español.
 */
export function mapAuthError(error: any): string {
  if (!error) return 'Ocurrió un error de autenticación.';

  const message = error.message || '';

  // Errores de red (sin conexión a internet). El SDK de Supabase envuelve los
  // fallos de fetch en AuthRetryableFetchError, con mensajes que varían según
  // navegador/entorno ("Failed to fetch", "fetch failed", "NetworkError", "Load failed").
  if (
    error.name === 'AuthRetryableFetchError' ||
    message.includes('Failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  ) {
    return 'Sin conexión a internet. Verifica tu red e intenta de nuevo.';
  }

  // Errores comunes de Supabase Auth
  if (message.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }

  if (message.includes('missing email or phone')) {
    return 'Por favor, ingresa tu correo electrónico.';
  }

  // Cuenta baneada en Auth: el admin la desactivó (fix-180-b).
  if (message.includes('User is banned')) {
    return 'Tu cuenta está desactivada. Contacta al administrador.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }

  if (message.includes('User not found')) {
    return 'No se encontró ningún usuario con ese correo.';
  }

  if (message.includes('User already registered')) {
    return 'Este correo ya está registrado.';
  }

  // Clave débil rechazada por el servidor (spec 0050-b, AC7): se dice qué le falta.
  if (error.code === 'weak_password' || error.name === 'AuthWeakPasswordError') {
    const reasons: string[] = Array.isArray(error.reasons) ? error.reasons : [];
    const known = reasons.map((r) => WEAK_PASSWORD_REASONS[r]).filter(Boolean);
    return known.length > 0
      ? known.join(' ')
      : `Esa contraseña es demasiado débil. Usa al menos ${PASSWORD_MIN_LENGTH} caracteres, con letras y números.`;
  }

  // Supabase informa el mínimo configurado en el proyecto ("at least 8 characters").
  const minLength = message.match(/Password should be at least (\d+) characters/);
  if (minLength) {
    return `La contraseña debe tener al menos ${minLength[1]} caracteres.`;
  }

  // hotfix-089-b: Supabase responde "Request rate limit reached" (login) o "email rate limit
  // exceeded" (correos); antes solo se reconocía "Rate limit exceeded" y caían en el genérico.
  if (
    error.code === 'over_request_rate_limit' ||
    error.code === 'over_email_send_rate_limit' ||
    /rate limit/i.test(message)
  ) {
    return 'Demasiados intentos. Por favor, intenta de nuevo más tarde.';
  }

  if (message.includes('New password should be different from the old password')) {
    return 'La nueva contraseña debe ser diferente a la anterior.';
  }

  if (message.includes('Database error saving new user')) {
    return 'Error al guardar el usuario. Por favor, contacta a soporte.';
  }

  // Si no se reconoce el error, devolver una traducción genérica o el mensaje original
  // si estamos en desarrollo, pero en este caso mejor algo seguro para el usuario.
  console.warn('Unhandled Auth Error:', message);

  // Algunos errores específicos de la lógica de negocio del proyecto
  if (message.includes('Password updated but login flag failed')) {
    return 'Contraseña actualizada, pero hubo un error al sincronizar. Por favor, contacta al administrador.';
  }

  return 'Error de autenticación. Por favor, verifica tus datos e intenta de nuevo.';
}
