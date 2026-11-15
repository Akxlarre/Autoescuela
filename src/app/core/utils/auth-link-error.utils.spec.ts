import {
  authLinkErrorFromUrl,
  authLinkErrorMessage,
  authLinkErrorSessionNotice,
} from './auth-link-error.utils';

// fix-181-b (F6, D07): Supabase devuelve el error de un enlace vencido o ya usado en la URL de
// vuelta (`redirect_to`), en el fragmento (flujo implícito) o en la query (PKCE).
describe('authLinkErrorFromUrl', () => {
  it('enlace vencido o ya usado (otp_expired en el fragmento) → vencido', () => {
    const hash =
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(authLinkErrorFromUrl(hash, '')).toBe('vencido');
  });

  it('otp_expired en la query (flujo PKCE) → vencido', () => {
    expect(authLinkErrorFromUrl('', '?error=access_denied&error_code=otp_expired')).toBe('vencido');
  });

  it('otro error de Supabase → invalido', () => {
    expect(authLinkErrorFromUrl('#error=server_error&error_description=boom', '')).toBe('invalido');
    expect(authLinkErrorFromUrl('', '?error_code=bad_jwt')).toBe('invalido');
  });

  it('sin error en la URL (acceso directo o sesión válida) → null', () => {
    expect(authLinkErrorFromUrl('', '')).toBeNull();
    expect(authLinkErrorFromUrl('#access_token=abc&type=recovery', '')).toBeNull();
    expect(authLinkErrorFromUrl('', '?returnUrl=%2Fapp')).toBeNull();
  });
});

describe('authLinkErrorMessage', () => {
  it('vencido → pide un enlace nuevo explicando que venció o ya se usó', () => {
    expect(authLinkErrorMessage('vencido')).toBe(
      'El enlace para restablecer tu contraseña venció o ya se usó. Pide uno nuevo con tu correo.',
    );
  });

  it('invalido → pide un enlace nuevo explicando que no es válido', () => {
    expect(authLinkErrorMessage('invalido')).toBe(
      'El enlace para restablecer tu contraseña no es válido. Pide uno nuevo con tu correo.',
    );
  });

  it('cualquier otro valor del parámetro → null (no se inventa un aviso)', () => {
    expect(authLinkErrorMessage(null)).toBeNull();
    expect(authLinkErrorMessage('')).toBeNull();
    expect(authLinkErrorMessage('<script>')).toBeNull();
  });
});

// F9 (D07 + D10 con sesión abierta): supabase-js no cierra la sesión que había cuando el enlace
// falla, así que el aviso va a la cuenta que sigue abierta y dice cuál es.
describe('authLinkErrorSessionNotice', () => {
  it('vencido → explica que no cambió nada y con qué cuenta se sigue', () => {
    expect(authLinkErrorSessionNotice('vencido', 'admin@escuela.cl')).toEqual({
      summary: 'El enlace venció o ya se usó',
      detail:
        'No se cambió ninguna contraseña. Sigues con la sesión de admin@escuela.cl; para cambiar la de otra cuenta, cierra sesión y pide un enlace nuevo.',
    });
  });

  it('invalido → mismo detalle, otro título', () => {
    const notice = authLinkErrorSessionNotice('invalido', 'admin@escuela.cl');
    expect(notice.summary).toBe('El enlace no es válido');
    expect(notice.detail).toContain('admin@escuela.cl');
  });

  it('sin correo cargado → no deja un hueco en el texto', () => {
    expect(authLinkErrorSessionNotice('vencido', undefined).detail).toContain(
      'Sigues con la sesión de tu cuenta;',
    );
  });
});
