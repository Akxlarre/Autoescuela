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

  it.each([
    [{ code: 'over_request_rate_limit', message: 'Request rate limit reached' }],
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }],
    [{ message: 'Rate limit exceeded' }],
  ])('A15 (hotfix-089-b): demasiados intentos → mensaje claro (%o)', (error) => {
    expect(mapAuthError(error)).toBe('Demasiados intentos. Por favor, intenta de nuevo más tarde.');
  });

  it('devuelve el fallback genérico para errores no reconocidos', () => {
    const error = { message: 'Something totally unexpected' };
    expect(mapAuthError(error)).toBe(
      'Error de autenticación. Por favor, verifica tus datos e intenta de nuevo.',
    );
  });

  it('PASSWORD_MIN_LENGTH = 10, igual que password_min_length de Supabase Auth (spec 0050-b)', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  describe('clave débil rechazada por Auth (spec 0050-b, AC7)', () => {
    const weak = (reasons: string[], message = 'Password is too weak') => ({
      name: 'AuthWeakPasswordError',
      code: 'weak_password',
      message,
      reasons,
    });

    it('filtrada en brechas conocidas', () => {
      expect(mapAuthError(weak(['pwned']))).toBe(
        'Esa contraseña apareció en filtraciones de datos conocidas. Elige otra.',
      );
    });

    it('le faltan letras o números', () => {
      expect(mapAuthError(weak(['characters']))).toBe('La contraseña debe tener letras y números.');
    });

    it('muy corta: usa el mínimo de la app', () => {
      expect(mapAuthError(weak(['length']))).toBe(
        'La contraseña debe tener al menos 10 caracteres.',
      );
    });

    it('varios motivos: se nombran todos', () => {
      expect(mapAuthError(weak(['length', 'characters']))).toBe(
        'La contraseña debe tener al menos 10 caracteres. La contraseña debe tener letras y números.',
      );
    });

    it('sin motivos reconocibles: mensaje general de clave débil', () => {
      expect(mapAuthError(weak([]))).toBe(
        'Esa contraseña es demasiado débil. Usa al menos 10 caracteres, con letras y números.',
      );
    });
  });

  it('"at least 8 characters" de Supabase → mensaje en español con el número real', () => {
    expect(mapAuthError({ message: 'Password should be at least 8 characters.' })).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });
});
