import { resolveNotificationRoute } from './topbar.component';

// ─── fix-092: deep-link de notificación class_b para secretaria ─────────────
describe('resolveNotificationRoute — referenceType "class_b"', () => {
  it('navega a /app/secretaria/agenda cuando el rol es secretary', () => {
    expect(resolveNotificationRoute('class_b', 1, 'secretary')).toBe('/app/secretaria/agenda');
  });

  it('navega a /app/secretaria/agenda cuando el rol es secretaria', () => {
    expect(resolveNotificationRoute('class_b', 1, 'secretaria')).toBe('/app/secretaria/agenda');
  });

  it('sigue devolviendo /app/instructor/horario para instructor (no regresión)', () => {
    expect(resolveNotificationRoute('class_b', 1, 'instructor')).toBe('/app/instructor/horario');
  });

  it('sigue devolviendo /app/alumno/horario para alumno (no regresión)', () => {
    expect(resolveNotificationRoute('class_b', 1, 'alumno')).toBe('/app/alumno/horario');
  });

  it('devuelve null para un rol sin ruta definida (admin)', () => {
    expect(resolveNotificationRoute('class_b', 1, 'admin')).toBeNull();
  });
});
