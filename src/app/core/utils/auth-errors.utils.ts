/**
 * Mapea errores de Supabase (GoTrue) a mensajes amigables en español.
 */
export function mapAuthError(error: any): string {
  if (!error) return 'Ocurrió un error de autenticación.';
  
  const message = error.message || '';
  
  // Errores comunes de Supabase Auth
  if (message.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  
  if (message.includes('missing email or phone')) {
    return 'Por favor, ingresa tu correo electrónico.';
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
  
  if (message.includes('Password should be at least 6 characters')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  
  if (message.includes('Rate limit exceeded')) {
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
