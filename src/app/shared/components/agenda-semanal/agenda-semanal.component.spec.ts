import { addDaysToIso, isDateBeyondLimit, isNextWeekBeyondLimit } from './agenda-semanal.component';

describe('addDaysToIso', () => {
  it('suma días dentro del mismo mes', () => {
    expect(addDaysToIso('2026-09-14', 3)).toBe('2026-09-17');
  });

  it('cruza el límite de mes correctamente', () => {
    expect(addDaysToIso('2026-09-28', 7)).toBe('2026-10-05');
  });

  it('cruza el límite de año correctamente', () => {
    expect(addDaysToIso('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('soporta días negativos (retroceder)', () => {
    expect(addDaysToIso('2026-09-14', -7)).toBe('2026-09-07');
  });
});

describe('isDateBeyondLimit — bloqueo por día individual', () => {
  it('no bloquea si no hay fecha límite configurada', () => {
    expect(isDateBeyondLimit('2026-12-20', null)).toBe(false);
  });

  it('no bloquea un día anterior o igual a la fecha límite', () => {
    expect(isDateBeyondLimit('2026-12-14', '2026-12-14')).toBe(false);
    expect(isDateBeyondLimit('2026-12-10', '2026-12-14')).toBe(false);
  });

  it('bloquea un día posterior a la fecha límite', () => {
    expect(isDateBeyondLimit('2026-12-15', '2026-12-14')).toBe(true);
  });

  it('no bloquea si no hay fecha (carga inicial)', () => {
    expect(isDateBeyondLimit(undefined, '2026-12-14')).toBe(false);
    expect(isDateBeyondLimit(null, '2026-12-14')).toBe(false);
  });
});

describe('isNextWeekBeyondLimit — bloqueo de la flecha "Semana siguiente"', () => {
  it('no deshabilita si no hay fecha límite configurada', () => {
    expect(isNextWeekBeyondLimit('2026-09-14', null)).toBe(false);
  });

  it('no deshabilita si la próxima semana todavía tiene días válidos', () => {
    // Semana actual: 2026-09-14 (lun) a 2026-09-18 (vie). Próxima semana
    // empieza 2026-09-21, que sigue dentro del límite (2026-12-14).
    expect(isNextWeekBeyondLimit('2026-09-14', '2026-12-14')).toBe(false);
  });

  it('no deshabilita en la última semana con al menos un día válido (semana "límite" mixta)', () => {
    // Semana actual empieza 2026-12-07 (lun). Próxima semana empieza
    // 2026-12-14 — coincide exactamente con el límite, así que esa próxima
    // semana SÍ tiene un día válido (el lunes 14) → no se deshabilita todavía.
    expect(isNextWeekBeyondLimit('2026-12-07', '2026-12-14')).toBe(false);
  });

  it('deshabilita cuando la próxima semana sería enteramente fantasma (0 días válidos)', () => {
    // Semana actual empieza 2026-12-14 (contiene el límite). Próxima semana
    // empezaría 2026-12-21, totalmente después del límite (2026-12-14).
    expect(isNextWeekBeyondLimit('2026-12-14', '2026-12-14')).toBe(true);
  });

  it('no deshabilita si todavía no hay weekStart (carga inicial)', () => {
    expect(isNextWeekBeyondLimit(undefined, '2026-12-14')).toBe(false);
    expect(isNextWeekBeyondLimit(null, '2026-12-14')).toBe(false);
  });
});
