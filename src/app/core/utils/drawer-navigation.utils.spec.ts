import { isRouteChange } from './drawer-navigation.utils';

describe('isRouteChange (hotfix-061-b)', () => {
  it('otro path → true (el drawer se cierra)', () => {
    expect(isRouteChange('/app/admin/alumnos', '/app/admin/agenda')).toBe(true);
  });

  it('mismo path con otra query o fragmento → false', () => {
    expect(isRouteChange('/app/admin/asistencia', '/app/admin/asistencia?tab=ciclos')).toBe(false);
    expect(isRouteChange('/app/admin/asistencia?tab=a', '/app/admin/asistencia#x')).toBe(false);
  });

  it('una barra final no cuenta como cambio', () => {
    expect(isRouteChange('/app/admin/agenda/', '/app/admin/agenda')).toBe(false);
  });
});
