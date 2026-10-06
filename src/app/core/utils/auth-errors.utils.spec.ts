import { mapAuthError, PASSWORD_MIN_LENGTH } from './auth-errors.utils';

describe('mapAuthError', () => {
  it('detecta error de red por name AuthRetryableFetchError', () => {
    const error = { name: 'AuthRetryableFetchError', message: 'fetch failed' };
    expect(mapAuthError(error)).toBe(
      'Sin conexión a internet. Verifica tu red e intenta de nuevo.',
    );
  });

  it('detecta error de red por mensaje "Failed to fetch"', () => {
    const error = { message: 'Failed to fetch' };
    expect(mapAuthError(error)).toBe(
      'Sin conexión a internet. Verifica tu red e intenta de nuevo.',
    );
  });

  it('sigue mapeando credenciales inválidas correctamente (no regresión)', () => {
    const error = { message: 'Invalid login credentials' };
    expect(mapAuthError(error)).toBe('Correo o contraseña incorrectos.');
  });

  it('cuenta baneada (desactivada por el admin) → mensaje de cuenta desactivada (fix-180-b)', () => {
    const error = { message: 'User is banned' };
    expect(mapAuthError(error)).toBe('Tu cuenta está desactivada. Contacta al administrador.');
  });

  it('devuelve el fallback genérico para errores no reconocidos', () => {
    const error = { message: 'Something totally unexpected' };
    expect(mapAuthError(error)).toBe(
      'Error de autenticación. Por favor, verifica tus datos e intenta de nuevo.',
    );
  });

  it('PASSWORD_MIN_LENGTH = 8, igual que password_min_length de Supabase Auth (hotfix-059-b)', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('"at least 8 characters" de Supabase → mensaje en español con el número real', () => {
    expect(mapAuthError({ message: 'Password should be at least 8 characters.' })).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });
});
