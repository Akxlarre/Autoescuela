import { isWeekBeyondVisibilityLimit } from './agenda-semanal.component';

describe('isWeekBeyondVisibilityLimit — límite de visualización de Agenda', () => {
  it('no deshabilita si no hay fecha límite configurada', () => {
    expect(isWeekBeyondVisibilityLimit('2026-09-18', null)).toBe(false);
  });

  it('no deshabilita si el fin de la semana actual es anterior a la fecha límite', () => {
    expect(isWeekBeyondVisibilityLimit('2026-09-18', '2026-12-14')).toBe(false);
  });

  it('deshabilita cuando el fin de la semana actual alcanza exactamente la fecha límite', () => {
    expect(isWeekBeyondVisibilityLimit('2026-12-14', '2026-12-14')).toBe(true);
  });

  it('deshabilita cuando el fin de la semana actual ya pasó la fecha límite', () => {
    expect(isWeekBeyondVisibilityLimit('2026-12-20', '2026-12-14')).toBe(true);
  });

  it('no deshabilita si todavía no hay weekEnd (carga inicial, weekData null)', () => {
    expect(isWeekBeyondVisibilityLimit(undefined, '2026-12-14')).toBe(false);
    expect(isWeekBeyondVisibilityLimit(null, '2026-12-14')).toBe(false);
  });
});
