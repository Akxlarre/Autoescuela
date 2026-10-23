import {
  ALIVE_COOKIE,
  shouldDiscardStoredSession,
  supabaseStorageKey,
} from './remember-session.utils';

describe('remember-session.utils (fix-229-b, A19)', () => {
  it('casilla marcada (sin preferencia guardada) → nunca se descarta', () => {
    expect(shouldDiscardStoredSession(null, '')).toBe(false);
    expect(shouldDiscardStoredSession(null, `${ALIVE_COOKIE}=1`)).toBe(false);
  });

  it('desmarcada y el navegador sigue abierto (está la cookie) → se conserva', () => {
    expect(shouldDiscardStoredSession('0', `otra=x; ${ALIVE_COOKIE}=1`)).toBe(false);
  });

  it('desmarcada y el navegador se cerró (no está la cookie) → se descarta', () => {
    expect(shouldDiscardStoredSession('0', '')).toBe(true);
    expect(shouldDiscardStoredSession('0', 'otra=x')).toBe(true);
    // Una cookie con nombre parecido no cuenta.
    expect(shouldDiscardStoredSession('0', `x${ALIVE_COOKIE}=1`)).toBe(true);
  });

  it('supabaseStorageKey usa el subdominio del proyecto, igual que supabase-js', () => {
    expect(supabaseStorageKey('https://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token');
  });
});
