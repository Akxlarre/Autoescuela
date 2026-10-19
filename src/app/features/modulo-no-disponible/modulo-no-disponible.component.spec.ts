import {
  moduloNoDisponibleLabel,
  resolveModuloNoDisponibleAction,
} from './modulo-no-disponible.component';

// ─── hotfix-092-b (J04/S16): mientras la sesión se restaura no se sabe el rol ───
describe('moduloNoDisponibleLabel', () => {
  it('sesión todavía restaurándose → "Volver" (no "inicio de sesión")', () => {
    expect(moduloNoDisponibleLabel('login', false)).toBe('Volver');
    expect(moduloNoDisponibleLabel('dashboard', false)).toBe('Volver');
  });

  it('sesión lista → el texto de siempre', () => {
    expect(moduloNoDisponibleLabel('dashboard', true)).toBe('Volver al inicio');
    expect(moduloNoDisponibleLabel('logout', true)).toBe('Volver al inicio de sesión');
    expect(moduloNoDisponibleLabel('login', true)).toBe('Volver al inicio de sesión');
  });
});

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
