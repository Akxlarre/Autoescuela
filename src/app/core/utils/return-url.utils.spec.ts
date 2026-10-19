import { loginQueryParams, safeReturnUrl } from './return-url.utils';

describe('return-url.utils (hotfix-096-b, A18)', () => {
  it.each([
    ['/app/admin/pagos', '/app/admin/pagos'],
    ['/app/secretaria/alumnos/42?enrollment=7', '/app/secretaria/alumnos/42?enrollment=7'],
  ])('acepta rutas internas de la app: %s', (raw, esperado) => {
    expect(safeReturnUrl(raw)).toBe(esperado);
  });

  it.each([
    null,
    undefined,
    '',
    '/app',
    '/login',
    'https://otro-sitio.cl/app/admin',
    '//otro-sitio.cl/app/admin',
    '/app/..//otro-sitio.cl',
    '/app\\@otro-sitio.cl',
    'javascript:alert(1)',
  ])('rechaza lo que no es una pantalla interna: %s', (raw) => {
    expect(safeReturnUrl(raw)).toBeNull();
  });

  it('loginQueryParams solo agrega returnUrl si es segura', () => {
    expect(loginQueryParams('/app/admin/pagos')).toEqual({ returnUrl: '/app/admin/pagos' });
    expect(loginQueryParams('/app')).toBeUndefined();
    expect(loginQueryParams(undefined)).toBeUndefined();
  });
});
