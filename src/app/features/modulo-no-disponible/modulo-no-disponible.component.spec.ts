import { resolveModuloNoDisponibleAction } from './modulo-no-disponible.component';

// ─── fix-261-m: el botón no debe cerrar la sesión de admin/secretaria ───────
describe('resolveModuloNoDisponibleAction', () => {
  it('admin → vuelve a su dashboard sin logout', () => {
    expect(resolveModuloNoDisponibleAction('admin')).toBe('dashboard');
  });

  it('secretaria → vuelve a su dashboard sin logout', () => {
    expect(resolveModuloNoDisponibleAction('secretaria')).toBe('dashboard');
  });

  it('instructor → cierra sesión (portal bloqueado en el piloto)', () => {
    expect(resolveModuloNoDisponibleAction('instructor')).toBe('logout');
  });

  it('alumno → cierra sesión (portal bloqueado en el piloto)', () => {
    expect(resolveModuloNoDisponibleAction('alumno')).toBe('logout');
  });

  it('rol desconocido → cierra sesión', () => {
    expect(resolveModuloNoDisponibleAction('unknown')).toBe('logout');
  });

  it('sin sesión (matrícula pública) → va al login sin logout', () => {
    expect(resolveModuloNoDisponibleAction(undefined)).toBe('login');
  });
});
